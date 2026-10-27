import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { StudioBlock } from "@/types/studioBlocks";
import { Choice } from "./AppearanceControls";
export default function AudienceControls({
  block,
  onChange,
}: {
  block: StudioBlock;
  onChange: (audience: StudioBlock["audience"]) => void;
}) {
  const { tenant, loading } = useTenant();
  const segments = useQuery({
    queryKey: ["newsletter-audience-segments", tenant?.id],
    enabled: Boolean(!loading && tenant?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_segments")
        .select("id,name")
        .eq("tenant_id", tenant!.id)
        .is("deleted_at", null)
        .order("name")
        .limit(500);
      if (error) throw new Error("Could not load account segments.");
      return data || [];
    },
  });
  if (block.type === "footer") return null;
  return (
    <details className="nl-controls" style={{ padding: "12px 20px" }}>
      <summary>Who sees this block?</summary>
      <Choice
        label="Visibility"
        value={block.audience?.mode || "all"}
        options={[
          { value: "all", label: "Everyone receiving this newsletter" },
          { value: "segments", label: "Only selected segments" },
        ]}
        onChange={(mode) =>
          onChange({
            mode: mode === "segments" ? "segments" : "all",
            segmentIds: block.audience?.segmentIds || [],
          })
        }
      />
      {block.audience?.mode === "segments" && (
        <>
          {segments.isLoading ? (
            <p className="nl-note">Loading segments…</p>
          ) : segments.error ? (
            <p role="alert" className="nl-error">
              Could not load account segments.{" "}
              <button
                type="button"
                className="nl-quiet"
                onClick={() => void segments.refetch()}
              >
                Retry
              </button>
            </p>
          ) : (
            (segments.data || []).map((segment) => (
              <label
                key={segment.id}
                className="nl-inline"
                style={{ padding: "5px 0" }}
              >
                <input
                  type="checkbox"
                  checked={
                    block.audience?.segmentIds?.includes(segment.id) || false
                  }
                  onChange={(event) => {
                    const ids = block.audience?.segmentIds || [];
                    onChange({
                      mode: "segments",
                      segmentIds: event.target.checked
                        ? [...ids, segment.id]
                        : ids.filter((id) => id !== segment.id),
                    });
                  }}
                />
                {segment.name}
              </label>
            ))
          )}
          <p className="nl-note">
            Shown when the recipient belongs to any selected segment. The editor
            shows all blocks; delivery checks the recipient's account and
            membership.
          </p>
          {!block.audience.segmentIds?.length && (
            <p className="nl-error">
              No segment is selected. This block will be hidden from all
              recipients.
            </p>
          )}
        </>
      )}
    </details>
  );
}
