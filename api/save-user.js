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

      // تنظيف البيانات والتأكد من عدم إرسال سلاسل فارغة
      const cleanEmail = email && email.trim() !== '' ? email.trim().toLowerCase() : undefined;
      const cleanPhone = phone && phone.trim() !== '' ? phone.trim() : undefined;

      // تحديد استعلام البحث بدقة بناءً على البيانات المتوفرة وغير الفارغة
      const query = cleanEmail ? { email: cleanEmail } : (cleanPhone ? { phone: cleanPhone } : { name });

      // بناء بيانات التحديث لتجنب تخزين قيم فارغة عن طريق الخطأ
      const updateData = {
        name,
        ...(cleanPhone && { phone: cleanPhone }),
        ...(cleanEmail && { email: cleanEmail }),
        ...(portfolio && { portfolio }),
        date: new Date()
      };

      const updatedUser = await User.findOneAndUpdate(query, updateData, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Portfolio and user data saved successfully to MongoDB Atlas!',
        user: updatedUser
      });
    } catch (error) {
      console.error('Error saving data:', error);

      // التعامل المخصص مع خطأ التكرار في الحقول الفريدة
      if (error.code === 11000) {
        return res.status(400).json({ error: 'The provided email or phone is already registered with another account.' });
      }

      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
