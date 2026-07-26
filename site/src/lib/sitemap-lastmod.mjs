// Builds a `pathname -> ISO date` map used to emit per-page <lastmod> in the
// sitemap. @astrojs/sitemap's own `lastmod` option stamps a single identical
// date on every URL, which is a signal Google discounts; this gives each page
// its real date instead.
//
// This runs from astro.config.mjs, before `astro:content` is available, so it
// reads the content collections straight off disk.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = path.resolve(HERE, '..', 'content');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.mdx?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

// Minimal frontmatter reader: the pipeline writes flat scalar keys at column 0,
// so only those are picked up. Indented continuation lines and `- ` list items
// are skipped by construction, which is all we need here.
function readFrontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return {};
  const out = {};
  for (const line of block[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):[ \t]*(.*)$/);
    if (!kv) continue;
    const value = kv[2].trim().replace(/^["']|["']$/g, '');
    if (!value || value.startsWith('[') || value.startsWith('{')) continue;
    out[kv[1]] = value;
  }
  return out;
}

function toIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * @param {(args: {filePath: string, frontmatter: Record<string,string>, contentDir: string}) => string} urlBuilder
 * @returns {Map<string, string>} pathname (with trailing slash) -> ISO date
 */
export function buildLastmodMap(urlBuilder) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!fs.existsSync(CONTENT_DIR)) return map;

  const bump = (url, iso) => {
    const prev = map.get(url);
    if (!prev || iso > prev) map.set(url, iso);
  };

  for (const filePath of walk(CONTENT_DIR)) {
    const frontmatter = readFrontmatter(filePath);
    const iso = toIso(frontmatter.published_date);
    if (!iso) continue;

    // Tool pages route on `tool_slug`, not the file path.
    const url = frontmatter.category === 'tools' && frontmatter.tool_slug
      ? `/tools/${frontmatter.tool_slug}/`
      : urlBuilder({ filePath, frontmatter, contentDir: CONTENT_DIR });

    bump(url, iso);
  }

  // Section and language hubs are only as fresh as their newest child.
  for (const [url, iso] of [...map]) {
    const parts = url.split('/').filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      bump('/' + parts.slice(0, i).join('/') + '/', iso);
    }
    bump('/', iso);
  }

  return map;
}
