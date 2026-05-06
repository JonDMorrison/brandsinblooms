import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  MapPin,
  Pencil,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  AuthButton,
  AuthCard,
  AuthInput,
  AuthStepProgress,
} from "@/components/auth";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  createCompanyProfileFromOnboarding,
  saveOnboardingResponse,
} from "./onboarding/CompanyProfileCreator";

interface OnboardingFlowProps {
  onComplete: (data: unknown) => void;
  onBack?: () => void;
}

const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_PATTERN =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i;
const manualSteps = ["Business Info", "Location", "Review"];

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

export const OnboardingFlow = ({ onComplete, onBack }: OnboardingFlowProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(true);
  const [existingPostalCode, setExistingPostalCode] = useState<string | null>(
    null,
  );

  const [formData, setFormData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: "",
  });

  const [locationData, setLocationData] = useState({
    postalCode: "",
    city: "",
    stateProvince: "",
    country: undefined as "US" | "CA" | undefined,
  });
  const [locationValidationError, setLocationValidationError] = useState<
    string | null
  >(null);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);

  useEffect(() => {
    const checkExistingLocation = async () => {
      if (!user?.id) {
        setIsCheckingLocation(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("company_profiles")
          .select(
            "postal_code, city, state_province, country, location_needs_confirmation",
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (data?.postal_code && data.location_needs_confirmation === false) {
          setExistingPostalCode(data.postal_code);
          setIsLocationConfirmed(true);
          setLocationData({
            postalCode: data.postal_code,
            city: data.city || "",
            stateProvince: data.state_province || "",
            country: data.country as "US" | "CA" | undefined,
          });
        }
      } catch (error) {
        console.error("Error checking existing location:", error);
      } finally {
        setIsCheckingLocation(false);
      }
    };

    checkExistingLocation();
  }, [user?.id]);

  const needsLocationStep = !existingPostalCode;
  const isBusinessInfoValid = Boolean(
    formData.aboutBusiness.trim() &&
    formData.toneSamples.trim() &&
    formData.annualEvents.trim(),
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handlePostalCodeChange = (value: string) => {
    setLocationData((previous) => ({ ...previous, postalCode: value }));
    setLocationValidationError(null);
    setIsLocationConfirmed(false);

    if (value.length >= 5) {
      const validation = validatePostalCode(value);
      if (!validation.valid) {
        setLocationValidationError(
          "Enter a valid US ZIP (12345) or Canadian postal code (A1A 1A1)",
        );
      } else {
        setLocationData((previous) => ({
          ...previous,
          postalCode: validation.normalized || value,
          country: validation.country,
        }));
      }
    }
  };

  const handleConfirmLocation = () => {
    if (locationData.postalCode) {
      const validation = validatePostalCode(locationData.postalCode);
      if (validation.valid) {
        setIsLocationConfirmed(true);
        setLocationValidationError(null);
        setLocationData((previous) => ({
          ...previous,
          postalCode: validation.normalized || previous.postalCode,
          country: validation.country,
        }));
      } else {
        setLocationValidationError("Please enter a valid postal/ZIP code");
      }
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !isBusinessInfoValid) {
      return;
    }

    if (currentStep === 2 && needsLocationStep && !isLocationConfirmed) {
      setLocationValidationError("Please confirm your location");
      return;
    }

    if (currentStep < manualSteps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else if (onBack) {
      onBack();
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      return;
    }

    if (needsLocationStep && !isLocationConfirmed) {
      setLocationValidationError("Please confirm your location");
      return;
    }

    if (!isBusinessInfoValid) {
      setCurrentStep(1);
      return;
    }

    setIsSubmitting(true);

    try {
      await saveOnboardingResponse(formData, user.id);

      if (needsLocationStep && isLocationConfirmed) {
        const { error: locationError } = await supabase
          .from("company_profiles")
          .update({
            postal_code: locationData.postalCode,
            city: locationData.city || null,
            state_province: locationData.stateProvince || null,
            country: locationData.country || null,
            location_detection_source: "manual",
            location_confidence: "high",
            location_needs_confirmation: false,
          })
          .eq("user_id", user.id);

        if (locationError) {
          console.error("Error saving location:", locationError);
          throw locationError;
        }
      }

      await createCompanyProfileFromOnboarding(formData, user.id);

      localStorage.setItem(
        `garden-center-onboarding-${user.id}`,
        JSON.stringify(formData),
      );

      onComplete(formData);

      navigate("/dashboard", { replace: true });
    } catch (error) {
      console.error("Error completing onboarding:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBusinessStep = () => (
    <div className="auth-manual-step" key="business">
      <div className="auth-onboarding-step__header auth-onboarding-step__header--left">
        <span className="auth-onboarding-eyebrow">Step 1</span>
        <h1>Tell us about your business</h1>
        <p>
          These details help BloomSuite match your tone, calendar, and customer
          priorities.
        </p>
      </div>

      <div className="auth-onboarding-form">
        <AuthInput
          id="aboutBusiness"
          label="About Your Business"
          placeholder="Describe your garden center, history, specialties, and what sets you apart..."
          value={formData.aboutBusiness}
          onChange={(event) =>
            handleInputChange("aboutBusiness", event.target.value)
          }
          multiline
          rows={4}
          required
        />
        <AuthInput
          id="toneSamples"
          label="Brand Voice"
          placeholder="Share examples of how you talk to customers in posts, emails, or in store..."
          value={formData.toneSamples}
          onChange={(event) =>
            handleInputChange("toneSamples", event.target.value)
          }
          multiline
          rows={3}
          required
        />
        <AuthInput
          id="annualEvents"
          label="Annual Events"
          placeholder="Spring sales, workshops, plant fairs, holiday promotions, and seasonal moments..."
          value={formData.annualEvents}
          onChange={(event) =>
            handleInputChange("annualEvents", event.target.value)
          }
          multiline
          rows={3}
          required
        />
      </div>
    </div>
  );

  const renderLocationStep = () => (
    <div className="auth-manual-step" key="location">
      <div className="auth-onboarding-step__header auth-onboarding-step__header--left">
        <span className="auth-onboarding-eyebrow">Step 2</span>
        <h1>Confirm your location</h1>
        <p>We tailor your content to your local climate and growing seasons.</p>
      </div>

      <div className="auth-onboarding-location auth-onboarding-location--manual">
        <div className="auth-onboarding-note auth-onboarding-note--info">
          <MapPin aria-hidden="true" />
          <span>
            Local growing context helps keep newsletters and campaigns
            seasonally relevant.
          </span>
        </div>

        <div className="auth-onboarding-grid auth-onboarding-grid--two">
          <AuthInput
            id="postal-code"
            label="Postal / ZIP Code"
            placeholder="97215 or V6B 1A1"
            value={locationData.postalCode}
            onChange={(event) => handlePostalCodeChange(event.target.value)}
            error={locationValidationError ?? undefined}
            disabled={!needsLocationStep}
            required
          />
          <AuthInput
            id="city"
            label="City"
            placeholder="Portland"
            value={locationData.city}
            onChange={(event) => {
              setLocationData((previous) => ({
                ...previous,
                city: event.target.value,
              }));
              setIsLocationConfirmed(false);
            }}
            disabled={!needsLocationStep}
          />
          <AuthInput
            id="state-province"
            label="State / Province"
            placeholder="Oregon or BC"
            value={locationData.stateProvince}
            onChange={(event) => {
              setLocationData((previous) => ({
                ...previous,
                stateProvince: event.target.value,
              }));
              setIsLocationConfirmed(false);
            }}
            disabled={!needsLocationStep}
          />
          <AuthInput
            id="country"
            label="Country"
            value={
              locationData.country === "US"
                ? "United States"
                : locationData.country === "CA"
                  ? "Canada"
                  : ""
            }
            disabled
            placeholder="Auto-detected from postal code"
          />
        </div>

        {needsLocationStep &&
        !isLocationConfirmed &&
        locationData.postalCode ? (
          <AuthButton
            type="button"
            onClick={handleConfirmLocation}
            variant="secondary"
          >
            <CheckCircle aria-hidden="true" />
            Confirm This Location
          </AuthButton>
        ) : null}

        {isLocationConfirmed ? (
          <div className="auth-onboarding-note auth-onboarding-note--success">
            <CheckCircle aria-hidden="true" />
            <span>
              Location confirmed: {locationData.postalCode}
              {locationData.city && ` — ${locationData.city}`}
              {locationData.stateProvince && `, ${locationData.stateProvince}`}
            </span>
          </div>
        ) : null}

        {needsLocationStep &&
        !isLocationConfirmed &&
        locationData.postalCode &&
        !locationValidationError ? (
          <div className="auth-onboarding-note auth-onboarding-note--warning">
            <AlertTriangle aria-hidden="true" />
            <span>Please confirm your location.</span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderSummaryItem = (label: string, value: string, step: number) => (
    <div className="auth-review-summary__item">
      <div>
        <span>{label}</span>
        <p>{value || "Not provided"}</p>
      </div>
      <button type="button" onClick={() => setCurrentStep(step)}>
        <Pencil aria-hidden="true" />
        Edit
      </button>
    </div>
  );

  const renderReviewStep = () => (
    <div className="auth-manual-step" key="review">
      <div className="auth-onboarding-step__header auth-onboarding-step__header--left">
        <span className="auth-onboarding-eyebrow">Step 3</span>
        <h1>Review your setup</h1>
        <p>
          Confirm the starter profile details before BloomSuite creates your
          workspace.
        </p>
      </div>

      <div className="auth-review-summary">
        {renderSummaryItem("About Your Business", formData.aboutBusiness, 1)}
        {renderSummaryItem("Brand Voice", formData.toneSamples, 1)}
        {renderSummaryItem("Annual Events", formData.annualEvents, 1)}
        {renderSummaryItem(
          "Location",
          [
            locationData.postalCode,
            locationData.city,
            locationData.stateProvince,
            locationData.country,
          ]
            .filter(Boolean)
            .join(", "),
          2,
        )}
      </div>
    </div>
  );

  const isPrimaryDisabled =
    currentStep === 1
      ? !isBusinessInfoValid
      : currentStep === 2
        ? needsLocationStep && !!locationValidationError
        : isSubmitting;

  if (isCheckingLocation) {
    return (
      <AuthCard className="auth-onboarding-card">
        <div
          className="auth-onboarding-loading"
          role="status"
          aria-live="polite"
        >
          <span
            className="auth-spinner auth-onboarding-loading__spinner"
            aria-hidden="true"
          />
          <p>Loading...</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard className="auth-onboarding-card">
      <div className="auth-onboarding-flow">
        <AuthStepProgress steps={manualSteps} currentStep={currentStep} />

        {currentStep === 1
          ? renderBusinessStep()
          : currentStep === 2
            ? renderLocationStep()
            : renderReviewStep()}

        <div className="auth-onboarding-actions auth-onboarding-actions--split">
          <AuthButton variant="ghost" onClick={handleBack} fullWidth={false}>
            <ArrowLeft aria-hidden="true" />
            Back
          </AuthButton>

          {currentStep === manualSteps.length ? (
            <AuthButton
              onClick={handleSubmit}
              disabled={isSubmitting || isPrimaryDisabled}
              loading={isSubmitting}
              fullWidth={false}
            >
              Complete Setup
            </AuthButton>
          ) : (
            <AuthButton
              onClick={handleNext}
              disabled={isPrimaryDisabled}
              fullWidth={false}
            >
              Continue
              <ArrowRight aria-hidden="true" />
            </AuthButton>
          )}
        </div>
      </div>
    </AuthCard>
  );
};
