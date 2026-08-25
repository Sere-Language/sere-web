# Errors

Sere exceptions are values with a class hierarchy rooted at `Exception`. `try` needs `except` and/or `finally`. Optional `else` runs when nothing was raised.

```sere
try:
    raise TypeError("nope")
except TypeError as e:
    print(e.message)
```

`except Type` matches that class and its subclasses. Bare `except:` catches everything. `as e` binds an instance with `.message`.

## Raising

```sere
class Boom(ValueError):
    pass

raise Boom("bad")
raise "boom"                 # Exception
raise TypeError              # empty message
assert False, "fail"         # AssertionError, catchable
```

`raise` stringifies the first constructor argument (or a bare `str`). Bare `raise` uses an empty `Exception`. `panic("msg")` still aborts — it is not catchable control flow.

## Builtin classes

All subclass `Exception`:

`SyntaxError`, `IndentationError`, `NameError`, `AttributeError`, `TypeError`, `IndexError`, `ImportError`, `ValueError`, `AssertionError`, `PermissionError`, `RuntimeError`, `RecursionError`, `NotImplementedError`.

The **compiler** also uses these names as diagnostic codes: `error[NameError]: unknown name 'foo'`. That is the same catalog, two surfaces. See [Diagnostics](diagnostics.md).

## Prelude macros

```sere
todo!("not yet")
unreachable!()
dbg!(total)          # prints and yields total
```

`todo!` and `unreachable!` are for paths that must not run. They are not a substitute for `raise`.

## `defer` vs `finally`

`defer` runs on function return, in reverse order. `finally` runs when leaving the `try`, including via `raise`. Use `finally` for exception-safe cleanup; use `defer` for the happy-path / every-return path inside one function.
