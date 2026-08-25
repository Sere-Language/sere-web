# Expressions

Precedence, high to low (roughly): postfix → unary → `as` → range → `* / // % **` → `+ -` → shifts → `&` → `^` → `|` → comparisons / `in` / `is` → `and` → `or` → ternary `a if c else b`.

The parser is recursive descent. Unary `*`, `&`, `++`, `--`, `not`, `+`, `-`, `~` sit above `as`. Assignment-like `:=` is parsed with the low-precedence expression forms.

## Postfix

Call, member, index, slice, and suffix `++` / `--` bind tightest.

```sere
xs[0]
xs[1:3]
p.length_sq()
n++
```

## Casts

```sere
n as i32
i32(tone)
Unique[T](pointer)
```

`as` is a checked/declared conversion in sema. Constructors on records and enums are `__init__` or variant construction, not the same node as `as`.

## Range

`start ... stop` desugars to `range(start, stop)`. A bare `...` in a call argument list is skipped, so `range(0, ..., 3)` is `range(0, 3)`.

`range` is an intrinsic that yields `list[i32]`:

| Call | Meaning |
| --- | --- |
| `range(stop)` | `0 … stop-1` |
| `range(start, stop)` | `start … stop-1` |
| `range(start, stop, step)` | stepped |

## Collections in expression position

```sere
xs: list[i32] = [1, 2, 3]
ages: dict[str, i32] = {"ada": 36}
empty: dict[str, i32] = dict[str, i32]()
arr: array[i32] = array[i32](1, 2, 3)
comp: list[i32] = [x for x in range(0, ..., 3)]
```

List comprehensions are real expressions. They type as `list[T]` from the element expression.

## F-strings

`f"n={n}"` interpolates an expression in `{...}`. The hole is a full expression, not a format mini-language. `{{` is a literal brace.

## Walrus

```sere
if (n := 3) > 0:
    print(n)
```

`name := expr` binds `name` and yields the value. The binding is visible in the enclosing statement's scope.

## Ternary

```sere
label: str = "ok" if n > 0 else "no"
```

This is `a if cond else b`, not a C-style `? :`.

## Lambdas and tuples

```sere
pair = (1, 2)
a, b = pair
add1 = lambda (x: i32) -> i32: x + 1
```

Untyped `lambda` parameters are `Any`. Lambdas **do not capture** enclosing locals. If you need a closed-over value, pass it as a parameter.

## Boolean and membership

```sere
ok: bool = "ell" in hello and n > 0 and not False
```

`in` uses `__contains__` when the type defines it. `is` on enum variants compares variant identity (`tone is Color.Green`).
