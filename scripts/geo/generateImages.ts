import fs from 'node:fs';
import path from 'node:path';
import { buildHeroImagePrompt, ensureDir, inferTopic, parseFrontmatter, paths, readMarkdown, writeFallbackNewsImage, writeJsonFile } from './lib';

type ImageEntry = {
  slug: string;
  title: string;
  topic: string;
  prompt: string;
  imagePath: string;
  imageStyle: 'svg-fallback' | 'ai';
};

function listMarkdownFiles() {
  const dirs = [paths.publishedDir, paths.draftsDir];
  const files: string[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) if (file.endsWith('.md')) files.push(path.join(dir, file));
  }
  return files;
}

function main() {
  ensureDir(paths.publicNewsImagesDir);
  const manifest: ImageEntry[] = [];
  for (const filePath of listMarkdownFiles()) {
    const markdown = readMarkdown(filePath);
    const { frontmatter, body } = parseFrontmatter(markdown);
    const slug = frontmatter.slug ?? path.basename(filePath, '.md');
    const title = frontmatter.title ?? slug;
    const topic = inferTopic(frontmatter, body);
    const pngPath = path.join(paths.publicNewsImagesDir, `${slug}.png`);
    const webpPath = path.join(paths.publicNewsImagesDir, `${slug}.webp`);
    const imagePath = fs.existsSync(pngPath)
      ? `/generated/news/${slug}.png`
      : fs.existsSync(webpPath)
        ? `/generated/news/${slug}.webp`
        : `/generated/news/${slug}.svg`;

    if (!fs.existsSync(pngPath) && !fs.existsSync(webpPath)) {
      writeFallbackNewsImage(slug, title, topic, frontmatter.targetCountry);
    }

    manifest.push({
      slug,
      title,
      topic,
      prompt: buildHeroImagePrompt(frontmatter, topic),
      imagePath,
      imageStyle: imagePath.endsWith('.svg') ? 'svg-fallback' : 'ai',
    });
  }

  writeJsonFile(path.join(paths.reportsDir, 'image-manifest.json'), manifest);
  console.log(JSON.stringify({ generated: manifest.length, report: 'content/geo/reports/image-manifest.json' }, null, 2));
}

main();
