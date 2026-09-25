"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CodeBlockLanguage =
  | "bash"
  | "css"
  | "js"
  | "json"
  | "jsx"
  | "sh"
  | "shell"
  | "ts"
  | "tsx";

export interface CodeBlockProps {
  className?: string;
  code: string;
  copyable?: boolean;
  filename?: string;
  highlightLines?: number[];
  label?: string;
  language?: CodeBlockLanguage;
  maxHeight?: number | string;
  onCopy?: () => void;
  showLineNumbers?: boolean;
  typing?: boolean;
  typingSpeed?: number;
  wrap?: boolean;
}

type TokenType =
  | "attr"
  | "comment"
  | "keyword"
  | "number"
  | "plain"
  | "punctuation"
  | "string"
  | "tag";

type Token = { type: TokenType; value: string };
type TokenRule = { regex: RegExp; type: TokenType };

const DEFAULT_LANGUAGE: CodeBlockLanguage = "tsx";
const DEFAULT_TYPING_SPEED = 40;
const COPY_RESET_MS = 2000;
const MS_PER_SECOND = 1000;
const VIEW_THRESHOLD = 0.2;

const LINE_COMMENT_RULE: TokenRule = { regex: /\/\/[^\n]*/y, type: "comment" };
const BLOCK_COMMENT_RULE: TokenRule = {
  regex: /\/\*[\s\S]*?\*\//y,
  type: "comment",
};
const HASH_COMMENT_RULE: TokenRule = { regex: /#[^\n]*/y, type: "comment" };
const STRING_RULE: TokenRule = {
  regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/y,
  type: "string",
};
const NUMBER_RULE: TokenRule = { regex: /\b\d+(?:\.\d+)?\b/y, type: "number" };
const HEX_COLOR_RULE: TokenRule = {
  regex: /#[0-9a-fA-F]{3,8}\b/y,
  type: "number",
};
const JS_KEYWORD_RULE: TokenRule = {
  regex:
    /\b(?:const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|throw|try|catch|finally|new|class|extends|implements|import|export|default|from|as|async|await|typeof|instanceof|in|of|void|null|undefined|true|false|this|super|type|interface|enum|public|private|protected|readonly|static|namespace|declare|never|unknown|any|string|number|boolean|object|symbol)\b/y,
  type: "keyword",
};
const JSX_TAG_RULE: TokenRule = { regex: /<\/?[A-Za-z][\w.]*/y, type: "tag" };
const JSX_ATTR_RULE: TokenRule = {
  regex: /\b[a-zA-Z_][\w-]*(?=\s*=)/y,
  type: "attr",
};
const PUNCTUATION_RULE: TokenRule = {
  regex: /[{}()[\]\\;:,.<>=+\-*\/%!&|^~?]/y,
  type: "punctuation",
};
const CSS_AT_RULE: TokenRule = { regex: /@[a-zA-Z-]+/y, type: "keyword" };
const CSS_PROPERTY_RULE: TokenRule = {
  regex: /\b[a-zA-Z-]+(?=\s*:)/y,
  type: "attr",
};
const JSON_KEYWORD_RULE: TokenRule = {
  regex: /\b(?:true|false|null)\b/y,
  type: "keyword",
};
const BASH_VARIABLE_RULE: TokenRule = {
  regex: /\$\{?\w+\}?/y,
  type: "number",
};
const BASH_FLAG_RULE: TokenRule = {
  regex: /(?:^|(?<=\s))--?[a-zA-Z][\w-]*/y,
  type: "attr",
};
const BASH_KEYWORD_RULE: TokenRule = {
  regex:
    /\b(?:if|then|else|elif|fi|for|do|done|while|case|esac|function|echo|export|cd|return|exit|local|set|source|pnpm|npm|yarn|git|sudo)\b/y,
  type: "keyword",
};

const RULES_JS: TokenRule[] = [
  LINE_COMMENT_RULE,
  BLOCK_COMMENT_RULE,
  STRING_RULE,
  JSX_TAG_RULE,
  JSX_ATTR_RULE,
  JS_KEYWORD_RULE,
  NUMBER_RULE,
  PUNCTUATION_RULE,
];
const RULES_CSS: TokenRule[] = [
  BLOCK_COMMENT_RULE,
  STRING_RULE,
  HEX_COLOR_RULE,
  CSS_AT_RULE,
  CSS_PROPERTY_RULE,
  NUMBER_RULE,
  PUNCTUATION_RULE,
];
const RULES_BASH: TokenRule[] = [
  HASH_COMMENT_RULE,
  STRING_RULE,
  BASH_VARIABLE_RULE,
  BASH_FLAG_RULE,
  BASH_KEYWORD_RULE,
  NUMBER_RULE,
  PUNCTUATION_RULE,
];
const RULES_JSON: TokenRule[] = [
  STRING_RULE,
  JSON_KEYWORD_RULE,
  NUMBER_RULE,
  PUNCTUATION_RULE,
];

const LANGUAGE_RULES: Record<CodeBlockLanguage, TokenRule[]> = {
  bash: RULES_BASH,
  css: RULES_CSS,
  js: RULES_JS,
  json: RULES_JSON,
  jsx: RULES_JS,
  sh: RULES_BASH,
  shell: RULES_BASH,
  ts: RULES_JS,
  tsx: RULES_JS,
};

const TOKEN_CLASS: Record<TokenType, string> = {
  attr: "text-blue-hover",
  comment: "text-muted-foreground italic",
  keyword: "text-blue",
  number: "text-amber-hover",
  plain: "text-foreground",
  punctuation: "text-foreground/70",
  string: "text-green",
  tag: "text-brand",
};

function getRules(language: CodeBlockLanguage): TokenRule[] {
  return LANGUAGE_RULES[language] ?? RULES_JS;
}

function tokenize(code: string, rules: TokenRule[]): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let plainBuffer = "";

  while (pos < code.length) {
    let matchedRule: TokenRule | undefined;
    let matchedValue = "";

    for (const rule of rules) {
      rule.regex.lastIndex = pos;
      const match = rule.regex.exec(code);
      const matchedText = match?.[0];
      if (matchedText && matchedText.length > 0) {
        matchedRule = rule;
        matchedValue = matchedText;
        break;
      }
    }

    if (matchedRule) {
      if (plainBuffer) {
        tokens.push({ type: "plain", value: plainBuffer });
        plainBuffer = "";
      }
      tokens.push({ type: matchedRule.type, value: matchedValue });
      pos += matchedValue.length;
    } else {
      plainBuffer += code[pos] ?? "";
      pos += 1;
    }
  }

  if (plainBuffer) {
    tokens.push({ type: "plain", value: plainBuffer });
  }

  return tokens;
}

function sliceTokens(tokens: Token[], charLimit: number): Token[] {
  const result: Token[] = [];
  let consumed = 0;

  for (const token of tokens) {
    if (consumed >= charLimit) {
      break;
    }
    const remaining = charLimit - consumed;
    if (token.value.length <= remaining) {
      result.push(token);
      consumed += token.value.length;
    } else {
      result.push({ type: token.type, value: token.value.slice(0, remaining) });
      break;
    }
  }

  return result;
}

function splitTokensIntoLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];

  for (const token of tokens) {
    const parts = token.value.split("\n");
    for (const [index, part] of parts.entries()) {
      if (index > 0) {
        lines.push([]);
      }
      if (part.length > 0) {
        lines.at(-1)?.push({ type: token.type, value: part });
      }
    }
  }

  return lines;
}

interface CopyButtonProps {
  code: string;
  onCopy?: () => void;
}

function CopyButton({ code, onCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        onCopy?.();
        window.setTimeout(() => setCopied(false), COPY_RESET_MS);
      })
      .catch(() => {
        // Clipboard API unavailable; the code remains manually selectable.
      });
  }, [code, onCopy]);

  return (
    <Button
      aria-label={copied ? "Copied to clipboard" : "Copy code"}
      className="shrink-0 text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {copied ? <Check /> : <Copy />}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </Button>
  );
}

export function CodeBlock({
  code,
  language = DEFAULT_LANGUAGE,
  filename,
  label,
  showLineNumbers = true,
  highlightLines,
  wrap = false,
  maxHeight,
  typing = false,
  typingSpeed = DEFAULT_TYPING_SPEED,
  copyable = true,
  onCopy,
  className,
}: CodeBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!typing);
  const [reduceMotion, setReduceMotion] = useState(false);

  const normalizedCode = useMemo(
    () => (code.endsWith("\n") ? code.slice(0, -1) : code),
    [code],
  );
  const highlightSet = useMemo(
    () => new Set(highlightLines ?? []),
    [highlightLines],
  );
  const fullTokens = useMemo(
    () => tokenize(normalizedCode, getRules(language)),
    [normalizedCode, language],
  );
  const showAll = !typing || reduceMotion;
  const animationEpoch = `${typing}:${reduceMotion}:${inView}:${typingSpeed}:${normalizedCode}`;
  const [epoch, setEpoch] = useState(animationEpoch);
  const [revealedCount, setRevealedCount] = useState(
    showAll ? normalizedCode.length : 0,
  );
  if (epoch !== animationEpoch) {
    setEpoch(animationEpoch);
    setRevealedCount(showAll ? normalizedCode.length : 0);
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function handleChange() {
      setReduceMotion(media.matches);
    }
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (!typing) {
      return;
    }
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold: VIEW_THRESHOLD },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [typing]);

  useEffect(() => {
    if (!typing || reduceMotion || !inView) {
      return;
    }

    let frameId = 0;
    let startTime: number | null = null;
    const charsPerMs = typingSpeed / MS_PER_SECOND;

    function tick(time: number) {
      if (startTime === null) {
        startTime = time;
      }
      const elapsed = time - startTime;
      const next = Math.min(
        normalizedCode.length,
        Math.floor(elapsed * charsPerMs),
      );
      setRevealedCount(next);
      if (next < normalizedCode.length) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [typing, reduceMotion, inView, normalizedCode, typingSpeed]);

  const visibleTokens = typing
    ? sliceTokens(fullTokens, revealedCount)
    : fullTokens;
  const lines = useMemo(
    () => splitTokensIntoLines(visibleTokens),
    [visibleTokens],
  );
  const maxHeightValue =
    typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight;

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-muted/30 font-mono",
        className,
      )}
      ref={containerRef}
    >
      {filename || copyable ? (
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border bg-muted/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden font-sans text-xs text-muted-foreground">
            {filename ? (
              <span className="truncate font-medium text-foreground">
                {filename}
              </span>
            ) : null}
            <span className="shrink-0 tracking-wide uppercase">{language}</span>
          </div>
          {copyable ? <CopyButton code={code} onCopy={onCopy} /> : null}
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0",
          wrap ? "overflow-x-hidden overflow-y-auto" : "overflow-auto",
        )}
        style={maxHeightValue ? { maxHeight: maxHeightValue } : undefined}
      >
        <pre
          aria-label={label}
          className={cn(
            "m-0 max-w-full py-3 text-[13px] leading-relaxed",
            wrap ? "break-words whitespace-pre-wrap" : "w-max min-w-full whitespace-pre",
          )}
          tabIndex={0}
        >
          <code className="block min-w-0">
            {lines.map((lineTokens, lineIndex) => {
              const lineNumber = lineIndex + 1;
              const isHighlighted = highlightSet.has(lineNumber);
              return (
                <div
                  className={cn(
                    "flex gap-3 border-l-2 border-transparent px-3",
                    wrap ? "min-w-0" : "w-max min-w-full",
                    isHighlighted &&
                    "border-brand bg-foreground/[0.045] dark:bg-foreground/[0.07]",
                  )}
                  key={lineNumber}
                >
                  {showLineNumbers ? (
                    <span
                      className={cn(
                        "w-6 shrink-0 text-right tabular-nums select-none",
                        isHighlighted
                          ? "text-foreground/80"
                          : "text-muted-foreground/60",
                      )}
                    >
                      {lineNumber}
                    </span>
                  ) : null}
                  <span className={cn(wrap ? "min-w-0 flex-1 break-words" : "block")}>
                    {lineTokens.length === 0
                      ? "\u00a0"
                      : lineTokens.map((token, tokenIndex) => (
                        <span
                          className={TOKEN_CLASS[token.type]}
                          key={`${lineNumber}-${tokenIndex}`}
                        >
                          {token.value}
                        </span>
                      ))}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
