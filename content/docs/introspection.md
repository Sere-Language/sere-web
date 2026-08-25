# Introspection and platform

These names are always in scope. They are compiler primitives (or module dunders), not `import inspect`.

```sere
typeof(small)              # str
isinstance[i32](small)
isinstance(small, i32)
dir(Box)                   # list[str]
dir()
inspect(scale)             # str
sizeof[i32]()              # i64
alignof[i32]()             # i64
x.__name__  x.__type__  x.__module__  x.__qualname__
Type.__name__
```

`from inspect import label` adds extra helpers (`label`, `describe`). It does not replace the builtins.

## Size and align

`sizeof[T]()` and `alignof[T]()` are compile-time facts about the lowered type, returned as `i64`. Use them when you are writing interop or allocators, not as a substitute for `len`.

## `typeof` vs `isinstance`

`typeof(x)` is a string. `isinstance[i32](x)` / `isinstance(x, i32)` is a bool. Unions and aliases follow the type checker, not a runtime class table for primitives.

## Platform

Host flags (`__windows__`, `__x86_64__`, `__platform__`, …) are compile-time bools / strings. False `if` branches are skipped by sema. See [Modules](modules.md).
