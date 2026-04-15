import React, { useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PostPerformanceTracker } from "@/components/analytics/PostPerformanceTracker";
import { SocialConnectionManager } from "@/components/analytics/SocialConnectionManager";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyTabs,
  JoyTabsContent,
  JoyTabsList,
  JoyTabsTrigger,
} from "@/components/joy/JoyTabs";
import { AutoScheduler } from "@/components/scheduling/AutoScheduler";
import {
  BarChart3,
  Calendar,
  CheckCircle,
  Link as LinkIcon,
  TrendingUp,
} from "lucide-react";

const SocialMediaPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [activeTab, setActiveTab] = useState("connections");

  const returnTo = searchParams.get("returnTo");
  const justConnected = searchParams.get("connected") === "true";

  useEffect(() => {
    if (justConnected) {
      setShowSuccessMessage(true);

      // Clean up URL parameters
      setSearchParams({});

      // Auto-redirect back to the original page after a delay
      if (returnTo) {
        const timer = setTimeout(() => {
          navigate(returnTo);
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [justConnected, returnTo, navigate, setSearchParams]);

  return (
    <ProtectedPageWrapper>
      <Stack spacing={3.5}>
        {showSuccessMessage && (
          <Sheet
            variant="soft"
            color="success"
            sx={{
              p: 2,
              borderRadius: "18px",
              border: "1px solid",
              borderColor: "success.200",
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CheckCircle className="h-4 w-4" />
              <Typography level="body-sm" color="success">
                Social account connected successfully!
                {returnTo && (
                  <Box component="span" sx={{ ml: 0.5 }}>
                    Redirecting you back in a moment...
                  </Box>
                )}
              </Typography>
            </Stack>
          </Sheet>
        )}

        <Sheet
          variant="plain"
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: "24px",
            border: "1px solid",
            borderColor: "neutral.200",
            background:
              "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(240, 249, 255, 0.9) 50%, rgba(255, 255, 255, 1) 100%)",
          }}
        >
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "18px",
                  display: "grid",
                  placeItems: "center",
                  backgroundColor: "primary.50",
                  color: "primary.700",
                }}
              >
                <TrendingUp className="h-6 w-6" />
              </Box>
              <div>
                <Typography level="h1">Social Media Management</Typography>
                <Typography level="body-md" color="neutral">
                  Manage connections, performance, and scheduling from one
                  tenant dashboard page.
                </Typography>
              </div>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip color="primary" variant="soft">
                Social analytics
              </JoyChip>
              <JoyChip color="success" variant="soft">
                Scheduling tools
              </JoyChip>
            </Stack>
          </Stack>
        </Sheet>

        <JoyTabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(String(value))}
        >
          <JoyTabsList
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            <JoyTabsTrigger value="connections">
              <Stack direction="row" spacing={1} alignItems="center">
                <LinkIcon className="h-4 w-4" />
                <span>Connections</span>
              </Stack>
            </JoyTabsTrigger>
            <JoyTabsTrigger value="analytics">
              <Stack direction="row" spacing={1} alignItems="center">
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </Stack>
            </JoyTabsTrigger>
            <JoyTabsTrigger value="scheduling">
              <Stack direction="row" spacing={1} alignItems="center">
                <Calendar className="h-4 w-4" />
                <span>Auto-Scheduling</span>
              </Stack>
            </JoyTabsTrigger>
          </JoyTabsList>

          <JoyTabsContent value="connections">
            <SocialConnectionManager />
          </JoyTabsContent>

          <JoyTabsContent value="analytics">
            <PostPerformanceTracker />
          </JoyTabsContent>

          <JoyTabsContent value="scheduling">
            <AutoScheduler />
          </JoyTabsContent>
        </JoyTabs>
      </Stack>
    </ProtectedPageWrapper>
  );
};

export default SocialMediaPage;
