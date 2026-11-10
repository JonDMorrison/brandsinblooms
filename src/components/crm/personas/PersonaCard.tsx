import * as React from "react";
import { CatalogListRow } from "@/components/crm/catalog/CatalogListRow";
import type { CatalogLayout } from "@/components/crm/catalog/CatalogViewToggle";
import Avatar from "@mui/joy/Avatar";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { MoreHorizontal } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { getPersonaIcon } from "@/components/icons/personas";
import { formatSegmentValue } from "@/lib/crm/systemSegmentDataAvailability";
import type { PersonaRecord } from "@/config/systemPersonas";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import Button from "@mui/joy/Button";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import type { PersonaRollup } from "@/hooks/usePersonaCustomerCounts";

interface PersonaCardProps {
  layout?: CatalogLayout;
  persona: PersonaRecord;
  metrics?: PersonaRollup;
  detailHref: string;
  campaignHref: string;
  onView: () => void;
  onCreateCampaign: () => void;
  onGenerateContent?: () => void;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

const stopPropagation = (event: React.MouseEvent<HTMLElement>) => {
  event.stopPropagation();
};

export function PersonaCard({
  layout = "grid",
  persona,
  metrics,
  detailHref,
  campaignHref,
  onView,
  onCreateCampaign,
  onGenerateContent,
  onEdit,
  onDuplicate,
  onDelete,
}: PersonaCardProps) {
  const PersonaIcon = getPersonaIcon(
    persona.id,
    persona.persona_name,
    !persona.is_custom,
  );

  const actions = (
    <JoyDropdownMenu>
      <JoyDropdownMenuTrigger
        aria-label={`Actions for ${persona.persona_name}`}
        onClick={stopPropagation}
        iconButtonSx={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
      >
        <MoreHorizontal size={16} />
      </JoyDropdownMenuTrigger>
      <JoyDropdownMenuContent onClick={stopPropagation}>
        <JoyDropdownMenuItem onClick={onView}>
          View details
        </JoyDropdownMenuItem>
        <JoyDropdownMenuItem onClick={onCreateCampaign}>
          Create campaign
        </JoyDropdownMenuItem>
        {onGenerateContent ? (
          <JoyDropdownMenuItem onClick={onGenerateContent}>
            Generate AI content
          </JoyDropdownMenuItem>
        ) : null}
        {persona.is_custom && onEdit ? (
          <JoyDropdownMenuItem onClick={onEdit}>
            Edit persona
          </JoyDropdownMenuItem>
        ) : null}
        {persona.is_custom && onDuplicate ? (
          <JoyDropdownMenuItem onClick={onDuplicate}>
            Duplicate persona
          </JoyDropdownMenuItem>
        ) : null}
        {persona.is_custom && onDelete ? (
          <>
            <Divider sx={{ my: 0.5 }} />
            <JoyDropdownMenuItem destructive onClick={onDelete}>
              Delete persona
            </JoyDropdownMenuItem>
          </>
        ) : null}
      </JoyDropdownMenuContent>
    </JoyDropdownMenu>
  );

  const count = metrics?.customerCount;
  const averageValue = formatSegmentValue(metrics?.averageValue ?? null, count ?? 0);
  const totalValue = formatSegmentValue(metrics?.totalValue ?? null, count ?? 0);

  if (layout === "list") {
    return (
      <CatalogListRow
        name={persona.persona_name}
        description={persona.persona_description}
        icon={<PersonaIcon size={20} />}
        isCustom={persona.is_custom}
        detailHref={detailHref}
        campaignHref={campaignHref}
        actions={actions}
        metrics={[
          { label: "Customers", value: count === undefined ? "Not available" : `${count.toLocaleString()} customers` },
          { label: "Average value", value: averageValue },
          { label: "Total value", value: totalValue },
        ]}
      />
    );
  }

  return (
    <JoyCard
      interactive
      onClick={onView}
      sx={{
        minHeight: 280,
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-xs)",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: "neutral.300",
          boxShadow: "var(--joy-shadow-sm)",
          backgroundColor: "background.surface",
        },
      }}
    >
      <JoyCardHeader
        title={persona.persona_name}
        description={persona.persona_description}
        startDecorator={
          <Avatar
            variant="soft"
            color={persona.is_custom ? "primary" : "neutral"}
            sx={{
              "--Avatar-size": "40px",
              flexShrink: 0,
              "& svg": {
                display: "block",
              },
            }}
          >
            <PersonaIcon size={22} />
          </Avatar>
        }
        actions={actions}
      />

      <JoyCardContent
        sx={{ pt: 2, display: "flex", flexDirection: "column", gap: 1.75 }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <JoyChip size="sm" variant="outlined" color="neutral">
            {persona.is_custom ? "Custom" : "System"}
          </JoyChip>
        </Stack>

        <Stack spacing={1.25}>
          <Stack spacing={0.35}>
            <Typography level="body-xs" color="neutral">
              Customers
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              {count === undefined ? "Not available" : `${count.toLocaleString()} customers`}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
            <Stack spacing={0.35} sx={{ minWidth: 110 }}>
              <Typography level="body-xs" color="neutral">
                Average value
              </Typography>
              <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                {averageValue}
              </Typography>
            </Stack>
            <Stack spacing={0.35} sx={{ minWidth: 110 }}>
              <Typography level="body-xs" color="neutral">
                Total value
              </Typography>
              <Typography level="body-sm" sx={{ fontWeight: 500 }}>
                {totalValue}
              </Typography>
            </Stack>
          </Stack>

          {metrics?.topChannel ? (
            <Typography level="body-xs" color="neutral">
              Top channel: {metrics.topChannel}
            </Typography>
          ) : null}
        </Stack>

        <Divider />

        <Stack
          direction="row"
          justifyContent="flex-end"
          alignItems="center"
          spacing={1}
          mt="auto"
        >
          <Button
            size="sm"
            variant="soft"
            color="neutral"
            component={RouterLink}
            to={detailHref}
            onClick={stopPropagation}
          >
            View details
          </Button>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            component={RouterLink}
            to={campaignHref}
            onClick={stopPropagation}
          >
            Create campaign
          </Button>
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
