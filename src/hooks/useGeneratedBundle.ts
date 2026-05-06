import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GeneratedBundleItem {
  channel: "newsletter" | "instagram" | "facebook" | "video" | "blog";
  title?: string;
  body: string;
  summary?: string;
  hashtags?: string[];
  imageQuery?: string;
  ctaSuggestions?: string[];
  media?: { url?: string; alt?: string } | null;
  _approved?: boolean;
}

export interface GeneratedBundle {
  id: string;
  items: GeneratedBundleItem[];
  recommendedImages: { url: string; alt?: string }[];
  meta: {
    mode: "event" | "seasonal" | "custom" | "holiday";
    sourceId?: string;
  };
  sourceLabel?: string;
  thumbnail?: string; // AI-generated thumbnail URL
}

interface DraftMergeResponse {
  ok: boolean;
  merged_content: GeneratedBundle;
  version: number;
  conflicts?: Array<{
    path: string;
    base: unknown;
    local: unknown;
    remote: unknown;
  }>;
}

interface GeneratedBundleSnapshot {
  id: string;
  version: number;
  content: GeneratedBundle;
  created_at?: string | null;
  updated_at?: string | null;
}

const bundleKey = (bundleId?: string) => ["generated-bundle", bundleId];

export function useGeneratedBundle(bundleId?: string) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: bundleKey(bundleId),
    enabled: !!bundleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("draft_snapshots" as any)
        .select(
          "id, version, content, doc_id, doc_type, created_at, updated_at",
        )
        .eq("doc_type", "content_bundle")
        .eq("doc_id", bundleId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error as any;
      return data as unknown as GeneratedBundleSnapshot | null;
    },
  });

  const update = useMutation({
    mutationFn: async ({
      snapshotId,
      content,
      versionIncrement = 1,
    }: {
      snapshotId: string;
      content: GeneratedBundle;
      versionIncrement?: number;
    }) => {
      // Use merge-safe draft-merge function for content_bundle
      const { data, error } = await supabase.functions.invoke("draft-merge", {
        body: {
          doc_type: "content_bundle",
          doc_id: bundleId,
          base_version: query.data?.version || null,
          new_content: content,
        },
      });
      if (error) throw error as any;
      return data as DraftMergeResponse;
    },
    onSuccess: (result) => {
      qc.setQueryData<GeneratedBundleSnapshot | null>(
        bundleKey(bundleId),
        (current) => {
          if (!result?.ok) {
            return current ?? null;
          }

          return {
            id: current?.id || "",
            version: result.version,
            content: result.merged_content,
            created_at: current?.created_at,
            updated_at: new Date().toISOString(),
          };
        },
      );
    },
  });

  return { query, update };
}
