// src/components/shared/ProtectedRoute.jsx
// Protege rutas según autenticación y rol

import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children, requireGestor = false, requireAdmin = false }) {
  const { user, loading, isGestor, isAdmin } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f4ef' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '3rem' }}>🍞</span>
          <p style={{ color: '#888', marginTop: '1rem' }}>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requireAdmin && !isAdmin) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: '#dc2626', fontWeight: '700' }}>Acceso denegado — se requiere rol Admin</p>
    </div>
  )

  if (requireGestor && !isGestor) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: '#dc2626', fontWeight: '700' }}>Acceso denegado — se requiere rol Gestor o Admin</p>
    </div>
  )

  return children
}
