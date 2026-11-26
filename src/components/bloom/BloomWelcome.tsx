import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Clock,
  FileText,
  GitCompare,
  LifeBuoy,
  Lightbulb,
  Mail,
  Package,
  PenLine,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ResourceFocus } from "@/types/askBloom";
import { getAskBloomStarterConfig } from "@/utils/askBloomStarters";

const STARTER_ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Clock,
  FileText,
  GitCompare,
  Lightbulb,
  Mail,
  Package,
  PenLine,
  Search,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
  User,
  Users,
};

function StarterIcon({ name, size = 15 }: { name: string; size?: number }) {
  const Icon = STARTER_ICON_MAP[name] ?? Sparkles;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.8} />;
}

const welcomeFontFamily = "var(--joy-fontFamily-display)";

const GENERAL_WELCOME_BODY =
  "Ask a question in everyday language. Bloom checks your customer, sales, and campaign records and points you to the source.";

export interface BloomWelcomeProps {
  /** The conversation's subject; null asks general starters. */
  resourceFocus: ResourceFocus | null;
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
  /** "panel" is the drawer; "page" is /bloom's wider canvas. */
  layout?: "panel" | "page";
  /** Extra content under the starters (e.g. the drawer's resource insights). */
  children?: React.ReactNode;
}

/**
 * The one Bloom welcome screen: greeting, starter questions and the "More help"
 * list. The Ask Bloom drawer and /bloom both render it, and both read their
 * starters from `getAskBloomStarterConfig` so the two never drift apart.
 */
export function BloomWelcome({
  children,
  disabled = false,
  layout = "panel",
  onSelectPrompt,
  resourceFocus,
}: BloomWelcomeProps) {
  const isPage = layout === "page";
  const starterConfig = React.useMemo(
    () => getAskBloomStarterConfig(resourceFocus),
    [resourceFocus],
  );
  const isGeneral = !resourceFocus;
  const secondaryStarters = starterConfig.secondaryStarters ?? [];
  const [isMoreHelpOpen, setIsMoreHelpOpen] = React.useState(false);
  const moreHelpRegionId = React.useId();

  return (
    <Stack
      data-testid="bloom-welcome"
      spacing={2}
      sx={{
        width: "100%",
        maxWidth: isPage ? 920 : undefined,
        mx: isPage ? "auto" : undefined,
        px: isPage ? { xs: 3, sm: 5, md: 6 } : "4px",
        py: isPage ? { xs: 4, sm: 5 } : 2,
        fontFamily: welcomeFontFamily,
        "& .MuiTypography-root": { fontFamily: welcomeFontFamily },
      }}
    >
      <Stack spacing={1}>
        <Typography
          sx={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "primary.900",
          }}
        >
          Your store guide
        </Typography>
        <Typography
          component="h3"
          sx={{
            fontSize: "20px",
            fontWeight: 700,
            lineHeight: 1.25,
            color: "brandNavy.900",
            textAlign: "left",
          }}
        >
          {starterConfig.greeting}
        </Typography>
        {isGeneral ? (
          <Typography
            sx={{ fontSize: "13.5px", lineHeight: 1.5, color: "neutral.600" }}
          >
            {GENERAL_WELCOME_BODY}
          </Typography>
        ) : null}
      </Stack>

      <Stack spacing={1.25}>
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography
            sx={{ fontSize: "13px", fontWeight: 700, color: "brandNavy.900" }}
          >
            Try asking
          </Typography>
          <Typography sx={{ fontSize: "12px", color: "neutral.600" }}>
            One tap to ask
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isPage
              ? {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                }
              : "repeat(2, minmax(0, 1fr))",
            gap: "10px",
          }}
        >
          {starterConfig.starters.map((starter) => (
            <Box
              key={starter.label}
              component="button"
              type="button"
              disabled={disabled}
              onClick={() => onSelectPrompt(starter.prompt)}
              sx={{
                appearance: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: "8px",
                minWidth: 0,
                p: "12px",
                textAlign: "left",
                font: "inherit",
                fontFamily: welcomeFontFamily,
                cursor: "pointer",
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "brandNavy.200",
                borderRadius: "16px",
                color: "brandNavy.900",
                transition:
                  "border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
                "&:hover": {
                  borderColor: "primary.500",
                  boxShadow:
                    "0 6px 18px rgba(var(--joy-palette-neutral-darkChannel) / 0.08)",
                },
                "&:active": { transform: "translateY(1px)" },
                "&:disabled": { cursor: "not-allowed", opacity: 0.5 },
                "&:focus-visible": {
                  outline: "2px solid var(--joy-palette-focusVisible)",
                  outlineOffset: "2px",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "10px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "primary.100",
                    color: "primary.900",
                    flexShrink: 0,
                  }}
                >
                  <StarterIcon name={starter.icon} size={17} />
                </Box>
                <Box
                  aria-hidden="true"
                  sx={{ display: "inline-flex", color: "neutral.600" }}
                >
                  <ArrowUpRight size={14} strokeWidth={2} />
                </Box>
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: "14px",
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: "brandNavy.900",
                    overflowWrap: "anywhere",
                  }}
                >
                  {starter.label}
                </Typography>
                <Typography
                  sx={{
                    mt: "2px",
                    fontSize: "12.5px",
                    lineHeight: 1.4,
                    color: "neutral.600",
                    overflowWrap: "anywhere",
                  }}
                >
                  {starter.description}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Typography
          sx={{ fontSize: "11.5px", color: "neutral.600", textAlign: "center" }}
        >
          Sourced answers · You approve every change
        </Typography>
      </Stack>

      {isGeneral && secondaryStarters.length > 0 ? (
        <Box
          sx={{
            bgcolor: "common.white",
            border: "1px solid",
            borderColor: "brandNavy.200",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          <Box
            component="button"
            type="button"
            aria-expanded={isMoreHelpOpen}
            aria-controls={moreHelpRegionId}
            onClick={() => setIsMoreHelpOpen((current) => !current)}
            sx={{
              appearance: "none",
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              p: "12px",
              border: "none",
              bgcolor: "transparent",
              textAlign: "left",
              font: "inherit",
              fontFamily: welcomeFontFamily,
              cursor: "pointer",
              "&:focus-visible": {
                outline: "2px solid var(--joy-palette-focusVisible)",
                outlineOffset: "-2px",
              },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 34,
                height: 34,
                borderRadius: "10px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "primary.100",
                color: "primary.900",
                flexShrink: 0,
              }}
            >
              <LifeBuoy size={17} strokeWidth={1.8} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "brandNavy.900",
                }}
              >
                More help and actions
              </Typography>
              <Typography sx={{ fontSize: "12.5px", color: "neutral.600" }}>
                Look up a customer, check stock, or fix a problem
              </Typography>
            </Box>
            <Box
              aria-hidden="true"
              sx={{
                display: "inline-flex",
                color: "neutral.600",
                flexShrink: 0,
                transition: "transform 200ms ease",
                transform: isMoreHelpOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              <ChevronDown size={16} strokeWidth={2} />
            </Box>
          </Box>
          {isMoreHelpOpen ? (
            <Box
              id={moreHelpRegionId}
              sx={{
                borderTop: "1px solid",
                borderColor: "brandNavy.200",
                py: "4px",
              }}
            >
              {secondaryStarters.map((starter) => (
                <Box
                  key={starter.label}
                  component="button"
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectPrompt(starter.prompt)}
                  sx={{
                    appearance: "none",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    p: "10px 14px",
                    border: "none",
                    bgcolor: "transparent",
                    textAlign: "left",
                    font: "inherit",
                    fontFamily: welcomeFontFamily,
                    fontSize: "13.5px",
                    fontWeight: 500,
                    color: "brandNavy.900",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "brandNavy.50" },
                    "&:focus-visible": {
                      outline: "2px solid var(--joy-palette-focusVisible)",
                      outlineOffset: "-2px",
                    },
                  }}
                >
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{ display: "inline-flex", color: "primary.900" }}
                  >
                    <StarterIcon name={starter.icon} />
                  </Box>
                  {starter.label}
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {children}
    </Stack>
  );
}
