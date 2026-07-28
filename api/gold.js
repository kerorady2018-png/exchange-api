let cachedData = null;
let lastFetchTime = 0;
const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 دقيقة

module.exports = async (req, res) => {
  // السماح بالوصول من أي مصدر (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // تفعيل التخزين المؤقت على حافة الشبكة لمدة 15 دقيقة (900 ثانية) للمعادن والذهب
  res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=300');

  const nowTime = Date.now();

  // إذا لم تنقضِ الـ 15 دقيقة، أرسل البيانات المخزنة فوراً لجميع المستخدمين لتوفير الطلبات
  if (cachedData && (nowTime - lastFetchTime < UPDATE_INTERVAL)) {
    return res.status(200).json({
      source: 'server-cache',
      data: cachedData
    });
  }

  try {
    // إذا انتهت الـ 15 دقيقة، اجلب السعر من المصدر الخارجي مرة واحدة فقط
    const response = await fetch('https://api.gold-api.com/price/XAU');
    const json = await response.json();

    cachedData = json;
    lastFetchTime = nowTime;

    return res.status(200).json({
      source: 'live-api',
      data: cachedData
    });
  } catch (error) {
    // في حال انقطاع الإنترنت الخارجي، أرسل آخر بيانات ناجحة مخزنة
    if (cachedData) {
      return res.status(200).json({
        source: 'fallback-cache',
        data: cachedData
      });
    }
    return res.status(500).json({ error: 'Failed to fetch gold price' });
  }
};
