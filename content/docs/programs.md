# Programs

A Sere program is a module. The compiler typechecks the module, expands macros, then lowers a typed AST to LLVM. Linking produces a native binary only when the entry module defines `main`.

## Entry

`main` may return `i32` or `void`. An `i32` becomes the process exit code.

```sere
def main() -> i32:
    return 0
```

Arguments arrive as `list[str]` when you ask for them. The generated C `main` converts `argv` into that list.

```sere
def main(argv: list[str]) -> i32:
    return len(argv)
```

A module without `main` is still a valid compilation unit. `--emit-llvm` works. The linker will not invent a C `main` for you.

## Initialization order

1. Linked native `sere_mod_init` (if you provided one with `--link`).
2. Top-level statements in imported modules (typechecked, then run as module init).
3. Top-level statements in the entry file.
4. `main`.

Top-level work is module initialization, not a script body that replaces `main`. Keep it for constants, tables, and `static` counters.

## Bindings at the top level

A typed binding may omit an initializer. The slot is **default-initialized**. `=` always requires an expression.

```sere
ptr: Unique[i32]          # ok
n: i32 = 0                # ok
# n: i32 =                # error
```

`prelude.sere` is loaded into the user module and marked `fromPrelude()`, so it is not re-emitted as your code. Names from the prelude are in scope without an import.

## Indentation

Indent with **spaces only**. Tabs are `IndentationError`. The lexer emits `Indent` / `Dedent` / `Newline` tokens; the parser treats indentation as structure, not style.

## What the compiler actually emits

Reachable functions become LLVM functions. User `main` is wrapped as C `main`. Unique pointers are dropped at end of scope. The runtime library `sere_rt` is always linked.

See [The compiler](compiler.md) for the pipeline and [Memory](memory.md) for drop vs `free`.
