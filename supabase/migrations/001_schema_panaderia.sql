-- ============================================================
-- ESQUEMA PANADERÍA - Supabase
-- Crear dentro de la cuenta existente (foodies)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Crear esquema separado para no interferir con "foodies"
CREATE SCHEMA IF NOT EXISTS panaderia;

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas por texto

-- ============================================================
-- ROLES Y USUARIOS
-- ============================================================

CREATE TABLE panaderia.roles (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE -- 'admin', 'gestor', 'vendedor'
);

INSERT INTO panaderia.roles (name) VALUES ('admin'), ('gestor'), ('vendedor');

-- Tabla de perfiles vinculada a auth.users de Supabase
CREATE TABLE panaderia.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  role_id    INT  NOT NULL REFERENCES panaderia.roles(id) DEFAULT 3,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CATEGORÍAS Y PRODUCTOS
-- ============================================================

CREATE TABLE panaderia.categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,       -- 'Panes', 'Facturas', 'Bebidas', etc.
  icon       TEXT,                       -- emoji o nombre de ícono
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO panaderia.categories (name, icon, sort_order) VALUES
  ('Panes',     '🍞', 1),
  ('Facturas',  '🥐', 2),
  ('Tortillas', '🫓', 3),
  ('Fiambres',  '🥩', 4),
  ('Lácteos',   '🥛', 5),
  ('Bebidas',   '🥤', 6),
  ('Otros',     '📦', 7);

-- Tipo de producto: 'horneado' (producción propia) | 'comprado' (para reventa)
CREATE TABLE panaderia.products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  category_id  INT  REFERENCES panaderia.categories(id),
  product_type TEXT NOT NULL CHECK (product_type IN ('horneado', 'comprado')),
  unit         TEXT NOT NULL DEFAULT 'unidad' CHECK (unit IN ('unidad', 'gramo')),
  price        NUMERIC(10,2) NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Promociones por cantidad: ej. 10 tortillas = $3500
CREATE TABLE panaderia.promos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES panaderia.products(id) ON DELETE CASCADE,
  min_qty     INT         NOT NULL, -- cantidad mínima para activar la promo
  promo_price NUMERIC(10,2) NOT NULL, -- precio TOTAL de ese pack
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROVEEDORES
-- ============================================================

CREATE TABLE panaderia.providers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  contact        TEXT,
  phone          TEXT,
  default_margin NUMERIC(5,2) NOT NULL DEFAULT 40, -- % margen sugerido
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- COMPRAS DE PRODUCTOS PARA REVENTA
-- ============================================================

CREATE TABLE panaderia.purchase_orders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id  UUID REFERENCES panaderia.providers(id),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  margin_used  NUMERIC(5,2) NOT NULL, -- margen aplicado en esta compra
  total_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   UUID REFERENCES panaderia.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE panaderia.purchase_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES panaderia.purchase_orders(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES panaderia.products(id), -- NULL si es producto nuevo
  product_name     TEXT NOT NULL, -- nombre en caso de que sea nuevo
  cost_price       NUMERIC(10,2) NOT NULL,
  suggested_price  NUMERIC(10,2) NOT NULL,
  final_price      NUMERIC(10,2) NOT NULL, -- precio que el gestor confirmó/modificó
  quantity         NUMERIC(10,3) NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- STOCK DE PRODUCCIÓN HORNEADA
-- ============================================================

CREATE TABLE panaderia.production_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES panaderia.products(id),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity   INT  NOT NULL, -- unidades cargadas por el gestor
  created_by UUID REFERENCES panaderia.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, date) -- una carga por producto por día
);

-- Vista de stock actual (producción cargada - vendido hoy)
-- Se crea como función para poder usarla dinámicamente

-- ============================================================
-- TURNOS
-- ============================================================

CREATE TABLE panaderia.shifts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('mañana', 'tarde')),
  user_id    UUID NOT NULL REFERENCES panaderia.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at  TIMESTAMPTZ,
  status     TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'cerrado')),
  UNIQUE(date, shift_type) -- un turno por franja horaria por día
);

CREATE TABLE panaderia.shift_closures (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id        UUID NOT NULL REFERENCES panaderia.shifts(id),
  -- Montos calculados por el sistema
  calc_cash       NUMERIC(10,2) NOT NULL DEFAULT 0,
  calc_transfer   NUMERIC(10,2) NOT NULL DEFAULT 0,
  calc_credit     NUMERIC(10,2) NOT NULL DEFAULT 0,
  calc_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Montos ingresados por el vendedor
  real_cash       NUMERIC(10,2) NOT NULL DEFAULT 0,
  real_transfer   NUMERIC(10,2) NOT NULL DEFAULT 0,
  real_total      NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Diferencias
  diff_cash       NUMERIC(10,2) GENERATED ALWAYS AS (real_cash - calc_cash) STORED,
  diff_transfer   NUMERIC(10,2) GENERATED ALWAYS AS (real_transfer - calc_transfer) STORED,
  diff_total      NUMERIC(10,2) GENERATED ALWAYS AS (real_total - calc_total) STORED,
  -- Stock horneado (JSON con {producto: {cargado, vendido, diferencia}})
  stock_report    JSONB,
  notes           TEXT,
  closed_by       UUID REFERENCES panaderia.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- VENTAS
-- ============================================================

-- Cuentas corrientes (clientes con fiado)
CREATE TABLE panaderia.credit_accounts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  phone      TEXT,
  balance    NUMERIC(10,2) NOT NULL DEFAULT 0, -- saldo deudor (positivo = debe)
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE panaderia.sales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id        UUID REFERENCES panaderia.shifts(id),
  seller_id       UUID REFERENCES panaderia.users(id),
  calc_total      NUMERIC(10,2) NOT NULL, -- total calculado por el sistema
  final_total     NUMERIC(10,2) NOT NULL, -- total cobrado (puede diferir si vendedor modifica)
  discount        NUMERIC(10,2) NOT NULL DEFAULT 0, -- diferencia si hubo modificación
  discount_reason TEXT,                  -- motivo del descuento/modificación
  status          TEXT NOT NULL DEFAULT 'activa' CHECK (status IN ('activa', 'anulada')),
  credit_account_id UUID REFERENCES panaderia.credit_accounts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE panaderia.sale_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id    UUID NOT NULL REFERENCES panaderia.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES panaderia.products(id),
  product_name TEXT NOT NULL, -- snapshot del nombre al momento de la venta
  quantity   NUMERIC(10,3) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL, -- precio unitario aplicado
  subtotal   NUMERIC(10,2) NOT NULL, -- puede incluir promo
  promo_applied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pagos (permite pagos mixtos: una venta puede tener 2 registros)
CREATE TABLE panaderia.payments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id        UUID NOT NULL REFERENCES panaderia.sales(id) ON DELETE CASCADE,
  method         TEXT NOT NULL CHECK (method IN ('efectivo', 'transferencia', 'cuenta_corriente')),
  amount         NUMERIC(10,2) NOT NULL,
  credit_account_id UUID REFERENCES panaderia.credit_accounts(id), -- si es fiado
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Pagos de cuenta corriente (abonos de deuda)
CREATE TABLE panaderia.credit_payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  credit_account_id UUID NOT NULL REFERENCES panaderia.credit_accounts(id),
  amount            NUMERIC(10,2) NOT NULL,
  method            TEXT NOT NULL DEFAULT 'efectivo',
  notes             TEXT,
  registered_by     UUID REFERENCES panaderia.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDITORÍA
-- ============================================================

CREATE TABLE panaderia.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES panaderia.users(id),
  action      TEXT NOT NULL, -- 'crear', 'modificar', 'eliminar', 'anular', 'cerrar_turno', etc.
  table_name  TEXT NOT NULL,
  record_id   TEXT,          -- UUID del registro afectado
  old_data    JSONB,         -- datos anteriores
  new_data    JSONB,         -- datos nuevos
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Función: calcular stock disponible de un producto horneado en una fecha
CREATE OR REPLACE FUNCTION panaderia.get_stock(p_product_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS INT AS $$
DECLARE
  v_produced INT;
  v_sold     NUMERIC;
BEGIN
  SELECT COALESCE(quantity, 0) INTO v_produced
  FROM panaderia.production_logs
  WHERE product_id = p_product_id AND date = p_date;

  SELECT COALESCE(SUM(si.quantity), 0) INTO v_sold
  FROM panaderia.sale_items si
  JOIN panaderia.sales s ON s.id = si.sale_id
  WHERE si.product_id = p_product_id
    AND s.status = 'activa'
    AND DATE(s.created_at) = p_date;

  RETURN COALESCE(v_produced, 0) - FLOOR(v_sold);
END;
$$ LANGUAGE plpgsql;

-- Trigger: actualizar updated_at en products
CREATE OR REPLACE FUNCTION panaderia.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON panaderia.products
  FOR EACH ROW EXECUTE FUNCTION panaderia.update_updated_at();

-- Trigger: auditoría automática en sales (anulaciones)
CREATE OR REPLACE FUNCTION panaderia.audit_sale_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO panaderia.audit_logs (user_id, action, table_name, record_id, old_data, new_data, description)
    VALUES (
      auth.uid(),
      'modificar',
      'sales',
      NEW.id::TEXT,
      row_to_json(OLD)::JSONB,
      row_to_json(NEW)::JSONB,
      'Cambio de estado de venta: ' || OLD.status || ' → ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sales_audit_trigger
  AFTER UPDATE ON panaderia.sales
  FOR EACH ROW EXECUTE FUNCTION panaderia.audit_sale_change();

-- Trigger: actualizar balance de cuenta corriente al registrar un pago
CREATE OR REPLACE FUNCTION panaderia.update_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.method = 'cuenta_corriente' AND NEW.credit_account_id IS NOT NULL THEN
    UPDATE panaderia.credit_accounts
    SET balance = balance + NEW.amount
    WHERE id = NEW.credit_account_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_credit_trigger
  AFTER INSERT ON panaderia.payments
  FOR EACH ROW EXECUTE FUNCTION panaderia.update_credit_balance();

-- Trigger: reducir balance al registrar abono de cuenta corriente
CREATE OR REPLACE FUNCTION panaderia.reduce_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE panaderia.credit_accounts
  SET balance = balance - NEW.amount
  WHERE id = NEW.credit_account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER credit_payments_trigger
  AFTER INSERT ON panaderia.credit_payments
  FOR EACH ROW EXECUTE FUNCTION panaderia.reduce_credit_balance();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas sensibles
ALTER TABLE panaderia.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.promos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.shifts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.shift_closures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.providers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.purchase_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.credit_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE panaderia.audit_logs      ENABLE ROW LEVEL SECURITY;

-- Función helper: obtener rol del usuario actual
CREATE OR REPLACE FUNCTION panaderia.get_user_role()
RETURNS TEXT AS $$
  SELECT r.name FROM panaderia.users u
  JOIN panaderia.roles r ON r.id = u.role_id
  WHERE u.id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Política base: todos los usuarios autenticados ven productos activos
CREATE POLICY "productos_lectura" ON panaderia.products
  FOR SELECT USING (auth.role() = 'authenticated' AND active = true);

CREATE POLICY "productos_escritura" ON panaderia.products
  FOR ALL USING (panaderia.get_user_role() IN ('admin', 'gestor'));

-- Ventas: el vendedor solo ve las de su turno, gestor/admin ven todo
CREATE POLICY "ventas_lectura" ON panaderia.sales
  FOR SELECT USING (
    auth.role() = 'authenticated' AND (
      panaderia.get_user_role() IN ('admin', 'gestor')
      OR seller_id = auth.uid()
    )
  );

CREATE POLICY "ventas_escritura" ON panaderia.sales
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ventas_update" ON panaderia.sales
  FOR UPDATE USING (
    -- Vendedor solo puede actualizar sus propias ventas en turno abierto
    -- Gestor y admin pueden modificar cualquiera
    panaderia.get_user_role() IN ('admin', 'gestor')
    OR (seller_id = auth.uid() AND status = 'activa')
  );

-- Sale items: hereda permisos de sales
CREATE POLICY "sale_items_lectura" ON panaderia.sale_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sale_items_escritura" ON panaderia.sale_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Production logs: solo gestor y admin
CREATE POLICY "production_logs_all" ON panaderia.production_logs
  FOR ALL USING (panaderia.get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "production_logs_lectura" ON panaderia.production_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Proveedores y compras: gestor y admin
CREATE POLICY "providers_all" ON panaderia.providers
  FOR ALL USING (panaderia.get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "purchase_orders_all" ON panaderia.purchase_orders
  FOR ALL USING (panaderia.get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "purchase_items_all" ON panaderia.purchase_items
  FOR ALL USING (panaderia.get_user_role() IN ('admin', 'gestor'));

-- Turnos: cualquier autenticado puede leer, vendedor crea y cierra el suyo
CREATE POLICY "shifts_lectura" ON panaderia.shifts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "shifts_escritura" ON panaderia.shifts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "shifts_update" ON panaderia.shifts
  FOR UPDATE USING (
    panaderia.get_user_role() IN ('admin', 'gestor')
    OR user_id = auth.uid()
  );

-- Cierres de turno
CREATE POLICY "shift_closures_lectura" ON panaderia.shift_closures
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "shift_closures_escritura" ON panaderia.shift_closures
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Cuentas corrientes: todos ven, gestor modifica
CREATE POLICY "credit_accounts_lectura" ON panaderia.credit_accounts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "credit_accounts_escritura" ON panaderia.credit_accounts
  FOR ALL USING (panaderia.get_user_role() IN ('admin', 'gestor'));

-- Pagos
CREATE POLICY "payments_lectura" ON panaderia.payments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "payments_escritura" ON panaderia.payments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Credit payments
CREATE POLICY "credit_payments_lectura" ON panaderia.credit_payments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "credit_payments_escritura" ON panaderia.credit_payments
  FOR INSERT WITH CHECK (panaderia.get_user_role() IN ('admin', 'gestor'));

-- Audit logs: solo lectura para gestor/admin, el sistema escribe
CREATE POLICY "audit_logs_lectura" ON panaderia.audit_logs
  FOR SELECT USING (panaderia.get_user_role() IN ('admin', 'gestor'));

CREATE POLICY "audit_logs_escritura" ON panaderia.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users
CREATE POLICY "users_lectura" ON panaderia.users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "users_escritura" ON panaderia.users
  FOR ALL USING (panaderia.get_user_role() = 'admin');

-- Promos
CREATE POLICY "promos_lectura" ON panaderia.promos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "promos_escritura" ON panaderia.promos
  FOR ALL USING (panaderia.get_user_role() IN ('admin', 'gestor'));

-- ============================================================
-- DATOS DE EJEMPLO (opcional, para testing)
-- ============================================================

-- Productos de ejemplo
INSERT INTO panaderia.products (name, category_id, product_type, unit, price) VALUES
  ('Pan de molde', 1, 'horneado', 'unidad', 350),
  ('Medialuna', 2, 'horneado', 'unidad', 250),
  ('Tortilla', 3, 'horneado', 'unidad', 400),
  ('Facturas surtidas', 2, 'horneado', 'unidad', 300),
  ('Jamón cocido', 4, 'comprado', 'gramo', 2.50),
  ('Queso en barra', 4, 'comprado', 'gramo', 3.00),
  ('Coca-Cola 500ml', 6, 'comprado', 'unidad', 800),
  ('Leche entera 1L', 5, 'comprado', 'unidad', 900);

-- Promo de tortillas: 10 = $3500
INSERT INTO panaderia.promos (product_id, min_qty, promo_price)
SELECT id, 10, 3500 FROM panaderia.products WHERE name = 'Tortilla';
