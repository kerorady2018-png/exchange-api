const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // السماح بالوصول من أي مصدر (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  // تفعيل التخزين المؤقت على حافة الشبكة لمدة ساعة كاملة (3600 ثانية)
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=1800');

  try {
    const url = 'https://www.banquemisr.com/Home/CAPITAL%20MARKETS/Exchange%20rates%20and%20currencies?sc_lang=ar-EG';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });

    const $ = cheerio.load(response.data);
    const rates = {};

    // قراءة صفوف جدول العملات من موقع بنك مصر
    $('table tr').each((index, element) => {
      const cols = $(element).find('td');
      if (cols.length >= 3) {
        const currencyName = $(cols[0]).text().trim(); // اسم العملة بالعربية
        const buyPrice = parseFloat($(cols[1]).text().trim());
        const sellPrice = parseFloat($(cols[2]).text().trim());

        if (currencyName && !isNaN(buyPrice)) {
          rates[currencyName] = {
            buy: buyPrice,
            sell: sellPrice
          };
        }
      }
    });

    return res.status(200).json({
      success: true,
      source: 'Banque Misr',
      updatedAt: new Date().toISOString(),
      rates: rates
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
