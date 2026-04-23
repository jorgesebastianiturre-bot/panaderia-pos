# 🍞 Sistema de Gestión — Panadería

Sistema de punto de venta, control de stock de producción, compras y cuentas corrientes. Construido con React + Supabase.

---

## Estructura del proyecto

```
panaderia/
├── src/
│   ├── components/
│   │   ├── pos/           # Componentes del punto de venta
│   │   └── shared/        # Layout, ProtectedRoute
│   ├── context/           # AuthContext, ShiftContext
│   ├── lib/               # Cliente Supabase, helpers
│   └── pages/             # Páginas de la app
├── supabase/
│   └── migrations/
│       └── 001_schema_panaderia.sql   ← ejecutar esto primero
├── .env.example
└── package.json
```

---

## 1. Configurar Supabase

### 1.1 Ir al proyecto existente (foodies)

Entrá a [supabase.com](https://supabase.com) → tu proyecto → **SQL Editor**.

### 1.2 Ejecutar el schema

Copiá y pegá todo el contenido de `supabase/migrations/001_schema_panaderia.sql` en el editor SQL y ejecutalo.

Esto crea:
- Esquema `panaderia` separado del esquema de foodies
- Todas las tablas, funciones, triggers y políticas RLS
- Datos de ejemplo (productos y categorías base)

### 1.3 Crear el primer usuario administrador

En Supabase → **Authentication** → **Users** → **Add user**:
- Email: tu email
- Password: la que elijas
- Confirm user: ✓ (marcá "Auto-confirm")

Después, en el SQL Editor, ejecutá esto para asignarle el rol admin:

```sql
INSERT INTO panaderia.users (id, full_name, role_id)
VALUES (
  'UUID-DEL-USUARIO',   -- copiá el UUID de Authentication → Users
  'Tu Nombre',
  1                     -- 1 = admin
);
```

Para crear vendedores o gestores, repetí el proceso con `role_id = 2` (gestor) o `role_id = 3` (vendedor).

### 1.4 Obtener las credenciales

En Supabase → **Settings** → **API**:
- Copiá la **URL del proyecto** (ej: `https://abcde.supabase.co`)
- Copiá el **anon public key**

---

## 2. Configurar el proyecto local

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/panaderia-pos.git
cd panaderia-pos

# Instalar dependencias
npm install

# Copiar el archivo de variables de entorno
cp .env.example .env.local
```

Editá `.env.local` con tus datos de Supabase:

```
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

Iniciar en modo desarrollo:

```bash
npm run dev
```

---

## 3. Desplegar en Vercel

1. Subir el código a un repositorio de GitHub
2. Ir a [vercel.com](https://vercel.com) → **New Project** → importar el repo
3. En **Environment Variables**, agregar:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Hacer clic en **Deploy**

El archivo `vercel.json` ya está configurado para manejar el routing de React.

---

## 4. Cómo usar el sistema

### 🔑 Roles y permisos

| Acción                          | Vendedor | Gestor | Admin |
|---------------------------------|----------|--------|-------|
| Registrar ventas                | ✓        | ✓      | ✓     |
| Cerrar su turno                 | ✓        | ✓      | ✓     |
| Cargar stock de producción      | ✗        | ✓      | ✓     |
| Registrar compras               | ✗        | ✓      | ✓     |
| Editar productos y precios      | ✗        | ✓      | ✓     |
| Ver reportes                    | ✗        | ✓      | ✓     |
| Gestionar usuarios              | ✗        | ✗      | ✓     |
| Reabrir turnos cerrados         | ✗        | ✗      | ✓     |

---

### 📋 Abrir un turno

1. Iniciar sesión
2. En el panel lateral, hacer clic en **"☀️ Abrir turno mañana"** o **"🌙 Abrir turno tarde"**
3. El sistema asigna el turno al usuario actual y a la fecha de hoy
4. Se redirige automáticamente al punto de venta

---

### 🛒 Hacer una venta

1. Tocá una **categoría** (Panes, Facturas, Bebidas...)
2. Tocá el **producto** — aparece el teclado numérico
3. Ingresá la **cantidad** (unidades o gramos para fiambres)
4. El sistema calcula el subtotal **aplicando promociones automáticamente**
   - Ej: si tenés configurado "10 tortillas = $3500" y vendés 12:
     → 1 pack de 10 = $3500 + 2 unidades × precio unitario
5. Tocá **"💵 COBRAR"**
6. Elegí el medio de pago (Efectivo, Transferencia o Fiado)
   - Para **pago mixto**: activar "⇄ Pago mixto" y dividir el monto entre dos medios
   - Para **fiado**: seleccionar el cliente de la lista
7. Confirmar — la venta queda registrada con auditoría automática

**Si modificás el total** (descuento): tocá "Aplicar descuento" dentro del modal de cobro, ingresá el nuevo monto y el motivo. La diferencia queda registrada.

**Si el stock de un producto horneado llega a 0**: aparece una alerta pero podés seguir vendiendo (stock negativo permitido).

---

### 🍞 Cargar stock de producción (gestor)

Hacerlo cada mañana antes de abrir el turno:

1. Ir a **Producción** en el menú lateral
2. Para cada producto horneado, ingresá la cantidad producida
   - Usá los botones **−10 / +10** para ajustar rápido
3. Hacer clic en **"✅ Guardar stock del día"**

Si ya se cargó antes y hay que corregir, simplemente modificar el número y guardar de nuevo — queda registrado en auditoría.

---

### 🔒 Cerrar un turno

1. Ir a **Cerrar turno** en el menú
2. El sistema muestra los **totales calculados** (efectivo, transferencias, fiado)
3. Ingresá los **valores reales**:
   - Contá el efectivo de la caja
   - Revisá las transferencias recibidas en el banco
4. El sistema muestra las **diferencias** (faltante/sobrante)
5. Podés agregar notas de observaciones
6. Hacé clic en **"🔒 Confirmar cierre de turno"**

El cierre queda registrado aunque haya diferencias. Una vez cerrado, el vendedor no puede modificar nada de ese turno.

El reporte muestra también el **stock horneado del día**: qué se cargó vs qué se vendió.

---

### 🛒 Registrar una compra (gestor)

1. Ir a **Compras**
2. Seleccioná el **proveedor** — el margen se autocompleta con el valor por defecto del proveedor
3. Podés cambiar el margen para esta compra específica (ej: este pedido tiene mejor precio)
4. Ingresá la fecha y la forma de pago
5. Agregá productos:
   - Escribí el nombre (autocompletado de productos existentes)
   - Ingresá el **precio de costo**
   - El sistema **sugiere el precio de venta** = costo × (1 + margen/100)
   - Podés editar el precio sugerido (redondearlo, etc.)
6. **"✅ Confirmar compra"** — esto:
   - Registra la orden de compra
   - Si el producto ya existe, actualiza su precio de venta
   - Si es nuevo, lo crea en el sistema
   - Registra todo en auditoría

---

### 💰 Registrar un abono de cuenta corriente

Un cliente que debe viene a pagar parte o todo:

1. Ir a **Admin** → **Cuentas corrientes**
2. Buscar el cliente
3. Hacer clic en **"💰 Registrar abono"**
4. Ingresar el monto pagado
5. Confirmar — el saldo se reduce automáticamente

---

### 📊 Ver reportes

Ir a **Reportes** (solo gestor/admin):

- **Ventas**: filtrar por rango de fechas, ver total y descuentos
- **Stock**: ver producción vs vendido por día (mermas y excedentes)
- **Cuentas corrientes**: saldo por cliente, historial de abonos
- **Cierres**: histórico de turnos con diferencias
- **Auditoría**: log completo de cada cambio en el sistema (quién, qué, cuándo)

---

## 5. Lógica de stock negativo

El sistema **permite vender aunque el stock llegue a 0**. Esto es intencional porque:
- Puede haber un error en la carga de producción de la mañana
- Puede haber producción extra no registrada

Cuando el stock llega a 0:
- Aparece un **banner naranja** de advertencia
- El producto se muestra con borde rojo en la grilla
- Se puede seguir vendiendo normalmente

Al **cierre de turno**, el informe muestra la diferencia:
- `+30` significa que se vendieron 30 más de lo cargado (excedente de producción no registrado)
- `-15` significa que quedaron 15 sin vender (merma)

---

## 6. Estructura de la base de datos

```
panaderia.roles              — admin, gestor, vendedor
panaderia.users              — perfiles vinculados a auth.users
panaderia.categories         — Panes, Facturas, Bebidas...
panaderia.products           — productos (horneado | comprado)
panaderia.promos             — promociones por cantidad
panaderia.providers          — proveedores con margen por defecto
panaderia.purchase_orders    — cabecera de cada compra
panaderia.purchase_items     — ítems de cada compra
panaderia.production_logs    — stock horneado cargado por el gestor
panaderia.shifts             — turnos mañana/tarde
panaderia.shift_closures     — cierres con montos sistema vs real
panaderia.sales              — ventas (una por ticket)
panaderia.sale_items         — ítems de cada venta
panaderia.payments           — pagos (hasta 2 por venta para mixto)
panaderia.credit_accounts    — clientes con fiado
panaderia.credit_payments    — abonos de cuenta corriente
panaderia.audit_logs         — log de toda acción en el sistema
```

---

## 7. Fase 2 (planificada)

- Módulo de personal: empleados, horarios, comisiones
- Compras de insumos de producción (harina, levadura, etc.)
- Producción con recetas: calcular consumo de insumos por lo horneado
- Conexión automática entre producción y descuento de insumos

---

## Soporte

Ante cualquier problema, revisar primero:
1. Las variables de entorno `.env.local` estén correctas
2. El SQL de migración se ejecutó completo sin errores
3. El usuario tiene un registro en `panaderia.users` con su UUID de Supabase Auth
