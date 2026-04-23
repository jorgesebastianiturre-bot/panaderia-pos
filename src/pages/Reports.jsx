// src/pages/Reports.jsx
// Panel de reportes: ventas, stock, cuentas corrientes, auditoría

import { useState, useEffect } from 'react'
import { supabase, formatMoney, formatDate } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TABS = ['Ventas', 'Stock', 'Cuentas corrientes', 'Cierres', 'Auditoría']

export default function Reports() {
  const { isGestor } = useAuth()
  const [tab, setTab] = useState(0)

  if (!isGestor) return (
    <div style={container}>
      <p style={{ textAlign: 'center', color: '#888', marginTop: '3rem' }}>
        Sin permisos para ver reportes.
      </p>
    </div>
  )

  return (
    <div style={container}>
      <h1 style={pageTitle}>📊 Reportes</h1>

      {/* Tabs */}
      <div style={tabBar}>
        {TABS.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            style={{ ...tabBtn, ...(tab === i ? tabBtnActive : {}) }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <SalesReport />}
      {tab === 1 && <StockReport />}
      {tab === 2 && <CreditReport />}
      {tab === 3 && <ClosuresReport />}
      {tab === 4 && <AuditReport />}
    </div>
  )
}

// ── Reporte de ventas ────────────────────────────────────────
function SalesReport() {
  const [sales, setSales]     = useState([])
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo]   = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('sales')
      .select('*, users(full_name), shifts(shift_type, date), sale_items(product_name, quantity, subtotal)')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59')
      .eq('status', 'activa')
      .order('created_at', { ascending: false })

    setSales(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalEfectivo    = sales.reduce((s, v) => s + (v.final_total || 0), 0) // simplificado
  const countSales       = sales.length

  return (
    <div style={reportContainer}>
      {/* Filtros */}
      <div style={filterRow}>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={filterInput} />
        <span style={{ color: '#888' }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={filterInput} />
        <button onClick={load} style={filterBtn}>Buscar</button>
      </div>

      {/* KPIs */}
      <div style={kpiGrid}>
        <KPI label="Ventas" value={countSales} />
        <KPI label="Total vendido" value={formatMoney(sales.reduce((s, v) => s + v.final_total, 0))} />
        <KPI label="Descuentos" value={formatMoney(sales.reduce((s, v) => s + (v.discount || 0), 0))} color="#dc2626" />
      </div>

      {/* Tabla */}
      {loading ? <p>Cargando...</p> : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                {['Fecha/Hora', 'Turno', 'Vendedor', 'Total', 'Descuento'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => (
                <tr key={sale.id}>
                  <td style={td}>{new Date(sale.created_at).toLocaleString('es-AR')}</td>
                  <td style={td}>{sale.shifts?.shift_type ?? '—'}</td>
                  <td style={td}>{sale.users?.full_name ?? '—'}</td>
                  <td style={{ ...td, fontWeight: '700', color: '#16a34a' }}>{formatMoney(sale.final_total)}</td>
                  <td style={{ ...td, color: sale.discount > 0 ? '#dc2626' : '#888' }}>
                    {sale.discount > 0 ? `−${formatMoney(sale.discount)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sales.length && <p style={empty}>Sin ventas en el período.</p>}
        </div>
      )}
    </div>
  )
}

// ── Reporte de stock ─────────────────────────────────────────
function StockReport() {
  const [logs, setLogs]   = useState([])
  const [date, setDate]   = useState(new Date().toISOString().split('T')[0])

  async function load() {
    const { data } = await supabase
      .from('production_logs')
      .select('*, products(name)')
      .eq('date', date)

    // Para cada producto, calcular vendido
    const withSales = await Promise.all((data ?? []).map(async log => {
      const { data: items } = await supabase
        .from('sale_items')
        .select('quantity, sales!inner(status, created_at)')
        .eq('product_id', log.product_id)
        .eq('sales.status', 'activa')

      const sold = items?.reduce((s, i) => s + parseFloat(i.quantity), 0) ?? 0
      return { ...log, sold: Math.round(sold), diff: log.quantity - Math.round(sold) }
    }))

    setLogs(withSales)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={reportContainer}>
      <div style={filterRow}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={filterInput} />
        <button onClick={load} style={filterBtn}>Ver</button>
      </div>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {['Producto', 'Producido', 'Vendido', 'Diferencia'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i}>
                <td style={td}>{log.products?.name}</td>
                <td style={td}>{log.quantity}</td>
                <td style={td}>{log.sold}</td>
                <td style={{ ...td, color: log.diff < 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                  {log.diff > 0 ? '+' : ''}{log.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length && <p style={empty}>Sin datos de producción para esa fecha.</p>}
      </div>
    </div>
  )
}

// ── Cuentas corrientes ───────────────────────────────────────
function CreditReport() {
  const [accounts, setAccounts] = useState([])
  const [selected, setSelected] = useState(null)
  const [payments, setPayments] = useState([])

  useEffect(() => {
    supabase.from('credit_accounts').select('*').order('name').then(({ data }) => setAccounts(data ?? []))
  }, [])

  async function loadHistory(accountId) {
    setSelected(accountId)
    const { data } = await supabase
      .from('credit_payments')
      .select('*')
      .eq('credit_account_id', accountId)
      .order('created_at', { ascending: false })
    setPayments(data ?? [])
  }

  const account = accounts.find(a => a.id === selected)

  return (
    <div style={reportContainer}>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {['Cliente', 'Saldo deudor', 'Acciones'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <tr key={acc.id}>
                <td style={td}>{acc.name}</td>
                <td style={{ ...td, color: acc.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                  {formatMoney(acc.balance)}
                </td>
                <td style={td}>
                  <button onClick={() => loadHistory(acc.id)} style={smallBtn}>Ver historial</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!accounts.length && <p style={empty}>Sin cuentas corrientes.</p>}
      </div>

      {selected && account && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', color: '#2d1b00' }}>
            Historial de {account.name} — Saldo: {formatMoney(account.balance)}
          </h3>
          <table style={table}>
            <thead>
              <tr>
                {['Fecha', 'Abonado', 'Medio'].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td style={td}>{new Date(p.created_at).toLocaleDateString('es-AR')}</td>
                  <td style={{ ...td, color: '#16a34a', fontWeight: '700' }}>{formatMoney(p.amount)}</td>
                  <td style={td}>{p.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments.length && <p style={empty}>Sin abonos registrados.</p>}
        </div>
      )}
    </div>
  )
}

// ── Cierres de turno ─────────────────────────────────────────
function ClosuresReport() {
  const [closures, setClosures] = useState([])

  useEffect(() => {
    supabase
      .from('shift_closures')
      .select('*, shifts(date, shift_type), users(full_name)')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setClosures(data ?? []))
  }, [])

  return (
    <div style={reportContainer}>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {['Fecha', 'Turno', 'Sistema', 'Real', 'Diferencia', 'Cerrado por'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {closures.map(c => (
              <tr key={c.id}>
                <td style={td}>{c.shifts?.date}</td>
                <td style={td}>{c.shifts?.shift_type}</td>
                <td style={td}>{formatMoney(c.calc_total)}</td>
                <td style={td}>{formatMoney(c.real_total)}</td>
                <td style={{ ...td, color: c.diff_total !== 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                  {c.diff_total > 0 ? '+' : ''}{formatMoney(c.diff_total)}
                </td>
                <td style={td}>{c.users?.full_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!closures.length && <p style={empty}>Sin cierres registrados.</p>}
      </div>
    </div>
  )
}

// ── Auditoría ────────────────────────────────────────────────
function AuditReport() {
  const [logs, setLogs]     = useState([])
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*, users(full_name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setLogs(data ?? []))
  }, [])

  return (
    <div style={reportContainer}>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {['Fecha', 'Usuario', 'Acción', 'Tabla', 'Descripción'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <>
                <tr key={log.id} onClick={() => setExpanded(expanded === log.id ? null : log.id)} style={{ cursor: 'pointer' }}>
                  <td style={td}>{new Date(log.created_at).toLocaleString('es-AR')}</td>
                  <td style={td}>{log.users?.full_name ?? '—'}</td>
                  <td style={td}>
                    <span style={actionBadge(log.action)}>{log.action}</span>
                  </td>
                  <td style={td}>{log.table_name}</td>
                  <td style={td}>{log.description}</td>
                </tr>
                {expanded === log.id && (log.old_data || log.new_data) && (
                  <tr>
                    <td colSpan={5} style={{ ...td, background: '#f8f4ef', fontSize: '0.82rem' }}>
                      {log.old_data && <div><b>Antes:</b> <code>{JSON.stringify(log.old_data, null, 2)}</code></div>}
                      {log.new_data && <div><b>Después:</b> <code>{JSON.stringify(log.new_data, null, 2)}</code></div>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {!logs.length && <p style={empty}>Sin registros de auditoría.</p>}
      </div>
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────
function KPI({ label, value, color }) {
  return (
    <div style={kpiCard}>
      <span style={{ fontSize: '0.82rem', color: '#888', fontWeight: '600' }}>{label}</span>
      <span style={{ fontSize: '1.4rem', fontWeight: '700', color: color || '#2d1b00' }}>{value}</span>
    </div>
  )
}

function actionBadge(action) {
  const colors = {
    crear: '#dcfce7',
    modificar: '#fef3c7',
    eliminar: '#fee2e2',
    anular: '#fee2e2',
    cerrar_turno: '#dbeafe',
  }
  return {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: '999px',
    background: colors[action] || '#f3f4f6',
    fontSize: '0.8rem',
    fontWeight: '600',
  }
}

// Estilos
const container = { minHeight: '100vh', background: '#f8f4ef', padding: '1rem' }
const pageTitle = { fontSize: '1.6rem', fontWeight: '700', color: '#2d1b00', marginBottom: '0.75rem' }
const tabBar = { display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1rem' }
const tabBtn = {
  padding: '0.5rem 1rem',
  border: '2px solid #e5d5c0',
  borderRadius: '0.625rem',
  background: 'white',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '0.9rem',
  whiteSpace: 'nowrap',
}
const tabBtnActive = { background: '#c8860a', borderColor: '#c8860a', color: 'white' }
const reportContainer = { display: 'flex', flexDirection: 'column', gap: '1rem' }
const filterRow = { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }
const filterInput = { padding: '0.5rem 0.75rem', border: '2px solid #e5d5c0', borderRadius: '0.5rem', fontSize: '0.9rem' }
const filterBtn = { padding: '0.5rem 1rem', background: '#c8860a', border: 'none', borderRadius: '0.5rem', color: 'white', fontWeight: '600', cursor: 'pointer' }
const kpiGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }
const kpiCard = { background: 'white', borderRadius: '0.875rem', padding: '1rem', border: '1.5px solid #e5d5c0', display: 'flex', flexDirection: 'column', gap: '0.25rem' }
const tableWrap = { background: 'white', borderRadius: '1rem', padding: '1rem', border: '1.5px solid #e5d5c0', overflowX: 'auto' }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const th = { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5d5c0', fontSize: '0.8rem', color: '#888', fontWeight: '600', whiteSpace: 'nowrap' }
const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid #f0e8dc' }
const empty = { textAlign: 'center', color: '#aaa', padding: '2rem 0' }
const smallBtn = { padding: '0.35rem 0.75rem', background: '#f5e6d3', border: 'none', borderRadius: '0.4rem', color: '#c8860a', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }
