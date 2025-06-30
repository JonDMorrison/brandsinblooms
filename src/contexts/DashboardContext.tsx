import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ContentTask {
  id: string;
  campaign_id?: string;
  post_type: string;
  ai_output?: string;
  status: string;
  scheduled_date?: string;
  created_at: string;
  campaigns?: {
    title: string;
  };
  _scheduledPostId?: string; // For tracking scheduled posts
}

interface Campaign {
  id: string;
  title: string;
  week_number: number;
  start_date: string;
  theme?: string;
  description?: string;
}

interface DashboardContextType {
  activeDraft: ContentTask | null;
  setActiveDraft: (draft: ContentTask | null) => void;
  drafts: ContentTask[];
  campaigns: Campaign[];
  currentCampaign: Campaign | null;
  scheduleDraft: (draftId: string, dateTime: string) => Promise<void>;
  updateDraftContent: (draftId: string, content: string) => Promise<void>;
  refreshData: () => Promise<void>;
  loading: boolean;
  composerMode: 'draft' | 'scheduled';
  setComposerMode: (mode: 'draft' | 'scheduled') => void;
  isDockOpen: boolean;
  openDock: () => void;
  closeDock: () => void;
  toggleDock: () => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within DashboardProvider');
  }
  return context;
};

interface DashboardProviderProps {
  children: ReactNode;
}

export const DashboardProvider = ({ children }: DashboardProviderProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [activeDraft, setActiveDraft] = useState<ContentTask | null>(null);
  const [drafts, setDrafts] = useState<ContentTask[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerMode, setComposerMode] = useState<'draft' | 'scheduled'>('draft');
  
  // Smart-Time Dock state
  const [isDockOpen, setDockOpen] = useState(false);

  const openDock = () => setDockOpen(true);
  const closeDock = () => setDockOpen(false);
  const toggleDock = () => setDockOpen(prev => !prev);

  // Close dock on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDockOpen) {
        closeDock();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDockOpen]);

  // Update composer mode when active draft changes
  useEffect(() => {
    if (activeDraft) {
      setComposerMode(activeDraft.status === 'scheduled' ? 'scheduled' : 'draft');
    }
  }, [activeDraft]);

  const fetchDrafts = async () => {
    if (!user) return;

    try {
      const query = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            theme
          )
        `)
        .in('status', ['approved', 'generated'])
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        query.eq('tenant_id', tenant.id);
      } else {
        query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDrafts(data || []);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      toast.error('Failed to load drafts');
    }
  };

  const fetchCampaigns = async () => {
    if (!user) return;

    try {
      const query = supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: false });

      if (tenant?.id) {
        query.eq('tenant_id', tenant.id);
      } else {
        query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCampaigns(data || []);
      
      // Set current campaign (most recent)
      if (data && data.length > 0) {
        setCurrentCampaign(data[0]);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      toast.error('Failed to load campaigns');
    }
  };

  const scheduleDraft = async (draftId: string, dateTime: string) => {
    try {
      const draft = drafts.find(d => d.id === draftId);
      if (!draft) return;

      // Update content task status to scheduled
      const { error: updateError } = await supabase
        .from('content_tasks')
        .update({ 
          status: 'scheduled',
          scheduled_date: dateTime
        })
        .eq('id', draftId);

      if (updateError) throw updateError;

      // Remove from drafts
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      
      // Clear active draft if it was the scheduled one
      if (activeDraft?.id === draftId) {
        setActiveDraft(null);
      }

      toast.success('Draft scheduled successfully');
    } catch (error) {
      console.error('Error scheduling draft:', error);
      toast.error('Failed to schedule draft');
    }
  };

  const updateDraftContent = async (draftId: string, content: string) => {
    try {
      // Check if this is a scheduled post
      const currentDraft = activeDraft;
      if (currentDraft?._scheduledPostId) {
        // Update the generated_content table for scheduled posts
        const { error } = await supabase
          .from('generated_content')
          .update({ caption: content })
          .eq('id', currentDraft.id);

        if (error) throw error;
      } else {
        // Update content_tasks for regular drafts
        const { error } = await supabase
          .from('content_tasks')
          .update({ ai_output: content })
          .eq('id', draftId);

        if (error) throw error;
      }

      // Update local state
      if (activeDraft?.id === draftId) {
        setActiveDraft({
          ...activeDraft,
          ai_output: content
        });
      }

      toast.success('Content saved');
    } catch (error) {
      console.error('Error updating content:', error);
      toast.error('Failed to save content');
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await Promise.all([fetchDrafts(), fetchCampaigns()]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, tenant]);

  const value: DashboardContextType = {
    activeDraft,
    setActiveDraft,
    drafts,
    campaigns,
    currentCampaign,
    scheduleDraft,
    updateDraftContent,
    refreshData,
    loading,
    composerMode,
    setComposerMode,
    isDockOpen,
    openDock,
    closeDock,
    toggleDock,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};
