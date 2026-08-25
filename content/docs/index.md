# Sere language

Sere is a statically typed, indentation-significant language that compiles to native code through LLVM 22. This set of pages describes the language **as the compiler implements it**, not as a wishlist.

A linked executable needs `main`. The `i32` it returns is the process exit code. `print` is an intrinsic (a call), not a statement.

```sere
def main() -> i32:
    print("hello, sere")
    return 0
```

```powershell
sere examples\hello.sere -o hello.exe
.\hello.exe
```

`prelude.sere` is injected into every program. Other stdlib modules are opt-in (`import math`). A file without `main` still typechecks and can emit LLVM; it does not produce a C `main`.

## How to read these pages

Start with [Programs](programs.md), [Types](types.md), and [Memory](memory.md) if you care about what actually hits the metal. [Libraries](libraries.md) covers `.slib`. [Macros](macros.md) and [The compiler](compiler.md) are the deep cuts.

| Page | About |
| --- | --- |
| [Programs](programs.md) | Entry, init, indentation, default bindings |
| [Lexical structure](lexical.md) | Comments, keywords, literals, operators |
| [Types](types.md) | Primitives, pointers, unions, collections |
| [Names and bindings](bindings.md) | Locals, `static`, `const`, decorators |
| [Expressions](expressions.md) | Precedence, range, walrus, comprehensions |
| [Statements](statements.md) | Control flow, `defer`, `with`, `del` |
| [Functions](functions.md) | Inference, generics, `extern "C"` |
| [Classes, structs, enums](records.md) | Identity vs value, variants, dunders |
| [Modules](modules.md) | Imports, dunders, host flags |
| [Libraries](libraries.md) | `.slib`, `init-lib`, `pack`, folder libs |
| [Memory](memory.md) | Unique, Shared, Ptr, collectors |
| [Collections and strings](collections.md) | list, array, dict, slices |
| [Pattern matching](matching.md) | `match` / `case`, guards |
| [Errors](errors.md) | `try` / `raise`, exception types |
| [Macros](macros.md) | quote, match, raw, hygiene |
| [Introspection](introspection.md) | `typeof`, `sizeof`, host facts |
| [Diagnostics](diagnostics.md) | Codes and `# type: ignore` |
| [Interop](interop.md) | Linking C, module init |
| [Standard library](stdlib.md) | Prelude and opt-in modules |
| [The compiler](compiler.md) | Frontend, IR, runtime |

Unsupported constructs diagnose (`NotImplementedError` and friends) instead of generating silent wrong code.
