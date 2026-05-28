import * as React from "react";
import hljs from "highlight.js/lib/core";
import type { LanguageFn } from "highlight.js";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";

type HighlightLanguageName =
  | "bash"
  | "css"
  | "javascript"
  | "json"
  | "markdown"
  | "python"
  | "sql"
  | "typescript"
  | "xml"
  | "yaml";

type HighlightLanguageModule = {
  default: LanguageFn;
};

type HighlightedCode = {
  html: string;
  languageLabel: string | null;
};

export interface BloomCodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  language?: string | null;
  code?: string;
  compact?: boolean;
  inline?: boolean;
}

const LANGUAGE_LOADERS: Record<
  HighlightLanguageName,
  () => Promise<HighlightLanguageModule>
> = {
  bash: () =>
    import("highlight.js/lib/languages/bash") as Promise<HighlightLanguageModule>,
  css: () =>
    import("highlight.js/lib/languages/css") as Promise<HighlightLanguageModule>,
  javascript: () =>
    import("highlight.js/lib/languages/javascript") as Promise<HighlightLanguageModule>,
  json: () =>
    import("highlight.js/lib/languages/json") as Promise<HighlightLanguageModule>,
  markdown: () =>
    import("highlight.js/lib/languages/markdown") as Promise<HighlightLanguageModule>,
  python: () =>
    import("highlight.js/lib/languages/python") as Promise<HighlightLanguageModule>,
  sql: () =>
    import("highlight.js/lib/languages/sql") as Promise<HighlightLanguageModule>,
  typescript: () =>
    import("highlight.js/lib/languages/typescript") as Promise<HighlightLanguageModule>,
  xml: () =>
    import("highlight.js/lib/languages/xml") as Promise<HighlightLanguageModule>,
  yaml: () =>
    import("highlight.js/lib/languages/yaml") as Promise<HighlightLanguageModule>,
};

const LANGUAGE_ALIASES: Record<string, HighlightLanguageName> = {
  html: "xml",
  jsx: "javascript",
  js: "javascript",
  md: "markdown",
  py: "python",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  tsx: "typescript",
  xhtml: "xml",
  yml: "yaml",
  zsh: "bash",
};

const AUTO_DETECT_LANGUAGES: HighlightLanguageName[] = [
  "javascript",
  "typescript",
  "python",
  "sql",
  "json",
  "xml",
  "css",
  "bash",
  "markdown",
  "yaml",
];

const loadedLanguages = new Set<HighlightLanguageName>();
const loadingLanguages = new Map<HighlightLanguageName, Promise<void>>();

const scrollbarSx = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--joy-palette-neutral-600) transparent",
  "&::-webkit-scrollbar": { width: 6, height: 6 },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "var(--joy-palette-neutral-600)",
    borderRadius: 999,
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "var(--joy-palette-neutral-500)",
  },
  "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
} as const;

const highlightTokenSx = {
  "& .hljs": { backgroundColor: "transparent", color: "neutral.100" },
  "& .hljs-attr, & .hljs-attribute, & .hljs-number, & .hljs-literal": {
    color: "warning.300",
  },
  "& .hljs-built_in, & .hljs-meta, & .hljs-symbol": { color: "primary.200" },
  "& .hljs-comment, & .hljs-quote": { color: "neutral.500" },
  "& .hljs-keyword, & .hljs-selector-tag, & .hljs-name, & .hljs-tag, & .hljs-type":
    { color: "primary.300" },
  "& .hljs-string, & .hljs-template-variable": { color: "success.300" },
  "& .hljs-title, & .hljs-title.function_": { color: "danger.200" },
  "& .hljs-variable, & .hljs-params": { color: "neutral.200" },
} as const;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const childrenToText = (children: React.ReactNode): string => {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(childrenToText).join("");
  }

  if (!children || typeof children !== "object" || !("props" in children)) {
    return "";
  }

  const props = children.props as { children?: React.ReactNode };
  return childrenToText(props.children);
};

const languageHintFromClassName = (className: string | undefined) => {
  const languageClass = className
    ?.split(/\s+/)
    .find((classPart) => classPart.startsWith("language-"));
  return languageClass?.replace(/^language-/, "") ?? null;
};

const isHighlightLanguageName = (
  value: string,
): value is HighlightLanguageName =>
  Object.prototype.hasOwnProperty.call(LANGUAGE_LOADERS, value);

const normalizeLanguage = (language: string | null | undefined) => {
  const languageName = language
    ?.trim()
    .toLowerCase()
    .replace(/^language-/, "");
  if (!languageName) {
    return null;
  }

  const highlightedName = LANGUAGE_ALIASES[languageName] ?? languageName;
  return isHighlightLanguageName(highlightedName)
    ? { displayName: languageName, highlightedName }
    : null;
};

const formatLanguageLabel = (language: string) => {
  switch (language) {
    case "bash":
      return "Bash";
    case "css":
      return "CSS";
    case "html":
    case "xml":
      return "HTML";
    case "javascript":
    case "js":
      return "JavaScript";
    case "json":
      return "JSON";
    case "jsx":
      return "JSX";
    case "markdown":
    case "md":
      return "Markdown";
    case "python":
    case "py":
      return "Python";
    case "sql":
      return "SQL";
    case "typescript":
    case "ts":
      return "TypeScript";
    case "tsx":
      return "TSX";
    case "yaml":
    case "yml":
      return "YAML";
    default:
      return language.toUpperCase();
  }
};

const ensureLanguageLoaded = (language: HighlightLanguageName) => {
  if (loadedLanguages.has(language)) {
    return Promise.resolve();
  }

  const existingLoad = loadingLanguages.get(language);
  if (existingLoad) {
    return existingLoad;
  }

  const load = LANGUAGE_LOADERS[language]()
    .then((languageModule) => {
      hljs.registerLanguage(language, languageModule.default);
      loadedLanguages.add(language);
    })
    .finally(() => {
      loadingLanguages.delete(language);
    });

  loadingLanguages.set(language, load);
  return load;
};

const ensureAutoDetectLanguagesLoaded = () =>
  Promise.all(AUTO_DETECT_LANGUAGES.map(ensureLanguageLoaded));

async function highlightCode(
  code: string,
  languageHint: string | null,
): Promise<HighlightedCode> {
  const normalizedLanguage = normalizeLanguage(languageHint);

  if (normalizedLanguage) {
    try {
      await ensureLanguageLoaded(normalizedLanguage.highlightedName);
      return {
        html: hljs.highlight(code, {
          ignoreIllegals: true,
          language: normalizedLanguage.highlightedName,
        }).value,
        languageLabel: formatLanguageLabel(normalizedLanguage.displayName),
      };
    } catch {
      // Fall through to auto-detection.
    }
  }

  try {
    await ensureAutoDetectLanguagesLoaded();
    const highlighted = hljs.highlightAuto(code, AUTO_DETECT_LANGUAGES);
    return {
      html: highlighted.value,
      languageLabel: highlighted.language
        ? formatLanguageLabel(highlighted.language)
        : null,
    };
  } catch {
    return {
      html: escapeHtml(code),
      languageLabel: normalizedLanguage
        ? formatLanguageLabel(normalizedLanguage.displayName)
        : null,
    };
  }
}

export default function BloomCodeBlock({
  children,
  className,
  code,
  compact = false,
  inline = false,
  language,
}: BloomCodeBlockProps) {
  const rawCode = React.useMemo(
    () => (typeof code === "string" ? code : childrenToText(children)),
    [children, code],
  );
  const normalizedCode = React.useMemo(
    () => rawCode.replace(/\n$/, ""),
    [rawCode],
  );
  const languageHint = React.useMemo(
    () => language ?? languageHintFromClassName(className),
    [className, language],
  );
  const initialLanguageLabel = React.useMemo(() => {
    const normalizedLanguage = normalizeLanguage(languageHint);
    return normalizedLanguage
      ? formatLanguageLabel(normalizedLanguage.displayName)
      : null;
  }, [languageHint]);
  const [highlightedCode, setHighlightedCode] = React.useState<HighlightedCode>(
    {
      html: escapeHtml(normalizedCode),
      languageLabel: initialLanguageLabel,
    },
  );
  const [hasCopied, setHasCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<number | null>(null);
  const codeLines = React.useMemo(
    () => (normalizedCode.length > 0 ? normalizedCode.split("\n") : [""]),
    [normalizedCode],
  );
  const showLineNumbers = codeLines.length > 5;

  React.useEffect(() => {
    let isCurrent = true;

    setHighlightedCode({
      html: escapeHtml(normalizedCode),
      languageLabel: initialLanguageLabel,
    });

    void highlightCode(normalizedCode, languageHint).then(
      (nextHighlightedCode) => {
        if (isCurrent) {
          setHighlightedCode(nextHighlightedCode);
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [initialLanguageLabel, languageHint, normalizedCode]);

  React.useEffect(
    () => () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode);
      setHasCopied(true);
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setHasCopied(false);
        copyTimeoutRef.current = null;
      }, 1500);
    } catch {
      toast.error("Unable to copy code");
    }
  };

  if (inline) {
    return (
      <Typography
        component="code"
        sx={{
          display: "inline",
          px: 0.5,
          py: 0.25,
          borderRadius: "var(--joy-radius-xs)",
          backgroundColor: "neutral.100",
          color: "neutral.800",
          fontFamily: "var(--joy-fontFamily-code)",
          fontSize: "0.85em",
        }}
      >
        {normalizedCode}
      </Typography>
    );
  }

  return (
    <Sheet
      variant="solid"
      color="neutral"
      sx={{
        position: "relative",
        my: compact ? 1 : 1.5,
        overflow: "hidden",
        borderRadius: "var(--joy-radius-md)",
        border: "1px solid",
        borderColor: "neutral.700",
        backgroundColor: "neutral.800",
        boxShadow: "none",
        ...highlightTokenSx,
      }}
    >
      {highlightedCode.languageLabel ? (
        <JoyChip
          color="neutral"
          size="sm"
          variant="soft"
          sx={{
            position: "absolute",
            top: 1,
            left: 1,
            zIndex: 1,
            fontFamily: "var(--joy-fontFamily-code)",
          }}
        >
          {highlightedCode.languageLabel}
        </JoyChip>
      ) : null}
      <JoyButton
        aria-label={hasCopied ? "Code copied" : "Copy code"}
        color="neutral"
        size="icon"
        variant="plain"
        onClick={() => {
          void handleCopy();
        }}
        sx={{
          position: "absolute",
          top: 1,
          right: 1,
          zIndex: 1,
          color: "neutral.100",
          backgroundColor: "neutral.700",
          "&:hover": { backgroundColor: "neutral.600" },
        }}
      >
        {hasCopied ? (
          <Check size={15} strokeWidth={1.9} />
        ) : (
          <Copy size={15} strokeWidth={1.9} />
        )}
      </JoyButton>
      <Box
        sx={{
          maxHeight: 400,
          overflow: "auto",
          pt: compact ? 4.75 : 5,
          pb: compact ? 1 : 1.25,
          ...scrollbarSx,
        }}
      >
        <Box
          component="pre"
          sx={{
            display: "grid",
            gridTemplateColumns: showLineNumbers ? "auto 1fr" : "1fr",
            m: 0,
            minWidth: "max-content",
            color: "neutral.50",
            fontFamily: "var(--joy-fontFamily-code)",
            fontSize: compact ? "0.75rem" : "0.8125rem",
            lineHeight: 1.6,
            tabSize: 2,
            whiteSpace: "pre",
          }}
        >
          {showLineNumbers ? (
            <Box
              aria-hidden="true"
              component="span"
              sx={{
                pr: 1.25,
                pl: 1.25,
                mr: 1.25,
                borderRight: "1px solid",
                borderColor: "neutral.700",
                color: "neutral.500",
                textAlign: "right",
                userSelect: "none",
              }}
            >
              {codeLines.map((_, index) => (
                <Box component="span" key={index + 1} sx={{ display: "block" }}>
                  {index + 1}
                </Box>
              ))}
            </Box>
          ) : null}
          <Box
            className="hljs"
            component="code"
            sx={{
              display: "block",
              minWidth: 0,
              pr: 1.25,
              pl: showLineNumbers ? 0 : 1.25,
              color: "neutral.100",
              fontFamily: "inherit",
              lineHeight: "inherit",
              whiteSpace: "pre",
            }}
            dangerouslySetInnerHTML={{ __html: highlightedCode.html }}
          />
        </Box>
      </Box>
    </Sheet>
  );
}
