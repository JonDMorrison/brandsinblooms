import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { useCreateFlow } from "@/state/useCreateFlow";
import { useToast } from "@/hooks/use-toast";
import { sanitizeCampaignTitle } from "@/utils/weekNumberSanitizer";
import { Loader2, AlertCircle } from "lucide-react";
import { GeneratedContentModal } from "./GeneratedContentModal";
import { getSeasonalTemplates, type SeasonalTemplate } from "@/utils/seasonalTemplateService";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

// Local helper: format a YYYY-MM-DD string to a readable date
const fmtLocalDate = (d?: string) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return String(d);
  }
};

interface CreateFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = 'event'|'seasonal'|'custom';

export function CreateFlowDialog({ open, onOpenChange }: CreateFlowDialogProps) {
  const { toast } = useToast();
  const {
    selectedPath, setSelectedPath,
    selectedSourceId, setSelectedSourceId,
    bundleId, snapshotId, setBundleIds,
    channels, setChannels,
  } = useCreateFlow();

  const [step, setStep] = useState<1|2>(1);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  // Custom idea form state
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<'traffic'|'sales'|'awareness'|'none'>("traffic");
  const [tone, setTone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Event/Seasonal data
  const [events, setEvents] = useState<any[]>([]);
  const [weeklyThemes, setWeeklyThemes] = useState<SeasonalTemplate[]>([]);
  const [search, setSearch] = useState("");

  // Pagination (UI-only)
  const PAGE_SIZE = 12;
  const [visibleEvents, setVisibleEvents] = useState(PAGE_SIZE);
  const [visibleWeeklyThemes, setVisibleWeeklyThemes] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!open) {
      setStep(1); setSelectedPath(null); setSelectedSourceId(null);
      setTitle(""); setNotes(""); setTone(""); setGoal("traffic");
      setChannels({ newsletter: true, instagram: true, facebook: true, video: true, blog: true });
      return;
    }
  }, [open, setSelectedPath, setSelectedSourceId]);

  // Reset pagination when context changes
  useEffect(() => {
    setVisibleEvents(PAGE_SIZE);
    setVisibleWeeklyThemes(PAGE_SIZE);
  }, [search, step, selectedPath]);

  // Fetch data for Events & Seasonal
  useEffect(() => {
    if (step === 2 && selectedPath === 'event') {
      (async () => {
        console.info('[CreateFlowDialog] Event fetch: loading master templates for events');
        try {
          // Use master templates instead of user campaigns for events too
          const themes = await getSeasonalTemplates();
          const uniqueThemes = themes.filter((theme, index, array) => 
            array.findIndex(t => t.title.trim().toLowerCase() === theme.title.trim().toLowerCase()) === index
          );
          
          // Sort by proximity to current week for better relevance
          const currentWeek = getCurrentWeekNumber();
          const sortedThemes = uniqueThemes.sort((a, b) => {
            const aDistance = Math.min(Math.abs(a.week_number - currentWeek), Math.abs((a.week_number + 52) - currentWeek), Math.abs(a.week_number - (currentWeek + 52)));
            const bDistance = Math.min(Math.abs(b.week_number - currentWeek), Math.abs((b.week_number + 52) - currentWeek), Math.abs(b.week_number - (currentWeek + 52)));
            return aDistance - bDistance;
          });
          
          console.info('[CreateFlowDialog] Event themes loaded and deduplicated', { 
            currentWeek,
            originalCount: themes.length, 
            uniqueCount: sortedThemes.length,
            sampleTitles: sortedThemes.slice(0, 5).map(t => sanitizeCampaignTitle(t.title))
          });
          setEvents(sortedThemes);
        } catch (error) {
          console.error('[CreateFlowDialog] Failed to load event themes', error);
          setEvents([]);
        }
      })();
    }
    if (step === 2 && selectedPath === 'seasonal') {
      (async () => {
        console.info('[CreateFlowDialog] Seasonal fetch: loading weekly themes');
        try {
          const themes = await getSeasonalTemplates();
          console.info('[CreateFlowDialog] Raw themes from service:', themes.length, themes.slice(0, 3));
          
          // More robust deduplication using Map to track by title
          const uniqueThemesMap = new Map();
          themes.forEach(theme => {
            const key = theme.title.trim().toLowerCase();
            if (!uniqueThemesMap.has(key)) {
              uniqueThemesMap.set(key, theme);
            } else {
              console.warn('[CreateFlowDialog] Duplicate theme found and filtered:', theme.title, `Week ${theme.week_number}`);
            }
          });
          
          const uniqueThemes = Array.from(uniqueThemesMap.values());
          
          // Sort by proximity to current week for better relevance
          const currentWeek = getCurrentWeekNumber();
          const sortedThemes = uniqueThemes.sort((a, b) => {
            const aDistance = Math.min(Math.abs(a.week_number - currentWeek), Math.abs((a.week_number + 52) - currentWeek), Math.abs(a.week_number - (currentWeek + 52)));
            const bDistance = Math.min(Math.abs(b.week_number - currentWeek), Math.abs((b.week_number + 52) - currentWeek), Math.abs(b.week_number - (currentWeek + 52)));
            return aDistance - bDistance;
          });
          
          console.info('[CreateFlowDialog] Themes after deduplication and sorting by current week:', { 
            currentWeek,
            originalCount: themes.length, 
            uniqueCount: sortedThemes.length,
            duplicatesRemoved: themes.length - sortedThemes.length,
            sampleTitles: sortedThemes.slice(0, 5).map(t => sanitizeCampaignTitle(t.title))
          });
          setWeeklyThemes(sortedThemes);
        } catch (error) {
          console.error('[CreateFlowDialog] Failed to load weekly themes', error);
          setWeeklyThemes([]);
        }
      })();
    }
  }, [step, selectedPath]);

  // Derived filtered lists
  const filteredEvents = useMemo(() => {
    const term = search.toLowerCase();
    return events.filter((e) => !term || e.title?.toLowerCase().includes(term) || (e.theme || '').toLowerCase().includes(term) || (e.content_ideas || '').toLowerCase().includes(term));
  }, [events, search]);

  const filteredWeeklyThemes = useMemo(() => {
    const term = search.toLowerCase();
    return weeklyThemes
      .filter((theme) => !term || theme.title.toLowerCase().includes(term) || (theme.theme || '').toLowerCase().includes(term) || (theme.content_ideas || '').toLowerCase().includes(term));
  }, [weeklyThemes, search]);

  const canContinue = useMemo(() => selectedPath !== null, [selectedPath]);
  const canGenerate = useMemo(() => {
    if (selectedPath === 'custom') return title.trim().length > 2;
    return !!selectedSourceId;
  }, [selectedPath, title, selectedSourceId]);

  const startGenerate = async () => {
    if (!selectedPath) return;
    setLoading(true);
    setNetworkError(false);

    // Get workspace id for current user
    const { data: me } = await supabase.from('users').select('tenant_id').limit(1).single();
    const workspaceId = me?.tenant_id as string;

    try {
      const payload: any = {
        mode: selectedPath as Mode,
        sourceId: selectedSourceId || undefined,
        workspaceId,
        channels: (Object.keys(channels).filter((k) => (channels as any)[k]) as any[]),
      };
      if (selectedPath === 'custom') {
        payload.userIdea = {
          title,
          goal: (goal === 'none' ? undefined : goal),
          tone: tone || undefined,
          notes: notes || undefined,
        };
      }
      // Pass explicit topic details for both event and seasonal paths
      if ((selectedPath === 'seasonal' || selectedPath === 'event') && selectedSourceId) {
        const picked = selectedPath === 'seasonal' 
          ? weeklyThemes.find((theme) => theme.id === selectedSourceId)
          : events.find((theme) => theme.id === selectedSourceId);
        if (picked) {
          payload.topicTitle = `Week ${picked.week_number}: ${picked.title}`;
          payload.topicDescription = picked.theme || picked.content_ideas || '';
        }
      }

      toast({ title: 'Generating content…', description: 'Creating five items across your channels.' });
      const { data, error } = await supabase.functions.invoke('generate-multichannel-content', { body: payload });
      if (error) throw error;

      setBundleIds(data.id, data.snapshotId);
      toast({ title: 'Draft bundle ready', description: 'Review and approve your items.' });
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message || '');
      const statusMatch = msg.match(/\b(4\d{2}|5\d{2})\b/);
      const status = (e?.status || e?.context?.status || (statusMatch ? Number(statusMatch[1]) : undefined)) as number | undefined;

      if (e?.name === 'FunctionsFetchError' || msg.includes('Failed to fetch')) {
        setNetworkError(true);
        toast({ title: 'AI temporarily unavailable', description: 'Please check your connection and try again.', variant: 'destructive' });
      } else if (status === 404) {
        setNetworkError(true);
        toast({ title: 'Generator not found', description: 'AI generator is not deployed in this environment.', variant: 'destructive' });
      } else if (status === 401 || status === 403) {
        toast({ title: 'Authorization required', description: 'Please sign in again and retry.', variant: 'destructive' });
      } else {
        toast({ title: 'Generation failed', description: msg || 'Please try again.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  // UI helpers
  const ChannelCheckbox = ({ name, label }: { name: keyof typeof channels; label: string }) => (
    <label className="flex items-center gap-2">
      <Checkbox checked={channels[name]} onCheckedChange={(v) => setChannels((c) => ({ ...c, [name]: !!v }))} />
      <span>{label}</span>
    </label>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>What do you want to post about?</DialogTitle>
            <DialogDescription>Events, holidays, or your own idea—AI will draft everything.</DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'event', title: 'Seasonal Plant Care Tips', desc: 'Give advice to your customers based on time of year.' },
                { key: 'seasonal', title: 'Weekly Garden Themes', desc: 'Choose from 52 weekly gardening themes designed for year-round content.' },
                { key: 'custom', title: 'Post My Own Custom Content', desc: 'Bring your idea—AI drafts content in your voice.' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedPath(opt.key as Mode)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedPath === opt.key ? 'ring-2 ring-offset-2' : ''}`}
                >
                  <div className="font-medium">{opt.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && selectedPath === 'event' && (
            <div className="space-y-3">
              <Input placeholder="Search themes" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredEvents.slice(0, visibleEvents).map((e) => (
                  <button key={e.id} onClick={() => setSelectedSourceId(e.id)} className={`w-full rounded-xl border p-3 text-left ${selectedSourceId===e.id?'ring-1':''}`}>
                    <div className="font-medium">{sanitizeCampaignTitle(e.title)}</div>
                    <div className="text-xs text-muted-foreground">{e.theme || e.content_ideas}</div>
                  </button>
                ))}
                {filteredEvents.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {search ? 'No results for your search.' : 'No themes available. Try Custom Content instead.'}
                  </div>
                )}
                {filteredEvents.length > visibleEvents && (
                  <div className="pt-2">
                    <Button variant="secondary" onClick={() => setVisibleEvents((v) => v + PAGE_SIZE)}>Load more</Button>
                  </div>
                )}
              </div>
              <div className="pt-2 space-y-2">
                <Label>Channels</Label>
                <div className="grid grid-cols-2 gap-2">
                  <ChannelCheckbox name="instagram" label="Instagram" />
                  <ChannelCheckbox name="facebook" label="Facebook" />
                  <ChannelCheckbox name="newsletter" label="Newsletter" />
                  <ChannelCheckbox name="video" label="Short Video" />
                  <ChannelCheckbox name="blog" label="Blog" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && selectedPath === 'seasonal' && (
            <div className="space-y-3">
              <Input placeholder="Search weekly themes" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="text-xs text-muted-foreground">
                52 weekly themes available ({filteredWeeklyThemes.length} shown)
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredWeeklyThemes.slice(0, visibleWeeklyThemes).map((theme) => (
                  <button key={theme.id} onClick={() => setSelectedSourceId(theme.id)} className={`w-full rounded-xl border p-3 text-left ${selectedSourceId===theme.id?'ring-1':''}`}>
                    <div className="font-medium">{sanitizeCampaignTitle(theme.title)}</div>
                    <div className="text-xs text-muted-foreground">
                      {theme.theme || 'Weekly theme'}
                    </div>
                    {theme.content_ideas && (
                      <div className="text-xs text-muted-foreground mt-1">{theme.content_ideas}</div>
                    )}
                  </button>
                ))}
                {filteredWeeklyThemes.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {search ? 'No results for your search.' : 'No weekly themes available. Try Custom Content instead.'}
                  </div>
                )}
                {filteredWeeklyThemes.length > visibleWeeklyThemes && (
                  <div className="pt-2">
                    <Button variant="secondary" onClick={() => setVisibleWeeklyThemes((v) => v + PAGE_SIZE)}>Load more</Button>
                  </div>
                )}
              </div>
              <div className="pt-2 space-y-2">
                <Label>Channels</Label>
                <div className="grid grid-cols-3 gap-2">
                  <ChannelCheckbox name="instagram" label="Instagram" />
                  <ChannelCheckbox name="facebook" label="Facebook" />
                  <ChannelCheckbox name="newsletter" label="Newsletter" />
                  <ChannelCheckbox name="video" label="Short Video" />
                  <ChannelCheckbox name="blog" label="Blog" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && selectedPath === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label>Theme / Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Fall Planting Weekend" />
                <Label>Goal</Label>
                <NativeSelect value={goal} onChange={(e) => setGoal(e.target.value as any)}>
                  <option value="traffic">Traffic</option>
                  <option value="sales">Sales</option>
                  <option value="awareness">Awareness</option>
                  <option value="none">No specific goal</option>
                </NativeSelect>
                <Label>Tone</Label>
                <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g., Friendly, Expert, Playful" />
              </div>
              <div className="space-y-3">
                <Label>Channels</Label>
                <div className="grid grid-cols-2 gap-2">
                  <ChannelCheckbox name="instagram" label="Instagram" />
                  <ChannelCheckbox name="facebook" label="Facebook" />
                  <ChannelCheckbox name="newsletter" label="Newsletter" />
                  <ChannelCheckbox name="video" label="Short Video" />
                  <ChannelCheckbox name="blog" label="Blog" />
                </div>
                <Label className="mt-2">Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, promos, links…" />
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            {step === 1 ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button disabled={!canContinue} onClick={() => setStep(2)}>Continue</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <div className="flex items-center gap-2">
                  {networkError && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <AlertCircle className="w-3 h-3" />
                      AI unavailable
                    </div>
                  )}
                  <Button disabled={!canGenerate || loading} onClick={startGenerate}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Content
                  </Button>
                </div>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review modal opens when bundle is ready */}
      {bundleId && (
        <GeneratedContentModal open={!!bundleId} onOpenChange={() => { /* closing handled inside */ }} />
      )}
    </>
  );
}
