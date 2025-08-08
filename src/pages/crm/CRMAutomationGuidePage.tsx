import React, { lazy, Suspense, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const GuidedAutomationBuilder = lazy(() => import('@/components/automation/GuidedAutomationBuilder').then(m => ({ default: m.GuidedAutomationBuilder })));

export const CRMAutomationGuidePage: React.FC = () => {
  const { toast } = useToast();

  useEffect(() => {
    document.title = 'Build Your Custom Automation – Guide';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Build your custom automation with guided steps.');
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold text-foreground">Build Your Custom Automation</h1>
          <Link to="/crm/automations/new/canvas" aria-label="Switch to Canvas">
            <Button variant="outline">Switch to Canvas</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="max-w-5xl mx-auto p-4 md:p-6">
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading guide...</div>}>
            <GuidedAutomationBuilder
              onComplete={() => toast({ title: 'Blueprint ready', description: 'Open the canvas to continue designing.' })}
              onBack={() => window.history.back()}
            />
          </Suspense>
        </section>
      </main>
    </div>
  );
};
