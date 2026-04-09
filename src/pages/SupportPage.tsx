import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BookOpen, ExternalLink, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const KNOWLEDGE_BASE_URL = 'https://bloomsuite.notion.site/bloomsuite-help';

const SupportPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [ticketOpen, setTicketOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from the signed-in user whenever the dialog opens
  useEffect(() => {
    if (ticketOpen) {
      const metaName =
        (user?.user_metadata?.full_name as string | undefined) ??
        (user?.user_metadata?.name as string | undefined) ??
        '';
      setName(metaName);
      setEmail(user?.email ?? '');
      setSubject('');
      setMessage('');
    }
  }, [ticketOpen, user]);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-support-ticket', {
        body: {
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        },
      });

      if (error) throw error;
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }

      toast({
        title: 'Message sent',
        description: "Your message has been sent. We'll get back to you within 1 business day.",
      });
      setTicketOpen(false);
    } catch (err) {
      toast({
        title: 'Could not send message',
        description: err instanceof Error ? err.message : 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Support & Help</h1>
        <p className="text-muted-foreground">
          Get help and support for your BloomSuite account
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Contact Support
            </CardTitle>
            <CardDescription>
              Send us a message and we'll reply within 1 business day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setTicketOpen(true)}>
              Create a ticket
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Knowledge Base
            </CardTitle>
            <CardDescription>
              Browse guides, how-tos, and best practices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              asChild
            >
              <a
                href={KNOWLEDGE_BASE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit Knowledge Base
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Contact Support</DialogTitle>
              <DialogDescription>
                Send us a message. We'll reply within 1 business day.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="support-name">Name</Label>
              <Input
                id="support-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-email">Email</Label>
              <Input
                id="support-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-subject">Subject</Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea
                id="support-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe what you need help with..."
                rows={6}
                disabled={submitting}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setTicketOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportPage;
