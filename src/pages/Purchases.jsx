// src/pages/Purchases.jsx
// Módulo de compras de productos para reventa con cálculo de margen automático

import { useState, useEffect } from 'react'
import { supabase, formatMoney, logAudit } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Purchases() {
  const { user } = useAuth()

  const [providers, setProviders] = useState([])
  const [products, setProducts]   = useState([])

  // Cabecera de la orden
  const [providerId, setProviderId] = useState('')
  const [margin, setMargin]         = useState(40)
  const [payMethod, setPayMethod]   = useState('efectivo')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])

  // Ítems de la compra
  const [items, setItems] = useState([
    { product_id: '', product_name: '', cost: '', suggested: 0, final_price: '' }
  ])

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('providers').select('*').eq('active', true).then(({ data }) => setProviders(data ?? []))
    supabase.from('products').select('*').eq('product_type', 'comprado').eq('active', true).then(({ data }) => setProducts(data ?? []))
  }, [])

  // Al cambiar proveedor, cargar su margen por defecto
  function handleProviderChange(pid) {
    setProviderId(pid)
    const prov = providers.find(p => p.id === pid)
    if (prov) setMargin(prov.default_margin)
  }

  // Actualizar ítem
  function updateItem(index, field, value) {
    setItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      // Recalcular precio sugerido si cambia costo o margen
      if (field === 'cost') {
        const cost      = parseFloat(value) || 0
        const suggested = Math.round(cost * (1 + margin / 100))
        updated[index].suggested   = suggested
        updated[index].final_price = suggested.toString()
      }

      return updated
    })
  }

  // Recalcular todos los sugeridos al cambiar el margen global
  function handleMarginChange(val) {
    const m = parseFloat(val) || 0
    setMargin(m)
    setItems(prev => prev.map(item => {
      const cost      = parseFloat(item.cost) || 0
      const suggested = Math.round(cost * (1 + m / 100))
      return { ...item, suggested, final_price: suggested.toString() }
    }))
  }

  function addItem() {
    setItems(prev => [...prev, { product_id: '', product_name: '', cost: '', suggested: 0, final_price: '' }])
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!providerId) { toast.error('Seleccioná un proveedor'); return }
    const validItems = items.filter(i => i.product_name && parseFloat(i.cost) > 0)
    if (!validItems.length) { toast.error('Agregá al menos un producto válido'); return }

    setSaving(true)
    try {
      const totalCost = validItems.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0)

      // 1. Crear orden de compra
      const { data: order, error: orderErr } = await supabase
        .from('purchase_orders')
        .insert({
          provider_id:   providerId,
          purchase_date: purchaseDate,
          payment_method: payMethod,
          margin_used:   margin,
          total_cost:    totalCost,
          created_by:    user.id,
        })
        .select()
        .single()

      if (orderErr) throw orderErr

      // 2. Procesar cada ítem
      for (const item of validItems) {
        const cost       = parseFloat(item.cost)
        const finalPrice = parseFloat(item.final_price) || Math.round(cost * (1 + margin / 100))
        const suggested  = Math.round(cost * (1 + margin / 100))

        // Insertar ítem de compra
        const { error: itemErr } = await supabase
          .from('purchase_items')
          .insert({
            purchase_order_id: order.id,
            product_id:        item.product_id || null,
            product_name:      item.product_name,
            cost_price:        cost,
            suggested_price:   suggested,
            final_price:       finalPrice,
            quantity:          1,
          })

        if (itemErr) throw itemErr

        // Actualizar o crear el producto con el nuevo precio
        if (item.product_id) {
          await supabase
            .from('products')
            .update({ price: finalPrice })
            .eq('id', item.product_id)

          await logAudit({
            action:      'modificar',
            tableName:   'products',
            recordId:    item.product_id,
            description: `Precio actualizado por compra. Costo: ${formatMoney(cost)}, Nuevo precio venta: ${formatMoney(finalPrice)}`,
          })
        } else {
          // Crear nuevo producto
          const { data: newProd } = await supabase
            .from('products')
            .insert({
              name:         item.product_name,
              product_type: 'comprado',
              price:        finalPrice,
            })
            .select()
            .single()

          await logAudit({
            action:      'crear',
            tableName:   'products',
            recordId:    newProd?.id,
            description: `Producto creado desde compra: ${item.product_name} @ ${formatMoney(finalPrice)}`,
          })
        }
      }

      toast.success('Compra registrada y precios actualizados')

      // Resetear formulario
      setProviderId('')
      setItems([{ product_id: '', product_name: '', cost: '', suggested: 0, final_price: '' }])
    } catch (err) {
      console.error(err)
      toast.error('Error al registrar la compra')
    } finally {
      setSaving(false)
    }
  }

  const totalCost     = items.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0)
  const selectedProv  = providers.find(p => p.id === providerId)

  return (
    <div style={container}>
      <div style={card}>
        <h1 style={pageTitle}>🛒 Nueva compra</h1>

        {/* Cabecera */}
        <div style={section}>
          <h2 style={sectionTitle}>Proveedor y condiciones</h2>

          <div style={formGrid}>
            <div style={field}>
              <label style={label}>Proveedor</label>
              <select value={providerId} onChange={e => handleProviderChange(e.target.value)} style={input}>
                <option value="">Seleccionar...</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={field}>
              <label style={label}>Margen de ganancia (%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  value={margin}
                  onChange={e => handleMarginChange(e.target.value)}
                  style={{ ...input, maxWidth: '100px' }}
                />
                {selectedProv && (
                  <span style={hint}>
                    Defecto del proveedor: {selectedProv.default_margin}%
                  </span>
                )}
              </div>
            </div>

            <div style={field}>
              <label style={label}>Fecha</label>
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} style={input} />
            </div>

            <div style={field}>
              <label style={label}>Forma de pago</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={input}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Crédito (pagar después)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ítems */}
        <div style={section}>
          <h2 style={sectionTitle}>Productos</h2>

          {items.map((item, i) => (
            <div key={i} style={itemRow}>
              {/* Nombre o selección */}
              <div style={{ flex: 2 }}>
                <label style={label}>Producto</label>
                <input
                  list={`products-list-${i}`}
                  value={item.product_name}
                  onChange={e => {
                    const name = e.target.value
                    const match = products.find(p => p.name === name)
                    updateItem(i, 'product_name', name)
                    if (match) updateItem(i, 'product_id', match.id)
                  }}
                  placeholder="Nombre del producto..."
                  style={input}
                />
                <datalist id={`products-list-${i}`}>
                  {products.map(p => <option key={p.id} value={p.name} />)}
                </datalist>
              </div>

              {/* Precio de costo */}
              <div style={{ flex: 1 }}>
                <label style={label}>Costo</label>
                <input
                  type="number"
                  value={item.cost}
                  onChange={e => updateItem(i, 'cost', e.target.value)}
                  placeholder="0"
                  style={input}
                />
              </div>

              {/* Precio sugerido */}
              <div style={{ flex: 1 }}>
                <label style={label}>Sugerido</label>
                <div style={{ ...input, background: '#f8f4ef', display: 'flex', alignItems: 'center' }}>
                  {item.suggested ? formatMoney(item.suggested) : '—'}
                </div>
              </div>

              {/* Precio final */}
              <div style={{ flex: 1 }}>
                <label style={label}>Precio venta</label>
                <input
                  type="number"
                  value={item.final_price}
                  onChange={e => updateItem(i, 'final_price', e.target.value)}
                  placeholder={item.suggested || '0'}
                  style={{ ...input, borderColor: '#c8860a' }}
                />
              </div>

              <button onClick={() => removeItem(i)} style={removeBtn}>✕</button>
            </div>
          ))}

          <button onClick={addItem} style={addBtn}>+ Agregar producto</button>
        </div>

        {/* Total */}
        <div style={totalRow}>
          <span style={{ fontWeight: '600', color: '#555' }}>Total de compra</span>
          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2d1b00' }}>
            {formatMoney(totalCost)}
          </span>
        </div>

        <button onClick={handleSave} disabled={saving} style={saveBtn}>
          {saving ? 'Guardando...' : '✅ Confirmar compra y actualizar precios'}
        </button>
      </div>
    </div>
  )
}

const container = { minHeight: '100vh', background: '#f8f4ef', padding: '1rem' }
const card = { maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }
const pageTitle = { fontSize: '1.6rem', fontWeight: '700', color: '#2d1b00', margin: 0 }
const section = { background: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1.5px solid #e5d5c0' }
const sectionTitle = { fontSize: '1rem', fontWeight: '700', color: '#2d1b00', margin: '0 0 1rem' }
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }
const field = { display: 'flex', flexDirection: 'column', gap: '0.35rem' }
const label = { fontSize: '0.82rem', fontWeight: '600', color: '#555' }
const input = {
  padding: '0.65rem 0.875rem',
  border: '2px solid #e5d5c0',
  borderRadius: '0.625rem',
  fontSize: '0.95rem',
  width: '100%',
  boxSizing: 'border-box',
}
const hint = { fontSize: '0.8rem', color: '#888' }
const itemRow = {
  display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
  paddingBottom: '0.875rem', marginBottom: '0.875rem',
  borderBottom: '1px solid #f0e8dc',
}
const removeBtn = {
  padding: '0.65rem', background: '#fff0f0', border: '2px solid #fca5a5',
  borderRadius: '0.5rem', color: '#dc2626', cursor: 'pointer', flexShrink: 0,
}
const addBtn = {
  padding: '0.75rem 1.25rem', background: 'none',
  border: '2px dashed #c8860a', borderRadius: '0.75rem',
  color: '#c8860a', fontWeight: '600', cursor: 'pointer', width: '100%',
}
const totalRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  background: 'white', padding: '1rem 1.25rem', borderRadius: '1rem',
  border: '1.5px solid #e5d5c0',
}
const saveBtn = {
  width: '100%', padding: '1.1rem',
  background: '#c8860a', border: 'none',
  borderRadius: '0.875rem', color: 'white',
  fontSize: '1.05rem', fontWeight: '700', cursor: 'pointer',
}
