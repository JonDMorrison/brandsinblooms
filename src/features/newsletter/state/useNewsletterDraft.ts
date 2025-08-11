import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';
import { TNewsletterBlock, registry } from '../blocks/registry';

interface UseNewsletterDraftOptions {
  docId: string;
}

interface UseNewsletterDraftResult {
  blocks: TNewsletterBlock[];
  setBlocks: React.Dispatch<React.SetStateAction<TNewsletterBlock[]>>;
  status: 'idle' | 'saving' | 'saved' | 'merged' | 'error';
  lastSavedAt?: number;
  scheduleSave: (content: any) => void;
  saveNow: (content?: any) => Promise<void>;
}

export function useNewsletterDraft({ docId }: UseNewsletterDraftOptions): UseNewsletterDraftResult {
  const [blocks, setBlocks] = useState<TNewsletterBlock[]>([]);

  // Load latest draft on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) {
        if (mounted && blocks.length === 0) {
          const { getMagazineA } = await import('../templates/magazine/a');
          setBlocks(getMagazineA());
        }
        return;
      }
      const { data: userRow } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();
      if (!userRow?.tenant_id) {
        if (mounted && blocks.length === 0) {
          const { getMagazineA } = await import('../templates/magazine/a');
          setBlocks(getMagazineA());
        }
        return;
      }
      const { data } = await supabase
        .from('draft_snapshots')
        .select('content')
        .eq('tenant_id', userRow.tenant_id)
        .eq('doc_type', 'newsletter')
        .eq('doc_id', docId)
        .order('version', { ascending: false })
        .limit(1);
      const last = (data && data[0]) as any;
      if (mounted && last?.content?.blocks) {
        setBlocks(last.content.blocks as TNewsletterBlock[]);
      } else if (mounted && blocks.length === 0) {
        // Seed with magazine template by default
        const { getMagazineA } = await import('../templates/magazine/a');
        setBlocks(getMagazineA());
      }
    };
    load();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const { status, lastSavedAt, scheduleSave, saveNow } = useDraftAutosave({
    docType: 'newsletter',
    docId,
  });

  return { blocks, setBlocks, status, lastSavedAt, scheduleSave, saveNow };
}
