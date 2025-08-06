import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InfoIcon, AlertTriangleIcon, CheckCircleIcon } from 'lucide-react'
import { detectCarrier, canReceiveMms, shouldUseFallback } from '@/lib/sms/carrierDetection'

interface CarrierStatusProps {
  phoneNumber: string
  mediaUrls: string[]
  className?: string
}

export function CarrierStatus({ phoneNumber, mediaUrls, className = "" }: CarrierStatusProps) {
  if (!phoneNumber) return null

  const carrierInfo = detectCarrier(phoneNumber)
  const supportsMms = canReceiveMms(phoneNumber)
  const needsFallback = shouldUseFallback(phoneNumber, mediaUrls)

  if (mediaUrls.length === 0) {
    return (
      <div className={`space-y-2 ${className}`}>
        <Badge variant="outline" className="text-xs">
          <CheckCircleIcon className="h-3 w-3 mr-1" />
          SMS Compatible
        </Badge>
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Carrier Support Badge */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={supportsMms ? "secondary" : "outline"} 
          className="text-xs"
        >
          {supportsMms ? (
            <>
              <CheckCircleIcon className="h-3 w-3 mr-1" />
              MMS Supported
            </>
          ) : (
            <>
              <InfoIcon className="h-3 w-3 mr-1" />
              SMS Only
            </>
          )}
        </Badge>
        
        <Badge variant="outline" className="text-xs">
          {carrierInfo.region} • {carrierInfo.carrier}
        </Badge>
      </div>

      {/* Fallback Warning */}
      {needsFallback && (
        <Alert>
          <AlertTriangleIcon className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {!supportsMms 
              ? "Images will be sent as links via SMS (carrier doesn't support MMS)"
              : "Multiple images may be sent as links for better compatibility"
            }
          </AlertDescription>
        </Alert>
      )}

      {/* MMS Info for supported carriers */}
      {supportsMms && !needsFallback && mediaUrls.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Will send as MMS with {mediaUrls.length} image{mediaUrls.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}