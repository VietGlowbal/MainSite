export const VINUNI_DEFAULT_ESSAY_PROMPT =
  'Mô tả một thành tựu cá nhân đạt được nhờ cam kết lâu dài và một khát vọng cá nhân trong tương lai.';

export const VINUNI_DEMO_APPLICATION_ID = 'vinuni-demo';

export function createVinUniInputHash(essay: string, essayPrompt: string) {
  const value = `${essay.trim()}\u0000${essayPrompt.trim()}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v2-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
