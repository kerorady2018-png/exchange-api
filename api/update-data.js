const { main } = require('../scripts/data-fetcher.cjs');

export default async function handler(req, res) {
  try {
    console.log('Running data fetcher via API...');
    await main();
    res.json({ success: true, message: 'Data updated successfully', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error in update-data API:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}
