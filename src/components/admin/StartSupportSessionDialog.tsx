import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headset } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSupportSession } from '@/contexts/SupportSessionContext';
import { toast } from 'sonner';

interface StartSupportSessionDialogProps {
  tenantId: string;
  tenantName: string;
  /** Called after the session is successfully created */
  onStarted?: () => void;
  /** Render prop – lets the parent supply any trigger element */
  trigger?: React.ReactNode;
}

export function StartSupportSessionDialog({
  tenantId,
  tenantName,
  onStarted,
  trigger,
}: StartSupportSessionDialogProps) {
  const { startSession, isInSupportSession } = useSupportSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!reason.trim()) {
      toast.error('Please enter a reason before starting the session.');
      return;
    }

    setLoading(true);
    try {
      await startSession(tenantId, tenantName, reason.trim());
      toast.success('Support session started', {
        description: `You are now in support mode for ${tenantName}. All actions are logged.`,
      });
      setOpen(false);
      setReason('');
      onStarted?.();
      navigate(`/admin/support/${tenantId}`);
    } catch (err) {
      toast.error('Failed to start support session', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button
      variant="outline"
      size="sm"
      className="border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
      data-testid="start-support-session-btn"
    >
      <Headset className="mr-2 h-4 w-4" />
      {isInSupportSession ? 'Switch Support Session' : 'Start Support Session'}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start Support Session</DialogTitle>
          <DialogDescription>
            You are about to enter <strong>{tenantName}</strong> in support mode.
            This session will be{' '}
            <strong>audited and logged</strong> with your identity, the tenant,
            timestamps, and your stated reason.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="support-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="support-reason"
              placeholder="e.g. Customer reports campaigns not sending — investigating live configuration"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
              data-testid="support-reason-input"
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 characters
            </p>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
            <p className="font-medium">Before you continue:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Your name and admin ID will be recorded</li>
              <li>Session start and end times will be logged</li>
              <li>The tenant ID and name will be captured</li>
              <li>A visible banner will show throughout the session</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              setReason('');
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={loading || !reason.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
            data-testid="confirm-start-session-btn"
          >
            {loading ? 'Starting…' : 'Start Support Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
