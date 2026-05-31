/**
 * Translation dictionary — English source string → Vietnamese.
 *
 * Keys are the exact English UI strings. Components wrap text in `t('...')`;
 * if a key is missing here it falls back to English, so coverage can grow
 * incrementally without ever breaking the English site.
 */
export const translations: Record<string, string> = {
  // ── Navigation ───────────────────────────────────────────────────────────
  Home: 'Trang chủ',
  Search: 'Tìm kiếm',
  Apply: 'Nộp đơn',
  Mentorship: 'Cố vấn',
  'GLOWBAL News': 'Tin tức GLOWBAL',
  'Mentor hub': 'Trung tâm cố vấn',
  Admin: 'Quản trị',
  Mentors: 'Cố vấn',
  News: 'Tin tức',
  Profile: 'Hồ sơ',
  'Sign In/Up': 'Đăng nhập/Đăng ký',
  'Sign in': 'Đăng nhập',
  'Sign out': 'Đăng xuất',

  // ── Common actions ───────────────────────────────────────────────────────
  Save: 'Lưu',
  Saved: 'Đã lưu',
  Share: 'Chia sẻ',
  Read: 'Đọc',
  Continue: 'Tiếp tục',
  Next: 'Tiếp theo',
  Back: 'Quay lại',
  Cancel: 'Hủy',
  Submit: 'Gửi',
  'Get started': 'Bắt đầu',
  'Learn more': 'Tìm hiểu thêm',
  'View all': 'Xem tất cả',
  Subscribe: 'Đăng ký',
  'Enter your email': 'Nhập email của bạn',

  // ── Topics (news + filters) ──────────────────────────────────────────────
  'All topics': 'Tất cả chủ đề',
  Universities: 'Trường đại học',
  Applications: 'Hồ sơ ứng tuyển',
  Scholarships: 'Học bổng',
  'Student life': 'Đời sống sinh viên',
  'Visas & immigration': 'Visa & nhập cư',
  Careers: 'Nghề nghiệp',
  More: 'Thêm',

  // ── News / guides ────────────────────────────────────────────────────────
  'Glowbal News & Guides': 'Tin tức & Hướng dẫn Glowbal',
  'Insights to help you study abroad': 'Thông tin giúp bạn du học',
  smarter: 'thông minh hơn',
  'Expert insights, real student stories, and practical guides to help you plan, apply, and succeed.':
    'Thông tin chuyên sâu, câu chuyện thực tế của sinh viên và hướng dẫn thiết thực giúp bạn lên kế hoạch, nộp đơn và thành công.',
  'Search articles, topics or universities...': 'Tìm bài viết, chủ đề hoặc trường đại học...',
  Featured: 'Nổi bật',
  'Read full guide': 'Đọc hướng dẫn đầy đủ',
  'Save for later': 'Lưu để đọc sau',
  'Latest articles': 'Bài viết mới nhất',
  'Fresh insights and expert advice': 'Thông tin mới và lời khuyên từ chuyên gia',
  'Latest first': 'Mới nhất trước',
  'No articles match that search yet.': 'Chưa có bài viết nào khớp với tìm kiếm.',
  'Read article': 'Đọc bài viết',
  'View all articles': 'Xem tất cả bài viết',
  'Trending now': 'Đang thịnh hành',
  'Stay updated': 'Cập nhật thông tin',
  'Get the latest study abroad tips, scholarships and guides straight to your inbox.':
    'Nhận các mẹo du học, học bổng và hướng dẫn mới nhất ngay trong hộp thư của bạn.',
  '{minutes} min read': '{minutes} phút đọc',

  // ── Article (guide) page chrome ──────────────────────────────────────────
  'On this page': 'Trong trang này',
  'Related articles': 'Bài viết liên quan',
  'By Glowbal Editorial Team': 'Bởi Đội ngũ Biên tập Glowbal',
  'Key takeaway': 'Điểm chính',
  'Why this matters': 'Tại sao điều này quan trọng',
  'Next steps': 'Bước tiếp theo',

  // ── Language switcher ────────────────────────────────────────────────────
  English: 'Tiếng Anh',
  'Tiếng Việt': 'Tiếng Việt',
};
