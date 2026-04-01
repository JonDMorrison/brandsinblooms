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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCreatePlaybook } from "@/hooks/usePlaybooks";

interface CreatePlaybookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreatePlaybookDialog({
  open,
  onOpenChange,
  onCreated,
}: CreatePlaybookDialogProps) {
  const [name, setName] = useState("");
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreatePlaybook();

  useEffect(() => {
    if (!open) {
      setName("");
      setJobType("");
      setDescription("");
    }
  }, [open]);

  const handleCreate = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), job_type: jobType.trim() || undefined, description: description.trim() || undefined },
      {
        onSuccess: (id) => {
          onOpenChange(false);
          onCreated?.(id);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Playbook</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pb-name">Name *</Label>
            <Input
              id="pb-name"
              placeholder="e.g. Kitchen Remodel"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pb-job-type">Job Type</Label>
            <Input
              id="pb-job-type"
              placeholder="e.g. Residential, Commercial"
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pb-desc">Description</Label>
            <Textarea
              id="pb-desc"
              placeholder="Brief description of this playbook"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || create.isPending}
            className="w-full"
          >
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
