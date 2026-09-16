# Project verification

- Application entry: root `App.js` forwards to `src/App.js`; active mobile code lives under `src/`.
- Startup regression suite: `npm test -- --runInBand --coverage=false --runTestsByPath __tests__/RatesStartup.test.js __tests__/StaticDataRegression.test.js __tests__/StartupUI.test.js`.
- Existing older tests import removed root-level `services/`, `screens/`, and `hooks/` paths. A full `npm test` currently fails before those suites execute; do not report these suites as passing.
- Android JavaScript/Hermes bundle check: `npx --no-install expo export --platform android --output-dir dist/startup-check --max-workers 2`. Set `CI=1` and `EXPO_NO_DOTENV=1` in the command environment. This is not a signed APK build or a physical-device test.
- This workspace uses Windows PowerShell: use separate commands or `; if ($?) { ... }`, not `&&`.
- Price readers share the validated raw snapshot in `src/api/apiConfig.js`. Preserve single-flight fetching, the 30-minute successful-fetch TTL, and source timestamps. Do not mark network failures or fabricated fallback values as current prices.
- Multi-source verification adds `__tests__/BanqueMisrSources.test.js`, `__tests__/DataFetcher.test.js`, and `__tests__/DataEndpoints.test.js` to the startup regression command above. Network responses and filesystem writes are mocked in these suites.
- `scripts/banque-misr.cjs` fetches official Banque Misr, 3omlla, and Banklive concurrently. These are alternative publishers of one bank's quotes, not three independent bank inputs to the blended rate. Official cash quotes have priority; transfer-only quotes are labeled, and official 100-JPY quotes are normalized per yen.
- `node scripts/data-fetcher.cjs` performs live requests and updates `public/data/rates.json` and `metadata.json`. The scheduled GitHub Actions workflow is the writer; `/api/banquemisr` only reads that snapshot, and the former public `/api/update-data` trigger returns 410. Vercel must deploy the updated data commits for users to receive them.
- Quotes retain their original timestamps during fallback and expire after seven days. Unknown publisher timestamps remain null; `fetchedAt` records retrieval, not the bank's publication time. A snapshot whose `checkedAt` is over an hour old is flagged stale by the app.
- Source checks on 2026-09-08 returned 19 official, 12 3omlla, and 14 Banklive currency quotes. The configured CBE proxy still returned 404 and remains an optional unavailable source; do not describe the CBE feed as repaired.
