import React, { useState } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyButton } from "@/components/joy/JoyButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
// Removed sonner import - using global toast replacement
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export const ProfileCleanupUtility = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);

  const checkForDuplicates = async () => {
    if (!user) return;

    setChecking(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_duplicate_merge_suggestions",
      );

      if (error) {
        console.error("Error checking duplicates:", error);
        toast.error("Failed to check for duplicates");
        return;
      }

      setDuplicates(data || []);

      if (!data || data.length === 0) {
        toast.success("No duplicate accounts found");
      } else {
        toast.info(`Found ${data.length} sets of duplicate accounts`);
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
      toast.error("Failed to check for duplicates");
    } finally {
      setChecking(false);
    }
  };

  const mergeDuplicates = async (keepUserId: string, mergeUserId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("merge_duplicate_accounts", {
        keep_user_id: keepUserId,
        merge_user_id: mergeUserId,
      });

      if (error) {
        console.error("Error merging accounts:", error);
        toast.error("Failed to merge accounts");
        return;
      }

      toast.success("Accounts merged successfully");
      // Refresh the duplicates list
      await checkForDuplicates();

      // If this was the current user, reload the page to refresh all data
      if (keepUserId === user?.id || mergeUserId === user?.id) {
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("Error merging accounts:", error);
      toast.error("Failed to merge accounts");
    } finally {
      setLoading(false);
    }
  };

  // Check if current user has duplicates
  const currentUserDuplicate = duplicates.find((dup) =>
    dup.accounts.some((acc: any) => acc.user_id === user?.id),
  );

  return (
    <JoyCard sx={{ maxWidth: "42rem", mx: "auto" }}>
      <JoyCardHeader
        title="Profile Cleanup Utility"
        startDecorator={<AlertTriangle className="h-5 w-5" />}
      />
      <JoyCardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <JoyButton
              onClick={checkForDuplicates}
              disabled={checking}
              bloomVariant="outline"
              loading={checking}
              loadingPosition="start"
            >
              {checking ? "Checking..." : "Check for Duplicates"}
            </JoyButton>
          </Stack>

          {currentUserDuplicate && (
            <Sheet
              variant="soft"
              color="warning"
              sx={{
                p: 2,
                borderRadius: "var(--joy-radius-md)",
                border: "1px solid",
                borderColor: "warning.200",
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    level="title-sm"
                    sx={{ color: "warning.800", fontWeight: "lg" }}
                  >
                    Duplicate Profiles Detected for Your Account
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "warning.700" }}>
                    You have {currentUserDuplicate.accounts.length} profiles.
                    This can cause issues with the app. We recommend merging
                    them.
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "warning.600" }}>
                    Suggested action: {currentUserDuplicate.suggestion_reason}
                  </Typography>

                  <div className="mt-3 space-y-2">
                    {currentUserDuplicate.accounts.map(
                      (account: any, index: number) => (
                        <div
                          key={account.user_id}
                          className="text-xs bg-white p-2 rounded border"
                        >
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <span>
                              Profile {index + 1}:{" "}
                              {account.company_name || "Unnamed"}(
                              {account.tokens_balance} tokens)
                            </span>
                            {account.user_id ===
                              currentUserDuplicate.suggested_keep_user_id && (
                              <span className="text-green-600 font-medium">
                                Recommended
                              </span>
                            )}
                          </Stack>
                        </div>
                      ),
                    )}
                  </div>

                  <JoyButton
                    onClick={() => {
                      const accounts = currentUserDuplicate.accounts;
                      const keepUserId =
                        currentUserDuplicate.suggested_keep_user_id;
                      const mergeUserId = accounts.find(
                        (acc: any) => acc.user_id !== keepUserId,
                      )?.user_id;

                      if (keepUserId && mergeUserId) {
                        mergeDuplicates(keepUserId, mergeUserId);
                      }
                    }}
                    disabled={loading}
                    loading={loading}
                    loadingPosition="start"
                    size="sm"
                    sx={{ mt: 3 }}
                  >
                    {loading ? "Merging..." : "Merge Profiles"}
                  </JoyButton>
                </Stack>
              </Stack>
            </Sheet>
          )}

          {duplicates.length === 0 && !checking && (
            <div className="text-center py-4">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                Click "Check for Duplicates" to scan for duplicate profiles
              </p>
            </div>
          )}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
};
