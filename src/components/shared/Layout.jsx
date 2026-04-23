// src/components/shared/Layout.jsx
// Layout principal con navegación lateral adaptada por rol

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useShift } from '../../context/ShiftContext'
import toast from 'react-hot-toast'

export default function Layout({ children }) {
  const { profile, role, isGestor, isAdmin, signOut } = useAuth()
  const { shift, openShift } = useShift()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openingShift, setOpeningShift] = useState(false)

  async function handleOpenShift(type) {
    setOpeningShift(true)
    try {
      await openShift(type)
      toast.success(`Turno ${type} abierto`)
    } catch (err) {
      // Si ya existe un turno para esa franja, lo informa
      toast.error(err.message?.includes('unique') ? 'Ya existe un turno para esa franja' : 'Error al abrir turno')
    } finally {
      setOpeningShift(false)
    }
  }

  // Ítems de navegación por rol
  const navItems = [
    { path: '/',            label: 'Venta',         icon: '🛒', always: true },
    { path: '/production',  label: 'Producción',    icon: '🍞', show: isGestor },
    { path: '/purchases',   label: 'Compras',       icon: '🛒', show: isGestor },
    { path: '/reports',     label: 'Reportes',      icon: '📊', show: isGestor },
    { path: '/admin',       label: 'Admin',         icon: '⚙️', show: isGestor },
    { path: '/shift-close', label: 'Cerrar turno',  icon: '🔒', always: true },
  ].filter(i => i.always || i.show)

  return (
    <div style={styles.app}>
      {/* ── Sidebar (desktop) ─────────────────── */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.logo}>🍞</span>
          <div>
            <p style={styles.brandName}>Panadería</p>
            <p style={styles.brandRole}>{profile?.full_name ?? '...'}</p>
          </div>
        </div>

        {/* Estado del turno */}
        <div style={styles.shiftBox}>
          {shift ? (
            <div style={styles.shiftActive}>
              <span style={styles.shiftDot} />
              <span>Turno {shift.shift_type} abierto</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <p style={styles.noShift}>Sin turno activo</p>
              <button
                onClick={() => handleOpenShift('mañana')}
                disabled={openingShift}
                style={styles.openShiftBtn}
              >
                ☀️ Abrir turno mañana
              </button>
              <button
                onClick={() => handleOpenShift('tarde')}
                disabled={openingShift}
                style={{ ...styles.openShiftBtn, background: '#f59e0b' }}
              >
                🌙 Abrir turno tarde
              </button>
            </div>
          )}
        </div>

        {/* Navegación */}
        <nav style={styles.nav}>
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                ...styles.navItem,
                ...(location.pathname === item.path ? styles.navItemActive : {}),
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Cerrar sesión */}
        <button
          onClick={async () => { await signOut(); navigate('/login') }}
          style={styles.signOutBtn}
        >
          Cerrar sesión
        </button>
      </aside>

      {/* ── Contenido principal ───────────────── */}
      <main style={styles.main}>
        {/* Topbar en mobile */}
        <div style={styles.topbar}>
          <span style={styles.topbarLogo}>🍞 Panadería</span>
          <button onClick={() => setMenuOpen(!menuOpen)} style={styles.menuToggle}>
            ☰
          </button>
        </div>

        {/* Menú mobile desplegable */}
        {menuOpen && (
          <div style={styles.mobileMenu}>
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMenuOpen(false) }}
                style={styles.mobileMenuItem}
              >
                {item.icon} {item.label}
              </button>
            ))}
            <button
              onClick={async () => { await signOut(); navigate('/login') }}
              style={{ ...styles.mobileMenuItem, color: '#dc2626' }}
            >
              Cerrar sesión
            </button>
          </div>
        )}

        <div style={styles.content}>
          {children}
        </div>
      </main>
    </div>
  )
}

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },
  // Sidebar
  sidebar: {
    width: '220px',
    background: '#2d1b00',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflowY: 'auto',
    // Ocultar en mobile con media query no es posible inline;
    // lo manejamos con el topbar
    '@media (max-width: 768px)': { display: 'none' },
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1.25rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logo: { fontSize: '2rem' },
  brandName: { margin: 0, fontWeight: '700', fontSize: '1rem' },
  brandRole: { margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', textTransform: 'capitalize' },
  shiftBox: {
    padding: '0.875rem 1rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  shiftActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: '#86efac',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  shiftDot: {
    width: '8px', height: '8px',
    borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
  },
  noShift: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.5)',
    margin: '0 0 0.4rem',
  },
  openShiftBtn: {
    width: '100%',
    padding: '0.5rem',
    background: '#c8860a',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'white',
    fontSize: '0.82rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.75rem 0.5rem',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.7rem 0.875rem',
    background: 'none',
    border: 'none',
    borderRadius: '0.625rem',
    color: 'rgba(255,255,255,0.75)',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    textAlign: 'left',
    transition: 'all 0.15s',
    width: '100%',
  },
  navItemActive: {
    background: 'rgba(200,134,10,0.3)',
    color: '#fbbf24',
    fontWeight: '700',
  },
  navIcon: { fontSize: '1.1rem', width: '20px', textAlign: 'center' },
  signOutBtn: {
    margin: '0.75rem',
    padding: '0.6rem',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '0.5rem',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  // Contenido
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topbar: {
    display: 'none', // visible en mobile via CSS, acá lo dejamos visible siempre en pantallas pequeñas
    padding: '0.75rem 1rem',
    background: '#2d1b00',
    color: 'white',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  topbarLogo: { fontWeight: '700', fontSize: '1.1rem' },
  menuToggle: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
  mobileMenu: {
    background: '#2d1b00',
    display: 'flex',
    flexDirection: 'column',
    borderBottom: '2px solid #c8860a',
    zIndex: 50,
  },
  mobileMenuItem: {
    padding: '0.875rem 1.25rem',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'left',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: '500',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
}
