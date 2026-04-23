import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Cliente SIN schema fijo — el schema se especifica en cada query
export const supabase = createClient(supabaseUrl, supabaseKey)

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

export function calcSubtotal(product, quantity, promos) {
  const applicablePromos = promos
    .filter(p => p.product_id === product.id && p.active && quantity >= p.min_qty)
    .sort((a, b) => b.min_qty - a.min_qty)

  if (applicablePromos.length === 0) {
    return { subtotal: product.price * quantity, promoApplied: false }
  }

  const bestPromo = applicablePromos[0]
  const packs     = Math.floor(quantity / bestPromo.min_qty)
  const remainder = quantity % bestPromo.min_qty
  const subtotal  = packs * bestPromo.promo_price + remainder * product.price
  return { subtotal, promoApplied: true }
}

export async function logAudit({ action, tableName, recordId, oldData, newData, description }) {
  const { da
