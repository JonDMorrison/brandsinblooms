import React, { useState, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { ImageIcon, UserIcon, PhoneIcon, MessageSquareIcon } from 'lucide-react'
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage'
import { MultiImageUpload } from './MultiImageUpload'
import { CarrierStatus } from './CarrierStatus'

interface SMSComposerProps {
  value: string
  onChange: (value: string) => void
  imageUrl?: string
  onImageChange?: (imageUrl: string | null) => void
  mediaUrls?: string[]
  onMediaUrlsChange?: (urls: string[]) => void
  maxLength?: number
  placeholder?: string
  showMergeTags?: boolean
  showCharacterCount?: boolean
  showMmsWarning?: boolean
  showImageUpload?: boolean
  enableMultiImage?: boolean
  testPhoneNumber?: string
  className?: string
}

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First Name', icon: UserIcon },
  { tag: '{{last_name}}', label: 'Last Name', icon: UserIcon },
  { tag: '{{phone}}', label: 'Phone', icon: PhoneIcon },
  { tag: '{{email}}', label: 'Email', icon: MessageSquareIcon },
]

export function SMSComposer({
  value,
  onChange,
  imageUrl,
  onImageChange,
  mediaUrls = [],
  onMediaUrlsChange,
  maxLength = 320,
  placeholder = "Type your SMS message...",
  showMergeTags = true,
  showCharacterCount = true,
  showMmsWarning = true,
  showImageUpload = true,
  enableMultiImage = false,
  testPhoneNumber,
  className = ""
}: SMSComposerProps) {
  const [showMergeTagMenu, setShowMergeTagMenu] = useState(false)

  const characterCount = value.length
  const isOverLimit = characterCount > maxLength
  const isNearLimit = characterCount > maxLength * 0.8
  const segmentCount = Math.ceil(characterCount / 160) || 1

  const insertMergeTag = useCallback((tag: string) => {
    const textarea = document.querySelector('textarea[data-sms-composer="true"]') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newValue = value.substring(0, start) + tag + value.substring(end)
    
    onChange(newValue)
    setShowMergeTagMenu(false)

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + tag.length, start + tag.length)
    }, 0)
  }, [value, onChange])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* SMS Input */}
      <div className="relative">
        <Textarea
          data-sms-composer="true"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`min-h-[120px] resize-none ${isOverLimit ? 'border-destructive' : ''}`}
          maxLength={maxLength + 50} // Allow slight overflow for warning
        />
        
        {/* Character Count & Status */}
        {showCharacterCount && (
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <Badge 
              variant={isOverLimit ? "destructive" : isNearLimit ? "secondary" : "outline"}
              className="text-xs"
            >
              {characterCount}/{maxLength}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {segmentCount} SMS
            </Badge>
          </div>
        )}
      </div>

      {/* Merge Tags */}
      {showMergeTags && (
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowMergeTagMenu(!showMergeTagMenu)}
            className="h-8"
          >
            <UserIcon className="h-3 w-3 mr-1" />
            Insert Merge Tag
          </Button>

          {showMergeTagMenu && (
            <Card className="absolute top-10 left-0 z-50 w-48 shadow-lg">
              <CardContent className="p-2">
                <div className="space-y-1">
                  {MERGE_TAGS.map((mergeTag) => (
                    <Button
                      key={mergeTag.tag}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8"
                      onClick={() => insertMergeTag(mergeTag.tag)}
                    >
                      <mergeTag.icon className="h-3 w-3 mr-2" />
                      {mergeTag.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Image Upload */}
      {showImageUpload && (
        <div className="space-y-3">
          {enableMultiImage ? (
            <MultiImageUpload
              value={mediaUrls}
              onChange={(urls) => onMediaUrlsChange?.(urls)}
              maxFiles={3}
              maxSizePerFile={500}
            />
          ) : (
            <>
              <h4 className="text-sm font-medium">Add Image (MMS)</h4>
              
              <MediaSelectorImage
                src={imageUrl || ''}
                onChange={(imageUrl) => onImageChange?.(imageUrl)}
                contentContext="SMS MMS image attachment"
                className="h-32"
              />
              
              {imageUrl && (
                <Badge variant="secondary" className="text-xs">
                  <ImageIcon className="h-3 w-3 mr-1" />
                  Will send as MMS
                </Badge>
              )}
            </>
          )}
        </div>
      )}

      {/* Carrier Status & Compatibility Check */}
      {testPhoneNumber && (mediaUrls.length > 0 || imageUrl) && (
        <CarrierStatus 
          phoneNumber={testPhoneNumber}
          mediaUrls={enableMultiImage ? mediaUrls : (imageUrl ? [imageUrl] : [])}
        />
      )}

      {/* Warnings & Info */}
      <div className="space-y-2">
        {isOverLimit && (
          <Alert variant="destructive">
            <AlertDescription>
              Message exceeds {maxLength} characters. It will be split into {segmentCount} SMS messages.
            </AlertDescription>
          </Alert>
        )}

        {showMmsWarning && characterCount > 160 && (
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>
              Long messages may be converted to MMS on some carriers.
            </AlertDescription>
          </Alert>
        )}

        {segmentCount > 1 && !isOverLimit && (
          <div className="text-sm text-muted-foreground">
            This message will be sent as {segmentCount} SMS segments.
          </div>
        )}
      </div>
    </div>
  )
}