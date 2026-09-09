import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-svh bg-paper text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  )
}
