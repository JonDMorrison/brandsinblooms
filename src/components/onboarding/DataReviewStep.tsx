import { CheckCircle, ArrowLeft, AlertTriangle, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { AuthButton, AuthInput } from "@/components/auth";
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
  onComplete: () => void;
  isCompleting: boolean;
  isAnalyzing: boolean;
  onLocationConfirmationChange?: (confirmed: boolean) => void;
}

// Validation patterns
const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_PATTERN =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

const validatePostalCode = (
  value: string,
): { valid: boolean; country?: "US" | "CA"; normalized?: string } => {
  const trimmed = value.trim();

  if (US_ZIP_PATTERN.test(trimmed)) {
    return { valid: true, country: "US", normalized: trimmed };
  }

  if (CA_POSTAL_PATTERN.test(trimmed)) {
    const cleaned = trimmed.replace(/\s/g, "").toUpperCase();
    const normalized = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return { valid: true, country: "CA", normalized };
  }

  return { valid: false };
};

export const DataReviewStep = ({
  extractedData,
  updateExtractedData,
  onBack,
  onComplete,
  isCompleting,
  isAnalyzing,
  onLocationConfirmationChange,
}: DataReviewStepProps) => {
  const locationExtraction = extractedData.locationExtraction;
  const showLocationPrompt =
    locationExtraction?.requires_confirmation ||
    locationExtraction?.confidence === "low" ||
    !locationExtraction?.postal_code ||
    (locationExtraction?.candidates?.length || 0) > 1;

  const [locationForm, setLocationForm] = useState({
    postalCode: locationExtraction?.postal_code || "",
    city: locationExtraction?.city || "",
    stateProvince: locationExtraction?.state_province || "",
  });
  const [selectedCandidate, setSelectedCandidate] = useState<string>(
    locationExtraction?.postal_code || "manual",
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isLocationConfirmedLocal, setIsLocationConfirmedLocal] =
    useState(false);

  // Update form when extraction data changes
  useEffect(() => {
    if (locationExtraction) {
      setLocationForm({
        postalCode: locationExtraction.postal_code || "",
        city: locationExtraction.city || "",
        stateProvince: locationExtraction.state_province || "",
      });
      setSelectedCandidate(locationExtraction.postal_code || "manual");

      // Auto-confirm if high confidence single location
      const autoConfirmed =
        !showLocationPrompt && Boolean(locationExtraction.postal_code);
      setIsLocationConfirmedLocal(autoConfirmed);
      onLocationConfirmationChange?.(autoConfirmed);
    }
  }, [locationExtraction, showLocationPrompt, onLocationConfirmationChange]);

  const handlePostalCodeChange = (value: string) => {
    setLocationForm((prev) => ({ ...prev, postalCode: value }));
    setValidationError(null);
    setIsLocationConfirmedLocal(false); // Reset confirmation when editing
    onLocationConfirmationChange?.(false); // Notify parent confirmation is lost

    if (value.length >= 5) {
      const validation = validatePostalCode(value);
      if (!validation.valid) {
        setValidationError(
          "Enter a valid US ZIP (12345) or Canadian postal code (A1A 1A1)",
        );
      }
    }
  };

  const handleCandidateSelect = (postalCode: string) => {
    setSelectedCandidate(postalCode);
    setIsLocationConfirmedLocal(false); // Reset until explicit confirmation
    onLocationConfirmationChange?.(false); // Notify parent confirmation is lost
    if (postalCode !== "manual") {
      const candidate = locationExtraction?.candidates?.find(
        (c) => c.postal_code === postalCode,
      );
      if (candidate) {
        setLocationForm({
          postalCode: candidate.postal_code,
          city: candidate.city || "",
          stateProvince: candidate.state_province || "",
        });
      }
    } else {
      setLocationForm({ postalCode: "", city: "", stateProvince: "" });
    }
    setValidationError(null);
  };

  const handleConfirmLocation = () => {
    if (locationForm.postalCode) {
      const validation = validatePostalCode(locationForm.postalCode);
      if (validation.valid) {
        setIsLocationConfirmedLocal(true);
        setValidationError(null);
        onLocationConfirmationChange?.(true);
      } else {
        setValidationError("Please enter a valid postal/ZIP code");
        onLocationConfirmationChange?.(false);
      }
    }
  };

  const handleComplete = () => {
    // Block completion if location needs confirmation
    if (showLocationPrompt && !isLocationConfirmedLocal) {
      setValidationError("Please confirm your location");
      return;
    }

    if (showLocationPrompt && locationForm.postalCode) {
      const validation = validatePostalCode(locationForm.postalCode);
      if (!validation.valid) {
        setValidationError(
          "Please enter a valid postal/ZIP code before continuing",
        );
        return;
      }
    }
    onComplete();
  };

  const hasMultipleCandidates =
    (locationExtraction?.candidates?.length || 0) > 1;

  // Determine if Complete button should be disabled
  const isCompleteDisabled =
    isCompleting || (showLocationPrompt && !!validationError);

  // While analyzing, show a clear loading state instead of empty form fields
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

      {locationExtraction ? (
        <section
          className="auth-onboarding-location"
          aria-labelledby="detected-location-title"
        >
          <div className="auth-onboarding-location__header">
            <div>
              <span className="auth-onboarding-eyebrow">Location</span>
              <h2 id="detected-location-title">
                <MapPin aria-hidden="true" />
                Detected Location
              </h2>
            </div>
            <span
              className={`auth-confidence-pill auth-confidence-pill--${locationExtraction.confidence}`}
            >
              {locationExtraction.confidence} confidence
            </span>
          </div>

          {showLocationPrompt ? (
            <div className="auth-onboarding-note auth-onboarding-note--warning">
              <AlertTriangle aria-hidden="true" />
              <span>
                {!locationExtraction.postal_code
                  ? "We couldn't detect your postal/ZIP code. Please enter it below."
                  : hasMultipleCandidates
                    ? "We found multiple locations. Please select the correct one."
                    : "Please confirm your location."}
              </span>
            </div>
          ) : null}

          {hasMultipleCandidates ? (
            <div className="auth-location-candidates">
              {locationExtraction.candidates.map((candidate) => (
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
                    onChange={() =>
                      handleCandidateSelect(candidate.postal_code)
                    }
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
                  selectedCandidate === "manual"
                    ? "auth-location-candidate--selected"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="location-candidate"
                  value="manual"
                  checked={selectedCandidate === "manual"}
                  onChange={() => handleCandidateSelect("manual")}
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

          {showLocationPrompt || selectedCandidate === "manual" ? (
            <div className="auth-onboarding-grid auth-onboarding-grid--two">
              <AuthInput
                id="postal-code"
                label="Postal / ZIP Code"
                placeholder="97215 or V3G 1R4"
                value={locationForm.postalCode}
                onChange={(e) => handlePostalCodeChange(e.target.value)}
                error={validationError ?? undefined}
              />
              <AuthInput
                id="city"
                label="City"
                placeholder="Portland"
                value={locationForm.city}
                onChange={(e) => {
                  setLocationForm((prev) => ({
                    ...prev,
                    city: e.target.value,
                  }));
                  setIsLocationConfirmedLocal(false);
                  onLocationConfirmationChange?.(false);
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
                  setIsLocationConfirmedLocal(false);
                  onLocationConfirmationChange?.(false);
                }}
              />
              <AuthInput
                id="country"
                label="Country"
                value={locationExtraction.country || ""}
                disabled
              />
            </div>
          ) : (
            <div className="auth-onboarding-confirmed-location">
              <CheckCircle aria-hidden="true" />
              <span>
                <strong>{locationExtraction.postal_code}</strong>
                {locationExtraction.city && ` — ${locationExtraction.city}`}
                {locationExtraction.state_province &&
                  `, ${locationExtraction.state_province}`}
                {locationExtraction.country &&
                  ` (${locationExtraction.country})`}
              </span>
            </div>
          )}

          {!isLocationConfirmedLocal && locationForm.postalCode ? (
            <AuthButton
              type="button"
              onClick={handleConfirmLocation}
              variant="secondary"
            >
              <CheckCircle aria-hidden="true" />
              Confirm This Location
            </AuthButton>
          ) : null}

          {isLocationConfirmedLocal ? (
            <div className="auth-onboarding-note auth-onboarding-note--success">
              <CheckCircle aria-hidden="true" />
              <span>Location confirmed</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {showLocationPrompt && !isLocationConfirmedLocal ? (
        <div className="auth-onboarding-note auth-onboarding-note--warning">
          <AlertTriangle aria-hidden="true" />
          <span>Please confirm your primary location to continue.</span>
        </div>
      ) : null}

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
