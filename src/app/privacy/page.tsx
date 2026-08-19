import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Chính sách Bảo mật',
  description:
    'Chính sách Bảo mật của nền tảng GlowBal Education — Cách GlowBal thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="15/08/2026"
      intro={
        <div className="space-y-2 leading-relaxed">
          <p>
            GlowBal Education (“GlowBal”, “chúng tôi”) tôn trọng quyền riêng tư và cam kết bảo vệ
            thông tin cá nhân của Người dùng khi truy cập và sử dụng website, nền tảng và các dịch
            vụ của GlowBal (“Dịch vụ”).
          </p>
          <p>
            Chính sách này quy định cách GlowBal thu thập, sử dụng, lưu trữ, chia sẻ và bảo vệ dữ
            liệu cá nhân của Người dùng.
          </p>
          <p>
            Bằng việc đăng ký hoặc sử dụng Dịch vụ, Người dùng xác nhận đã đọc và đồng ý với
            Chính sách Bảo mật này.
          </p>
        </div>
      }
      sections={[
        {
          heading: '1. Đối tượng sử dụng',
          body: (
            <div className="space-y-1.5">
              <p>Dịch vụ GlowBal dành cho Người dùng từ đủ 16 tuổi trở lên.</p>
              <p>
                Người dùng từ 16 đến dưới 18 tuổi được khuyến nghị sử dụng Dịch vụ với sự đồng ý
                và giám sát của cha, mẹ hoặc người giám hộ hợp pháp.
              </p>
            </div>
          ),
        },
        {
          heading: '2. Thông tin GlowBal thu thập',
          body: (
            <div className="space-y-2">
              <p>Tùy thuộc vào việc sử dụng Dịch vụ, GlowBal có thể thu thập:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <b>Thông tin cá nhân:</b> họ tên, email, số điện thoại, ngày sinh, thông tin tài
                  khoản;
                </li>
                <li>
                  <b>Thông tin học tập:</b> trường học, GPA, chứng chỉ, thành tích, hoạt động ngoại
                  khóa;
                </li>
                <li>
                  <b>Hồ sơ du học:</b> CV, bài luận/SOP, mục tiêu học tập, trường và học bổng quan
                  tâm;
                </li>
                <li>
                  <b>Thông tin giao dịch:</b> gói dịch vụ, thời điểm, giá trị và mã giao dịch;
                </li>
                <li>
                  <b>Dữ liệu kỹ thuật:</b> thiết bị, trình duyệt, IP, thời gian và hoạt động sử
                  dụng nền tảng.
                </li>
              </ul>
              <p className="text-sm italic text-slate-500">
                Người dùng chịu trách nhiệm đảm bảo thông tin cung cấp cho GlowBal là chính xác và
                hợp pháp.
              </p>
            </div>
          ),
        },
        {
          heading: '3. Mục đích sử dụng dữ liệu',
          body: (
            <div className="space-y-2">
              <p>GlowBal sử dụng dữ liệu để:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Cung cấp và quản lý Dịch vụ;</li>
                <li>Cá nhân hóa trải nghiệm Người dùng;</li>
                <li>Phân tích hồ sơ và đưa ra đề xuất về trường, học bổng;</li>
                <li>Vận hành tính năng AI và AI Matching;</li>
                <li>Kết nối Người dùng với Achiever/Mentor;</li>
                <li>Xử lý thanh toán và hoàn tiền;</li>
                <li>Hỗ trợ khách hàng;</li>
                <li>Phát hiện gian lận và bảo vệ an toàn hệ thống;</li>
                <li>Phân tích và cải thiện sản phẩm, công nghệ;</li>
                <li>Tuân thủ nghĩa vụ pháp lý.</li>
              </ul>
            </div>
          ),
        },
        {
          heading: '4. Dữ liệu và công nghệ AI',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal có thể xử lý thông tin Người dùng cung cấp, bao gồm hồ sơ học tập, CV,
                bài luận và mục tiêu du học, để vận hành các tính năng AI và tạo ra các đề xuất phù
                hợp.
              </p>
              <p>
                GlowBal có thể sử dụng dữ liệu ở dạng phù hợp để phân tích, cải thiện chất lượng
                và hiệu suất của Dịch vụ, đồng thời áp dụng các biện pháp bảo vệ phù hợp trong
                quá trình xử lý.
              </p>
            </div>
          ),
        },
        {
          heading: '5. Chia sẻ thông tin',
          body: (
            <div className="space-y-2">
              <p className="font-medium">GlowBal không bán dữ liệu cá nhân của Người dùng.</p>
              <p>Trong phạm vi cần thiết, GlowBal có thể chia sẻ dữ liệu với:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Nhà cung cấp công nghệ, AI, hosting và thanh toán;</li>
                <li>Đối tác hỗ trợ vận hành Dịch vụ;</li>
                <li>
                  Achiever/Mentor khi Người dùng chủ động sử dụng tính năng kết nối;
                </li>
                <li>Cơ quan nhà nước hoặc bên liên quan khi pháp luật yêu cầu hoặc cho phép.</li>
              </ul>
              <p className="text-sm italic text-slate-500">
                GlowBal chỉ chia sẻ thông tin cần thiết cho mục đích tương ứng và áp dụng các biện
                pháp bảo vệ phù hợp.
              </p>
            </div>
          ),
        },
        {
          heading: '6. Bảo mật và lưu trữ dữ liệu',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal áp dụng các biện pháp kỹ thuật và tổ chức hợp lý nhằm bảo vệ dữ liệu khỏi
                việc truy cập, sử dụng, thay đổi hoặc tiết lộ trái phép.
              </p>
              <p>
                Dữ liệu được lưu trữ trong thời gian cần thiết để cung cấp Dịch vụ, thực hiện giao
                dịch, giải quyết tranh chấp, đảm bảo an toàn hệ thống và đáp ứng nghĩa vụ pháp lý.
              </p>
              <p className="text-sm italic text-slate-500">
                Không có phương thức lưu trữ hoặc truyền tải dữ liệu nào trên Internet có thể đảm
                bảo an toàn tuyệt đối.
              </p>
            </div>
          ),
        },
        {
          heading: '7. Quyền của Người dùng',
          body: (
            <div className="space-y-2">
              <p>Trong phạm vi pháp luật cho phép, Người dùng có quyền:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Yêu cầu biết và truy cập dữ liệu cá nhân;</li>
                <li>Yêu cầu chỉnh sửa thông tin không chính xác;</li>
                <li>Yêu cầu xóa tài khoản hoặc dữ liệu;</li>
                <li>Rút lại sự đồng ý đối với một số hoạt động xử lý;</li>
                <li>Yêu cầu giải thích về việc sử dụng dữ liệu.</li>
              </ul>
              <p>
                Yêu cầu liên quan đến dữ liệu cá nhân được gửi về:{' '}
                <a href="mailto:glowbal.edu@gmail.com" className="font-semibold text-[#E11D48]">
                  glowbal.edu@gmail.com
                </a>
              </p>
              <p className="text-sm italic text-slate-500">
                GlowBal có thể yêu cầu xác minh danh tính trước khi xử lý yêu cầu.
              </p>
            </div>
          ),
        },
        {
          heading: '8. Cookie và dịch vụ bên thứ ba',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal có thể sử dụng Cookies và công nghệ tương tự để duy trì đăng nhập, ghi nhớ
                tùy chọn, phân tích hoạt động và cải thiện trải nghiệm Người dùng.
              </p>
              <p>
                Nền tảng có thể chứa liên kết hoặc sử dụng dịch vụ của bên thứ ba. Các dịch vụ này
                có thể có chính sách bảo mật riêng và GlowBal khuyến nghị Người dùng xem xét các
                chính sách đó trước khi cung cấp thông tin.
              </p>
            </div>
          ),
        },
        {
          heading: '9. Thay đổi chính sách',
          body: (
            <p>
              GlowBal có thể cập nhật Chính sách Bảo mật để phản ánh những thay đổi về Dịch vụ,
              công nghệ, hoạt động xử lý dữ liệu hoặc quy định pháp luật. Phiên bản mới sẽ được
              công bố trên Nền tảng cùng với ngày cập nhật. Việc tiếp tục sử dụng Dịch vụ sau khi
              Chính sách được cập nhật được hiểu là Người dùng đã tiếp tục đồng ý với phiên bản
              mới, trong phạm vi pháp luật cho phép.
            </p>
          ),
        },
        {
          heading: '10. Liên hệ',
          body: (
            <div className="space-y-1 font-medium">
              <p>
                Nếu có câu hỏi, yêu cầu hoặc khiếu nại liên quan đến quyền riêng tư và dữ liệu cá
                nhân, vui lòng liên hệ:
              </p>
              <p>
                <b>GLOWBAL EDUCATION</b>
              </p>
              <p>
                📧 Email:{' '}
                <a href="mailto:glowbal.edu@gmail.com" className="text-[#E11D48] underline">
                  glowbal.edu@gmail.com
                </a>
              </p>
              <p>
                🌐 Website:{' '}
                <a href="https://glowbal-education.com" className="text-[#E11D48] underline">
                  GlowBal Education
                </a>
              </p>
              <p className="mt-2 text-slate-500">GO GLOW – GO GLOBAL ✈️🌍</p>
            </div>
          ),
        },
      ]}
    />
  );
}
