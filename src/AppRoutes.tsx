
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { SmartRootRoute } from "./components/SmartRootRoute";
import { OnboardingGuard } from "./components/OnboardingGuard";
import { NetworkErrorBoundary } from "./components/NetworkErrorBoundary";
import { Suspense, lazy } from "react";

// Lazy load components for better performance - handling named exports
const Index = lazy(() => import("./pages/Index"));
const CompanyProfilePage = lazy(() => import("./components/CompanyProfilePage").then(module => ({ default: module.CompanyProfilePage })));
const TeamPage = lazy(() => import("./components/TeamPage").then(module => ({ default: module.TeamPage })));
const LandingPage = lazy(() => import("./components/LandingPage").then(module => ({ default: module.LandingPage })));
const OnboardingFlow = lazy(() => import("./components/OnboardingFlow").then(module => ({ default: module.OnboardingFlow })));
const CalendarView = lazy(() => import("./components/CalendarView").then(module => ({ default: module.CalendarView })));
const Homepage = lazy(() => import("./components/Homepage").then(module => ({ default: module.Homepage })));
const SocialPlannerPage = lazy(() => import("./components/social/SocialPlannerPage").then(module => ({ default: module.SocialPlannerPage })));
const ContentLibrary = lazy(() => import("./components/content-library/ContentLibrary").then(module => ({ default: module.ContentLibrary })));
const AnalyticsDashboard = lazy(() => import("./components/analytics/AnalyticsDashboard").then(module => ({ default: module.AnalyticsDashboard })));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard").then(module => ({ default: module.AdminDashboard })));
const DevSocialPage = lazy(() => import("./components/social/DevSocialPage").then(module => ({ default: module.DevSocialPage })));
const CompleteLandingPage = lazy(() => import("./components/landing/CompleteLandingPage").then(module => ({ default: module.CompleteLandingPage })));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-garden-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-text-secondary">Loading...</p>
    </div>
  </div>
);

export function AppRoutes() {
  return (
    <NetworkErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<SmartRootRoute />} />
          <Route path="/landing" element={
            <PublicRoute>
              <LandingPage />
            </PublicRoute>
          } />
          <Route path="/complete-landing" element={
            <PublicRoute>
              <CompleteLandingPage />
            </PublicRoute>
          } />
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingFlow onComplete={() => {}} />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <Index />
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="/homepage" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <Homepage />
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <CompanyProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/team" element={
            <ProtectedRoute>
              <TeamPage />
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <CalendarView />
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="/social" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <SocialPlannerPage />
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="/content-library" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <ContentLibrary onboardingData={{}} />
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute>
              <OnboardingGuard>
                <AnalyticsDashboard />
              </OnboardingGuard>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/dev/social" element={
            <ProtectedRoute>
              <DevSocialPage />
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </NetworkErrorBoundary>
  );
}
