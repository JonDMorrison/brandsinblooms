import { useEffect } from "react";
import { Share2, X } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";
import type { MinimalForm } from "@/lib/forms/documentation";
import { trackFormBuilderAnalyticsEvent } from "@/lib/forms/analytics";

import { FormPublishTab } from "./FormPublishTab";
import { Button } from "../ui-legacy/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui-legacy/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui-legacy/sheet";

interface FormShareDialogProps {
  form: MinimalForm;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function FormShareDialog({
  form,
  onOpenChange,
  open,
}: FormShareDialogProps) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) {
      return;
    }

    trackFormBuilderAnalyticsEvent("form_share_opened", {
      form_id: form.id,
      form_status: form.status,
      viewport: isMobile ? "mobile" : "desktop",
    });
  }, [form.id, form.status, isMobile, open]);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] max-h-[100dvh] gap-0 overflow-y-auto rounded-t-[2rem] border-slate-200 bg-white p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Share Your Form</SheetTitle>
            <SheetDescription>
              Get your form in front of people with a share link, embed code, or
              developer-friendly examples.
            </SheetDescription>
          </SheetHeader>
          <ShareDialogBody form={form} isMobile />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] gap-0 overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-0 shadow-2xl sm:max-w-[92vw] md:max-w-[46rem] lg:max-w-[54rem]"
        overlayClassName="bg-black/50 backdrop-blur-sm"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Share Your Form</DialogTitle>
          <DialogDescription>
            Get your form in front of people with a share link, embed code, or
            developer-friendly examples.
          </DialogDescription>
        </DialogHeader>
        <ShareDialogBody form={form} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ShareDialogBody({
  form,
  isMobile = false,
  onClose,
}: {
  form: MinimalForm;
  isMobile?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="bg-white">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-8 sm:py-6">
        {isMobile ? (
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
        ) : null}

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Share2 className="h-5 w-5" />
            </div>
            <div className="space-y-2 pr-10">
              <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
                Share Your Form
              </h2>
              <p className="max-w-xl text-sm leading-6 text-slate-500">
                Get your form in front of people with a direct link, a
                ready-to-paste website embed, or developer-friendly integration
                examples.
              </p>
            </div>
          </div>

          {onClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close share dialog</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <FormPublishTab form={form} analyticsSurface="share-dialog" />
      </div>
    </div>
  );
}
