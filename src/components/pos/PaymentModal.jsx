// src/components/pos/PaymentModal.jsx
// Modal de cobro: un solo medio (por defecto) o mixto (opcional)

import { useState, useEffect } from 'react'
import { supabase, formatMoney } from '../../lib/supabase'

export default function PaymentModal({ total, onConfirm, onClose }) {
  const [mixedMode, setMixedMode]           = useState(false)
  const [method, setMethod]                 = useState('efectivo')
  const [method2, setMethod2]               = useState('transferencia')
  const [amount2, setAmount2]               = useState('')
  const [creditAccounts, setCreditAccounts] = useState([])
  const [selectedCredit, setSelectedCredit] = useState(null)
  const [discountedTotal, setDiscountedTotal] = useState(total)
  const [discountReason, setDiscountReason]   = useState('')
  const [showDiscountInput, setShowDiscountInput] = useState(false)

  useEffect(() => {
    supabase.from('credit_accounts').select('*').eq('active', true).then(({ data }) => {
      setCreditAccounts(data ?? [])
    })
  }, [])

  const paymentMethods = [
    { id: 'efectivo',          label: 'Efectivo',   icon: '💵' },
    { id: 'transferencia',     label: 'Transf.',    icon: '📱' },
    { id: 'cuenta_corriente',  label: 'Fiado',      icon: '📋' },
  ]

  function handleConfirm() {
    const payments = []

    if (mixedMode) {
      const a2 = parseFloat(amount2) || 0
      const a1 = discountedTotal - a2
      if (a1 <= 0 || a2 <= 0) return

      payments.push({ method, amount: a1, creditAccountId: method  === 'cuenta_corriente' ? selectedCredit : null })
      payments.push({ method: method2, amount: a2, creditAccountId: method2 === 'cuenta_corriente' ? selectedCredit : null })
    } else {
      payments.push({ method, amount: discountedTotal, creditAccountId: method === 'cuenta_corriente' ? selectedCredit : null })
    }

    onConfirm({
      payments,
      finalTotal:     discountedTotal,
      discountReason: discountedTotal !== total ? discountReason : null,
      creditAccountId: method === 'cuenta_corriente' ? selectedCredit : null,
    })
  }

  const amount2Num = parseFloat(amount2) || 0
  const amount1    = discountedTotal - amount2Num

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={title}>Cobrar {formatMoney(discountedTotal)}</h2>

        {/* Descuento opcional */}
        {!showDiscountInput ? (
          <button onClick={() => setShowDiscountInput(true)} style={discountToggle}>
            ✏️ Modificar monto total
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={label}>Nuevo total</label>
            <input
              type="number"
              value={discountedTotal}
              onChange={e => setDiscountedTotal(parseFloat(e.target.value) || 0)}
              style={input}
            />
            <label style={label}>Motivo (obligatorio si hay diferencia)</label>
            <input
              placeholder="ej: descuento cliente habitual"
              value={discountReason}
              onChange={e => setDiscountReason(e.target.value)}
              style={input}
            />
          </div>
        )}

        {/* Selector de medio de pago principal */}
        <div>
          <label style={label}>Medio de pago</label>
          <div style={methodGrid}>
            {paymentMethods.map(m => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                style={{ ...methodBtn, ...(method === m.id ? methodBtnActive : {}) }}
              >
                <span style={{ fontSize: '1.8rem' }}>{m.icon}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cuenta corriente */}
        {(method === 'cuenta_corriente' || method2 === 'cuenta_corriente') && (
          <div>
            <label style={label}>Cliente (fiado)</label>
            <select
              value={selectedCredit ?? ''}
              onChange={e => setSelectedCredit(e.target.value)}
              style={input}
            >
              <option value="">Seleccionar cliente...</option>
              {creditAccounts.map(ca => (
                <option key={ca.id} value={ca.id}>
                  {ca.name} — Saldo: {formatMoney(ca.balance)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Toggle pago mixto */}
        <button
          onClick={() => setMixedMode(!mixedMode)}
          style={mixedToggle}
        >
          {mixedMode ? '✕ Cancelar pago mixto' : '⇄ Pago mixto (dos medios)'}
        </button>

        {/* Pago mixto */}
        {mixedMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={methodGrid}>
              {paymentMethods.filter(m => m.id !== method).map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod2(m.id)}
                  style={{ ...methodBtn, ...(method2 === m.id ? methodBtnActive : {}) }}
                >
                  <span style={{ fontSize: '1.8rem' }}>{m.icon}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '700' }}>{m.label}</span>
                </button>
              ))}
            </div>
            <div>
              <label style={label}>
                Monto en {paymentMethods.find(m => m.id === method2)?.label}
              </label>
              <input
                type="number"
                value={amount2}
                onChange={e => setAmount2(e.target.value)}
                placeholder="0"
                style={input}
              />
              <p style={{ fontSize: '0.85rem', color: '#888', margin: '0.25rem 0 0' }}>
                Resto en {paymentMethods.find(m => m.id === method)?.label}: {formatMoney(amount1)}
              </p>
            </div>
          </div>
        )}

        {/* Botones */}
        <div style={actions}>
          <button onClick={onClose} style={btnCancel}>Cancelar</button>
          <button onClick={handleConfirm} style={btnConfirm}>
            Confirmar cobro ✓
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.65)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  zIndex: 100,
}
const modal = {
  background: 'white',
  borderRadius: '1.5rem 1.5rem 0 0',
  padding: '1.5rem',
  width: '100%', maxWidth: '480px',
  display: 'flex', flexDirection: 'column', gap: '1rem',
  maxHeight: '90vh', overflowY: 'auto',
}
const title = { textAlign: 'center', fontSize: '1.4rem', fontWeight: '700', color: '#2d1b00', margin: 0 }
const label = { fontSize: '0.85rem', fontWeight: '600', color: '#555', display: 'block', marginBottom: '0.4rem' }
const input = {
  width: '100%', padding: '0.75rem 1rem',
  border: '2px solid #e5d5c0', borderRadius: '0.75rem',
  fontSize: '1rem', boxSizing: 'border-box',
}
const methodGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }
const methodBtn = {
  padding: '0.875rem 0.5rem',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
  border: '2px solid #e5d5c0', borderRadius: '0.875rem',
  background: 'white', cursor: 'pointer', transition: 'all 0.15s',
}
const methodBtnActive = { background: '#f5e6d3', borderColor: '#c8860a' }
const discountToggle = {
  background: 'none', border: '1.5px dashed #e5d5c0',
  borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer',
  color: '#888', fontSize: '0.85rem', width: '100%',
}
const mixedToggle = {
  background: 'none', border: '1.5px dashed #c8860a',
  borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer',
  color: '#c8860a', fontSize: '0.85rem', fontWeight: '600', width: '100%',
}
const actions = { display: 'flex', gap: '0.75rem' }
const btnCancel = {
  flex: 1, padding: '1rem', background: 'white',
  border: '2px solid #e5d5c0', borderRadius: '0.875rem',
  fontWeight: '600', cursor: 'pointer', fontSize: '1rem',
}
const btnConfirm = {
  flex: 2, padding: '1rem', background: '#16a34a',
  border: 'none', borderRadius: '0.875rem',
  color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '1.05rem',
}
