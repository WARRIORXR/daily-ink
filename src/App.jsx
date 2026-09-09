import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Entries from './pages/Entries'
import Home from './pages/Home'
import Journal from './pages/Journal'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/entries" element={<Entries />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
