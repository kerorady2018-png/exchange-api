// services/userService.js

export const saveDataToAtlas = async (userData) => {
  try {
    const response = await fetch('https://exchange-api.vercel.app/api/save-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: userData.name,       // اسم المستخدم (إجباري)
        phone: userData.phone,     // رقم الهاتف
        email: userData.email,     // البريد الإلكتروني
        portfolio: userData.portfolio, // مصفوفة الأصول
        totalValue: userData.totalValue // القيمة الإجمالية
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save data');
    }

    return result.user;
  } catch (error) {
    console.error('Error in saving:', error.message);
    throw error;
  }
};

export const restoreDataFromAtlas = async (identifier) => {
  try {
    const isEmail = identifier.includes('@');
    const requestBody = isEmail 
      ? { email: identifier.trim().toLowerCase() } 
      : { phone: identifier.trim() };

    const response = await fetch('https://exchange-api.vercel.app/api/get-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'User not found');
    }

    return result.user;
  } catch (error) {
    console.error('Error in restoring:', error.message);
    throw error;
  }
};
