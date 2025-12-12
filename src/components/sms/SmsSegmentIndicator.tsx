import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Info } from 'lucide-react';
import { 
  countSmsSegments, 
  hasUnicodeCharacters, 
  getUnicodeCharacters,
  type SmsSegmentInfo 
} from '@/lib/sms/smsSegmentCounter';

interface SmsSegmentIndicatorProps {
  text: string;
  isMms?: boolean;
  mmsUnitCost?: number;
  showDetails?: boolean;
  className?: string;
}

export function SmsSegmentIndicator({
  text,
  isMms = false,
  mmsUnitCost = 3,
  showDetails = true,
  className = ''
}: SmsSegmentIndicatorProps) {
  const segmentInfo = countSmsSegments(text);
  const hasUnicode = hasUnicodeCharacters(text);
  const unicodeChars = hasUnicode ? getUnicodeCharacters(text) : [];
  
  // Calculate billable units
  const billableUnits = isMms ? mmsUnitCost : segmentInfo.segments;
  
  // Determine warning level
  const isWarning = segmentInfo.segments > 1 || hasUnicode;
  const isCritical = segmentInfo.segments > 3;
  
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Main indicator badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge 
          variant={isCritical ? 'destructive' : isWarning ? 'secondary' : 'outline'}
          className="text-xs"
        >
          {billableUnits} credit{billableUnits !== 1 ? 's' : ''}
        </Badge>
        
        {!isMms && segmentInfo.segments > 0 && (
          <Badge variant="outline" className="text-xs">
            {segmentInfo.segments} segment{segmentInfo.segments !== 1 ? 's' : ''}
          </Badge>
        )}
        
        <Badge 
          variant={segmentInfo.encoding === 'UCS-2' ? 'secondary' : 'outline'} 
          className="text-xs"
        >
          {isMms ? 'MMS' : segmentInfo.encoding}
        </Badge>
      </div>
      
      {/* Detailed warnings */}
      {showDetails && (
        <>
          {/* Unicode warning */}
          {hasUnicode && !isMms && (
            <Alert className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Unicode detected ({unicodeChars.slice(0, 5).join(' ')}{unicodeChars.length > 5 ? '...' : ''}).
                This reduces characters per segment from 160 to 70.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Multipart warning */}
          {segmentInfo.isMultipart && !isMms && !hasUnicode && (
            <Alert className="py-2">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Long message will be sent as {segmentInfo.segments} segments 
                ({segmentInfo.charCount} chars, {segmentInfo.perSegment}/segment).
              </AlertDescription>
            </Alert>
          )}
          
          {/* MMS info */}
          {isMms && (
            <Alert className="py-2">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                MMS message with media. Charged as {mmsUnitCost} credits.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function SmsSegmentBadge({
  text,
  isMms = false,
  mmsUnitCost = 3
}: {
  text: string;
  isMms?: boolean;
  mmsUnitCost?: number;
}) {
  const segmentInfo = countSmsSegments(text);
  const billableUnits = isMms ? mmsUnitCost : segmentInfo.segments;
  const hasUnicode = hasUnicodeCharacters(text);
  
  return (
    <Badge 
      variant={hasUnicode || segmentInfo.segments > 1 ? 'secondary' : 'outline'}
      className="text-xs"
    >
      {billableUnits} credit{billableUnits !== 1 ? 's' : ''} 
      {!isMms && segmentInfo.encoding === 'UCS-2' && ' (Unicode)'}
    </Badge>
  );
}
