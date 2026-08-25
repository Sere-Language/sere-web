/** Token lists from the Sere TextMate grammar (`source.sere`). */

/** `# ...` — comment.line.number-sign.sere */
export const COMMENTS = "#" as const;

/** `f"""` / `f'''` — string.interpolated.triple.sere */
/** `f"` / `f'` — string.interpolated.sere */
export const FSTRING_PREFIX = "f" as const;

/** `"""` / `'''` — string.quoted.triple.sere */
/** `"` — string.quoted.double.sere */
/** `'` — string.quoted.single.sere */
export const STRING_DELIMS = ['"""', "'''", '"', "'"] as const;

/** `` `...` `` — string.regexp.sere */
export const REGEX_DELIM = "`" as const;

/** `@name` — punctuation.decorator + entity.name.function.decorator */
export const DECORATOR_PREFIX = "@" as const;

/** `macro name` — storage.type.macro + entity.name.function.macro */
export const MACRO_DECL = "macro" as const;

/** `def name` — storage.type.function + entity.name.function */
export const DEF_DECL = "def" as const;

/** `class` / `struct` / `enum` / `type` + name — storage.type + entity.name.type */
export const TYPE_DECLS = ["class", "struct", "enum", "type"] as const;

/** Bare declaration keywords — storage.type.sere */
export const DECLARATIONS = [
    "class",
    "struct",
    "enum",
    "type",
    "def",
    "macro",
] as const;

/** `name!` — entity.name.function.macro */
export const MACRO_INVOKE_SUFFIX = "!" as const;

/** `static` / `const` / `extern` — storage.modifier.sere */
export const MODIFIERS = ["static", "const", "extern"] as const;

/** `True` / `False` / `None` — constant.language.sere */
export const CONSTANTS = ["True", "False", "None"] as const;

/** Control-flow / language keywords — keyword.control.sere */
export const KEYWORDS = [
    "and",
    "as",
    "assert",
    "break",
    "case",
    "continue",
    "defer",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "match",
    "not",
    "or",
    "pass",
    "quote",
    "raise",
    "return",
    "super",
    "try",
    "while",
    "with",
    "syntax",
    "interpolate",
    "wrapper",
    "typed",
] as const;

/** Built-in types — storage.type.sere */
export const TYPES = [
    "void",
    "bool",
    "i8",
    "i16",
    "i32",
    "i64",
    "u8",
    "u16",
    "u32",
    "u64",
    "f32",
    "f64",
    "str",
    "regex",
    "byte",
    "never",
    "Int",
    "Float",
    "Unique",
    "Shared",
    "Ptr",
    "list",
    "array",
    "dict",
] as const;

/** Exception types — support.type.exception.sere */
export const EXCEPTIONS = [
    "Exception",
    "SyntaxError",
    "IndentationError",
    "NameError",
    "AttributeError",
    "TypeError",
    "IndexError",
    "ImportError",
    "ValueError",
    "AssertionError",
    "PermissionError",
    "RuntimeError",
    "RecursionError",
    "NotImplementedError",
] as const;

/** Built-in functions — entity.name.function.sere */
export const FUNCTIONS = [
    "print",
    "str",
    "unique",
    "shared",
    "alloc",
    "load",
    "store",
    "free",
    "len",
    "abs",
    "min",
    "max",
    "clamp",
    "sign",
    "range",
    "append",
    "typeof",
    "isinstance",
    "dir",
    "inspect",
    "sizeof",
    "alignof",
    "panic",
    "parse",
    "try_parse",
] as const;

/** `.name` — variable.other.member.sere */
export const MEMBER_PREFIX = "." as const;

/**
 * Operators — keyword.operator.sere
 * Longer tokens first so `**` wins over `*`, `//=` over `//`, etc.
 */
export const OPERATORS = [
    "|>",
    "++",
    "--",
    "**=",
    "**",
    "*=",
    "&=",
    "<<=",
    "<<",
    ">>=",
    ">>",
    "<=",
    ">=",
    "==",
    "!=",
    "=>",
    "->",
    "+=",
    "-=",
    "/=",
    "//=",
    "//",
    "%=",
    "^=",
    "|",
    "^",
    "~",
    "*",
    "&",
    "+",
    "-",
    "<",
    ">",
    "=",
    "!",
    "$",
] as const;

/** Hex / bin / oct / decimal / float — constant.numeric.sere */
export const NUMBER =
    /\b0[xX][0-9A-Fa-f][0-9A-Fa-f_]*\b|\b0[bB][01][01_]*\b|\b0[oO][0-7][0-7_]*\b|\b[0-9][0-9_]*(\.[0-9_]*([eE][+-]?[0-9_]+)?|[eE][+-]?[0-9_]+)?[fF]?\b|\.[0-9][0-9_]*([eE][+-]?[0-9_]+)?[fF]?/;


export const CODE_SAMPLE = `struct Point:
    x: i32
    y: i32

    def length_sq(self) -> i32:
        return self.x * self.x + self.y * self.y

def main() -> i32:
    p = Point(3, 4)
    print(f"sere {p.length_sq()}")
    return 0`