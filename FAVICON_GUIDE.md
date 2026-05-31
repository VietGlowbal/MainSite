# Favicon Update Guide - Globe Icon

## What Was Changed

Your website icon has been updated from the Vercel logo to a custom globe icon. Three approaches have been implemented:

### 1. **Static Globe Icon** (Default for most browsers)
- **File**: `src/app/icon.tsx`
- **What it does**: Generates a static PNG globe icon (32x32)
- **Used for**: Browser tabs, bookmarks, and most favicon displays
- **Color**: Blue (#3b82f6) globe with latitude/longitude lines

### 2. **Apple Touch Icon** (iOS/macOS)
- **File**: `src/app/apple-icon.tsx`
- **What it does**: Generates a larger icon (180x180) with gradient background
- **Used for**: iOS home screen, macOS touch bar
- **Color**: Purple gradient background with white globe

### 3. **Animated Globe Icon** (GIF-like effect) ✨
- **File**: `src/components/animated-favicon.tsx`
- **What it does**: Creates a rotating globe animation in the browser tab
- **Used for**: Dynamic favicon that rotates continuously
- **Animation**: 8-frame rotation at 8 FPS (smooth spinning effect)

## How It Works

The animated favicon uses a client-side canvas to draw and rotate the globe, then updates the favicon dynamically. This creates a GIF-like effect without needing an actual GIF file.

### Animation Details:
- **Rotation**: Full 360° rotation
- **Speed**: 8 frames per second (1 second per full rotation)
- **Performance**: Lightweight, uses requestAnimationFrame
- **Browser Support**: Works in all modern browsers

## Customization Options

### Change Colors

Edit `src/components/animated-favicon.tsx`:

```typescript
// Change globe color (currently blue)
ctx.strokeStyle = '#3b82f6' // Change this hex color

// For gradient effect:
const gradient = ctx.createLinearGradient(0, 0, 32, 32)
gradient.addColorStop(0, '#667eea')
gradient.addColorStop(1, '#764ba2')
ctx.strokeStyle = gradient
```

### Change Animation Speed

```typescript
// Slower rotation (2 seconds per rotation)
const interval = setInterval(animate, 250) // was 125

// Faster rotation (0.5 seconds per rotation)
const interval = setInterval(animate, 62.5) // was 125
```

### Disable Animation

If you want just the static globe icon, remove this line from `src/app/layout.tsx`:

```typescript
<AnimatedFavicon />
```

### Change Globe Design

Edit the drawing code in `animated-favicon.tsx`:
- Adjust `ctx.arc()` for circle size
- Adjust `ctx.ellipse()` for latitude/longitude lines
- Add more lines or remove some for different globe styles

## Testing

1. **Development**: Run `npm run dev` and check your browser tab
2. **Production**: Build with `npm run build` and test
3. **Mobile**: Add to iOS home screen to see the Apple icon

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Static Icon | ✅ | ✅ | ✅ | ✅ |
| Animated Icon | ✅ | ✅ | ✅ | ✅ |
| Apple Icon | ✅ | ✅ | ✅ | ✅ |

## Files Modified

1. ✅ `src/app/icon.tsx` - Static favicon generator
2. ✅ `src/app/apple-icon.tsx` - Apple touch icon generator
3. ✅ `src/components/animated-favicon.tsx` - Animated favicon component
4. ✅ `src/app/layout.tsx` - Added AnimatedFavicon component and metadata

## Next Steps

- The old `favicon.ico` file can be deleted if you want
- Customize colors to match your brand
- Adjust animation speed to your preference
- Consider adding different animations for different pages/states
