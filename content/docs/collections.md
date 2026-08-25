# Collections and strings

Lists, arrays, dicts, and strings are compiler-known types with runtime helpers in `sere_rt`. `len` is an intrinsic that also dispatches to `__len__`.

## Lists

```sere
xs: list[i32] = [1, 2, 3]
xs.append(4)
xs[0] = 10
print(len(xs), xs[1], xs[1:], xs[:2], xs[1:3], xs[:])
```

`xs.append(v)` and `append(xs, v)` both add to a list. `del xs[i]` removes an index.

Comprehensions:

```sere
comp: list[i32] = [x for x in range(0, ..., 3)]
```

## Arrays

```sere
arr: array[i32] = array[i32](1, 2, 3)
```

Fixed, constructed by the `array` intrinsic. Not a growable list.

## Dicts

```sere
ages: dict[str, i32] = {"ada": 36}
ages["ada"] = 37
empty: dict[str, i32] = dict[str, i32]()
del ages["ada"]
```

Empty dicts need the typed constructor. `del table[key]` removes a key.

## Strings

```sere
hello: str = "Hello"
assert hello[0] == "H"
assert hello[-1] == "o"
assert hello[1:4] == "ell"
assert "ell" in hello
assert hello + "!" == "Hello!"
assert hello * 2 == "HelloHello"
```

Indexing and slicing produce `str` (a one-character string for a single index). `for ch in hello` walks those one-character strings.

F-strings and triple quotes are lexical forms; they still type as `str`. Regex literals are **not** strings — they type as `regex`. See [Lexical structure](lexical.md).

## `len`

Works on `list`, `array`, `dict`, `str`, and any type with `__len__`. The intrinsic is the primitive; a dunder is the extension point.
