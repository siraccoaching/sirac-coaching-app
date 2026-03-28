import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/hooks'
import Login from './pages/Login'
import CoachDashboard from './pages/coach/Dashboard'
import ClientDetail from './pages/coach/ClientDetail'
import AddClient from './pages/coach/AddClient'
import ClientHome from './pages/client/Home'
import SessionLog from './pages/client/SessionLog'
import SessionHistory from './pages/client/History'

function ProtectedRoute({ children, requiredRole }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to={profile?.role === 'coach' ? '/coach' : '/client'} replace />
  }
  return children
}

function Loader() {
  return (
    <div className="flex h-full items-center justify-center bg-dark-900">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Chargement…</p>
      </div>
    </div>
  )
}

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) return <Loader />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to={profile?.role === 'coach' ? '/coach' : '/client'} replace /> : <Login />
        } />

        {/* Coach routes */}
        <Route path="/coach" element={
          <ProtectedRoute requiredRole="coach"><CoachDashboard /></ProtectedRoute>
        } />
        <Route path="/coach/client/:id" element={
          <ProtectedRoute requiredRole="coach"><ClientDetail /></ProtectedRoute>
        } />
        <Route path="/coach/add-client" element={
          <ProtectedRoute requiredRole="coach"><AddClient /></ProtectedRoute>
        } />

        {/* Client routes */}
        <Route path="/client" element={
          <ProtectedRoute requiredRole="client"><ClientHome /></ProtectedRoute>
        } />
        <Route path="/client/session/:sessionId" element={
          <ProtectedRoute requiredRole="client"><SessionLog /></ProtectedRoute>
        } />
        <Route path="/client/history" element={
          <ProtectedRoute requiredRole="client"><SessionHistory /></ProtectedRoute>
        } />

        <Route path="*" element={
          <Navigate to={user ? (profile?.role === 'coach' ? '/coach' : '/client') : '/login'} replace />
        } />
      </Routes>
    </BrowserRouter>
  )
}
