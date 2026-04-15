import React, { useState } from 'react'
import { Button } from '@/components/ui-legacy/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui-legacy/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui-legacy/alert-dialog'
import { 
  RefreshCwIcon, 
  DownloadIcon, 
  MoreVerticalIcon,
  LoaderIcon,
  AlertTriangleIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { retryFailedMessages, downloadFailedMessages } from '@/lib/sms/smsRetryService'

interface SmsCampaignActionsProps {
  campaignId: string
  failedCount: number
  onRetryComplete?: () => void
}

export function SmsCampaignActions({ campaignId, failedCount, onRetryComplete }: SmsCampaignActionsProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showRetryDialog, setShowRetryDialog] = useState(false)

  const handleRetry = async () => {
    setShowRetryDialog(false)
    setIsRetrying(true)

    try {
      const result = await retryFailedMessages(campaignId, 'all_failed')
      
      if (result.success) {
        if (result.countReset > 0) {
          toast.success(`Retrying ${result.countReset} messages`, {
            description: result.countSkippedOptOut + result.countSkippedSuppressed > 0
              ? `Skipped: ${result.countSkippedOptOut} opted-out, ${result.countSkippedSuppressed} suppressed`
              : undefined
          })
          onRetryComplete?.()
        } else {
          toast.info('No messages to retry', {
            description: 'All failed messages have opted-out or suppressed recipients'
          })
        }
      } else {
        toast.error('Failed to retry messages', {
          description: result.error
        })
      }
    } catch (error) {
      toast.error('Failed to retry messages', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsRetrying(false)
    }
  }

  const handleDownload = async () => {
    setIsDownloading(true)

    try {
      await downloadFailedMessages(campaignId)
      toast.success('Download started')
    } catch (error) {
      toast.error('Failed to download', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsDownloading(false)
    }
  }

  if (failedCount === 0) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreVerticalIcon className="h-4 w-4 mr-1" />
            Failed Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={() => setShowRetryDialog(true)}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4 mr-2" />
            )}
            Retry Failed ({failedCount})
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <DownloadIcon className="h-4 w-4 mr-2" />
            )}
            Download Failed CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
              Retry Failed Messages
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will queue {failedCount} failed messages to be sent again. 
              Messages to opted-out or suppressed customers will be skipped.
              <br /><br />
              <strong>Note:</strong> This may incur additional SMS charges for successfully sent messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetry}>
              Retry Messages
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
