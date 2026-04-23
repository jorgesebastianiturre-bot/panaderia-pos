// src/components/pos/NumericKeypad.jsx
// Teclado numérico grande optimizado para pantalla táctil

import { useState } from 'react'

export default function NumericKeypad({ product, onConfirm, onClose }) {
  const [value, setValue] = useState('')

  const isGrams = product?.unit === 'gramo'
  const label   = isGrams
    ? `¿Cuántos gramos de ${product?.name}?`
    : `¿Cuántas unidades de ${product?.name}?`

  function press(key) {
    if (key === '⌫') {
      setValue(v => v.slice(0, -1))
    } else if (key === '.') {
      if (!value.includes('.')) setValue(v => v + '.')
    } else {
      setValue(v => v + key)
    }
  }

  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫']

  return (
    <div style={overlay}>
      <div style={modal}>
        <p style={title}>{label}</p>

        {/* Pantalla */}
        <div style={screen}>
          <span style={screenValue}>{value || '0'}</span>
          <span style={screenUnit}>{isGrams ? 'g' : 'un'}</span>
        </div>

        {/* Grilla de teclas */}
        <div style={grid}>
          {keys.map(k => (
            <button
              key={k}
              onClick={() => press(k)}
              style={{ ...key_btn, ...(k === '⌫' ? key_delete : {}) }}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Botones de acción */}
        <div style={actions}>
          <button onClick={onClose} style={btn_cancel}>Cancelar</button>
          <button
            onClick={() => onConfirm(value)}
            disabled={!value}
            style={{ ...btn_confirm, opacity: value ? 1 : 0.5 }}
          >
            Agregar ✓
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: '1rem',
}
const modal = {
  background: 'white', borderRadius: '1.5rem',
  padding: '1.5rem', width: '100%', maxWidth: '360px',
  display: 'flex', flexDirection: 'column', gap: '1rem',
}
const title = { textAlign: 'center', fontWeight: '700', fontSize: '1.05rem', color: '#2d1b00', margin: 0 }
const screen = {
  background: '#f8f4ef', borderRadius: '0.75rem',
  padding: '1rem 1.5rem',
  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  border: '2px solid #e5d5c0',
}
const screenValue = { fontSize: '2.5rem', fontWeight: '700', color: '#2d1b00' }
const screenUnit  = { fontSize: '1rem', color: '#888' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }
const key_btn = {
  padding: '1.25rem',
  background: '#f8f4ef',
  border: '2px solid #e5d5c0',
  borderRadius: '0.75rem',
  fontSize: '1.5rem',
  fontWeight: '700',
  cursor: 'pointer',
  transition: 'background 0.1s',
  color: '#2d1b00',
}
const key_delete = { background: '#fff0f0', borderColor: '#fca5a5', color: '#dc2626' }
const actions = { display: 'flex', gap: '0.75rem' }
const btn_cancel = {
  flex: 1, padding: '1rem',
  background: 'white', border: '2px solid #e5d5c0',
  borderRadius: '0.875rem', fontWeight: '600', cursor: 'pointer', fontSize: '1rem',
}
const btn_confirm = {
  flex: 2, padding: '1rem',
  background: '#16a34a', border: 'none',
  borderRadius: '0.875rem', color: 'white',
  fontWeight: '700', cursor: 'pointer', fontSize: '1.05rem',
}
