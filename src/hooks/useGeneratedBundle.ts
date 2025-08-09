import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GeneratedBundleItem {
  channel: 'newsletter' | 'instagram' | 'facebook' | 'video' | 'blog';
  title?: string;
  body: string;
  summary?: string;
  hashtags?: string[];
  ctaSuggestions?: string[];
  media?: { url?: string; alt?: string } | null;
  _approved?: boolean;
}

export interface GeneratedBundle {
  id: string;
  items: GeneratedBundleItem[];
  recommendedImages: { url: string; alt?: string }[];
  meta: { mode: 'event'|'seasonal'|'custom'; sourceId?: string };
}

const bundleKey = (bundleId?: string) => ['generated-bundle', bundleId];

export function useGeneratedBundle(bundleId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: bundleKey(bundleId),
    enabled: !!bundleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draft_snapshots' as any)
        .select('id, version, content, doc_id, doc_type')
        .eq('doc_type', 'content_bundle')
        .eq('doc_id', bundleId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error as any;
      return (data as unknown) as { id: string; version: number; content: GeneratedBundle } | null;
    }
  });

  const update = useMutation({
    mutationFn: async ({ snapshotId, content, versionIncrement = 1 }: { snapshotId: string; content: GeneratedBundle; versionIncrement?: number }) => {
      // Use merge-safe draft-merge function for content_bundle
      const { data, error } = await supabase.functions.invoke('draft-merge', {
        body: {
          doc_type: 'content_bundle',
          doc_id: bundleId,
          base_version: query.data?.version || null,
          new_content: content,
        },
      });
      if (error) throw error as any;
      return data as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: bundleKey(bundleId) });
    }
  });

  return { query, update };
}
