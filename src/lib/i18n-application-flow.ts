/**
 * Translations for the redesigned application setup flow — Review Profile,
 * Activities & Achievements (activity reflection + AI Reflection Card),
 * Personal Reflection, and the Review & Confirm additions. Kept in its own
 * module for the same reason `i18n-personal-report.ts` is: a large,
 * self-contained surface stays easy to find rather than growing the base
 * dictionary file.
 */
export const APPLICATION_FLOW_TRANSLATIONS: Record<string, string> = {
  // Step 1 — Review Existing Profile
  'Before we start, check your information': 'Trước khi bắt đầu, hãy kiểm tra thông tin của bạn',
  'We’ve brought across the information you’ve already given GlowBal. Check that everything is still correct before we analyse this application.':
    'Chúng tôi đã mang sang những thông tin bạn đã cung cấp cho GlowBal. Hãy kiểm tra lại mọi thứ vẫn còn chính xác trước khi chúng tôi phân tích hồ sơ này.',
  'Study plans': 'Kế hoạch học tập',
  'Intended study level': 'Bậc học dự định',
  'Subject interests': 'Ngành học quan tâm',
  'Preferred destinations': 'Điểm đến mong muốn',
  'Academic information': 'Thông tin học tập',
  'No curriculum or grades on file yet.': 'Chưa có chương trình học hoặc điểm số nào được lưu.',
  'Comparable GPA': 'GPA quy đổi',
  'No test scores on file yet.': 'Chưa có điểm thi nào được lưu.',
  'Practical information': 'Thông tin thực tế',
  'Funding source': 'Nguồn tài trợ',
  'Study preferences': 'Sở thích học tập',
  'Yes, this information is correct': 'Đúng, thông tin này chính xác',

  // Step 2 — Activities & Achievements: reflect action + reflection modal
  'Reflect on this experience': 'Suy ngẫm về trải nghiệm này',
  'Continue reflection': 'Tiếp tục suy ngẫm',
  'Reflection Card ready': 'Thẻ Suy ngẫm đã sẵn sàng',
  'Reflect on {title}': 'Suy ngẫm về {title}',
  '{current} of {total} · {dimension}': '{current}/{total} · {dimension}',
  'Your answer': 'Câu trả lời của bạn',
  'Write in your own words…': 'Viết bằng lời của chính bạn…',
  'Need inspiration?': 'Cần gợi ý?',
  'Hide example': 'Ẩn ví dụ',
  'Save & exit': 'Lưu & thoát',
  'Finish reflection': 'Hoàn tất suy ngẫm',
  Context: 'Bối cảnh',
  Motivation: 'Động lực',
  Challenge: 'Thử thách',
  Action: 'Hành động',
  Impact: 'Tác động',
  Transformation: 'Sự thay đổi',
  Future: 'Tương lai',
  'What did you personally do?': 'Bạn đã đích thân làm gì?',
  'How did you lead the team through it?': 'Bạn đã dẫn dắt đội nhóm qua việc đó như thế nào?',
  'How did you develop, test or improve your solution?':
    'Bạn đã phát triển, thử nghiệm hoặc cải tiến giải pháp của mình như thế nào?',
  'How did you gather, test, or analyse what you needed?':
    'Bạn đã thu thập, kiểm chứng hoặc phân tích những gì cần thiết như thế nào?',
  'What did you change or do to improve?': 'Bạn đã thay đổi hoặc làm gì để cải thiện?',
  'One way to structure your answer: "I personally [specific action], which involved [step 1], [step 2] and [step 3]."':
    'Một cách gợi ý để viết câu trả lời: "Tôi đã đích thân [hành động cụ thể], bao gồm [bước 1], [bước 2] và [bước 3]."',

  // Reflection Card
  'We saved your reflection, but couldn’t create the summary.':
    'Chúng tôi đã lưu bài suy ngẫm của bạn, nhưng chưa thể tạo bản tóm tắt.',
  'Reflection Card': 'Thẻ Suy ngẫm',
  'Building your Reflection Card': 'Đang xây dựng Thẻ Suy ngẫm của bạn',
  'Here’s how GlowBal understood this experience': 'Đây là cách GlowBal hiểu về trải nghiệm này',
  'Review this before we use it in your reports.':
    'Hãy xem lại trước khi chúng tôi dùng nội dung này trong báo cáo của bạn.',
  Story: 'Câu chuyện',
  'My Contribution': 'Đóng góp của tôi',
  'Demonstrated Skills': 'Kỹ năng thể hiện',
  'Why GlowBal identified this': 'Vì sao GlowBal nhận diện điều này',
  'Key Takeaway': 'Điều rút ra chính',
  'Future Connection': 'Liên hệ tương lai',
  Regenerate: 'Tạo lại',
  'Looks right': 'Đúng rồi',
  'Edit your Reflection Card': 'Chỉnh sửa Thẻ Suy ngẫm của bạn',
  'My Contribution (one per line)': 'Đóng góp của tôi (mỗi dòng một mục)',
  'Evidence (one per line)': 'Minh chứng (mỗi dòng một mục)',
  'Demonstrated Skills — one per line, as "Skill — why"':
    'Kỹ năng thể hiện — mỗi dòng một mục, theo dạng "Kỹ năng — vì sao"',

  // Step 3 — Personal Reflection
  'Personal Reflection': 'Suy ngẫm cá nhân',
  'Think about:': 'Hãy nghĩ về:',
  'Continue to Review & Confirm': 'Tiếp tục đến Xem lại & Xác nhận',
  'This was confirmed on {date} and is used to generate your reports.':
    'Thông tin này đã được xác nhận vào {date} và được dùng để tạo báo cáo của bạn.',
  'Looking back, which experiences have shaped you the most?':
    'Nhìn lại, những trải nghiệm nào đã định hình bạn nhiều nhất?',
  'What keeps pulling your attention, even when nobody asks you to do it?':
    'Điều gì luôn thu hút sự chú ý của bạn, ngay cả khi không ai yêu cầu bạn làm?',
  'Think about your best moments. What made you feel proud, not because of awards, but because of what you accomplished?':
    'Hãy nghĩ về những khoảnh khắc đẹp nhất của bạn. Điều gì khiến bạn tự hào, không phải vì giải thưởng, mà vì những gì bạn đã đạt được?',
  'Think about the biggest challenge you’ve faced. How did it change the way you think or act?':
    'Hãy nghĩ về thử thách lớn nhất bạn từng đối mặt. Nó đã thay đổi cách bạn suy nghĩ hoặc hành động như thế nào?',
  'Imagine yourself 10 years from now. What would make you feel that your work truly mattered?':
    'Hãy tưởng tượng bạn của 10 năm sau. Điều gì sẽ khiến bạn cảm thấy công việc của mình thực sự có ý nghĩa?',

  // Step 4 — Review & Confirm additions
  Experiences: 'Trải nghiệm',
  'Activities added': 'Hoạt động đã thêm',
  'Reflection Cards': 'Thẻ Suy ngẫm',
  '{count} confirmed': '{count} đã xác nhận',
  'Questions completed': 'Câu hỏi đã hoàn thành',
  '{count} of {total}': '{count}/{total}',
};
