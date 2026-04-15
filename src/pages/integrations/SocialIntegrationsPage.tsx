import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Facebook, Instagram, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';

export default function SocialIntegrationsPage() {
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
          <Share2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Social Media</h1>
          <p className="text-muted-foreground">
            Connect your social accounts to publish and manage content
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Facebook */}
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Facebook className="w-6 h-6 text-blue-600" />
              <CardTitle className="text-base">Facebook</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Publish posts and manage your Facebook Pages
            </p>
            <Button onClick={() => navigate('/social-accounts')} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* Instagram */}
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Instagram className="w-6 h-6 text-pink-600" />
              <CardTitle className="text-base">Instagram</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share photos and stories to your Instagram Business account
            </p>
            <Button onClick={() => navigate('/social-accounts')} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
