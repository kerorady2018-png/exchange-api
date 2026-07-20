let cache = null;
let lastUpdate = 0;
const TTL = 3600000;

export default async function handler(req, res) {
  const now = Date.now();

  if (cache && (now - lastUpdate < TTL)) {
    return res.status(200).json(cache);
  }

  try {
    cache = {
      "USD": 48.50,
      "EUR": 52.10,
      "GBP": 60.20,
      "SAR": 12.90,
      "AED": 13.20,
      "EGP": 1
    };
    
    lastUpdate = now;

    return res.status(200).json(cache);

  } catch (error) {
    if (cache) {
      return res.status(200).json(cache);
    }
    
    return res.status(503).json({ error: 'Service Unavailable' });
  }
}
