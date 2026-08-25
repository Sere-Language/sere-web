# Modules and imports

A file `util.sere` is module `util`. Imports are resolved, parsed, macro-expanded, and typechecked **before** the user module is checked. Export bindings become fields on the module object.

## Import forms

```sere
import util
import util as u
from util import double
from html_lang import html, Html
from math import sqrt
from string import *
```

Search order:

1. Directory of the importing file, and `libs/` next to it
2. Current working directory
3. The stdlib next to `sere` (or `SERE_STDLIB` in tests)

`util.sere` and `util.slib` both provide module `util`. `.sere` wins when both exist. A folder `util/` with `util/util.sere` or `util/lib.sere` is also `import util`. Native `.c` / `.lib` in that folder or `native/` are compiled and linked. The compiler extracts `.slib` files under `.sere-lib/` and links any native objects they contain.

`sere init` gives you `src/` and `libs/`. Publish reusable code with `sere init-lib` + `sere pack`. See [Libraries](libraries.md).

## Prelude

`stdlib/prelude.sere` is injected into every module and marked `fromPrelude()`. It is not re-emitted as user IR. Keep thinking of it as always-on names: `abs`, `min`, `max`, `clamp`, `sign`, `Int` / `Float`, and macros `dbg!`, `todo!`, `unreachable!`, `cfg!`.

## Module globals

Always in scope:

| Name | Meaning |
| --- | --- |
| `__name__` | `"__main__"` for the entry file, otherwise the module stem |
| `__file__` | Source path |
| `__package__` | Package string |
| `__doc__` | Leading docstring if present |
| `__debug__` | True in a debug-oriented build flag |
| `__sere_version__` | Compiler version string |

## Host flags

Compile-time bools. A **false** `if` branch is not typechecked, so you can call OS-only APIs inside the true arm.

| Flag | Meaning |
| --- | --- |
| `__windows__` `__linux__` `__macos__` `__unix__` | OS |
| `__x86_64__` `__arm64__` | Architecture |
| `__platform__` | `"windows"` / `"linux"` / `"macos"` |
| `__arch__` | `"x86_64"` / `"arm64"` / `"unknown"` |

```sere
if __windows__:
    windows.message_box("hi")
if cfg!(linux):
    pass
```

`cfg!(windows)` (and `linux`, `macos`, `unix`, `x86_64`, `arm64`, `debug`) is a prelude macro that expands to the matching dunder.

Failed C bindings typically return `""` / `0` / `False` rather than throwing. Gate them anyway.

## What imports are not

There is no unmodified foreign standard library. Use Sere modules (`requests`, `wsgi`, `fs`, …). An unknown module is `ImportError`.
