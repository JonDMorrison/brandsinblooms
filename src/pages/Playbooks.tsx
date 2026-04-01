import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Plus,
  Sparkles,
  Clock,
  Layers,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { usePlaybooks, type PlaybookSummary } from "@/hooks/usePlaybooks";
import { PlaybookDetail } from "@/components/playbooks/PlaybookDetail";
import { GeneratePlaybookDialog } from "@/components/playbooks/GeneratePlaybookDialog";
import { CreatePlaybookDialog } from "@/components/playbooks/CreatePlaybookDialog";

export default function Playbooks() {
  const { data: playbooks, isLoading } = usePlaybooks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const handleCreated = (id: string) => {
    setSelectedId(id);
  };

  const confidenceColor = (score: number) => {
    if (score > 50) return "bg-green-500";
    if (score > 0) return "bg-amber-500";
    return "bg-gray-300";
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left panel — playbook list */}
      <div className="w-80 border-r flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Playbooks</h1>
              {playbooks && playbooks.length > 0 && (
                <Badge variant="secondary">{playbooks.length}</Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowGenerate(true)}
                title="Generate with AI"
              >
                <Sparkles className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCreate(true)}
                title="New playbook"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !playbooks || playbooks.length === 0 ? (
            <div className="p-6 text-center space-y-4">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-medium">No playbooks yet</p>
                <p className="text-xs text-muted-foreground">
                  Generate your first one with AI
                </p>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setShowGenerate(true)}>
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </Button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {playbooks.map((pb: PlaybookSummary) => (
                <Card
                  key={pb.id}
                  className={`cursor-pointer transition-colors shadow-none ${
                    selectedId === pb.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedId(pb.id)}
                >
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-tight line-clamp-2">
                        {pb.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        v{pb.version}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {pb.job_type && (
                        <Badge variant="secondary" className="text-[10px]">
                          {pb.job_type}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {pb.phase_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" />
                        {pb.task_count}
                      </span>
                      {(pb.total_hours_low || pb.total_hours_high) && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {pb.total_hours_low}–{pb.total_hours_high}h
                        </span>
                      )}
                    </div>

                    {/* Confidence bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${confidenceColor(pb.confidence_score)}`}
                          style={{
                            width: `${Math.max(pb.confidence_score, 5)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-6 text-right">
                        {pb.confidence_score}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 overflow-y-auto">
        {selectedId ? (
          <div className="p-6 max-w-4xl">
            <PlaybookDetail playbookId={selectedId} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-8">
            <BookOpen className="w-16 h-16 text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-lg font-medium text-muted-foreground">
                Select a playbook
              </p>
              <p className="text-sm text-muted-foreground/70">
                Choose a playbook from the list or generate a new one with AI
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" />
                New Playbook
              </Button>
              <Button className="gap-2" onClick={() => setShowGenerate(true)}>
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <GeneratePlaybookDialog
        open={showGenerate}
        onOpenChange={setShowGenerate}
        onCreated={handleCreated}
      />
      <CreatePlaybookDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
      />
    </div>
  );
}
