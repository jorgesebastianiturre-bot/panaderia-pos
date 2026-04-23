// src/pages/Home.jsx
// Redirige automáticamente según si hay turno abierto o no

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShift } from '../context/ShiftContext'
import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { shift, loading } = useShift()
  const { profile }        = useAuth()
  const navigate           = useNavigate()

  useEffect(() => {
    if (!loading) {
      if (shift) {
        navigate('/pos', { replace: true })
      }
      // Si no hay turno, se queda en Home para que el usuario abra uno
    }
  }, [shift, loading])

  if (loading) return null

  // Si ya hay turno, redirige a POS (el useEffect lo maneja)
  if (shift) return null

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <span style={styles.emoji}>🍞</span>
        <h1 style={styles.title}>Bienvenido, {profile?.full_name?.split(' ')[0] ?? ''}</h1>
        <p style={styles.subtitle}>
          No hay turno abierto para hoy.<br />
          Usá el panel lateral para abrir tu turno.
        </p>
        <div style={styles.hint}>
          <p>☀️ <strong>Turno mañana</strong> — primer turno del día</p>
          <p>🌙 <strong>Turno tarde</strong> — segundo turno</p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f8f4ef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    background: 'white',
    borderRadius: '1.5rem',
    padding: '3rem 2.5rem',
    textAlign: 'center',
    maxWidth: '420px',
    width: '100%',
    border: '1.5px solid #e5d5c0',
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },
  emoji: { fontSize: '4rem', display: 'block', marginBottom: '1rem' },
  title: { fontSize: '1.6rem', fontWeight: '700', color: '#2d1b00', margin: '0 0 0.5rem' },
  subtitle: { color: '#888', lineHeight: 1.6, margin: '0 0 1.5rem' },
  hint: {
    background: '#fef3c7',
    borderRadius: '0.875rem',
    padding: '1rem 1.25rem',
    textAlign: 'left',
    fontSize: '0.9rem',
    color: '#92400e',
    lineHeight: 1.8,
  },
}
