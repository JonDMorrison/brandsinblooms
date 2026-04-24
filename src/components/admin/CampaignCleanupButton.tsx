import React, { useState } from "react";
import { JoyButton } from "@/components/joy/JoyButton";
import { useAuth } from "@/contexts/AuthContext";
import { cleanupDuplicateCampaigns } from "@/utils/campaignCleanup";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
// Removed sonner import - using global toast replacement
import { Trash2 } from "lucide-react";

export const CampaignCleanupButton = () => {
  const { user } = useAuth();
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const handleCleanup = async () => {
    if (!user) return;

    setIsCleaningUp(true);
    try {
      const currentWeek = getCurrentWeekNumber();
      const result = await cleanupDuplicateCampaigns(user.id, currentWeek);

      if (result.success) {
        toast.success(result.message);
        // Refresh the page to show cleaned up data
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error("Failed to cleanup campaigns");
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Only show in development or for admin users
  const isDevelopment = import.meta.env.DEV;
  const isAdmin = user?.email === "jon@getclear.ca";

  if (!isDevelopment && !isAdmin) {
    return null;
  }

  return (
    <JoyButton
      onClick={handleCleanup}
      color="warning"
      disabled={isCleaningUp}
      loading={isCleaningUp}
      loadingPosition="start"
      size="sm"
      startDecorator={<Trash2 className="w-4 h-4" />}
      variant="soft"
    >
      {isCleaningUp ? "Cleaning up..." : "Cleanup Duplicates"}
    </JoyButton>
  );
};
