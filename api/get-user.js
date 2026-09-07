const { MongoClient } = require('mongodb');

export default async function handler(req, res) {
  // طلبات GET و POST مسموحة
  if (req.method !== 'GET' && req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  console.log('📥 Get-user request received:', {
    method: req.method,
    query: req.query,
    body: req.body
  });

  try {
    // التحقق من متغيرات البيئة
    const MONGODB_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.DB_NAME || 'user_database';
    const COLLECTION_NAME = process.env.COLLECTION_NAME || 'users';

    console.log('🔍 Environment check:', {
      hasMongoUri: !!MONGODB_URI,
      dbName: DB_NAME,
      collectionName: COLLECTION_NAME
    });

    if (!MONGODB_URI) {
      console.error('❌ MongoDB URI not configured');
      return res.status(500).json({ success: false, error: 'MongoDB URI not configured' });
    }

    // استخراج معلمات البحث
    let phone, email;
    
    if (req.method === 'GET') {
      phone = req.query.phone;
      email = req.query.email;
    } else {
      phone = req.body.phone;
      email = req.body.email;
    }

    console.log('🔍 Search parameters:', { phone, email });

    // التحقق من وجود معرف البحث
    if (!phone && !email) {
      console.error('❌ Validation failed: missing search parameters');
      return res.status(400).json({ success: false, error: 'Phone or email is required' });
    }

    // الاتصال بقاعدة البيانات
    console.log('🔌 Connecting to MongoDB...');
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // البحث عن المستخدم
    console.log('🔍 Searching for user...');
    const user = await collection.findOne({
      $or: [
        { phone: phone },
        { email: email ? email.toLowerCase() : null }
      ]
    });

    console.log('📊 Search result:', {
      found: !!user,
      userId: user?.phone || user?.email,
      portfolioCount: user?.portfolio?.length || 0
    });

    // إغلاق الاتصال
    await client.close();
    console.log('🔌 MongoDB connection closed');

    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('✅ User found successfully');
    return res.status(200).json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('❌ Error in get-user API:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}