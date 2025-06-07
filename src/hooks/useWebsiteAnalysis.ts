
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExtractedData {
  businessName: string;
  aboutBusiness: string;
  location: string;
  services: string;
  brandVoice: string;
  annualEvents: string;
  websiteContent: string;
}

export const useWebsiteAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>({
    businessName: "",
    aboutBusiness: "",
    location: "",
    services: "",
    brandVoice: "",
    annualEvents: "",
    websiteContent: ""
  });

  const analyzeWebsite = async (websiteUrl: string): Promise<boolean> => {
    if (!websiteUrl.trim()) {
      toast.error("Please enter a website URL");
      return false;
    }

    console.log('=== WEBSITE ANALYSIS DEBUG ===');
    console.log('1. Starting website analysis for:', websiteUrl);
    console.log('2. Supabase client status:', !!supabase);
    console.log('3. Current user:', await supabase.auth.getUser());
    
    setIsAnalyzing(true);
    
    try {
      console.log('4. About to call supabase.functions.invoke...');
      
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { websiteUrl: websiteUrl.trim() }
      });

      console.log('5. Function response received:');
      console.log('   - Data:', data);
      console.log('   - Error:', error);
      console.log('   - Full response object:', { data, error });

      if (error) {
        console.error('6. Error analyzing website:', error);
        console.error('   - Error type:', typeof error);
        console.error('   - Error message:', error.message);
        console.error('   - Error details:', error.details);
        toast.error(`Failed to analyze website: ${error.message || 'Unknown error'}`);
        return false;
      }

      if (data?.extractedData) {
        console.log('7. Successfully extracted data:', data.extractedData);
        console.log('8. Extraction method used:', data.extractionMethod);
        
        setExtractedData(data.extractedData);
        
        // Show success message with extraction method
        const methodText = data.extractionMethod === 'firecrawl' ? 
          'Website analyzed successfully using advanced extraction!' : 
          'Website analyzed successfully!';
        
        // Wait for all items to be visible before advancing
        setTimeout(() => {
          toast.success(methodText);
        }, 1000);
        return true;
      } else {
        console.warn('9. No extracted data received');
        console.warn('   - Full data object:', data);
        toast.error("No data could be extracted from the website.");
        return false;
      }
    } catch (error) {
      console.error('10. Catch block - Error in analyzeWebsite:', error);
      console.error('    - Error type:', typeof error);
      console.error('    - Error name:', error?.name);
      console.error('    - Error message:', error?.message);
      console.error('    - Error stack:', error?.stack);
      toast.error(`Failed to analyze website: ${error?.message || 'Network error'}`);
      return false;
    } finally {
      console.log('11. Analysis complete, setting isAnalyzing to false');
      setTimeout(() => {
        setIsAnalyzing(false);
      }, 1000);
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
    extractedData,
    analyzeWebsite,
    updateExtractedData
  };
};
