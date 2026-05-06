import React, { Suspense, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLoading } from "@/contexts/LoadingContext";
import { EmergencyAuthReset } from "@/components/EmergencyAuthReset";
import { useHomepageLaunchVariant } from "@/components/homepage-three/homepageLaunchFlags";
import { lazyNamed } from "@/utils/lazyNamed";

const HomepagePresentation = lazyNamed(
  () => import("@/components/homepage-three/HomepagePresentation"),
  "HomepagePresentation",
);

const CompleteLandingPage = lazyNamed(
  () => import("@/components/landing/CompleteLandingPage"),
  "CompleteLandingPage",
);

export const SmartRootRoute = () => {
  const { user, loading } = useAuth();
  const { setLoading, clearLoading } = useLoading();
  const homepageLaunch = useHomepageLaunchVariant();

  // Manage auth loading state in the global loading context
  useEffect(() => {
    if (loading) {
      setLoading("auth", {
        isLoading: true,
        message: "Checking authentication...",
        priority: "auth",
      });
    } else {
      clearLoading("auth");
    }
  }, [loading, setLoading, clearLoading]);

  // Don't render anything while loading - let GlobalLoadingOverlay handle it
  if (loading || (!user && homepageLaunch.isLoading)) {
    return null;
  }

  // Show landing page for unauthenticated users, redirect authenticated users to dashboard
  return (
    <>
      {user ? (
        <Navigate to="/dashboard" replace />
      ) : homepageLaunch.variant === "legacy" ? (
        <Suspense fallback={null}>
          <CompleteLandingPage />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <HomepagePresentation />
        </Suspense>
      )}

      {/* Emergency Auth Reset Component - always available when there are issues */}
      <EmergencyAuthReset />
    </>
  );
};
