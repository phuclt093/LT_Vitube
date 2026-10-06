/*
  Bản chính nằm ở /api/pwa/assetlinks (next.config.mjs rewrite /.well-known/assetlinks.json
  sang đó). File này chỉ trỏ về bản chính, phòng khi Next.js nhận thư mục `.well-known`
  làm route trước cả rewrite — hai đường cho cùng một kết quả. Xoá file này cũng được.
*/
export { GET } from '@/app/api/pwa/assetlinks/route';

// Next.js bắt buộc khai báo cấu hình route ngay trong file, không được re-export
export const dynamic = 'force-dynamic';
