// src/pages/ShiftClose.jsx
// Pantalla de cierre de turno con comparación sistema vs real

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, formatMoney, logAudit } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useShift } from '../context/ShiftContext'
import toast from 'react-hot-toast'

export default function ShiftClose() {
  const { user } = useAuth()
  const { shift, refreshShift } = useShift()
  const navigate = useNavigate()

  const [summary, setSummary]       = useState(null)  // totales del sistema
  const [stockReport, setStockReport] = useState([])   // stock horneados
  const [realCash, setRealCash]     = useState('')
  const [realTransfer, setRealTransfer] = useState('')
  const [notes, setNotes]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [closing, setClosing]       = useState(false)

  useEffect(() => {
    if (shift) loadSummary()
  }, [shift])

  async function loadSummary() {
    setLoading(true)

    // Traer todos los pagos del turno
    const { data: payments } = await supabase
      .from('payments')
      .select('method, amount, sales!inner(shift_id, status)')
      .eq('sales.shift_id', shift.id)
      .eq('sales.status', 'activa')

    const calcCash     = payments?.filter(p => p.method === 'efectivo').reduce((s, p) => s + p.amount, 0) ?? 0
    const calcTransfer = payments?.filter(p => p.method === 'transferencia').reduce((s, p) => s + p.amount, 0) ?? 0
    const calcCredit   = payments?.filter(p => p.method === 'cuenta_corriente').reduce((s, p) => s + p.amount, 0) ?? 0

    setSummary({
      calcCash,
      calcTransfer,
      calcCredit,
      calcTotal: calcCash + calcTransfer + calcCredit,
    })

    // Stock de productos horneados
    const today = new Date().toISOString().split('T')[0]
    const { data: prodLogs } = await supabase
      .from('production_logs')
      .select('*, products(name)')
      .eq('date', today)

    // Calcular vendido por producto
    const stockData = await Promise.all((prodLogs ?? []).map(async log => {
      const { data: items } = await supabase
        .from('sale_items')
        .select('quantity, sales!inner(shift_id, status, created_at)')
        .eq('product_id', log.product_id)
        .eq('sales.status', 'activa')

      const sold = items?.reduce((s, i) => s + parseFloat(i.quantity), 0) ?? 0
      return {
        name:     log.products?.name,
        loaded:   log.quantity,
        sold:     Math.round(sold),
        diff:     log.quantity - Math.round(sold),
      }
    }))

    setStockReport(stockData)
    setLoading(false)
  }

  async function handleClose() {
    if (!shift) return
    setClosing(true)

    try {
      const real_cash     = parseFloat(realCash)     || 0
      const real_transfer = parseFloat(realTransfer) || 0
      const real_total    = real_cash + real_transfer

      // 1. Insertar cierre
      const { error: closureError } = await supabase
        .from('shift_closures')
        .insert({
          shift_id:      shift.id,
          calc_cash:     summary.calcCash,
          calc_transfer: summary.calcTransfer,
          calc_credit:   summary.calcCredit,
          calc_total:    summary.calcTotal,
          real_cash,
          real_transfer,
          real_total,
          stock_report:  stockReport,
          notes,
          closed_by:     user.id,
        })

      if (closureError) throw closureError

      // 2. Marcar turno como cerrado
      const { error: shiftError } = await supabase
        .from('shifts')
        .update({ status: 'cerrado', closed_at: new Date().toISOString() })
        .eq('id', shift.id)

      if (shiftError) throw shiftError

      // 3. Auditoría
      await logAudit({
        action:      'cerrar_turno',
        tableName:   'shifts',
        recordId:    shift.id,
        description: `Turno ${shift.shift_type} del ${shift.date} cerrado. Total sistema: ${formatMoney(summary.calcTotal)}, Total real: ${formatMoney(real_total)}`,
      })

      toast.success('Turno cerrado correctamente')
      await refreshShift()
      navigate('/')
    } catch (err) {
      console.error(err)
      toast.error('Error al cerrar el turno')
    } finally {
      setClosing(false)
    }
  }

  if (!shift) {
    return (
      <div style={container}>
        <p style={{ textAlign: 'center', color: '#888', marginTop: '3rem' }}>
          No hay turno abierto para cerrar.
        </p>
      </div>
    )
  }

  if (loading) return <div style={container}><p>Cargando resumen...</p></div>

  const diffCash     = (parseFloat(realCash)     || 0) - summary.calcCash
  const diffTransfer = (parseFloat(realTransfer) || 0) - summary.calcTransfer
  const diffTotal    = diffCash + diffTransfer

  return (
    <div style={container}>
      <div style={card}>
        <h1 style={pageTitle}>
          Cierre de turno — {shift.shift_type}
        </h1>
        <p style={subtitle}>{shift.date}</p>

        {/* Resumen sistema */}
        <section style={section}>
          <h2 style={sectionTitle}>💻 Totales del sistema</h2>
          <Row label="Efectivo"     value={summary.calcCash}     />
          <Row label="Transferencia" value={summary.calcTransfer} />
          <Row label="Fiado (c/c)"  value={summary.calcCredit}   color="#2563eb" />
          <Row label="TOTAL"         value={summary.calcTotal}    bold />
        </section>

        {/* Montos reales */}
        <section style={section}>
          <h2 style={sectionTitle}>✏️ Ingresá los valores reales</h2>
          <Field
            label="Efectivo contado"
            value={realCash}
            onChange={setRealCash}
            placeholder={formatMoney(summary.calcCash)}
          />
          <Field
            label="Transferencias según banco"
            value={realTransfer}
            onChange={setRealTransfer}
            placeholder={formatMoney(summary.calcTransfer)}
          />
        </section>

        {/* Diferencias */}
        {(realCash || realTransfer) && (
          <section style={{ ...section, background: diffTotal === 0 ? '#f0fdf4' : '#fef3c7' }}>
            <h2 style={sectionTitle}>📊 Diferencias</h2>
            <DiffRow label="Efectivo"     diff={diffCash}     />
            <DiffRow label="Transferencia" diff={diffTransfer} />
            <DiffRow label="TOTAL"         diff={diffTotal} bold />
          </section>
        )}

        {/* Stock horneados */}
        {stockReport.length > 0 && (
          <section style={section}>
            <h2 style={sectionTitle}>🍞 Stock horneado del día</h2>
            <table style={table}>
              <thead>
                <tr>
                  {['Producto','Cargado','Vendido','Diferencia'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stockReport.map((row, i) => (
                  <tr key={i}>
                    <td style={td}>{row.name}</td>
                    <td style={td}>{row.loaded}</td>
                    <td style={td}>{row.sold}</td>
                    <td style={{ ...td, color: row.diff < 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                      {row.diff > 0 ? '+' : ''}{row.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Notas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={labelStyle}>Notas (opcional)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observaciones del turno..."
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          />
        </div>

        <button
          onClick={handleClose}
          disabled={closing}
          style={closeBtn}
        >
          {closing ? 'Cerrando...' : '🔒 Confirmar cierre de turno'}
        </button>
      </div>
    </div>
  )
}

// Sub-componentes
function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f0e8dc' }}>
      <span style={{ fontWeight: bold ? '700' : '400' }}>{label}</span>
      <span style={{ fontWeight: bold ? '700' : '600', color: color || '#2d1b00' }}>
        {formatMoney(value)}
      </span>
    </div>
  )
}

function DiffRow({ label, diff, bold }) {
  const color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#888'
  const prefix = diff > 0 ? '+' : ''
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
      <span style={{ fontWeight: bold ? '700' : '400' }}>{label}</span>
      <span style={{ color, fontWeight: '700' }}>
        {diff === 0 ? '✓ Sin diferencia' : `${prefix}${formatMoney(diff)}`}
      </span>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem' }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

// Estilos
const container = { minHeight: '100vh', background: '#f8f4ef', padding: '1rem', overflowY: 'auto' }
const card = { maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }
const pageTitle = { fontSize: '1.6rem', fontWeight: '700', color: '#2d1b00', margin: 0, textTransform: 'capitalize' }
const subtitle = { color: '#888', margin: 0 }
const section = { background: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1.5px solid #e5d5c0' }
const sectionTitle = { fontSize: '1rem', fontWeight: '700', color: '#2d1b00', margin: '0 0 0.75rem' }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const th = { textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '2px solid #e5d5c0', fontSize: '0.8rem', color: '#888', fontWeight: '600' }
const td = { padding: '0.5rem 0.5rem', borderBottom: '1px solid #f0e8dc' }
const labelStyle = { fontSize: '0.85rem', fontWeight: '600', color: '#555' }
const inputStyle = {
  padding: '0.75rem 1rem',
  border: '2px solid #e5d5c0',
  borderRadius: '0.75rem',
  fontSize: '1rem',
  width: '100%',
  boxSizing: 'border-box',
}
const closeBtn = {
  width: '100%',
  padding: '1.1rem',
  background: '#2d1b00',
  color: 'white',
  border: 'none',
  borderRadius: '0.875rem',
  fontSize: '1.1rem',
  fontWeight: '700',
  cursor: 'pointer',
}
