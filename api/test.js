export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({
      success: true,
      message: 'API Test Working',
      timestamp: new Date().toISOString(),
      environment: {
        hasMongoUri: !!process.env.MONGODB_URI,
        mongoUriLength: process.env.MONGODB_URI?.length || 0,
        dbName: process.env.DB_NAME,
        collectionName: process.env.COLLECTION_NAME,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}