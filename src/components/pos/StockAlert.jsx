// src/components/pos/StockAlert.jsx
// Banner de alerta cuando hay productos horneados en stock 0

export default function StockAlert({ products, onDismiss }) {
  return (
    <div style={container}>
      <span style={icon}>⚠️</span>
      <span style={text}>
        Stock en 0: {products.map(p => p.name).join(', ')} — Se puede seguir vendiendo
      </span>
      <button onClick={onDismiss} style={closeBtn}>✕</button>
    </div>
  )
}

const container = {
  background: '#fef3c7',
  borderBottom: '2px solid #f59e0b',
  padding: '0.6rem 1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
}
const icon    = { fontSize: '1.2rem' }
const text    = { flex: 1, fontSize: '0.9rem', fontWeight: '600', color: '#92400e' }
const closeBtn = {
  background: 'none', border: 'none',
  cursor: 'pointer', color: '#92400e', fontSize: '1rem',
}
