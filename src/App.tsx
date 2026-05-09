import React, { Suspense } from "react";
import { Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarLayout } from "@/components/SidebarLayout";
import ChunkErrorBoundary from "@/components/loading/ChunkErrorBoundary";
import { PageSkeleton } from "@/components/loading/PageSkeleton";
import PublicPageFallback from "@/components/loading/PublicPageFallback";
import {
  DashboardShell,
  resolveAdminDashboardContentWidth,
} from "@/components/layout/DashboardShell";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PublicRoute } from "@/components/PublicRoute";
import { RecoveryRoute } from "@/components/RecoveryRoute";
import { SmartRootRoute } from "@/components/SmartRootRoute";
import { DataProviderWrapper } from "@/components/DataProviderWrapper";
import { RedirectWithQuery } from "@/components/RedirectWithQuery";
import { NavigationTracker } from "@/components/NavigationTracker";
import { lazyNamed } from "@/utils/lazyNamed";
import { lazyRetry } from "@/utils/lazyRetry";

// ============================================================
// LAZY-LOADED ADMIN PAGES
// ============================================================
const AdminHub = lazyRetry(() => import("@/pages/admin/AdminHub"));
const AdminTenants = lazyRetry(() => import("@/pages/admin/AdminTenants"));
const AdminDashboard = lazyRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminManage = lazyRetry(() => import("@/pages/AdminManage"));
const AdminGovernanceConfig = lazyRetry(
  () => import("@/pages/admin/AdminGovernanceConfig"),
);
const TenantEmailManagement = lazyRetry(
  () => import("@/pages/admin/TenantEmailManagement"),
);
const AdminReportsPage = lazyNamed(
  () => import("@/pages/AdminReportsPage"),
  "AdminReportsPage",
);
const AdminCostsPage = lazyRetry(() => import("@/pages/admin/AdminCostsPage"));
const AdminAuditLogsPage = lazyRetry(
  () => import("@/pages/admin/AdminAuditLogsPage"),
);
const ReportedProblemsPage = lazyRetry(
  () => import("@/pages/admin/ReportedProblemsPage"),
);
const ReportedProblemDetailPage = lazyRetry(
  () => import("@/pages/admin/ReportedProblemDetailPage"),
);
const OAuthDebugPage = lazyRetry(() => import("@/pages/admin/OAuthDebugPage"));
const SeedDemoCustomers = lazyRetry(() => import("@/pages/SeedDemoCustomers"));
const TwilioCopyPage = lazyNamed(
  () => import("@/pages/admin/TwilioCopyPage"),
  "TwilioCopyPage",
);
const AnalyticsHealthPage = lazyRetry(
  () => import("@/pages/admin/AnalyticsHealthPage"),
);

// ============================================================
// LAZY-LOADED INTEGRATIONS PAGES
// ============================================================
const IntegrationsPage = lazyRetry(() => import("@/pages/IntegrationsPage"));
const POSIntegrationsPage = lazyRetry(
  () => import("@/pages/integrations/POSIntegrationsPage"),
);
const CRMIntegrationsPage = lazyRetry(
  () => import("@/pages/integrations/CRMIntegrationsPage"),
);
const SocialIntegrationsPage = lazyRetry(
  () => import("@/pages/integrations/SocialIntegrationsPage"),
);
const AutomationsIntegrationsPage = lazyRetry(
  () => import("@/pages/integrations/AutomationsIntegrationsPage"),
);
const WebsiteIntegrationsPage = lazyRetry(
  () => import("@/pages/integrations/WebsiteIntegrationsPage"),
);
const MigrationsRouteGate = lazyRetry(
  () => import("@/pages/MigrationsRouteGate"),
);
const LightspeedConnectPage = lazyRetry(
  () => import("@/pages/integrations/lightspeed/ConnectPage"),
);
const GuidePage = lazyRetry(
  () => import("@/pages/integrations/lightspeed/GuidePage"),
);
const DebugPage = lazyRetry(
  () => import("@/pages/integrations/lightspeed/DebugPage"),
);
const ShopifyDebugPage = lazyRetry(
  () => import("@/pages/integrations/shopify/DebugPage"),
);
const SquareGuidePage = lazyRetry(
  () => import("@/pages/integrations/square/GuidePage"),
);
const CloverGuidePage = lazyRetry(
  () => import("@/pages/integrations/clover/GuidePage"),
);
const IntegrationDocumentationPage = lazyRetry(
  () => import("@/pages/integrations/IntegrationDocumentationPage"),
);
const IntegrationDetailPage = lazyRetry(
  () => import("@/pages/integrations/IntegrationDetailPage"),
);

// ============================================================
// LAZY-LOADED PUBLIC / AUTH / MARKETING PAGES
// ============================================================
const AuthPage = lazyNamed(
  () => import("@/components/auth/AuthPage"),
  "AuthPage",
);
const ForgotPasswordPage = lazyNamed(
  () => import("@/pages/ForgotPasswordPage"),
  "ForgotPasswordPage",
);
const ForgotPasswordSentPage = lazyNamed(
  () => import("@/pages/ForgotPasswordSentPage"),
  "ForgotPasswordSentPage",
);
const ResetPasswordPage = lazyNamed(
  () => import("@/pages/ResetPasswordPage"),
  "ResetPasswordPage",
);
const OnboardingPage = lazyRetry(() => import("@/pages/OnboardingPage"));
const PricingPage = lazyRetry(() => import("@/pages/PricingPage"));
const FAQPage = lazyRetry(() => import("@/pages/FAQPage"));
const ContactPage = lazyRetry(() => import("@/pages/ContactPage"));
const AboutPage = lazyNamed(() => import("@/pages/AboutPage"), "AboutPage");
const SmsPage = lazyNamed(() => import("@/pages/public/SmsPage"), "SmsPage");
const PrivacyPage = lazyNamed(
  () => import("@/pages/public/PrivacyPage"),
  "PrivacyPage",
);
const TermsPage = lazyNamed(
  () => import("@/pages/public/TermsPage"),
  "TermsPage",
);
const PlatformAgreementPage = lazyNamed(
  () => import("@/pages/public/PlatformAgreementPage"),
  "PlatformAgreementPage",
);
const EcommPage = lazyNamed(
  () => import("@/pages/public/EcommPage"),
  "EcommPage",
);
const FeaturesPage = lazyNamed(
  () => import("@/pages/FeaturesPage"),
  "FeaturesPage",
);
const FeatureDetailPage = lazyRetry(() => import("@/pages/FeatureDetailPage"));
const KnowledgeBasePage = lazyRetry(() => import("@/pages/KnowledgeBasePage"));
const Home1Page = lazyNamed(() => import("@/pages/Home1Page"), "Home1Page");
const EmailPreferences = lazyRetry(() => import("@/pages/EmailPreferences"));
const PublicFormPage = lazyRetry(() => import("@/pages/PublicFormPage"));
const WebsiteWaitlistPage = lazyNamed(
  () => import("@/pages/WebsiteWaitlistPage"),
  "WebsiteWaitlistPage",
);
const AuthCallbackPage = lazyNamed(
  () => import("@/pages/AuthCallbackPage"),
  "AuthCallbackPage",
);
const OAuthCallbackHandler = lazyNamed(
  () => import("@/components/migrations/OAuthCallbackHandler"),
  "OAuthCallbackHandler",
);
const OAuthAuthorizePage = lazyRetry(
  () => import("@/pages/OAuthAuthorizePage"),
);
const CallbackPage = lazyRetry(
  () => import("@/pages/integrations/lightspeed/CallbackPage"),
);
const ShopifyCallbackPage = lazyRetry(
  () => import("@/pages/integrations/shopify/CallbackPage"),
);
const SquareCallbackPage = lazyRetry(
  () => import("@/pages/integrations/square/CallbackPage"),
);
const CloverCallbackPage = lazyRetry(
  () => import("@/pages/integrations/clover/CallbackPage"),
);
const ConfirmSubscription = lazyRetry(
  () => import("@/pages/ConfirmSubscription"),
);
const NotFound = lazyRetry(() => import("@/pages/NotFound"));

// ============================================================
// LAZY-LOADED CRM PAGES
// ============================================================
const CRMDashboardPage = lazyNamed(
  () => import("@/pages/crm/CRMDashboardPage"),
  "CRMDashboardPage",
);
const CRMCustomersPage = lazyNamed(
  () => import("@/pages/crm/CRMCustomersPage"),
  "CRMCustomersPage",
);
const AddCustomer = lazyRetry(() => import("@/pages/crm/AddCustomer"));
const CustomerDashboardPage = lazyRetry(
  () => import("@/pages/crm/CustomerDashboardPage"),
);
const CRMCampaignsPage = lazyNamed(
  () => import("@/pages/crm/CRMCampaignsPage"),
  "CRMCampaignsPage",
);
const CRMCampaignReport = lazyRetry(
  () => import("@/pages/crm/CRMCampaignReport"),
);
const CRMCampaignRecipientsPage = lazyRetry(
  () => import("@/pages/crm/CRMCampaignRecipientsPage"),
);
const CRMCampaignRecipientDetailPage = lazyRetry(
  () => import("@/pages/crm/CRMCampaignRecipientDetailPage"),
);
const CRMSegmentsBetaPage = lazyRetry(
  () => import("@/pages/crm/CRMSegmentsBetaPage"),
);
const CRMSegmentsPage = lazyNamed(
  () => import("@/pages/crm/CRMSegmentsPage"),
  "CRMSegmentsPage",
);
const CRMPersonasPage = lazyNamed(
  () => import("@/pages/crm/CRMPersonasPage"),
  "CRMPersonasPage",
);
const PersonaDetailPage = lazyRetry(
  () => import("@/pages/crm/PersonaDetailPage"),
);
const CRMAnalytics = lazyRetry(() => import("@/pages/crm/CRMAnalytics"));
const CRMAutomations = lazyRetry(() => import("@/pages/crm/CRMAutomations"));
const AutomationWizardLandingPage = lazyNamed(
  () => import("@/pages/crm/AutomationWizardLandingPage"),
  "AutomationWizardLandingPage",
);
const CRMAutomationGuidePage = lazyNamed(
  () => import("@/pages/crm/CRMAutomationGuidePage"),
  "CRMAutomationGuidePage",
);
const CRMAutomationBuilderPage = lazyNamed(
  () => import("@/pages/crm/CRMAutomationBuilderPage"),
  "CRMAutomationBuilderPage",
);
const CRMAutomationExecutionsPage = lazyNamed(
  () => import("@/pages/crm/CRMAutomationExecutionsPage"),
  "CRMAutomationExecutionsPage",
);
const FormsPage = lazyRetry(() => import("@/pages/crm/FormsPage"));
const FormEditorPage = lazyRetry(() => import("@/pages/crm/FormEditorPage"));
const FormDocumentationPage = lazyRetry(
  () => import("@/pages/crm/FormDocumentationPage"),
);
const EmailSendingSettings = lazyRetry(
  () => import("@/pages/crm/EmailSendingSettings"),
);

// ============================================================
// LAZY-LOADED MARKETING / CONTENT PAGES
// ============================================================
const CRMCampaignEditorPage = lazyRetry(
  () => import("@/pages/crm/CRMCampaignEditorPage"),
);
const CampaignStudioPage = lazyRetry(
  () => import("@/pages/crm/CampaignStudioPage"),
);
const SavedBlocksPage = lazyNamed(
  () => import("@/pages/crm/SavedBlocksPage"),
  "SavedBlocksPage",
);
const NewslettersPage = lazyNamed(
  () => import("@/pages/NewslettersPage"),
  "NewslettersPage",
);
const NewsletterNewPage = lazyNamed(
  () => import("@/pages/NewsletterNewPage"),
  "NewsletterNewPage",
);
const SegmentBuilderPage = lazyRetry(
  () => import("@/pages/crm/SegmentBuilderPage"),
);
const SegmentMembersPage = lazyRetry(
  () => import("@/pages/crm/SegmentMembersPage"),
);
const ContentLibraryPage = lazyRetry(
  () => import("@/pages/ContentLibraryPage"),
);
const SocialMediaPage = lazyRetry(() => import("@/pages/SocialMediaPage"));
const PublishPage = lazyRetry(() => import("@/pages/PublishPage"));
const CarouselComposerPage = lazyRetry(
  () => import("@/pages/CarouselComposerPage"),
);
const TemplatesPage = lazyNamed(
  () => import("@/pages/TemplatesPage"),
  "TemplatesPage",
);
const WebsitePage = lazyNamed(
  () => import("@/pages/WebsitePage"),
  "WebsitePage",
);
const AnalyticsPage = lazyRetry(() => import("@/pages/AnalyticsPage"));

// ============================================================
// LAZY-LOADED DASHBOARD / STORE / SETTINGS / UTILITY PAGES
// ============================================================
const BloomSuiteDashboard = lazyNamed(
  () => import("@/pages/BloomSuiteDashboard"),
  "BloomSuiteDashboard",
);
const CalendarPage = lazyRetry(() => import("@/pages/CalendarPage"));
const ActivityCenterPage = lazyRetry(
  () => import("@/pages/ActivityCenterPage"),
);
const ActivityDetailsPage = lazyRetry(
  () => import("@/pages/ActivityDetailsPage"),
);
const SMSTestingDemo = lazyRetry(() => import("@/pages/SMSTestingDemo"));
const SettingsPage = lazyRetry(() => import("@/pages/SettingsPage"));
const AccountSetupPage = lazyRetry(() => import("@/pages/AccountSetupPage"));
const UsagePage = lazyRetry(() => import("@/pages/UsagePage"));
const DomainsPage = lazyRetry(() => import("@/pages/DomainsPage"));
const ProductsPage = lazyRetry(() => import("@/pages/products/ProductsPage"));
const ProductDetailPage = lazyRetry(
  () => import("@/pages/products/ProductDetailPage"),
);
const ProfilePage = lazyRetry(() => import("@/pages/ProfilePage"));
const AccountPage = lazyRetry(() => import("@/pages/AccountPage"));
const SupportPage = lazyRetry(() => import("@/pages/SupportPage"));
const HelpDeskPage = lazyRetry(() => import("@/pages/HelpDeskPage"));
const TicketListPage = lazyRetry(() => import("@/pages/TicketListPage"));
const CreateTicketPage = lazyRetry(() => import("@/pages/CreateTicketPage"));
const TicketDetailPage = lazyRetry(() => import("@/pages/TicketDetailPage"));
const PlanPage = lazyRetry(() => import("@/pages/PlanPage"));
const CommunityPage = lazyNamed(
  () => import("@/pages/CommunityPage"),
  "CommunityPage",
);
const SMSRoutes = lazyRetry(() =>
  import("@/routes/SMSRoutes").then((mod) => ({ default: mod.default })),
);

const LEGACY_SOCIAL_ROUTE = ["/", "social"].join("");
const LEGACY_SOCIAL_MEDIA_ROUTE = ["/", ["social", "media"].join("-")].join("");

function IntegrationsRouteLayout() {
  return <TenantRouteLayout />;
}

function TenantRouteLayout() {
  return (
    <ProtectedRoute>
      <DashboardShell mode="tenant">
        <Outlet />
      </DashboardShell>
    </ProtectedRoute>
  );
}

function AdminRouteLayout() {
  const location = useLocation();

  return (
    <ProtectedRoute>
      <DashboardShell
        mode="admin"
        contentWidth={resolveAdminDashboardContentWidth(location.pathname)}
      >
        <Outlet />
      </DashboardShell>
    </ProtectedRoute>
  );
}

function AdminLazyBoundary() {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageSkeleton variant="default" />}>
        <Outlet />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

function IntegrationsLazyBoundary() {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageSkeleton variant="default" />}>
        <Outlet />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

function PublicLazyBoundary() {
  return (
    <ChunkErrorBoundary dashboardHref="/" linkLabel="Go home">
      <Suspense fallback={<PublicPageFallback />}>
        <Outlet />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

function CallbackLazyBoundary() {
  return (
    <ChunkErrorBoundary dashboardHref="/" linkLabel="Go home">
      <Suspense
        fallback={
          <PublicPageFallback
            title="Processing redirect"
            description="Preparing your connection and loading the next step."
          />
        }
      >
        <Outlet />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

const CRM_LAZY_PAGE_OPTIONS = {
  dashboardHref: "/crm",
  linkLabel: "Go to CRM",
} as const;

const DASHBOARD_LAZY_PAGE_OPTIONS = {
  dashboardHref: "/dashboard",
  linkLabel: "Go to Dashboard",
} as const;

type ProtectedSidebarSkeletonVariant =
  | "table"
  | "form"
  | "default"
  | "dashboard";

interface ProtectedSidebarLazyPageOptions {
  dashboardHref: string;
  linkLabel: string;
}

function renderProtectedSidebarLazyPage(
  page: React.ReactElement,
  skeleton: ProtectedSidebarSkeletonVariant,
  options: ProtectedSidebarLazyPageOptions = CRM_LAZY_PAGE_OPTIONS,
) {
  const { dashboardHref, linkLabel } = options;

  return (
    <ProtectedRoute>
      <SidebarLayout>
        <ChunkErrorBoundary dashboardHref={dashboardHref} linkLabel={linkLabel}>
          <Suspense fallback={<PageSkeleton variant={skeleton} />}>
            {page}
          </Suspense>
        </ChunkErrorBoundary>
      </SidebarLayout>
    </ProtectedRoute>
  );
}

function renderProtectedFullscreenLazyPage(
  page: React.ReactElement,
  skeleton: ProtectedSidebarSkeletonVariant,
  options: ProtectedSidebarLazyPageOptions = CRM_LAZY_PAGE_OPTIONS,
) {
  const { dashboardHref, linkLabel } = options;

  return (
    <ProtectedRoute>
      <ChunkErrorBoundary dashboardHref={dashboardHref} linkLabel={linkLabel}>
        <Suspense fallback={<PageSkeleton variant={skeleton} />}>
          {page}
        </Suspense>
      </ChunkErrorBoundary>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <HelmetProvider>
      <div className="min-h-screen bg-background text-foreground">
        <ErrorBoundary>
          <NavigationTracker />
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLazyBoundary />}>
              <Route
                path="/auth"
                element={
                  <PublicRoute>
                    <AuthPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicRoute>
                    <ForgotPasswordPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/forgot-password/sent"
                element={
                  <PublicRoute>
                    <ForgotPasswordSentPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <RecoveryRoute>
                    <ResetPasswordPage />
                  </RecoveryRoute>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/onboarding/manual"
                element={
                  <ProtectedRoute>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/about" element={<AboutPage />} />

              {/* Public compliance pages */}
              <Route path="/sms-program" element={<SmsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route
                path="/platform-agreement"
                element={<PlatformAgreementPage />}
              />
              <Route path="/ecomm" element={<EcommPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/features/:slug" element={<FeatureDetailPage />} />
              <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
              <Route path="/home1" element={<Home1Page />} />
              <Route path="/email-preferences" element={<EmailPreferences />} />

              {/* Public form page - no auth required */}
              <Route path="/f/:embedKey" element={<PublicFormPage />} />

              {/* Public website landing page */}
              <Route path="/website" element={<WebsiteWaitlistPage />} />
              <Route
                path="/website/waitlist"
                element={<WebsiteWaitlistPage />}
              />

              {/* Public confirmation page */}
              <Route
                path="/confirm-subscription"
                element={<ConfirmSubscription />}
              />
            </Route>

            <Route path="/" element={<SmartRootRoute />} />

            {/* Protected routes with sidebar */}
            <Route
              path="/dashboard"
              element={renderProtectedSidebarLazyPage(
                <BloomSuiteDashboard />,
                "dashboard",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/newsletters"
              element={renderProtectedSidebarLazyPage(
                <NewslettersPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/templates"
              element={renderProtectedSidebarLazyPage(
                <TemplatesPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            {/* Protected website builder */}
            <Route
              path="/website/app"
              element={renderProtectedSidebarLazyPage(
                <WebsitePage />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/content"
              element={renderProtectedSidebarLazyPage(
                <ContentLibraryPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/content/library"
              element={renderProtectedSidebarLazyPage(
                <ContentLibraryPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <SidebarLayout>
                    <DataProviderWrapper>
                      <ChunkErrorBoundary
                        dashboardHref="/dashboard"
                        linkLabel="Go to Dashboard"
                      >
                        <Suspense
                          fallback={<PageSkeleton variant="dashboard" />}
                        >
                          <CalendarPage />
                        </Suspense>
                      </ChunkErrorBoundary>
                    </DataProviderWrapper>
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/activity"
              element={renderProtectedSidebarLazyPage(
                <ActivityCenterPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/activity/:eventId"
              element={renderProtectedSidebarLazyPage(
                <ActivityDetailsPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/campaigns"
              element={renderProtectedSidebarLazyPage(
                <SocialMediaPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/crm"
              element={renderProtectedSidebarLazyPage(
                <CRMDashboardPage />,
                "table",
              )}
            />
            <Route
              path="/crm/customers"
              element={renderProtectedSidebarLazyPage(
                <CRMCustomersPage />,
                "table",
              )}
            />
            <Route
              path="/crm/customers/new"
              element={renderProtectedSidebarLazyPage(<AddCustomer />, "form")}
            />
            <Route
              path="/crm/customers/:customerId"
              element={renderProtectedSidebarLazyPage(
                <CustomerDashboardPage />,
                "form",
              )}
            />
            <Route
              path="/crm/campaigns"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignsPage />,
                "table",
              )}
            />
            <Route
              path="/crm/campaigns/:campaignId/analytics"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignReport />,
                "table",
              )}
            />
            <Route
              path="/crm/campaigns/:campaignId/report"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignReport />,
                "table",
              )}
            />
            <Route
              path="/crm/campaigns/:campaignId/recipients"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignRecipientsPage />,
                "table",
              )}
            />
            <Route
              path="/crm/campaigns/:campaignId/recipients/:recipientId"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignRecipientDetailPage />,
                "form",
              )}
            />
            <Route
              path="/dashboard/campaigns/:campaignId/recipients"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignRecipientsPage />,
                "table",
              )}
            />
            <Route
              path="/dashboard/campaigns/:campaignId/recipients/:recipientId"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignRecipientDetailPage />,
                "form",
              )}
            />
            <Route
              path="/crm/segments/beta"
              element={<Navigate replace to="/crm/segments" />}
            />
            <Route
              path="/crm/segments"
              element={renderProtectedSidebarLazyPage(
                <CRMSegmentsPage />,
                "table",
              )}
            />
            <Route
              path="/crm/segments/new"
              element={renderProtectedSidebarLazyPage(
                <SegmentBuilderPage />,
                "form",
              )}
            />
            <Route
              path="/crm/segments/:segmentId"
              element={renderProtectedSidebarLazyPage(
                <SegmentBuilderPage />,
                "form",
              )}
            />
            <Route
              path="/crm/segments/:segmentId/members"
              element={renderProtectedSidebarLazyPage(
                <SegmentMembersPage />,
                "table",
              )}
            />
            <Route
              path="/crm/personas"
              element={renderProtectedSidebarLazyPage(
                <CRMPersonasPage />,
                "table",
              )}
            />
            <Route
              path="/crm/personas/:personaId"
              element={renderProtectedSidebarLazyPage(
                <PersonaDetailPage />,
                "table",
              )}
            />
            <Route
              path="/crm/analytics"
              element={renderProtectedSidebarLazyPage(
                <CRMAnalytics />,
                "table",
              )}
            />
            <Route
              path="/crm/automations"
              element={renderProtectedSidebarLazyPage(
                <CRMAutomations />,
                "table",
              )}
            />
            <Route
              path="/crm/automations/new"
              element={renderProtectedSidebarLazyPage(
                <AutomationWizardLandingPage />,
                "form",
              )}
            />
            <Route
              path="/crm/automations/new/guide"
              element={renderProtectedSidebarLazyPage(
                <CRMAutomationGuidePage />,
                "form",
              )}
            />
            <Route
              path="/crm/automations/new/canvas"
              element={renderProtectedSidebarLazyPage(
                <CRMAutomationBuilderPage />,
                "form",
              )}
            />
            <Route
              path="/crm/automations/:automationId"
              element={renderProtectedSidebarLazyPage(
                <CRMAutomationBuilderPage />,
                "form",
              )}
            />
            <Route
              path="/crm/automations/:automationId/executions"
              element={renderProtectedSidebarLazyPage(
                <CRMAutomationExecutionsPage />,
                "table",
              )}
            />
            <Route
              path="/crm/forms"
              element={renderProtectedSidebarLazyPage(<FormsPage />, "table")}
            />
            <Route
              path="/crm/forms/developer-guide"
              element={
                <ProtectedRoute>
                  <SidebarLayout>
                    <Navigate to="/crm/forms" replace />
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/forms/:formId/docs"
              element={renderProtectedSidebarLazyPage(
                <FormDocumentationPage />,
                "form",
              )}
            />
            <Route
              path="/crm/forms/:formId/docs"
              element={renderProtectedSidebarLazyPage(
                <FormDocumentationPage />,
                "form",
              )}
            />
            <Route
              path="/crm/forms/:formId"
              element={renderProtectedSidebarLazyPage(
                <FormEditorPage />,
                "form",
              )}
            />
            <Route
              path="/crm/settings/email-sending"
              element={renderProtectedSidebarLazyPage(
                <EmailSendingSettings />,
                "form",
              )}
            />
            <Route
              path="/crm/campaigns/blocks"
              element={renderProtectedSidebarLazyPage(
                <SavedBlocksPage />,
                "table",
              )}
            />
            <Route
              path="/crm/campaigns/new"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignEditorPage />,
                "form",
              )}
            />
            <Route
              path="/crm/campaigns/:campaignId/edit"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignEditorPage />,
                "form",
              )}
            />
            <Route
              path="/crm/campaigns/:id/studio"
              element={renderProtectedFullscreenLazyPage(
                <CampaignStudioPage />,
                "dashboard",
              )}
            />
            <Route
              path="/crm/campaigns/:campaignId"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignEditorPage />,
                "form",
              )}
            />
            <Route
              path="/sms/*"
              element={renderProtectedSidebarLazyPage(
                <SMSRoutes />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/sms/test"
              element={renderProtectedSidebarLazyPage(
                <SMSTestingDemo />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/analytics"
              element={renderProtectedSidebarLazyPage(
                <AnalyticsPage />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/assets"
              element={renderProtectedSidebarLazyPage(
                <ContentLibraryPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/settings"
              element={renderProtectedSidebarLazyPage(
                <SettingsPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/account-setup"
              element={renderProtectedSidebarLazyPage(
                <AccountSetupPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/settings/usage"
              element={renderProtectedSidebarLazyPage(
                <UsagePage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/domains"
              element={renderProtectedSidebarLazyPage(
                <DomainsPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/social-accounts"
              element={renderProtectedSidebarLazyPage(
                <SocialMediaPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/newsletters/new"
              element={renderProtectedSidebarLazyPage(
                <NewsletterNewPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/newsletters/builder"
              element={renderProtectedSidebarLazyPage(
                <CRMCampaignEditorPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route path="/integrations" element={<IntegrationsRouteLayout />}>
              <Route element={<IntegrationsLazyBoundary />}>
                <Route index element={<IntegrationsPage />} />
                <Route path="pos" element={<POSIntegrationsPage />} />
                <Route path="crm" element={<CRMIntegrationsPage />} />
                <Route path="social" element={<SocialIntegrationsPage />} />
                <Route
                  path="facebook"
                  element={<RedirectWithQuery to="/integrations/meta" />}
                />
                <Route
                  path="instagram"
                  element={<RedirectWithQuery to="/integrations/meta" />}
                />
                <Route
                  path="google-analytics-4"
                  element={
                    <RedirectWithQuery to="/integrations/google-analytics" />
                  }
                />
                <Route
                  path="email-domain-dns"
                  element={
                    <RedirectWithQuery to="/integrations/email-infrastructure" />
                  }
                />
                <Route
                  path="automations"
                  element={<AutomationsIntegrationsPage />}
                />
                <Route path="website" element={<WebsiteIntegrationsPage />} />
                <Route path="migrations" element={<MigrationsRouteGate />} />
                <Route
                  path="lightspeed/connect"
                  element={<LightspeedConnectPage />}
                />
                <Route path="lightspeed/guide" element={<GuidePage />} />
                <Route path="lightspeed/debug" element={<DebugPage />} />
                <Route path="shopify/debug" element={<ShopifyDebugPage />} />
                <Route path="square/guide" element={<SquareGuidePage />} />
                <Route path="clover/guide" element={<CloverGuidePage />} />
                <Route
                  path=":slug/documentation"
                  element={<IntegrationDocumentationPage />}
                />
                <Route path=":slug" element={<IntegrationDetailPage />} />
              </Route>
            </Route>
            <Route path="/oauth/callback" element={<OAuthCallbackHandler />} />
            <Route
              path={LEGACY_SOCIAL_ROUTE}
              element={<RedirectWithQuery to="/social-accounts" />}
            />
            <Route
              path={LEGACY_SOCIAL_MEDIA_ROUTE}
              element={<RedirectWithQuery to="/social-accounts" />}
            />
            <Route element={<CallbackLazyBoundary />}>
              <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route
                path="/integrations/lightspeed/callback"
                element={<CallbackPage />}
              />
              <Route
                path="/integrations/shopify/callback"
                element={<ShopifyCallbackPage />}
              />
              <Route
                path="/integrations/square/callback"
                element={<SquareCallbackPage />}
              />
              <Route
                path="/integrations/clover/callback"
                element={<CloverCallbackPage />}
              />
            </Route>
            <Route
              path="/crm/pos"
              element={
                <ProtectedRoute>
                  <SidebarLayout>
                    <ChunkErrorBoundary>
                      <Suspense fallback={<PageSkeleton variant="default" />}>
                        <POSIntegrationsPage />
                      </Suspense>
                    </ChunkErrorBoundary>
                  </SidebarLayout>
                </ProtectedRoute>
              }
            />

            {/* Products routes */}
            <Route
              path="/products"
              element={renderProtectedSidebarLazyPage(
                <ProductsPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/products/:productId"
              element={renderProtectedSidebarLazyPage(
                <ProductDetailPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/profile/*"
              element={renderProtectedSidebarLazyPage(
                <ProfilePage />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/account"
              element={renderProtectedSidebarLazyPage(
                <AccountPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/support"
              element={renderProtectedSidebarLazyPage(
                <SupportPage />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />

            {/* Help Desk Routes */}
            <Route
              path="/helpdesk"
              element={renderProtectedSidebarLazyPage(
                <HelpDeskPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/helpdesk/tickets"
              element={renderProtectedSidebarLazyPage(
                <TicketListPage />,
                "table",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/helpdesk/tickets/new"
              element={renderProtectedSidebarLazyPage(
                <CreateTicketPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/helpdesk/tickets/:ticketId"
              element={renderProtectedSidebarLazyPage(
                <TicketDetailPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />

            <Route
              path="/publish"
              element={renderProtectedSidebarLazyPage(
                <PublishPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/carousel/composer"
              element={renderProtectedSidebarLazyPage(
                <CarouselComposerPage />,
                "form",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route
              path="/plan"
              element={renderProtectedSidebarLazyPage(
                <PlanPage />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route path="/admin" element={<AdminRouteLayout />}>
              <Route element={<AdminLazyBoundary />}>
                <Route index element={<AdminHub />} />
                <Route path="tenants" element={<AdminTenants />} />
                <Route path="search" element={<AdminDashboard />} />
                <Route path="manage" element={<AdminManage />} />
                <Route
                  path="governance-config"
                  element={<AdminGovernanceConfig />}
                />
                <Route
                  path="tenants/:tenantId/email"
                  element={<TenantEmailManagement />}
                />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="costs" element={<AdminCostsPage />} />
                <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                <Route
                  path="reported-problems"
                  element={<ReportedProblemsPage />}
                />
                <Route
                  path="reported-problems/:problemId"
                  element={<ReportedProblemDetailPage />}
                />
                <Route path="oauth-debug" element={<OAuthDebugPage />} />
                <Route path="seed-demo" element={<SeedDemoCustomers />} />
                <Route path="twilio-copy" element={<TwilioCopyPage />} />
                <Route
                  path="analytics-health"
                  element={<AnalyticsHealthPage />}
                />
              </Route>
            </Route>
            <Route
              path="/community"
              element={renderProtectedSidebarLazyPage(
                <CommunityPage />,
                "default",
                DASHBOARD_LAZY_PAGE_OPTIONS,
              )}
            />
            <Route element={<PublicLazyBoundary />}>
              {/* Show NotFound for any unrecognized routes */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster
            closeButton={false}
            duration={4000}
            expand={false}
            visibleToasts={4}
            position="top-right"
            icons={{
              success: <CheckCircle2 size={16} strokeWidth={1.9} />,
              error: <AlertCircle size={16} strokeWidth={1.9} />,
              info: <Info size={16} strokeWidth={1.9} />,
              warning: <TriangleAlert size={16} strokeWidth={1.9} />,
            }}
            toastOptions={{
              classNames: {
                toast: "bloom-sonner-toast",
                title: "bloom-sonner-title",
                description: "bloom-sonner-description",
                actionButton: "bloom-sonner-action",
                success: "bloom-sonner-toast--success",
                error: "bloom-sonner-toast--error",
                info: "bloom-sonner-toast--info",
                warning: "bloom-sonner-toast--warning",
              },
            }}
          />
        </ErrorBoundary>
      </div>
    </HelmetProvider>
  );
}

export default App;
