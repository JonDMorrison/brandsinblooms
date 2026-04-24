import React, { useState } from "react";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Plus } from "lucide-react";
import { EmailDomainsList } from "@/components/domains/EmailDomainsList";
import { PageContainer } from "@/components/joy/PageContainer";

const DomainsPage = () => {
  const [addDomainOpen, setAddDomainOpen] = useState(false);

  return (
    <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Sheet sx={{ bgcolor: "transparent" }}>
        <Stack spacing={0}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
            useFlexGap
            sx={{ mb: 3 }}
          >
            <Stack spacing={0.75}>
              <Typography level="h3" sx={{ fontWeight: 700 }}>
                Email Domains
              </Typography>
              <Typography level="body-sm" color="neutral">
                Manage branded sending domains to improve deliverability and
                keep DMARC compliance on track.
              </Typography>
            </Stack>

            <Button
              color="primary"
              size="sm"
              startDecorator={<Plus size={16} />}
              variant="solid"
              onClick={() => setAddDomainOpen(true)}
            >
              Add Domain
            </Button>
          </Stack>

          <EmailDomainsList
            addDomainOpen={addDomainOpen}
            onAddDomainOpenChange={setAddDomainOpen}
          />
        </Stack>
      </Sheet>
    </PageContainer>
  );
};

export default DomainsPage;
