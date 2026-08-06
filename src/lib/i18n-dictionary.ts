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
  /*
   * The header nav item, pointing at /how-it-works since 03/08 — the general
   * help page. Note the casing: 'How GLOWBAL works' (further down) is the Home
   * section heading and a SEPARATE key, because DomTranslator matches exact
   * text and the two strings differ.
   */
  'How GlowBal works': 'Cách GlowBal hoạt động',
  // Superseded as a nav label by 'How GlowBal works' when /ai-strategy stopped
  // being the whole explainer. Kept for the same reason as Blog below: any node
  // whose text is still exactly this should translate.
  'Build your strategy': 'Lên Chiến lược Du học', // header until 03/08, Figma 375:9845
  'AI strategy': 'Chiến lược AI', // footer -> /ai-strategy, Figma 104:7413
  'GlowBal Strategy': 'Chiến lược GlowBal', // the stage's own name, /ai-strategy H1 area
  // No longer a nav label — /news is "News" above since 01/08. Kept because
  // DomTranslator matches any node whose text is exactly this.
  Blog: 'Blog',
  Contact: 'Liên hệ',
  // 'Find a mentor' is already defined further down, under the mentorship copy.
  // The three destinations behind the "Search" dropdown translate through keys
  // that already exist: Search, Mentors (above) and Scholarships / Universities
  // (further down, under Topics). Do not add second copies of them here — a
  // duplicate key in this object silently wins or loses by source order.
  // Mobile hamburger sheet. "Plan your studies" is the designer's CTA copy.
  Menu: 'Menu',
  'Close menu': 'Đóng menu',
  // Still the CTA button's copy (MARKETING_NAV_ACTIONS.primary -> /onboarding),
  // which is what a guest sees. The nav ITEM that used to share this string is
  // now "My Portal" below.
  'Plan your studies': 'Lập kế hoạch du học',
  'Build your application strategy':'Lên chiến lược ứng tuyển',
  /*
   * Nav item -> /apply. "Plan your studies" until 31/07, "Application" until
   * 01/08. "Hồ sơ của tôi" rather than a literal "Cổng của tôi": the page is
   * the student's own applications and saved lists, and it already ships that
   * exact wording as its H1 ('My Applications', further down).
   */
  'My Portal': 'Hồ sơ của tôi',
  // Superseded as a nav label by 'My Portal'. Kept for the same reason as Blog.
  Application: 'Ứng tuyển',

  // ── Home hero (Figma 375:9857) ───────────────────────────────────────────
  // DomTranslator matches the *exact* trimmed text of a node, so these keys
  // must stay character-identical to the JSX in features/marketing/ui.
  'A tool built for scholarship hunters': 'Công cụ dành cho "dân săn học bổng"',
  // "200+", not the frame's "300+" — the owner confirmed 200 on 24/07 and again
  // on 28/07. Both languages carry the same number; see the note in home-hero.
  'Personalised analysis and strategy, beside you for the whole scholarship hunt — across 200+ universities and 3,000+ scholarships worth up to $150,000,000.':
    'Phân tích và đưa chiến lược cá nhân hoá, đồng hành xuyên suốt quá trình săn học bổng từ 200+ trường đại học và 3000+ học bổng với trị giá lên đến $150,000,000.',
  'Find matching scholarships': 'Tìm Học bổng Phù hợp',
  // Still rendered by the legacy landing at src/components/landing/home until
  // that tree is deleted. Remove this key with those files, not before.
  'Find my scholarships': 'Tìm học bổng của tôi',

  // ── Home partner wall (Figma 104:7135) ───────────────────────────────────
  // University names live in alt attributes, which DomTranslator never touches,
  // so there is nothing here to accidentally translate.
  //
  // The heading is now "Study <university>", where the second word flips over as
  // a crest is hovered. Only the FIRST word is a key: "Study" is a separate text
  // node from the word beside it, and every value that word can take is an
  // institution name, so each is marked data-no-auto-translate at the call site
  // (see StudyWord in features/marketing/ui/home-partners.tsx) rather than
  // listed here. "Anywhere", the resting value, is the one exception and already
  // has a key further down — do not add a second one.
  //
  // "Học tại" ("study at"), not "Học", because the word that follows is a place:
  // "Học Cambridge" reads as studying the subject of Cambridge.
  Study: 'Học tại',
  // 'Our featured partners': 'Đối tác tiêu biểu của chúng tôi' was here. Removed
  // rather than left behind: nothing renders that string any more (/dev/home
  // renders the same component), and a key with no caller is indistinguishable
  // from one whose caller is broken. It is recorded in the commit if the heading
  // is ever reinstated — but see the ⚠️ in features/marketing/ui/partner-logos.ts
  // before doing that.

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
  // Figma supplies English placeholder copy for the two demo-video rows.
  // All three rows have keys while final product copy and video assets are prepared.
  Features: 'Tính năng',
  'Learn how GlowBal helps you find scholarships from A to Z with just two simple features':
    'Tìm hiểu cách GlowBal giúp bạn săn học bổng từ A-Z, chỉ với 2 tính năng đơn giản',
  // A product name — kept as-is in both languages, like the university names.
  'GlowBal Matcher': 'GlowBal Matcher',
  'Answer simple questions about you. With our G-Matching technology, we can pair you with the best future opportunity from:':
    'Trả lời vài câu hỏi đơn giản về bạn. Với công nghệ G-Matching, chúng tôi ghép bạn với cơ hội phù hợp nhất từ:',
  '200+ top universities globally': 'Hơn 200 trường đại học hàng đầu thế giới',
  '100+ different majors, even the rarest ones': 'Hơn 100 chuyên ngành, kể cả những ngành hiếm nhất',
  '3000+ scholarships': 'Hơn 3000 học bổng',
  'Demo Video 2': 'Video demo 2',
  'An all-in-one customer service platform that helps you balance everything your customers need to be happy.':
    'Một nền tảng dịch vụ khách hàng tất cả trong một giúp bạn cân bằng mọi thứ khách hàng cần để hài lòng.',
  'Keep your customers in the loop with live chat':
    'Luôn cập nhật cho khách hàng bằng trò chuyện trực tiếp',
  'Embed help articles right on your website': 'Nhúng các bài viết trợ giúp ngay trên website của bạn',
  'Customers never have to leave the page to find an answer':
    'Khách hàng không cần rời khỏi trang để tìm câu trả lời',
  'Demo Video 3': 'Video demo 3',
  'Measure what matters with Untitled’s easy-to-use reports. You can filter, export, and drilldown on the data in a couple clicks.':
    'Đo lường những điều quan trọng với báo cáo dễ sử dụng của Untitled. Bạn có thể lọc, xuất và xem chi tiết dữ liệu chỉ với vài cú nhấp chuột.',
  'Filter, export, and drilldown on the data quickly':
    'Lọc, xuất và xem chi tiết dữ liệu nhanh chóng',
  'Save, schedule, and automate reports to your inbox':
    'Lưu, lên lịch và tự động gửi báo cáo đến hộp thư của bạn',
  'Connect the tools you already use with 100+ integrations':
    'Kết nối các công cụ bạn đang dùng với hơn 100 tích hợp',

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
  // The pre-redesign /news layout was deleted on 31/07 when the two blog routes
  // were merged; its copy went with it ("Insights to help you study abroad",
  // "Latest first", "Trending now", the grid/list and sort controls). What is
  // left here is what /news/[slug] and the newsletter card still render.
  Featured: 'Nổi bật',
  'No articles match that search yet.': 'Chưa có bài viết nào khớp với tìm kiếm.',
  'Read article': 'Đọc bài viết',
  'View all articles': 'Xem tất cả bài viết',
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
  'Search articles, topics or tags': 'Tìm bài viết, chủ đề hoặc thẻ',
  /*
   * The list page renders the reading time as two nodes — "12" and "min read" —
   * rather than one interpolated string. DomTranslator matches a text node
   * whole, so "12 min read" could never hit `{minutes} min read` above and every
   * distinct duration would make its own round trip to /api/translate. Split,
   * the number passes through untouched and this key is a free hit.
   *
   * `{minutes} min read` stays: /news/[slug] uses <T k="..."> with a real var,
   * which interpolates through the dictionary rather than through the DOM.
   */
  'min read': 'phút đọc',
  // The count line under the filters, likewise split from its number.
  article: 'bài viết',
  articles: 'bài viết',
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
  Founder: 'Nhà sáng lập',
  'Co-founder':'Đồng sáng lập',
  'Back-end': 'Backend Developer',
  'Front-end & System':'Frontend & System Developer',
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
  'Target intake':'Kỳ nhập học mục tiêu',
  'Member since':'Tham gia từ',
  'Fill in more sections for better course matches and stronger plans.':'Hoàn thiện thêm các mục để nhận gợi ý ngành học phù hợp và lộ trình tối ưu hơn',
  'Keep these up to date for better recommendations and stronger application plans.':'Cập nhật thông tin thường xuyên để nhận đề xuất chính xác và tối ưu hóa chiến lược ứng tuyển',
  'Edit profile':'Chỉnh sửa',
  'Nationality':'Quốc gia',
  'No documents uploaded yet.':'Chưa tải lên tài liệu nào',
  'application in progress':'hồ sơ đang ứng tuyển',
  'Upgrade to GlowBal Plus':'Nâng cấp lên GlowBal Plus',
  'Not started':'Chưa có',
  'Go to my applications':'Đến trang Ứng tuyển',

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

  /*
   * The five stages (STAGE_TEMPLATE in lib/course-parser/extract-course.ts) and
   * the baseline checklist written onto every application at creation
   * (lib/course-parser/baseline-checklist.ts).
   *
   * These are stored in the database as English rows, not rendered from code,
   * but the workspace is under /apply and therefore a PII route with machine
   * translation switched off — so each one has to be a static key or it sits in
   * English forever. AI-extracted task titles cannot be covered this way and do
   * not appear here; they are the course page's own wording.
   *
   * `Research` is already keyed above (as a funding type) and covers the stage.
   */
  'Check eligibility': 'Kiểm tra điều kiện',
  'Prepare documents': 'Chuẩn bị hồ sơ',
  'Improve application': 'Cải thiện hồ sơ',
  /*
   * `Submit` is NOT keyed here. It already exists in the common-actions block
   * near the top as 'Gửi', and this dictionary keys on the English string with
   * no notion of context — so a second entry is a duplicate-key error, and
   * changing the first to 'Nộp hồ sơ' would repaint every generic Submit button
   * in the product. 'Gửi' reads correctly enough as a stage name; disambiguating
   * properly needs a namespaced key, which this dictionary does not have.
   */
  'Understand the course, the university and whether it fits your plans.':
    'Tìm hiểu khoá học, trường và mức độ phù hợp với dự định của bạn.',
  'Confirm you meet the academic, English and test requirements.':
    'Xác nhận bạn đáp ứng yêu cầu học thuật, tiếng Anh và các bài thi.',
  'Gather and write everything the application asks you to submit.':
    'Chuẩn bị và viết mọi giấy tờ mà hồ sơ yêu cầu.',
  'Strengthen the parts of your application that are weakest.':
    'Củng cố những phần yếu nhất trong hồ sơ của bạn.',
  'Send the application and track its progress.': 'Nộp hồ sơ và theo dõi tiến độ.',

  'Read the official course page': 'Đọc trang khoá học chính thức',
  'Confirm the course is the one you want: what it covers, how long it runs and where it is taught.':
    'Xác nhận đây đúng là khoá học bạn muốn: nội dung, thời lượng và nơi đào tạo.',
  'Find the application deadline': 'Tìm hạn nộp hồ sơ',
  'Deadlines differ by course and by round. Note the one that applies to you and work back from it.':
    'Hạn nộp khác nhau theo khoá học và theo đợt. Ghi lại hạn áp dụng cho bạn và lên kế hoạch ngược từ đó.',
  'Check the academic requirements': 'Kiểm tra yêu cầu học thuật',
  'Compare your grades and subjects against what the course asks for.':
    'Đối chiếu điểm và môn học của bạn với yêu cầu của khoá học.',
  'Check the English language requirement': 'Kiểm tra yêu cầu tiếng Anh',
  'Find the minimum score and whether individual band scores are set separately.':
    'Tìm điểm tối thiểu và xem trường có yêu cầu điểm từng kỹ năng riêng không.',
  'Check whether any admission test is required': 'Kiểm tra xem có bài thi đầu vào nào không',
  'Some courses and countries require an entrance or aptitude test with its own deadline.':
    'Một số khoá học và quốc gia yêu cầu bài thi đầu vào hoặc thi năng lực, có hạn nộp riêng.',
  'Gather your academic transcripts': 'Chuẩn bị bảng điểm',
  'Official transcripts for every year of study, translated if they are not in English.':
    'Bảng điểm chính thức của tất cả các năm học, dịch thuật nếu không phải tiếng Anh.',
  'Write your personal statement': 'Viết bài luận cá nhân',
  'Why this subject, why this university, and what you have done that shows it.':
    'Vì sao chọn ngành này, vì sao chọn trường này, và bạn đã làm gì để chứng minh điều đó.',
  'Request your letters of recommendation': 'Xin thư giới thiệu',
  'Ask early. Referees need time, and most portals want their details before you submit.':
    'Hãy hỏi sớm. Người giới thiệu cần thời gian, và hầu hết hệ thống yêu cầu thông tin của họ trước khi bạn nộp.',
  'Prepare your CV': 'Chuẩn bị CV',
  'Education, work, activities and achievements on one or two pages.':
    'Học vấn, kinh nghiệm, hoạt động và thành tích trong một đến hai trang.',
  'Review your personal statement': 'Rà soát lại bài luận cá nhân',
  'Read it back against the course page and cut anything that is not about this course.':
    'Đọc lại bài luận cùng với trang khoá học và bỏ đi những gì không liên quan đến khoá học này.',
  'Strengthen your weakest requirement': 'Củng cố yêu cầu bạn còn yếu nhất',
  'Whichever requirement you are furthest from meeting is the one worth the remaining time.':
    'Yêu cầu bạn còn cách xa nhất là yêu cầu đáng dành thời gian còn lại nhất.',
  'Complete the online application form': 'Hoàn thành mẫu đơn trực tuyến',
  'Fill in the university or national portal and attach every document it asks for.':
    'Điền vào hệ thống của trường hoặc hệ thống quốc gia và đính kèm mọi giấy tờ được yêu cầu.',
  'Pay the application fee and submit': 'Đóng lệ phí và nộp hồ sơ',
  'Keep the confirmation — it is what you quote if you need to chase the application.':
    'Giữ lại xác nhận — đó là thứ bạn cần khi hỏi lại về hồ sơ.',

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

  // ── Onboarding wizard: câu 6 & 7 (academic intake) ───────────────────────
  // The progress bar navigates, so its segments need accessible names — see
  // onboarding-wizard.tsx. "Question" is interpolated with the step number.
  'Onboarding questions': 'Các câu hỏi tìm hiểu',
  Question: 'Câu hỏi',

  'Academic Information': 'Thông tin học tập',
  'Which curriculum are you studying, and how are you graded on it?':
    'Bạn đang học chương trình nào, và được chấm điểm theo thang điểm nào?',
  'Add any test results you already have. Leave a score blank if you are still waiting for it.':
    'Thêm những kết quả thi bạn đã có. Để trống nếu bạn vẫn đang chờ kết quả.',
  Curriculum: 'Chương trình học',
  'Select a curriculum': 'Chọn chương trình học',
  'How are you graded?': 'Bạn được chấm điểm theo thang nào?',
  // 'English proficiency' is already above, in the profile section.
  'English Proficiency': 'Trình độ tiếng Anh',
  'Standardized test': 'Kỳ thi chuẩn hóa',
  'Standardized Test': 'Kỳ thi chuẩn hóa',
  'Your score': 'Điểm của bạn',

  // Curricula. The exam-board names are proper nouns and stay as they are.
  'Vietnamese National Curriculum': 'Chương trình Giáo dục Phổ thông Việt Nam',
  'Others...': 'Khác...',

  // Grading scales.
  '10-point scale': 'Thang điểm 10',
  '4.0 scale': 'Thang điểm 4.0',
  'IB points (out of 45)': 'Điểm IB (trên 45)',
  '7-point subject average': 'Điểm trung bình môn (thang 7)',
  'A Level / AS letter grades': 'Điểm chữ A Level / AS',
  'IGCSE grades (9–1)': 'Điểm IGCSE (9–1)',
  '4.0 scale (unweighted)': 'Thang 4.0 (không trọng số)',
  '5.0 scale (weighted)': 'Thang 5.0 (có trọng số)',
  'Percentage (%)': 'Phần trăm (%)',
  'Other scale — describe it': 'Thang điểm khác — mô tả rõ',

  // Grade / score field labels.
  'Current GPA (0–10)': 'GPA hiện tại (0–10)',
  'Current GPA (0–4.0)': 'GPA hiện tại (0–4.0)',
  'Current GPA (0–5.0)': 'GPA hiện tại (0–5.0)',
  'Predicted or current IB total': 'Tổng điểm IB dự kiến hoặc hiện tại',
  'Average subject grade (1–7)': 'Điểm trung bình môn (1–7)',
  'Your A Level / AS grades': 'Điểm A Level / AS của bạn',
  'Your IGCSE grades': 'Điểm IGCSE của bạn',
  'Current average (%)': 'Điểm trung bình hiện tại (%)',
  'Your grade and its scale': 'Điểm của bạn kèm thang điểm',
  'Overall band': 'Điểm band tổng',
  'Total score': 'Tổng điểm',
  'Overall score': 'Điểm tổng',
  'Cambridge English Scale score': 'Điểm theo thang Cambridge English',
  'Composite score': 'Điểm tổng hợp',
  'Your AP scores': 'Điểm AP của bạn',
  'IB total': 'Tổng điểm IB',
  'Your A Level grades': 'Điểm A Level của bạn',
  'Your GCSE / IGCSE grades': 'Điểm GCSE / IGCSE của bạn',

  // Field hints.
  'Your overall average, as it appears on your transcript.':
    'Điểm trung bình chung (như trên học bạ của bạn).',
  'Unweighted GPA on the 4.0 scale.': 'GPA không trọng số trên thang 4.0.',
  'Six subjects plus the bonus points — 24 to 45.':
    'Sáu môn cộng điểm thưởng — 24 đến 45.',
  'Use this if you only have per-subject grades so far.':
    'Chọn mục này nếu bạn mới chỉ có điểm từng môn.',
  'Predicted grades are fine — mark them as predicted in your notes.':
    'Điểm dự kiến cũng được — hãy ghi rõ đó là điểm dự kiến.',
  'List one number per subject.': 'Ghi một số cho mỗi môn.',
  'The unweighted GPA on your transcript.': 'GPA không trọng số trên học bạ của bạn.',
  'Use this only if your school weights AP and honours courses.':
    'Chỉ chọn nếu trường bạn cộng trọng số cho lớp AP và honours.',
  'Your overall average as a percentage.':
    'Điểm trung bình chung của bạn tính theo phần trăm.',
  'Start with the number — for example 18/20 or 87%.':
    'Bắt đầu bằng con số — ví dụ 18/20 hoặc 87%.',
  'Half bands only — 0 to 9.': 'Chỉ theo nửa band — 0 đến 9.',
  'Four sections out of 30 each — 0 to 120.':
    'Bốn phần, mỗi phần tối đa 30 — tổng 0 đến 120.',
  '10 to 90.': '10 đến 90.',
  'Reported in steps of 5 — 10 to 160.': 'Báo theo bước 5 — 10 đến 160.',
  '80 to 230 on the Cambridge English Scale.':
    '80 đến 230 trên thang Cambridge English.',
  'Reported in steps of 10 — 400 to 1600.': 'Báo theo bước 10 — 400 đến 1600.',
  '1 to 36.': '1 đến 36.',
  'One score per exam, 1 to 5.': 'Một điểm cho mỗi kỳ thi, 1 đến 5.',
  '24 to 45.': '24 đến 45.',
  'One letter per subject; A* to E.': 'Một điểm chữ cho mỗi môn; A* đến E.',
  'Numbers (9–1) or letters (A*–G).': 'Dạng số (9–1) hoặc dạng chữ (A*–G).',

  // Rejected values. `{min}`, `{max}`, `{decimals}`, `{step}` and `{example}`
  // are interpolated by t() — keep the braces and the names verbatim.
  'Enter a number between {min} and {max}.': 'Hãy nhập một số từ {min} đến {max}.',
  'This scale uses whole numbers only.': 'Thang điểm này chỉ nhận số nguyên.',
  'Round to {decimals} decimal places or fewer.':
    'Làm tròn tới tối đa {decimals} chữ số thập phân.',
  'Scores on this scale move in steps of {step}.':
    'Điểm trên thang này nhảy theo bước {step}.',
  'Use grades like {example}.': 'Hãy nhập theo dạng {example}.',
  'Enter your grade so we can match you accurately.':
    'Hãy nhập điểm của bạn để chúng tôi ghép cặp chính xác.',

  // ── Home: scholarship rail (Figma 104:7225) ──────────────────────────────
  // The design writes these in Vietnamese; the English above is the source
  // string, so these entries are the designer's own wording restored.
  'Scholarship library': 'Kho học bổng',
  'Scholarship library ....': 'Kho học bổng ....',
  'Browse a free preview. Create your profile to unlock full eligibility requirements and required documents, then save opportunities to your plan.':
    'Duyệt xem trước miễn phí. Tạo hồ sơ của bạn để mở khóa đầy đủ điều kiện, tài liệu cần thiết và lưu cơ hội vào kế hoạch của bạn.',
  'Funding opportunities, curated for you': 'Cơ hội hỗ trợ tài chính dành riêng cho bạn',
  'Explore verified funding opportunities, save your strongest fits, and turn your university plans into a clearer path forward.':
    'Khám phá các cơ hội hỗ trợ tài chính đã được xác thực, lưu những lựa chọn phù hợp nhất và biến kế hoạch chọn trường thành lộ trình rõ ràng hơn.',
  opportunities: 'cơ hội',
  'matched to you': 'phù hợp với bạn',
  saved: 'đã lưu',
  'Find your next opportunity': 'Tìm cơ hội tiếp theo của bạn',
  'Narrow the vault by eligibility, funding, and destination.': 'Lọc theo điều kiện, mức hỗ trợ và điểm đến du học.',
  'Browse a preview for free. Create your profile to unlock the full eligibility criteria and required documents, and to save opportunities into your plan.':
    'Duyệt xem trước miễn phí. Tạo hồ sơ của bạn để mở khóa đầy đủ điều kiện, tài liệu cần thiết và lưu cơ hội vào kế hoạch của bạn.',
  'See more': 'Xem thêm',
  'View scholarship': 'Xem học bổng',
  'Scroll or swipe to see more scholarships.':
    'Cuộn hoặc vuốt để xem thêm học bổng.',

  // ── Home: testimonials (Figma 104:7265) ──────────────────────────────────
  'Learn from students who have succeeded': 'Học hỏi từ những sinh viên đã thành công',
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
  'GlowBal is a study-abroad planning platform that helps you explore universities, discover scholarships and organise your next steps in one place.':
    'GlowBal là nền tảng lập kế hoạch du học, giúp bạn khám phá các trường đại học, tìm học bổng và sắp xếp các bước tiếp theo tại một nơi.',
  'You can explore universities and start building your profile for free. Any optional paid service is clearly explained before it applies.':
    'Bạn có thể khám phá các trường đại học và bắt đầu tạo hồ sơ miễn phí. Mọi dịch vụ trả phí tùy chọn đều được giải thích rõ trước khi áp dụng.',
  'It turns the information you add into practical next steps for your university and scholarship plan. It is guidance, so always check official requirements before you apply.':
    'Tính năng này biến thông tin bạn cung cấp thành các bước tiếp theo thiết thực cho kế hoạch chọn trường và học bổng. Đây là gợi ý, vì vậy hãy luôn kiểm tra yêu cầu chính thức trước khi nộp đơn.',
  'They are students and graduates who share first-hand experience of applications, scholarships and student life. Their availability and areas of expertise vary.':
    'Họ là sinh viên và cựu sinh viên chia sẻ kinh nghiệm trực tiếp về hồ sơ, học bổng và đời sống sinh viên. Thời gian hỗ trợ và lĩnh vực chuyên môn của mỗi người có thể khác nhau.',
  'No. You can begin with a country, subject or budget and use GlowBal to compare universities before deciding where to apply.':
    'Không. Bạn có thể bắt đầu với quốc gia, ngành học hoặc ngân sách, rồi dùng GlowBal để so sánh các trường đại học trước khi quyết định nơi nộp đơn.',
  'Your profile gives GlowBal the context to organise relevant opportunities, save your shortlist and make your next steps more personal.':
    'Hồ sơ giúp GlowBal có đủ thông tin để sắp xếp các cơ hội phù hợp, lưu danh sách lựa chọn và cá nhân hóa các bước tiếp theo của bạn.',

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

  // ── Loading states ───────────────────────────────────────────────────────
  // The `label` a caller hands the globe loader (src/shared/ui/globe-loader.tsx)
  // — the line under the spinning globe that says what is actually happening.
  // The playful rotating line above it is NOT here: it lives in
  // src/shared/ui/loading-phrases.ts as EN/VI pairs, for the reasons set out in
  // that file's header.
  Loading: 'Đang tải',
  'Checking your details': 'Đang kiểm tra thông tin của bạn',
  'Signing you out': 'Đang đăng xuất',
  'Signing you up': 'Đang đăng ký cho bạn',
  'Saving your profile': 'Đang lưu hồ sơ của bạn',
  'Building your profile': 'Đang dựng hồ sơ của bạn',
  'Saving your answers': 'Đang lưu câu trả lời của bạn',
  'Saving your achievements': 'Đang lưu thành tích của bạn',
  'Uploading your document': 'Đang tải tài liệu lên',
  'Uploading your documents': 'Đang tải tài liệu lên',
  'Searching universities': 'Đang tìm trường',
  'Finding scholarships for you': 'Đang tìm học bổng cho bạn',
  'Finding courses for you': 'Đang tìm khoá học cho bạn',
  'Loading your applications': 'Đang tải hồ sơ ứng tuyển của bạn',
  'Loading your profile': 'Đang tải hồ sơ của bạn',
  'Adding courses to your plan': 'Đang thêm khoá học vào kế hoạch',
  'Reading your statement': 'Đang đọc bài luận của bạn',
  'Analysing your statement': 'Đang phân tích bài luận của bạn',
  'Recalculating your match': 'Đang tính lại mức độ phù hợp',
  'Submitting your application': 'Đang gửi hồ sơ của bạn',
  'Submitting your review': 'Đang gửi đánh giá của bạn',
  'Sending your feedback': 'Đang gửi phản hồi của bạn',
  'Opening secure checkout': 'Đang mở trang thanh toán bảo mật',
  'Updating your availability': 'Đang cập nhật lịch rảnh của bạn',
  'Saving your rate': 'Đang lưu mức phí của bạn',
  'Updating the user': 'Đang cập nhật người dùng',
  'Updating the coordinator': 'Đang cập nhật điều phối viên',
  'Updating the ambassador': 'Đang cập nhật đại sứ',
  'Updating the article': 'Đang cập nhật bài viết',
  'Updating the application': 'Đang cập nhật hồ sơ',
  'Updating the booking': 'Đang cập nhật lịch hẹn',
  'Saving the article': 'Đang lưu bài viết',
  'Loading article links': 'Đang tải liên kết bài viết',
  'Saving article links': 'Đang lưu liên kết bài viết',

  // ── Mentor profile, /mentors/[id] (Figma 375:21633) ──────────────────────
  // The frame's Vietnamese is the source for these; the English literals in
  // the JSX are the translation back, so the pairs read in the frame's voice.
  'All mentors': 'Tất cả cố vấn',
  About: 'Giới thiệu',
  Strengths: 'Điểm mạnh',
  'Best for': 'Tốt nhất cho',
  // `Reviews`, `Book a session` and `Back` are deliberately absent — all three
  // are already defined above (lines 331, 394, 128) and a duplicate key is a
  // type error. The existing Vietnamese covers this page unchanged.
  'Book this mentor': 'Đặt lịch với cố vấn này',
  // Its own text node beside the formatted price, so it translates on its own.
  '/hour': '/giờ',
  'Book now': 'Đặt lịch ngay',
  'Available times': 'Khung giờ trống',
  'No reviews yet — be the first to book and leave one.':
    'Chưa có đánh giá nào — hãy là người đầu tiên đặt lịch và để lại đánh giá.',
  '+ 10% service fee · paid securely through Stripe':
    '+ 10% phí dịch vụ · thanh toán an toàn qua Stripe',
  'Pick any open day below. Sessions must be booked at least an hour ahead.':
    'Chọn bất kỳ ngày nào mở bên dưới. Buổi tư vấn cần được đặt trước ít nhất một giờ.',
  'This mentor hasn’t published availability for the next 90 days.':
    'Cố vấn này chưa mở lịch cho 90 ngày tới.',
  'No ratings yet': 'Chưa có đánh giá nào',
  'No open times right now': 'Hiện chưa có khung giờ trống',
  'Select a day with a dot to see its times.':
    'Chọn một ngày có dấu chấm để xem khung giờ.',
  'No date selected': 'Chưa chọn ngày',
  'Loading availability…': 'Đang tải lịch trống…',
  Today: 'Hôm nay',
  'Not bookable yet': 'Chưa thể đặt lịch',
  'What do you want help with?': 'Bạn muốn được hỗ trợ điều gì?',
  'What would you like to ask?': 'Bạn muốn hỏi điều gì?',
  'The more context you give, the more your mentor can prepare.':
    'Bạn chia sẻ càng cụ thể, cố vấn càng chuẩn bị tốt.',
  'Or type your own topic': 'Hoặc tự nhập chủ đề của bạn',
  'Session topic': 'Chủ đề buổi tư vấn',
  'Service fee (10%)': 'Phí dịch vụ (10%)',
  Total: 'Tổng cộng',
  'Redirecting…': 'Đang chuyển hướng…',
  'Personal statement review': 'Review bài luận cá nhân',
  'Course & university choice': 'Lựa chọn chương trình học & trường',
  'Interview practice': 'Luyện phỏng vấn',
  'Scholarships & funding': 'Học bổng & trợ cấp',
  'Life on campus': 'Đời sống sinh viên',
  'Previous month': 'Tháng trước',
  'Next month': 'Tháng sau',
  'Talk to a student who has already been admitted where you are applying.':'Hãy kết nối với các sinh viên đang theo học tại ngôi trường bạn muốn nộp hồ sơ',
  'Anywhere':'Mọi nơi',
  'Subject':'Ngành học',
  'Search by name or university':'Tìm kiếm theo tên sinh viên hoặc trường',

  // ── University detail, /universities/[id] (Figma 375:10629) ───────────────
  //
  // The section bar and the strip/rail labels. Listed here rather than left to
  // /api/translate because the bar is the first thing on the page a reader uses:
  // uncovered strings made it render half-Vietnamese ("Giới thiệu · Subjects ·
  // Tuyển sinh · Location") until four sequential round trips came back, and the
  // labels are fixed UI text, so paying a model for them on every load is waste.
  // `About`, `Admissions`, `Careers`, `Overview` and `At a glance` are already
  // covered above.
  Subjects: 'Các ngành',
  Location: 'Địa điểm',
  'Costs & funding': 'Chi phí & Tài trợ',
  'Why this university': 'Vì sao chọn trường này',
  'Talk to a student': 'Kết nối với sinh viên',
  Programmes: 'Chương trình học',
  'Statement review': 'Nhận xét bài luận',
  // Section eyebrows.
  Academics: 'Học thuật',
  'Getting in': 'Tuyển sinh',
  'On campus': 'Trong trường',
  Money: 'Chi phí',
  'After graduation': 'Sau khi tốt nghiệp',
  'The honest view': 'Góc nhìn thực tế',
  'Ask a human': 'Tư vấn trực tiếp',
  VinUniversity: 'VinUniversity',
  // Stat strip and facts rail. `Acceptance rate` is already covered above.
  'QS World Rank': 'Xếp hạng QS thế giới',
  'Typical GPA': 'GPA điển hình',
  'Tuition / year': 'Học phí / năm',
  'Application deadline': 'Hạn nộp đơn',
  'Admission difficulty': 'Độ khó tuyển sinh',
  'Living cost (USD / year)': 'Chi phí sinh hoạt (USD / năm)',
  'English requirement': 'Yêu cầu tiếng Anh',
  // Body sections.
  // `Best for`, `International environment` and `Teaching style` are already
  // covered above, as are `Find a mentor` and `Frequently asked questions`.
  'Subjects and fit': 'Các ngành & mức độ phù hợp',
  'Strongest subjects': 'Ngành mạnh nhất',
  'Admission requirements': 'Yêu cầu tuyển sinh',
  'Campus and location': 'Khuôn viên & vị trí',
  'Costs and scholarships': 'Chi phí & học bổng',
  'Careers and outcomes': 'Nghề nghiệp & kết quả',
  'Talk to someone who studied here': 'Nói chuyện với người từng học ở đây',
  'Worth knowing': 'Nên biết',
  "GlowBal's insider note": 'Ghi chú nội bộ của GlowBal',
  'Back to university search': 'Quay về trang Tìm trường đại học',
  'Official website': 'Website chính thức',
  'See all scholarships': 'Xem tất cả học bổng',
  'Colleges and programmes': 'Các trường & chương trình',

  // ── "My application", the upper half of /apply (Figma 562:15386) ──────────
  //
  // ⚠️ These were MISSING until the merge, and the omission was invisible for
  // the same reason it mattered: /apply has been in PII_ROUTE_PREFIXES all
  // along, so there was no machine fallback to paper over them — the tracker's
  // heading, its subtitle and the import bar simply sat in English on the
  // Vietnamese page. Same rule as the saved-list block below: every string.
  'My application': 'Hồ sơ ứng tuyển của tôi',
  'The courses you are applying to, how far along each one is, and what is due next.':
    'Các khoá học bạn đang ứng tuyển, tiến độ từng hồ sơ và việc cần làm tiếp theo.',
  'Nothing here yet — tick a university in your saved list below and plan its application.':
    'Chưa có gì ở đây — tích chọn một trường trong danh sách đã lưu bên dưới và lên kế hoạch ứng tuyển.',
  'Continue applying': 'Tiếp tục apply',
  // `Deadline` is already keyed further up (line ~442) and covers this row too.
  //
  // The countdown under the date (features/apply/domain/deadline.ts). Same
  // split as the scholarship bar's "Scholarship 50%": the number is its own
  // text node in the component, so only the noun needs a key here — an
  // interpolated "3 days left" could never be a dictionary hit on this route.
  'day left': 'ngày nữa',
  'days left': 'ngày nữa',
  'Due today': 'Hạn hôm nay',
  'Deadline passed': 'Đã quá hạn',
  /*
   * The paste-a-URL importer's six strings were removed here on 01/08 along
   * with the bar itself ('Add a course', 'Paste a university course page URL',
   * 'Add course', 'Adding…', and the two lines under them). Applications are
   * created from the saved list now — see my-application-section.tsx (5).
   */
  'GlowBal’s AI is reading the course page and building your checklist…':
    'AI của GlowBal đang đọc trang khoá học và dựng danh sách việc cần làm…',
  'Could not reach the server. Please try again.':
    'Không kết nối được máy chủ. Vui lòng thử lại.',

  // ── Saved list, now the lower half of /apply (Figma 562:15078, previously
  //    375:12701 · 375:12841 · 375:13295 · 375:13369 · 502:18462) and the
  //    subject picker (375:13546) ────────────────────────────────────────────
  //
  // ⚠️ EVERY string on these two routes has to be here. `/apply` is in
  // PII_ROUTE_PREFIXES (src/lib/dom-translate.tsx), so whole-page machine
  // translation is switched OFF — there is no fallback, and anything missing
  // sits in English on a Vietnamese page permanently. That is also why the
  // components split labels away from values: an interpolated "Scholarship 50%"
  // or "Deadline: 5 Jan 2026" could never be a dictionary hit.
  'Saved list': 'Danh sách đã lưu',
  // Added with the merge — the two sections now talk to each other.
  'Go to my saved list': 'Đến danh sách đã lưu',
  'Tick a university in your saved list below, choose the subject you want, and plan its application. It will appear here.':
    'Tích chọn một trường trong danh sách đã lưu bên dưới, chọn ngành bạn muốn và lên kế hoạch ứng tuyển. Hồ sơ sẽ hiện ở đây.',
  'We could not set those applications up. Please try again.':
    'Chúng tôi không thiết lập được các hồ sơ đó. Vui lòng thử lại.',
  /*
   * Replaces "We need the course page link to build a checklist…". A subject is
   * now enough to plan an application, so the student is never sent looking for
   * a URL — see planApplications in application-progress-client.tsx.
   */
  'Choose a subject for that university to plan its application.':
    'Hãy chọn ngành cho trường đó để lên kế hoạch ứng tuyển.',
  'You have reached the number of courses your plan allows.':
    'Bạn đã dùng hết số khoá học mà gói của bạn cho phép.',
  'Setting up your application': 'Đang thiết lập hồ sơ ứng tuyển của bạn',
  'The universities you have saved, with their deadlines and any scholarships you have attached.':
    'Các trường bạn đã lưu, kèm hạn chót và học bổng bạn đã áp dụng.',
  'Nothing saved yet — the universities you save while browsing show up here.':
    'Chưa lưu trường nào — các trường bạn lưu khi tìm kiếm sẽ hiện ở đây.',
  'Save a university from the search page and it will appear here with its deadline and the scholarships attached to it.':
    'Lưu một trường từ trang tìm kiếm, trường đó sẽ hiện ở đây kèm hạn chót và các học bổng đi cùng.',
  'Saved universities': 'Trường đã lưu',
  'Economics':'Kinh tế',
  'Humanities':'Nhân văn',

  // The row (375:12726). `QS World Ranking` is already covered further up.
  'THE Ranking': 'Xếp hạng THE',
  'Deadline:': 'Hạn chót:',
  '/ year': '/ năm',
  'Subject:': 'Ngành:',
  'No subject chosen yet': 'Chưa chọn ngành',
  // The frame's own wording for this link, kept verbatim.
  'Change subject here': 'Chọn lại ngành tại đây',
  'Choose a subject here': 'Chọn ngành tại đây',
  'Course page': 'Trang khoá học',
  'Official site': 'Liên kết chính thức',
  Remove: 'Xóa',
  /*
   * ⚠️ NOT COVERED, and it cannot be: the row checkbox and the picker's radios
   * carry interpolated aria-labels ("Select Massachusetts Institute of
   * Technology", "Choose Fulbright Scholarship 2026"). There is no static key for
   * a string containing a university name, and this route has no machine
   * fallback, so those stay English for screen-reader users. Fixing it properly
   * means a t()-with-parameters helper, which this dictionary does not have.
   */

  // The scholarship bar (375:12813 / 375:12841)
  'See all the scholarships you could apply for': 'Xem thêm tất cả các học bổng',
  'Scholarships here': 'Học bổng tại đây',
  Scholarship: 'Học bổng',
  'scholarship attached': 'học bổng đã áp dụng',
  'scholarships attached': 'học bổng đã áp dụng',
  'Apply scholarship': 'Áp học bổng',
  'Plan my application': 'Lên kế hoạch ứng tuyển',
  'Tick a university to plan its application.':
    'Tích chọn một trường để lên kế hoạch ứng tuyển.',

  // The picker (375:13295)
  'Apply a scholarship': 'Áp học bổng',
  'Scholarships for your saved list': 'Học bổng cho danh sách đã lưu',
  'Pick a scholarship to attach to your saved university. It will show on the university and in your plan.':
    'Chọn một học bổng để áp cho trường bạn đã lưu. Học bổng sẽ hiện trên trường đó và trong kế hoạch của bạn.',
  'Everything our directory links to the universities you saved. Open one to see who it is for and what it covers.':
    'Tất cả học bổng mà hệ thống liên kết với các trường bạn đã lưu. Mở một học bổng để xem đối tượng và mức hỗ trợ.',
  'None of the universities you selected have a scholarship in our directory yet.':
    'Các trường bạn chọn hiện chưa có học bổng nào trong hệ thống.',
  'None of the universities on your saved list have a scholarship in our directory yet.':
    'Các trường trong danh sách đã lưu hiện chưa có học bổng nào trong hệ thống.',
  'Available scholarships': 'Học bổng khả dụng',
  'See details': 'Xem chi tiết',
  'Value not published': 'Chưa công bố giá trị',
  'Apply scholarship now': 'Áp học bổng ngay',
  Close: 'Đóng',
  // `Please wait...` is already covered further up this file.

  // The scholarship detail panel (375:13369)
  'Scholarship value': 'Gía trị học bổng',
  'Who it is for': 'Đối tượng',
  'Application conditions': 'Điều kiện ứng tuyển',
  Analysis: 'Phân tích',
  'Applies to': 'Trường áp dụng',
  'Open the official page': 'Mở trang chính thức',

  // The confirmation (502:18462). The frame reads "Thanh you for you
  // applycation"; shipped without the typos.
  'Thank you for your application': 'Cảm ơn bạn đã ứng tuyển',
  'Your scholarship is now part of your plan.':
    'Học bổng đã được thêm vào kế hoạch của bạn.',
  'Back to my saved list': 'Quay lại danh sách đã lưu',
  'Go to my plan': 'Đi đến trang apply',
  'Scholarship added': 'Đã thêm học bổng',

  // Toasts
  'Could not remove that university. Please try again.':
    'Không thể xoá trường này. Vui lòng thử lại.',
  'Could not attach that scholarship. Please try again.':
    'Không thể áp học bổng này. Vui lòng thử lại.',
  'Your session expired. Please sign in again.':
    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',

  // The subject picker (375:13546)
  'Select a subject': 'Chọn ngành',
  School: 'Trường/Viện',
  'Search schools': 'Tìm trường/viện',
  'Search subjects': 'Tìm ngành',
  'We do not have a subject list for this university yet. Paste a link to the course page below and it will show on your saved list.':
    'Hệ thống chưa có danh sách ngành cho trường này. Hãy dán link trang khoá học bên dưới, link sẽ hiện trong danh sách đã lưu của bạn.',
  'Collected from this university’s own course catalogue. Check the official page before you apply.':
    'Được thu thập từ danh mục khoá học của chính trường. Hãy kiểm tra trang chính thức trước khi nộp hồ sơ.',
  'Open the official course page': 'Mở trang khoá học chính thức',
  // Was "Cannot find the subject you want? Paste a link to it", when a link was
  // the only route to an application. It is optional now — see the note in
  // program-picker.tsx.
  'Have a link to the course page? (optional)': 'Có link trang khoá học? (không bắt buộc)',
  'We will read it and build a checklist specific to this course. Without one you still get the standard application checklist.':
    'Chúng tôi sẽ đọc link và dựng danh sách việc cần làm riêng cho khoá học này. Không có link thì bạn vẫn nhận được danh sách việc cần làm tiêu chuẩn.',
  'Optional. It shows as a link on your saved list.':
    'Không bắt buộc. Link sẽ hiện trong danh sách đã lưu của bạn.',
  'That does not look like a course page link — it needs to start with http:// or https://':
    'Đây không giống link trang khoá học — link cần bắt đầu bằng http:// hoặc https://',
  'Save subject': 'Lưu ngành',
  'Saving...': 'Đang lưu...',
  'Pick a subject or paste a course link to continue.':
    'Chọn một ngành hoặc dán link khoá học để tiếp tục.',
  'Saving a subject is not switched on in this environment yet — the user_universities.program column has not been added. Nothing was changed.':
    'Tính năng lưu ngành chưa được bật ở môi trường này — cột user_universities.program chưa được thêm. Không có thay đổi nào được lưu.',
  'We could not save that. Please try again.': 'Không thể lưu. Vui lòng thử lại.',
  Reset: 'Đặt lại',

  /*
   * Counts and durations on the picker's two lists (the frame's "4
   * specializations" and "(4 năm)").
   *
   * Enumerated rather than interpolated for the reason at the top of this
   * section: these are `MultiSelectOption.description` strings, so there is no
   * text node to split, and this route has no machine-translation fallback. The
   * ranges cover what the one catalogue in the repo actually contains (VinUni's
   * colleges hold 1–6 programmes; its degrees run 4–6 years) with headroom.
   */
  '1 programme': '1 chương trình',
  '2 programmes': '2 chương trình',
  '3 programmes': '3 chương trình',
  '4 programmes': '4 chương trình',
  '5 programmes': '5 chương trình',
  '6 programmes': '6 chương trình',
  '7 programmes': '7 chương trình',
  '8 programmes': '8 chương trình',
  // Degree levels, folded to one spelling by `degreeLabel` in the api slice —
  // the raw `catalog_programmes.degree_level` has both "master" and "Master's".
  Bachelor: 'Cử nhân',
  Master: 'Thạc sĩ',
  Diploma: 'Cao đẳng',
  // `PhD` is already covered further up, in the onboarding vocabulary.

  '1 year': '1 năm',
  '2 years': '2 năm',
  '3 years': '3 năm',
  '4 years': '4 năm',
  '5 years': '5 năm',
  '6 years': '6 năm',
  '7 years': '7 năm',
  '8 years': '8 năm',

  // ── GlowBal Plus (/plus, /plus/success) ──────────────────────────────────
  // Added 2026-08-02 with the page's rebuild. It had ONE key before that
  // ('Upgrade to GlowBal Plus', further up, which belongs to /profile), so the
  // whole pricing page — every tier name, price caption and comparison row —
  // was reaching /api/translate on a Vietnamese visitor's first paint and
  // rendering whatever came back unread. The tier names, taglines, duration
  // labels and comparison rows below are the literals in src/lib/plus.ts; the
  // rest are in src/app/plus/*.
  'GlowBal Plus': 'GlowBal Plus',
  'Unlock your full scholarship plan': 'Mở khóa kế hoạch săn học bổng đầy đủ của bạn',
  'Go beyond searching — more AI application strategies, full scholarship details, a document checklist, and priority student-supporter access. Designed to help you apply with a clearer, stronger strategy.':
    'Không chỉ dừng lại ở việc tìm kiếm — thêm chiến lược ứng tuyển từ AI, thông tin học bổng đầy đủ, danh sách hồ sơ cần chuẩn bị và quyền hỗ trợ ưu tiên từ đội ngũ sinh viên. Được thiết kế để bạn nộp hồ sơ với một chiến lược rõ ràng và mạnh mẽ hơn.',
  'More AI strategy credits': 'Thêm tín dụng chiến lược AI',
  'Full scholarship details': 'Thông tin học bổng đầy đủ',
  'Priority supporter access': 'Ưu tiên kết nối người hỗ trợ',
  '🎉 Your profile is set up': '🎉 Hồ sơ của bạn đã sẵn sàng',
  'Get the most from GlowBal with Plus — or keep exploring for free.':
    'Tận dụng tối đa GlowBal với Plus — hoặc tiếp tục khám phá miễn phí.',
  'Maybe later — see my matches →': 'Để sau — xem trường phù hợp với tôi →',
  'Checkout cancelled': 'Đã hủy thanh toán',
  'Nothing was charged. Your plan is unchanged — pick it up again whenever you are ready.':
    'Bạn chưa bị trừ khoản nào. Gói của bạn không thay đổi — hãy quay lại bất cứ khi nào bạn sẵn sàng.',
  'You’re on GlowBal Plus': 'Bạn đang dùng GlowBal Plus',
  'Thanks for your support — you can extend your plan any time below.':
    'Cảm ơn bạn đã ủng hộ — bạn có thể gia hạn gói bất cứ lúc nào ở bên dưới.',
  'GlowBal Plus is coming soon': 'GlowBal Plus sắp ra mắt',
  'The plans below are a preview — they are not on sale yet. Everything in the Free plan is fully available in the meantime.':
    'Các gói dưới đây chỉ là bản xem trước — chúng chưa được mở bán. Trong thời gian này, mọi tính năng của gói Miễn phí vẫn hoạt động đầy đủ.',

  'Show prices in': 'Hiển thị giá bằng',
  'Display currency': 'Đơn vị tiền tệ hiển thị',
  // The three tier names, from PLUS_PACKAGES. Short enough to collide with an
  // unrelated node elsewhere on the site; none exists today, and either reading
  // is correct Vietnamese for the word on its own.
  Starter: 'Khởi đầu',
  Pro: 'Chuyên nghiệp',
  Premium: 'Cao cấp',
  'Everything you need to apply with confidence': 'Mọi thứ bạn cần để tự tin nộp hồ sơ',
  'Our most popular plan for serious applicants':
    'Gói phổ biến nhất dành cho những ứng viên nghiêm túc',
  'The complete, hands-on plan': 'Gói đầy đủ, đồng hành sát sao',
  '6 months of Plus access': '6 tháng sử dụng Plus',
  '12 months of Plus access': '12 tháng sử dụng Plus',
  '24 months of Plus access': '24 tháng sử dụng Plus',
  'AI strategy credits': 'Tín dụng chiến lược AI',
  'Most popular': 'Phổ biến nhất',
  'Coming soon': 'Sắp ra mắt',
  'Choose this plan': 'Chọn gói này',
  'Sign up & choose': 'Đăng ký & chọn gói',
  'Starting checkout…': 'Đang mở thanh toán…',
  'No account yet? Selecting a plan signs you up first — it’s free to start.':
    'Chưa có tài khoản? Chọn một gói sẽ đưa bạn đến bước đăng ký trước — hoàn toàn miễn phí.',

  // Card highlights + comparison rows (PLUS_PACKAGES.highlights, PLUS_COMPARISON).
  'Full scholarship details & deadlines': 'Thông tin học bổng đầy đủ & hạn nộp',
  'Application roadmap + document checklist': 'Lộ trình ứng tuyển + danh sách hồ sơ',
  'Strategy history — revisit & compare': 'Lịch sử chiến lược — xem lại & so sánh',
  'Everything in Starter': 'Toàn bộ gói Khởi đầu',
  'Plus-only & premium scholarships': 'Học bổng dành riêng cho Plus & học bổng cao cấp',
  'Priority student-supporter access': 'Ưu tiên kết nối người hỗ trợ là sinh viên',
  'Everything in Pro': 'Toàn bộ gói Chuyên nghiệp',
  '1:1 onboarding & dedicated support': 'Hướng dẫn 1:1 & hỗ trợ riêng',
  'A mentor session credit included': 'Tặng kèm 1 buổi với cố vấn',
  'University search & matching': 'Tìm kiếm & gợi ý trường phù hợp',
  'Save universities & scholarships': 'Lưu trường & học bổng',
  'Full scholarship details (eligibility, documents, deadlines)':
    'Thông tin học bổng đầy đủ (điều kiện, hồ sơ, hạn nộp)',
  'Mentor session credit included': 'Tặng kèm buổi với cố vấn',
  'Plus access': 'Thời hạn dùng Plus',
  '6 months': '6 tháng',
  '12 months': '12 tháng',
  '24 months': '24 tháng',

  'Compare Free & Plus': 'So sánh Miễn phí & Plus',
  'Start free, upgrade when you’re ready. Here’s exactly what each option includes.':
    'Bắt đầu miễn phí, nâng cấp khi bạn sẵn sàng. Dưới đây là chính xác những gì mỗi lựa chọn bao gồm.',
  // Screen-reader labels on the tick / dash cells.
  Included: 'Có',
  'Not included': 'Không có',
  'Scroll the table sideways to see every plan.': 'Vuốt ngang bảng để xem toàn bộ các gói.',

  'Continue with the Free plan': 'Tiếp tục với gói Miễn phí',
  'Everything you need to start — no payment required.':
    'Mọi thứ bạn cần để bắt đầu — không cần thanh toán.',
  'View limited scholarship previews': 'Xem thông tin học bổng ở mức giới hạn',
  'Save scholarships': 'Lưu học bổng',
  'Create a basic profile': 'Tạo hồ sơ cơ bản',
  '2 AI strategy suggestions': '2 lượt gợi ý chiến lược AI',
  'Continue free': 'Tiếp tục miễn phí',
  'Not sure which plan fits you?': 'Chưa rõ gói nào phù hợp với bạn?',
  'Payments are processed securely by Stripe.': 'Thanh toán được xử lý an toàn qua Stripe.',
  'Choose your currency above — you’ll be charged in the currency you select; conversions from VND are approximate. GlowBal helps you discover opportunities and prepare stronger applications; it does not guarantee scholarship outcomes.':
    'Chọn đơn vị tiền tệ ở trên — bạn sẽ được tính phí bằng đơn vị đã chọn; tỷ giá quy đổi từ VND chỉ là tương đối. GlowBal giúp bạn tìm cơ hội và chuẩn bị hồ sơ tốt hơn; chúng tôi không cam kết kết quả học bổng.',
  'GlowBal helps you discover opportunities and prepare stronger applications; it does not guarantee scholarship outcomes.':
    'GlowBal giúp bạn tìm cơ hội và chuẩn bị hồ sơ tốt hơn; chúng tôi không cam kết kết quả học bổng.',

  // /plus/success — the return leg from Stripe.
  'Confirming your payment…': 'Đang xác nhận thanh toán của bạn…',
  'We couldn’t confirm this payment automatically yet. If you completed checkout and Plus doesn’t appear shortly, contact':
    'Chúng tôi chưa thể tự động xác nhận khoản thanh toán này. Nếu bạn đã hoàn tất thanh toán mà Plus vẫn chưa xuất hiện, hãy liên hệ',
  'You’re already on Plus': 'Bạn đã dùng Plus rồi',
  'Welcome to GlowBal Plus': 'Chào mừng bạn đến với GlowBal Plus',
  'This plan is already active on your account — you’re all set.':
    'Gói này đã được kích hoạt trên tài khoản của bạn — mọi thứ đã sẵn sàng.',
  'Explore scholarships': 'Khám phá học bổng',
  'Go to My Portal': 'Đến Hồ sơ của tôi',

  // ── AI Strategy: the two analysis reports ────────────────────────────────
  // Where the design mockups supplied Vietnamese, that wording is kept
  // verbatim rather than retranslated — "Phân tích chân dung ứng viên",
  // "Nhập học yêu cầu" and the fit page's title all come straight off the
  // frames. Everything else follows the tone already set above.

  // Stage bar
  'Strategy stages': 'Các bước chiến lược',
  Reflections: 'Tự đánh giá',
  'Personal Report': 'Báo cáo cá nhân',
  'GlowBal Matching Report': 'Báo cáo mức độ phù hợp GlowBal',
  'Personalized Strategy': 'Chiến lược cá nhân hoá',
  'Application Planner': 'Kế hoạch nộp hồ sơ',
  'Available once your analysis has run': 'Sẽ mở khi phân tích của bạn hoàn tất',

  // Applicant Portrait
  'Applicant portrait analysis': 'Phân tích chân dung ứng viên',
  'Welcome back, {name}': 'Chào mừng trở lại, {name}',
  'Portrait sections': 'Các phần của chân dung',
  // NOT "Profile strength" — that key is already taken above by the profile
  // COMPLETENESS meter ('Độ hoàn thiện hồ sơ'). This is a different quantity
  // and reusing the key would have relabelled one of them wrongly.
  'Portrait strength': 'Độ mạnh chân dung',
  'Core identity': 'Bản sắc cốt lõi',
  'Driving force': 'Động lực',
  'Signature pattern': 'Dấu ấn riêng (USP)',
  'Emerging themes': 'Chủ đề nổi lên',
  'Personal positioning': 'Định vị cá nhân',
  'Proof of me': 'Bằng chứng về tôi',
  'Who you are on paper, before any one course is considered.':
    'Bạn là ai trên hồ sơ, trước khi xét tới bất kỳ khoá học nào.',
  'What is actually pushing you towards this subject.':
    'Điều thực sự thúc đẩy bạn đến với ngành học này.',
  'The combination only you can claim — your USP.':
    'Sự kết hợp chỉ riêng bạn có — điểm khác biệt của bạn.',
  'Patterns that keep recurring across what you have done.':
    'Những mô-típ lặp lại xuyên suốt những gì bạn đã làm.',
  'How to present all of this to an admissions reader.':
    'Cách trình bày tất cả những điều này với hội đồng tuyển sinh.',
  'What you can actually evidence, strongest first.':
    'Những gì bạn thực sự chứng minh được, mạnh nhất trước.',
  'Brief summary': 'Mô tả ngắn',
  'What drives you': 'Điều thúc đẩy bạn',
  'Only you can claim this combination': 'Chỉ riêng bạn có sự kết hợp này',
  'Patterns running through your record': 'Những mô-típ xuyên suốt hồ sơ của bạn',
  'How to present yourself': 'Cách bạn nên thể hiện bản thân',
  'Academic strengths': 'Thế mạnh học thuật',
  'How you learn': 'Cách bạn học',
  "Where you're still building": 'Những điểm bạn còn đang xây dựng',
  'See how you match your course': 'Xem mức độ phù hợp với khoá học của bạn',
  'Your portrait is not ready yet': 'Chân dung của bạn chưa sẵn sàng',
  'Add your personal summary and achievements, and this page fills in with what we can evidence.':
    'Hãy bổ sung phần giới thiệu bản thân và thành tích, trang này sẽ hiển thị những gì chúng tôi chứng minh được.',
  'Start your reflections': 'Bắt đầu phần tự đánh giá',
  'Update your reflections': 'Cập nhật phần tự đánh giá',
  '{n} more sections unlock as you add detail':
    'Thêm {n} phần nữa sẽ mở khi bạn bổ sung chi tiết',

  // Evidence hierarchy (F3). "Verified" is already translated above and is not
  // repeated here. The reach labels all carry "level" — partly for
  // consistency, and partly because a bare "School" is already a key meaning
  // the institution ('Trường/Viện'), which is not what this band means.
  Checkable: 'Có thể kiểm chứng',
  'Self-reported': 'Tự khai',
  'International level': 'Cấp quốc tế',
  'National level': 'Cấp quốc gia',
  'Provincial level': 'Cấp tỉnh',
  'District level': 'Cấp huyện',
  'School level': 'Cấp trường',
  'Unstated level': 'Chưa nêu cấp độ',
  '{n} verified': '{n} đã xác minh',
  '{n} checkable': '{n} có thể kiểm chứng',
  '{n} self-reported': '{n} tự khai',
  'No detail given': 'Chưa có thông tin chi tiết',
  'Worth attaching proof for': 'Nên đính kèm bằng chứng cho',
  'A document moves each of these up a tier. Admissions readers weigh what they can check.':
    'Một tài liệu đính kèm sẽ nâng mỗi mục lên một bậc. Hội đồng tuyển sinh đánh giá cao những gì họ kiểm chứng được.',

  // Confidence (shared by both reports)
  'Well evidenced': 'Bằng chứng đầy đủ',
  'Partly evidenced': 'Bằng chứng một phần',
  'Thin evidence': 'Bằng chứng còn mỏng',

  // Vagueness gate (F6)
  'Nothing written yet': 'Bạn chưa viết gì',
  'Too short to show your reasoning': 'Quá ngắn để thấy được lập luận của bạn',
  'Opens with a stock phrase': 'Mở đầu bằng câu sáo rỗng',
  'No names, numbers or dates a reader could picture':
    'Không có tên, con số hay mốc thời gian nào để người đọc hình dung',
  'Career goals': 'Mục tiêu nghề nghiệp',
  'What motivates you': 'Điều gì thúc đẩy bạn',
  'Your goals': 'Mục tiêu của bạn',
  'Dream career': 'Nghề nghiệp mơ ước',
  'Why study abroad': 'Vì sao du học',

  // Programme Fit
  'How well you match this course, university and its scholarships':
    'Phân tích mức độ phù hợp (giữa ứng viên với ngành - trường - học bổng)',
  // "Why this university", "Admission requirements", "Costs and scholarships"
  // and "Scholarships" are already translated above for the university detail
  // page, which uses the same section names. Reusing those keys is the point of
  // an English-keyed dictionary — a second entry would be a second answer.
  'Fit report sections': 'Các phần của báo cáo phù hợp',
  'Overall fit': 'Mức độ phù hợp tổng quan',
  'Programme overview': 'Tổng quan chương trình',
  'Persona alignment': 'Mức độ tương thích cá nhân',
  'Profile gaps': 'Khoảng trống hồ sơ',
  'Why this university was recommended': 'Vì sao trường này được gợi ý',
  Costs: 'Chi phí',
  '#{n} QS world ranking': 'Hạng {n} xếp hạng QS thế giới',
  '#{n} THE ranking': 'Hạng {n} xếp hạng THE',
  'What the course asks for. We do not tick these off against your grades — marking systems differ too much between countries for that to be safe.':
    'Đây là yêu cầu của khoá học. Chúng tôi không tự đánh dấu đạt/chưa đạt dựa trên điểm của bạn — hệ thống chấm điểm giữa các nước khác nhau quá nhiều để làm điều đó một cách an toàn.',
  'The distance between where you are ({current}%) and where you could be ({goal}%).':
    'Khoảng cách giữa vị trí hiện tại của bạn ({current}%) và mức bạn có thể đạt được ({goal}%).',
  'Ready to study at {university}?': 'Sẵn sàng để học tại {university}?',
  'Turn this report into a plan for {course}, built around the gaps above.':
    'Biến báo cáo này thành kế hoạch cho {course}, dựa trên những khoảng trống ở trên.',
  'Build my strategy': 'Lên chiến lược cho tôi',
  'Check the official course page': 'Xem trang chính thức của khoá học',
  'We do not have enough on this course yet': 'Chúng tôi chưa có đủ dữ liệu về khoá học này',
  'Run your analysis, and the details we hold for this university will appear here.':
    'Hãy chạy phân tích, thông tin chúng tôi có về trường này sẽ hiển thị ở đây.',

  // Analysis loading gate
  'Loading your reports...': 'Đang tải báo cáo của bạn...',
  'Analysing profile...': 'Đang phân tích hồ sơ...',
  'Understanding achievements...': 'Đang tìm hiểu thành tích...',
  'Comparing against course...': 'Đang đối chiếu với khoá học...',
  'Building recommendations...': 'Đang xây dựng gợi ý...',
  'This usually takes 30–60 seconds.': 'Việc này thường mất 30–60 giây.',
  'Analysis failed.': 'Phân tích thất bại.',

  // ── Navigation: breadcrumbs and the application context bar ──────────────
  // Crumb labels come from the route registry (shared/lib/app-routes.ts) and
  // are translated; the dynamic ones — a course, a university, a person's name
  // — deliberately are not. See the note in shared/ui/breadcrumbs.tsx.
  // "My Portal", "Build your strategy" and "Become a mentor" are already
  // translated above and are not repeated. The crumb for a course is
  // "Your application", NOT "Application" — that key is taken above by the nav
  // label for the act of applying ('Ứng tuyển'), which is a different word in
  // Vietnamese and would have mislabelled every breadcrumb.
  Breadcrumb: 'Đường dẫn',
  'Application sections': 'Các mục của hồ sơ',
  'Finish your AI analysis to unlock this': 'Hoàn tất phân tích AI để mở mục này',
  'Your application': 'Hồ sơ ứng tuyển của bạn',
  Planner: 'Kế hoạch',
  Task: 'Công việc',
  'AI Analysis': 'Phân tích AI',
  'Your Strategy': 'Chiến lược của bạn',
  'CV builder': 'Trình tạo CV',
  'Statement writer': 'Trình viết bài luận',
  Statement: 'Bài luận',
  'Matching Report': 'Báo cáo phù hợp',
  'How GlowBal Works': 'GlowBal hoạt động thế nào',
  'Choose your subject': 'Chọn ngành học',
  University: 'Trường đại học',
  Mentor: 'Cố vấn',
  Article: 'Bài viết',
  'Application sent': 'Đã gửi đơn',
  Welcome: 'Chào mừng',
  // My Portal row quick links
  Report: 'Báo cáo',
  Board: 'Bảng',

  // ── Language switcher ────────────────────────────────────────────────────
  English: 'Tiếng Anh',
  'Tiếng Việt': 'Tiếng Việt',
};
