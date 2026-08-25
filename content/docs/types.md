# Types

Types are interned. Pointer identity is equality (`TypeContext`). Sema fills `resolvedType()` on AST nodes; codegen must not invent new language rules.

## Kinds in the compiler

| `TypeKind` | Examples |
| --- | --- |
| `Primitive` | `i32`, `bool`, `str`, `void`, `never` |
| `Generic` | `Unique[T]`, `Ptr[i32]`, `list[str]`, `dict[K, V]` |
| `Record` | `class`, `struct`, `enum` |
| `Function` | `(i32, i32) -> i32` |
| `Alias` | `type Meters = i32` |
| `TypeParam` | `T` on a generic `def` / `class` |
| `Module` | imported package object |
| `Union` | `T \| U` |

`Any` is a top type: every value is assignable to it. Omitted parameter and return types become `Any`. `None` is `void` as a named type, so both of these are valid:

```sere
n: i32 | None = None
m: i32 | None = void
```

## Primitives

| Type | Meaning |
| --- | --- |
| `void` | No value (function returns) |
| `bool` | `True` / `False` |
| `i8` `i16` `i32` `i64` | Signed integers |
| `u8` `u16` `u32` `u64` | Unsigned integers |
| `f32` `f64` | IEEE floats |
| `str` | String |
| `byte` | Alias of `u8` |
| `regex` | Compiled pattern (backtick literal) |
| `never` | Does not return (`panic`, `todo!`) |

Prelude aliases (unions):

```sere
type Int = i8 | i16 | i32 | i64 | u8 | u16 | u32 | u64
type Float = f32 | f64
```

Integer widths mix in arithmetic. The result widens:

```sere
type Number = i32 | i64
wide: i64 = 10
total: i64 = small + wide
```

## Pointers

| Type | Meaning |
| --- | --- |
| `Unique[T]` | Exclusive heap pointer; dropped at end of scope |
| `Shared[T]` | Reference-counted heap pointer |
| `Ptr[T]` | Raw pointer; caller `free`s |

All three are pointer-like (`Type::isPointerLike`, `pointeeType()`). They share an LLVM pointer representation with different drop / retain rules. See [Memory](memory.md).

## Collections

| Type | Meaning |
| --- | --- |
| `list[T]` | Runtime list |
| `array[T]` | Fixed array from `array[T](...)` |
| `dict[K, V]` | Map |

Empty dicts need an explicit constructor: `dict[str, i32]()`.

## User types

- `class` — identity (reference). Inheritance and `super()` are allowed.
- `struct` — copy-by-value. No inheritance.
- `enum` — discriminant plus optional payloads.
- `type Name = ...` — alias or union.

Cast with `as` or a constructor: `n as i32`, `i32(tone)`, `T(value)`, `Unique[T](pointer)`.

## What is not a type rule in codegen

If a program reaches IR generation, it is already well-typed. New facts belong on the AST or the `Type`, not in an LLVM pass. That is the contract that keeps the LSP, `--analyze`, and `sere build` agreeing.
