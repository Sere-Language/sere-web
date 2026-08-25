# Pattern matching

`match` is a statement. The scrutinee is evaluated once. Arms are tried in order. `case _` is the wildcard.

```sere
match moved:
    case Message.Move(x, y):
        assert x == 1
    case Message.Quit if n > 0:
        pass
    case _:
        assert False
```

## What binds

Enum payloads bind names in the arm. `Message.Move(x, y)` brings `x` and `y` into that suite with the payload field types. Unit variants bind nothing.

`case pat if expr` is a guard. The pattern must match **and** the guard must be true, or the next arm is tried.

## What `is` is not

`tone is Color.Green` is an expression that compares variant identity. It is not a `match`. Use `is` in conditions; use `match` when you need to unpack.

## Exhaustiveness

Write a `case _` when you do not want a fall-through hole. The compiler will not silently invent a default. An unmatched value that falls out of a `match` without a wildcard is a runtime / control-flow problem — treat `_` as part of the contract.

## Flags

On a `@flags` enum, `Flag.A in mask` is a bitwise test, not a `match`. You can still `match` the whole mask if you need structure; `in` is the cheap membership check.
