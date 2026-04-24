import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/Layout';
import Applications from './pages/Applications';
import TimelinePage from './pages/Timeline';
import Todos from './pages/Todos';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/Login';
import Tools from './pages/Tools';
import BatchImport from './pages/BatchImport';
import CalendarPage from './pages/CalendarPage';
import Ratings from './pages/Ratings';
import WeeklyReport from './pages/WeeklyReport';
import ShareView from './pages/ShareView';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/share/:token" element={<ShareView />} />
      <Route path="/" element={<ProtectedRoute><AppLayout><Applications /></AppLayout></ProtectedRoute>} />
      <Route path="/timeline" element={<ProtectedRoute><AppLayout><TimelinePage /></AppLayout></ProtectedRoute>} />
      <Route path="/todos" element={<ProtectedRoute><AppLayout><Todos /></AppLayout></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/tools" element={<ProtectedRoute><AppLayout><Tools /></AppLayout></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><AppLayout><CalendarPage /></AppLayout></ProtectedRoute>} />
      <Route path="/ratings" element={<ProtectedRoute><AppLayout><Ratings /></AppLayout></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><AppLayout><WeeklyReport /></AppLayout></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute><AppLayout><BatchImport /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
