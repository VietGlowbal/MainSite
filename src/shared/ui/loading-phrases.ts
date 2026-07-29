/**
 * The line the globe loader cycles through while the app is busy.
 *
 * These are deliberately playful rather than informative: the *useful* half of
 * the message is the optional `label` a caller passes to the loader ("Saving
 * your profile"), which renders underneath. This line's whole job is to make a
 * wait feel attended-to rather than frozen.
 *
 * Rules for adding one:
 *  - Present-participle, or a short present-participle phrase. It is always
 *    read with three appearing dots after it, so it has to be grammatical as
 *    "Pondering..." and never as a complete sentence.
 *  - Bilingual, like the rest of the app. Vietnamese takes the "Đang ..."
 *    progressive rather than a literal gerund, which Vietnamese has no form
 *    for. Pairs live here rather than in `i18n-dictionary` on purpose: the
 *    dictionary is keyed on exact English UI strings and is also the seed
 *    corpus for DomTranslator, and forty joke gerunds would be noise in both.
 *  - Nothing that could be read as a real status claim. "Contacting the
 *    university" would be a lie; "Consulting the atlas" cannot be mistaken for
 *    one. The user is waiting on a request, not on a whimsical narrator.
 *  - Nothing that implies failure or lost work. A user watching this line
 *    during a slow save is already nervous.
 */
export type LoadingPhrase = {
  readonly en: string;
  readonly vi: string;
};

export const LOADING_PHRASES: readonly LoadingPhrase[] = [
  // ── Thinking noises ────────────────────────────────────────────────────
  { en: 'Discombobulating', vi: 'Đang xáo tung mọi thứ' },
  { en: 'Pondering', vi: 'Đang nghiền ngẫm' },
  { en: 'Ruminating', vi: 'Đang ngẫm nghĩ' },
  { en: 'Cogitating', vi: 'Đang suy tư' },
  { en: 'Percolating', vi: 'Đang ủ ý tưởng' },
  { en: 'Noodling', vi: 'Đang mày mò' },
  { en: 'Marinating', vi: 'Đang ướp ý tưởng' },
  { en: 'Simmering', vi: 'Đang ninh nhừ' },
  { en: 'Deliberating', vi: 'Đang cân nhắc' },
  { en: 'Untangling', vi: 'Đang gỡ rối' },
  { en: 'Finagling', vi: 'Đang xoay xở' },
  { en: 'Wrangling', vi: 'Đang thu xếp' },
  { en: 'Bamboozling', vi: 'Đang bày trò' },
  { en: 'Singing', vi: 'Đang ngân nga' },
  { en: 'Humming', vi: 'Đang ngâm nga' },
  { en: 'Rummaging', vi: 'Đang lục lọi' },
  { en: 'Tidying up', vi: 'Đang dọn dẹp' },
  { en: 'Warming up', vi: 'Đang khởi động' },
  { en: 'Brewing', vi: 'Đang pha chế' },
  { en: 'Counting to infinity', vi: 'Đang đếm đến vô cực' },
  { en: 'Alphabetising', vi: 'Đang xếp theo bảng chữ cái' },
  { en: 'Sharpening pencils', vi: 'Đang gọt bút chì' },
  { en: 'Buffering optimism', vi: 'Đang nạp thêm lạc quan' },

  // ── On-theme: the globe is spinning, so lean into it ───────────────────
  { en: 'Spinning the globe', vi: 'Đang quay quả địa cầu' },
  { en: 'Consulting the atlas', vi: 'Đang tra cứu bản đồ' },
  { en: 'Charting the route', vi: 'Đang vạch lộ trình' },
  { en: 'Crossing time zones', vi: 'Đang băng qua các múi giờ' },
  { en: 'Packing a suitcase', vi: 'Đang xếp hành lý' },
  { en: 'Checking the weather abroad', vi: 'Đang xem thời tiết bên kia' },
  { en: 'Shortlisting', vi: 'Đang lọc danh sách' },
  { en: 'Weighing the odds', vi: 'Đang cân đo cơ hội' },
  { en: 'Reading the fine print', vi: 'Đang đọc kỹ điều khoản' },
  { en: 'Proofreading', vi: 'Đang soát lỗi' },
  { en: 'Double-checking', vi: 'Đang kiểm tra lại' },
  { en: 'Triangulating', vi: 'Đang định vị' },
  { en: 'Calibrating', vi: 'Đang hiệu chỉnh' },
  { en: 'Synthesising', vi: 'Đang tổng hợp' },
];

/**
 * A phrase index that is not the one currently showing.
 *
 * Sequential cycling would make the loader legible as a fixed list after two
 * or three waits; picking at random would repeat the same word back-to-back
 * roughly one time in forty, which reads as the animation having frozen.
 */
export function nextPhraseIndex(current: number, random = Math.random): number {
  if (LOADING_PHRASES.length < 2) return 0;
  // Draw from the list minus the current entry, then fold the hole back in, so
  // every other phrase stays equally likely.
  const draw = Math.floor(random() * (LOADING_PHRASES.length - 1));
  return draw >= current ? draw + 1 : draw;
}
