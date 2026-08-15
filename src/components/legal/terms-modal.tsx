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
      <div className="flex flex-col max-h-[80vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#EDE9EE] px-6 py-4 bg-[#FBF9FA]">
          <div>
            <h2 className="text-lg font-bold text-[#141118]">
              {isVi ? 'ĐIỀU KHOẢN VÀ ĐIỀU KIỆN SỬ DỤNG' : 'TERMS AND CONDITIONS OF USE'}
            </h2>
            <p className="text-xs text-[#6B6570]">
              {isVi ? 'Nền tảng GlowBal Education · Cập nhật: 15/08/2026' : 'GlowBal Education Platform · Last updated: 15/08/2026'}
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
            <p>
              {isVi
                ? 'Bằng việc truy cập, đăng ký hoặc sử dụng nền tảng GlowBal Education (“GlowBal”, “Nền tảng”, “chúng tôi”), bao gồm website, ứng dụng và các dịch vụ liên quan (“Dịch vụ”), Người dùng (“Bạn”, “Người dùng”) xác nhận rằng đã đọc, hiểu và đồng ý tuân thủ các Điều khoản và Điều kiện Sử dụng này (“Điều khoản”). Nếu bạn không đồng ý với bất kỳ nội dung nào của Điều khoản, vui lòng không sử dụng Dịch vụ.'
                : 'By accessing, registering for, or using the GlowBal Education platform ("GlowBal", "Platform", "we", "us"), including the website, applications, and related services ("Services"), the User ("You", "User") confirms that they have read, understood, and agreed to comply with these Terms and Conditions of Use ("Terms"). If you do not agree with any part of these Terms, please do not use the Services.'}
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              2. {isVi ? 'ĐỊNH NGHĨA' : 'DEFINITIONS'}
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>{isVi ? '“Nền tảng”' : '"Platform"'}</b>: {isVi ? 'hệ thống website, ứng dụng và các sản phẩm công nghệ do GlowBal vận hành.' : 'the website, apps, and technology products operated by GlowBal.'}</li>
              <li><b>{isVi ? '“Dịch vụ”' : '"Services"'}</b>: {isVi ? 'toàn bộ sản phẩm, tính năng và dịch vụ được GlowBal cung cấp trên Nền tảng.' : 'all products, features, and services provided by GlowBal on the Platform.'}</li>
              <li><b>{isVi ? '“Nội dung”' : '"Content"'}</b>: {isVi ? 'thông tin, dữ liệu, văn bản, hình ảnh, video, phần mềm, tài liệu và các tài sản khác được cung cấp trên Nền tảng.' : 'information, data, text, images, videos, software, documents, and assets on the Platform.'}</li>
              <li><b>{isVi ? '“Người dùng”' : '"User"'}</b>: {isVi ? 'cá nhân đăng ký hoặc sử dụng Dịch vụ, bao gồm cả người dùng miễn phí và người dùng trả phí.' : 'any individual who registers or uses the Services, free or paid.'}</li>
              <li><b>{isVi ? '“Cố vấn/Achiever/Mentor”' : '"Mentor / Advisor"'}</b>: {isVi ? 'cá nhân hoặc tổ chức cung cấp dịch vụ tư vấn, cố vấn hoặc hỗ trợ thông qua hoặc liên quan đến Nền tảng.' : 'individuals or organizations providing advisory or mentoring services via the Platform.'}</li>
              <li><b>{isVi ? '“Tổ chức giáo dục”' : '"Educational Institution"'}</b>: {isVi ? 'trường đại học, cao đẳng, trường học, tổ chức học bổng hoặc tổ chức giáo dục khác được đề cập trên Nền tảng.' : 'universities, colleges, scholarship organizations, or schools listed on the Platform.'}</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              3. {isVi ? 'ĐIỀU KIỆN SỬ DỤNG' : 'ELIGIBILITY AND USE'}
            </h3>
            <p>
              {isVi
                ? 'GlowBal dành cho Người dùng từ đủ 16 tuổi trở lên. Khi đăng ký hoặc sử dụng Dịch vụ, Người dùng xác nhận rằng đã đủ 16 tuổi; có đầy đủ năng lực để chấp nhận Điều khoản; cung cấp thông tin trung thực, chính xác và chịu trách nhiệm với tài khoản của mình. Người dùng từ 16 đến dưới 18 tuổi được khuyến nghị sử dụng Dịch vụ với sự đồng ý và giám sát của cha mẹ hoặc người giám hộ hợp pháp.'
                : 'GlowBal is intended for users aged 16 and above. Users confirm they are at least 16 years old, have legal capacity, provide accurate information, and are responsible for their account activities. Users aged 16-18 are encouraged to use the service under parental or legal guardian supervision.'}
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              4. {isVi ? 'PHẠM VI DỊCH VỤ' : 'SCOPE OF SERVICES'}
            </h3>
            <p>
              {isVi
                ? 'GlowBal cung cấp nền tảng công nghệ hỗ trợ giáo dục và định hướng du học, bao gồm: GlowBal Matcher (tìm kiếm trường, học bổng), Strategy Master (chiến lược hồ sơ, CV, bài luận, thư giới thiệu), My Portal (quản lý hồ sơ ứng tuyển), và các công cụ AI hỗ trợ. Các dịch vụ nhằm mục đích hỗ trợ nghiên cứu và chuẩn bị hồ sơ, không được xem là lời khuyên pháp lý hay tài chính chính thức.'
                : 'GlowBal provides technology tools for study-abroad guidance, including GlowBal Matcher, Strategy Master, My Portal, and AI assistance tools. Services are for preparation and planning purposes, and do not constitute formal legal or financial advice.'}
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              5. {isVi ? 'VAI TRÒ CỦA GLOWBAL' : 'ROLE OF GLOWBAL'}
            </h3>
            <p>
              {isVi
                ? 'GlowBal là nền tảng công nghệ và đơn vị hỗ trợ công cụ. GlowBal không phải là trường đại học, tổ chức cấp học bổng hay cơ quan cấp visa, và không có quyền quyết định tuyển sinh hay cấp visa. Quyết định cuối cùng thuộc về các trường và cơ quan có thẩm quyền.'
                : 'GlowBal is a technology and preparatory platform. GlowBal is not a university, scholarship board, or visa authority, and does not make admissions or visa decisions.'}
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              6. {isVi ? 'KHÔNG CAM KẾT VỀ KẾT QUẢ' : 'NO GUARANTEE OF OUTCOMES'}
            </h3>
            <p>
              {isVi
                ? 'GlowBal không cam kết hoặc bảo đảm rằng Người dùng sẽ được nhận vào một trường đại học cụ thể, nhận học bổng hay được cấp visa. Thông tin và đề xuất chỉ mang tính chất tham khảo. Người dùng có trách nhiệm tự kiểm tra thông tin từ các nguồn chính thức.'
                : 'GlowBal does not guarantee university admission, scholarship awards, or visa approvals. All recommendations are advisory; users are responsible for verifying official requirements.'}
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              7. {isVi ? 'TRÁCH NHIỆM CỦA NGƯỜI DÙNG' : 'USER RESPONSIBILITIES'}
            </h3>
            <p>
              {isVi
                ? 'Người dùng cam kết cung cấp thông tin trung thực, không sử dụng hồ sơ giả mạo, tự xác minh deadline ứng tuyển và không can thiệp phá hoại nền tảng.'
                : 'Users commit to providing truthful information, avoiding fraudulent materials, tracking deadlines independently, and not disrupting platform security.'}
            </p>
          </section>

          {/* Section 8 */}
          <section className="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
            <h3 className="font-bold text-[#E11D48] text-base mb-1.5">
              8. {isVi ? 'CHÍNH SÁCH HOÀN TIỀN' : 'REFUND POLICY'}
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
              <li>• <b>{isVi ? 'Thời hạn yêu cầu:' : 'Timeframe:'}</b> {isVi ? 'Trong vòng 24 giờ kể từ thời điểm thanh toán Dịch vụ.' : 'Within 24 hours of payment.'}</li>
              <li>• <b>{isVi ? 'Mức hoàn tiền:' : 'Refund Amount:'}</b> {isVi ? 'Hoàn lại 90% số tiền đã thanh toán (10% giữ lại chi phí vận hành & xử lý giao dịch).' : '90% refund (10% retained for processing & operation costs).'}</li>
              <li>• <b>{isVi ? 'Cách thức yêu cầu:' : 'How to request:'}</b> {isVi ? 'Gửi email đến glowbal.edu@gmail.com với tiêu đề [YÊU CẦU HOÀN TIỀN] – Họ tên – Email tài khoản.' : 'Email glowbal.edu@gmail.com with subject [REFUND REQUEST] - Full Name - Account Email.'}</li>
              <li>• <b>{isVi ? 'Thời gian xử lý:' : 'Processing time:'}</b> {isVi ? 'Hoàn tiền trong vòng 07–14 ngày làm việc.' : 'Processed within 7-14 business days.'}</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              9. {isVi ? 'CHÍNH SÁCH BẢO LƯU TÀI KHOẢN' : 'ACCOUNT DEFERRAL POLICY'}
            </h3>
            <p>
              {isVi
                ? 'Người dùng có thể yêu cầu bảo lưu tài khoản tối đa 06 tháng kể từ ngày thanh toán. Quyền lợi không được chuyển nhượng hoặc cho mượn.'
                : 'Users may defer their active account for up to 6 months. Account privileges are non-transferable.'}
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              10. {isVi ? 'QUYỀN SỞ HỮU TRÍ TUỆ' : 'INTELLECTUAL PROPERTY'}
            </h3>
            <p>
              {isVi
                ? 'Toàn bộ nội dung, phần mềm, thương hiệu và thiết kế trên Nền tảng thuộc sở hữu của GlowBal Education và được bảo vệ theo pháp luật sở hữu trí tuệ.'
                : 'All content, software, branding, and assets belong exclusively to GlowBal Education and are protected under applicable IP laws.'}
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              11. {isVi ? 'QUYỀN RIÊNG TƯ & BẢO MẬT DỮ LIỆU' : 'PRIVACY & DATA PROTECTION'}
            </h3>
            <p>
              {isVi
                ? 'GlowBal xử lý dữ liệu cá nhân theo Chính sách Bảo mật được công bố trên Nền tảng và áp dụng các biện pháp bảo vệ dữ liệu kỹ thuật phù hợp.'
                : 'Personal data is processed in accordance with our Privacy Policy with appropriate technical and organizational safeguards.'}
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              12. {isVi ? 'MIỄN TRỪ VÀ GIỚI HẠN TRÁCH NHIỆM' : 'LIMITATION OF LIABILITY'}
            </h3>
            <p>
              {isVi
                ? 'Trách nhiệm bồi thường của GlowBal (nếu có) trong mọi trường hợp không vượt quá tổng số tiền Người dùng đã thanh toán cho GlowBal trong 06 tháng gần nhất.'
                : "GlowBal's total aggregate liability shall not exceed the total fees paid by the user to GlowBal in the preceding 6 months."}
            </p>
          </section>

          {/* Section 13 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              13. {isVi ? 'BẤT KHẢ KHÁNG' : 'FORCE MAJEURE'}
            </h3>
            <p>
              {isVi
                ? 'GlowBal không chịu trách nhiệm đối với các sự cố nằm ngoài tầm kiểm soát hợp lý như thiên tai, sự cố kỹ thuật bên thứ ba hoặc thay đổi chính sách từ đối tác AI/API.'
                : 'GlowBal is not liable for disruptions caused by events beyond reasonable control, including third-party API changes or natural disasters.'}
            </p>
          </section>

          {/* Section 14 - 20 */}
          <section>
            <h3 className="font-bold text-[#141118] text-base mb-1.5">
              14 - 20. {isVi ? 'ĐIỀU KHOẢN CHUNG & THÔNG TIN LIÊN HỆ' : 'GENERAL PROVISIONS & CONTACT'}
            </h3>
            <p>
              {isVi
                ? 'Điều khoản được điều chỉnh theo pháp luật nước CHXHCN Việt Nam. Mọi thắc mắc xin liên hệ email: glowbal.edu@gmail.com. GlowBal Education — GO GLOW, GO GLOBAL ✈️🌍'
                : 'Governed by the laws of Vietnam. For inquiries, contact: glowbal.edu@gmail.com. GlowBal Education — GO GLOW, GO GLOBAL ✈️🌍'}
            </p>
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
