
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

    console.log('Starting website analysis for:', websiteUrl);
    setIsAnalyzing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-website', {
        body: { websiteUrl: websiteUrl.trim() }
      });

      console.log('Analysis response:', { data, error });

      if (error) {
        console.error('Error analyzing website:', error);
        toast.error("Failed to analyze website. Please try again or fill in manually.");
        return false;
      }

      if (data?.extractedData) {
        console.log('Successfully extracted data:', data.extractedData);
        setExtractedData(data.extractedData);
        // Wait for all items to be visible before advancing
        setTimeout(() => {
          toast.success("Website analyzed successfully!");
        }, 1000);
        return true;
      } else {
        console.warn('No extracted data received');
        toast.error("No data could be extracted from the website.");
        return false;
      }
    } catch (error) {
      console.error('Error in analyzeWebsite:', error);
      toast.error("Failed to analyze website. Please try again.");
      return false;
    } finally {
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
