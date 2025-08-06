import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Database, Users, Zap } from 'lucide-react';
import { useGeoSegmentation } from '@/hooks/useGeoSegmentation';
import { useToast } from '@/hooks/use-toast';

export const GeoEnrichmentPanel: React.FC = () => {
  const [enrichmentStatus, setEnrichmentStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const { loading, batchEnrichGeoData } = useGeoSegmentation();
  const { toast } = useToast();

  const handleEnrichment = async () => {
    setEnrichmentStatus('running');
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.random() * 10;
      });
    }, 500);

    try {
      const success = await batchEnrichGeoData(100);
      
      if (success) {
        setProgress(100);
        setEnrichmentStatus('complete');
        toast({
          title: "Enrichment Complete",
          description: "Customer location data has been successfully enriched"
        });
      } else {
        setEnrichmentStatus('idle');
        setProgress(0);
      }
    } catch (error) {
      setEnrichmentStatus('idle');
      setProgress(0);
    }

    clearInterval(progressInterval);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Geographic Data Enrichment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-accent/20 rounded-lg">
            <Database className="h-8 w-8 text-blue-500" />
            <div>
              <div className="font-medium">Location Data</div>
              <div className="text-sm text-muted-foreground">City, State, Country</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-accent/20 rounded-lg">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <div className="font-medium">USDA Zones</div>
              <div className="text-sm text-muted-foreground">Hardiness Zones 3a-11</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-accent/20 rounded-lg">
            <Zap className="h-8 w-8 text-purple-500" />
            <div>
              <div className="font-medium">Climate Zones</div>
              <div className="text-sm text-muted-foreground">Tropical to Polar</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Enrichment Progress</span>
            <Badge variant={enrichmentStatus === 'complete' ? 'default' : 'secondary'}>
              {enrichmentStatus === 'idle' && 'Ready'}
              {enrichmentStatus === 'running' && 'Processing...'}
              {enrichmentStatus === 'complete' && 'Complete'}
            </Badge>
          </div>
          
          {enrichmentStatus !== 'idle' && (
            <Progress value={progress} className="w-full" />
          )}
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">What this does:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Geocodes postal codes to lat/lon coordinates</li>
            <li>• Determines USDA Hardiness Zones for gardening relevance</li>
            <li>• Assigns climate zones for seasonal targeting</li>
            <li>• Enables radius-based geographic segmentation</li>
          </ul>
        </div>

        <Button 
          onClick={handleEnrichment}
          disabled={loading || enrichmentStatus === 'running'}
          className="w-full"
        >
          {loading || enrichmentStatus === 'running' ? (
            <>
              <Database className="mr-2 h-4 w-4 animate-spin" />
              Enriching Data...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Start Geo Enrichment
            </>
          )}
        </Button>

        {enrichmentStatus === 'complete' && (
          <div className="text-center text-sm text-muted-foreground">
            ✅ Location data enriched successfully. You can now use geographic filters in your segments.
          </div>
        )}
      </CardContent>
    </Card>
  );
};