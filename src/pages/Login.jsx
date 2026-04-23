import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { signIn, isAuthenticated, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => clearError?.();
  }, [clearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    clearError?.();

    if (!email || !password) {
      setLocalError('Completá email y contraseña.');
      return;
    }

    const result = await signIn(email.trim(), password);

    if (!result.ok) {
      setLocalError(result.error || 'No se pudo iniciar sesión.');
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f7f7f8',
        padding: '16px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: 20,
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 18, fontSize: 22 }}>Iniciar sesión</h1>

        <label style={{ display: 'block', marginBottom: 6 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          autoComplete="email"
          style={{
            width: '100%',
            height: 40,
            borderRadius: 8,
            border: '1px solid #d1d5db',
            padding: '0 12px',
            marginBottom: 12,
          }}
        />

        <label style={{ display: 'block', marginBottom: 6 }}>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          autoComplete="current-password"
          style={{
            width: '100%',
            height: 40,
            borderRadius: 8,
            border: '1px solid #d1d5db',
            padding: '0 12px',
            marginBottom: 12,
          }}
        />

        {(localError || error) && (
          <p style={{ color: '#b91c1c', marginTop: 0, marginBottom: 12 }}>
            {localError || error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            height: 42,
            border: 'none',
            borderRadius: 8,
            background: loading ? '#9ca3af' : '#111827',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
