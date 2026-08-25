# The compiler

Sere is split so the compiler and the editor share one analysis pipeline. Codegen, linking, and the language server are thin clients of that pipeline.

`tools/sere/main.cpp` only parses argv and calls `Compiler::run`.

```
Compiler::run
 ├── --lsp            → runLanguageServer()
 ├── init/build/run/clean/shell
 └── compileInput()
      ├── Frontend::analyze()     lex, parse, import, prelude, macros, sema
      ├── IRGenerator::emit()     typed AST → LLVM module
      ├── runOptPipeline()
      └── clang/lld + sere_rt     unless --emit-llvm or --emit-asm
```

`--analyze` runs `Frontend` and prints JSON diagnostics. It never touches LLVM. That is the same path the LSP uses for `textDocument/publishDiagnostics`.

## Frontend

`Frontend::analyze(path, text, stdlibDir)`:

1. Reset diagnostics, AST, types, imports.
2. Wrap `text` in a `SourceManager`.
3. **Lex** the whole file (`Lexer::tokenizeAll`).
4. **Parse** a `Module` (`Parser::parseModule`).
5. **Load imports** — origin directory, then `stdlib/`.
6. **Load prelude** into the user module, marked `fromPrelude()`.
7. Collect macro use sites for the LSP.
8. **Expand macros** on imported modules, then on the user module.
9. Build a `TypeContext` and typecheck imports.
10. Typecheck the user module. `TypeChecker` fills `resolvedType()` and a `SemanticSymbol` table.

If parse fails, `Frontend` still keeps an empty module so the LSP can report diagnostics instead of crashing.

Keywords live in `kKeywords` (`lib/lex/Token.cpp`). The keyword `TokenKind` range must stay contiguous (`KeywordFalse` through `KeywordWith`). Insert new keywords **before** `Unknown`, inside that block.

On error the parser synchronizes and keeps going.

## Sema

1. Register intrinsics (`registerBuiltins`).
2. Inject module dunders.
3. Collect class / enum / alias / function / macro / method names.
4. Flatten inheritance.
5. Check bodies: statements, inference, casts, dunders, pointers.

Symbols live in stacked scopes. Pointer rules (`*`, `&`, `*p = v`) are sema, not codegen.

## Backend

`IRGenerator` takes a typed `Module` plus imported modules and builds an `llvm::Module`.

- Lower `Type*` to `llvm::Type*`
- Declare functions, including `extern "C"` and generic instantiations
- Emit module init for globals
- Lower statements and expressions
- Call the C runtime (`sere_alloc`, `sere_print_str`, `sere_list_push`, …)
- Wrap user `main` as C `main`
- Drop unique pointers at end of scope (`emitDrops`)

If a program can reach codegen, it should already be well-typed. Do not put new language diagnostics in IR gen.

`runOptPipeline` uses LLVM PassBuilder at `--opt=` levels `O0`…`O3`, `Os`, `Oz`. Default for a normal compile is `O0` unless the driver overrides it. `--passes=` injects a custom pipeline string.

Linking writes a temp `.ll`, then the pinned `clang` + `lld` + `sere_rt`.

## Runtime

`runtime/` is C (plus optional `sere_qt6.cpp`). ABI lives in headers.

| Header | Role |
| --- | --- |
| `runtime/sere_rt.h` | Strings, lists, dicts, alloc, print, sys |
| `include/sere/api/sere_mod.h` | Boxed objects and `Sere_DefineFunction` |
| `include/sere/api/sere_gc.h` | Pluggable collector vtable |

| File | Typical contents |
| --- | --- |
| `sere_rt.c` | Core heap, strings, lists |
| `sere_gc.c` | Builtin collectors |
| `sere_mod.c` | Native module registry |
| `sere_stdlib.c` | Extra stdlib C helpers |
| `sere_sys.c` | Process / env |
| `sere_re.c` | Regex |
| `sere_win.c` / `sere_gl.c` | Platform / OpenGL |
| `sere_qt6.cpp` or stub | Qt widgets |

New runtime function: declare in a header, implement in the matching `.c`, bind from Sere with `extern "C"`.

## Intrinsics vs stdlib vs extern

See [Interop](interop.md). The short version: intrinsics are always in scope; stdlib is parsed Sere; `--link` is your C.

## Invariants

- No circular CMake library deps.
- Editor code stays in `lib/lsp` and `editors/vscode`. Language rules stay in parse / sema / codegen.
- Heavy work stays off the UI thread by running `sere --lsp` as a child process.
- New public API goes in `include/sere/…` with a file docstring.

## Adding syntax

| Change | Lexer | Parser | AST | Macros | Sema | Codegen | LSP / grammar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| New keyword | yes | yes | maybe | if quoted | yes | yes | yes |
| New operator | maybe | yes | op enum | — | yes | yes | tokens + tmLanguage |
| New intrinsic | — | — | — | — | builtin + check | `emitIntrinsic` | completions |
| New node kind | — | yes | yes | clone/subst | check* | emit* | `Query.cpp` |

When you add a node kind, update `searchExpr` / `searchStmt` in `lib/ast/Query.cpp` or hover and go-to-definition will miss it.
