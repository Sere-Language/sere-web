# Classes, structs, and enums

Three user-defined record kinds. They share field/method syntax and diverge on identity, copy, and inheritance.

## Class — identity

A class value is a reference. Assignment aliases. Multiple bases are allowed.

```sere
class Pet:
    name: str

    def __init__(self, name: str) -> void:
        self.name = name

    def id(self) -> i32:
        return 1

class Cat(Pet):
    def __init__(self, name: str) -> void:
        super().__init__(name)

class Box[T]:
    value: T

    def get(self) -> T:
        return self.value

class Animal:
    @abstract
    def speak(self) -> i32:
        pass
```

Construct with `Pet("z")` or `Box[i32](4)`. `super()` is the first base. `@frozen` locks fields after init. `@abstract` methods must be overridden.

Sema flattens inheritance before checking bodies, so an inherited method is a real symbol, not a lookup at runtime.

## Struct — value

```sere
struct Point:
    x: i32
    y: i32

    def length_sq(self) -> i32:
        return self.x * self.x + self.y * self.y

p: Point = Point(1, 2)
q: Point = p     # copy
q.x = 9          # p.x stays 1
```

Structs cannot inherit. Methods still take `self`; they operate on the value (or a temporary), they do not turn the struct into a class.

Use a struct when the bits are the identity — points, colors, small records you want to pass without sharing.

## Enum — discriminant

```sere
enum Color:
    Red
    Green = 2
    Blue

enum Message:
    Quit
    Move(x: i32, y: i32)
    Write(str)

    def is_quit(self) -> bool:
        match self:
            case Message.Quit:
                return True
            case _:
                return False
```

- Unit variants: `Color.Green`
- Payload variants: `Message.Move(1, 2)`
- `.name` → `str`, `.value` → discriminant, `i32(tone)` → tag
- `Color.variants()` → `list[str]`
- `tone is Color.Green` compares variant identity
- `@flags` marks a flag set; `Flag.A in mask` is a bitwise test

`match` is the way to unpack payloads. See [Pattern matching](matching.md).

## Dunder methods

If a type defines these, the corresponding syntax uses them:

| Method | Syntax |
| --- | --- |
| `__init__` | `T(...)` |
| `__len__` | `len(x)` |
| `__getitem__` / `__setitem__` | `x[i]` / `x[i] = v` |
| `__contains__` | `v in x` |
| `__enter__` / `__exit__` | `with x as name:` |
| `__add__` / `__radd__` and other arithmetic | `+ - * / // % **` and comparisons |

These are ordinary methods with reserved names. Missing dunders mean the syntax does not typecheck on that type — the compiler will not invent operators.
