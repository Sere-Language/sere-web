# Libraries

Sere libraries are drop-in modules. There is no registry and no package manager yet — you create a library, pack it (or leave it as a folder), and copy it into another project's `libs/`.

`util.sere` and `util.slib` both provide module `util`. A folder named `util` with `util/util.sere` or `util/lib.sere` is also `import util`.

## Create and pack

```powershell
sere init-lib mathlib
cd mathlib
sere pack
copy dist\mathlib.slib ..\myapp\libs\
```

`sere --init-lib mathlib` and `sere init mathlib --lib` do the same as `init-lib`. A `kind = "lib"` project writes the `.slib` on `sere build` as well.

Pack a single file without a project:

```powershell
sere pack file.sere -o mathlib.slib
```

The archive contains **only** the entry, the local modules it actually imports, and compiled native objects. Unused files next to the library are not packed.

## Consume

```sere
import mathlib

def main() -> i32:
    return mathlib.add(2, 3)
```

Drop `mathlib.slib` (or a folder library) into `libs/`. The language server uses the same search path, so completions and hover work like ordinary modules.

If both `mathlib.sere` and `mathlib.slib` exist, **`.sere` wins**.

## Folder libraries

If you prefer not to pack:

```
libs/mylib/lib.sere
libs/mylib/extra.sere
libs/mylib/native/*.c
```

or `mylib.sere` plus loose `.c` / `.cpp` next to the folder. Native sources under `libs/native` (when `native = true`) or in the library folder are compiled and stored in the `.slib` when you pack.

The compiler extracts `.slib` files next to themselves under `.sere-lib/` and links any native objects they contain. Prefer packing the compiled `.lib` / `.a` into the `.slib` so consumers stay on one file.

## Search order

1. Directory of the importing file, and `libs/` next to it
2. Current working directory
3. The stdlib next to `sere` (or `SERE_STDLIB` in tests)

See [Modules](modules.md) for import syntax and host flags. A registry / install-from-name flow is not part of the language yet.

## What does not belong here

The compiler `stdlib/` is the language distribution. User libraries go in a project `libs/` folder, not into `stdlib/` unless they ship with Sere.
