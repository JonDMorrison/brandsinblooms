
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type DocType = 'newsletter' | 'automation';

type Conflict = { path: string; base: any; local: any; remote: any };

type Status = 'idle' | 'saving' | 'saved' | 'merged' | 'error';

interface UseDraftAutosaveOptions {
  docType: DocType;
  docId: string | null | undefined; // require real UUID to enable saving
  throttleMs?: number; // default 5000
  onHeadNotice?: (info: { version: number }) => void; // when other tabs update head
}

interface UseDraftAutosaveResult {
  status: Status;
  lastSavedAt?: number;
  conflicts: Conflict[];
  scheduleSave: (content: any) => void;
  saveNow: (content?: any) => Promise<void>;
  clearConflicts: () => void;
}

/**
 * Merge-safe autosave hook (client).
 * - Throttles saves
 * - Invokes edge function draft-merge
 * - Subscribes to realtime head changes for this doc
 */
export function useDraftAutosave(opts: UseDraftAutosaveOptions): UseDraftAutosaveResult {
  const { docType, docId, throttleMs = 5000, onHeadNotice } = opts;
  const { toast } = useToast();

  const canSave = useMemo(() => Boolean(docId), [docId]);

  const baseVersionRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<any>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | undefined>(undefined);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  // Load current head version on mount
  useEffect(() => {
    let cancelled = false;
    const loadHead = async () => {
      if (!canSave) return;
      // Derive tenant to filter correctly (not strictly required here)
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data: userRow } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userRow?.tenant_id) return;

      const { data: headRows, error } = await supabase
        .from('draft_snapshots')
        .select('version')
        .eq('tenant_id', userRow.tenant_id)
        .eq('doc_type', docType)
        .eq('doc_id', docId)
        .order('version', { ascending: false })
        .limit(1);

      if (!cancelled && !error && headRows && headRows.length > 0) {
        baseVersionRef.current = (headRows[0] as any).version as number;
      }
    };
    loadHead();
    return () => {
      cancelled = true;
    };
  }, [canSave, docType, docId]);

  // Subscribe to realtime updates for this doc
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let mounted = true;

    const subscribe = async () => {
      if (!canSave) return;
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      const { data: userRow } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userRow?.tenant_id) return;

      channel = supabase
        .channel('draft-autosave-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'draft_snapshots',
            filter: `tenant_id=eq.${userRow.tenant_id},doc_type=eq.${docType},doc_id=eq.${docId}`,
          } as any,
          (payload: any) => {
            if (!mounted) return;
            const newVersion = payload?.new?.version as number | undefined;
            const actor = payload?.new?.user_id as string | undefined;
            const currentUserId = user.user.id as string;

            // Ignore updates from this same user/session and stale versions
            if (actor === currentUserId) return;
            if (!newVersion || newVersion <= baseVersionRef.current) return;

            baseVersionRef.current = newVersion;
            onHeadNotice?.({ version: newVersion });
            toast({
              title: 'Draft updated in another tab',
              description: 'We will merge your changes on the next save.',
            });
          }
        )
        .subscribe();
    };

    subscribe();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [canSave, docId, docType, onHeadNotice, toast]);

  const performSave = useCallback(async (content: any) => {
    if (!canSave) return;
    setStatus('saving');

    const { data, error } = await supabase.functions.invoke('draft-merge', {
      body: {
        doc_type: docType,
        doc_id: docId,
        base_version: baseVersionRef.current,
        new_content: content,
      },
    });

    if (error) {
      console.error('Autosave error:', error);
      setStatus('error');
      return;
    }

    const nextVersion = (data as any)?.version as number | undefined;
    const newConflicts = ((data as any)?.conflicts || []) as Conflict[];
    const mergedContent = (data as any)?.merged_content;

    if (nextVersion) {
      baseVersionRef.current = nextVersion;
      setLastSavedAt(Date.now());
    }

    // Keep local reference in sync with server-merged content
    if (mergedContent !== undefined) {
      lastContentRef.current = mergedContent;
    }

    if (newConflicts.length > 0) {
      setConflicts(newConflicts);
      toast({
        title: 'Changes merged – review recommended',
        description: 'We merged edits from another tab/device. Review the highlighted differences.',
      });
      setStatus('merged');
    } else {
      setConflicts([]);
      setStatus('saved');
    }
  }, [canSave, docId, docType, toast]);

  const scheduleSave = useCallback((content: any) => {
    if (!canSave) return;
    lastContentRef.current = content;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      performSave(lastContentRef.current);
    }, throttleMs);
  }, [canSave, performSave, throttleMs]);

  const saveNow = useCallback(async (content?: any) => {
    if (!canSave) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    const payload = content !== undefined ? content : lastContentRef.current;
    if (payload === undefined) return;
    await performSave(payload);
  }, [canSave, performSave]);

  // Save on window blur
  useEffect(() => {
    if (!canSave) return;
    const onBlur = () => {
      if (lastContentRef.current !== undefined && lastContentRef.current !== null) {
        void saveNow();
      }
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [canSave, saveNow]);

  const clearConflicts = useCallback(() => setConflicts([]), []);

  return {
    status,
    lastSavedAt,
    conflicts,
    scheduleSave,
    saveNow,
    clearConflicts,
  };
}
