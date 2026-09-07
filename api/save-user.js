const { MongoClient } = require('mongodb');

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  // Enable CORS
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

  // فقط طلبات POST مسموحة
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  console.log('📥 Save-user request received:', {
    method: req.method,
    contentType: req.headers['content-type'],
    bodyLength: JSON.stringify(req.body).length,
    body: req.body,
    headers: req.headers
  });

  try {
    // التحقق من متغيرات البيئة
    const MONGODB_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.DB_NAME || 'user_database';
    const COLLECTION_NAME = process.env.COLLECTION_NAME || 'users';

    console.log('🔍 Environment check:', {
      hasMongoUri: !!MONGODB_URI,
      mongoUriLength: MONGODB_URI?.length || 0,
      dbName: DB_NAME,
      collectionName: COLLECTION_NAME
    });

    if (!MONGODB_URI) {
      console.error('❌ MongoDB URI not configured');
      return res.status(500).json({ success: false, error: 'MongoDB URI not configured' });
    }

    // استخراج البيانات من الطلب
    const { name, phone, email, portfolio, totalValue, target, clientTimestamp } = req.body;

    console.log('📋 Request data:', {
      name,
      phone,
      email,
      portfolioCount: portfolio?.length || 0,
      portfolio: portfolio,
      totalValue,
      target,
      clientTimestamp
    });

    // التحقق من البيانات المطلوبة
    if (!name || (!phone && !email)) {
      console.error('❌ Validation failed: missing required fields');
      return res.status(400).json({ success: false, error: 'Name and either phone or email are required' });
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

    // إنشاء معرف المستخدم
    const userId = phone || email;
    const updateData = {
      name: name.trim(),
      phone: phone || null,
      email: email || null,
      portfolio: portfolio || [],
      totalValue: Number(totalValue) || 0,
      target: target || null,
      updatedAt: new Date().toISOString(),
      clientTimestamp: clientTimestamp || Date.now()
    };

    console.log('💾 Attempting to save/update user:', {
      userId,
      updateDataSummary: {
        name: updateData.name,
        portfolioCount: updateData.portfolio.length,
        totalValue: updateData.totalValue
      }
    });

    // البحث عن المستخدم وإنشاؤه أو تحديثه
    const result = await collection.updateOne(
      { $or: [{ phone: phone }, { email: email }] },
      { $set: updateData },
      { upsert: true }
    );

    console.log('📊 Update result:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount
    });

    // الحصول على المستخدم المحدث
    const user = await collection.findOne(
      { $or: [{ phone: phone }, { email: email }] }
    );

    console.log('✅ User saved successfully:', {
      userId: user?.phone || user?.email,
      portfolioCount: user?.portfolio?.length || 0,
      totalValue: user?.totalValue
    });

    // إغلاق الاتصال
    await client.close();
    console.log('🔌 MongoDB connection closed');

    return res.status(200).json({
      success: true,
      user: user,
      message: result.upsertedCount > 0 ? 'User created successfully' : 'User updated successfully'
    });

  } catch (error) {
    console.error('❌ Error in save-user API:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}