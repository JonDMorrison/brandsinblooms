import * as React from "react";
import { draftPreviewText } from "@/lib/crm/newsletterInbox";
import type { StudioBlock } from "@/types/studioBlocks";

/**
 * Keeps the preview text drafted from the design until the person writes
 * their own. When the preview text is empty and a design exists, it is set
 * to the first sentence of the first text block (greeting removed). When the
 * design changes it is drafted again, unless the person has typed something
 * other than the last draft. Lives in the editor rather than the Inbox step,
 * which unmounts while it is closed.
 */
export function usePreviewTextAutoDraft({
  blocks,
  previewText,
  onDraft,
  enabled,
}: {
  blocks: StudioBlock[];
  previewText: string;
  onDraft: (previewText: string) => void;
  /** False while the campaign loads, for SMS, and for locked campaigns. */
  enabled: boolean;
}) {
  const draft = React.useMemo(() => draftPreviewText(blocks), [blocks]);
  const hasDesign = React.useMemo(
    () =>
      blocks.some(
        (block) => block.type !== "footer" && block.visible !== false,
      ),
    [blocks],
  );
  // The value this hook last wrote (or found already matching the draft).
  // null until the first check, and whenever the person owns the text.
  const lastDraftRef = React.useRef<string | null>(null);
  const checkedRef = React.useRef(false);
  const previewRef = React.useRef(previewText);
  previewRef.current = previewText;
  const onDraftRef = React.useRef(onDraft);
  onDraftRef.current = onDraft;

  React.useEffect(() => {
    if (!enabled || !hasDesign) return;
    const current = previewRef.current;
    const isEmpty = current.trim().length === 0;
    if (!checkedRef.current) {
      checkedRef.current = true;
      // Text saved earlier that matches this design's draft is still a draft.
      if (!isEmpty && current !== draft) {
        lastDraftRef.current = null;
        return;
      }
    } else if (!isEmpty && current !== lastDraftRef.current) {
      // The person typed their own preview text; leave it alone.
      return;
    }
    lastDraftRef.current = draft;
    if (current !== draft) onDraftRef.current(draft);
    // Runs on load and when the design (its drafted text) changes, not on
    // every keystroke in the preview field.
  }, [draft, enabled, hasDesign]);
}
