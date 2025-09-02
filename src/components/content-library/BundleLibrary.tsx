import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Trash2, Search, Filter, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import { useContentLibrary, useDeleteBundle } from "@/hooks/useContentLibrary";
import type { Channel } from "@/lib/content/libraryTypes";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useLocation, useNavigate } from "react-router-dom";
import { GeneratedContentModal } from "@/components/create-flow/GeneratedContentModal";
import { useCreateFlow } from "@/state/useCreateFlow";
import { useBundlePreviewTitle } from "@/hooks/useBundlePreviewTitle";
import { GenerationProgressBanner } from "@/components/generation/GenerationProgressBanner";
import { ContentGenerationSkeleton } from "@/components/generation/ContentGenerationSkeleton";
import { useGenerationJobTracker } from "@/state/useGenerationJobTracker";

const channelLabels: Record<Channel, string> = {
  instagram: 'IG',
  facebook: 'FB',
  newsletter: 'Newsletter',
  video: 'Video',
  blog: 'Blog',
};

function useQueryParams() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

function getBundleDisplayName(it: { sourceLabel?: string; mode: 'event'|'seasonal'|'custom'; channels?: Channel[]; updatedAt: string }): string {
  const raw = (it.sourceLabel || '').trim();
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
  const isNonTitle = !raw || isUUID || /^untitled$/i.test(raw);
  if (!isNonTitle) return raw;
  const modeLabel = it.mode === 'event' ? 'Event' : it.mode === 'seasonal' ? 'Seasonal' : 'Custom';
  let channelPart = 'General';
  if (it.channels && it.channels.length > 0) {
    channelPart = it.channels.length === 1 ? channelLabels[it.channels[0]] : 'Multi-channel';
  }
  const datePart = new Date(it.updatedAt).toLocaleDateString();
  return `${modeLabel} • ${channelPart} • Updated ${datePart}`;
}

function BundleCard({ it, openBundle, handleDelete }: { it: any; openBundle: (bundleId: string, snapshotId?: string) => void; handleDelete: (bundleId: string) => Promise<any> | void }) {
  const { title } = useBundlePreviewTitle(it.bundleId, { includeChannelTag: false });
  const displayTitle = title || getBundleDisplayName(it);
  return (
    <Card key={it.bundleId} className="relative p-3 hover:shadow-md transition cursor-pointer" onClick={(e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-trash]')) return;
      openBundle(it.bundleId, it.snapshotId);
    }}>
      {it.thumbnail ? (
        <img src={it.thumbnail} alt={`${displayTitle} thumbnail`} className="w-full aspect-video object-cover rounded-lg mb-3" loading="lazy" />
      ) : (
        <div className="w-full aspect-video rounded-lg mb-3 bg-muted" />
      )}

      <button
        data-trash
        aria-label="Delete"
        className="absolute right-3 top-3 p-2 rounded-full bg-background/80 border hover:bg-background"
        onClick={() => handleDelete(it.bundleId)}
        title="Delete"
      >
        <Trash2 className="h-5 w-5 text-destructive" />
      </button>

      <div className="text-sm font-semibold truncate" title={displayTitle}>
        {displayTitle}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-xs capitalize">{it.mode}</Badge>
        {it.channels?.map((ch: Channel) => (
          <Badge key={ch} variant="outline" className="text-xs">{channelLabels[ch]}</Badge>
        ))}
      </div>

      <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {it.approvedCount}/{it.totalItems} approved</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Updated {new Date(it.updatedAt).toLocaleDateString()}</span>
      </div>

      <div className="mt-2 text-xs text-primary inline-flex items-center">
        Open <ChevronRight className="h-3 w-3 ml-1" />
      </div>
    </Card>
  );
}

export const BundleLibrary = () => {
  const navigate = useNavigate();
  const params = useQueryParams();
  const { getJobsByType, getActiveJobs } = useGenerationJobTracker();

  const [search, setSearch] = useState(params.get('q') || '');
  const [mode, setMode] = useState<("event"|"seasonal"|"custom"|"all")>((params.get('mode') as any) || 'all');
  const [channel, setChannel] = useState<Channel | 'all'>(((params.get('channel') as any) || 'all'));
  const [sort, setSort] = useState<'newest'|'updated'>(((params.get('sort') as any) || 'updated'));
  const [page, setPage] = useState<number>(parseInt(params.get('page') || '1', 10));

  const debouncedSearch = useDebounce(search, 300);

  // Sync URL params
  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set('q', debouncedSearch);
    if (mode !== 'all') p.set('mode', mode);
    if (channel !== 'all') p.set('channel', channel);
    if (sort !== 'updated') p.set('sort', sort);
    if (page > 1) p.set('page', String(page));
    navigate({ pathname: '/content/library', search: p.toString() }, { replace: true });
  }, [debouncedSearch, mode, channel, sort, page, navigate]);

  const { data, isLoading } = useContentLibrary({ search: debouncedSearch, mode, channel, page, pageSize: 24, sort });
  const total = data?.total || 0;
  const items = data?.items || [];
  
  // Check for active generation jobs
  const activeJobs = getActiveJobs();
  const bundleJobs = getJobsByType('bundle').concat(getJobsByType('custom'));

  const { toast } = useToast();
  const del = useDeleteBundle();

  const [modalOpen, setModalOpen] = useState(false);
  const { setBundleIds } = useCreateFlow();

  const openBundle = (bundleId: string, snapshotId?: string) => {
    // hydrate create flow and open modal
    setBundleIds(bundleId, snapshotId || null);
    setModalOpen(true);
    window.dispatchEvent(new CustomEvent('library_card_open', { detail: { bundleId } }));
  };

  const handleDelete = async (bundleId: string) => {
    const confirmed = window.confirm('Delete this bundle? You can Undo for 10 seconds.');
    if (!confirmed) return;
    window.dispatchEvent(new CustomEvent('library_delete_confirm', { detail: { bundleId } }));
    await del.mutateAsync({ bundleId, deletedAt: new Date().toISOString() });
    const t = toast({
      title: 'Deleted',
      description: 'Bundle moved to trash',
      action: (
        <ToastAction altText="Undo" onClick={async () => {
          await del.mutateAsync({ bundleId, deletedAt: null });
          toast({ title: 'Restored', description: 'Bundle restored' });
        }}>
          Undo
        </ToastAction>
      )
    });
    return t;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">My Content</h1>
        <p className="text-sm text-muted-foreground">Previously generated posts, newsletters, and more.</p>
      </header>

      <section className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative md:flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); window.dispatchEvent(new CustomEvent('library_filter_change')); }}
            placeholder="Search by title"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select className="border rounded-md px-2 py-1 text-sm" value={mode} onChange={e => { setMode(e.target.value as any); setPage(1); }}>
            <option value="all">All Modes</option>
            <option value="event">Event</option>
            <option value="seasonal">Seasonal</option>
            <option value="custom">Custom</option>
          </select>
          <select className="border rounded-md px-2 py-1 text-sm" value={channel} onChange={e => { setChannel(e.target.value as any); setPage(1); }}>
            <option value="all">All Channels</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="newsletter">Newsletter</option>
            <option value="video">Video</option>
            <option value="blog">Blog</option>
          </select>
          <select className="border rounded-md px-2 py-1 text-sm" value={sort} onChange={e => setSort(e.target.value as any)}>
            <option value="newest">Newest</option>
            <option value="updated">Last Updated</option>
          </select>
        </div>
      </section>

      {/* Generation Progress Banner */}
      <GenerationProgressBanner />

      <main>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 && bundleJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-2xl">
            <p className="text-sm text-muted-foreground mb-3">No content yet</p>
            <Button onClick={() => navigate('/')}>Create Any Content</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Show generation skeletons for active jobs */}
            {bundleJobs.filter(job => job.status === 'generating').length > 0 && (
              <ContentGenerationSkeleton 
                type="bundle" 
                count={bundleJobs.filter(job => job.status === 'generating').length}
                className="mb-6"
              />
            )}
            
            {/* Show actual content */}
            {items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((it: any) => (
                  <BundleCard key={it.bundleId} it={it} openBundle={openBundle} handleDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <GeneratedContentModal open={modalOpen} onOpenChange={setModalOpen} />

      {/* Simple pagination */}
      {total > 24 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
          <div className="text-xs text-muted-foreground">Page {page}</div>
          <Button variant="outline" size="sm" disabled={items.length < 24} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
};
