-- Add linked_crm_campaign_id to content_tasks table for bidirectional CRM integration
ALTER TABLE public.content_tasks 
ADD COLUMN linked_crm_campaign_id UUID REFERENCES public.crm_campaigns(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_content_tasks_linked_crm_campaign ON public.content_tasks(linked_crm_campaign_id);

-- Add source_content_task_id to crm_campaigns if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'crm_campaigns' 
                   AND column_name = 'source_content_task_id') THEN
        ALTER TABLE public.crm_campaigns 
        ADD COLUMN source_content_task_id UUID REFERENCES public.content_tasks(id) ON DELETE SET NULL;
        
        CREATE INDEX idx_crm_campaigns_source_content_task ON public.crm_campaigns(source_content_task_id);
    END IF;
END $$;