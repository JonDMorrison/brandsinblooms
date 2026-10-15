// Isolated Playwright entry point. It is not a production route or an auth bypass.
// Real API/RLS authorization is separately verified by HTTP and PostgreSQL contracts.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssVarsProvider, Sheet, Stack, Typography } from "@mui/joy";
import { ProgrammeBaselinePanel } from "@/components/crm/customer-intelligence/ProgrammeBaselinePanel";
import { ProgrammeWorkspaceBody } from "@/components/crm/customer-intelligence/LoyaltyProgrammeWorkspace";
import { CalendarImportWorksheet } from "@/components/calendar/MarketingCalendarImport";
import { createProgrammeDraft } from "../../supabase/functions/_shared/loyalty/programme-templates";
const at = "2026-10-15T18:00:00Z";
const detail = {
  programme: {
    id: "programme-a",
    name: "Synthetic welcome journey",
    status: "draft",
    current_version_id: "version-a",
    created_at: at,
    updated_at: at,
  },
  version: {
    id: "version-a",
    programme_id: "programme-a",
    version_number: 1,
    definition: createProgrammeDraft(
      "welcome",
      "CAD",
      "2026-10-15",
      "America/Vancouver",
    ),
    definition_hash: "a".repeat(64),
  },
  baselines: [],
  baselineLimit: 100,
};
const mode = new URLSearchParams(location.search).get("view") ?? "baseline";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CssVarsProvider>
      <BrowserRouter>
        <Sheet
          sx={{
            minHeight: "100vh",
            p: { xs: 2, md: 4 },
            bgcolor: "background.level1",
          }}
        >
          <Stack spacing={2} sx={{ maxWidth: 1180, mx: "auto" }}>
            <Typography level="body-sm">
              Synthetic test workspace · no customer messages or purchases
            </Typography>
            {mode === "calendar" ? (
              <CalendarImportWorksheet
                tenantId="fixture-tenant"
                timezone="America/Vancouver"
              />
            ) : mode === "programmes" ? (
              <ProgrammeWorkspaceBody
                tenantId="fixture-tenant"
                timezone="America/Vancouver"
              />
            ) : (
              <ProgrammeBaselinePanel
                tenantId="fixture-tenant"
                detail={detail}
                onSaved={async () => undefined}
              />
            )}
          </Stack>
        </Sheet>
      </BrowserRouter>
    </CssVarsProvider>
  </React.StrictMode>,
);
