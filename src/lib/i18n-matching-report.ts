/**
 * Matching Report — EN→VI translations.
 *
 * Kept out of the base dictionary for the same reason the Personal Report and
 * Strategy Hub catalogs are: this is one large report surface, and folding ~50
 * report-specific strings into the navigation/product dictionary makes both
 * harder to maintain. Merged in `i18n-catalog.ts`.
 *
 * ─── TRANSLATION RULE FOR THE SCORE COPY ─────────────────────────────────────
 *
 * The Vietnamese must carry the same guarantee the English does: the match
 * figure describes ĐỘ PHÙ HỢP (alignment), never KHẢ NĂNG ĐỖ (chance of
 * admission). Do not "improve" these strings into anything that reads as a
 * prediction — see core principle 7 and MATCH_SCORE_DISCLAIMER.
 */
export const MATCHING_REPORT_TRANSLATIONS: Record<string, string> = {
  // Classification bands
  Safety: 'An toàn',
  'Strong match': 'Rất phù hợp',
  Match: 'Phù hợp',
  Reach: 'Thử sức',
  'Currently ineligible': 'Hiện chưa đủ điều kiện',
  'Not enough data to place you': 'Chưa đủ dữ liệu để xếp nhóm',

  'Your academic standing sits clearly above this programme’s usual admitted range.':
    'Năng lực học thuật của bạn cao hơn rõ rệt so với mức trúng tuyển thường thấy của chương trình này.',
  'You sit comfortably inside this programme’s usual admitted range.':
    'Bạn nằm ở mức trên trong khoảng trúng tuyển thường thấy của chương trình này.',
  'You sit within this programme’s usual admitted range.':
    'Bạn nằm trong khoảng trúng tuyển thường thấy của chương trình này.',
  'Your academic standing is below this programme’s usual admitted range. You can still apply.':
    'Năng lực học thuật của bạn thấp hơn khoảng trúng tuyển thường thấy của chương trình này. Bạn vẫn có thể nộp hồ sơ.',
  'One or more entry requirements are not met yet. This is about eligibility, not about how strong you are.':
    'Có ít nhất một điều kiện đầu vào chưa đạt. Đây là vấn đề điều kiện dự tuyển, không phải đánh giá năng lực của bạn.',
  'This programme publishes no usable admitted-grade range, so we will not guess at a band.':
    'Chương trình này không công bố khoảng điểm trúng tuyển có thể dùng được, nên chúng tôi sẽ không đoán nhóm xếp hạng.',

  // Dimension labels
  'Academic fit': 'Mức phù hợp học thuật',
  'Programme and values fit': 'Mức phù hợp với chương trình và giá trị cá nhân',
  'Career vision fit': 'Mức phù hợp với định hướng nghề nghiệp',
  'Financial feasibility': 'Khả năng tài chính',
  'Application readiness': 'Mức sẵn sàng của hồ sơ',

  // Dimension meanings
  'Grades, coursework and academic achievements against what this programme expects':
    'Điểm số, môn học và thành tích học thuật so với yêu cầu của chương trình',
  'How your experiences, interests and motivations line up with how this course teaches':
    'Trải nghiệm, mối quan tâm và động lực của bạn khớp đến đâu với cách chương trình này giảng dạy',
  'Whether where this programme leads matches where you have said you want to go':
    'Hướng đi mà chương trình này dẫn tới có khớp với định hướng bạn đã nêu hay không',
  'Cost against your stated budget and the funding realistically available':
    'Chi phí so với ngân sách bạn đã nêu và nguồn tài trợ thực tế có thể có',
  'How much of the application itself is ready — tests, documents, portfolio':
    'Hồ sơ của bạn đã sẵn sàng đến đâu — bài thi, giấy tờ, portfolio',

  // The score disclaimer. Alignment, never likelihood.
  'This measures how closely your profile aligns with what this programme looks for. It is not a prediction of whether you will be admitted.':
    'Chỉ số này đo mức độ hồ sơ của bạn phù hợp với những gì chương trình tìm kiếm. Đây không phải dự đoán về việc bạn có được nhận hay không.',

  // Alignment levels
  High: 'Cao',
  Moderate: 'Trung bình',
  Emerging: 'Đang hình thành',
  'Not assessed': 'Chưa đánh giá',

  // Eligibility
  'Required subjects': 'Môn học bắt buộc',
  'Minimum qualification': 'Bằng cấp tối thiểu',
  'Language requirement': 'Yêu cầu ngoại ngữ',
  'Citizenship or residency': 'Quốc tịch hoặc cư trú',
  'Application deadline': 'Hạn nộp hồ sơ',
  Met: 'Đạt',
  'Not met': 'Chưa đạt',
  'We could not check this': 'Chúng tôi chưa kiểm tra được mục này',

  // Section navigation
  'Report sections': 'Các phần của báo cáo',
  'Overall match': 'Mức phù hợp tổng thể',
  'Why you match': 'Vì sao bạn phù hợp',
  'Entry requirements': 'Điều kiện đầu vào',
  'Gaps and risks': 'Khoảng trống và rủi ro',
  'Admissions view': 'Góc nhìn tuyển sinh',
  'What next': 'Bước tiếp theo',

  // Matching Report V2 reading order
  'Current Alignment Snapshot': 'Tóm tắt mức phù hợp hiện tại',
  'Alignment score': 'Điểm phù hợp',
  'No aggregate score is available until this fit has enough evidence.':
    'Chưa có điểm tổng hợp cho đến khi phần phù hợp này có đủ bằng chứng.',
  'Evidence coverage': 'Mức độ bao phủ bằng chứng',
  'Alignment level': 'Mức phù hợp',
  'Strong current alignment': 'Mức phù hợp hiện tại cao',
  'Moderate current alignment': 'Mức phù hợp hiện tại trung bình',
  'Limited current alignment': 'Mức phù hợp hiện tại hạn chế',
  'Critical Requirements': 'Điều kiện quan trọng',
  'No hard requirements were recorded.': 'Chưa ghi nhận điều kiện bắt buộc nào.',
  'Strongest Alignment Areas': 'Các điểm phù hợp mạnh nhất',
  'Important Gaps': 'Khoảng trống quan trọng',
  'Programme Criteria Breakdown': 'Phân tích từng tiêu chí chương trình',
  'Positioning Opportunities': 'Cơ hội định vị hồ sơ',
  'Scholarship Alignment': 'Mức phù hợp học bổng',
  'Evidence that improves assessment': 'Bằng chứng giúp đánh giá chính xác hơn',
  'Evidence references': 'Mã bằng chứng',
  'Programme source references': 'Mã nguồn tiêu chí chương trình',
  'Evidence needed': 'Bằng chứng cần bổ sung',
  'No positioning opportunities were recorded.': 'Chưa ghi nhận cơ hội định vị hồ sơ.',
  'No additional evidence was requested.': 'Không có yêu cầu bổ sung bằng chứng.',
  'Add a verified source for this criterion.': 'Bổ sung nguồn đã xác minh cho tiêu chí này.',
  'Supporting Insights': 'Các phân tích bổ trợ',
  Strengths: 'Điểm mạnh',
  Gaps: 'Khoảng trống',
  'No strengths were recorded.': 'Chưa ghi nhận điểm mạnh nào.',
  'No gaps were recorded.': 'Chưa ghi nhận khoảng trống nào.',
  'Scholarship alignment is unavailable for the selected scholarship.':
    'Chưa có dữ liệu mức phù hợp cho học bổng đã chọn.',
  'No selected scholarship was available for this application, so scholarship alignment was not assessed.':
    'Hồ sơ này chưa chọn học bổng nên chưa đánh giá mức phù hợp học bổng.',
  'Selected scholarship': 'Học bổng đã chọn',
  'Linked metrics': 'Metric liên quan',
  'Applicant evidence': 'Bằng chứng từ hồ sơ',
  'Target sources': 'Nguồn đối chiếu',
  'Evidence records and target sources': 'Bản ghi bằng chứng và nguồn đối chiếu',
  'evidence records': 'bản ghi bằng chứng',
  'target sources': 'nguồn đối chiếu',
  'Source references': 'Mã nguồn',
  'Direct evidence': 'Bằng chứng trực tiếp',
  'No applicant evidence was recorded.': 'Chưa ghi nhận bằng chứng từ hồ sơ.',
  'No target sources were recorded.': 'Chưa ghi nhận nguồn đối chiếu.',
  'University source': 'Nguồn trường đại học',
  'Programme source': 'Nguồn chương trình',
  'Requirement source': 'Nguồn điều kiện',
  'Scholarship source': 'Nguồn học bổng',
  Assessed: 'Đã đánh giá',
  'Limited evidence': 'Bằng chứng còn hạn chế',
  'Not available': 'Chưa có dữ liệu',
  'Evidence status': 'Trạng thái bằng chứng',
  Verified: 'Đã xác minh',
  Unverified: 'Chưa xác minh',
  Conflicting: 'Mâu thuẫn',
  'Report only': 'Chỉ từ báo cáo',
  Submetrics: 'Các chỉ số phụ',
  Reasoning: 'Lý do đánh giá',
  'Missing evidence': 'Bằng chứng còn thiếu',
  Limitations: 'Giới hạn',
  'Overall alignment': 'Mức phù hợp tổng thể',
  'Requirement type': 'Loại điều kiện',
  'Applicant value': 'Giá trị của ứng viên',
  'Required value': 'Giá trị yêu cầu',
  'Deadline status': 'Trạng thái hạn nộp',
  Open: 'Đang mở',
  Passed: 'Đã qua hạn',
  Unknown: 'Chưa rõ',
  'Not provided': 'Chưa cung cấp',
  'Not specified': 'Chưa nêu rõ',
  strong: 'Mạnh',
  moderate: 'Trung bình',
  weak: 'Yếu',
  missing: 'Chưa có bằng chứng',
  critical: 'Nghiêm trọng',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',

  // Section 1
  'Match score': 'Điểm phù hợp',
  'Data confidence': 'Độ tin cậy dữ liệu',
  '{level} alignment with this programme': 'Mức phù hợp {level} với chương trình này',
  'These requirements are not met yet': 'Những điều kiện này hiện chưa đạt',
  'Fixing these matters more than raising any score below.':
    'Xử lý những điều kiện này quan trọng hơn việc nâng bất kỳ điểm số nào bên dưới.',
  'Where you align most': 'Nơi bạn phù hợp nhất',

  // Section 2
  'Five dimensions, scored separately. Only the academic one decides your Reach, Match or Safety band — the rest describe fit without moving it.':
    'Năm khía cạnh được chấm riêng. Chỉ khía cạnh học thuật quyết định nhóm Thử sức, Phù hợp hay An toàn của bạn — các khía cạnh còn lại mô tả mức phù hợp nhưng không làm thay đổi nhóm đó.',
  '{dimension} alignment': 'Mức phù hợp: {dimension}',
  'What supports this': 'Bằng chứng cho điều này',

  // Section 3
  'Whether you can apply at all, which is a different question from how competitive you are. Anything we could not verify is marked as unchecked rather than assumed either way.':
    'Bạn có đủ điều kiện nộp hồ sơ hay không — đây là câu hỏi khác với việc hồ sơ của bạn cạnh tranh đến đâu. Những mục chúng tôi không xác minh được sẽ ghi rõ là chưa kiểm tra, thay vì suy đoán theo bất kỳ hướng nào.',
  'What the course publishes': 'Thông tin chương trình công bố',

  // Section 4
  'Critical gaps sit on the dimensions that carry the most weight and are currently weakest. Competitive gaps are worth closing but are not what is holding this application back.':
    'Khoảng trống nghiêm trọng nằm ở những khía cạnh có trọng số cao nhất và hiện đang yếu nhất. Khoảng trống cạnh tranh vẫn nên khắc phục, nhưng không phải là điều đang cản trở hồ sơ này.',
  'We did not find evidence-backed gaps for this programme.':
    'Chúng tôi không tìm thấy khoảng trống nào có bằng chứng rõ ràng cho chương trình này.',
  'Critical gaps': 'Khoảng trống nghiêm trọng',
  'Competitive gaps': 'Khoảng trống cạnh tranh',

  // Section 5
  'How this reads to an admissions reader': 'Hồ sơ này trông ra sao với người xét tuyển',
  'First impression': 'Ấn tượng đầu tiên',
  'Your strongest dimension here is {dimension}.':
    'Khía cạnh mạnh nhất của bạn ở đây là {dimension}.',
  'What strengthens your application': 'Điều làm hồ sơ của bạn mạnh hơn',
  'No evidence-backed strengths were recorded for this programme yet.':
    'Chưa ghi nhận điểm mạnh nào có bằng chứng rõ ràng cho chương trình này.',
  'What we could not check': 'Những điều chúng tôi chưa kiểm tra được',
  'These are gaps in our information, not judgements about you. Filling them in makes the report sharper.':
    'Đây là những chỗ chúng tôi còn thiếu thông tin, không phải nhận xét về bạn. Bổ sung thêm sẽ giúp báo cáo chính xác hơn.',

  // Section 6
  'What to do next': 'Việc cần làm tiếp theo',
  'Start with the entry requirements above. Until those are met, improving anything else will not change whether this application can be submitted.':
    'Hãy bắt đầu từ các điều kiện đầu vào ở trên. Khi chưa đạt những điều kiện đó, việc cải thiện các phần khác sẽ không thay đổi được khả năng nộp hồ sơ này.',
  'Your highest-impact work is on {dimension}.':
    'Việc mang lại tác động lớn nhất cho bạn nằm ở {dimension}.',
  'Your Strategy Report turns these findings into a prioritised plan and a set of tasks you can work through.':
    'Strategy Report sẽ biến những phát hiện này thành kế hoạch có thứ tự ưu tiên và danh sách việc bạn có thể thực hiện.',
  'Open my Strategy Report': 'Mở Strategy Report của tôi',
  'Go to my Planner': 'Đi tới Planner của tôi',

  // Header, empty state and sources
  'The report checks entry requirements first, then scores academic fit, profile and values, career direction, finances and readiness as separate dimensions.':
    'Báo cáo kiểm tra điều kiện đầu vào trước, sau đó chấm riêng từng khía cạnh: học thuật, hồ sơ và giá trị cá nhân, định hướng nghề nghiệp, tài chính và mức sẵn sàng.',
  'We could not build the report. Please try again.':
    'Chúng tôi chưa tạo được báo cáo. Vui lòng thử lại.',
  'We could not reach the server. Please check your connection and try again.':
    'Không kết nối được tới máy chủ. Vui lòng kiểm tra kết nối và thử lại.',
  'Course details are extracted automatically from the university’s own pages. Check the official page before relying on any figure.':
    'Thông tin chương trình được trích xuất tự động từ trang web của trường. Hãy kiểm tra trang chính thức trước khi dựa vào bất kỳ con số nào.',
};
