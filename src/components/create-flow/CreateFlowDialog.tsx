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
import { Loader2, AlertCircle } from "lucide-react";
import { GeneratedContentModal } from "./GeneratedContentModal";

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
    bundleId, snapshotId, setBundleIds
  } = useCreateFlow();

  const [step, setStep] = useState<1|2>(1);
const [loading, setLoading] = useState(false);
const [networkError, setNetworkError] = useState(false);

  // Custom idea form state
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<'traffic'|'sales'|'awareness'|'none'>("traffic");
  const [tone, setTone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [channels, setChannels] = useState({ newsletter: true, instagram: true, facebook: true, video: true, blog: true });

  // Event/Seasonal data
  const [events, setEvents] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // Pagination (UI-only)
  const PAGE_SIZE = 12;
  const [visibleEvents, setVisibleEvents] = useState(PAGE_SIZE);
  const [visibleHolidays, setVisibleHolidays] = useState(PAGE_SIZE);

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
    setVisibleHolidays(PAGE_SIZE);
  }, [search, step, selectedPath]);

  // Fetch data for Events & Seasonal
  useEffect(() => {
    if (step === 2 && selectedPath === 'event') {
      (async () => {
        const today = new Date().toISOString().slice(0,10);
        const { data } = await supabase
          .from('campaigns')
          .select('id,title,start_date,theme,description')
          .gte('start_date', today)
          .order('start_date', { ascending: true })
          .limit(25);
        setEvents(data || []);
      })();
    }
    if (step === 2 && selectedPath === 'seasonal') {
      (async () => {
        const { data, error } = await supabase.rpc('fn_get_newsletter_ideas');
        if (!error) {
          setHolidays((data as any[]) || []);
        }
      })();
    }
  }, [step, selectedPath]);

  // Derived filtered lists
  const filteredEvents = useMemo(() => {
    const term = search.toLowerCase();
    return events.filter((e) => !term || e.title?.toLowerCase().includes(term));
  }, [events, search]);

  const filteredHolidays = useMemo(() => {
    const term = search.toLowerCase();
    return holidays
      .flat()
      .filter((h: any) => !term || (h.title || '').toLowerCase().includes(term));
  }, [holidays, search]);

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
      };
      if (selectedPath === 'custom') {
        payload.userIdea = {
          title,
          goal: (goal === 'none' ? undefined : goal),
          tone: tone || undefined,
          channels: (Object.keys(channels).filter((k) => (channels as any)[k]) as any[]),
          notes: notes || undefined,
        };
      }

      toast({ title: 'Generating content…', description: 'Creating five items across your channels.' });
      const { data, error } = await supabase.functions.invoke('generate-multichannel-content', { body: payload });
      if (error) throw error;

      setBundleIds(data.id, data.snapshotId);
      toast({ title: 'Draft bundle ready', description: 'Review and approve your items.' });
    } catch (e: any) {
      console.error(e);
      if (e?.name === 'FunctionsFetchError' || e?.message?.includes('Failed to fetch')) {
        setNetworkError(true);
      }
      toast({ title: 'Generation failed', description: e?.message || 'Please try again.', variant: 'destructive' });
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
                { key: 'event', title: 'Promote an Event', desc: 'Pick an in-store event and generate ready-to-post content.' },
                { key: 'seasonal', title: 'Use Seasonal Holidays', desc: 'Choose from upcoming holidays (weekly & annual).' },
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
              <Input placeholder="Search events" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredEvents.slice(0, visibleEvents).map((e) => (
                  <button key={e.id} onClick={() => setSelectedSourceId(e.id)} className={`w-full rounded-xl border p-3 text-left ${selectedSourceId===e.id?'ring-1':''}`}>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.theme || e.description}</div>
                  </button>
                ))}
                {filteredEvents.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {search ? 'No results for your search.' : 'No upcoming events. Try Custom Content instead.'}
                  </div>
                )}
                {filteredEvents.length > visibleEvents && (
                  <div className="pt-2">
                    <Button variant="secondary" onClick={() => setVisibleEvents((v) => v + PAGE_SIZE)}>Load more</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && selectedPath === 'seasonal' && (
            <div className="space-y-3">
              <Input placeholder="Search seasonal ideas" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredHolidays.slice(0, visibleHolidays).map((h: any) => (
                  <button key={h.id} onClick={() => setSelectedSourceId(h.id)} className={`w-full rounded-xl border p-3 text-left ${selectedSourceId===h.id?'ring-1':''}`}>
                    <div className="font-medium">{h.title}</div>
                    <div className="text-xs text-muted-foreground">{h.description}</div>
                  </button>
                ))}
                {filteredHolidays.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {search ? 'No results for your search.' : 'No upcoming holidays. Try Custom Content instead.'}
                  </div>
                )}
                {filteredHolidays.length > visibleHolidays && (
                  <div className="pt-2">
                    <Button variant="secondary" onClick={() => setVisibleHolidays((v) => v + PAGE_SIZE)}>Load more</Button>
                  </div>
                )}
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
