import { describe, expect, it } from 'vitest';
import { translations } from '@/lib/i18n-dictionary';
import { TARGET_PROFILE_FIELD_DEFS } from './target-profile';

const vietnamese = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;

describe('target profile static localization', () => {
  it('uses English source copy with a Vietnamese dictionary entry', () => {
    for (const field of TARGET_PROFILE_FIELD_DEFS) {
      for (const source of [field.label, field.hint, field.example]) {
        expect(source, field.key).not.toMatch(vietnamese);
        expect(translations[source], source).toBeTruthy();
      }
    }
  });
});
