import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { TrendingUp, UserCheck, Users, UserX } from "lucide-react";

interface SegmentsStatsStripProps {
  totalSegments: number;
  segmentedCustomers: number;
  unsegmentedCustomers: number;
  coverageRate: number;
}

export function SegmentsStatsStrip({
  totalSegments,
  segmentedCustomers,
  unsegmentedCustomers,
  coverageRate,
}: SegmentsStatsStripProps) {
  const items = [
    {
      label: "Total segments",
      value: totalSegments.toLocaleString(),
      icon: <Users />,
    },
    {
      label: "Segmented customers",
      value: segmentedCustomers.toLocaleString(),
      icon: <UserCheck />,
    },
    {
      label: "Unsegmented customers",
      value: unsegmentedCustomers.toLocaleString(),
      icon: <UserX />,
    },
    {
      label: "Audience coverage",
      value: `${coverageRate}%`,
      icon: <TrendingUp />,
    },
  ];

  return (
    <Sheet
      variant="plain"
      sx={{
        overflow: "hidden",
        borderRadius: "var(--joy-radius-xl)",
        border: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
      }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {items.map((item, index) => (
          <Stack
            key={item.label}
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
              px: { xs: 2, md: 2.5 },
              py: { xs: 2, md: 2.25 },
              borderColor: "neutral.100",
              borderTop: index > 1 ? { xs: "1px solid", lg: "none" } : "none",
              borderLeft:
                index % 2 === 1 ? { xs: "1px solid", lg: "none" } : "none",
              "@media (min-width: 1200px)": {
                borderTop: "none",
                borderLeft: index === 0 ? "none" : "1px solid",
              },
            }}
          >
            <Sheet
              variant="soft"
              color="neutral"
              sx={{
                width: 36,
                height: 36,
                borderRadius: "999px",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                "& > *": {
                  width: 18,
                  height: 18,
                },
              }}
            >
              {item.icon}
            </Sheet>
            <Stack spacing={0.25}>
              <Typography level="body-xs" color="neutral">
                {item.label}
              </Typography>
              <Typography level="title-md" sx={{ fontWeight: 600 }}>
                {item.value}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Box>
    </Sheet>
  );
}
