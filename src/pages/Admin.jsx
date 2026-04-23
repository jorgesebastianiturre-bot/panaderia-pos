// src/pages/Admin.jsx
// Panel de administración: productos, proveedores, usuarios, cuentas corrientes

import { useState, useEffect } from 'react'
import { supabase, formatMoney, logAudit } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const SECTIONS = ['Productos', 'Proveedores', 'Usuarios', 'Cuentas corrientes']

export default function Admin() {
  const { isGestor, isAdmin } = useAuth()
  const [section, setSection] = useState(0)

  if (!isGestor) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
      Sin permisos de acceso.
    </div>
  )

  return (
    <div style={container}>
      <h1 style={pageTitle}>⚙️ Administración</h1>

      <div style={tabBar}>
        {SECTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => setSection(i)}
            style={{ ...tabBtn, ...(section === i ? tabActive : {}) }}
          >
            {s}
          </button>
        ))}
      </div>

      {section === 0 && <ProductsAdmin />}
      {section === 1 && <ProvidersAdmin />}
      {section === 2 && isAdmin && <UsersAdmin />}
      {section === 3 && <CreditAccountsAdmin />}
    </div>
  )
}

// ── Gestión de productos ─────────────────────────────────────
function ProductsAdmin() {
  const [products, setProducts]       = useState([])
  const [categories, setCategories]   = useState([])
  const [editing, setEditing]         = useState(null)
  const [form, setForm]               = useState({})
  const [promos, setPromos]           = useState([])
  const [showPromoFor, setShowPromoFor] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [pRes, cRes, promoRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').order('name'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('promos').select('*, products(name)').eq('active', true),
    ])
    setProducts(pRes.data ?? [])
    setCategories(cRes.data ?? [])
    setPromos(promoRes.data ?? [])
  }

  function startEdit(product) {
    setEditing(product.id)
    setForm({ ...product })
  }

  async function saveProduct() {
    if (!form.name || !form.price) { toast.error('Completá nombre y precio'); return }

    const oldProd = products.find(p => p.id === form.id)
    const payload = {
      name: form.name, price: parseFloat(form.price),
      category_id: form.category_id || null, active: form.active,
    }

    if (editing === 'new') {
      const { data, error } = await supabase
        .from('products')
        .insert({ ...payload, product_type: form.product_type || 'horneado', unit: form.unit || 'unidad' })
        .select().single()
      if (error) { toast.error('Error al crear'); return }
      await logAudit({ action: 'crear', tableName: 'products', recordId: data.id, newData: payload, description: `Producto creado: ${form.name}` })
    } else {
      const { error } = await supabase.from('products').update(payload).eq('id', editing)
      if (error) { toast.error('Error al actualizar'); return }
      await logAudit({ action: 'modificar', tableName: 'products', recordId: editing, oldData: oldProd, newData: payload, description: `Producto modificado: ${form.name}` })
    }

    toast.success('Producto guardado')
    setEditing(null)
    setForm({})
    load()
  }

  async function toggleActive(product) {
    await supabase.from('products').update({ active: !product.active }).eq('id', product.id)
    await logAudit({ action: 'modificar', tableName: 'products', recordId: product.id, description: `Producto ${product.active ? 'desactivado' : 'activado'}: ${product.name}` })
    load()
  }

  async function addPromo(productId, minQty, promoPrice) {
    await supabase.from('promos').insert({ product_id: productId, min_qty: parseInt(minQty), promo_price: parseFloat(promoPrice) })
    toast.success('Promoción agregada')
    load()
  }

  async function deletePromo(promoId) {
    await supabase.from('promos').update({ active: false }).eq('id', promoId)
    load()
  }

  return (
    <div style={sectionWrap}>
      <button
        onClick={() => { setEditing('new'); setForm({ product_type: 'horneado', unit: 'unidad', active: true, price: '' }) }}
        style={primaryBtn}
      >
        + Nuevo producto
      </button>

      {/* Formulario de edición */}
      {editing && (
        <div style={formCard}>
          <h3 style={formTitle}>{editing === 'new' ? 'Nuevo producto' : 'Editar producto'}</h3>
          <div style={formGrid}>
            <Field label="Nombre" value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
            <Field label="Precio ($)" type="number" value={form.price || ''} onChange={v => setForm(f => ({ ...f, price: v }))} />
            <div>
              <label style={lbl}>Categoría</label>
              <select value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} style={inp}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {editing === 'new' && (
              <>
                <div>
                  <label style={lbl}>Tipo</label>
                  <select value={form.product_type} onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))} style={inp}>
                    <option value="horneado">Horneado (producción propia)</option>
                    <option value="comprado">Comprado (reventa)</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Unidad</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
                    <option value="unidad">Unidad</option>
                    <option value="gramo">Gramos</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div style={formActions}>
            <button onClick={() => { setEditing(null); setForm({}) }} style={cancelBtn}>Cancelar</button>
            <button onClick={saveProduct} style={primaryBtn}>Guardar</button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {['Nombre', 'Tipo', 'Precio', 'Categoría', 'Estado', 'Promos', 'Acciones'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <>
                <tr key={p.id}>
                  <td style={td}>{p.name}</td>
                  <td style={td}>{p.product_type}</td>
                  <td style={{ ...td, fontWeight: '700' }}>{formatMoney(p.price)}</td>
                  <td style={td}>{p.categories?.name ?? '—'}</td>
                  <td style={td}>
                    <span style={{ color: p.active ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={td}>
                    {promos.filter(pr => pr.product_id === p.id).map(pr => (
                      <span key={pr.id} style={promoBadge}>
                        {pr.min_qty}× {formatMoney(pr.promo_price)}
                        <button onClick={() => deletePromo(pr.id)} style={delPromoBtn}>✕</button>
                      </span>
                    ))}
                    <button onClick={() => setShowPromoFor(showPromoFor === p.id ? null : p.id)} style={smallBtn}>
                      + Promo
                    </button>
                  </td>
                  <td style={td}>
                    <button onClick={() => startEdit(p)} style={smallBtn}>✏️ Editar</button>
                    <button onClick={() => toggleActive(p)} style={{ ...smallBtn, marginLeft: '0.25rem', color: p.active ? '#dc2626' : '#16a34a' }}>
                      {p.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
                {showPromoFor === p.id && <PromoForm productId={p.id} onAdd={addPromo} />}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PromoForm({ productId, onAdd }) {
  const [minQty, setMinQty]     = useState('')
  const [promoPrice, setPromoPrice] = useState('')

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0.5rem 1rem', background: '#f5e6d3' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Nueva promo:</span>
          <input
            type="number" placeholder="Cant. mín" value={minQty}
            onChange={e => setMinQty(e.target.value)}
            style={{ ...inp, maxWidth: '100px' }}
          />
          <span>= $</span>
          <input
            type="number" placeholder="Precio total" value={promoPrice}
            onChange={e => setPromoPrice(e.target.value)}
            style={{ ...inp, maxWidth: '120px' }}
          />
          <button
            onClick={() => onAdd(productId, minQty, promoPrice)}
            style={primaryBtn}
          >
            Agregar
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Gestión de proveedores ───────────────────────────────────
function ProvidersAdmin() {
  const [providers, setProviders] = useState([])
  const [form, setForm]           = useState({ name: '', contact: '', phone: '', default_margin: 40 })
  const [editing, setEditing]     = useState(null)

  useEffect(() => {
    supabase.from('providers').select('*').order('name').then(({ data }) => setProviders(data ?? []))
  }, [])

  async function save() {
    if (!form.name) { toast.error('Nombre requerido'); return }
    const payload = { name: form.name, contact: form.contact, phone: form.phone, default_margin: parseFloat(form.default_margin) }

    if (editing) {
      await supabase.from('providers').update(payload).eq('id', editing)
    } else {
      await supabase.from('providers').insert(payload)
    }

    toast.success('Proveedor guardado')
    setEditing(null)
    setForm({ name: '', contact: '', phone: '', default_margin: 40 })
    supabase.from('providers').select('*').order('name').then(({ data }) => setProviders(data ?? []))
  }

  return (
    <div style={sectionWrap}>
      <div style={formCard}>
        <h3 style={formTitle}>{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
        <div style={formGrid}>
          <Field label="Nombre" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Contacto" value={form.contact} onChange={v => setForm(f => ({ ...f, contact: v }))} />
          <Field label="Teléfono" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Margen por defecto (%)" type="number" value={form.default_margin} onChange={v => setForm(f => ({ ...f, default_margin: v }))} />
        </div>
        <button onClick={save} style={primaryBtn}>Guardar proveedor</button>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>{['Nombre', 'Contacto', 'Margen %', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {providers.map(p => (
              <tr key={p.id}>
                <td style={td}>{p.name}</td>
                <td style={td}>{p.contact || '—'}</td>
                <td style={td}>{p.default_margin}%</td>
                <td style={td}>
                  <button
                    onClick={() => { setEditing(p.id); setForm(p) }}
                    style={smallBtn}
                  >
                    ✏️ Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Gestión de usuarios (solo admin) ─────────────────────────
function UsersAdmin() {
  const [users, setUsers]   = useState([])
  const [roles, setRoles]   = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('*, roles(name)').order('full_name'),
      supabase.from('roles').select('*'),
    ]).then(([uRes, rRes]) => {
      setUsers(uRes.data ?? [])
      setRoles(rRes.data ?? [])
    })
  }, [])

  async function updateRole(userId, roleId) {
    await supabase.from('users').update({ role_id: parseInt(roleId) }).eq('id', userId)
    await logAudit({ action: 'modificar', tableName: 'users', recordId: userId, description: `Rol de usuario cambiado a ${roles.find(r => r.id === parseInt(roleId))?.name}` })
    supabase.from('users').select('*, roles(name)').order('full_name').then(({ data }) => setUsers(data ?? []))
    toast.success('Rol actualizado')
  }

  async function toggleUser(userId, active) {
    await supabase.from('users').update({ active: !active }).eq('id', userId)
    supabase.from('users').select('*, roles(name)').order('full_name').then(({ data }) => setUsers(data ?? []))
  }

  return (
    <div style={sectionWrap}>
      <p style={{ fontSize: '0.9rem', color: '#888' }}>
        Para crear usuarios, usá el panel de Supabase Auth o enviá invitaciones.
        Aquí podés cambiar roles y activar/desactivar cuentas.
      </p>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>{['Nombre', 'Rol', 'Estado', 'Acciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={td}>{u.full_name}</td>
                <td style={td}>
                  <select value={u.role_id} onChange={e => updateRole(u.id, e.target.value)} style={{ ...inp, fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td style={{ ...td, color: u.active ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                  {u.active ? 'Activo' : 'Inactivo'}
                </td>
                <td style={td}>
                  <button onClick={() => toggleUser(u.id, u.active)} style={smallBtn}>
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Cuentas corrientes ───────────────────────────────────────
function CreditAccountsAdmin() {
  const [accounts, setAccounts] = useState([])
  const [form, setForm]         = useState({ name: '', phone: '' })
  const [abonoId, setAbonoId]   = useState(null)
  const [abonoAmount, setAbonoAmount] = useState('')
  const { user } = useAuth()

  useEffect(() => {
    supabase.from('credit_accounts').select('*').order('name').then(({ data }) => setAccounts(data ?? []))
  }, [])

  async function create() {
    if (!form.name) { toast.error('Nombre requerido'); return }
    await supabase.from('credit_accounts').insert(form)
    toast.success('Cuenta creada')
    setForm({ name: '', phone: '' })
    supabase.from('credit_accounts').select('*').order('name').then(({ data }) => setAccounts(data ?? []))
  }

  async function registerAbono(accountId) {
    const amount = parseFloat(abonoAmount)
    if (!amount || amount <= 0) { toast.error('Monto inválido'); return }

    await supabase.from('credit_payments').insert({
      credit_account_id: accountId,
      amount,
      registered_by: user.id,
    })

    toast.success('Abono registrado')
    setAbonoId(null)
    setAbonoAmount('')
    supabase.from('credit_accounts').select('*').order('name').then(({ data }) => setAccounts(data ?? []))
  }

  return (
    <div style={sectionWrap}>
      <div style={formCard}>
        <h3 style={formTitle}>Nueva cuenta corriente</h3>
        <div style={formGrid}>
          <Field label="Nombre del cliente" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Teléfono (opcional)" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
        </div>
        <button onClick={create} style={primaryBtn}>Crear cuenta</button>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>{['Cliente', 'Saldo deudor', 'Acciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <>
                <tr key={acc.id}>
                  <td style={td}>{acc.name}</td>
                  <td style={{ ...td, color: acc.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: '700' }}>
                    {formatMoney(acc.balance)}
                  </td>
                  <td style={td}>
                    <button onClick={() => setAbonoId(abonoId === acc.id ? null : acc.id)} style={smallBtn}>
                      💰 Registrar abono
                    </button>
                  </td>
                </tr>
                {abonoId === acc.id && (
                  <tr>
                    <td colSpan={3} style={{ padding: '0.5rem 1rem', background: '#f0fdf4' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          placeholder="Monto a abonar"
                          value={abonoAmount}
                          onChange={e => setAbonoAmount(e.target.value)}
                          style={{ ...inp, maxWidth: '160px' }}
                        />
                        <button onClick={() => registerAbono(acc.id)} style={primaryBtn}>Confirmar abono</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Sub-componentes compartidos ──────────────────────────────
function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} />
    </div>
  )
}

// Estilos
const container = { minHeight: '100vh', background: '#f8f4ef', padding: '1rem' }
const pageTitle = { fontSize: '1.6rem', fontWeight: '700', color: '#2d1b00', marginBottom: '0.75rem' }
const tabBar = { display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }
const tabBtn = { padding: '0.5rem 1rem', border: '2px solid #e5d5c0', borderRadius: '0.625rem', background: 'white', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }
const tabActive = { background: '#c8860a', borderColor: '#c8860a', color: 'white' }
const sectionWrap = { display: 'flex', flexDirection: 'column', gap: '1.25rem' }
const formCard = { background: 'white', borderRadius: '1rem', padding: '1.25rem', border: '1.5px solid #e5d5c0' }
const formTitle = { fontSize: '1rem', fontWeight: '700', color: '#2d1b00', margin: '0 0 1rem' }
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }
const formActions = { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }
const lbl = { fontSize: '0.82rem', fontWeight: '600', color: '#555', display: 'block', marginBottom: '0.3rem' }
const inp = { padding: '0.6rem 0.875rem', border: '2px solid #e5d5c0', borderRadius: '0.5rem', fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' }
const tableWrap = { background: 'white', borderRadius: '1rem', padding: '1rem', border: '1.5px solid #e5d5c0', overflowX: 'auto' }
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }
const th = { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #e5d5c0', fontSize: '0.8rem', color: '#888', fontWeight: '600' }
const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid #f0e8dc' }
const primaryBtn = { padding: '0.65rem 1.25rem', background: '#c8860a', border: 'none', borderRadius: '0.625rem', color: 'white', fontWeight: '700', cursor: 'pointer' }
const cancelBtn = { padding: '0.65rem 1.25rem', background: 'white', border: '2px solid #e5d5c0', borderRadius: '0.625rem', fontWeight: '600', cursor: 'pointer' }
const smallBtn = { padding: '0.3rem 0.6rem', background: '#f5e6d3', border: 'none', borderRadius: '0.375rem', color: '#c8860a', fontWeight: '600', cursor: 'pointer', fontSize: '0.82rem' }
const promoBadge = { display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#fef3c7', borderRadius: '999px', padding: '0.2rem 0.5rem', fontSize: '0.8rem', marginRight: '0.25rem' }
const delPromoBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '0.75rem' }
