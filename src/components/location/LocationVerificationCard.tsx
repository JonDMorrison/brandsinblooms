import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import FormHelperText from "@mui/joy/FormHelperText";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";

interface LocationCandidate {
  postal_code: string;
  city?: string;
  state_province?: string;
  country?: "US" | "CA";
  source?: string;
  snippet?: string;
}

interface RedetectResult {
  success: boolean;
  hasNewCandidates: boolean;
  newCandidates?: LocationCandidate[];
  currentPostalCode?: string;
}

const EMPTY_CANDIDATES: LocationCandidate[] = [];

interface LocationVerificationCardProps {
  isLoading?: boolean;
  // Current detected data
  postalCode?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: "US" | "CA" | null;
  source?: "jsonld" | "footer" | "contact" | "regex" | "manual" | "none" | null;
  confidence?: "high" | "medium" | "low" | null;
  snippet?: string | null;
  candidates?: LocationCandidate[];
  needsConfirmation?: boolean;

  // Callbacks
  onConfirm: (data: {
    postalCode: string;
    city?: string;
    stateProvince?: string;
    country?: "US" | "CA";
  }) => Promise<void>;
  onRedetect?: () => Promise<RedetectResult>;
  onConfirmationChange?: (confirmed: boolean) => void; // Notify parent of confirmation state

  // State
  isRedetecting?: boolean;
  isSaving?: boolean;

  // Display options
  compact?: boolean;
}

// Validation patterns
const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_PATTERN =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

const validatePostalCode = (
  value: string,
  country: "US" | "CA",
): { valid: boolean; normalized?: string } => {
  const trimmed = value.trim();

  if (country === "US") {
    if (US_ZIP_PATTERN.test(trimmed)) {
      return { valid: true, normalized: trimmed };
    }
    return { valid: false };
  }

  // CA
  if (CA_POSTAL_PATTERN.test(trimmed)) {
    const cleaned = trimmed.replace(/\s/g, "").toUpperCase();
    const normalized = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return { valid: true, normalized };
  }
  return { valid: false };
};

const COUNTRY_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
];

const POSTAL_PLACEHOLDER_BY_COUNTRY: Record<"US" | "CA", string> = {
  US: "97215",
  CA: "V6B 1A1",
};

const getConfidenceChip = (
  confidence: "high" | "medium" | "low" | null | undefined,
) => {
  switch (confidence) {
    case "high":
      return (
        <Chip color="success" size="sm" variant="soft">
          High Confidence
        </Chip>
      );
    case "medium":
      return (
        <Chip color="warning" size="sm" variant="soft">
          Medium Confidence
        </Chip>
      );
    case "low":
      return (
        <Chip color="danger" size="sm" variant="soft">
          Low Confidence
        </Chip>
      );
    default:
      return (
        <Chip color="neutral" size="sm" variant="soft">
          Unknown
        </Chip>
      );
  }
};

const getSourceLabel = (source: string | null | undefined) => {
  switch (source) {
    case "jsonld":
      return "Schema.org structured data";
    case "footer":
      return "Website footer";
    case "contact":
      return "Contact page";
    case "regex":
      return "Text pattern matching";
    case "manual":
      return "Manually confirmed";
    case "none":
      return "Not detected";
    default:
      return "Unknown source";
  }
};

const formatLocationLabel = (location: {
  postalCode?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: "US" | "CA" | null;
}) => {
  return [
    location.postalCode,
    [location.city, location.stateProvince].filter(Boolean).join(", "),
    location.country,
  ]
    .filter(Boolean)
    .join(" • ");
};

function LocationVerificationSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        p: compact ? 2.5 : { xs: 3, md: 3.5 },
        borderRadius: "xl",
        bgcolor: "background.surface",
      }}
    >
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
        >
          <Stack spacing={1}>
            <Skeleton
              animation="wave"
              sx={{ width: 160, height: 18 }}
              variant="text"
            />
            <Skeleton
              animation="wave"
              sx={{ width: 260, height: 14 }}
              variant="text"
            />
          </Stack>
          <Skeleton
            animation="wave"
            sx={{ width: 112, height: 34, borderRadius: "lg" }}
            variant="rectangular"
          />
        </Stack>

        <Sheet variant="soft" sx={{ p: 2.25, borderRadius: "lg" }}>
          <Stack spacing={1}>
            <Skeleton
              animation="wave"
              sx={{ width: 220, height: 18 }}
              variant="text"
            />
            <Skeleton
              animation="wave"
              sx={{ width: 180, height: 14 }}
              variant="text"
            />
          </Stack>
        </Sheet>

        <Stack spacing={1.25}>
          {Array.from({ length: 2 }).map((_, index) => (
            <Sheet key={index} variant="soft" sx={{ p: 2, borderRadius: "lg" }}>
              <Stack spacing={0.75}>
                <Skeleton
                  animation="wave"
                  sx={{ width: 200, height: 16 }}
                  variant="text"
                />
                <Skeleton
                  animation="wave"
                  sx={{ width: 120, height: 12 }}
                  variant="text"
                />
              </Stack>
            </Sheet>
          ))}
        </Stack>

        <Divider />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 1.5,
          }}
        >
          <Skeleton
            animation="wave"
            sx={{ width: "100%", height: 56, borderRadius: "lg" }}
            variant="rectangular"
          />
          <Skeleton
            animation="wave"
            sx={{ width: "100%", height: 56, borderRadius: "lg" }}
            variant="rectangular"
          />
          <Skeleton
            animation="wave"
            sx={{ width: "100%", height: 56, borderRadius: "lg" }}
            variant="rectangular"
          />
          <Skeleton
            animation="wave"
            sx={{ width: "100%", height: 56, borderRadius: "lg" }}
            variant="rectangular"
          />
        </Box>
      </Stack>
    </Sheet>
  );
}

export const LocationVerificationCard: React.FC<
  LocationVerificationCardProps
> = ({
  isLoading = false,
  postalCode,
  city,
  stateProvince,
  country,
  source,
  confidence,
  snippet,
  candidates = EMPTY_CANDIDATES,
  needsConfirmation = false,
  onConfirm,
  onRedetect,
  onConfirmationChange,
  isRedetecting = false,
  isSaving = false,
  compact = false,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    null,
  );
  const [showManualFields, setShowManualFields] = useState(false);
  const [formData, setFormData] = useState({
    postalCode: postalCode || "",
    city: city || "",
    stateProvince: stateProvince || "",
    country: country || (undefined as "US" | "CA" | undefined),
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [pendingCandidates, setPendingCandidates] = useState<
    LocationCandidate[]
  >([]);
  const latestOnConfirmationChange = useRef(onConfirmationChange);

  latestOnConfirmationChange.current = onConfirmationChange;

  const hasDetectedLocation = postalCode || city || stateProvince;
  const candidateSignature = useMemo(
    () =>
      candidates
        .map((candidate) =>
          [
            candidate.postal_code,
            candidate.city ?? "",
            candidate.state_province ?? "",
            candidate.country ?? "",
            candidate.source ?? "",
            candidate.snippet ?? "",
          ].join("|"),
        )
        .join("||"),
    [candidates],
  );
  const availableCandidates = useMemo(
    () => (pendingCandidates.length > 0 ? pendingCandidates : candidates),
    [candidates, pendingCandidates],
  );
  const showWarning =
    needsConfirmation ||
    confidence === "low" ||
    !postalCode ||
    pendingCandidates.length > 0;
  const isManuallyConfirmed = source === "manual" && confidence === "high";
  const shouldShowEmptyState =
    !isLoading &&
    !hasDetectedLocation &&
    availableCandidates.length === 0 &&
    !showManualFields;

  // Calculate and notify parent of confirmation status
  const isConfirmed = Boolean(postalCode) && !needsConfirmation;

  // Notify parent when confirmation status changes
  useEffect(() => {
    latestOnConfirmationChange.current?.(isConfirmed);
  }, [isConfirmed]);

  useEffect(() => {
    const nextFormData = {
      postalCode: postalCode || "",
      city: city || "",
      stateProvince: stateProvince || "",
      country: country || undefined,
    };

    setFormData((prev) =>
      prev.postalCode === nextFormData.postalCode &&
      prev.city === nextFormData.city &&
      prev.stateProvince === nextFormData.stateProvince &&
      prev.country === nextFormData.country
        ? prev
        : nextFormData,
    );
    setSelectedCandidate((prev) => (prev === null ? prev : null));
    setValidationError((prev) => (prev === null ? prev : null));

    if (
      postalCode ||
      city ||
      stateProvince ||
      needsConfirmation ||
      candidates.length > 0
    ) {
      setShowManualFields((prev) => (prev ? false : prev));
    }
  }, [
    postalCode,
    city,
    stateProvince,
    country,
    needsConfirmation,
    candidateSignature,
    candidates.length,
  ]);

  if (isLoading) {
    return <LocationVerificationSkeleton compact={compact} />;
  }

  const handleRedetectClick = async () => {
    if (!onRedetect) return;

    const result = await onRedetect();

    // If manually confirmed and new candidates found, show change dialog
    if (
      result.success &&
      result.hasNewCandidates &&
      result.newCandidates &&
      result.newCandidates.length > 0
    ) {
      // Check if any candidates differ from current postal code
      const hasDifferentCandidates = result.newCandidates.some(
        (c) => c.postal_code !== postalCode,
      );

      if (hasDifferentCandidates) {
        setPendingCandidates(result.newCandidates);
        setShowChangeDialog(true);
      }
    }
  };

  const handleKeepCurrent = () => {
    setShowChangeDialog(false);
    setPendingCandidates([]);
  };

  const handleChangeLocation = () => {
    // Show the candidates in the main UI for selection
    setShowChangeDialog(false);
    setShowManualFields(true);
    const nextCandidate = pendingCandidates[0];

    if (nextCandidate) {
      setSelectedCandidate(nextCandidate.postal_code);
      setFormData({
        postalCode: nextCandidate.postal_code,
        city: nextCandidate.city || "",
        stateProvince: nextCandidate.state_province || "",
        country: nextCandidate.country || undefined,
      });
      setValidationError(null);
      return;
    }

    setSelectedCandidate("manual");
  };

  const handlePostalCodeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, postalCode: value }));
    setValidationError(null);

    const activeCountry: "US" | "CA" = formData.country ?? "US";
    if (value.length >= 5) {
      const validation = validatePostalCode(value, activeCountry);
      if (!validation.valid) {
        setValidationError(
          activeCountry === "US"
            ? "Doesn't look like a US ZIP (12345 or 12345-6789). Confirm the country or fix the format."
            : "Doesn't look like a Canadian postal code (A1A 1A1). Confirm the country or fix the format.",
        );
      }
    }
  };

  const handleCountryChange = (nextCountry: "US" | "CA") => {
    setFormData((prev) => ({ ...prev, country: nextCountry }));
    // Re-validate any existing postal against the new country and surface
    // a soft warning if the format no longer matches.
    if (formData.postalCode.trim().length >= 5) {
      const validation = validatePostalCode(formData.postalCode, nextCountry);
      if (!validation.valid) {
        setValidationError(
          nextCountry === "US"
            ? "Doesn't look like a US ZIP (12345 or 12345-6789). Confirm the country or fix the format."
            : "Doesn't look like a Canadian postal code (A1A 1A1). Confirm the country or fix the format.",
        );
      } else {
        setValidationError(null);
        setFormData((prev) => ({
          ...prev,
          postalCode: validation.normalized ?? prev.postalCode,
          country: nextCountry,
        }));
      }
    } else {
      setValidationError(null);
    }
  };

  const handleCandidateSelect = (candidate: LocationCandidate) => {
    setSelectedCandidate(candidate.postal_code);
    setShowManualFields(true);
    setFormData({
      postalCode: candidate.postal_code,
      city: candidate.city || "",
      stateProvince: candidate.state_province || "",
      country: candidate.country || undefined,
    });
    setValidationError(null);
  };

  const handleManualEntry = () => {
    setSelectedCandidate("manual");
    setShowManualFields(true);
    setValidationError(null);

    if (!hasDetectedLocation) {
      setFormData({
        postalCode: "",
        city: "",
        stateProvince: "",
        country: undefined,
      });
    }
  };

  const handleConfirm = async () => {
    const country: "US" | "CA" = formData.country ?? "US";
    const validation = validatePostalCode(formData.postalCode, country);
    // Soft warning only — country comes from the picker (user-driven), so
    // we no longer block submit on a postal format mismatch. We do still
    // normalize when the format matches the selected country.
    if (!validation.valid) {
      setValidationError(
        country === "US"
          ? "Doesn't look like a US ZIP (12345 or 12345-6789). Confirm the country or fix the format."
          : "Doesn't look like a Canadian postal code (A1A 1A1). Confirm the country or fix the format.",
      );
    }

    await onConfirm({
      postalCode: validation.normalized ?? formData.postalCode,
      city: formData.city || undefined,
      stateProvince: formData.stateProvince || undefined,
      country,
    });
  };

  if (shouldShowEmptyState) {
    return (
      <Sheet
        variant="outlined"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: "xl",
          bgcolor: "background.surface",
        }}
      >
        <JoyEmptyState
          icon={<MapPin />}
          title="Add your postal code"
          description="Confirm a postal or ZIP code so local recommendations, climate guidance, and nearby growing context can be tailored correctly."
          primaryAction={{
            label: "Enter Manually",
            onClick: handleManualEntry,
            variant: "solid",
          }}
          secondaryAction={
            onRedetect
              ? {
                  label: "Detect From Website",
                  loading: isRedetecting,
                  loadingPosition: "start",
                  onClick: handleRedetectClick,
                  startDecorator: !isRedetecting ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : undefined,
                  variant: "plain",
                  color: "neutral",
                }
              : undefined
          }
        />
      </Sheet>
    );
  }

  if (isConfirmed && !showWarning) {
    return (
      <>
        <Sheet
          variant="outlined"
          sx={{
            p: compact ? 2.5 : { xs: 3, md: 3.5 },
            borderRadius: "xl",
            bgcolor: "background.surface",
          }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={2}
            >
              <Stack spacing={0.5}>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  alignItems="center"
                >
                  <Typography level="title-lg">Detected Location</Typography>
                  <Chip color="success" size="sm" variant="soft">
                    Verified
                  </Chip>
                </Stack>
                <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                  Source: {getSourceLabel(source)}
                  {confidence ? ` • ${confidence} confidence` : ""}
                </Typography>
              </Stack>

              {onRedetect ? (
                <JoyButton
                  color="neutral"
                  loading={isRedetecting}
                  loadingPosition="start"
                  onClick={handleRedetectClick}
                  startDecorator={
                    !isRedetecting ? (
                      <RefreshCw className="h-4 w-4" />
                    ) : undefined
                  }
                  variant="plain"
                >
                  Re-detect from website
                </JoyButton>
              ) : null}
            </Stack>

            <Sheet variant="soft" sx={{ p: 2.25, borderRadius: "lg" }}>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MapPin className="h-4 w-4" />
                  <Typography level="title-md">
                    {formatLocationLabel({
                      postalCode,
                      city,
                      stateProvince,
                      country,
                    })}
                  </Typography>
                </Stack>
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  {isManuallyConfirmed
                    ? "This location has been manually confirmed and will stay in place unless you choose a new one."
                    : "This location is confirmed and ready to drive local recommendations."}
                </Typography>
              </Stack>
            </Sheet>

            {snippet ? (
              <AccordionGroup
                variant="plain"
                sx={{ "--AccordionGroup-gap": "0.5rem" }}
              >
                <Accordion>
                  <AccordionSummary>
                    <Typography level="body-sm" fontWeight="md">
                      Detection snippet
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Sheet
                      variant="soft"
                      sx={{
                        p: 2,
                        borderRadius: "lg",
                        bgcolor: "background.surface",
                      }}
                    >
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.600",
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                        }}
                      >
                        {snippet}
                      </Typography>
                    </Sheet>
                  </AccordionDetails>
                </Accordion>
              </AccordionGroup>
            ) : null}
          </Stack>
        </Sheet>

        <JoyAlertDialog
          cancelLabel="Keep Current"
          confirmLabel="Change Location"
          onClose={() => setShowChangeDialog(false)}
          onConfirm={handleChangeLocation}
          open={showChangeDialog}
          title="New locations detected"
          variant="warning"
        >
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            We found location candidates that differ from your confirmed postal
            code {postalCode}.
          </Typography>
          <Stack spacing={1}>
            {pendingCandidates.map((candidate) => (
              <Sheet
                key={`${candidate.postal_code}-${candidate.city ?? ""}`}
                variant="soft"
                sx={{ p: 1.5, borderRadius: "lg" }}
              >
                <Typography level="body-sm" fontWeight="md">
                  {formatLocationLabel({
                    postalCode: candidate.postal_code,
                    city: candidate.city,
                    stateProvince: candidate.state_province,
                    country: candidate.country,
                  })}
                </Typography>
              </Sheet>
            ))}
          </Stack>
        </JoyAlertDialog>
      </>
    );
  }

  return (
    <>
      <Sheet
        variant="outlined"
        sx={{
          p: compact ? 2.5 : { xs: 3, md: 3.5 },
          borderRadius: "xl",
          bgcolor: "background.surface",
        }}
      >
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
          >
            <Stack spacing={0.75}>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                alignItems="center"
              >
                <Typography level="title-lg">Detected Location</Typography>
                <Chip color="warning" size="sm" variant="soft">
                  {postalCode ? "Needs Review" : "Missing Postal Code"}
                </Chip>
                {confidence ? getConfidenceChip(confidence) : null}
              </Stack>

              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                {!postalCode
                  ? "We still need a postal or ZIP code before local recommendations can be trusted."
                  : availableCandidates.length > 1
                    ? "We found multiple possible matches. Choose the right location or correct it manually."
                    : "Review the detected location and confirm or correct it before climate guidance is generated."}
              </Typography>
            </Stack>

            {onRedetect ? (
              <JoyButton
                color="neutral"
                loading={isRedetecting}
                loadingPosition="start"
                onClick={handleRedetectClick}
                startDecorator={
                  !isRedetecting ? <RefreshCw className="h-4 w-4" /> : undefined
                }
                variant="plain"
              >
                Re-detect from website
              </JoyButton>
            ) : null}
          </Stack>

          {hasDetectedLocation ? (
            <Sheet variant="soft" sx={{ p: 2.25, borderRadius: "lg" }}>
              <Stack spacing={0.75}>
                <Typography
                  level="body-xs"
                  sx={{
                    color: "neutral.500",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Current Detection
                </Typography>
                <Typography level="title-sm">
                  {formatLocationLabel({
                    postalCode,
                    city,
                    stateProvince,
                    country,
                  })}
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  Source: {getSourceLabel(source)}
                </Typography>
              </Stack>
            </Sheet>
          ) : null}

          {snippet ? (
            <AccordionGroup
              variant="plain"
              sx={{ "--AccordionGroup-gap": "0.5rem" }}
            >
              <Accordion>
                <AccordionSummary>
                  <Typography level="body-sm" fontWeight="md">
                    Why this location was detected
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Sheet
                    variant="soft"
                    sx={{
                      p: 2,
                      borderRadius: "lg",
                      bgcolor: "background.surface",
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Info className="h-4 w-4" />
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          Source evidence
                        </Typography>
                      </Stack>
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.600",
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                        }}
                      >
                        {snippet}
                      </Typography>
                    </Stack>
                  </Sheet>
                </AccordionDetails>
              </Accordion>
            </AccordionGroup>
          ) : null}

          {availableCandidates.length > 0 ? (
            <Stack spacing={1.25}>
              <Typography level="title-sm">Possible Matches</Typography>
              <Stack spacing={1}>
                {availableCandidates.map((candidate) => {
                  const candidateKey = `${candidate.postal_code}-${candidate.city ?? ""}-${candidate.state_province ?? ""}`;
                  const isSelected =
                    selectedCandidate === candidate.postal_code;

                  return (
                    <Sheet
                      key={candidateKey}
                      component="button"
                      onClick={() => handleCandidateSelect(candidate)}
                      sx={{
                        p: 2,
                        borderRadius: "lg",
                        border: "1px solid",
                        borderColor: isSelected ? "primary.400" : "neutral.200",
                        bgcolor: isSelected
                          ? "rgba(var(--joy-palette-primary-mainChannel) / 0.08)"
                          : "background.surface",
                        textAlign: "left",
                        cursor: "pointer",
                        transition:
                          "border-color 0.2s ease, background-color 0.2s ease, transform 0.2s ease",
                        "&:hover": {
                          borderColor: isSelected
                            ? "primary.400"
                            : "neutral.300",
                          transform: "translateY(-1px)",
                        },
                      }}
                      type="button"
                    >
                      <Stack spacing={0.5}>
                        <Typography level="title-sm">
                          {formatLocationLabel({
                            postalCode: candidate.postal_code,
                            city: candidate.city,
                            stateProvince: candidate.state_province,
                            country: candidate.country,
                          })}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          {candidate.source
                            ? getSourceLabel(candidate.source)
                            : "Candidate match"}
                        </Typography>
                        {candidate.snippet ? (
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.600" }}
                          >
                            {candidate.snippet}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Sheet>
                  );
                })}
              </Stack>
            </Stack>
          ) : null}

          <Divider />

          <Stack spacing={1.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
            >
              <Typography level="title-sm">Confirm or Correct</Typography>
              {!showManualFields ? (
                <JoyButton
                  color="neutral"
                  onClick={handleManualEntry}
                  variant="plain"
                >
                  Enter manually
                </JoyButton>
              ) : null}
            </Stack>

            {showManualFields ||
            hasDetectedLocation ||
            availableCandidates.length > 0 ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                  gap: 1.5,
                }}
              >
                <Box>
                  <JoyInput
                    helperText={validationError ?? "Required"}
                    label="Postal / ZIP Code"
                    placeholder={
                      POSTAL_PLACEHOLDER_BY_COUNTRY[formData.country ?? "US"]
                    }
                    value={formData.postalCode}
                    onValueChange={handlePostalCodeChange}
                  />
                  {validationError ? (
                    <FormHelperText sx={{ color: "warning.600" }}>
                      {validationError}
                    </FormHelperText>
                  ) : null}
                </Box>

                <JoyInput
                  label="City"
                  placeholder="Portland"
                  value={formData.city}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, city: value }))
                  }
                />

                <JoyInput
                  label="State / Province"
                  placeholder="Oregon or BC"
                  value={formData.stateProvince}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, stateProvince: value }))
                  }
                />

                <JoySelect
                  label="Country"
                  value={formData.country ?? "US"}
                  options={COUNTRY_OPTIONS}
                  onValueChange={(value) =>
                    handleCountryChange(value as "US" | "CA")
                  }
                />
              </Box>
            ) : null}
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap>
            <JoyButton
              disabled={!formData.postalCode || isSaving}
              loading={isSaving}
              loadingPosition="start"
              onClick={handleConfirm}
              startDecorator={
                !isSaving ? <CheckCircle2 className="h-4 w-4" /> : undefined
              }
              variant="solid"
            >
              Confirm Location
            </JoyButton>
            {onRedetect ? (
              <JoyButton
                color="neutral"
                loading={isRedetecting}
                loadingPosition="start"
                onClick={handleRedetectClick}
                startDecorator={
                  !isRedetecting ? <RefreshCw className="h-4 w-4" /> : undefined
                }
                variant="plain"
              >
                Re-detect from website
              </JoyButton>
            ) : null}
          </Stack>
        </Stack>
      </Sheet>

      <JoyAlertDialog
        cancelLabel="Keep Current"
        confirmLabel="Change Location"
        onClose={() => setShowChangeDialog(false)}
        onConfirm={handleChangeLocation}
        open={showChangeDialog}
        title="New locations detected"
        variant="warning"
      >
        <Typography level="body-sm" sx={{ color: "neutral.600" }}>
          We found location candidates that differ from your confirmed postal
          code {postalCode}.
        </Typography>
        <Stack spacing={1}>
          {pendingCandidates.map((candidate) => (
            <Sheet
              key={`${candidate.postal_code}-${candidate.city ?? ""}`}
              variant="soft"
              sx={{ p: 1.5, borderRadius: "lg" }}
            >
              <Typography level="body-sm" fontWeight="md">
                {formatLocationLabel({
                  postalCode: candidate.postal_code,
                  city: candidate.city,
                  stateProvince: candidate.state_province,
                  country: candidate.country,
                })}
              </Typography>
            </Sheet>
          ))}
        </Stack>
      </JoyAlertDialog>
    </>
  );
};
