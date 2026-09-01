'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

/**
 * Renders the guide's Markdown body in its stored language. Editorial prose is
 * not machine-translated into a Vietnamese SEO page without a reviewed source.
 */
export function ArticleBody({ content }: { content: string }) {
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
        {content}
      </ReactMarkdown>
    </article>
  );
}
