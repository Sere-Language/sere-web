import type { Monaco } from "@monaco-editor/react";
import type { editor, languages } from "monaco-editor";
import {
  CONSTANTS,
  DECLARATIONS,
  EXCEPTIONS,
  FUNCTIONS,
  KEYWORDS,
  MODIFIERS,
  TYPES,
} from "../utils/code";

export const SERE_LANGUAGE_ID = "sere";

export const SERE_TOKEN_TYPES = [
  "namespace",
  "type",
  "class",
  "enum",
  "struct",
  "typeParameter",
  "parameter",
  "variable",
  "property",
  "enumMember",
  "function",
  "method",
  "macro",
  "keyword",
  "modifier",
  "string",
  "number",
  "regexp",
  "operator",
  "decorator",
] as const;

export const SERE_TOKEN_MODIFIERS = [
  "declaration",
  "definition",
  "readonly",
  "static",
  "abstract",
  "defaultLibrary",
] as const;

const EXTRA_TYPES = ["Callable", "Function", "Class"] as const;

const languageConfig: languages.LanguageConfiguration = {
  comments: { lineComment: "#" },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string", "comment"] },
    { open: "'", close: "'", notIn: ["string", "comment"] },
    { open: "`", close: "`", notIn: ["string", "comment"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
    { open: "`", close: "`" },
  ],
  folding: {
    offSide: true,
    markers: {
      start: /^\s*#\s*region\b/,
      end: /^\s*#\s*endregion\b/,
    },
  },
  indentationRules: {
    increaseIndentPattern:
      /^\s*(def|class|struct|enum|macro|if|elif|else|while|for|try|except|finally|match|case|quote|defer).*:(\s*(#.*)?)?$/,
    decreaseIndentPattern: /^\s*(elif|else|except|finally|case)\b/,
  },
  wordPattern:
    /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]+)/g,
};

const monarch: languages.IMonarchLanguage = {
  defaultToken: "source",
  tokenPostfix: ".sere",
  ignoreCase: false,
  keywords: [...DECLARATIONS, ...KEYWORDS, ...MODIFIERS],
  typeKeywords: [...TYPES, ...EXTRA_TYPES, ...EXCEPTIONS],
  constants: [...CONSTANTS],
  builtins: [...FUNCTIONS],
  tokenizer: {
    root: [
      [/#.*$/, "comment"],
      [/f"""/, { token: "string", next: "@ftripleDq" }],
      [/f'''/, { token: "string", next: "@ftripleSq" }],
      [/f"/, { token: "string", next: "@fstringDq" }],
      [/f'/, { token: "string", next: "@fstringSq" }],
      [/"""/, { token: "string", next: "@tripleDq" }],
      [/'''/, { token: "string", next: "@tripleSq" }],
      [/"/, { token: "string", next: "@stringDq" }],
      [/'/, { token: "string", next: "@stringSq" }],
      [/`/, { token: "regexp", next: "@regex" }],
      [/@[A-Za-z_]\w*/, "annotation"],
      [/\bdef\b/, { token: "keyword", next: "@afterDef" }],
      [/\bmacro\b/, { token: "keyword", next: "@afterMacro" }],
      [/\b(?:class|struct|enum|type)\b/, { token: "keyword", next: "@afterType" }],
      [/[A-Za-z_]\w*!(?!\w)/, "identifier.macro"],
      [
        /[A-Za-z_]\w*/,
        {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@constants": "constant",
            "@builtins": "identifier.function",
            "@default": "identifier",
          },
        },
      ],
      [/\./, { token: "delimiter", next: "@member" }],
      [/->/, "operator"],
      [/=>/, "operator"],
      [/\|>/, "operator"],
      [
        /\+\+|--|\*\*=|\*\*|\*=|&=|<<=|<<|>>=|>>|<=|>=|==|!=|\+=|-=|\/=|\/\/=|\/\/|%=|\^=/,
        "operator",
      ],
      [/[+\-*/%&|^~<>!=$]/, "operator"],
      [/0[xX][0-9A-Fa-f_]+/, "number"],
      [/0[bB][01_]+/, "number"],
      [/0[oO][0-7_]+/, "number"],
      [/\d[\d_]*(\.[\d_]*)?([eE][+-]?\d[\d_]*)?[fF]?/, "number"],
      [/\.[\d_]+([eE][+-]?\d[\d_]*)?[fF]?/, "number"],
      [/[{}()\[\]]/, "delimiter.bracket"],
      [/[,:;]/, "delimiter"],
    ],
    afterDef: [
      [/\s+/, "white"],
      [/[A-Za-z_]\w*/, { token: "identifier.function", next: "@pop" }],
      [/./, { token: "source", next: "@pop" }],
    ],
    afterMacro: [
      [/\s+/, "white"],
      [/[A-Za-z_]\w*/, { token: "identifier.macro", next: "@pop" }],
      [/./, { token: "source", next: "@pop" }],
    ],
    afterType: [
      [/\s+/, "white"],
      [/[A-Za-z_]\w*/, { token: "type", next: "@pop" }],
      [/./, { token: "source", next: "@pop" }],
    ],
    member: [
      [/[A-Za-z_]\w*/, { token: "identifier.member", next: "@pop" }],
      [/./, { token: "source", next: "@pop" }],
    ],
    stringDq: [
      [/\\./, "string.escape"],
      [/"/, { token: "string", next: "@pop" }],
      [/[^\\"]+/, "string"],
    ],
    stringSq: [
      [/\\./, "string.escape"],
      [/'/, { token: "string", next: "@pop" }],
      [/[^\\']+/, "string"],
    ],
    tripleDq: [
      [/\\./, "string.escape"],
      [/"""/, { token: "string", next: "@pop" }],
      [/./, "string"],
    ],
    tripleSq: [
      [/\\./, "string.escape"],
      [/'''/, { token: "string", next: "@pop" }],
      [/./, "string"],
    ],
    regex: [
      [/\\./, "string.escape"],
      [/`/, { token: "regexp", next: "@pop" }],
      [/[^\\`]+/, "regexp"],
    ],
    fstringDq: [
      [/\\./, "string.escape"],
      [/\{/, { token: "delimiter.bracket", next: "@interp" }],
      [/"/, { token: "string", next: "@pop" }],
      [/[^\\"\{]+/, "string"],
    ],
    fstringSq: [
      [/\\./, "string.escape"],
      [/\{/, { token: "delimiter.bracket", next: "@interp" }],
      [/'/, { token: "string", next: "@pop" }],
      [/[^\\'\{]+/, "string"],
    ],
    ftripleDq: [
      [/\\./, "string.escape"],
      [/\{/, { token: "delimiter.bracket", next: "@interp" }],
      [/"""/, { token: "string", next: "@pop" }],
      [/./, "string"],
    ],
    ftripleSq: [
      [/\\./, "string.escape"],
      [/\{/, { token: "delimiter.bracket", next: "@interp" }],
      [/'''/, { token: "string", next: "@pop" }],
      [/./, "string"],
    ],
    interp: [
      [/\}/, { token: "delimiter.bracket", next: "@pop" }],
      [/#.*$/, "comment"],
      [
        /[A-Za-z_]\w*/,
        {
          cases: {
            "@keywords": "keyword",
            "@typeKeywords": "type",
            "@constants": "constant",
            "@builtins": "identifier.function",
            "@default": "identifier",
          },
        },
      ],
      [/\d[\d_]*/, "number"],
      [/[,:.]/, "delimiter"],
      [/[+\-*/%]/, "operator"],
      [/\s+/, "white"],
    ],
  },
};

const theme: editor.IStandaloneThemeData = {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "8b8582" },
    { token: "string", foreground: "e8cfc4" },
    { token: "string.escape", foreground: "d4a090" },
    { token: "regexp", foreground: "e8cfc4" },
    { token: "source", foreground: "c8c2be" },
    { token: "keyword", foreground: "d66a62" },
    { token: "keyword.sere", foreground: "d66a62" },
    { token: "operator", foreground: "d66a62" },
    { token: "operator.sere", foreground: "d66a62" },
    { token: "constant", foreground: "d4a090" },
    { token: "number", foreground: "d4a090" },
    { token: "number.sere", foreground: "d4a090" },
    { token: "type", foreground: "d4a090" },
    { token: "type.sere", foreground: "d4a090" },
    { token: "delimiter", foreground: "8b8582" },
    { token: "delimiter.bracket", foreground: "8b8582" },
    { token: "annotation", foreground: "c9b8b0" },
    { token: "identifier.function", foreground: "c9b8b0" },
    { token: "identifier.macro", foreground: "c9b8b0" },
    { token: "identifier.member", foreground: "d4a090" },
    { token: "identifier", foreground: "c8c2be" },
    { token: "namespace", foreground: "d4a090" },
    { token: "class", foreground: "d4a090" },
    { token: "enum", foreground: "d4a090" },
    { token: "struct", foreground: "d4a090" },
    { token: "typeParameter", foreground: "d4a090" },
    { token: "parameter", foreground: "c8c2be" },
    { token: "variable", foreground: "c8c2be" },
    { token: "property", foreground: "d4a090" },
    { token: "enumMember", foreground: "d4a090" },
    { token: "function", foreground: "c9b8b0" },
    { token: "method", foreground: "c9b8b0" },
    { token: "macro", foreground: "c9b8b0" },
    { token: "modifier", foreground: "d66a62" },
    { token: "decorator", foreground: "c9b8b0" },
  ],
  colors: {
    "editor.background": "#16181c",
    "editorGutter.background": "#16181c",
    "editorLineNumber.foreground": "#5c5856",
    "editorLineNumber.activeForeground": "#9a948f",
    "editorCursor.foreground": "#c25248",
    "editor.selectionBackground": "#c2524833",
    "editor.lineHighlightBackground": "#ffffff08",
    "editorWidget.background": "#1c2024",
    "editorWidget.border": "#ffffff12",
    "editorSuggestWidget.background": "#1c2024",
    "editorSuggestWidget.border": "#ffffff12",
    "editorHoverWidget.background": "#1c2024",
    "editorHoverWidget.border": "#ffffff12",
  },
};

let registered = false;

export function ensureSereMonaco(monaco: Monaco): void {
  monaco.editor.defineTheme("sere-dark", theme);
  if (!registered) {
    monaco.languages.register({
      id: SERE_LANGUAGE_ID,
      extensions: [".sere"],
      aliases: ["Sere", "sere"],
    });
    registered = true;
  }
  monaco.languages.setLanguageConfiguration(SERE_LANGUAGE_ID, {
    ...languageConfig,
    onEnterRules: [
      {
        beforeText:
          /^\s*(def|class|struct|enum|macro|if|elif|else|while|for|try|except|finally|match|case|quote|defer).*:(\s*(#.*)?)?$/,
        action: { indentAction: monaco.languages.IndentAction.Indent },
      },
      {
        beforeText: /^\s*(elif|else|except|finally|case)\b.*/,
        action: { indentAction: monaco.languages.IndentAction.Outdent },
      },
    ],
  });
  monaco.languages.setMonarchTokensProvider(SERE_LANGUAGE_ID, monarch);
}

export const SERE_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  tabSize: 4,
  insertSpaces: true,
  detectIndentation: false,
  minimap: { enabled: false },
  fontSize: 13.5,
  fontFamily:
    '"JetBrainsMono Nerd Font Mono", var(--font-geist-mono), ui-monospace, monospace',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  padding: { top: 16, bottom: 16 },
  lineHeight: 22,
  renderLineHighlight: "line",
  smoothScrolling: true,
  cursorBlinking: "smooth",
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  wordBasedSuggestions: "off",
  snippetSuggestions: "none",
  acceptSuggestionOnEnter: "on",
  quickSuggestions: { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  tabCompletion: "on",
  parameterHints: { enabled: true, cycle: true },
  inlayHints: { enabled: "on" },
  codeLens: true,
  formatOnType: false,
  autoClosingBrackets: "languageDefined",
  autoClosingQuotes: "languageDefined",
  matchBrackets: "always",
  folding: true,
  links: true,
};
