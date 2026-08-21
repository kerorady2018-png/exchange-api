import NetInfo from '@react-native-community/netinfo';

/**
 * خدمة حالة الشبكة
 * تستخدم لتتبع حالة الاتصال بالإنترنت
 */
class NetworkService {
  static isOnline = true;
  static listeners = [];

  /**
   * بدء تتبع حالة الشبكة
   */
  static startTracking() {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected && state.isInternetReachable;
      this.notifyListeners();
    });
  }

  /**
   * إضافة مستمع لحالة الشبكة
   * @param {function} callback - دالة الاستدعاء عند تغير الحالة
   */
  static addListener(callback) {
    this.listeners.push(callback);
    callback(this.isOnline);
  }

  /**
   * إزالة مستمع
   * @param {function} callback - دالة الاستدعاء المراد إزالتها
   */
  static removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  /**
   * إعلام جميع المستمعين بتغير الحالة
   */
  static notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.isOnline);
      } catch (error) {
        console.error('Error notifying network listener:', error);
      }
    });
  }

  /**
   * التحقق من الاتصال بالإنترنت
   * @returns {Promise<boolean>}
   */
  static async checkConnection() {
    try {
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected && state.isInternetReachable;
      return this.isOnline;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  }

  /**
   * الحصول على حالة الاتصال الحالية
   * @returns {boolean}
   */
  static isConnected() {
    return this.isOnline;
  }
}

// بدء التتبع تلقائياً
NetworkService.startTracking();

export default NetworkService;
