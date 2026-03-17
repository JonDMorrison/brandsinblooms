import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupportSession } from '@/contexts/SupportSessionContext';
import { toast } from 'sonner';

function useDuration(startedAt: string | undefined): string {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setSeconds(0);
      return;
    }
    const start = new Date(startedAt).getTime();
    const update = () => setSeconds(Math.floor((Date.now() - start) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

export function SupportSessionBanner() {
  const { isInSupportSession, supportSession, endSession } = useSupportSession();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const duration = useDuration(supportSession?.startedAt);

  if (!isInSupportSession || !supportSession) return null;

  const handleExit = async () => {
    setEnding(true);
    try {
      await endSession();
      toast.success('Support session ended', {
        description: `Session for ${supportSession.tenantName} has been closed and logged.`,
      });
      navigate('/admin/tenants');
    } catch (err) {
      toast.error('Failed to end support session', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setEnding(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-md"
      data-testid="support-session-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">
          <strong>SUPPORT MODE</strong>&nbsp;— Viewing&nbsp;
          <strong>{supportSession.tenantName}</strong>
          {supportSession.reason && (
            <span className="opacity-75">&nbsp;({supportSession.reason})</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="hidden sm:flex items-center gap-1 text-amber-800">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {duration}
        </span>

        <Button
          size="sm"
          variant="outline"
          className="border-amber-800 bg-amber-600 text-amber-950 hover:bg-amber-700 hover:text-amber-950 h-7 px-3"
          onClick={handleExit}
          disabled={ending}
          data-testid="exit-support-session-btn"
        >
          <LogOut className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          {ending ? 'Ending…' : 'Exit Support Session'}
        </Button>
      </div>
    </div>
  );
}
