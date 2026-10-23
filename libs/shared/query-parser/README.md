# query-parser

The query language of Explore (`/explore`), shared by the backend and the frontend. The full
language is described in [docs/api-contract.md](../../../docs/api-contract.md#explore-logs).

```
{company="KX", level=~"achievement|milestone"} |= "angular" != "legacy"
```

- `parseQuery(text)`: reads a query, or throws a `QueryParseError` with a 1-based `column`.
  Regular expressions use RE2 syntax and run with `re2js`, in linear time, since visitors' queries run
  on the server. Never run query input through `RegExp`.
- `compileQuery(query)`: a test for one record (`labels`, `tech`, `line`). Comparisons ignore case.
- `suggest(text, cursor, labels)` / `applySuggestion(...)`: autocomplete for label names and values.
- `withLabelMatcher(text, label, value, op)`: narrows a query, for "filter for this value".
- `formatQuery(query)`: prints a query in its canonical form.

Run the tests with `npx nx test query-parser`.
