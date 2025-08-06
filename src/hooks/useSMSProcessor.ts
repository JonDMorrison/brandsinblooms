import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SMSProcessingResult {
  original_message: string;
  processed_message: string;
  hub_url: string | null;
  macro_usage: {
    hub_used: boolean;
    total_macros: number;
    processed_at: string;
  };
}

export const useSMSProcessor = () => {
  const [processing, setProcessing] = useState(false);

  const processSMSMessage = async (
    message: string, 
    campaignId: string
  ): Promise<SMSProcessingResult | null> => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sms-processor', {
        body: { 
          message, 
          campaign_id: campaignId 
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error processing SMS message:', error);
      return null;
    } finally {
      setProcessing(false);
    }
  };

  const generateQRCode = async (code: string, size: number = 200): Promise<string | null> => {
    try {
      // Use the environment URL directly instead of accessing protected properties
      const supabaseUrl = 'https://udldmkqwnxhdeztyqcau.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/qr-generator?code=${encodeURIComponent(code)}&size=${size}`
      );

      if (!response.ok) throw new Error('QR generation failed');
      
      const svgText = await response.text();
      return `data:image/svg+xml;base64,${btoa(svgText)}`;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };

  return {
    processSMSMessage,
    generateQRCode,
    processing
  };
};