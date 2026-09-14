# Sere vs Python

Sere and Python share a surface syntax — indentation instead of braces, `def` for functions, f-strings, `class` and `struct` records — but they sit at opposite ends of the execution model. Python is an interpreted, dynamically typed language that runs on a bytecode virtual machine. Sere is an ahead-of-time compiled, statically typed language that lowers your source to LLVM 22 IR and then to native machine code, producing a standalone executable with no interpreter, virtual machine, or bundled runtime. If you know Python, you already know most of how Sere looks; what changes is when errors surface, how types are checked, and what you ship.

## The short answer

- **Choose Sere** when you want the readability of Python and the deployment story of C: a single native binary, compile-time type checks, explicit control over memory, and no runtime to install on the target machine.
- **Choose Python** when you need the ecosystem — NumPy, PyTorch, Django, pandas — or when you are writing short scripts where iteration speed matters more than runtime characteristics.
- **The syntax transfers.** Moving from Python to Sere is mostly a matter of adding type annotations, replacing dynamic patterns with generics, and learning Sere's pointer vocabulary.

## Side-by-side comparison

| Dimension | Sere | Python |
| --- | --- | --- |
| Execution model | Ahead-of-time compiled to native machine code | Interpreted; CPython executes bytecode on a VM |
| Backend | LLVM 22 | CPython bytecode, or a JIT in alternative runtimes |
| Type system | Static, checked at compile time | Dynamic, checked at runtime; optional annotations |
| Distribution | One standalone native binary | Requires a Python interpreter on the target |
| Runtime dependency | None | A Python installation of a compatible version |
| Indentation-significant | Yes | Yes |
| Integer types | Sized: `i8`, `i16`, `i32`, `i64`, `u8`–`u64` | A single arbitrary-precision `int` |
| Float types | `f32`, `f64` (IEEE) | `float` (double precision) |
| Strings | `str`, plus `bytes` / `encoding` modules | `str`, `bytes` |
| Collections | `list[T]`, `dict[K, V]`, `array`, slices | `list`, `dict`, `set`, `tuple` |
| Generics | `list[T]`, `dict[K, V]`, generic `def` and `class` | Native syntax since 3.12; `typing` before that |
| Memory model | `Unique[T]` drops at scope end, `Shared[T]` is reference-counted, `Ptr[T]` is manual; the collector is pluggable | Reference counting plus a cycle collector, always on |
| Garbage collection | Optional — bring mark-sweep, an arena, or write your own | Always enabled, not removable |
| Macros | First-class: `macro` declarations, quoted bodies, hygienic `name!(...)` expansion | No macro system; metaclasses and decorators instead |
| Pattern matching | `match` / `case` with guards | `match` / `case` since 3.10 |
| Error handling | `try` / `except` / `else` / `finally`, hierarchy rooted at `Exception` | Same shape, `Exception`-rooted |
| Deferred cleanup | `defer` and `with` | `with` and `try` / `finally` |
| C interop | `extern "C"` and `--link`; native C compiles into the same binary | C extensions, `ctypes`, `cffi` |
| Editor tooling | Language server built into the toolchain (`sere --lsp`) plus a VS Code / Cursor extension | Pylance, Pyright, Jedi — separate projects |
| Static analysis | `sere --analyze file.sere` emits JSON diagnostics | Third-party linters and type checkers |
| Packaging | A `.slib` file dropped into `libs/`; no registry or package manager yet | PyPI and pip, with a vast index |
| Ecosystem size | Early; the standard library ships with the compiler | Very large and mature |
| License | Free and open source | PSF license |

## Syntax comparison

The same program in both languages. Sere's version declares types, so the compiler can verify every field access and arithmetic operation before the program ever runs.

**Sere** — `main.sere`

```sere
struct Point:
    x: i32
    y: i32

    def length_sq(self) -> i32:
        return self.x * self.x + self.y * self.y

def main() -> i32:
    p = Point(3, 4)
    print(f"sere {p.length_sq()}")
    return 0
```

**Python** — `main.py`

```python
class Point:
    def __init__(self, x: int, y: int) -> None:
        self.x = x
        self.y = y

    def length_sq(self) -> int:
        return self.x * self.x + self.y * self.y


def main() -> int:
    p = Point(3, 4)
    print(f"sere {p.length_sq()}")
    return 0
```

The hello-world case is just as small:

```sere
def main() -> i32:
    print("hello, sere")
    return 0
```

```powershell
sere build main.sere
.\main.exe
```

There is no `python main.py` step, because there is no interpreter to invoke. `sere build` produces `main.exe`, and that file is the entire deliverable.

## What Sere borrows from Python

- **Indentation as structure.** Blocks are indentation-significant, and `#` starts a comment, exactly as in Python.
- **Familiar declarations.** `def`, `class`, `struct`, `enum`, `type` aliases, and decorators written with `@name`.
- **f-strings.** `f"..."` and triple-quoted variants both exist, and interpolate expressions.
- **A prelude that is always in scope.** `print`, `abs`, `min`, `max`, `len`-style helpers, and `dbg!` are injected into every program without an import — the same design that makes Python feel immediate.
- **Dunder conventions.** `__name__`, `__type__`, `__module__`, and `__qualname__` behave the way a Python reader expects.
- **Comprehensions, the walrus operator, and `range`.** Expressive one-liners carry over unchanged.
- **`match` / `case`.** Structural pattern matching with guards, mirroring Python 3.10 and later.
- **`try` / `except` / `finally`.** Exceptions are values in a class hierarchy rooted at `Exception`.

## Where Sere diverges

- **Types are mandatory, not advisory.** Sere is statically typed. An omitted annotation becomes `Any`, which is the top type — but the moment you name a type, the compiler enforces it across every call site. Python's annotations are not enforced at runtime.
- **Integers have widths.** Sere gives you `i8` through `i64` and `u8` through `u64`, so you choose the representation and pay for exactly that. Python's `int` is arbitrary precision.
- **Memory is explicit.** Sere exposes three pointer types — `Unique[T]` for exclusive ownership dropped at end of scope, `Shared[T]` for reference counting, and `Ptr[T]` for raw manual `alloc` / `free` — and the collector is pluggable. You can run without a garbage collector, or link one in with `--link my_gc.lib`.
- **Compile-time introspection.** `sizeof[i32]()` and `alignof[i32]()` are compile-time facts about the lowered type, and host flags like `__windows__`, `__x86_64__`, and `__platform__` are resolved during semantic analysis. False branches are skipped entirely.
- **Macros are part of the language.** `macro` bodies support quoting, matching, and raw emission, and expand hygienically. Python has no comparable facility.
- **Unsupported constructs fail loudly.** Anything the compiler does not implement raises a diagnostic such as `NotImplementedError` rather than generating silently wrong code.
- **No package registry.** Libraries are `.slib` files copied into a project's `libs/` directory. There is no `pip install` equivalent yet.

## When to choose Sere

- You want a CLI tool, a web backend, or a systems component that ships as one file with no runtime prerequisite.
- You care about predictable memory behaviour — arenas, reference counting, or a custom collector — and want to choose per project.
- You are writing C interop and would rather the language handle the ABI boundary explicitly.
- You like Python's ergonomics but not its runtime characteristics.

## When to choose Python

- You depend on the scientific, data, or web framework ecosystem.
- You are prototyping and want the fastest possible edit-run loop.
- You are gluing together existing services and runtime speed is not the constraint.
- You need a mature package index with decades of accumulated libraries.

## Frequently asked questions

### Is Sere a Python dialect?

No. Sere is an independent, statically typed, compiled language. It borrows Python's surface syntax — indentation, `def`, f-strings, dunders — so that Python developers can read it immediately, but it has its own compiler, type system, standard library, and runtime model. Python code is not valid Sere, and Sere is not implemented on top of CPython.

### Does Sere run Python code?

No. Sere compiles `.sere` source to native machine code through LLVM. There is no Python interpreter embedded in the toolchain and no Python compatibility mode.

### Does Sere need a runtime or virtual machine?

No. `sere build` produces a standalone native binary. There is no interpreter, virtual machine, or runtime to bundle with your program or install on the target machine.

### Is Sere garbage collected?

Not by default, and not necessarily at all. Sere gives you `Unique[T]`, which is dropped at the end of its scope, and `Shared[T]`, which is reference-counted. When you need automatic collection you link one in, and the design is pluggable — mark-sweep, arena allocation, or a collector you write yourself. That is a different stance from Python, where garbage collection is always on and not removable.

### How do I install Sere?

Download the Windows installer or a release archive from the [install guide](/install), then put the compiler on your `PATH`. The `sere` command then gives you `init`, `build`, `run`, `pack`, `--analyze`, `--lsp`, `--emit-llvm`, and `--emit-asm`.

### Does Sere have editor support?

Yes. The compiler ships a language server invoked with `sere --lsp`, and a VS Code extension that also works in Cursor. It provides highlighting, go-to-definition, hover, and rename, reading from the same semantic analysis pipeline the compiler uses.

## Naming note

Sere is also written `sere-lang` and `Sere language`. This page describes the Sere **programming language** and its compiler. It is unrelated to U.S. military SERE (Survival, Evasion, Resistance, and Escape) training, to seral stages in ecology, or to any other entity that shares the name.

## Keep reading

- [Introduction](/docs) — what Sere is and how the documentation is organised
- [Types](/docs/types) — primitives, pointers, unions, collections
- [Memory and pointers](/docs/memory) — `Unique`, `Shared`, `Ptr`, and collectors
- [Macros](/docs/macros) — quoting, matching, and hygiene
- [The standard library](/docs/stdlib) — the prelude and opt-in modules
- [Install Sere](/install) — downloads and the build-from-source requirements
