import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store } from 'lucide-react';
import { LightspeedIntegration } from '@/components/integrations/LightspeedIntegration';
import { SquareIntegration } from '@/components/integrations/SquareIntegration';

export default function POSIntegrationsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link 
        to="/integrations" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <p className="text-muted-foreground">
            Connect your POS to sync customers, orders, and purchase data
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LightspeedIntegration />
        <SquareIntegration />
      </div>
    </div>
  );
}
