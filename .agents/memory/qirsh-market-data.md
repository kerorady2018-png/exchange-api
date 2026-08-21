---
name: Qirsh market data architecture
description: How the API server fetches live currency + gold/silver data for the Qirsh FinTech app
---

## Rule
Use the fawazahmed0 free CDN currency API for **both** fiat currencies and precious metals.
`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/egp.json`
returns `egp.xau` (gold, troy oz) and `egp.xag` (silver, troy oz) alongside all fiat codes.

**Why:** The `metals.live` API fails with SSL TLS SNI error in the Replit container environment.
The fawazahmed0 CDN works perfectly and covers all currencies + metals in one call.

**How to apply:**
- `egpRates["xau"]` = how many troy oz per 1 EGP → invert and divide by 31.1035 for EGP/gram
- `egpRates["usd"]` = how many USD per 1 EGP → invert for EGP/USD mid rate
- All currencies and metals from one fetch; has CDN fallback at `latest.currency-api.pages.dev`

## Key values (as of session, June 2026)
- USD/EGP mid ≈ 51.78
- Gold 24K ≈ 7,500 EGP/gram (live from XAU ISO code)
- Refresh interval: 30 minutes via `setInterval` in `src/index.ts`
