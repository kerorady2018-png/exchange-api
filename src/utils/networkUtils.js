/**
 * دالة إعادة المحاولة الذكية (Exponential Backoff)
 * تساعد في التعامل مع انقطاعات الإنترنت المؤقتة أو ضغط السيرفر بشكل احترافي.
 */
export const withRetry = async (fn, retries = 3, initialDelay = 1000) => {
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

      // حساب التأخير بشكل أسّي: 1s -> 2s -> 4s
      const delay = initialDelay * Math.pow(2, i);
      console.log(`Retry attempt ${i + 1} after ${delay}ms due to: ${error.message}`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};
