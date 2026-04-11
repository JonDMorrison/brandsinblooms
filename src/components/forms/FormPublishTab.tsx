import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Code,
  Copy,
  ExternalLink,
  FileCode,
  Globe,
  Zap,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  buildIframeEmbedCode,
  buildJavaScriptEmbedCode,
  buildReactEmbedCode,
  FormEmbedDisplayMode,
  getLegacyEdgeEmbedScriptUrl,
  getPublicFormUrl,
  getStaticEmbedScriptUrl,
} from "@/lib/forms/share";
import { Form } from "@/types/formBuilder";

interface FormPublishTabProps {
  form: Pick<Form, "embed_key" | "name">;
  initialTab?: "direct-link" | "iframe" | "javascript" | "react";
}

const DISPLAY_MODE_OPTIONS: Array<{
  value: FormEmbedDisplayMode;
  label: string;
  description: string;
}> = [
  {
    value: "inline",
    label: "Inline",
    description: "Render the form directly inside a page section.",
  },
  {
    value: "modal",
    label: "Modal",
    description: "Open the form inside a centered dialog.",
  },
  {
    value: "slide-in",
    label: "Slide-In",
    description: "Open the form in a side panel.",
  },
];

export function FormPublishTab({
  form,
  initialTab = "direct-link",
}: FormPublishTabProps) {
  const { toast } = useToast();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [iframeHeight, setIframeHeight] = useState("600");
  const [displayMode, setDisplayMode] =
    useState<FormEmbedDisplayMode>("inline");
  const [containerSelector, setContainerSelector] =
    useState("#bloomsuite-form");
  const [buttonText, setButtonText] = useState("Open Form");

  const publicUrl = useMemo(
    () => getPublicFormUrl(form.embed_key),
    [form.embed_key],
  );
  const staticRuntimeUrl = useMemo(() => getStaticEmbedScriptUrl(), []);
  const legacyRuntimeUrl = useMemo(() => getLegacyEdgeEmbedScriptUrl(), []);
  const normalizedIframeHeight = Math.max(320, Number(iframeHeight) || 600);

  const iframeCode = useMemo(
    () =>
      buildIframeEmbedCode({
        embedKey: form.embed_key,
        iframeHeight: normalizedIframeHeight,
      }),
    [form.embed_key, normalizedIframeHeight],
  );

  const jsEmbedCode = useMemo(
    () =>
      buildJavaScriptEmbedCode({
        embedKey: form.embed_key,
        formName: form.name,
        displayMode,
        containerSelector,
        buttonText,
      }),
    [buttonText, containerSelector, displayMode, form.embed_key, form.name],
  );

  const reactCode = useMemo(
    () =>
      buildReactEmbedCode({
        embedKey: form.embed_key,
        formName: form.name,
        displayMode,
        buttonText,
      }),
    [buttonText, displayMode, form.embed_key, form.name],
  );

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedItem(key);
    window.setTimeout(() => setCopiedItem(null), 2000);
    toast({
      title: "Copied",
      description: "The embed code was copied to your clipboard.",
    });
  };

  return (
    <Tabs defaultValue={initialTab} className="w-full space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 sm:grid-cols-4">
        <TabsTrigger value="direct-link" className="gap-2">
          <Globe className="h-4 w-4" />
          Direct Link
        </TabsTrigger>
        <TabsTrigger value="iframe" className="gap-2">
          <FileCode className="h-4 w-4" />
          Iframe
        </TabsTrigger>
        <TabsTrigger value="javascript" className="gap-2">
          <Zap className="h-4 w-4" />
          JavaScript
        </TabsTrigger>
        <TabsTrigger value="react" className="gap-2">
          <Code className="h-4 w-4" />
          React
        </TabsTrigger>
      </TabsList>

      <TabsContent value="direct-link" className="space-y-4">
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Public form URL
            </h3>
            <p className="text-sm text-muted-foreground">
              Share this direct link anywhere you want visitors to open the
              form.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input value={publicUrl} readOnly className="font-mono text-sm" />
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void copyToClipboard(publicUrl, "direct-link")}
              >
                {copiedItem === "direct-link" ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy
              </Button>
              <Button variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="iframe" className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="iframe-height">Height (px)</Label>
              <Input
                id="iframe-height"
                type="number"
                min={320}
                value={iframeHeight}
                onChange={(event) => setIframeHeight(event.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Use iframe embeds when you want the safest drop-in option across
              different CMS or website builders.
            </p>
          </div>

          <CodeBlock value={iframeCode} />

          <Button
            variant="outline"
            onClick={() => void copyToClipboard(iframeCode, "iframe")}
          >
            {copiedItem === "iframe" ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy iframe code
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="javascript" className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Older embed codes that point to {legacyRuntimeUrl} are deprecated.
            Replace them with the static runtime below: {staticRuntimeUrl}
          </AlertDescription>
        </Alert>

        <div className="rounded-2xl border bg-card p-4">
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Display Mode</Label>
              <RadioGroup
                value={displayMode}
                onValueChange={(value) =>
                  setDisplayMode(value as FormEmbedDisplayMode)
                }
                className="grid gap-3 sm:grid-cols-3"
              >
                {DISPLAY_MODE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer gap-3 rounded-xl border px-4 py-3"
                  >
                    <RadioGroupItem value={option.value} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {displayMode === "inline" ? (
              <div className="space-y-2">
                <Label htmlFor="container-selector">Container selector</Label>
                <Input
                  id="container-selector"
                  value={containerSelector}
                  onChange={(event) => setContainerSelector(event.target.value)}
                  placeholder="#bloomsuite-form"
                />
                <p className="text-xs text-muted-foreground">
                  The generated placeholder uses this selector as the inline
                  mount point.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="button-text">Trigger button text</Label>
                <Input
                  id="button-text"
                  value={buttonText}
                  onChange={(event) => setButtonText(event.target.value)}
                  placeholder="Open Form"
                />
              </div>
            )}
          </div>

          <CodeBlock value={jsEmbedCode} />

          <Button
            variant="outline"
            onClick={() => void copyToClipboard(jsEmbedCode, "javascript")}
          >
            {copiedItem === "javascript" ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy JavaScript code
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="react" className="space-y-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            This snippet loads the static runtime once and renders the form via
            the same data attributes used by the JavaScript embed.
          </p>

          <CodeBlock value={reactCode} />

          <Button
            variant="outline"
            onClick={() => void copyToClipboard(reactCode, "react")}
          >
            {copiedItem === "react" ? (
              <Check className="mr-2 h-4 w-4" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copy React code
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-4 text-sm">
      <code>{value}</code>
    </pre>
  );
}
