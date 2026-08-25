# Functions

Functions are first-class names. Sema collects them before checking bodies so mutual recursion typechecks. Codegen declares LLVM functions, including `extern "C"` symbols and generic instantiations, then emits reachable bodies.

## Shape

```sere
def scale(value: i32, factor: i32 = 2) -> i32:
    return value * factor

def identity[T](value: T) -> T:
    return value
```

- Return type after `->` may be omitted: `main` infers `i32`, `__init__` infers `void`, other functions infer `Any`
- Parameter types may be omitted (`Any`)
- Default arguments are allowed
- Generic type parameters: `[T]` on `def` or `class`
- Methods take `self` as the first parameter
- `super()` is the first base class: `super().__init__(name)`, `super().id()`

There is no `*args` / `**kwargs`, no keyword-only parameters, and no nested `def`. Those are reserved and diagnose.

## Inference is not gradual dynamism

`Any` is a top type, not “we will figure it out at runtime.” You can write untyped parameters and still compile, but the checker will not invent a precise type later. Prefer explicit `i32` / `str` / `T` on anything that crosses a function boundary.

## Lambdas

```sere
add1 = lambda (x: i32) -> i32: x + 1
```

Untyped `lambda x: ...` parameters are `Any`. **No capture.** A lambda is a function value, not a closure over the enclosing frame. Pass what you need as arguments.

## Native functions

```sere
extern "C" "native_add"
def add(left: i32, right: i32) -> i32
```

The string is the link symbol. The `def` has no body. Codegen emits a declaration with that name. Link the object or lib with `--link`.

This is the typed path. The boxed `Sere_Object` API (`Sere_DefineFunction`) is the other path — see [Interop](interop.md).

## Dunders as functions

If a type defines `__len__`, `len(x)` calls it. Same for `__getitem__`, `__contains__`, arithmetic, `__enter__` / `__exit__`. The syntax is not special-cased per type in the parser; sema resolves the method.

## `main` wrapping

User `main` is not the LLVM/C entry. The backend wraps it as C `main`, converts `argv` when the signature asks for `list[str]`, then returns the `i32` (or `0` for `void`). Module init runs first.
