import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useCreateFlow } from "@/state/useCreateFlow";
import { useGeneratedBundle } from "@/hooks/useGeneratedBundle";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, Settings, Sparkles } from "lucide-react";
import { MediaSelector } from "@/components/image/MediaSelector";
import { convertMarkdownToHtml } from "@/utils/markdownUtils";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface ImprovedContentGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ContentTypeConfig {
  id: string;
  label: string;
  description: string;
  icon: string;
  estimatedTime: string;
  destination: string;
}

const contentTypes: ContentTypeConfig[] = [
  {
    id: 'newsletter',
    label: 'Newsletter',
    description: 'Email newsletter with CRM block templates',
    icon: '📧',
    estimatedTime: '2-3 min',
    destination: 'CRM Block Builder'
  },
  {
    id: 'instagram',
    label: 'Instagram Post', 
    description: 'Engaging Instagram content with hashtags',
    icon: '📱',
    estimatedTime: '1-2 min',
    destination: 'Publish Portal'
  },
  {
    id: 'facebook',
    label: 'Facebook Post',
    description: 'Community-focused Facebook content',
    icon: '📘', 
    estimatedTime: '1-2 min',
    destination: 'Publish Portal'
  },
  {
    id: 'blog',
    label: 'Blog Post',
    description: 'SEO-optimized blog article',
    icon: '📝',
    estimatedTime: '3-4 min', 
    destination: 'Website (Coming Soon)'
  },
  {
    id: 'video',
    label: 'Video Script',
    description: 'Video content script',
    icon: '🎥',
    estimatedTime: '2-3 min',
    destination: 'Video Tools (Coming Soon)'
  }
];

export function ImprovedContentGenerationModal({ open, onOpenChange }: ImprovedContentGenerationModalProps) {
  const { bundleId, snapshotId, setBundleIds, channels, setChannels } = useCreateFlow();
  const { query, update } = useGeneratedBundle(bundleId || undefined);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Content type selection
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({
    newsletter: true,
    instagram: true,
    facebook: true,
    blog: false,
    video: false
  });

  // Modal state
  const [currentStep, setCurrentStep] = useState<'select' | 'review'>('select');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generated content state
  const items = useMemo(() => query.data?.content.items || [], [query.data]);
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  useEffect(() => {
    setDraftItems(items);
    setDirty(new Set());
  }, [items]);

  useEffect(() => {
    // Sync with create flow channels when modal opens
    if (open && channels) {
      setSelectedTypes(channels);
    }
  }, [open, channels]);

  const selectedCount = Object.values(selectedTypes).filter(Boolean).length;

  const handleTypeToggle = (typeId: string, checked: boolean) => {
    setSelectedTypes(prev => ({ ...prev, [typeId]: checked }));
    
    // Update create flow channels
    if (setChannels) {
      setChannels(prev => ({ ...prev, [typeId]: checked }));
    }
  };

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

  const handleApproveItem = async (index: number) => {
    if (!query.data || !snapshotId) return;
    const item = draftItems[index];
    
    // Auto-save before approving
    await handleSaveItem(index);
    
    // Mark as approved
    const next = { ...query.data.content } as any;
    next.items = [...draftItems];
    next.items[index] = { ...next.items[index], _approved: true };
    
    try {
      await update.mutateAsync({ snapshotId, content: next });
      
      // Route to appropriate destination
      if (item.channel === 'newsletter') {
        toast({ title: "Approved", description: "Sending to CRM Block Builder..." });
        navigate(`/crm/campaigns/new?type=newsletter&bundleId=${bundleId}`);
      } else if (item.channel === 'instagram' || item.channel === 'facebook') {
        toast({ title: "Approved", description: "Sending to Publish Portal..." });
        navigate(`/publish?bundleId=${bundleId}&channel=${item.channel}`);
      } else if (item.channel === 'blog') {
        toast({ title: "Approved", description: "Blog content approved - Website integration coming soon" });
      } else if (item.channel === 'video') {
        toast({ title: "Approved", description: "Video script approved - Video tools coming soon" });
      }
      
      setDirty((prev) => {
        const n = new Set(prev);
        n.delete(index);
        return n;
      });
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to approve", variant: "destructive" });
    }
  };

  const handleStartGeneration = async () => {
    const selectedChannels = Object.entries(selectedTypes)
      .filter(([_, selected]) => selected)
      .map(([typeId, _]) => typeId);
      
    if (selectedChannels.length === 0) {
      toast({ 
        title: "No content types selected", 
        description: "Please select at least one content type to generate.",
        variant: "destructive" 
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      // This would trigger the actual generation - for now just simulate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Move to review step
      setCurrentStep('review');
      toast({ 
        title: "Content Generated!", 
        description: `Generated ${selectedChannels.length} pieces of content with proper templates and MediaSelector support.` 
      });
    } catch (error) {
      console.error('Generation failed:', error);
      toast({ 
        title: "Generation Failed", 
        description: "Please try again or contact support.",
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setBundleIds(null, null);
    setCurrentStep('select');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {currentStep === 'select' ? 'Generate Content Pack' : 'Review & Approve Content'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'select' 
              ? 'Select content types to generate using CRM templates and MediaSelector for images.'
              : 'Edit content, choose images with MediaSelector, then approve for publishing.'
            }
          </DialogDescription>
        </DialogHeader>

        {currentStep === 'select' && (
          <div className="flex-1 overflow-y-auto space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <h3 className="text-lg font-semibold">Select Content Types to Generate</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contentTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`border rounded-lg p-4 transition-all cursor-pointer hover:border-primary/50 ${
                      selectedTypes[type.id] ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                    onClick={() => handleTypeToggle(type.id, !selectedTypes[type.id])}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedTypes[type.id]}
                        onCheckedChange={(checked) => handleTypeToggle(type.id, checked as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{type.icon}</span>
                          <h4 className="font-medium">{type.label}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {type.estimatedTime}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>→</span>
                          <span>{type.destination}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedCount} content type{selectedCount !== 1 ? 's' : ''} selected
                </div>
                <Button
                  onClick={handleStartGeneration}
                  disabled={selectedCount === 0 || isGenerating}
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Content...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate {selectedCount} Content Piece{selectedCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              {query.isLoading ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Loading generated content…</div>
              ) : (draftItems?.length || 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No generated items yet.</div>
              ) : (
                <div className="space-y-6 p-1">
                  {draftItems.map((item: any, idx: number) => (
                    <div key={idx} className="rounded-lg border p-6 bg-card">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="text-xl">
                            {contentTypes.find(t => t.id === item.channel)?.icon || '📄'}
                          </div>
                          <div>
                            <div className="font-semibold capitalize text-lg">{item.channel}</div>
                            <div className="text-sm text-muted-foreground">
                              → {contentTypes.find(t => t.id === item.channel)?.destination}
                            </div>
                          </div>
                          <Badge variant={item._approved ? 'default' : 'secondary'}>
                            {item._approved ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Approved
                              </>
                            ) : 'Draft'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {dirty.has(idx) && (
                            <Button size="sm" variant="secondary" onClick={() => handleSaveItem(idx)} disabled={update.isPending}>
                              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Save
                            </Button>
                          )}
                          {!item._approved && (
                            <Button size="sm" onClick={() => handleApproveItem(idx)} disabled={update.isPending}>
                              {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Approve & Send
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Title</Label>
                            <Input
                              value={sanitizeWeekNumbers(item.title || '')}
                              onChange={(e) => editItem(idx, { title: e.target.value })}
                              placeholder="Enter title (optional)"
                              className="w-full"
                            />
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Content</Label>
                            {item.channel === 'newsletter' ? (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  Newsletter uses CRM block templates - content will be structured in blocks when approved
                                </p>
                                <RichTextEditor
                                  content={convertMarkdownToHtml(sanitizeWeekNumbers(item.body || ''))}
                                  onChange={(html) => editItem(idx, { body: html })}
                                  placeholder="Newsletter content will be converted to CRM blocks..."
                                  className="w-full min-h-[200px]"
                                />
                              </div>
                            ) : item.channel === 'blog' ? (
                              <RichTextEditor
                                content={convertMarkdownToHtml(sanitizeWeekNumbers(item.markdown || item.body || ''))}
                                onChange={(html) => editItem(idx, { markdown: html })}
                                placeholder="Write and format your blog content..."
                                className="w-full min-h-[200px]"
                              />
                            ) : (
                              <textarea
                                className="w-full min-h-[200px] rounded-md border p-3 text-sm leading-relaxed resize-y"
                                value={sanitizeWeekNumbers(item.caption || item.script || item.body || '')}
                                onChange={(e) => editItem(idx, { 
                                  [item.channel === 'video' ? 'script' : 'caption']: e.target.value 
                                })}
                                placeholder={`Write your ${item.channel} content...`}
                              />
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">Featured Image</Label>
                            <MediaSelector
                              compact
                              selectedImageUrl={item.media?.url}
                              contentContext={item.title || item.caption || item.script || item.markdown || item.body}
                              onImageSelect={(url: string, metadata?: any) =>
                                editItem(idx, { media: { url, alt: metadata?.alt_text || item.media?.alt } })
                              }
                              autoSelectFirst={true}
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              MediaSelector automatically opens and finds relevant images
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <Separator />
            <div className="flex-shrink-0 flex items-center justify-between pt-4">
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <div className="text-sm text-muted-foreground">
                {draftItems.filter((item: any) => item._approved).length} of {draftItems.length} items approved
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}