import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

/**
 * Guard for admin-only routes. The real enforcement lives in the database
 * (row level security on login_events), so even a hand-crafted request from a
 * non-admin returns nothing. This guard just keeps the page out of reach.
 */
export default function RequireAdmin({ children }) {
  const { user, isAdmin, adminLoading, loading, configured } = useAuth()

  if (loading || (user && adminLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg">
        <Spinner label="Checking access..." />
      </div>
    )
  }

  // Without a Supabase project there are no accounts and therefore no admins.
  if (!configured || !user || !isAdmin) return <Navigate to="/" replace />

  return children
}
