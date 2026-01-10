import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Shield, 
  TrendingUp, 
  Mail, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Users,
  Lock,
  BarChart3
} from 'lucide-react';

export const EmailDomainGuide: React.FC = () => {
  return (
    <Accordion type="single" collapsible className="w-full">
      {/* Why Custom Domains */}
      <AccordionItem value="why-custom-domain" className="border rounded-lg px-4 mb-3">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Why Use a Custom Sending Domain?</p>
              <p className="text-sm text-muted-foreground font-normal">
                Better deliverability, brand recognition, and reputation control
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100">Better Inbox Placement</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Emails from authenticated domains are more likely to reach the inbox instead of spam.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">Brand Recognition</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Recipients see your brand in the "from" address, building trust and recognition.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <BarChart3 className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-900 dark:text-purple-100">Reputation Control</p>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Your sending reputation is yours alone—not affected by other senders.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-900 dark:text-orange-100">Higher Engagement</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      Customers are more likely to open emails from a brand they recognize.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Why Avoid Shared Domains?</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    When using a shared sending domain (like noreply@bloomsuite.app), your deliverability 
                    can be affected by other senders' practices. A bad actor on a shared domain can harm 
                    everyone's reputation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </AccordionContent>
      </AccordionItem>

      {/* How Authentication Works */}
      <AccordionItem value="authentication" className="border rounded-lg px-4 mb-3">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">How Email Authentication Works</p>
              <p className="text-sm text-muted-foreground font-normal">
                SPF, DKIM, and DMARC explained in plain language
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Email authentication uses DNS records to prove that emails actually come from you. 
            Think of it like showing ID when picking up a package—it proves you are who you say you are.
          </p>

          <div className="space-y-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">SPF</span>
                  </div>
                  <div>
                    <p className="font-medium">Sender Policy Framework</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">What it does:</span> Tells mailboxes which servers are allowed to send emails on your behalf.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Analogy:</span> Like a guest list at a venue—only approved servers can send as you.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-green-100 dark:bg-green-900">
                    <span className="text-xs font-bold text-green-700 dark:text-green-300">DKIM</span>
                  </div>
                  <div>
                    <p className="font-medium">DomainKeys Identified Mail</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">What it does:</span> Adds a digital signature to every email proving it hasn't been tampered with.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Analogy:</span> Like a wax seal on a letter—proves authenticity and that nothing was changed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-purple-100 dark:bg-purple-900">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">DMARC</span>
                  </div>
                  <div>
                    <p className="font-medium">Domain-based Message Authentication</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">What it does:</span> Tells mailboxes what to do if SPF or DKIM checks fail (reject, quarantine, or allow).
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Analogy:</span> Like a policy for what security should do if someone fails the guest list check.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-orange-100 dark:bg-orange-900">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-300">Return Path</span>
                  </div>
                  <div>
                    <p className="font-medium">Bounce Handling Address</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">What it does:</span> Specifies where bounce notifications (undeliverable emails) should be sent.
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">Analogy:</span> Like a return address on a package—where to send it back if delivery fails.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Sending Limits */}
      <AccordionItem value="limits" className="border rounded-lg px-4 mb-3">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Sending Limits & Reputation</p>
              <p className="text-sm text-muted-foreground font-normal">
                Understanding daily limits and maintaining good deliverability
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Your domain starts with full sending capacity. We monitor your bounce and complaint 
            rates to ensure good deliverability and protect your sender reputation.
          </p>

          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="font-medium mb-3">Default Sending Limits</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Daily limit</span>
                  <span className="font-medium">2,000 emails/day</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Hourly limit</span>
                  <span className="font-medium">500 emails/hour</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <CardContent className="pt-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-medium">Pro tip:</span> Send your best content to engaged 
                subscribers. High open rates and low bounces build a strong sender reputation.
              </p>
            </CardContent>
          </Card>
        </AccordionContent>
      </AccordionItem>


      {/* Best Practices */}
      <AccordionItem value="best-practices" className="border rounded-lg px-4 mb-3">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Best Practices for Email Success</p>
              <p className="text-sm text-muted-foreground font-normal">
                Keep your reputation healthy and maximize deliverability
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Only Email Opted-in Contacts</p>
                <p className="text-sm text-muted-foreground">
                  Never purchase email lists or add people without permission. Always use confirmed opt-ins.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Honor Unsubscribes Immediately</p>
                <p className="text-sm text-muted-foreground">
                  We automatically add unsubscribe links and process opt-outs instantly.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Remove Bounced Emails</p>
                <p className="text-sm text-muted-foreground">
                  We automatically track bounces. Repeatedly sending to invalid addresses hurts reputation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Monitor Your Metrics</p>
                <p className="text-sm text-muted-foreground">
                  Keep bounce rate under 5% and complaint rate under 0.2%. We'll warn you if you're approaching limits.
                </p>
              </div>
            </div>

            <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 mt-4">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-100">Automatic Protection</p>
                    <p className="text-sm text-red-700 dark:text-red-300">
                      If your bounce rate exceeds 5% or complaint rate exceeds 0.2%, we'll automatically 
                      pause your domain to protect your reputation. You'll be notified so you can address 
                      the issue.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Setup Process */}
      <AccordionItem value="setup-steps" className="border rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="font-medium">Setup Process Overview</p>
              <p className="text-sm text-muted-foreground font-normal">
                What to expect when connecting your domain
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />

            <div className="space-y-6">
              <div className="relative">
                <div className="absolute -left-5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] text-primary-foreground font-bold">1</span>
                </div>
                <div>
                  <p className="font-medium">Enter Your Domain</p>
                  <p className="text-sm text-muted-foreground">Click "Connect Domain" and enter your domain name (e.g., yourbusiness.com)</p>
                  <p className="text-xs text-muted-foreground mt-1">⏱️ Takes about 30 seconds</p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] text-primary-foreground font-bold">2</span>
                </div>
                <div>
                  <p className="font-medium">Add DNS Records</p>
                  <p className="text-sm text-muted-foreground">
                    We'll provide DNS records to add at your domain registrar (Cloudflare, GoDaddy, Namecheap, etc.)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">⏱️ Takes 5-10 minutes depending on your provider</p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] text-primary-foreground font-bold">3</span>
                </div>
                <div>
                  <p className="font-medium">Wait for Verification</p>
                  <p className="text-sm text-muted-foreground">
                    DNS changes take time to propagate across the internet. Click "Check DNS" to verify status.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">⏱️ Usually 15 minutes to 4 hours, can take up to 48 hours</p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] text-primary-foreground font-bold">4</span>
                </div>
                <div>
                  <p className="font-medium">Automatic Warm-up Begins</p>
                  <p className="text-sm text-muted-foreground">
                    Once verified, we start building your sending reputation with gradually increasing limits.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">⏱️ About 2 weeks to full capacity</p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
                <div>
                  <p className="font-medium text-green-600 dark:text-green-400">Ready to Send!</p>
                  <p className="text-sm text-muted-foreground">
                    Your domain is fully warmed up and ready for high-volume sending.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
