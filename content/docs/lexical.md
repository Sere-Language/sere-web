# Lexical structure

The lexer scans a `SourceManager` into a flat token stream, then inserts `Indent`, `Dedent`, and `Newline`. Multi-character operators are recognized in the lexer. Unary `*` and `&` reuse `Star` / `Amp`; the parser decides prefix vs binary.

## Comments

`#` to end of line. `# type: ignore` and `# type[NameError]: ignore` are not ordinary comments — [Diagnostics](diagnostics.md) parses them as ignore directives.

## Names

Identifiers: ASCII letters, digits, and `_`. Keywords are reserved and form a contiguous `TokenKind` range (`KeywordFalse` through `KeywordWith`) so semantic highlighting can treat them as one block.

## Keywords

```
False  None  True
and  as  assert  break  case  class  const  continue
def  defer  del  elif  else  enum  except  extern  finally
for  from  if  import  in  is  lambda  macro  match
not  or  pass  raise  return  static  struct  super
try  type  while  with
```

`const` binds a readonly name. `lambda` is an anonymous function. `with` requires `__enter__` / `__exit__` on the context type. `quote`, `syntax`, `interpolate`, `wrapper`, and `typed` appear in macro definitions.

## Literals

| Kind | Forms |
| --- | --- |
| Integer | `42`, `0xFF`, `0b1010`, `0o755`, `1_000` |
| Float | `1.0`, `3e2`, `1.0f` (`_` allowed) |
| Bool | `True`, `False` |
| None | `None` — a named `void` |
| String | `"..."`, `'...'`, `"""..."""` |
| F-string | `f"hi {x}"` with `{expr}` holes |
| Regex | backtick `` `\d+` ``, type `regex` |

Hex / bin / oct prefixes accept `0x` / `0X`, `0b` / `0B`, `0o` / `0O`.

## Operators

| Group | Tokens |
| --- | --- |
| Arithmetic | `+ - * / // % **` |
| Bitwise | `& \| ^ ~ << >>` |
| Comparison | `== != < <= > >=` `is` `in` |
| Boolean | `and` `or` `not` |
| Assignment | `=` `+=` `-=` `*=` `/=` `//=` `%=` `**=` `&=` `\|=` `^=` `<<=` `>>=` |
| Inc / dec | `++n` `n++` `--n` `n--` |
| Pointers | `&x` `*p` |
| Cast | `value as T` |
| Call / index | `f(x)` `xs[i]` `xs[a:b]` |
| Walrus | `name := expr` |
| Other | `.` `,` `:` `->` `=>` `!` `$` `@` `...` |

`/` is true division. `//` is floor division. `|` is both bitwise or and the union constructor in type position.
