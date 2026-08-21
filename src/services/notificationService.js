import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// إعداد كيفية ظهور الإشعارات عندما يكون التطبيق مفتوحاً
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldBadge: false,
  }),
});

// دالة طلب الأذونات وإنشاء قناة الإشعارات لأندرويد
export async function registerForPushNotificationsAsync() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CurrenCX Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('لم يتم منح صلاحية الإشعارات!');
      return;
    }
  } catch (error) {
    console.log('Error registering notifications:', error);
  }
}

// دالة إرسال الإشعار الفوري
export async function sendPushNotification(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: 'default',
      },
      trigger: null, // إرسال فوري
    });
  } catch (error) {
    console.log('Error sending notification:', error);
  }
}

// جدولة التقرير اليومي بانتظام (يعمل تلقائياً في الخلفية بواسطة النظام في تمام الساعة 12 منتصف الليل)
export async function scheduleDailyPortfolioReport() {
  try {
    // إلغاء الجدولة القديمة لمنع التكرار
    await Notifications.cancelAllScheduledNotificationsAsync();

    // جدولة إشعار يومي صامت وثابت في تمام الساعة 12:00 AM
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 تقرير CurrenCX الذكي',
        body: 'تم رصد وتحديث أصول المحفظة وأسعار العملات اليوم. اضغط للمزيد.',
        sound: 'default',
      },
      trigger: {
        hour: 0,
        minute: 0,
        repeats: true,
      },
    });

    console.log('تم جدولعة التقرير اليومي بنجاح.');
  } catch (error) {
    console.log('Error scheduling daily report:', error);
  }
}
