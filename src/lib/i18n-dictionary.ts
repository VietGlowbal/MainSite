/**
 * Translation dictionary — English source string → Vietnamese.
 *
 * Keys are the exact English UI strings. Two consumers read this map:
 *   1. `t('...')` in components — interpolates `{vars}` and falls back to the
 *      English key when a translation is missing, so coverage can grow
 *      incrementally without ever breaking the English site.
 *   2. `DomTranslator` — seeds its machine-translation cache from these entries
 *      and matches them against the *exact* trimmed text of a DOM text node.
 *      So static strings here are translated instantly and for free; anything
 *      not listed (including interpolated text with real numbers/names) falls
 *      through to the OpenAI-backed /api/translate.
 *
 * Keep keys verbatim (same casing/punctuation) so the DOM matcher hits them.
 * Do NOT translate brand names (GLOWBAL) or university names.
 */
export const translations: Record<string, string> = {
  // ── Navigation ───────────────────────────────────────────────────────────
  Home: 'Trang chủ',
  Search: 'Tìm kiếm',
  Apply: 'Nộp đơn',
  Mentorship: 'Cố vấn',
  'GLOWBAL News': 'Tin tức GLOWBAL',
  'Mentor hub': 'Trung tâm cố vấn',
  'Mentorship hub': 'Trung tâm cố vấn',
  Admin: 'Quản trị',
  Mentors: 'Cố vấn',
  News: 'Tin tức',
  Profile: 'Hồ sơ',
  'Sign In/Up': 'Đăng nhập/Đăng ký',
  'Sign in': 'Đăng nhập',
  'Sign out': 'Đăng xuất',
  'Search universities': 'Tìm trường đại học',
  Coordinator: 'Điều phối viên',
  'About us': 'Về chúng tôi',
  // The header and the footer point at /ai-strategy under different labels, on
  // purpose: the nav was relabelled on Figma 375:9845 / 375:10151, the footer
  // frame (104:7413) was not. Keep both keys.
  'Build your strategy': 'Lên Chiến lược Du học', // header, Figma 375:9845
  'AI strategy': 'Chiến lược AI', // footer, Figma 104:7413
  Blog: 'Blog',
  Contact: 'Liên hệ',
  // 'Find a mentor' is already defined further down, under the mentorship copy.
  // Mobile hamburger sheet. "Plan your studies" is the designer's CTA copy.
  Menu: 'Menu',
  'Close menu': 'Đóng menu',
  'Plan your studies': 'Lập kế hoạch du học',

  // ── Home hero (Figma 375:9857) ───────────────────────────────────────────
  // DomTranslator matches the *exact* trimmed text of a node, so these keys
  // must stay character-identical to the JSX in features/marketing/ui.
  'A tool built for scholarship hunters': 'Công cụ dành cho "dân săn học bổng"',
  'Personalised analysis and strategy, beside you for the whole scholarship hunt — across 300+ universities and 3,000+ scholarships worth up to $150,000,000.':
    'Phân tích và đưa chiến lược cá nhân hoá, đồng hành xuyên suốt quá trình săn học bổng từ 300+ trường đại học và 3000+ học bổng với trị giá lên đến $150,000,000.',
  'Find matching scholarships': 'Tìm Học bổng Phù hợp',
  // Still rendered by the legacy landing at src/components/landing/home until
  // that tree is deleted. Remove this key with those files, not before.
  'Find my scholarships': 'Tìm học bổng của tôi',

  // ── Home partner wall (Figma 104:7135) ───────────────────────────────────
  // University names live in alt attributes, which DomTranslator never touches,
  // so there is nothing here to accidentally translate.
  'Our featured partners': 'Đối tác tiêu biểu của chúng tôi',

  // ── Home metrics (Figma 375:9879) ────────────────────────────────────────
  // Five adoption figures supplied by the designer. Listed here rather than
  // left to fall through so that a number never makes a round trip to
  // /api/translate just to come back unchanged. The Vietnamese digit groupings
  // are the frame's own, which is why they do not all carry separators.
  'Standout numbers': 'Những con số nổi bật',
  '"GlowBal has shown how much it invests in product quality, and how well it answers what the market actually needs"':
    '"GlowBal đã chứng minh mức độ đầu tư về chất lượng sản phẩm và khả năng đáp ứng nhu cầu thực từ thị trường"',
  // Keep the values short in both languages — see the note on `Metric`.
  '7,800+': '7800+',
  'Scholarship searches run': 'Lượt Sử dụng Công cụ Tìm kiếm học bổng',
  '370': '370',
  'Regular users': 'Người dùng Thường xuyên',
  '$2,000': '$2000',
  'Invested by Venture X': 'Đầu tư từ quỹ Venture X',
  '150': '150',
  'Pilot users': 'Người dùng Thử nghiệm',
  '270': '270',
  'Pieces of feedback shaping the product': 'Feedbacks để hoàn thiện hệ thống',

  // ── Home features (Figma 104:7164) ───────────────────────────────────────
  // Only the first block is written; the other two show `MissingContent`,
  // which is marked data-no-auto-translate and needs no keys.
  Features: 'Tính năng',
  'See the scholarships tied to the university you picked':
    'Xem các học bổng liên kết với trường đại học bạn đã chọn',
  'Browse a free preview. Create your profile to unlock the full eligibility rules, the documents you need, and to save opportunities into your plan.':
    'Duyệt xem trước miễn phí. Tạo hồ sơ của bạn để mở khóa đầy đủ điều kiện, tài liệu cần thiết và lưu cơ hội vào kế hoạch của bạn.',
  // A product name — kept as-is in both languages, like the university names.
  'GlowBal Matcher': 'GlowBal Matcher',
  'Answer simple questions about you. With our G-Matching technology, we can pair you with the best future opportunity from:':
    'Trả lời vài câu hỏi đơn giản về bạn. Với công nghệ G-Matching, chúng tôi ghép bạn với cơ hội phù hợp nhất từ:',
  '200+ top universities globally': 'Hơn 200 trường đại học hàng đầu thế giới',
  '100+ different majors, even the rarest ones': 'Hơn 100 chuyên ngành, kể cả những ngành hiếm nhất',
  '3000+ scholarships': 'Hơn 3000 học bổng',

  // ── Home "How GLOWBAL works" (Figma 104:7211) ────────────────────────────
  // 'Learn more' is already defined above, under the common actions.
  'How GLOWBAL works': 'Cách GLOWBAL hoạt động',
  'No agencies, no endless tabs. Just the clearest path from a dream university to a scholarship plan.':
    'Không có đại lý, không có tab vô tận. Chỉ có con đường rõ ràng nhất từ một trường mơ ước đến một kế hoạch học bổng.',
  'Pick a university': 'Chọn một trường đại học',
  'Search for a university you care about, or browse by country, major, budget and scholarship odds.':
    'Tìm kiếm một trường đại học mà bạn quan tâm, hoặc duyệt theo quốc gia, chuyên ngành, ngân sách và khả năng học bổng.',
  'Create your free GLOWBAL profile': 'Tạo hồ sơ GLOWBAL miễn phí của bạn',
  'Add your basics so GLOWBAL can surface the scholarships that fit and save your application plan.':
    'Thêm thông tin cơ bản của bạn để GLOWBAL có thể hiển thị các học bổng liên quan và lưu kế hoạch hồ sơ của bạn.',
  'Choose your scholarships': 'Chọn học bổng',
  'See the scholarship opportunities tied to the university you picked and save the ones you want to apply for.':
    'Xem các cơ hội học bổng liên quan đến trường đại học bạn đã chọn và lưu lại những học bổng bạn muốn đăng ký.',
  'Build your AI strategy': 'Tạo chiến lược AI của bạn',
  'Get a personalised strategy showing what to prepare, what to improve, and how to approach each scholarship.':
    'Nhận một chiến lược cá nhân hóa cho thấy những gì cần chuẩn bị, những gì cần cải thiện và cách tiếp cận từng học bổng.',

  // ── Common actions / labels ──────────────────────────────────────────────
  Save: 'Lưu',
  Saved: 'Đã lưu',
  Share: 'Chia sẻ',
  Read: 'Đọc',
  Continue: 'Tiếp tục',
  Next: 'Tiếp theo',
  Back: 'Quay lại',
  Cancel: 'Hủy',
  Submit: 'Gửi',
  Edit: 'Chỉnh sửa',
  Done: 'Xong',
  View: 'Xem',
  'View all': 'Xem tất cả',
  'Get started': 'Bắt đầu',
  'Learn more': 'Tìm hiểu thêm',
  Subscribe: 'Đăng ký nhận tin',
  'Enter your email': 'Nhập email của bạn',
  'Clear all': 'Xóa tất cả',
  'Clear all filters': 'Xóa tất cả bộ lọc',
  'Sort by': 'Sắp xếp theo',
  'Sort by:': 'Sắp xếp theo:',
  'Please wait...': 'Vui lòng đợi...',
  Any: 'Bất kỳ',
  Free: 'Miễn phí',
  Verified: 'Đã xác minh',
  'Verified data': 'Dữ liệu đã xác minh',

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

  // ── Blog list, redesigned (Figma 153:18266) ──────────────────────────────
  'Resource library': 'Thư viện tài nguyên',
  'Guides on choosing a university, funding it, and getting in — written for Vietnamese students.':
    'Hướng dẫn chọn trường, tìm nguồn tài chính và cách trúng tuyển — viết cho sinh viên Việt Nam.',
  'Read post': 'Đọc bài',
  'No posts in this topic yet.': 'Chưa có bài viết nào trong chủ đề này.',
  Subscribed: 'Đã đăng ký',
  'Please enter a valid email address': 'Vui lòng nhập địa chỉ email hợp lệ',
  'Successfully subscribed! Check your email.':
    'Đăng ký thành công! Hãy kiểm tra email của bạn.',
  "You're already subscribed!": 'Bạn đã đăng ký rồi!',
  'Something went wrong. Please try again.': 'Đã xảy ra lỗi. Vui lòng thử lại.',
  'Failed to subscribe. Please try again.': 'Đăng ký thất bại. Vui lòng thử lại.',

  // ── Article (guide) page chrome ──────────────────────────────────────────
  'On this page': 'Trong trang này',
  'Related articles': 'Bài viết liên quan',
  'By Glowbal Editorial Team': 'Bởi Đội ngũ Biên tập Glowbal',
  'Key takeaway': 'Điểm chính',
  'Why this matters': 'Tại sao điều này quan trọng',
  'Next steps': 'Bước tiếp theo',

  // ── Landing ────────────────────────────────────────────────────────────--
  'Find your match': 'Tìm trường phù hợp',
  'Join the waitlist': 'Tham gia danh sách chờ',
  'Go Glow. Go GLOWBAL.': 'Go Glow. Go GLOWBAL.',
  'The vibe': 'Không khí',
  'Universities tracked': 'Trường đại học được theo dõi',
  'Countries covered': 'Quốc gia được bao phủ',
  'Achievers ready to mentor': 'Người dẫn dắt sẵn sàng cố vấn',
  'Of beta users felt less stressed': 'Người dùng thử cảm thấy bớt căng thẳng',
  'Answer a few simple questions': 'Trả lời vài câu hỏi đơn giản',
  'Tell us your strengths, preferences, and career direction. Our matcher does the heavy lifting.':
    'Cho chúng tôi biết thế mạnh, sở thích và định hướng nghề nghiệp của bạn. Công cụ ghép cặp sẽ lo phần còn lại.',
  'Choose your dream paths': 'Chọn con đường mơ ước',
  'Get a curated shortlist of universities, scholarships, and programs that actually fit you.':
    'Nhận danh sách rút gọn gồm các trường, học bổng và chương trình thực sự phù hợp với bạn.',
  'Apply with confidence': 'Nộp đơn tự tin',
  'Connect with mentors who got in, sharpen your statements with our AI writer, and ship it.':
    'Kết nối với cố vấn đã trúng tuyển, trau chuốt bài luận với trình viết AI, và nộp đơn.',
  'How we help you': 'Chúng tôi giúp bạn thế nào',
  'Three steps from overwhelmed to admitted.': 'Ba bước từ choáng ngợp đến trúng tuyển.',
  "No agents. No hidden costs. Just the clearest path from where you are to where you're going.":
    'Không qua trung gian. Không chi phí ẩn. Chỉ là con đường rõ ràng nhất từ nơi bạn đang đứng đến nơi bạn muốn tới.',
  Demo: 'Demo',
  'See GLOWBAL in motion.': 'Xem GLOWBAL hoạt động.',
  'A 90-second walkthrough of the matcher, the Achievers, and the AI statement writer.':
    'Hướng dẫn 90 giây về công cụ ghép cặp, các Achiever và trình viết bài luận AI.',
  'Play demo video': 'Phát video demo',
  'Match → mentor → apply': 'Ghép cặp → cố vấn → nộp đơn',
  'Our mission': 'Sứ mệnh của chúng tôi',
  'Help every ambitious student approach global education with ease and without fear — no matter where they\'re starting from.':
    'Giúp mọi sinh viên đầy hoài bão tiếp cận giáo dục toàn cầu một cách dễ dàng và không sợ hãi — dù bạn bắt đầu từ đâu.',
  Experts: 'Chuyên gia',
  "Mentors who've been on both sides of admissions.": 'Cố vấn đã trải qua cả hai phía của quá trình tuyển sinh.',
  'Our advisors review applications, coach interviews, and pressure-test scholarship strategies.':
    'Cố vấn của chúng tôi rà soát hồ sơ, luyện phỏng vấn và thử thách chiến lược săn học bổng.',
  'Team behind GLOWBAL': 'Đội ngũ phía sau GLOWBAL',
  'Built by students who walked the path.': 'Được xây dựng bởi những sinh viên đã đi qua con đường này.',
  'A small team of first-gen and international graduates building what we wish we had.':
    'Một nhóm nhỏ gồm các cử nhân thế hệ đầu và du học sinh, xây dựng điều mà chúng tôi từng ước có.',
  'What users say': 'Người dùng nói gì',
  'Loved by the students getting in.': 'Được yêu thích bởi những sinh viên đã trúng tuyển.',
  Contacts: 'Liên hệ',
  "Want to chat? We're listening.": 'Muốn trò chuyện? Chúng tôi luôn lắng nghe.',
  'Drop us a message — partnerships, press, student stories, or just to say hi.':
    'Gửi tin nhắn cho chúng tôi — hợp tác, báo chí, câu chuyện sinh viên, hay chỉ để chào hỏi.',
  'Reach us': 'Kết nối với chúng tôi',

  // ── Universities explorer ──────────────────────────────────────────────--
  "Find the university that's right for you": 'Du học dễ dàng với học bổng cao nhất',
  'Explore 10,000+ universities worldwide and find your perfect fit.':
    'Glowbal giúp bạn tìm bến đỗ trong 10,000 trường đại học và 1000 lựa chọn học bổng đa dạng.',
  'Search by university name': 'Tìm theo tên trường',
  'Where do you want to study?': 'Bạn muốn học ở đâu?',
  'Select a subject or field': 'Chọn ngành hoặc lĩnh vực',
  'Popular searches:': 'Tìm kiếm phổ biến:',
  'Computer Science': 'Khoa học Máy tính',
  Business: 'Kinh doanh',
  Engineering: 'Kỹ thuật',
  Medicine: 'Y khoa',
  'Data Science': 'Khoa học Dữ liệu',
  Law: 'Luật',
  'Improve your searches': 'Cải thiện tìm kiếm của bạn',
  'Refine your search': 'Bộ lọc tìm kiếm',
  'Study destination': 'Khu vực địa lý - Chọn quốc gia',
  'Any country': 'Bất kỳ quốc gia',
  'Search country or region': 'Tìm quốc gia hoặc khu vực',
  'Subject / Field': 'Ngành / Lĩnh vực',
  'Any subject': 'Bất kỳ ngành',
  STEM: 'STEM',
  'Arts & Humanities': 'Nghệ thuật & Nhân văn',
  'Russell Group': 'Russell Group',
  'Global Top 50': 'Top 50 toàn cầu',
  'QS World Ranking': 'Xếp hạng QS thế giới',
  'Tuition fees (per year)': 'Học phí (mỗi năm)',
  'Acceptance rate': 'Tỷ lệ trúng tuyển',
  'Study level': 'Bậc học',
  'Any type': 'Bất kỳ loại',
  Public: 'Công lập',
  Private: 'Tư thục',
  'Campus setting': 'Khung cảnh khuôn viên',
  'Any setting': 'Bất kỳ khung cảnh',
  Urban: 'Thành thị',
  Suburban: 'Ngoại ô',
  Rural: 'Nông thôn',
  'Program language': 'Ngôn ngữ chương trình',
  "Language data coming soon — we're ingesting it from each university's course catalogue.":
    'Dữ liệu ngôn ngữ sắp có — chúng tôi đang thu thập từ danh mục khóa học của từng trường.',
  'Scholarships available': 'Có học bổng',
  'Show only with scholarships': 'Chỉ hiện trường có học bổng',
  'No universities match yet — try widening your filters.':
    'Chưa có trường nào khớp — hãy thử nới rộng bộ lọc.',
  Compare: 'So sánh',
  'Pick at least two universities to compare': 'Chọn ít nhất hai trường để so sánh',
  'Open the compare panel': 'Mở bảng so sánh',
  'Best Match': 'Phù hợp nhất',
  'QS Rank: Best first': 'Xếp hạng QS: Cao nhất trước',
  'Tuition: Low → High': 'Học phí: Thấp → Cao',
  'Acceptance: Most selective': 'Trúng tuyển: Khắt khe nhất',
  'Grid view': 'Dạng lưới',
  'List view': 'Dạng danh sách',
  'View profile': 'Xem hồ sơ',
  'Back to search results': 'Quay lại kết quả tìm kiếm',
  'Housing & campus': 'Nhà ở & khuôn viên',
  'International environment': 'Môi trường quốc tế',
  'Teaching style': 'Phong cách giảng dạy',
  'Institution type': 'Loại hình trường',
  'At a glance': 'Tổng quan nhanh',
  'Find a Course': 'Tìm khóa học',
  'Save to My Universities': 'Lưu vào Trường của tôi',
  'Saved to My Universities': 'Đã lưu vào Trường của tôi',
  'See student reviews': 'Xem đánh giá của sinh viên',
  'Read all reviews': 'Đọc tất cả đánh giá',
  'Top Programs': 'Chương trình hàng đầu',
  'View all programs': 'Xem tất cả chương trình',
  'Entry Requirements': 'Yêu cầu đầu vào',
  'View all admission requirements': 'Xem tất cả yêu cầu tuyển sinh',
  'Campus & Location': 'Khuôn viên & Vị trí',
  'Tuition Fees': 'Học phí',
  'Estimated Living Cost': 'Chi phí sinh hoạt ước tính',
  'Acceptance Rate': 'Tỷ lệ trúng tuyển',
  Founded: 'Thành lập',
  Website: 'Trang web',
  Type: 'Loại hình',
  Overview: 'Tổng quan',
  Programs: 'Chương trình',
  Admissions: 'Tuyển sinh',
  'Tuition & Costs': 'Học phí & Chi phí',
  Rankings: 'Xếp hạng',
  Reviews: 'Đánh giá',
  'Find a mentor here': 'Tìm cố vấn tại đây',
  'Tuition fee': 'Học phí',
  'Visit official website ↗': 'Truy cập trang web chính thức ↗',
  "Are you interested? Let's discover scholarship for this uni":
    'Bạn có quan tâm không? Cùng khám phá học bổng cho trường này',
  'Showing scholarships for {name}': 'Đang hiển thị học bổng cho {name}',
  'No scholarships are linked to {name} yet — showing the full directory.':
    'Chưa có học bổng nào được liên kết với {name} — đang hiển thị toàn bộ danh mục.',
  'Show all': 'Hiển thị tất cả',
  Dismiss: 'Bỏ qua',
  'Funding picked for {name}': 'Tài trợ được chọn cho {name}',
  'Show all scholarships': 'Hiển thị tất cả học bổng',
  'Scholarships at {name}': 'Học bổng tại {name}',
  'Other scholarships in {country}': 'Học bổng khác tại {country}',
  'Other scholarships': 'Học bổng khác',
  'Continue to Apply': 'Tiếp tục nộp đơn',
  '{count} scholarship(s) saved': 'Đã lưu {count} học bổng',
  Achievability: 'Khả năng đạt được',
  'Just saved': 'Vừa lưu',
  'Open scholarship': 'Mở học bổng',
  'Not sure? Chat with our in-house team for more info':
    'Chưa chắc chắn? Trò chuyện với đội ngũ của chúng tôi để biết thêm thông tin',
  'Continue with limited plan →': 'Tiếp tục với gói giới hạn →',
  'Unlock the full application plan to keep building this application.':
    'Mở khóa kế hoạch nộp đơn đầy đủ để tiếp tục xây dựng hồ sơ này.',
  'Continue to your application →': 'Tiếp tục đến hồ sơ của bạn →',

  // ── Mentors ────────────────────────────────────────────────────────────--
  'Mentorship Hub': 'Trung tâm Cố vấn',
  "Meet a mentor who's walked the path": 'Gặp người cố vấn đã đi qua con đường này',
  'Browse current students and recent grads at your dream universities. Pick a time, share what you want help with, and book a real video session.':
    'Duyệt qua sinh viên hiện tại và cựu sinh viên ở các trường mơ ước của bạn. Chọn thời gian, chia sẻ điều bạn cần giúp, và đặt một buổi gọi video thực sự.',
  'Become a mentor': 'Trở thành cố vấn',
  'Search by mentor, university, or topic': 'Tìm theo cố vấn, trường hoặc chủ đề',
  'Any location': 'Bất kỳ địa điểm',
  'Any university': 'Bất kỳ trường',
  'All universities': 'Tất cả các trường',
  'Currently studying': 'Đang theo học',
  Alumni: 'Cựu sinh viên',
  Languages: 'Ngôn ngữ',
  'Top rated': 'Được đánh giá cao',
  'Newest mentors': 'Cố vấn mới nhất',
  'Price: low → high': 'Giá: thấp → cao',
  'Price: high → low': 'Giá: cao → thấp',
  'Hide filters': 'Ẩn bộ lọc',
  'More filters': 'Thêm bộ lọc',
  Status: 'Trạng thái',
  Rating: 'Đánh giá',
  'Find your university': 'Tìm trường của bạn',
  'Pick a country or specific school above': 'Chọn quốc gia hoặc trường cụ thể ở trên',
  'Choose a time': 'Chọn thời gian',
  'Mentors share a calendar with open slots': 'Cố vấn chia sẻ lịch với các khung giờ còn trống',
  'Choose a mentor': 'Chọn cố vấn',
  'Popular help with:': 'Hỗ trợ phổ biến:',
  'Personal statement': 'Bài luận cá nhân',
  'Interview prep': 'Luyện phỏng vấn',
  'Visa & accommodation': 'Visa & chỗ ở',
  'Scholarship strategy': 'Chiến lược học bổng',
  'Course choice': 'Lựa chọn khóa học',
  'Life abroad': 'Cuộc sống ở nước ngoài',
  'New mentor': 'Cố vấn mới',
  'Pricing pending': 'Đang cập nhật giá',
  'Book a session': 'Đặt buổi tư vấn',
  'No mentors match your search': 'Không có cố vấn nào khớp với tìm kiếm của bạn',
  'Try widening the country or removing the date filter — or invite a mentor at your school.':
    'Hãy thử nới rộng quốc gia hoặc bỏ bộ lọc ngày — hoặc mời một cố vấn ở trường của bạn.',

  // ── Apply / dashboard ──────────────────────────────────────────────────--
  'My Applications': 'Hồ sơ của tôi',
  'Track and manage all your university course applications in one place.':
    'Theo dõi và quản lý tất cả hồ sơ ứng tuyển khóa học của bạn ở một nơi.',
  'Build my checklist': 'Tạo danh sách việc cần làm',
  'Analyzing...': 'Đang phân tích...',
  'This doesn\'t look like a valid URL. Please paste the official course page link.':
    'Đây có vẻ không phải là một URL hợp lệ. Vui lòng dán liên kết trang khóa học chính thức.',
  "Use the official course page from the university website. We'll create a personalised application plan for you.":
    'Hãy dùng trang khóa học chính thức từ website của trường. Chúng tôi sẽ tạo một kế hoạch ứng tuyển riêng cho bạn.',
  'How it works': 'Cách hoạt động',
  'Please paste a course URL first.': 'Vui lòng dán URL khóa học trước.',
  "You've already imported this course.": 'Bạn đã nhập khóa học này rồi.',
  'Active Applications': 'Hồ sơ đang hoạt động',
  'Deadline (soonest)': 'Hạn chót (gần nhất)',
  'Progress (highest)': 'Tiến độ (cao nhất)',
  'Recently added': 'Thêm gần đây',
  'Start your first application plan': 'Bắt đầu kế hoạch ứng tuyển đầu tiên',
  'Paste the official course page URL from a university website and Glowbal will build your personalised checklist.':
    'Dán URL trang khóa học chính thức từ website của trường, Glowbal sẽ lập danh sách việc cần làm riêng cho bạn.',
  'Paste course URL': 'Dán URL khóa học',
  'Shortlisted Universities': 'Trường trong danh sách rút gọn',
  'Submitted / Completed': 'Đã nộp / Hoàn thành',
  'Application overview': 'Tổng quan hồ sơ',
  'Active applications': 'Hồ sơ đang hoạt động',
  Submitted: 'Đã nộp',
  'Offers received': 'Thư mời nhận được',
  'Tasks completed': 'Công việc đã hoàn thành',
  'Upcoming deadlines': 'Hạn chót sắp tới',
  Deadline: 'Hạn chót',
  Progress: 'Tiến độ',
  'Next up:': 'Tiếp theo:',
  'Find a course': 'Tìm khóa học',
  'On track': 'Đúng tiến độ',
  Interview: 'Phỏng vấn',
  'Offer received': 'Đã nhận thư mời',
  Rejected: 'Bị từ chối',
  'Deadline soon': 'Sắp đến hạn',
  'Direct Apply': 'Nộp trực tiếp',
  'University Portal': 'Cổng thông tin của trường',
  'QS Ranking': 'Xếp hạng QS',
  'Tuition (Intl.)': 'Học phí (Quốc tế)',
  'before scholarship': 'trước học bổng',
  '/yr': '/năm',
  'What are your real admission odds?': 'Cơ hội đỗ thật sự của bạn là bao nhiêu?',
  "Tell us what and where you want to study — we'll match you with universities and scholarships that fit.":
    'Cho chúng tôi biết bạn muốn học ngành gì và ở đâu — chúng tôi sẽ gợi ý trường và học bổng phù hợp.',
  'See my odds': 'Xem cơ hội của tôi',
  'Choose a destination': 'Chọn bến đỗ',
  'Free to explore — sign in to save your matches':
    'Khám phá miễn phí — đăng nhập để lưu kết quả phù hợp',
  'Verified student': 'Sinh viên đã xác minh',
  'Need help?': 'Cần trợ giúp?',
  'Get expert guidance from current students and admissions mentors.':
    'Nhận hướng dẫn từ sinh viên hiện tại và cố vấn tuyển sinh.',
  'Find a mentor': 'Tìm cố vấn',
  'Improve your application': 'Cải thiện hồ sơ của bạn',
  'Tools and feedback to strengthen your profile.':
    'Công cụ và phản hồi giúp củng cố hồ sơ của bạn.',
  'SOP Maximiser': 'Tối ưu bài luận SOP',
  'Improve your statement': 'Cải thiện bài luận của bạn',
  'Interview Prep': 'Luyện phỏng vấn',
  'Practice & get ready': 'Luyện tập & sẵn sàng',
  'Profile Review': 'Rà soát hồ sơ',
  'Get expert feedback': 'Nhận phản hồi từ chuyên gia',
  '7-day full access': 'Truy cập đầy đủ 7 ngày',
  "You're on a free trial. Unlock all tools and mentor support.":
    'Bạn đang dùng bản dùng thử miễn phí. Mở khóa tất cả công cụ và hỗ trợ từ cố vấn.',
  'Upgrade Now': 'Nâng cấp ngay',

  // ── Profile ────────────────────────────────────────────────────────────--
  'My Profile': 'Hồ sơ của tôi',
  'Tell us about yourself so we can give you better recommendations and build stronger application plans.':
    'Hãy cho chúng tôi biết về bạn để chúng tôi đưa ra gợi ý tốt hơn và xây dựng kế hoạch ứng tuyển vững chắc hơn.',
  'Personal information': 'Thông tin cá nhân',
  'Name, nationality, location and contact details': 'Họ tên, quốc tịch, địa điểm và thông tin liên hệ',
  'View details': 'Xem chi tiết',
  'Academic background': 'Học vấn',
  'Your education history, grades and subjects': 'Lịch sử học tập, điểm số và môn học của bạn',
  'Complete section': 'Hoàn thành mục này',
  'Target preferences': 'Tiêu chí mong muốn',
  'Countries, subjects, budget and preferred cities': 'Quốc gia, ngành học, ngân sách và thành phố ưu tiên',
  'Edit preferences': 'Chỉnh sửa tiêu chí',
  Achievements: 'Thành tích',
  'Awards, extracurriculars and leadership roles': 'Giải thưởng, hoạt động ngoại khóa và vai trò lãnh đạo',
  'Add achievements': 'Thêm thành tích',
  'Work experience': 'Kinh nghiệm làm việc',
  'Internships, jobs and volunteering': 'Thực tập, công việc và tình nguyện',
  'Add experience': 'Thêm kinh nghiệm',
  Documents: 'Tài liệu',
  'Upload important documents and certificates': 'Tải lên tài liệu và chứng chỉ quan trọng',
  'Upload documents': 'Tải lên tài liệu',
  'English proficiency': 'Trình độ tiếng Anh',
  'IELTS, TOEFL or other language test scores': 'Điểm IELTS, TOEFL hoặc bài thi ngôn ngữ khác',
  'Add test score': 'Thêm điểm thi',
  'Application goals': 'Mục tiêu ứng tuyển',
  'What you want to achieve and your dream career': 'Điều bạn muốn đạt được và nghề nghiệp mơ ước',
  'Add goals': 'Thêm mục tiêu',
  'Profile sections': 'Các mục hồ sơ',
  'Suggested next steps': 'Các bước gợi ý tiếp theo',
  'Complete these to get the most out of Glowbal.': 'Hoàn thành những mục này để tận dụng tối đa Glowbal.',
  'Add your achievements': 'Thêm thành tích của bạn',
  'Help universities see your strengths beyond academics.':
    'Giúp các trường thấy được thế mạnh của bạn ngoài học thuật.',
  'Upload your transcript': 'Tải lên bảng điểm của bạn',
  "We'll use it to check eligibility and find better matches.":
    'Chúng tôi sẽ dùng nó để kiểm tra điều kiện và tìm trường phù hợp hơn.',
  'Set your application goals': 'Đặt mục tiêu ứng tuyển của bạn',
  'Get a personalised plan and smart recommendations.':
    'Nhận một kế hoạch cá nhân hóa và các gợi ý thông minh.',
  'Profile strength': 'Độ hoàn thiện hồ sơ',
  'Improve profile': 'Cải thiện hồ sơ',
  'Your documents': 'Tài liệu của bạn',
  'Academic transcript': 'Bảng điểm học tập',
  Passport: 'Hộ chiếu',
  'IELTS Certificate': 'Chứng chỉ IELTS',
  'Personal statement draft': 'Bản nháp bài luận cá nhân',
  'Curriculum vitae': 'Sơ yếu lý lịch',
  'Not uploaded': 'Chưa tải lên',
  'Upload a document': 'Tải lên một tài liệu',
  'Your applications': 'Hồ sơ của bạn',
  Active: 'Đang hoạt động',
  Offers: 'Thư mời',
  'Location not set': 'Chưa đặt địa điểm',
  'Not set': 'Chưa đặt',
  Undergraduate: 'Đại học',
  Postgraduate: 'Sau đại học',

  // ── Auth ───────────────────────────────────────────────────────────────--
  'Welcome back 👋': 'Chào mừng trở lại 👋',
  'Sign in to continue your journey.': 'Đăng nhập để tiếp tục hành trình của bạn.',
  'Create your account': 'Tạo tài khoản của bạn',
  'Join thousands of students finding their dream university.':
    'Tham gia cùng hàng nghìn sinh viên đang tìm ngôi trường mơ ước.',
  'Continue with Google': 'Tiếp tục với Google',
  OR: 'HOẶC',
  'Full name': 'Họ và tên',
  'Enter your full name': 'Nhập họ và tên của bạn',
  'Email address': 'Địa chỉ email',
  Password: 'Mật khẩu',
  'Enter your password': 'Nhập mật khẩu của bạn',
  'Show password': 'Hiện mật khẩu',
  'Hide password': 'Ẩn mật khẩu',
  'Remember me': 'Ghi nhớ đăng nhập',
  'Forgot password?': 'Quên mật khẩu?',
  'Create account': 'Tạo tài khoản',
  'Your data is secure and encrypted': 'Dữ liệu của bạn được bảo mật và mã hóa',
  "Don't have an account?": 'Chưa có tài khoản?',
  'Already have an account?': 'Đã có tài khoản?',
  'Check your inbox': 'Kiểm tra hộp thư của bạn',

  // ── Onboarding ─────────────────────────────────────────────────────────--
  "It's simple! Let us know more about you. Then we will match you with your best global opportunity!":
    'Rất đơn giản! Hãy cho chúng tôi biết thêm về bạn. Sau đó chúng tôi sẽ ghép bạn với cơ hội toàn cầu phù hợp nhất!',
  'Go Back': 'Quay lại',
  'Next Question': 'Câu hỏi tiếp theo',
  'Save and continue': 'Lưu và tiếp tục',
  'Sign up to save your matches': 'Đăng ký để lưu các trường phù hợp của bạn',
  'You can search freely without an account. To save this quiz and unlock personalised matches, sign up on the final step.':
    'Bạn có thể tìm kiếm tự do mà không cần tài khoản. Để lưu bài trắc nghiệm này và mở khóa các gợi ý cá nhân hóa, hãy đăng ký ở bước cuối.',
  'Select subjects': 'Chọn ngành học',
  'Select specific countries': 'Chọn quốc gia cụ thể',
  'Choose specific countries': 'Chọn quốc gia cụ thể',
  'Pick as many as you like': 'Chọn bao nhiêu tùy thích',
  'Selected countries': 'Quốc gia đã chọn',
  'Selected subjects': 'Ngành đã chọn',
  'Big city': 'Thành phố lớn',
  'Campus town': 'Thị trấn đại học',
  'Quiet / green': 'Yên tĩnh / xanh mát',
  'City + campus': 'Thành phố + khuôn viên',
  'City + quiet': 'Thành phố + yên tĩnh',
  'Campus + quiet': 'Khuôn viên + yên tĩnh',
  Flexible: 'Linh hoạt',
  'Support needs': 'Nhu cầu hỗ trợ',
  'What do you want your degree to unlock for you, personally or professionally?':
    'Bạn muốn tấm bằng của mình mở ra điều gì, về mặt cá nhân hay sự nghiệp?',

  // ── Attribute text (placeholder / aria-label / title) ───────────────────--
  'Save university': 'Lưu trường',
  'Remove from saved': 'Bỏ khỏi đã lưu',
  'Saved to My Universities — click to remove': 'Đã lưu vào Trường của tôi — bấm để bỏ',
  'Save and track application progress': 'Lưu và theo dõi tiến độ hồ sơ',
  'Remove from shortlist': 'Bỏ khỏi danh sách rút gọn',
  'Compare universities': 'So sánh các trường',
  'Mark as complete': 'Đánh dấu hoàn thành',
  'Mark as incomplete': 'Đánh dấu chưa hoàn thành',
  'Take the 60-second quiz so we can personalise your matches':
    'Làm bài trắc nghiệm 60 giây để chúng tôi cá nhân hóa gợi ý cho bạn',
  'Admin console': 'Bảng quản trị',
  'Admin sections': 'Các mục quản trị',
  'Paste your full SOP here…': 'Dán toàn bộ bài luận SOP của bạn vào đây…',
  'Paste a university course page URL (e.g. https://www.example.ac.uk/courses/...)':
    'Dán URL trang khóa học của trường (vd: https://www.example.ac.uk/courses/...)',
  'Search by name, email, or ID': 'Tìm theo tên, email hoặc ID',

  // ── Apply — application workspace ─────────────────────────────────────────
  'Your tasks': 'Nhiệm vụ của bạn',
  'No tasks yet': 'Chưa có nhiệm vụ nào',
  'Tasks will appear here as you progress': 'Các nhiệm vụ sẽ xuất hiện ở đây khi bạn tiến triển',
  'Apply deadline': 'Hạn nộp đơn',
  'Your match': 'Mức phù hợp của bạn',
  'Your current CV': 'CV hiện tại của bạn',
  'Max possible match': 'Mức phù hợp tối đa',
  'With AI-optimized CV': 'Với CV được tối ưu bằng AI',
  'Entry requirements': 'Yêu cầu đầu vào',
  'View official course page': 'Xem trang khóa học chính thức',
  'More options': 'Thêm tùy chọn',

  // ── Admin ────────────────────────────────────────────────────────────────
  'Admin Console': 'Bảng quản trị',
  'Manage Glowbal': 'Quản lý Glowbal',
  'Approve mentors, confirm bookings, and manage the user base.':
    'Phê duyệt cố vấn, xác nhận lượt đặt và quản lý người dùng.',
  'Mentor applications': 'Đơn ứng tuyển cố vấn',
  'Bookings & payments': 'Lượt đặt & thanh toán',
  Users: 'Người dùng',
  User: 'Người dùng',
  'Mentor applications waiting': 'Đơn ứng tuyển cố vấn đang chờ',
  'Approved mentors': 'Cố vấn đã duyệt',
  'Bookings awaiting payment': 'Lượt đặt đang chờ thanh toán',
  'Confirmed sessions': 'Buổi đã xác nhận',
  'Completed sessions': 'Buổi đã hoàn thành',
  'Quick actions': 'Thao tác nhanh',
  'Review mentor applications': 'Duyệt đơn ứng tuyển cố vấn',
  'Confirm payments': 'Xác nhận thanh toán',
  'Manage users': 'Quản lý người dùng',
  'Total users': 'Tổng người dùng',
  Admins: 'Quản trị viên',
  'Mentor profiles': 'Hồ sơ cố vấn',
  All: 'Tất cả',
  Roles: 'Vai trò',
  Onboarded: 'Đã hoàn tất onboarding',
  Joined: 'Tham gia',
  'Last sign-in': 'Đăng nhập gần nhất',
  Actions: 'Hành động',
  'No users match.': 'Không có người dùng nào khớp.',
  'Loading users…': 'Đang tải người dùng…',
  'Try again': 'Thử lại',
  Student: 'Sinh viên',
  'Active sessions': 'Buổi đang hoạt động',
  'Total Glowbal revenue': 'Tổng doanh thu Glowbal',
  'No pending payments.': 'Không có khoản thanh toán nào đang chờ.',
  'Confirm payment': 'Xác nhận thanh toán',
  'All bookings': 'Tất cả lượt đặt',
  Amount: 'Số tiền',
  Fee: 'Phí',
  Date: 'Ngày',
  'No pending applications.': 'Không có đơn nào đang chờ.',
  'Hide details': 'Ẩn chi tiết',
  'View application': 'Xem đơn',
  'Bio:': 'Tiểu sử:',
  'Topics:': 'Chủ đề:',
  'Languages:': 'Ngôn ngữ:',
  'Price:': 'Giá:',
  Approve: 'Phê duyệt',
  Reject: 'Từ chối',
  Processed: 'Đã xử lý',
  Pending: 'Đang chờ',

  // ── Scholarships directory ───────────────────────────────────────────────
  'Browse curated scholarships and find funding you can apply for.':
    'Khám phá danh mục học bổng được tuyển chọn và tìm nguồn tài trợ bạn có thể ứng tuyển.',
  Directory: 'Danh mục',
  'Match my courses (AI)': 'Khớp khóa học (AI)',
  'For you': 'Dành cho bạn',
  'Matched to your saved universities': 'Phù hợp với trường bạn đã lưu',
  'Search scholarships by name': 'Tìm học bổng theo tên',
  Scope: 'Loại hình',
  'Funding type': 'Loại học bổng',
  Country: 'Quốc gia',
  'All countries': 'Tất cả quốc gia',
  'Clear filters': 'Xóa bộ lọc',
  'No scholarships match these filters': 'Không có học bổng nào khớp bộ lọc',
  Relevance: 'Liên quan',
  'Name (A–Z)': 'Tên (A–Z)',
  'Official link': 'Trang chính thức',
  'Applicable universities': 'Trường áp dụng',
  Coverage: 'Giá trị học bổng',
  Eligibility: 'Đối tượng',
  Conditions: 'Điều kiện ứng tuyển',
  Insight: 'Phân tích',
  Slots: 'Số suất',
  'Ranking / acceptance': 'Xếp hạng / tỷ lệ trúng tuyển',
  Provider: 'Đơn vị tài trợ',
  // Scope labels (match SCHOLARSHIP_SCOPE_LABELS in src/lib/scholarships.ts)
  'University-specific': 'Theo trường',
  'Country / government': 'Theo quốc gia / chính phủ',
  Consortium: 'Liên minh trường',
  'Foundation / provider': 'Quỹ / tổ chức tài trợ',
  // Funding-type labels (match FUNDING_TYPE_LABELS in src/lib/scholarships.ts)
  'Merit-based': 'Theo thành tích',
  'Need-based': 'Theo nhu cầu tài chính',
  Leadership: 'Lãnh đạo',
  Research: 'Nghiên cứu',
  Sport: 'Thể thao',
  'Diversity & inclusion': 'Đa dạng & hòa nhập',
  'Regional / government': 'Khu vực / chính phủ',
  'Field-specific': 'Theo ngành',
  'Full ride': 'Toàn phần',
  Partial: 'Bán phần',
  'Travel / mobility': 'Đi lại / trao đổi',
  Other: 'Khác',

  // ── Onboarding (quiz) ─────────────────────────────────────────────────────
  // Rendered via t() in onboarding-single-page.tsx (the page opts out of the
  // DOM auto-translator). Reuses existing keys: Undergraduate, Postgraduate,
  // Engineering, Business, Computer Science, Medicine, Big city, Campus town,
  // Quiet / green, Flexible.
  'GLOWBAL · onboarding': 'GLOWBAL · onboarding',
  'Skip to search': 'Bỏ qua, tới tìm kiếm',
  "Tell us about you. We'll do the rest.": 'Kể cho chúng tôi về bạn. Phần còn lại để chúng tôi lo.',
  'A 60-second detour will sharpen your search.': 'Một phút trả lời sẽ giúp tìm kiếm của bạn chính xác hơn.',
  'Filling in these questions lets': 'Việc trả lời những câu hỏi này giúp',
  'rank universities by how well they fit your subject, budget, country preference, and goals. You can skip any time — your search will just be more generic until you do.':
    'xếp hạng các trường theo mức độ phù hợp với ngành học, ngân sách, quốc gia mong muốn và mục tiêu của bạn. Bạn có thể bỏ qua bất cứ lúc nào — kết quả tìm kiếm sẽ chung chung hơn cho đến khi bạn điền.',
  "Seven short questions. They tune the matcher so the universities you see actually fit you. Skip any you're not sure about — every answer makes the search better, none are required.":
    'Bảy câu hỏi ngắn. Chúng tinh chỉnh công cụ ghép cặp để các trường bạn thấy thực sự phù hợp với bạn. Câu nào chưa chắc thì cứ bỏ qua — mỗi câu trả lời đều giúp tìm kiếm tốt hơn, không câu nào bắt buộc.',
  'Pick at least one answer to save a personalised match.': 'Chọn ít nhất một câu trả lời để lưu kết quả phù hợp được cá nhân hóa.',
  'Looking great — {completed}/{total} answered.': 'Tuyệt vời — đã trả lời {completed}/{total}.',
  'All set. Save your profile to unlock matches.': 'Đã xong. Lưu hồ sơ để mở khóa các trường phù hợp.',
  'Skip for now': 'Bỏ qua',
  'Saving…': 'Đang lưu…',
  'Save & see matches': 'Lưu & xem kết quả phù hợp',
  'Sign in & save': 'Đăng nhập & lưu',
  'Please sign in so we can save your profile.': 'Vui lòng đăng nhập để chúng tôi lưu hồ sơ của bạn.',
  "A sentence or two about the future you're building toward.": 'Một hai câu về tương lai bạn đang hướng tới.',

  // Questions (title + body)
  'What level are you aiming for?': 'Bạn đang hướng tới bậc học nào?',
  'Start with the path you are actually planning now.': 'Bắt đầu từ con đường bạn đang thực sự dự định.',
  'Which subject worlds pull you in?': 'Lĩnh vực nào thu hút bạn?',
  'Pick the broad theme — you can refine specific courses later.':
    'Chọn nhóm ngành lớn — bạn có thể tinh chỉnh khóa học cụ thể sau.',
  'Which parts of the world feel right?': 'Khu vực nào trên thế giới hợp với bạn?',
  'Think globally, then narrow it down to places that excite you.':
    'Nghĩ rộng toàn cầu, rồi thu hẹp về những nơi khiến bạn hào hứng.',
  'What budget feels realistic?': 'Ngân sách nào là phù hợp với bạn?',
  'A strong shortlist should be ambitious, but still within reach.':
    'Một danh sách tốt nên đủ tham vọng nhưng vẫn trong tầm với.',
  'What kind of environment suits you?': 'Môi trường nào hợp với bạn?',
  'Course fit matters, but so does where you will actually live.':
    'Khóa học phù hợp rất quan trọng, nhưng nơi bạn sẽ sống cũng vậy.',
  'Where do you most want support?': 'Bạn cần hỗ trợ nhất ở đâu?',
  'No judgement — pick the area where guidance would help most.':
    'Không phán xét — chọn mảng mà sự hướng dẫn sẽ giúp bạn nhiều nhất.',
  'What kind of future are you building?': 'Bạn đang xây dựng một tương lai như thế nào?',
  'Speak in your own words — even one sentence helps us match you.':
    'Hãy nói theo cách của bạn — chỉ một câu cũng giúp chúng tôi ghép cặp tốt hơn.',

  // Study level (missing one)
  PhD: 'Tiến sĩ',

  // Subject families + first two children (shown as hints)
  Technology: 'Công nghệ',
  'Arts & Creative': 'Nghệ thuật & Sáng tạo',
  'Social Sciences': 'Khoa học Xã hội',
  'Health and Science': 'Sức khỏe & Khoa học',
  'Software Engineering': 'Kỹ thuật Phần mềm',
  'Mechanical Engineering': 'Kỹ thuật Cơ khí',
  'Civil Engineering': 'Kỹ thuật Xây dựng',
  'Business Management': 'Quản trị Kinh doanh',
  Finance: 'Tài chính',
  Drama: 'Sân khấu',
  Music: 'Âm nhạc',
  Psychology: 'Tâm lý học',
  Politics: 'Chính trị học',
  Biology: 'Sinh học',

  // Regions + hints
  'UK & Ireland': 'Anh & Ireland',
  Europe: 'Châu Âu',
  'North America': 'Bắc Mỹ',
  'Asia-Pacific': 'Châu Á - Thái Bình Dương',
  'Middle East': 'Trung Đông',
  'Open to ideas': 'Cởi mở với những ý tưởng',
  'United Kingdom, Ireland': 'Vương quốc Anh, Ireland',
  'Germany, France, Netherlands': 'Đức, Pháp, Hà Lan',
  'United States, Canada': 'Hoa Kỳ, Canada',
  'Singapore, Australia, Japan': 'Singapore, Úc, Nhật Bản',
  'UAE, Qatar': 'UAE, Qatar',
  'Show best-fit places first': 'Hiện những nơi phù hợp nhất trước',

  // Budget
  'Under $15k': 'Dưới $15k',
  'Up to $25k': 'Tối đa $25k',
  'Up to $50k': 'Tối đa $50k',
  '$50k+': 'Trên $50k',

  // Support needs
  'Applications and deadlines': 'Hồ sơ và thời hạn',
  'Choosing the right country': 'Chọn đúng quốc gia',
  'Budget / affordability': 'Ngân sách / khả năng chi trả',
  'Confidence and direction': 'Sự tự tin và định hướng',
  'Scholarships and funding': 'Học bổng và tài trợ',
  'Parents / family alignment': 'Đồng thuận với cha mẹ / gia đình',

  // Goal ideas
  'Build a global AI career with strong scholarship support.':
    'Xây dựng sự nghiệp AI toàn cầu với sự hỗ trợ học bổng vững chắc.',
  'Study computer science abroad and launch a startup one day.':
    'Du học ngành khoa học máy tính và một ngày nào đó khởi nghiệp.',
  'Find a university that opens doors into product and innovation.':
    'Tìm một trường mở ra cánh cửa vào lĩnh vực sản phẩm và đổi mới.',
  'Move into a big international city and grow my confidence.':
    'Chuyển đến một thành phố lớn và phát triển sự tự tin.',
  'Get a practical degree that leads to strong job options worldwide.':
    'Có một tấm bằng thực tiễn dẫn tới nhiều cơ hội việc làm tốt trên toàn cầu.',

  // ── Home: scholarship rail (Figma 104:7225) ──────────────────────────────
  // The design writes these in Vietnamese; the English above is the source
  // string, so these entries are the designer's own wording restored.
  'Scholarship library': 'Kho học bổng',
  'Browse a preview for free. Create your profile to unlock the full eligibility criteria and required documents, and to save opportunities into your plan.':
    'Duyệt xem trước miễn phí. Tạo hồ sơ của bạn để mở khóa đầy đủ điều kiện, tài liệu cần thiết và lưu cơ hội vào kế hoạch của bạn.',
  'See more': 'Xem thêm',
  'View scholarship': 'Xem học bổng',
  'Scroll or swipe to see more scholarships.':
    'Cuộn hoặc vuốt để xem thêm học bổng.',

  // ── Home: testimonials (Figma 104:7265) ──────────────────────────────────
  'Learn from students who made it': 'Học hỏi từ những sinh viên đã thành công',
  'GlowBal connects you with students all over the world who share real experience of universities, scholarships, applications and student life.':
    'GlowBal kết nối bạn với những sinh viên trên khắp thế giới, những người chia sẻ kinh nghiệm thực tế về các trường đại học, học bổng, hồ sơ và cuộc sống sinh viên.',

  // ── Home: FAQ (Figma 104:7347) ───────────────────────────────────────────
  'Frequently asked questions': 'Câu hỏi thường gặp',
  'Everything you need to know about the product and billing.':
    'Mọi điều bạn cần biết về sản phẩm và thanh toán.',
  'What is GlowBal?': 'GlowBal là gì?',
  'Is GlowBal free?': 'GlowBal có miễn phí không?',
  'What is the AI strategy suggestion?': 'Gợi ý chiến lược AI là gì?',
  'Who are the student supporters?': 'Ai là những người hỗ trợ sinh viên?',
  'Do I need to know which university I want?':
    'Tôi có cần biết trường đại học của mình không?',
  'Why do I need to create a profile?': 'Tại sao tôi cần tạo một hồ sơ?',

  // ── Home: contact (Figma 104:7361) ───────────────────────────────────────
  'Leave your details for a consultation': 'Để lại thông tin để nhận tư vấn',
  'GlowBal will get in touch to understand what you need.':
    'GlowBal sẽ liên lạc với bạn để hiểu hơn về nhu cầu của bạn.',
  'The GlowBal team': 'Đội ngũ của Glowbal',
  'Start with a dream university. Leave with a scholarship plan.':
    'Bắt đầu với một trường đại học mơ ước. Ra về với kế hoạch học bổng.',
  'First name': 'Tên',
  'Last name': 'Họ',
  'Phone number': 'Số điện thoại',
  'Country dialling code': 'Mã vùng quốc gia',
  'Leave us a message...': 'Để lại lời nhắn cho chúng tôi...',
  'Get advice': 'Tư vấn cho tôi',
  'Sending…': 'Đang gửi…',
  'You agree to our friendly': 'Bạn đồng ý với',
  'privacy policy': 'chính sách bảo mật',

  // ── Footer (Figma 104:7404) ──────────────────────────────────────────────
  'Helping students find global universities, scholarships, and application strategies.':
    'Giúp sinh viên tìm kiếm các trường đại học toàn cầu, học bổng và chiến lược nộp hồ sơ.',
  Product: 'Sản phẩm',
  Company: 'Công ty',
  Legal: 'Pháp lý',
  'Find scholarships': 'Tìm kiếm học bổng',
  // 'AI strategy' is already defined in the Navigation block above.
  'Student mentors': 'Cố vấn sinh viên',
  'Our team': 'Đội ngũ',
  'Student stories': 'Câu chuyện của sinh viên',
  'Terms of service': 'Điều khoản dịch vụ',
  '© 2026 GlowBal. Student-first global guidance.':
    '© 2026 GlowBal. Hướng dẫn toàn cầu ưu tiên sinh viên.',
  'Best AI Tool': 'Công cụ AI tốt nhất',
  '2,000+ reviews': 'Hơn 2.000 đánh giá',

  // ── Universities list (Figma 105:8300) ───────────────────────────────────
  // "Find the university...", "Search by university name" and "Sort by" are
  // already defined above (the earlier universities block).
  'Explore universities worldwide and find your perfect fit.':
    'Khám phá các trường đại học trên toàn thế giới và tìm nơi phù hợp nhất với bạn.',
  'Where do you want to study': 'Bạn muốn học ở đâu',
  'Select a major': 'Chọn chuyên ngành',
  'Find universities': 'Tìm trường đại học',
  'Filter by criteria': 'Chọn theo tiêu chí',
  // Criteria chips (only the data-backed ones ship, see university-list-client).
  // 'Scholarships' and 'Acceptance rate' are defined elsewhere in this file.
  'World QS ranking': 'Xếp hạng QS thế giới',
  // Sort chips
  Popular: 'Phổ biến',
  'Price: high to low': 'Giá cao - thấp',
  'Price: low to high': 'Giá thấp - cao',
  // Majors ('Business' and 'Arts & Humanities' are defined elsewhere)
  'Engineering & Technology': 'Kỹ thuật & Công nghệ',
  'Medicine & Health': 'Y khoa & Sức khỏe',
  // Card ('View profile' is defined elsewhere)
  'QS ranking': 'Xếp hạng QS',
  'International tuition': 'Học phí quốc tế',
  'Global top 50': 'Top 50 toàn cầu',
  'Top 200 worldwide': 'Top 200 toàn cầu',
  'Saved to your list': 'Đã lưu vào danh sách của bạn',
  'Removed from your list': 'Đã xóa khỏi danh sách của bạn',
  'No universities match your filters': 'Không có trường nào khớp với bộ lọc của bạn',
  'Try clearing a filter or searching a different name.':
    'Hãy thử bỏ bớt bộ lọc hoặc tìm một tên khác.',
  // Login gate
  'Log in to keep exploring': 'Đăng nhập để tiếp tục khám phá',
  'Create a free account to open full university profiles, discover scholarships and unlock your personalised matches.':
    'Tạo tài khoản miễn phí để mở hồ sơ đầy đủ của trường, khám phá học bổng và mở khóa gợi ý phù hợp riêng cho bạn.',
  'Log in or sign up': 'Đăng nhập hoặc đăng ký',
  'Maybe later': 'Để sau',
  // Nav / mobile chrome ('Menu', 'Close menu', 'Next' are defined elsewhere)
  Previous: 'Trước',

  // ── Language switcher ────────────────────────────────────────────────────
  English: 'Tiếng Anh',
  'Tiếng Việt': 'Tiếng Việt',
};
