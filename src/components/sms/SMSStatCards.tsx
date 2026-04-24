import * as React from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import {
  Clock3,
  MessageSquare,
  MousePointerClick,
  TrendingUp,
  Users,
} from "lucide-react";
import type { SMSStats } from "@/hooks/useSMSStats";

interface SMSStatCardsProps {
  stats: SMSStats;
  onCardClick: (cardType: string) => void;
}

type StatCardConfig = {
  key: string;
  label: string;
  value: number;
  formatter: (value: number) => string;
  subtitle: string;
  color: "primary" | "success" | "warning" | "info" | "neutral";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconSx?: SxProps;
};

const GRID_COLUMNS = {
  xs: "1fr",
  sm: "repeat(2, minmax(0, 1fr))",
  md: "repeat(3, minmax(0, 1fr))",
  xl: "repeat(5, minmax(0, 1fr))",
} as const;

function AnimatedStatValue({
  value,
  formatter,
}: {
  value: number;
  formatter: (value: number) => string;
}) {
  const [displayValue, setDisplayValue] = React.useState(0);
  const previousValueRef = React.useRef(0);

  React.useEffect(() => {
    const startValue = previousValueRef.current;
    const delta = value - startValue;
    const duration = 420;
    let frameId = 0;
    let startTime = 0;

    const step = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + delta * easedProgress;

      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        previousValueRef.current = value;
      }
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [value]);

  return <>{formatter(Math.round(displayValue))}</>;
}

function formatTrendDescriptor(
  value: number | null | undefined,
  fallback: string,
) {
  if (value === null || value === undefined || value === 0) {
    return fallback;
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}% vs prior 30 days`;
}

export const SMSStatCards: React.FC<SMSStatCardsProps> = ({
  stats,
  onCardClick,
}) => {
  const cards: StatCardConfig[] = [
    {
      key: "subscribers",
      label: "Subscribers",
      value: stats.subscribers,
      formatter: (value) => value.toLocaleString(),
      subtitle: formatTrendDescriptor(
        stats.subscribersGrowth,
        "SMS opted-in audience",
      ),
      icon: Users,
      color: "primary",
    },
    {
      key: "credits",
      label: "Credits",
      value: stats.credits,
      formatter: (value) => value.toLocaleString(),
      subtitle: `${stats.creditsUsed.toLocaleString()} used this month`,
      icon: MessageSquare,
      color: "success",
    },
    {
      key: "deliverability",
      label: "Deliverability",
      value: stats.deliverability,
      formatter: (value) => `${value}%`,
      subtitle: formatTrendDescriptor(
        stats.deliverabilityGrowth,
        "Messages delivered successfully",
      ),
      icon: TrendingUp,
      color: "warning",
    },
    {
      key: "clicks",
      label: "Clicks",
      value: stats.clicks,
      formatter: (value) => value.toLocaleString(),
      subtitle: formatTrendDescriptor(stats.clicksGrowth, "Total link clicks"),
      icon: MousePointerClick,
      color: "info",
      iconSx: {
        backgroundColor: "rgba(78, 186, 181, 0.14)",
        color: "#1E8A85",
        "&:hover": {
          backgroundColor: "rgba(78, 186, 181, 0.18)",
        },
      },
    },
    {
      key: "queue",
      label: "Queue",
      value: stats.queuedMessages,
      formatter: (value) => value.toLocaleString(),
      subtitle:
        stats.queuedMessages === 1
          ? "1 message waiting to send"
          : "Messages waiting to send",
      icon: Clock3,
      color: "neutral",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: GRID_COLUMNS,
        gap: 2,
      }}
    >
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            key={card.key}
            onClick={() => onCardClick(card.key)}
            variant="outlined"
            sx={{
              p: 2.5,
              minHeight: 184,
              borderRadius: "24px",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
              cursor: "pointer",
              transition:
                "border-color 180ms ease-out, box-shadow 180ms ease-out, transform 180ms ease-out",
              "&:hover": {
                borderColor: "neutral.300",
                boxShadow: "sm",
                transform: "translateY(-2px)",
              },
            }}
          >
            <Stack spacing={2.25} sx={{ height: "100%" }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 2,
                }}
              >
                <Typography
                  level="body-xs"
                  color="neutral"
                  fontWeight="lg"
                  sx={{
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {card.label}
                </Typography>

                <IconButton
                  size="sm"
                  variant="soft"
                  color={card.color}
                  aria-hidden="true"
                  sx={{
                    borderRadius: "999px",
                    pointerEvents: "none",
                    ...card.iconSx,
                  }}
                >
                  <Icon size={18} />
                </IconButton>
              </Box>

              <Typography
                level="h2"
                sx={{
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                <AnimatedStatValue
                  value={card.value}
                  formatter={card.formatter}
                />
              </Typography>

              <Typography level="body-xs" color="neutral">
                {card.subtitle}
              </Typography>
            </Stack>
          </Card>
        );
      })}
    </Box>
  );
};
