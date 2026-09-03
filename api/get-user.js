const mongoose = require('mongoose');

export default async function handler(req, res) {
  // طلبات GET و POST مسموحة
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // التحقق من متغيرات البيئة
    const MONGODB_URI = process.env.MONGODB_URI;
    const DB_NAME = process.env.DB_NAME || 'user_database';
    const COLLECTION_NAME = process.env.COLLECTION_NAME || 'users';

    if (!MONGODB_URI) {
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

    // التحقق من وجود معرف البحث
    if (!phone && !email) {
      return res.status(400).json({ success: false, error: 'Phone or email is required' });
    }

    // الاتصال بقاعدة البيانات
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 5000,
    });

    const db = mongoose.connection.db;
    const collection = db.collection(COLLECTION_NAME);

    // البحث عن المستخدم
    const user = await collection.findOne({
      $or: [
        { phone: phone },
        { email: email ? email.toLowerCase() : null }
      ]
    });

    // إغلاق الاتصال
    await mongoose.connection.close();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('Error in get-user API:', error);
    
    // إغلاق الاتصال في حالة الخطأ
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}