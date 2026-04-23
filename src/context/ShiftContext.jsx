// src/context/ShiftContext.jsx
// Maneja el turno activo del vendedor

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const ShiftContext = createContext(null)

export function ShiftProvider({ children }) {
  const { user, isVendedor } = useAuth()
  const [shift, setShift]   = useState(null)    // turno activo
  const [loading, setLoading] = useState(true)

  // Detectar turno abierto del día actual para este usuario
  async function loadShift() {
    if (!user) { setShift(null); setLoading(false); return }
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .eq('status', 'abierto')
      .maybeSingle()
    setShift(data)
    setLoading(false)
  }

  useEffect(() => { loadShift() }, [user])

  // Abrir un nuevo turno
  async function openShift(shiftType) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('shifts')
      .insert({ date: today, shift_type: shiftType, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    setShift(data)
    return data
  }

  // Cerrar turno (lógica completa en ShiftClose page)
  async function refreshShift() { await loadShift() }

  return (
    <ShiftContext.Provider value={{ shift, loading, openShift, refreshShift }}>
      {children}
    </ShiftContext.Provider>
  )
}

export function useShift() {
  return useContext(ShiftContext)
}
