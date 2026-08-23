/**
 * Personalized Strategy report — EN→VI translations.
 *
 * Only chrome lives here. AI-authored content on that page (`recommendation.*`)
 * renders verbatim by product decision and never passes through `t()`, which is
 * why this file is much smaller than the surface it covers.
 */
export const STRATEGY_REPORT_TRANSLATIONS: Record<string, string> = {
  // Section navigation
  Overview: 'Tổng quan',
  Priorities: 'Ưu tiên',
  Development: 'Phát triển hồ sơ',
  Narrative: 'Câu chuyện',
  Roadmap: 'Lộ trình',

  // Section 1 — overview
  'Where you are, and where this takes you': 'Bạn đang ở đâu, và chiến lược này đưa bạn tới đâu',
  'Current position': 'Vị trí hiện tại',
  'Strongest dimension': 'Khía cạnh mạnh nhất',
  'Biggest challenge': 'Thách thức lớn nhất',
  'Strategic goal': 'Mục tiêu chiến lược',
  'Top priorities': 'Những ưu tiên hàng đầu',
  'Expected outcome': 'Kết quả kỳ vọng',
  'This is not the highest-scoring option, and that is deliberate':
    'Đây không phải phương án có điểm cao nhất, và đó là lựa chọn có chủ đích',

  // Section 2 — priorities
  'What to work on': 'Những việc cần tập trung',
  'Ordered by how much each one moves your position, not by how easy it is.':
    'Sắp xếp theo mức độ thay đổi vị thế hồ sơ của bạn, không theo mức độ dễ làm.',
  High: 'Cao',
  Medium: 'Trung bình',
  Low: 'Thấp',
  'Already in your portfolio': 'Đã có trong hồ sơ của bạn',
  'Not started yet': 'Chưa bắt đầu',

  // Section 3 — development
  'How to develop your profile': 'Cách phát triển hồ sơ của bạn',
  'What makes you different': 'Điều khiến bạn khác biệt',
  'How to amplify it': 'Cách khuếch đại điều đó',
  'The directions we compared': 'Các hướng đi đã được so sánh',
  'Each direction is scored on six dimensions. The margin shows how close the decision was.':
    'Mỗi hướng đi được chấm trên sáu khía cạnh. Khoảng cách điểm cho thấy lựa chọn sát sao đến mức nào.',
  '{n} behind': 'kém {n} điểm',
  'Portfolio opportunities': 'Cơ hội bổ sung cho hồ sơ',
  'Academic and experience strategies are not generated yet. They are part of the report specification but the engine does not produce them, so nothing is shown rather than something recycled from the sections above.':
    'Chiến lược học thuật và chiến lược trải nghiệm chưa được tạo. Chúng nằm trong đặc tả báo cáo nhưng hệ thống chưa sinh ra, nên phần này để trống thay vì lắp ghép lại nội dung từ các mục phía trên.',

  // Section 4 — narrative
  'The story your application should tell': 'Câu chuyện mà hồ sơ của bạn nên kể',
  'How you read now': 'Hồ sơ của bạn hiện được đọc như thế nào',
  'How you could read': 'Hồ sơ của bạn có thể được đọc như thế nào',

  // Section 5 — roadmap
  'Your roadmap': 'Lộ trình của bạn',
  Prioritise: 'Ưu tiên làm',
  Avoid: 'Nên tránh',
};
