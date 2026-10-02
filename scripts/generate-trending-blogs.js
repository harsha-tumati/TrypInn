#!/usr/bin/env node
/**
 * Add the trending, high-search-intent posts in scripts/trending-blogs/ to the
 * blog corpus.
 *
 * Unlike generate-blogs.js — which wipes public/blogs/content and regenerates
 * all 1000 destination guides from scratch — this script is ADDITIVE and
 * idempotent: it only writes its own post ids, and re-running it refreshes
 * those posts in place without touching anything else.
 *
 * Images are drawn from scripts/.blog-image-cache.json, preferring Unsplash ids
 * that the existing corpus has not used, so new posts get fresh visuals without
 * needing an Unsplash API key.
 *
 *   bun run scripts/generate-trending-blogs.js
 *   bun run scripts/generate-sitemap.js      # refresh sitemaps + RSS afterwards
 */
import fs from 'fs';
import path from 'path';

import { TRENDING_POSTS } from './trending-blogs/index.js';

const OUT = path.resolve('public', 'blogs');
const CONTENT = path.join(OUT, 'content');
const INDEX_FILE = path.join(OUT, 'index.json');
const CACHE_FILE = path.resolve('scripts', '.blog-image-cache.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

function hash(str) {
  let h = 0;
  for (const c of str) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function imgUrl(id, w) {
  return `https://images.unsplash.com/photo-${id}?fm=webp&w=${w}&q=60`;
}

function readTime(text) {
  const words = text.split(/\s+/).length;
  return `${Math.max(3, Math.ceil(words / 200))} min read`;
}

function shortExcerpt(text) {
  return text.length > 80 ? `${text.slice(0, 77).trim()}…` : text;
}

// ── Image pool ───────────────────────────────────────────────────────────────

/**
 * Count how often each Unsplash id already appears across the existing corpus
 * (cover images and inline figures), so we can prefer unused photos.
 *
 * Posts this script owns are skipped: counting our own previous output would
 * make a second run pick different photos than the first.
 */
function buildUsageCounts(ownIds) {
  const counts = new Map();
  if (!fs.existsSync(CONTENT)) return counts;
  for (const file of fs.readdirSync(CONTENT)) {
    if (!file.endsWith('.json')) continue;
    if (ownIds.has(file.slice(0, -'.json'.length))) continue;
    let post;
    try {
      post = JSON.parse(fs.readFileSync(path.join(CONTENT, file), 'utf-8'));
    } catch {
      continue;
    }
    const haystack = `${post.coverImage || ''} ${post.content || ''}`;
    for (const [, id] of haystack.matchAll(/photo-([0-9a-f-]+)\?/g)) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Ordered candidate ids for a post: every id from each named pool (destination
 * first, then template), least-used first, de-duplicated.
 */
function candidateIds(cache, pools, usage, postId) {
  const seen = new Set();
  const ids = [];
  for (const pool of pools) {
    const fromPool = cache.destinations[pool] || cache.templates[pool];
    if (!fromPool) {
      throw new Error(`"${postId}" names image pool "${pool}", which is not in the image cache`);
    }
    for (const id of fromPool) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids.sort((a, b) => (usage.get(a) || 0) - (usage.get(b) || 0));
}

// ── Build posts ──────────────────────────────────────────────────────────────

function buildPosts() {
  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error(`Image cache missing: ${CACHE_FILE}. Run generate-blogs.js first.`);
  }
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  const usage = buildUsageCounts(new Set(TRENDING_POSTS.map((p) => p.id)));
  const claimed = new Set(); // ids used by this run, so the 50 don't repeat

  return TRENDING_POSTS.map((spec) => {
    const candidates = candidateIds(cache, spec.img, usage, spec.id);
    if (candidates.length < 3) {
      throw new Error(`Not enough cached images for "${spec.id}" (pools: ${spec.img.join(', ')})`);
    }

    // Take the three least-used ids this run hasn't already claimed. Offset the
    // start by a hash of the id so posts sharing a pool don't all grab the same
    // first photo.
    const picked = [];
    const offset = hash(spec.id) % candidates.length;
    for (let i = 0; i < candidates.length && picked.length < 3; i++) {
      const id = candidates[(offset + i) % candidates.length];
      if (claimed.has(id)) continue;
      claimed.add(id);
      picked.push(id);
    }
    while (picked.length < 3) picked.push(candidates[picked.length]);

    const [coverId, inline1, inline2] = picked;

    const content = spec.body
      .replace('{{IMG1}}', `![${spec.tags[0]} travel](${imgUrl(inline1, 1200)})`)
      .replace('{{IMG2}}', `![${spec.tags[0]} travel](${imgUrl(inline2, 1200)})`);

    return {
      id: spec.id,
      title: spec.title,
      metaDescription: spec.metaDescription,
      excerpt: spec.excerpt,
      coverImage: imgUrl(coverId, 800),
      author: spec.author,
      date: spec.date,
      readTime: readTime(content),
      tags: spec.tags,
      featured: false,
      content,
    };
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(CONTENT, { recursive: true });

  const posts = buildPosts();

  const ids = new Set();
  for (const post of posts) {
    if (ids.has(post.id)) throw new Error(`Duplicate post id in trending-blogs data: ${post.id}`);
    ids.add(post.id);
  }

  for (const post of posts) {
    fs.writeFileSync(path.join(CONTENT, `${post.id}.json`), JSON.stringify(post, null, 2));
  }

  // Merge into index.json. New posts go first so they surface on page 1 of
  // /travel-guides; re-running replaces the previous entries in place.
  const existing = fs.existsSync(INDEX_FILE)
    ? JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'))
    : [];
  const kept = existing.filter((entry) => !ids.has(entry.id));

  const entries = posts.map((post) => ({
    id: post.id,
    title: post.title,
    excerpt: shortExcerpt(post.excerpt),
    coverImage: post.coverImage.replace('w=800', 'w=400'),
    author: post.author,
    date: post.date,
    readTime: post.readTime,
    tags: post.tags,
    featured: post.featured,
  }));

  fs.writeFileSync(INDEX_FILE, JSON.stringify([...entries, ...kept]));

  const added = posts.length - (existing.length - kept.length);
  console.log(`✅ Wrote ${posts.length} trending posts to public/blogs/content`);
  console.log(`✅ index.json: ${entries.length + kept.length} posts (${added} new, ${posts.length - added} refreshed)`);
  console.log('→ Next: bun run scripts/generate-sitemap.js');
}

main();
