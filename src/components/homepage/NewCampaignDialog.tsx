
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getCurrentWeekNumber } from "./homepageUtils";

interface Campaign {
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
}

interface NewCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (campaign: Omit<Campaign, 'id'>) => void;
}

export const NewCampaignDialog = ({ open, onOpenChange, onCreate }: NewCampaignDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    
    const newCampaign = {
      title: title.trim(),
      description: description.trim() || null,
      theme: theme.trim() || null,
      start_date: new Date().toISOString().split('T')[0],
      week_number: getCurrentWeekNumber(),
    };

    onCreate(newCampaign);
    
    // Reset form
    setTitle("");
    setDescription("");
    setTheme("");
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-garden-green-dark">Create New Campaign</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-garden-green-dark">
              Campaign Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter campaign title"
              required
              className="border-garden-green-light focus:border-garden-green"
            />
          </div>
          
          <div>
            <Label htmlFor="description" className="text-garden-green-dark">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your campaign"
              className="border-garden-green-light focus:border-garden-green"
            />
          </div>
          
          <div>
            <Label htmlFor="theme" className="text-garden-green-dark">
              Theme
            </Label>
            <Input
              id="theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Campaign theme (e.g., Spring Planting)"
              className="border-garden-green-light focus:border-garden-green"
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-garden-green-light text-garden-green-dark"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || loading}
              className="bg-garden-green hover:bg-garden-green-dark text-white"
            >
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
