import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno de Supabase. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel/local.'
  );
}

// IMPORTANTE: NO configurar db.schema acá.
// Auth usa el esquema por defecto y agregar schema global puede romper login/register.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --------------------
// Helpers de Auth
// --------------------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
}

export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  return session;
}

// --------------------
// Operaciones en panaderia.users (RLS)
// --------------------

/**
 * Busca el perfil del usuario en panaderia.users por auth_id (uuid del usuario auth).
 */
export async function getPanaderiaUserByAuthId(authUserId) {
  const { data, error } = await supabase
    .schema('panaderia')
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Crea/actualiza perfil en panaderia.users (si tus políticas RLS lo permiten).
 */
export async function upsertPanaderiaUser(userPayload) {
  const { data, error } = await supabase
    .schema('panaderia')
    .from('users')
    .upsert(userPayload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actualiza campos de panaderia.users por id (uuid).
 */
export async function updatePanaderiaUser(userId, updates) {
  const { data, error } = await supabase
    .schema('panaderia')
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
