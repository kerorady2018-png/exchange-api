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
    throw error;
  }
};

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  portfolio: { type: Array, default: [] },
  date: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // دعم طلبات GET و POST لاستعادة البيانات
  if (req.method === 'GET' || req.method === 'POST') {
    try {
      await connectDB();
      
      // استقبال البيانات سواء عبر الـ Query Parameters (في GET) أو الـ Body (في POST)
      const queryParams = req.method === 'GET' ? req.query : req.body;
      const { phone, email } = queryParams || {};

      if (!phone && !email) {
        return res.status(400).json({ error: 'Phone or email is required to restore data' });
      }

      // تنظيف المدخلات للبحث بدقة
      const cleanEmail = email && email.trim() !== '' ? email.trim().toLowerCase() : undefined;
      const cleanPhone = phone && phone.trim() !== '' ? phone.trim() : undefined;

      // البحث عن المستخدم باستخدام الإيميل أو الهاتف
      let user = null;
      if (cleanEmail) {
        user = await User.findOne({ email: cleanEmail });
      }
      if (!user && cleanPhone) {
        user = await User.findOne({ phone: cleanPhone });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        success: true,
        user: {
          name: user.name,
          phone: user.phone || '',
          email: user.email || '',
          portfolio: user.portfolio || [],
          date: user.date
        }
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
