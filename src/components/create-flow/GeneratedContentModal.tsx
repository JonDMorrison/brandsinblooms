import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useCreateFlow } from "@/state/useCreateFlow";
import { useGeneratedBundle } from "@/hooks/useGeneratedBundle";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { MediaSelector } from "@/components/image/MediaSelector";
import { EmailPreview } from "@/components/crm/EmailPreview";
import { EditableNewsletterPreview } from "./EditableNewsletterPreview";
import { convertNewsletterToCRM_Direct } from "@/utils/newsletterToCrmSync";
import { buildEmailHtmlFromNewsletter } from "@/utils/newsletterToCrmConverter";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
// Removed markdown import - blog content now generated as HTML

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
    handleClose();
    toast({ title: 'Sent to Publish Portal', description: `Opening ${channel}` });
    navigate(`/publish?bundleId=${bundleId}&channel=${channel}`);
  };

  const handoffNewsletter = (newsletterItem: any) => {
    console.log('🚀 [CLICK DEBUG] handoffNewsletter function called!');
    console.log('🚀 [CLICK DEBUG] Event fired with item:', newsletterItem);
    console.log('🚀 [CLICK DEBUG] Item channel:', newsletterItem?.channel);
    console.log('🚀 [CLICK DEBUG] Item approved status:', newsletterItem?._approved);
    
    try {
      // Encode the newsletter content to pass to the block builder
      const newsletterData = {
        title: newsletterItem.title || 'Newsletter',
        content: newsletterItem.body || '',
        featuredImage: newsletterItem.media?.url || '',
        bundleId: bundleId
      };
      
      console.log('📦 [CLICK DEBUG] Newsletter data prepared:', newsletterData);
      
      // Pass the newsletter data as encoded query parameters
      const params = new URLSearchParams({
        type: 'newsletter',
        bundleId: bundleId || '',
        prefillData: JSON.stringify(newsletterData)
      });
      
      const targetUrl = `/crm/campaigns/new?${params.toString()}`;
      console.log('🔗 [CLICK DEBUG] Navigating to URL:', targetUrl);
      console.log('📝 [CLICK DEBUG] Query params:', params.toString());
      
      toast({ title: 'Opening Block Builder', description: 'Transferring newsletter content...' });
      
      navigate(targetUrl);
      console.log('✅ [CLICK DEBUG] Navigation completed');
      
    } catch (error) {
      console.error('❌ [CLICK DEBUG] Error in handoffNewsletter:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col text-gray-900 bg-white">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-900">Review & Approve Content</DialogTitle>
          <DialogDescription className="text-gray-900">Edit copy, choose images with MediaSelector, then approve for publishing.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {query.isLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading generated content…</div>
          ) : (draftItems?.length || 0) === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No generated items yet.</div>
          ) : (
            <div className="space-y-6">
              {draftItems.map((item: any, idx: number) => (
                <div key={idx} className="rounded-lg border p-6 bg-card text-gray-900">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold capitalize text-lg text-gray-900">{item.channel}</div>
                      <span className={`text-xs px-2 py-1 rounded-full ${item._approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {item._approved ? 'Approved' : 'Draft'}
                      </span>
                    </div>
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
                      {!item._approved ? (
                        <Button size="sm" onClick={() => handleApproveItem(idx)} disabled={update.isPending}>
                          {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Approve
                        </Button>
                      ) : item.channel === 'instagram' || item.channel === 'facebook' ? (
                        <Button size="sm" onClick={() => handoffPublish(item.channel as 'instagram'|'facebook')}>
                          → Publish Portal
                        </Button>
                      ) : item.channel === 'newsletter' ? (
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            console.log('🎯 [BUTTON DEBUG] Button clicked!');
                            console.log('🎯 [BUTTON DEBUG] Click event:', e);
                            console.log('🎯 [BUTTON DEBUG] Item being passed:', item);
                            console.log('🎯 [BUTTON DEBUG] Item channel:', item.channel);
                            console.log('🎯 [BUTTON DEBUG] Item approved:', item._approved);
                            handoffNewsletter(item);
                          }}
                          onMouseEnter={() => console.log('🔍 [BUTTON DEBUG] Button hover detected')}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          Send to Block builder
                        </Button>
                      ) : item.channel === 'blog' ? (
                        <Button size="sm" variant="outline" disabled title="Send to Website – Coming Soon">
                          → Send to Website (Coming Soon)
                        </Button>
                      ) : item.channel === 'video' ? (
                        <Button size="sm" variant="outline" disabled title="Video publishing coming soon">
                          → Video Publisher (Coming Soon)
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block text-gray-900">Title</Label>
                        <Input
                          value={sanitizeWeekNumbers(item.title || '')}
                          onChange={(e) => editItem(idx, { title: e.target.value })}
                          placeholder="Enter title (optional)"
                          className="w-full text-gray-900"
                        />
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium mb-2 block text-gray-900">Content</Label>
                        {item.channel === 'instagram' || item.channel === 'facebook' ? (
                          <textarea
                            className="w-full min-h-[200px] rounded-md border p-3 text-sm leading-relaxed resize-y text-gray-900"
                            value={sanitizeWeekNumbers(item.caption || '')}
                            onChange={(e) => editItem(idx, { caption: e.target.value })}
                            placeholder="Write your social media caption..."
                          />
                        ) : item.channel === 'video' ? (
                          <textarea
                            className="w-full min-h-[200px] rounded-md border p-3 text-sm leading-relaxed resize-y text-gray-900"
                            value={sanitizeWeekNumbers(item.script || '')}
                            onChange={(e) => editItem(idx, { script: e.target.value })}
                            placeholder="Write your video script..."
                          />
                          ) : item.channel === 'blog' ? (
                            <div className="w-full">
                              <RichTextEditor
                                content={sanitizeWeekNumbers(item.body || item.markdown || '')}
                                onChange={(html) => editItem(idx, { body: html })}
                                placeholder="Write and format your blog content..."
                                className="w-full min-h-[200px]"
                              />
                            </div>
                          ) : item.channel === 'newsletter' ? (
                             <div className="space-y-2">
                               <p className="text-xs text-gray-500">Newsletter will use CRM block templates when approved</p>
                              <EditableNewsletterPreview
                                content={sanitizeWeekNumbers(item.body || '')}
                                title={item.title || 'Newsletter'}
                                onChange={(content) => editItem(idx, { body: content })}
                                onSave={() => handleSaveItem(idx)}
                                className="w-full"
                              />
                            </div>
                         ) : (
                          <textarea
                            className="w-full min-h-[200px] rounded-md border p-3 text-sm leading-relaxed resize-y text-gray-900"
                            value={sanitizeWeekNumbers(item.body || '')}
                            onChange={(e) => editItem(idx, { body: e.target.value })}
                            placeholder="Write content..."
                          />
                        )}
                      </div>
                    </div>
                    
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium mb-2 block text-gray-900">Featured Image</Label>
                          <MediaSelector
                            compact
                            selectedImageUrl={item.media?.url}
                            contentContext={item.title || item.caption || item.script || item.body}
                            onImageSelect={(url: string, metadata?: any) =>
                              editItem(idx, { media: { url, alt: metadata?.alt_text || item.media?.alt } })
                            }
                            autoSelectFirst={item.requiresMediaSelector || item.autoSelectImage || true}
                          />
                          <p className="text-xs text-gray-500 mt-2">
                            MediaSelector automatically opens and finds relevant images based on your content
                          </p>
                        </div>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center justify-between mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleSaveAll} disabled={dirty.size === 0 || update.isPending}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save All Changes
            </Button>
            <Button onClick={handleApproveAll} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve All Content
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
