// src/lib/supabase.js
// Cliente de Supabase configurado para el esquema "panaderia"

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'panaderia' }, // usar el esquema panaderia por defecto
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// ============================================================
// HELPERS DE AUDITORÍA
// Registra cualquier acción en la tabla audit_logs
// ============================================================
export async function logAudit({ action, tableName, recordId, oldData, newData, description }) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('audit_logs').insert({
    user_id:    user?.id,
    action,
    table_name: tableName,
    record_id:  recordId,
    old_data:   oldData,
    new_data:   newData,
    description,
  })
}

// ============================================================
// HELPERS DE STOCK
// ============================================================

// Retorna el stock actual de un producto horneado en una fecha
export async function getStock(productId, date = new Date().toISOString().split('T')[0]) {
  const { data, error } = await supabase.rpc('get_stock', {
    p_product_id: productId,
    p_date: date,
  })
  if (error) throw error
  return data
}

// ============================================================
// HELPERS DE PROMOCIONES
// Calcula el subtotal aplicando promos si corresponde
// ============================================================
export function calcSubtotal(product, quantity, promos) {
  const applicablePromos = promos
    .filter(p => p.product_id === product.id && p.active && quantity >= p.min_qty)
    .sort((a, b) => b.min_qty - a.min_qty) // mayor pack primero

  if (applicablePromos.length === 0) {
    return { subtotal: product.price * quantity, promoApplied: false }
  }

  const bestPromo = applicablePromos[0]
  const packs     = Math.floor(quantity / bestPromo.min_qty)
  const remainder = quantity % bestPromo.min_qty

  const subtotal = packs * bestPromo.promo_price + remainder * product.price
  return { subtotal, promoApplied: true }
}

// ============================================================
// HELPERS DE FORMATO
// ============================================================
export function formatMoney(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(amount ?? 0)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}
