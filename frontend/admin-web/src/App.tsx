import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import type { Role } from './types';
import LoginPage from './pages/LoginPage';
import JobListPage from './pages/JobListPage';
import CandidateListPage from './pages/CandidateListPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import ScreeningWorkbenchPage from './pages/ScreeningWorkbenchPage';
import InterviewListPage from './pages/InterviewListPage';
import InterviewDetailPage from './pages/InterviewDetailPage';
import UserAdminPage from './pages/UserAdminPage';
import TalentPoolPage from './pages/TalentPoolPage';
import TalentSettingsPage from './pages/TalentSettingsPage';
import CalendarPage from './pages/CalendarPage';
import OfferListPage from './pages/OfferListPage';
import ReportsPage from './pages/ReportsPage';
import NotificationPage from './pages/NotificationPage';
import AuditPage from './pages/AuditPage';
import CategoryAdminPage from './pages/CategoryAdminPage';
import DashboardPage from './pages/DashboardPage';
import AnnouncementListPage from './pages/AnnouncementListPage';
import AnnouncementEditPage from './pages/AnnouncementEditPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">加载中…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireRole({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route
          path="/jobs"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <JobListPage />
            </RequireRole>
          }
        />
        <Route
          path="/jobs/new"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <JobListPage />
            </RequireRole>
          }
        />
        <Route
          path="/jobs/:id/edit"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <JobListPage />
            </RequireRole>
          }
        />
        {/* 只读岗位详情（深链 / 复制链接分享） */}
        <Route
          path="/jobs/:id"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <JobListPage />
            </RequireRole>
          }
        />
        <Route
          path="/candidates"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <CandidateListPage />
            </RequireRole>
          }
        />
        <Route
          path="/candidates/:id"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <CandidateDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/screening"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <ScreeningWorkbenchPage />
            </RequireRole>
          }
        />
        <Route
          path="/jobs/:jobId/screening"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <ScreeningWorkbenchPage />
            </RequireRole>
          }
        />
        <Route
          path="/interviews"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR', 'INTERVIEWER']}>
              <InterviewListPage />
            </RequireRole>
          }
        />
        <Route
          path="/interviews/:id"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR', 'INTERVIEWER']}>
              <InterviewDetailPage />
            </RequireRole>
          }
        />
        <Route
          path="/talents"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <TalentPoolPage />
            </RequireRole>
          }
        />
        <Route
          path="/talent-settings"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <TalentSettingsPage />
            </RequireRole>
          }
        />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route
          path="/offers"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <OfferListPage />
            </RequireRole>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route path="/notifications" element={<NotificationPage />} />
        <Route
          path="/audit"
          element={
            <RequireRole roles={['SUPER_ADMIN']}>
              <AuditPage />
            </RequireRole>
          }
        />
        <Route
          path="/users"
          element={
            <RequireRole roles={['SUPER_ADMIN']}>
              <UserAdminPage />
            </RequireRole>
          }
        />
        <Route
          path="/job-categories"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR', 'DIRECTION_OWNER']}>
              <CategoryAdminPage />
            </RequireRole>
          }
        />
        <Route
          path="/announcements"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <AnnouncementListPage />
            </RequireRole>
          }
        />
        <Route
          path="/announcements/new"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <AnnouncementEditPage />
            </RequireRole>
          }
        />
        <Route
          path="/announcements/:id/edit"
          element={
            <RequireRole roles={['SUPER_ADMIN', 'HR']}>
              <AnnouncementEditPage />
            </RequireRole>
          }
        />
        {/* Default authenticated root: redirect to dashboard */}
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
