
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WebsiteStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

interface FormData {
  website_url: string;
  company_name: string;
}

export const WebsiteStep = ({ onNext }: WebsiteStepProps) => {
  const { user } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormData>({
    defaultValues: {
      website_url: '',
      company_name: '',
    }
  });

  const websiteUrl = watch('website_url');

  const validateWebsiteUrl = (url: string) => {
    if (!url) return 'Website URL is required';
    if (!url.startsWith('https://')) {
      return 'URL must start with https://';
    }
    try {
      new URL(url);
      return true;
    } catch {
      return 'Please enter a valid URL';
    }
  };

  const triggerBackgroundAnalysis = async (url: string) => {
    try {
      setIsAnalyzing(true);
      setAnalysisStatus('Analyzing your site in the background...');
      
      // Call the analyze-website edge function
      const { error } = await supabase.functions.invoke('analyze-website', {
        body: { 
          url,
          workspaceId: user?.id 
        },
      });
      
      if (error) {
        throw error;
      }
      
      setAnalysisStatus('✅ Site analysis started! This won\'t slow you down.');
    } catch (error) {
      console.error('Background analysis error:', error);
      // Friendly error mapping - don't block the UI
      setAnalysisStatus('We\'ll keep trying to analyze your site in the background.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;

    try {
      // Save to database first
      const { error } = await supabase
        .from('company_profiles')
        .upsert(
          { 
            user_id: user.id,
            website_url: data.website_url,
            company_name: data.company_name || null,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      // Start background analysis (don't block UI)
      triggerBackgroundAnalysis(data.website_url);
      
      // Move to next step immediately
      setTimeout(onNext, 1500); // Small delay to show analysis status
      
    } catch (error) {
      console.error('Error saving website info:', error);
      // Could show error toast here, but don't block progression
    }
  };

  const handleSkip = () => {
    onNext();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-6 h-6 text-primary" />
            <div>
              <h4 className="font-semibold">Tell us about your business</h4>
              <p className="text-sm text-muted-foreground">
                We'll analyze your website to understand your brand and create personalized content
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="website_url">Website URL *</Label>
              <Input
                id="website_url"
                {...register('website_url', { 
                  validate: validateWebsiteUrl 
                })}
                placeholder="https://your-business.com"
                className="mt-1"
              />
              {errors.website_url && (
                <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.website_url.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Include https:// at the beginning
              </p>
            </div>

            <div>
              <Label htmlFor="company_name">Company Name (optional)</Label>
              <Input
                id="company_name"
                {...register('company_name')}
                placeholder="We can usually detect this from your site"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank if you'd like us to auto-detect it
              </p>
            </div>

            {/* Analysis status */}
            {analysisStatus && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
                <span className="text-sm">{analysisStatus}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                disabled={!websiteUrl || isAnalyzing}
                className="flex-1"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Save & Continue'
                )}
              </Button>
              
              <Button 
                type="button" 
                variant="ghost" 
                onClick={handleSkip}
                disabled={isAnalyzing}
              >
                Skip for now
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Help text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>🔒 Your data is processed securely and never stored unnecessarily</p>
      </div>
    </div>
  );
};
