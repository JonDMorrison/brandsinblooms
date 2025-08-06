import React from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle, XCircle, Lightbulb } from 'lucide-react'
import { ImageValidationResult } from '@/lib/validation/imageValidation'

interface ValidationSummaryProps {
  validation: ImageValidationResult
  imageCount: number
  showOptimizations?: boolean
  className?: string
}

export function ValidationSummary({ 
  validation, 
  imageCount, 
  showOptimizations = true,
  className = '' 
}: ValidationSummaryProps) {
  const hasIssues = validation.errors.length > 0 || validation.warnings.length > 0
  const hasOptimizations = validation.optimizations.length > 0

  if (!hasIssues && (!showOptimizations || !hasOptimizations)) {
    return (
      <Alert className={`border-green-200 bg-green-50 ${className}`}>
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          {imageCount === 0 
            ? 'Ready to add images' 
            : `${imageCount} image${imageCount !== 1 ? 's' : ''} validated successfully`
          }
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Errors */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">
                {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''} found:
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="space-y-1">
              <div className="font-medium">
                {validation.warnings.length} warning{validation.warnings.length !== 1 ? 's' : ''}:
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Optimizations */}
      {showOptimizations && validation.optimizations.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="space-y-2">
              <div className="font-medium">
                Optimization suggestions:
              </div>
              <ul className="space-y-1 text-sm">
                {validation.optimizations.map((optimization, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                      Tip
                    </Badge>
                    <span>{optimization}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}