import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Copy, Download, ExternalLink, Info, Check, Camera } from 'lucide-react';
import { downloadUnsplashImage, copyAttributionToClipboard, generateAttributionText, UnsplashDownloadData } from '@/services/unsplashDownloadService';
import { toast } from '@/hooks/use-toast';

interface UnsplashAttributionProps {
  photographer: string;
  photographerUrl?: string;
  photographerUsername?: string;
  unsplashId: string;
  imageUrl: string;
  downloadLocation?: string;
  urls?: {
    raw?: string;
    full?: string;
    regular?: string;
    small?: string;
    thumb?: string;
  };
  className?: string;
  showDownload?: boolean;
  showAttribution?: boolean;
  compact?: boolean;
}

type Platform = 'facebook' | 'instagram' | 'email' | 'blog' | 'copy';
type Quality = 'raw' | 'full' | 'regular';

export const UnsplashAttribution: React.FC<UnsplashAttributionProps> = ({
  photographer,
  photographerUrl,
  photographerUsername,
  unsplashId,
  imageUrl,
  downloadLocation,
  urls,
  className = '',
  showDownload = true,
  showAttribution = true,
  compact = false
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('copy');
  const [selectedQuality, setSelectedQuality] = useState<Quality>('raw');
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | null>(null);

  const handleDownload = async () => {
    setIsDownloading(true);
    
    try {
      const downloadData: UnsplashDownloadData = {
        imageUrl: getQualityUrl(selectedQuality),
        photographer,
        photographerUsername,
        photographerUrl,
        unsplashId,
        downloadLocation,
        quality: selectedQuality
      };
      
      const result = await downloadUnsplashImage(downloadData);
      
      if (result.success) {
        toast({
          title: "Download successful",
          description: `High-resolution image downloaded: ${result.filename}`,
        });
      } else {
        toast({
          title: "Download failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyAttribution = async (platform: Platform) => {
    const success = await copyAttributionToClipboard(photographer, photographerUrl, platform);
    
    if (success) {
      setCopiedPlatform(platform);
      toast({
        title: "Attribution copied",
        description: `Attribution copied for ${platform}!`,
      });
      setTimeout(() => setCopiedPlatform(null), 2000);
    } else {
      toast({
        title: "Copy failed",
        description: "Failed to copy attribution",
        variant: "destructive",
      });
    }
  };

  const getQualityUrl = (quality: Quality): string => {
    if (!urls) return imageUrl;
    
    switch (quality) {
      case 'raw':
        return urls.raw || urls.full || urls.regular || imageUrl;
      case 'full':
        return urls.full || urls.regular || imageUrl;
      case 'regular':
        return urls.regular || imageUrl;
      default:
        return imageUrl;
    }
  };

  const getQualityLabel = (quality: Quality): string => {
    switch (quality) {
      case 'raw':
        return 'Highest Quality (Raw)';
      case 'full':
        return 'High Quality (Full)';
      case 'regular':
        return 'Standard Quality';
      default:
        return 'Standard Quality';
    }
  };

  const platformOptions = [
    { value: 'copy' as Platform, label: 'Copy Link' },
    { value: 'facebook' as Platform, label: 'Facebook' },
    { value: 'instagram' as Platform, label: 'Instagram' },
    { value: 'email' as Platform, label: 'Email' },
    { value: 'blog' as Platform, label: 'Blog/Website' },
  ];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="secondary" className="text-xs">
          <Camera className="w-3 h-3 mr-1" />
          {photographer}
        </Badge>
        
        {showDownload && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="h-6 w-6 p-0"
                >
                  <Download className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download high-res image</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        {photographerUrl && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.open(photographerUrl, '_blank')}
                  className="h-6 w-6 p-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View photographer's profile</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-surface-primary/30 rounded-lg border border-primary/10 p-3 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-text-primary">Photo Attribution</span>
          </div>
          
          <div className="text-sm text-text-secondary">
            Photo by{' '}
            {photographerUrl ? (
              <a
                href={photographerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 font-medium"
              >
                {photographer}
              </a>
            ) : (
              <span className="font-medium">{photographer}</span>
            )}{' '}
            on{' '}
            <a
              href="https://unsplash.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 font-medium"
            >
              Unsplash
            </a>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {showAttribution && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Info className="w-4 h-4 mr-1" />
                  Attribution
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Copy Attribution</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Platform</label>
                    <NativeSelect 
                      value={selectedPlatform} 
                      onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
                      options={platformOptions.map(option => ({
                        value: option.value,
                        label: option.label
                      }))}
                    />
                  </div>
                  
                  <div className="bg-surface-secondary/50 p-3 rounded-lg">
                    <p className="text-xs text-text-tertiary mb-1">Attribution text:</p>
                    <code className="text-sm text-text-primary">
                      {generateAttributionText(photographer, photographerUrl, selectedPlatform)}
                    </code>
                  </div>
                  
                  <Button
                    onClick={() => handleCopyAttribution(selectedPlatform)}
                    className="w-full"
                    disabled={copiedPlatform === selectedPlatform}
                  >
                    {copiedPlatform === selectedPlatform ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Attribution
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {showDownload && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="default">
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Download High-Resolution Image</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Quality</label>
                    <NativeSelect 
                      value={selectedQuality} 
                      onChange={(e) => setSelectedQuality(e.target.value as Quality)}
                      options={[
                        ...(urls?.raw ? [{ value: 'raw' as const, label: 'Highest Quality (Raw)' }] : []),
                        ...(urls?.full ? [{ value: 'full' as const, label: 'High Quality (Full)' }] : []),
                        { value: 'regular' as const, label: 'Standard Quality' }
                      ]}
                    />
                  </div>
                  
                  <div className="bg-surface-secondary/50 p-3 rounded-lg">
                    <p className="text-xs text-text-tertiary mb-1">Download includes:</p>
                    <ul className="text-sm text-text-primary space-y-1">
                      <li>• {getQualityLabel(selectedQuality)}</li>
                      <li>• Photographer attribution in filename</li>
                      <li>• Automatic Unsplash download tracking</li>
                    </ul>
                  </div>
                  
                  <Button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full"
                  >
                    {isDownloading ? (
                      'Downloading...'
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Download {getQualityLabel(selectedQuality)}
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  );
};