/**
 * Final Application Check — EN→VI translations.
 *
 * ─── TRANSLATION RULE ────────────────────────────────────────────────────────
 *
 * The readiness figure describes MỨC ĐỘ HOÀN THIỆN of the application. It is
 * never a prediction of the outcome (KHẢ NĂNG ĐỖ) and never advice about
 * whether to submit. No string here may drift into either, in either language —
 * see READINESS_DISCLAIMER and core principle 7.
 *
 * The readiness state labels are deliberately about the work, not the verdict:
 * "Nearly there" is about how much is left to do, not about admission.
 */
export const FINAL_CHECK_TRANSLATIONS: Record<string, string> = {
  // Page shell
  'Final check': 'Kiểm tra lần cuối',
  'A last read of {course} as one package: what is complete, what each document is doing, and whether they tell the same story.':
    'Đọc lại {course} như một bộ hồ sơ hoàn chỉnh: phần nào đã xong, mỗi tài liệu đang làm nhiệm vụ gì, và chúng có kể cùng một câu chuyện hay không.',
  'Final Check is not enabled in the database yet.':
    'Kiểm tra lần cuối chưa được kích hoạt trong cơ sở dữ liệu.',
  'Reviewing your application': 'Đang rà soát hồ sơ của bạn',
  'We could not run the check. Please try again.':
    'Chúng tôi chưa chạy được phần kiểm tra. Vui lòng thử lại.',
  'Run final check': 'Chạy kiểm tra lần cuối',
  'Reviewing…': 'Đang rà soát…',
  'Last checked': 'Lần kiểm tra gần nhất',

  // Readiness
  'Overall readiness': 'Mức độ hoàn thiện tổng thể',
  'This measures how complete and consistent your application is right now. It is not a prediction of the outcome, and it is not advice about whether to submit.':
    'Chỉ số này đo mức độ hoàn thiện và nhất quán của hồ sơ ở thời điểm hiện tại. Đây không phải dự đoán kết quả, cũng không phải lời khuyên về việc có nên nộp hay không.',
  '{count} critical finding(s) are still open. Clearing those raises this figure fastest.':
    'Còn {count} phát hiện nghiêm trọng chưa xử lý. Giải quyết những mục này sẽ nâng chỉ số nhanh nhất.',

  // Readiness states
  'Not started': 'Chưa bắt đầu',
  Early: 'Giai đoạn đầu',
  'Taking shape': 'Đang dần thành hình',
  'Nearly there': 'Sắp hoàn thiện',
  Strong: 'Vững vàng',

  // Component inventory
  'What is attached': 'Những gì đã có trong hồ sơ',
  CV: 'CV',
  Essay: 'Bài luận',
  'Letter of recommendation': 'Thư giới thiệu',
  'Supporting materials': 'Tài liệu bổ trợ',
  'Written and reviewed': 'Đã viết và đã được rà soát',
  'Written, not reviewed yet': 'Đã viết, chưa được rà soát',
  'Nothing attached': 'Chưa có tài liệu nào',
  'Not required': 'Không bắt buộc',
  'Ready to review your documents': 'Sẵn sàng rà soát tài liệu của bạn',
  'Not enough to review yet': 'Chưa đủ tài liệu để rà soát',
  'Upload the versions you actually intend to submit. Reviewing an old draft and calling it a final check would be worse than not running one.':
    'Hãy tải lên đúng bản bạn định nộp. Rà soát một bản nháp cũ rồi gọi đó là kiểm tra lần cuối còn tệ hơn là không kiểm tra.',
  'Attach at least two of your application documents, then run the check. With less than that there is nothing to cross-reference.':
    'Hãy bổ sung ít nhất hai tài liệu trong hồ sơ rồi chạy kiểm tra. Ít hơn thế thì không có gì để đối chiếu chéo.',

  // Action-first summary
  Blocker: 'Điểm chặn',
  'Attach {component}': 'Đính kèm {component}',
  'This required component is missing. Attach or upload it before submission.':
    'Thành phần bắt buộc này còn thiếu. Hãy đính kèm hoặc tải lên trước khi nộp hồ sơ.',
  'Critical finding': 'Phát hiện nghiêm trọng',
  'Resolve critical finding in {component}': 'Xử lý phát hiện nghiêm trọng trong {component}',
  'Narrative conflict': 'Mâu thuẫn trong câu chuyện',
  'Resolve conflict: {checkName}': 'Giải quyết mâu thuẫn: {checkName}',
  'Review draft {component}': 'Rà soát bản nháp {component}',
  'This component is currently written as a draft and needs a complete review.':
    'Thành phần này hiện là bản nháp và cần được rà soát đầy đủ.',
  'Strategic action': 'Hành động chiến lược',
  'Strengthen {component}': 'Củng cố {component}',
  Ready: 'Sẵn sàng',
  'Application materials complete': 'Tài liệu hồ sơ đã hoàn tất',
  'All required components are attached and reviewed without critical blockers.':
    'Tất cả thành phần bắt buộc đã được đính kèm và rà soát, không còn điểm chặn nghiêm trọng.',
  'Action-first summary': 'Tóm tắt ưu tiên hành động',
  'Immediate priorities and blockers to address before submitting your application.':
    'Ưu tiên và điểm chặn cần xử lý trước khi nộp hồ sơ.',
  'Priority next action': 'Hành động ưu tiên tiếp theo',
  Blockers: 'Điểm chặn',
  'No missing components. All required documents are attached.':
    'Không còn thành phần thiếu. Tất cả tài liệu bắt buộc đã được đính kèm.',
  'Drafts needing review': 'Bản nháp cần rà soát',
  'No unreviewed drafts. All attached documents have been reviewed.':
    'Không còn bản nháp chưa rà soát. Tất cả tài liệu đính kèm đã được rà soát.',
  'Critical findings & conflicts': 'Phát hiện nghiêm trọng & mâu thuẫn',
  'No critical document findings or narrative conflicts found.':
    'Không tìm thấy phát hiện nghiêm trọng nào trong tài liệu hoặc mâu thuẫn trong câu chuyện.',
  'Run final check to analyze document quality and consistency.':
    'Chạy kiểm tra lần cuối để phân tích chất lượng và tính nhất quán của tài liệu.',

  // Document review
  'Document by document': 'Rà soát từng tài liệu',
  'Each document is judged on what it is meant to do, not on whether it is well written.':
    'Mỗi tài liệu được đánh giá theo nhiệm vụ của nó trong hồ sơ, không phải theo việc viết hay hay dở.',
  Critical: 'Nghiêm trọng',
  Strategic: 'Chiến lược',
  Polish: 'Tinh chỉnh',
  'Materially affects how credible or competitive this application is':
    'Ảnh hưởng đáng kể tới độ tin cậy hoặc sức cạnh tranh của hồ sơ',
  'Meaningfully strengthens the application': 'Giúp hồ sơ mạnh lên rõ rệt',
  'A minor refinement': 'Một điều chỉnh nhỏ',
  'What it needs to do': 'Tài liệu này cần làm được gì',
  'What it currently shows': 'Hiện tại nó đang thể hiện điều gì',
  'Strongest part': 'Phần mạnh nhất',
  'What is missing': 'Điều còn thiếu',
  'How it contributes': 'Đóng góp vào tổng thể hồ sơ',
  'Do this next': 'Việc cần làm tiếp theo',

  // Narrative audit
  'Does it tell one story?': 'Hồ sơ có kể cùng một câu chuyện không?',
  'Your core narrative': 'Câu chuyện cốt lõi của bạn',
  'Themes and where they show up': 'Các chủ đề và nơi chúng xuất hiện',
  Theme: 'Chủ đề',
  Evidence: 'Bằng chứng',
  Consistency: 'Tính nhất quán',
  'Appears in': 'Xuất hiện trong',
  'Nowhere yet': 'Chưa xuất hiện ở đâu',
  Moderate: 'Trung bình',
  Weak: 'Yếu',
  'Consistency checks': 'Các kiểm tra nhất quán',
  Identity: 'Bản sắc',
  Motivation: 'Động lực',
  'Factual detail': 'Chi tiết dữ kiện',
  Direction: 'Định hướng',
  Consistent: 'Nhất quán',
  'Minor conflict': 'Mâu thuẫn nhỏ',
  Conflict: 'Mâu thuẫn',
  'Claims your documents do not yet back up': 'Những điều hồ sơ chưa chứng minh được',
  'These are the parts a reader is most likely to question.':
    'Đây là những phần người đọc dễ đặt câu hỏi nhất.',
  'Unsupported statements': 'Những khẳng định chưa có bằng chứng',
  'Themes taking up too much space': 'Những chủ đề đang chiếm quá nhiều chỗ',
  'What this check could not cover': 'Những gì lần kiểm tra này chưa bao quát được',
};
