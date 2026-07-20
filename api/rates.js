let cache = null;
let lastUpdate = 0;
const TTL = 3600000;

export default async function handler(req, res) {
  const now = Date.now();

  if (cache && (now - lastUpdate < TTL)) {
    return res.status(200).json(cache);
  }

  try {
    const apiKey = '22950cdd66502e2bee322124';
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Upstream API request failed');
    }

    const data = await response.json();

    if (data.result !== 'success') {
      throw new Error('API returned unsuccessful result');
    }

    cache = data.conversion_rates;
    lastUpdate = now;

    return res.status(200).json(cache);

  } catch (error) {
    if (cache) {
      return res.status(200).json(cache);
    }
    return res.status(503).json({ error: 'Service Unavailable' });
  }
}
