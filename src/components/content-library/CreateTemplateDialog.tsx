
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTemplate: (template: any) => void;
}

export const CreateTemplateDialog = ({ open, onOpenChange, onCreateTemplate }: CreateTemplateDialogProps) => {
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    content: "",
    type: "social_post",
    tags: [] as string[]
  });
  const [newTag, setNewTag] = useState("");
  const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const detectVariables = (content: string) => {
    const variablePattern = /\[([A-Z_]+)\]/g;
    const matches = content.match(variablePattern);
    if (matches) {
      const variables = matches.map(match => match.slice(1, -1));
      setDetectedVariables([...new Set(variables)]);
    } else {
      setDetectedVariables([]);
    }
  };

  const handleContentChange = (content: string) => {
    setFormData({ ...formData, content });
    detectVariables(content);
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim().toLowerCase())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim().toLowerCase()]
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSubmit = async () => {
    if (formData.title && formData.category && formData.content) {
      setIsSubmitting(true);
      try {
        await onCreateTemplate({
          ...formData,
          variables: detectedVariables
        });
        // Reset form
        setFormData({
          title: "",
          category: "",
          description: "",
          content: "",
          type: "social_post",
          tags: []
        });
        setDetectedVariables([]);
        setNewTag("");
      } catch (error) {
        console.error('Error creating template:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
          <DialogDescription>
            Create a reusable content template with variables for easy customization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Template Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Plant Care Tips"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Educational">Educational</SelectItem>
                  <SelectItem value="Promotional">Promotional</SelectItem>
                  <SelectItem value="Community">Community</SelectItem>
                  <SelectItem value="Seasonal">Seasonal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of when to use this template"
            />
          </div>

          <div>
            <Label htmlFor="content">Content Template</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your template content here. Use [VARIABLE_NAME] for dynamic content..."
              className="min-h-[150px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use square brackets around UPPERCASE words to create variables, e.g., [PLANT_NAME]
            </p>
          </div>

          {detectedVariables.length > 0 && (
            <div>
              <Label>Detected Variables</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {detectedVariables.map((variable, index) => (
                  <Badge key={index} variant="outline">
                    {variable}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag}>Add</Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    #{tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.title || !formData.category || !formData.content || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? "Creating..." : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
