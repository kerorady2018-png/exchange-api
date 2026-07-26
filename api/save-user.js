import mongoose from 'mongoose';

// منع فتح اتصال جديد مع كل طلب (مهم جداً لعمل وظائف Serverless على Vercel)
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'user_database', // اسم قاعدة البيانات
    });
    isConnected = true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

// تصميم هيكل البيانات (Schema) الذي سيتم حفظه في القاعدة
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  email: String,
  date: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  // تفعيل الـ CORS للسماح بالتطبيق بالاتصال بالـ API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      await connectDB();
      const { name, phone, email, date } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // حفظ البيانات في قاعدة البيانات
      const newUser = new User({ name, phone, email, date });
      await newUser.save();

      return res.status(200).json({ 
        success: true, 
        message: 'Data saved successfully to MongoDB Atlas!' 
      });
    } catch (error) {
      console.error('Error saving data:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
