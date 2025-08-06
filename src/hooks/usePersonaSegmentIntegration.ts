import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Persona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: 'predefined' | 'custom';
}

export const usePersonaSegmentIntegration = () => {
  const [selectedPersonas, setSelectedPersonas] = useState<Persona[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Save persona and segment selections to campaign
  const saveCampaignTargeting = useCallback(async (campaignId: string) => {
    if (!campaignId) return;

    try {
      setLoading(true);

      // Update campaign with persona IDs
      if (selectedPersonas.length > 0) {
        const personaIds = selectedPersonas.map(p => p.id);
        const { error: campaignError } = await supabase
          .from('crm_campaigns')
          .update({ persona_ids: personaIds })
          .eq('id', campaignId);

        if (campaignError) throw campaignError;

        // Insert campaign-persona relationships
        const campaignPersonas = selectedPersonas.map(persona => ({
          campaign_id: campaignId,
          persona_id: persona.id
        }));

        const { error: junctionError } = await supabase
          .from('campaign_personas')
          .insert(campaignPersonas);

        if (junctionError && !junctionError.message.includes('duplicate')) {
          throw junctionError;
        }
      }

      // Save segment selections (existing logic would be preserved)
      if (selectedSegments.length > 0) {
        const campaignSegments = selectedSegments.map(segment => ({
          campaign_id: campaignId,
          segment_id: segment.id
        }));

        const { error: segmentError } = await supabase
          .from('campaign_segments')
          .insert(campaignSegments);

        if (segmentError && !segmentError.message.includes('duplicate')) {
          throw segmentError;
        }
      }

      toast({
        title: "Targeting saved",
        description: "Campaign personas and segments have been saved successfully."
      });

    } catch (error: any) {
      console.error('Error saving targeting:', error);
      toast({
        title: "Error",
        description: "Failed to save targeting preferences.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPersonas, selectedSegments, toast]);

  // Save persona and segment selections to automation
  const saveAutomationTargeting = useCallback(async (automationId: string) => {
    if (!automationId) return;

    try {
      setLoading(true);

      // Update automation with persona targeting
      const personaTargeting = {
        persona_ids: selectedPersonas.map(p => p.id),
        conditions: selectedSegments.map(s => ({
          type: 'segment',
          segment_id: s.id,
          segment_name: s.name
        }))
      };

      const { error: automationError } = await supabase
        .from('crm_automations')
        .update({ persona_targeting: personaTargeting })
        .eq('id', automationId);

      if (automationError) throw automationError;

      // Insert automation-persona relationships
      if (selectedPersonas.length > 0) {
        const automationPersonas = selectedPersonas.map(persona => ({
          automation_id: automationId,
          persona_id: persona.id
        }));

        const { error: junctionError } = await supabase
          .from('automation_personas')
          .insert(automationPersonas);

        if (junctionError && !junctionError.message.includes('duplicate')) {
          throw junctionError;
        }
      }

      toast({
        title: "Targeting saved",
        description: "Automation personas and targeting have been saved successfully."
      });

    } catch (error: any) {
      console.error('Error saving automation targeting:', error);
      toast({
        title: "Error",
        description: "Failed to save automation targeting preferences.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPersonas, selectedSegments, toast]);

  // Load existing targeting for a campaign
  const loadCampaignTargeting = useCallback(async (campaignId: string) => {
    try {
      setLoading(true);

      // Load personas
      const { data: campaignPersonas, error: personaError } = await supabase
        .from('campaign_personas')
        .select('persona_id')
        .eq('campaign_id', campaignId);

      if (personaError) throw personaError;

      if (campaignPersonas) {
        // Fetch full persona details
        const personaIds = campaignPersonas.map(cp => cp.persona_id);
        if (personaIds.length > 0) {
          const { data: personas, error: personaDetailError } = await supabase
            .from('crm_personas')
            .select('id, persona_name, persona_description, is_custom')
            .in('id', personaIds);
          
          if (personaDetailError) throw personaDetailError;
          setSelectedPersonas(personas || []);
        }
      }

      // Load segments - get segment IDs first, then fetch details
      const { data: campaignSegments, error: segmentError } = await supabase
        .from('campaign_segments')
        .select('segment_id')
        .eq('campaign_id', campaignId);

      if (segmentError) throw segmentError;

      if (campaignSegments) {
        const segmentIds = campaignSegments.map(cs => cs.segment_id);
        const allSegments: Segment[] = [];
        
        if (segmentIds.length > 0) {
          // Fetch from predefined segments
          const { data: predefinedSegments } = await supabase
            .from('crm_segments')
            .select('id, name, description, customer_count')
            .in('id', segmentIds);
          
          if (predefinedSegments) {
            allSegments.push(...predefinedSegments.map(seg => ({
              id: seg.id,
              name: seg.name,
              description: seg.description || undefined,
              customer_count: seg.customer_count || 0,
              type: 'predefined' as const
            })));
          }
          
          // Fetch from custom segments
          const { data: customSegments } = await supabase
            .from('custom_segments')
            .select('id, name, customer_count')
            .in('id', segmentIds);
          
          if (customSegments) {
            allSegments.push(...customSegments.map(seg => ({
              id: seg.id,
              name: seg.name,
              description: undefined,
              customer_count: seg.customer_count || 0,
              type: 'custom' as const
            })));
          }
        }
        
        setSelectedSegments(allSegments);
      }

    } catch (error: any) {
      console.error('Error loading campaign targeting:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    selectedPersonas,
    selectedSegments,
    setSelectedPersonas,
    setSelectedSegments,
    loading,
    saveCampaignTargeting,
    saveAutomationTargeting,
    loadCampaignTargeting
  };
};