import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useCreateFlow } from "@/state/useCreateFlow";
import { useGeneratedBundle } from "@/hooks/useGeneratedBundle";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { MediaSelector } from "@/components/image/MediaSelector";
import { EmailPreview } from "@/components/crm/EmailPreview";
import { convertNewsletterToCRM_Direct } from "@/utils/newsletterToCrmSync";
import { buildEmailHtmlFromNewsletter } from "@/utils/newsletterToCrmConverter";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";

interface GeneratedContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratedContentModal({ open, onOpenChange }: GeneratedContentModalProps) {
  const { bundleId, snapshotId, setBundleIds } = useCreateFlow();
  const { query, update } = useGeneratedBundle(bundleId || undefined);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Saved items from server
  const items = useMemo(() => query.data?.content.items || [], [query.data]);

  // Local draft state and dirty tracking
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  useEffect(() => {
    setDraftItems(items);
    setDirty(new Set());
  }, [items]);

  // Local edit only
  const editItem = (index: number, patch: any) => {
    setDraftItems((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] || {}), ...patch };
      return next;
    });
    setDirty((prev) => {
      const n = new Set(prev);
      n.add(index);
      return n;
    });
  };

  // Persist a single item
  const handleSaveItem = async (index: number) => {
    if (!query.data || !snapshotId) return;
    const next = { ...query.data.content } as any;
    next.items = [...next.items];
    next.items[index] = draftItems[index];
    try {
      await update.mutateAsync({ snapshotId, content: next });
      setDirty((prev) => {
        const n = new Set(prev);
        n.delete(index);
        return n;
      });
      toast({ title: "Saved", description: "Changes saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save", variant: "destructive" });
    }
  };

  const handleCancelItem = (index: number) => {
    setDraftItems((prev) => {
      const next = [...prev];
      next[index] = items[index];
      return next;
    });
    setDirty((prev) => {
      const n = new Set(prev);
      n.delete(index);
      return n;
    });
  };

  const handleSaveAll = async () => {
    if (!query.data || !snapshotId || dirty.size === 0) return;
    const next = { ...query.data.content } as any;
    next.items = draftItems;
    try {
      await update.mutateAsync({ snapshotId, content: next });
      setDirty(new Set());
      toast({ title: "All changes saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save all", variant: "destructive" });
    }
  };

  const handleApproveItem = async (index: number) => {
    if (!query.data || !snapshotId) return;
    const next = { ...query.data.content } as any;
    next.items = [...draftItems];
    next.items[index] = { ...next.items[index], _approved: true };
    try {
      await update.mutateAsync({ snapshotId, content: next });
      setDirty((prev) => {
        const n = new Set(prev);
        n.delete(index);
        return n;
      });
      toast({ title: "Approved", description: "Item approved" });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to approve", variant: "destructive" });
    }
  };

  const handleApproveAll = async () => {
    if (!query.data || !snapshotId) return;
    const confirmed = window.confirm('Approve all items? This will mark every item as approved.');
    if (!confirmed) return;
    try {
      const allApproved = (draftItems || []).map((it: any) => ({ ...it, _approved: true }));
      await update.mutateAsync({ snapshotId, content: { ...query.data.content, items: allApproved } });
      setDirty(new Set());
      toast({ title: 'Approved', description: 'All items marked as approved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to approve all', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setBundleIds(null, null);
    onOpenChange(false);
  };

  const handoffPublish = (channel: 'instagram'|'facebook') => {
    toast({ title: 'Sent to Publish Portal', description: `Opening ${channel}` });
    navigate(`/publish?bundleId=${bundleId}&channel=${channel}`);
  };

  const handoffNewsletter = () => {
    toast({ title: 'Opened in Block Builder', description: 'Prefilling newsletter content' });
    navigate(`/crm/campaigns/new?type=newsletter&bundleId=${bundleId}`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review & Approve</DialogTitle>
          <DialogDescription>Edit copy, choose media, then approve.</DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading generated content…</div>
        ) : (draftItems?.length || 0) === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No generated items yet.</div>
        ) : (
          <div className="space-y-4">
            {draftItems.map((item: any, idx: number) => (
              <div key={idx} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium capitalize">{item.channel}</div>
                  <div className="flex items-center gap-2">
                    {dirty.has(idx) && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleSaveItem(idx)} disabled={update.isPending}>
                          {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCancelItem(idx)} disabled={update.isPending}>
                          Cancel
                        </Button>
                      </>
                    )}
                    <span className={`text-xs ${item._approved ? 'text-green-600' : 'text-muted-foreground'}`}>{item._approved ? 'Approved' : 'Draft'}</span>
                    {!item._approved ? (
                      <Button size="sm" variant="outline" onClick={() => handleApproveItem(idx)} disabled={update.isPending}>
                        {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Approve
                      </Button>
                    ) : item.channel === 'instagram' || item.channel === 'facebook' ? (
                      <Button size="sm" onClick={() => handoffPublish(item.channel as 'instagram'|'facebook')}>Post to Social</Button>
                    ) : item.channel === 'newsletter' ? (
                      <Button size="sm" onClick={handoffNewsletter}>Send to CRM</Button>
                    ) : item.channel === 'blog' ? (
                      <Button size="sm" variant="outline" disabled title="Send to Website – Coming Soon">
                        Send to Website – Coming Soon
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Input
                      value={sanitizeWeekNumbers(item.title || '')}
                      onChange={(e) => editItem(idx, { title: e.target.value })}
                      placeholder="Title (optional)"
                    />
                    {item.channel === 'instagram' || item.channel === 'facebook' ? (
                      <textarea
                        className="w-full min-h-[240px] md:min-h-[320px] rounded-md border p-3 text-sm leading-relaxed resize-y"
                        value={sanitizeWeekNumbers(item.caption || '')}
                        onChange={(e) => editItem(idx, { caption: e.target.value })}
                        placeholder="Write a caption"
                      />
                    ) : item.channel === 'video' ? (
                      <textarea
                        className="w-full min-h-[240px] md:min-h-[320px] rounded-md border p-3 text-sm leading-relaxed resize-y"
                        value={sanitizeWeekNumbers(item.script || '')}
                        onChange={(e) => editItem(idx, { script: e.target.value })}
                        placeholder="Write a short video script"
                      />
                    ) : item.channel === 'blog' ? (
                      <div className="w-full">
                        <RichTextEditor
                          content={sanitizeWeekNumbers(item.markdown || item.body || '')}
                          onChange={(html) => editItem(idx, { markdown: html })}
                          placeholder="Write and format your blog content"
                          className="w-full"
                        />
                      </div>
                    ) : (
                      item.channel === 'newsletter' ? (
                        <>
                          <textarea
                            className="w-full min-h-[240px] md:min-h-[320px] rounded-md border p-3 text-sm leading-relaxed resize-y"
                            value={sanitizeWeekNumbers(item.body || '')}
                            onChange={(e) => editItem(idx, { body: e.target.value })}
                            placeholder="Write newsletter body"
                          />
                          <div className="mt-3 rounded-md border">
                            <EmailPreview
                              blocks={Array.isArray(item.blocks) && item.blocks.length ? item.blocks : convertNewsletterToCRM_Direct(item.body || '')}
                              campaignName={item.title || 'Newsletter'}
                              subjectLine={item.title || 'Newsletter'}
                              senderName="Your Garden Center"
                              senderEmail="newsletter@example.com"
                            />
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Email HTML (read-only)</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const html = buildEmailHtmlFromNewsletter(item.body || '', item.title || 'Newsletter');
                                  navigator.clipboard.writeText(html);
                                  toast({ title: 'Copied HTML to clipboard' });
                                }}
                              >
                                Copy HTML
                              </Button>
                            </div>
                            <textarea
                              className="w-full min-h-[160px] rounded-md border p-3 text-xs font-mono"
                              readOnly
                              value={buildEmailHtmlFromNewsletter(item.body || '', item.title || 'Newsletter')}
                            />
                          </div>
                        </>
                      ) : (
                        <textarea
                          className="w-full min-h-[240px] md:min-h-[320px] rounded-md border p-3 text-sm leading-relaxed resize-y"
                          value={sanitizeWeekNumbers(item.body || '')}
                          onChange={(e) => editItem(idx, { body: e.target.value })}
                          placeholder="Write body"
                        />
                      )
                    )}
                  </div>
                  <div className="space-y-2">
                    <MediaSelector
                      compact
                      selectedImageUrl={item.media?.url}
                      contentContext={item.title || item.caption || item.script || item.markdown || item.body}
                      onImageSelect={(url: string, metadata?: any) =>
                        editItem(idx, { media: { url, alt: metadata?.alt_text || item.media?.alt } })
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleSaveAll} disabled={dirty.size === 0 || update.isPending}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save All
            </Button>
            <Button onClick={handleApproveAll} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve All
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
