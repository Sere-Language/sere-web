# Statements

Statements are the unit of control flow. The parser covers `def`, `class`, `struct`, `enum`, `type`, `macro`, imports, `if` / `while` / `for` / `match` / `try`, `defer`, `del`, `assert`, `raise`, and assignment. On error it synchronizes and keeps going so the LSP can still highlight the rest of the file.

## Simple statements

```sere
pass
assert cond
assert cond, "failed"
return expr
break
continue
n = n + 1
n += 2
++n
n++
```

`assert False, "fail"` raises a catchable `AssertionError`. `pass` is a no-op suite filler.

## `if` / `while` / `for`

```sere
if n == 1:
    n = n + 2
elif n == 0:
    pass
else:
    n = -n

while n < 4:
    n = n + 1

for n in range(0, 4):
    total += n
for item in xs:
    total += item
for ch in hello:
    pass
```

`for` iterates `range(...)`, `str` (one-character strings), and `list[T]`. A false compile-time host branch is **not typechecked**:

```sere
if __windows__:
    windows.message_box("hi")
```

That is how OS-only APIs stay off other targets. See [Modules](modules.md).

## `defer`

```sere
defer free(raw)
defer:
    print("done")
```

`defer` queues its body and runs it in **reverse order** on every `return`, including the implicit return at the end of the function. Use it for `free`, unlock, and “always log” — not as a substitute for `finally` on exceptions. Exception paths are `try` / `finally`.

## `del`

```sere
del xs[i]
del table[key]
```

Removes a list index or dict key. `del name` is a diagnostic. There is no unbind-a-local form.

## `with`

```sere
with Guard() as value:
    print(value)
```

One evaluated context object. The type must define `__enter__` and `__exit__`. `as value` binds the enter result.

## `match`

See [Pattern matching](matching.md). `match` is a statement. Arms are `case` suites, optionally with `if` guards.
