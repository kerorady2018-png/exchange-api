export default function handler(req, res) {
  // تفعيل الـ CORS للسماح لتطبيق الموبايل بالاتصال بالـ API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { name, phone, email, date } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // يمكنك هنا حفظ البيانات في قاعدة بيانات سحابية (مثل MongoDB Atlas) 
    // أو معالجة البيانات حسب رغبتك
    console.log('New User Registered:', { name, phone, email, date });

    return res.status(200).json({ 
      success: true, 
      message: 'Data saved successfully on Vercel!' 
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
