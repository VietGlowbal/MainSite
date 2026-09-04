/**
 * Auth surface — sign in, sign up, password reset, and the error messages the
 * auth routes return.
 *
 * The error entries must match `AUTH_ERROR_MESSAGES` in
 * `src/features/auth/domain/errors.ts` CHARACTER FOR CHARACTER, placeholders
 * included: the English text is the lookup key. A drifted key is not a crash —
 * `t()` falls back to English — which is exactly why it is easy to miss. A unit
 * test asserts every code has an entry here.
 */
export const AUTH_TRANSLATIONS: Record<string, string> = {
  // ── Route errors (keys mirror AUTH_ERROR_MESSAGES) ──────────────────────
  'We could not read that request. Please try again.':
    'Chúng tôi không đọc được yêu cầu đó. Vui lòng thử lại.',
  'Please enter a valid email and password.':
    'Vui lòng nhập email và mật khẩu hợp lệ.',
  'Please check the fields below.': 'Vui lòng kiểm tra lại các trường bên dưới.',
  'Please enter a password.': 'Vui lòng nhập mật khẩu.',
  'Password must be at least {min} characters.': 'Mật khẩu phải có ít nhất {min} ký tự.',
  'Password must be {max} characters or fewer.': 'Mật khẩu không được vượt quá {max} ký tự.',
  'This password has appeared in a known data breach. Please choose a different password.':
    'Mật khẩu này đã xuất hiện trong một vụ rò rỉ dữ liệu đã biết. Vui lòng chọn mật khẩu khác.',
  'An account with this email already exists. Try signing in instead.':
    'Email này đã có tài khoản. Hãy thử đăng nhập.',
  'Could not create your account. Please try again.':
    'Không thể tạo tài khoản. Vui lòng thử lại.',
  'This reset link is invalid or has expired. Please request a new one.':
    'Liên kết đặt lại này không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.',
  'Could not update your password. Please try again.':
    'Không thể cập nhật mật khẩu. Vui lòng thử lại.',
  'Too many attempts. Please wait a moment and try again.':
    'Quá nhiều lần thử. Vui lòng đợi một chút rồi thử lại.',

  // ── Client-side messages that never reach a route ───────────────────────
  'Those passwords do not match.': 'Hai mật khẩu không khớp.',
  'Could not send the reset link.': 'Không gửi được liên kết đặt lại.',
  'Could not update your password.': 'Không thể cập nhật mật khẩu.',
  'Something went wrong': 'Đã có lỗi xảy ra',

  // ── Sign in / sign up ───────────────────────────────────────────────────
  'Welcome back 👋': 'Chào mừng trở lại 👋',
  'Sign in to continue your journey.': 'Đăng nhập để tiếp tục hành trình của bạn.',
  'Create an account': 'Tạo tài khoản',
  'Join thousands of students finding their dream university.':
    'Cùng hàng nghìn học sinh tìm được ngôi trường mơ ước.',
  Password: 'Mật khẩu',
  'Create account': 'Tạo tài khoản',
  'Sign in': 'Đăng nhập',
  'Sign up': 'Đăng ký',
  'Please wait…': 'Vui lòng đợi…',
  'Continue with Google': 'Tiếp tục với Google',
  'Already have an account?': 'Đã có tài khoản?',
  "Don't have an account?": 'Chưa có tài khoản?',
  'Show password': 'Hiện mật khẩu',
  'Hide password': 'Ẩn mật khẩu',
  'At least {min} characters. Checked against known data breaches.':
    'Ít nhất {min} ký tự. Được đối chiếu với các vụ rò rỉ dữ liệu đã biết.',
  'Check your inbox': 'Kiểm tra hộp thư của bạn',
  'We sent a confirmation link to {email}. Click it to activate your account.':
    'Chúng tôi đã gửi liên kết xác nhận tới {email}. Nhấn vào đó để kích hoạt tài khoản.',

  // ── Password reset ──────────────────────────────────────────────────────
  'Forgot password?': 'Quên mật khẩu?',
  'Reset your password': 'Đặt lại mật khẩu',
  'Enter your email and we will send you a link to choose a new password.':
    'Nhập email của bạn, chúng tôi sẽ gửi liên kết để bạn chọn mật khẩu mới.',
  'Send reset link': 'Gửi liên kết đặt lại',
  'Remembered it?': 'Nhớ ra rồi?',
  'If an account exists for {email}, we have sent a link to reset its password. The link expires in one hour.':
    'Nếu {email} có tài khoản, chúng tôi đã gửi liên kết để đặt lại mật khẩu. Liên kết hết hạn sau một giờ.',
  'Choose a new password': 'Chọn mật khẩu mới',
  'You will be signed in once your new password is saved.':
    'Bạn sẽ được đăng nhập ngay sau khi mật khẩu mới được lưu.',
  'New password': 'Mật khẩu mới',
  'Confirm new password': 'Xác nhận mật khẩu mới',
  'Create a password': 'Tạo mật khẩu',
  'Re-enter your password': 'Nhập lại mật khẩu',
  'Save new password': 'Lưu mật khẩu mới',
  'Back to sign in': 'Quay lại đăng nhập',
  'This reset link is not valid': 'Liên kết đặt lại không hợp lệ',
  'The link may have expired or already been used. Request a new one to continue.':
    'Liên kết có thể đã hết hạn hoặc đã được dùng. Hãy yêu cầu liên kết mới để tiếp tục.',
};
