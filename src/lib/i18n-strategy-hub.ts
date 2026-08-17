/**
 * Strategy Hub (`/ai-strategy`) — the animated landing page a student reaches
 * from the "Strategy Master" nav action. Kept as its own catalog rather than
 * folded into `i18n-dictionary.ts`, matching the precedent set by
 * `i18n-personal-report.ts` / `i18n-application-flow.ts` for large,
 * self-contained report/feature surfaces.
 */
export const STRATEGY_HUB_TRANSLATIONS: Record<string, string> = {
  // Sound toggle
  'Sounds on': 'Đã bật âm thanh',
  'Sounds off': 'Đã tắt âm thanh',
  'Toggle sound effects': 'Bật/tắt hiệu ứng âm thanh',

  // Hero
  'Your GlowBal Strategy': 'Chiến lược GlowBal của bạn',
  'Build a strategy for wherever you apply.':
    'Xây dựng chiến lược cho bất kỳ nơi nào bạn ứng tuyển.',
  'Open an application in My Portal and GlowBal builds the strategy around the exact university and course you picked.':
    'Mở một hồ sơ ứng tuyển trong My Portal và GlowBal sẽ xây dựng chiến lược xoay quanh đúng trường và ngành bạn đã chọn.',
  // "Go to My Portal" reuses the existing translation in i18n-dictionary.ts.
  'Watch the 90 sec tour': 'Xem giới thiệu 90 giây',
  'Built around your profile': 'Xây dựng dựa trên hồ sơ của bạn',
  'Different for every application': 'Khác nhau cho từng hồ sơ ứng tuyển',
  'Made for real applications': 'Dành cho hồ sơ ứng tuyển thật',

  // Tour section
  'See it in action': 'Xem cách hoạt động',
  'Everything starts here.': 'Mọi thứ bắt đầu từ đây.',
  'See how GlowBal turns your profile into a strategy for any university or course you decide to apply to.':
    'Xem cách GlowBal biến hồ sơ của bạn thành chiến lược cho bất kỳ trường hoặc ngành nào bạn quyết định ứng tuyển.',
  'Meet your GlowBal strategy hub.': 'Gặp gỡ trung tâm chiến lược GlowBal của bạn.',
  'This short animation shows how a student moves from profile to strategy — open an application in My Portal to see it built for real.':
    'Đoạn hoạt ảnh ngắn này cho thấy cách một sinh viên đi từ hồ sơ đến chiến lược — hãy mở một hồ sơ ứng tuyển trong My Portal để thấy nó được xây dựng thật sự.',
  'GlowBal is connecting the dots…': 'GlowBal đang kết nối các mảnh ghép…',
  'Profile, university match, reports, strategy and actions — all built from the application you choose.':
    'Hồ sơ, mức độ phù hợp với trường, các báo cáo, chiến lược và hành động — tất cả được xây dựng từ hồ sơ ứng tuyển bạn chọn.',
  "That's the whole journey.": 'Đó là toàn bộ hành trình.',
  'Open My Portal to start building your own.': 'Mở My Portal để bắt đầu xây dựng chiến lược của riêng bạn.',
  'Profile analysed': 'Hồ sơ đã được phân tích',
  'Application selected': 'Hồ sơ ứng tuyển đã được chọn',
  'New strategy recommendation': 'Gợi ý chiến lược mới',
  'Actions ready': 'Hành động đã sẵn sàng',

  // Reports hub
  'Your GlowBal reports': 'Các báo cáo GlowBal của bạn',
  'Three reports. Each one answers a different question.':
    'Ba báo cáo. Mỗi báo cáo trả lời một câu hỏi khác nhau.',
  'Explore what each report is for before you open an application and generate anything.':
    'Tìm hiểu mục đích của từng báo cáo trước khi bạn mở một hồ sơ ứng tuyển và tạo bất cứ thứ gì.',

  'Personal Report': 'Báo cáo Cá nhân',
  'Understand your overall applicant profile.': 'Hiểu rõ hồ sơ ứng viên tổng thể của bạn.',
  'Understand the applicant before the application.': 'Hiểu rõ ứng viên trước khi có hồ sơ ứng tuyển.',
  'The strongest recurring signals across your profile, evidence and experiences — not tied to any one university.':
    'Những tín hiệu lặp lại mạnh nhất trong hồ sơ, bằng chứng và trải nghiệm của bạn — không gắn với riêng một trường nào.',
  'Available now': 'Đã sẵn sàng',
  'Across all applications': 'Áp dụng cho mọi hồ sơ ứng tuyển',
  'This is your reusable personal foundation. It does not belong to one university or course.':
    'Đây là nền tảng cá nhân dùng lại được của bạn. Nó không thuộc về riêng một trường hay ngành nào.',

  'Matching Report': 'Báo cáo Mức độ Phù hợp',
  'See how you align with a chosen course.': 'Xem mức độ phù hợp của bạn với ngành đã chọn.',
  'See how your profile fits a chosen university and course.':
    'Xem hồ sơ của bạn phù hợp thế nào với một trường và ngành cụ thể.',
  'Compares your profile against the university and course inside an application you open in My Portal.':
    'So sánh hồ sơ của bạn với trường và ngành trong một hồ sơ ứng tuyển bạn mở tại My Portal.',
  'Application specific': 'Dành riêng cho từng hồ sơ',
  'Open an application first. GlowBal then generates this report for that exact university and course.':
    'Hãy mở một hồ sơ ứng tuyển trước. GlowBal sẽ tạo báo cáo này cho đúng trường và ngành đó.',

  'Strategy Report': 'Báo cáo Chiến lược',
  'Turn analysis into priorities and actions.': 'Biến phân tích thành ưu tiên và hành động.',
  'Turn the analysis into a plan you can actually follow.': 'Biến phân tích thành một kế hoạch bạn có thể thực sự làm theo.',
  'Priorities and actions tailored to the application you opened, with the reasoning behind each one.':
    'Các ưu tiên và hành động phù hợp với hồ sơ ứng tuyển bạn đã mở, kèm lý do cho từng gợi ý.',
  'Part of GlowBal Plus': 'Thuộc gói GlowBal Plus',
  'Turns into action': 'Biến thành hành động',
  'Strategy recommendations become tasks inside your GlowBal workspace.':
    'Các gợi ý chiến lược trở thành việc cần làm ngay trong không gian làm việc GlowBal của bạn.',

  'Evaluation Report': 'Báo cáo Đánh giá',
  'Check readiness before submission.': 'Kiểm tra mức độ sẵn sàng trước khi nộp hồ sơ.',
  'Coming soon': 'Sắp ra mắt',
  "A pre-submission readiness check is on the roadmap — it isn't available yet.":
    'Tính năng kiểm tra sẵn sàng trước khi nộp hồ sơ đang trong lộ trình phát triển — hiện chưa khả dụng.',

  'Explore': 'Khám phá',
  'Explore →': 'Khám phá →',

  // Final CTA
  'Ready to choose where you are going?': 'Sẵn sàng chọn nơi bạn sẽ đến chưa?',
  'Open an application in My Portal and GlowBal will build the strategy from there.':
    'Mở một hồ sơ ứng tuyển trong My Portal và GlowBal sẽ xây dựng chiến lược từ đó.',

  // Page metadata (not runtime-translated, but scanned as an object:description candidate)
  'GlowBal Strategy Hub': 'Trung tâm Chiến lược GlowBal',
  'Build a strategy for wherever you apply. Open an application in My Portal and GlowBal builds the strategy around the exact university and course you picked.':
    'Xây dựng chiến lược cho bất kỳ nơi nào bạn ứng tuyển. Mở một hồ sơ ứng tuyển trong My Portal và GlowBal sẽ xây dựng chiến lược xoay quanh đúng trường và ngành bạn đã chọn.',

  // Report preview panels
  'The themes and patterns that consistently show up across your profile.':
    'Những chủ đề và khuôn mẫu lặp lại nhất quán trong hồ sơ của bạn.',
  'Proven capabilities': 'Năng lực đã chứng minh',
  'Strengths that are supported by your experiences and evidence.':
    'Những điểm mạnh được củng cố bởi trải nghiệm và bằng chứng của bạn.',
  'Evidence quality': 'Chất lượng bằng chứng',
  'Where your profile is well supported and where detail is still thin.':
    'Nơi hồ sơ của bạn được củng cố tốt và nơi chi tiết vẫn còn mỏng.',
  'Areas for growth': 'Những điểm cần phát triển',
  'The parts of your overall profile that could become stronger over time.':
    'Những phần trong hồ sơ tổng thể của bạn có thể trở nên mạnh hơn theo thời gian.',
  'Academic fit': 'Mức độ phù hợp học thuật',
  'Compare your academic profile against what the course expects.':
    'So sánh hồ sơ học thuật của bạn với yêu cầu của ngành học.',
  'Course alignment': 'Sự liên kết với ngành học',
  'Understand how your interests and experiences connect to the subject.':
    'Hiểu cách sở thích và trải nghiệm của bạn liên kết với ngành học.',
  'Evidence fit': 'Mức độ phù hợp của bằng chứng',
  'See which achievements strengthen this specific application.':
    'Xem thành tích nào củng cố riêng cho hồ sơ ứng tuyển này.',
  'Potential gaps': 'Khoảng trống tiềm ẩn',
  'Identify the parts of the match that need stronger evidence or positioning.':
    'Xác định những phần cần bằng chứng hoặc định vị mạnh hơn.',
  'Top priorities': 'Ưu tiên hàng đầu',
  'The highest-value improvements to focus on first.':
    'Những cải thiện giá trị nhất cần tập trung trước tiên.',
  'Recommended actions': 'Hành động được đề xuất',
  'Concrete things you can do to strengthen the application.':
    'Những việc cụ thể bạn có thể làm để củng cố hồ sơ ứng tuyển.',
  'Why it matters': 'Vì sao điều này quan trọng',
  'The reasoning behind each recommendation.': 'Lý do đằng sau mỗi đề xuất.',
  'What comes next': 'Bước tiếp theo',
  'A clear sequence so you always know the next move.':
    'Một trình tự rõ ràng để bạn luôn biết bước tiếp theo là gì.',
  'Remaining gaps': 'Khoảng trống còn lại',
  'Document check': 'Kiểm tra tài liệu',
  'Final recommendation': 'Đề xuất cuối cùng',
  'GlowBal ·': 'GlowBal ·',
};
