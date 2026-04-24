import { useState } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { UsageAlertSettings } from "@/components/settings/UsageAlertSettings";
import { JoyButton } from "@/components/joy/JoyButton";
import { UsageDashboard } from "@/components/subscription/UsageDashboard";
import { UsageWarningBanner } from "@/components/subscription/UsageWarningBanner";

type UsageTabId = "overview" | "alerts";

const UsagePage = () => {
  const [activeTab, setActiveTab] = useState<UsageTabId>("overview");

  return (
    <Stack
      spacing={3}
      sx={{
        width: "100%",
        maxWidth: 1080,
        mx: "auto",
        px: { xs: 2, md: 3 },
        py: { xs: 3, md: 4 },
      }}
    >
      <Stack spacing={0.5} sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <JoyButton
            component={Link}
            size="sm"
            startDecorator={<ArrowLeft size={16} />}
            sx={{ color: "text.tertiary", mr: 0.5 }}
            to="/settings?tab=account"
            variant="plain"
          >
            Settings
          </JoyButton>
        </Stack>
        <Typography fontWeight={700} level="h3">
          Usage & Alerts
        </Typography>
        <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
          Monitor your plan usage and configure alert thresholds.
        </Typography>
      </Stack>

      <UsageWarningBanner dismissible={false} />

      <Tabs
        onChange={(_, value) => {
          if (value === "overview" || value === "alerts") {
            setActiveTab(value);
          }
        }}
        size="sm"
        value={activeTab}
        variant="plain"
      >
        <TabList
          sx={{
            gap: 2,
            px: 0,
            py: 0,
            borderRadius: 0,
            bgcolor: "transparent",
            borderBottom: "1px solid",
            borderColor: "neutral.200",
            "--List-gap": "16px",
          }}
        >
          <Tab
            disableIndicator
            sx={{
              px: 0,
              pb: 1.5,
              borderRadius: 0,
              bgcolor: "transparent",
              color: activeTab === "overview" ? "text.primary" : "text.secondary",
              fontWeight: activeTab === "overview" ? "lg" : "md",
              borderBottom: activeTab === "overview" ? "2px solid" : "2px solid transparent",
              borderColor: activeTab === "overview" ? "text.primary" : "transparent",
            }}
            value="overview"
          >
            Usage Overview
          </Tab>
          <Tab
            disableIndicator
            sx={{
              px: 0,
              pb: 1.5,
              borderRadius: 0,
              bgcolor: "transparent",
              color: activeTab === "alerts" ? "text.primary" : "text.secondary",
              fontWeight: activeTab === "alerts" ? "lg" : "md",
              borderBottom: activeTab === "alerts" ? "2px solid" : "2px solid transparent",
              borderColor: activeTab === "alerts" ? "text.primary" : "transparent",
            }}
            value="alerts"
          >
            Alert Settings
          </Tab>
        </TabList>

        <TabPanel keepMounted sx={{ px: 0, pt: 3, pb: 0 }} value="overview">
          <UsageDashboard />
        </TabPanel>
        <TabPanel keepMounted sx={{ px: 0, pt: 3, pb: 0 }} value="alerts">
          <UsageAlertSettings />
        </TabPanel>
      </Tabs>
    </Stack>
  );
};

export default UsagePage;
