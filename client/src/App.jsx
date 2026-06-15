import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TicketDetail from './pages/TicketDetail'
import CreateTicket from './pages/CreateTicket'
import MyRequests from './pages/MyRequests'
import Users from './pages/Users'
import Teams from './pages/Teams'
import CMDB from './pages/CMDB'
import CIDetail from './pages/CIDetail'
import Services from './pages/Services'
import Contracts from './pages/Contracts'
import AuditPage from './pages/AuditPage'
import EmailConfig from './pages/EmailConfig'
import Reports from './pages/Reports'
import WebhooksPage from './pages/WebhooksPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
            <Route path="create-ticket" element={<CreateTicket />} />
            <Route path="my-requests" element={<MyRequests />} />
            <Route path="users" element={<Users />} />
            <Route path="teams" element={<Teams />} />
            <Route path="cmdb" element={<CMDB />} />
            <Route path="cmdb/:id" element={<CIDetail />} />
            <Route path="services" element={<Services />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="email-config" element={<EmailConfig />} />
            <Route path="reports" element={<Reports />} />
            <Route path="webhooks" element={<WebhooksPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
