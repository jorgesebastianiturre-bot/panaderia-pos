// src/pages/Production.jsx
// Carga del stock de producción diaria (solo gestor/admin)

import { useState, useEffect } from 'react'
import { supabase, logAudit } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Production() {
  const { user, isGestor } = useAuth()
  const [horneados, setHorneados] = useState([]) // productos tipo 'horneado'
  const [logs, setLogs]           = useState({}) // { productId: quantity }
  const [existing, setExisting]   = useState({}) // cargas ya existentes hoy
  const [saving, setSaving]       = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [prodRes, logsRes] = await Promise.all([
      supabase.from('products').select('*').eq('product_type', 'horneado').eq('active', true),
      supabase.from('production_logs').select('*').eq('date', today),
    ])

    setHorneados(prodRes.data ?? [])

    const existingMap = {}
    const logsInit    = {}
    for (const log of (logsRes.data ?? [])) {
      existingMap[log.product_id] = log
      logsInit[log.product_id]    = log.quantity
    }
    setExisting(existingMap)
    setLogs(logsInit)
  }

  function handleChange(productId, value) {
    setLogs(prev => ({ ...prev, [productId]: parseInt(value) || 0 }))
  }

  async function handleSave() {
    if (!isGestor) { toast.error('Sin permisos'); return }
    setSaving(true)

    try {
      for (const product of horneados) {
        const qty = logs[product.id] ?? 0
        const ex  = existing[product.id]

        if (ex) {
          // Actualizar carga existente
          await supabase
            .from('production_logs')
            .update({ quantity: qty })
            .eq('id', ex.id)

          await logAudit({
            action:      'modificar',
            tableName:   'production_logs',
            recordId:    ex.id,
            oldData:     { quantity: ex.quantity },
            newData:     { quantity: qty },
            description: `Stock de ${product.name} actualizado: ${ex.quantity} → ${qty}`,
          })
        } else if (qty > 0) {
          // Insertar nueva carga
          const { data: newLog } = await supabase
            .from('production_logs')
            .insert({ product_id: product.id, date: today, quantity: qty, created_by: user.id })
            .select()
            .single()

          await logAudit({
            action:      'crear',
            tableName:   'production_logs',
            recordId:    newLog?.id,
            newData:     { product_id: product.id, quantity: qty, date: today },
            description: `Stock inicial de ${product.name}: ${qty} unidades`,
          })
        }
      }

      toast.success('Stock de producción guardado')
      await loadData()
    } catch (err) {
      console.error(err)
      toast.error('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={container}>
      <div style={card}>
        <div style={header}>
          <h1 style={title}>🍞 Carga de producción</h1>
          <p style={dateLabel}>{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        <p style={hint}>
          Ingresá las unidades producidas hoy de cada producto.
          Si ya cargaste antes, podés corregirlo.
        </p>

        <div style={grid}>
          {horneados.map(product => {
            const ex = existing[product.id]
            return (
              <div key={product.id} style={productCard}>
                <div style={productInfo}>
                  <span style={productName}>{product.name}</span>
                  {ex && <span style={existingBadge}>Cargado antes: {ex.quantity}</span>}
                </div>
                <div style={inputRow}>
                  <button
                    onClick={() => handleChange(product.id, Math.max(0, (logs[product.id] ?? 0) - 10))}
                    style={stepBtn}
                  >−10</button>
                  <input
                    type="number"
                    min="0"
                    value={logs[product.id] ?? ''}
                    onChange={e => handleChange(product.id, e.target.value)}
                    placeholder="0"
                    style={qtyInput}
                  />
                  <button
                    onClick={() => handleChange(product.id, (logs[product.id] ?? 0) + 10)}
                    style={{ ...stepBtn, background: '#f0fdf4', borderColor: '#86efac', color: '#16a34a' }}
                  >+10</button>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={saveBtn}
        >
          {saving ? 'Guardando...' : '✅ Guardar stock del día'}
        </button>
      </div>
    </div>
  )
}

const container = { minHeight: '100vh', background: '#f8f4ef', padding: '1rem' }
const card = { maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }
const header = { display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const title = { fontSize: '1.6rem', fontWeight: '700', color: '#2d1b00', margin: 0 }
const dateLabel = { color: '#888', margin: 0, textTransform: 'capitalize' }
const hint = { background: '#fef3c7', borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#92400e', margin: 0 }
const grid = { display: 'flex', flexDirection: 'column', gap: '0.75rem' }
const productCard = {
  background: 'white',
  borderRadius: '1rem',
  padding: '1rem 1.25rem',
  border: '1.5px solid #e5d5c0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap',
}
const productInfo = { display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }
const productName = { fontWeight: '700', fontSize: '1rem', color: '#2d1b00' }
const existingBadge = { fontSize: '0.8rem', color: '#888' }
const inputRow = { display: 'flex', alignItems: 'center', gap: '0.5rem' }
const stepBtn = {
  width: '48px', height: '48px',
  border: '2px solid #e5d5c0',
  borderRadius: '0.5rem',
  background: '#fff0f0',
  color: '#dc2626',
  fontSize: '1rem',
  fontWeight: '700',
  cursor: 'pointer',
}
const qtyInput = {
  width: '80px', textAlign: 'center',
  padding: '0.6rem',
  border: '2px solid #e5d5c0',
  borderRadius: '0.5rem',
  fontSize: '1.2rem',
  fontWeight: '700',
  color: '#2d1b00',
}
const saveBtn = {
  width: '100%', padding: '1.1rem',
  background: '#c8860a', border: 'none',
  borderRadius: '0.875rem', color: 'white',
  fontSize: '1.1rem', fontWeight: '700', cursor: 'pointer',
}
