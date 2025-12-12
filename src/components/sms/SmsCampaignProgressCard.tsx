import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  MessageSquareIcon, 
  CheckCircle2Icon, 
  XCircleIcon, 
  ClockIcon, 
  AlertTriangleIcon,
  LoaderIcon,
  SendIcon
} from 'lucide-react'
import { SmsCampaignProgress } from '@/lib/sms/getSmsCampaignProgress'

interface SmsCampaignProgressCardProps {
  progress: SmsCampaignProgress | null
  loading?: boolean
  error?: Error | null
}

export function SmsCampaignProgressCard({ progress, loading, error }: SmsCampaignProgressCardProps) {
  if (loading && !progress) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading progress...</span>
        </CardContent>
      </Card>
    )
  }

  if (error && !progress) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Error loading progress</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  if (!progress) return null

  const { jobs, messages, rates, isComplete, isStalled, stallReason } = progress

  // Calculate progress percentage
  const processedMessages = messages.sent + messages.delivered + messages.failed
  const progressPercent = messages.total > 0 
    ? Math.round((processedMessages / messages.total) * 100) 
    : 0

  // Status display
  const getStatusBadge = () => {
    if (isComplete && messages.failed === 0) {
      return <Badge className="bg-green-500 hover:bg-green-600">Complete</Badge>
    }
    if (isComplete && messages.failed > 0) {
      return <Badge variant="secondary">Completed with errors</Badge>
    }
    if (isStalled) {
      return <Badge variant="destructive">Stalled</Badge>
    }
    if (jobs.in_progress > 0) {
      return <Badge variant="secondary" className="animate-pulse">Processing</Badge>
    }
    if (jobs.pending > 0) {
      return <Badge variant="outline">Queued</Badge>
    }
    return <Badge variant="outline">{progress.campaignStatus}</Badge>
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <SendIcon className="h-5 w-5" />
              Sending Progress
            </CardTitle>
            <CardDescription>
              Real-time campaign delivery status
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stall Warning */}
        {isStalled && stallReason && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertTitle>Campaign Stalled</AlertTitle>
            <AlertDescription>{stallReason}</AlertDescription>
          </Alert>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {processedMessages.toLocaleString()} of {messages.total.toLocaleString()} messages processed
          </p>
        </div>

        {/* Message Counts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClockIcon className="h-3.5 w-3.5" />
              <span className="text-xs">Queued</span>
            </div>
            <div className="text-xl font-semibold">{messages.queued.toLocaleString()}</div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <MessageSquareIcon className="h-3.5 w-3.5" />
              <span className="text-xs">Sent</span>
            </div>
            <div className="text-xl font-semibold">{messages.sent.toLocaleString()}</div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
              <CheckCircle2Icon className="h-3.5 w-3.5" />
              <span className="text-xs">Delivered</span>
            </div>
            <div className="text-xl font-semibold">{messages.delivered.toLocaleString()}</div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-destructive mb-1">
              <XCircleIcon className="h-3.5 w-3.5" />
              <span className="text-xs">Failed</span>
            </div>
            <div className="text-xl font-semibold">{messages.failed.toLocaleString()}</div>
          </div>
        </div>

        {/* Rates */}
        {messages.total > 0 && (processedMessages > 0) && (
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Delivery Rate:</span>{' '}
              <span className="font-medium text-green-600 dark:text-green-400">
                {(rates.deliveredRate * 100).toFixed(1)}%
              </span>
            </div>
            {messages.failed > 0 && (
              <div>
                <span className="text-muted-foreground">Failure Rate:</span>{' '}
                <span className="font-medium text-destructive">
                  {(rates.failedRate * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Job Status (collapsible detail) */}
        {jobs.total > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-muted-foreground mb-2">Worker Jobs</div>
            <div className="flex flex-wrap gap-2 text-xs">
              {jobs.pending > 0 && (
                <Badge variant="outline" className="font-normal">
                  {jobs.pending} pending
                </Badge>
              )}
              {jobs.in_progress > 0 && (
                <Badge variant="secondary" className="font-normal">
                  {jobs.in_progress} processing
                </Badge>
              )}
              {jobs.completed > 0 && (
                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 font-normal">
                  {jobs.completed} completed
                </Badge>
              )}
              {jobs.failed > 0 && (
                <Badge variant="destructive" className="font-normal">
                  {jobs.failed} failed
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Timestamps */}
        {progress.timestamps.lastJobUpdatedAt && (
          <div className="text-xs text-muted-foreground pt-2">
            Last update: {new Date(progress.timestamps.lastJobUpdatedAt).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
