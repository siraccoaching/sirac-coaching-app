import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/hooks'
import { useRealtimeNotifications, useEnsurePush } from './lib/notify'
import { useOfflineSync } from './lib/offline'
import ConsentGate from './components/ConsentGate'
import Login from './pages/Login'
const Legal = lazy(() => import('./pages/Legal'))
const AIMealPlan = lazy(() => import('./pages/client/AIMealPlan'))
const CoachDashboard = lazy(() => import('./pages/coach/Dashboard'))
const ClientDetail = lazy(() => import('./pages/coach/ClientDetail'))
const AddClient = lazy(() => import('./pages/coach/AddClient'))
const Programs = lazy(() => import('./pages/coach/Programs'))
const ProgramBuilder = lazy(() => import('./pages/coach/ProgramBuilder'))
const ProgramDetail = lazy(() => import('./pages/coach/ProgramDetail'))
const CoachSettings = lazy(() => import('./pages/coach/CoachSettings'))
const ClientHome = lazy(() => import('./pages/client/Home'))
const SessionLog = lazy(() => import('./pages/client/SessionLog'))
const SessionHistory = lazy(() => import('./pages/client/History'))
const MyProgram = lazy(() => import('./pages/client/MyProgram'))
const SessionLogger = lazy(() => import('./pages/client/SessionLogger'))
const Measurements = lazy(() => import('./pages/client/Measurements'))
const WeeklyCheckin = lazy(() => import('./pages/client/WeeklyCheckin'))
const BookSession = lazy(() => import('./pages/client/BookSession'))
const Progress = lazy(() => import('./pages/client/Progress'))
const ExerciseLibrary = lazy(() => import('./pages/coach/ExerciseLibrary'))
const CoachCalendar = lazy(() => import('./pages/coach/CoachCalendar'))
const ProgramTemplates = lazy(() => import('./pages/coach/ProgramTemplates'))
const CoachMessages = lazy(() => import('./pages/Messages').then(m => ({ default: m.CoachMessages })))
const ClientMessages = lazy(() => import('./pages/Messages').then(m => ({ default: m.ClientMessages })))
const JoinCoach = lazy(() => import('./pages/JoinCoach'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Onboarding = lazy(() => import('./pages/client/Onboarding'))
const FreeSession = lazy(() => import('./pages/client/FreeSession'))
const NutritionPlans = lazy(() => import('./pages/coach/NutritionPlans'))
const Nutrition = lazy(() => import('./pages/client/Nutrition'))
const Profile = lazy(() => import('./pages/client/Profile'))

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
  useRealtimeNotifications(user ? profile : null)
  useEnsurePush(user ? profile : null)
  const { offline, pending, justSynced } = useOfflineSync(!!user && profile?.role === 'client')
  if (loading) return <Loader />
  return (
    <BrowserRouter>
      <div className="ios-statusbar" aria-hidden />
      {(offline || pending > 0 || justSynced > 0) && (
        <div data-testid="sync-pill" role="status" style={{ position: 'fixed', bottom: 'calc(66px + var(--sab))', left: '50%', transform: 'translateX(-50%)', zIndex: 960, padding: '6px 14px', borderRadius: 20,
          fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(0,0,0,.15)',
          background: justSynced ? '#34c759' : offline ? '#ff9500' : 'var(--accent)', color: 'white', pointerEvents: 'none' }}>
          {justSynced ? `✓ ${justSynced} séance${justSynced > 1 ? 's' : ''} envoyée${justSynced > 1 ? 's' : ''} au coach`
            : offline ? `📶 Hors ligne${pending ? ` · ${pending} séance${pending > 1 ? 's' : ''} en attente` : ''}`
            : `Envoi de ${pending} séance${pending > 1 ? 's' : ''}…`}
        </div>
      )}
      <Suspense fallback={<Loader />}>
      <ConsentGate profile={user ? profile : null}>
      <Routes>
        <Route path="/legal/:doc" element={<Legal />} />
        <Route path="/login" element={
          user ? <Navigate to={profile?.role === 'coach' ? '/coach' : '/client'} replace /> : <Login />
        } />
        <Route path="/coach" element={<ProtectedRoute requiredRole="coach"><CoachDashboard /></ProtectedRoute>} />
        <Route path="/coach/client/:id/meal-plan" element={<ProtectedRoute requiredRole="coach"><AIMealPlan /></ProtectedRoute>} />
        <Route path="/coach/client/:id" element={<ProtectedRoute requiredRole="coach"><ClientDetail /></ProtectedRoute>} />
        <Route path="/coach/add-client" element={<ProtectedRoute requiredRole="coach"><AddClient /></ProtectedRoute>} />
        <Route path="/coach/programs" element={<ProtectedRoute requiredRole="coach"><Programs /></ProtectedRoute>} />
        <Route path="/coach/programs/new" element={<ProtectedRoute requiredRole="coach"><ProgramBuilder /></ProtectedRoute>} />
        <Route path="/coach/programs/:id/edit" element={<ProtectedRoute requiredRole="coach"><ProgramBuilder /></ProtectedRoute>} />
        <Route path="/coach/programs/:id" element={<ProtectedRoute requiredRole="coach"><ProgramDetail /></ProtectedRoute>} />
        <Route path="/coach/settings" element={<ProtectedRoute requiredRole="coach"><CoachSettings /></ProtectedRoute>} />
        <Route path="/client" element={<ProtectedRoute requiredRole="client"><ClientHome /></ProtectedRoute>} />
        <Route path="/client/session/:sessionId" element={<ProtectedRoute requiredRole="client"><SessionLog /></ProtectedRoute>} />
        <Route path="/client/history" element={<ProtectedRoute requiredRole="client"><SessionHistory /></ProtectedRoute>} />
        <Route path="/client/program" element={<ProtectedRoute requiredRole="client"><MyProgram /></ProtectedRoute>} />
        <Route path="/client/session-log/:sessionId" element={<ProtectedRoute requiredRole="client"><SessionLogger /></ProtectedRoute>} />
        <Route path="/client/measurements" element={<ProtectedRoute requiredRole="client"><Measurements /></ProtectedRoute>} />
        <Route path="/client/checkin" element={<ProtectedRoute requiredRole="client"><WeeklyCheckin /></ProtectedRoute>} />
        <Route path="/client/book" element={<ProtectedRoute requiredRole="client"><BookSession /></ProtectedRoute>} />
        <Route path="/client/progress" element={<ProtectedRoute requiredRole="client"><Progress /></ProtectedRoute>} />
        <Route path="/coach/exercises" element={<ProtectedRoute requiredRole="coach"><ExerciseLibrary /></ProtectedRoute>} />
        <Route path="/coach/calendar" element={<ProtectedRoute requiredRole="coach"><CoachCalendar /></ProtectedRoute>} />
        <Route path="/coach/templates" element={<ProtectedRoute requiredRole="coach"><ProgramTemplates /></ProtectedRoute>} />
        <Route path="/coach/messages" element={<ProtectedRoute requiredRole="coach"><CoachMessages /></ProtectedRoute>} />
        <Route path="/coach/messages/:clientId" element={<ProtectedRoute requiredRole="coach"><CoachMessages /></ProtectedRoute>} />
        <Route path="/client/messages" element={<ProtectedRoute requiredRole="client"><ClientMessages /></ProtectedRoute>} />
        <Route path="/join" element={<JoinCoach />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/client/onboarding" element={<ProtectedRoute requiredRole="client"><Onboarding /></ProtectedRoute>} />
        <Route path="/client/free-session" element={<ProtectedRoute requiredRole="client"><FreeSession /></ProtectedRoute>} />
        <Route path="/coach/nutrition" element={<ProtectedRoute requiredRole="coach"><NutritionPlans /></ProtectedRoute>} />
        <Route path="/client/nutrition" element={<ProtectedRoute requiredRole="client"><Nutrition /></ProtectedRoute>} />
        <Route path="/client/meal-plan" element={<ProtectedRoute requiredRole="client"><AIMealPlan /></ProtectedRoute>} />
        <Route path="/client/profile" element={<ProtectedRoute requiredRole="client"><Profile /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? (profile?.role === 'coach' ? '/coach' : '/client') : '/login'} replace />} />
      </Routes>
      </ConsentGate>
      </Suspense>
    </BrowserRouter>
  )
}
