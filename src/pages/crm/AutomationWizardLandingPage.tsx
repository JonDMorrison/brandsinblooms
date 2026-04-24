import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowLeft,
  GitBranch,
  LayoutTemplate,
  WandSparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/joy/PageContainer";

type CreationOptionCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
};

function CreationOptionCard({
  icon,
  title,
  description,
  onClick,
}: CreationOptionCardProps) {
  return (
    <Sheet
      variant="outlined"
      onClick={onClick}
      sx={{
        borderRadius: "lg",
        p: 3,
        cursor: "pointer",
        transition: "all 200ms ease",
        textAlign: "center",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        "&:hover": {
          borderColor: "primary.300",
          backgroundColor: "primary.50",
          boxShadow: "md",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "14px",
          backgroundColor: "neutral.100",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "neutral.600",
        }}
      >
        {icon}
      </Box>
      <Typography level="title-sm" fontWeight="lg">
        {title}
      </Typography>
      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
        {description}
      </Typography>
    </Sheet>
  );
}

function CreationOptionSkeleton() {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, height: "100%" }}>
      <Stack alignItems="center" spacing={1.5}>
        <Skeleton variant="circular" width={56} height={56} animation="wave" />
        <Skeleton variant="text" width="58%" height={20} animation="wave" />
        <Stack spacing={0.5} sx={{ width: "100%", alignItems: "center" }}>
          <Skeleton variant="text" width="90%" height={14} animation="wave" />
          <Skeleton variant="text" width="72%" height={14} animation="wave" />
        </Stack>
      </Stack>
    </Sheet>
  );
}

export const AutomationWizardLandingPage = () => {
  const navigate = useNavigate();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    document.title = "Create an Automation";

    const frame = window.requestAnimationFrame(() => {
      setReady(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <PageContainer>
      <Stack spacing={2.5} sx={{ pb: 4 }}>
        <Typography
          level="body-xs"
          component={Link}
          to="/crm/automations"
          sx={{
            color: "neutral.500",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            width: "fit-content",
            "&:hover": {
              color: "neutral.700",
            },
          }}
        >
          <ArrowLeft size={14} />
          Back to automations
        </Typography>

        <Stack spacing={0.5}>
          <Typography level="h3" fontWeight="bold">
            Create an Automation
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            Choose how you&apos;d like to build your workflow.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
            maxWidth: 900,
          }}
        >
          {ready ? (
            <>
              <CreationOptionCard
                icon={<WandSparkles size={28} />}
                title="Guided Setup"
                description="Answer a few questions and we'll build the workflow for you."
                onClick={() =>
                  navigate("/crm/automations/new/guide?mode=guided")
                }
              />
              <CreationOptionCard
                icon={<LayoutTemplate size={28} />}
                title="Start from Template"
                description="Choose from pre-built automation recipes for common workflows."
                onClick={() => navigate("/crm/automations/new/guide")}
              />
              <CreationOptionCard
                icon={<GitBranch size={28} />}
                title="Build from Scratch"
                description="Design your workflow visually on the flow canvas."
                onClick={() => navigate("/crm/automations/new/canvas")}
              />
            </>
          ) : (
            <>
              <CreationOptionSkeleton />
              <CreationOptionSkeleton />
              <CreationOptionSkeleton />
            </>
          )}
        </Box>
      </Stack>
    </PageContainer>
  );
};
