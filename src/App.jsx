import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Calendar from './pages/Calendar'
import Entries from './pages/Entries'
import Home from './pages/Home'
import Journal from './pages/Journal'
import Login from './pages/Login'
import Review from './pages/Review'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/journal/:date" element={<Journal />} />
        <Route path="/entries" element={<Entries />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/review" element={<Review />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}