import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DocCodeBlockProps {
  code: string;
  language: string;
  ariaLabel?: string;
}

export function DocCodeBlock({ code, language, ariaLabel }: DocCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1000);
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl border border-gray-900/80">
      <div className="flex items-center justify-between bg-gray-900 px-4 py-2">
        <span className="text-xs font-mono text-gray-400">{language}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto rounded-md px-0 py-0 text-xs text-gray-400 hover:bg-transparent hover:text-white"
          onClick={() => void handleCopy()}
          aria-label={`Copy ${language} code block`}
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <pre
        aria-label={ariaLabel ?? `${language} code example`}
        className="overflow-x-auto bg-gray-950 p-4 font-mono text-sm text-gray-100"
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
