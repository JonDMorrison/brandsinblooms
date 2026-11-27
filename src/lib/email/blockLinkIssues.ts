// Which block links would go out broken, using the shared link check. The
// campaign editor's send checks, the Studio canvas and the test-send warning
// all read this list, so they always agree.
import type { StudioBlock } from "@/types/studioBlocks";
import { getBlockDisplayLabel } from "@/components/crm/studio/blockLibraryData";
import { validateLinkUrl } from "@/lib/email/linkValidation";

export type BlockLinkProblem = "empty" | "invalid" | "unsafe";

export interface BlockLinkIssue {
  /** Where the link lives in the block, for example "galleryProducts.1.buttonUrl". */
  field: string;
  /** What the person calls it, for example "Product 2 button link". */
  fieldLabel: string;
  problem: BlockLinkProblem;
}

export interface CampaignBlockLinkIssues {
  blockId: string;
  /** 1-based position among all blocks, as the canvas shows them. */
  position: number;
  blockLabel: string;
  issues: BlockLinkIssue[];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Whether the block's button goes out. Photo Banner buttons are opt-in and
 * coupon buttons are on unless hidden (the same rule as the message check);
 * a button with no words is not drawn. YouTube buttons always open the video.
 */
function buttonSends(block: StudioBlock): boolean {
  if (block.type === "youtube" || block.type === "footer") return false;
  if (block.type === "graphic-hero" && block.showButton !== true) return false;
  if (block.type === "coupon" && block.showButton === false) return false;
  return hasText(block.buttonText);
}

/**
 * Every link in one block that would go out empty or broken. A link that
 * must be there (a button with words) is a problem when empty; an optional
 * link (on an image) is only checked when something is typed in it. Hidden
 * blocks send nothing and have no problems.
 */
export function findBlockLinkIssues(block: StudioBlock): BlockLinkIssue[] {
  if (block.visible === false) return [];
  const issues: BlockLinkIssue[] = [];
  const check = (field: string, fieldLabel: string, value: unknown, required: boolean) => {
    const text = typeof value === "string" ? value : "";
    if (!text.trim()) {
      if (required) issues.push({ field, fieldLabel, problem: "empty" });
      return;
    }
    const result = validateLinkUrl(text);
    if (result.status === "unsafe" || result.status === "invalid") {
      issues.push({ field, fieldLabel, problem: result.status });
    }
  };

  if (buttonSends(block)) check("buttonUrl", "Button link", block.buttonUrl, true);
  if (block.imageLinkEnabled !== false) check("linkUrl", "Image link", block.linkUrl, false);
  if (block.showSecondaryLink && hasText(block.secondaryLinkText)) {
    check("secondaryLinkUrl", "Secondary link", block.secondaryLinkUrl, true);
  }
  (block.galleryImages ?? []).forEach((image, index) => {
    check(`galleryImages.${index}.linkUrl`, `Image ${index + 1} link`, image?.linkUrl, false);
  });
  (block.galleryProducts ?? []).forEach((product, index) => {
    check(`galleryProducts.${index}.linkUrl`, `Product ${index + 1} image link`, product?.linkUrl, false);
    check(
      `galleryProducts.${index}.buttonUrl`,
      `Product ${index + 1} button link`,
      product?.buttonUrl,
      hasText(product?.buttonText),
    );
  });
  if (block.type === "button-group" || block.type === "navigation" || block.type === "survey") {
    const noun = block.type === "survey" ? "Answer" : "Link";
    (block.links ?? []).forEach((link, index) => {
      check(`links.${index}.url`, `${noun} ${index + 1}`, link?.url, hasText(link?.label));
    });
  }
  return issues;
}

/** Each block with a link problem, in canvas order. */
export function findCampaignLinkIssues(
  blocks: ReadonlyArray<StudioBlock>,
): CampaignBlockLinkIssues[] {
  const found: CampaignBlockLinkIssues[] = [];
  blocks.forEach((block, index) => {
    const issues = findBlockLinkIssues(block);
    if (issues.length > 0) {
      found.push({
        blockId: block.id,
        position: index + 1,
        blockLabel: getBlockDisplayLabel(block),
        issues,
      });
    }
  });
  return found;
}

const PROBLEM_TEXT: Record<BlockLinkProblem, string> = {
  empty: "is empty",
  invalid: "is not a full link",
  unsafe: "is a kind of link emails can't use",
};

/** "Button link is empty", for a badge or a list. */
export function describeBlockLinkIssue(issue: BlockLinkIssue): string {
  return `${issue.fieldLabel} ${PROBLEM_TEXT[issue.problem]}`;
}

/** One sentence per block, for the send checklist and the test-send warning. */
export function describeCampaignBlockLinkIssues(entry: CampaignBlockLinkIssues): string {
  const details = entry.issues.map(describeBlockLinkIssue).join("; ");
  return `Block ${entry.position} (${entry.blockLabel}): ${details}. Enter a full link, like https://yourstore.com.`;
}
