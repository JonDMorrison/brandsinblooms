import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Music2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CRMIntegrationsPage() {
  const navigate = useNavigate();

  const providers = [
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Import contacts, segments, and tags from Mailchimp',
      icon: Mail,
      color: 'text-yellow-600',
    },
    {
      id: 'klaviyo',
      name: 'Klaviyo',
      description: 'Import contacts, segments, and lists from Klaviyo',
      icon: Music2,
      color: 'text-purple-600',
    },
    {
      id: 'constant_contact',
      name: 'Constant Contact',
      description: 'Import contacts and lists from Constant Contact',
      icon: Mail,
      color: 'text-orange-600',
    },
  ];

  const handleStartMigration = (provider: string) => {
    navigate('/integrations/migrations', { state: { provider } });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link 
        to="/integrations" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Import Contacts</h1>
        <p className="text-muted-foreground">
          One-time import from your email marketing platform
        </p>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card key={provider.id} className="bg-card border border-border rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-muted ${provider.color}`}>
                  <provider.icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{provider.name}</h3>
                  <p className="text-sm text-muted-foreground">{provider.description}</p>
                </div>
                <Button onClick={() => handleStartMigration(provider.id)}>
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Includes contacts, consent status, tags, and segments with AI-powered field mapping
      </p>
    </div>
  );
}
