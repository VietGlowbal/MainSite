/**
 * Vietnamese for the sales-journey Home (design handoff 2026-09-27).
 *
 * English source string → Vietnamese, merged into the runtime catalog by
 * `i18n-catalog.ts` like the other feature catalogs. Keys must match the
 * English at the call site character for character.
 *
 * ⚠️ DRAFTS. Where the handoff supplied Vietnamese (`glowbal-home-data.js`) it
 * is used; everything else — most of the team roster, the form's errors and
 * success copy — is a draft written for this build. The handoff's own note
 * applies: have a native speaker review before relying on it. Strings that
 * already had an owner-approved translation elsewhere in the catalog are NOT
 * redefined here (e.g. "Have you ever?", "Study", "Register for Free
 * Consultation"), so this file never silently changes copy on another page.
 *
 * Not here on purpose: people's names, school names, university and country
 * names (never translated — rendered with `data-no-auto-translate`), and the
 * student quotes, which carry their own Vietnamese original in
 * features/marketing/domain/home-content.ts.
 */
export const HOME_TRANSLATIONS: Record<string, string> = {
  /* ── Hero + globe ─────────────────────────────────────────────────────── */
  'A collection of insights from 3,000+ scholarships and 700+ universities worldwide.':
    'Kho dữ liệu chuyên sâu từ hơn 3.000 học bổng và hơn 700 trường đại học trên toàn thế giới.',
  // Highlighted keywords (home-highlight.tsx). Each Vietnamese value must occur
  // verbatim in its sentence's Vietnamese above, or the highlight is skipped.
  '3,000+ scholarships': 'hơn 3.000 học bổng',
  '700+ universities': 'hơn 700 trường đại học',
  'With insights from 3,000+ scholarships, we help you apply for the best global education route.':
    'Với dữ liệu từ hơn 3.000 học bổng, chúng tôi giúp bạn ứng tuyển theo lộ trình du học tốt nhất.',
  'Countries with GlowBal scholarship data · drag to spin':
    'Quốc gia có dữ liệu học bổng GlowBal · kéo để xoay',
  'GlowBal has scholarship data for:': 'GlowBal có dữ liệu học bổng tại:',
  '{country} ({count} scholarships)': '{country} ({count} học bổng)',
  '{count} scholarships': '{count} học bổng',

  /* ── Scholarship showcase / library preview ──────────────────────────── */
  "Choose from 900+ of the world's leading universities with {value} in total scholarship value":
    'Chọn từ hơn 900 trường đại học hàng đầu thế giới với tổng giá trị học bổng {value}',
  '900+': 'hơn 900',
  'Want the full library and the scholarships that fit you? Register for a free consultation — a GlowBal mentor will send you your shortlist.':
    'Muốn xem toàn bộ thư viện và các học bổng phù hợp với bạn? Đăng ký tư vấn miễn phí — mentor GlowBal sẽ gửi bạn danh sách rút gọn.',
  'Register for free consultation': 'Đăng ký tư vấn miễn phí',

  /* ── Success stories ─────────────────────────────────────────────────── */
  'Student stories': 'Câu chuyện học sinh',
  // Owner, 2026-09-29: "Scholarship" dropped from the section title.
  'GlowBal Success Stories': 'Câu chuyện thành công cùng GlowBal',
  'Success Stories': 'Câu chuyện thành công',
  // The label under Phạm Quỳnh Chi's name. Kept in English on /vi too, as the
  // site already does for "Mentee" ("Trở thành Mentee của GlowBal").
  'Star Mentee': 'Star Mentee',
  "Watch Chi's story": 'Xem câu chuyện của Chi',
  'Student quotes': 'Chia sẻ của học sinh',
  'Translated from Vietnamese': 'Dịch từ tiếng Việt',
  'Read more': 'Xem thêm',
  'Show less': 'Thu gọn',
  '100% Merit-based Scholarship for Bachelor of Business Administration — VinUniversity':
    'Học bổng tài năng 100% ngành Quản trị Kinh doanh — VinUniversity',
  '100% Scholarship — Fulbright University': 'Học bổng 100% — Đại học Fulbright',
  'Vice Chancellor Scholarship — RMIT': 'Học bổng Vice Chancellor — RMIT',
  'Education Development Scholarship — BUV': 'Học bổng Phát triển Giáo dục — BUV',
  'Full Scholarship — Lingnan University': 'Học bổng toàn phần — Đại học Lingnan',

  /* ── Standout numbers ────────────────────────────────────────────────── */
  'Numbers say it all': 'Những con số nói lên tất cả',
  'Measured momentum behind a clearer scholarship journey.':
    'Những dấu ấn thực tế tạo nên một hành trình học bổng rõ ràng hơn.',
  'Web access': 'Lượt truy cập website',
  'Regular users': 'Người dùng thường xuyên',
  'Investment from Venture X Incubation Program': 'Đầu tư từ chương trình ươm tạo Venture X',
  'Awarded from Academy of Finance': 'Giải thưởng từ Học viện Tài chính',
  // The proof images under the four numbers (home-metrics-grid.tsx).
  "GlowBal's university directory on glowbal-education.com":
    'Thư viện trường đại học của GlowBal trên glowbal-education.com',
  'Students who use GlowBal': 'Học sinh đang sử dụng GlowBal',
  'The GlowBal team on stage at Venture X Demo Day with its certificate':
    'Đội ngũ GlowBal trên sân khấu Venture X Demo Day cùng chứng nhận tham gia',
  'The GlowBal team receiving the Runner-up prize at the Young Entrepreneurship 2026 final':
    'Đội ngũ GlowBal nhận giải Á quân tại Chung kết cuộc thi Khởi nghiệp trẻ 2026',
  'Backed by VinUniversity (Venture X) & AOF (Young Startup Competition)':
    'Được VinUniversity (Venture X) & Học viện Tài chính (Young Startup Competition) hỗ trợ',
  AOF: 'AOF',

  /* ── Team ────────────────────────────────────────────────────────────── */
  'GlowBal Team': 'Đội ngũ GlowBal',
  'GlowBal is driven by a distinguished team across technology, education, research, and communication, with first-hand experience in scholarships and study-abroad journeys. Combining student insight, specialist expertise, and technology, we turn fragmented advice into a clear, personalised system — from identifying the right competitions and research opportunities to strengthening CVs, SOPs, and overall application stories.':
    'GlowBal được dẫn dắt bởi đội ngũ xuất sắc trong các lĩnh vực công nghệ, giáo dục, nghiên cứu và truyền thông, với trải nghiệm thực tế về học bổng và hành trình du học. Kết hợp góc nhìn của học sinh, chuyên môn sâu và công nghệ, chúng tôi biến những lời khuyên rời rạc thành một hệ thống rõ ràng, cá nhân hoá — từ tìm đúng cuộc thi và cơ hội nghiên cứu đến hoàn thiện CV, SOP và câu chuyện hồ sơ tổng thể.',
  'The GlowBal team at Venture X Demo Day': 'Đội ngũ GlowBal tại Venture X Demo Day',
  '+{count} more': '+{count} thành tích khác',
  Supporter: 'Người hỗ trợ',
  'Technical & Academic Advisor': 'Cố vấn Kỹ thuật & Học thuật',
  'Academic & Extracurricular Advisor': 'Cố vấn Học thuật & Ngoại khoá',
  'Technical Advisor': 'Cố vấn Kỹ thuật',
  Work: 'Kinh nghiệm',
  'students guided to VinUniversity merit scholarships': 'học sinh được hướng dẫn giành học bổng tài năng VinUniversity',
  'Master of Computer Science': 'Thạc sĩ Khoa học Máy tính',
  'Bachelor of Business Administration (80% Merit-based Scholarship)':
    'Cử nhân Quản trị Kinh doanh (Học bổng tài năng 80%)',
  'Bachelor of Business Administration': 'Cử nhân Quản trị Kinh doanh',
  'Bachelor of Information Technology': 'Cử nhân Công nghệ Thông tin',
  'Bachelor of International Political Economics': 'Cử nhân Kinh tế Chính trị Quốc tế',
  'Bachelor of Economics': 'Cử nhân Kinh tế',
  'Bachelor of Customs and Logistics': 'Cử nhân Hải quan và Logistics',
  // James David Lapslie
  'Finalist, Undergraduate of the Year 2026 (AI category)':
    'Chung kết, Undergraduate of the Year 2026 (hạng mục AI)',
  'Semi-finalist, Inter-Campus Enterprise Competition 2025 & 2026':
    'Bán kết, Inter-Campus Enterprise Competition 2025 & 2026',
  'Led a team of eight to win the Birmingham Project Award with Siemens UK':
    'Dẫn dắt nhóm tám người giành Birmingham Project Award cùng Siemens UK',
  'Led a team of six to complete the Engineering Education Scheme with GKN Automotive':
    'Dẫn dắt nhóm sáu người hoàn thành Engineering Education Scheme cùng GKN Automotive',
  'Vice-President, University Debate Society': 'Phó Chủ tịch, Câu lạc bộ Tranh biện của trường',
  'Bronze winner, Birmingham Debate Pro Am 2026': 'Giải Đồng, Birmingham Debate Pro Am 2026',
  'Accepted onto the Algoverse 2026 AI research program':
    'Được chọn vào chương trình nghiên cứu AI Algoverse 2026',
  'Accepted into the Engineering and Science Leadership Academy 2026':
    'Được chọn vào Engineering and Science Leadership Academy 2026',
  // Nguyễn Khánh Linh
  'Represented VinUniversity on exchange at the University of Birmingham, UK':
    'Đại diện VinUniversity trao đổi tại University of Birmingham, Vương quốc Anh',
  'Advised 1 × 100%, 4 × 80%, 7 × 70–75% Merit-based Scholarship winners at VinUniversity (incl. CBM, CAS and CECS)':
    'Tư vấn cho 1 học sinh đạt học bổng tài năng 100%, 4 × 80%, 7 × 70–75% tại VinUniversity (gồm CBM, CAS và CECS)',
  "4-time Dean's List Academic Award recipient": '4 lần đạt Giải thưởng Học thuật Dean’s List',
  'Worked at VinDynamics – Vingroup and Laulau Learning Vietnam':
    'Từng làm việc tại VinDynamics – Vingroup và Laulau Learning Vietnam',
  // Nguyễn Hoàng Linh
  '80% merit-based scholarship at Carnegie Mellon University':
    'Học bổng tài năng 80% tại Carnegie Mellon University',
  '75% Merit-based Scholarship, VinUniversity': 'Học bổng tài năng 75%, VinUniversity',
  'Worked at EY Consulting Vietnam': 'Từng làm việc tại EY Consulting Vietnam',
  // Phạm Quỳnh Chi
  'Back at GlowBal in a new role, I bring first-hand experience to help you strengthen your SOP & CV, build a strategic extracurricular profile and map a clear path to your dream universities.':
    'Trở lại GlowBal với vai trò mới, mình mang theo trải nghiệm thực tế để giúp bạn hoàn thiện SOP & CV, xây dựng hồ sơ ngoại khoá có chiến lược và vạch ra lộ trình rõ ràng đến ngôi trường mơ ước.',
  '100% Merit-based Scholarship (BBA) — VinUniversity': 'Học bổng tài năng 100% (BBA) — VinUniversity',
  'First Runner-Up, Social Pioneers (Social Marketing Competition)':
    'Giải Nhì, Social Pioneers (cuộc thi Social Marketing)',
  'Second Runner-Up, ISME Debate Contest': 'Giải Ba, cuộc thi Tranh biện ISME',
  'Encouragement Prize, RMIT Business Plan Competition': 'Giải Khuyến khích, RMIT Business Plan Competition',
  // Nguyễn Văn Huấn
  'With experience in AI research, innovation, and technology competitions, I help students build a strong academic profile, discover research and STEM opportunities, and navigate program and scholarship applications abroad with greater confidence.':
    'Với kinh nghiệm nghiên cứu AI, đổi mới sáng tạo và các cuộc thi công nghệ, mình giúp học sinh xây dựng hồ sơ học thuật vững chắc, khám phá cơ hội nghiên cứu và STEM, và tự tin hơn khi ứng tuyển chương trình học và học bổng ở nước ngoài.',
  'First Author, MVA research paper on nighttime vehicle localisation — under review at Neural Computing and Applications (Q1 Scopus)':
    'Tác giả chính, bài nghiên cứu MVA về định vị phương tiện ban đêm — đang được bình duyệt tại Neural Computing and Applications (Q1 Scopus)',
  'Bronze Prize, FTU Student Scientific Research Competition (Vietnamese NLP sentiment analysis)':
    'Giải Đồng, cuộc thi Nghiên cứu Khoa học Sinh viên FTU (phân tích cảm xúc NLP tiếng Việt)',
  'Team Leader, AuraBeam Research Project (AI-powered anti-glare adaptive headlights)':
    'Trưởng nhóm, dự án nghiên cứu AuraBeam (đèn pha thích ứng chống chói dùng AI)',
  'Top 2 & Top 8, SOICT Technology Showcase (HUST)': 'Top 2 & Top 8, SOICT Technology Showcase (HUST)',
  'Top 25, VinUni Datathon': 'Top 25, VinUni Datathon',
  'Active in research, entrepreneurship and innovation initiatives at HUST':
    'Tích cực tham gia các hoạt động nghiên cứu, khởi nghiệp và đổi mới sáng tạo tại HUST',
  // Tạ Đức Hiển
  'From data/research competitions and academic projects to scholarship positioning, I provide practical guidance to make your profile stronger, more distinctive, and application-ready.':
    'Từ các cuộc thi dữ liệu/nghiên cứu và dự án học thuật đến định vị học bổng, mình đưa ra hướng dẫn thực tế để hồ sơ của bạn mạnh hơn, khác biệt hơn và sẵn sàng ứng tuyển.',
  'Second Runner-up, HBAAC': 'Giải Ba, HBAAC',
  'Top 8 HUST Representatives, G-TIP Competition (South Korea & Malaysia)':
    'Top 8 đại diện HUST, cuộc thi G-TIP (Hàn Quốc & Malaysia)',
  'Second Runner-up, Data Science Talent Competition 2026': 'Giải Ba, Data Science Talent Competition 2026',
  'Second Prize, Student Scientific Research Competition 2025': 'Giải Nhì, cuộc thi Nghiên cứu Khoa học Sinh viên 2025',
  'Cumulative GPA 4.0/4.0': 'GPA tích luỹ 4.0/4.0',
  '3-time recipient, Academic Encouragement Scholarship': '3 lần nhận Học bổng Khuyến khích Học tập',
  'Outstanding Student Award 2024–2025': 'Giải thưởng Sinh viên Xuất sắc 2024–2025',
  // Phùng Thị Hương
  'Drawing from my experience in case competitions, research, and extracurricular activities, I can help students discover the right opportunities, build a standout profile, and navigate their study-abroad journey with confidence.':
    'Từ kinh nghiệm tham gia các cuộc thi giải case, nghiên cứu và hoạt động ngoại khoá, mình có thể giúp học sinh tìm đúng cơ hội, xây dựng hồ sơ nổi bật và tự tin trên hành trình du học.',
  '1st Runner-up, Social Marketing Competition': 'Giải Nhì, cuộc thi Social Marketing',
  'Consolation Prize, WAH Business Case Competition': 'Giải Khuyến khích, WAH Business Case Competition',
  '2 conference papers': '2 bài báo hội thảo',
  '2-time recipient, Academic Encouragement Scholarship': '2 lần nhận Học bổng Khuyến khích Học tập',
  // Lý Giai Mẫn
  'IELTS Overall 9.0': 'IELTS Overall 9.0',
  'VinUniversity Scholarship — 80% tuition': 'Học bổng VinUniversity — 80% học phí',
  // Chu Tuấn Linh
  'HKUST Top 1% Achiever': 'Top 1% HKUST Achiever',
  'Outstanding Achievement in AI & Data Science': 'Thành tích Xuất sắc về AI & Khoa học Dữ liệu',
  'Runner-up, Young Entrepreneurship Competition 2026':
    'Á quân, cuộc thi Young Entrepreneurship Competition 2026',
  // Nguyễn Tuấn Kiên
  '"5 Good Students" Award 2024–2025': 'Danh hiệu "Sinh viên 5 tốt" 2024–2025',
  'Top 5 Finalist, Gems of AOF': 'Top 5 chung kết, Gems of AOF',

  /* ── Your GlowBal journey (content PDF (3) §6) ───────────────────────── */
  'Your GlowBal journey': 'Hành trình cùng GlowBal',
  'How to “Hunt Scholarship” with GlowBal?': 'Làm thế nào để “săn học bổng” cùng GlowBal?',
  'Hunt Scholarship': 'săn học bổng',
  'GlowBal Matcher: Unlock Best-Fit Scholarships and Universities':
    'GlowBal Matcher: Mở khoá học bổng và trường phù hợp nhất',
  'Finish a short quiz to identify high-value scholarships tailored to your profile and your universities.':
    'Hoàn thành một bài quiz ngắn để tìm ra những học bổng giá trị cao, phù hợp với hồ sơ và các trường bạn chọn.',
  'Free Consultation': 'Tư vấn miễn phí',
  'Strategy Master: Craft Your Winning Strategy': 'Strategy Master: Xây dựng chiến lược chiến thắng',
  'Build a compelling application strategy, highlighting your unique strengths and showcasing your potential.':
    'Xây dựng chiến lược ứng tuyển thuyết phục, làm nổi bật điểm mạnh riêng và thể hiện tiềm năng của bạn.',
  'Work closely with dedicated experts who guide and support you through every detail until success.':
    'Làm việc cùng các chuyên gia tận tâm, đồng hành và hỗ trợ bạn trong từng chi tiết cho đến khi thành công.',
  'Conquer your Dream with GlowBal AI and experts': 'Chinh phục ước mơ cùng GlowBal AI và chuyên gia',
  'You are not alone, our experts are here to oversee your application with our AI.':
    'Bạn không đơn độc — chuyên gia của chúng tôi cùng GlowBal AI sẽ theo sát hồ sơ của bạn.',

  /* ── Product features ────────────────────────────────────────────────── */
  'Two tools. One clearer decision.': 'Hai công cụ. Một quyết định rõ ràng hơn.',
  'One clearer decision.': 'Một quyết định rõ ràng hơn.',
  // Product name, kept as is — same convention as `AOF: 'AOF'` above.
  'GlowBal AI': 'GlowBal AI',
  'With Strategy Master, GlowBal AI helps you understand your profile, evaluate your fit and turn your study-abroad goals into an actionable strategy.':
    'Với Strategy Master, GlowBal AI giúp bạn hiểu hồ sơ của mình, đánh giá mức độ phù hợp và chuyển mục tiêu du học thành một chiến lược có thể thực hiện.',
  'Every deadline and task on one timeline.': 'Mọi hạn chót và đầu việc trên một dòng thời gian.',
  'Feedback on your statement of purpose.': 'Góp ý cho bài luận mục tiêu của bạn.',
  'Sharpen your CV for each programme.': 'Hoàn thiện CV cho từng chương trình.',
  '{title} demo video': 'Video demo {title}',
  'Play {title} demo video': 'Phát video demo {title}',

  /* ── Pricing ─────────────────────────────────────────────────────────── */
  'GlowBal packages': 'Gói GlowBal',
  'Become a GlowBal Mentee TODAY!': 'Trở thành Mentee của GlowBal NGAY HÔM NAY!',
  'TODAY!': 'NGAY HÔM NAY!',
  'GlowBal is proud to be a pioneering education platform to combine AI and human power with an affordable price.':
    'GlowBal tự hào là nền tảng giáo dục tiên phong kết hợp sức mạnh của AI và con người với mức giá phải chăng.',
  'AI and human power': 'sức mạnh của AI và con người',
  'Launching Offer: 50% off all packages during 2026.': 'Ưu đãi ra mắt: Giảm 50% cho tất cả các gói trong năm 2026.',
  'Human mentor': 'Mentor đồng hành',
  'Choose how you {glow} on your study-abroad journey': 'Chọn cách bạn {glow} trên hành trình du học',
  glow: 'toả sáng',
  'Most chosen': 'Được chọn nhiều nhất',
  Was: 'Giá gốc',
  '/year': '/năm',
  '≈ {amount}/month': '≈ {amount}/tháng',
  'Get Free': 'Dùng miễn phí',
  'Get Yearly Premium Plan': 'Chọn gói Yearly Premium',
  'Get Yearly Plan': 'Chọn gói Yearly',
  'Access university & major research tools': 'Truy cập công cụ tìm hiểu trường & ngành học',
  'Discover best-fit scholarship opportunities': 'Khám phá cơ hội học bổng phù hợp nhất',
  'Get free 1-on-1 personalised expert advice': 'Nhận tư vấn 1-1 cá nhân hoá miễn phí từ chuyên gia',
  'Everything in Yearly, plus end-to-end human mentorship':
    'Mọi quyền lợi của gói Yearly, cùng mentor đồng hành trọn quy trình',
  'Full application package review by human experts': 'Chuyên gia review toàn bộ bộ hồ sơ ứng tuyển',
  'Dedicated scholarship strategy with our in-house team': 'Chiến lược học bổng riêng cùng đội ngũ nội bộ',
  'Priority 1-on-1 support throughout the process': 'Hỗ trợ 1-1 ưu tiên trong suốt quá trình',
  '3 free 1-on-1 sessions with Scholarship Mentors': '3 buổi 1-1 miễn phí với Scholarship Mentor',
  'Everything in Starter, plus full AI tools & mentor support':
    'Mọi quyền lợi của gói Starter, cùng bộ công cụ AI đầy đủ & mentor hỗ trợ',
  'Unlimited personalised roadmaps & university lists': 'Lộ trình & danh sách trường cá nhân hoá không giới hạn',
  '24/7 AI Companion & scholarship matching': 'AI Companion 24/7 & ghép học bổng',
  'Unlimited CV/SOP AI review': 'Review CV/SOP bằng AI không giới hạn',
  '1 free 1-on-1 session with a Scholarship Mentor': '1 buổi 1-1 miễn phí với Scholarship Mentor',
  'Full application progress tracking': 'Theo dõi toàn bộ tiến độ ứng tuyển',

  /* ── Consultation form ───────────────────────────────────────────────── */
  // The left column is the team photo again (2026-10-01); its caption strings
  // ("The GlowBal team", "Start with a dream university. Leave with a
  // scholarship plan.") already have Vietnamese in i18n-dictionary.ts.
  'Register for Free Scholarship Consultation with GlowBal Mentors':
    'Đăng ký tư vấn học bổng miễn phí cùng mentor GlowBal',
  'Your full name': 'Họ và tên của bạn',
  'dd/mm/yyyy': 'dd/mm/yyyy',
  'From your account': 'Từ tài khoản của bạn',
  'Where would you like to study?': 'Bạn muốn du học ở đâu?',
  'A country or a university': 'Quốc gia hoặc tên trường',
  'Study-abroad budget': 'Ngân sách du học',
  'Choose…': 'Chọn…',
  'Under 300 million VND (< 300 triệu VND)': 'Dưới 300 triệu VND',
  '300–500 million VND': '300–500 triệu VND',
  '500–800 million VND': '500–800 triệu VND',
  'Over 800 million VND (> 800 triệu VND)': 'Trên 800 triệu VND',
  'Choose your GlowBal package': 'Chọn gói GlowBal',
  'You picked {package} — change anytime': 'Bạn đã chọn {package} — có thể đổi bất cứ lúc nào',
  'This field is required.': 'Vui lòng điền thông tin này.',
  'Enter a valid email address, e.g. you@example.com': 'Vui lòng nhập email hợp lệ, ví dụ you@example.com',
  'Enter your date of birth as dd/mm/yyyy.': 'Vui lòng nhập ngày sinh theo dạng dd/mm/yyyy.',
  'Enter a valid phone number.': 'Vui lòng nhập số điện thoại hợp lệ.',
  'Please agree to the privacy policy to continue.': 'Vui lòng đồng ý với chính sách bảo mật để tiếp tục.',
  'Too many requests, try again in a minute.': 'Quá nhiều yêu cầu, vui lòng thử lại sau một phút.',
  'Request Consultation': 'Gửi yêu cầu tư vấn',
  "You're registered!": 'Bạn đã đăng ký thành công!',
  "We've emailed {email}.": 'Chúng tôi đã gửi email tới {email}.',
  "We've received your details for {email}.": 'Chúng tôi đã nhận thông tin của {email}.',
  'A GlowBal mentor will contact you shortly.': 'Mentor GlowBal sẽ sớm liên hệ với bạn.',
  'Create your free account with this email to unlock free scholarship & university search.':
    'Tạo tài khoản miễn phí bằng email này để mở khoá tính năng tìm học bổng & trường đại học miễn phí.',
  'Sign up free': 'Đăng ký miễn phí',
  'Prefer to talk now?': 'Muốn trao đổi ngay?',
};
