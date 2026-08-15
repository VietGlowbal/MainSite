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

  // Activity Reflection — Headings per category
  'What issue or need did you notice?': 'Bạn đã nhận thấy vấn đề hoặc nhu cầu nào?',
  'Why did you choose to get involved?': 'Tại sao bạn lại chọn tham gia?',
  'What was the hardest obstacle?': 'Trở ngại khó khăn nhất là gì?',
  'What did you personally do?': 'Bạn đã đích thân làm gì?',
  'What changed because of your contribution?': 'Điều gì đã thay đổi nhờ sự đóng góp của bạn?',
  'How did the experience change you?': 'Trải nghiệm đó đã thay đổi bạn như thế nào?',
  'How will it influence what you do next?': 'Nó sẽ ảnh hưởng thế nào đến những dự định tiếp theo của bạn?',

  'What responsibility or opportunity did you take on?': 'Bạn đã đảm nhận trách nhiệm hoặc cơ hội nào?',
  'Why did you decide to step up or lead?': 'Tại sao bạn quyết định đứng lên dẫn dắt?',
  'What was the toughest leadership decision you faced?': 'Quyết định lãnh đạo khó khăn nhất bạn từng đối mặt là gì?',
  'How did you lead the team through it?': 'Bạn đã dẫn dắt đội nhóm qua việc đó như thế nào?',
  'How did your leadership affect the team or project?': 'Sự lãnh đạo của bạn đã ảnh hưởng thế nào đến đội nhóm hoặc dự án?',
  'What kind of leader did this experience help you become?': 'Trải nghiệm này đã giúp bạn trở thành người lãnh đạo như thế nào?',
  'How will this influence the way you lead in future?': 'Nó sẽ ảnh hưởng thế nào đến phong cách lãnh đạo của bạn trong tương lai?',

  'What problem inspired you to start this project?': 'Vấn đề nào đã truyền cảm hứng để bạn bắt đầu dự án này?',
  'Why did you want to solve it?': 'Tại sao bạn lại muốn giải quyết vấn đề đó?',
  'What was the hardest part of making the idea work?': 'Phần khó nhất khi hiện thực hóa ý tưởng này là gì?',
  'How did you develop, test or improve your solution?':
    'Bạn đã phát triển, thử nghiệm hoặc cải tiến giải pháp của mình như thế nào?',
  'What difference did the solution make?': 'Giải pháp đó đã tạo ra sự khác biệt gì?',
  'What did building it teach you about solving problems?': 'Quá trình xây dựng dự án đã dạy cho bạn điều gì về cách giải quyết vấn đề?',
  'What has it made you want to build or study next?': 'Nó khiến bạn muốn tạo ra hoặc nghiên cứu điều gì tiếp theo?',

  'What question or gap did you set out to investigate?': 'Câu hỏi hoặc khoảng trống nghiên cứu nào bạn đã đặt ra để tìm hiểu?',
  'Why was this question worth pursuing to you?': 'Tại sao câu hỏi này lại đáng để bạn theo đuổi?',
  'Where did the evidence or method get hardest to pin down?': 'Giai đoạn nào trong việc thu thập chứng cứ hoặc phương pháp là khó xác định nhất?',
  'How did you gather, test, or analyse what you needed?':
    'Bạn đã thu thập, kiểm chứng hoặc phân tích những gì cần thiết như thế nào?',
  'What did you find, and what does it explain?': 'Bạn đã phát hiện ra điều gì, và nó giải thích cho vấn đề gì?',
  'How did it change the way you evaluate a claim or a problem?': 'Nó đã thay đổi cách bạn đánh giá một nhận định hoặc một vấn đề như thế nào?',
  'How does it shape what you want to study or research next?': 'Nó định hình những gì bạn muốn theo học hoặc nghiên cứu tiếp theo như thế nào?',

  'What challenge or goal were you pursuing?': 'Thử thách hoặc mục tiêu nào bạn đã theo đuổi?',
  'Why was the goal important to you?': 'Tại sao mục tiêu đó lại quan trọng đối với bạn?',
  'What moment tested your perseverance the most?': 'Khoảnh khắc nào đã thử thách sự kiên trì của bạn nhiều nhất?',
  'What did you change or do to improve?': 'Bạn đã thay đổi hoặc làm gì để cải thiện?',
  'What did you achieve, and what did it represent?': 'Bạn đã đạt được kết quả gì, và nó đại diện cho điều gì?',
  'How did it change the way you approach learning or challenges?': 'Nó đã thay đổi cách bạn tiếp cận việc học hoặc đối mặt với thử thách như thế nào?',
  'How does it connect to what you want to study or develop next?': 'Nó liên kết thế nào với những gì bạn muốn theo học hoặc phát triển tiếp theo?',

  'What was the situation, and how did you become part of it?': 'Tình huống lúc đó là gì, và bạn đã tham gia vào như thế nào?',
  'Why did this matter enough to you to get involved?': 'Tại sao việc này lại đủ quan trọng để bạn quyết định tham gia?',
  'What was the hardest part?': 'Phần khó khăn nhất là gì?',
  'What changed as a result?': 'Kết quả đã thay đổi điều gì?',
  'How did it change you?': 'Nó đã thay đổi bạn như thế nào?',
  'How does it connect to what you want to do next?': 'Nó liên kết thế nào với những việc bạn muốn làm tiếp theo?',

  // Activity Reflection — Dimension Guidance Prompts
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
  'What changed as a result?': 'Điều gì đã thay đổi sau đó?',
  'How did it change you?': 'Điều đó đã thay đổi bạn như thế nào?',
  'How does it connect to what you want to do next?': 'Điều đó liên quan thế nào đến điều bạn muốn làm tiếp theo?',
};
