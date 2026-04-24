import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import type { ColorPaletteProp } from "@mui/joy/styles/types";
import Typography from "@mui/joy/Typography";
import { type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";

interface MetricCardProps {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  color: string;
  borderColor: string;
  bgColor: string;
  clickable?: boolean;
  href?: string;
  suffix?: string;
  prefix?: string;
}

export const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
  color,
  borderColor,
  bgColor,
  clickable = false,
  href,
  suffix = "",
  prefix = "",
}: MetricCardProps) => {
  const resolvePalette = (...tokens: string[]): ColorPaletteProp => {
    const joined = tokens.join(" ").toLowerCase();

    if (joined.includes("green") || joined.includes("emerald")) {
      return "success";
    }

    if (
      joined.includes("yellow") ||
      joined.includes("orange") ||
      joined.includes("amber")
    ) {
      return "warning";
    }

    if (joined.includes("red")) {
      return "danger";
    }

    if (
      joined.includes("blue") ||
      joined.includes("purple") ||
      joined.includes("indigo") ||
      joined.includes("cyan")
    ) {
      return "primary";
    }

    return "neutral";
  };

  const palette = resolvePalette(color, borderColor, bgColor);
  const displayValue =
    value === 0 && !clickable ? "—" : `${prefix}${value}${suffix}`;
  const cardContent = (
    <JoyCard interactive={clickable}>
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-start"
            justifyContent="space-between"
          >
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
              <Typography level="body-sm" color="neutral">
                {title}
              </Typography>
              <Typography level="h3" color={palette}>
                {displayValue}
              </Typography>
            </Stack>
            <Sheet
              variant="soft"
              color={palette}
              sx={{
                width: 40,
                height: 40,
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Icon className="h-5 w-5" />
            </Sheet>
          </Stack>
          <Typography level="body-sm" color="neutral">
            {description}
          </Typography>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );

  if (clickable && href) {
    return (
      <Link to={href} className="block no-underline">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
};
