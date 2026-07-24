export default async function handler(req, res) {
  try {
    // يمكنك هنا جلب الأسعار الحقيقية من مصدر أو وضع هيكل البيانات المؤقت
    const metalsData = {
      lastUpdated: new Date().toISOString(),
      gold: {
        karat24: { buy: 0, sell: 0 },
        karat21: { buy: 0, sell: 0 },
        karat18: { buy: 0, sell: 0 },
      },
      silver: { buy: 0, sell: 0 }
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate'); // تحديث كل 15 دقيقة (900 ثانية)
    return res.status(200).json(metalsData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch metals data' });
  }
}
