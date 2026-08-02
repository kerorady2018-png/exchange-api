let cachedData = null;
let lastFetchTime = 0;
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 دقيقة

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');

  const nowTime = Date.now();

  if (cachedData && (nowTime - lastFetchTime < UPDATE_INTERVAL)) {
    return res.status(200).json({
      source: 'server-cache',
      data: cachedData
    });
  }

  try {
    const response = await fetch('https://api.gold-api.com/price/XAU');
    
    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const json = await response.json();

    cachedData = json;
    lastFetchTime = nowTime;

    return res.status(200).json({
      source: 'live-api',
      data: cachedData
    });
  } catch (error) {
    // إذا توفر كاش قديم، استخدمه لتجنب الانقطاع
    if (cachedData) {
      return res.status(200).json({
        source: 'fallback-cache',
        data: cachedData
      });
    }
    
    // منع انهيار السيرفر وإعطاء 500 نهائياً، وإرجاع استجابة نجاح آمنة
    return res.status(200).json({
      source: 'safe-fallback',
      data: {
        price: 0,
        symbol: "XAU",
        error: "Temporary external source unavailable"
      }
    });
  }
}
