import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sparkles, Loader2, Clock, Info, RotateCcw } from "lucide-react";
import {
  useGeneratePlaybook,
  useCreatePlaybook,
  type GeneratedPlaybook,
} from "@/hooks/usePlaybooks";

const LOADING_MESSAGES = [
  "Analyzing job type...",
  "Building phases...",
  "Estimating hours...",
  "Finalizing tasks...",
];

interface GeneratePlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function GeneratePlaybookDialog({
  open,
  onOpenChange,
  onCreated,
}: GeneratePlaybookDialogProps) {
  const [jobType, setJobType] = useState("");
  const [audience, setAudience] = useState<"Field Crew" | "Office & PM" | "Both">("Both");
  const [tradeName, setTradeName] = useState("");
  const [preview, setPreview] = useState<GeneratedPlaybook | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  const generate = useGeneratePlaybook();
  const create = useCreatePlaybook();

  useEffect(() => {
    if (!generate.isPending) return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [generate.isPending]);

  useEffect(() => {
    if (!open) {
      setJobType("");
      setAudience("Both");
      setTradeName("");
      setPreview(null);
      setLoadingMsgIndex(0);
    }
  }, [open]);

  const handleGenerate = () => {
    setPreview(null);
    generate.mutate(
      { job_type: jobType, audience, trade_name: tradeName || undefined },
      { onSuccess: (data) => setPreview(data) }
    );
  };

  const handleSave = () => {
    if (!preview) return;
    create.mutate(
      {
        name: preview.name,
        job_type: preview.job_type,
        description: preview.description,
        confidence_score: preview.confidence_score,
        projects_analyzed: preview.projects_analyzed,
        total_hours_low: preview.total_hours_band.low,
        total_hours_high: preview.total_hours_band.high,
        phases: preview.phases,
      },
      {
        onSuccess: (id) => {
          onOpenChange(false);
          onCreated?.(id);
        },
      }
    );
  };

  const confidenceColor = (score: number) => {
    if (score > 50) return "bg-green-100 text-green-800 border-green-200";
    if (score > 0) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const roleColor = (role: string | null) => {
    if (!role) return "secondary";
    const r = role.toLowerCase();
    if (r.includes("electric")) return "default";
    if (r.includes("plumb")) return "default";
    if (r.includes("frame") || r.includes("carpenter")) return "secondary";
    return "outline" as const;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate Playbook with AI
          </DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label htmlFor="job-type">Job Type *</Label>
              <Input
                id="job-type"
                placeholder="e.g. Kitchen Remodel, Commercial Fit-Out, Roofing"
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                disabled={generate.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Audience</Label>
              <div className="flex gap-2">
                {(["Field Crew", "Office & PM", "Both"] as const).map((opt) => (
                  <Button
                    key={opt}
                    variant={audience === opt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAudience(opt)}
                    disabled={generate.isPending}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-name">Trade Focus (optional)</Label>
              <Input
                id="trade-name"
                placeholder="e.g. Electrical, Framing, Plumbing"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                disabled={generate.isPending}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!jobType.trim() || generate.isPending}
              className="w-full gap-2"
              size="lg"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {LOADING_MESSAGES[loadingMsgIndex]}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Playbook
                </>
              )}
            </Button>

            {generate.isError && (
              <p className="text-sm text-destructive text-center">
                {generate.error?.message || "Generation failed. Please try again."}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">{preview.name}</h3>
                  <p className="text-sm text-muted-foreground">{preview.description}</p>
                </div>
                <Badge className={confidenceColor(preview.confidence_score)}>
                  {preview.confidence_score > 0
                    ? `${preview.confidence_score}% confidence`
                    : "Best practices"}
                </Badge>
              </div>

              {preview.data_quality_note && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-sm">
                  <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{preview.data_quality_note}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                Estimated: {preview.total_hours_band.low}–{preview.total_hours_band.high} hours
              </div>
            </div>

            {/* Phases */}
            <Accordion type="multiple" defaultValue={preview.phases.map((_, i) => `phase-${i}`)}>
              {preview.phases.map((phase, pi) => (
                <AccordionItem key={pi} value={`phase-${pi}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{phase.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {phase.tasks.length} task{phase.tasks.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pl-1">
                      {phase.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {phase.description}
                        </p>
                      )}
                      {phase.tasks.map((task, ti) => (
                        <div
                          key={ti}
                          className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        >
                          <span className="text-sm font-medium">{task.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={roleColor(task.baseline_role_type)} className="text-xs">
                              {task.baseline_role_type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {task.estimated_hours}h
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t">
              <Button
                variant="ghost"
                onClick={handleGenerate}
                disabled={generate.isPending || create.isPending}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate
              </Button>
              <div className="flex-1" />
              <Button
                onClick={handleSave}
                disabled={create.isPending}
                className="gap-2"
              >
                {create.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Save Playbook
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
