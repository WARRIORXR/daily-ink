import { Link, Navigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { InkMark } from '../components/Navbar'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { mode, loading } = useAuth()

  if (loading) return null
  if (mode === 'server') return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh flex-col bg-bg text-ink">
      <header className="mx-auto flex w-full max-w-sm items-center justify-between px-5 py-6">
        <Link to="/" className="flex items-center gap-2 text-ink">
          <InkMark className="h-4 w-4" />
          <span className="font-display text-lg tracking-tight">Daily Ink</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-5 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <AuthForm />
        </div>
      </main>
    </div>
  )
}
