import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  supabase,
  signIn as supabaseSignIn,
  signOut as supabaseSignOut,
  getCurrentSession,
  getPanaderiaUserByAuthId,
} from '../lib/supabase';

const AuthContext = createContext(null);

function normalizeAuthError(error) {
  if (!error) return 'Ocurrió un error inesperado.';

  const msg = error.message || String(error);

  if (msg.toLowerCase().includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }

  return msg;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const buildUserState = async (authUser) => {
    if (!authUser) {
      return null;
    }

    const dbUser = await getPanaderiaUserByAuthId(authUser.id);

    if (!dbUser) {
      throw new Error('Tu usuario existe en Auth pero no en panaderia.users. Contactá al administrador.');
    }

    if (!dbUser.role) {
      throw new Error('Tu usuario no tiene rol asignado en panaderia.users.');
    }

    return {
      id: authUser.id,
      email: authUser.email,
      role: dbUser.role,
      profile: dbUser,
      auth: authUser,
    };
  };

  const refreshSessionUser = async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await getCurrentSession();
      const authUser = session?.user ?? null;

      if (!authUser) {
        setUser(null);
        return;
      }

      const fullUser = await buildUserState(authUser);
      setUser(fullUser);
    } catch (err) {
      setUser(null);
      setError(normalizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const session = await getCurrentSession();
        const authUser = session?.user ?? null;

        if (!isMounted) return;

        if (!authUser) {
          setUser(null);
          return;
        }

        const fullUser = await buildUserState(authUser);
        if (!isMounted) return;

        setUser(fullUser);
      } catch (err) {
        if (!isMounted) return;
        setUser(null);
        setError(normalizeAuthError(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      const authUser = session?.user ?? null;
      if (!authUser) {
        setUser(null);
        return;
      }

      try {
        const fullUser = await buildUserState(authUser);
        if (!isMounted) return;
        setUser(fullUser);
      } catch (err) {
        if (!isMounted) return;
        setUser(null);
        setError(normalizeAuthError(err));
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const { user: authUser } = await supabaseSignIn(email, password);

      if (!authUser) {
        throw new Error('No se pudo obtener el usuario autenticado.');
      }

      const fullUser = await buildUserState(authUser);
      setUser(fullUser);

      return { ok: true, user: fullUser };
    } catch (err) {
      const message = normalizeAuthError(err);
      setUser(null);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);

    try {
      await supabaseSignOut();
      setUser(null);
      return { ok: true };
    } catch (err) {
      const message = normalizeAuthError(err);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      signIn,
      signOut,
      refreshSessionUser,
      clearError: () => setError(null),
    }),
    [user, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return context;
}
