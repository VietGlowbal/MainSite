'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAutoTranslate } from '@/lib/use-auto-translate';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

/**
 * Renders the guide's Markdown body. When the site language is Vietnamese the
 * Markdown is machine-translated (preserving formatting) via /api/translate;
 * in English it renders the source directly.
 */
export function ArticleBody({ content }: { content: string }) {
  const body = useAutoTranslate(content);
  return (
    <article className="geo-article mt-10">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => {
            const flattened = Array.isArray(children) ? children.join(' ') : String(children);
            return <h2 id={slugify(flattened)}>{children}</h2>;
          },
          table: ({ children }) => (
            <div className="geo-table-wrap">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
