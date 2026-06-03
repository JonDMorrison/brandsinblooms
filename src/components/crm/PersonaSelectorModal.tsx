import { useState, useEffect } from "react";
import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Checkbox from "@mui/joy/Checkbox";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  Check,
  Info,
  Plus,
  Search,
  Target,
  UserCircle,
  UserPlus,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPersonaEmoji } from "@/config/systemPersonas";
import { useAllPersonas } from "@/hooks/useAllPersonas";

interface PersonaSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onPersonasSelected: (personas: any[]) => void;
  selectedPersonaIds?: string[];
  title?: string;
  description?: string;
}

const sectionHeadingSx = {
  color: "neutral.500",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
} as const;

const selectableCardSx = (isSelected: boolean) => ({
  cursor: "pointer",
  transition: "all 0.15s ease",
  borderColor: isSelected ? "primary.500" : "neutral.outlinedBorder",
  bgcolor: isSelected ? "primary.softBg" : "background.surface",
  boxShadow: isSelected ? "sm" : "none",
  "&:hover": {
    borderColor: isSelected ? "primary.500" : "primary.300",
    bgcolor: "primary.softBg",
  },
});

const clampSx = (lines: number) => ({
  display: "-webkit-box",
  WebkitLineClamp: lines,
  WebkitBoxOrient: "vertical" as const,
  overflow: "hidden",
});

const matchesQuery = (value: string | null | undefined, query: string) =>
  !query || (value ?? "").toLowerCase().includes(query);

export const PersonaSelectorModal = ({
  open,
  onClose,
  onPersonasSelected,
  selectedPersonaIds = [],
  title = "Select Your Customer Personas",
  description = "Choose personas that represent your ideal customers",
}: PersonaSelectorModalProps) => {
  const [selectedPredefined, setSelectedPredefined] =
    useState<string[]>(selectedPersonaIds);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customPersona, setCustomPersona] = useState({
    persona_name: "",
    persona_description: "",
  });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const { personas, loading, createPersona } = useAllPersonas();

  const predefinedPersonas = personas.filter((persona) => !persona.is_custom);
  const savedPersonas = personas.filter((persona) => persona.is_custom);

  useEffect(() => {
    if (open) {
      // Re-seed selection on open only. Consumers pass a freshly-mapped
      // selectedPersonaIds array each render, so keying on it would reset
      // in-modal toggles (and any just-created persona) on unrelated parent
      // re-renders. Matches SegmentSelectorModal's intentional [open] keying.
      setSelectedPredefined(selectedPersonaIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePredefinedToggle = (personaId: string) => {
    setSelectedPredefined((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId],
    );
  };

  const createCustomPersona = async () => {
    if (!customPersona.persona_name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a persona name",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate names
    const existingNames = [
      ...predefinedPersonas.map((p) => p.persona_name.toLowerCase()),
      ...savedPersonas.map((p) => p.persona_name.toLowerCase()),
    ];

    if (existingNames.includes(customPersona.persona_name.toLowerCase())) {
      toast({
        title: "Error",
        description: "A persona with this name already exists",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const createdPersona = await createPersona({
        name: customPersona.persona_name,
        description: customPersona.persona_description,
      });

      if (!createdPersona) {
        throw new Error("Failed to create persona.");
      }

      toast({
        title: "Success",
        description: "Custom persona created successfully",
      });

      setSelectedPredefined((prev) => [...prev, createdPersona.id]);

      // Reset form
      setCustomPersona({ persona_name: "", persona_description: "" });
      setShowCustomForm(false);
    } catch (error) {
      console.error("Error creating persona:", error);
      toast({
        title: "Error",
        description: "Failed to create custom persona",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = () => {
    const selectedPersonas = personas.filter((persona) =>
      selectedPredefined.includes(persona.id),
    );

    onPersonasSelected(selectedPersonas);
    onClose();
  };

  const handleClose = () => {
    setShowCustomForm(false);
    setCustomPersona({ persona_name: "", persona_description: "" });
    setSearch("");
    onClose();
  };

  const query = search.trim().toLowerCase();
  const filteredPredefined = predefinedPersonas.filter((persona) =>
    matchesQuery(persona.persona_name, query),
  );
  const filteredSaved = savedPersonas.filter((persona) =>
    matchesQuery(persona.persona_name, query),
  );
  const selectedCount = selectedPredefined.length;

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        aria-labelledby="persona-selector-title"
        layout="center"
        variant="outlined"
        sx={{
          width: { xs: "95vw", sm: 600, md: 700 },
          maxHeight: "85vh",
          borderRadius: "xl",
          p: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <ModalClose sx={{ zIndex: 20 }} />

        {/* A. HEADER */}
        <Box
          sx={{
            bgcolor: "background.surface",
            borderBottom: "1px solid",
            borderColor: "divider",
            px: 3,
            pt: 2.5,
            pb: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <Box sx={{ color: "primary.500", display: "inline-flex", mt: 0.25 }}>
              <UserCircle aria-hidden="true" size={22} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, pr: 4 }}>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: "center" }}
              >
                <Typography id="persona-selector-title" level="title-lg">
                  {title}
                </Typography>
                <Tooltip
                  arrow
                  title="Personas are fictional profiles representing customer types, used to personalize messaging."
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      color: "neutral.400",
                      cursor: "help",
                      display: "inline-flex",
                    }}
                  >
                    <Info size={16} />
                  </Box>
                </Tooltip>
              </Stack>
              <Typography color="neutral" level="body-sm">
                {description}
              </Typography>
            </Box>
          </Stack>
          <Input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search personas..."
            size="sm"
            slotProps={{ input: { "aria-label": "Search personas" } }}
            startDecorator={<Search aria-hidden="true" size={16} />}
            sx={{ mt: 1.5 }}
            value={search}
            variant="outlined"
          />
        </Box>

        {/* B. BODY */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, py: 2 }}>
          <Typography level="title-sm" sx={{ ...sectionHeadingSx, mb: 1.5 }}>
            Popular Personas
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size="sm" />
            </Box>
          ) : filteredPredefined.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              }}
            >
              {filteredPredefined.map((persona) => {
                const isSelected = selectedPredefined.includes(persona.id);
                return (
                  <Card
                    key={persona.id}
                    aria-pressed={isSelected}
                    onClick={() => handlePredefinedToggle(persona.id)}
                    role="button"
                    size="sm"
                    variant="outlined"
                    sx={{ ...selectableCardSx(isSelected), minHeight: 140 }}
                  >
                    <Stack spacing={1}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <Checkbox
                          checked={isSelected}
                          readOnly
                          slotProps={{ input: { tabIndex: -1 } }}
                          sx={{ pointerEvents: "none" }}
                        />
                        <Avatar
                          size="sm"
                          variant="soft"
                          sx={{ bgcolor: "primary.softBg", fontSize: "1.25rem" }}
                        >
                          {getPersonaEmoji(persona)}
                        </Avatar>
                        <Typography
                          level="title-sm"
                          noWrap
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          {persona.persona_name}
                        </Typography>
                      </Stack>
                      <Typography
                        color="neutral"
                        level="body-xs"
                        sx={clampSx(3)}
                      >
                        {persona.persona_description}
                      </Typography>
                    </Stack>
                  </Card>
                );
              })}
            </Box>
          ) : (
            <Typography
              color="neutral"
              level="body-sm"
              sx={{ fontStyle: "italic" }}
            >
              {query
                ? `No personas match "${search}".`
                : "No personas available."}
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography level="title-sm" sx={{ ...sectionHeadingSx, mb: 1.5 }}>
            Your Custom Personas
          </Typography>
          {filteredSaved.length > 0 ? (
            <Stack spacing={1.5}>
              {filteredSaved.map((persona) => {
                const isSelected = selectedPredefined.includes(persona.id);
                return (
                  <Card
                    key={persona.id}
                    aria-pressed={isSelected}
                    onClick={() => handlePredefinedToggle(persona.id)}
                    role="button"
                    size="sm"
                    variant="outlined"
                    sx={selectableCardSx(isSelected)}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center" }}
                    >
                      <Checkbox
                        checked={isSelected}
                        readOnly
                        slotProps={{ input: { tabIndex: -1 } }}
                        sx={{ pointerEvents: "none" }}
                      />
                      <Avatar
                        size="sm"
                        variant="soft"
                        sx={{ bgcolor: "primary.softBg", fontSize: "1.25rem" }}
                      >
                        {getPersonaEmoji(persona)}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography level="title-sm">
                          {persona.persona_name}
                        </Typography>
                        {persona.persona_description && (
                          <Typography
                            color="neutral"
                            level="body-xs"
                            sx={clampSx(2)}
                          >
                            {persona.persona_description}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Typography
              color="neutral"
              level="body-sm"
              sx={{ fontStyle: "italic" }}
            >
              {savedPersonas.length === 0
                ? "No custom personas yet."
                : `No custom personas match "${search}".`}
            </Typography>
          )}

          <Box sx={{ mt: 2 }}>
            {!showCustomForm ? (
              <Button
                color="neutral"
                fullWidth
                onClick={() => setShowCustomForm(true)}
                startDecorator={<Plus aria-hidden="true" size={16} />}
                sx={{ borderStyle: "dashed" }}
                variant="outlined"
              >
                Add Your Own Persona
              </Button>
            ) : (
              <Sheet
                variant="outlined"
                sx={{ borderRadius: "md", overflow: "hidden" }}
              >
                <Stack
                  direction="row"
                  spacing={1.25}
                  sx={{
                    alignItems: "center",
                    bgcolor: "background.level1",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ color: "primary.500", display: "inline-flex" }}>
                    <UserPlus aria-hidden="true" size={18} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography level="title-sm">
                      Create Custom Persona
                    </Typography>
                    <Typography color="neutral" level="body-xs">
                      Give it a name and a short description of who they are.
                    </Typography>
                  </Box>
                </Stack>
                <Box sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <FormControl required>
                      <FormLabel>Persona Name</FormLabel>
                      <Input
                        onChange={(event) =>
                          setCustomPersona((prev) => ({
                            ...prev,
                            persona_name: event.target.value,
                          }))
                        }
                        placeholder="e.g., Succulent Sam"
                        slotProps={{ input: { maxLength: 50 } }}
                        value={customPersona.persona_name}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Description</FormLabel>
                      <Textarea
                        maxRows={6}
                        minRows={3}
                        onChange={(event) =>
                          setCustomPersona((prev) => ({
                            ...prev,
                            persona_description: event.target.value,
                          }))
                        }
                        placeholder="Describe this customer persona..."
                        slotProps={{ textarea: { maxLength: 250 } }}
                        value={customPersona.persona_description}
                      />
                      <FormHelperText sx={{ justifyContent: "flex-end" }}>
                        {customPersona.persona_description.length}/250 characters
                      </FormHelperText>
                    </FormControl>
                  </Stack>
                </Box>
                <Box
                  sx={{
                    bgcolor: "background.level1",
                    borderTop: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    gap: 1,
                    justifyContent: "flex-end",
                    px: 2,
                    py: 1.5,
                  }}
                >
                  <Button
                    color="neutral"
                    disabled={creating}
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomPersona({
                        persona_name: "",
                        persona_description: "",
                      });
                    }}
                    variant="plain"
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    disabled={!customPersona.persona_name.trim()}
                    loading={creating}
                    onClick={createCustomPersona}
                    startDecorator={<Plus aria-hidden="true" size={16} />}
                    variant="solid"
                  >
                    Create Persona
                  </Button>
                </Box>
              </Sheet>
            )}
          </Box>

          {/* FAQ */}
          <AccordionGroup
            sx={{ borderRadius: "md", mt: 2 }}
            variant="soft"
          >
            <Accordion>
              <AccordionSummary>
                What's the difference between personas and segments?
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5} sx={{ pt: 1 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.5,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    }}
                  >
                    <Sheet
                      color="primary"
                      variant="soft"
                      sx={{ borderRadius: "md", p: 1.5 }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", mb: 1 }}
                      >
                        <Box sx={{ color: "primary.500", display: "inline-flex" }}>
                          <Users aria-hidden="true" size={16} />
                        </Box>
                        <Typography level="title-sm">Personas</Typography>
                      </Stack>
                      <Typography level="body-xs" sx={{ mb: 1 }}>
                        Fictional profiles representing customer types
                      </Typography>
                      <Stack spacing={0.5}>
                        <Typography level="body-xs">
                          • <strong>Purpose:</strong> Personalize messaging
                        </Typography>
                        <Typography level="body-xs">
                          • <strong>Example:</strong> "DIY Dana" - loves hands-on
                          projects
                        </Typography>
                        <Typography level="body-xs">
                          • <strong>Used for:</strong> Content tone, product
                          suggestions
                        </Typography>
                      </Stack>
                    </Sheet>
                    <Sheet
                      color="success"
                      variant="soft"
                      sx={{ borderRadius: "md", p: 1.5 }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", mb: 1 }}
                      >
                        <Box sx={{ color: "success.500", display: "inline-flex" }}>
                          <Target aria-hidden="true" size={16} />
                        </Box>
                        <Typography level="title-sm">Segments</Typography>
                      </Stack>
                      <Typography level="body-xs" sx={{ mb: 1 }}>
                        Real groups of customers with shared traits
                      </Typography>
                      <Stack spacing={0.5}>
                        <Typography level="body-xs">
                          • <strong>Purpose:</strong> Target specific audiences
                        </Typography>
                        <Typography level="body-xs">
                          • <strong>Example:</strong> "Loyalty Members" - 847
                          customers
                        </Typography>
                        <Typography level="body-xs">
                          • <strong>Used for:</strong> Campaign targeting,
                          analytics
                        </Typography>
                      </Stack>
                    </Sheet>
                  </Box>
                  <Sheet
                    variant="soft"
                    sx={{ borderRadius: "md", p: 1.5 }}
                  >
                    <Typography color="neutral" level="body-xs">
                      <strong>Pro tip:</strong> Use personas to craft the right
                      message, then use segments to send it to the right people.
                    </Typography>
                  </Sheet>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </AccordionGroup>
        </Box>

        {/* C. FOOTER */}
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "background.surface",
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            gap: 2,
            px: 3,
            py: 2,
          }}
        >
          <Typography
            color={selectedCount > 0 ? "primary" : "neutral"}
            level="body-sm"
            startDecorator={
              selectedCount > 0 ? <Check aria-hidden="true" size={16} /> : null
            }
          >
            {selectedCount > 0
              ? `${selectedCount} persona${selectedCount === 1 ? "" : "s"} selected`
              : "No personas selected yet"}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
            <Button color="neutral" onClick={handleClose} variant="plain">
              Cancel
            </Button>
            <Button
              color="primary"
              disabled={loading}
              onClick={handleConfirm}
              variant="solid"
            >
              Save Selection
            </Button>
          </Stack>
        </Box>
      </ModalDialog>
    </Modal>
  );
};
