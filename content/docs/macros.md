# Macros

Macros run **after parse, before type checking**. They rewrite token trees / AST. They are hygienic by default: names introduced in a `quote` do not capture caller names. Expansion depth is capped (diagnostic `RecursionError`, fuel default 128).

User macros are navigable in the LSP. Prelude macros (`dbg!`, `todo!`, …) are not.

## Quote

```sere
macro twice(x):
    quote:
        ($x) + ($x)

total: i32 = twice!(n)
```

Splice with `$x`. Repeats: `$($x),*` inside `quote`. `$type` is available when the macro sets `typed: true` (the type of the first argument).

Hygiene means a `tmp` you bind inside `quote` is not the caller's `tmp`. That is the point — macros compose without stealing locals.

## Match (token trees)

```sere
macro vec:
    match:
        ($($x:expr),*) => quote:
            [$($x),*]

xs: list[i32] = vec!(1, 2, 3)
```

Specs include `expr`, `ident`, `literal`. The expander re-parses captured tokens as expressions when the spec says `expr`.

## Indent / raw / pipeline

Statement form: `name:` plus an indented body. Expression form only after `=`:

```sere
node: Html = html:
    <div>{title}</div>

n: i32 = pipeline:
    1
    |> add2
    |> wrap(4)
```

Do **not** write `if left < right:` as a macro invocation. `ident:` newline after a comparison is the suite colon, not an indent-macro.

## Properties

```sere
macro html:
    syntax: raw          # raw | tokens | pipeline | (default sere)
    interpolate: brace   # brace | dollar
    wrapper: Html        # constructor around the result
    typed: true
```

## Invocation shapes

- `name!(...)`  `name!{...}`  `name![...]`
- indent `name:` (statement, or initializer after `=`)

Import macros like any name: `from html_lang import html, Html`.

## Pipeline pieces in the compiler

| Piece | Header | Role |
| --- | --- | --- |
| Token trees | `macro/TokenTree.h` | Nest `()`, `[]`, `{}`, indent blocks |
| Pattern parse | `macro/Parse.h` | Re-parse captured tokens as exprs |
| Quote | `macro/Quote.h` | Clone AST, substitute `$x`, hygiene |
| Expander | `macro/Expander.h` | `quote`, `match`, raw bodies, fuel limit |

Imported modules expand first, then the user module. That way a macro you import is already defined when your file expands.

## What macros are not

They are not runtime reflection. After expansion, sema sees ordinary Sere. If expansion blows the fuel limit, you get `RecursionError`, not a silent infinite compile.
