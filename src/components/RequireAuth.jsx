import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

export default function RequireAuth({ children }) {
  const { mode, loading } = useAuth()

  if (loading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-4xl justify-center bg-bg px-4 pt-24">
        <Spinner label="Warming up…" />
      </div>
    )
  }

  // Supabase configured but not signed in → send to login.
  // Local mode needs no auth at all.
  if (mode === 'guest') return <Navigate to="/login" replace />

  return children
}