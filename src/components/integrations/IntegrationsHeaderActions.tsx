import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import { Download, MailPlus } from "lucide-react";
import type { IntegrationDefinition } from "@/components/integrations/integrationsHubConfig";
import { SUPPORT_EMAIL } from "@/lib/bloomSupport/constants";

const REQUEST_INTEGRATION_MAILTO =
  `mailto:${SUPPORT_EMAIL}?subject=Request%20an%20Integration&body=Hi%20BloomSuite%20team%2C%0A%0AI'd%20like%20to%20request%20support%20for%20the%20following%20integration%3A%0A`;

function exportIntegrationStatuses(items: IntegrationDefinition[]) {
  const rows = [
    ["Name", "Category", "Status", "Detail Path"],
    ...items.map((item) => [
      item.name,
      item.categoryLabel,
      item.status,
      `/integrations/${item.slug}`,
    ]),
  ];

  const csv = rows
    .map((row) =>
      row.map((value) => `"${String(value).split('"').join('""')}"`).join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "integrations-status.csv";
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The header actions every integrations surface shows (/integrations and
 * Settings > Connections), so both pages offer the same things.
 */
export function IntegrationsHeaderActions({
  items,
}: {
  items: IntegrationDefinition[];
}) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems={{ xs: "stretch", sm: "center" }}
    >
      <Button
        color="neutral"
        size="sm"
        startDecorator={<Download size={16} />}
        variant="outlined"
        onClick={() => exportIntegrationStatuses(items)}
      >
        Export status
      </Button>
      <Button
        color="neutral"
        component="a"
        href={REQUEST_INTEGRATION_MAILTO}
        size="sm"
        startDecorator={<MailPlus size={16} />}
        variant="solid"
      >
        Request integration
      </Button>
    </Stack>
  );
}
