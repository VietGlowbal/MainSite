import { describe, expect, it } from 'vitest';
import { translations } from '@/lib/i18n-dictionary';

const REQUIRED_MAPPINGS = {
  'GlowBal Matcher': 'Công Cụ Định Hướng Du Học',
  'GlowBal News': 'Tin tức GlowBal',
  Search: 'Tìm kiếm',
  'Search Universities': 'Tìm Đại học',
  'Search Scholarships': 'Tìm Học bổng',
  'Search Advisors': 'Tìm cố vấn',
  'Plan your Global Education': 'Lập Kế hoạch Du học',
  'My Portal': 'Trang lưu',
  'My Application': 'Theo dõi Tiến độ',
  'Saved Universities': 'Trường đã lưu',
  'User Profile': 'Thông tin Cá nhân',
  'Strategy Master': 'Công Cụ Lên Chiến Lược',
  Reflection: 'Nhập Thông Tin',
  'Applicant Personal Report': 'Phân tích Chân dung Ứng viên',
  'GlowBal Matching Report': 'Phân tích Mức độ Phù hợp Giữa ứng viên và lựa chọn trường - ngành - học bổng',
  'Personalized Strategy': 'Chiến lược Cá nhân hoá',
  'Application Planner': 'Theo dõi Quá trình Ứng tuyển',
  'List View': 'Danh sách',
  'Status View': 'Mức độ Hoàn thành',
  'Calendar View': 'Lịch',
  'Profile Support': 'Xây dựng Hồ sơ cùng GlowBal AI',
  'Essay Support': 'Xây dựng Bài luận',
  'CV Support': 'Xây dựng CV',
  'LOR Support': 'Xây dựng Thư giới thiệu',
  Documents: 'Lưu tài liệu',
} as const;

describe('required product vocabulary', () => {
  it('keeps the 25 approved English-to-Vietnamese mappings exact', () => {
    expect(Object.keys(REQUIRED_MAPPINGS)).toHaveLength(25);
    for (const [key, value] of Object.entries(REQUIRED_MAPPINGS)) expect(translations[key]).toBe(value);
  });
});
