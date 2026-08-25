import type { ReactNode } from "react";
import {
  CONSTANTS,
  DECLARATIONS,
  EXCEPTIONS,
  FUNCTIONS,
  KEYWORDS,
  MODIFIERS,
  OPERATORS,
  TYPES,
} from "./code";

export type TokenKind =
  | "comment"
  | "string"
  | "escape"
  | "regex"
  | "keyword"
  | "modifier"
  | "constant"
  | "declaration"
  | "type"
  | "exception"
  | "function"
  | "macro"
  | "decorator"
  | "member"
  | "operator"
  | "number"
  | "text";

interface Token {
  kind: TokenKind;
  value: string;
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  comment: "tok-comment",
  string: "tok-string",
  escape: "tok-escape",
  regex: "tok-regex",
  keyword: "tok-keyword",
  modifier: "tok-keyword",
  constant: "tok-constant",
  declaration: "tok-keyword",
  type: "tok-type",
  exception: "tok-type",
  function: "tok-function",
  macro: "tok-function",
  decorator: "tok-function",
  member: "tok-member",
  operator: "tok-keyword",
  number: "tok-number",
  text: "",
};

const TOKEN_COLOR: Record<TokenKind, string | undefined> = {
  comment: "#8b8582",
  string: "#e8cfc4",
  escape: "#d4a090",
  regex: "#e8cfc4",
  keyword: "#d66a62",
  modifier: "#d66a62",
  constant: "#d4a090",
  declaration: "#d66a62",
  type: "#d4a090",
  exception: "#d4a090",
  function: "#c9b8b0",
  macro: "#c9b8b0",
  decorator: "#c9b8b0",
  member: "#d4a090",
  operator: "#d66a62",
  number: "#d4a090",
  text: undefined,
};

const DECLARATION_SET = new Set<string>(DECLARATIONS);
const MODIFIER_SET = new Set<string>(MODIFIERS);
const CONSTANT_SET = new Set<string>(CONSTANTS);
const KEYWORD_SET = new Set<string>(KEYWORDS);
const TYPE_SET = new Set<string>(TYPES);
const EXCEPTION_SET = new Set<string>(EXCEPTIONS);
const FUNCTION_SET = new Set<string>(FUNCTIONS);

const DECL_NAME_KIND: Record<string, TokenKind> = {
  def: "function",
  macro: "macro",
  class: "type",
  struct: "type",
  enum: "type",
  type: "type",
};

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*/;
const NUMBER_RE =
  /^(?:0[xX][0-9A-Fa-f][0-9A-Fa-f_]*|0[bB][01][01_]*|0[oO][0-7][0-7_]*|[0-9][0-9_]*(?:\.[0-9_]*(?:[eE][+-]?[0-9_]+)?|[eE][+-]?[0-9_]+)?[fF]?|\.[0-9][0-9_]*(?:[eE][+-]?[0-9_]+)?[fF]?)/;

function readIdent(code: string, i: number): string {
  return IDENT_RE.exec(code.slice(i))?.[0] ?? "";
}

function readWhitespace(code: string, i: number): string {
  let j = i;
  while (j < code.length && (code[j] === " " || code[j] === "\t")) j += 1;
  return code.slice(i, j);
}

function quoteDelim(code: string, i: number): string | null {
  if (code.startsWith('"""', i) || code.startsWith("'''", i)) {
    return code.slice(i, i + 3);
  }
  if (code[i] === '"' || code[i] === "'") return code[i] ?? null;
  return null;
}

function tokenize(
  code: string,
  from = 0,
  stopOnRBrace = false,
): { tokens: Token[]; index: number } {
  const tokens: Token[] = [];
  let i = from;
  let braceDepth = 1;

  while (i < code.length) {
    const ch = code[i] ?? "";

    if (stopOnRBrace) {
      if (ch === "{") {
        tokens.push({ kind: "text", value: "{" });
        braceDepth += 1;
        i += 1;
        continue;
      }
      if (ch === "}") {
        braceDepth -= 1;
        if (braceDepth === 0) break;
        tokens.push({ kind: "text", value: "}" });
        i += 1;
        continue;
      }
    }

    if (ch === "#") {
      let j = i + 1;
      while (j < code.length && code[j] !== "\n") j += 1;
      tokens.push({ kind: "comment", value: code.slice(i, j) });
      i = j;
      continue;
    }

    const fString = ch === "f" ? quoteDelim(code, i + 1) : null;
    if (fString) {
      const result = readString(code, i, fString, true);
      tokens.push(...result.tokens);
      i = result.index;
      continue;
    }

    const delim = quoteDelim(code, i);
    if (delim) {
      const result = readString(code, i, delim, false);
      tokens.push(...result.tokens);
      i = result.index;
      continue;
    }

    if (ch === "`") {
      const result = readString(code, i, "`", false, "regex");
      tokens.push(...result.tokens);
      i = result.index;
      continue;
    }

    if (ch === "@") {
      const name = readIdent(code, i + 1);
      if (name) {
        tokens.push({ kind: "decorator", value: `@${name}` });
        i += 1 + name.length;
        continue;
      }
    }

    if (/[A-Za-z_]/.test(ch)) {
      const word = readIdent(code, i);
      const afterWord = i + word.length;
      const ws = readWhitespace(code, afterWord);
      const next = afterWord + ws.length;

      if (DECLARATION_SET.has(word) && readIdent(code, next)) {
        tokens.push({ kind: "declaration", value: word });
        if (ws) tokens.push({ kind: "text", value: ws });
        const name = readIdent(code, next);
        tokens.push({ kind: DECL_NAME_KIND[word] ?? "text", value: name });
        i = next + name.length;
        continue;
      }

      if (code[next] === "!") {
        tokens.push({ kind: "macro", value: word });
        i = afterWord;
        continue;
      }

      let kind: TokenKind = "text";
      if (MODIFIER_SET.has(word)) kind = "modifier";
      else if (CONSTANT_SET.has(word)) kind = "constant";
      else if (KEYWORD_SET.has(word)) kind = "keyword";
      else if (TYPE_SET.has(word)) kind = "type";
      else if (EXCEPTION_SET.has(word)) kind = "exception";
      else if (FUNCTION_SET.has(word)) kind = "function";

      tokens.push({ kind, value: word });
      i = afterWord;
      continue;
    }

    if (ch === ".") {
      const name = readIdent(code, i + 1);
      if (name) {
        tokens.push({ kind: "text", value: "." });
        tokens.push({ kind: "member", value: name });
        i += 1 + name.length;
        continue;
      }
    }

    const number = NUMBER_RE.exec(code.slice(i))?.[0];
    if (number) {
      tokens.push({ kind: "number", value: number });
      i += number.length;
      continue;
    }

    const operator = OPERATORS.find((op) => code.startsWith(op, i));
    if (operator) {
      tokens.push({ kind: "operator", value: operator });
      i += operator.length;
      continue;
    }

    tokens.push({ kind: "text", value: ch });
    i += 1;
  }

  return { tokens, index: i };
}

function readString(
  code: string,
  start: number,
  delim: string,
  interpolated: boolean,
  kind: TokenKind = "string",
): { tokens: Token[]; index: number } {
  const tokens: Token[] = [];
  const open = interpolated ? `f${delim}` : delim;
  tokens.push({ kind, value: open });
  let i = start + open.length;

  while (i < code.length) {
    if (code.startsWith(delim, i)) {
      tokens.push({ kind, value: delim });
      return { tokens, index: i + delim.length };
    }

    if (code[i] === "\\" && i + 1 < code.length) {
      tokens.push({ kind: "escape", value: code.slice(i, i + 2) });
      i += 2;
      continue;
    }

    if (interpolated && code[i] === "{") {
      if (code[i + 1] === "{") {
        tokens.push({ kind, value: "{{" });
        i += 2;
        continue;
      }
      tokens.push({ kind: "text", value: "{" });
      const inner = tokenize(code, i + 1, true);
      tokens.push(...inner.tokens);
      if (code[inner.index] === "}") {
        tokens.push({ kind: "text", value: "}" });
        i = inner.index + 1;
      } else {
        i = inner.index;
      }
      continue;
    }

    let j = i + 1;
    while (
      j < code.length &&
      !code.startsWith(delim, j) &&
      code[j] !== "\\" &&
      !(interpolated && code[j] === "{")
    ) {
      j += 1;
    }
    tokens.push({ kind, value: code.slice(i, j) });
    i = j;
  }

  return { tokens, index: i };
}

export function highlightSere(code: string): ReactNode {
  if (!code) return null;

  return tokenize(code).tokens.map((token, index) => (
    <span
      key={index}
      className={TOKEN_CLASS[token.kind] || undefined}
      style={TOKEN_COLOR[token.kind] ? { color: TOKEN_COLOR[token.kind] } : undefined}
    >
      {token.value}
    </span>
  ));
}