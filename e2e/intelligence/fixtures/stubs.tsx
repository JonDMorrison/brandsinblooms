import * as React from "react";
import { Box, Button, Sheet, Stack, Typography } from "@mui/joy";

export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        width: "100%",
        boxSizing: "border-box",
        maxWidth: 1480,
        mx: "auto",
        px: { xs: 2, md: 4 },
        pb: 8,
      }}
    >
      {children}
    </Box>
  );
}
export function CustomerGrowthWorkspace({ section }: { section?: string }) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "20px", p: 3 }}>
      <Stack spacing={1}>
        <Typography level="h3">
          Customer{" "}
          {section === "growth" ? "growth comparison" : "purchase explorer"}
        </Typography>
        <Typography level="body-md">
          Recorded customer histories, exact filters and unknown data remain
          available in the real workbench.
        </Typography>
        <Button variant="outlined">
          Review recorded{" "}
          {section === "growth" ? "dates and weights" : "product purchases"}
        </Button>
      </Stack>
    </Sheet>
  );
}
export function LoyaltyProgrammeWorkspace() {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "20px", p: 3 }}>
      <Typography level="h3">Loyalty programmes and measurement</Typography>
    </Sheet>
  );
}
export function IdealCustomerTypeExportPanel() {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "20px", p: 3 }}>
      <Typography level="h3">Reviewed Ideal Customer Type export</Typography>
    </Sheet>
  );
}
export function PushReadinessPanel() {
  return (
    <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
      <Typography level="title-md">Push channel readiness</Typography>
    </Sheet>
  );
}
export function PushPilotPanel() {
  return (
    <Sheet variant="soft" sx={{ borderRadius: "lg", p: 2 }}>
      <Typography level="title-md">Advanced push programme controls</Typography>
    </Sheet>
  );
}
