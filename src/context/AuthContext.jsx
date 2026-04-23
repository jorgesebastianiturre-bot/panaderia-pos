// src/context/AuthContext.jsx
// Maneja autenticación y rol del usuario actual

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [profile, setProfile] = useState(null) // datos de panaderia.users
  const [loading, setLoading] = useState(true)

  // Carga perfil del usuario desde la tabla panaderia.users
  async function loadProfile(authUser) {
    if (!authUser) { setProfile(null); return }
    const { data } = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('id', authUser.id)
      .single()
    setProfile(data)
  }

  useEffect(() => {
    // Verificar sesión al iniciar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null).finally(() => setLoading(false))
    })

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  // Helpers de rol
  const role       = profile?.roles?.name ?? null
  const isAdmin    = role === 'admin'
  const isGestor   = role === 'gestor' || role === 'admin'
  const isVendedor = !!role // cualquier rol puede vender

  return (
    <AuthContext.Provider value={{ user, profile, loading, role, isAdmin, isGestor, isVendedor, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
