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
      "KWD": 157.80,
      "BHD": 128.60,
      "OMR": 126.00,
      "QAR": 13.30,
      "JOD": 68.40,
      "CHF": 55.20,
      "JPY": 0.31,
      "CAD": 35.40,
      "AUD": 32.10,
      "CNY": 6.70,
      "SEK": 4.60,
      "NOK": 4.50,
      "DKK": 7.00,
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
