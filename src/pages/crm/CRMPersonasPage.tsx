import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Layers3, Plus, RefreshCw, Search, Shapes, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PersonaRecord } from "@/config/systemPersonas";
import { CatalogGridSkeleton } from "@/components/crm/catalog/CatalogCardSkeleton";
import {
  CatalogStatsStrip,
  CatalogStatsStripSkeleton,
} from "@/components/crm/catalog/CatalogStatsStrip";
import {
  CustomPersonaModal,
  type PersonaFormInitialValue,
} from "@/components/crm/personas/CustomPersonaModal";
import { PersonaCard } from "@/components/crm/personas/PersonaCard";
import {
  PersonasFilterBar,
  type PersonaSortOption,
  type PersonaViewFilter,
} from "@/components/crm/personas/PersonasFilterBar";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent } from "@/components/joy/JoyCard";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { usePersonaCustomerCounts } from "@/hooks/usePersonaCustomerCounts";

type EditorState = {
  mode: "create" | "edit";
  title: string;
  submitLabel: string;
  persona?: PersonaRecord;
  initialValue?: PersonaFormInitialValue | null;
} | null;

function toInitialValue(
  persona?: PersonaRecord | null,
): PersonaFormInitialValue | null {
  if (!persona) {
    return null;
  }

  return {
    name: persona.persona_name,
    description: persona.persona_description,
    metadata: persona.metadata,
  };
}

const PERSONA_GRID_COLUMNS = {
  xs: "1fr",
  md: "repeat(2, minmax(0, 1fr))",
  xl: "repeat(3, minmax(0, 1fr))",
} as const;

function PersonaSectionHeading({ label }: { label: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography
        level="body-xs"
        sx={{
          color: "neutral.500",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </Typography>
      <Divider sx={{ borderColor: "neutral.200" }} />
    </Stack>
  );
}

function CreatePersonaCard({ onClick }: { onClick: () => void }) {
  return (
    <JoyCard
      interactive
      onClick={onClick}
      sx={{
        minHeight: 280,
        display: "grid",
        placeItems: "center",
        borderStyle: "dashed",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "none",
        textAlign: "center",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: "neutral.400",
          boxShadow: "none",
          backgroundColor: "background.surface",
        },
        "&:hover .create-persona-icon": {
          color: "neutral.500",
        },
      }}
    >
      <JoyCardContent
        sx={{
          pt: 4,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          alignItems: "center",
        }}
      >
        <Plus
          size={24}
          className="create-persona-icon"
          style={{ color: "var(--joy-palette-neutral-300)" }}
        />
        <Typography
          level="body-sm"
          sx={{ color: "neutral.700", fontWeight: 500 }}
        >
          Create persona
        </Typography>
      </JoyCardContent>
    </JoyCard>
  );
}

export const CRMPersonasPage = () => {
  const navigate = useNavigate();
  const {
    personas,
    predefinedPersonas,
    customPersonas,
    createPersona,
    updatePersona,
    fetchPersonas,
    deletePersona,
    loading,
  } = useAllPersonas();
  const {
    statsByPersona,
    summary,
    loading: metricsLoading,
  } = usePersonaCustomerCounts();
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<PersonaViewFilter>("all");
  const [sort, setSort] = React.useState<PersonaSortOption>("customers-desc");
  const [editorState, setEditorState] = React.useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PersonaRecord | null>(
    null,
  );

  const openCreateEditor = React.useCallback(() => {
    setEditorState({
      mode: "create",
      title: "Create custom persona",
      submitLabel: "Save persona",
    });
  }, []);

  const clearFilters = React.useCallback(() => {
    setQuery("");
    setView("all");
    setSort("customers-desc");
  }, []);

  const filteredPersonas = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = personas.filter((persona) => {
      if (view === "system" && persona.is_custom) {
        return false;
      }

      if (view === "custom" && !persona.is_custom) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const interestText = [
        ...(persona.metadata?.communication?.interests ?? []),
        ...(persona.metadata?.communication?.avoidTopics ?? []),
      ]
        .join(" ")
        .toLowerCase();

      const haystack = [
        persona.persona_name,
        persona.persona_description,
        persona.metadata?.behavior?.preferredChannel,
        persona.metadata?.communication?.preferredTone,
        interestText,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return filtered.sort((left, right) => {
      const leftStats = statsByPersona[left.id];
      const rightStats = statsByPersona[right.id];

      switch (sort) {
        case "customers-desc":
          return (
            (rightStats?.customerCount ?? 0) - (leftStats?.customerCount ?? 0)
          );
        case "value-desc":
          return (rightStats?.totalValue ?? 0) - (leftStats?.totalValue ?? 0);
        case "engagement-desc":
          return (
            (rightStats?.averageEngagement ?? 0) -
            (leftStats?.averageEngagement ?? 0)
          );
        case "recent":
          return (
            new Date(right.updated_at ?? right.created_at ?? 0).getTime() -
            new Date(left.updated_at ?? left.created_at ?? 0).getTime()
          );
        case "name-asc":
        default:
          return left.persona_name.localeCompare(right.persona_name);
      }
    });
  }, [personas, query, sort, statsByPersona, view]);

  const handleEditorSave = React.useCallback(
    async (payload: {
      name: string;
      description?: string | null;
      metadata?: PersonaRecord["metadata"];
    }) => {
      if (!editorState) {
        return null;
      }

      const result =
        editorState.mode === "edit" && editorState.persona
          ? await updatePersona({
              id: editorState.persona.id,
              ...payload,
            })
          : await createPersona(payload);

      if (result) {
        setEditorState(null);
      }

      return result;
    },
    [createPersona, editorState, updatePersona],
  );

  const visibleSystemPersonas = React.useMemo(
    () => filteredPersonas.filter((persona) => !persona.is_custom),
    [filteredPersonas],
  );

  const visibleCustomPersonas = React.useMemo(
    () => filteredPersonas.filter((persona) => persona.is_custom),
    [filteredPersonas],
  );

  const showSearchEmptyState =
    filteredPersonas.length === 0 && query.trim().length > 0;
  const isCatalogLoading = loading || metricsLoading;
  const personaStats = React.useMemo(
    () => [
      {
        label: "Total personas",
        value: personas.length.toLocaleString(),
        icon: <Shapes size={18} />,
        iconColor: "primary" as const,
      },
      {
        label: "System personas",
        value: predefinedPersonas.length.toLocaleString(),
        icon: <Layers3 size={18} />,
        iconColor: "neutral" as const,
      },
      {
        label: "Custom personas",
        value: customPersonas.length.toLocaleString(),
        icon: <Plus size={18} />,
        iconColor: "warning" as const,
      },
      {
        label: "Assigned customers",
        value: summary.assignedCustomers.toLocaleString(),
        icon: <Users size={18} />,
        iconColor: "success" as const,
      },
    ],
    [
      customPersonas.length,
      personas.length,
      predefinedPersonas.length,
      summary.assignedCustomers,
    ],
  );

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <JoyPageHeaderBand
          title="Personas"
          description="System and custom personas for targeting, campaign planning, and audience management."
          actions={
            <>
              <JoyTooltip title="Refresh personas">
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  onClick={() => void fetchPersonas()}
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : undefined}
                  />
                </IconButton>
              </JoyTooltip>
              <JoyButton
                size="sm"
                onClick={openCreateEditor}
                startDecorator={<Plus size={16} />}
              >
                Create persona
              </JoyButton>
            </>
          }
          sx={{
            px: 0,
            py: 0,
            borderRadius: 0,
            background: "transparent",
          }}
        />

        {isCatalogLoading ? (
          <CatalogStatsStripSkeleton />
        ) : (
          <CatalogStatsStrip items={personaStats} />
        )}

        <PersonasFilterBar
          query={query}
          onQueryChange={setQuery}
          view={view}
          onViewChange={setView}
          sort={sort}
          onSortChange={setSort}
          resultCount={filteredPersonas.length}
          totalCount={personas.length}
          loading={isCatalogLoading}
          hasActiveFilters={
            query.trim().length > 0 ||
            view !== "all" ||
            sort !== "customers-desc"
          }
          onClearFilters={clearFilters}
        />

        {isCatalogLoading ? (
          <Stack spacing={4}>
            <CatalogGridSkeleton
              columns={PERSONA_GRID_COLUMNS}
              headingWidth={132}
            />
            <CatalogGridSkeleton
              columns={PERSONA_GRID_COLUMNS}
              headingWidth={132}
            />
          </Stack>
        ) : showSearchEmptyState ? (
          <Stack
            spacing={1.25}
            alignItems="center"
            sx={{ py: { xs: 6, md: 8 } }}
          >
            <Search
              size={32}
              style={{ color: "var(--joy-palette-neutral-300)" }}
            />
            <Typography level="body-sm" color="neutral">
              No personas match your search
            </Typography>
            <JoyButton
              variant="plain"
              color="primary"
              size="sm"
              sx={{ minHeight: "auto", px: 0 }}
              onClick={clearFilters}
            >
              Clear search
            </JoyButton>
          </Stack>
        ) : (
          <Stack spacing={4}>
            {view !== "custom" && visibleSystemPersonas.length > 0 ? (
              <Stack spacing={1.5}>
                <PersonaSectionHeading label="System Personas" />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: PERSONA_GRID_COLUMNS,
                    gap: 2,
                  }}
                >
                  {visibleSystemPersonas.map((persona) => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      metrics={statsByPersona[persona.id]}
                      detailHref={`/crm/personas/${encodeURIComponent(persona.id)}`}
                      campaignHref={`/crm/campaigns/new?persona=${encodeURIComponent(persona.id)}`}
                      onView={() =>
                        navigate(
                          `/crm/personas/${encodeURIComponent(persona.id)}`,
                        )
                      }
                      onCreateCampaign={() =>
                        navigate(
                          `/crm/campaigns/new?persona=${encodeURIComponent(persona.id)}`,
                        )
                      }
                      onGenerateContent={() =>
                        navigate(
                          `/crm/campaigns/new?persona=${encodeURIComponent(persona.id)}&type=newsletter`,
                        )
                      }
                    />
                  ))}
                </Box>
              </Stack>
            ) : null}

            {view !== "system" ? (
              <Stack spacing={1.5}>
                <PersonaSectionHeading label="Custom Personas" />
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: PERSONA_GRID_COLUMNS,
                    gap: 2,
                  }}
                >
                  <CreatePersonaCard onClick={openCreateEditor} />
                  {visibleCustomPersonas.map((persona) => (
                    <PersonaCard
                      key={persona.id}
                      persona={persona}
                      metrics={statsByPersona[persona.id]}
                      detailHref={`/crm/personas/${encodeURIComponent(persona.id)}`}
                      campaignHref={`/crm/campaigns/new?persona=${encodeURIComponent(persona.id)}`}
                      onView={() =>
                        navigate(
                          `/crm/personas/${encodeURIComponent(persona.id)}`,
                        )
                      }
                      onCreateCampaign={() =>
                        navigate(
                          `/crm/campaigns/new?persona=${encodeURIComponent(persona.id)}`,
                        )
                      }
                      onGenerateContent={() =>
                        navigate(
                          `/crm/campaigns/new?persona=${encodeURIComponent(persona.id)}&type=newsletter`,
                        )
                      }
                      onEdit={() =>
                        setEditorState({
                          mode: "edit",
                          title: `Edit ${persona.persona_name}`,
                          submitLabel: "Update persona",
                          persona,
                          initialValue: toInitialValue(persona),
                        })
                      }
                      onDuplicate={() =>
                        setEditorState({
                          mode: "create",
                          title: `Duplicate ${persona.persona_name}`,
                          submitLabel: "Create duplicate",
                          initialValue: {
                            name: `${persona.persona_name} Copy`,
                            description: persona.persona_description,
                            metadata: persona.metadata,
                          },
                        })
                      }
                      onDelete={() => setDeleteTarget(persona)}
                    />
                  ))}
                </Box>

                {visibleCustomPersonas.length === 0 &&
                query.trim().length === 0 ? (
                  <Sheet
                    variant="outlined"
                    sx={{
                      borderStyle: "dashed",
                      borderColor: "neutral.200",
                      borderRadius: "lg",
                      px: 3,
                      py: 3.5,
                      textAlign: "center",
                    }}
                  >
                    <Stack spacing={1.25} alignItems="center">
                      <Typography level="title-sm">
                        No custom personas yet
                      </Typography>
                      <Typography level="body-sm" color="neutral">
                        Create a custom persona for campaign planning beyond the
                        built-in archetypes.
                      </Typography>
                      <JoyButton
                        variant="plain"
                        color="primary"
                        size="sm"
                        sx={{ minHeight: "auto", px: 0 }}
                        onClick={openCreateEditor}
                      >
                        Create your first custom persona
                      </JoyButton>
                    </Stack>
                  </Sheet>
                ) : null}
              </Stack>
            ) : null}
          </Stack>
        )}

        <CustomPersonaModal
          open={Boolean(editorState)}
          onSave={handleEditorSave}
          onCancel={() => setEditorState(null)}
          title={editorState?.title}
          submitLabel={editorState?.submitLabel}
          initialValue={editorState?.initialValue}
        />

        <JoyAlertDialog
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            if (!deleteTarget) {
              return;
            }

            const success = await deletePersona(deleteTarget.id);
            if (success) {
              setDeleteTarget(null);
            }
          }}
          title={`Delete ${deleteTarget?.persona_name ?? "persona"}?`}
          description="This removes the custom persona from the catalog and clears its explicit customer assignments. Existing campaign history stays intact."
          confirmLabel="Delete persona"
          variant="danger"
        />
      </Stack>
    </PageContainer>
  );
};

export default CRMPersonasPage;
