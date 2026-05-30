# Language Switcher Implementation

## Overview
Added a language switcher to allow users to toggle between English and Vietnamese throughout the site.

## Features

### Desktop Sidebar
- **Location**: In the sidebar footer, above the account/profile button
- **Design**: Full-width button with:
  - Globe icon on the left
  - Flag emoji + language name in the center
  - Dropdown arrow on the right
- **Languages**:
  - 🇬🇧 English
  - 🇻🇳 Tiếng Việt (Vietnamese)

### Mobile
- **Location**: Floating button in bottom-right corner
- **Design**: Compact pill button with:
  - Flag emoji
  - Language code (EN/VI)
- **Position**: Above the bottom navigation bar
- **Behavior**: Stays visible while scrolling

## Technical Implementation

### Files Created/Modified

1. **`src/lib/use-language.ts`** (NEW)
   - Custom React hook for language management
   - `useLanguage()` - Get/set current language
   - `useTranslation()` - Translation helper (placeholder for future i18n)
   - Stores preference in localStorage
   - Emits custom events for cross-component sync

2. **`src/components/nav-reveal.tsx`** (MODIFIED)
   - Added `LanguageSwitcher` component for desktop sidebar
   - Added `MobileLanguageButton` component for mobile
   - Both components sync via custom events

3. **`src/app/globals.css`** (MODIFIED)
   - Added `.glowbal-language-switcher` styles for desktop
   - Added `.glowbal-mobile-language-button` styles for mobile
   - Responsive positioning and animations

## Usage

### For Users
1. **Desktop**: Click the language button in the sidebar footer
2. **Mobile**: Tap the floating language button (bottom-right)
3. Language preference is saved and persists across sessions

### For Developers

#### Using the Language Hook
```typescript
import { useLanguage } from '@/lib/use-language';

function MyComponent() {
  const { language, setLanguage, toggleLanguage } = useLanguage();
  
  return (
    <div>
      <p>Current language: {language}</p>
      <button onClick={toggleLanguage}>Toggle Language</button>
      <button onClick={() => setLanguage('vi')}>Switch to Vietnamese</button>
    </div>
  );
}
```

#### Listening to Language Changes
```typescript
useEffect(() => {
  const handleLanguageChange = (e: CustomEvent<{ language: 'en' | 'vi' }>) => {
    console.log('Language changed to:', e.detail.language);
    // Update your component state, refetch data, etc.
  };
  
  window.addEventListener('glowbal:language-change', handleLanguageChange);
  return () => {
    window.removeEventListener('glowbal:language-change', handleLanguageChange);
  };
}, []);
```

#### Using Translations (Future)
```typescript
import { useTranslation } from '@/lib/use-language';

function MyComponent() {
  const t = useTranslation();
  
  return (
    <div>
      <h1>{t('home.title', 'Welcome to GLOWBAL')}</h1>
      <p>{t('home.subtitle', 'Your global education partner')}</p>
    </div>
  );
}
```

## Styling

### Desktop Button
- Width: 100% of sidebar footer
- Padding: 0.7rem 1rem
- Border radius: 12px
- Hover effect: Slight lift with shadow
- Transition: 200ms ease

### Mobile Button
- Position: Fixed, bottom-right
- Size: Compact pill (auto width)
- Z-index: 45 (above content, below modals)
- Hover effect: Lift with enhanced shadow
- Safe area aware: Respects device notches

## Future Enhancements

### Phase 1: Translation Infrastructure
- [ ] Integrate i18n library (e.g., next-intl, react-i18next)
- [ ] Create translation files (en.json, vi.json)
- [ ] Implement translation loading system
- [ ] Add translation keys to all UI text

### Phase 2: Content Translation
- [ ] Translate navigation items
- [ ] Translate page titles and descriptions
- [ ] Translate form labels and validation messages
- [ ] Translate error messages

### Phase 3: Dynamic Content
- [ ] Translate university data (names, descriptions)
- [ ] Translate mentor profiles
- [ ] Translate news articles
- [ ] Add language-specific content filtering

### Phase 4: Advanced Features
- [ ] Auto-detect user's browser language
- [ ] Add more languages (French, Spanish, etc.)
- [ ] Language-specific URLs (/en/universities, /vi/universities)
- [ ] SEO optimization for multilingual content

## Storage

- **Key**: `glowbal-language`
- **Values**: `'en'` | `'vi'`
- **Location**: localStorage
- **Default**: `'en'` (English)

## Events

### Custom Event: `glowbal:language-change`
- **Type**: CustomEvent
- **Detail**: `{ language: 'en' | 'vi' }`
- **Trigger**: When language is changed via any switcher
- **Purpose**: Sync language state across all components

## Browser Support

- Modern browsers with localStorage support
- Fallback to English if localStorage unavailable
- Custom events supported in all modern browsers
- Flag emojis display correctly in most systems

## Accessibility

- ✅ Keyboard accessible (tab navigation)
- ✅ ARIA labels for screen readers
- ✅ Clear visual feedback on hover/active
- ✅ Descriptive button titles
- ✅ Semantic HTML (button elements)

## Testing Checklist

- [x] Language persists after page reload
- [x] Desktop switcher works in sidebar
- [x] Mobile button appears and functions
- [x] Language syncs between desktop and mobile
- [x] No console errors
- [x] Build succeeds
- [ ] Test with actual Vietnamese translations
- [ ] Test on various devices and screen sizes
- [ ] Test with screen readers
- [ ] Test keyboard navigation
