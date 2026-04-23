// src/App.jsx
// Router principal de la aplicación

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ShiftProvider } from './context/ShiftContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import Layout from './components/shared/Layout'

// Páginas
import Login      from './pages/Login'
import Home       from './pages/Home'
import POS        from './pages/POS'
import Production from './pages/Production'
import Purchases  from './pages/Purchases'
import Reports    from './pages/Reports'
import Admin      from './pages/Admin'
import ShiftClose from './pages/ShiftClose'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ShiftProvider>
          {/* Notificaciones toast */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#2d1b00',
                color: '#fff',
                borderRadius: '0.75rem',
                fontSize: '0.9rem',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />

          <Routes>
            {/* Ruta pública */}
            <Route path="/login" element={<Login />} />

            {/* Rutas protegidas — todas con Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/pos"
              element={
                <ProtectedRoute>
                  <Layout>
                    <POS />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/shift-close"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ShiftClose />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/production"
              element={
                <ProtectedRoute requireGestor>
                  <Layout>
                    <Production />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/purchases"
              element={
                <ProtectedRoute requireGestor>
                  <Layout>
                    <Purchases />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute requireGestor>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requireGestor>
                  <Layout>
                    <Admin />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Cualquier ruta desconocida → inicio */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ShiftProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
