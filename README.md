# Currency Vs Au - Currency Converter & Metals Tracker

## 📱 App Overview

**Currency Vs Au** is a comprehensive financial management application designed for currency conversion, precious metals tracking, and portfolio management. Built with React Native and Expo, this app provides real-time exchange rates, gold and silver prices, and powerful investment tracking tools.

## 🌟 Key Features

### 1. **Currency Converter**
- Real-time currency conversion between 35+ world currencies
- Instant calculations with automatic updates
- Conversion history (last 15 transactions)
- Currency search and favorites
- Offline capability with cached data

### 2. **Live Currency Rates**
- Real-time exchange rates from multiple sources
- Central Bank of Egypt and Banque Misr integration
- Daily price change indicators (green/red)
- Interactive price charts for each currency
- Favorites management with custom ordering
- Price alerts and notifications

### 3. **Precious Metals Tracking**
- Gold prices in all carats (24K, 22K, 21K, 18K, 14K, 12K, 9K)
- Silver prices (999, 925, 800)
- Gold bullion rates (1g, 2.5g, 5g, 10g, 20g, 50g, 100g)
- Egyptian market-specific calculations
- Gold pound and jeweler's dollar rates
- Historical price charts
- Advanced price alerts (Target Price + Fixed Step)

### 4. **Portfolio Management**
- Track investments in currencies and precious metals
- Real-time portfolio value calculation
- Profit/loss tracking with performance metrics
- Financial goal setting with notifications
- Automatic cloud backup every 24 hours
- Smart sync (only when assets change)
- Privacy mode to hide sensitive balances
- Detailed performance reports

### 5. **Settings & Customization**
- Dark mode support
- 11 language support (Arabic, English, French, Spanish, German, Turkish, Italian, Russian, Chinese, Urdu, Dutch)
- RTL support for Arabic and Urdu
- Base currency selection
- Currency favorites management
- Price alert configuration
- User data backup and restore
- Privacy policy access

## 🎨 User Interface

### Design Highlights
- **Modern Floating Dock Navigation**: Smooth swipe gestures between 5 main screens
- **Skeleton Loading**: Professional loading states for better UX
- **Dark/Light Mode**: Automatic theme switching
- **Responsive Design**: Optimized for various screen sizes
- **Smooth Animations**: Micro-interactions and transitions
- **Country Flags**: Visual currency identification
- **Color-Coded Indicators**: Green for gains, red for losses

### Navigation Structure
1. **Converter Tab**: Quick currency conversion
2. **Rates Tab**: Live currency rates with charts
3. **Metals Tab**: Gold and silver prices
4. **Portfolio Tab**: Investment tracking
5. **Settings Tab**: App customization

## 🔒 Privacy & Security

### Data Protection
- **Local Storage**: Most data stored securely on device
- **AES Encryption**: Sensitive data (email, phone) encrypted
- **No Third-Party Sharing**: We never sell user data
- **Secure API**: All communications use HTTPS
- **User Control**: Full access, delete, and export rights

### API Rate Limiting
- **Currency Rates**: Update every 60 minutes
- **Metals Rates**: Update every 15 minutes
- **Portfolio Sync**: Every 24 hours (only when assets change)
- **Offline Cache**: Minimizes API requests
- **Smart Sync**: No unnecessary background calls

## 📊 Technical Specifications

### Framework & Dependencies
- **React Native**: 0.74.5
- **Expo SDK**: 51.0.0
- **Navigation**: React Navigation 7.x
- **State Management**: Context API
- **Internationalization**: i18next
- **Storage**: AsyncStorage
- **Charts**: react-native-chart-kit, react-native-gifted-charts

### Performance Optimizations
- **Lazy Loading**: Screens load on demand
- **Data Caching**: Smart caching strategy
- **Background Fetch**: Efficient background sync
- **Memory Management**: Optimized for smooth performance

## 🌍 Language Support

The app supports 11 languages with full RTL support:
- Arabic (العربية) ✅ RTL
- English ✅
- Français (French) ✅
- Español (Spanish) ✅
- Deutsch (German) ✅
- Türkçe (Turkish) ✅
- Italiano (Italian) ✅
- Русский (Russian) ✅
- 中文 (Chinese) ✅
- اردو (Urdu) ✅ RTL
- Nederlands (Dutch) ✅

## 🚀 Installation

### Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios
```

### Production Build
```bash
# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## 📦 Package Information

- **Package Name**: com.kerollos.currencyvsau
- **Version**: 1.0.0
- **Minimum SDK**: Android 5.0 (API 21)
- **Target SDK**: Android 13 (API 33)

## 🎯 Use Cases

### For Traders
- Real-time currency rate monitoring
- Quick conversion calculations
- Historical price analysis
- Price alerts for key currencies

### For Investors
- Portfolio tracking across currencies and metals
- Performance metrics and profit/loss analysis
- Goal setting and progress tracking
- Secure cloud backup

### For Jewelry Market
- Accurate gold prices in all carats
- Egyptian market-specific rates
- Bullion price tracking
- Historical price trends

### For Travelers
- Instant currency conversion
- Offline access to recent rates
- Multi-currency comparison
- Travel budget planning

## 🔧 Features Breakdown

### Smart Synchronization
- **Hash-Based Sync**: Only syncs when assets actually change
- **24-Hour Interval**: Automatic backup once daily
- **Change Detection**: Monitors asset count and structure
- **Value-Independent**: Doesn't sync on price changes alone

### Error Handling
- **Network Detection**: Alerts when offline
- **Graceful Degradation**: Uses cached data when API fails
- **User Feedback**: Clear error messages
- **Retry Mechanisms**: Automatic retry on network recovery

### Notification System
- **Price Alerts**: Custom price thresholds
- **Goal Notifications**: Financial goal achievements
- **Smart Scheduling**: Avoids notification spam
- **User Control**: Enable/disable per currency/metal

## 📱 Screen Descriptions

### 1. Converter Screen
- Input fields for amount selection
- Currency picker with search
- Instant conversion results
- Conversion history
- Quick swap button

### 2. Rates Screen
- Live currency list with flags
- Price change indicators
- Tap for price charts
- Long-press to reorder favorites
- Pull-to-refresh

### 3. Metals Screen
- Gold prices by carat
- Silver prices
- Bullion rates
- Historical charts
- Price alerts configuration

### 4. Portfolio Screen
- Asset list with values
- Total portfolio value
- Profit/loss indicators
- Goal progress
- Add/Edit/Delete assets
- Privacy toggle

### 5. Settings Screen
- Theme toggle (dark/light)
- Language selection
- Base currency choice
- Favorites management
- User account setup
- Privacy policy
- Help center

## 🎓 Onboarding Experience

New users receive a 4-slide onboarding experience:
- Feature introduction
- Navigation guide
- Privacy overview
- Get started call-to-action

## 📞 Support & Contact

- **Email**: support@currencyvsau.com
- **Website**: www.currencyvsau.com
- **WhatsApp Support**: In-app direct messaging

## 📄 Legal

### Privacy Policy
Comprehensive privacy policy covering:
- Data collection practices
- Data usage and storage
- User rights and controls
- API rate limiting details
- Contact information

### Terms of Service
- User responsibilities
- Service limitations
- Data backup policies
- Contact procedures

## 🔄 Update Frequency

- **Currency Rates**: Every 60 minutes
- **Metals Rates**: Every 15 minutes
- **Portfolio Sync**: Every 24 hours (if changed)
- **App Updates**: As needed for improvements

## 🎨 Brand Identity

- **App Name**: Currency Vs Au
- **Logo**: Professional currency/gold icon
- **Color Scheme**: Blue (#007AFF) primary, clean white/dark backgrounds
- **Typography**: Modern, readable fonts

## 🌟 Target Audience

- **Currency Traders**: Need real-time rates and conversion tools
- **Gold Investors**: Track precious metals prices
- **Travelers**: Quick currency conversion
- **Jewelry Market**: Accurate gold pricing
- **General Users**: Simple financial management

## 📈 Analytics & Performance

- **Fast Loading**: Optimized startup time
- **Smooth Animations**: 60fps interactions
- **Low Memory Usage**: Efficient resource management
- **Battery Friendly**: Minimal background activity

## 🔮 Future Enhancements

Potential features for future updates:
- Historical rate charts
- More currency pairs
- Portfolio sharing
- Export to PDF/Excel
- Widget support
- Apple Watch companion
- Advanced analytics

## 📝 Developer Notes

### Key Implementation Details
- **Smart Caching**: Reduces API calls significantly
- **Background Sync**: Uses expo-background-fetch
- **Encryption**: Crypto-js for sensitive data
- **Network Awareness**: NetInfo for connectivity
- **Internationalization**: Full i18n support

### API Endpoints
- Currency rates: exchange-api-sepia.vercel.app
- Bank rates: cbe-api.vercel.app
- Gold/Silver: exchange-api-sepia.vercel.app

## 🎯 Google Play Store Listing

### Short Description (80 chars)
Currency converter, gold prices, portfolio tracking - all in one app

### Full Description
Currency Vs Au is your ultimate financial companion for currency conversion, precious metals tracking, and investment portfolio management. Track real-time exchange rates, monitor gold and silver prices, and manage your investments with powerful tools.

**Key Features:**
- Real-time currency conversion (35+ currencies)
- Live exchange rates with Central Bank integration
- Gold prices in all carats (24K, 21K, 18K, etc.)
- Silver and bullion rates
- Portfolio management with profit/loss tracking
- Price alerts and notifications
- Dark mode and 11 language support
- Offline capability with smart caching
- Secure cloud backup

Perfect for traders, investors, travelers, and anyone interested in financial markets. Download now and take control of your finances!

### Keywords
currency converter, gold price, exchange rates, portfolio tracker, investment, finance, money, trading, forex, metals

## 📞 Contact & Support

For support, feedback, or questions:
- Email: support@currencyvsau.com
- Website: www.currencyvsau.com

---

**Version**: 1.0.0  
**Last Updated**: August 6, 2026  
**Developer**: Kerollos  
**License**: Proprietary
