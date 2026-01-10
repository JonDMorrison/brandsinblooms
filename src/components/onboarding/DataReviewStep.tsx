import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, ArrowLeft, AlertTriangle, MapPin } from "lucide-react";
import { useState, useEffect } from "react";

interface LocationCandidate {
  postal_code: string;
  city?: string;
  state_province?: string;
  country?: 'US' | 'CA';
}

interface LocationExtraction {
  postal_code: string | null;
  city: string | null;
  state_province: string | null;
  country: 'US' | 'CA' | null;
  source: string;
  confidence: 'high' | 'medium' | 'low';
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

export const DataReviewStep = ({ 
  extractedData, 
  updateExtractedData, 
  onBack, 
  onComplete, 
  isCompleting,
  isAnalyzing
}: DataReviewStepProps) => {
  const locationExtraction = extractedData.locationExtraction;
  const showLocationPrompt = locationExtraction?.requires_confirmation || 
    locationExtraction?.confidence === 'low' || 
    !locationExtraction?.postal_code ||
    (locationExtraction?.candidates?.length || 0) > 1;

  const [locationForm, setLocationForm] = useState({
    postalCode: locationExtraction?.postal_code || '',
    city: locationExtraction?.city || '',
    stateProvince: locationExtraction?.state_province || '',
  });
  const [selectedCandidate, setSelectedCandidate] = useState<string>(
    locationExtraction?.postal_code || 'manual'
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Update form when extraction data changes
  useEffect(() => {
    if (locationExtraction) {
      setLocationForm({
        postalCode: locationExtraction.postal_code || '',
        city: locationExtraction.city || '',
        stateProvince: locationExtraction.state_province || '',
      });
      setSelectedCandidate(locationExtraction.postal_code || 'manual');
    }
  }, [locationExtraction]);

  const handlePostalCodeChange = (value: string) => {
    setLocationForm(prev => ({ ...prev, postalCode: value }));
    setValidationError(null);
    
    if (value.length >= 5) {
      const validation = validatePostalCode(value);
      if (!validation.valid) {
        setValidationError('Enter a valid US ZIP (12345) or Canadian postal code (A1A 1A1)');
      }
    }
  };

  const handleCandidateSelect = (postalCode: string) => {
    setSelectedCandidate(postalCode);
    if (postalCode !== 'manual') {
      const candidate = locationExtraction?.candidates?.find(c => c.postal_code === postalCode);
      if (candidate) {
        setLocationForm({
          postalCode: candidate.postal_code,
          city: candidate.city || '',
          stateProvince: candidate.state_province || '',
        });
      }
    } else {
      setLocationForm({ postalCode: '', city: '', stateProvince: '' });
    }
    setValidationError(null);
  };

  const handleComplete = () => {
    // If location needs confirmation, validate before completing
    if (showLocationPrompt && locationForm.postalCode) {
      const validation = validatePostalCode(locationForm.postalCode);
      if (!validation.valid) {
        setValidationError('Please enter a valid postal/ZIP code before continuing');
        return;
      }
    }
    onComplete();
  };

  const hasMultipleCandidates = (locationExtraction?.candidates?.length || 0) > 1;

  return (
    <Card className="w-full max-w-lg mx-auto border-brand-green/30 bg-white/95 backdrop-blur-sm rounded-2xl">
      <CardHeader className="text-center pb-6">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-brand-green" />
        </div>
        <CardTitle className="text-2xl font-semibold text-foreground">
          Review Your Content
        </CardTitle>
        <p className="text-gray-600 mt-2">
          Instantly receive ready-to-go posts, emails, and more — all editable and fully tailored.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name" className="text-gray-700 font-medium">
              Business Name
            </Label>
            <Input
              id="business-name"
              value={extractedData.businessName}
              onChange={(e) => updateExtractedData('businessName', e.target.value)}
              placeholder="Your Garden Center Name"
              className="h-12 border-brand-green/30 focus:border-brand-green focus:ring-brand-green/20 transition-all duration-200 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="about-business" className="text-gray-700 font-medium">
              About Your Business
            </Label>
            <Textarea
              id="about-business"
              value={extractedData.aboutBusiness}
              onChange={(e) => updateExtractedData('aboutBusiness', e.target.value)}
              placeholder="Tell us about your garden center..."
              className="min-h-[100px] border-brand-green/30 focus:border-brand-green focus:ring-brand-green/20 transition-all duration-200 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-voice" className="text-gray-700 font-medium">
              Brand Voice & Tone
            </Label>
            <Textarea
              id="brand-voice"
              value={extractedData.brandVoice}
              onChange={(e) => updateExtractedData('brandVoice', e.target.value)}
              placeholder="How do you communicate with customers?"
              className="min-h-[80px] border-brand-green/30 focus:border-brand-green focus:ring-brand-green/20 transition-all duration-200 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="annual-events" className="text-gray-700 font-medium">
              Annual Events & Seasons
            </Label>
            <Textarea
              id="annual-events"
              value={extractedData.annualEvents}
              onChange={(e) => updateExtractedData('annualEvents', e.target.value)}
              placeholder="Spring sales, holiday events, workshops..."
              className="min-h-[80px] border-brand-green/30 focus:border-brand-green focus:ring-brand-green/20 transition-all duration-200 rounded-lg"
            />
          </div>

          {/* Location Verification Section */}
          {locationExtraction && (
            <div className={`space-y-3 p-4 rounded-lg border ${
              showLocationPrompt 
                ? 'border-yellow-300 bg-yellow-50/50' 
                : 'border-green-200 bg-green-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <Label className="text-gray-700 font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Detected Location
                </Label>
                <Badge 
                  variant="secondary"
                  className={
                    locationExtraction.confidence === 'high' 
                      ? 'bg-green-100 text-green-800' 
                      : locationExtraction.confidence === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }
                >
                  {locationExtraction.confidence} confidence
                </Badge>
              </div>

              {showLocationPrompt && (
                <div className="flex items-start gap-2 text-sm text-yellow-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {!locationExtraction.postal_code 
                      ? "We couldn't detect your postal/ZIP code. Please enter it below."
                      : hasMultipleCandidates
                        ? "We found multiple locations. Please select the correct one."
                        : "Please confirm your location."}
                  </span>
                </div>
              )}

              {/* Multiple candidates selection */}
              {hasMultipleCandidates && (
                <div className="space-y-2">
                  {locationExtraction.candidates.map((candidate) => (
                    <label
                      key={candidate.postal_code}
                      className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                        selectedCandidate === candidate.postal_code 
                          ? 'bg-brand-green/10 border border-brand-green/30' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name="location-candidate"
                        value={candidate.postal_code}
                        checked={selectedCandidate === candidate.postal_code}
                        onChange={() => handleCandidateSelect(candidate.postal_code)}
                        className="text-brand-green"
                      />
                      <span className="text-sm">
                        <span className="font-medium">{candidate.postal_code}</span>
                        {candidate.city && ` — ${candidate.city}`}
                        {candidate.state_province && `, ${candidate.state_province}`}
                      </span>
                    </label>
                  ))}
                  <label
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                      selectedCandidate === 'manual' 
                        ? 'bg-brand-green/10 border border-brand-green/30' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="location-candidate"
                      value="manual"
                      checked={selectedCandidate === 'manual'}
                      onChange={() => handleCandidateSelect('manual')}
                      className="text-brand-green"
                    />
                    <span className="text-sm">None of these — enter manually</span>
                  </label>
                </div>
              )}

              {/* Postal code input - shown if needs confirmation or manual selected */}
              {(showLocationPrompt || selectedCandidate === 'manual') && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="postal-code" className="text-sm text-gray-600">
                      Postal/ZIP Code *
                    </Label>
                    <Input
                      id="postal-code"
                      placeholder="e.g., 97215"
                      value={locationForm.postalCode}
                      onChange={(e) => handlePostalCodeChange(e.target.value)}
                      className={`h-10 ${validationError ? 'border-red-300' : 'border-brand-green/30'}`}
                    />
                    {validationError && (
                      <p className="text-xs text-red-600">{validationError}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="city" className="text-sm text-gray-600">
                      City
                    </Label>
                    <Input
                      id="city"
                      placeholder="e.g., Portland"
                      value={locationForm.city}
                      onChange={(e) => setLocationForm(prev => ({ ...prev, city: e.target.value }))}
                      className="h-10 border-brand-green/30"
                    />
                  </div>
                </div>
              )}

              {/* Show confirmed location for high confidence */}
              {!showLocationPrompt && locationExtraction.postal_code && (
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{locationExtraction.postal_code}</span>
                  {locationExtraction.city && ` — ${locationExtraction.city}`}
                  {locationExtraction.state_province && `, ${locationExtraction.state_province}`}
                  {locationExtraction.country && ` (${locationExtraction.country})`}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <Button 
            onClick={onBack}
            variant="outline"
            className="flex-1 h-12 border-brand-green/30 hover:bg-muted hover:border-brand-green transition-all duration-200 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleComplete}
            disabled={isCompleting || (showLocationPrompt && validationError !== null)}
            className="flex-1 h-12 bg-brand-teal hover:bg-brand-teal-600 text-white font-medium transition-all duration-200 hover:shadow-lg rounded-lg"
          >
            {isCompleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              "Complete Setup"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
