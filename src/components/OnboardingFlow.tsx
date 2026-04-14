import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2, MapPin, CheckCircle, AlertTriangle } from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { createCompanyProfileFromOnboarding, saveOnboardingResponse } from "./onboarding/CompanyProfileCreator";
import { LandingPageHeader } from "./landing/LandingPageHeader";
import { supabase } from "@/integrations/supabase/client";
import { enforceLocationConfirmation } from "@/lib/locationValidation";

interface OnboardingFlowProps {
  onComplete: (data: any) => void;
  onBack?: () => void;
}

// Validation patterns
const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;
const CA_POSTAL_PATTERN = /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\s?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

const validatePostalCode = (value: string): { valid: boolean; country?: 'US' | 'CA'; normalized?: string } => {
  const trimmed = value.trim();
  
  if (US_ZIP_PATTERN.test(trimmed)) {
    return { valid: true, country: 'US', normalized: trimmed };
  }
  
  if (CA_POSTAL_PATTERN.test(trimmed)) {
    const cleaned = trimmed.replace(/\s/g, '').toUpperCase();
    const normalized = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return { valid: true, country: 'CA', normalized };
  }
  
  return { valid: false };
};

export const OnboardingFlow = ({ onComplete, onBack }: OnboardingFlowProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(true);
  const [existingPostalCode, setExistingPostalCode] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  // Location form state
  const [locationData, setLocationData] = useState({
    postalCode: "",
    city: "",
    stateProvince: "",
    country: undefined as 'US' | 'CA' | undefined
  });
  const [locationValidationError, setLocationValidationError] = useState<string | null>(null);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);

  // Check if user already has a confirmed postal code
  useEffect(() => {
    const checkExistingLocation = async () => {
      if (!user?.id) {
        setIsCheckingLocation(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('company_profiles')
          .select('postal_code, city, state_province, country, location_needs_confirmation')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.postal_code && data.location_needs_confirmation === false) {
          // User already has confirmed location - skip location step
          setExistingPostalCode(data.postal_code);
          setIsLocationConfirmed(true);
          setLocationData({
            postalCode: data.postal_code,
            city: data.city || "",
            stateProvince: data.state_province || "",
            country: data.country as 'US' | 'CA' | undefined
          });
        }
      } catch (error) {
        console.error('Error checking existing location:', error);
      } finally {
        setIsCheckingLocation(false);
      }
    };

    checkExistingLocation();
  }, [user?.id]);

  // Steps configuration - location step is the last content step before submit
  const contentSteps = [
    {
      title: "Tell us about your business",
      description: "Help us understand your garden center's story and what makes it special.",
      field: "aboutBusiness",
      placeholder: "Describe your garden center, its history, location, specialties, and what sets you apart from competitors...",
      label: "About Your Business",
      type: "textarea" as const
    },
    {
      title: "Share your brand voice",
      description: "Provide examples of how you communicate with customers to help us match your tone.",
      field: "toneSamples",
      placeholder: "Share examples of your marketing copy, social media posts, or how you typically communicate with customers...",
      label: "Brand Voice & Tone Examples",
      type: "textarea" as const
    },
    {
      title: "Annual events and seasons",
      description: "Tell us about your yearly calendar, seasonal promotions, and special events.",
      field: "annualEvents",
      placeholder: "Describe your seasonal events, annual sales, workshops, plant fairs, holiday promotions, etc...",
      label: "Annual Events & Seasonal Calendar",
      type: "textarea" as const
    }
  ];

  // Location step configuration
  const locationStep = {
    title: "Confirm your location",
    description: "We tailor your content to your local climate and growing seasons.",
    type: "location" as const
  };

  // Total steps: content steps + location step (if not already confirmed)
  const needsLocationStep = !existingPostalCode;
  const totalSteps = contentSteps.length + (needsLocationStep ? 1 : 0);
  const isLocationStep = needsLocationStep && currentStep === contentSteps.length + 1;
  const isLastStep = currentStep === totalSteps;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePostalCodeChange = (value: string) => {
    setLocationData(prev => ({ ...prev, postalCode: value }));
    setLocationValidationError(null);
    setIsLocationConfirmed(false);
    
    if (value.length >= 5) {
      const validation = validatePostalCode(value);
      if (!validation.valid) {
        setLocationValidationError('Enter a valid US ZIP (12345) or Canadian postal code (A1A 1A1)');
      } else {
        setLocationData(prev => ({ 
          ...prev, 
          postalCode: validation.normalized || value,
          country: validation.country 
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
        setLocationData(prev => ({
          ...prev,
          postalCode: validation.normalized || prev.postalCode,
          country: validation.country
        }));
      } else {
        setLocationValidationError('Please enter a valid postal/ZIP code');
      }
    }
  };

  const handleNext = () => {
    if (isLocationStep) {
      // Location step validation
      if (!isLocationConfirmed) {
        setLocationValidationError('Please confirm your location to continue');
        return;
      }
    } else {
      // Content step validation
      const currentField = contentSteps[currentStep - 1].field as keyof typeof formData;
      if (!formData[currentField].trim()) {
        return;
      }
    }
    
    if (currentStep < totalSteps) {
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

    // Final validation
    if (needsLocationStep && !isLocationConfirmed) {
      setLocationValidationError('Please confirm your location before completing setup');
      return;
    }

    if (!isLocationStep) {
      const currentField = contentSteps[currentStep - 1].field as keyof typeof formData;
      if (!formData[currentField].trim()) {
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      // Save onboarding response to database
      await saveOnboardingResponse(formData, user.id);

      // Persist location BEFORE creating company profile — the profile
      // creator checks location_needs_confirmation in the DB and will
      // reject if it's still true.
      if (needsLocationStep && isLocationConfirmed) {
        const { error: locationError } = await supabase
          .from('company_profiles')
          .update({
            postal_code: locationData.postalCode,
            city: locationData.city || null,
            state_province: locationData.stateProvince || null,
            country: locationData.country || null,
            location_detection_source: 'manual',
            location_confidence: 'high',
            location_needs_confirmation: false
          })
          .eq('user_id', user.id);

        if (locationError) {
          console.error('Error saving location:', locationError);
          throw locationError;
        }
      }

      // Create company profile from onboarding data
      await createCompanyProfileFromOnboarding(formData, user.id);
      
      // SERVER-SIDE SAFETY CHECK: Re-verify location confirmation invariant
      const validation = await enforceLocationConfirmation(user.id);
      
      if (!validation.success) {
        console.error('❌ Server-side location validation failed:', validation.error);
        setLocationValidationError(validation.error || 'Location confirmation required');
        setIsSubmitting(false);
        return;
      }
      
      // Store the onboarding data in localStorage as backup
      localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(formData));
      
      // Call the onComplete callback with the data
      onComplete(formData);
      
      // Navigate to the dashboard
      navigate('/dashboard', { replace: true });
      
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state while checking existing location
  if (isCheckingLocation) {
    return (
      <div className="min-h-screen bg-garden-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-garden-green" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const renderLocationStep = () => (
    <div className="space-y-6">
      {/* Climate explanation */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Why we need your location</p>
          <p>We tailor your content to your local climate and growing seasons, ensuring your marketing is always relevant to your customers.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="postal-code" className="text-base font-medium">
              Postal/ZIP Code <span className="text-red-500">*</span>
            </Label>
            <Input
              id="postal-code"
              placeholder="e.g., 97215 or V6B 1A1"
              value={locationData.postalCode}
              onChange={(e) => handlePostalCodeChange(e.target.value)}
              className={`h-12 ${locationValidationError ? 'border-red-300 focus:ring-red-200' : ''}`}
            />
            {locationValidationError && (
              <p className="text-sm text-red-600">{locationValidationError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city" className="text-base font-medium">City</Label>
            <Input
              id="city"
              placeholder="e.g., Portland"
              value={locationData.city}
              onChange={(e) => {
                setLocationData(prev => ({ ...prev, city: e.target.value }));
                setIsLocationConfirmed(false);
              }}
              className="h-12"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="state-province" className="text-base font-medium">State/Province</Label>
            <Input
              id="state-province"
              placeholder="e.g., Oregon or BC"
              value={locationData.stateProvince}
              onChange={(e) => {
                setLocationData(prev => ({ ...prev, stateProvince: e.target.value }));
                setIsLocationConfirmed(false);
              }}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country" className="text-base font-medium">Country</Label>
            <Input
              id="country"
              value={locationData.country === 'US' ? 'United States' : locationData.country === 'CA' ? 'Canada' : ''}
              disabled
              placeholder="Auto-detected from postal code"
              className="h-12 bg-muted"
            />
          </div>
        </div>

        {/* Confirm button */}
        {!isLocationConfirmed && locationData.postalCode && (
          <Button
            type="button"
            onClick={handleConfirmLocation}
            variant="outline"
            className="w-full border-garden-green text-garden-green hover:bg-garden-green/10"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Confirm This Location
          </Button>
        )}

        {/* Confirmed indicator */}
        {isLocationConfirmed && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg border border-green-200">
            <CheckCircle className="w-4 h-4" />
            Location confirmed: {locationData.postalCode}
            {locationData.city && ` — ${locationData.city}`}
            {locationData.stateProvince && `, ${locationData.stateProvince}`}
          </div>
        )}

        {/* Warning when not confirmed */}
        {!isLocationConfirmed && locationData.postalCode && !locationValidationError && (
          <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Please confirm your location to continue.</span>
          </div>
        )}
      </div>
    </div>
  );

  const renderContentStep = () => {
    const stepData = contentSteps[currentStep - 1];
    return (
      <div className="space-y-2">
        <Label htmlFor={stepData.field} className="text-base font-medium">
          {stepData.label}
        </Label>
        <Textarea
          id={stepData.field}
          placeholder={stepData.placeholder}
          value={formData[stepData.field as keyof typeof formData]}
          onChange={(e) => handleInputChange(stepData.field, e.target.value)}
          className="min-h-[150px] resize-none text-base leading-relaxed"
          required
        />
      </div>
    );
  };

  const currentStepTitle = isLocationStep ? locationStep.title : contentSteps[currentStep - 1].title;
  const currentStepDescription = isLocationStep ? locationStep.description : contentSteps[currentStep - 1].description;

  // Determine if the action button should be disabled
  const isActionDisabled = isLocationStep 
    ? !isLocationConfirmed || !!locationValidationError
    : !formData[contentSteps[currentStep - 1]?.field as keyof typeof formData]?.trim();

  return (
    <div className="min-h-screen bg-garden-background">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      <div className="min-h-screen flex items-center justify-center bg-garden-background p-4">
        <div className="w-full max-w-2xl mx-auto">
          {/* Progress indicator */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-garden-green">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round((currentStep / totalSteps) * 100)}% complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-garden-green h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold text-garden-green-dark mb-2">
                {currentStepTitle}
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                {currentStepDescription}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {isLocationStep ? renderLocationStep() : renderContentStep()}

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {currentStep === 1 ? 'Back to Website' : 'Previous'}
                </Button>

                {isLastStep ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isActionDisabled}
                    className="bg-garden-green hover:bg-garden-green-dark text-white flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Completing Setup...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={isActionDisabled}
                    className="bg-garden-green hover:bg-garden-green-dark text-white flex items-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
