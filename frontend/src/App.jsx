import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SavedEventsProvider } from './context/SavedEventsContext'
import { ThemeProvider } from './context/ThemeContext'
import MainLayout from './layouts/MainLayout'
import ProtectedRoute from './routes/ProtectedRoute'

const HomePage = lazy(() => import('./pages/public/HomePage'))
const ExploreEventsPage = lazy(() => import('./pages/public/ExploreEventsPage'))
const EventDetailPage = lazy(() => import('./pages/public/EventDetailPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const DashboardPage = lazy(() => import('./pages/fan/DashboardPage'))
const ProfileSettingsPage = lazy(() => import('./pages/fan/ProfileSettingsPage'))
const SavedEventsPage = lazy(() => import('./pages/fan/SavedEventsPage'))
const FollowingPage = lazy(() => import('./pages/fan/FollowingPage'))
const NotificationsPage = lazy(() => import('./pages/fan/NotificationsPage'))
const ArtistDirectoryPage = lazy(() => import('./pages/public/ArtistDirectoryPage'))
const ArtistProfilePage = lazy(() => import('./pages/public/ArtistProfilePage'))
const ArtistDashboardPage = lazy(() => import('./pages/artist/ArtistDashboardPage'))
const PromoterDashboardPage = lazy(() => import('./pages/promoter/PromoterDashboardPage'))
const PromoterProfilePage = lazy(() => import('./pages/promoter/PromoterProfilePage'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <SavedEventsProvider>
          <Suspense
            fallback={
              <div role="status" className="min-h-screen bg-[var(--bg)] p-8 text-center text-sm text-[var(--text-soft)]">
                Loading EchoRoom…
              </div>
            }
          >
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/events" element={<ExploreEventsPage />} />
                <Route path="/events/:eventId" element={<EventDetailPage />} />
                <Route path="/artists" element={<ArtistDirectoryPage />} />
                <Route path="/artists/:artistId" element={<ArtistProfilePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['fan']}>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/profile"
                  element={
                    <ProtectedRoute allowedRoles={['fan']}>
                      <ProfileSettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/saved-events"
                  element={
                    <ProtectedRoute allowedRoles={['fan']}>
                      <SavedEventsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/following"
                  element={
                    <ProtectedRoute allowedRoles={['fan']}>
                      <FollowingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['fan']}>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/artist"
                  element={
                    <ProtectedRoute allowedRoles={['artist']}>
                      <ArtistDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/promoter"
                  element={
                    <ProtectedRoute allowedRoles={['promoter']}>
                      <PromoterDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/promoter/profile"
                  element={
                    <ProtectedRoute allowedRoles={['promoter']}>
                      <PromoterProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
          </SavedEventsProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
