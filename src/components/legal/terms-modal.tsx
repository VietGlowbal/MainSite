'use client';

import { Modal } from '@/shared/ui';
import { useLanguage } from '@/lib/i18n';

export function TermsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const isVi = lang === 'vi';

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={t('Terms and Conditions of Use')}
      className="max-w-2xl p-0 overflow-hidden"
    >
      <div className="flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#EDE9EE] px-6 py-4 bg-[#FBF9FA]">
          <div>
            <h2 className="text-lg font-bold text-[#141118]">
              {isVi ? 'ĐIỀU KHOẢN VÀ ĐIỀU KIỆN SỬ DỤNG' : 'TERMS AND CONDITIONS OF USE'}
            </h2>
            <p className="text-xs text-[#6B6570]">
              {isVi ? 'NỀN TẢNG GLOWBAL EDUCATION · Cập nhật lần cuối: 15/08/2026' : 'GLOWBAL EDUCATION PLATFORM · Last updated: 15/08/2026'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#6B6570] hover:bg-[#EDE9EE] hover:text-[#141118] transition-colors cursor-pointer"
            aria-label={t('Close')}
          >
            ✕
          </button>
        </div>

        {/* Modal Body - Scrollable Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-[#2B2730] leading-relaxed">
          {/* Section 1 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              1. {isVi ? 'CHẤP NHẬN ĐIỀU KHOẢN' : 'ACCEPTANCE OF TERMS'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'Bằng việc truy cập, đăng ký hoặc sử dụng nền tảng GlowBal Education (“GlowBal”, “Nền tảng”, “chúng tôi”), bao gồm website, ứng dụng và các dịch vụ liên quan (“Dịch vụ”), Người dùng (“Bạn”, “Người dùng”) xác nhận rằng đã đọc, hiểu và đồng ý tuân thủ các Điều khoản và Điều kiện Sử dụng này (“Điều khoản”).'
                : 'By accessing, registering for, or using the GlowBal Education platform (“GlowBal”, “Platform”, “we”, “us”), including the website, applications, and related services (“Services”), the User (“You”, “User”) confirms that they have read, understood, and agreed to comply with these Terms and Conditions of Use (“Terms”).'}
            </p>
            <p>
              {isVi
                ? 'Nếu bạn không đồng ý với bất kỳ nội dung nào của Điều khoản, vui lòng không sử dụng Dịch vụ.'
                : 'If you do not agree with any part of these Terms, please do not use the Services.'}
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              2. {isVi ? 'ĐỊNH NGHĨA' : 'DEFINITIONS'}
            </h3>
            <p className="mb-2">{isVi ? 'Trong Điều khoản này:' : 'In these Terms:'}</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>{isVi ? '“Nền tảng”' : '“Platform”'}</b> {isVi ? 'là hệ thống website, ứng dụng và các sản phẩm công nghệ do GlowBal vận hành.' : 'is the website, application, and technology ecosystem operated by GlowBal Education.'}
              </li>
              <li>
                <b>{isVi ? '“Dịch vụ”' : '“Services”'}</b> {isVi ? 'là toàn bộ sản phẩm, tính năng và dịch vụ được GlowBal cung cấp trên Nền tảng.' : 'is all features, digital tools, mentoring connections, and guidance products provided on the Platform.'}
              </li>
              <li>
                <b>{isVi ? '“Nội dung”' : '“Content”'}</b> {isVi ? 'là thông tin, dữ liệu, văn bản, hình ảnh, video, phần mềm, tài liệu và các tài sản khác được cung cấp trên Nền tảng.' : 'is information, data, copy, images, videos, software, documents, and resources available on the Platform.'}
              </li>
              <li>
                <b>{isVi ? '“Người dùng”' : '“User”'}</b> {isVi ? 'là cá nhân đăng ký hoặc sử dụng Dịch vụ, bao gồm cả người dùng miễn phí và người dùng trả phí.' : 'is any individual who registers or uses the Services, whether free or paid.'}
              </li>
              <li>
                <b>{isVi ? '“Cố vấn/Achiever/Mentor”' : '“Mentor / Advisor”'}</b> {isVi ? 'là cá nhân hoặc tổ chức cung cấp dịch vụ tư vấn, cố vấn hoặc hỗ trợ thông qua hoặc liên quan đến Nền tảng.' : 'is individuals or organizations offering advisory guidance and feedback through the Platform.'}
              </li>
              <li>
                <b>{isVi ? '“Tổ chức giáo dục”' : '“Educational Institution”'}</b> {isVi ? 'là trường đại học, cao đẳng, trường học, tổ chức học bổng hoặc tổ chức giáo dục khác được đề cập trên Nền tảng.' : 'is universities, colleges, scholarship organizations, and academic entities referenced on the Platform.'}
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              3. {isVi ? 'ĐIỀU KIỆN SỬ DỤNG' : 'ELIGIBILITY AND ACCOUNT TERMS'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'GlowBal dành cho Người dùng từ đủ 16 tuổi trở lên.'
                : 'GlowBal is intended for users aged 16 and above.'}
            </p>
            <p className="mb-2">{isVi ? 'Khi đăng ký hoặc sử dụng Dịch vụ, Người dùng xác nhận rằng:' : 'When registering or using the Services, the User confirms that:'}</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>{isVi ? 'Đã đủ 16 tuổi;' : 'They are at least 16 years of age;'}</li>
              <li>{isVi ? 'Có đầy đủ năng lực để chấp nhận và thực hiện Điều khoản;' : 'They possess legal capacity to accept and execute these Terms;'}</li>
              <li>{isVi ? 'Cung cấp thông tin chính xác, đầy đủ và trung thực;' : 'They provide accurate, complete, and truthful information;'}</li>
              <li>{isVi ? 'Sử dụng Dịch vụ cho mục đích hợp pháp;' : 'They use the Services for lawful purposes;'}</li>
              <li>{isVi ? 'Chịu trách nhiệm đối với hoạt động phát sinh từ tài khoản của mình.' : 'They take full responsibility for activities under their account.'}</li>
            </ul>
            <p className="mb-2">
              {isVi
                ? 'Người dùng từ 16 đến dưới 18 tuổi được khuyến nghị sử dụng Dịch vụ với sự đồng ý và giám sát của cha, mẹ hoặc người giám hộ hợp pháp, đặc biệt đối với các Dịch vụ có phát sinh thanh toán hoặc kết nối trực tiếp với Cố vấn/Achiever/Mentor.'
                : 'Users between 16 and 18 years of age are encouraged to use the Platform under parental or guardian supervision, especially for paid plans or direct mentor sessions.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'GlowBal có quyền yêu cầu xác minh độ tuổi hoặc thông tin tài khoản khi cần thiết.'
                : 'GlowBal reserves the right to verify user age and identity information when necessary.'}
            </p>
            <p>
              {isVi
                ? 'Nếu phát hiện Người dùng chưa đủ 16 tuổi, cung cấp thông tin sai lệch hoặc sử dụng danh tính của người khác, GlowBal có quyền từ chối cung cấp Dịch vụ, tạm khóa hoặc chấm dứt tài khoản.'
                : 'If a user is found under 16, providing fraudulent details, or impersonating others, GlowBal reserves the right to refuse service, suspend, or terminate the account.'}
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              4. {isVi ? 'PHẠM VI DỊCH VỤ' : 'SCOPE OF SERVICES'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'GlowBal cung cấp nền tảng công nghệ hỗ trợ giáo dục và định hướng du học, bao gồm nhưng không giới hạn:'
                : 'GlowBal provides technology tools to guide students through the university and scholarship application journey:'}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mb-2">
              <li>
                <b>GlowBal Matcher:</b> {isVi ? 'tìm kiếm và định hướng trường đại học, học bổng và Cố vấn;' : 'intelligent discovery for target universities, scholarships, and mentors;'}
              </li>
              <li>
                <b>Strategy Master:</b> {isVi ? 'phân tích hồ sơ, xây dựng chiến lược, theo dõi tiến độ và hỗ trợ tài liệu như CV, bài luận và thư giới thiệu;' : 'profile diagnostics, strategic narratives, milestone timelines, CV, essays, and recommendation letters support;'}
              </li>
              <li>
                <b>My Portal:</b> {isVi ? 'quản lý lựa chọn, theo dõi hồ sơ ứng tuyển và lưu trữ tài liệu;' : 'centralized selection tracker, application portfolio, and document vault;'}
              </li>
              <li>
                {isVi ? 'Cơ sở dữ liệu về trường đại học, học bổng và Cố vấn;' : 'Comprehensive database of global universities and scholarships with AI assistance tools;'}
              </li>
              <li>
                {isVi ? 'Các công cụ AI và dịch vụ trả phí khác được GlowBal cung cấp theo từng thời điểm.' : 'AI tools and premium features provided by GlowBal from time to time.'}
              </li>
            </ul>
            <p className="text-xs text-slate-500 italic">
              {isVi
                ? 'Các Dịch vụ nhằm hỗ trợ Người dùng nghiên cứu, lập kế hoạch và chuẩn bị hồ sơ và không được xem là lời khuyên pháp lý, tài chính hoặc chuyên môn chính thức.'
                : 'Services are designed for preparation and guidance and do not constitute formal legal or financial advice.'}
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              5. {isVi ? 'VAI TRÒ CỦA GLOWBAL' : 'ROLE OF GLOWBAL'}
            </h3>
            <p className="mb-2">{isVi ? 'Người dùng hiểu và đồng ý rằng:' : 'The User acknowledges and agrees that:'}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{isVi ? 'GlowBal là nền tảng công nghệ và đơn vị hỗ trợ, cung cấp công cụ, thông tin và kết nối cho Người dùng;' : 'GlowBal is a technology and educational guidance platform;'}</li>
              <li>{isVi ? 'GlowBal không phải là trường đại học, tổ chức cấp học bổng, cơ quan tuyển sinh hoặc cơ quan cấp visa;' : 'GlowBal is not a university, scholarship provider, admissions committee, or visa authority;'}</li>
              <li>{isVi ? 'GlowBal không có quyền quyết định việc tuyển sinh, cấp học bổng hoặc cấp visa;' : 'GlowBal does not make final admission or visa determinations;'}</li>
              <li>{isVi ? 'Các quyết định cuối cùng thuộc về trường đại học, tổ chức học bổng và cơ quan có thẩm quyền tương ứng.' : 'All admissions and funding decisions belong solely to the respective institutions and authorities.'}</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              6. {isVi ? 'KHÔNG CAM KẾT VỀ KẾT QUẢ' : 'NO GUARANTEE OF OUTCOMES'}
            </h3>
            <p className="mb-2">{isVi ? 'GlowBal không cam kết hoặc bảo đảm rằng Người dùng sẽ:' : 'GlowBal does not guarantee or warrant that the User will:'}</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>{isVi ? 'Được nhận vào một trường đại học cụ thể;' : 'Be admitted to any specific university;'}</li>
              <li>{isVi ? 'Nhận được học bổng;' : 'Receive scholarship awards;'}</li>
              <li>{isVi ? 'Được cấp visa;' : 'Be granted a visa;'}</li>
              <li>{isVi ? 'Đạt một mức điểm hoặc kết quả cụ thể;' : 'Achieve specific test scores or results;'}</li>
              <li>{isVi ? 'Đạt được bất kỳ kết quả tuyển sinh hoặc nghề nghiệp nào.' : 'Attain specific admissions or career outcomes.'}</li>
            </ul>
            <p className="mb-2">
              {isVi
                ? 'Thông tin, phân tích, chiến lược và đề xuất trên GlowBal chỉ mang tính chất tham khảo và hỗ trợ.'
                : 'Information, analytics, strategies, and recommendations on GlowBal are for advisory and reference purposes only.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'Kết quả thực tế phụ thuộc vào nhiều yếu tố, bao gồm năng lực của Người dùng, chất lượng hồ sơ, mức độ cạnh tranh, yêu cầu của từng tổ chức và quyết định của bên có thẩm quyền.'
                : 'Actual outcomes depend on multiple factors including individual student profile, competition level, institutional criteria, and official decisions.'}
            </p>
            <p>
              {isVi
                ? 'Người dùng có trách nhiệm tự kiểm tra và xác minh thông tin từ các nguồn chính thức trước khi đưa ra quyết định.'
                : 'Users are responsible for independently checking and verifying all official institutional requirements before making decisions.'}
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              7. {isVi ? 'TRÁCH NHIỆM CỦA NGƯỜI DÙNG' : 'USER RESPONSIBILITIES'}
            </h3>
            <p className="mb-2">{isVi ? 'Khi sử dụng Dịch vụ, Người dùng cam kết:' : 'When using the Services, the User agrees to:'}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{isVi ? 'Cung cấp thông tin và tài liệu trung thực, chính xác và đầy đủ;' : 'Provide truthful, accurate, and complete information and materials;'}</li>
              <li>{isVi ? 'Không sử dụng hồ sơ, chứng chỉ hoặc tài liệu giả mạo;' : 'Refrain from using fraudulent documents, certificates, or profiles;'}</li>
              <li>{isVi ? 'Tự xác minh deadline, yêu cầu và quy trình ứng tuyển;' : 'Independently verify application deadlines, requirements, and procedures;'}</li>
              <li>{isVi ? 'Chịu trách nhiệm đối với việc đáp ứng các thời hạn ứng tuyển;' : 'Take personal responsibility for meeting application deadlines;'}</li>
              <li>{isVi ? 'Không sử dụng GlowBal cho mục đích bất hợp pháp hoặc gây hại;' : 'Not use GlowBal for unlawful, misleading, or harmful purposes;'}</li>
              <li>{isVi ? 'Không can thiệp, phá hoại hoặc gây ảnh hưởng đến hoạt động của Nền tảng.' : 'Not disrupt, attack, reverse-engineer, or compromise the Platform security.'}</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
            <h3 className="font-bold text-[#E11D48] text-base mb-2">
              8. {isVi ? 'CHÍNH SÁCH HOÀN TIỀN' : 'REFUND POLICY'}
            </h3>
            <div className="space-y-2 text-xs sm:text-sm">
              <p>
                <b>8.1. {isVi ? 'Thời hạn yêu cầu:' : 'Timeframe:'}</b>{' '}
                {isVi
                  ? 'Đối với giao dịch thanh toán trực tiếp cho GlowBal, Người dùng có thể yêu cầu hoàn tiền trong vòng 24 giờ kể từ thời điểm đăng ký và thanh toán Dịch vụ. Sau thời hạn này, yêu cầu hoàn tiền sẽ không được chấp nhận, trừ trường hợp pháp luật có quy định khác.'
                  : 'Refund requests must be submitted within 24 hours of payment. After this timeframe, refund requests are not accepted unless mandated by law.'}
              </p>
              <p>
                <b>8.2. {isVi ? 'Mức hoàn tiền:' : 'Refund Rate:'}</b>{' '}
                {isVi
                  ? 'Đối với yêu cầu hợp lệ, GlowBal hoàn lại 90% số tiền Người dùng đã thanh toán. 10% còn lại được giữ lại để bù đắp chi phí xử lý giao dịch, vận hành hệ thống và cung cấp Dịch vụ. (Ví dụ: Thanh toán 1.000.000 VNĐ → số tiền hoàn lại là 900.000 VNĐ).'
                  : 'For eligible requests, GlowBal refunds 90% of the paid amount (10% is retained to cover gateway processing and system operation costs). E.g., 1,000,000 VND paid → 900,000 VND refunded.'}
              </p>
              <div>
                <b>8.3. {isVi ? 'Cách thức yêu cầu:' : 'Request Process:'}</b>{' '}
                {isVi ? 'Người dùng gửi yêu cầu đến' : 'Send an email to'}{' '}
                <a href="mailto:glowbal.edu@gmail.com" className="font-bold text-[#E11D48] underline">
                  glowbal.edu@gmail.com
                </a>{' '}
                {isVi ? 'với tiêu đề' : 'with subject'}{' '}
                <code className="bg-white px-1.5 py-0.5 rounded border border-rose-200 text-xs">
                  {isVi ? '[YÊU CẦU HOÀN TIỀN] – Họ tên – Email tài khoản' : '[REFUND REQUEST] – Full Name – Account Email'}
                </code>.
                <p className="mt-1">
                  {isVi
                    ? 'Yêu cầu cần bao gồm: Họ và tên; Email tài khoản; Tên Dịch vụ; Thời điểm và số tiền thanh toán; Mã giao dịch (nếu có); Lý do yêu cầu hoàn tiền. GlowBal sẽ kiểm tra và xác nhận tính hợp lệ của yêu cầu.'
                    : 'The request must include: Full Name; Account Email; Service Name; Payment Date & Amount; Transaction ID; Reason for request.'}
                </p>
              </div>
              <p>
                <b>8.4. {isVi ? 'Thời gian hoàn tiền:' : 'Processing Time:'}</b>{' '}
                {isVi
                  ? 'Sau khi yêu cầu được xác nhận hợp lệ, GlowBal sẽ tiến hành hoàn tiền trong vòng 07–14 ngày làm việc về phương thức thanh toán ban đầu hoặc phương thức phù hợp khác.'
                  : '07–14 business days after confirmation back to original payment method or a verified alternative.'}
              </p>
              <p>
                <b>8.5. {isVi ? 'Trường hợp không đủ điều kiện:' : 'Ineligibility:'}</b>{' '}
                {isVi
                  ? 'GlowBal có quyền từ chối yêu cầu nếu: Yêu cầu được gửi sau 24 giờ; Không xác minh được giao dịch; Thông tin cung cấp không chính xác; Có dấu hiệu gian lận hoặc lạm dụng chính sách; Người dùng vi phạm Điều khoản; Giao dịch được thực hiện thông qua nền tảng có chính sách hoàn tiền riêng.'
                  : 'Requests sent after 24 hours, unverified transactions, inaccurate details, fraudulent behavior, Terms violations, or purchases made through platforms with separate refund rules.'}
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              9. {isVi ? 'CHÍNH SÁCH BẢO LƯU TÀI KHOẢN' : 'ACCOUNT DEFERRAL POLICY'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'Người dùng có thể yêu cầu bảo lưu tài khoản tối đa 06 tháng kể từ ngày thanh toán.'
                : 'Users may request an account deferral for up to 06 months from the payment date.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'Tài khoản và các quyền lợi đi kèm không được chuyển nhượng, cho mượn, cho thuê hoặc sử dụng bởi bên thứ ba.'
                : 'Account subscriptions and privileges are strictly non-transferable and may not be rented, loaned, or shared with third parties.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'Khi kích hoạt lại, GlowBal có quyền xác minh thông tin tài khoản. Nếu phát hiện thông tin người sử dụng không phù hợp với thông tin đăng ký ban đầu, có dấu hiệu chuyển nhượng hoặc gian lận, GlowBal có quyền khóa tài khoản vĩnh viễn và chấm dứt các quyền lợi liên quan.'
                : 'Upon reactivation, GlowBal reserves the right to verify identity. If unauthorized transfer or fraud is found, the account will be permanently terminated.'}
            </p>
            <p>
              {isVi
                ? 'Thời gian bảo lưu không làm gia hạn thời hạn yêu cầu hoàn tiền.'
                : 'Account deferral does not extend the 24-hour refund eligibility window.'}
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              10. {isVi ? 'QUYỀN SỞ HỮU TRÍ TUỆ' : 'INTELLECTUAL PROPERTY'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'Toàn bộ Nội dung, phần mềm, thiết kế, thương hiệu, logo và các tài sản trí tuệ khác trên Nền tảng thuộc sở hữu của GlowBal hoặc bên cấp phép hợp pháp và được bảo vệ theo quy định pháp luật về sở hữu trí tuệ.'
                : 'All software, content, branding, designs, frameworks, and digital assets on the Platform belong exclusively to GlowBal Education or its lawful licensors.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'GlowBal cấp cho Người dùng quyền sử dụng có giới hạn, không độc quyền và không được chuyển nhượng, chỉ nhằm mục đích cá nhân và học tập.'
                : 'GlowBal grants the User a limited, non-exclusive, non-transferable license for personal, educational use.'}
            </p>
            <p>
              {isVi
                ? 'Người dùng không được sao chép, phân phối, sửa đổi, tạo tác phẩm phái sinh, công khai hoặc khai thác thương mại Nội dung của GlowBal nếu không có sự đồng ý trước bằng văn bản.'
                : 'Users may not copy, distribute, modify, create derivative works, or commercially exploit GlowBal content without prior written permission.'}
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              11. {isVi ? 'QUYỀN RIÊNG TƯ VÀ BẢO VỆ DỮ LIỆU' : 'PRIVACY AND DATA PROTECTION'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'GlowBal thu thập và xử lý dữ liệu cá nhân của Người dùng theo Chính sách Bảo mật được công bố trên Nền tảng.'
                : 'GlowBal collects and processes personal data in accordance with our Privacy Policy published on the Platform.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'Bằng việc sử dụng Dịch vụ, Người dùng xác nhận đã đọc và đồng ý với việc thu thập, sử dụng và xử lý dữ liệu theo Chính sách Bảo mật.'
                : 'By using the Services, the User confirms they have read and agreed to data collection and processing in accordance with our Privacy Policy.'}
            </p>
            <p>
              {isVi
                ? 'GlowBal áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu Người dùng. Tuy nhiên, không có hệ thống công nghệ nào có thể đảm bảo an toàn tuyệt đối.'
                : 'GlowBal applies appropriate technical and organizational measures to safeguard user data; however, no technology system can guarantee absolute invulnerability.'}
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              12. {isVi ? 'MIỄN TRỪ VÀ GIỚI HẠN TRÁCH NHIỆM' : 'LIMITATION OF LIABILITY'}
            </h3>
            <div className="space-y-2">
              <p>
                <b>12.1. {isVi ? 'Tuyên bố miễn trừ bảo đảm:' : 'Disclaimer of Warranties:'}</b>{' '}
                {isVi
                  ? 'GlowBal cung cấp Nền tảng và Dịch vụ theo tình trạng hiện có và khả năng cung cấp tại từng thời điểm. GlowBal không cam kết rằng Dịch vụ luôn hoạt động liên tục; hoàn toàn không có lỗi; luôn chính xác hoặc cập nhật; luôn đáp ứng mọi nhu cầu cụ thể của Người dùng.'
                  : 'GlowBal provides the Platform and Services on an “as is” and “as available” basis without warranty of uninterrupted, error-free, or fully comprehensive operation.'}
              </p>
              <p>
                <b>12.2. {isVi ? 'Giới hạn trách nhiệm:' : 'Limitation of Liability:'}</b>{' '}
                {isVi
                  ? 'Trong phạm vi pháp luật cho phép, GlowBal và các cán bộ, nhân viên, đại lý, đối tác của mình không chịu trách nhiệm đối với các thiệt hại gián tiếp, ngẫu nhiên, đặc biệt hoặc phát sinh do việc không thể sử dụng Nền tảng; quyết định của trường, tổ chức học bổng hoặc cơ quan cấp visa; sai sót hoặc thiếu chính xác trong Nội dung; truy cập trái phép vào dữ liệu; hành vi của Cố vấn hoặc bên thứ ba.'
                  : 'To the maximum extent permitted by applicable law, GlowBal shall not be liable for indirect, incidental, special, or consequential damages resulting from inability to use the Platform, third-party decisions, data inaccuracies, or third-party mentor actions.'}
              </p>
              <p>
                {isVi
                  ? 'Trong phạm vi pháp luật cho phép, trách nhiệm của GlowBal đối với Người dùng sẽ không vượt quá tổng số tiền Người dùng đã thanh toán cho GlowBal trong 06 tháng gần nhất trước thời điểm phát sinh khiếu nại.'
                  : 'To the maximum extent permitted by applicable law, GlowBal’s total liability to any User shall not exceed the total fees paid by such User to GlowBal in the preceding 06 months.'}
              </p>
            </div>
          </section>

          {/* Section 13 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              13. {isVi ? 'BẤT KHẢ KHÁNG' : 'FORCE MAJEURE'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'GlowBal không chịu trách nhiệm đối với sự chậm trễ, gián đoạn hoặc không thể thực hiện nghĩa vụ do các sự kiện nằm ngoài khả năng kiểm soát hợp lý, bao gồm nhưng không giới hạn ở:'
                : 'GlowBal is not liable for delays, interruptions, or failure to perform obligations resulting from events beyond reasonable control, including but not limited to:'}
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>{isVi ? 'Thiên tai;' : 'Natural disasters;'}</li>
              <li>{isVi ? 'Dịch bệnh;' : 'Epidemics / pandemics;'}</li>
              <li>{isVi ? 'Chiến tranh;' : 'War and civil unrest;'}</li>
              <li>{isVi ? 'Đình công;' : 'Labor strikes;'}</li>
              <li>{isVi ? 'Sự cố kỹ thuật;' : 'Technical failures;'}</li>
              <li>{isVi ? 'Sự cố từ nhà cung cấp dịch vụ bên thứ ba;' : 'Third-party infrastructure outages;'}</li>
              <li>{isVi ? 'Thay đổi chính sách của nhà cung cấp API hoặc công nghệ AI;' : 'Policy modifications by third-party AI / API providers;'}</li>
              <li>{isVi ? 'Quyết định của cơ quan nhà nước có thẩm quyền.' : 'Governmental or statutory regulatory actions.'}</li>
            </ul>
            <p>
              {isVi
                ? 'GlowBal sẽ thực hiện các biện pháp hợp lý để hạn chế ảnh hưởng của những sự kiện này.'
                : 'GlowBal will take reasonable steps to mitigate the impact of such events.'}
            </p>
          </section>

          {/* Section 14 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              14. {isVi ? 'TẠM NGỪNG VÀ CHẤM DỨT TÀI KHOẢN' : 'SUSPENSION AND TERMINATION'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'GlowBal có quyền tạm ngừng hoặc chấm dứt quyền truy cập của Người dùng khi:'
                : 'GlowBal reserves the right to suspend or terminate User access when:'}
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>{isVi ? 'Vi phạm Điều khoản;' : 'Violating these Terms;'}</li>
              <li>{isVi ? 'Có hành vi gian lận;' : 'Engaging in fraudulent activity;'}</li>
              <li>{isVi ? 'Sử dụng Dịch vụ trái pháp luật;' : 'Using Services unlawfully;'}</li>
              <li>{isVi ? 'Gây ảnh hưởng đến hệ thống hoặc Người dùng khác;' : 'Affecting platform stability or other users;'}</li>
              <li>{isVi ? 'Cung cấp thông tin giả mạo;' : 'Submitting forged credentials;'}</li>
              <li>{isVi ? 'Hoặc có hành vi khác gây ảnh hưởng nghiêm trọng đến GlowBal.' : 'Or engaging in conduct detrimental to GlowBal.'}</li>
            </ul>
            <p className="mb-2">
              {isVi
                ? 'Khi tài khoản bị chấm dứt, quyền sử dụng Dịch vụ của Người dùng sẽ chấm dứt theo quyết định của GlowBal.'
                : 'Upon account termination, access rights cease immediately.'}
            </p>
            <p>
              {isVi
                ? 'Các điều khoản về sở hữu trí tuệ, bảo mật, miễn trừ trách nhiệm, giới hạn trách nhiệm và giải quyết tranh chấp vẫn tiếp tục có hiệu lực khi cần thiết.'
                : 'Provisions regarding intellectual property, privacy, disclaimers, liability limits, and dispute resolution survive termination.'}
            </p>
          </section>

          {/* Section 15 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              15. {isVi ? 'THAY ĐỔI ĐIỀU KHOẢN' : 'MODIFICATION OF TERMS'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'GlowBal có quyền sửa đổi, bổ sung hoặc thay thế Điều khoản này khi cần thiết.'
                : 'GlowBal reserves the right to amend, update, or replace these Terms as needed.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'Phiên bản cập nhật sẽ được công bố trên Nền tảng cùng với ngày cập nhật mới.'
                : 'Updated versions will be published on the Platform along with the latest revision date.'}
            </p>
            <p>
              {isVi
                ? 'Việc tiếp tục sử dụng Dịch vụ sau khi Điều khoản được cập nhật được xem là Người dùng đã chấp nhận phiên bản mới.'
                : 'Continued use of Services following revisions constitutes acceptance of the new Terms.'}
            </p>
          </section>

          {/* Section 16 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              16. {isVi ? 'LUẬT ÁP DỤNG VÀ GIẢI QUYẾT TRANH CHẤP' : 'GOVERNING LAW AND DISPUTE RESOLUTION'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'Điều khoản này được điều chỉnh và giải thích theo pháp luật của nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.'
                : 'These Terms are governed by and construed in accordance with the laws of the Socialist Republic of Vietnam.'}
            </p>
            <p className="mb-2">
              {isVi
                ? 'Mọi tranh chấp phát sinh liên quan đến Điều khoản hoặc việc sử dụng Dịch vụ trước tiên sẽ được ưu tiên giải quyết thông qua thương lượng.'
                : 'Any disputes arising out of or in connection with these Terms shall first be resolved through friendly mutual negotiation.'}
            </p>
            <p>
              {isVi
                ? 'Trường hợp không thể giải quyết bằng thương lượng, tranh chấp sẽ được đưa ra cơ quan có thẩm quyền tại Việt Nam theo quy định pháp luật.'
                : 'If negotiation fails, disputes will be submitted to competent authorities in Vietnam in accordance with Vietnamese law.'}
            </p>
          </section>

          {/* Section 17 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              17. {isVi ? 'KHẢ NĂNG ÁP DỤNG TỪNG PHẦN' : 'SEVERABILITY'}
            </h3>
            <p>
              {isVi
                ? 'Nếu bất kỳ điều khoản nào bị xác định là vô hiệu, bất hợp pháp hoặc không thể thi hành, các điều khoản còn lại vẫn giữ nguyên hiệu lực.'
                : 'If any provision is deemed invalid, unlawful, or unenforceable, the remaining provisions will continue in full force.'}
            </p>
          </section>

          {/* Section 18 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              18. {isVi ? 'TỪ BỎ QUYỀN' : 'NO WAIVER'}
            </h3>
            <p>
              {isVi
                ? 'Việc GlowBal không thực hiện hoặc chậm thực hiện bất kỳ quyền nào theo Điều khoản này không được xem là từ bỏ quyền đó hoặc bất kỳ quyền nào khác.'
                : 'Failure or delay by GlowBal in exercising any right under these Terms shall not be construed as a waiver of that or any other right.'}
            </p>
          </section>

          {/* Section 19 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              19. {isVi ? 'TOÀN BỘ THỎA THUẬN' : 'ENTIRE AGREEMENT'}
            </h3>
            <p>
              {isVi
                ? 'Điều khoản này cùng với Chính sách Bảo mật và các chính sách, thông báo pháp lý khác được GlowBal công bố cấu thành toàn bộ thỏa thuận giữa Người dùng và GlowBal liên quan đến việc sử dụng Nền tảng và Dịch vụ.'
                : 'These Terms together with the Privacy Policy and other official notices constitute the entire agreement between the User and GlowBal regarding the Platform and Services.'}
            </p>
          </section>

          {/* Section 20 */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-bold text-[#141118] text-base mb-2">
              20. {isVi ? 'THÔNG TIN LIÊN HỆ' : 'CONTACT INFORMATION'}
            </h3>
            <p className="mb-2">
              {isVi
                ? 'Nếu có bất kỳ câu hỏi, khiếu nại hoặc yêu cầu nào liên quan đến Điều khoản và Điều kiện Sử dụng, vui lòng liên hệ:'
                : 'For any questions, complaints, or inquiries regarding these Terms and Conditions of Use, please contact:'}
            </p>
            <div className="space-y-1 font-medium text-xs sm:text-sm">
              <p className="font-bold text-[#141118]">GLOWBAL EDUCATION</p>
              <p>
                📧 Email:{' '}
                <a href="mailto:glowbal.edu@gmail.com" className="text-[#E11D48] underline">
                  glowbal.edu@gmail.com
                </a>
              </p>
              <p>
                🌐 Website:{' '}
                <a href="https://glowbal-education.com" target="_blank" rel="noopener noreferrer" className="text-[#E11D48] underline">
                  GlowBal Education
                </a>
              </p>
              <p className="mt-2 text-slate-500 font-semibold">GO GLOW – GO GLOBAL ✈️🌍</p>
              <p className="text-slate-400 text-xs">© 2026 GlowBal Education. All Rights Reserved</p>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#EDE9EE] px-6 py-3.5 bg-[#FBF9FA] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#E11D48] px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-[#B01238] transition-all cursor-pointer"
          >
            {isVi ? 'Đã hiểu' : 'I understand'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
