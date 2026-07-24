import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    let goldPrice = null;
    let silverPrice = null;

    // محاولة الجلب من المصدر الأول
    try {
      const [resGold1, resSilver1] = await Promise.all([
        axios.get('https://api.gold-api.com/price/XAU', { timeout: 4000 }),
        axios.get('https://api.gold-api.com/price/XAG', { timeout: 4000 })
      ]);
      if (resGold1.data && resGold1.data.price) {
        goldPrice = Number(resGold1.data.price);
      }
      if (resSilver1.data && resSilver1.data.price) {
        silverPrice = Number(resSilver1.data.price);
      }
    } catch (e1) {}

    // محاولة الجلب من المصدر الثاني في حال تعذر المصدر الأول
    if (!goldPrice || !silverPrice) {
      try {
        const res2 = await axios.get('https://api.metals.live/v1/spot', { timeout: 3000 });
        if (res2.data && Array.isArray(res2.data)) {
          const g = res2.data.find(i => i.gold);
          const s = res2.data.find(i => i.silver);
          if (!goldPrice && g && g.gold) goldPrice = Number(g.gold);
          if (!silverPrice && s && s.silver) silverPrice = Number(s.silver);
        }
      } catch (e2) {}
    }

    // التحقق الصارم: إذا لم يتم العثور على الأسعار، إرجاع خطأ صريح بدون وضع أي قيمة افتراضية
    if (!goldPrice || isNaN(goldPrice) || !silverPrice || isNaN(silverPrice)) {
      return res.status(502).json({ 
        error: 'Failed to fetch valid metal prices from external APIs.' 
      });
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=60');
    return res.status(200).json({
      lastUpdated: new Date().toISOString(),
      goldOunceUSD: goldPrice,
      silverOunceUSD: silverPrice
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
}
