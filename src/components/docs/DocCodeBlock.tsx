import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

import {
  useCopyFeedback,
  type CopyFeedbackState,
} from "@/hooks/useCopyFeedback";
import { cn } from "@/lib/utils";

import { CopyButton } from "@/components/ui-legacy/copy-button";

interface DocCodeBlockProps {
  ariaLabel?: string;
  className?: string;
  code: string;
  codeViewportClassName?: string;
  copyAriaLabel?: string;
  copyButtonClassName?: string;
  copyState?: CopyFeedbackState;
  description?: string;
  language: string;
  onCopy?: () => void | Promise<void>;
  testId?: string;
  title?: string;
}

let hasRegisteredHighlightLanguages = false;

function registerHighlightLanguages() {
  if (hasRegisteredHighlightLanguages) {
    return;
  }

  hljs.registerLanguage("bash", bash);
  hljs.registerLanguage("javascript", javascript);
  hljs.registerLanguage("json", json);
  hljs.registerLanguage("typescript", typescript);
  hljs.registerLanguage("xml", xml);
  hasRegisteredHighlightLanguages = true;
}

function getHighlightLanguage(language: string) {
  switch (language) {
    case "html":
      return "xml";
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    default:
      return language;
  }
}

function formatLanguageLabel(language: string) {
  switch (language) {
    case "tsx":
      return "TSX";
    case "ts":
      return "TypeScript";
    case "html":
      return "HTML";
    case "json":
      return "JSON";
    case "bash":
      return "Bash";
    default:
      return language.toUpperCase();
  }
}

function getHighlightedCode(code: string, language: string) {
  registerHighlightLanguages();

  try {
    const normalizedLanguage = getHighlightLanguage(language);
    if (hljs.getLanguage(normalizedLanguage)) {
      return hljs.highlight(code, {
        ignoreIllegals: true,
        language: normalizedLanguage,
      }).value;
    }
  } catch {
    // Fall through to the auto-highlight fallback below.
  }

  return hljs.highlightAuto(code).value;
}

export function DocCodeBlock({
  code,
  language,
  ariaLabel,
  className,
  codeViewportClassName,
  copyAriaLabel,
  copyButtonClassName,
  copyState,
  description,
  onCopy,
  testId,
  title,
}: DocCodeBlockProps) {
  const { copyValue, getCopyState } = useCopyFeedback();
  const highlightedCode = useMemo(
    () => getHighlightedCode(code, language),
    [code, language],
  );
  const effectiveCopyState = copyState ?? getCopyState("doc-code-block");

  const handleCopy = async () => {
    if (onCopy) {
      await onCopy();
      return;
    }

    await copyValue({
      key: "doc-code-block",
      value: code,
    });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm shadow-slate-900/5",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-[linear-gradient(180deg,_rgba(248,250,252,0.96),_rgba(241,245,249,0.9))] px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {title ? (
            <p className="text-sm font-semibold text-slate-950">{title}</p>
          ) : null}
          {description ? (
            <p className="text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
          <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {formatLanguageLabel(language)}
          </span>
        </div>

        <CopyButton
          aria-label={copyAriaLabel ?? `Copy ${language} code block`}
          className={cn("w-full sm:w-[8.75rem]", copyButtonClassName)}
          onClick={() => void handleCopy()}
          state={effectiveCopyState}
        />
      </div>

      <pre
        data-testid={testId}
        aria-label={ariaLabel ?? `${language} code example`}
        className={cn(
          "overflow-x-auto bg-[#fbfaf6] px-4 py-4 font-mono text-sm leading-6 text-slate-800",
          "[&_.hljs]:block [&_.hljs]:bg-transparent [&_.hljs]:p-0 [&_.hljs]:text-slate-800",
          "[&_.hljs-attr]:text-amber-700 [&_.hljs-attribute]:text-amber-700 [&_.hljs-number]:text-amber-700 [&_.hljs-literal]:text-amber-700",
          "[&_.hljs-built_in]:text-cyan-700 [&_.hljs-meta]:text-slate-500 [&_.hljs-symbol]:text-rose-700",
          "[&_.hljs-comment]:text-slate-400 [&_.hljs-quote]:text-slate-400",
          "[&_.hljs-keyword]:text-sky-700 [&_.hljs-selector-tag]:text-sky-700 [&_.hljs-name]:text-sky-700 [&_.hljs-tag]:text-sky-700 [&_.hljs-type]:text-sky-700 [&_.hljs-title.function_]:text-sky-800",
          "[&_.hljs-string]:text-emerald-700 [&_.hljs-template-variable]:text-emerald-700",
          codeViewportClassName,
        )}
      >
        <code
          className="hljs"
          dangerouslySetInnerHTML={{
            __html: highlightedCode,
          }}
        />
      </pre>
    </div>
  );
}
