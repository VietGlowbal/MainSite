import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Điều khoản và Điều kiện Sử dụng | GlowBal Education',
  description:
    'Điều khoản và Điều kiện Sử dụng Nền tảng GlowBal Education — Các điều khoản chi phối việc sử dụng nền tảng và dịch vụ GlowBal.',
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions of Use"
      lastUpdated="15/08/2026"
      intro={
        <p className="leading-relaxed">
          Bằng việc truy cập, đăng ký hoặc sử dụng nền tảng GlowBal Education (“GlowBal”, “Nền
          tảng”, “chúng tôi”), bao gồm website, ứng dụng và các dịch vụ liên quan (“Dịch vụ”),
          Người dùng (“Bạn”, “Người dùng”) xác nhận rằng đã đọc, hiểu và đồng ý tuân thủ các Điều
          khoản và Điều kiện Sử dụng này (“Điều khoản”). Nếu bạn không đồng ý với bất kỳ nội dung
          nào của Điều khoản, vui lòng không sử dụng Dịch vụ.
        </p>
      }
      sections={[
        {
          heading: '1. Chấp nhận Điều khoản',
          body: (
            <p>
              Bằng việc truy cập, đăng ký hoặc sử dụng nền tảng GlowBal Education, bạn xác nhận
              đã đọc, hiểu và đồng ý tuân thủ các Điều khoản và Điều kiện Sử dụng này.
            </p>
          ),
        },
        {
          heading: '2. Định nghĩa',
          body: (
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <b>“Nền tảng”</b> là hệ thống website, ứng dụng và các sản phẩm công nghệ do
                GlowBal vận hành.
              </li>
              <li>
                <b>“Dịch vụ”</b> là toàn bộ sản phẩm, tính năng và dịch vụ được GlowBal cung cấp
                trên Nền tảng.
              </li>
              <li>
                <b>“Nội dung”</b> là thông tin, dữ liệu, văn bản, hình ảnh, video, phần mềm, tài
                liệu và các tài sản khác được cung cấp trên Nền tảng.
              </li>
              <li>
                <b>“Người dùng”</b> là cá nhân đăng ký hoặc sử dụng Dịch vụ, bao gồm cả người
                dùng miễn phí và người dùng trả phí.
              </li>
              <li>
                <b>“Cố vấn/Achiever/Mentor”</b> là cá nhân hoặc tổ chức cung cấp dịch vụ tư vấn,
                cố vấn hoặc hỗ trợ thông qua hoặc liên quan đến Nền tảng.
              </li>
              <li>
                <b>“Tổ chức giáo dục”</b> là trường đại học, cao đẳng, trường học, tổ chức học
                bổng hoặc tổ chức giáo dục khác được đề cập trên Nền tảng.
              </li>
            </ul>
          ),
        },
        {
          heading: '3. Điều kiện sử dụng',
          body: (
            <div className="space-y-2">
              <p>GlowBal dành cho Người dùng từ đủ 16 tuổi trở lên.</p>
              <p>Khi đăng ký hoặc sử dụng Dịch vụ, Người dùng xác nhận rằng:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Đã đủ 16 tuổi;</li>
                <li>Có đầy đủ năng lực để chấp nhận và thực hiện Điều khoản;</li>
                <li>Cung cấp thông tin chính xác, đầy đủ và trung thực;</li>
                <li>Sử dụng Dịch vụ cho mục đích hợp pháp;</li>
                <li>Chịu trách nhiệm đối với hoạt động phát sinh từ tài khoản của mình.</li>
              </ul>
              <p>
                Người dùng từ 16 đến dưới 18 tuổi được khuyến nghị sử dụng Dịch vụ với sự đồng ý
                và giám sát của cha, mẹ hoặc người giám hộ hợp pháp, đặc biệt đối với các Dịch vụ
                có phát sinh thanh toán hoặc kết nối trực tiếp với Cố vấn/Achiever/Mentor.
              </p>
              <p className="text-sm italic text-slate-500">
                GlowBal có quyền yêu cầu xác minh độ tuổi hoặc thông tin tài khoản khi cần thiết.
                Nếu phát hiện Người dùng chưa đủ 16 tuổi, cung cấp thông tin sai lệch hoặc sử dụng
                danh tính của người khác, GlowBal có quyền từ chối cung cấp Dịch vụ, tạm khóa hoặc
                chấm dứt tài khoản.
              </p>
            </div>
          ),
        },
        {
          heading: '4. Phạm vi dịch vụ',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal cung cấp nền tảng công nghệ hỗ trợ giáo dục và định hướng du học, bao gồm
                nhưng không giới hạn:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <b>GlowBal Matcher:</b> tìm kiếm và định hướng trường đại học, học bổng và Cố
                  vấn;
                </li>
                <li>
                  <b>Strategy Master:</b> phân tích hồ sơ, xây dựng chiến lược, theo dõi tiến độ
                  và hỗ trợ tài liệu như CV, bài luận và thư giới thiệu;
                </li>
                <li>
                  <b>My Portal:</b> quản lý lựa chọn, theo dõi hồ sơ ứng tuyển và lưu trữ tài
                  liệu;
                </li>
                <li>Cơ sở dữ liệu về trường đại học, học bổng và Cố vấn;</li>
                <li>
                  Các công cụ AI và dịch vụ trả phí khác được GlowBal cung cấp theo từng thời
                  điểm.
                </li>
              </ul>
              <p className="text-sm italic text-slate-500">
                Các Dịch vụ nhằm hỗ trợ Người dùng nghiên cứu, lập kế hoạch và chuẩn bị hồ sơ và
                không được xem là lời khuyên pháp lý, tài chính hoặc chuyên môn chính thức.
              </p>
            </div>
          ),
        },
        {
          heading: '5. Vai trò của GlowBal',
          body: (
            <div className="space-y-2">
              <p>Người dùng hiểu và đồng ý rằng:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  GlowBal là nền tảng công nghệ và đơn vị hỗ trợ, cung cấp công cụ, thông tin và
                  kết nối cho Người dùng;
                </li>
                <li>
                  GlowBal không phải là trường đại học, tổ chức cấp học bổng, cơ quan tuyển sinh
                  hoặc cơ quan cấp visa;
                </li>
                <li>
                  GlowBal không có quyền quyết định việc tuyển sinh, cấp học bổng hoặc cấp visa;
                </li>
                <li>
                  Các quyết định cuối cùng thuộc về trường đại học, tổ chức học bổng và cơ quan
                  có thẩm quyền tương ứng.
                </li>
              </ul>
            </div>
          ),
        },
        {
          heading: '6. Không cam kết về kết quả',
          body: (
            <div className="space-y-2">
              <p>GlowBal không cam kết hoặc bảo đảm rằng Người dùng sẽ:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Được nhận vào một trường đại học cụ thể;</li>
                <li>Nhận được học bổng;</li>
                <li>Được cấp visa;</li>
                <li>Đạt một mức điểm hoặc kết quả cụ thể;</li>
                <li>Đạt được bất kỳ kết quả tuyển sinh hoặc nghề nghiệp nào.</li>
              </ul>
              <p>
                Thông tin, phân tích, chiến lược và đề xuất trên GlowBal chỉ mang tính chất tham
                khảo và hỗ trợ. Kết quả thực tế phụ thuộc vào nhiều yếu tố, bao gồm năng lực của
                Người dùng, chất lượng hồ sơ, mức độ cạnh tranh, yêu cầu của từng tổ chức và quyết
                định của bên có thẩm quyền.
              </p>
              <p className="text-sm italic text-slate-500">
                Người dùng có trách nhiệm tự kiểm tra và xác minh thông tin từ các nguồn chính thức
                trước khi đưa ra quyết định.
              </p>
            </div>
          ),
        },
        {
          heading: '7. Trách nhiệm của Người dùng',
          body: (
            <div className="space-y-2">
              <p>Khi sử dụng Dịch vụ, Người dùng cam kết:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Cung cấp thông tin và tài liệu trung thực, chính xác và đầy đủ;</li>
                <li>Không sử dụng hồ sơ, chứng chỉ hoặc tài liệu giả mạo;</li>
                <li>Tự xác minh deadline, yêu cầu và quy trình ứng tuyển;</li>
                <li>Chịu trách nhiệm đối với việc đáp ứng các thời hạn ứng tuyển;</li>
                <li>Không sử dụng GlowBal cho mục đích bất hợp pháp hoặc gây hại;</li>
                <li>
                  Không can thiệp, phá hoại hoặc gây ảnh hưởng đến hoạt động của Nền tảng.
                </li>
              </ul>
            </div>
          ),
        },
        {
          heading: '8. Chính sách hoàn tiền',
          body: (
            <div className="space-y-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
              <div>
                <p>
                  <b>8.1. Thời hạn yêu cầu:</b> Trong vòng 24 giờ kể từ thời điểm đăng ký và
                  thanh toán Dịch vụ. Sau thời hạn này, yêu cầu hoàn tiền sẽ không được chấp nhận,
                  trừ trường hợp pháp luật có quy định khác.
                </p>
              </div>
              <div>
                <p>
                  <b>8.2. Mức hoàn tiền:</b> Hoàn lại 90% số tiền đã thanh toán. 10% còn lại được
                  giữ lại để bù đắp chi phí xử lý giao dịch, vận hành hệ thống và cung cấp Dịch
                  vụ.
                </p>
                <p className="text-sm italic text-slate-500">
                  Ví dụ: Thanh toán 1.000.000 VNĐ → số tiền hoàn lại là 900.000 VNĐ.
                </p>
              </div>
              <div>
                <p>
                  <b>8.3. Cách thức yêu cầu:</b> Gửi email đến{' '}
                  <a href="mailto:glowbal.edu@gmail.com" className="font-semibold text-[#E11D48]">
                    glowbal.edu@gmail.com
                  </a>{' '}
                  với tiêu đề{' '}
                  <code className="rounded bg-rose-100 px-1 text-sm">
                    [YÊU CẦU HOÀN TIỀN] – Họ tên – Email tài khoản
                  </code>
                  . Nội dung cần bao gồm: họ tên, email tài khoản, tên Dịch vụ, thời điểm và số
                  tiền thanh toán, mã giao dịch (nếu có), lý do yêu cầu hoàn tiền.
                </p>
              </div>
              <div>
                <p>
                  <b>8.4. Thời gian hoàn tiền:</b> Trong vòng 07–14 ngày làm việc về phương thức
                  thanh toán ban đầu hoặc phương thức phù hợp khác.
                </p>
              </div>
              <div>
                <p>
                  <b>8.5. Trường hợp không đủ điều kiện:</b> Yêu cầu gửi sau 24 giờ, không xác
                  minh được giao dịch, thông tin không chính xác, có dấu hiệu gian lận hoặc lạm
                  dụng chính sách, vi phạm Điều khoản, hoặc giao dịch thực hiện qua nền tảng có
                  chính sách hoàn tiền riêng.
                </p>
              </div>
            </div>
          ),
        },
        {
          heading: '9. Chính sách bảo lưu tài khoản',
          body: (
            <div className="space-y-2">
              <p>
                Người dùng có thể yêu cầu bảo lưu tài khoản tối đa 06 tháng kể từ ngày thanh
                toán.
              </p>
              <p>
                Tài khoản và các quyền lợi đi kèm không được chuyển nhượng, cho mượn, cho thuê
                hoặc sử dụng bởi bên thứ ba.
              </p>
              <p className="text-sm italic text-slate-500">
                Thời gian bảo lưu không làm gia hạn thời hạn yêu cầu hoàn tiền.
              </p>
            </div>
          ),
        },
        {
          heading: '10. Quyền sở hữu trí tuệ',
          body: (
            <div className="space-y-2">
              <p>
                Toàn bộ Nội dung, phần mềm, thiết kế, thương hiệu, logo và các tài sản trí tuệ
                khác trên Nền tảng thuộc sở hữu của GlowBal hoặc bên cấp phép hợp pháp và được bảo
                vệ theo quy định pháp luật về sở hữu trí tuệ.
              </p>
              <p>
                GlowBal cấp cho Người dùng quyền sử dụng có giới hạn, không độc quyền và không
                được chuyển nhượng, chỉ nhằm mục đích cá nhân và học tập.
              </p>
              <p className="text-sm italic text-slate-500">
                Người dùng không được sao chép, phân phối, sửa đổi, tạo tác phẩm phái sinh, công
                khai hoặc khai thác thương mại Nội dung của GlowBal nếu không có sự đồng ý trước
                bằng văn bản.
              </p>
            </div>
          ),
        },
        {
          heading: '11. Quyền riêng tư và bảo vệ dữ liệu',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal thu thập và xử lý dữ liệu cá nhân của Người dùng theo Chính sách Bảo mật
                được công bố trên Nền tảng.
              </p>
              <p>
                GlowBal áp dụng các biện pháp kỹ thuật và tổ chức phù hợp để bảo vệ dữ liệu Người
                dùng. Tuy nhiên, không có hệ thống công nghệ nào có thể đảm bảo an toàn tuyệt đối.
              </p>
            </div>
          ),
        },
        {
          heading: '12. Miễn trừ và giới hạn trách nhiệm',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal cung cấp Nền tảng và Dịch vụ theo tình trạng hiện có và không cam kết rằng
                Dịch vụ luôn hoạt động liên tục, hoàn toàn không có lỗi, luôn chính xác hoặc đáp
                ứng mọi nhu cầu cụ thể của Người dùng.
              </p>
              <p>
                Trong phạm vi pháp luật cho phép, trách nhiệm của GlowBal đối với Người dùng sẽ
                không vượt quá tổng số tiền Người dùng đã thanh toán cho GlowBal trong 06 tháng gần
                nhất trước thời điểm phát sinh khiếu nại.
              </p>
            </div>
          ),
        },
        {
          heading: '13. Bất khả kháng',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal không chịu trách nhiệm đối với sự chậm trễ, gián đoạn hoặc không thể thực
                hiện nghĩa vụ do các sự kiện nằm ngoài khả năng kiểm soát hợp lý, bao gồm nhưng
                không giới hạn ở:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Thiên tai, dịch bệnh, chiến tranh, đình công;</li>
                <li>Sự cố kỹ thuật hoặc sự cố từ nhà cung cấp dịch vụ bên thứ ba;</li>
                <li>Thay đổi chính sách của nhà cung cấp API hoặc công nghệ AI;</li>
                <li>Quyết định của cơ quan nhà nước có thẩm quyền.</li>
              </ul>
            </div>
          ),
        },
        {
          heading: '14. Tạm ngừng và chấm dứt tài khoản',
          body: (
            <div className="space-y-2">
              <p>GlowBal có quyền tạm ngừng hoặc chấm dứt quyền truy cập của Người dùng khi:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Vi phạm Điều khoản;</li>
                <li>Có hành vi gian lận hoặc sử dụng Dịch vụ trái pháp luật;</li>
                <li>Gây ảnh hưởng đến hệ thống hoặc Người dùng khác;</li>
                <li>Cung cấp thông tin giả mạo.</li>
              </ul>
              <p className="text-sm italic text-slate-500">
                Các điều khoản về sở hữu trí tuệ, bảo mật, miễn trừ trách nhiệm và giải quyết
                tranh chấp vẫn tiếp tục có hiệu lực sau khi tài khoản chấm dứt.
              </p>
            </div>
          ),
        },
        {
          heading: '15–19. Thay đổi điều khoản và Điều khoản chung',
          body: (
            <div className="space-y-2">
              <p>
                GlowBal có quyền sửa đổi, bổ sung hoặc thay thế Điều khoản này khi cần thiết.
                Phiên bản cập nhật sẽ được công bố trên Nền tảng cùng với ngày cập nhật mới. Việc
                tiếp tục sử dụng Dịch vụ sau khi Điều khoản được cập nhật được xem là Người dùng đã
                chấp nhận phiên bản mới.
              </p>
              <p>
                Điều khoản này được điều chỉnh và giải thích theo pháp luật của nước Cộng hòa Xã
                hội Chủ nghĩa Việt Nam. Mọi tranh chấp phát sinh trước tiên sẽ được ưu tiên giải
                quyết thông qua thương lượng.
              </p>
              <p className="text-sm italic text-slate-500">
                Nếu bất kỳ điều khoản nào bị xác định là vô hiệu hoặc không thể thi hành, các điều
                khoản còn lại vẫn giữ nguyên hiệu lực.
              </p>
            </div>
          ),
        },
        {
          heading: '20. Thông tin liên hệ',
          body: (
            <div className="space-y-1 font-medium">
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
