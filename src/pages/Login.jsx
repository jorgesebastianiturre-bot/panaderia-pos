// src/pages/Login.jsx
// Pantalla de ingreso al sistema

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      toast.error('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.emoji}>🍞</span>
          <h1 style={styles.title}>Panadería</h1>
          <p style={styles.subtitle}>Sistema de Gestión</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="usuario@ejemplo.com"
              autoFocus
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5e6d3 0%, #e8c99a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    background: 'white',
    borderRadius: '1.5rem',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  emoji: { fontSize: '3.5rem', display: 'block', marginBottom: '0.5rem' },
  title: { fontSize: '2rem', fontWeight: '700', color: '#2d1b00', margin: 0 },
  subtitle: { color: '#8B6914', margin: '0.25rem 0 0', fontSize: '0.95rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontWeight: '600', color: '#444', fontSize: '0.9rem' },
  input: {
    padding: '0.875rem 1rem',
    border: '2px solid #e5d5c0',
    borderRadius: '0.75rem',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    background: '#c8860a',
    color: 'white',
    border: 'none',
    borderRadius: '0.75rem',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '0.5rem',
    transition: 'background 0.2s',
  },
}
