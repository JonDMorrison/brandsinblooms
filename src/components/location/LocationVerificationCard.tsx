import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  MapPin, 
  AlertTriangle, 
  CheckCircle, 
  ChevronDown, 
  RefreshCw,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationCandidate {
  postal_code: string;
  city?: string;
  state_province?: string;
  country?: 'US' | 'CA';
  source?: string;
  snippet?: string;
}

interface RedetectResult {
  success: boolean;
  hasNewCandidates: boolean;
  newCandidates?: LocationCandidate[];
  currentPostalCode?: string;
}

interface LocationVerificationCardProps {
  // Current detected data
  postalCode?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  country?: 'US' | 'CA' | null;
  source?: 'jsonld' | 'footer' | 'contact' | 'regex' | 'manual' | 'none' | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  snippet?: string | null;
  candidates?: LocationCandidate[];
  needsConfirmation?: boolean;
  
  // Callbacks
  onConfirm: (data: {
    postalCode: string;
    city?: string;
    stateProvince?: string;
    country?: 'US' | 'CA';
  }) => Promise<void>;
  onRedetect?: () => Promise<RedetectResult>;
  
  // State
  isRedetecting?: boolean;
  isSaving?: boolean;
  
  // Display options
  compact?: boolean;
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
    // Normalize Canadian postal code to "A1A 1A1" format
    const cleaned = trimmed.replace(/\s/g, '').toUpperCase();
    const normalized = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return { valid: true, country: 'CA', normalized };
  }
  
  return { valid: false };
};

const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low' | null | undefined) => {
  switch (confidence) {
    case 'high':
      return <Badge className="bg-green-100 text-green-800 border-green-200">High Confidence</Badge>;
    case 'medium':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Medium Confidence</Badge>;
    case 'low':
      return <Badge className="bg-red-100 text-red-800 border-red-200">Low Confidence</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
};

const getSourceLabel = (source: string | null | undefined) => {
  switch (source) {
    case 'jsonld':
      return 'Schema.org structured data';
    case 'footer':
      return 'Website footer';
    case 'contact':
      return 'Contact page';
    case 'regex':
      return 'Text pattern matching';
    case 'manual':
      return 'Manually confirmed';
    case 'none':
      return 'Not detected';
    default:
      return 'Unknown source';
  }
};

export const LocationVerificationCard: React.FC<LocationVerificationCardProps> = ({
  postalCode,
  city,
  stateProvince,
  country,
  source,
  confidence,
  snippet,
  candidates = [],
  needsConfirmation = false,
  onConfirm,
  onRedetect,
  isRedetecting = false,
  isSaving = false,
  compact = false,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<string>('current');
  const [manualEntry, setManualEntry] = useState(false);
  const [formData, setFormData] = useState({
    postalCode: postalCode || '',
    city: city || '',
    stateProvince: stateProvince || '',
    country: country || undefined as 'US' | 'CA' | undefined,
  });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSnippetOpen, setIsSnippetOpen] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [pendingCandidates, setPendingCandidates] = useState<LocationCandidate[]>([]);

  const hasDetectedLocation = postalCode || city || stateProvince;
  const showWarning = needsConfirmation || confidence === 'low' || !postalCode;
  const hasMultipleCandidates = candidates.length > 1;
  const isManuallyConfirmed = source === 'manual' && confidence === 'high';

  const handleRedetectClick = async () => {
    if (!onRedetect) return;
    
    const result = await onRedetect();
    
    // If manually confirmed and new candidates found, show change dialog
    if (result.success && result.hasNewCandidates && result.newCandidates && result.newCandidates.length > 0) {
      // Check if any candidates differ from current postal code
      const hasDifferentCandidates = result.newCandidates.some(
        c => c.postal_code !== postalCode
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
    // Set manual entry to allow user to pick from new candidates
    setManualEntry(true);
    setSelectedCandidate('manual');
    setFormData({
      postalCode: '',
      city: '',
      stateProvince: '',
      country: undefined,
    });
  };

  const handlePostalCodeChange = (value: string) => {
    setFormData(prev => ({ ...prev, postalCode: value }));
    setValidationError(null);
    
    if (value.length >= 5) {
      const validation = validatePostalCode(value);
      if (!validation.valid) {
        setValidationError('Please enter a valid US ZIP (12345) or Canadian postal code (A1A 1A1)');
      } else {
        setFormData(prev => ({ 
          ...prev, 
          postalCode: validation.normalized || value,
          country: validation.country 
        }));
      }
    }
  };

  const handleCandidateSelect = (value: string) => {
    setSelectedCandidate(value);
    setManualEntry(value === 'manual');
    
    if (value === 'current') {
      setFormData({
        postalCode: postalCode || '',
        city: city || '',
        stateProvince: stateProvince || '',
        country: country || undefined,
      });
    } else if (value !== 'manual') {
      const candidate = candidates.find(c => c.postal_code === value);
      if (candidate) {
        setFormData({
          postalCode: candidate.postal_code,
          city: candidate.city || '',
          stateProvince: candidate.state_province || '',
          country: candidate.country || undefined,
        });
      }
    } else {
      setFormData({
        postalCode: '',
        city: '',
        stateProvince: '',
        country: undefined,
      });
    }
    setValidationError(null);
  };

  const handleConfirm = async () => {
    const validation = validatePostalCode(formData.postalCode);
    if (!validation.valid) {
      setValidationError('Please enter a valid US ZIP or Canadian postal code');
      return;
    }

    await onConfirm({
      postalCode: validation.normalized || formData.postalCode,
      city: formData.city || undefined,
      stateProvince: formData.stateProvince || undefined,
      country: validation.country,
    });
  };

  // If location is confirmed and high confidence, show compact view
  if (!needsConfirmation && confidence === 'high' && !compact) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Detected Location
            {getConfidenceBadge(confidence)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {postalCode && <span className="font-medium">{postalCode}</span>}
            {city && <span>{city}</span>}
            {stateProvince && <span>{stateProvince}</span>}
            {country && <span>({country})</span>}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Source: {getSourceLabel(source)}</span>
          </div>

          {onRedetect && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedetectClick}
              disabled={isRedetecting}
              className="mt-2"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRedetecting && "animate-spin")} />
              Re-detect from website
            </Button>
          )}

          {/* Change Location Dialog */}
          <AlertDialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>New Locations Detected</AlertDialogTitle>
                <AlertDialogDescription>
                  We found {pendingCandidates.length} location{pendingCandidates.length > 1 ? 's' : ''} on your website that differ from your confirmed location ({postalCode}).
                  <div className="mt-3 space-y-2">
                    {pendingCandidates.map((c, i) => (
                      <div key={i} className="text-sm font-medium text-foreground">
                        • {c.postal_code} {c.city && `- ${c.city}`}{c.state_province && `, ${c.state_province}`}
                      </div>
                    ))}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleKeepCurrent}>Keep Current</AlertDialogCancel>
                <AlertDialogAction onClick={handleChangeLocation}>Change Location</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "transition-colors",
      showWarning ? "border-yellow-300 bg-yellow-50/30" : "border-border"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          Detected Location
          {confidence && getConfidenceBadge(confidence)}
        </CardTitle>
        {showWarning && (
          <CardDescription className="flex items-center gap-2 text-yellow-700 mt-2">
            <AlertTriangle className="h-4 w-4" />
            {!postalCode 
              ? "We couldn't detect your postal/ZIP code. Please enter it below."
              : hasMultipleCandidates
                ? "We found multiple possible locations. Please select the correct one."
                : "We couldn't confidently detect your location. Please confirm or correct."
            }
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current detected info (if any) */}
        {hasDetectedLocation && !hasMultipleCandidates && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="text-sm font-medium">Currently detected:</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {postalCode && <span className="font-medium">{postalCode}</span>}
              {city && <span>{city}</span>}
              {stateProvince && <span>{stateProvince}</span>}
              {country && <span>({country})</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Source: {getSourceLabel(source)}
            </p>
          </div>
        )}

        {/* Detection snippet (expandable) */}
        {snippet && (
          <Collapsible open={isSnippetOpen} onOpenChange={setIsSnippetOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Why we detected this location
                </span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  isSnippetOpen && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground font-mono mt-2">
                {snippet}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Multiple candidates selection */}
        {hasMultipleCandidates && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select the correct location:</Label>
            <RadioGroup value={selectedCandidate} onValueChange={handleCandidateSelect}>
              {candidates.map((candidate, index) => (
                <div key={candidate.postal_code} className="flex items-center space-x-2">
                  <RadioGroupItem value={candidate.postal_code} id={`candidate-${index}`} />
                  <Label htmlFor={`candidate-${index}`} className="text-sm font-normal cursor-pointer">
                    <span className="font-medium">{candidate.postal_code}</span>
                    {candidate.city && <span className="ml-1">{candidate.city}</span>}
                    {candidate.state_province && <span>, {candidate.state_province}</span>}
                    {candidate.country && <span className="text-muted-foreground ml-1">({candidate.country})</span>}
                  </Label>
                </div>
              ))}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="candidate-manual" />
                <Label htmlFor="candidate-manual" className="text-sm font-normal cursor-pointer">
                  None of these — enter manually
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        {/* Manual entry form */}
        {(showWarning || manualEntry || !hasMultipleCandidates) && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="postal-code" className="text-sm">
                  Postal/ZIP Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="postal-code"
                  placeholder="e.g., 97215 or V6B 1A1"
                  value={formData.postalCode}
                  onChange={(e) => handlePostalCodeChange(e.target.value)}
                  className={cn(validationError && "border-red-300 focus:ring-red-200")}
                />
                {validationError && (
                  <p className="text-xs text-red-600">{validationError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-sm">City</Label>
                <Input
                  id="city"
                  placeholder="e.g., Portland"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="state-province" className="text-sm">State/Province</Label>
                <Input
                  id="state-province"
                  placeholder="e.g., Oregon or BC"
                  value={formData.stateProvince}
                  onChange={(e) => setFormData(prev => ({ ...prev, stateProvince: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-sm">Country</Label>
                <Input
                  id="country"
                  value={formData.country === 'US' ? 'United States' : formData.country === 'CA' ? 'Canada' : ''}
                  disabled
                  placeholder="Auto-detected from postal code"
                  className="bg-muted"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          {(showWarning || manualEntry) && (
            <Button
              onClick={handleConfirm}
              disabled={!formData.postalCode || !!validationError || isSaving}
              className="flex-1 sm:flex-none"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Location
                </>
              )}
            </Button>
          )}
          
          {onRedetect && (
            <Button
              variant="outline"
              onClick={handleRedetectClick}
              disabled={isRedetecting}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isRedetecting && "animate-spin")} />
              Re-detect from website
            </Button>
          )}
        </div>

        {/* Change Location Dialog */}
        <AlertDialog open={showChangeDialog} onOpenChange={setShowChangeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>New Locations Detected</AlertDialogTitle>
              <AlertDialogDescription>
                We found {pendingCandidates.length} location{pendingCandidates.length > 1 ? 's' : ''} on your website that differ from your confirmed location ({postalCode}).
                <div className="mt-3 space-y-2">
                  {pendingCandidates.map((c, i) => (
                    <div key={i} className="text-sm font-medium text-foreground">
                      • {c.postal_code} {c.city && `- ${c.city}`}{c.state_province && `, ${c.state_province}`}
                    </div>
                  ))}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleKeepCurrent}>Keep Current</AlertDialogCancel>
              <AlertDialogAction onClick={handleChangeLocation}>Change Location</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
