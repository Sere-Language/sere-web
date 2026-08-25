# Standard library

`stdlib/` is ordinary Sere. The compiler injects `prelude.sere` into every program. Everything else is opt-in.

```sere
import io
import gc
from math import sqrt
```

Search path: directory of the importing file, then the stdlib next to `sere` (or `SERE_STDLIB` in tests).

## Prelude

Always loaded, marked `fromPrelude()`. Keep it small in your head: names everyone needs, plus macros such as `dbg!`.

Injected surface:

- `abs`, `min`, `max`, `clamp`, `sign`
- `Int` / `Float` union aliases
- macros `dbg!` `todo!` `unreachable!` `cfg!`

`print` is both a prelude-friendly name and a compiler intrinsic. Do not reimplement I/O in Sere when the intrinsic already exists.

Memory vocabulary is documented in `stdlib/memory.sere` (comments). The pointer types themselves are compiler generics.

## Modules

| Module | Role |
| --- | --- |
| `io` | `read_line`, `eprint` |
| `fs` `path` `os` `env` `sys` | Files, paths, process, host |
| `string` `bytes` `encoding` `regex` | Text and binary |
| `math` `vec` `matrix` `ml` `arrays` | Numeric / linear algebra |
| `hash` `random` `time` `log` `bit` | Utilities |
| `gc` `heap` `memory` | Collectors, arenas (memory is documentation) |
| `inspect` | Extra labels (`label`, `describe`) — not the builtin `typeof` / `dir` |
| `util` | Tiny helpers (`double`); used by import examples |
| `html_lang` | `html:` raw macro + `Html` |
| `windows` | Win32 message box, beep, clipboard (stub off Windows) |
| `gl` | OpenGL 2.1+ (WGL window, shaders, VBO/VAO, textures, FBO, input) |
| `qt6` | Qt 6 widgets; linked automatically if the compiler was built with Qt |
| `requests` | HTTP client (`get` / `post` / `put` / `delete`) |
| `wsgi` | Blocking HTTP server; subclass `Handler` and implement `handle` |

Failed C bindings typically return `""` / `0` / `False` rather than throwing. Gate OS-only code with `if __windows__:`.

## How a C-backed module is wired

1. Add the C function to `runtime/` and declare it in `sere_rt.h` (or the matching public header).
2. Rebuild `sere_rt`.
3. Declare `extern "C"` in `stdlib/yourmod.sere`.
4. Add `examples/…` and a test that `--emit-llvm`s it.

Optional heavy deps (Qt6) are behind CMake `find_package`. When Qt is missing, `sere_qt6_stub.c` still links so `import qt6` typechecks; runtime calls fail closed.

## Project vs distribution

`sere init` creates `src/` and `libs/`. Publish reusable code with `sere init-lib` + `sere pack` as a single `.slib` (reachable sources plus compiled native objects). Drop that file into a project's `libs/` and `import` it. A folder `libs/mylib/` with `lib.sere` or `mylib.sere` (and optional C sources) is the same import without packing. Loose `.sere` files on the import path still work. Neither belongs in `stdlib/` unless it ships with the language.

See [Libraries](libraries.md).
