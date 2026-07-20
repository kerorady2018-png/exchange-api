import * as cheerio from 'cheerio';

let cache = null;
let lastUpdate = 0;
const TTL = 3600000; // تخزين مؤقت لمدة ساعة كاملة

export default async function handler(req, res) {
  const now = Date.now();

  // إذا كانت البيانات مخزنة ولم ينتهِ الوقت، أرسلها فوراً لتسريع التطبيق
  if (cache && (now - lastUpdate < TTL)) {
    return res.status(200).json(cache);
  }

  try {
    const url = 'https://www.banquemisr.com/Home/CAPITAL%20MARKETS/Exchange%20rates%20and%20currencies?sc_lang=ar-EG';

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Bank Misr page');
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // الهيكل الافتراضي لأسعار العملات الذي يتوقعه تطبيق الموبايل
    const rates = {
      "USD": 0,
      "EUR": 0,
      "GBP": 0,
      "SAR": 0,
      "AED": 0
    };

    // استخراج البيانات من جدول صفحة بنك مصر
    // يمكنك تعديل محددات العناصر (Selectors) بناءً على الكود الفعلي لجدول العملات في الصفحة
    $('table tr').each((index, element) => {
      const currencyText = $(element).find('td').eq(0).text().trim();
      const rateText = $(element).find('td').eq(2).text().trim(); // سعر البيع أو الشراء حسب رغبتك
      
      const parsedRate = parseFloat(rateText);
      if (currencyText && !isNaN(parsedRate)) {
        rates[currencyText] = parsedRate;
      }
    });

    cache = rates;
    lastUpdate = now;

    return res.status(200).json(cache);

  } catch (error) {
    console.error('Error fetching or parsing Bank Misr rates:', error);
    
    // في حال حدوث أي خطأ في الاتصال، يتم إرجاع آخر بيانات ناجحة من الكاش
    if (cache) {
      return res.status(200).json(cache);
    }
    
    return res.status(503).json({ error: 'Service Unavailable' });
  }
}
