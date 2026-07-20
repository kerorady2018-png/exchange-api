let cache = null;
let lastUpdate = 0;
const TTL = 3600000;

export default async function handler(req, res) {
  const now = Date.now();

  if (cache && (now - lastUpdate < TTL)) {
    return res.status(200).json(cache);
  }

  try {
    const url = 'ضع_رابط_المصدر_الجديد_هنا';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Upstream API request failed');
    }

    const data = await response.json();

    cache = data.conversion_rates || data.rates || data;
    lastUpdate = now;

    return res.status(200).json(cache);

  } catch (error) {
    if (cache) {
      return res.status(200).json(cache);
    }
    return res.status(503).json({ error: 'Service Unavailable' });
  }
}
