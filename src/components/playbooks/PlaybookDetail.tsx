import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Clock,
  GripVertical,
  Plus,
  Copy,
  Archive,
  Save,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { usePlaybook, type PlaybookDetail as PlaybookDetailType } from "@/hooks/usePlaybooks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface PlaybookDetailProps {
  playbookId: string;
}

export function PlaybookDetail({ playbookId }: PlaybookDetailProps) {
  const { data: playbook, isLoading } = usePlaybook(playbookId);
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Playbook not found
      </div>
    );
  }

  const totalHours = playbook.phases.reduce(
    (sum, p) => sum + p.tasks.reduce((ts, t) => ts + (t.estimated_hours || 0), 0),
    0
  );

  const confidenceColor = (score: number) => {
    if (score > 50) return "bg-green-100 text-green-800 border-green-200";
    if (score > 0) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  const handleArchive = async () => {
    const { error } = await supabase
      .from("playbooks" as any)
      .update({ is_archived: true })
      .eq("id", playbookId);
    if (error) {
      toast.error("Failed to archive");
    } else {
      toast.success("Playbook archived");
      queryClient.invalidateQueries({ queryKey: ["playbooks"] });
    }
  };

  const handleDuplicate = async () => {
    // Re-fetch full detail then create via RPC
    if (!playbook) return;
    try {
      const { data: membership } = await supabase
        .from("organization_memberships" as any)
        .select("org_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .limit(1)
        .single();

      if (!membership?.org_id) throw new Error("No organization found");

      const { error } = await supabase.rpc("rpc_create_playbook" as any, {
        p_name: `${playbook.name} (copy)`,
        p_job_type: playbook.job_type,
        p_description: playbook.description,
        p_org_id: membership.org_id,
        p_confidence_score: playbook.confidence_score,
        p_projects_analyzed: playbook.projects_analyzed,
        p_total_hours_low: playbook.total_hours_low,
        p_total_hours_high: playbook.total_hours_high,
        p_phases: JSON.stringify(playbook.phases),
      });

      if (error) throw error;
      toast.success("Playbook duplicated");
      queryClient.invalidateQueries({ queryKey: ["playbooks"] });
    } catch (err: any) {
      toast.error("Failed to duplicate: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{playbook.name}</h2>
            {playbook.description && (
              <p className="text-sm text-muted-foreground">{playbook.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {playbook.job_type && (
              <Badge variant="secondary">{playbook.job_type}</Badge>
            )}
            <Badge variant="outline">v{playbook.version}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Badge className={confidenceColor(playbook.confidence_score)}>
            {playbook.confidence_score > 0
              ? `${playbook.confidence_score}% confidence`
              : "Best practices"}
          </Badge>
          {(playbook.total_hours_low || playbook.total_hours_high) && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {playbook.total_hours_low}–{playbook.total_hours_high}h
            </span>
          )}
          <span>{totalHours}h total across {playbook.phases.length} phases</span>
        </div>
      </div>

      {/* Phases */}
      <Accordion
        type="multiple"
        defaultValue={playbook.phases.map((p) => p.id)}
      >
        {playbook.phases.map((phase) => (
          <AccordionItem key={phase.id} value={phase.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                <span className="font-medium">{phase.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {phase.tasks.length} task{phase.tasks.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pl-7">
                {phase.description && (
                  <p className="text-sm text-muted-foreground mb-3">{phase.description}</p>
                )}
                {phase.tasks.map((task) => (
                  <Card key={task.id} className="shadow-none">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{task.title}</div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {task.baseline_role_type && (
                          <Badge variant="outline" className="text-xs">
                            {task.baseline_role_type}
                          </Badge>
                        )}
                        {task.estimated_hours != null && (
                          <Badge variant="secondary" className="text-xs">
                            {task.estimated_hours}h
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Footer actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDuplicate}>
          <Copy className="w-4 h-4" />
          Duplicate
        </Button>
        <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleArchive}>
          <Archive className="w-4 h-4" />
          Archive
        </Button>
      </div>
    </div>
  );
}
