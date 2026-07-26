import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import path from 'node:path';
import rehypeAutoInternalLinks from './src/plugins/auto-internal-links/index.mjs';
import rehypeRelatedCallouts from './src/plugins/related-callouts/index.mjs';
import { buildLastmodMap } from './src/lib/sitemap-lastmod.mjs';

// Languages collection routes via frontmatter.language + frontmatter.concept,
// not the filename. All other collections use the standard file-path mapping.
//
// The category check matters: cheatsheets may also carry `language` + `concept`
// (javascript-array-cheatsheet declares javascript/array-methods, which is also
// a real language post), and without it they resolve onto the language article's
// URL instead of their own.
function devnookUrlBuilder({ filePath, frontmatter, contentDir }) {
  if (frontmatter.category === 'languages' && frontmatter.language && frontmatter.concept) {
    const lang = String(frontmatter.language).toLowerCase();
    const concept = String(frontmatter.concept).toLowerCase();
    return `/languages/${lang}/${concept}/`;
  }
  // Normalize explicit overrides to the canonical trailing-slash form so
  // internal links never point at the no-slash variant (which 301-redirects).
  const withTrailingSlash = (u) => (u.endsWith('/') ? u : u + '/');
  if (frontmatter.permalink) return withTrailingSlash(frontmatter.permalink);
  if (frontmatter.url) return withTrailingSlash(frontmatter.url);
  let rel = path.relative(contentDir, filePath)
    .replace(/\.(md|mdx)$/i, '')
    .replace(/[\\/]index$/, '');
  if (frontmatter.slug) {
    const dir = path.dirname(rel);
    rel = (dir === '.' || dir === '') ? frontmatter.slug : `${dir}/${frontmatter.slug}`;
  }
  return '/' + rel.split(path.sep).join('/').replace(/^\/+|\/+$/g, '') + '/';
}

// pathname -> ISO date, so each sitemap entry carries its own <lastmod>.
const lastmodByPath = buildLastmodMap(devnookUrlBuilder);

export default defineConfig({
  site: 'https://devnook.dev',
  output: 'static',
  integrations: [
    sitemap({
      serialize(item) {
        const { pathname } = new URL(item.url);
        const lastmod = lastmodByPath.get(pathname);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
  image: {
    service: {
      entrypoint: 'astro/assets/services/noop'
    }
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    },
    rehypePlugins: [
      [rehypeAutoInternalLinks, {
        contentDir: 'src/content',
        autoAnchors: true,
        maxLinksPerPage: 8,
        maxLinksPerTarget: 1,
        dryRun: false,
        verbose: true,
        urlBuilder: devnookUrlBuilder,
      }],
      [rehypeRelatedCallouts, {
        contentDir: 'src/content',
        wordThreshold: 500,
        maxCallouts: 3,
        verbose: true,
        urlBuilder: devnookUrlBuilder,
      }],
    ],
  }
});
