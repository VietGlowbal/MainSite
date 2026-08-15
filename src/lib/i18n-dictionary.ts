import { FIELD_OF_STUDY_TRANSLATIONS } from './fields-of-study';

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
  // The comprehensive academic-profile subject taxonomy lives beside its
  // canonical values. Entries declared later in this object deliberately win
  // when an established product translation already exists for the same word.
  ...FIELD_OF_STUDY_TRANSLATIONS,

  // ── Navigation ───────────────────────────────────────────────────────────
  Home: 'Trang chủ',
  Search: 'Tìm kiếm',
  'GlowBal News': 'Tin tức GlowBal',
  'Strategy Master': 'Công Cụ Lên Chiến Lược',
  Register: 'Đăng Ký',
  'User Profile': 'Thông tin Cá nhân',
  'Plan your Global Education': 'Lập Kế hoạch Du học',
  Apply: 'Nộp đơn',
  Advising: 'Cố vấn',
  'GLOWBAL News': 'Tin tức GLOWBAL',
  'Advisor hub': 'Trung tâm cố vấn',
  'Advising hub': 'Trung tâm cố vấn',
  Admin: 'Quản trị',
  Advisors: 'Cố vấn',
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
  'The page you&apos;re looking for doesn&apos;t exist. It may have been moved or never existed.': 'Trang bạn tìm không tồn tại. Có thể trang đã được chuyển hoặc chưa từng tồn tại.',
  'You may use GlowBal to search universities, discover scholarships, save opportunities, and generate application strategies. You agree to provide accurate information and to use the service lawfully and respectfully.': 'Bạn có thể dùng GlowBal để tìm trường đại học, khám phá học bổng, lưu cơ hội và tạo chiến lược ứng tuyển. Bạn đồng ý cung cấp thông tin chính xác và sử dụng dịch vụ hợp pháp, tôn trọng.',
  'GlowBal offers free features, including a limited number of AI strategy suggestions, and a paid GlowBal Plus plan with additional capabilities. Paid features and limits are described at checkout and may change over time.': 'GlowBal cung cấp các tính năng miễn phí, gồm một số gợi ý chiến lược AI giới hạn, cùng gói GlowBal Plus trả phí với nhiều khả năng hơn. Tính năng và giới hạn trả phí được mô tả khi thanh toán và có thể thay đổi theo thời gian.',
  'AI strategy suggestions are generated to assist your planning and may contain errors. Always verify eligibility, deadlines, and requirements with the official source before applying.': 'Gợi ý chiến lược AI được tạo để hỗ trợ việc lập kế hoạch và có thể có sai sót. Luôn kiểm tra điều kiện, hạn chót và yêu cầu với nguồn chính thức trước khi nộp hồ sơ.',
  // Superseded as a nav label by 'How GlowBal works' when /ai-strategy stopped
  // being the whole explainer. Kept for the same reason as Blog below: any node
  // whose text is still exactly this should translate.
  'Build your strategy': 'Lên Chiến lược Du học', // header until 03/08, Figma 375:9845
  'AI strategy': 'Chiến lược AI', // footer -> /ai-strategy, Figma 104:7413
  'GlowBal Strategy': 'Chiến lược GlowBal', // the stage's own name, /ai-strategy H1 area
  // No longer a nav label — /news is "GlowBal News" above. Kept because
  // DomTranslator matches any node whose text is exactly this.
  Blog: 'Bài viết',
  Email: 'Địa chỉ email',
  Contact: 'Liên hệ',
  // The three destinations behind the "Search" dropdown translate through keys
  // that already exist: Advisors (above) and Scholarships / Universities
  // (further down, under Topics). Do not add second copies of them here — a
  // duplicate key in this object silently wins or loses by source order.
  // Mobile hamburger sheet.
  Menu: 'Trình đơn',
  'Close menu': 'Đóng menu',
  // Legacy CTA copy retained for older screens; the current matrix uses
  // "Plan your Global Education" above.
  'Plan your studies': 'Lập kế hoạch du học',
  'Build your application strategy':'Lên chiến lược ứng tuyển',
  /*
   * Nav item -> /apply. "Plan your studies" until 31/07, "Application" until
   * 01/08. "Hồ sơ của tôi" rather than a literal "Cổng của tôi": the page is
   * the student's own applications and saved lists, and it already ships that
   * exact wording as its H1 ('My Applications', further down).
   */
  'My Portal': 'Trang lưu',
  // Superseded as a nav label by 'My Portal'. Kept for the same reason as Blog.
  Application: 'Ứng tuyển',

  // ── Home (Figma 884:12026; copy source: Home.md) ─────────────────────────
  // DomTranslator matches the *exact* trimmed text of a node, so these keys
  // must stay character-identical to the JSX in features/marketing/ui.
  'The all-in-one solution for scholarship seekers':
    'Giải pháp công nghệ toàn diện dành cho “dân săn học bổng”',
  'From discovering suitable universities and scholarships to building a personalised strategy and tracking your applications, GlowBal supports your entire journey.':
    'GlowBal giúp bạn đưa ra quyết định chọn trường và học bổng phù hợp, từ đó xây dựng chiến lược cá nhân hoá, đồng hành theo dõi hồ sơ cùng bạn trong toàn bộ hành trình chinh phục giấc mơ du học.',
  'Find a University that Fits You 100% free':
    'Công cụ Tìm trường Phù hợp Hoàn toàn Miễn phí',
  // Still rendered by the legacy landing at src/components/landing/home until
  // that tree is deleted. Remove this key with those files, not before.
  'Find my scholarships': 'Tìm học bổng của tôi',

  // University catalogue.
  'View your university matches': 'Xem các trường đại học phù hợp với bạn',
  'Deterministic demo · fixed fixture data': 'Bản demo deterministic · dữ liệu fixture cố định',
  'Your university matches': 'Các trường đại học phù hợp với bạn',
  'No university matches yet': 'Chưa có trường đại học phù hợp',
  'Add your target subject and destination preferences in your profile, then return here.':
    'Thêm môn học mục tiêu và điểm đến mong muốn trong hồ sơ, sau đó quay lại đây.',
  'Update preferences': 'Cập nhật tùy chọn',
  'Recommended universities': 'Các trường đại học được đề xuất',
  'Universities are ranked by profile fit, with Strong Chance, Target and Reach tiers.':
    'Các trường đại học được xếp hạng theo mức độ phù hợp với hồ sơ, gồm các tier Strong Chance, Target và Reach.',
  'University match tiers': 'Các tier phù hợp của trường đại học',
  'No universities in this tier yet': 'Chưa có trường đại học nào trong tier này',
  'Try another tier to see the universities that match your profile.':
    'Hãy thử tier khác để xem các trường đại học phù hợp với hồ sơ của bạn.',
  "Choose from 200+ of the world's leading universities":
    'Chọn từ 200+ đại học tốt nhất thế giới',
  'Find a university': 'Tìm Đại học',

  // Partner orbit interaction.
  // University names live in alt attributes, which DomTranslator never touches,
  // so there is nothing here to accidentally translate.
  //
  // The supporting line reads "Study <university>", where the second word flips
  // as a crest is hovered. Every changing value is an institution name and is
  // marked data-no-auto-translate at the call site. "Anywhere", the resting
  // value, is the one exception and already has a key further down.
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

  // Pain points.
  'Have you ever?': 'Bạn có từng?',
  'A study-abroad dream, but no clear path forward':
    'Muốn đi du học, nhưng loay hoay với các lựa chọn?',
  'Want to study abroad, but feel lost among the choices':
    'Muốn đi du học, nhưng loay hoay với các lựa chọn',
  'There is too much information, but no clear direction.':
    'Thông tin quá nhiều nhưng thiếu một lộ trình rõ ràng.',
  'Found a university you love, but not a strong enough scholarship':
    'Tìm được trường mình thích, nhưng không có học bổng đủ tốt',
  'The best scholarships are often hidden in closed groups and networks — and winning one can feel impossible without the right support.':
    'Học bổng càng cao lại càng được “cất giấu” trong những hội nhóm, network kín, và để chinh phục học bổng đó còn khó hơn lên trời nếu không có người hỗ trợ!',
  'Lack clear guidance and strategy': 'Thiếu chỉ dẫn và chiến lược rõ ràng',
  'You do not know how to tell your story and present both strengths and weaknesses in an application that wins over the admissions committee.':
    'Không biết cách khai thác câu chuyện bản thân và thể hiện cả điểm mạnh và điểm yếu qua bộ hồ sơ để chinh phục hội đồng tuyển sinh',
  'Have no one truly supporting you': 'Thiếu người đồng hành thực sự',
  'The experts around you are busy, while you need support with even the smallest details.':
    'Những chuyên gia xung quanh đều bận, nhưng mình cần sự hỗ trợ từ những chi tiết nhỏ nhất',

  // Five-step journey.
  'GlowBal is here to help you achieve your dream. From your first choice to a complete application strategy.':
    'GlowBal ở đây để đồng hành và cung cấp cho một giải pháp toàn diện, cá nhân hoá giúp bạn chinh phục giấc mơ của chính mình',
  'GlowBal combines technology, data and team expertise to support you from discovering opportunities to completing your application strategy.':
    'Kết hợp công nghệ, dữ liệu từ 3000+ học bổng và 200+ trường top đầu thế giới, cùng với kinh nghiệm của đội ngũ chuyên gia săn học bổng để hỗ trợ bạn từ bước khám phá lựa chọn đến khi hoàn thiện chiến lược ứng tuyển.',
  'Input simple information': 'Nhập thông tin đơn giản',
  'Pick a university, programme and scholarship':
    'Chọn trường - chương trình học - học bổng',
  'Receive specialised reports': 'Nhận Báo cáo Phân tích Chuyên nghiệp',
  'Receive a personalised strategy': 'Nhận Chiến lược Cá nhân hoá',
  'Build your application, track progress and receive feedback':
    'Cùng GlowBal xây dựng hồ sơ, theo dõi và nhận feedback',
  'Tell GlowBal about your goals, strengths and study preferences.':
    'Hãy cho GlowBal biết mục tiêu, thế mạnh và mong muốn du học của bạn.',
  'A profile that reflects you': 'Một hồ sơ phản ánh đúng con người bạn',
  'Compare relevant universities, programmes and funding opportunities in one workspace.':
    'So sánh các trường, chương trình học và cơ hội tài trợ phù hợp trong cùng một không gian.',
  'A focused shortlist': 'Một danh sách lựa chọn tập trung',
  'See your applicant profile and how well each option fits your direction.':
    'Hiểu chân dung ứng viên và mức độ phù hợp của từng lựa chọn với định hướng của bạn.',
  'Evidence-backed clarity': 'Sự rõ ràng dựa trên dữ liệu',
  'Turn your strengths, gaps and deadlines into an actionable plan.':
    'Biến thế mạnh, điểm cần cải thiện và các mốc thời gian thành kế hoạch có thể thực hiện.',
  'Your next best actions': 'Những hành động phù hợp nhất tiếp theo',
  'Keep documents, progress and expert feedback connected as you move towards submission.':
    'Kết nối tài liệu, tiến độ và phản hồi chuyên gia trong suốt quá trình hoàn thiện hồ sơ.',
  'An application that keeps moving': 'Một bộ hồ sơ luôn tiến về phía trước',
  'Journey outcome': 'Kết quả của bước này',
  'Select a step or let the journey play.': 'Chọn một bước hoặc để hành trình tự chuyển.',
  'Previous step': 'Bước trước',
  'Next step': 'Bước tiếp theo',

  // Two product demos.
  Features: 'Tính năng',
  'Learn how GlowBal helps you find scholarships from A to Z with just two simple features':
    'Tìm hiểu cách GlowBal giúp bạn săn học bổng từ A-Z, chỉ với 2 tính năng đơn giản',
  'GlowBal Matcher': 'Công Cụ Định Hướng Du Học',
  'Find what fits you, not simply what is famous.':
    'Công cụ hỗ trợ lựa chọn chương trình học, đại học và học bổng phù hợp nhất - để bạn không còn mò đường một mình.',
  'Answer a few questions about your goals, strengths and direction. GlowBal Matcher helps you discover universities and scholarships worth exploring further.':
    'Trả lời một số câu hỏi về mục tiêu, thế mạnh và định hướng của bạn. GlowBal Matcher giúp bạn khám phá các trường và học bổng đáng để nghiên cứu sâu hơn.',
  'Personalised recommendations': 'Đề xuất dựa trên hồ sơ cá nhân',
  'University and scholarship discovery': 'Khám phá trường và học bổng',
  'Save promising opportunities': 'Lưu lại các lựa chọn tiềm năng',
  'Discover your matches': 'Bắt đầu Miễn phí Ngay',
  'Finding the right option is only the beginning.':
    'Tìm được lựa chọn phù hợp mới chỉ là bước khởi đầu.',
  'Strategy Master helps you understand your profile, evaluate your fit and turn your study-abroad goals into an actionable strategy.':
    'Strategy Master giúp bạn hiểu hồ sơ của mình, đánh giá mức độ phù hợp và chuyển mục tiêu du học thành một chiến lược có thể thực hiện.',
  'Applicant Personal Report': 'Phân tích Chân dung Ứng viên',
  'Personalised Strategy': 'Chiến lược Cá nhân hoá',
  'Live preview': 'Bản xem trước',
  '92% fit': 'Phù hợp 92%',
  'Play demo': 'Xem demo',
  'The demo video could not be loaded.': 'Không thể tải video demo.',
  'Your browser does not support video playback.': 'Trình duyệt của bạn không hỗ trợ phát video.',

  // Testimonials, team and consultation.
  Testimonials: 'Lời chia sẻ',
  'Anonymous student': 'Học sinh ẩn danh',
  'Illustrative portrait': 'Chân dung minh họa',
  'What do students say about GlowBal?': 'Học sinh nói gì về GlowBal?',
  'Student feedback': 'Chia sẻ của học sinh',
  'GlowBal helped me narrow hundreds of options down to the universities genuinely worth considering.':
    'GlowBal giúp mình thu hẹp hàng trăm lựa chọn xuống những trường thực sự đáng cân nhắc.',
  'For the first time, I understood why a university suited my profile.':
    'Lần đầu tiên mình hiểu rõ vì sao một trường phù hợp với hồ sơ của mình.',
  'I no longer have to manage everything across different files and notes.':
    'Mình không còn phải quản lý mọi thứ bằng nhiều file và ghi chú khác nhau.',
  'The team behind your journey.': 'Đội ngũ đằng sau hành trình của bạn.',
  'GlowBal is built by a team across technology, education, research and communication, including people who have experienced scholarship and study-abroad journeys themselves. We combine student insight, specialist knowledge and technology to turn fragmented advice into a clearer system.':
    'GlowBal được xây dựng bởi đội ngũ trong các lĩnh vực công nghệ, giáo dục, nghiên cứu và truyền thông, cùng những người đã trực tiếp trải qua hành trình học bổng và du học. Chúng mình kết hợp góc nhìn của người dùng, kiến thức chuyên môn và công nghệ để biến những lời khuyên rời rạc thành một hệ thống rõ ràng hơn.',
  // Home roster cards — programme and scholarship lines, from the owner's
  // member sheet. University names are never translated (see the crest alt
  // text in features/marketing/ui/university-crests.ts), but a course of study
  // is ordinary copy and is.
  'Business Administration · Marketing': 'Quản trị kinh doanh · Marketing',
  'Business Administration · Business Analytics':
    'Quản trị kinh doanh · Phân tích kinh doanh',
  // 'Business Administration' and 'Information Technology' are already in this
  // catalogue further down (the programme-name block) — not repeated here.
  'Computer Engineering': 'Kỹ thuật máy tính',
  'International Political Economics': 'Kinh tế chính trị quốc tế',
  "80% merit scholarship · 4× Dean's List": "Học bổng tài năng 80% · 4 lần Dean's List",
  '90% merit scholarship · full ride at Lingnan':
    'Học bổng tài năng 90% · học bổng toàn phần tại Lingnan',
  '2× FTU academic encouragement scholarship':
    '2 lần học bổng khuyến khích học tập FTU',
  'Founder & CEO': 'Nhà sáng lập & CEO',
  'CO - Founder': 'Đồng sáng lập',
  'Jack of all trades': 'Đa năng',
  'UX Research': 'Nghiên cứu UX',
  'Backend Developer': 'Lập trình viên Backend',
  'Product Designer': 'Nhà thiết kế sản phẩm',
  'UX Researcher': 'Nhà nghiên cứu UX',
  'Product Manager': 'Quản lý sản phẩm',
  'Life swept away my innocence and threw me into towering ambitions.':
    'Cuộc sống cuốn đi sự hồn nhiên và ném vào tôi những tham vọng rất cao',
  'I grew through hardship. I rose from the ashes.':
    'Tôi đã trưởng thành từ trong đau khổ. Tôi đã đứng lên từ đống tro tàn.',
  'Faith is an expensive luxury, and money is truly spellbinding.':
    'Vì niềm tin là thứ thật xa xỉ. Và đồng tiền là thứ thật ma mị.',
  "Children who understand too much rarely get sweets; they drink matcha lattes and eat spicy noodles because they are used to life's bitterness.":
    'Những đứa trẻ hiểu chuyện thường ko có kẹo, chúng uống matcha latte và ăn mỳ cay vì đã quen với đắng cay của cuộc đời.',
  'At the feast between angels and demons, I am the only one invited.':
    'Trên bàn tiệc giữa tiên và quỷ tao là thằng duy nhất được mời',
  'Heaven has not treated me badly. If no one hires me as a developer, I will become a ride-hailing driver.':
    '“Con thấy ông trời đã đối xử với con không tệ. Nếu không ai thuê con Dev, con sẽ chạy xe ôm công nghệ.”',
  'Anyone here ever made a mistake? Raise your hand to receive a second chance.':
    '“Ai ở đây đã từng sai nào, dơ tay để nhận cơ hội thứ 2 nào.”',
  'Meet the GlowBal team': 'Gặp gỡ đội ngũ GlowBal',
  'Not sure where to begin?': 'Bạn chưa biết nên bắt đầu từ đâu?',
  'Tell us about your goals. The GlowBal team will contact you to help identify a suitable next step.':
    'Để lại thông tin về mục tiêu của bạn. Đội ngũ GlowBal sẽ liên hệ để giúp bạn xác định bước tiếp theo phù hợp.',
  'What and where would you like to study?': 'Bạn đang muốn học gì và ở đâu?',
  'Request guidance': 'Nhận tư vấn',

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
  'Go Glow. Go GLOWBAL.': 'Tỏa sáng. Cùng GLOWBAL.',
  'The vibe': 'Không khí',
  'Universities tracked': 'Trường đại học được theo dõi',
  'Countries covered': 'Quốc gia được bao phủ',
  'Achievers ready to advise': 'Người dẫn dắt sẵn sàng cố vấn',
  'Of beta users felt less stressed': 'Người dùng thử cảm thấy bớt căng thẳng',
  'Answer a few simple questions': 'Trả lời vài câu hỏi đơn giản',
  'Tell us your strengths, preferences, and career direction. Our matcher does the heavy lifting.':
    'Cho chúng tôi biết thế mạnh, sở thích và định hướng nghề nghiệp của bạn. Công cụ ghép cặp sẽ lo phần còn lại.',
  'Choose your dream paths': 'Chọn con đường mơ ước',
  'Get a curated shortlist of universities, scholarships, and programs that actually fit you.':
    'Nhận danh sách rút gọn gồm các trường, học bổng và chương trình thực sự phù hợp với bạn.',
  'Apply with confidence': 'Nộp đơn tự tin',
  'Connect with advisors who got in, sharpen your statements with our AI writer, and ship it.':
    'Kết nối với cố vấn đã trúng tuyển, trau chuốt bài luận với trình viết AI, và nộp đơn.',
  'How we help you': 'Chúng tôi giúp bạn thế nào',
  'Three steps from overwhelmed to admitted.': 'Ba bước từ choáng ngợp đến trúng tuyển.',
  "No agents. No hidden costs. Just the clearest path from where you are to where you're going.":
    'Không qua trung gian. Không chi phí ẩn. Chỉ là con đường rõ ràng nhất từ nơi bạn đang đứng đến nơi bạn muốn tới.',
  Demo: 'Bản demo',
  'See GLOWBAL in motion.': 'Xem GLOWBAL hoạt động.',
  'A 90-second walkthrough of the matcher, the Achievers, and the AI statement writer.':
    'Hướng dẫn 90 giây về công cụ ghép cặp, các Achiever và trình viết bài luận AI.',
  'Play demo video': 'Phát video demo',
  'Match → advisor → apply': 'Ghép cặp → cố vấn → nộp đơn',
  'Our mission': 'Sứ mệnh của chúng tôi',
  'Help every ambitious student approach global education with ease and without fear — no matter where they\'re starting from.':
    'Giúp mọi sinh viên đầy hoài bão tiếp cận giáo dục toàn cầu một cách dễ dàng và không sợ hãi — dù bạn bắt đầu từ đâu.',
  Experts: 'Chuyên gia',
  "Advisors who've been on both sides of admissions.": 'Cố vấn đã trải qua cả hai phía của quá trình tuyển sinh.',
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
  'List View': 'Danh sách',
  'Status View': 'Mức độ Hoàn thành',
  'Calendar View': 'Lịch',
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
  'Find an advisor here': 'Tìm cố vấn tại đây',
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
  'Advisor Hub': 'Trung tâm Cố vấn',
  "Meet an advisor who's walked the path": 'Gặp người cố vấn đã đi qua con đường này',
  'Browse current students and recent grads at your dream universities. Pick a time, share what you want help with, and book a real video session.':
    'Duyệt qua sinh viên hiện tại và cựu sinh viên ở các trường mơ ước của bạn. Chọn thời gian, chia sẻ điều bạn cần giúp, và đặt một buổi gọi video thực sự.',
  'Become an advisor': 'Trở thành cố vấn',
  'Search by advisor, university, or topic': 'Tìm theo cố vấn, trường hoặc chủ đề',
  'Any location': 'Bất kỳ địa điểm',
  'Any university': 'Bất kỳ trường',
  'All universities': 'Tất cả các trường',
  'Currently studying': 'Đang theo học',
  Alumni: 'Cựu sinh viên',
  Languages: 'Ngôn ngữ',
  'Top rated': 'Được đánh giá cao',
  'Newest advisors': 'Cố vấn mới nhất',
  'Price: low → high': 'Giá: thấp → cao',
  'Price: high → low': 'Giá: cao → thấp',
  'Hide filters': 'Ẩn bộ lọc',
  'More filters': 'Thêm bộ lọc',
  Status: 'Trạng thái',
  Rating: 'Đánh giá',
  'Find your university': 'Tìm trường của bạn',
  'Pick a country or specific school above': 'Chọn quốc gia hoặc trường cụ thể ở trên',
  'Choose a time': 'Chọn thời gian',
  'Advisors share a calendar with open slots': 'Cố vấn chia sẻ lịch với các khung giờ còn trống',
  'Choose an advisor': 'Chọn cố vấn',
  'Popular help with:': 'Hỗ trợ phổ biến:',
  'Personal statement': 'Bài luận cá nhân',
  'Interview prep': 'Luyện phỏng vấn',
  'Visa & accommodation': 'Visa & chỗ ở',
  'Scholarship strategy': 'Chiến lược học bổng',
  'Course choice': 'Lựa chọn khóa học',
  'Life abroad': 'Cuộc sống ở nước ngoài',
  'New advisor': 'Cố vấn mới',
  'Pricing pending': 'Đang cập nhật giá',
  'Book a session': 'Đặt buổi tư vấn',
  'No advisors match your search': 'Không có cố vấn nào khớp với tìm kiếm của bạn',
  'Try widening the country or removing the date filter — or invite an advisor at your school.':
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
  'Get expert guidance from current students and admissions advisors.':
    'Nhận hướng dẫn từ sinh viên hiện tại và cố vấn tuyển sinh.',
  'Find an advisor': 'Tìm cố vấn',
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
  "You're on a free trial. Unlock all tools and advisor support.":
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
  // Approved profile-navigation label. Advisor verification uses the more
  // specific "Verification documents" key below instead of overriding this.
  Documents: 'Lưu tài liệu',
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
  'Approve advisors, confirm bookings, and manage the user base.':
    'Phê duyệt cố vấn, xác nhận lượt đặt và quản lý người dùng.',
  'Advisor applications': 'Đơn ứng tuyển cố vấn',
  'Bookings & payments': 'Lượt đặt & thanh toán',
  Users: 'Người dùng',
  User: 'Người dùng',
  'Advisor applications waiting': 'Đơn ứng tuyển cố vấn đang chờ',
  'Approved advisors': 'Cố vấn đã duyệt',
  'Bookings awaiting payment': 'Lượt đặt đang chờ thanh toán',
  'Confirmed sessions': 'Buổi đã xác nhận',
  'Completed sessions': 'Buổi đã hoàn thành',
  'Quick actions': 'Thao tác nhanh',
  'Review advisor applications': 'Duyệt đơn ứng tuyển cố vấn',
  'Confirm payments': 'Xác nhận thanh toán',
  'Manage users': 'Quản lý người dùng',
  'Total users': 'Tổng người dùng',
  Admins: 'Quản trị viên',
  'Advisor profiles': 'Hồ sơ cố vấn',
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
  'GLOWBAL · onboarding': 'GLOWBAL · bắt đầu',
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
  'Scholarship spotlight': 'Học bổng nổi bật',
  'A world of funding, brought into focus.':
    'Thế giới học bổng, được chọn lọc rõ ràng.',
  'Start with a few standout opportunities, then explore the library to find the scholarships that fit your goals, destination and story.':
    'Bắt đầu với những cơ hội nổi bật, sau đó khám phá kho học bổng phù hợp với mục tiêu, điểm đến và câu chuyện của bạn.',
  'published scholarships in one growing library':
    'học bổng đã xuất bản trong một thư viện không ngừng mở rộng',
  'published scholarships to explore': 'học bổng đã xuất bản để khám phá',
  'published scholarships': 'học bổng đã xuất bản',
  'ready to explore': 'sẵn sàng để khám phá',
  'Explore all scholarships': 'Khám phá tất cả học bổng',
  'Featured scholarships': 'Học bổng nổi bật',
  'Award value': 'Giá trị giải thưởng',
  'What it covers': 'Quyền lợi học bổng',
  'Scholarship logo': 'Logo học bổng',
  'University crest': 'Logo trường đại học',
  'Scholarship mark': 'Biểu trưng học bổng',
  'Funding support': 'Hỗ trợ tài chính',
  'Full tuition': 'Toàn bộ học phí',
  'Global opportunity': 'Cơ hội toàn cầu',
  'Application window': 'Thời gian ứng tuyển',
  'Check current dates': 'Kiểm tra thời hạn hiện tại',
  'Previous scholarship': 'Học bổng trước',
  'Next scholarship': 'Học bổng tiếp theo',
  'Pause automatic rotation': 'Tạm dừng chuyển động tự động',
  'Resume automatic rotation': 'Tiếp tục chuyển động tự động',

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
  'Find scholarships': 'Tìm Học bổng',
  // 'AI strategy' is already defined in the Navigation block above.
  'Student advisors': 'Cố vấn sinh viên',
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
  'All advisors': 'Tất cả cố vấn',
  About: 'Giới thiệu',
  Strengths: 'Điểm mạnh',
  'Best for': 'Tốt nhất cho',
  // `Reviews`, `Book a session` and `Back` are deliberately absent — all three
  // are already defined above (lines 331, 394, 128) and a duplicate key is a
  // type error. The existing Vietnamese covers this page unchanged.
  'Book this advisor': 'Đặt lịch với cố vấn này',
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
  'This advisor hasn’t published availability for the next 90 days.':
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
  'The more context you give, the more your advisor can prepare.':
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

  // Advisor directory card hierarchy and dynamic labels. These use t() with
  // interpolation, so counts, names, years and formatted prices never fall
  // through to the network translator.
  'University not listed': 'Chưa cập nhật trường đại học',
  'Subject not listed': 'Chưa cập nhật ngành học',
  '{price}/hour': '{price}/giờ',
  'Class of {year}': 'Khóa {year}',
  "Open the profile to see this advisor's experience and support topics.":
    'Mở hồ sơ để xem kinh nghiệm và các nội dung cố vấn có thể hỗ trợ.',
  'Session rate': 'Phí mỗi buổi',
  "View {name}'s profile": 'Xem hồ sơ của {name}',
  '{count} advisor': '{count} cố vấn',
  '{count} advisors': '{count} cố vấn',
  '{count} session': '{count} buổi',
  '{count} sessions': '{count} buổi',
  'Compare university, academic background, experience and rate.':
    'So sánh trường đại học, nền tảng học thuật, kinh nghiệm và mức phí.',
  'No advisors have been approved yet. Check back soon.':
    'Chưa có cố vấn nào được phê duyệt. Vui lòng quay lại sau.',
  'No advisor matches those filters yet. Try widening the country or subject.':
    'Chưa có cố vấn phù hợp với bộ lọc. Hãy thử mở rộng quốc gia hoặc ngành học.',
  "Master's": 'Thạc sĩ',

  // Advisor profile stats, reviews and booking strings with live values.
  '{rating} / 5': '{rating} / 5',
  '{count} session delivered': 'Đã hoàn thành {count} buổi tư vấn',
  '{count} sessions delivered': 'Đã hoàn thành {count} buổi tư vấn',
  '{count} review': '{count} đánh giá',
  '{count} reviews': '{count} đánh giá',
  'Glowbal student': 'Học viên GlowBal',
  '{student} · {date}': '{student} · {date}',
  Mo: 'T2',
  Tu: 'T3',
  We: 'T4',
  Th: 'T5',
  Fr: 'T6',
  Sa: 'T7',
  Su: 'CN',
  '{date} — no times available': '{date} — không có khung giờ trống',
  'Choose or type a topic so your advisor can prepare.':
    'Hãy chọn hoặc nhập một chủ đề để cố vấn có thể chuẩn bị.',
  'Tell your advisor what you want to discuss — a sentence is enough.':
    'Hãy cho cố vấn biết bạn muốn trao đổi điều gì — chỉ cần một câu là đủ.',
  'Could not start checkout.': 'Không thể bắt đầu thanh toán.',
  'The payment link was missing. Please try again.':
    'Không tìm thấy liên kết thanh toán. Vui lòng thử lại.',
  'Book a session with {name}': 'Đặt buổi tư vấn với {name}',
  'Book {name}': 'Đặt lịch với {name}',
  '{count} min': '{count} phút',
  'Session ({count} min)': 'Buổi tư vấn ({count} phút)',
  'Pay {amount}': 'Thanh toán {amount}',

  // Errors returned by /api/mentorship/checkout. Translating the API message
  // through t() keeps failed booking states bilingual as well as happy paths.
  'Invalid JSON body': 'Dữ liệu gửi lên không hợp lệ',
  'Invalid request': 'Yêu cầu không hợp lệ',
  'Sign in required': 'Vui lòng đăng nhập',
  'Slot not found': 'Không tìm thấy khung giờ',
  'This slot is no longer available': 'Khung giờ này không còn khả dụng',
  'Sessions must be booked at least an hour in advance':
    'Buổi tư vấn phải được đặt trước ít nhất một giờ',
  'Advisor not found': 'Không tìm thấy cố vấn',
  'Advisor is not currently accepting bookings': 'Cố vấn hiện không nhận lịch đặt',
  'Advisor pricing is not configured. Please try another advisor.':
    'Mức phí của cố vấn chưa được thiết lập. Vui lòng chọn cố vấn khác.',
  'Advisor pricing is not configured.': 'Mức phí của cố vấn chưa được thiết lập.',
  'The booking total is below the payment minimum.':
    'Tổng giá trị đặt lịch thấp hơn mức thanh toán tối thiểu.',
  'Slot is no longer available': 'Khung giờ này không còn khả dụng',
  'Could not create booking': 'Không thể tạo lịch hẹn',
  'Could not start the payment. Please try again.':
    'Không thể bắt đầu thanh toán. Vui lòng thử lại.',

  // Advisor recruitment, application, verification and approval journey.
  'Create your profile': 'Tạo hồ sơ của bạn',
  'Tell us where you studied, what you experienced and how you can help.':
    'Cho chúng tôi biết bạn đã học ở đâu, có trải nghiệm gì và có thể hỗ trợ điều gì.',
  'Verify your experience': 'Xác minh kinh nghiệm của bạn',
  'Your documents stay private and are reviewed only by GlowBal admins.':
    'Tài liệu của bạn được bảo mật và chỉ quản trị viên GlowBal xem xét.',
  'Start advising': 'Bắt đầu tư vấn',
  'Once approved, choose your rate and availability and accept bookings.':
    'Sau khi được duyệt, hãy chọn mức phí, lịch rảnh và bắt đầu nhận lịch đặt.',
  'For students and alumni': 'Dành cho sinh viên và cựu sinh viên',
  'Want to share your experience with future students?':
    'Bạn muốn chia sẻ kinh nghiệm với thế hệ sinh viên tương lai?',
  'Become a GlowBal advisor, set your own rate and availability, and help applicants make confident decisions.':
    'Trở thành cố vấn GlowBal, tự đặt mức phí và lịch rảnh, đồng thời giúp ứng viên đưa ra quyết định tự tin hơn.',
  'Apply to become an advisor': 'Đăng ký trở thành cố vấn',
  'Free to apply · Reviewed within 48 hours': 'Đăng ký miễn phí · Xét duyệt trong vòng 48 giờ',
  'How advisor applications work': 'Quy trình đăng ký cố vấn',
  'Back to all advisors': 'Quay lại danh sách cố vấn',
  'Advisor application': 'Đơn đăng ký cố vấn',
  'Share your experience, set your hourly rate, and earn money helping applicants make stronger university decisions.':
    'Chia sẻ kinh nghiệm, tự đặt mức phí theo giờ và có thêm thu nhập khi giúp ứng viên đưa ra quyết định đại học tốt hơn.',
  'You have a fast-track invitation, so the document-evidence step is optional.':
    'Bạn có lời mời đăng ký nhanh nên bước nộp tài liệu minh chứng là không bắt buộc.',
  'Every advisor is verified manually before their profile goes live.':
    'Mọi cố vấn đều được xác minh thủ công trước khi hồ sơ được công khai.',
  'Step {number}': 'Bước {number}',
  'Complete your profile': 'Hoàn thiện hồ sơ của bạn',
  'University, experience and support topics': 'Trường đại học, kinh nghiệm và chủ đề hỗ trợ',
  'Submit for review': 'Gửi để xét duyệt',
  'Your evidence stays private': 'Tài liệu minh chứng luôn được bảo mật',
  'Go live after approval': 'Hồ sơ được công khai sau khi duyệt',
  'Set times and accept bookings': 'Đặt lịch rảnh và nhận lịch tư vấn',
  'Complete your application': 'Hoàn thiện đơn đăng ký',
  'Required fields are marked with an asterisk. You can review everything before submitting.':
    'Các trường bắt buộc được đánh dấu bằng dấu sao. Bạn có thể xem lại mọi thông tin trước khi nộp.',
  'Application submitted': 'Đã gửi đơn đăng ký',
  'Thanks for applying. Your request is now in the admin review queue, and we’ll email you with the outcome within 48 hours.':
    'Cảm ơn bạn đã đăng ký. Yêu cầu của bạn đang trong hàng đợi xét duyệt của quản trị viên và chúng tôi sẽ gửi kết quả qua email trong vòng 48 giờ.',
  'Application status': 'Trạng thái đơn đăng ký',
  'Admin verification': 'Quản trị viên xác minh',
  'In review': 'Đang xét duyệt',
  'Profile published': 'Hồ sơ được công khai',
  'After approval': 'Sau khi được duyệt',
  'You can add availability from your advisor dashboard while you wait. Students will only see your profile after an admin approves it.':
    'Trong khi chờ, bạn có thể thêm lịch rảnh từ bảng điều khiển cố vấn. Sinh viên chỉ thấy hồ sơ sau khi quản trị viên phê duyệt.',
  'Files must be 10 MB or smaller.': 'Tệp phải có dung lượng không quá 10 MB.',
  'Upload failed: {message}': 'Tải lên thất bại: {message}',
  'Profile photo must be 5 MB or smaller.': 'Ảnh hồ sơ phải có dung lượng không quá 5 MB.',
  'Avatar upload failed: {message}': 'Tải ảnh đại diện thất bại: {message}',
  'Please complete all required steps.': 'Vui lòng hoàn thành tất cả các bước bắt buộc.',
  Identity: 'Danh tính',
  Pricing: 'Mức phí',
  Availability: 'Lịch rảnh',
  'These four fields are required for verification. Only your display name and university show up publicly.':
    'Bốn trường này là bắt buộc để xác minh. Chỉ tên hiển thị và trường đại học của bạn được công khai.',
  'Display name (shown publicly)': 'Tên hiển thị (được công khai)',
  'Full legal name (private)': 'Họ tên pháp lý đầy đủ (bảo mật)',
  'Date of birth (private)': 'Ngày sinh (bảo mật)',
  'We review every advisor manually. These four documents are stored privately and only seen by GlowBal admins.':
    'Chúng tôi xét duyệt thủ công từng cố vấn. Bốn tài liệu này được lưu trữ riêng tư và chỉ quản trị viên GlowBal có thể xem.',
  'This is what mentees see. Be specific about what you can help with — vague profiles get fewer bookings.':
    'Đây là nội dung người được tư vấn sẽ thấy. Hãy nêu cụ thể điều bạn có thể hỗ trợ vì hồ sơ chung chung thường nhận ít lịch đặt hơn.',
  'Profile photo (optional but recommended)': 'Ảnh hồ sơ (không bắt buộc nhưng nên có)',
  'Profile photo preview': 'Xem trước ảnh hồ sơ',
  'Degree level': 'Bậc học',
  'Subject / programme': 'Ngành học / chương trình',
  'Study start year': 'Năm bắt đầu học',
  Bio: 'Giới thiệu bản thân',
  'Topics you can help with': 'Chủ đề bạn có thể hỗ trợ',
  '{count} selected · pick at least one': 'Đã chọn {count} · chọn ít nhất một mục',
  'Special skills / strengths': 'Kỹ năng đặc biệt / điểm mạnh',
  'What makes you stand out?': 'Điều gì khiến bạn nổi bật?',
  'Languages you can advise in': 'Ngôn ngữ bạn có thể dùng để tư vấn',
  Currency: 'Đơn vị tiền tệ',
  'You keep 90% of your hourly rate. GlowBal adds a 10% service fee on top, charged to the mentee.':
    'Bạn nhận 90% mức phí theo giờ. GlowBal cộng thêm 10% phí dịch vụ do người được tư vấn thanh toán.',
  'Click any future date to add 1-hour slots. You can change these any time from your dashboard.':
    'Chọn một ngày trong tương lai để thêm khung giờ 1 tiếng. Bạn có thể thay đổi bất cứ lúc nào từ bảng điều khiển.',
  'Review & submit': 'Xem lại & nộp đơn',
  'Double-check everything below. Your application goes to GlowBal admins for verification.':
    'Hãy kiểm tra lại mọi thông tin bên dưới. Đơn của bạn sẽ được gửi đến quản trị viên GlowBal để xác minh.',
  '(new — pending review)': '(mới — đang chờ xét duyệt)',
  'By submitting, you confirm the details above are accurate and that you’ll respect mentee privacy.':
    'Khi nộp đơn, bạn xác nhận thông tin trên là chính xác và cam kết tôn trọng quyền riêng tư của người được tư vấn.',
  'By submitting, you confirm that all documents are genuine and that you’ll respect mentee privacy.':
    'Khi nộp đơn, bạn xác nhận mọi tài liệu đều xác thực và cam kết tôn trọng quyền riêng tư của người được tư vấn.',
  'GlowBal will email you within 48 hours with the outcome.':
    'GlowBal sẽ gửi kết quả cho bạn qua email trong vòng 48 giờ.',
  'Remove {document}': 'Xóa {document}',
  'Display name': 'Tên hiển thị',
  'Legal name': 'Họ tên pháp lý',
  'Date of birth': 'Ngày sinh',
  'Fast-track — not required': 'Đăng ký nhanh — không bắt buộc',
  '{count} / 4 uploaded': 'Đã tải lên {count} / 4',
  Topics: 'Chủ đề',
  'Initial slots': 'Khung giờ ban đầu',
  '{count} added': 'Đã thêm {count}',
  'Add times to {count} selected day': 'Thêm giờ cho {count} ngày đã chọn',
  'Add times to {count} selected days': 'Thêm giờ cho {count} ngày đã chọn',
  '{count} slot': '{count} khung giờ',
  '{count} slots': '{count} khung giờ',
  '{count} day': '{count} ngày',
  '{count} days': '{count} ngày',
  'Advisor application progress': 'Tiến độ đăng ký cố vấn',
  Optional: 'Không bắt buộc',
  '{count}/800 characters': '{count}/800 ký tự',
  'PNG, JPG or WebP up to 5 MB': 'PNG, JPG hoặc WebP, tối đa 5 MB',
  'Upload document': 'Tải tài liệu lên',
  'Replace document': 'Thay tài liệu',
  'PDF, DOC, DOCX, PNG or JPG up to 10 MB': 'PDF, DOC, DOCX, PNG hoặc JPG, tối đa 10 MB',
  'Enter the amount you want to receive for each one-hour session.':
    'Nhập số tiền bạn muốn nhận cho mỗi buổi tư vấn một giờ.',
  'Enter your rate': 'Nhập mức phí của bạn',
  'Per one-hour session': 'Cho mỗi buổi tư vấn một giờ',
  'Student pays': 'Học sinh thanh toán',
  'Includes the 10% service fee': 'Đã bao gồm 10% phí dịch vụ',
  'Custom time': 'Giờ tùy chỉnh',
  'Invalid signup': 'Đơn đăng ký không hợp lệ',
  'Date of birth looks invalid': 'Ngày sinh có vẻ không hợp lệ',
  'All four verification documents are required.': 'Cần tải lên đủ bốn tài liệu xác minh.',
  'You already have an advisor profile': 'Bạn đã có hồ sơ cố vấn',
  'Hourly rate is below the minimum for this currency': 'Mức phí theo giờ thấp hơn mức tối thiểu của đơn vị tiền tệ này',
  'Could not save your university. Please try again.': 'Không thể lưu trường đại học của bạn. Vui lòng thử lại.',
  'Advisor signups are temporarily unavailable due to a database update. Please try again shortly.':
    'Đăng ký cố vấn tạm thời không khả dụng do hệ thống đang cập nhật. Vui lòng thử lại sau ít phút.',
  'Could not submit your application. Please try again.': 'Không thể nộp đơn. Vui lòng thử lại.',
  'Could not submit your application.': 'Không thể nộp đơn.',

  // Seeded advisor academic details and profile content. User-authored content
  // still falls back to the original language when no exact dictionary entry
  // exists; university names and advisor names are intentionally untouched.
  'Computer Science, BA': 'Khoa học máy tính, Cử nhân',
  'MSc Computer Science': 'Thạc sĩ Khoa học máy tính',
  'Economics, AB': 'Kinh tế học, Cử nhân',
  'PhD Aeronautical Engineering': 'Tiến sĩ Kỹ thuật Hàng không',
  'MS Symbolic Systems': 'Thạc sĩ Hệ thống Biểu tượng',
  'Business Administration': 'Quản trị Kinh doanh',
  'BA Architecture': 'Cử nhân Kiến trúc',
  'PhD Electrical Engineering': 'Tiến sĩ Kỹ thuật Điện',
  'Cambridge CS undergrad. I help applicants demystify the SAQ, technical interviews, and the personal statement. Happy to chat in English or Vietnamese.':
    'Sinh viên Cử nhân Khoa học máy tính tại Cambridge. Tôi giúp ứng viên hiểu rõ SAQ, phỏng vấn kỹ thuật và bài luận cá nhân. Sẵn sàng trao đổi bằng tiếng Anh hoặc tiếng Việt.',
  "Oxford MSc CS, now working in fintech. I review SOPs line-by-line and run mock technical interviews. I'll also tell you honestly when a school isn't worth it.":
    'Tốt nghiệp Thạc sĩ Khoa học máy tính tại Oxford, hiện làm việc trong lĩnh vực công nghệ tài chính. Tôi góp ý SOP từng dòng và tổ chức phỏng vấn kỹ thuật thử. Tôi cũng sẽ trao đổi thẳng thắn khi một trường chưa thực sự phù hợp với bạn.',
  'Harvard ’25, majoring in Economics with a minor in Statistics. I love helping students with the Common App essays — yes, all 650 words of them.':
    'Harvard khóa 2025, chuyên ngành Kinh tế học và ngành phụ Thống kê. Tôi rất thích hỗ trợ học sinh với bài luận Common App — bao gồm toàn bộ 650 từ.',
  'PhD candidate at Imperial. I help applicants for engineering and physics programmes navigate research statements and interview panels.':
    'Nghiên cứu sinh Tiến sĩ tại Imperial. Tôi hỗ trợ ứng viên các chương trình kỹ thuật và vật lý xây dựng bài luận nghiên cứu và chuẩn bị cho hội đồng phỏng vấn.',
  'Stanford alum now at a YC-backed AI startup. I focus on Stanford-specific essays, internship prep, and breaking into Bay Area tech.':
    'Cựu sinh viên Stanford, hiện làm việc tại một startup AI được YC hậu thuẫn. Tôi tập trung vào bài luận riêng của Stanford, chuẩn bị thực tập và định hướng gia nhập ngành công nghệ tại Bay Area.',
  'VNU Hanoi business student. I work mostly with applicants targeting top Vietnamese universities and exchange programmes — affordable rates in VND.':
    'Sinh viên ngành Kinh doanh tại VNU Hà Nội. Tôi chủ yếu hỗ trợ ứng viên nhắm đến các trường hàng đầu Việt Nam và chương trình trao đổi, với mức phí phù hợp bằng VND.',
  'UCL Architecture grad. Portfolio reviews, design-school interviews, and how to actually survive crit week as a first-year.':
    'Tốt nghiệp Kiến trúc tại UCL. Tôi hỗ trợ góp ý portfolio, luyện phỏng vấn trường thiết kế và chia sẻ cách vượt qua tuần phản biện trong năm nhất.',
  'MIT EECS PhD. I help applicants for top US engineering programmes nail their statement of purpose and prepare for grilling interviews.':
    'Nghiên cứu sinh Tiến sĩ EECS tại MIT. Tôi giúp ứng viên các chương trình kỹ thuật hàng đầu Hoa Kỳ hoàn thiện bài luận mục đích và chuẩn bị cho các vòng phỏng vấn chuyên sâu.',
  SAQ: 'SAQ',
  'SOP review': 'Góp ý bài luận mục đích (SOP)',
  Internships: 'Thực tập',
  'Research applications': 'Hồ sơ nghiên cứu',
  'Visa & relocation': 'Visa & chuyển nơi ở',
  'Portfolio review': 'Góp ý portfolio',
  'Common App': 'Common App',
  'STEM Olympiad veteran': 'Có kinh nghiệm thi Olympic STEM',
  'Strong writer': 'Viết luận tốt',
  'Mock interviews': 'Phỏng vấn thử',
  'Tech-savvy': 'Am hiểu công nghệ',
  'Startup experience': 'Kinh nghiệm khởi nghiệp',
  'Empathetic listener': 'Biết lắng nghe và thấu cảm',
  'Public speaking': 'Thuyết trình trước công chúng',
  Multilingual: 'Đa ngôn ngữ',
  Hindi: 'Tiếng Hindi',
  Mandarin: 'Tiếng Quan Thoại',
  Japanese: 'Tiếng Nhật',
  Korean: 'Tiếng Hàn',
  Spanish: 'Tiếng Tây Ban Nha',
  Arabic: 'Tiếng Ả Rập',
  French: 'Tiếng Pháp',

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
  'Scholarship value': 'Giá trị học bổng',
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
  'Choose a university for this scholarship': 'Chọn trường đại học cho học bổng này',
  'This scholarship is linked to more than one university. Choose the one you plan to apply to.':
    'Học bổng này liên kết với nhiều trường đại học. Hãy chọn trường bạn dự định ứng tuyển.',
  'This scholarship is not tied to a specific university in our data. Choose the university you plan to apply to, then check the official eligibility rules.':
    'Trong dữ liệu của chúng tôi, học bổng này không gắn với một trường cụ thể. Hãy chọn trường bạn dự định ứng tuyển, sau đó kiểm tra điều kiện chính thức.',
  'University options': 'Các trường đại học để lựa chọn',
  'Loading universities...': 'Đang tải danh sách trường...',
  'No universities match your search.': 'Không có trường đại học nào khớp với tìm kiếm của bạn.',
  'No universities are available in the directory yet.': 'Chưa có trường đại học nào trong danh mục.',
  'Save scholarship and university': 'Lưu học bổng và trường đại học',
  'Could not save this scholarship. Please try again.': 'Không thể lưu học bổng này. Vui lòng thử lại.',
  'Could not remove this scholarship. Please try again.': 'Không thể xóa học bổng này. Vui lòng thử lại.',
  'We could not load the university list. Please try again.': 'Không thể tải danh sách trường đại học. Vui lòng thử lại.',
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
  'An advisor session credit included': 'Tặng kèm 1 buổi với cố vấn',
  'University search & matching': 'Tìm kiếm & gợi ý trường phù hợp',
  'Save universities & scholarships': 'Lưu trường & học bổng',
  'Full scholarship details (eligibility, documents, deadlines)':
    'Thông tin học bổng đầy đủ (điều kiện, hồ sơ, hạn nộp)',
  'Advisor session credit included': 'Tặng kèm buổi với cố vấn',
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
  'GlowBal Matching Report': 'Phân tích Mức độ Phù hợp Giữa ứng viên và lựa chọn trường - ngành - học bổng',
  'Personalized Strategy': 'Chiến lược Cá nhân hoá',
  'Application Planner': 'Theo dõi Quá trình Ứng tuyển',
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
  'Build my strategy': 'Xây dựng chiến lược của tôi',
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
  Advisor: 'Cố vấn',
  Article: 'Bài viết',
  'Application sent': 'Đã gửi đơn',
  Welcome: 'Chào mừng',
  // My Portal row quick links
  Report: 'Báo cáo',
  Board: 'Bảng',

  // ── Language switcher ────────────────────────────────────────────────────
  English: 'Tiếng Anh',
  Vietnamese: 'Tiếng Việt',

  // ── CV Builder (src/components/cv/CvBuilderWorkspace.tsx) ───────────────
  // English is the source of truth for this screen (OpenAI-backed since it
  // switched off DeepSeek); these keys mirror the copy that used to be
  // hardcoded in Vietnamese directly in the JSX.
  'Complete your Personalized Strategy before building a CV.':
    'Hoàn tất Chiến lược cá nhân hóa trước khi tạo CV.',
  'Open Personalized Strategy': 'Mở Chiến lược cá nhân hóa',
  'Your Target Profile will be generated from the current strategy.':
    'Hồ sơ mục tiêu sẽ được tạo từ chiến lược hiện tại.',
  'Strategic directions': 'Các định hướng chiến lược',
  'Your AI-recommended CV direction': 'Định hướng CV do AI đề xuất',
  'These directions are read-only. The Recommended direction is locked to your Personalized Strategy.':
    'Các định hướng này chỉ đọc. Định hướng Đề xuất được khóa theo Chiến lược cá nhân hóa.',
  '{count} directions evaluated': '{count} định hướng đã được đánh giá',
  'Strategy alignment': 'Căn chỉnh chiến lược',
  'Chosen direction': 'Định hướng đã chọn',
  'Locked strategy direction': 'Định hướng chiến lược đã khóa',
  'Retry Target Profile': 'Thử lại Hồ sơ mục tiêu',
  'Regenerate the Target Profile for the current strategy.':
    'Tạo lại Hồ sơ mục tiêu cho chiến lược hiện tại.',
  'chosenDirection must match one of directionOptions':
    'Định hướng đã chọn phải khớp với một trong các lựa chọn định hướng',
  'Your Personalized Strategy sets the direction. The AI only uses university, programme and profile data stored in Supabase; missing pieces are flagged, never invented.':
    'Chiến lược cá nhân hóa định hướng. AI chỉ sử dụng dữ liệu trường, chương trình và hồ sơ được lưu trong Supabase; phần thiếu sẽ được đánh dấu, không bịa thêm.',
  'CV creation progress': 'Tiến trình tạo CV',
  Content: 'Nội dung',
  'CV Draft': 'Bản CV',
  'No Target Profile yet. Enter a career direction and start generating.':
    'Chưa có hồ sơ mục tiêu. Hãy nhập định hướng và bắt đầu tạo.',
  'University positioning': 'Định vị trường',
  'Educational philosophy': 'Triết lý giáo dục',
  Environment: 'Môi trường',
  'Programme objectives': 'Mục tiêu chương trình',
  'Priority competencies': 'Năng lực ưu tiên',
  'Information used to position the CV': 'Thông tin dùng để định hướng CV',
  'Not enough data': 'Chưa đủ dữ liệu',
  'Missing data: {items}': 'Dữ liệu còn thiếu: {items}',
  'What the CV needs to prove': 'CV cần chứng minh',
  'This is the target for the CV, not a score of the current profile.':
    'Đây là mục tiêu cho CV, chưa phải điểm đánh giá hồ sơ hiện tại.',
  'Suggested evidence: {items}': 'Dẫn chứng phù hợp: {items}',
  // 'Personal information', 'Full name' and 'Location' are already defined
  // above (§ Application sub-nav / onboarding); reused as-is here.
  Phone: 'Điện thoại',
  'Links — comma separated': 'Links — ngăn cách bằng dấu phẩy',
  Institution: 'Trường',
  Qualification: 'Bằng cấp',
  'Field of study': 'Ngành học',
  Start: 'Bắt đầu',
  End: 'Kết thúc',
  'Remove this entry': 'Xóa mục này',
  '+ Add education': '+ Thêm education',
  'Each entry allows up to 5 contributions. Describe real actions and results.':
    'Mỗi hoạt động tối đa 5 contributions. Hãy mô tả hành động và kết quả có thật.',
  // 'Type' and 'Remove' are already defined above; reused as-is here.
  'Role / title': 'Vai trò / tiêu đề',
  Organization: 'Tổ chức',
  'Remove contribution': 'Xóa contribution',
  'Remove entry': 'Xóa hoạt động',
  '+ Add entry': '+ Thêm trải nghiệm',
  Award: 'Giải thưởng',
  '+ Add award': '+ Thêm award',
  'Remove skill group {index}': 'Xóa nhóm kỹ năng {index}',
  'Remove group': 'Xóa nhóm',
  Group: 'Nhóm',
  'Skills — comma separated': 'Kỹ năng — ngăn cách bằng dấu phẩy',
  '+ Add skill group': '+ Thêm nhóm kỹ năng',
  'Section {label}': 'Mục {label}',
  'Reorder {label}': 'Sắp xếp {label}',
  'Drag {label}': 'Kéo {label}',
  'Drag to reorder': 'Kéo để đổi vị trí',
  'Move {label} up': 'Đưa {label} lên',
  'Move up': 'Đưa lên',
  'Move {label} down': 'Đưa {label} xuống',
  'Move down': 'Đưa xuống',
  'Remove {label}': 'Xóa {label}',
  'Remove section': 'Xóa section',
  'Remove the {label} section from the CV?': 'Xóa section {label} khỏi CV?',
  'Click to edit': 'Nhấp để chỉnh sửa',
  experience: 'kinh nghiệm',
  project: 'dự án',
  activity: 'hoạt động',
  'Edit {title} heading': 'Chỉnh sửa tiêu đề {title}',
  'Edit {itemLabel} {index} organization': 'Chỉnh sửa tổ chức {itemLabel} {index}',
  'Edit {itemLabel} {index} title': 'Chỉnh sửa tiêu đề {itemLabel} {index}',
  'Edit {itemLabel} {index} dates': 'Chỉnh sửa thời gian {itemLabel} {index}',
  'Edit {title} — bullet {index}': 'Chỉnh sửa {title} — bullet {index}',
  'Edit full name': 'Chỉnh sửa họ tên',
  'Edit email': 'Chỉnh sửa email',
  'Edit phone number': 'Chỉnh sửa số điện thoại',
  'Edit location': 'Chỉnh sửa địa điểm',
  'Edit link {index}': 'Chỉnh sửa liên kết {index}',
  'Edit Profile heading': 'Chỉnh sửa tiêu đề Profile',
  'Edit the introduction': 'Chỉnh sửa phần giới thiệu',
  'Edit Education heading': 'Chỉnh sửa tiêu đề Education',
  'Edit school {index}': 'Chỉnh sửa trường học {index}',
  'Edit qualification {index}': 'Chỉnh sửa bằng cấp {index}',
  'Edit field of study {index}': 'Chỉnh sửa ngành học {index}',
  'Edit education detail {index}': 'Chỉnh sửa chi tiết học vấn {index}',
  'Edit Awards heading': 'Chỉnh sửa tiêu đề Awards',
  'Edit award {index}': 'Chỉnh sửa giải thưởng {index}',
  'Edit award issuer {index}': 'Chỉnh sửa đơn vị trao giải {index}',
  'Edit Skills heading': 'Chỉnh sửa tiêu đề Skills',
  'Edit skill group name {index}': 'Chỉnh sửa tên nhóm kỹ năng {index}',
  'Edit skills in group {index}': 'Chỉnh sửa kỹ năng nhóm {index}',
  'Edit study dates {index}': 'Chỉnh sửa thời gian học {index}',
  'Clear the draft on this device': 'Xóa bản nháp trên thiết bị',
  'Retry the missing sections': 'Thử lại phần thiếu',
  'Decide what the CV needs to prove.': 'Xác định CV cần chứng minh điều gì.',
  'The AI only uses university, programme and profile data stored in Supabase. Missing pieces are flagged, never invented.':
    'AI chỉ dùng dữ liệu trường, chương trình và hồ sơ có trong Supabase. Phần thiếu sẽ được đánh dấu, không tự bịa.',
  'Career direction (optional)': 'Định hướng nghề nghiệp (không bắt buộc)',
  'e.g. Software Engineer in education technology': 'Ví dụ: Software Engineer in education technology',
  'AI is working…': 'AI đang làm…',
  'Regenerate Target Profile': 'Tạo lại hồ sơ mục tiêu',
  'Create Target Profile': 'Tạo hồ sơ mục tiêu',
  'Continue to content →': 'Tiếp tục nhập nội dung →',
  'Enter your CV data': 'Nhập dữ liệu cho CV',
  'Review the existing information and add your experience, awards and skills.':
    'Kiểm tra thông tin có sẵn và bổ sung trải nghiệm, giải thưởng, kỹ năng của bạn.',
  // 'Back' is already defined above; reused as-is here.
  'Generate CV with AI': 'Tạo CV bằng AI',
  'Your CV is ready. Review and edit it.': 'CV đã được tạo. Kiểm tra và chỉnh sửa.',
  'AI is building your CV.': 'AI đang xây dựng CV của bạn.',
  'Click directly on the CV content to edit it before running a review.':
    'Nhấp trực tiếp vào nội dung trong bản CV để chỉnh sửa trước khi đánh giá.',
  'Evidence coverage': 'Độ phủ dẫn chứng',
  '3 strengths': '3 điểm mạnh',
  'Needs more evidence': 'Cần bổ sung',
  'AI needs more from you': 'AI cần bạn bổ sung',
  'Answer with real facts. The AI will only rewrite the affected sections.':
    'Trả lời bằng dữ kiện thật. AI sẽ chỉ viết lại phần liên quan.',
  'Answered {count}/{total} questions': 'Đã trả lời {count}/{total} câu',
  'AI is improving the CV…': 'AI đang cải thiện CV…',
  'Use these answers to improve the CV': 'Dùng câu trả lời để cải thiện CV',
  'Click the introduction or any bullet on the CV to edit it.':
    'Nhấp vào phần giới thiệu hoặc bullet trên CV để chỉnh sửa.',
  'AI is reviewing…': 'AI đang đánh giá…',
  'Run CV Review': 'Đánh giá CV',
  'Answer every question and regenerate the CV before running Review.':
    'Hãy trả lời đủ các câu hỏi và tạo lại CV trước khi đánh giá.',
  'Choose layout →': 'Chọn layout →',
  'Choose how the CV is presented': 'Chọn cách trình bày CV',
  'Both layouts use the same content; you can switch templates before downloading the PDF.':
    'Hai layout dùng cùng nội dung; bạn có thể đổi mẫu trước khi tải PDF.',
  'Black and white, single column, ATS-optimized.': 'Đen trắng, một cột, tối ưu ATS.',
  'Light rose–slate, emphasizes personal character.': 'Light hồng–slate, nhấn mạnh dấu ấn cá nhân.',
  'AI suggests: {rationale}': 'AI đề xuất: {rationale}',
  'The CV may run past two pages. Shorten the introduction or the bullets.':
    'CV có thể vượt hai trang. Hãy rút gọn phần giới thiệu hoặc các bullet.',
  'Download PDF / Print CV': 'Tải PDF / In CV',
  '{count} items completed': '{count} mục đã hoàn tất',
  // Status/error strings held in component state as their English source
  // and looked up via t(status) / t(error) at render time.
  'AI is preparing the Target Profile…': 'AI đang chuẩn bị hồ sơ mục tiêu…',
  'Preparing profile and programme data…': 'Đang chuẩn bị dữ liệu hồ sơ và chương trình…',
  'AI is building the Target Profile…': 'AI đang xây dựng hồ sơ mục tiêu…',
  'AI is normalizing and arranging the CV…': 'AI đang chuẩn hóa và sắp xếp CV…',
  'AI is evaluating the current CV…': 'AI đang đánh giá CV hiện tại…',
  'Could not create the Target Profile.': 'Chưa thể tạo hồ sơ mục tiêu. Vui lòng thử lại.',
  'Create a Target Profile first.': 'Hãy tạo hồ sơ mục tiêu trước.',
  'Could not create the CV.': 'Không thể tạo CV.',
  'Could not review the CV.': 'Không thể đánh giá CV.',
  'Invalid Target Profile.': 'Hồ sơ mục tiêu không hợp lệ.',
  'Invalid list of sections to generate.': 'Danh sách phần cần tạo không hợp lệ.',
  'Invalid CV generation mode.': 'Chế độ tạo CV không hợp lệ.',
  'Could not finish the CV. Please retry the missing sections.':
    'Chưa thể hoàn tất CV. Vui lòng thử lại phần còn thiếu.',
  'A current Personalized Strategy is required before building a CV.':
    'Cần có Chiến lược cá nhân hóa hiện tại trước khi tạo CV.',
  'A current Personalized Strategy is required before generating a CV.':
    'Cần có Chiến lược cá nhân hóa hiện tại trước khi tạo CV.',
  'Your Personalized Strategy changed. Refresh the CV Builder and try again.':
    'Chiến lược cá nhân hóa của bạn đã thay đổi. Hãy làm mới trình tạo CV rồi thử lại.',
  'The Target Profile was created from an older strategy. Regenerate it and try again.':
    'Hồ sơ mục tiêu được tạo từ chiến lược cũ. Hãy tạo lại rồi thử lại.',
  'Invalid career direction.': 'Định hướng nghề nghiệp không hợp lệ.',
  // Approved product vocabulary (kept exact for static crawl parity).
  'Search Universities': 'Tìm Đại học',
  'Search Scholarships': 'Tìm Học bổng',
  'Search Advisors': 'Tìm cố vấn',
  'My Application': 'Theo dõi Tiến độ',
  'Saved Universities': 'Trường đã lưu',
  Reflection: 'Nhập Thông Tin',
  'Profile Support': 'Xây dựng Hồ sơ cùng GlowBal AI',
  'Essay Support': 'Xây dựng Bài luận',
  'CV Support': 'Xây dựng CV',
  'LOR Support': 'Xây dựng Thư giới thiệu',
  // Static-audit additions (rendered UI remains local when machine translation
  // is unavailable or blocked).
  'Open My Portal': 'Mở Trang lưu',
  'Create an account': 'Tạo tài khoản',
  'Back to planner': 'Quay lại kế hoạch',
  Due: 'Hạn',
  'Evidence required': 'Cần dẫn chứng',
  'Up to +': 'Tối đa +',
  'AI Coach': 'Cố vấn AI',
  'Enter your name': 'Nhập tên của bạn',
  Unlock: 'Mở khóa',
  Link: 'Liên kết',
  Unique: 'Duy nhất',
  Referred: 'Được giới thiệu',
  'Welcome,': 'Chào mừng,',
  'Date:': 'Ngày:',
  'Payment pending': 'Đang chờ thanh toán',
  'Meeting link': 'Liên kết cuộc họp',
  'Leave a review': 'Để lại đánh giá',
  Review: 'Đánh giá',
  'Comment (optional)': 'Nhận xét (không bắt buộc)',
  'Error ID:': 'Mã lỗi:',
  'Back home': 'Về trang chủ',
  'UAT Feedback': 'Phản hồi UAT',
  'Page URL': 'URL trang',
  '(optional)': '(không bắt buộc)',
  Area: 'Khu vực',
  'Application received': 'Đã nhận hồ sơ',
  Book: 'Đặt lịch',
  'Open AI Writer': 'Mở AI Writer',
  'Return to Homepage': 'Về trang chủ',
  'Changed your mind?': 'Bạn đã đổi ý?',
  'Go back to homepage': 'Về trang chủ',
  'Loading...': 'Đang tải...',
  'Upload your CV': 'Tải CV của bạn lên',
  'The more': 'Càng nhiều',
  'provide, the': 'bạn cung cấp,',
  'will be!': 'càng tốt!',
  'Loading globe...': 'Đang tải quả địa cầu...',
  'Globe view': 'Chế độ xem địa cầu',
  'Privacy Policy': 'Chính sách bảo mật',
  'e.g. 2027': 'ví dụ: 2027',
  'Find a curriculum': 'Tìm chương trình học',
  'e.g. 2025': 'ví dụ: 2025',
  'What you are aiming for': 'Mục tiêu của bạn',
  'e.g. Hanoi, Vietnam': 'ví dụ: Hà Nội, Việt Nam',
  'Where and what': 'Ở đâu và ngành gì',
  'e.g. United Kingdom': 'ví dụ: Vương quốc Anh',
  Manage: 'Quản lý',
  Account: 'Tài khoản',
  'Document type': 'Loại tài liệu',
  'e.g. Google': 'ví dụ: Google',
  Add: 'Thêm',
  'Back to profile': 'Quay lại hồ sơ',
  'View →': 'Xem →',
  'Filter:': 'Bộ lọc:',
  'All (': 'Tất cả (',
  'For:': 'Cho:',
  'No link available': 'Không có liên kết',
  'Go to Apply': 'Đi đến Nộp đơn',
  'Competition rate': 'Mức độ cạnh tranh',
  'Name (A-Z)': 'Tên (A-Z)',
  'Apply to VinUni': 'Nộp đơn vào VinUni',
  'Academic profile': 'Hồ sơ học tập',
  '· click to': '· nhấn để',
  'Maintain:': 'Duy trì:',
  'Application timeline': 'Lộ trình hồ sơ',
  'Notify:': 'Thông báo:',
  'Alumni network': 'Mạng lưới cựu sinh viên',
  'Climate:': 'Khí hậu:',
  'Run it through the AACC analyzer whenever you’re ready.': 'Chạy qua trình phân tích AACC bất cứ khi nào bạn sẵn sàng.',
  'I have a draft — analyze it': 'Tôi có bản nháp — phân tích ngay',
  'VinUni AACC verdict': 'Kết luận AACC VinUni',
  'Edit & re-analyze': 'Sửa và phân tích lại',
  'on My Portal': 'trong Trang lưu',
  'GPA:': 'GPA:',
  'Difficulty:': 'Độ khó:',
  'Acceptance rate:': 'Tỷ lệ trúng tuyển:',
  'Employability:': 'Khả năng việc làm:',
  'View official page': 'Xem trang chính thức',
  'LinkedIn, portfolio, GitHub': 'LinkedIn, hồ sơ năng lực, GitHub',
  Education: 'Học vấn',
  'Experience Collection': 'Bộ sưu tập kinh nghiệm',
  Experience: 'Kinh nghiệm',
  Project: 'Dự án',
  Volunteering: 'Tình nguyện',
  'Contribution framework': 'Khung đóng góp',
  Built: 'Xây dựng',
  Led: 'Dẫn dắt',
  Improved: 'Cải thiện',
  Partnered: 'Hợp tác',
  '+ Contribution (': '+ Đóng góp (',
  'Build My CV': 'Xây dựng CV của tôi',
  'Target Profile': 'Hồ sơ mục tiêu',
  'Layout & PDF': 'Bố cục & PDF',
  'Fit:': 'Mức phù hợp:',
  'Medium-high': 'Khá cao',
  Locked: 'Đã khóa',
  '• You have time to prepare before the deadline.': '• Bạn còn thời gian chuẩn bị trước hạn chót.',
  'What to improve': 'Điều cần cải thiện',
  'Week 3: Review your CV and recommendation letter.': 'Tuần 3: Xem lại CV và thư giới thiệu.',
  'Can help with': 'Có thể hỗ trợ',
  'GLOWBAL home': 'Trang chủ GLOWBAL',
  'Toggle menu': 'Bật/tắt menu',
  'Popular:': 'Phổ biến:',
  'Create your free GlowBal profile': 'Tạo hồ sơ GlowBal miễn phí',
  'Create free profile': 'Tạo hồ sơ miễn phí',
  'I already have an account': 'Tôi đã có tài khoản',
  'Decorative globe': 'Quả địa cầu trang trí',
  'Need help with your application?': 'Cần trợ giúp với hồ sơ của bạn?',
  'Need help with your': 'Cần trợ giúp với',
  'application?': 'hồ sơ của bạn?',
  '← Back to home': '← Về trang chủ',
  'Match breakdown': 'Phân tích mức phù hợp',
  'Profile under review.': 'Hồ sơ đang được xem xét.',
  'Application not approved.': 'Hồ sơ chưa được duyệt.',
  'Topic:': 'Chủ đề:',
  'Goal:': 'Mục tiêu:',
  'Mentee paid': 'Người được cố vấn đã thanh toán',
  'Join meeting →': 'Tham gia cuộc họp →',
  'Your monthly availability': 'Lịch rảnh hàng tháng của bạn',
  'Your availability': 'Lịch rảnh của bạn',
  'Booked — can’t be removed': 'Đã đặt — không thể xóa',
  "Booked — can't be removed": 'Đã đặt — không thể xóa',
  '· Booked': '· Đã đặt',
  'Hourly rate': 'Mức phí theo giờ',
  '/ hour': '/ giờ',
  'e.g. Linh N.': 'ví dụ: Linh N.',
  'Adding:': 'Đang thêm:',
  Preview: 'Xem trước',
  'e.g. 2021': 'ví dụ: 2021',
  'Add another': 'Thêm mục khác',
  'Add another language': 'Thêm ngôn ngữ khác',
  'You receive': 'Bạn nhận được',
  'Your availability —': 'Lịch rảnh của bạn —',
  'Ready to go GLOWBAL?': 'Sẵn sàng GLOWBAL chưa?',
  yeah: 'đúng vậy',
  'F7.1 · Evidence matching': 'F7.1 · Đối chiếu dẫn chứng',
  'Homeroom teacher': 'Giáo viên chủ nhiệm',
  Employer: 'Nhà tuyển dụng',
  Coach: 'Huấn luyện viên',
  'How long have they known you?': 'Họ đã biết bạn trong bao lâu?',
  'How do they know you?': 'Họ biết bạn qua đâu?',
  'Email template for recommender': 'Mẫu email cho người giới thiệu',
  'EMAIL TEMPLATE': 'MẪU EMAIL',
  'Drafting your email…': 'Đang soạn email…',
  'Email template': 'Mẫu email',
  'Loading your draft…': 'Đang tải bản nháp…',
  Completed: 'Đã hoàn tất',
  'Letter of Recommendation': 'Thư giới thiệu',
  'AI Feedback': 'Phản hồi AI',
  'Checking tone, evidence, and programme fit.': 'Đang kiểm tra giọng văn, dẫn chứng và mức phù hợp chương trình.',
  'Programme ·': 'Chương trình ·',
  'Profile ·': 'Hồ sơ ·',
  'Overall quality': 'Chất lượng tổng thể',
  'PROFILE COVERAGE': 'MỨC ĐỘ BAO PHỦ HỒ SƠ',
  Pagination: 'Phân trang',
  'Next page': 'Trang tiếp theo',
  'Planner view': 'Chế độ xem kế hoạch',
  'Remove row': 'Xóa hàng',
  'Add item': 'Thêm mục',
  'Next Priority': 'Ưu tiên tiếp theo',
  'Final Deadline': 'Hạn chót cuối',
  Category: 'Danh mục',
  Priority: 'Ưu tiên',
  Added: 'Đã thêm',
  Remaining: 'Còn lại',
  'Next up': 'Tiếp theo',
  'Nothing left — nicely done.': 'Không còn gì — làm tốt lắm.',
  Recommended: 'Đề xuất',
  Overall: 'Tổng thể',
  Before: 'Trước',
  After: 'Sau',
  Prioritize: 'Ưu tiên',
  Avoid: 'Tránh',
  'Long-term narrative': 'Câu chuyện dài hạn',
  'Download PDF': 'Tải PDF',
  'Preparing PDF...': 'Đang chuẩn bị PDF...',
  'Turn this into Planner tasks': 'Biến điều này thành việc cần làm trong Kế hoạch',
  'Adds what to prioritize and what to avoid, above, to your Planner as tasks you can track. Safe to click again after this report regenerates — it updates the same tasks rather than duplicating them.':
    'Thêm những việc cần ưu tiên và cần tránh ở trên vào Kế hoạch của bạn dưới dạng việc cần làm có thể theo dõi. Bạn có thể bấm lại sau khi báo cáo này được tạo lại — hệ thống sẽ cập nhật cùng những việc đó thay vì tạo trùng lặp.',
  'Adding to Planner...': 'Đang thêm vào Kế hoạch...',
  'Add to Planner': 'Thêm vào Kế hoạch',
  'Review my CV': 'Xem lại CV của tôi',
  Uploading: 'Đang tải lên',
  'Reading document': 'Đang đọc tài liệu',
  'Organizing content': 'Đang sắp xếp nội dung',
  'Ready to review': 'Sẵn sàng xem lại',
  'Evidence:': 'Dẫn chứng:',
  'Cancel import': 'Hủy nhập',
  'Layout - PDF': 'Bố cục - PDF',
  'CV layout': 'Bố cục CV',
  'AI recommended': 'AI đề xuất',
  'Zoom out': 'Thu nhỏ',
  'Zoom in': 'Phóng to',
  'of your CV': 'của CV bạn',
  'No CV uploaded yet': 'Chưa tải CV lên',
  'Enter information manually': 'Nhập thông tin thủ công',
  'Try another file': 'Thử tệp khác',
  'We could not build your PDF.': 'Không thể tạo PDF của bạn.',
  Current: 'Hiện tại',
  Accept: 'Chấp nhận',
  'Edit manually': 'Chỉnh sửa thủ công',
  Programme: 'Chương trình',
  Exchange: 'Trao đổi',
  'Meet our team': 'Gặp đội ngũ của chúng tôi',
  'Next team member': 'Thành viên tiếp theo',
  'Team member': 'Thành viên đội ngũ',
  'View opportunity': 'Xem cơ hội',
  'Create a profile': 'Tạo hồ sơ',
  'Uploading…': 'Đang tải lên…',
  Complete: 'Hoàn tất',
  'or drag and drop': 'hoặc kéo thả',
  Primary: 'Chính',
  'Layout and PDF | GlowBal': 'Bố cục và PDF | GlowBal',
  'Target Profile | GlowBal': 'Hồ sơ mục tiêu | GlowBal',
  Calendar: 'Lịch',
  Upcoming: 'Sắp tới',
  Cancelled: 'Đã hủy',
  'IB Diploma Programme (IBDP)': 'Chương trình Tú tài Quốc tế (IBDP)',
  'TOEFL iBT': 'TOEFL iBT',
  'PTE Academic': 'PTE Academic',
  'None yet': 'Chưa có',
  ACT: 'ACT',
  'IB Diploma': 'Tú tài Quốc tế',
  'A-Level': 'A-Level',
  Africa: 'Châu Phi',
  Oceania: 'Châu Đại Dương',
  'Privacy Policy | GlowBal': 'Chính sách bảo mật | GlowBal',
  'Information we collect': 'Thông tin chúng tôi thu thập',
  'Low competition': 'Cạnh tranh thấp',
  Moderate: 'Trung bình',
  'Highly competitive': 'Cạnh tranh cao',
  General: 'Chung',
  'Health & medicine': 'Sức khỏe & y khoa',
  'Doctoral / PhD': 'Tiến sĩ / PhD',
  Academic: 'Học thuật',
  Career: 'Nghề nghiệp',
  FAQ: 'Câu hỏi thường gặp',
  'About Me': 'Giới thiệu bản thân',
  Layout: 'Bố cục',
  Explore: 'Khám phá',
  Fund: 'Tài trợ',
  Connect: 'Kết nối',
  'You don’t know what to do next': 'Bạn chưa biết bước tiếp theo',
  Team: 'Đội ngũ',
  'GBP (£)': 'GBP (£)',
  'VND (₫)': 'VND (₫)',
  Antarctica: 'Nam Cực',
  Writing: 'Bài viết',
  Detail: 'Chi tiết',
  Voice: 'Giọng văn',
  Character: 'Số ký tự',
  Contribution: 'Đóng góp',
  Hook: 'Mở đầu',
  'Wider engagement': 'Mức độ tương tác rộng hơn',
  'Written voice': 'Giọng văn viết',
  Impact: 'Tác động',
  'CV / Portfolio': 'CV / Hồ sơ năng lực',
  'Strategy Roadmap': 'Lộ trình chiến lược',
  'Open CV builder': 'Mở công cụ tạo CV',
  'Review your profile': 'Xem lại hồ sơ',
  'Receive a live improvement roadmap': 'Nhận lộ trình cải thiện trực tiếp',
  'AI Powered': 'Vận hành bằng AI',
  Direction: 'Định hướng',
  Narrative: 'Câu chuyện',
  Portfolio: 'Hồ sơ năng lực',
  Differentiation: 'Điểm khác biệt',
  Roadmap: 'Lộ trình',
  Technical: 'Kỹ thuật',
  'Make clearer': 'Làm rõ hơn',
  'Highlight impact': 'Làm nổi bật tác động',
  'Add confirmed evidence': 'Thêm dẫn chứng đã xác nhận',
  'Career Alignment': 'Mức độ phù hợp nghề nghiệp',
  'Upload a CV': 'Tải CV lên',
  'Continue to layout anyway': 'Vẫn tiếp tục đến bố cục',
  Retry: 'Thử lại',
  'Continue editing': 'Tiếp tục chỉnh sửa',
  'Add CV content': 'Thêm nội dung CV',
  'Retry export': 'Thử xuất lại',
  'Generate a new PDF': 'Tạo PDF mới',
  'Output report': 'Báo cáo kết quả',
  'Community Impact Project': 'Dự án tác động cộng đồng',
  'Building your application': 'Xây dựng hồ sơ ứng tuyển',
  'Work your improvement plan': 'Thực hiện kế hoạch cải thiện',
  New: 'Mới',
  'Privacy policy': 'Chính sách bảo mật',
  'Content and AI output': 'Nội dung và kết quả AI',
  'Career planning': 'Lập kế hoạch nghề nghiệp',
  'What if I cannot afford the tuition?': 'Nếu tôi không đủ khả năng chi trả học phí thì sao?',
  'Lead Technical Developer': 'Trưởng nhóm phát triển kỹ thuật',
  'Head of Technology': 'Trưởng bộ phận Công nghệ',
  Marketing: 'Tiếp thị',
  'Employability': 'Khả năng việc làm',
  'Extremely Competitive': 'Cạnh tranh cực kỳ cao',
  'Competitive–Extremely Competitive': 'Cạnh tranh đến cực kỳ cao',
  Computing: 'Điện toán',
  'quant finance': 'tài chính định lượng',
  'Female Future Leader Award': 'Giải thưởng Nữ lãnh đạo tương lai',
  'About GlowBal | The team helping students study abroad': 'Giới thiệu GlowBal | Đội ngũ hỗ trợ sinh viên du học',
  'The team helping students go global': 'Đội ngũ giúp sinh viên vươn ra thế giới',
  'GlowBal is built by students and advisors who have been through the study-abroad journey themselves — and want to make it clearer for everyone who comes next.': 'GlowBal được xây dựng bởi những sinh viên và cố vấn từng trải qua hành trình du học — và muốn giúp hành trình ấy rõ ràng hơn cho những người tiếp bước.',
  Stage: 'Giai đoạn',
  'The part that changes your odds': 'Phần giúp thay đổi cơ hội của bạn',
  'See the whole journey': 'Xem toàn bộ hành trình',
  'Where you start one': 'Điểm bắt đầu của bạn',
  'Find a university first': 'Trước tiên, hãy tìm trường đại học',
  'Ready to start yours?': 'Bạn sẵn sàng bắt đầu chưa?',
  'Create a free account to save universities, plan an application and build your first strategy.': 'Tạo tài khoản miễn phí để lưu trường, lập kế hoạch ứng tuyển và xây dựng chiến lược đầu tiên.',
  'Read how GlowBal works': 'Đọc cách GlowBal hoạt động',
  'Select your level': 'Chọn bậc học',
  'Saving your information': 'Đang lưu thông tin của bạn',
  'What is your highest level of education?': 'Trình độ học vấn cao nhất của bạn là gì?',
  'What is your nationality?': 'Quốc tịch của bạn là gì?',
  GPA: 'GPA',
  IELTS: 'IELTS',
  'Separate several with a comma.': 'Phân tách nhiều mục bằng dấu phẩy.',
  'Which countries are you interested in?': 'Bạn quan tâm đến những quốc gia nào?',
  'Total budget': 'Tổng ngân sách',
  'Select your tuition budget (USD)': 'Chọn ngân sách học phí của bạn (USD)',
  // Reflection step 1, rebuilt as one question per screen.
  // Candidate Information redesign — modes, chrome, scores and conversions.
  // Subject catalogue and intake seasons (spec 2).
  // Questions 5-8 (spec 2).
  'Search subjects or browse below': 'Tìm ngành hoặc xem danh sách bên dưới',
  'No subjects found for “{query}”': 'Không tìm thấy ngành nào cho “{query}”',
  Others: 'Khác',
  'Add as Other': 'Thêm vào mục Khác',
  'Select all': 'Chọn tất cả',
  'Show all countries': 'Xem tất cả quốc gia',
  'What subject are you interested in?': 'Bạn quan tâm đến ngành nào?',
  'e.g. Marine Biology': 'ví dụ: Sinh học biển',
  'No countries found for “{query}”': 'Không tìm thấy quốc gia nào cho “{query}”',
  '🌍 I’m open to other countries': '🌍 Tôi sẵn sàng cân nhắc các quốc gia khác',
  'Show me strong options outside my current choices too.':
    'Hãy gợi ý cho tôi cả những lựa chọn tốt ngoài danh sách hiện tại.',
  'A Master’s normally requires an undergraduate degree first. You can still choose this if you’re planning ahead.':
    'Bậc thạc sĩ thường yêu cầu có bằng đại học trước. Bạn vẫn có thể chọn nếu đang lên kế hoạch dài hạn.',
  'Not sure which one to choose? You can update this information later.':
    'Chưa chắc nên chọn mục nào? Bạn có thể cập nhật thông tin này sau.',
  'Choose at least one subject you’re interested in.': 'Hãy chọn ít nhất một ngành bạn quan tâm.',
  'Choose at least one destination or tell us you’re open to suggestions.':
    'Hãy chọn ít nhất một điểm đến, hoặc cho chúng tôi biết bạn sẵn sàng nghe gợi ý.',
  'Choose the level of study you’re currently considering.':
    'Hãy chọn bậc học bạn đang cân nhắc.',
  'Choose when you would like to start.': 'Hãy chọn thời điểm bạn muốn bắt đầu.',
  'Autumn / Fall': 'Mùa thu',
  Spring: 'Mùa xuân',
  'Data Science & Analytics': 'Khoa học dữ liệu & phân tích',
  'Artificial Intelligence': 'Trí tuệ nhân tạo',
  'Cyber Security': 'An ninh mạng',
  'Information Technology': 'Công nghệ thông tin',
  'Business & Management': 'Kinh doanh & quản trị',
  'Finance & Accounting': 'Tài chính & kế toán',
  Entrepreneurship: 'Khởi nghiệp',
  Mathematics: 'Toán học',
  Physics: 'Vật lý',
  Chemistry: 'Hoá học',
  'Environmental Science': 'Khoa học môi trường',
  Nursing: 'Điều dưỡng',
  Pharmacy: 'Dược',
  'Biomedical Science': 'Khoa học y sinh',
  'Electrical Engineering': 'Kỹ thuật điện',
  'Chemical Engineering': 'Kỹ thuật hoá học',
  'Aerospace Engineering': 'Kỹ thuật hàng không vũ trụ',
  'International Relations': 'Quan hệ quốc tế',
  Sociology: 'Xã hội học',
  History: 'Lịch sử',
  Philosophy: 'Triết học',
  Architecture: 'Kiến trúc',
  'Arts & Design': 'Nghệ thuật & thiết kế',
  'Media & Communication': 'Truyền thông & báo chí',
  Film: 'Điện ảnh',
  'Hospitality & Tourism': 'Khách sạn & du lịch',
  Agriculture: 'Nông nghiệp',
  '{answered} of {total} completed': 'Đã hoàn thành {answered}/{total}',
  'One question at a time': 'Từng câu một',
  'Show all questions': 'Hiển thị tất cả câu hỏi',
  'How would you like to answer?': 'Bạn muốn trả lời theo cách nào?',
  'Not saved': 'Chưa lưu',
  'Save & Exit': 'Lưu & thoát',
  'Save & Continue': 'Lưu & tiếp tục',
  'Highest level of education': 'Trình độ học vấn cao nhất',
  'What qualification is it?': 'Đó là bằng cấp gì?',
  'Not sure? You can update this later in your profile settings.':
    'Chưa chắc chắn? Bạn có thể cập nhật sau trong phần hồ sơ.',
  'Search country or nationality': 'Tìm quốc gia hoặc quốc tịch',
  'No country or nationality matches that.': 'Không có quốc gia hoặc quốc tịch nào khớp.',
  'What is your GPA?': 'GPA của bạn là bao nhiêu?',
  'What is your English test score?': 'Điểm tiếng Anh của bạn là bao nhiêu?',
  'What is your annual tuition budget?': 'Ngân sách học phí hằng năm của bạn là bao nhiêu?',
  'Enter GPA': 'Nhập GPA',
  'Convert with AI': 'Quy đổi bằng AI',
  'Your GPA': 'GPA của bạn',
  'Out of {max}': 'Trên thang {max}',
  'Tell us about your grades': 'Hãy cho chúng tôi biết về điểm của bạn',
  'e.g. 9 As at GCSE and 4 A*s at A Level': 'ví dụ: 9 điểm A ở GCSE và 4 điểm A* ở A Level',
  'Any system — describe them however they were given to you.':
    'Hệ thống nào cũng được — hãy mô tả đúng như bạn nhận được.',
  'Understanding your grades…': 'Đang đọc điểm của bạn…',
  'Estimate my GPA': 'Ước tính GPA của tôi',
  'Estimated GPA': 'GPA ước tính',
  'Use this GPA': 'Dùng GPA này',
  'An approximate equivalent for matching — not an official conversion.':
    'Mức tương đương gần đúng để so khớp — không phải quy đổi chính thức.',
  'We could not read those grades.': 'Chúng tôi chưa đọc được số điểm đó.',
  'We could not read that result.': 'Chúng tôi chưa đọc được kết quả đó.',
  'Equivalent test': 'Chứng chỉ tương đương',
  'Your IELTS band': 'Điểm IELTS của bạn',
  'Out of {max}, in half bands': 'Trên thang {max}, theo bậc 0,5',
  'I haven’t taken an English test yet': 'Tôi chưa thi chứng chỉ tiếng Anh',
  'Test type': 'Loại bài thi',
  'Select a test': 'Chọn một bài thi',
  'Tell us what English qualification or result you have':
    'Hãy cho biết bạn có chứng chỉ hoặc kết quả tiếng Anh nào',
  'e.g. Grade A in Cambridge C1 Advanced': 'ví dụ: Grade A trong Cambridge C1 Advanced',
  'Understanding your result…': 'Đang đọc kết quả của bạn…',
  'Estimate my IELTS': 'Ước tính IELTS của tôi',
  'Estimated IELTS': 'IELTS ước tính',
  'Use this score': 'Dùng điểm này',
  'Secondary school or equivalent': 'Trung học phổ thông hoặc tương đương',
  'Associate degree or diploma': 'Cao đẳng hoặc bằng nghề',
  'Undergraduate degree': 'Bằng đại học',
  'Postgraduate degree': 'Bằng sau đại học',
  'PhD or equivalent': 'Tiến sĩ hoặc tương đương',
  'Something else — tell us': 'Khác — hãy cho chúng tôi biết',
  'e.g. National Diploma in Engineering': 'ví dụ: Bằng kỹ sư quốc gia',
  'Select the option that best describes your current or most advanced qualification.':
    'Chọn phương án mô tả đúng nhất bằng cấp hiện tại hoặc cao nhất của bạn.',
  'Select the country or nationality that best represents you.':
    'Chọn quốc gia hoặc quốc tịch phù hợp nhất với bạn.',
  'Enter your GPA or let AI estimate it from your grades.':
    'Nhập GPA của bạn, hoặc để AI ước tính từ điểm số của bạn.',
  'Enter your IELTS score or choose an equivalent English test and we’ll convert it for you.':
    'Nhập điểm IELTS, hoặc chọn một chứng chỉ tiếng Anh tương đương và chúng tôi sẽ quy đổi giúp bạn.',
  'Choose everywhere you would consider studying.':
    'Chọn tất cả những nơi bạn cân nhắc đi học.',
  'The qualification you want to apply for, not the one you already hold.':
    'Bằng cấp bạn muốn ứng tuyển, không phải bằng bạn đang có.',
  'A rough idea is fine — it shapes which scholarships we look for.':
    'Ước chừng cũng được — điều này định hướng học bổng chúng tôi tìm cho bạn.',
  'Set it in either currency — the two stay in step with each other.':
    'Đặt theo đơn vị tiền nào cũng được — hai ô luôn đồng bộ với nhau.',
  Scores: 'Điểm số',
  Aspirations: 'Nguyện vọng',
  Budget: 'Ngân sách',
  'Duolingo English Test': 'Duolingo English Test',
  'Cambridge English': 'Cambridge English',
  AP: 'AP',
  'Question {current} of {total}': 'Câu hỏi {current} / {total}',
  'Select your nationality': 'Chọn quốc tịch của bạn',
  'Write it on whichever scale your school uses.':
    'Ghi theo thang điểm mà trường bạn đang dùng.',
  'Leave this empty if you have not taken it yet.':
    'Để trống nếu bạn chưa thi.',
  'Which subjects are you interested in?': 'Bạn quan tâm đến những ngành nào?',
  'Pick as many as you are considering — you can change these later.':
    'Chọn bao nhiêu tuỳ ý — bạn có thể thay đổi sau.',
  'Search countries': 'Tìm quốc gia',
  'When do you want to start?': 'Bạn muốn bắt đầu khi nào?',
  'Select an intake': 'Chọn kỳ nhập học',
  'This is what the Planner counts back from when it sets your deadlines.':
    'Kế hoạch của bạn sẽ tính ngược từ mốc này để đặt hạn chót.',
  'What do you want to do after you graduate?':
    'Bạn muốn làm gì sau khi tốt nghiệp?',
  'A sentence or two is plenty.': 'Một hai câu là đủ.',
  'Your strategy report uses this to judge which direction fits you best.':
    'Báo cáo chiến lược dùng thông tin này để chọn hướng đi phù hợp nhất với bạn.',
  'Why this subject?': 'Vì sao bạn chọn ngành này?',
  'What got you interested, and what keeps you interested.':
    'Điều gì khiến bạn bắt đầu quan tâm, và điều gì giữ bạn ở lại với nó.',
  'Your personal report builds its "driving force" section from this.':
    'Báo cáo cá nhân sẽ dựng phần “động lực” của bạn từ câu trả lời này.',
  'How will your study be funded?': 'Việc học của bạn sẽ được tài trợ thế nào?',
  'Annual tuition budget': 'Ngân sách học phí hằng năm',
  'Annual tuition budget (USD)': 'Ngân sách học phí hằng năm (USD)',
  'Converted at {rate} VND to 1 USD.': 'Quy đổi theo tỷ giá {rate} VND / 1 USD.',
  'Autumn / Fall 2026': 'Kỳ mùa thu 2026',
  'Spring 2027': 'Kỳ mùa xuân 2027',
  'Autumn / Fall 2027': 'Kỳ mùa thu 2027',
  'Spring 2028': 'Kỳ mùa xuân 2028',
  'Autumn / Fall 2028': 'Kỳ mùa thu 2028',
  'Later than 2028': 'Sau năm 2028',
  'High school': 'Trung học phổ thông',
  '2 - Year Associate Degree': 'Chương trình cao đẳng 2 năm',
  '4 - Year Bachelor’s Degree': 'Chương trình cử nhân 4 năm',
  'Master’s Degree': 'Bằng thạc sĩ',
  Doctorate: 'Bằng tiến sĩ',
  'Master or Post-Graduate Certificate': 'Thạc sĩ hoặc chứng chỉ sau đại học',
  'Bachelor’s Degree': 'Bằng cử nhân',
  'College Diploma / Certificate': 'Bằng cao đẳng / Chứng chỉ',
  'Advanced study after your undergraduate degree.':
    'Chương trình học nâng cao sau khi hoàn thành bậc đại học.',
  'An undergraduate degree, typically lasting 3–4 years.':
    'Chương trình cử nhân, thường kéo dài từ 3 đến 4 năm.',
  'Vocational or academic qualifications at college level.':
    'Bằng cấp nghề hoặc học thuật ở bậc cao đẳng.',
  'Personal savings or parents': 'Tiền tiết kiệm cá nhân hoặc gia đình',
  'Student loan': 'Khoản vay sinh viên',
  'Employer or sponsor': 'Nhà tuyển dụng hoặc đơn vị tài trợ',
  'Not decided yet': 'Chưa quyết định',
  'Autumn / Fall {year}': 'Mùa thu {year}',
  'Spring {year}': 'Mùa xuân {year}',
  'September – December {year}': 'Tháng 9 – Tháng 12 năm {year}',
  'January – April {year}': 'Tháng 1 – Tháng 4 năm {year}',
  'Later than {year}': 'Sau năm {year}',
  'Starting from {year} or later': 'Bắt đầu từ năm {year} trở đi',
  'I’m still exploring my options': 'Tôi vẫn đang tìm hiểu các lựa chọn',
  'Save {name} to your list': 'Lưu {name} vào danh sách của bạn',
  'Remove {name} from your list': 'Xóa {name} khỏi danh sách của bạn',
  'Add {name} to my portal': 'Thêm {name} vào Trang lưu',
  'Remove {name} from my portal': 'Xóa {name} khỏi Trang lưu',
  'Add to my portal': 'Thêm vào Trang lưu',
  'Added to my portal': 'Đã thêm vào Trang lưu',
  Design: 'Thiết kế',
  'What is your intended level of study?': 'Bạn dự định học ở bậc nào?',
  'Intended level of study': 'Bậc học dự định',
  'Select a funding source': 'Chọn nguồn tài trợ',
  'Select a band': 'Chọn khoảng điểm',

  // Candidate information — Q9 to Q12. ("Scholarship" and "Complete" are
  // already above; both funding labels and the CTA reuse those entries.)
  'Family funds or your own savings will cover most of the cost.':
    'Tiền của gia đình hoặc tiền tiết kiệm của bạn sẽ chi trả phần lớn chi phí.',
  'You are hoping to fund some or all of it with a scholarship.':
    'Bạn hy vọng học bổng sẽ chi trả một phần hoặc toàn bộ chi phí.',
  'A government or private loan you will repay after graduating.':
    'Khoản vay của nhà nước hoặc tư nhân mà bạn sẽ trả sau khi tốt nghiệp.',
  'A company, government body or organisation is paying.':
    'Một công ty, cơ quan nhà nước hoặc tổ chức sẽ chi trả.',
  'You are still working it out — that is a normal answer here.':
    'Bạn vẫn đang cân nhắc — đó là câu trả lời hoàn toàn bình thường.',
  'You can change this later — it only shapes which scholarships we look for.':
    'Bạn có thể thay đổi sau — thông tin này chỉ định hướng việc tìm học bổng.',
  'Why are you interested in these subjects?': 'Vì sao bạn quan tâm đến những ngành này?',
  'Answer for one subject or all of them — your personal report builds its “driving force” section from this.':
    'Trả lời cho một ngành hoặc tất cả — báo cáo cá nhân sẽ dựng phần “động lực” từ câu trả lời này.',
  'Tuition only, in your own currency — living costs are not included.':
    'Chỉ tính học phí, theo đơn vị tiền tệ của bạn — chưa gồm chi phí sinh hoạt.',
  'What you told us before': 'Điều bạn đã cho chúng tôi biết trước đó',
  'Your subject': 'Ngành của bạn',

  // Q9 / Q10 — the written answers and their idea helper.
  'We could not come up with ideas.': 'Chúng tôi chưa nghĩ ra gợi ý nào.',
  'Example: I want to work in sustainable energy and help build a cleaner future.':
    'Ví dụ: Tôi muốn làm việc trong lĩnh vực năng lượng bền vững và góp phần xây dựng một tương lai sạch hơn.',
  'Here are some things to think about:': 'Một vài điều để bạn suy nghĩ:',
  'What kind of work excites you?': 'Loại công việc nào khiến bạn hào hứng?',
  'What impact do you want to make?': 'Bạn muốn tạo ra tác động gì?',
  'Where do you see yourself in the future?': 'Bạn hình dung mình ở đâu trong tương lai?',
  'Generate ideas with AI': 'Gợi ý ý tưởng bằng AI',
  'Thinking…': 'Đang nghĩ…',
  'Pick one to start from': 'Chọn một gợi ý để bắt đầu',
  'It goes straight into the box — edit it however you like.':
    'Gợi ý sẽ được đưa thẳng vào ô trả lời — bạn sửa lại thế nào cũng được.',
  'Your answer doesn’t need to be perfect — this can be short and you can always change it later.':
    'Câu trả lời không cần hoàn hảo — bạn có thể viết ngắn và sửa lại bất cứ lúc nào.',
  'Choose your subjects first and we’ll ask about them here.':
    'Hãy chọn ngành học trước, chúng tôi sẽ hỏi về chúng ở đây.',
  'Choose a subject to tell us more about.': 'Chọn một ngành để kể thêm cho chúng tôi.',
  'Your subjects': 'Các ngành của bạn',
  answered: 'đã trả lời',
  'Why are you interested in {subject}?': 'Vì sao bạn quan tâm đến {subject}?',
  'Example: I first became interested in {subject} when I started building my own projects and realised I loved solving real problems.':
    'Ví dụ: Tôi bắt đầu quan tâm đến {subject} khi tự làm những dự án của riêng mình và nhận ra mình thích giải quyết các vấn đề thực tế.',
  'Need a nudge? Consider these:': 'Cần gợi ý? Hãy thử nghĩ về:',
  'What first interested you in {subject}?': 'Điều gì khiến bạn quan tâm đến {subject} đầu tiên?',
  'What parts of {subject} excite you most?':
    'Phần nào của {subject} khiến bạn hào hứng nhất?',
  'What would you like to do with {subject}?': 'Bạn muốn làm gì với {subject}?',
  'You only need to answer for one subject — you can add more later if you want.':
    'Bạn chỉ cần trả lời cho một ngành — có thể bổ sung thêm sau nếu muốn.',

  // Q12 — the multi-currency tuition budget.
  'Which currency do you think in?': 'Bạn quen tính theo đơn vị tiền tệ nào?',
  'Other currency': 'Đơn vị tiền tệ khác',
  '{amount} and above per year': 'Từ {amount} trở lên mỗi năm',
  '{range} per year': '{range} mỗi năm',
  'Roughly {conversions}': 'Tương đương khoảng {conversions}',
  'Conversions are approximate and are not saved — we store the range in your own currency.':
    'Số quy đổi chỉ mang tính tham khảo và không được lưu — chúng tôi lưu khoảng ngân sách theo đơn vị tiền tệ của bạn.',
  'This is tuition only. Living costs, flights and visa fees are not included — we show those separately on each course.':
    'Đây chỉ là học phí. Chi phí sinh hoạt, vé máy bay và lệ phí visa không bao gồm — chúng tôi hiển thị riêng ở từng khóa học.',
  'AI Assessment | GlowBal': 'Đánh giá AI | GlowBal',
  'Application Strategy | GlowBal': 'Chiến lược ứng tuyển | GlowBal',
  'Statement writer | GlowBal': 'Công cụ viết bài luận | GlowBal',
  'Back to strategy': 'Quay lại chiến lược',
  'Your AI strategist is ready.': 'Chiến lược gia AI của bạn đã sẵn sàng.',
  'Recommendations are generated from your Applicant Analysis and Course Match Analysis, ranked by priority. Ask for a re-analysis any time you&rsquo;ve made progress.': 'Đề xuất được tạo từ Phân tích ứng viên và Phân tích mức độ phù hợp khóa học, sau đó xếp hạng theo mức ưu tiên. Hãy yêu cầu phân tích lại bất cứ khi nào bạn có tiến bộ.',
  'Recommendations are generated from your Applicant Analysis and Course Match Analysis, ranked by priority. Ask for a re-analysis any time you’ve made progress.': 'Đề xuất được tạo từ Phân tích ứng viên và Phân tích mức độ phù hợp khóa học, sau đó xếp hạng theo mức ưu tiên. Hãy yêu cầu phân tích lại bất cứ khi nào bạn có tiến bộ.',
  'Generate My Strategy': 'Tạo chiến lược của tôi',
  'Estimated time:': 'Thời gian ước tính:',
  'How much it could improve admission chances': 'Mức độ có thể cải thiện cơ hội trúng tuyển',
  'points toward this category&rsquo;s match score.': 'điểm vào mức phù hợp của danh mục này.',
  'points toward this category’s match score.': 'điểm vào mức phù hợp của danh mục này.',
  'What to submit': 'Cần nộp gì',
  'Suggested next step': 'Bước tiếp theo đề xuất',
  'Task content': 'Nội dung nhiệm vụ',
  'Supporting files': 'Tệp hỗ trợ',
  Tips: 'Mẹo',
  'Loading saved universities': 'Đang tải các trường đã lưu',
  'Sign in to keep track of the courses you are applying to.': 'Đăng nhập để theo dõi các khóa học bạn đang ứng tuyển.',
  'Loading applications': 'Đang tải hồ sơ ứng tuyển',
  'GlowBal&rsquo;s AI is reading the course page and building your checklist…': 'AI của GlowBal đang đọc trang khóa học và xây dựng danh sách kiểm tra cho bạn…',
  List: 'Danh sách',
  'Application Progress | GlowBal': 'Tiến độ ứng tuyển | GlowBal',
  'Harvard Style': 'Kiểu Harvard',
  'Build from scratch': 'Xây dựng từ đầu',
  'We sent a confirmation link to': 'Chúng tôi đã gửi liên kết xác nhận tới',
  'e.g. CS in the US, Business in the UK, anywhere in Europe…': 'ví dụ: Khoa học máy tính ở Mỹ, Kinh doanh ở Anh, hoặc bất kỳ nơi nào tại châu Âu…',
  'GLOWBAL — Launching soon': 'GLOWBAL — Sắp ra mắt',
  'Launching soon': 'Sắp ra mắt',
  'We&rsquo;re building something new': 'Chúng tôi đang xây dựng điều mới mẻ',
  'We’re building something new': 'Chúng tôi đang xây dựng điều mới mẻ',
  'GLOWBAL is offline for a short redesign. Leave your email and we&rsquo;ll let you know the moment we&rsquo;re back.': 'GLOWBAL tạm ngoại tuyến để cải tiến trong thời gian ngắn. Hãy để lại email, chúng tôi sẽ báo cho bạn ngay khi quay lại.',
  'GLOWBAL is offline for a short redesign. Leave your email and we’ll let you know the moment we’re back.': 'GLOWBAL tạm ngoại tuyến để cải tiến trong thời gian ngắn. Hãy để lại email, chúng tôi sẽ báo cho bạn ngay khi quay lại.',
  'GLOWBAL team? Enter your access code': 'Bạn thuộc đội ngũ GLOWBAL? Nhập mã truy cập',
  'Loading ambassadors…': 'Đang tải đại sứ…',
  'Add an ambassador': 'Thêm đại sứ',
  'link is generated for each ambassador to share.': 'liên kết được tạo cho mỗi đại sứ để chia sẻ.',
  Ambassador: 'Đại sứ',
  Visits: 'Lượt truy cập',
  'Last visit': 'Lượt truy cập gần nhất',
  'No ambassadors yet. Add one above to get a shareable link.': 'Chưa có đại sứ nào. Hãy thêm một người ở trên để nhận liên kết chia sẻ.',
  paused: 'tạm dừng',
  'Sign-ups by day (last 30 days)': 'Lượt đăng ký theo ngày (30 ngày qua)',
  'No sign-ups through your links yet.': 'Chưa có lượt đăng ký nào qua liên kết của bạn.',
  'sign-up': 'đăng ký',
  Ambassadors: 'Đại sứ',
  'Create a share link for each ambassador and track how much traffic each one drives.': 'Tạo liên kết chia sẻ cho từng đại sứ và theo dõi lượng truy cập họ mang lại.',
  'Advisor dashboard': 'Bảng điều khiển cố vấn',
  'Manage your sessions, pricing, and availability in one place.': 'Quản lý buổi tư vấn, mức phí và lịch rảnh ở một nơi.',
  'sessions.': 'buổi.',
  'Transfer reference:': 'Mã tham chiếu chuyển khoản:',
  'My bookings': 'Lịch đặt của tôi',
  'Track your booked sessions with Achievers.': 'Theo dõi các buổi đã đặt với Achievers.',
  'How was your session?': 'Buổi tư vấn của bạn thế nào?',
  'Share your experience...': 'Chia sẻ trải nghiệm của bạn…',
  'Something went off-orbit': 'Đã xảy ra sự cố ngoài dự kiến',
  'An unexpected error happened on this page. Try again, and if the issue persists, head back to the home page.': 'Đã xảy ra lỗi bất ngờ trên trang này. Hãy thử lại; nếu lỗi vẫn tiếp diễn, hãy quay về trang chủ.',
  'Bug report sent!': 'Đã gửi báo cáo lỗi!',
  'Thanks for helping us improve Glowbal. We&apos;ll look into it.': 'Cảm ơn bạn đã giúp Glowbal cải thiện. Chúng tôi sẽ xem xét.',
  'Thanks for helping us improve Glowbal. We’ll look into it.': 'Cảm ơn bạn đã giúp Glowbal cải thiện. Chúng tôi sẽ xem xét.',
  'Submit another report': 'Gửi báo cáo khác',
  'Found a bug? Let us know so we can fix it.': 'Bạn phát hiện lỗi? Hãy cho chúng tôi biết để sửa lỗi.',
  'Steps to reproduce': 'Các bước tái hiện',
  'Expected result': 'Kết quả mong đợi',
  'What should have happened?': 'Điều đáng lẽ phải xảy ra?',
  'Actual result': 'Kết quả thực tế',
  'What happened instead?': 'Thực tế đã xảy ra điều gì?',
  Screenshot: 'Ảnh chụp màn hình',
  'Three stages,': 'Ba giai đoạn,',
  'Start with universities': 'Bắt đầu với các trường đại học',
  steps: 'bước',
  'Browse universities first': 'Trước tiên, hãy xem các trường đại học',
  'Help the next generation of students': 'Hỗ trợ thế hệ sinh viên tiếp theo',
  'Share your experience, set your hourly rate, and earn money helping applicants get into your university.': 'Chia sẻ kinh nghiệm, đặt mức phí theo giờ và kiếm thu nhập khi giúp ứng viên vào được trường của bạn.',
  'Thanks for applying. Our team reviews advisor applications within 48 hours and we&rsquo;ll email you with the outcome. Meanwhile you can pre-fill your calendar from the dashboard.': 'Cảm ơn bạn đã đăng ký. Đội ngũ của chúng tôi xem xét hồ sơ cố vấn trong vòng 48 giờ và sẽ gửi kết quả qua email. Trong lúc chờ, bạn có thể điền trước lịch từ bảng điều khiển.',
  'Thanks for applying. Our team reviews advisor applications within 48 hours and we’ll email you with the outcome. Meanwhile you can pre-fill your calendar from the dashboard.': 'Cảm ơn bạn đã đăng ký. Đội ngũ của chúng tôi xem xét hồ sơ cố vấn trong vòng 48 giờ và sẽ gửi kết quả qua email. Trong lúc chờ, bạn có thể điền trước lịch từ bảng điều khiển.',
  'Go to my advisor dashboard': 'Đến bảng điều khiển cố vấn',
  'Browse other advisors': 'Xem các cố vấn khác',
  'Find an advisor | GlowBal': 'Tìm cố vấn | GlowBal',
  'This advisor hasn&rsquo;t published availability for the next 90 days.': 'Cố vấn này chưa công bố lịch rảnh trong 90 ngày tới.',
  "e.g. I'm applying for Computer Science and would like advice on my personal statement.": 'ví dụ: Tôi đang ứng tuyển ngành Khoa học máy tính và muốn được tư vấn về bài luận cá nhân.',
  'Session (': 'Buổi tư vấn (',
  'This advisor hasn&rsquo;t set a session price. Browse the directory for advisors who are taking bookings.': 'Cố vấn này chưa đặt giá buổi tư vấn. Hãy xem danh bạ các cố vấn đang nhận lịch đặt.',
  'This advisor hasn’t set a session price. Browse the directory for advisors who are taking bookings.': 'Cố vấn này chưa đặt giá buổi tư vấn. Hãy xem danh bạ các cố vấn đang nhận lịch đặt.',
  'Advisor not found | GlowBal': 'Không tìm thấy cố vấn | GlowBal',
  'Choose your subject | GlowBal': 'Chọn môn học | GlowBal',
  'Collected from this university&rsquo;s own course catalogue. Check the official page before you apply.': 'Thông tin được lấy từ danh mục khóa học của chính trường đại học này. Hãy kiểm tra trang chính thức trước khi ứng tuyển.',
  'Back to my universities': 'Quay lại các trường của tôi',
  'QS #': 'QS #',
  'Application progress': 'Tiến độ ứng tuyển',
  tasks: 'nhiệm vụ',
  '💡 Tips': '💡 Mẹo',
  'No tasks generated yet. Try removing and re-adding this university.': 'Chưa có nhiệm vụ nào được tạo. Hãy thử xóa rồi thêm lại trường đại học này.',
  'AI Statement Writer': 'Công cụ viết bài luận AI',
  'GLOWBAL News & Guides': 'Tin tức & hướng dẫn GLOWBAL',
  'Glowbal News': 'Tin tức GlowBal',
  'More actions': 'Thao tác khác',
  'Unsubscribe from Newsletter': 'Hủy đăng ký nhận bản tin',
  'We&rsquo;re sorry to see you go. You can unsubscribe from our newsletter below.': 'Rất tiếc khi bạn rời đi. Bạn có thể hủy đăng ký nhận bản tin bên dưới.',
  'We’re sorry to see you go. You can unsubscribe from our newsletter below.': 'Rất tiếc khi bạn rời đi. Bạn có thể hủy đăng ký nhận bản tin bên dưới.',
  'You won&rsquo;t receive any more emails from us.': 'Bạn sẽ không nhận thêm email nào từ chúng tôi.',
  'You won’t receive any more emails from us.': 'Bạn sẽ không nhận thêm email nào từ chúng tôi.',
  'Email Address': 'Địa chỉ email',
  'If you&rsquo;re having trouble unsubscribing, please contact us at': 'Nếu bạn gặp khó khăn khi hủy đăng ký, hãy liên hệ với chúng tôi tại',
  'If you’re having trouble unsubscribing, please contact us at': 'Nếu bạn gặp khó khăn khi hủy đăng ký, hãy liên hệ với chúng tôi tại',
  'Lost in space': 'Lạc giữa không gian',
  'Browse universities': 'Xem các trường đại học',
  'Anything else?': 'Còn điều gì khác không?',
  'Extracurricular certificates, degrees, or achievements we should take into account.': 'Các chứng chỉ ngoại khóa, bằng cấp hoặc thành tích khác mà chúng tôi nên xem xét.',
  'Sharing Zone': 'Khu vực chia sẻ',
  'What&rsquo;s on your cute mind? Tell us': 'Bạn đang nghĩ gì? Hãy kể cho chúng tôi',
  'What’s on your cute mind? Tell us': 'Bạn đang nghĩ gì? Hãy kể cho chúng tôi',
  'anything you would love us to include in our recommendations': 'bất cứ điều gì bạn muốn chúng tôi đưa vào đề xuất',
  '. We&rsquo;re all ears!': '. Chúng tôi luôn lắng nghe!',
  '. We’re all ears!': '. Chúng tôi luôn lắng nghe!',
  'Save note': 'Lưu ghi chú',
  'Last step': 'Bước cuối',
  'before we reveal your best match, are there anything else you would like to tell us?': 'trước khi tiết lộ lựa chọn phù hợp nhất, bạn còn điều gì muốn cho chúng tôi biết không?',
  'details you': 'thông tin bạn',
  recommendations: 'đề xuất',
  'Cambridge International (IGCSE / AS & A Level)': 'Cambridge International (IGCSE / AS & A Level)',
  'AP + US High School Diploma': 'AP + Bằng tốt nghiệp trung học Mỹ',
  'IELTS Academic': 'IELTS Academic',
  SAT: 'SAT',
  'AP Exams': 'Kỳ thi AP',
  'GCSE / IGCSE': 'GCSE / IGCSE',
  'It&rsquo;s simple!': 'Thật đơn giản!',
  'It’s simple!': 'Thật đơn giản!',
  'Let us know more about you. Then we will match you with your best global opportunity!': 'Hãy cho chúng tôi biết thêm về bạn. Sau đó, chúng tôi sẽ kết nối bạn với cơ hội toàn cầu phù hợp nhất!',
  countries: 'quốc gia',
  selected: 'đã chọn',
  'selected in this area': 'đã chọn trong khu vực này',
  'South America': 'Nam Mỹ',
  Asia: 'Châu Á',
  'Click any country to select or deselect it': 'Nhấp vào quốc gia bất kỳ để chọn hoặc bỏ chọn',
  'countries selected total': 'tổng số quốc gia đã chọn',
  'GlowBal | Find Universities, Scholarships & Study Abroad Support': 'GlowBal | Tìm trường, học bổng & hỗ trợ du học',
  'GlowBal Plus | Unlock your full scholarship plan': 'GlowBal Plus | Mở khóa kế hoạch học bổng đầy đủ',
  'You&rsquo;re on GlowBal Plus': 'Bạn đang sử dụng GlowBal Plus',
  'Choose your currency above — you&rsquo;ll be charged in the currency you select; conversions from VND are approximate. GlowBal helps you discover opportunities and prepare stronger applications; it does not guarantee scholarship outcomes.': 'Chọn đơn vị tiền tệ ở trên — bạn sẽ được tính phí bằng loại tiền đã chọn; quy đổi từ VND chỉ mang tính gần đúng. GlowBal giúp bạn khám phá cơ hội và chuẩn bị hồ sơ tốt hơn, nhưng không đảm bảo kết quả học bổng.',
  'No account yet? Selecting a plan signs you up first — it&rsquo;s free to start.': 'Chưa có tài khoản? Chọn gói sẽ đăng ký tài khoản trước — bắt đầu hoàn toàn miễn phí.',
  'Start free, upgrade when you&rsquo;re ready. Here&rsquo;s exactly what each option includes.': 'Bắt đầu miễn phí, nâng cấp khi bạn sẵn sàng. Dưới đây là chính xác những gì mỗi lựa chọn bao gồm.',
  'We couldn&rsquo;t confirm this payment automatically yet. If you completed checkout and Plus doesn&rsquo;t appear shortly, contact': 'Chúng tôi chưa thể tự động xác nhận khoản thanh toán này. Nếu bạn đã hoàn tất thanh toán mà Plus chưa xuất hiện, hãy liên hệ',
  'GlowBal helps students find universities, discover scholarships, and build application strategies. This policy explains what information we collect, why we collect it, and the choices you have.': 'GlowBal giúp sinh viên tìm trường đại học, khám phá học bổng và xây dựng chiến lược ứng tuyển. Chính sách này giải thích thông tin chúng tôi thu thập, lý do thu thập và các lựa chọn của bạn.',
  'Account details you provide: name, email, phone number, and date of birth.': 'Thông tin tài khoản bạn cung cấp: tên, email, số điện thoại và ngày sinh.',
  'Profile information: intended study level, target country, subject, current school, and any documents you upload.': 'Thông tin hồ sơ: bậc học dự định, quốc gia mục tiêu, môn học, trường hiện tại và mọi tài liệu bạn tải lên.',
  'Activity such as universities you view, scholarships you save, and AI strategies you generate.': 'Hoạt động như các trường bạn xem, học bổng bạn lưu và chiến lược AI bạn tạo.',
  'Basic technical data (device, browser, and usage analytics) to keep the service reliable.': 'Dữ liệu kỹ thuật cơ bản (thiết bị, trình duyệt và phân tích sử dụng) để duy trì dịch vụ ổn định.',
  'How we use your information': 'Cách chúng tôi sử dụng thông tin của bạn',
  'To show relevant universities and scholarships and save your plan.': 'Hiển thị các trường và học bổng phù hợp, đồng thời lưu kế hoạch của bạn.',
  'To generate personalised AI application strategies.': 'Tạo chiến lược ứng tuyển AI được cá nhân hóa.',
  'To send updates you ask for, such as scholarship reminders.': 'Gửi các cập nhật bạn yêu cầu, chẳng hạn lời nhắc học bổng.',
  'To improve and secure the platform.': 'Cải thiện và bảo mật nền tảng.',
  Sharing: 'Chia sẻ',
  'We do not sell your personal information. We share data only with service providers that help us operate GlowBal (for example, hosting, email, and payment processing) under appropriate safeguards, or where required by law.': 'Chúng tôi không bán thông tin cá nhân của bạn. Chúng tôi chỉ chia sẻ dữ liệu với các nhà cung cấp dịch vụ hỗ trợ vận hành GlowBal (ví dụ lưu trữ, email và xử lý thanh toán) cùng các biện pháp bảo vệ phù hợp, hoặc khi pháp luật yêu cầu.',
  'Your choices': 'Lựa chọn của bạn',
  'You can access, update, or delete your profile information at any time from your account settings, or by contacting us. You can unsubscribe from non-essential emails using the link in any message.': 'Bạn có thể truy cập, cập nhật hoặc xóa thông tin hồ sơ bất cứ lúc nào trong cài đặt tài khoản hoặc liên hệ với chúng tôi. Bạn có thể hủy đăng ký email không thiết yếu bằng liên kết trong bất kỳ thư nào.',
  'Questions about privacy? Email us at': 'Có câu hỏi về quyền riêng tư? Email cho chúng tôi tại',
  'Where you study now': 'Bạn đang học ở đâu',
  'Select level…': 'Chọn bậc học…',
  'e.g. Hanoi Amsterdam High School': 'ví dụ: Trường THPT chuyên Hà Nội - Amsterdam',
  'Select qualification…': 'Chọn bằng cấp…',
  'e.g. A*AA, GPA 3.8, 38 IB points': 'ví dụ: A*AA, GPA 3.8, 38 điểm IB',
  'Curriculum and grades': 'Chương trình học và điểm số',
  'Grading scale:': 'Thang điểm:',
  'This saved curriculum is no longer in the current test. It will be preserved unless you remove it.': 'Chương trình học đã lưu này không còn trong bài kiểm tra hiện tại. Chương trình sẽ được giữ lại trừ khi bạn xóa.',
  'Your academic story': 'Câu chuyện học tập của bạn',
  'Free text and subjects. This is what the AI reads when it scores how well you match a course.':
    'Văn bản tự do và các môn học. Đây là thông tin AI đọc khi đánh giá mức độ phù hợp của bạn với một khóa học.',
  'Academic background summary': 'Tóm tắt nền tảng học thuật',
  'Target subjects / fields of study': 'Môn học / lĩnh vực học tập mục tiêu',
  'Briefly describe your academic history and any notable achievements…': 'Mô tả ngắn gọn quá trình học tập và thành tích nổi bật của bạn…',
  'e.g. Computer Science, Engineering, Business…': 'ví dụ: Khoa học máy tính, Kỹ thuật, Kinh doanh…',
  'Select a subject or field…': 'Chọn một môn học hoặc lĩnh vực…',
  'Choose from the list. You can add more than one.': 'Chọn từ danh sách. Bạn có thể thêm nhiều lựa chọn.',
  'Other subject / field of study': 'Môn học / lĩnh vực học tập khác',
  'Enter another subject or field…': 'Nhập môn học hoặc lĩnh vực khác…',
  'Remove {subject}': 'Xóa {subject}',
  'e.g. National Science Olympiad finalist': 'ví dụ: lọt vào chung kết Olympic Khoa học Quốc gia',
  'What it was, and what you did…': 'Đó là gì và bạn đã làm gì…',
  Skills: 'Kỹ năng',
  'e.g. Python, Public speaking, Research…': 'ví dụ: Python, Thuyết trình, Nghiên cứu…',
  'Select test…': 'Chọn bài thi…',
  'Sub-scores (optional)': 'Điểm thành phần (không bắt buộc)',
  'Standardized tests': 'Bài thi chuẩn hóa',
  'Test scores': 'Điểm bài thi',
  Plus: 'Plus',
  'more in your documents': 'thêm trong tài liệu của bạn',
  'Stored privately in your profile. GlowBal reads it to score how well you match a course.': 'Được lưu riêng tư trong hồ sơ của bạn. GlowBal đọc tài liệu để đánh giá mức độ phù hợp với khóa học.',
  'e.g. Software Engineering Intern': 'ví dụ: Thực tập sinh Kỹ thuật phần mềm',
  'Select type…': 'Chọn loại…',
  'Key responsibilities and achievements…': 'Trách nhiệm chính và thành tích…',
  'Loading scholarships': 'Đang tải học bổng',
  'Subject-specific': 'Theo môn học',
  'Country-specific': 'Theo quốc gia',
  Diversity: 'Đa dạng',
  Sports: 'Thể thao',
  'AI-powered scholarship search matched to your course applications. We find funding you&apos;re eligible for — including exclusive opportunities.': 'Tìm kiếm học bổng bằng AI phù hợp với các hồ sơ khóa học của bạn. Chúng tôi tìm nguồn tài trợ bạn đủ điều kiện — bao gồm cả cơ hội độc quyền.',
  'AI-powered scholarship search matched to your course applications. We find funding you’re eligible for — including exclusive opportunities.': 'Tìm kiếm học bổng bằng AI phù hợp với các hồ sơ khóa học của bạn. Chúng tôi tìm nguồn tài trợ bạn đủ điều kiện — bao gồm cả cơ hội độc quyền.',
  'Your courses': 'Các khóa học của bạn',
  'Select which applications to find scholarships for (or leave blank to search all)': 'Chọn hồ sơ cần tìm học bổng (hoặc để trống để tìm tất cả)',
  'Searching with AI…': 'Đang tìm kiếm bằng AI…',
  'Failed to search for scholarships': 'Không thể tìm kiếm học bổng',
  'Search again': 'Tìm lại',
  'course selected': 'khóa học đã chọn',
  'courses selected': 'khóa học đã chọn',
  course: 'khóa học',
  'Previously found scholarships': 'Học bổng đã tìm thấy trước đây',
  'Extracted when you imported your courses': 'Được trích xuất khi bạn nhập các khóa học',
  'Sort:': 'Sắp xếp:',
  'Best match': 'Phù hợp nhất',
  'Easiest first': 'Dễ nhất trước',
  'No scholarships match this filter.': 'Không có học bổng nào phù hợp với bộ lọc này.',
  'No scholarships found for your current applications. Try importing more courses or updating your profile.': 'Không tìm thấy học bổng cho các hồ sơ hiện tại. Hãy thử nhập thêm khóa học hoặc cập nhật hồ sơ.',
  'University scholarship': 'Học bổng của trường đại học',
  'No courses imported yet': 'Chưa nhập khóa học nào',
  'Import a course on the Apply page first, then come back here to find scholarships matched to your applications.': 'Trước tiên hãy nhập khóa học trên trang Ứng tuyển, sau đó quay lại đây để tìm học bổng phù hợp với hồ sơ của bạn.',
  'Loading course matches': 'Đang tải các kết quả phù hợp khóa học',
  'Business & economics': 'Kinh doanh & kinh tế',
  'Arts & humanities': 'Nghệ thuật & nhân văn',
  'matched on this page': 'kết quả phù hợp trên trang này',
  'Search by scholarship name': 'Tìm theo tên học bổng',
  'Select major': 'Chọn ngành học',
  'Choose by criteria': 'Chọn theo tiêu chí',
  'Matched to your saved universities on this page': 'Phù hợp với các trường đã lưu trên trang này',
  'Terms of Service | GlowBal': 'Điều khoản dịch vụ | GlowBal',
  'Terms of Service': 'Điều khoản dịch vụ',
  'These terms govern your use of GlowBal. By creating an account or using the platform, you agree to them. Please read them carefully.': 'Các điều khoản này chi phối việc bạn sử dụng GlowBal. Khi tạo tài khoản hoặc sử dụng nền tảng, bạn đồng ý với các điều khoản này. Vui lòng đọc kỹ.',
  'Using GlowBal': 'Sử dụng GlowBal',
  Accounts: 'Tài khoản',
  'You are responsible for keeping your account credentials secure and for activity that happens under your account. You must be old enough to consent to use the service in your country.': 'Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và hoạt động diễn ra dưới tài khoản của mình. Bạn phải đủ tuổi đồng ý sử dụng dịch vụ tại quốc gia của mình.',
  'Free and Plus plans': 'Gói miễn phí và Plus',
  'No guarantee of admission or funding': 'Không đảm bảo trúng tuyển hoặc tài trợ',
  'GlowBal helps you discover opportunities and prepare stronger applications, but we do not guarantee admission or scholarship outcomes. Final decisions are made by universities and scholarship providers.': 'GlowBal giúp bạn khám phá cơ hội và chuẩn bị hồ sơ tốt hơn, nhưng không đảm bảo kết quả trúng tuyển hoặc học bổng. Quyết định cuối cùng thuộc về trường đại học và đơn vị cấp học bổng.',
  'Questions about these terms? Email us at': 'Có câu hỏi về các điều khoản này? Email cho chúng tôi tại',
  'Find the university that’s right for you': 'Tìm trường đại học phù hợp với bạn',
  Financials: 'Tài chính',
  'Campus Life': 'Đời sống khuôn viên',
  'SOP fit': 'Mức phù hợp bài luận SOP',
  'VinUniversity logo': 'Logo VinUniversity',
  'Strategic partners': 'Đối tác chiến lược',
  'Talk to a VinUni advisor': 'Trao đổi với cố vấn VinUni',
  'to see your personal match score and save VinUni to your shortlist.': 'để xem điểm phù hợp cá nhân và lưu VinUni vào danh sách rút gọn.',
  'Strengths from the Glowbal database': 'Thế mạnh từ cơ sở dữ liệu GlowBal',
  Facilities: 'Cơ sở vật chất',
  'Tuition, scholarships & financial aid': 'Học phí, học bổng & hỗ trợ tài chính',
  'Base scholarships (merit-based)': 'Học bổng cơ bản (dựa trên thành tích)',
  'Special & cumulative scholarships': 'Học bổng đặc biệt & cộng dồn',
  'Maintaining your scholarship:': 'Duy trì học bổng:',
  'On-campus jobs': 'Việc làm trong khuôn viên',
  'We&apos;re sorry to see you go. You can unsubscribe from our newsletter below.': 'Rất tiếc khi bạn rời đi. Bạn có thể hủy đăng ký nhận bản tin bên dưới.',
  'You won&apos;t receive any more emails from us.': 'Bạn sẽ không nhận thêm email nào từ chúng tôi.',
  'If you&apos;re having trouble unsubscribing, please contact us at': 'Nếu bạn gặp khó khăn khi hủy đăng ký, hãy liên hệ với chúng tôi tại',
  'What&apos;s on your cute mind? Tell us': 'Bạn đang nghĩ gì? Hãy kể cho chúng tôi',
  '. We&apos;re all ears!': '. Chúng tôi luôn lắng nghe!',
  'It&apos;s simple!': 'Thật đơn giản!',
  'What do you want to achieve through higher education? What are your long-term ambitions?…': 'Bạn muốn đạt được gì qua giáo dục đại học? Tham vọng dài hạn của bạn là gì?…',
  'e.g. Software Engineer, Researcher…': 'ví dụ: Kỹ sư phần mềm, Nhà nghiên cứu…',
  'When you plan to start': 'Bạn dự định bắt đầu khi nào',
  'Account details': 'Thông tin tài khoản',
  'Update your name and email address.': 'Cập nhật họ tên và địa chỉ email của bạn.',
  'Changing your email requires confirmation.': 'Bạn cần xác nhận khi thay đổi email.',
  'Full name and email address are required.': 'Vui lòng nhập đầy đủ họ tên và địa chỉ email.',
  'Saved. Check your inbox to confirm your new email address.': 'Đã lưu. Hãy kiểm tra hộp thư để xác nhận địa chỉ email mới.',
  'Personal details': 'Thông tin cá nhân',
  'Select nationality…': 'Chọn quốc tịch…',
  'A few sentences about yourself…': 'Vài câu về bản thân bạn…',
  'e.g. London, Manchester': 'ví dụ: London, Manchester',
  'e.g. Computer Science, Law': 'ví dụ: Khoa học máy tính, Luật',
  'Budget and study mode': 'Ngân sách và hình thức học',
  'Select budget…': 'Chọn ngân sách…',
  'Select mode…': 'Chọn hình thức…',
  // The month picker that replaced the free-text "Target intake" box, and its
  // chrome in src/shared/ui/month-picker.tsx.
  'Select a month': 'Chọn tháng',
  'Select a year…': 'Chọn năm…',
  'The month you want to start studying.': 'Tháng bạn muốn bắt đầu nhập học.',
  'The admissions round you plan to apply in.': 'Đợt tuyển sinh bạn dự định nộp hồ sơ.',
  'Your saved answer is not a month. Pick one to replace it.':
    'Câu trả lời đã lưu không phải là một tháng. Hãy chọn một tháng để thay thế.',
  'Choose your target intake': 'Chọn kỳ nhập học mục tiêu',
  'Previous year': 'Năm trước',
  'Next year': 'Năm sau',
  'Clear': 'Xoá',
  'e.g. Large city campus, close to industry hubs': 'ví dụ: Khuôn viên thành phố lớn, gần các trung tâm ngành',
  'Select a support area…': 'Chọn lĩnh vực cần hỗ trợ…',
  'Earn while you study. Most teaching & research roles open from year 2 onwards.': 'Kiếm thu nhập trong khi học. Hầu hết vị trí giảng dạy và nghiên cứu mở từ năm thứ hai trở đi.',
  'Admission requirements & timeline': 'Yêu cầu tuyển sinh & mốc thời gian',
  'Academic baseline': 'Nền tảng học thuật',
  'Documents required': 'Tài liệu cần thiết',
  'Career outcomes & alumni': 'Kết quả nghề nghiệp & cựu sinh viên',
  'Recruiting partners': 'Đối tác tuyển dụng',
  'Internship & experience programs': 'Chương trình thực tập & trải nghiệm',
  'Post-graduation pathway:': 'Lộ trình sau tốt nghiệp:',
  'Location, housing & community': 'Địa điểm, nhà ở & cộng đồng',
  Housing: 'Nhà ở',
  'Clubs & community': 'Câu lạc bộ & cộng đồng',
  'Campus gallery': 'Thư viện ảnh khuôn viên',
  'Real photography coming soon — these are placeholder gradients.': 'Ảnh thực tế sẽ sớm có — hiện tại đây là các dải màu minh họa.',
  'Ready to start?': 'Sẵn sàng bắt đầu chưa?',
  'Apply to VinUniversity through Glowbal': 'Ứng tuyển VinUniversity qua GlowBal',
  'Build your VinUni application with advisors who studied there. Track your tasks, drafts and deadlines in one place — and save VinUni to your shortlist.': 'Xây dựng hồ sơ VinUni cùng các cố vấn từng học tại đó. Theo dõi nhiệm vụ, bản nháp và thời hạn ở một nơi — đồng thời lưu VinUni vào danh sách rút gọn.',
  'Apply on VinUni site': 'Ứng tuyển trên trang VinUni',
  'Book a VinUni advisor': 'Đặt lịch với cố vấn VinUni',
  '← Back to all universities': '← Quay lại tất cả trường đại học',
  'Strong fit': 'Rất phù hợp',
  Promising: 'Có triển vọng',
  'Needs work': 'Cần cải thiện',
  Misaligned: 'Chưa phù hợp',
  "Stress-test your SOP against VinUni's AACC rubric": 'Kiểm tra kỹ SOP theo tiêu chí AACC của VinUni',
  'Do you have a Statement of Purpose (SOP) yet?': 'Bạn đã có Bài luận mục tiêu (SOP) chưa?',
  'Either way, we’ve got you. We’ll either analyse your draft or coach you to write one.': 'Dù thế nào, chúng tôi vẫn hỗ trợ bạn. Chúng tôi có thể phân tích bản nháp hoặc hướng dẫn bạn viết bài.',
  'Yes — analyze it': 'Có — phân tích bài',
  'No — show me how to write one': 'Chưa — hướng dẫn tôi cách viết',
  'Sign in to analyze your SOP': 'Đăng nhập để phân tích SOP',
  'Analysis runs against your private account. Sign in to securely send your draft to the AACC reviewer.': 'Phân tích được thực hiện trong tài khoản riêng tư của bạn. Đăng nhập để gửi bản nháp an toàn cho chuyên gia đánh giá AACC.',
  'Sign in to continue': 'Đăng nhập để tiếp tục',
  'Paste your Statement of Purpose': 'Dán Bài luận mục tiêu của bạn',
  '+ characters': '+ ký tự',
  'Suggested structure': 'Cấu trúc đề xuất',
  'Drafted something already?': 'Bạn đã có bản nháp chưa?',
  'Change my answer': 'Thay đổi câu trả lời',
  'Writing prompts': 'Gợi ý viết',
  Examples: 'Ví dụ',
  'Common pitfalls': 'Lỗi thường gặp',
  'Indicators VinUni rewards': 'Tiêu chí VinUni đánh giá cao',
  'Top recommendations': 'Đề xuất hàng đầu',
  'Red flags to address': 'Điểm cảnh báo cần xử lý',
  'Book a VinUni advisor to deepen this': 'Đặt lịch với cố vấn VinUni để đào sâu nội dung này',
  'Analysis is AI-generated guidance, not an admissions decision. VinUni admissions reads the full application in context.': 'Phân tích là hướng dẫn do AI tạo ra, không phải quyết định tuyển sinh. Bộ phận tuyển sinh VinUni sẽ đọc toàn bộ hồ sơ trong bối cảnh đầy đủ.',
  'No data returned for this pillar.': 'Không có dữ liệu cho trụ cột này.',
  Gaps: 'Khoảng trống',
  'From your SOP': 'Từ SOP của bạn',
  'University not found | GlowBal': 'Không tìm thấy trường đại học | GlowBal',
  'Check out your favourite unis': 'Xem các trường yêu thích của bạn',
  'Why students choose': 'Vì sao sinh viên lựa chọn',
  'GlowBal&rsquo;s insider note': 'Ghi chú nội bộ của GlowBal',
  'GlowBal’s insider note': 'Ghi chú nội bộ của GlowBal',
  'Book a 1-1 session with a current student or alumnus for honest advice about your application and life on campus.': 'Đặt lịch 1-1 với sinh viên hiện tại hoặc cựu sinh viên để nhận lời khuyên chân thật về hồ sơ và cuộc sống trong khuôn viên.',
  'Ready to study at': 'Sẵn sàng học tại',
  'Find courses and start building your application with GlowBal&rsquo;s AI course picker.': 'Tìm khóa học và bắt đầu xây dựng hồ sơ với công cụ chọn khóa học AI của GlowBal.',
  'Find courses and start building your application with GlowBal’s AI course picker.': 'Tìm khóa học và bắt đầu xây dựng hồ sơ với công cụ chọn khóa học AI của GlowBal.',
  years: 'năm',
  'Find the university that&rsquo;s right for you': 'Tìm trường đại học phù hợp với bạn',
  'Built [what] for [who], resulting in [impact].': 'Đã xây dựng [điều gì] cho [ai], tạo ra [tác động].',
  Awards: 'Giải thưởng',
  'Core skills': 'Kỹ năng cốt lõi',
  Assessment: 'Đánh giá',
  '← CV Workspace': '← Không gian CV',
  'Select layout': 'Chọn bố cục',
  'Your journey to studying abroad': 'Hành trình du học của bạn',
  'Study abroad, with a plan': 'Du học với một kế hoạch rõ ràng',
  'Find the right university and scholarship for your future abroad': 'Tìm trường đại học và học bổng phù hợp cho tương lai du học của bạn',
  'Explore 10,000+ universities, discover 2,000+ scholarships worth over over $150,000,000, and build your application strategy with AI and real student supporters around the world.': 'Khám phá hơn 10.000 trường đại học, hơn 2.000 học bổng trị giá trên 150 triệu đô la và xây dựng chiến lược ứng tuyển với AI cùng những sinh viên hỗ trợ thực tế trên toàn thế giới.',
  'See how it works': 'Xem cách hoạt động',
  'Free to start · No agents · Start with one dream university': 'Bắt đầu miễn phí · Không qua trung gian · Bắt đầu với một trường đại học mơ ước',
  'Your strategy': 'Chiến lược của bạn',
  '✓ Subject interest matches the award': '✓ Sở thích môn học phù hợp với học bổng',
  '→ Strengthen your personal statement': '→ Củng cố bài luận cá nhân',
  'Can help with scholarship essays': 'Có thể hỗ trợ bài luận học bổng',
  'Student supporters worldwide': 'Sinh viên hỗ trợ trên toàn thế giới',
  'From choosing your dream university to preparing your application, GlowBal helps you move from confusion to a clear study-abroad plan.': 'Từ việc chọn trường đại học mơ ước đến chuẩn bị hồ sơ, GlowBal giúp bạn chuyển từ bối rối sang kế hoạch du học rõ ràng.',
  'See GlowBal in action': 'Xem GlowBal hoạt động',
  'Product demo — coming soon': 'Bản demo sản phẩm — sắp ra mắt',
  'Too many universities': 'Quá nhiều trường đại học',
  'Scholarships are hard to find': 'Khó tìm học bổng',
  'Advice is hard to trust': 'Khó tin lời tư vấn',
  'Studying abroad should not feel this confusing': 'Du học không nên khiến bạn bối rối như vậy',
  'Choose a university': 'Chọn trường đại học',
  'Pick scholarships': 'Chọn học bổng',
  'Generate your AI strategy': 'Tạo chiến lược AI của bạn',
  'Choose a university. Unlock scholarships. Build your plan.': 'Chọn trường đại học. Mở khóa học bổng. Xây dựng kế hoạch.',
  'Start with a university': 'Bắt đầu với một trường đại học',
  'See scholarships connected to your chosen university': 'Xem học bổng liên quan đến trường bạn đã chọn',
  'Unlock details': 'Mở khóa thông tin chi tiết',
  'Create your free GlowBal profile to unlock full scholarship details and save opportunities to your plan.': 'Tạo hồ sơ GlowBal miễn phí để mở khóa thông tin học bổng đầy đủ và lưu cơ hội vào kế hoạch của bạn.',
  'Get an AI strategy for your scholarship application': 'Nhận chiến lược AI cho hồ sơ học bổng',
  'Free users get': 'Người dùng miễn phí nhận được',
  '. Upgrade to GlowBal Plus for more strategies and deeper support.': '. Nâng cấp lên GlowBal Plus để có thêm chiến lược và hỗ trợ chuyên sâu hơn.',
  'Your scholarship strategy': 'Chiến lược học bổng của bạn',
  '• Your subject interest matches the scholarship area.': '• Sở thích môn học của bạn phù hợp với lĩnh vực học bổng.',
  '• Your academic profile appears relevant.': '• Hồ sơ học tập của bạn có vẻ phù hợp.',
  '• Strengthen your personal statement.': '• Củng cố bài luận cá nhân.',
  '• Show leadership or extracurricular activity.': '• Thể hiện hoạt động lãnh đạo hoặc ngoại khóa.',
  '• Ask for a recommendation letter early.': '• Xin thư giới thiệu sớm.',
  'Week 1: Confirm eligibility and collect documents.': 'Tuần 1: Xác nhận điều kiện và thu thập tài liệu.',
  'Week 2: Draft your personal statement.': 'Tuần 2: Soạn bản nháp bài luận cá nhân.',
  'Week 4: Final review and submit.': 'Tuần 4: Xem xét lần cuối và nộp hồ sơ.',
  'Learn from students who have already made it': 'Học hỏi từ những sinh viên đã đạt được mục tiêu',
  'Ask about this university': 'Hỏi về trường đại học này',
  'Find a student supporter': 'Tìm sinh viên hỗ trợ',
  'Built by students who understand the journey': 'Được xây dựng bởi những sinh viên hiểu hành trình này',
  'Real outcomes from the GlowBal team': 'Kết quả thực tế từ đội ngũ GlowBal',
  'GlowBal advising record': 'Thành tích tư vấn của GlowBal',
  '“Real student supporters who have studied abroad and won scholarships, ready to share what worked.”': '“Những sinh viên hỗ trợ thực tế từng du học và giành học bổng, sẵn sàng chia sẻ điều đã hiệu quả.”',
  'Student stories from the first GlowBal cohort will appear here.': 'Câu chuyện của sinh viên từ khóa đầu tiên của GlowBal sẽ xuất hiện tại đây.',
  'Want a stronger scholarship strategy?': 'Bạn muốn chiến lược học bổng vững chắc hơn?',
  'Everything you need to start.': 'Mọi thứ bạn cần để bắt đầu.',
  'Start for free': 'Bắt đầu miễn phí',
  'Deeper support for serious applicants.': 'Hỗ trợ chuyên sâu hơn cho ứng viên nghiêm túc.',
  'Unlock my full scholarship plan': 'Mở khóa kế hoạch học bổng đầy đủ của tôi',
  'Start with one dream university. Leave with a scholarship plan.': 'Bắt đầu với một trường đại học mơ ước. Rời đi với một kế hoạch học bổng.',
  'Choose a university, discover scholarships, and build your AI application strategy — free to start.': 'Chọn trường đại học, khám phá học bổng và xây dựng chiến lược ứng tuyển AI — bắt đầu miễn phí.',
  'Get early updates': 'Nhận cập nhật sớm',
  'Not ready yet? Save your spot.': 'Chưa sẵn sàng? Hãy giữ chỗ.',
  'We’ll send your scholarship starting points and product updates. One email, no spam.': 'Chúng tôi sẽ gửi các gợi ý học bổng ban đầu và cập nhật sản phẩm. Một email, không spam.',
  'GlowBal. Student-first global guidance.': 'GlowBal. Định hướng toàn cầu, ưu tiên sinh viên.',
  Instagram: 'Instagram',
  Sections: 'Mục',
  'Search for a university': 'Tìm trường đại học',
  'Search university name…': 'Tìm tên trường đại học…',
  'Searching…': 'Đang tìm kiếm…',
  'No matches for “': 'Không có kết quả phù hợp với “',
  'Browse all →': 'Xem tất cả →',
  '← Search again': '← Tìm lại',
  'Create free profile to view scholarships': 'Tạo hồ sơ miễn phí để xem học bổng',
  'Unlock full scholarship details for': 'Mở khóa thông tin học bổng đầy đủ cho',
  'eligibility, required documents, deadlines, and save opportunities to your plan. It’s free to start.': 'điều kiện, tài liệu cần thiết, thời hạn và lưu cơ hội vào kế hoạch. Bắt đầu miễn phí.',
  'No spam. We only ask for the basics to save your plan.': 'Không spam. Chúng tôi chỉ hỏi thông tin cơ bản để lưu kế hoạch của bạn.',
  Bookings: 'Lịch đặt',
  'Book an advising session with': 'Đặt buổi tư vấn với',
  'our advisors and alumni.': 'cố vấn và cựu sinh viên của chúng tôi.',
  'Book a Session': 'Đặt buổi tư vấn',
  'Last updated:': 'Cập nhật lần cuối:',
  'This is a general template provided for convenience and is not legal advice. Please have it reviewed by a qualified professional before relying on it.': 'Đây là mẫu thông tin chung nhằm mục đích thuận tiện và không phải tư vấn pháp lý. Hãy nhờ chuyên gia đủ năng lực xem xét trước khi dựa vào nội dung này.',
  'Complete your profile for match scores →': 'Hoàn thiện hồ sơ để xem điểm phù hợp →',
  session: 'buổi tư vấn',
  'We&rsquo;ll email you within 48 hours. You can pre-fill your availability and pricing in the meantime.': 'Chúng tôi sẽ gửi email cho bạn trong vòng 48 giờ. Trong lúc chờ, bạn có thể điền trước lịch rảnh và mức phí.',
  'We’ll email you within 48 hours. You can pre-fill your availability and pricing in the meantime.': 'Chúng tôi sẽ gửi email cho bạn trong vòng 48 giờ. Trong lúc chờ, bạn có thể điền trước lịch rảnh và mức phí.',
  'Reach out to support if you&rsquo;d like a re-review.': 'Hãy liên hệ bộ phận hỗ trợ nếu bạn muốn được xem xét lại.',
  'Reach out to support if you’d like a re-review.': 'Hãy liên hệ bộ phận hỗ trợ nếu bạn muốn được xem xét lại.',
  'Profile suspended.': 'Hồ sơ bị tạm ngưng.',
  'Bookings are paused. Contact support for next steps.': 'Lịch đặt đang tạm dừng. Liên hệ hỗ trợ để biết bước tiếp theo.',
  'No upcoming sessions yet. Once mentees book, they&rsquo;ll show up here.': 'Chưa có buổi tư vấn sắp tới. Khi người được tư vấn đặt lịch, buổi hẹn sẽ hiển thị tại đây.',
  'No upcoming sessions yet. Once mentees book, they’ll show up here.': 'Chưa có buổi tư vấn sắp tới. Khi người được tư vấn đặt lịch, buổi hẹn sẽ hiển thị tại đây.',
  'Past sessions will appear here.': 'Các buổi tư vấn đã qua sẽ hiển thị tại đây.',
  'Select one or more days above to add times.': 'Chọn một hoặc nhiều ngày ở trên để thêm giờ.',
  'Add times to': 'Thêm giờ cho',
  'selected day': 'ngày đã chọn',
  'Clear selection': 'Bỏ chọn',
  'Add custom time': 'Thêm giờ tùy chỉnh',
  'Remove this time': 'Xóa giờ này',
  'Talk to an advisor who studies here': 'Trao đổi với cố vấn đang học tại đây',
  'Real advice from current students and recent alumni at': 'Lời khuyên thực tế từ sinh viên hiện tại và cựu sinh viên gần đây tại',
  'See all →': 'Xem tất cả →',
  'No advisors at': 'Không có cố vấn tại',
  'Are you a student here? Become an advisor →': 'Bạn đang là sinh viên tại đây? Trở thành cố vấn →',
  'Master’s': 'Thạc sĩ',
  'USD ($)': 'USD ($)',
  'CV / Resume': 'CV / Sơ yếu lý lịch',
  'University acceptance letter': 'Thư chấp nhận nhập học',
  'Latest transcript': 'Bảng điểm mới nhất',
  'Student card / ID': 'Thẻ sinh viên / giấy tờ tùy thân',
  'Tell us who you are': 'Hãy cho chúng tôi biết bạn là ai',
  'As it appears on your official documents': 'Theo đúng thông tin trên giấy tờ chính thức',
  'Search by name or country': 'Tìm theo tên hoặc quốc gia',
  'No universities match.': 'Không có trường đại học phù hợp.',
  'Selected:': 'Đã chọn:',
  'Can&rsquo;t find your university? Add it manually': 'Không tìm thấy trường đại học? Hãy thêm thủ công',
  'Can’t find your university? Add it manually': 'Không tìm thấy trường đại học? Hãy thêm thủ công',
  'Tell us your university and country — we&rsquo;ll add it to GlowBal so other students can find you. (It&rsquo;s reviewed by our team alongside your application.)': 'Hãy cho chúng tôi biết trường đại học và quốc gia của bạn — chúng tôi sẽ thêm vào GlowBal để sinh viên khác có thể tìm thấy bạn. (Đội ngũ sẽ xem xét cùng hồ sơ của bạn.)',
  'Tell us your university and country — we’ll add it to GlowBal so other students can find you. (It’s reviewed by our team alongside your application.)': 'Hãy cho chúng tôi biết trường đại học và quốc gia của bạn — chúng tôi sẽ thêm vào GlowBal để sinh viên khác có thể tìm thấy bạn. (Đội ngũ sẽ xem xét cùng hồ sơ của bạn.)',
  'University name': 'Tên trường đại học',
  '← Back to the university list': '← Quay lại danh sách trường đại học',
  'Verification documents': 'Tài liệu xác minh',
  'Build your advisor profile': 'Xây dựng hồ sơ cố vấn',
  'e.g. Computer Science, MEng': 'ví dụ: Khoa học máy tính, MEng',
  'Share your story, what makes your perspective unique, and how you can help applicants.': 'Chia sẻ câu chuyện, điều làm góc nhìn của bạn độc đáo và cách bạn có thể giúp ứng viên.',
  'Set your hourly rate': 'Đặt mức phí theo giờ',
  'per session. The mentee pays': 'mỗi buổi. Người được tư vấn thanh toán',
  'Pick your free times': 'Chọn thời gian rảnh',
  'Glowbal will email you within 48 hours with the outcome.': 'GlowBal sẽ gửi email kết quả cho bạn trong vòng 48 giờ.',
  'Tap one or more days, then add the times you&rsquo;re free below. Selected days turn pink; days with saved times show a count.': 'Chạm vào một hoặc nhiều ngày, sau đó thêm các giờ bạn rảnh bên dưới. Ngày đã chọn sẽ chuyển màu hồng; ngày có giờ đã lưu sẽ hiển thị số lượng.',
  'Tap one or more days, then add the times you’re free below. Selected days turn pink; days with saved times show a count.': 'Chạm vào một hoặc nhiều ngày, sau đó thêm các giờ bạn rảnh bên dưới. Ngày đã chọn sẽ chuyển màu hồng; ngày có giờ đã lưu sẽ hiển thị số lượng.',
  slot: 'khung giờ',
  across: 'trên',
  'You can change all of this any time from your advisor dashboard.': 'Bạn có thể thay đổi tất cả nội dung này bất cứ lúc nào từ bảng điều khiển cố vấn.',
  'Mentees pay': 'Người được tư vấn thanh toán',
  'including the service fee.': 'bao gồm phí dịch vụ.',
  Earnings: 'Thu nhập',
  'Payouts are processed manually via Stripe Connect (in setup). Reach out to support if you need a payout reference now.': 'Khoản chi trả được xử lý thủ công qua Stripe Connect (đang thiết lập). Hãy liên hệ hỗ trợ nếu bạn cần mã tham chiếu chi trả ngay.',
  'Subscribing...': 'Đang đăng ký…',
  '✓ Subscribed': '✓ Đã đăng ký',
  'Type your own answer or generate one': 'Nhập câu trả lời của bạn hoặc tạo một câu',
  'You’re out of this world': 'Bạn thật khác biệt',
  'onboarding progress': 'tiến độ bắt đầu',
  'Build the recommender&rsquo;s point of view': 'Xây dựng góc nhìn của người giới thiệu',
  'Build the recommender’s point of view': 'Xây dựng góc nhìn của người giới thiệu',
  'Select only experiences this recommender directly observed. School and programme context are taken from this application.': 'Chỉ chọn những trải nghiệm mà người giới thiệu này trực tiếp quan sát. Bối cảnh trường học và chương trình được lấy từ hồ sơ này.',
  'Who are you asking for a recommendation?': 'Bạn đang nhờ ai viết thư giới thiệu?',
  'Subject teacher': 'Giáo viên bộ môn',
  'School counselor': 'Cố vấn học đường',
  'Research supervisor': 'Người hướng dẫn nghiên cứu',
  'Club advisor': 'Cố vấn câu lạc bộ',
  'Internship supervisor': 'Người hướng dẫn thực tập',
  'Volunteer supervisor': 'Người hướng dẫn hoạt động tình nguyện',
  'Academic advisor': 'Cố vấn học tập',
  'Less than 6 months': 'Dưới 6 tháng',
  'More than 2 years': 'Trên 2 năm',
  'What experiences have they directly observed or supervised?': 'Họ đã trực tiếp quan sát hoặc hướng dẫn những trải nghiệm nào?',
  'No saved activities or achievements are available yet.': 'Chưa có hoạt động hoặc thành tích nào được lưu.',
  'RECOMMENDER PERSPECTIVE': 'GÓC NHÌN NGƯỜI GIỚI THIỆU',
  'F7.2 · Recommended emphasis': 'F7.2 · Trọng tâm đề xuất',
  'How to raise it:': 'Cách cải thiện:',
  'Do not prioritise': 'Không ưu tiên',
  'Suggested Recommender Brief': 'Tóm tắt đề xuất cho người giới thiệu',
  'Send an email to my recommender': 'Gửi email cho người giới thiệu',
  'Ask your recommender': 'Hỏi người giới thiệu',
  'AI is drafting this with your application context.': 'AI đang soạn nội dung này dựa trên bối cảnh hồ sơ của bạn.',
  'Close email template': 'Đóng mẫu email',
  'Using the standard template instead.': 'Thay vào đó sử dụng mẫu tiêu chuẩn.',
  'AI statement feedback': 'Phản hồi AI về bài luận',
  'Strengthen your statement': 'Củng cố bài luận',
  'LOR review stages': 'Các giai đoạn xem xét thư giới thiệu',
  'Personal Statement': 'Bài luận cá nhân',
  'Statement of Purpose': 'Bài luận mục tiêu',
  words: 'từ',
  'Save draft': 'Lưu bản nháp',
  '· UCAS max: 650': '· Tối đa UCAS: 650',
  Essay: 'Bài luận',
  'Your feedback will appear here once you submit your': 'Phản hồi của bạn sẽ xuất hiện ở đây sau khi bạn gửi',
  'AI summary': 'Tóm tắt AI',
  'Quality dimensions': 'Các khía cạnh chất lượng',
  'WHAT WORKS WELL': 'ĐIỂM HIỆU QUẢ',
  'WHAT COULD BE STRONGER': 'ĐIỂM CÓ THỂ CẢI THIỆN',
  'Suggestion:': 'Gợi ý:',
  'All suggestions applied. Your': 'Đã áp dụng tất cả gợi ý. Bài',
  'is looking strong.': 'của bạn đang rất tốt.',
  'Update this directly in the letter draft using facts your recommender can verify.': 'Cập nhật trực tiếp trong bản nháp thư bằng những sự thật mà người giới thiệu có thể xác minh.',
  'Missing from document': 'Thiếu trong tài liệu',
  Curiosity: 'Tò mò',
  'Essay diagnostic': 'Chẩn đoán bài luận',
  'Previous page': 'Trang trước',
  'Unlock GlowBal Plus benefits:': 'Mở khóa lợi ích GlowBal Plus:',
  'Current usage:': 'Mức sử dụng hiện tại:',
  'Upgrade to Plus': 'Nâng cấp lên Plus',
  'What are you hoping to study, and where?': 'Bạn muốn học gì và ở đâu?',
  'For example: CS in the US, Business in the UK, anywhere in Europe...': 'Ví dụ: Khoa học máy tính ở Mỹ, Kinh doanh ở Anh, bất kỳ nơi nào tại châu Âu…',
  'Academic standing': 'Nền tảng học thuật',
  'Demonstrated impact': 'Tác động đã thể hiện',
  'Personal fit': 'Mức phù hợp cá nhân',
  Activities: 'Hoạt động',
  Personal: 'Cá nhân',
  'Open statement writer': 'Mở công cụ viết bài luận',
  'How do I improve this?': 'Tôi cải thiện điều này như thế nào?',
  'No tasks yet. Once your strategy has been analysed, everything it recommends appears here as a plan you can work through.': 'Chưa có nhiệm vụ. Sau khi chiến lược được phân tích, mọi đề xuất sẽ xuất hiện ở đây dưới dạng kế hoạch để bạn thực hiện.',
  'Search tasks': 'Tìm nhiệm vụ',
  'Start writing…': 'Bắt đầu viết…',
  Course: 'Khóa học',
  'Application Progress': 'Tiến độ ứng tuyển',
  'tasks completed': 'nhiệm vụ đã hoàn thành',
  'Updated — refresh the dashboard to see new priorities.': 'Đã cập nhật — làm mới bảng điều khiển để xem các ưu tiên mới.',
  'Could not re-analyse. Please try again.': 'Không thể phân tích lại. Vui lòng thử lại.',
  'Drop a task here': 'Thả nhiệm vụ vào đây',
  'Not scheduled': 'Chưa lên lịch',
  'Drag a task onto a day to give it a deadline. Drag it back here to clear one.': 'Kéo nhiệm vụ vào một ngày để đặt hạn. Kéo lại đây để xóa hạn.',
  'Everything has a date.': 'Mọi thứ đều có ngày.',
  'Nothing matches those filters.': 'Không có kết quả phù hợp với các bộ lọc đó.',
  'AI analyses your application': 'AI phân tích hồ sơ của bạn',
  'AI compares you against your course': 'AI so sánh bạn với khóa học',
  Personalised: 'Cá nhân hóa',
  'Every recommendation is unique.': 'Mỗi đề xuất đều độc đáo.',
  'Analyses hundreds of factors instantly.': 'Phân tích hàng trăm yếu tố ngay lập tức.',
  'Continuously Updated': 'Cập nhật liên tục',
  'Improve something? Ask for a re-analysis and your strategy catches up.':
    'Bạn vừa cải thiện điều gì đó? Hãy yêu cầu phân tích lại để chiến lược được cập nhật.',
  'Course Specific': 'Theo từng khóa học',
  'Every recommendation is based on your chosen university course.':
    'Mỗi đề xuất đều dựa trên khóa học đại học bạn đã chọn.',
  'Build your personalised roadmap into university.': 'Xây dựng lộ trình cá nhân hóa để vào đại học.',
  'Our AI analyses your profile, compares you against your chosen university course, and creates a personalised action plan that updates as you improve.': 'AI của chúng tôi phân tích hồ sơ, so sánh bạn với khóa học đại học đã chọn và tạo kế hoạch hành động cá nhân hóa được cập nhật khi bạn tiến bộ.',
  'Start My Strategy': 'Bắt đầu chiến lược của tôi',
  'What students say': 'Sinh viên nói gì',
  'I had no idea what universities actually wanted.': 'Trước đây tôi không biết các trường đại học thực sự muốn gì.',
  'The strategy showed me weaknesses I never considered.': 'Chiến lược đã cho tôi thấy những điểm yếu mà tôi chưa từng nghĩ đến.',
  'It made the application process much less stressful.': 'Quy trình ứng tuyển trở nên nhẹ nhàng hơn rất nhiều.',
  'Sample testimonial': 'Lời chia sẻ mẫu',
  Positioning: 'Định vị',
  'Your Personalized Strategy': 'Chiến lược cá nhân hóa của bạn',
  'Strategy report sections': 'Các phần báo cáo chiến lược',
  'Why this direction': 'Vì sao chọn hướng này',
  'Your story, retold through this direction': 'Câu chuyện của bạn, kể lại qua định hướng này',
  'Why this is stronger': 'Vì sao điều này tốt hơn',
  'The crowded pattern you currently resemble': 'Mô hình phổ biến mà bạn hiện đang giống',
  'How to stand out': 'Cách tạo khác biệt',
  'Expected positioning': 'Định vị kỳ vọng',
  'Something went wrong.': 'Đã xảy ra lỗi.',
  'Loading your strategy...': 'Đang tải chiến lược của bạn…',
  'Make concise': 'Làm súc tích hơn',
  'Tailor to this course': 'Điều chỉnh cho khóa học này',
  'Statement Readiness': 'Mức độ sẵn sàng của bài luận',
  'Continue to Submit Audit': 'Tiếp tục đến kiểm tra nộp hồ sơ',
  'Could not save': 'Không thể lưu',
  'Section name': 'Tên mục',
  'Paste CV text': 'Dán nội dung CV',
  'Please check:': 'Vui lòng kiểm tra:',
  'AI Assessment': 'Đánh giá AI',
  'Reviewed against version': 'Đã xem xét theo phiên bản',
  Strong: 'Mạnh',
  'CV steps': 'Các bước CV',
  Step: 'Bước',
  "We have not read this programme's page yet": 'Chúng tôi chưa đọc trang chương trình này',
  'Open course details': 'Mở thông tin khóa học',
  'We saved your file, but we could not read its text.': 'Chúng tôi đã lưu tệp nhưng không thể đọc nội dung.',
  'Scanned PDFs, images and Word documents cannot be read automatically yet. Your file is still attached to this application.': 'Hiện chưa thể tự động đọc PDF quét, hình ảnh và tài liệu Word. Tệp của bạn vẫn được đính kèm hồ sơ này.',
  'A text-based PDF exported from Word or Google Docs reads reliably.': 'PDF dạng văn bản xuất từ Word hoặc Google Docs thường được đọc chính xác.',
  'Your CV has changed since this review.': 'CV của bạn đã thay đổi kể từ lần xem xét này.',
  'Your statement has changed since this analysis.': 'Bài luận của bạn đã thay đổi kể từ lần phân tích này.',
  'Our AI provider is not responding.': 'Nhà cung cấp AI của chúng tôi không phản hồi.',
  'There is no CV content to review yet': 'Chưa có nội dung CV để xem xét',
  'Your PDF is older than your CV': 'PDF của bạn cũ hơn CV',
  'Paste a draft you already have, or start from the brief above.': 'Dán bản nháp bạn đã có hoặc bắt đầu từ đề cương ở trên.',
  'Start writing': 'Bắt đầu viết',
  'Paste statement': 'Dán bài luận',
  'Last updated': 'Cập nhật lần cuối',
  'Last saved': 'Lưu lần cuối',
  'Last analyzed': 'Phân tích lần cuối',
  'Start with the document you already have': 'Bắt đầu với tài liệu bạn đã có',
  'Start CV': 'Bắt đầu CV',
  'Start statement': 'Bắt đầu bài luận',
  Suggested: 'Đề xuất',
  'Edit the suggestion before applying it': 'Chỉnh sửa gợi ý trước khi áp dụng',
  'Apply my version': 'Áp dụng phiên bản của tôi',
  'fields have content': 'trường có nội dung',
  'University Detail': 'Thông tin trường đại học',
  'Application Strategy': 'Chiến lược ứng tuyển',
  'Submit Audit': 'Kiểm tra nộp hồ sơ',
  'Academic Awards & Prizes': 'Giải thưởng & thành tích học thuật',
  'Competitions & Olympiads': 'Cuộc thi & Olympic',
  'Research & Publications': 'Nghiên cứu & xuất bản',
  'Certificates & Recognitions': 'Chứng chỉ & ghi nhận',
  'Leadership & Initiative': 'Lãnh đạo & sáng kiến',
  'Innovation & Projects': 'Đổi mới & dự án',
  'Personal Growth': 'Phát triển cá nhân',
  'Advising & Tutoring': 'Cố vấn & gia sư',
  'Personal Reflection': 'Suy ngẫm cá nhân',
  'GlowBal&rsquo;s AI is reading the course page': 'AI của GlowBal đang đọc trang khóa học',
  'GlowBal’s AI is reading the course page': 'AI của GlowBal đang đọc trang khóa học',
  'We&rsquo;re going through': 'Chúng tôi đang xem qua',
  'We’re going through': 'Chúng tôi đang xem qua',
  'and building your application checklist. This usually takes about a minute — the page fills in on its own.': 'và xây dựng danh sách kiểm tra hồ sơ. Thường mất khoảng một phút — trang sẽ tự động điền thông tin.',
  'the official course page and building your application checklist. This usually takes about a minute — the page fills in on its own.': 'trang khóa học chính thức và xây dựng danh sách kiểm tra hồ sơ. Thường mất khoảng một phút — trang sẽ tự động điền thông tin.',
  'What we&rsquo;re gathering': 'Những gì chúng tôi đang thu thập',
  'What we’re gathering': 'Những gì chúng tôi đang thu thập',
  'Finding your universities': 'Tìm các trường đại học của bạn',
  'Search the university directory': 'Tìm trong danh bạ trường đại học',
  'Open a university and read the detail': 'Mở trường đại học và đọc thông tin chi tiết',
  'Check the scholarships': 'Kiểm tra học bổng',
  'Save the ones you want': 'Lưu những lựa chọn bạn muốn',
  'Attach a scholarship': 'Gắn học bổng',
  'GlowBal builds your application': 'GlowBal xây dựng hồ sơ của bạn',
  'See how well you fit': 'Xem mức độ phù hợp của bạn',
  'Strengthen your application': 'Củng cố hồ sơ của bạn',
  'Confirm your details': 'Xác nhận thông tin',
  'A structured set of questions — not a blank box — covering the things that actually shape an application.': 'Một bộ câu hỏi có cấu trúc — không phải ô trống — bao quát những yếu tố thực sự định hình hồ sơ ứng tuyển.',
  'Your background, education and grades': 'Thông tin nền tảng, học vấn và điểm số của bạn',
  'Where you want to study and what you are aiming for': 'Nơi bạn muốn học và mục tiêu bạn hướng đến',
  'Your interests, and how you learn best': 'Sở thích của bạn và cách bạn học hiệu quả nhất',
  'Starter questions for your personal statement': 'Các câu hỏi gợi ý cho bài luận cá nhân của bạn',
  'See the questions': 'Xem các câu hỏi',
  'Awards, competitions, projects, volunteering, work. The specifics — because “I was in a club” and “I ran the club” score very differently.': 'Giải thưởng, cuộc thi, dự án, hoạt động tình nguyện, công việc. Thông tin cụ thể rất quan trọng — vì “tôi tham gia một câu lạc bộ” và “tôi điều hành câu lạc bộ” được đánh giá rất khác nhau.',
  'Academic achievements with the level, year and how competitive it was': 'Thành tích học tập kèm cấp độ, năm đạt được và mức độ cạnh tranh',
  'Extracurricular activities, projects and employment': 'Hoạt động ngoại khóa, dự án và kinh nghiệm làm việc',
  'Upload your CV alongside them': 'Tải CV của bạn lên cùng các thông tin này',
  'Genuinely have none yet? You can finish this step empty and still continue': 'Thực sự chưa có? Bạn vẫn có thể để trống bước này và tiếp tục',
  'One about you, one about the course — because a strong applicant for one course is an average one for another. Takes about 30–60 seconds.': 'Một báo cáo về bạn, một báo cáo về khóa học — vì ứng viên mạnh với khóa học này có thể chỉ ở mức trung bình với khóa học khác. Mất khoảng 30–60 giây.',
  'Your report: personality, strengths, growth areas, and what makes you competitive': 'Báo cáo về bạn: tính cách, điểm mạnh, lĩnh vực cần phát triển và điều tạo nên sức cạnh tranh của bạn',
  'The course report: how you match on entry requirements, experience and personal qualities': 'Báo cáo khóa học: mức độ phù hợp của bạn về yêu cầu đầu vào, kinh nghiệm và phẩm chất cá nhân',
  'What the course is looking for that you have not shown yet': 'Những điều khóa học đang tìm kiếm mà bạn chưa thể hiện',
  'Where the admissions risk sits, and how confident the analysis is': 'Rủi ro tuyển sinh nằm ở đâu và mức độ tin cậy của phân tích',
  'Your weak areas become a specific, ordered list of things to do — each one tied to the part of your application it lifts.': 'Những điểm yếu của bạn trở thành danh sách việc cần làm cụ thể, có thứ tự — mỗi việc gắn với phần hồ sơ mà nó cải thiện.',
  'Grouped by Academics, Activities, Personal Statement, Impact and Personal': 'Được nhóm theo Học thuật, Hoạt động, Bài luận cá nhân, Tác động và Cá nhân',
  'Each action carries a priority and how much it would move your score': 'Mỗi hành động có mức ưu tiên và mức điểm dự kiến có thể cải thiện',
  'Mark things in progress, done, or blocked as you work': 'Đánh dấu đang thực hiện, đã hoàn thành hoặc bị chặn trong quá trình làm',
  'Ask the AI coach about any single action, upload evidence when it is done, then re-run the analysis and watch the score move': 'Hỏi cố vấn AI về từng hành động, tải bằng chứng lên khi hoàn tất, sau đó chạy lại phân tích và theo dõi điểm số thay đổi',
  'Add achievements, projects and grades': 'Thêm thành tích, dự án và điểm số',
  'Get two AI reports': 'Nhận hai báo cáo AI',
  'Studies at': 'Đang học tại',
  'Tap a face to see where they study, what they have won, and how to reach them.': 'Chạm vào một gương mặt để xem họ học ở đâu, đã đạt thành tích gì và cách liên hệ.',
  'Previous team member': 'Thành viên đội ngũ trước',
  'Choose from 200+ of the world&apos;s leading universities': 'Chọn từ hơn 200 trường đại học hàng đầu thế giới',
  'Choose from 200+ of the world’s leading universities': 'Chọn từ hơn 200 trường đại học hàng đầu thế giới',
  'Find scholarships that fit your goals': 'Tìm học bổng phù hợp với mục tiêu',
  'Create a free profile to save opportunities and build a focused application plan.': 'Tạo hồ sơ miễn phí để lưu cơ hội và xây dựng kế hoạch ứng tuyển tập trung.',
  'Demo clip coming soon': 'Video demo sắp ra mắt',
  'This step will show a short screen recording of': 'Bước này sẽ hiển thị bản ghi màn hình ngắn về',
  'Takes you to': 'Đưa bạn đến',
  'That is the most we can include. Remove one to add another.': 'Đó là số lượng tối đa có thể thêm. Hãy xóa một mục để thêm mục khác.',
  'The part that changes your odds: a profile of you, a profile of the course, and a plan that closes the gap between them.': 'Phần giúp thay đổi cơ hội của bạn: hồ sơ của bạn, hồ sơ khóa học và kế hoạch thu hẹp khoảng cách giữa hai bên.',
  'Your application tells you where you stand. The Strategy is how you improve it — start it from the application itself.': 'Hồ sơ cho bạn biết vị trí hiện tại. Chiến lược giúp bạn cải thiện — hãy bắt đầu từ chính hồ sơ đó.',
  'Opens from “Ready to strengthen this application?” on any application': 'Mở từ “Sẵn sàng củng cố hồ sơ này?” trên bất kỳ hồ sơ nào',
  'Built for that one course, not a generic checklist': 'Được xây dựng cho đúng khóa học đó, không phải danh sách kiểm tra chung chung',
  'Starts with a walkthrough of what the Strategy will do before you commit': 'Bắt đầu bằng hướng dẫn về những gì Chiến lược sẽ làm trước khi bạn cam kết',
  'Head of Business Development': 'Trưởng bộ phận Phát triển Kinh doanh',
  'Frontend & System Developer': 'Lập trình viên Frontend & Hệ thống',
  'Head of Research and Development': 'Trưởng bộ phận Nghiên cứu và Phát triển',
  'Choose a programme to evaluate': 'Chọn chương trình để đánh giá',
  'Each report belongs to one programme and only uses data from your account.': 'Mỗi báo cáo gắn với một chương trình cụ thể và chỉ dùng dữ liệu thuộc tài khoản của bạn.',
  'Matching Report is not enabled in the database.': 'Matching Report chưa được kích hoạt trong cơ sở dữ liệu.',
  'No programmes yet': 'Chưa có chương trình nào',
  'Add a programme in My Applications before creating a report.': 'Hãy thêm một chương trình vào My Applications trước khi tạo báo cáo.',
  'Add programme': 'Thêm chương trình',
  'Academic achievements and extracurricular activities': 'Thành tích học thuật và hoạt động phi học thuật',
  'Could not read the document. Please try again.': 'Không thể đọc tài liệu. Vui lòng thử lại.',
  'The extraction result is invalid. Please try again.': 'Kết quả trích xuất không hợp lệ. Vui lòng thử lại.',
  'Reading PDF…': 'Đang đọc PDF…',
  'Upload a CV or certificate PDF': 'Tải CV hoặc chứng nhận PDF',
  'You can choose multiple PDFs; each file can be up to 10MB': 'Có thể chọn nhiều PDF, mỗi file tối đa 10MB',
  'The system only fills data with a source excerpt in the PDF; you review everything before saving.': 'Hệ thống chỉ điền dữ liệu có đoạn nguồn trong PDF; bạn luôn được kiểm tra trước khi lưu.',
  'Academic achievements': 'Thành tích học thuật',
  'Achievement {number}': 'Thành tích {number}',
  'Add achievement': 'Thêm thành tích',
  'Academic achievement type': 'Loại thành tích học thuật',
  'Achievement name': 'Tên thành tích',
  'For example: First prize in the Hanoi City Mathematics Olympiad 2026': 'Ví dụ: Giải Nhất cuộc thi Olympic Toán Thành Phố Hà Nội năm 2026',
  'Competition or organisation name': 'Tên cuộc thi / tên tổ chức',
  'Organising body': 'Đơn vị tổ chức',
  Level: 'Cấp độ',
  'City level': 'Cấp thành phố',
  'Award year': 'Năm cấp',
  'Detailed description': 'Mô tả chi tiết',
  'Describe the scale, competitiveness, selection criteria, your role, the result, and why this achievement matters.': 'Nêu quy mô cuộc thi hoặc chương trình, mức độ cạnh tranh, tiêu chí xét chọn, vai trò của bạn, kết quả đạt được và ý nghĩa của thành tích.',
  'Extracurricular activities': 'Hoạt động phi học thuật',
  'Activity {number}': 'Hoạt động {number}',
  'Add activity': 'Thêm hoạt động',
  'Extracurricular activity type': 'Loại hoạt động phi học thuật',
  'Describe why you joined, your role, key contributions, results, impact, or what made this activity meaningful.': 'Lí do tham gia, vai trò, đóng góp chính, kết quả đạt được, tác động hoặc điều khiến hoạt động này có ý nghĩa với bạn.',
  'CV content | GlowBal': 'Nội dung CV | GlowBal',
  'Build your CV | GlowBal': 'Tạo CV | GlowBal',
  'Choose now': 'Chọn ngay',
  'Open Glowbal AI': 'Mở Glowbal AI',
  'Choose a CV format': 'Chọn format CV',
  'Bring your experience together into a target profile and an English CV for the programme':
    'Tổng hợp kinh nghiệm của bạn thành hồ sơ mục tiêu và CV tiếng Anh cho chương trình.',
  'Upload or paste an existing CV to receive evidence-based feedback':
    'Tải lên hoặc dán CV hiện có để nhận phản hồi dựa trên bằng chứng.',
  'Start building your CV': 'Bắt đầu xây dựng CV',
  Upload: 'Tải lên',
  Input: 'Nhập',
  'Where would you like to start?': 'Bạn muốn bắt đầu từ đâu',
  'PDF extraction results': 'Kết quả đọc PDF',
  'Review before adding to your profile': 'Kiểm tra trước khi điền vào hồ sơ',
  '{count} items found': '{count} mục được tìm thấy',
  'unpdf read {readable}/{total} pages': 'unpdf đọc được {readable}/{total} trang',
  '{count} characters': '{count} ký tự',
  'OCR needed for pages {pages}': 'Cần OCR trang {pages}',
  'Select {title}': 'Chọn {title}',
  Achievement: 'Thành tích',
  Activity: 'Hoạt động',
  'High confidence': 'Tin cậy cao',
  'Needs review': 'Cần kiểm tra',
  'Needs confirmation': 'Cần xác nhận',
  'Page {page}: “{quote}”': 'Trang {page}: “{quote}”',
  'This PDF is mostly scanned images. unpdf could not read the content; the OCR path is reserved but not connected to a cloud service yet.': 'PDF này chủ yếu là ảnh scan. unpdf chưa đọc được nội dung; nhánh OCR đã được chừa sẵn nhưng chưa kết nối cloud.',
  'No achievement or activity with enough evidence was found in this document.': 'Không tìm thấy thành tích hoặc hoạt động đủ dẫn chứng trong tài liệu.',
  '{count} items were excluded because their source excerpt or format did not match.': 'Đã loại {count} mục vì không khớp đoạn nguồn hoặc sai định dạng.',
  'Add {count} selected items': 'Điền {count} mục đã chọn',
  Skip: 'Bỏ qua',
  'Candidate information': 'Thông tin ứng viên',
  'Personal and study information': 'Thông tin cá nhân và học tập',
  'Achievements and activities': 'Thành tích và hoạt động',
  'Finish': 'Hoàn tất',
  'Submit Bug Report': 'Gửi báo cáo lỗi',
  'Page URL is required': 'Vui lòng nhập URL trang',
  '1. Go to ...\n2. Click on ...\n3. ...': '1. Truy cập ...\n2. Nhấp vào ...\n3. ...',
  'Steps are required': 'Vui lòng nhập các bước',
  'Please be more specific': 'Vui lòng mô tả cụ thể hơn',
  'Expected result is required': 'Vui lòng nhập kết quả mong đợi',
  'Actual result is required': 'Vui lòng nhập kết quả thực tế',
  optional: 'không bắt buộc',
  'of 3 &middot;': 'trong 3 ·',
  'of 3 ·': 'trên 3 ·',
  'Step {current} of {total}': 'Bước {current} trong {total}',
  'Area {current} of {total}': 'Khu vực {current} trong {total}',
  'the university directory': 'danh bạ trường đại học',
  'the scholarship list': 'danh sách học bổng',
  'the questions about you': 'các câu hỏi về bạn',
  'your achievements': 'thành tích của bạn',
  'steps, built for one specific course — so it can compare you against that course’s real requirements rather than a generic checklist. You start it from an application you have already planned.':
    'bước, được xây dựng cho một khóa học cụ thể — để so sánh bạn với yêu cầu thực tế của khóa học thay vì danh sách chung chung. Bạn bắt đầu từ hồ sơ đã lên kế hoạch.',
  'A Strategy belongs to a single course, so it opens from an application rather than from here. Plan one in My Portal, then use “Ready to strengthen this application?” at the bottom of it.':
    'Một Chiến lược gắn với một khóa học, nên được mở từ hồ sơ thay vì tại đây. Hãy lập hồ sơ trong Trang lưu, sau đó chọn “Sẵn sàng củng cố hồ sơ này?” ở cuối hồ sơ.',
  'Extracting the text from your file.': 'Đang trích xuất nội dung từ tệp của bạn.',
  'Splitting it into CV sections.': 'Đang chia nội dung thành các phần CV.',
  'Reading your CV against every part of your target profile.':
    'Đang đối chiếu CV với từng phần trong hồ sơ mục tiêu của bạn.',
  "Reading this programme's page and your Glowbal profile.":
    'Đang đọc trang chương trình và hồ sơ Glowbal của bạn.',
  "Target profile suggestions use the course's own requirements. Without them, generation will leave most fields empty.":
    'Gợi ý hồ sơ mục tiêu dựa trên yêu cầu riêng của khóa học. Nếu thiếu dữ liệu này, phần lớn trường sẽ để trống.',
  'Import a CV you already have, or start from your Glowbal profile.':
    'Nhập CV hiện có hoặc bắt đầu từ hồ sơ Glowbal của bạn.',
  'Run the review again to refresh the feedback.': 'Chạy lại đánh giá để cập nhật phản hồi.',
  'Reviewing…': 'Đang đánh giá…',
  'Re-run review': 'Chạy lại đánh giá',
  'Re-analyze to refresh the feedback below.': 'Phân tích lại để cập nhật phản hồi bên dưới.',
  'Analyzing…': 'Đang phân tích…',
  'Re-analyze': 'Phân tích lại',
  'Nothing you have written was lost. This is usually temporary.':
    'Nội dung bạn đã viết vẫn được giữ nguyên. Lỗi này thường chỉ là tạm thời.',
  'We could not finish the analysis.': 'Không thể hoàn tất phân tích.',
  'Your document is saved. Try again shortly.':
    'Tài liệu của bạn đã được lưu. Hãy thử lại sau ít phút.',
  'Add your education and experience first, then run the review.':
    'Hãy thêm học vấn và kinh nghiệm trước, sau đó chạy đánh giá.',
  'Your CV content is safe. This is usually temporary.':
    'Nội dung CV của bạn vẫn an toàn. Lỗi này thường chỉ là tạm thời.',
  'You have edited your CV since this file was generated.':
    'Bạn đã chỉnh sửa CV sau khi tệp này được tạo.',
  'steps, built for one specific course &mdash; so it can compare you against that course&rsquo;s real requirements rather than a generic checklist. You start it from an application you have already planned.': 'bước, được xây dựng cho một khóa học cụ thể — để so sánh bạn với yêu cầu thực tế của khóa học thay vì danh sách chung chung. Bạn bắt đầu từ hồ sơ đã lên kế hoạch.',
  'A Strategy belongs to a single course, so it opens from an application rather than from here. Plan one in My Portal, then use &ldquo;Ready to strengthen this application?&rdquo; at the bottom of it.': 'Một Chiến lược gắn với một khóa học, nên được mở từ hồ sơ thay vì tại đây. Hãy lập hồ sơ trong Trang lưu, sau đó chọn “Sẵn sàng củng cố hồ sơ này?” ở cuối hồ sơ.',
  'From &ldquo;where do I even start&rdquo; to a plan that gets you in': 'Từ “tôi phải bắt đầu từ đâu” đến kế hoạch giúp bạn trúng tuyển',
  'From “where do I even start” to a plan that gets you in': 'Từ “tôi phải bắt đầu từ đâu” đến kế hoạch giúp bạn trúng tuyển',
  'Search real universities, read the honest detail on each one, and save the ones worth your time.': 'Tìm các trường đại học thực tế, đọc thông tin chân thực về từng trường và lưu những trường xứng đáng với thời gian của bạn.',
  'From your saved list, GlowBal builds a real application for one course — the steps to follow, and how well you currently fit.': 'Từ danh sách đã lưu, GlowBal xây dựng hồ sơ thực tế cho một khóa học — các bước cần theo dõi và mức độ phù hợp hiện tại của bạn.',
  'Search by name, or filter by where you want to study and what you want to study, and browse the results.': 'Tìm theo tên hoặc lọc theo nơi và ngành bạn muốn học, rồi xem kết quả.',
  'Filter by destination country and by subject area': 'Lọc theo quốc gia điểm đến và lĩnh vực môn học',
  'Every result opens into a full profile, not a stub': 'Mỗi kết quả mở ra hồ sơ đầy đủ, không phải trang sơ sài',
  'steps. Save the universities worth your time, turn one into a real application plan, then work through a strategy built from your profile and that course&rsquo;s actual requirements &mdash; without leaving GlowBal.': 'bước. Lưu những trường xứng đáng với thời gian của bạn, biến một trường thành kế hoạch ứng tuyển thực tế, rồi thực hiện chiến lược dựa trên hồ sơ và yêu cầu thực tế của khóa học — mà không cần rời GlowBal.',
  'Compare Free &amp; Plus': 'So sánh Miễn phí & Plus',
  'Review &amp; submit': 'Xem lại & nộp',
  'Find the university that&apos;s right for you': 'Tìm trường đại học phù hợp với bạn',
  'Build the recommender&apos;s point of view': 'Xây dựng góc nhìn của người giới thiệu',
  'We&rsquo;re going through the official course page and building your application checklist. This usually takes about a minute — the page fills in on its own.': 'Chúng tôi đang xem trang khóa học chính thức và xây dựng danh sách kiểm tra hồ sơ. Thường mất khoảng một phút — trang sẽ tự động điền thông tin.',
  // Application strategy, CV review, and statement feedback chrome.
  '{label}: {current}/10 current, {potential}/10 potential. View definition': '{label}: hiện tại {current}/10, tiềm năng {potential}/10. Xem định nghĩa',
  '{name} score': 'Điểm {name}',
  '{sections} sections · {entries} entries': '{sections} phần · {entries} mục',
  'a document': 'một tài liệu',
  'A higher line means the stage has stronger evidence and persuasion.': 'Đường càng cao cho thấy chặng đó có dẫn chứng và sức thuyết phục tốt hơn.',
  'AACC assessment': 'Đánh giá AACC',
  'AACC score': 'Điểm AACC',
  'AACC score and potential': 'Điểm AACC và mức có thể đạt',
  'Outstanding Ability': 'Năng lực Vượt trội',
  Creativity: 'Sáng tạo',
  Commitment: 'Cam kết',
  'Assesses clarity, sentence rhythm, and structure: whether the opening, development, transitions, and conclusion guide the reader.': 'Đánh giá độ rõ ràng, nhịp câu và cấu trúc: phần mở đầu, triển khai, chuyển ý và kết luận có dẫn dắt người đọc hay không.',
  'Assesses the specificity of evidence: actions, context, numbers, reactions, and details that keep the story from becoming generic.': 'Đánh giá mức độ cụ thể của dẫn chứng: hành động, bối cảnh, con số, phản ứng và chi tiết giúp câu chuyện không trở nên chung chung.',
  'Assesses personal voice: whether the essay shows how you think, your motivations, emotions, and perspective rather than a template voice.': 'Đánh giá giọng văn cá nhân: bài luận có thể hiện cách bạn suy nghĩ, động lực, cảm xúc và góc nhìn thay vì giọng văn khuôn mẫu hay không.',
  'Assesses character shown through choices and actions, such as responsibility, integrity, maturity, and learning from mistakes.': 'Đánh giá tính cách qua lựa chọn và hành động, như trách nhiệm, chính trực, trưởng thành và khả năng học từ sai lầm.',
  'Assesses curiosity and learning: how you ask questions, pursue ideas, and expand your understanding beyond ordinary requirements.': 'Đánh giá sự tò mò và học hỏi: cách bạn đặt câu hỏi, theo đuổi ý tưởng và mở rộng hiểu biết vượt ngoài yêu cầu thông thường.',
  'Assesses the value you create for others or a community, including impact, outcomes, and what you learn by contributing.': 'Đánh giá giá trị bạn tạo ra cho người khác hoặc cộng đồng, gồm tác động, kết quả và điều bạn học được khi đóng góp.',
  'Academic competitiveness': 'Năng lực cạnh tranh học thuật',
  'High priority': 'Ưu tiên cao',
  'Medium priority': 'Ưu tiên trung bình',
  'Low priority': 'Ưu tiên thấp',
  'Act now': 'Làm ngay',
  'Add content': 'Thêm nội dung',
  'Add evidence': 'Bổ sung dẫn chứng',
  'Add line': 'Thêm dòng',
  'Add more content to split it.': 'Hãy thêm nội dung để chia thành các phần.',
  'Add section': 'Thêm phần',
  'After priorities': 'Sau khi ưu tiên',
  'AI did not identify any evidence-backed gaps.': 'AI không phát hiện khoảng trống nào có dẫn chứng.',
  'AI feedback': 'Phản hồi từ AI',
  'AI is preparing the analysis…': 'AI đang chuẩn bị phân tích…',
  'AI is reading and comparing each section of your CV.': 'AI đang đọc và so sánh từng phần trong CV của bạn.',
  'AI is reasoning through the next section…': 'AI đang phân tích phần tiếp theo…',
  'AI will read the programme page and your profile, then fill these seven areas. You can edit every area afterwards.': 'AI sẽ đọc trang chương trình và hồ sơ của bạn, rồi điền bảy mục này. Bạn có thể chỉnh sửa từng mục sau đó.',
  'AI will read your CV, compare it with each target-profile area, and identify three strengths and what is missing.': 'AI sẽ đọc CV, so sánh với từng mục trong hồ sơ mục tiêu và xác định ba điểm mạnh cùng những gì còn thiếu.',
  'Aligned direction': 'Định hướng phù hợp',
  'Ambassador name (for example, Nguyen An)': 'Tên đại sứ (ví dụ: Nguyễn An)',
  'Analyse again': 'Phân tích lại',
  'Analyse CV': 'Phân tích CV',
  'Analysing essay': 'Đang phân tích bài luận',
  'Analysing the next section…': 'Đang phân tích phần tiếp theo…',
  'Analysing…': 'Đang phân tích…',
  'Answered {answered} of {total} prompts': 'Đã trả lời {answered}/{total} yêu cầu',
  'Applicant profile': 'Hồ sơ ứng viên',
  'Applicant profile sections': 'Các phần hồ sơ ứng viên',
  'Application readiness': 'Mức độ sẵn sàng nộp hồ sơ',
  'Assessing programme fit': 'Đang đánh giá độ phù hợp chương trình',
  'At least {count} characters. Your essay is analysed by AI and is not saved.': 'Tối thiểu {count} ký tự. Bài viết được AI phân tích và không được lưu.',
  'Back to AI Strategy': 'Quay lại AI Strategy',
  'Back to Application Strategy': 'Quay lại Application Strategy',
  'Back to Apply': 'Quay lại Apply',
  'Before writing your CV, define what it needs to prove for the programme you are applying to. AI will compare these seven areas when reviewing your CV.': 'Trước khi viết CV, hãy xác định CV cần chứng minh điều gì cho chương trình bạn đăng ký. AI sẽ so sánh bảy mục này khi đánh giá CV.',
  'Below 6': 'Dưới 6',
  'Black line = strong benchmark {score}/10': 'Đường màu đen = mốc tốt {score}/10',
  'Career direction': 'Định hướng nghề nghiệp',
  'Where do you want to go after graduation.': 'Bạn muốn đi tới đâu sau khi tốt nghiệp.',
  'Example: become a data engineer in healthcare in Southeast Asia.':
    'Ví dụ: trở thành kỹ sư dữ liệu trong lĩnh vực y tế tại Đông Nam Á.',
  'How does this university position itself?': 'Trường này tự định vị mình như thế nào.',
  'Example: a research-intensive university highly ranked for computer science.':
    'Ví dụ: đại học nghiên cứu chuyên sâu, xếp hạng cao về khoa học máy tính.',
  'How the university teaches and what it values in students.':
    'Cách trường dạy và điều họ coi trọng ở sinh viên.',
  'Example: project-based learning with a strong theoretical foundation.':
    'Ví dụ: học qua dự án, chú trọng nền tảng lý thuyết vững.',
  'The learning environment you will enter.': 'Môi trường học tập bạn sẽ bước vào.',
  'Example: small classes, an international community, and strong industry links.':
    'Ví dụ: lớp nhỏ, cộng đồng quốc tế, gắn với doanh nghiệp.',
  'What this programme promises its graduates will be able to do.':
    'Chương trình này cam kết đào tạo ra điều gì.',
  'Example: train engineers who can build large-scale data systems.':
    'Ví dụ: đào tạo kỹ sư có thể xây dựng hệ thống dữ liệu quy mô lớn.',
  'The capabilities your CV most needs to prove.':
    'Những năng lực CV của bạn cần chứng minh rõ nhất.',
  'Example: analytical thinking, programming, and interdisciplinary teamwork.':
    'Ví dụ: tư duy phân tích, lập trình, làm việc nhóm liên ngành.',
  'Where your direction and this programme meet.':
    'Điểm gặp nhau giữa định hướng của bạn và chương trình này.',
  'Example: the programme focuses on health data, matching your career goal.':
    'Ví dụ: chương trình có hướng dữ liệu y tế, khớp với mục tiêu của bạn.',
  'Change': 'Chuyển biến',
  'Check profile data': 'Kiểm tra dữ liệu hồ sơ',
  'Choose a layout and export PDF': 'Chọn bố cục và xuất PDF',
  'Choose another file': 'Chọn tệp khác',
  'Choose another profile': 'Chọn hồ sơ khác',
  'Choose PDF/DOCX': 'Chọn PDF/DOCX',
  'Click to upload {label}': 'Nhấn để tải lên {label}',
  Confidence: 'Độ tin cậy',
  Conflict: 'Xung đột',
  'Content priorities': 'Ưu tiên nội dung',
  'Content unavailable': 'Chưa có nội dung',
  Context: 'Bối cảnh',
  'Continue entering content': 'Tiếp tục nhập nội dung',
  'Continue to Matching Report': 'Tiếp tục đến Matching Report',
  'Could not analyse the CV.': 'Không thể phân tích CV.',
  'Could not create Matching Report.': 'Không thể tạo Matching Report.',
  'Could not create target profile': 'Không thể tạo hồ sơ mục tiêu',
  'Could not create the report.': 'Không thể tạo báo cáo.',
  'Could not generate a suggestion': 'Không thể tạo gợi ý',
  'Could not import CV': 'Không thể nhập CV',
  'Create from Glowbal profile': 'Tạo từ hồ sơ Glowbal',
  'Create Matching Report': 'Tạo Matching Report',
  'Create PDF': 'Tạo PDF',
  'Create report': 'Tạo báo cáo',
  'Create target profile': 'Tạo hồ sơ mục tiêu',
  'Creating applicant profile': 'Đang tạo hồ sơ ứng viên',
  'Creating report…': 'Đang tạo báo cáo…',
  'Creating target profile': 'Đang tạo hồ sơ mục tiêu',
  'Current AACC': 'AACC hiện tại',
  currently: 'hiện tại',
  'Curriculum Vitae': 'Sơ yếu lý lịch',
  'Custom section': 'Phần tùy chỉnh',
  'CV content': 'Nội dung CV',
  'CV has not been reviewed yet': 'CV chưa được đánh giá',
  'CV review': 'Đánh giá CV',
  'CV score': 'Điểm CV',
  'CV score map': 'Bản đồ điểm CV',
  'Data confidence': 'Độ tin cậy dữ liệu',
  'Data is newer than this report': 'Dữ liệu mới hơn báo cáo này',
  'Define what your CV needs to prove': 'Xác định điều CV cần chứng minh',
  Delete: 'Xóa',
  'Delete this content': 'Xóa nội dung này',
  'Delete this content?': 'Xóa nội dung này?',
  'Demo · data is not saved': 'Bản demo · dữ liệu không được lưu',
  'Detail line': 'Dòng chi tiết',
  'Diagnostic summary': 'Tóm tắt chẩn đoán',
  'Do this': 'Thực hiện',
  down: 'xuống',
  'Drop a CV here, or choose a file': 'Thả CV vào đây hoặc chọn tệp',
  'Edit and analyse again': 'Chỉnh sửa và phân tích lại',
  'Edit content': 'Chỉnh sửa nội dung',
  'Edit essay': 'Chỉnh sửa bài luận',
  'Editing · old result is not updated': 'Đang chỉnh sửa · kết quả cũ chưa được cập nhật',
  'Education philosophy': 'Triết lý giáo dục',
  'Enter content section by section. Reorder, add, or remove sections, and ask AI to rewrite individual lines. AI only suggests — it never changes your content automatically.': 'Nhập nội dung theo từng phần. Sắp xếp, thêm hoặc xóa phần, rồi yêu cầu AI viết lại từng dòng. AI chỉ gợi ý — không tự động thay đổi nội dung của bạn.',
  'Enter CV content': 'Nhập nội dung CV',
  'Enter CV content first, then return to choose a layout.': 'Hãy nhập nội dung CV trước rồi quay lại chọn bố cục.',
  'Enter manually': 'Nhập thủ công',
  'Essay content': 'Nội dung bài luận',
  'Essay journey chart across five stages': 'Biểu đồ hành trình bài luận qua năm chặng',
  'Essay prompt': 'Đề bài luận',
  'Essay review profile': 'Hồ sơ phản biện bài luận',
  'Essay rhythm': 'Nhịp bài luận',
  Evidence: 'Dẫn chứng',
  'Evidence coverage map': 'Bản đồ độ phủ dẫn chứng',
  'Evidence sources': 'Nguồn dẫn chứng',
  'Evidence strengths and gaps': 'Đã có và cần bổ sung',
  'Evidence-based analysis': 'Phân tích có dẫn chứng',
  'Evidence-based CV review': 'Đánh giá CV có dẫn chứng',
  'Export PDF': 'Xuất PDF',
  Fair: 'Khá',
  Feedback: 'Phản hồi',
  'Figma {node} is still an Untitled UI placeholder.': 'Figma {node} vẫn là bản mẫu của Untitled UI.',
  'Financial feasibility': 'Khả năng tài chính',
  'Five dimensions of fit': 'Năm khía cạnh phù hợp',
  'Fix first': 'Việc cần sửa trước',
  Future: 'Tương lai',
  'Generate again': 'Tạo lại',
  'Generating PDF': 'Đang tạo PDF',
  'Generating suggestion': 'Đang tạo gợi ý',
  'GlowBal rereads your profile, achievements, and activities to find evidence-backed patterns. Missing data is called out rather than filled in by AI.': 'GlowBal đọc lại hồ sơ, thành tích và hoạt động để tìm các xu hướng có dẫn chứng. Dữ liệu thiếu sẽ được nêu rõ thay vì để AI tự điền.',
  'How far is the CV from being strong?': 'CV còn cách một CV tốt bao xa?',
  'Ideas and structure': 'Ý tưởng và cấu trúc',
  'Import an existing CV, create from your Glowbal profile, or enter it manually.': 'Nhập CV có sẵn, tạo từ hồ sơ Glowbal hoặc nhập thủ công.',
  'Import content from a CV': 'Nhập nội dung từ CV',
  'Import CV': 'Nhập CV',
  'Import from another CV': 'Nhập từ CV khác',
  'Import this file': 'Nhập tệp này',
  'Import uploaded CV': 'Nhập CV đã tải lên',
  'Improvement ideas': 'Gợi ý cải thiện',
  'Improvement score bridge': 'Cầu điểm cải thiện',
  Keep: 'Giữ lại',
  'Key assessment': 'Nhận định chính',
  'Last analysed': 'Phân tích lần cuối',
  'Last extracted': 'Trích xuất lần cuối',
  'Last generated': 'Tạo lần cuối',
  'Letter of recommendation draft': 'Bản nháp thư giới thiệu',
  'Limits to know': 'Các giới hạn cần biết',
  'Linked to an item in your Glowbal profile.': 'Đã liên kết với một mục trong hồ sơ Glowbal.',
  'Living costs': 'Chi phí sinh hoạt',
  'Matching Report confidence': 'Độ tin cậy của Matching Report',
  Missing: 'Thiếu',
  'missing content': 'nội dung còn thiếu',
  Move: 'Di chuyển',
  'Move entry': 'Di chuyển mục',
  'Needs action': 'Cần hành động',
  'Needs clarification': 'Cần làm rõ',
  'Needs more evidence:': 'Cần bổ sung dẫn chứng:',
  'New content': 'Nội dung mới',
  'Next free generation': 'Lần tạo miễn phí tiếp theo',
  'No changes suggested': 'Không có thay đổi được đề xuất',
  'No clear signal yet.': 'Chưa có tín hiệu rõ ràng.',
  'No content yet': 'Chưa có nội dung',
  'No CV content to export': 'Không có nội dung CV để xuất',
  'No gaps were found against the target profile.': 'Không tìm thấy khoảng trống nào so với hồ sơ mục tiêu.',
  'No information yet': 'Chưa có thông tin',
  'No major gap recorded.': 'Chưa ghi nhận khoảng trống lớn.',
  'No target profile yet': 'Chưa có hồ sơ mục tiêu',
  'No verified data': 'Không có dữ liệu đã xác minh',
  'Not an admissions decision': 'Không phải quyết định tuyển sinh',
  'Not available': 'Không có',
  'Official source': 'Nguồn chính thức',
  'One-page focus': 'Tập trung trong một trang',
  Open: 'Mở',
  'Open programme page': 'Mở trang chương trình',
  'Open to print': 'Mở để in',
  'Open your CV, select all, copy, and paste it here. This always works, even with scanned files.': 'Mở CV, chọn tất cả, sao chép và dán vào đây. Cách này luôn hoạt động, kể cả với tệp scan.',
  'Opening and appeal': 'Mở bài và sức hút',
  or: 'hoặc',
  'Or upload another CV': 'Hoặc tải lên CV khác',
  'Overall AACC score': 'Điểm AACC tổng',
  Page: 'Trang',
  'Paste CV content': 'Dán nội dung CV',
  'Paste the full CV content here...': 'Dán toàn bộ nội dung CV vào đây...',
  'Paste your CV content here': 'Dán nội dung CV vào đây',
  'PDF ready': 'PDF đã sẵn sàng',
  'PDFs with a text layer work best. Up to 10MB.': 'PDF có lớp văn bản sẽ hoạt động tốt nhất. Tối đa 10MB.',
  'Personal signature': 'Dấu ấn cá nhân',
  'Please check': 'Vui lòng kiểm tra',
  'points to clarify': 'điểm cần làm rõ',
  Potential: 'Tiềm năng',
  'Preparing section {letter}: {title}…': 'Đang chuẩn bị phần {letter}: {title}…',
  'Priority capabilities': 'Năng lực ưu tiên',
  'Priority roadmap': 'Lộ trình ưu tiên',
  'Profile · if available': 'Hồ sơ · nếu có',
  'Profile and programme fit': 'Độ phù hợp hồ sơ và chương trình',
  'Profile strategy': 'Chiến lược hồ sơ',
  'Programme · server confirmed': 'Chương trình · máy chủ đã xác nhận',
  Prompt: 'Đề bài',
  Proven: 'Đã chứng minh',
  'proven points': 'điểm đã chứng minh',
  'Proven:': 'Đã chứng minh:',
  'Quality by section': 'Chất lượng theo từng phần',
  'Questions to answer': 'Câu hỏi cần bổ sung',
  'Radar chart comparing current and potential scores': 'Biểu đồ radar so sánh điểm hiện tại và điểm tiềm năng',
  'Reasoning…': 'Đang suy luận…',
  'Recommendation letter': 'Thư giới thiệu',
  Refine: 'Tinh chỉnh',
  'Regenerate target profile': 'Tạo lại hồ sơ mục tiêu',
  'Remove detail line': 'Xóa dòng chi tiết',
  'Remove the': 'Xóa',
  'Report confidence': 'Độ tin cậy báo cáo',
  'Report limitations': 'Giới hạn của báo cáo',
  'Retry missing sections': 'Thử lại phần thiếu',
  'Review again': 'Đánh giá lại',
  'Review and improve your CV': 'Đánh giá và cải thiện CV',
  'Review Reflection': 'Xem lại Reflection',
  'Reviewing your CV': 'Đang đánh giá CV',
  'Scale of 10': 'Thang điểm 10',
  Score: 'Điểm',
  'Score gap': 'Khoảng cách điểm',
  'Scored essay': 'Bài luận đã chấm',
  'Scoring essay…': 'Đang chấm bài luận…',
  section: 'phần',
  Select: 'Chọn',
  'Short by {score} points': 'Còn thiếu {score} điểm',
  'Some information could not be determined': 'Một số thông tin không thể xác định',
  'Source confidence': 'Độ tin cậy nguồn',
  'Sources and freshness': 'Nguồn và độ mới',
  'Split into sections': 'Chia thành các phần',
  'Start with this content': 'Bắt đầu với nội dung này',
  'Story journey across five stages': 'Hành trình câu chuyện qua năm chặng',
  'Strengths and priorities': 'Điểm mạnh và ưu tiên',
  'Strong benchmark reached': 'Đã đạt mốc tốt',
  'Summary from Writing, Detail, Voice, Character, Creativity, and Aspirations in the current result.': 'Tóm tắt từ Writing, Detail, Voice, Character, Creativity và Aspirations trong kết quả hiện tại.',
  'Supporting data': 'Dữ liệu hỗ trợ',
  'Talk with a VinUni advisor': 'Trao đổi với cố vấn VinUni',
  target: 'mục tiêu',
  'target reached': 'đã đạt mục tiêu',
  'The content will be split into sections for review before saving. Nothing is written to your CV until you confirm.': 'Nội dung sẽ được chia thành các phần để bạn kiểm tra trước khi lưu. CV chỉ được cập nhật sau khi bạn xác nhận.',
  'The file was readable but does not look like a CV. You can paste content or enter it manually.': 'Tệp có thể đọc được nhưng không giống CV. Bạn có thể dán nội dung hoặc nhập thủ công.',
  'The PDF has selectable text and a reading order that works with automated CV filters.': 'PDF có văn bản chọn được và thứ tự đọc phù hợp với bộ lọc CV tự động.',
  'The preview uses the same section order and emphasis as the PDF. Page breaks in the PDF may differ slightly.': 'Bản xem trước dùng cùng thứ tự và điểm nhấn như PDF. Vị trí ngắt trang trong PDF có thể hơi khác.',
  'The report checks entry requirements first, then evaluates academic fit, profile, finances, career direction, and readiness separately.': 'Báo cáo kiểm tra điều kiện đầu vào trước, sau đó đánh giá riêng học thuật, hồ sơ, tài chính, định hướng nghề nghiệp và mức độ sẵn sàng.',
  'The review uses the target profile, so create it first.': 'Đánh giá sử dụng hồ sơ mục tiêu, vì vậy hãy tạo hồ sơ trước.',
  'The same content, three different presentations. Each layout brings different sections forward and prints different levels of detail.': 'Cùng một nội dung với ba cách trình bày khác nhau. Mỗi bố cục làm nổi bật các phần và mức độ chi tiết khác nhau.',
  'There are no serious gaps left. The suggestions below will make the CV stronger.': 'Không còn khoảng trống nghiêm trọng. Các gợi ý dưới đây sẽ giúp CV tốt hơn.',
  'There is not enough data to identify a recurring theme.': 'Chưa đủ dữ liệu để xác định chủ đề lặp lại.',
  'This download link expires after 10 minutes. Generate a new one anytime.': 'Liên kết tải xuống hết hạn sau 10 phút. Bạn có thể tạo liên kết mới bất cứ lúc nào.',
  'This feature is not enabled in the database.': 'Tính năng này chưa được bật trong cơ sở dữ liệu.',
  'This line is fine, or we have no confirmed information to add.': 'Dòng này đã ổn hoặc chưa có thông tin xác nhận để bổ sung.',
  'Three strengths': 'Ba điểm mạnh',
  Tuition: 'Học phí',
  up: 'lên',
  'Up to 5 MB': 'Tối đa 5 MB',
  'Update Reflection': 'Cập nhật Reflection',
  'Update report': 'Cập nhật báo cáo',
  'Updating applicant profile': 'Đang cập nhật hồ sơ ứng viên',
  'Updating…': 'Đang cập nhật…',
  'Upload a PDF/DOCX or paste the content.': 'Tải PDF/DOCX lên hoặc dán nội dung.',
  Used: 'Đã dùng',
  'View highlights': 'Xem điểm nổi bật',
  'We could not find any clearly evidenced strengths in the CV. Add specific details to each entry to help.': 'Không tìm thấy điểm mạnh nào có dẫn chứng rõ ràng trong CV. Hãy thêm chi tiết cụ thể vào từng mục.',
  'We could not find CV content in this file': 'Không tìm thấy nội dung CV trong tệp này',
  'We could not finish the review.': 'Không thể hoàn tất đánh giá.',
  'We could not generate your target profile.': 'Không thể tạo hồ sơ mục tiêu của bạn.',
  'We could not reach Glowbal. Check your connection and try again.': 'Không thể kết nối Glowbal. Hãy kiểm tra kết nối và thử lại.',
  'We could not read that CV.': 'Không thể đọc CV đó.',
  'We could not upload that file.': 'Không thể tải tệp đó lên.',
  'We found {sections} sections and {entries} entries.': 'Đã tìm thấy {sections} phần và {entries} mục.',
  'We found {sections} sections and {entries} entries. {uncertain} field{plural} we were unsure about are marked "Please check".': 'Đã tìm thấy {sections} phần và {entries} mục. Có {uncertain} trường{plural} chưa chắc chắn được đánh dấu "Vui lòng kiểm tra".',
  'What needs clarification': 'Điều cần làm rõ',
  'What you did well': 'Điều bạn đã làm tốt',
  'Where to start': 'Bắt đầu từ đâu',
  'which differs from our recommendation. That is completely fine — you know your profile best.': 'khác với đề xuất của chúng tôi. Điều đó hoàn toàn ổn — bạn hiểu hồ sơ của mình nhất.',
  'Why this university?': 'Vì sao là trường đại học này?',
  'Working well': 'Đang hiệu quả',
  'Writing, Detail, and Voice signals': 'Tín hiệu Writing, Detail và Voice',
  'You already have CV content in Glowbal. Importing this file will replace it.': 'Bạn đã có nội dung CV trong Glowbal. Nhập tệp này sẽ thay thế nội dung hiện tại.',
  'You can still continue.': 'Bạn vẫn có thể tiếp tục.',
  'You did well': 'Bạn đã làm tốt',
  'You have not created a target profile yet': 'Bạn chưa tạo hồ sơ mục tiêu',
  'You have uploaded a CV. Importing from it is the fastest way.': 'Bạn đã tải CV lên. Nhập từ CV là cách nhanh nhất.',
  'You selected': 'Bạn đã chọn',
  'Your applicant profile': 'Hồ sơ ứng viên của bạn',
  'Your CV': 'CV của bạn',
  'Your CV is compared with the target profile — what this programme needs you to prove. This is a content review, not a formatting review.': 'CV của bạn được so sánh với hồ sơ mục tiêu — những gì chương trình này cần bạn chứng minh. Đây là đánh giá nội dung, không phải đánh giá định dạng.',
  'Your CV review will appear here.': 'Kết quả đánh giá CV sẽ xuất hiện ở đây.',
  'Your CV will be reviewed against the target profile. You can still enter content first.': 'CV của bạn sẽ được đánh giá theo hồ sơ mục tiêu. Bạn vẫn có thể nhập nội dung trước.',
  'Your uploaded CVs': 'Các CV bạn đã tải lên',
  Zoom: 'Thu phóng',
  'short by {score} points': 'còn thiếu {score} điểm',
  Section: 'Phần',
  'Replace current CV content?': 'Thay thế nội dung CV hiện tại?',
  'Replace content': 'Thay thế nội dung',
  'Replace with this content': 'Thay thế bằng nội dung này',
  'Rendering your CV.': 'Đang dựng CV của bạn.',

  // /apply — delete an application, apply to a second course at the same university
  'Could not delete that application.': 'Không thể xóa đơn ứng tuyển này.',
  'Delete application': 'Xóa đơn ứng tuyển',
  'Delete this application?': 'Xóa đơn ứng tuyển này?',
  'This permanently removes {label} and everything built for it — your checklist, reports, and any CV or statement work done for this course. This cannot be undone.':
    'Thao tác này sẽ xóa vĩnh viễn {label} và mọi thứ đã được xây dựng cho đơn này — checklist, báo cáo, cùng mọi nội dung CV hoặc bài luận đã làm cho khóa học này. Không thể hoàn tác.',
  'Deleting…': 'Đang xóa…',
  'You already have an application for that course.': 'Bạn đã có đơn ứng tuyển cho khóa học đó.',
  'We could not add that course. Please try again.':
    'Chúng tôi không thể thêm khóa học đó. Vui lòng thử lại.',
  'Add another course': 'Thêm khóa học khác',
  'Apply to another course': 'Ứng tuyển khóa học khác',
  'Apply to another course at {university}': 'Ứng tuyển khóa học khác tại {university}',
  'Paste the course page and we will track it as its own application, alongside the one you already have here.':
    'Dán trang khóa học và chúng tôi sẽ theo dõi đây như một đơn ứng tuyển riêng, bên cạnh đơn bạn đã có tại đây.',
  'Adding…': 'Đang thêm…',
  'Add course': 'Thêm khóa học',

  // Achievements & activities — the card-grid redesign of reflection step 2.
  'We could not upload that file. Please try again.':
    'Chúng tôi không thể tải tệp này lên. Vui lòng thử lại.',
  'Most recent': 'Mới nhất',
  Oldest: 'Cũ nhất',
  'Achievement type': 'Loại thành tích',
  'Reviewed first': 'Đã xem trước',
  'Needs review first': 'Cần xem lại trước',
  'Edit {title}': 'Chỉnh sửa {title}',
  'Remove {title}': 'Xóa {title}',
  'Extracted from {fileName}': 'Trích xuất từ {fileName}',
  'Added manually': 'Được thêm thủ công',
  'Please check this': 'Vui lòng kiểm tra mục này',
  Reviewed: 'Đã xem lại',
  'Possible duplicate': 'Có thể trùng lặp',
  'Upload your achievements': 'Tải lên thành tích của bạn',
  'Upload your CV or certificate PDFs and we’ll automatically extract your achievements.':
    'Tải lên CV hoặc chứng chỉ PDF của bạn, chúng tôi sẽ tự động trích xuất thành tích.',
  'Remove this document?': 'Xóa tài liệu này?',
  'Achievements already saved to your profile will remain.':
    'Các thành tích đã lưu vào hồ sơ của bạn sẽ vẫn được giữ lại.',
  'Recently uploaded': 'Đã tải lên gần đây',
  'You can upload multiple PDFs. Each file up to 10MB.':
    'Bạn có thể tải lên nhiều tệp PDF. Mỗi tệp tối đa 10MB.',
  Rename: 'Đổi tên',
  Reprocess: 'Xử lý lại',
  'Uploading {fileName}': 'Đang tải lên {fileName}',
  'Finding achievements…': 'Đang tìm thành tích…',
  '{count} achievements found': 'Tìm thấy {count} thành tích',
  'We’ve extracted achievements from your document.':
    'Chúng tôi đã trích xuất thành tích từ tài liệu của bạn.',
  'We couldn’t find any clear achievements in this document.':
    'Chúng tôi không tìm thấy thành tích rõ ràng nào trong tài liệu này.',
  'Add one manually': 'Thêm thủ công',
  'We couldn’t read that document. Try uploading another copy.':
    'Chúng tôi không thể đọc tài liệu này. Hãy thử tải lên một bản khác.',
  'Review achievements ({count})': 'Xem lại thành tích ({count})',
  'No academic achievements yet': 'Chưa có thành tích học thuật nào',
  'Upload a CV or certificate, or add one manually.':
    'Tải lên CV hoặc chứng chỉ, hoặc thêm thủ công.',
  'Remove this achievement?': 'Xóa thành tích này?',
  'This will remove it from your GlowBal profile, but not from your uploaded document.':
    'Thao tác này sẽ xóa mục này khỏi hồ sơ GlowBal của bạn, nhưng không xóa khỏi tài liệu đã tải lên.',
  'No extracurricular activities yet': 'Chưa có hoạt động ngoại khóa nào',
  'Upload a document or add an activity manually.':
    'Tải lên tài liệu hoặc thêm hoạt động thủ công.',
  'Remove this activity?': 'Xóa hoạt động này?',
  'You still have {count} extracted achievements to review.':
    'Bạn vẫn còn {count} thành tích được trích xuất cần xem lại.',
  'Review first': 'Xem lại trước',
  'Continue anyway': 'Vẫn tiếp tục',
  'Review & Confirm': 'Xem lại & Xác nhận',
  'File name': 'Tên tệp',
  'Save changes': 'Lưu thay đổi',
  '{count} possible duplicates': '{count} mục có thể trùng lặp',
  '“{title}” looks like it might already be on your profile as “{existing}”.':
    '“{title}” có vẻ đã có trong hồ sơ của bạn dưới tên “{existing}”.',
  'Keep both': 'Giữ cả hai',
  Merge: 'Gộp lại',
  'Academic Award / Prize': 'Giải thưởng / Phần thưởng học thuật',
  Competition: 'Cuộc thi',
  'Publication / Research': 'Xuất bản / Nghiên cứu',
  Certification: 'Chứng chỉ',
  'Volunteering / Community Service': 'Tình nguyện / Hoạt động cộng đồng',
  'Project / Entrepreneurship': 'Dự án / Khởi nghiệp',
  Mentoring: 'Cố vấn / Hướng dẫn',
  'Edit achievement': 'Chỉnh sửa thành tích',
  'Edit activity': 'Chỉnh sửa hoạt động',
  Title: 'Tiêu đề',
  'Organisation / project': 'Tổ chức / dự án',
  Period: 'Giai đoạn',
  Description: 'Mô tả',
  'What would you like to add?': 'Bạn muốn thêm gì?',
  'Academic achievement': 'Thành tích học thuật',
  'Extracurricular activity': 'Hoạt động ngoại khóa',
  'All extracted achievements reviewed': 'Đã xem lại tất cả thành tích được trích xuất',
  'Review achievements': 'Xem lại thành tích',
  '{current} of {total}': '{current} / {total}',

  // Review & Confirm, and the read-only views once confirmed.
  'Confirmed profile': 'Hồ sơ đã xác nhận',
  'This information was confirmed on {date} and is used to generate your reports.':
    'Thông tin này đã được xác nhận vào ngày {date} và được dùng để tạo báo cáo của bạn.',
  'This information is locked and was used to generate your reports.':
    'Thông tin này đã bị khóa và được dùng để tạo báo cáo của bạn.',
  'This information is used to generate your reports.':
    'Thông tin này được dùng để tạo báo cáo của bạn.',
  'All fields are read-only.': 'Tất cả các trường đều chỉ đọc.',
  'Original grades': 'Điểm gốc',
  'Confirmed achievements': 'Thành tích đã xác nhận',
  'These achievements were confirmed on {date} and were included in your reports.':
    'Những thành tích này đã được xác nhận vào ngày {date} và đã được đưa vào báo cáo của bạn.',
  'Confirmed supporting documents': 'Tài liệu hỗ trợ đã xác nhận',
  'These documents supported your confirmed profile and were included in your report inputs.':
    'Những tài liệu này hỗ trợ hồ sơ đã xác nhận của bạn và đã được đưa vào dữ liệu đầu vào của báo cáo.',
  'No documents were uploaded.': 'Chưa có tài liệu nào được tải lên.',
  PDF: 'PDF',
  'Preview {fileName}': 'Xem trước {fileName}',
  'Need to make a change? Contact GlowBal Support if something in your confirmed information is incorrect.':
    'Cần thay đổi? Liên hệ Hỗ trợ GlowBal nếu có thông tin nào trong hồ sơ đã xác nhận của bạn không chính xác.',
  'We could not confirm your information. Please try again.':
    'Chúng tôi không thể xác nhận thông tin của bạn. Vui lòng thử lại.',
  'Check everything below carefully — once confirmed, this information is locked and used to generate your reports.':
    'Hãy kiểm tra kỹ mọi thông tin bên dưới — sau khi xác nhận, thông tin này sẽ bị khóa và được dùng để tạo báo cáo của bạn.',
  'You’re ready to confirm': 'Bạn đã sẵn sàng để xác nhận',
  'Every required question has been answered and reviewed.':
    'Mọi câu hỏi bắt buộc đã được trả lời và xem lại.',
  'A few things need your attention before you can confirm':
    'Có một vài điều cần bạn chú ý trước khi có thể xác nhận',
  'Fix this': 'Sửa mục này',
  '{count} extracted achievements still need review.':
    'Còn {count} thành tích được trích xuất cần xem lại.',
  '{count} extracted activities still need review.':
    'Còn {count} hoạt động được trích xuất cần xem lại.',
  'GPA / equivalent': 'GPA / điểm tương đương',
  'IELTS / English test': 'IELTS / bài thi tiếng Anh',
  'SAT / other test scores': 'SAT / điểm thi khác',
  'Study preferences': 'Nguyện vọng học tập',
  Countries: 'Quốc gia',
  'Open to suggestions': 'Sẵn sàng cân nhắc gợi ý',
  'Preferred intake': 'Kỳ nhập học mong muốn',
  'Why {subject}': 'Vì sao chọn {subject}',
  'Subject motivation': 'Động lực chọn ngành',
  '{count} more subject motivations on file.': 'Còn {count} động lực chọn ngành khác đã lưu.',
  'Financial plan': 'Kế hoạch tài chính',
  Funding: 'Nguồn tài trợ',
  'Achievements & activities': 'Thành tích & hoạt động',
  '{count} on file': '{count} mục đã lưu',
  'Supporting documents': 'Tài liệu hỗ trợ',
  'I confirm that the information above is accurate.': 'Tôi xác nhận thông tin trên là chính xác.',
  'Once confirmed, this information is locked and cannot be edited without contacting GlowBal Support.':
    'Sau khi xác nhận, thông tin này sẽ bị khóa và không thể chỉnh sửa nếu không liên hệ Hỗ trợ GlowBal.',
  'Confirm & Generate Reports': 'Xác nhận & Tạo báo cáo',
  'Confirm your information': 'Xác nhận thông tin của bạn',
  'Confirm your information?': 'Xác nhận thông tin của bạn?',
  'This locks your candidate information exactly as shown and begins generating your reports. You will not be able to edit it afterwards without contacting GlowBal Support.':
    'Thao tác này sẽ khóa thông tin ứng viên của bạn đúng như hiển thị và bắt đầu tạo báo cáo. Bạn sẽ không thể chỉnh sửa sau đó nếu không liên hệ Hỗ trợ GlowBal.',
  'Confirming…': 'Đang xác nhận…',

  // Edit achievement / edit activity — the large two-column editor.
  'Add academic achievement': 'Thêm thành tích học thuật',
  'Add extracurricular activity': 'Thêm hoạt động ngoại khóa',
  'Edit academic achievement': 'Chỉnh sửa thành tích học thuật',
  'Edit extracurricular activity': 'Chỉnh sửa hoạt động ngoại khóa',
  'Add a new academic achievement to your profile.':
    'Thêm một thành tích học thuật mới vào hồ sơ của bạn.',
  'Add a new extracurricular activity to your profile.':
    'Thêm một hoạt động ngoại khóa mới vào hồ sơ của bạn.',
  'Update the details of this achievement. All changes will be saved to your profile.':
    'Cập nhật chi tiết của thành tích này. Mọi thay đổi sẽ được lưu vào hồ sơ của bạn.',
  'Close editor': 'Đóng trình chỉnh sửa',
  'Select the category that best describes this achievement.':
    'Chọn danh mục mô tả đúng nhất thành tích này.',
  'Select the category that best describes this activity.':
    'Chọn danh mục mô tả đúng nhất hoạt động này.',
  'Activity title': 'Tên hoạt động',
  'Enter the full name of your achievement.': 'Nhập tên đầy đủ của thành tích.',
  'Enter the full name of your activity.': 'Nhập tên đầy đủ của hoạt động.',
  'Name of the competition, program or organisation.': 'Tên cuộc thi, chương trình hoặc tổ chức.',
  'The body or institution that organised this achievement.':
    'Cơ quan hoặc tổ chức đã tổ chức thành tích này.',
  'Name of the club, school or organisation, if any.':
    'Tên câu lạc bộ, trường học hoặc tổ chức (nếu có).',
  'Choose the level of this achievement.': 'Chọn cấp độ của thành tích này.',
  'Select a level': 'Chọn cấp độ',
  'Not applicable': 'Không áp dụng',
  'Describe the level': 'Mô tả cấp độ',
  'Year you received or achieved this award.': 'Năm bạn nhận hoặc đạt được giải thưởng này.',
  'Select a year': 'Chọn năm',
  'When this activity started, and ended if it has — "Present" for ongoing.':
    'Thời gian hoạt động bắt đầu, và kết thúc nếu đã kết thúc — dùng "Present" nếu vẫn đang diễn ra.',
  'Enter an achievement name.': 'Vui lòng nhập tên thành tích.',
  'Enter an activity title.': 'Vui lòng nhập tên hoạt động.',
  'Add a short description.': 'Vui lòng thêm mô tả ngắn.',
  'Choose the year you received this award.': 'Chọn năm bạn nhận được giải thưởng này.',
  'Provide a brief description of your achievement and its significance.':
    'Cung cấp mô tả ngắn gọn về thành tích của bạn và ý nghĩa của nó.',
  'Describe what you did, your responsibilities and any impact or outcome.':
    'Mô tả những gì bạn đã làm, trách nhiệm của bạn và bất kỳ tác động hoặc kết quả nào.',
  'Discard changes?': 'Hủy các thay đổi?',
  'You have unsaved changes.': 'Bạn có thay đổi chưa được lưu.',
  'Keep editing': 'Tiếp tục chỉnh sửa',
  Discard: 'Hủy bỏ',
  'Local / City level': 'Cấp địa phương / thành phố',
  'Regional level': 'Cấp khu vực',
  'University level': 'Cấp đại học',
  'Community level': 'Cấp cộng đồng',
  'Organisation level': 'Cấp tổ chức',

  // Report Generation page — after Review & Confirm, before the reports themselves.
  'Your reports are ready': 'Báo cáo của bạn đã sẵn sàng',
  'Your information is confirmed': 'Thông tin của bạn đã được xác nhận',
  "We've finished analysing your profile.": 'Chúng tôi đã hoàn tất phân tích hồ sơ của bạn.',
  "We're now creating your personalised GlowBal reports.":
    'Chúng tôi đang tạo các báo cáo cá nhân hóa GlowBal cho bạn.',
  'Confirmed {date}': 'Đã xác nhận {date}',
  'Building your personalised reports': 'Đang xây dựng báo cáo cá nhân hóa của bạn',
  '{count} of {total} reports complete': 'Đã hoàn thành {count} / {total} báo cáo',
  'Report generation progress': 'Tiến trình tạo báo cáo',
  'Personal Report is ready.': 'Báo cáo cá nhân đã sẵn sàng.',
  'Matching Report is ready.': 'Báo cáo phù hợp đã sẵn sàng.',
  'A complete overview of your profile, strengths, achievements and academic background.':
    'Tổng quan đầy đủ về hồ sơ, thế mạnh, thành tích và nền tảng học vấn của bạn.',
  'Generating…': 'Đang tạo…',
  "We couldn't finish this report. We'll retry it using your confirmed information.":
    'Chúng tôi chưa hoàn thành báo cáo này. Chúng tôi sẽ thử lại bằng thông tin đã xác nhận của bạn.',
  'Open report': 'Mở báo cáo',
  'Shows how strongly your profile matches your selected university and course.':
    'Cho thấy mức độ phù hợp giữa hồ sơ của bạn với trường và ngành học bạn đã chọn.',
  "We're still working on your reports": 'Chúng tôi vẫn đang xử lý báo cáo của bạn',
  "Some of your reports couldn't be completed. Your confirmed information is safe and we'll retry them.":
    'Một số báo cáo chưa thể hoàn thành. Thông tin đã xác nhận của bạn vẫn an toàn và chúng tôi sẽ thử lại.',
  'View my reports': 'Xem báo cáo của tôi',
  "You don't need to keep this page open — we'll keep working in the background.":
    'Bạn không cần giữ trang này mở — chúng tôi sẽ tiếp tục xử lý trong nền.',
  'Reports are generated from the information you confirmed.':
    'Báo cáo được tạo từ thông tin bạn đã xác nhận.',
  'View confirmed information': 'Xem thông tin đã xác nhận',
  // Extended production-route audit: metadata, catalog descriptions and
  // validation copy that is supplied through variables rather than t('...').
  'Meet the team behind GlowBal — the people helping students find global universities, scholarships, and application strategies.':
    'Gặp gỡ đội ngũ đứng sau GlowBal — những người giúp học sinh tìm trường đại học quốc tế, học bổng và chiến lược ứng tuyển.',
  'GlowBal Strategy: two AI reports — one about you, one about the course — and an ordered plan that closes the gap between them.':
    'Chiến lược GlowBal: hai báo cáo AI — một về bạn, một về khóa học — cùng kế hoạch theo thứ tự để thu hẹp khoảng cách giữa hai bên.',
  'Build and edit the structured content of your CV.':
    'Xây dựng và chỉnh sửa nội dung có cấu trúc cho CV của bạn.',
  'Choose how your CV is presented and export it.':
    'Chọn cách trình bày CV và xuất bản hoàn chỉnh.',
  'See whether your CV proves what this programme is looking for.':
    'Kiểm tra xem CV của bạn đã chứng minh được những gì chương trình đang tìm kiếm hay chưa.',
  'Define what your CV needs to prove for this programme.':
    'Xác định những điều CV cần chứng minh cho chương trình này.',
  'Prepare your CV and personal statement for this application.':
    'Chuẩn bị CV và bài luận cá nhân cho hồ sơ ứng tuyển này.',
  'Get line-by-line AI feedback on your personal statement or SOP.':
    'Nhận phản hồi AI theo từng dòng cho bài luận cá nhân hoặc SOP của bạn.',
  'The courses you are applying to, how far along each one is, and the universities you have saved.':
    'Các khóa học bạn đang ứng tuyển, tiến độ của từng hồ sơ và những trường bạn đã lưu.',
  'Choose a format and how to start building your CV.':
    'Chọn định dạng và cách bắt đầu xây dựng CV của bạn.',
  'GLOWBAL is offline for a short redesign. Leave your email and we’ll let you know when we’re back.':
    'GLOWBAL tạm ngừng để thiết kế lại. Hãy để lại email và chúng tôi sẽ báo khi trở lại.',
  'Please enter a valid email address.': 'Vui lòng nhập địa chỉ email hợp lệ.',
  'Please enter a valid date of birth.': 'Vui lòng nhập ngày sinh hợp lệ.',
  'The waitlist table is not set up yet. Create `waitlist_signups` in Supabase.':
    'Danh sách chờ chưa được thiết lập. Vui lòng thử lại sau.',
  'Something went wrong saving your signup. Please try again.':
    'Đã xảy ra lỗi khi lưu đăng ký. Vui lòng thử lại.',
  "You're on the list. We'll email you the moment we're back.":
    'Bạn đã có trong danh sách. Chúng tôi sẽ gửi email ngay khi trở lại.',
  'How GlowBal takes you from searching universities, to applying for a course, to a personalised strategy that improves your chances of getting in.':
    'Cách GlowBal đồng hành từ lúc tìm trường, ứng tuyển khóa học đến khi có chiến lược cá nhân hóa giúp tăng cơ hội trúng tuyển.',
  'Student-first global course and university guidance platform.':
    'Nền tảng định hướng khóa học và đại học toàn cầu lấy học sinh làm trung tâm.',
  'Pick the subject you want to apply for at a university on your saved list.':
    'Chọn ngành bạn muốn ứng tuyển tại một trường trong danh sách đã lưu.',
  'Study-abroad news, generated guides, trending topics, and scholarship stories from Glowbal.':
    'Tin du học, hướng dẫn, chủ đề nổi bật và câu chuyện học bổng từ GlowBal.',
  'GlowBal helps students discover global universities, find scholarships, and build application strategies with AI and real student supporters.':
    'GlowBal giúp học sinh khám phá các trường đại học toàn cầu, tìm học bổng và xây dựng chiến lược ứng tuyển với AI cùng người hỗ trợ thực tế.',
  'Something went wrong saving your details. Please try again.':
    'Đã xảy ra lỗi khi lưu thông tin. Vui lòng thử lại.',
  "Thanks — we'll be in touch shortly.": 'Cảm ơn bạn — chúng tôi sẽ sớm liên hệ.',
  'Upgrade to GlowBal Plus for more AI application strategies, full scholarship details, a document checklist, and priority student-supporter access.':
    'Nâng cấp lên GlowBal Plus để có thêm chiến lược ứng tuyển AI, thông tin học bổng đầy đủ, danh sách tài liệu và quyền ưu tiên kết nối người hỗ trợ.',
  'How GlowBal collects, uses, and protects your personal information when you discover universities, scholarships, and build your application plan.':
    'Cách GlowBal thu thập, sử dụng và bảo vệ thông tin cá nhân khi bạn tìm trường, học bổng và xây dựng kế hoạch ứng tuyển.',
  'English-language and standardized test results': 'Kết quả tiếng Anh và các bài thi chuẩn hóa',
  'Your academic or professional CV': 'CV học thuật hoặc nghề nghiệp của bạn',
  'Your statement of purpose or personal statement': 'SOP hoặc bài luận cá nhân của bạn',
  'The terms that govern your use of GlowBal — the platform for discovering universities, scholarships, and building application strategies.':
    'Các điều khoản áp dụng khi sử dụng GlowBal — nền tảng tìm trường, học bổng và xây dựng chiến lược ứng tuyển.',
  'Find universities that match your goals': 'Tìm các trường đại học phù hợp với mục tiêu của bạn',
  'Discover programs and compare options': 'Khám phá chương trình và so sánh các lựa chọn',
  'Prepare and submit your application': 'Chuẩn bị và nộp hồ sơ ứng tuyển',
  'Plan your finances and explore funding': 'Lập kế hoạch tài chính và tìm nguồn hỗ trợ',
  'Connect with advisors and prepare for success': 'Kết nối với cố vấn và chuẩn bị để thành công',
  'It is hard to know which universities are realistic, ambitious, affordable, or worth applying to.':
    'Thật khó để biết trường nào vừa sức, tham vọng, phù hợp ngân sách hoặc đáng để ứng tuyển.',
  'Scholarship information is scattered across different websites, deadlines, eligibility pages, and university portals.':
    'Thông tin học bổng nằm rải rác trên nhiều website, hạn chót, trang điều kiện và cổng thông tin của trường.',
  'Even after finding a scholarship, many students are unsure how to prepare documents or improve their chances.':
    'Ngay cả khi đã tìm được học bổng, nhiều học sinh vẫn chưa biết chuẩn bị tài liệu hoặc cải thiện cơ hội như thế nào.',
  'GlowBal connects you with real people who have studied abroad, won scholarships, and supported others through the journey.':
    'GlowBal kết nối bạn với những người đã du học, giành học bổng và đồng hành cùng người khác trong hành trình này.',
  'Search for a university you’re interested in, or browse by country, subject, budget, and scholarship availability.':
    'Tìm trường bạn quan tâm hoặc duyệt theo quốc gia, ngành học, ngân sách và học bổng hiện có.',
  'Add your basic details so GlowBal can show relevant scholarships and save your application plan.':
    'Thêm thông tin cơ bản để GlowBal hiển thị học bổng phù hợp và lưu kế hoạch ứng tuyển của bạn.',
  'View scholarship opportunities linked to your chosen university and save the ones you want to apply for.':
    'Xem các cơ hội học bổng liên quan đến trường đã chọn và lưu những học bổng bạn muốn ứng tuyển.',
  'Get a personalised strategy showing what to prepare, what to improve, and how to approach each scholarship.':
    'Nhận chiến lược cá nhân hóa về những gì cần chuẩn bị, cần cải thiện và cách tiếp cận từng học bổng.',
  'PDF preferred. Helps us verify your background.':
    'Ưu tiên PDF. Tài liệu này giúp chúng tôi xác minh hồ sơ của bạn.',
  'Official letter or PDF showing you were accepted.':
    'Thư chính thức hoặc PDF chứng minh bạn đã được chấp nhận.',
  'Most recent academic transcript or grade summary.':
    'Bảng điểm hoặc bản tổng hợp kết quả học tập gần nhất.',
  'Photo of your university student card (alumni: a graduation cert is fine).':
    'Ảnh thẻ sinh viên đại học (cựu sinh viên có thể dùng bằng tốt nghiệp).',
  'Grades, subjects and test scores against what the course asks for.':
    'Đối chiếu điểm số, môn học và kết quả thi với yêu cầu của khóa học.',
  'What you have done outside the classroom, and how consistently.':
    'Những gì bạn đã làm ngoài lớp học và mức độ duy trì nhất quán.',
  'How clearly your statement makes the case only you could make.':
    'Mức độ bài luận thể hiện rõ câu chuyện riêng chỉ bạn mới có thể kể.',
  'Evidence that something changed because you were involved.':
    'Bằng chứng cho thấy sự tham gia của bạn đã tạo ra thay đổi.',
  'How well who you are lines up with how this course teaches.':
    'Mức độ con người và cách học của bạn phù hợp với phương pháp giảng dạy của khóa học.',
  'Build a CV against what this course asks for, then export it as a PDF.':
    'Xây dựng CV theo yêu cầu của khóa học rồi xuất thành PDF.',
  'Leads with education, research and publications. Single column, full detail.':
    'Ưu tiên học vấn, nghiên cứu và công bố. Một cột, đầy đủ chi tiết.',
  'Leads with skills and technical projects. Two columns, scannable.':
    'Ưu tiên kỹ năng và dự án kỹ thuật. Hai cột, dễ đọc nhanh.',
  'Leads with roles, organisations and community impact. Two columns.':
    'Ưu tiên vai trò, tổ chức và tác động cộng đồng. Bố cục hai cột.',
  'Your background, grades, achievements and what you are aiming for.':
    'Nền tảng, điểm số, thành tích và mục tiêu của bạn.',
  'What your profile says about you, read back as a candidate portrait.':
    'Những gì hồ sơ thể hiện về bạn, được phản ánh thành chân dung ứng viên.',
  'How well you fit a course, with the requirements and costs beside it.':
    'Mức độ phù hợp với khóa học, kèm theo yêu cầu và chi phí.',
  'AI feedback on your essay and your CV, one draft at a time.':
    'Phản hồi AI cho bài luận và CV của bạn theo từng bản nháp.',
  'A last check over everything you are about to send.':
    'Kiểm tra lần cuối mọi thứ bạn sắp gửi.',
  'A. Is your CV aligned with the course?': 'A. CV của bạn có phù hợp với khóa học không?',
  'B. Does the reader understand who you are?': 'B. Người đọc có hiểu bạn là ai không?',
  'C. Does it include enough examples and results?': 'C. CV có đủ ví dụ và kết quả không?',
  'D. Does the important content stand out?': 'D. Nội dung quan trọng có đủ nổi bật không?',
  'E. Is the CV concise enough for one page?': 'E. CV có đủ súc tích để nằm trong một trang không?',
  'General information': 'Thông tin chung',
  'About me': 'Giới thiệu bản thân',
  Projects: 'Dự án',
  'Awards and achievements': 'Giải thưởng và thành tích',
  Publications: 'Công bố',
  Certifications: 'Chứng chỉ',
  Interests: 'Sở thích',
  'Strong foundation': 'Nền tảng tốt',
  'Needs improvement': 'Cần cải thiện',
  'Not focused enough': 'Chưa đủ tập trung',
  Urgent: 'Khẩn cấp',
  High: 'Cao',
  Medium: 'Trung bình',
  Low: 'Thấp',
  'Highly recommended': 'Rất khuyến nghị',
  'Already in your portfolio': 'Đã có trong hồ sơ của bạn',
  'Suggested opportunity': 'Cơ hội được đề xuất',
  'Identity fit': 'Mức độ phù hợp bản sắc',
  'Evidence strength': 'Độ mạnh của bằng chứng',
  Consistency: 'Tính nhất quán',
  'Future alignment': 'Mức độ phù hợp tương lai',
  Scalability: 'Khả năng mở rộng',
  'Weighing strategic directions...': 'Đang cân nhắc các hướng chiến lược...',
  'Positioning your story...': 'Đang định vị câu chuyện của bạn...',
  'Evaluating your portfolio...': 'Đang đánh giá hồ sơ của bạn...',
  'Building your roadmap...': 'Đang xây dựng lộ trình của bạn...',
  'Contact information': 'Thông tin liên hệ',
  'Activities and leadership': 'Hoạt động và vai trò lãnh đạo',

  // Per-application onboarding — Skip affordances (reflection-about-form.tsx,
  // achievements/reflection-evidence-form.tsx)
  'These answers are already filled in from your profile.':
    'Các câu trả lời này đã được điền sẵn từ hồ sơ của bạn.',
  'Skip — my answers are still correct': 'Bỏ qua — câu trả lời của tôi vẫn đúng',
  'Your achievements and activities are already filled in from your profile.':
    'Thành tích và hoạt động này đã được điền sẵn từ hồ sơ của bạn.',
  'Skip — my achievements are still correct': 'Bỏ qua — thành tích của tôi vẫn đúng',
  'Payment method': 'Phương thức thanh toán',
  'Manual bank transfer': 'Chuyển khoản ngân hàng',
  'Bank transfer payment | GlowBal': 'Thanh toán chuyển khoản ngân hàng | GlowBal',
  'Transfer the exact VND amount; founder confirmation is required.': 'Chuyển đúng số tiền VND; cần người sáng lập xác nhận.',
  'VNPay is currently available in Sandbox. Manual bank transfer is confirmed by the founder. Stripe will be available soon.': 'VNPay hiện khả dụng ở môi trường Sandbox. Chuyển khoản ngân hàng cần người sáng lập xác nhận. Stripe sẽ sớm khả dụng.',
  'I have transferred': 'Tôi đã chuyển khoản',
  'Payment status': 'Trạng thái thanh toán',
  'Awaiting transfer': 'Đang chờ chuyển khoản',
  'Transfer reported — awaiting founder': 'Đã báo chuyển khoản — chờ người sáng lập',
  'Confirmed': 'Đã xác nhận',
  'Expired': 'Đã hết hạn',
  'Received late — support review required': 'Đã nhận trễ — cần hỗ trợ kiểm tra',
  'Founder payment review': 'Kiểm tra thanh toán của người sáng lập',
  'State:': 'Trạng thái:',
  'Checkout expiry': 'Hạn thanh toán',
  'Current ledger': 'Sổ cái hiện tại',
  'Reviewer note': 'Ghi chú người duyệt',
  'Confirm received': 'Xác nhận đã nhận',
  'Review link is missing.': 'Thiếu liên kết kiểm tra.',
  'This review is unavailable.': 'Không thể mở kiểm tra này.',
  'Could not load payment status': 'Không thể tải trạng thái thanh toán',
  'Could not record transfer claim': 'Không thể ghi nhận đã chuyển khoản',
  'Loading payment status…': 'Đang tải trạng thái thanh toán…',
  Copy: 'Sao chép',
  'Copied!': 'Đã sao chép!',
  Error: 'Lỗi',
  'VietQR Payment': 'Thanh toán VietQR',
  'Transfer reported — awaiting confirmation': 'Đã báo chuyển khoản — chờ xác nhận',
  'Payment expired': 'Thanh toán đã hết hạn',
  'Scan QR to Pay': 'Quét mã QR để thanh toán',
  'Your GlowBal purchase has been confirmed and activated.': 'Giao dịch GlowBal của bạn đã được xác nhận và kích hoạt.',
  'We have received your transfer report. Founder will verify shortly.': 'Chúng tôi đã ghi nhận bạn báo chuyển khoản. Người sáng lập sẽ sớm xác minh.',
  'This transaction has expired. Please create a new checkout.': 'Giao dịch này đã hết hạn. Vui lòng tạo yêu cầu thanh toán mới.',
  'Open any banking app or e-wallet to scan the VietQR code.': 'Mở ứng dụng ngân hàng hoặc ví điện tử bất kỳ để quét mã VietQR.',
  VietQR: 'VietQR',
  'Instant transfer 24/7': 'Chuyển khoản nhanh 24/7',
  'Copy amount': 'Sao chép số tiền',
  'Transfer reference (Mandatory)': 'Nội dung chuyển khoản (Bắt buộc)',
  'Copy reference': 'Sao chép mã chuyển khoản',
  'Keep this exact reference code in transfer description to auto-verify': 'Giữ nguyên mã tham chiếu này trong nội dung chuyển khoản để hệ thống tự động xác minh',
  'Copy account number': 'Sao chép số tài khoản',
  'Expires at': 'Hết hạn lúc',
  'Processing…': 'Đang xử lý…',
  'I have transferred money': 'Tôi đã chuyển khoản',
  'You reported transfer. The system will update your access once confirmed.': 'Bạn đã báo chuyển khoản. Hệ thống sẽ cập nhật quyền truy cập sau khi được xác nhận.',
  'Back to plans': 'Quay lại các gói',
  Reference: 'Mã tham chiếu',
  'GlowBal bank transfer QR code': 'Mã QR chuyển khoản ngân hàng GlowBal',
  Bank: 'Ngân hàng',
  'Account holder': 'Chủ tài khoản',
  'Account number': 'Số tài khoản',
  Expires: 'Hết hạn',
  'VNPay': 'VNPay',
  'Stripe': 'Stripe',
  Sandbox: 'Sandbox',
  'You will pay {amount}': 'Bạn sẽ thanh toán {amount}',
  'VNPay is currently available in Sandbox for testing. Stripe will be available soon.':
    'VNPay hiện khả dụng ở môi trường Sandbox để thử nghiệm. Stripe sẽ sớm khả dụng.',
  'Continue with VNPay': 'Tiếp tục với VNPay',
  'Continue with manual transfer': 'Tiếp tục với chuyển khoản',
  'VNPay Sandbox checkout': 'Thanh toán VNPay Sandbox',
  'Payment result could not be verified': 'Không thể xác minh kết quả thanh toán',
  'Please return to GlowBal and check your payment status.':
    'Vui lòng quay lại GlowBal và kiểm tra trạng thái thanh toán.',
  'Payment was not completed': 'Thanh toán chưa hoàn tất',
  'No payment was recorded. You can try again when you are ready.':
    'Chưa ghi nhận thanh toán. Bạn có thể thử lại khi sẵn sàng.',
  'Payment successful': 'Thanh toán thành công',
  'Your GlowBal purchase has been confirmed.': 'Giao dịch GlowBal của bạn đã được xác nhận.',
  'Payment received — confirming your purchase': 'Đã nhận thanh toán — đang xác nhận giao dịch',
  'Payment received — contact support': 'Đã nhận thanh toán — vui lòng liên hệ hỗ trợ',
  'VNPay has returned a successful payment. Confirmation may take a moment.':
    'VNPay đã trả về giao dịch thành công. Việc xác nhận có thể mất một chút thời gian.',
  'Your payment was received but needs a support review.':
    'Đã nhận thanh toán nhưng cần bộ phận hỗ trợ kiểm tra.',
  'Return to GlowBal': 'Quay lại GlowBal',
  'VNPay payment result': 'Kết quả thanh toán VNPay',
  'Payments are processed securely by VNPay Sandbox.':
    'Thanh toán được xử lý an toàn qua VNPay Sandbox.',
  'VNPay charges the canonical VND amount shown in each plan. Other currencies are display estimates. GlowBal helps you discover opportunities and prepare stronger applications; it does not guarantee scholarship outcomes.':
    'VNPay tính số tiền VND chuẩn được hiển thị ở mỗi gói. Các loại tiền khác chỉ là ước tính hiển thị. GlowBal giúp bạn tìm cơ hội và chuẩn bị hồ sơ tốt hơn; không đảm bảo kết quả học bổng.',
  'Choose a plan below to test payment in Vietnamese dong. Stripe is coming soon.':
    'Chọn một gói bên dưới để thử thanh toán bằng đồng Việt Nam. Stripe sẽ sớm khả dụng.',
  'GlowBal Pricing | Choose how you want to shine': 'Bảng giá GlowBal | Chọn cách bạn muốn tỏa sáng',
  'You don’t go it alone. GlowBal walks with you from picking schools to hitting submit. Choose the support plan that fits your study abroad journey.':
    'Bạn không phải đi một mình. GlowBal đồng hành cùng bạn từ chọn trường đến khi nộp hồ sơ. Hãy chọn gói đồng hành phù hợp với hành trình du học của bạn.',
  'Thanks for your support — you can extend or upgrade your plan below.':
    'Cảm ơn bạn đã tin tưởng — bạn có thể gia hạn hoặc nâng cấp gói bên dưới.',
  'Everything you need to start exploring — no payment required.':
    'Mọi thứ bạn cần để bắt đầu khám phá — không cần thanh toán.',
  'Continue free →': 'Tiếp tục miễn phí →',
  'Chat with our in-house team for advice': 'Trò chuyện với đội ngũ tư vấn của chúng tôi',
  'Payments are processed securely via VNPay and Bank Transfer (VietQR).':
    'Thanh toán được xử lý bảo mật qua VNPay và Chuyển khoản ngân hàng (VietQR).',
  'GlowBal Pricing': 'Bảng giá GlowBal',
  'Choose how you want to': 'Chọn cách bạn muốn',
  'shine': 'tỏa sáng',
  'on your study-abroad journey': 'trên hành trình du học',
  "You don't go it alone. GlowBal": 'Bạn không phải đi một mình. GlowBal',
  'walks with you': 'đồng hành cùng bạn',
  'from picking schools to hitting submit.': 'từ chọn trường đến khi nộp hồ sơ.',
  'Launch offer · 2026 application season': 'Ưu đãi ra mắt · Mùa nộp hồ sơ 2026',
  'all plans': 'tất cả các gói',
  'Show prices in:': 'Hiển thị giá bằng:',
  'You submit your application': 'Bạn chỉ nộp hồ sơ du học',
  'once': 'một lần',
  "Pick the level of support you're most at peace with.": 'Hãy chọn mức độ hỗ trợ khiến bạn an tâm nhất.',
  'Could not start checkout': 'Không thể bắt đầu thanh toán',
  'Something went wrong': 'Đã xảy ra lỗi',
  '/mo': '/tháng',
  'Choose payment method': 'Chọn phương thức thanh toán',
  'Continue to payment': 'Tiếp tục thanh toán',
  'Monthly': 'Gói tháng',
  'Yearly': 'Gói năm',
  'Yearly Premium': 'Gói năm cao cấp',
  'GlowBal Monthly': 'GlowBal Tháng',
  'GlowBal Yearly': 'GlowBal Năm',
  'GlowBal Premium': 'GlowBal Cao cấp',
  'Cancel anytime': 'Hủy bất kỳ lúc nào',
  'Just 207,000₫/month': 'Chỉ 207.000₫/tháng',
  '375,000₫/month': '375.000₫/tháng',
  'You save 2,490,000₫': 'Tiết kiệm 2.490.000₫',
  '🏆 Best value': '🏆 Tiết kiệm nhất',
  '⭐ Most complete': '⭐ Toàn diện nhất',
  'Start finding your direction — no commitment yet.': 'Bắt đầu tìm kiếm định hướng — chưa cần cam kết dài hạn.',
  'By your side all season — no more ceilings.': 'Đồng hành suốt cả mùa nộp đơn — không còn giới hạn.',
  'Stop carrying it alone — real experts stand behind your application.':
    'Không còn phải tự xoay sở một mình — chuyên gia thực thụ đứng sau hồ sơ của bạn.',
  'Easy / Target / Reach school matching — know exactly where you stand':
    'Phân loại trường An toàn / Mục tiêu / Thử thách — biết chính xác bạn đang ở đâu',
  'Deadline reminders so you never miss a submission':
    'Nhắc nhở hạn chót để bạn không bao giờ bỏ lỡ kỳ nộp đơn',
  'AI CV / SOP review': 'Đánh giá CV / SOP bằng AI',
  '(limited)': '(giới hạn)',
  'Roadmap capped at 2×/month · no scholarship matching yet':
    'Lộ trình giới hạn 2 lần/tháng · chưa có gợi ý học bổng',
  'Everything in Monthly,': 'Bao gồm toàn bộ tính năng gói Tháng,',
  'every limit removed': 'mở khóa mọi giới hạn',
  'Unlimited roadmap + CV/SOP edits —': 'Không giới hạn chỉnh sửa lộ trình & CV/SOP —',
  'until your file is flawless': 'cho đến khi hồ sơ hoàn hảo',
  'Scholarship matching + real-time progress tracking':
    'Gợi ý học bổng thông minh & theo dõi tiến độ thời gian thực',
  '3 free 1-on-1 sessions': '3 buổi trao đổi 1:1 miễn phí',
  'with a real scholarship mentor': 'với cố vấn học bổng thực thụ',
  'Everything in Yearly — plus': 'Bao gồm toàn bộ gói Năm — cộng thêm',
  'the human touch': 'sự đồng hành trực tiếp',
  'Strategy reviewed by a': 'Chiến lược được đánh giá bởi',
  'real expert': 'chuyên gia thực tế',
  ', not just AI': ', không chỉ có AI',
  'An expert checks your': 'Chuyên gia kiểm tra',
  'entire application': 'toàn bộ hồ sơ của bạn',
  'before you submit': 'trước khi bạn nộp',
  '5 one-on-one sessions': '5 buổi cố vấn chuyên sâu 1:1',
  '+ mentor-vetted scholarship strategy': '+ chiến lược học bổng được cố vấn thẩm định',
  'Priority support — someone’s always there when you need them':
    'Hỗ trợ ưu tiên — luôn có người sẵn sàng khi bạn cần',
  'Try it': 'Thử ngay',
  'Start your journey': 'Bắt đầu hành trình',
  'Go with an expert': 'Đồng hành cùng chuyên gia',
  '1 month of Plus access': '1 tháng truy cập Plus',
  'Choose one direction for this CV. Changing it will rebuild the Target Profile and CV.':
    'Chọn một định hướng cho CV này. Thay đổi định hướng sẽ tạo lại Hồ sơ mục tiêu và CV.',
  'Use for this CV': 'Dùng cho CV này',
  'Select one of the available Personalized Strategy directions.':
    'Hãy chọn một trong các định hướng có sẵn của Chiến lược cá nhân hóa.',
  'Regenerate the Target Profile for the current direction.':
    'Tạo lại Hồ sơ mục tiêu cho định hướng hiện tại.',
  'Choose your CV direction': 'Chọn định hướng cho CV của bạn',
  'Choose the direction for this CV. The AI only uses university, programme and profile data stored in Supabase; missing pieces are flagged, never invented.':
    'Chọn định hướng cho CV này. AI chỉ sử dụng dữ liệu trường, chương trình và hồ sơ được lưu trong Supabase; phần thiếu sẽ được đánh dấu, không bịa thêm.',
  'CV direction': 'Định hướng CV',

  // ── Plus Gating & Upgrade Modals ──────────────────────────────────────────
  'See all 3000 scholarships': 'Xem tất cả 3.000 học bổng',
  'Upgrade to GlowBal Plus to browse all 3000+ scholarships worldwide, unlock advanced filtering and tailored application requirements.':
    'Nâng cấp lên GlowBal Plus để tra cứu toàn bộ kho 3.000+ học bổng trên thế giới, mở khóa bộ lọc nâng cao và điều kiện chi tiết.',
  'Upgrade to GlowBal Plus to unlock all 3000+ scholarships worldwide and maximize your admissions chances.':
    'Nâng cấp lên GlowBal Plus để mở khóa toàn bộ kho 3.000+ học bổng trên thế giới và mở rộng cơ hội trúng tuyển.',
  'Upgrade to GlowBal Plus to unlock all {count} scholarships for your saved universities.':
    'Nâng cấp lên GlowBal Plus để mở khóa tất cả {count} học bổng cho các trường đã lưu của bạn.',
  'Upgrade to GlowBal Plus to unlock all scholarships for your saved universities.':
    'Nâng cấp lên GlowBal Plus để mở khóa tất cả học bổng cho các trường đã lưu của bạn.',
  'Unlock your full strategic narrative': 'Mở khóa toàn bộ câu chuyện chiến lược',
  'Upgrade to GlowBal Plus to access the complete personalized narrative, detailed positioning angles, and tailored storyline for your application.':
    'Nâng cấp lên GlowBal Plus để xem toàn bộ câu chuyện cá nhân hóa, góc định vị chi tiết và tuyến cốt truyện cho hồ sơ của bạn.',
  'Upgrade to GlowBal Plus to access the complete personalized narrative and shape your unique admissions identity.':
    'Nâng cấp lên GlowBal Plus để xem câu chuyện cá nhân hóa hoàn chỉnh và định hình bản sắc hồ sơ du học của bạn.',
  'Secure checkout with instant activation · 100% money-back guarantee within 7 days.':
    'Thanh toán an toàn, kích hoạt ngay lập tức · Cam kết hoàn tiền 100% trong vòng 7 ngày.',
  'Bank transfer': 'Chuyển khoản ngân hàng',
  'Terms and Conditions of Use': 'Điều khoản và Điều kiện Sử dụng',
  'I have read and agree to the': 'Tôi đã đọc và đồng ý với',
  'of GlowBal Education.': 'của GlowBal Education.',
  'I understand': 'Đã hiểu',

  // ── Terms and Conditions of Use ──────────────────────────────────────────
  'Terms and Conditions of Use | GlowBal Education': 'Điều khoản và Điều kiện Sử dụng | GlowBal Education',
  'Terms and Conditions of Use for the GlowBal Education Platform — The terms that govern your use of GlowBal platform and services.':
    'Điều khoản và Điều kiện Sử dụng Nền tảng GlowBal Education — Các điều khoản chi phối việc sử dụng nền tảng và dịch vụ GlowBal.',
  'By accessing, registering for, or using the GlowBal Education platform (“GlowBal”, “Platform”, “we”, “us”), including the website, applications, and related services (“Services”), the User (“You”, “User”) confirms that they have read, understood, and agreed to comply with these Terms and Conditions of Use (“Terms”). If you do not agree with any part of these Terms, please do not use the Services.':
    'Bằng việc truy cập, đăng ký hoặc sử dụng nền tảng GlowBal Education (“GlowBal”, “Nền tảng”, “chúng tôi”), bao gồm website, ứng dụng và các dịch vụ liên quan (“Dịch vụ”), Người dùng (“Bạn”, “Người dùng”) xác nhận rằng đã đọc, hiểu và đồng ý tuân thủ các Điều khoản và Điều kiện Sử dụng này (“Điều khoản”). Nếu bạn không đồng ý với bất kỳ nội dung nào của Điều khoản, vui lòng không sử dụng Dịch vụ.',
  '1. Acceptance of Terms': '1. Chấp nhận điều khoản',
  'By accessing, registering for, or using the GlowBal Education platform, you acknowledge and agree to be bound by these Terms and Conditions of Use.':
    'Bằng việc truy cập, đăng ký hoặc sử dụng nền tảng GlowBal Education, bạn xác nhận đã đọc, hiểu và đồng ý tuân thủ các Điều khoản và Điều kiện Sử dụng này.',
  '2. Definitions': '2. Định nghĩa',
  '“Platform”': '“Nền tảng”',
  ': the website, application, and technology ecosystem operated by GlowBal Education.':
    ': hệ thống website, ứng dụng và các sản phẩm công nghệ do GlowBal vận hành.',
  '“Services”': '“Dịch vụ”',
  ': all features, digital tools, mentoring connections, and guidance products provided on the Platform.':
    ': toàn bộ sản phẩm, tính năng và dịch vụ được GlowBal cung cấp trên Nền tảng.',
  '“Content”': '“Nội dung”',
  ': information, data, copy, images, videos, software, documents, and resources available on the Platform.':
    ': thông tin, dữ liệu, văn bản, hình ảnh, video, phần mềm, tài liệu và các tài sản khác được cung cấp trên Nền tảng.',
  '“User”': '“Người dùng”',
  ': any individual who registers or uses the Services, whether free or paid.':
    ': cá nhân đăng ký hoặc sử dụng Dịch vụ, bao gồm cả người dùng miễn phí và người dùng trả phí.',
  '“Mentor / Advisor”': '“Cố vấn / Achiever / Mentor”',
  ': individuals or organizations offering advisory guidance and feedback through the Platform.':
    ': cá nhân hoặc tổ chức cung cấp dịch vụ tư vấn, cố vấn hoặc hỗ trợ thông qua hoặc liên quan đến Nền tảng.',
  '“Educational Institution”': '“Tổ chức giáo dục”',
  ': universities, colleges, scholarship organizations, and academic entities referenced on the Platform.':
    ': trường đại học, cao đẳng, trường học, tổ chức học bổng hoặc tổ chức giáo dục khác được đề cập trên Nền tảng.',
  '3. Eligibility and Account Terms': '3. Điều kiện sử dụng',
  'GlowBal is intended for users aged 16 and above. Users confirm they possess legal capacity, provide truthful details, and maintain security over their accounts.':
    'GlowBal dành cho Người dùng từ đủ 16 tuổi trở lên. Khi đăng ký hoặc sử dụng Dịch vụ, Người dùng xác nhận rằng đã đủ 16 tuổi, có đầy đủ năng lực để chấp nhận và thực hiện Điều khoản, cung cấp thông tin chính xác, trung thực và chịu trách nhiệm với tài khoản của mình.',
  'Users between 16 and 18 years of age are encouraged to use the Platform under parental or guardian supervision, especially for paid plans or direct mentor sessions.':
    'Người dùng từ 16 đến dưới 18 tuổi được khuyến nghị sử dụng Dịch vụ với sự đồng ý và giám sát của cha, mẹ hoặc người giám hộ hợp pháp, đặc biệt đối với các Dịch vụ có phát sinh thanh toán hoặc kết nối trực tiếp với Cố vấn/Achiever/Mentor.',
  '4. Scope of Services': '4. Phạm vi dịch vụ',
  'GlowBal provides technology tools to guide students through the university and scholarship application journey:':
    'GlowBal cung cấp nền tảng công nghệ hỗ trợ giáo dục và định hướng du học, bao gồm nhưng không giới hạn:',
  'GlowBal Matcher:': 'GlowBal Matcher:',
  'intelligent discovery for target universities, scholarships, and mentors;':
    'tìm kiếm và định hướng trường đại học, học bổng và Cố vấn;',
  'Strategy Master:': 'Strategy Master:',
  'profile diagnostics, strategic narratives, milestone timelines, CV, essays, and recommendation letters support;':
    'phân tích hồ sơ, xây dựng chiến lược, theo dõi tiến độ và hỗ trợ tài liệu như CV, bài luận và thư giới thiệu;',
  'My Portal:': 'My Portal:',
  'centralized selection tracker, application portfolio, and document vault;':
    'quản lý lựa chọn, theo dõi hồ sơ ứng tuyển và lưu trữ tài liệu;',
  'Comprehensive database of global universities and scholarships with AI assistance tools.':
    'Cơ sở dữ liệu về trường đại học, học bổng và Cố vấn; Các công cụ AI và dịch vụ trả phí khác.',
  'Services are designed for preparation and guidance and do not constitute formal legal or financial advice.':
    'Các Dịch vụ nhằm hỗ trợ Người dùng nghiên cứu, lập kế hoạch và chuẩn bị hồ sơ và không được xem là lời khuyên pháp lý, tài chính hoặc chuyên môn chính thức.',
  '5. Role of GlowBal': '5. Vai trò của GlowBal',
  'GlowBal is a technology and educational guidance platform. GlowBal is not a university, scholarship provider, admissions committee, or visa authority, and does not make final admission or visa determinations. All admissions and funding decisions belong solely to the respective institutions and authorities.':
    'GlowBal là nền tảng công nghệ và đơn vị hỗ trợ, cung cấp công cụ, thông tin và kết nối cho Người dùng. GlowBal không phải là trường đại học, tổ chức cấp học bổng, cơ quan tuyển sinh hoặc cơ quan cấp visa; không có quyền quyết định việc tuyển sinh, cấp học bổng hoặc cấp visa. Các quyết định cuối cùng thuộc về trường đại học, tổ chức học bổng và cơ quan có thẩm quyền tương ứng.',
  '6. No Guarantee of Outcomes': '6. Không cam kết về kết quả',
  'GlowBal does not guarantee university admission, scholarship awards, visa approval, or specific score improvements. Recommendations are advisory and analytical. Users are responsible for independently verifying all dates, requirements, and official instructions.':
    'GlowBal không cam kết hoặc bảo đảm rằng Người dùng sẽ được nhận vào một trường đại học cụ thể, nhận học bổng, được cấp visa hoặc đạt bất kỳ kết quả tuyển sinh cụ thể nào. Thông tin, phân tích, chiến lược và đề xuất trên GlowBal chỉ mang tính chất tham khảo và hỗ trợ. Người dùng có trách nhiệm tự kiểm tra và xác minh thông tin từ các nguồn chính thức trước khi đưa ra quyết định.',
  '7. User Responsibilities': '7. Trách nhiệm của người dùng',
  'Users agree to provide genuine materials, refrain from submitting fraudulent records, track deadlines independently, and preserve platform security and integrity.':
    'Người dùng cam kết cung cấp thông tin và tài liệu trung thực, không sử dụng hồ sơ hoặc tài liệu giả mạo, tự xác minh deadline, quy trình ứng tuyển và không can thiệp phá hoại hoạt động của Nền tảng.',
  '8. Refund Policy': '8. Chính sách hoàn tiền',
  '8.1. Timeframe:': '8.1. Thời hạn yêu cầu:',
  'Refund requests must be submitted within 24 hours of payment.':
    'Trong vòng 24 giờ kể từ thời điểm đăng ký và thanh toán Dịch vụ.',
  '8.2. Refund Rate:': '8.2. Mức hoàn tiền:',
  '90% of the paid fee is refunded (10% is retained to cover payment gateway processing and operating costs).':
    'Hoàn lại 90% số tiền đã thanh toán (10% còn lại giữ lại để bù đắp chi phí xử lý giao dịch, vận hành hệ thống).',
  '8.3. Request Process:': '8.3. Cách thức yêu cầu:',
  'Send an email to': 'Gửi email đến',
  'with subject line': 'với tiêu đề',
  '[REFUND REQUEST] – Full Name – Account Email': '[YÊU CẦU HOÀN TIỀN] – Họ tên – Email tài khoản',
  'along with transaction details.': 'kèm đầy đủ chi tiết giao dịch.',
  '8.4. Processing Time:': '8.4. Thời gian hoàn tiền:',
  '07–14 business days back to the original payment method or a verified alternative.':
    'Trong vòng 07–14 ngày làm việc về phương thức thanh toán ban đầu hoặc phương thức phù hợp.',
  '8.5. Ineligibility:': '8.5. Trường hợp không đủ điều kiện:',
  'Requests sent after 24 hours, unverified transactions, fraudulent activity, or violations of Terms are non-refundable.':
    'Gửi sau 24 giờ, không xác minh được giao dịch, có dấu hiệu gian lận hoặc vi phạm Điều khoản.',
  '9. Account Deferral Policy': '9. Chính sách bảo lưu tài khoản',
  'Users may request an account deferral for up to 06 months from the payment date. Account benefits and subscriptions are strictly non-transferable.':
    'Người dùng có thể yêu cầu bảo lưu tài khoản tối đa 06 tháng kể từ ngày thanh toán. Tài khoản và các quyền lợi đi kèm không được chuyển nhượng, cho mượn, cho thuê hoặc sử dụng bởi bên thứ ba.',
  '10. Intellectual Property': '10. Quyền sở hữu trí tuệ',
  'All software, content, branding, designs, frameworks, and digital assets on the Platform belong exclusively to GlowBal Education or its lawful licensors and are protected under international intellectual property law.':
    'Toàn bộ Nội dung, phần mềm, thiết kế, thương hiệu, logo và các tài sản trí tuệ khác trên Nền tảng thuộc sở hữu của GlowBal hoặc bên cấp phép hợp pháp và được bảo vệ theo quy định pháp luật về sở hữu trí tuệ.',
  '11. Privacy and Data Protection': '11. Quyền riêng tư và bảo vệ dữ liệu',
  'GlowBal processes personal data in accordance with our Privacy Policy published on the Platform, maintaining technical and organizational security standards.':
    'GlowBal thu thập và xử lý dữ liệu cá nhân của Người dùng theo Chính sách Bảo mật được công bố trên Nền tảng và áp dụng các biện pháp kỹ thuật, tổ chức phù hợp để bảo vệ dữ liệu.',
  '12. Limitation of Liability': '12. Miễn trừ và giới hạn trách nhiệm',
  'To the maximum extent permitted by applicable law, GlowBal’s total liability to any User shall not exceed the total fees paid by such User to GlowBal in the preceding 06 months.':
    'Trong phạm vi pháp luật cho phép, trách nhiệm của GlowBal đối với Người dùng sẽ không vượt quá tổng số tiền Người dùng đã thanh toán cho GlowBal trong 06 tháng gần nhất trước thời điểm phát sinh khiếu nại.',
  '13. Force Majeure': '13. Bất khả kháng',
  'GlowBal is not liable for service delays or interruptions caused by events beyond reasonable control, including natural disasters, third-party infrastructure outages, or third-party AI/API policy modifications.':
    'GlowBal không chịu trách nhiệm đối với sự chậm trễ hoặc không thể thực hiện nghĩa vụ do các sự kiện nằm ngoài khả năng kiểm soát hợp lý như thiên tai, dịch bệnh, chiến tranh, sự cố kỹ thuật bên thứ ba hoặc thay đổi chính sách từ nhà cung cấp API/AI.',
  '14 - 19. Suspension, Termination & Governing Law': '14 - 19. Tạm ngừng, sửa đổi & Điều khoản chung',
  'GlowBal reserves the right to suspend or terminate accounts in breach of these Terms. These Terms are governed by the laws of the Socialist Republic of Vietnam. Any dispute will first be resolved through friendly mutual negotiation.':
    'GlowBal có quyền tạm ngừng hoặc chấm dứt tài khoản vi phạm Điều khoản. GlowBal có quyền sửa đổi Điều khoản và công bố phiên bản cập nhật trên Nền tảng. Điều khoản được điều chỉnh theo pháp luật nước CHXHCN Việt Nam. Mọi tranh chấp ưu tiên giải quyết qua thương lượng.',
  '20. Contact Information': '20. Thông tin liên hệ',
  'GLOWBAL EDUCATION': 'GLOWBAL EDUCATION',
  '📧 Email:': '📧 Email:',
  '🌐 Website:': '🌐 Website:',
  'GlowBal Education': 'GlowBal Education',
  'GO GLOW – GO GLOBAL ✈️🌍': 'GO GLOW – GO GLOBAL ✈️🌍',

  // ── Personal Canvas Report (PR #199) ─────────────────────────────────────
  'Experiences analysed': 'Hoạt động đã phân tích',
  'Activities contributing evidence to this report': 'Các hoạt động đóng góp minh chứng cho báo cáo này',
  'Strong evidence items': 'Minh chứng nổi bật',
  'Experiences with evidence, outcomes and demonstrated capability': 'Trải nghiệm có minh chứng, kết quả và năng lực thực tế',
  'Checkable evidence': 'Minh chứng có thể đối chiếu',
  'Verified or attributable evidence sources': 'Nguồn minh chứng đã xác thực hoặc có thể quy chiếu',
  'Recorded outcomes': 'Kết quả đã ghi nhận',
  'Experiences with a stated result or change': 'Trải nghiệm có kết quả hoặc sự thay đổi cụ thể',
  'Quantified outcomes': 'Kết quả định lượng',
  'Outcomes containing a measurable result': 'Kết quả chứa số liệu đo lường được',
  'Capabilities evidenced': 'Năng lực được chứng minh',
  'Distinct grounded capability labels across experiences': 'Các nhóm năng lực rõ ràng được thể hiện qua các trải nghiệm',
  'Applicant Snapshot': 'Tổng quan Ứng viên',
  'Applicant profile themes': 'Chủ đề hồ sơ ứng viên',
  'Evidence base': 'Cơ sở minh chứng',
  'Where your profile can become stronger': 'Điểm có thể phát triển thêm trong hồ sơ',
  'Evidence gap': 'Khoảng trống minh chứng',
  'Growth opportunity': 'Cơ hội phát triển',
  'Suggested direction': 'Định hướng đề xuất',
  'Build more specific, verifiable evidence in this area so GlowBal can distinguish an emerging capability from a genuine development gap.':
    'Xây dựng thêm minh chứng cụ thể, có thể kiểm chứng trong phần này để GlowBal làm nổi bật năng lực tiềm năng của bạn.',
  'No high-confidence growth gaps identified yet.': 'Chưa phát hiện khoảng trống phát triển đáng kể nào.',
  'As you add more reflected experiences, GlowBal can distinguish genuine development opportunities from simple missing data.':
    'Khi bạn bổ sung thêm các trải nghiệm phản tư, GlowBal sẽ phân tích rõ hơn các cơ hội phát triển tiềm năng.',
  'Key Takeaways': 'Điểm cốt lõi cần nhớ',
  'What to remember before you build the application': 'Những điều cần lưu ý trước khi xây dựng hồ sơ',
  'Three evidence-backed ideas to carry into your positioning, university matching and application strategy.':
    'Ba ý tưởng dựa trên minh chứng thực tế giúp bạn định vị bản thân, chọn trường và lên chiến lược ứng tuyển.',
  'What Makes You Stand Out': 'Điểm khiến bạn nổi bật',
  'Your Competitive Advantage': 'Lợi thế cạnh tranh của bạn',
  'Your Growth Opportunity': 'Cơ hội bứt phá của bạn',
  '. Personal Canvas': '. Personal Canvas',
  'View section →': 'Xem phần này →',
  'Personal Canvas': 'Bản đồ cá nhân (Personal Canvas)',
  'Your applicant profile, in six connected parts': 'Hồ sơ ứng viên của bạn qua 6 phần kết nối chặt chẽ',
  'Start with the whole picture, then open any area to see the evidence and reasoning behind it.':
    'Bắt đầu với bức tranh tổng thể, sau đó mở từng khu vực để xem minh chứng và lập luận chi tiết.',
  'Driving Forces': 'Động lực thúc đẩy',
  'Proven Capabilities': 'Năng lực đã chứng minh',
  'Areas for Growth': 'Điểm cần phát triển',
  'Social Proof': 'Minh chứng xã hội & Công nhận',
  'Long-Term Vision': 'Tầm nhìn dài hạn',
  'Forces': 'Động lực',
  'Capabilities': 'Năng lực',
  'Proof': 'Minh chứng',
  'Growth': 'Phát triển',
  'Vision': 'Tầm nhìn',
  'Personal Report sections': 'Các phần của Báo cáo Cá nhân',
  'A profile of who you are as an applicant — built from your reflected experiences, evidence and recurring patterns.':
    'Bức chân dung về bản thân bạn với tư cách là ứng viên — được xây dựng từ các trải nghiệm phản tư, minh chứng và mô thức tính cách nổi bật.',
  '✨ GLOWBAL PLUS': '✨ GLOWBAL PLUS',
  'Upgrade to GlowBal Plus to view your personalized application narrative, tailored storytelling angle, and strategic essays guidance.':
    'Nâng cấp GlowBal Plus để xem câu chuyện hồ sơ cá nhân hóa, góc kể chuyện phù hợp và hướng dẫn chiến lược bài luận.',
  'Unlock your strategic narrative': 'Mở khóa câu chuyện chiến lược của bạn',
};
