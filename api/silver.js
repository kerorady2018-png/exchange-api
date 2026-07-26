let cachedData = null;
let lastFetchTime = 0;
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 دقيقة

module.exports = async (req, res) => {
  const nowTime = Date.now();

  // التخزين المؤقت على السيرفر لتوفير الطلبات للفضة
  if (cachedData && (nowTime - lastFetchTime < UPDATE_INTERVAL)) {
    return res.status(200).json({
      source: 'server-cache',
      data: cachedData
    });
  }

  try {
    const response = await fetch('https://api.gold-api.com/price/XAG');
    const json = await response.json();

    cachedData = json;
    lastFetchTime = nowTime;

    return res.status(200).json({
      source: 'live-api',
      data: cachedData
    });
  } catch (error) {
    if (cachedData) {
      return res.status(200).json({
        source: 'fallback-cache',
        data: cachedData
      });
    }
    return res.status(500).json({ error: 'Failed to fetch silver price' });
  }
};
