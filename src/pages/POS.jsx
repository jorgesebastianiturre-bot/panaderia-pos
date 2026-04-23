// src/pages/POS.jsx
// Punto de venta principal — interfaz táctil optimizada para mostrador

import { useEffect, useState, useCallback } from 'react'
import { supabase, calcSubtotal, formatMoney } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useShift } from '../context/ShiftContext'
import NumericKeypad from '../components/pos/NumericKeypad'
import PaymentModal from '../components/pos/PaymentModal'
import DiscountModal from '../components/pos/DiscountModal'
import StockAlert from '../components/pos/StockAlert'
import toast from 'react-hot-toast'

export default function POS() {
  const { user, profile } = useAuth()
  const { shift }         = useShift()

  const [categories, setCategories] = useState([])
  const [products, setProducts]     = useState([])
  const [promos, setPromos]         = useState([])
  const [stockMap, setStockMap]     = useState({}) // { productId: stockQty }

  const [selectedCategory, setSelectedCategory] = useState(null)
  const [cart, setCart]         = useState([])   // ítems del ticket actual
  const [showKeypad, setShowKeypad]  = useState(false)
  const [pendingProduct, setPendingProduct] = useState(null) // producto esperando cantidad
  const [showPayment, setShowPayment]   = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [stockAlerts, setStockAlerts]   = useState([]) // productos en 0

  // Carga inicial
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [catRes, prodRes, promoRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('*').eq('active', true).order('name'),
      supabase.from('promos').select('*').eq('active', true),
    ])
    setCategories(catRes.data ?? [])
    setProducts(prodRes.data ?? [])
    setPromos(promoRes.data ?? [])
    if (catRes.data?.length) setSelectedCategory(catRes.data[0].id)

    // Cargar stock de productos horneados
    await loadStock(prodRes.data ?? [])
  }

  async function loadStock(prods) {
    const today    = new Date().toISOString().split('T')[0]
    const horneados = prods.filter(p => p.product_type === 'horneado')
    const stockEntries = {}

    await Promise.all(horneados.map(async p => {
      const { data } = await supabase.rpc('get_stock', {
        p_product_id: p.id,
        p_date: today,
      })
      stockEntries[p.id] = data ?? 0
    }))

    setStockMap(stockEntries)

    // Detectar alertas de stock 0
    const alerts = horneados.filter(p => (stockEntries[p.id] ?? 0) <= 0)
    setStockAlerts(alerts)
  }

  // Productos de la categoría seleccionada
  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products

  // Al tocar un producto
  function handleProductTap(product) {
    // Para fiambres (gramos): abrir teclado solicitando gramos
    setPendingProduct(product)
    setShowKeypad(true)
  }

  // Al confirmar cantidad en el teclado
  function handleQuantityConfirm(quantity) {
    if (!pendingProduct || !quantity) { setShowKeypad(false); return }

    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Cantidad inválida')
      return
    }

    // Calcular subtotal con promos
    const { subtotal, promoApplied } = calcSubtotal(pendingProduct, qty, promos)

    // Agregar o actualizar ítem en el carrito
    setCart(prev => {
      const existing = prev.findIndex(i => i.product_id === pendingProduct.id)
      if (existing >= 0) {
        const updated = [...prev]
        const newQty  = updated[existing].quantity + qty
        const { subtotal: newSub, promoApplied: pa } = calcSubtotal(pendingProduct, newQty, promos)
        updated[existing] = { ...updated[existing], quantity: newQty, subtotal: newSub, promo_applied: pa }
        return updated
      }
      return [...prev, {
        product_id:   pendingProduct.id,
        product_name: pendingProduct.name,
        quantity:     qty,
        unit:         pendingProduct.unit,
        unit_price:   pendingProduct.price,
        subtotal,
        promo_applied: promoApplied,
      }]
    })

    // Alerta si el producto horneado llegó a 0
    if (pendingProduct.product_type === 'horneado') {
      const currentStock = stockMap[pendingProduct.id] ?? 0
      if (currentStock - qty <= 0) {
        toast('⚠️ Stock en 0 — se permite continuar', { icon: '⚠️', duration: 3000 })
      }
      // Actualizar stock local (optimista)
      setStockMap(prev => ({ ...prev, [pendingProduct.id]: currentStock - qty }))
    }

    setPendingProduct(null)
    setShowKeypad(false)
  }

  // Eliminar ítem del carrito
  function removeItem(index) {
    setCart(prev => prev.filter((_, i) => i !== index))
  }

  // Total calculado
  const calcTotal = cart.reduce((acc, i) => acc + i.subtotal, 0)

  // Confirmar venta con un solo medio de pago
  async function confirmSale(paymentData) {
    if (!shift) {
      toast.error('No hay turno abierto. Abrí un turno primero.')
      return
    }
    if (cart.length === 0) {
      toast.error('El carrito está vacío')
      return
    }

    try {
      const finalTotal = paymentData.finalTotal ?? calcTotal

      // 1. Crear la venta
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          shift_id:       shift.id,
          seller_id:      user.id,
          calc_total:     calcTotal,
          final_total:    finalTotal,
          discount:       calcTotal - finalTotal,
          discount_reason: paymentData.discountReason ?? null,
          credit_account_id: paymentData.creditAccountId ?? null,
        })
        .select()
        .single()

      if (saleError) throw saleError

      // 2. Insertar ítems de la venta
      const items = cart.map(i => ({
        sale_id:       sale.id,
        product_id:    i.product_id,
        product_name:  i.product_name,
        quantity:      i.quantity,
        unit_price:    i.unit_price,
        subtotal:      i.subtotal,
        promo_applied: i.promo_applied,
      }))
      const { error: itemsError } = await supabase.from('sale_items').insert(items)
      if (itemsError) throw itemsError

      // 3. Registrar pagos (uno o dos medios)
      const payments = paymentData.payments.map(p => ({
        sale_id:           sale.id,
        method:            p.method,
        amount:            p.amount,
        credit_account_id: p.method === 'cuenta_corriente' ? p.creditAccountId : null,
      }))
      const { error: paymentsError } = await supabase.from('payments').insert(payments)
      if (paymentsError) throw paymentsError

      toast.success('✅ Venta registrada')
      setCart([])
      setShowPayment(false)
      await loadStock(products) // refrescar stock
    } catch (err) {
      console.error(err)
      toast.error('Error al registrar la venta')
    }
  }

  return (
    <div style={styles.container}>
      {/* ── Alertas de stock ─────────────────────── */}
      {stockAlerts.length > 0 && (
        <StockAlert products={stockAlerts} onDismiss={() => setStockAlerts([])} />
      )}

      <div style={styles.layout}>
        {/* ── PANEL IZQUIERDO: Categorías + Productos ── */}
        <div style={styles.left}>
          {/* Categorías */}
          <div style={styles.categories}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  ...styles.catBtn,
                  ...(selectedCategory === cat.id ? styles.catBtnActive : {}),
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{cat.icon}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Grilla de productos */}
          <div style={styles.productsGrid}>
            {filteredProducts.map(product => {
              const stock = stockMap[product.id]
              const isLow = product.product_type === 'horneado' && (stock ?? 1) <= 0
              return (
                <button
                  key={product.id}
                  onClick={() => handleProductTap(product)}
                  style={{ ...styles.productBtn, ...(isLow ? styles.productBtnLow : {}) }}
                >
                  <span style={styles.productName}>{product.name}</span>
                  <span style={styles.productPrice}>{formatMoney(product.price)}</span>
                  {product.product_type === 'horneado' && (
                    <span style={{ ...styles.stockBadge, background: isLow ? '#ef4444' : '#22c55e' }}>
                      Stock: {stock ?? '—'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── PANEL DERECHO: Ticket ─────────────────── */}
        <div style={styles.right}>
          <div style={styles.ticketHeader}>
            <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>🧾 Ticket</span>
            {shift && (
              <span style={styles.shiftBadge}>
                Turno {shift.shift_type}
              </span>
            )}
          </div>

          {/* Ítems del carrito */}
          <div style={styles.cartItems}>
            {cart.length === 0 ? (
              <p style={styles.emptyCart}>Tocá un producto para agregar</p>
            ) : (
              cart.map((item, i) => (
                <div key={i} style={styles.cartItem}>
                  <div style={styles.cartItemInfo}>
                    <span style={styles.cartItemName}>{item.product_name}</span>
                    <span style={styles.cartItemQty}>
                      {item.unit === 'gramo'
                        ? `${item.quantity}g`
                        : `× ${item.quantity}`}
                      {item.promo_applied && ' 🏷️'}
                    </span>
                  </div>
                  <div style={styles.cartItemRight}>
                    <span style={styles.cartItemTotal}>{formatMoney(item.subtotal)}</span>
                    <button onClick={() => removeItem(i)} style={styles.removeBtn}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total */}
          <div style={styles.totalSection}>
            <div style={styles.totalRow}>
              <span>TOTAL</span>
              <span style={styles.totalAmount}>{formatMoney(calcTotal)}</span>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setShowDiscount(true)}
                style={styles.discountBtn}
              >
                Aplicar descuento
              </button>
            )}
          </div>

          {/* Botones de cobro */}
          <div style={styles.payButtons}>
            <button
              onClick={() => cart.length > 0 && setShowPayment(true)}
              disabled={cart.length === 0}
              style={{ ...styles.payBtn, background: '#16a34a' }}
            >
              💵 COBRAR
            </button>
            <button
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              style={{ ...styles.payBtn, background: '#dc2626', flex: '0 0 auto', padding: '0 1.5rem' }}
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      {/* ── Modales ─────────────────────────────── */}
      {showKeypad && (
        <NumericKeypad
          product={pendingProduct}
          onConfirm={handleQuantityConfirm}
          onClose={() => { setShowKeypad(false); setPendingProduct(null) }}
        />
      )}

      {showPayment && (
        <PaymentModal
          total={calcTotal}
          onConfirm={confirmSale}
          onClose={() => setShowPayment(false)}
        />
      )}

      {showDiscount && (
        <DiscountModal
          calcTotal={calcTotal}
          onConfirm={(finalTotal, reason) => {
            // Actualizar el precio final al confirmar el pago
            setShowDiscount(false)
          }}
          onClose={() => setShowDiscount(false)}
        />
      )}
    </div>
  )
}

// ── Estilos ──────────────────────────────────────────────────
const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f8f4ef',
    overflow: 'hidden',
  },
  layout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: '0',
  },
  // Panel izquierdo
  left: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRight: '2px solid #e5d5c0',
  },
  categories: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem',
    background: 'white',
    borderBottom: '2px solid #e5d5c0',
    overflowX: 'auto',
    flexShrink: 0,
  },
  catBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.6rem 1rem',
    border: '2px solid #e5d5c0',
    borderRadius: '0.75rem',
    background: 'white',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minWidth: '70px',
    transition: 'all 0.15s',
  },
  catBtnActive: {
    background: '#c8860a',
    borderColor: '#c8860a',
    color: 'white',
  },
  productsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '0.75rem',
    padding: '0.75rem',
    overflowY: 'auto',
    flex: 1,
  },
  productBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '1.25rem 0.75rem',
    background: 'white',
    border: '2px solid #e5d5c0',
    borderRadius: '1rem',
    cursor: 'pointer',
    minHeight: '100px',
    transition: 'all 0.15s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
  },
  productBtnLow: {
    borderColor: '#ef4444',
    background: '#fff5f5',
  },
  productName: { fontWeight: '600', fontSize: '0.9rem', textAlign: 'center', color: '#2d1b00' },
  productPrice: { fontSize: '1rem', fontWeight: '700', color: '#c8860a' },
  stockBadge: {
    fontSize: '0.7rem',
    color: 'white',
    borderRadius: '999px',
    padding: '0.15rem 0.5rem',
    fontWeight: '700',
  },

  // Panel derecho (ticket)
  right: {
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    background: 'white',
    flexShrink: 0,
  },
  ticketHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderBottom: '2px solid #e5d5c0',
  },
  shiftBadge: {
    background: '#f5e6d3',
    color: '#c8860a',
    borderRadius: '999px',
    padding: '0.25rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cartItems: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  emptyCart: { color: '#aaa', textAlign: 'center', marginTop: '2rem', fontSize: '0.95rem' },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f8f4ef',
    borderRadius: '0.75rem',
    padding: '0.6rem 0.75rem',
  },
  cartItemInfo: { display: 'flex', flexDirection: 'column', gap: '0.1rem' },
  cartItemName: { fontWeight: '600', fontSize: '0.9rem', color: '#2d1b00' },
  cartItemQty: { fontSize: '0.8rem', color: '#888' },
  cartItemRight: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  cartItemTotal: { fontWeight: '700', color: '#c8860a', fontSize: '0.95rem' },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '0.2rem',
  },
  totalSection: {
    padding: '1rem 1.25rem',
    borderTop: '2px solid #e5d5c0',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontWeight: '700',
    fontSize: '1.1rem',
  },
  totalAmount: { fontSize: '1.5rem', color: '#c8860a' },
  discountBtn: {
    width: '100%',
    marginTop: '0.5rem',
    background: 'none',
    border: '1.5px dashed #c8860a',
    borderRadius: '0.5rem',
    color: '#c8860a',
    padding: '0.4rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
  payButtons: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem 1.25rem',
    borderTop: '2px solid #e5d5c0',
  },
  payBtn: {
    flex: 1,
    padding: '1.1rem',
    border: 'none',
    borderRadius: '0.875rem',
    color: 'white',
    fontSize: '1.1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
}
