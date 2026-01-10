
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { persistLocationExtraction } from "@/lib/location/persistLocationExtraction";

export interface LocationExtraction {
  postal_code: string | null;
  city: string | null;
  state_province: string | null;
  country: 'US' | 'CA' | null;
  source: 'jsonld' | 'footer' | 'contact' | 'regex' | 'none';
  confidence: 'high' | 'medium' | 'low';
  snippet: string | null;
  candidates: any[];
  requires_confirmation: boolean;
}

interface ExtractedData {
  businessName: string;
  aboutBusiness: string;
  location: string;
  services: string;
  brandVoice: string;
  annualEvents: string;
  websiteContent: string;
  // Brand colors from Firecrawl branding extraction
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandAccentColor?: string;
  brandTextColor?: string;
  brandLogo?: string;
  // Structured location extraction
  locationExtraction?: LocationExtraction;
}

interface AnalysisError {
  type: 'network' | 'validation' | 'extraction' | 'unknown';
  message: string;
  canRetry: boolean;
  suggestedAction?: string;
}

export const useWebsiteAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<AnalysisError | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    businessName: "",
    aboutBusiness: "",
    location: "",
    services: "",
    brandVoice: "",
    annualEvents: "",
    websiteContent: ""
  });

  const resetAnalysis = () => {
    setIsAnalyzing(false);
    setAnalysisError(null);
    setExtractedData({
      businessName: "",
      aboutBusiness: "",
      location: "",
      services: "",
      brandVoice: "",
      annualEvents: "",
      websiteContent: ""
    });
  };

  const categorizeError = (error: any): AnalysisError => {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    // Network-related errors
    if (!navigator.onLine || errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
      return {
        type: 'network',
        message: 'No internet connection. Please check your connection and try again.',
        canRetry: true,
        suggestedAction: 'Check your internet connection'
      };
    }
    
    // URL validation errors
    if (errorMessage.includes('Website analysis failed') || errorMessage.includes('URL')) {
      return {
        type: 'validation',
        message: 'The website URL appears to be invalid or inaccessible. Please verify the URL is correct.',
        canRetry: true,
        suggestedAction: 'Double-check the website URL'
      };
    }
    
    // Content extraction errors
    if (errorMessage.includes('content') || errorMessage.includes('extraction')) {
      return {
        type: 'extraction',
        message: 'Unable to extract content from this website. You can try manual entry instead.',
        canRetry: false,
        suggestedAction: 'Switch to manual entry'
      };
    }
    
    // Generic error
    return {
      type: 'unknown',
      message: errorMessage,
      canRetry: true,
      suggestedAction: 'Try again or use manual entry'
    };
  };

  const analyzeWebsite = async (websiteUrl: string, userId?: string): Promise<boolean> => {
    if (!websiteUrl.trim()) {
      const error: AnalysisError = {
        type: 'validation',
        message: 'Please enter a website URL',
        canRetry: true,
        suggestedAction: 'Enter a valid website URL'
      };
      setAnalysisError(error);
      return false;
    }

    console.log('=== WEBSITE ANALYSIS DEBUG ===');
    console.log('1. Starting website analysis for:', websiteUrl);
    
    // Reset previous errors and start analysis
    setAnalysisError(null);
    setIsAnalyzing(true);
    
    try {
      console.log('2. About to call supabase.functions.invoke...');
      
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { websiteUrl: websiteUrl.trim() }
      });

      console.log('3. Function response received:');
      console.log('   - Data:', data);
      console.log('   - Error:', error);

      if (error) {
        console.error('4. Error analyzing website:', error);
        const analysisError = categorizeError(error);
        setAnalysisError(analysisError);
        
        // Don't show toast for errors we're handling gracefully
        return false;
      }

      if (data?.extractedData) {
        console.log('5. Successfully extracted data:', data.extractedData);
        console.log('6. Extraction method used:', data.extractionMethod);
        console.log('7. Branding data:', data.brandingData);
        
        // Merge branding data and location extraction into extracted data
        const mergedData = {
          ...data.extractedData,
          brandPrimaryColor: data.brandingData?.primaryColor || undefined,
          brandSecondaryColor: data.brandingData?.secondaryColor || undefined,
          brandAccentColor: data.brandingData?.accentColor || undefined,
          brandTextColor: data.brandingData?.textColor || undefined,
          brandLogo: data.brandingData?.logo || undefined,
          locationExtraction: data.locationExtraction || undefined,
        };
        
        console.log('8. Location extraction:', data.locationExtraction);
        setExtractedData(mergedData);
        
        // Persist location extraction to company_profiles if userId provided
        if (userId && data.locationExtraction) {
          console.log('9. Persisting location extraction to database...');
          const persistResult = await persistLocationExtraction({
            userId,
            websiteUrl: websiteUrl.trim(),
            locationExtraction: data.locationExtraction,
          });
          
          if (persistResult.success) {
            console.log('✅ Location extraction persisted, needs confirmation:', persistResult.needsConfirmation);
          } else {
            console.warn('⚠️ Failed to persist location extraction:', persistResult.error);
          }
        }
        
        // Website analyzed successfully - show success message
        const colorDetected = data.brandingData?.primaryColor ? ' Brand colors detected!' : '';
        const locationConfirmNeeded = data.locationExtraction?.requires_confirmation 
          ? ' Location needs confirmation.' 
          : '';
        toast({
          title: "Success",
          description: `Website analyzed successfully!${colorDetected}${locationConfirmNeeded}`,
        });
        return true;
      } else {
        console.warn('7. No extracted data received');
        const analysisError: AnalysisError = {
          type: 'extraction',
          message: 'No content could be extracted from this website. The site may be protected or have limited content.',
          canRetry: false,
          suggestedAction: 'Try manual entry instead'
        };
        setAnalysisError(analysisError);
        return false;
      }
    } catch (error: any) {
      console.error('8. Catch block - Error in analyzeWebsite:', error);
      const analysisError = categorizeError(error);
      setAnalysisError(analysisError);
      return false;
    } finally {
      console.log('10. Analysis complete, setting isAnalyzing to false');
      // Always reset analyzing state immediately
      setIsAnalyzing(false);
    }
  };

  const updateExtractedData = (field: string, value: string) => {
    setExtractedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return {
    isAnalyzing,
    analysisError,
    extractedData,
    analyzeWebsite,
    updateExtractedData,
    resetAnalysis
  };
};
