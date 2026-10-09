import React, { useState } from "react";
import { TourTooltip } from "./TourTooltip";
import { useQuickTour } from "@/contexts/QuickTourContext";
import { useNavigate } from "react-router-dom";

const loadAnimation = async (path: string, signal: AbortSignal) => {
  try {
    const response = await fetch(path, { signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export function TourSteps() {
  const { tourProgress } = useQuickTour();
  const navigate = useNavigate();
  const [animations, setAnimations] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (!tourProgress.isActive) return;
    const controller = new AbortController();
    void Promise.all([
      loadAnimation("/lottie/tour-swirl.json", controller.signal),
      loadAnimation("/lottie/pos-plug.json", controller.signal),
      loadAnimation("/lottie/confetti.json", controller.signal),
    ]).then(([tourSwirl, posPlug, confetti]) => {
      if (!controller.signal.aborted) setAnimations({ tourSwirl, posPlug, confetti });
    });
    return () => controller.abort();
  }, [tourProgress.isActive]);

  if (!tourProgress.isActive) return null;

  return (
    <>
      <TourTooltip
        targetSelector="[data-tour='dashboard-overview']"
        step="dashboard"
        title="Welcome to Your Garden Centre Dashboard"
        description="See your customer activity, marketing results, and next steps in one place."
        highlight="Start with the latest metrics and quick actions."
        animation={animations.tourSwirl}
        side="bottom"
        align="start"
      />
      <TourTooltip
        targetSelector="[data-tour='pos-connect']"
        step="pos"
        title="Connect Your POS System"
        description="Choose a supported POS connection or import customer reports. The setup flow explains which records can sync and what needs review."
        highlight="Open integrations to use the secure setup for your system."
        cta="Connect POS"
        onCta={() => navigate("/integrations/pos")}
        animation={animations.posPlug}
        side="right"
        align="start"
      />
      <TourTooltip
        targetSelector="[data-tour='customers']"
        step="customers"
        title="Customer Management"
        description="View and segment your customers based on purchase history, preferences, and behaviour."
        highlight="Build focused audiences for more relevant marketing."
        side="bottom"
        align="center"
      />
      <TourTooltip
        targetSelector="[data-tour='composer']"
        step="composer"
        title="AI Content Composer"
        description="Draft email and SMS campaigns with AI assistance tailored to your garden centre."
        highlight="Review and approve the content before you send."
        side="left"
        align="center"
      />
      <TourTooltip
        targetSelector="[data-tour='automation']"
        step="automation"
        title="Marketing Automation"
        description="Set up follow-up workflows for customers who have agreed to hear from you."
        highlight="Choose the audience, review the messages, and enable the workflow when it is ready."
        animation={animations.confetti}
        side="bottom"
        align="center"
      />
    </>
  );
}
