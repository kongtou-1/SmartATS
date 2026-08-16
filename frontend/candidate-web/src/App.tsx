import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import JobListPage from './pages/JobListPage';
import JobDetailPage from './pages/JobDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyResumePage from './pages/MyResumePage';
import MyApplicationsPage from './pages/MyApplicationsPage';
import MyOffersPage from './pages/MyOffersPage';
import OfferResponsePage from './pages/OfferResponsePage';
import ApplyWizardPage from './pages/ApplyWizardPage';
import AnnouncementListPage from './pages/AnnouncementListPage';
import AnnouncementDetailPage from './pages/AnnouncementDetailPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">加载中…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/offer-response/:token" element={<OfferResponsePage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<JobListPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/announcements" element={<AnnouncementListPage />} />
        <Route path="/announcements/:id" element={<AnnouncementDetailPage />} />
      </Route>
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/resume" element={<MyResumePage />} />
        <Route path="/applications" element={<MyApplicationsPage />} />
        <Route path="/offers" element={<MyOffersPage />} />
        <Route path="/jobs/:id/apply" element={<ApplyWizardPage />} />
        <Route path="/apply" element={<ApplyWizardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
