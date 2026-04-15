import React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  HelpCircle,
  BookOpen,
  MessageCircle,
  Mail,
  ExternalLink,
  FileText,
  Video,
  Users,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";

export const SupportSettings = () => {
  const supportResources = [
    {
      title: "Help Center",
      description: "Browse our comprehensive knowledge base and tutorials",
      icon: <BookOpen className="h-6 w-6 text-blue-600" />,
      action: "Browse Articles",
      url: "#",
      badge: "Popular",
    },
    {
      title: "Video Tutorials",
      description: "Watch step-by-step video guides for getting started",
      icon: <Video className="h-6 w-6 text-purple-600" />,
      action: "Watch Videos",
      url: "#",
      badge: null,
    },
    {
      title: "API Documentation",
      description: "Technical documentation for developers and integrations",
      icon: <FileText className="h-6 w-6 text-green-600" />,
      action: "View Docs",
      url: "#",
      badge: null,
    },
    {
      title: "Community Forum",
      description: "Connect with other users and share best practices",
      icon: <Users className="h-6 w-6 text-orange-600" />,
      action: "Join Community",
      url: "#",
      badge: "New",
    },
  ];

  const contactOptions = [
    {
      title: "Email Support",
      description: "Get help via email - we typically respond within 24 hours",
      icon: <Mail className="h-5 w-5 text-blue-600" />,
      action: "Send Email",
      contact: "support@bloomsuite.com",
    },
    {
      title: "Live Chat",
      description: "Chat with our support team during business hours",
      icon: <MessageCircle className="h-5 w-5 text-green-600" />,
      action: "Start Chat",
      contact: "Available 9 AM - 5 PM EST",
    },
  ];

  const browserName =
    typeof navigator === "undefined"
      ? "Unknown"
      : navigator.userAgent.split(" ")[0] || "Unknown";

  return (
    <Stack spacing={3}>
      <JoyCard>
        <JoyCardHeader
          title="Support & Help"
          description="Access documentation, contact support, and capture the context needed for troubleshooting."
          startDecorator={
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "16px",
                display: "grid",
                placeItems: "center",
                backgroundColor: "primary.50",
                color: "primary.700",
              }}
            >
              <HelpCircle className="h-5 w-5" />
            </Box>
          }
        />
        <JoyCardContent>
          <Stack spacing={3}>
            <div>
              <Typography level="title-sm" sx={{ mb: 1.5 }}>
                Help Resources
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {supportResources.map((resource) => (
                  <JoyCard key={resource.title}>
                    <JoyCardContent sx={{ pt: 3 }}>
                      <Stack spacing={1.5}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                          >
                            {resource.icon}
                            <div>
                              <Typography level="title-sm">
                                {resource.title}
                              </Typography>
                              {resource.badge ? (
                                <JoyChip
                                  color="primary"
                                  variant="soft"
                                  size="sm"
                                  sx={{ mt: 0.75 }}
                                >
                                  {resource.badge}
                                </JoyChip>
                              ) : null}
                            </div>
                          </Stack>
                        </Stack>
                        <Typography level="body-sm" color="neutral">
                          {resource.description}
                        </Typography>
                        <JoyButton
                          bloomVariant="outline"
                          size="sm"
                          sx={{ alignSelf: "flex-start" }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          {resource.action}
                        </JoyButton>
                      </Stack>
                    </JoyCardContent>
                  </JoyCard>
                ))}
              </Box>
            </div>

            <div>
              <Typography level="title-sm" sx={{ mb: 1.5 }}>
                Contact Support
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "minmax(0, 1fr)",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 2,
                }}
              >
                {contactOptions.map((option) => (
                  <JoyCard key={option.title}>
                    <JoyCardContent sx={{ pt: 3 }}>
                      <Stack spacing={1.5}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                        >
                          {option.icon}
                          <Typography level="title-sm">
                            {option.title}
                          </Typography>
                        </Stack>
                        <Typography level="body-sm" color="neutral">
                          {option.description}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {option.contact}
                        </Typography>
                        <JoyButton size="sm" sx={{ alignSelf: "flex-start" }}>
                          {option.action}
                        </JoyButton>
                      </Stack>
                    </JoyCardContent>
                  </JoyCard>
                ))}
              </Box>
            </div>

            <JoyCard
              variant="plain"
              sx={{ backgroundColor: "neutral.50", borderColor: "neutral.200" }}
            >
              <JoyCardHeader title="System Information" />
              <JoyCardContent>
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
                  <Typography level="body-sm">
                    <strong>Version:</strong> v1.0.0
                  </Typography>
                  <Typography level="body-sm">
                    <strong>Environment:</strong> Production
                  </Typography>
                  <Typography level="body-sm">
                    <strong>Browser:</strong> {browserName}
                  </Typography>
                  <Typography level="body-sm">
                    <strong>User ID:</strong> ••••••••
                  </Typography>
                </Box>
                <Typography level="body-xs" color="neutral" sx={{ mt: 1.5 }}>
                  This information helps support narrow down
                  environment-specific issues faster.
                </Typography>
              </JoyCardContent>
            </JoyCard>

            <JoyCard
              variant="plain"
              sx={{ backgroundColor: "primary.50", borderColor: "primary.100" }}
            >
              <JoyCardContent sx={{ pt: 3 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    <Typography level="title-sm">
                      Feedback & Feature Requests
                    </Typography>
                  </Stack>
                  <Typography level="body-sm" color="neutral">
                    Help improve BloomSuite by sharing product feedback,
                    workflow gaps, or requested features.
                  </Typography>
                  <JoyButton
                    bloomVariant="outline"
                    size="sm"
                    sx={{ alignSelf: "flex-start" }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Submit Feedback
                  </JoyButton>
                </Stack>
              </JoyCardContent>
            </JoyCard>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
};
