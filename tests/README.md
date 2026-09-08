# Reproducible checks

Run from the project root:

```sh
python3 scripts/validate.py
node tests/runtime.cjs
npm install --prefix tests
node tests/database.mjs
npx --prefix tests playwright install chromium
node tests/browser.cjs
```

Use a current Node version with ESM support. `CITL_CHROMIUM_PATH` may point to an already installed Chromium for the browser test. These development dependencies are not required for the static site.

`database.mjs` creates an in-memory PGlite PostgreSQL instance, loads **synthetic** schema-fixture.sql, and applies SUPABASE-REPAIR.sql twice before exercising business operations. It does not connect to any Supabase host. The fixture is not a full production schema. QR scenarios use the current Cairo clock and expect test slots to fit within the same day; rerun daytime if a midnight boundary affects the test fixture.

`browser.cjs` serves files on localhost, blocks external network calls and replaces Supabase with fixtures. It asserts TV retention on failure, all exam rows across pages, 90-degree rotation, ticker escaping/speed and page smoke checks. It does not validate real Auth, Realtime, email or Storage integration. The clock is fixed for predictable TV status.

`results/` contains the delivered run evidence. The browser fixture's intercepted /today/ visit insert is intentional and is never sent to production. Screenshots are not required for these assertions; external fonts/icons may be blocked during this isolated test.

Do not execute schema-fixture.sql in Supabase. Do not treat passing synthetic tests as approval to reset or overwrite a real database.
