import mongoose from 'mongoose';

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'user_database',
    });
    isConnected = true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  portfolio: { type: Array, default: [] }, // حقل مخصص لحفظ بيانات المحفظة والأصول
  date: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      await connectDB();
      const { name, phone, email, portfolio } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // البحث عن المستخدم باستخدام الإيميل أو الهاتف أو الاسم لتحديث بياناته بدلاً من تكرار السجلات
      const query = email ? { email } : (phone ? { phone } : { name });

      const updateData = {
        name,
        phone,
        email,
        ...(portfolio && { portfolio }), // تحديث المحفظة إذا تم إرسالها
        date: new Date()
      };

      const updatedUser = await User.findOneAndUpdate(query, updateData, {
        new: true,
        upsert: true, // إنشاء المستخدم إذا لم يكن موجوداً أو تحديثه إذا كان موجوداً
        setDefaultsOnInsert: true
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Portfolio and user data saved successfully to MongoDB Atlas!',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error saving data:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
