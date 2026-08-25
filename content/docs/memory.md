# Memory and pointers

Sere exposes three pointer types and a pluggable collector. Sema owns the rules. Codegen lowers them to LLVM pointers with different drop / retain behavior.

## The three types

| Type | Meaning | Who frees it |
| --- | --- | --- |
| `Unique[T]` | Exclusive heap pointer | Dropped at end of scope |
| `Shared[T]` | Reference-counted heap pointer | Last retain drops |
| `Ptr[T]` | Raw pointer | You `free` |

```sere
owned: Unique[i32] = unique[i32](42)
*owned = 43
value: i32 = load(owned)

raw: Ptr[i32] = alloc[i32]()
store(raw, 7)
*raw = 8
free(raw)

local: i32 = 10
stack: Ptr[i32] = &local
*stack = *owned
```

| Form | Result |
| --- | --- |
| `unique[T](value)` | `Unique[T]` |
| `shared[T](value)` | `Shared[T]` |
| `alloc[T]()` | `Ptr[T]` |
| `load(p)` | `T` |
| `store(p, v)` | `void` |
| `free(p)` | `void` |
| `&x` | `Ptr[T]` for an addressable lvalue |
| `*p` | load `T`; `*p = v` stores |

Sema: `*p` requires a pointer-like type and types as `T`. `&x` requires an addressable lvalue. `*p = v` is assignment through a pointer, not `Star` as multiply.

## Drop vs free

`IRGenerator::emitDrops` inserts Unique drops at end of scope. You do not `free` a `Unique`. You **do** `free` a `Ptr` from `alloc`, unless a collector has taken ownership of that allocation.

`defer free(raw)` is the usual pairing for raw pointers. See [Statements](statements.md).

## Collectors

`alloc` / `free` go through the installed collector (`import gc`). Default name is `"none"`: tracked malloc; you free it.

```sere
import gc
gc.use("mark_sweep")   # or "arena"
p = alloc[i32]()
gc.add_root(p as Ptr[i8])
gc.collect()
```

Builtins: `none`, `mark_sweep`, `arena`. Arenas and pools for explicit regions: `import heap`.

Custom collector: implement `SereGcVTable` in C, call `sere_gc_install` from `sere_mod_init`, link with `--link`. Install **before** the program allocates.

```powershell
sere main.sere --link my_gc.lib
```

Headers: `include/sere/api/sere_gc.h`.

## Mental model

- `Unique` — this function owns the box; leaving the scope ends it.
- `Shared` — several names can hold the box; the last one ends it.
- `Ptr` — an address. The collector or you decide the lifetime. `&local` is not heap.

Do not treat `Ptr` as a safe `Unique`. The type checker will not save you from a dangling stack address.
