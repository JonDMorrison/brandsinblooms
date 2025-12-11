import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { WarmupLimitDetails } from '@/utils/campaignSendingErrors';

const STAGE_LABELS: Record<number, string> = {
  0: 'Initial',
  1: 'Building',
  2: 'Growing',
  3: 'Maturing',
  4: 'Fully Warmed',
};

interface WarmupLimitModalProps {
  open: boolean;
  onClose: () => void;
  details: WarmupLimitDetails | null;
}

export function WarmupLimitModal({ open, onClose, details }: WarmupLimitModalProps) {
  if (!details) return null;

  const { warmupStage, dailyLimit, dailyUsed, remaining, requested } = details;
  const usagePercent = dailyLimit > 0 ? Math.min(100, (dailyUsed / dailyLimit) * 100) : 0;
  const stageLabel = STAGE_LABELS[warmupStage] || `Stage ${warmupStage}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle>Domain Warmup Limit Reached</DialogTitle>
              <DialogDescription>
                Your domain is still warming up
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Explanation */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Why is this happening?</p>
                <p>
                  New email domains need to build reputation gradually. Sending too many emails 
                  at once can hurt your deliverability and land you in spam folders.
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current Stage</span>
              <span className="font-medium">{stageLabel}</span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Today's Usage</span>
                <span className="font-medium">{dailyUsed} / {dailyLimit} emails</span>
              </div>
              <Progress value={usagePercent} className="h-2" />
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining Today</span>
              <span className={`font-medium ${remaining === 0 ? 'text-destructive' : 'text-amber-600'}`}>
                {remaining} emails
              </span>
            </div>

            <div className="flex justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">You Attempted</span>
              <span className="font-medium text-destructive">{requested} emails</span>
            </div>
          </div>

          {/* Options */}
          {remaining > 0 && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm">
                <span className="font-medium">Option: </span>
                You can send to up to <span className="font-semibold text-primary">{remaining}</span> recipients 
                now and schedule the rest for tomorrow.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild variant="outline" className="w-full">
            <Link to="/crm" onClick={onClose} className="flex items-center justify-center gap-2">
              View Warmup Assistant
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
