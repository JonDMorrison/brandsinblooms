
import React from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Onboarding from './pages/OnboardingPage';
import Dashboard from './pages/Index';
import PricingPage from './pages/PricingPage';
import AccountSettings from './pages/AccountPage';
import CompanyProfile from './pages/ProfilePage';
import SocialAccounts from './pages/SocialPage';
import BillingPage from './pages/BillingPage';
import CalendarPage from './pages/CalendarPage';
import TeamPage from './pages/TeamPage';
import ContentImportPage from './pages/ContentLibraryPage';
import ReviewQueuePage from './pages/ContentTasksPage';
import DevSocialPageWrapper from './pages/DevSocialPage';
import PublishPage from "./pages/PublishPage";

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
      <Route path="/signup" element={!isAuthenticated ? <Signup /> : <Navigate to="/dashboard" />} />
      <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
      <Route path="/reset-password" element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/dashboard" />} />
      <Route path="/onboarding" element={isAuthenticated ? <Onboarding /> : <Navigate to="/login" />} />
      <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/account" element={isAuthenticated ? <AccountSettings /> : <Navigate to="/login" />} />
      <Route path="/company-profile" element={isAuthenticated ? <CompanyProfile /> : <Navigate to="/login" />} />
      <Route path="/social-accounts" element={isAuthenticated ? <SocialAccounts /> : <Navigate to="/login" />} />
      <Route path="/billing" element={isAuthenticated ? <BillingPage /> : <Navigate to="/login" />} />
      <Route path="/calendar" element={isAuthenticated ? <CalendarPage /> : <Navigate to="/login" />} />
      <Route path="/team" element={isAuthenticated ? <TeamPage /> : <Navigate to="/login" />} />
      <Route path="/content-import" element={isAuthenticated ? <ContentImportPage /> : <Navigate to="/login" />} />
      <Route path="/review-queue" element={isAuthenticated ? <ReviewQueuePage /> : <Navigate to="/login" />} />
      <Route path="/dev-social" element={<DevSocialPageWrapper />} />
      <Route path="/publish" element={<PublishPage />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

const Login = () => <div>Login Page</div>;
const Signup = () => <div>Signup Page</div>;
const ForgotPassword = () => <div>Forgot Password Page</div>;
const ResetPassword = () => <div>Reset Password Page</div>;

export default App;
