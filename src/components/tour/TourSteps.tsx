import React, { useState } from 'react';
import { TourTooltip } from './TourTooltip';
import { useQuickTour } from '@/contexts/QuickTourContext';
import { POSConnectionModal } from './POSConnectionModal';

// Dynamic imports for animations (will be loaded at runtime)
const loadAnimation = async (path: string) => {
  try {
    const response = await fetch(path);
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load animation: ${path}`, error);
    return null;
  }
};

export function TourSteps() {
  const { tourProgress } = useQuickTour();
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [animations, setAnimations] = useState<Record<string, any>>({});

  // Load animations on mount
  React.useEffect(() => {
    const loadAnimations = async () => {
      const [tourSwirl, posPlug, confetti] = await Promise.all([
        loadAnimation('/lottie/tour-swirl.json'),
        loadAnimation('/lottie/pos-plug.json'),
        loadAnimation('/lottie/confetti.json'),
      ]);

      setAnimations({
        tourSwirl,
        posPlug,
        confetti,
      });
    };

    loadAnimations();
  }, []);

  if (!tourProgress.isActive) {
    return null;
  }

  const handlePOSConnect = () => {
    setShowPOSModal(true);
  };

  return (
    <>
      {/* Step 1: Dashboard Overview */}
      <TourTooltip
        targetSelector="[data-tour='dashboard-overview']"
        step="dashboard"
        title="Welcome to Your Garden Center Dashboard!"
        description="This is your command center. Monitor sales, track customers, and manage your garden center operations all in one place."
        highlight="Check out your latest metrics and quick actions here."
        animation={animations.tourSwirl}
        side="bottom"
        align="start"
      />

      {/* Step 2: Connect POS */}
      <TourTooltip
        targetSelector="[data-tour='pos-connect']"
        step="pos"
        title="Connect Your POS System"
        description="Link your Shopify, Square, or import CSV data to automatically sync customers and orders."
        highlight="Click here to connect your POS system and unlock powerful customer insights."
        cta="Connect POS"
        onCta={handlePOSConnect}
        animation={animations.posPlug}
        side="right"
        align="start"
      />

      {/* Step 3: Customer Management */}
      <TourTooltip
        targetSelector="[data-tour='customers']"
        step="customers"
        title="Customer Management"
        description="View and segment your customers based on purchase history, preferences, and behavior."
        highlight="Build targeted segments for more effective marketing campaigns."
        side="bottom"
        align="center"
      />

      {/* Step 4: AI Composer */}
      <TourTooltip
        targetSelector="[data-tour='composer']"
        step="composer"
        title="AI Content Composer"
        description="Create engaging email and SMS campaigns with AI assistance tailored to your garden center."
        highlight="Generate personalized content that resonates with your customers."
        side="left"
        align="center"
      />

      {/* Step 5: Automation Builder */}
      <TourTooltip
        targetSelector="[data-tour='automation']"
        step="automation"
        title="Marketing Automation"
        description="Set up automated workflows to nurture customers and drive repeat purchases."
        highlight="Build automated sequences that work while you focus on your business. 🎉 You're all set! Start building amazing customer relationships."
        animation={animations.confetti}
        side="bottom"
        align="center"
      />

      {/* POS Connection Modal */}
      <POSConnectionModal
        isOpen={showPOSModal}
        onClose={() => setShowPOSModal(false)}
        onSuccess={() => {
          setShowPOSModal(false);
          // Move to next step after successful connection
        }}
      />
    </>
  );
}