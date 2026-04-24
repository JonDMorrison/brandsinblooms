import React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  HelpCircle,
  Mail,
  MessageCircle,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { useToast } from "@/hooks/use-toast";
import { SettingsSectionCard } from "./SettingsSurface";

interface SupportResource {
  title: string;
  description: string;
  icon: LucideIcon;
  url: string;
  meta?: string;
}

interface ContactMethod {
  title: string;
  description: string;
  icon: LucideIcon;
  value: string;
  actionLabel: string;
  onClick: () => void;
}

interface SystemDetail {
  label: string;
  value: string;
}

interface SupportFeedbackCta {
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}

const SUPPORT_EMAIL = "support@bloomsuite.com";
const PLACEHOLDER_RESOURCE_URL = "#";

const rowSx = {
  width: "100%",
  p: 2,
  borderRadius: "18px",
  border: "1px solid",
  borderColor: "neutral.200",
  bgcolor: "background.level1",
  textAlign: "left",
  transition:
    "border-color 150ms ease, background-color 150ms ease, transform 150ms ease",
  cursor: "pointer",
  "&:hover": {
    borderColor: "neutral.300",
    bgcolor: "background.surface",
    transform: "translateY(-1px)",
  },
};

const resolveBrowserName = () => {
  if (typeof navigator === "undefined") {
    return "Unavailable";
  }

  const userAgent = navigator.userAgent;

  if (/Edg/i.test(userAgent)) {
    return "Microsoft Edge";
  }

  if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) {
    return "Google Chrome";
  }

  if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    return "Safari";
  }

  if (/Firefox/i.test(userAgent)) {
    return "Firefox";
  }

  return navigator.userAgent.split(" ")[0] || "Unknown";
};

const resolveEnvironmentLabel = () => {
  const mode = import.meta.env.MODE;

  if (mode === "development") {
    return "Development";
  }

  if (mode === "test") {
    return "Test";
  }

  return "Production";
};

const resolveAppVersion = () => import.meta.env.VITE_APP_VERSION || "v1.0.0";

const InteractiveRow = ({
  icon: Icon,
  title,
  description,
  value,
  actionLabel,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  value?: string;
  actionLabel?: string;
  onClick: () => void;
}) => {
  return (
    <Box component="button" onClick={onClick} sx={rowSx} type="button">
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "16px",
              display: "grid",
              placeItems: "center",
              bgcolor: "background.surface",
              color: "text.secondary",
              flexShrink: 0,
            }}
          >
            <Icon size={18} />
          </Box>

          <Stack spacing={0.4} sx={{ minWidth: 0 }}>
            <Typography level="title-sm">{title}</Typography>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              {description}
            </Typography>
            {value ? (
              <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                {value}
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {actionLabel ? (
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              {actionLabel}
            </Typography>
          ) : null}
          <ChevronRight size={18} style={{ color: "var(--joy-palette-text-tertiary)" }} />
        </Stack>
      </Stack>
    </Box>
  );
};

export const SupportSettings = () => {
  const { toast } = useToast();

  const openExternalTarget = (url?: string) => {
    if (!url || url === PLACEHOLDER_RESOURCE_URL) {
      toast({
        title: "Resource unavailable",
        description: "This support resource is not linked in the workspace yet.",
      });
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openEmailSupport = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
  };

  const openFeedback = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=BloomSuite%20Product%20Feedback`;
  };

  const openLiveChat = () => {
    const supportWindow = window as Window & {
      Intercom?: (...args: unknown[]) => void;
      $crisp?: { push?: (args: unknown[]) => void } | Array<unknown>;
      Tawk_API?: { toggle?: () => void; maximize?: () => void };
      chatwootSDK?: { toggle?: () => void; popoutChatWindow?: () => void };
    };

    if (typeof supportWindow.Intercom === "function") {
      supportWindow.Intercom("show");
      return;
    }

    if (Array.isArray(supportWindow.$crisp)) {
      supportWindow.$crisp.push(["do", "chat:open"]);
      return;
    }

    if (supportWindow.$crisp?.push) {
      supportWindow.$crisp.push(["do", "chat:open"]);
      return;
    }

    if (supportWindow.Tawk_API?.toggle) {
      supportWindow.Tawk_API.toggle();
      return;
    }

    if (supportWindow.Tawk_API?.maximize) {
      supportWindow.Tawk_API.maximize();
      return;
    }

    if (supportWindow.chatwootSDK?.toggle) {
      supportWindow.chatwootSDK.toggle();
      return;
    }

    if (supportWindow.chatwootSDK?.popoutChatWindow) {
      supportWindow.chatwootSDK.popoutChatWindow();
      return;
    }

    toast({
      title: "Live chat unavailable",
      description: "No live chat widget is available in this environment.",
    });
  };

  const supportResources: SupportResource[] = [
    {
      title: "Help Center",
      description:
        "Browse product guidance, troubleshooting notes, and onboarding walkthroughs.",
      icon: BookOpen,
      url: PLACEHOLDER_RESOURCE_URL,
      meta: "Popular",
    },
    {
      title: "Setup Guides",
      description:
        "Review setup flows and onboarding references without leaving the settings workspace.",
      icon: HelpCircle,
      url: PLACEHOLDER_RESOURCE_URL,
    },
    {
      title: "API Documentation",
      description:
        "Reference technical setup details for integrations, auth, and delivery tooling.",
      icon: FileText,
      url: PLACEHOLDER_RESOURCE_URL,
    },
    {
      title: "Video Tutorials",
      description:
        "Watch concise walkthroughs for publishing, automation, and account setup.",
      icon: Video,
      url: PLACEHOLDER_RESOURCE_URL,
    },
  ];

  const contactMethods: ContactMethod[] = [
    {
      title: "Email Support",
      description: "General product questions and issue follow-up.",
      icon: Mail,
      value: SUPPORT_EMAIL,
      actionLabel: "Write email",
      onClick: openEmailSupport,
    },
    {
      title: "Live Chat",
      description: "Business-hours support for active troubleshooting.",
      icon: MessageCircle,
      value: "Available 9 AM - 5 PM EST",
      actionLabel: "Start chat",
      onClick: openLiveChat,
    },
  ];

  const systemDetails: SystemDetail[] = [
    { label: "Version", value: resolveAppVersion() },
    { label: "Environment", value: resolveEnvironmentLabel() },
    { label: "Browser", value: resolveBrowserName() },
    { label: "Support Email", value: SUPPORT_EMAIL },
  ];

  const feedback: SupportFeedbackCta = {
    title: "Feedback & Feature Requests",
    description:
      "Share workflow gaps, product feedback, or feature requests with the BloomSuite team.",
    actionLabel: "Submit Feedback",
    onClick: openFeedback,
  };

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <HelpCircle size={18} strokeWidth={1.8} />
          <Typography level="title-lg">Support</Typography>
        </Stack>
        <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 720 }}>
          Access support contacts, internal product guidance, and troubleshooting context from a single settings surface.
        </Typography>
      </Stack>

      <SettingsSectionCard
        description="Reach the BloomSuite team using the available support channels and response windows."
        startDecorator={<Mail size={18} />}
        title="Support Channels"
      >
        <Stack spacing={1.25}>
          {contactMethods.map((contact) => (
            <InteractiveRow
              actionLabel={contact.actionLabel}
              description={contact.description}
              icon={contact.icon}
              key={contact.title}
              onClick={contact.onClick}
              title={contact.title}
              value={contact.value}
            />
          ))}
        </Stack>
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Reference concise product material and support guidance without leaving the settings workflow."
        startDecorator={<BookOpen size={18} />}
        title="Help Resources"
      >
        <Stack spacing={1.25}>
          {supportResources.map((resource) => (
            <InteractiveRow
              actionLabel={resource.meta}
              description={resource.description}
              icon={resource.icon}
              key={resource.title}
              onClick={() => openExternalTarget(resource.url)}
              title={resource.title}
            />
          ))}
        </Stack>
      </SettingsSectionCard>

      <SettingsSectionCard
        description="A concise environment snapshot that helps support narrow down browser- or environment-specific issues."
        startDecorator={<Users size={18} />}
        title="System Info"
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "repeat(2, minmax(0, 1fr))",
            },
            gap: 1.5,
          }}
        >
          {systemDetails.map((detail) => (
            <Sheet key={detail.label} sx={{ borderRadius: "18px", p: 2 }} variant="soft">
              <Stack spacing={0.5}>
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                  {detail.label}
                </Typography>
                <Typography level="title-sm">{detail.value}</Typography>
              </Stack>
            </Sheet>
          ))}
        </Box>
      </SettingsSectionCard>

      <SettingsSectionCard
        description="Share product direction feedback and feature requests without altering the existing support behavior."
        headerActions={
          <JoyButton onClick={feedback.onClick} startDecorator={<ExternalLink size={16} />} variant="outline">
            {feedback.actionLabel}
          </JoyButton>
        }
        startDecorator={<MessageCircle size={18} />}
        title="Feedback & Feature Requests"
      >
        <Stack spacing={0.75}>
          <Typography level="title-sm">{feedback.title}</Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {feedback.description}
          </Typography>
        </Stack>
      </SettingsSectionCard>
    </Stack>
  );
};
