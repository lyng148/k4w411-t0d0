# PWA Installation Guide

## 🍎 Cài đặt trên iPhone 12 (iOS)

### Bước 1: Mở trong Safari
- Mở app trong **Safari** browser (không phải Chrome)
- Truy cập: https://your-app-url.com

### Bước 2: Thêm vào Home Screen
1. Nhấn nút **Share** (biểu tượng mũi tên lên) ở dưới cùng
2. Cuộn xuống và chọn **"Add to Home Screen"**
3. Đặt tên cho app (mặc định: "Todo")
4. Nhấn **"Add"**

### Bước 3: Mở Full Screen
- Tìm icon app trên Home Screen
- Nhấn vào để mở
- App sẽ chạy ở chế độ full screen, không có thanh địa chỉ Safari

## 🎨 Tính năng PWA

✅ **Full Screen**: Không có thanh trình duyệt, trải nghiệm như native app
✅ **Safe Area**: Tự động điều chỉnh cho notch của iPhone 12
✅ **Offline Mode**: Hoạt động ngay cả khi mất kết nối internet
✅ **App Icon**: Icon xinh xắn trên Home Screen
✅ **Fast Loading**: Cache tài nguyên để tải nhanh

## 🔧 Tối ưu cho iPhone 12

- Viewport đã được tối ưu cho màn hình 390x844px
- Safe area insets tự động cho notch
- Status bar trong suốt
- Touch optimization cho swipe gestures
- Prevent overscroll bounce

## 📱 Kiểm tra PWA

Để kiểm tra xem PWA đã hoạt động:
1. Mở DevTools (F12)
2. Vào tab "Application"
3. Kiểm tra:
   - Manifest
   - Service Workers
   - Cache Storage

## 🌐 Deploy

Khi deploy lên production:
1. Đảm bảo app chạy trên HTTPS
2. Service Worker sẽ tự động đăng ký
3. Manifest.json phải accessible
4. Icons phải có resolution phù hợp:
   - 192x192px (minimum)
   - 512x512px (recommended)

## 🎯 Tạo App Icons

Để tạo icons cho PWA:
1. Tạo icon 1024x1024px với background #FFB3D9
2. Thêm logo/character của app
3. Export các sizes: 192x192, 512x512
4. Đặt vào thư mục `/public`
