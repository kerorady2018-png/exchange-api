export default async function handler(req, res) {
  try {
    // يمكنك هنا جلب الأسعار المحدثة أو إرجاع الهيكل المطلوب
    const metalsData = {
      lastUpdated: new Date().toISOString(),
      gold: {
        karat24: { buy: 0, sell: 0 },
        karat21: { buy: 0, sell: 0 },
        karat18: { buy: 0, sell: 0 },
      },
      silver: { 
        buy: 0, 
        sell: 0 
      }
    };

    // السماح بالوصول من أي مصدر (CORS) وتخزين مؤقت لمدة 15 دقيقة (900 ثانية) على سيرفرات Vercel
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=60');
    
    return res.status(200).json(metalsData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch metals data' });
  }
}
