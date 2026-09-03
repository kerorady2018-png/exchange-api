const mongoose = require('mongoose');

export default async function handler(req, res) {
  // فقط طلبات POST مسموحة
  if (req.method !== 'POST') {
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

    // الاتصال بقاعدة البيانات
    await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      serverSelectionTimeoutMS: 5000,
    });

    const db = mongoose.connection.db;
    const collection = db.collection(COLLECTION_NAME);

    // استخراج البيانات من الطلب
    const { name, phone, email, portfolio, totalValue, target, clientTimestamp } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || (!phone && !email)) {
      return res.status(400).json({ success: false, error: 'Name and either phone or email are required' });
    }

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

    // البحث عن المستخدم وإنشاؤه أو تحديثه
    const result = await collection.updateOne(
      { $or: [{ phone: phone }, { email: email }] },
      { $set: updateData },
      { upsert: true }
    );

    // الحصول على المستخدم المحدث
    const user = await collection.findOne(
      { $or: [{ phone: phone }, { email: email }] }
    );

    // إغلاق الاتصال
    await mongoose.connection.close();

    return res.status(200).json({
      success: true,
      user: user,
      message: result.upsertedCount > 0 ? 'User created successfully' : 'User updated successfully'
    });

  } catch (error) {
    console.error('Error in save-user API:', error);
    
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