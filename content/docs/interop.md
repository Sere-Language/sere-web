# Native interop

Three different ways a name becomes callable:

| Kind | How it exists | Example |
| --- | --- | --- |
| **Intrinsic** | `IntrinsicKind` + type checker + `emitIntrinsic` | `unique`, `alloc`, `len`, `print` |
| **Prelude / stdlib Sere** | Parsed from `stdlib/*.sere`, often `extern "C" "symbol"` | `io.read_line`, `gc.use` |
| **User / native** | `def` in the program, or `extern "C"` + `--link` | `examples/native_add.sere` |

Intrinsics are always in scope. They are names the type checker and codegen special-case, not magic syntax. Prefer a stdlib `extern "C"` wrapper when the operation is just a runtime call.

## Typed C functions

```sere
extern "C" "sere_gc_collect"
def collect() -> void
```

The string is the link symbol. The `def` has no body. Codegen emits a direct call.

```powershell
sere src\main.sere --link libs\native.lib -o bin\app.exe
```

Packed `.slib` files and folder libraries (`mylib/lib.sere` plus `mylib/*.c` or `mylib/native/`) compile and link their C automatically. Prefer packing the compiled `.lib` / `.a` into the `.slib` so consumers stay on one file. See [Libraries](libraries.md).

## Module init

Optional: define `void sere_mod_init(void)` in C. The runtime provides an empty default. A strong definition from `--link` overrides it. `sere_mod_init` runs from generated `main` **before** Sere globals.

Headers: `include/sere/api/sere_mod.h`, `sere_gc.h`.

## Boxed native modules

The heavier API registers functions that take `Sere_Object*`:

```c
static Sere_Object* add(Sere_Object* const* args, int32_t nargs) { ... }

extern "C" void sere_mod_init(void) {
  Sere_DefineFunction("add", add, 2);
}
```

Use this when you need a dynamic export table. For a fixed typed signature, `extern "C" "symbol"` is the simpler path.

## Linking facts

`compileInput` writes a temp `.ll`, then invokes the pinned `clang` with `lld` (`-fuse-ld=lld`) and `sere_rt`. Extra native libs come from `--link`. Importing `qt6` also pulls `sere_qt6` when that library was built.

Users compiling Sere programs do **not** need `scripts/env.ps1`. That script is only for building the compiler itself.

On Windows the runtime also links `user32`, `gdi32`, `opengl32`, `shell32`, `advapi32`.

## Custom GC

Implement `SereGcVTable`, call `sere_gc_install` from `sere_mod_init`, link with `--link`. Install before the program allocates. See [Memory](memory.md).
