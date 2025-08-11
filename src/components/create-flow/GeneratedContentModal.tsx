import { useMemo } from "react";
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

interface GeneratedContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratedContentModal({ open, onOpenChange }: GeneratedContentModalProps) {
  const { bundleId, snapshotId, setBundleIds } = useCreateFlow();
  const { query, update } = useGeneratedBundle(bundleId || undefined);
  const { toast } = useToast();
  const navigate = useNavigate();

  const items = useMemo(() => query.data?.content.items || [], [query.data]);

  const setItem = (index: number, patch: any) => {
    if (!query.data || !snapshotId) return;
    const next = { ...query.data.content } as any;
    next.items = [...next.items];
    next.items[index] = { ...next.items[index], ...patch };
    update.mutate({ snapshotId, content: next });
  };

  const approveAll = () => {
    if (!query.data || !snapshotId) return;
    const confirmed = window.confirm('Approve all items? This will mark every item as approved.');
    if (!confirmed) return;
    try {
      const allApproved = (query.data.content.items || []).map((it: any) => ({ ...it, _approved: true }));
      update.mutate({ snapshotId, content: { ...query.data.content, items: allApproved } });
      toast({ title: 'Approved', description: 'All items marked as approved' });
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Failed to approve all', variant: 'destructive' });
    }
  };

// Removed chooseImage in favor of MediaSelector component usage

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
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No generated items yet.</div>
        ) : (
          <div className="space-y-4">
            {items.map((item: any, idx: number) => (
              <div key={idx} className="rounded-2xl border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium capitalize">{item.channel}</div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${item._approved ? 'text-green-600' : 'text-muted-foreground'}`}>{item._approved ? 'Approved' : 'Draft'}</span>
                      {!item._approved ? (
                        <Button size="sm" variant="outline" onClick={() => setItem(idx, { _approved: true })}>
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
                      value={item.title || ''}
                      onChange={(e) => setItem(idx, { title: e.target.value })}
                      placeholder="Title (optional)"
                    />
                    {item.channel === 'instagram' || item.channel === 'facebook' ? (
                      <textarea
                        className="w-full min-h-[120px] rounded-md border p-3 text-sm"
                        value={item.caption || ''}
                        onChange={(e) => setItem(idx, { caption: e.target.value })}
                        placeholder="Write a caption"
                      />
                    ) : item.channel === 'video' ? (
                      <textarea
                        className="w-full min-h-[140px] rounded-md border p-3 text-sm"
                        value={item.script || ''}
                        onChange={(e) => setItem(idx, { script: e.target.value })}
                        placeholder="Write a short video script"
                      />
                    ) : item.channel === 'blog' ? (
                      <div className="w-full">
                        <RichTextEditor
                          content={item.markdown || item.body || ''}
                          onChange={(html) => setItem(idx, { markdown: html })}
                          placeholder="Write and format your blog content"
                          className="w-full"
                        />
                      </div>
                    ) : (
item.channel === 'newsletter' ? (
                      <>
                        <textarea
                          className="w-full min-h-[120px] rounded-md border p-3 text-sm"
                          value={item.body || ''}
                          onChange={(e) => setItem(idx, { body: e.target.value })}
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
                      </>
                    ) : (
                      <textarea
                        className="w-full min-h-[120px] rounded-md border p-3 text-sm"
                        value={item.body || ''}
                        onChange={(e) => setItem(idx, { body: e.target.value })}
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
                        setItem(idx, { media: { url, alt: metadata?.alt_text || item.media?.alt } })
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
          <Button onClick={approveAll} disabled={update.isPending}>
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
