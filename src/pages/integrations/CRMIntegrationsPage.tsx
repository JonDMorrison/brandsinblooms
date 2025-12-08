import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Mail, Download, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function CRMIntegrationsPage() {
  const navigate = useNavigate();

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
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">CRM & Email</h1>
          <p className="text-muted-foreground">
            Import contacts and sync with your marketing tools
          </p>
        </div>
      </div>

      {/* Data Migration Tool - Featured */}
      <Card className="bg-card border-2 border-primary/20 rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <Download className="w-6 h-6 text-primary" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Data Migration Tool</CardTitle>
                <Badge className="bg-primary text-primary-foreground">Recommended</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            One-time import from Mailchimp or Klaviyo with AI-powered field mapping
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ Contacts & Consent</li>
            <li>✓ Tags & Segments</li>
            <li>✓ AI Auto-Mapping</li>
            <li>✓ Reconciliation Report</li>
          </ul>
          <Button onClick={() => navigate('/integrations/migrations')} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Start Migration
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mailchimp */}
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Mail className="w-6 h-6 text-yellow-600" />
              <CardTitle className="text-base">Mailchimp</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sync leads and send targeted email campaigns
            </p>
            <Button variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* HubSpot */}
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Users className="w-6 h-6 text-orange-500" />
              <CardTitle className="text-base">HubSpot</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sync contacts and track lead engagement
            </p>
            <Button variant="outline" className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
