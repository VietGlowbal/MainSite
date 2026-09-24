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
  'Key challenge': 'Thách thức chính',
  'Strategic opportunity': 'Cơ hội chiến lược',
  'Strongest dimension': 'Khía cạnh mạnh nhất',
  'Biggest challenge': 'Thách thức lớn nhất',
  'Strategic goal': 'Mục tiêu chiến lược',
  'Top priorities': 'Những ưu tiên hàng đầu',
  'Expected outcome': 'Kết quả kỳ vọng',
  'Activity-level analysis': 'Phân tích theo từng hoạt động',
  'Filter activity analysis': 'Lọc phân tích hoạt động',
  'No activities match this filter.': 'Không có hoạt động nào khớp bộ lọc này.',
  maintain: 'Duy trì',
  develop: 'Phát triển',
  consolidate: 'Củng cố',
  reposition: 'Định vị lại',
  deprioritize: 'Giảm ưu tiên',
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
  'Core narrative direction': 'Định hướng câu chuyện cốt lõi',
  'Origin / trigger': 'Nguồn gốc / động lực khởi phát',
  'Recurring motivation': 'Động lực lặp lại',
  'Capabilities developed': 'Năng lực đã phát triển',
  'Emerging direction': 'Định hướng đang hình thành',
  'Not established from the available evidence.': 'Chưa được xác lập từ bằng chứng hiện có.',
  'Supporting themes': 'Các chủ đề hỗ trợ',
  'Narrative tension / gap': 'Căng thẳng / khoảng trống trong câu chuyện',
  'Narrative options': 'Các phương án câu chuyện',
  'Strategic fit': 'Mức độ phù hợp chiến lược',
  'How you read now': 'Hồ sơ của bạn hiện được đọc như thế nào',
  'How you could read': 'Hồ sơ của bạn có thể được đọc như thế nào',

  // Section 5 — roadmap
  'Your roadmap': 'Lộ trình của bạn',
  'Strategic Roadmap': 'Lộ trình chiến lược',
  Goal: 'Mục tiêu',
  'Recommended move': 'Hướng xử lý đề xuất',
  'Adds one trackable Planner task for each roadmap deliverable and preserves completed work when the report regenerates.':
    'Thêm một nhiệm vụ Planner có thể theo dõi cho mỗi đầu ra của lộ trình và giữ lại các việc đã hoàn thành khi báo cáo được tạo lại.',
  Prioritise: 'Ưu tiên làm',
  Avoid: 'Nên tránh',
  'Your Application Strategy': 'Chiến lược hồ sơ của bạn',
  'A focused plan based on your current profile, target programme, and available evidence.':
    'Kế hoạch tập trung dựa trên hồ sơ hiện tại, chương trình mục tiêu và bằng chứng bạn đang có.',
  'A concise view of your current position and next priorities': 'Tóm tắt vị trí hiện tại và những ưu tiên tiếp theo',
  'What is still unclear': 'Điều vẫn chưa rõ',
  'Potential differentiation': 'Tiềm năng tạo khác biệt',
  'Priorities are ranked by potential impact, relevance to your target, evidence gaps, feasibility, and urgency.':
    'Ưu tiên được xếp theo tác động tiềm năng, mức liên quan tới mục tiêu, khoảng trống bằng chứng, tính khả thi và mức cấp thiết.',
  '3 Focus Areas': '3 trọng tâm cần tập trung',
  build: 'Xây dựng',
  Diagnosis: 'Chẩn đoán',
  Gap: 'Khoảng trống',
  'Possible routes': 'Các hướng khả thi',
  'Recommended route': 'Hướng đề xuất',
  'Evidence expected': 'Bằng chứng kỳ vọng',
  Strong: 'Mạnh',
  Developing: 'Đang phát triển',
  Limited: 'Hạn chế',
  'Not Established': 'Chưa thiết lập',
  'Future Potential': 'Tiềm năng tương lai',
  Actions: 'Hành động',
  'Actions taken': 'Hành động đã thực hiện',
  'Capabilities Developed': 'Năng lực đã phát triển',
  'Central idea': 'Ý tưởng trung tâm',
  'Why it emerges': 'Vì sao ý tưởng hình thành',
  'Strongest supporting experiences': 'Trải nghiệm hỗ trợ mạnh nhất',
  'What could strengthen it': 'Điều có thể củng cố',
  Evaluation: 'Đánh giá',
  'Evidence Strength': 'Độ mạnh bằng chứng',
  'Personal Authenticity': 'Tính chân thực cá nhân',
  'Programme Relevance': 'Mức liên quan tới chương trình',
  Differentiation: 'Khả năng tạo khác biệt',
  'Development Potential': 'Tiềm năng phát triển',
  'Evidence supporting this diagnosis': 'Bằng chứng hỗ trợ chẩn đoán này',
  'Use this direction to resolve the narrative gap.': 'Dùng hướng này để giải quyết khoảng trống câu chuyện.',
  'Strategic Fit': 'Mức độ phù hợp chiến lược',
  'Compressed timeline': 'Lộ trình rút gọn',
  'The roadmap is prioritised around the current deadline.': 'Lộ trình được ưu tiên theo thời hạn hiện tại.',
  'Open Personal Canvas': 'Mở Personal Canvas',
  'Open CV Builder': 'Mở trình tạo CV',
  'Open Statement Writer': 'Mở trình viết bài luận',
  'Emerging Direction': 'Định hướng đang hình thành',
};
