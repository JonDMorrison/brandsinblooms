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
import { useGenerationJobTracker } from "@/state/useGenerationJobTracker";
import { useNavigate } from "react-router-dom";
import { getSeasonalTemplates, type SeasonalTemplate } from "@/utils/seasonalTemplateService";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { useSeasonalHolidays } from "@/hooks/useSeasonalHolidays";
import { differenceInDays } from "date-fns";

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

type Mode = 'seasonal'|'holiday'|'custom';

export function CreateFlowDialog({ open, onOpenChange }: CreateFlowDialogProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { startGeneration, completeJob, failJob } = useGenerationJobTracker();
  const {
    selectedPath, setSelectedPath,
    selectedSourceId, setSelectedSourceId,
    bundleId, snapshotId, setBundleIds,
    channels, setChannels,
  } = useCreateFlow();

  const [step, setStep] = useState<1|2|3>(1);
  const [loading, setLoading] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  // Custom idea form state
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<'traffic'|'sales'|'awareness'|'none'>("traffic");
  const [tone, setTone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Seasonal and Holiday data
  const [weeklyThemes, setWeeklyThemes] = useState<SeasonalTemplate[]>([]);
  const [search, setSearch] = useState("");

  // Holiday data hook
  const { allHolidays } = useSeasonalHolidays();

  // Pagination (UI-only)
  const PAGE_SIZE = 12;
  const [visibleWeeklyThemes, setVisibleWeeklyThemes] = useState(PAGE_SIZE);
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
    setVisibleWeeklyThemes(PAGE_SIZE);
    setVisibleHolidays(PAGE_SIZE);
  }, [search, step, selectedPath]);

  // Fetch data for Seasonal 
  useEffect(() => {
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
  const filteredWeeklyThemes = useMemo(() => {
    const term = search.toLowerCase();
    return weeklyThemes
      .filter((theme) => !term || theme.title.toLowerCase().includes(term) || (theme.theme || '').toLowerCase().includes(term) || (theme.content_ideas || '').toLowerCase().includes(term));
  }, [weeklyThemes, search]);

  const filteredHolidays = useMemo(() => {
    const term = search.toLowerCase();
    const now = new Date();
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    
    return allHolidays
      .filter(holiday => {
        const holidayDate = new Date(holiday.holiday_date);
        return holidayDate >= now && holidayDate <= oneYearFromNow;
      })
      .filter((holiday) => !term || holiday.holiday_name.toLowerCase().includes(term) || (holiday.description || '').toLowerCase().includes(term) || (holiday.garden_relevance || '').toLowerCase().includes(term))
      .sort((a, b) => new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime());
  }, [allHolidays, search]);

  const canContinueFromStep1 = useMemo(() => selectedPath !== null, [selectedPath]);
  const canContinueFromStep2 = useMemo(() => {
    if (selectedPath === 'custom') return title.trim().length > 2;
    return !!selectedSourceId;
  }, [selectedPath, title, selectedSourceId]);
  const canGenerate = useMemo(() => {
    const hasChannels = Object.values(channels).some(Boolean);
    return canContinueFromStep2 && hasChannels;
  }, [canContinueFromStep2, channels]);

  const startGenerate = async () => {
    if (!selectedPath) return;
    
    // Prepare job data - ALL content now redirects to /content/library
    let jobTitle = 'Untitled Content';
    let jobType: 'campaign' | 'bundle' | 'holiday' | 'seasonal' | 'custom' = 'bundle';
    const redirectPath = '/content/library'; // Unified redirect path

    if (selectedPath === 'custom') {
      jobTitle = title || 'Custom Content';
      jobType = 'custom';
    } else if (selectedPath === 'seasonal' && selectedSourceId) {
      const picked = weeklyThemes.find((theme) => theme.id === selectedSourceId);
      if (picked) {
        jobTitle = `Week ${picked.week_number}: ${picked.title}`;
        jobType = 'seasonal';
      }
    } else if (selectedPath === 'holiday' && selectedSourceId) {
      const picked = allHolidays.find((holiday) => holiday.id === selectedSourceId);
      if (picked) {
        jobTitle = picked.holiday_name;
        jobType = 'holiday';
      }
    }

    // Start job tracking and close modal immediately
    const jobId = startGeneration({
      type: jobType,
      title: jobTitle,
      redirectPath,
      sourceId: selectedSourceId || undefined,
    });
    
    // Close modal and navigate to content library with bundle tracking
    onOpenChange(false);
    navigate(`${redirectPath}?from=generation&jobId=${jobId}`);
    
    setLoading(true);
    setNetworkError(false);

    try {
      // Get current user's tenant info - handle both single-user and multi-tenant modes
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Get workspace id for current user - tenant_id can be null for single-user mode
      const { data: me, error: userError } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', currentUser.id)
        .single();
      
      if (userError) {
        console.error('Failed to get user tenant info:', userError);
        throw new Error('Failed to get user workspace information');
      }

      const workspaceId = me?.tenant_id || currentUser.id; // Fallback to user ID for single-user mode

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
      // Pass explicit topic details for seasonal and holiday paths
      if (selectedPath === 'seasonal' && selectedSourceId) {
        const picked = weeklyThemes.find((theme) => theme.id === selectedSourceId);
        if (picked) {
          payload.topicTitle = `Week ${picked.week_number}: ${picked.title}`;
          payload.topicDescription = picked.theme || picked.content_ideas || '';
        }
      }
      if (selectedPath === 'holiday' && selectedSourceId) {
        const picked = allHolidays.find((holiday) => holiday.id === selectedSourceId);
        if (picked) {
          payload.topicTitle = picked.holiday_name;
          payload.topicDescription = picked.garden_relevance || picked.description || '';
        }
      }

      toast({ title: 'Generating content…', description: 'This will only take a moment.' });
      
      // Add timeout to prevent endless spinning
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Generation timed out after 60 seconds')), 60000);
      });
      
      const generation = supabase.functions.invoke('generate-multichannel-content', { body: payload });
      
      const { data, error } = await Promise.race([generation, timeout]) as any;
      if (error) throw error;

      setBundleIds(data.id, data.snapshotId);
      completeJob(jobId, { bundleId: data.id, snapshotId: data.snapshotId });
      toast({ title: 'Content generated successfully!', description: 'Your content is ready for review.' });
    } catch (e: any) {
      console.error('Content generation error:', e);
      const msg = String(e?.message || '');
      const statusMatch = msg.match(/\b(4\d{2}|5\d{2})\b/);
      const status = (e?.status || e?.context?.status || (statusMatch ? Number(statusMatch[1]) : undefined)) as number | undefined;

      // Mark job as failed
      if (msg.includes('timed out')) {
        failJob(jobId, 'Generation timed out. Please try again.');
      } else if (e?.name === 'FunctionsFetchError' || msg.includes('Failed to fetch')) {
        failJob(jobId, 'AI temporarily unavailable. Please check your connection and try again.');
      } else if (status === 404) {
        failJob(jobId, 'AI generator not found. Please contact support.');
      } else if (status === 401 || status === 403) {
        failJob(jobId, 'Authorization required. Please sign in again.');
      } else {
        failJob(jobId, msg || 'Generation failed. Please try again.');
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
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>
              {step === 1 && "What do you want to post about?"}
              {step === 2 && "Choose your topic"}
              {step === 3 && "Select your channels"}
            </DialogTitle>
            <DialogDescription>
              {step === 1 && "Events, holidays, or your own idea—AI will draft everything."}
              {step === 2 && "Pick a specific theme, holiday, or describe your custom idea."}
              {step === 3 && "Choose which types of content to create for your campaign."}
            </DialogDescription>
          </DialogHeader>

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'seasonal', title: 'Seasonal Themes & Care Tips', desc: 'Choose from 52 weekly themes and seasonal care tips.' },
                { key: 'holiday', title: 'Holidays', desc: 'Pick from upcoming annual holidays—AI drafts your posts.' },
                { key: 'custom', title: 'Custom Idea', desc: 'Bring your idea—AI drafts content in your voice.' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedPath(opt.key as Mode)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedPath === opt.key ? 'ring-2 ring-offset-2' : ''}`}
                >
                  <div className="font-medium text-gray-900">{opt.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && selectedPath === 'holiday' && (
            <div className="space-y-3">
              <Input placeholder="Search holidays" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="text-xs text-muted-foreground">
                Upcoming holidays ({filteredHolidays.length} shown)
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredHolidays.slice(0, visibleHolidays).map((holiday) => {
                  const daysUntil = differenceInDays(new Date(holiday.holiday_date), new Date());
                  return (
                    <button key={holiday.id} onClick={() => setSelectedSourceId(holiday.id)} className={`w-full rounded-xl border p-3 text-left ${selectedSourceId===holiday.id?'ring-1':''}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{holiday.holiday_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtLocalDate(holiday.holiday_date)}
                          {daysUntil < 14 && daysUntil > 0 && (
                            <span className="ml-2 inline-block px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">Urgent</span>
                          )}
                        </div>
                      </div>
                      {holiday.garden_relevance && (
                        <div className="text-xs text-muted-foreground mt-1">{holiday.garden_relevance}</div>
                      )}
                    </button>
                  );
                })}
                {filteredHolidays.length === 0 && (
                  <div className="text-sm text-muted-foreground">
                    {search ? 'No holidays match your search.' : 'No upcoming holidays found. Try Custom Content instead.'}
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

          {step === 2 && selectedPath === 'seasonal' && (
            <div className="space-y-3">
              <Input placeholder="Search weekly themes" value={search} onChange={(e) => setSearch(e.target.value)} className="!border-gray-300 focus-visible:!border-gray-500 focus:!border-gray-500 caret-black text-gray-900" />
              <div className="text-xs text-muted-foreground">
                52 weekly themes available ({filteredWeeklyThemes.length} shown)
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {filteredWeeklyThemes.slice(0, visibleWeeklyThemes).map((theme) => (
                  <button key={theme.id} onClick={() => setSelectedSourceId(theme.id)} className={`w-full rounded-xl border p-3 text-left ${selectedSourceId===theme.id?'ring-1':''}`}>
                    <div className="font-medium text-gray-900 !text-gray-900">{sanitizeCampaignTitle(theme.title)}</div>
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
            </div>
          )}

          {step === 2 && selectedPath === 'custom' && (
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
              <Label className="mt-2">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Context, promos, links…" />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Select the types of content to create:</Label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setChannels({ newsletter: true, instagram: true, facebook: true, video: true, blog: true })}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setChannels({ newsletter: false, instagram: false, facebook: false, video: false, blog: false })}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <ChannelCheckbox name="instagram" label="Instagram Post" />
                  <ChannelCheckbox name="facebook" label="Facebook Post" />
                  <ChannelCheckbox name="newsletter" label="Newsletter Section" />
                </div>
                <div className="space-y-3">
                  <ChannelCheckbox name="video" label="Short Video Script" />
                  <ChannelCheckbox name="blog" label="Blog Article" />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                AI will create content tailored for each selected platform. You can review and edit everything before publishing.
              </div>
            </div>
          )}

          <DialogFooter className="mt-4">
            {step === 1 && (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button disabled={!canContinueFromStep1} onClick={() => setStep(2)}>Continue</Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button disabled={!canContinueFromStep2} onClick={() => setStep(3)}>Continue</Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
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
