/**
 * Translations for the redesigned application setup flow — Review Profile,
 * Activities & Achievements (activity reflection + AI Reflection Card),
 * Personal Reflection, and the Review & Confirm additions. Kept in its own
 * module for the same reason `i18n-personal-report.ts` is: a large,
 * self-contained surface stays easy to find rather than growing the base
 * dictionary file.
 */
export const APPLICATION_FLOW_TRANSLATIONS: Record<string, string> = {
  // Achievements & activities evidence form controls
  'City / Local': 'Tỉnh / Thành phố',
  Regional: 'Khu vực',
  Community: 'Cộng đồng',
  Organisation: 'Tổ chức',
  'Academic award': 'Giải thưởng học thuật',
  'Research / publication': 'Nghiên cứu khoa học / Bài báo được xuất bản',
  'Certificate / recognition': 'Bằng khen / Giấy khen',
  'Community volunteering / project (core role, measurable impact)':
    'Hoạt động tình nguyện / Dự án cộng đồng (vai trò cốt lõi, tác động đo lường được)',
  'Club / team leadership (President, lead, project founder... 6+ months)':
    'Lãnh đạo CLB / Đội nhóm (Chủ tịch, Trưởng ban, Founder dự án... từ 6 tháng trở lên)',
  'Personal project / startup / social initiative (created a concrete product, service, or movement)':
    'Dự án cá nhân / Khởi nghiệp / Sáng kiến xã hội (tạo ra sản phẩm, dịch vụ hoặc phong trào cụ thể)',
  'Internship / company / NGO project (at least 1-2 months)':
    'Thực tập / Dự án tại Doanh nghiệp / Tổ chức phi chính phủ (tối thiểu 1-2 tháng)',
  'Mentoring / tutoring students (at least 3-6 months)':
    'Cố vấn / Dạy kèm học sinh (ít nhất 3-6 tháng)',
  'Upload failed. Please try again.': 'Tải lên thất bại. Vui lòng thử lại.',
  'For example: Hanoi City Mathematics Olympiad': 'Ví dụ: Olympic Toán học Thành phố Hà Nội',
  'For example: Vietnam Mathematical Society / VNU': 'Ví dụ: Hội Toán học Việt Nam / ĐHQG',
  'For example: Green Summer Campaign': 'Ví dụ: Chiến dịch Mùa hè xanh',
  'For example: Organising Committee Lead': 'Ví dụ: Trưởng ban Tổ chức',
  'For example: High School Union': 'Ví dụ: Đoàn trường THPT',
  'For example: 06/2024 – 08/2024': 'Ví dụ: 06/2024 - 08/2024',
  'No matching options': 'Không có lựa chọn phù hợp',
  'or drag and drop it here (PDF, DOCX, up to 10MB)': 'hoặc kéo thả vào đây (PDF, DOCX, tối đa 10MB)',
  'Analysing and extracting achievements automatically...': 'Đang phân tích và tự động trích xuất thành tích...',
  'Delete file': 'Xóa tệp',
  'If you do not have a CV, you can enter the information below': 'Nếu chưa có CV có thể tự nhập thông tin ở dưới',
  'Remove this card': 'Xóa thẻ này',
  'Help / Guidance': 'Trợ giúp / Hướng dẫn',
  'How to fill this in': 'Hướng dẫn điền thông tin',
  'Upload a CV (PDF, DOCX) so the system can identify and quickly fill your awards, projects, and activities. Or enter each achievement manually in the fields below.':
    'Bạn có thể tải lên tệp CV (PDF, DOCX) để hệ thống tự động nhận diện và điền nhanh các giải thưởng, dự án và hoạt động của bạn. Hoặc bạn có thể tự nhập tay từng thành tích vào các ô bên dưới.',
  'Supporting evidence (certificates, awards, and publications) helps GlowBal build a more reliable application strategy.':
    'Các minh chứng đính kèm (giấy khen, chứng chỉ, bài báo) sẽ giúp tăng độ tin cậy khi GlowBal xây dựng chiến lược ứng tuyển.',

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

  // Activity Reflection — Dimension Guidance Prompts
  //
  // NOTE: the per-category main-question headings that used to live here
  // (the original seven-category system's "Headings per category" block)
  // were removed — they are superseded by the "Approved question bank"
  // entries further down for the current four-category system, and having
  // both caused duplicate-key TypeScript errors after a merge. The guidance
  // bullets below are still current: `OTHER_QUESTIONS` in
  // `activity-reflection.ts` reuses this exact wording.
  'What was the situation before you got involved?': 'Tình hình trước khi bạn tham gia như thế nào?',
  'What made this moment or opportunity worth acting on?': 'Điều gì khiến cơ hội hoặc thời điểm này đáng để bạn hành động?',
  'What made this matter to you personally?': 'Điều gì khiến việc này có ý nghĩa cá nhân đối với bạn?',
  'Was there a moment that made you decide to commit?': 'Có khoảnh khắc nào khiến bạn quyết định dốc lòng thực hiện không?',
  'What options did you consider?': 'Bạn đã cân nhắc những lựa chọn nào?',
  'Why was it difficult?': 'Tại sao quyết định đó lại khó khăn?',
  'What did you personally do, step by step?': 'Bạn đã đích thân làm những gì, từng bước một?',
  'What decisions were yours to make?': 'Những quyết định quan trọng nào do chính bạn đưa ra?',
  'What changed as a result — for you, for others, or for the project?': 'Kết quả đã thay đổi điều gì — cho bạn, cho người khác, hay cho dự án?',
  'How do you know it worked?': 'Làm thế nào bạn biết giải pháp của mình đã phát huy hiệu quả?',
  'What do you understand or do differently now?': 'Bây giờ bạn đã hiểu hoặc làm điều gì khác biệt so với trước?',
  'What surprised you about yourself?': 'Điều gì ở bản thân khiến bạn bất ngờ nhất?',
  'How does this connect to what you want to study or do next?': 'Điều này liên hệ như thế nào với những gì bạn muốn học hoặc làm tiếp theo?',
  'What would you carry forward from this experience?': 'Bạn sẽ mang theo bài học hoặc giá trị gì từ trải nghiệm này?',

  // Activity Reflection — Inspiration Scaffolding Templates
  'One way to structure your answer: "Before I got involved, [situation]. I noticed / was asked to help with [opportunity] because [reason]."':
    'Gợi ý cấu trúc câu trả lời: "Trước khi tôi tham gia, [bối cảnh/tình hình]. Tôi nhận thấy / được nhờ giúp đỡ về [cơ hội/vấn đề] vì [lý do]."',
  'One way to structure your answer: "This mattered to me because [personal reason]. I decided to commit when [moment/realisation]."':
    'Gợi ý cấu trúc câu trả lời: "Điều này có ý nghĩa với tôi vì [lý do cá nhân]. Tôi quyết định dốc lòng thực hiện khi [khoảnh khắc/nhận thức]."',
  'One way to structure your answer: "The hardest part was [difficulty] because [reason]. I considered [option A] and [option B]."':
    'Gợi ý cấu trúc câu trả lời: "Phần khó nhất là [trở ngại] vì [lý do]. Tôi đã cân nhắc [phương án A] và [phương án B]."',
  'One way to structure your answer: "I personally [specific action], which involved [step 1], [step 2] and [step 3]."':
    'Một cách gợi ý để viết câu trả lời: "Tôi đã đích thân [hành động cụ thể], bao gồm [bước 1], [bước 2] và [bước 3]."',
  'One way to structure your answer: "As a result, [what changed] for [who/what]. I know this because [evidence, even if it\'s a comment or reaction rather than a number]."':
    'Gợi ý cấu trúc câu trả lời: "Kết quả là, [điều thay đổi] đối với [ai/cái gì]. Tôi biết điều này nhờ [minh chứng/phản hồi nhận được]."',
  'One way to structure your answer: "I used to [old way of thinking/doing]. Now I [new understanding or behaviour], which surprised me because [reason]."':
    'Gợi ý cấu trúc câu trả lời: "Trước đây tôi từng [cách nghĩ/cách làm cũ]. Giờ đây tôi [suy nghĩ/hành động mới], điều này khiến tôi bất ngờ vì [lý do]."',
  'One way to structure your answer: "This connects to what I want to study/do next because [reason]. I want to carry [specific lesson] forward."':
    'Gợi ý cấu trúc câu trả lời: "Điều này gắn liền với ngành học/định hướng tương lai của tôi vì [lý do]. Tôi muốn mang theo [bài học cụ thể] cho chặng đường tới."',

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
  'Sample answer': 'Câu trả lời mẫu',
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

  // Personal Reflection — current seven-question set
  'What You Enjoy Exploring': 'Điều bạn thích khám phá',
  'What topics, activities, or problems do you genuinely enjoy exploring? Why do you find them interesting?':
    'Những chủ đề, hoạt động hoặc vấn đề nào bạn thực sự thích tìm hiểu? Vì sao chúng khiến bạn quan tâm?',
  'Think about what you enjoy learning, discussing, researching, or doing even without being asked.':
    'Hãy nghĩ về điều bạn thích học hỏi, thảo luận, nghiên cứu hoặc thực hiện ngay cả khi không ai yêu cầu.',
  'Mention what specifically interests you and why.':
    'Hãy nêu rõ điều gì thu hút bạn và vì sao.',
  'I often find myself reading about how technology can improve education. I like thinking about why some students struggle with traditional learning and how technology could make learning more personalised.':
    'Tôi thường tìm đọc về cách công nghệ có thể cải thiện giáo dục. Tôi thích suy nghĩ về lý do một số học sinh gặp khó khăn với cách học truyền thống và cách công nghệ có thể cá nhân hóa việc học.',

  'A Perspective-Changing Experience': 'Một trải nghiệm thay đổi góc nhìn',
  'What is one experience that has changed the way you think or see yourself? What happened, and how did it change you?':
    'Trải nghiệm nào đã thay đổi cách bạn suy nghĩ hoặc nhìn nhận bản thân? Điều gì đã xảy ra và nó thay đổi bạn ra sao?',
  'This could be a challenge, a project, a volunteer experience, a competition, or even a personal moment.':
    'Đó có thể là một thử thách, dự án, trải nghiệm tình nguyện, cuộc thi hoặc một khoảnh khắc cá nhân.',
  'Briefly explain what happened, what you realised, and how it changed your mindset, values, or actions.':
    'Hãy tóm tắt điều đã xảy ra, điều bạn nhận ra và cách nó thay đổi tư duy, giá trị hoặc hành động của bạn.',
  'Volunteering at an English class for visually impaired students changed how I viewed accessibility. I realised that many difficulties came not from the students’ abilities, but from how the learning environment was designed.':
    'Việc tình nguyện tại một lớp tiếng Anh cho học sinh khiếm thị đã thay đổi cách tôi nhìn về khả năng tiếp cận. Tôi nhận ra nhiều khó khăn không đến từ năng lực của các bạn, mà từ cách môi trường học tập được thiết kế.',

  'A Problem You Care About': 'Một vấn đề bạn quan tâm',
  'What is one problem in your school, community, or society that you genuinely care about? Who is affected, and why does this problem matter to you?':
    'Một vấn đề ở trường, cộng đồng hoặc xã hội mà bạn thực sự quan tâm là gì? Ai bị ảnh hưởng và vì sao vấn đề này quan trọng với bạn?',
  'Name one specific problem, who is affected, and why you personally care about it.':
    'Hãy nêu một vấn đề cụ thể, những ai bị ảnh hưởng và lý do cá nhân khiến bạn quan tâm.',
  'It can come from your school, community, industry, or personal experience.':
    'Vấn đề này có thể xuất phát từ trường học, cộng đồng, ngành nghề hoặc trải nghiệm cá nhân của bạn.',
  'I care about the lack of career guidance for high school students in smaller cities. Many students have limited exposure to different careers, so they often choose majors based on what their families or friends recommend.':
    'Tôi quan tâm đến việc thiếu định hướng nghề nghiệp cho học sinh trung học ở các thành phố nhỏ. Nhiều bạn ít được tiếp cận với các nghề nghiệp khác nhau nên thường chọn ngành theo lời khuyên của gia đình hoặc bạn bè.',

  'What You Are Proud Of': 'Điều bạn tự hào',
  'What is something you have built, improved, solved, or helped others achieve that you are genuinely proud of? What did you personally do?':
    'Bạn đã xây dựng, cải thiện, giải quyết hoặc giúp người khác đạt được điều gì mà bạn thực sự tự hào? Bạn đã trực tiếp làm gì?',
  'Choose something where you made a meaningful contribution.':
    'Hãy chọn một việc mà bạn đã đóng góp một cách có ý nghĩa.',
  'Explain what you did, the challenge you faced, and what changed because of your work. Add numbers if possible.':
    'Hãy giải thích điều bạn đã làm, thử thách bạn gặp phải và điều gì thay đổi nhờ công việc của bạn. Thêm số liệu nếu có thể.',
  'I am most proud of a financial literacy workshop I organised for middle school students. I redesigned the activities into an investment simulation and led a five-person team to deliver the programme to over 100 students.':
    'Tôi tự hào nhất về một buổi học về kiến thức tài chính mà tôi tổ chức cho học sinh trung học cơ sở. Tôi thiết kế lại hoạt động thành mô phỏng đầu tư và dẫn dắt nhóm năm người triển khai chương trình cho hơn 100 học sinh.',

  'Why This Major': 'Vì sao chọn ngành này',
  'Why did you choose your intended major?': 'Vì sao bạn chọn ngành học dự định?',
  'Describe the experience, interest, or problem that led you to this field.':
    'Hãy mô tả trải nghiệm, mối quan tâm hoặc vấn đề đã đưa bạn đến với lĩnh vực này.',
  'Explain what you hope to learn and how those skills could help solve problems you care about.':
    'Hãy giải thích điều bạn muốn học và cách các kỹ năng đó có thể giúp giải quyết những vấn đề bạn quan tâm.',
  'I want to use technology and business to make quality education more accessible to students with disabilities, especially by developing learning products that allow them to study more independently.':
    'Tôi muốn dùng công nghệ và kinh doanh để giúp giáo dục chất lượng dễ tiếp cận hơn với học sinh khuyết tật, đặc biệt thông qua các sản phẩm học tập giúp các bạn học độc lập hơn.',

  'Future Change': 'Thay đổi trong tương lai',
  'What problem or change do you hope to work on in the future?':
    'Bạn hy vọng sẽ giải quyết vấn đề hoặc tạo ra thay đổi gì trong tương lai?',
  'Start with one problem or group of people you care about; you do not need a specific career title yet.':
    'Hãy bắt đầu với một vấn đề hoặc nhóm người bạn quan tâm; bạn chưa cần có một chức danh nghề nghiệp cụ thể.',
  'Imagine what you would like to change, the kind of solution you might create, and who would benefit.':
    'Hãy hình dung điều bạn muốn thay đổi, loại giải pháp bạn có thể tạo ra và những ai sẽ được hưởng lợi.',
  'I want to make quality learning more accessible to students with disabilities. I hope to develop technology-enabled learning products that adapt to different needs rather than expecting every learner to use the same system.':
    'Tôi muốn giúp việc học chất lượng dễ tiếp cận hơn với học sinh khuyết tật. Tôi hy vọng phát triển các sản phẩm học tập ứng dụng công nghệ có thể thích ứng với nhu cầu khác nhau, thay vì buộc mọi người học theo cùng một hệ thống.',

  'Ideal University Environment': 'Môi trường đại học lý tưởng',
  'What kind of university environment would help you become the person you want to be?':
    'Môi trường đại học như thế nào sẽ giúp bạn trở thành con người bạn mong muốn?',
  'Consider how you learn best, who you want to learn with, and what you want to experience outside the classroom.':
    'Hãy cân nhắc cách bạn học tốt nhất, những người bạn muốn học cùng và trải nghiệm bạn muốn có ngoài lớp học.',
  'You might include projects, research, entrepreneurship, competitions, mentorship, or community work.':
    'Bạn có thể đề cập đến dự án, nghiên cứu, khởi nghiệp, cuộc thi, cố vấn hoặc hoạt động cộng đồng.',
  'I want an environment where I can learn through real projects rather than lectures alone. I would like to work with students from different disciplines, receive mentorship, and have opportunities to test ideas through entrepreneurship and community initiatives.':
    'Tôi muốn một môi trường nơi tôi có thể học qua các dự án thực tế thay vì chỉ nghe giảng. Tôi muốn làm việc với sinh viên từ nhiều ngành khác nhau, nhận được sự cố vấn và có cơ hội thử nghiệm ý tưởng qua khởi nghiệp và các sáng kiến cộng đồng.',

  // Personal Reflection — Guidance Prompts (Bullets)
  'Which moments or activities still stand out?': 'Những khoảnh khắc hay hoạt động nào vẫn còn đọng lại rõ nét nhất?',
  'If they had never happened, what might be different about you?':
    'Nếu những điều đó chưa từng xảy ra, bạn nghĩ bản thân mình bây giờ sẽ khác như thế nào?',
  'Which problems, topics or communities do you keep returning to?':
    'Những vấn đề, chủ đề hoặc cộng đồng nào mà bạn luôn muốn quay trở lại tìm hiểu hoặc tham gia?',
  'What would you still spend time on if nobody judged or paid you?':
    'Điều gì bạn vẫn sẵn sàng dành thời gian làm kể cả khi không ai đánh giá hay trả công?',
  'When were you genuinely proud of your contribution?':
    'Khi nào bạn cảm thấy thực sự tự hào về sự đóng góp của chính mình?',
  'What role do you naturally seem to take on?':
    'Bạn thường tự nhiên đảm nhận vai trò gì khi ở trong một tập thể?',
  'What happened?': 'Chuyện gì đã xảy ra?',
  'What became different about you afterwards?':
    'Sau sự kiện đó, bạn đã trở nên khác biệt như thế nào?',
  'Who or what would you want your work to benefit?':
    'Bạn muốn công việc của mình mang lại lợi ích cho ai hoặc điều gì?',
  'Why does that matter personally?':
    'Tại sao điều đó lại có ý nghĩa đặc biệt với cá nhân bạn?',

  // Step 4 — Review & Confirm additions
  Experiences: 'Trải nghiệm',
  'Experiences confirmed': 'Trải nghiệm đã xác nhận',
  'Activities added': 'Hoạt động đã thêm',
  'Reflection Cards': 'Thẻ Suy ngẫm',
  '{count} confirmed': '{count} đã xác nhận',
  'Questions completed': 'Câu hỏi đã hoàn thành',
  '{count} of {total}': '{count}/{total}',

  // ─── UX/content correction pass — navigation, breadcrumbs, four-category
  // taxonomy, low-effort reflection UX (see docs/current-status.md) ──────────

  // Application-return navigation
  '{section} updated': 'Đã cập nhật {section}',

  // "Application setup" stepper
  'Personal reflection': 'Suy ngẫm cá nhân',

  // Reflection status vocabulary (activity/achievement cards)
  'Reflection not started': 'Chưa bắt đầu suy ngẫm',
  'Reflection in progress · {answered}/{total}': 'Đang suy ngẫm · {answered}/{total}',
  'Reflection complete': 'Đã hoàn tất suy ngẫm',
  'Generating Reflection Card…': 'Đang tạo Thẻ Suy ngẫm…',
  'Review Reflection Card': 'Xem lại Thẻ Suy ngẫm',
  Confirmed: 'Đã xác nhận',

  // Three-level disclosure reflection UX
  'Tell us what happened in your own words…': 'Hãy kể lại chuyện gì đã xảy ra bằng lời của chính bạn…',
  'You don’t need polished answers. A few honest sentences is enough.':
    'Bạn không cần câu trả lời hoàn hảo. Vài câu thật lòng là đủ.',
  'Help me think': 'Giúp tôi suy nghĩ',
  'Hide help': 'Ẩn gợi ý',
  'One way you could structure your answer:': 'Một cách bạn có thể sắp xếp câu trả lời:',

  // Four approved top-level experience categories + subtypes
  'Community Impact': 'Tác động cộng đồng',
  'Volunteering, service, fundraising, social impact': 'Tình nguyện, phục vụ cộng đồng, gây quỹ, tác động xã hội',
  'Clubs, teams, organising, founding and leadership': 'Câu lạc bộ, đội nhóm, tổ chức, sáng lập và lãnh đạo',
  'Projects, research, startups and hackathons': 'Dự án, nghiên cứu, khởi nghiệp và hackathon',
  'Academic & Personal Growth': 'Học thuật & Phát triển bản thân',
  'Competitions, learning, courses and certifications': 'Cuộc thi, học tập, khóa học và chứng chỉ',
  'Volunteering & community service': 'Tình nguyện & phục vụ cộng đồng',
  'Leadership & initiative': 'Lãnh đạo & sáng kiến',
  'Advising & tutoring': 'Cố vấn & gia sư',
  'Project, startup or hackathon': 'Dự án, khởi nghiệp hoặc hackathon',
  'Research & publications': 'Nghiên cứu & công bố khoa học',
  'Competition & Olympiad': 'Cuộc thi & Olympiad',
  'Academic award & prize': 'Giải thưởng học thuật',
  'Independent learning & personal growth': 'Tự học & phát triển bản thân',
  'What best describes it?': 'Điều gì mô tả đúng nhất?',
  'What kind of experience was this?': 'Đây là loại trải nghiệm gì?',

  // Approved question bank — Community Impact
  'What issue or need did you notice in the community?': 'Bạn đã nhận thấy vấn đề hoặc nhu cầu gì trong cộng đồng?',
  'Why did you choose to participate?': 'Vì sao bạn chọn tham gia?',
  'What was the hardest obstacle you encountered?': 'Trở ngại khó khăn nhất bạn gặp phải là gì?',
  'How did you respond to that challenge?': 'Bạn đã phản ứng thế nào trước thử thách đó?',
  'What changed because of your contribution?': 'Điều gì đã thay đổi nhờ đóng góp của bạn?',
  'How did this experience change the way you see yourself or your community?':
    'Trải nghiệm này đã thay đổi cách bạn nhìn nhận bản thân hoặc cộng đồng như thế nào?',
  'How will this influence your future direction?': 'Điều này sẽ ảnh hưởng thế nào đến định hướng tương lai của bạn?',

  // Approved question bank — Leadership & Initiative
  'What responsibility or opportunity did you take on?': 'Bạn đã đảm nhận trách nhiệm hoặc cơ hội gì?',
  'Why did you choose to participate (and even take the lead)?':
    'Vì sao bạn chọn tham gia (và thậm chí đứng ra dẫn dắt)?',
  'What was the toughest leadership decision you had to make?':
    'Quyết định lãnh đạo khó khăn nhất bạn từng phải đưa ra là gì?',
  'How did you lead your team through that situation?': 'Bạn đã dẫn dắt đội nhóm vượt qua tình huống đó như thế nào?',
  'How did your leadership influence the team or project?':
    'Vai trò lãnh đạo của bạn đã ảnh hưởng thế nào đến đội nhóm hoặc dự án?',
  'What kind of leader did this experience help you become?': 'Trải nghiệm này đã giúp bạn trở thành người lãnh đạo như thế nào?',

  // Approved question bank — Innovation & Projects
  'What problem inspired you to start this project?': 'Vấn đề gì đã truyền cảm hứng để bạn bắt đầu dự án này?',
  'Why did you decide to solve this problem yourself?': 'Vì sao bạn quyết định tự mình giải quyết vấn đề này?',
  'How did you develop or improve your solution?': 'Bạn đã phát triển hoặc cải tiến giải pháp của mình như thế nào?',
  'What difference did your solution make?': 'Giải pháp của bạn đã tạo ra khác biệt gì?',
  'What did building this project teach you about solving problems?':
    'Việc xây dựng dự án này đã dạy bạn điều gì về cách giải quyết vấn đề?',
  'How has this project influenced what you want to build or study next?':
    'Dự án này đã ảnh hưởng thế nào đến điều bạn muốn xây dựng hoặc học tiếp theo?',

  // Approved question bank — Academic & Personal Growth
  'What challenge or goal were you pursuing?': 'Bạn đã theo đuổi thử thách hoặc mục tiêu gì?',
  'Why was this goal important to you?': 'Vì sao mục tiêu này quan trọng với bạn?',
  'What moment tested your perseverance the most?': 'Khoảnh khắc nào thử thách sự kiên trì của bạn nhiều nhất?',
  'What did you do to keep improving?': 'Bạn đã làm gì để tiếp tục cải thiện?',
  'What did you achieve, and what does that achievement represent to you?':
    'Bạn đã đạt được điều gì, và thành tích đó có ý nghĩa gì với bạn?',
  'How has this experience changed the way you approach learning or challenges?':
    'Trải nghiệm này đã thay đổi cách bạn tiếp cận việc học hoặc thử thách như thế nào?',

  // Approved question bank — legacy "other" fallback
  'What was the situation, and how did you become part of it?':
    'Tình huống đó là gì, và bạn đã trở thành một phần của nó như thế nào?',
  'Why did this matter enough to you to get involved?': 'Vì sao điều này đủ quan trọng để bạn tham gia?',
  'What was the hardest part?': 'Phần khó khăn nhất là gì?',
  'What did you personally do?': 'Bạn đã đích thân làm gì?',
  'What changed as a result?': 'Điều gì đã thay đổi sau đó?',
  'How did it change you?': 'Điều đó đã thay đổi bạn như thế nào?',
  'How does it connect to what you want to do next?': 'Điều đó liên quan thế nào đến điều bạn muốn làm tiếp theo?',
};
