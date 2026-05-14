import { CheckCircle, ArrowLeft, AlertTriangle, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthButton, AuthInput } from "@/components/auth";
import { JoySelect } from "@/components/joy/JoySelect";
import { WebsiteAnalysisLoader } from "./WebsiteAnalysisLoader";

interface LocationCandidate {
  postal_code: string;
  city?: string;
  state_province?: string;
  country?: "US" | "CA";
}

interface LocationExtraction {
  postal_code: string | null;
  city: string | null;
  state_province: string | null;
  country: "US" | "CA" | null;
  source: string;
  confidence: "high" | "medium" | "low";
  snippet: string | null;
  candidates: LocationCandidate[];
  requires_confirmation: boolean;
}

export interface ConfirmedLocation {
  postal_code: string;
  city: string;
  state_province: string;
  country: "US" | "CA";
}

interface ExtractedData {
  businessName: string;
  aboutBusiness: string;
  brandVoice: string;
  annualEvents: string;
  location: string;
  services: string;
  locationExtraction?: LocationExtraction;
}

interface DataReviewStepProps {
  extractedData: ExtractedData;
  updateExtractedData: (field: keyof ExtractedData, value: string) => void;
  onBack: () => void;
  onComplete: (confirmedLocation: ConfirmedLocation) => void;
  isCompleting: boolean;
  isAnalyzing: boolean;
}

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

const postalMismatchMessage = (country: "US" | "CA"): string =>
  country === "US"
    ? "Doesn't look like a US ZIP (12345 or 12345-6789). Confirm the country or fix the format."
    : "Doesn't look like a Canadian postal code (A1A 1A1). Confirm the country or fix the format.";

const MANUAL_OPTION = "manual";

interface LocationForm {
  postalCode: string;
  city: string;
  stateProvince: string;
  country: "US" | "CA" | "";
}

const emptyLocationForm: LocationForm = {
  postalCode: "",
  city: "",
  stateProvince: "",
  country: "",
};

const formFromExtraction = (extraction?: LocationExtraction): LocationForm => ({
  postalCode: extraction?.postal_code ?? "",
  city: extraction?.city ?? "",
  stateProvince: extraction?.state_province ?? "",
  country: extraction?.country ?? "",
});

const hasAllLocationFields = (form: LocationForm): boolean =>
  Boolean(
    form.postalCode.trim() &&
      form.city.trim() &&
      form.stateProvince.trim() &&
      form.country,
  );

export const DataReviewStep = ({
  extractedData,
  updateExtractedData,
  onBack,
  onComplete,
  isCompleting,
  isAnalyzing,
}: DataReviewStepProps) => {
  const locationExtraction = extractedData.locationExtraction;
  const hasExtraction = Boolean(locationExtraction);
  const candidates = locationExtraction?.candidates ?? [];
  const hasMultipleCandidates = candidates.length > 1;

  const [locationForm, setLocationForm] = useState<LocationForm>(() =>
    formFromExtraction(locationExtraction),
  );
  const [selectedCandidate, setSelectedCandidate] = useState<string>(
    locationExtraction?.postal_code || MANUAL_OPTION,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [postalWarning, setPostalWarning] = useState<string | null>(null);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState<boolean>(
    () => {
      if (!locationExtraction) return false;
      const autoConfirmed =
        !locationExtraction.requires_confirmation &&
        locationExtraction.confidence !== "low" &&
        Boolean(locationExtraction.postal_code) &&
        candidates.length <= 1;
      return autoConfirmed;
    },
  );

  // Resync form when a new extraction arrives (e.g., re-analyze).
  useEffect(() => {
    if (!locationExtraction) {
      setLocationForm(emptyLocationForm);
      setSelectedCandidate(MANUAL_OPTION);
      setIsLocationConfirmed(false);
      setValidationError(null);
      setPostalWarning(null);
      return;
    }
    setLocationForm(formFromExtraction(locationExtraction));
    setSelectedCandidate(locationExtraction.postal_code || MANUAL_OPTION);
    const autoConfirmed =
      !locationExtraction.requires_confirmation &&
      locationExtraction.confidence !== "low" &&
      Boolean(locationExtraction.postal_code) &&
      (locationExtraction.candidates?.length ?? 0) <= 1;
    setIsLocationConfirmed(autoConfirmed);
    setValidationError(null);
    setPostalWarning(null);
  }, [locationExtraction]);

  // Clear "Please fill in..." the moment all four fields are filled,
  // so the disabled Complete button unlatches as soon as the user can act.
  useEffect(() => {
    if (validationError && hasAllLocationFields(locationForm)) {
      setValidationError(null);
    }
  }, [locationForm, validationError]);

  const markUnconfirmed = useCallback(() => {
    setIsLocationConfirmed(false);
  }, []);

  const handlePostalCodeChange = (value: string) => {
    setLocationForm((prev) => ({ ...prev, postalCode: value }));
    markUnconfirmed();
    const trimmed = value.trim();
    if (locationForm.country && trimmed.length >= 5) {
      const validation = validatePostalCode(
        trimmed,
        locationForm.country as "US" | "CA",
      );
      if (!validation.valid) {
        setPostalWarning(
          postalMismatchMessage(locationForm.country as "US" | "CA"),
        );
      } else {
        setPostalWarning(null);
      }
    } else {
      setPostalWarning(null);
    }
  };

  const handleCountryChange = (nextCountry: "US" | "CA") => {
    const trimmed = locationForm.postalCode.trim();
    if (trimmed.length >= 5) {
      const validation = validatePostalCode(trimmed, nextCountry);
      if (validation.valid) {
        setPostalWarning(null);
        setLocationForm((prev) => ({
          ...prev,
          country: nextCountry,
          postalCode: validation.normalized ?? prev.postalCode,
        }));
      } else {
        setPostalWarning(postalMismatchMessage(nextCountry));
        setLocationForm((prev) => ({ ...prev, country: nextCountry }));
      }
    } else {
      setPostalWarning(null);
      setLocationForm((prev) => ({ ...prev, country: nextCountry }));
    }
    markUnconfirmed();
  };

  const handleCandidateSelect = (postalCode: string) => {
    setSelectedCandidate(postalCode);
    markUnconfirmed();
    setPostalWarning(null);
    if (postalCode === MANUAL_OPTION) {
      setLocationForm(emptyLocationForm);
      return;
    }
    const candidate = candidates.find((c) => c.postal_code === postalCode);
    if (candidate) {
      setLocationForm({
        postalCode: candidate.postal_code,
        city: candidate.city ?? "",
        stateProvince: candidate.state_province ?? "",
        country: candidate.country ?? "",
      });
    }
  };

  const handleConfirmLocation = () => {
    if (!hasAllLocationFields(locationForm)) {
      setValidationError(
        "Please fill in postal/ZIP, city, state/province, and country.",
      );
      setIsLocationConfirmed(false);
      return;
    }
    // hasAllLocationFields guarantees country is non-empty.
    const country = locationForm.country as "US" | "CA";
    const validation = validatePostalCode(locationForm.postalCode, country);
    if (validation.valid) {
      setPostalWarning(null);
      setLocationForm((prev) => ({
        ...prev,
        postalCode: validation.normalized ?? prev.postalCode,
      }));
    } else {
      // Soft warning: surface the mismatch but still confirm.
      // Country is user-driven from the picker.
      setPostalWarning(postalMismatchMessage(country));
    }
    setValidationError(null);
    setIsLocationConfirmed(true);
  };

  const handleComplete = () => {
    if (!hasAllLocationFields(locationForm)) {
      setValidationError(
        "Please fill in postal/ZIP, city, state/province, and country.",
      );
      return;
    }
    const country = locationForm.country as "US" | "CA";
    const validation = validatePostalCode(locationForm.postalCode, country);
    const normalizedPostal = validation.normalized ?? locationForm.postalCode;

    if (!isLocationConfirmed) {
      if (!validation.valid) {
        // Soft mismatch — surface warning but auto-confirm and complete.
        setPostalWarning(postalMismatchMessage(country));
      } else {
        setPostalWarning(null);
      }
      setLocationForm((prev) => ({ ...prev, postalCode: normalizedPostal }));
      setIsLocationConfirmed(true);
    }

    onComplete({
      postal_code: normalizedPostal,
      city: locationForm.city,
      state_province: locationForm.stateProvince,
      country,
    });
  };

  const showLocationWarning = useMemo(() => {
    if (isLocationConfirmed) return false;
    if (!hasAllLocationFields(locationForm)) return true;
    if (locationExtraction?.requires_confirmation) return true;
    if (locationExtraction?.confidence === "low") return true;
    return false;
  }, [isLocationConfirmed, locationForm, locationExtraction]);

  const isCompleteDisabled =
    isCompleting ||
    !hasAllLocationFields(locationForm) ||
    Boolean(validationError);

  if (isAnalyzing) {
    return <WebsiteAnalysisLoader isAnalyzing={isAnalyzing} />;
  }

  return (
    <div className="auth-onboarding-step auth-onboarding-step--review">
      <div className="auth-onboarding-step__header">
        <div className="auth-icon-bubble auth-icon-bubble--large">
          <CheckCircle aria-hidden="true" />
        </div>
        <h1>Review your store profile</h1>
        <p>
          We've pre-filled this from your website. Review and adjust anything.
        </p>
      </div>

      <div className="auth-onboarding-form auth-onboarding-form--review">
        <AuthInput
          id="business-name"
          label="Business Name"
          value={extractedData.businessName}
          onChange={(e) => updateExtractedData("businessName", e.target.value)}
          placeholder="Your Garden Center Name"
        />

        <AuthInput
          id="about-business"
          label="About Your Business"
          value={extractedData.aboutBusiness}
          onChange={(e) => updateExtractedData("aboutBusiness", e.target.value)}
          placeholder="Tell us about your garden center..."
          multiline
          rows={4}
        />

        <AuthInput
          id="brand-voice"
          label="Brand Voice"
          value={extractedData.brandVoice}
          onChange={(e) => updateExtractedData("brandVoice", e.target.value)}
          placeholder="How do you communicate with customers?"
          multiline
          rows={3}
        />

        <AuthInput
          id="annual-events"
          label="Annual Events"
          value={extractedData.annualEvents}
          onChange={(e) => updateExtractedData("annualEvents", e.target.value)}
          placeholder="Spring sales, holiday events, workshops..."
          multiline
          rows={2}
        />
      </div>

      <section
        className="auth-onboarding-location"
        aria-labelledby="primary-location-title"
      >
        <div className="auth-onboarding-location__header">
          <div>
            <span className="auth-onboarding-eyebrow">Location</span>
            <h2 id="primary-location-title">
              <MapPin aria-hidden="true" />
              {hasExtraction ? "Detected Location" : "Primary Location"}
            </h2>
          </div>
          {hasExtraction ? (
            <span
              className={`auth-confidence-pill auth-confidence-pill--${locationExtraction!.confidence}`}
            >
              {locationExtraction!.confidence} confidence
            </span>
          ) : null}
        </div>

        {showLocationWarning ? (
          <div className="auth-onboarding-note auth-onboarding-note--warning">
            <AlertTriangle aria-hidden="true" />
            <span>
              {hasExtraction && !locationExtraction!.postal_code
                ? "We couldn't detect your postal/ZIP code. Please enter it below."
                : hasExtraction && hasMultipleCandidates
                  ? "We found multiple locations. Please select the correct one or enter manually."
                  : hasExtraction
                    ? "Please confirm your location."
                    : "Please enter your primary location."}
            </span>
          </div>
        ) : null}

        {hasExtraction && hasMultipleCandidates ? (
          <div className="auth-location-candidates">
            {candidates.map((candidate) => (
              <label
                key={candidate.postal_code}
                className={`auth-location-candidate ${
                  selectedCandidate === candidate.postal_code
                    ? "auth-location-candidate--selected"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="location-candidate"
                  value={candidate.postal_code}
                  checked={selectedCandidate === candidate.postal_code}
                  onChange={() => handleCandidateSelect(candidate.postal_code)}
                />
                <span
                  className="auth-location-candidate__radio"
                  aria-hidden="true"
                />
                <span className="auth-location-candidate__copy">
                  <strong>{candidate.postal_code}</strong>
                  <span>
                    {[
                      candidate.city,
                      candidate.state_province,
                      candidate.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </span>
              </label>
            ))}
            <label
              className={`auth-location-candidate ${
                selectedCandidate === MANUAL_OPTION
                  ? "auth-location-candidate--selected"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="location-candidate"
                value={MANUAL_OPTION}
                checked={selectedCandidate === MANUAL_OPTION}
                onChange={() => handleCandidateSelect(MANUAL_OPTION)}
              />
              <span
                className="auth-location-candidate__radio"
                aria-hidden="true"
              />
              <span className="auth-location-candidate__copy">
                <strong>None of these</strong>
                <span>Enter manually</span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="auth-onboarding-grid auth-onboarding-grid--two">
          <AuthInput
            id="postal-code"
            label="Postal / ZIP Code"
            placeholder={
              locationForm.country
                ? POSTAL_PLACEHOLDER_BY_COUNTRY[
                    locationForm.country as "US" | "CA"
                  ]
                : "97215 or V6B 1A1"
            }
            value={locationForm.postalCode}
            onChange={(e) => handlePostalCodeChange(e.target.value)}
            error={validationError ?? postalWarning ?? undefined}
          />
          <AuthInput
            id="city"
            label="City"
            placeholder="Portland"
            value={locationForm.city}
            onChange={(e) => {
              setLocationForm((prev) => ({ ...prev, city: e.target.value }));
              markUnconfirmed();
            }}
          />
          <AuthInput
            id="state-province"
            label="State / Province"
            placeholder="OR"
            value={locationForm.stateProvince}
            onChange={(e) => {
              setLocationForm((prev) => ({
                ...prev,
                stateProvince: e.target.value,
              }));
              markUnconfirmed();
            }}
          />
          <JoySelect
            label="Country"
            value={locationForm.country}
            options={COUNTRY_OPTIONS}
            placeholder="Select a country"
            onValueChange={(value) =>
              handleCountryChange(value as "US" | "CA")
            }
          />
        </div>

        {!isLocationConfirmed ? (
          <AuthButton
            type="button"
            onClick={handleConfirmLocation}
            variant="secondary"
            disabled={!hasAllLocationFields(locationForm)}
          >
            <CheckCircle aria-hidden="true" />
            Confirm This Location
          </AuthButton>
        ) : (
          <div className="auth-onboarding-note auth-onboarding-note--success">
            <CheckCircle aria-hidden="true" />
            <span>Location confirmed</span>
          </div>
        )}
      </section>

      <div className="auth-onboarding-actions auth-onboarding-actions--split">
        <AuthButton onClick={onBack} variant="ghost" fullWidth={false}>
          <ArrowLeft aria-hidden="true" />
          Back
        </AuthButton>
        <AuthButton
          onClick={handleComplete}
          disabled={isCompleteDisabled}
          loading={isCompleting}
          fullWidth={false}
        >
          Complete Setup
        </AuthButton>
      </div>
    </div>
  );
};
