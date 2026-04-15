import React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { FileText, Mail, Plus, Send } from "lucide-react";

export const NewslettersPage = () => {
  const navigate = useNavigate();
  const actionCards = [
    {
      title: "New Newsletter",
      description: "Start a campaign from scratch with the Joy email workflow.",
      icon: Plus,
      color: "success" as const,
      actionLabel: "Create now",
      onClick: () => navigate("/newsletters/new"),
    },
    {
      title: "Templates",
      description:
        "Browse your saved layouts and reusable newsletter structures.",
      icon: FileText,
      color: "primary" as const,
      actionLabel: "Browse templates",
      onClick: () => navigate("/templates?type=newsletter"),
    },
    {
      title: "Campaigns",
      description:
        "Review sent, scheduled, and draft campaigns in your CRM queue.",
      icon: Send,
      color: "warning" as const,
      actionLabel: "View campaigns",
      onClick: () => navigate("/crm/campaigns"),
    },
  ];

  return (
    <Stack spacing={4}>
      <Sheet
        variant="plain"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: "24px",
          background:
            "linear-gradient(135deg, rgba(12, 74, 110, 0.08) 0%, rgba(236, 253, 245, 0.9) 45%, rgba(255, 255, 255, 1) 100%)",
          border: "1px solid",
          borderColor: "neutral.200",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
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
                <Mail className="h-6 w-6" />
              </Box>
              <div>
                <Typography level="h1">Newsletter Studio</Typography>
                <Typography level="body-md" color="neutral">
                  Create, review, and launch email campaigns without leaving the
                  tenant workspace.
                </Typography>
              </div>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <JoyChip color="primary" variant="soft">
                Tenant email workspace
              </JoyChip>
              <JoyChip color="success" variant="soft">
                Templates ready
              </JoyChip>
            </Stack>
          </Stack>

          <JoyButton
            onClick={() => navigate("/newsletters/new")}
            startDecorator={<Plus />}
          >
            Create Newsletter
          </JoyButton>
        </Stack>
      </Sheet>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(3, minmax(0, 1fr))",
          },
          gap: 3,
        }}
      >
        {actionCards.map((card) => {
          const Icon = card.icon;

          return (
            <JoyCard
              key={card.title}
              interactive
              onClick={card.onClick}
              sx={{ height: "100%" }}
            >
              <JoyCardHeader
                title={card.title}
                description={card.description}
                startDecorator={
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "16px",
                      display: "grid",
                      placeItems: "center",
                      backgroundColor: `${card.color}.50`,
                      color: `${card.color}.700`,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </Box>
                }
              />
              <JoyCardContent>
                <JoyButton
                  bloomVariant="outline"
                  onClick={card.onClick}
                  sx={{ width: "100%" }}
                >
                  {card.actionLabel}
                </JoyButton>
              </JoyCardContent>
            </JoyCard>
          );
        })}
      </Box>

      <JoyCard>
        <JoyCardHeader
          title="Recent newsletters"
          description="This tenant has not sent any newsletter campaigns yet."
        />
        <JoyCardContent>
          <Stack
            spacing={2.5}
            alignItems="center"
            justifyContent="center"
            sx={{ py: { xs: 4, md: 6 }, textAlign: "center" }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "20px",
                display: "grid",
                placeItems: "center",
                backgroundColor: "neutral.100",
                color: "neutral.500",
              }}
            >
              <Mail className="h-8 w-8" />
            </Box>
            <Stack spacing={0.75}>
              <Typography level="title-md">No newsletters yet</Typography>
              <Typography level="body-sm" color="neutral">
                Start with a new campaign or begin from one of your saved
                templates.
              </Typography>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <JoyButton
                onClick={() => navigate("/newsletters/new")}
                startDecorator={<Plus />}
              >
                Create your first newsletter
              </JoyButton>
              <JoyButton
                bloomVariant="outline"
                onClick={() => navigate("/templates?type=newsletter")}
                startDecorator={<FileText />}
              >
                Browse templates
              </JoyButton>
            </Stack>
          </Stack>
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
};
