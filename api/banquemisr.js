const fs = require('fs');
const path = require('path');

export default async function handler(req, res) {
  res.setHeader('Allow', 'GET');
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  try {
    const snapshot = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/rates.json'), 'utf8'));
    const currencies = snapshot.currencies || {};
    const now = Date.now();
    const rates = {};
    for (const [code, quote] of Object.entries(currencies.banqueMisrRates || {})) {
      if (!/^[A-Z]{3}$/.test(code) || !quote || !['official', '3omlla', 'banklive'].includes(quote.source) ||
          !Number.isFinite(quote.buy) || !Number.isFinite(quote.sell) || quote.buy <= 0 || quote.sell < quote.buy) continue;
      const times = [quote.fetchedAt, quote.sourceUpdatedAt || quote.fetchedAt].map(time => Date.parse(time));
      if (times.some(time => !Number.isFinite(time) || time > now || now - time > 7 * 24 * 60 * 60 * 1000)) continue;
      rates[code] = { ...quote, stale: quote.stale === true || now - times[0] > 60 * 60 * 1000 };
    }
    const quotes = Object.values(rates);
    const status = !quotes.length ? 'unavailable' : quotes.every(quote => quote.stale) ? 'stale' :
      quotes.some(quote => quote.stale) || currencies.banqueMisrStatus !== 'ok' ? 'partial' : 'ok';
    return res.status(quotes.length ? 200 : 503).json({
      success: quotes.length > 0,
      rates,
      status,
      sources: currencies.banqueMisrSources || {},
      checkedAt: currencies.checkedAt || null
    });
  } catch {
    return res.status(503).json({ success: false, rates: {}, status: 'unavailable', error: 'Bank snapshot unavailable' });
  }
}
