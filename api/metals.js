import axios from 'axios';

export default async function handler(req, res) {
  try {
    let goldSource1 = null;
    let silverSource1 = null;
    try {
      const [resGold1, resSilver1] = await Promise.all([
        axios.get('https://api.gold-api.com/price/XAU', { timeout: 4000 }),
        axios.get('https://api.gold-api.com/price/XAG', { timeout: 4000 })
      ]);
      if (resGold1.data && resGold1.data.price) {
        goldSource1 = Number(resGold1.data.price);
      }
      if (resSilver1.data && resSilver1.data.price) {
        silverSource1 = Number(resSilver1.data.price);
      }
    } catch (e1) {}

    let goldSource2 = null;
    let silverSource2 = null;
    try {
      const res2 = await axios.get('https://api.metals.live/v1/spot', { timeout: 3000 });
      if (res2.data && Array.isArray(res2.data)) {
        const g = res2.data.find(i => i.gold);
        const s = res2.data.find(i => i.silver);
        if (g && g.gold) goldSource2 = Number(g.gold);
        if (s && s.silver) silverSource2 = Number(s.silver);
      }
    } catch (e2) {}

    const validGoldPrices = [goldSource1, goldSource2].filter(val => val !== null && !isNaN(val) && val > 0);
    const validSilverPrices = [silverSource1, silverSource2].filter(val => val !== null && !isNaN(val) && val > 0);

    const avgGoldOunceUSD = validGoldPrices.length > 0 
      ? validGoldPrices.reduce((a, b) => a + b, 0) / validGoldPrices.length 
      : 0;

    const avgSilverOunceUSD = validSilverPrices.length > 0 
      ? validSilverPrices.reduce((a, b) => a + b, 0) / validSilverPrices.length 
      : 0;

    const metalsData = {
      lastUpdated: new Date().toISOString(),
      goldOunceUSD: avgGoldOunceUSD,
      silverOunceUSD: avgSilverOunceUSD
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=60');
    return res.status(200).json(metalsData);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch metals data' });
  }
}
