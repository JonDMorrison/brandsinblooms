import type { ReactNode } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

interface IntegrationSectionProps {
  title: string;
  description: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function IntegrationSection({
  title,
  description,
  icon,
  children,
}: IntegrationSectionProps) {
  return (
    <Stack spacing={1.75}>
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {icon ? (
            <Box
              sx={{
                color: "text.secondary",
                display: "flex",
                alignItems: "center",
              }}
            >
              {icon}
            </Box>
          ) : null}
          <Typography component="h4" level="title-lg" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Stack>
        <Typography
          level="body-sm"
          sx={{ color: "text.secondary", maxWidth: 720 }}
        >
          {description}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(3, minmax(0, 1fr))",
          },
          gap: 2,
        }}
      >
        {children}
      </Box>
    </Stack>
  );
}
