/**
 * دالة إعادة المحاولة الذكية (Exponential Backoff)
 * تساعد في التعامل مع انقطاعات الإنترنت المؤقتة أو ضغط السيرفر بشكل احترافي.
 * تم تحسينها لتقليل البطء: محاولة واحدة فقط للسرعة
 */
export const withRetry = async (fn, retries = 1, initialDelay = 500) => {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // لا نعيد المحاولة إذا كان الخطأ 404 (غير موجود) أو 401 (غير مصرح)
      if (error.response && (error.response.status === 404 || error.response.status === 401)) {
        throw error;
      }

      // لا نعيد المحاولة في حالة Network Error للسرعة
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        throw error;
      }

      // حساب التأخير بشكل أسّي: 0.5s -> 1s (أسرع)
      const delay = initialDelay * Math.pow(2, i);
      console.log(`Retry attempt ${i + 1} after ${delay}ms due to: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};
