import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmailDomainManagement } from '@/hooks/useEmailDomainManagement';

interface DomainSenderSettingsProps {
  domainId: string;
  open: boolean;
  onClose: () => void;
}

export const DomainSenderSettings: React.FC<DomainSenderSettingsProps> = ({ 
  domainId, 
  open, 
  onClose 
}) => {
  const { updateDomainSender, domains } = useEmailDomainManagement();
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const domain = domains.find(d => d.id === domainId);

  useEffect(() => {
    if (domain) {
      setFromName(domain.default_from_name || '');
      setFromEmail(domain.default_from_email || '');
    }
  }, [domain]);

  const handleSave = async () => {
    setError(null);

    if (!fromName.trim()) {
      setError('Please enter a sender name');
      return;
    }

    if (!fromEmail.trim()) {
      setError('Please enter a sender email');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate email belongs to domain
    if (domain && !fromEmail.toLowerCase().endsWith(`@${domain.domain}`)) {
      setError(`Email must end with @${domain.domain}`);
      return;
    }

    setLoading(true);
    const result = await updateDomainSender(domainId, fromName, fromEmail);
    setLoading(false);

    if (result.success) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Sender Settings
          </DialogTitle>
          <DialogDescription>
            Configure the default sender for emails sent from {domain?.domain}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="fromName">Sender Name</Label>
            <Input
              id="fromName"
              placeholder="Your Company Name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This name appears in the recipient's inbox
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromEmail">Sender Email</Label>
            <Input
              id="fromEmail"
              placeholder={domain ? `news@${domain.domain}` : 'email@yourdomain.com'}
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Must be an address on your verified domain
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Using a recognizable sender name and email improves open rates and deliverability.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
