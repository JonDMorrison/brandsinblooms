
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement

interface ExtractedData {
  businessName: string;
  aboutBusiness: string;
  location: string;
  services: string;
  brandVoice: string;
  annualEvents: string;
  websiteContent: string;
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

  const analyzeWebsite = async (websiteUrl: string): Promise<boolean> => {
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
        
        setExtractedData(data.extractedData);
        
        // Website analyzed successfully - removing toast to prevent ReferenceError
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
      console.log('9. Analysis complete, setting isAnalyzing to false');
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
