import { useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateFlow } from "@/state/useCreateFlow";
import { useGeneratedBundle } from "@/hooks/useGeneratedBundle";
import { mediaSelector } from "@/utils/mediaSelector";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

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
    if (!query.data) return;
    const allApproved = (query.data.content.items || []).map((it: any) => ({ ...it, _approved: true }));
    update.mutate({ snapshotId: snapshotId!, content: { ...query.data.content, items: allApproved } });
  };

  const chooseImage = async (index: number) => {
    const item = items[index];
    const res = await mediaSelector({ prompt: item.title || item.body.slice(0, 80) });
    setItem(index, { media: { url: res.url, alt: res.alt } });
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

        <div className="space-y-4">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium capitalize">{item.channel}</div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${item._approved ? 'text-green-600' : 'text-muted-foreground'}`}>{item._approved ? 'Approved' : 'Draft'}</span>
                  <Button size="sm" variant="outline" onClick={() => setItem(idx, { _approved: !item._approved })}>{item._approved ? 'Unapprove' : 'Approve'}</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Input
                    value={item.title || ''}
                    onChange={(e) => setItem(idx, { title: e.target.value })}
                    placeholder="Title (optional)"
                  />
                  <textarea
                    className="w-full min-h-[120px] rounded-md border p-3 text-sm"
                    value={item.body}
                    onChange={(e) => setItem(idx, { body: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="aspect-video bg-muted flex items-center justify-center rounded-md overflow-hidden">
                    {item.media?.url ? (
                      <img src={item.media.url} alt={item.media.alt || ''} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-xs text-muted-foreground">No image selected</span>
                    )}
                  </div>
                  <Button variant="secondary" onClick={() => chooseImage(idx)}>Choose Image</Button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.channel === 'instagram' && <Button size="sm" onClick={() => handoffPublish('instagram')}>Go to Publish Portal</Button>}
                {item.channel === 'facebook' && <Button size="sm" onClick={() => handoffPublish('facebook')}>Go to Publish Portal</Button>}
                {item.channel === 'newsletter' && <Button size="sm" onClick={handoffNewsletter}>Send to CRM</Button>}
                {item.channel === 'blog' && (
                  <Button size="sm" variant="outline" disabled title="Send to Website – Coming Soon">Send to Website – Coming Soon</Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button onClick={approveAll}>Approve All</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
