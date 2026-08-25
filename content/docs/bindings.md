# Names and bindings

Sere names live in stacked scopes. The type checker collects declarations first (types, functions, macros, methods), flattens inheritance, then checks bodies. The LSP reads a flattened `SemanticSymbol` table: name, kind, type display, range, snippet.

## Locals

```sere
n: i32 = 0
ptr: Unique[i32]
```

- `name: Type` — default-initialized slot
- `name: Type = expr` — initialized
- `=` always requires an expression
- Untyped locals infer from the initializer. If inference fails, you get `ValueError` or `Any`.

Assignments reject non-lvalues. `*p = v` is store-through-pointer, not multiplication — sema decides that before codegen.

## `static`

Module-level `static` and function-level `static` persist.

```sere
static module_count: i32 = 0

def bump() -> i32:
    static n: i32 = 0
    n = n + 1
    return n
```

A function `static` is one slot for the process, not per call. It is not a captured local.

## `const`

`const` binds a readonly name. The compiler treats later assignment as an error.

```sere
const limit = 4
```

## Aliases

Functions and types can be aliased. The alias is the same callable / type.

```sere
donut = print
```

## Decorators

Parsed as `@name` on the next declaration.

| Decorator | On | Effect |
| --- | --- | --- |
| `@public` / `@private` | field | Visibility. Outside use of a private field is `PermissionError`. |
| `@abstract` | method | Must be overridden. |
| `@override` | method | Marks an override. |
| `@frozen` | class | Fields are not assignable after init. |
| `@flags` | enum | Stored on the enum. `Flag.A in mask` is a bitwise test. Extra checking is still thin. |

## What does not exist

- `global` / `nonlocal`
- `del name` (only `del xs[i]` / `del table[key]`)
- Nested `def`
- Lambda capture of enclosing locals — pass values as parameters

Those diagnose instead of pretending to work. See [Functions](functions.md) for `lambda` rules.
