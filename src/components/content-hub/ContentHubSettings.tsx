import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, ExternalLink, Calendar, Globe, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Campaign {
  id: string;
  title: string;
  slug?: string;
  hub_enabled?: boolean;
  hub_expiry?: string;
}

interface ContentHubSettingsProps {
  campaign: Campaign;
  onCampaignUpdate: (updates: Partial<Campaign>) => void;
  onSave?: () => void;
}

export const ContentHubSettings: React.FC<ContentHubSettingsProps> = ({
  campaign,
  onCampaignUpdate,
  onSave
}) => {
  const { toast } = useToast();
  const [localSlug, setLocalSlug] = useState(campaign.slug || '');
  const [localExpiry, setLocalExpiry] = useState(campaign.hub_expiry || '');
  const [isGeneratingSlug, setIsGeneratingSlug] = useState(false);

  // Generate slug from campaign title
  const generateSlug = async () => {
    setIsGeneratingSlug(true);
    try {
      // Simple slug generation - in production, this might call the database function
      const baseSlug = campaign.title
        .toLowerCase()
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

      const timestamp = Date.now().toString().slice(-6);
      const newSlug = baseSlug.length >= 3 ? baseSlug : `${baseSlug}-${timestamp}`;
      
      setLocalSlug(newSlug);
      onCampaignUpdate({ slug: newSlug });
      
      toast({
        title: "Slug generated",
        description: "Campaign slug has been generated from the title."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate slug. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingSlug(false);
    }
  };

  const handleSlugChange = (value: string) => {
    // Validate slug format
    const cleanSlug = value
      .toLowerCase()
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/-+/g, '-');
    
    setLocalSlug(cleanSlug);
    onCampaignUpdate({ slug: cleanSlug });
  };

  const handleExpiryChange = (value: string) => {
    setLocalExpiry(value);
    onCampaignUpdate({ hub_expiry: value });
  };

  const handleEnabledChange = (enabled: boolean) => {
    onCampaignUpdate({ hub_enabled: enabled });
  };

  const getHubUrl = () => {
    if (!campaign.slug) return '';
    // In production, this would use your actual domain
    return `https://gc.ly/${campaign.slug}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "URL copied to clipboard."
    });
  };

  const openPreview = () => {
    const url = getHubUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Auto-generate expiry date (30 days from now) if not set
  useEffect(() => {
    if (campaign.hub_enabled && !localExpiry) {
      const defaultExpiry = new Date();
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);
      const expiryString = defaultExpiry.toISOString().split('T')[0];
      setLocalExpiry(expiryString);
      onCampaignUpdate({ hub_expiry: expiryString });
    }
  }, [campaign.hub_enabled]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Content Hub Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure your mobile-optimized content hub for this campaign.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Hub Status
              </CardTitle>
              <CardDescription>
                Enable or disable the content hub for this campaign
              </CardDescription>
            </div>
            <Switch
              checked={campaign.hub_enabled || false}
              onCheckedChange={handleEnabledChange}
            />
          </div>
        </CardHeader>
        
        {campaign.hub_enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hub-slug">Hub URL Slug</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="hub-slug"
                    value={localSlug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="my-special-offer"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only letters, numbers, and hyphens allowed
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={generateSlug}
                  disabled={isGeneratingSlug}
                  className="shrink-0"
                >
                  Generate
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hub-expiry">Expiry Date</Label>
              <Input
                id="hub-expiry"
                type="date"
                value={localExpiry}
                onChange={(e) => handleExpiryChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                After this date, the hub will show an "expired" message
              </p>
            </div>

            {campaign.slug && (
              <div className="space-y-3">
                <Label>Hub URL</Label>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <code className="flex-1 text-sm font-mono">
                    {getHubUrl()}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(getHubUrl())}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openPreview}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
                
                <Alert>
                  <Smartphone className="h-4 w-4" />
                  <AlertDescription>
                    This URL can be used in SMS messages using the <code>{'{{HUB}}'}</code> macro, 
                    which will be automatically replaced with a shortened link.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Badge variant="outline" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                Mobile Optimized
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Globe className="w-3 h-3 mr-1" />
                Analytics Enabled
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Smartphone className="w-3 h-3 mr-1" />
                Share Features
              </Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {campaign.hub_enabled && !campaign.slug && (
        <Alert>
          <AlertDescription>
            Please set a URL slug to enable the content hub functionality.
          </AlertDescription>
        </Alert>
      )}

      {onSave && (
        <div className="flex justify-end">
          <Button onClick={onSave} className="min-w-24">
            Save Settings
          </Button>
        </div>
      )}
    </div>
  );
};