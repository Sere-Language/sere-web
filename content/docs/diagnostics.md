# Diagnostics

The compiler does not use C++ exceptions for user errors. `DiagnosticEngine` collects `error` / `warn` / `note` with a `DiagnosticCode`. Messages print as `error[NameError]: …`.

`--analyze` runs the frontend only and prints JSON. The LSP uses the same path for `textDocument/publishDiagnostics`. It never touches LLVM.

## Codes

| Exception | Typical cause |
| --- | --- |
| `SyntaxError` | Parse |
| `IndentationError` | Mixed or inconsistent indent |
| `NameError` | Unknown name, type, function, macro, module |
| `AttributeError` | Unknown field or method |
| `TypeError` | Wrong type, operand, or argument |
| `IndexError` | Bad index or slice |
| `ImportError` | Missing module or prelude |
| `ValueError` | Invalid or uninferable value |
| `AssertionError` | Bad `assert` |
| `PermissionError` | Private field |
| `RuntimeError` | Control-flow / compiler internal |
| `RecursionError` | Macro expansion limit |
| `NotImplementedError` | Unsupported or leftover construct |

These names match the runtime exception classes. An unknown name in `# type[Bogus]: ignore` is itself `ValueError` and lists this catalog.

## Suppression

`IgnoreDirective` parses comments:

```sere
# type[NameError]: ignore          # whole file if at the top
def main() -> i32:
    n: i32 = "nope"                # TypeError still reported
    return missing                 # NameError ignored (file rule)

    return missing  # type: ignore              # this line
    # type: ignore
    return missing                              # next statement
```

- `# type[Exception]: ignore` hides every diagnostic in scope
- `# type: ignore[NameError]` is accepted
- A comment-only `# type: ignore` on the previous line applies to the next statement

Use this for generated code and known holes. Do not use it to hide a `TypeError` you have not looked at.

## Incomplete lowering

If a construct parses but lowering is incomplete, you get `NotImplementedError` rather than silent wrong code. That is a compiler bug surface, not a language feature. File it.

Reserved / out of scope (they diagnose):

- `*args` / `**kwargs`, keyword-only parameters, `global` / `nonlocal`
- Nested `def`, `async` / `await`, `yield`
- Lambda capture of enclosing locals
- `del name`
- `print x` as a statement (`print` is a call)
