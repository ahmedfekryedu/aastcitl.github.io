# Repair verification

Run `npm install --prefix tests`, then `npx --prefix tests playwright install chromium`.

From the project root run:

```
node tests/runtime.cjs
node tests/browser.cjs
```

Browser tests use the actual bundled Supabase JavaScript SDK, with synthetic HTTP responses. All external requests are intercepted or blocked, and writes are blocked. New database functions missing from the user's deployment deliberately return `PGRST202`; the repaired pages must not depend on them. No production credentials or user sessions are used.

`results/baseline.json` documents failures observed before these fixes. `results/browser.json` documents the final tests. Tests cover data, real UI clicks, posters, missing external email SDK, transient errors, original TV display, and the original today-only exam page. This does not claim validation of every authenticated role, live data, or every administrative operation.
