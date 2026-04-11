import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FileText, Plus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FORM_TEMPLATES,
  createFormFromTemplate,
  getTemplateFieldPreview,
} from "@/lib/formTemplates";

type TemplateSelection = ReturnType<typeof createFormFromTemplate> & {
  name: string;
};

interface FormTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateData: TemplateSelection) => void | Promise<void>;
  onStartFromScratch?: () => void | Promise<void>;
  isCreating?: boolean;
}

export function FormTemplatesDialog({
  open,
  onOpenChange,
  onSelect,
  onStartFromScratch,
  isCreating = false,
}: FormTemplatesDialogProps) {
  const handleSelect = (templateId: string) => {
    const template = FORM_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;

    const formData = createFormFromTemplate(template);
    void onSelect({
      name: template.name,
      ...formData,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <div className="space-y-6 p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create a Form
            </DialogTitle>
            <DialogDescription>
              Start from a lightweight starter form or choose a template
              designed for common lead capture workflows.
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              "grid gap-4",
              onStartFromScratch ? "md:grid-cols-2" : "md:grid-cols-1",
            )}
          >
            {onStartFromScratch && (
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Plus className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base">
                        Start from Scratch
                      </CardTitle>
                    </div>
                    <Badge variant="secondary">Recommended</Badge>
                  </div>
                  <CardDescription>
                    Start with a clean form scaffold containing one required
                    email field, then customize the rest in the editor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full gap-2"
                    onClick={() => void onStartFromScratch()}
                    disabled={isCreating}
                  >
                    <Plus className="h-4 w-4" />
                    {isCreating ? "Creating Form..." : "Start from Scratch"}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-muted p-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <CardTitle className="text-base">Use a Template</CardTitle>
                </div>
                <CardDescription>
                  Choose from {FORM_TEMPLATES.length} starter templates below to
                  launch faster with preconfigured fields and consent settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm">
                  <span className="text-muted-foreground">
                    Template library
                  </span>
                  <Badge variant="secondary">
                    {FORM_TEMPLATES.length} templates
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Templates
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pick a starting point and tailor it once you land in the
                  editor.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {FORM_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className="bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">
                            {template.name}
                          </CardTitle>
                          <Badge variant="outline">{template.category}</Badge>
                        </div>
                        <CardDescription>
                          {template.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                      {getTemplateFieldPreview(template)}
                    </div>
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleSelect(template.id)}
                      disabled={isCreating}
                    >
                      <span>Use Template</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t px-6 py-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
