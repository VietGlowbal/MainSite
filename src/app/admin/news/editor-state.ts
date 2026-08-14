/** Small state predicates kept pure so autosave edge cases stay testable. */
export function hasUnsavedRevision(savedRevision: number, currentRevision: number) {
  return savedRevision !== currentRevision;
}

export function uploadedImageTarget(target: 'hero' | 'inline', currentHeroImage: string, uploadedUrl: string) {
  return target === 'hero'
    ? { heroImage: uploadedUrl, inlineImageUrl: null }
    : { heroImage: currentHeroImage, inlineImageUrl: uploadedUrl };
}
