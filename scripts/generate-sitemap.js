#!/usr/bin/env node
/**
 * SEO-optimized sitemap & RSS generator for Trypinn.
 *
 * Outputs:
 *   public/sitemap.xml          → Sitemap index (primary entry point)
 *   public/sitemap-static.xml   → Static marketing pages
 *   public/sitemap-posts.xml    → Blog posts with image extensions
 *   public/rss.xml              → RSS 2.0 feed with media extensions
 *
 * SEO features:
 *   – Split sitemap index for crawl-budget signalling
 *   – Google image:sitemap extensions on every post (cover + inline)
 *   – Tiered priorities (home 1.0, blog 0.9, originals 0.8, generated 0.6)
 *   – Full ISO-8601 lastmod timestamps
 *   – RSS with media:content, full article body, enclosures
 */
import fs from 'fs';
import path from 'path';

const DOMAIN = 'https://trypinn.com';
const BLOG_DIR = path.resolve('public', 'blogs');
const CONTENT_DIR = path.join(BLOG_DIR, 'content');
const PUBLIC_DIR = path.resolve('public');

const NOW = new Date();
const TODAY_ISO = NOW.toISOString();                 // 2026-05-31T13:45:00.000Z
const TODAY_DATE = NOW.toISOString().split('T')[0];  // 2026-05-31

// ── Original manual posts (mirrors BlogPage.jsx) ──
const ORIGINAL_POSTS = [
  { id: 'split-group-trip-expenses', title: "How to Split Group Trip Expenses Fairly — Without the Awkward Money Talk", date: '2026-05-20', author: 'Trypinn Team', excerpt: "One person always ends up paying for the cab, another for dinner, and by day three nobody remembers who owes whom. Here's a fair, drama-free way to handle trip money.", coverImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?fm=webp&w=800&q=60', tags: ['Group Travel', 'Expenses', 'Trip Planning'] },
  { id: 'weekend-getaways-bengaluru', title: "12 Underrated Weekend Getaways Near Bengaluru for 2026", date: '2026-05-18', author: 'Trypinn Team', excerpt: "Coorg and Ooty are lovely — and packed. Here are twelve quieter escapes within driving distance of Bengaluru.", coverImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?fm=webp&w=800&q=60', tags: ['Weekend Trips', 'India', 'Itinerary'] },
  { id: 'pre-trip-checklist', title: "The Smart Traveler's Pre-Trip Checklist: 9 Things People Always Forget", date: '2026-05-14', author: 'Trypinn Team', excerpt: "It's never the passport people forget — it's the small stuff that quietly wrecks a trip. Here's the checklist we run before every single departure.", coverImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?fm=webp&w=800&q=60', tags: ['Trip Planning', 'Travel Tips', 'Checklist'] },
  { id: 'group-trip-planner', title: "Planning a Group Trip Without Losing Your Mind — Here's the App That Saved Us", date: '2026-05-16', author: 'Trypinn Team', excerpt: "We've all been there — that excited WhatsApp group that quickly spirals into chaos. Here's how we broke the curse.", coverImage: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?fm=webp&w=800&q=60', tags: ['Group Travel', 'Trip Planning', 'AI', 'India'] },
  { id: 'goa-india', title: "The Ultimate Guide to Goa: Beaches, Heritage, and Nightlife", date: '2026-05-10', author: 'Trypinn Experts', excerpt: "Pristine beaches, vibrant nightlife, and Portuguese heritage. Perfect for groups seeking sun, sand, and adventure.", coverImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?fm=webp&w=800&q=60', tags: ['Beach', 'Nightlife', 'India', 'Heritage'] },
  { id: 'bali-indonesia', title: "Bali Backpacking: Temples, Terraces, and Tropical Bliss", date: '2026-05-08', author: 'Wanderlust Team', excerpt: "Lush rice terraces, ancient temples, and tropical paradise. Experience culture, wellness, and natural beauty.", coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?fm=webp&w=800&q=60', tags: ['Tropical', 'Wellness', 'Indonesia'] },
  { id: 'santorini-greece', title: "Santorini Sunsets: The Jewel of the Aegean", date: '2026-05-05', author: 'Trypinn Experts', excerpt: "Iconic blue domes, stunning sunsets, and whitewashed villages. The ultimate romantic Mediterranean escape.", coverImage: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?fm=webp&w=800&q=60', tags: ['Romantic', 'Mediterranean', 'Greece'] },
  { id: 'leh-ladakh', title: "Adventure Awaits: Conquering Leh Ladakh", date: '2026-05-02', author: 'Mountain Explorer', excerpt: "Breathtaking mountain passes, pristine lakes, and Buddhist monasteries. A paradise for adventurous souls.", coverImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?fm=webp&w=800&q=60', tags: ['Adventure', 'Mountains', 'India'] },
  { id: 'dubai-uae', title: "Dubai Uncovered: Luxury, Skyscrapers, and Deserts", date: '2026-04-28', author: 'Trypinn Experts', excerpt: "Futuristic skyline, world-class shopping, and desert adventures. Where modern luxury meets Arabian culture.", coverImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?fm=webp&w=800&q=60', tags: ['Luxury', 'Cityscape', 'UAE'] },
  { id: 'kerala-india', title: "God's Own Country: The Serenity of Kerala", date: '2026-04-25', author: 'Trypinn Team', excerpt: "Serene backwaters, lush tea plantations, and Ayurvedic retreats. God's Own Country awaits.", coverImage: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?fm=webp&w=800&q=60', tags: ['Nature', 'Relaxation', 'India'] },
];

// ── Helpers ──
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseIsoDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
  } catch {}
  return TODAY_ISO;
}

function parseDateOnly(dateStr) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return TODAY_DATE;
}

/** Extract inline images from markdown content: ![alt](url) */
function extractInlineImages(content) {
  if (!content) return [];
  const images = [];
  const regex = /!\[(.*?)\]\((.*?)\)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    images.push({ alt: m[1].trim(), url: m[2].trim() });
  }
  return images;
}

/** Simple markdown → HTML for RSS <content:encoded> */
function mdToHtml(md) {
  if (!md) return '';
  return escapeXml(md)
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold / italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Images
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
    // Links
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    // Paragraphs (simple: wrap non-tag lines)
    .replace(/^(?!<[a-z]).+$/gim, '<p>$&</p>')
    // Line breaks
    .replace(/\n/g, '');
}

// ── Load generated posts with full content ──
function loadGeneratedPosts() {
  const indexPath = path.join(BLOG_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  return index.map((p) => {
    let full = { ...p };
    const contentPath = path.join(CONTENT_DIR, `${p.id}.json`);
    if (fs.existsSync(contentPath)) {
      try {
        full = { ...full, ...JSON.parse(fs.readFileSync(contentPath, 'utf-8')) };
      } catch {}
    }
    return full;
  });
}

// ═══════════════════════════════════════════════════════════════
//  SITEMAP STATIC  – homepage, blog index, etc.
// ═══════════════════════════════════════════════════════════════
function buildSitemapStatic() {
  const pages = [
    { loc: '/',             changefreq: 'daily',   priority: '1.0', lastmod: TODAY_ISO },
    { loc: '/blog',         changefreq: 'daily',   priority: '0.9', lastmod: TODAY_ISO },
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (const p of pages) {
    xml += `  <url>\n`;
    xml += `    <loc>${DOMAIN}${escapeXml(p.loc)}</loc>\n`;
    xml += `    <lastmod>${p.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
    xml += `    <priority>${p.priority}</priority>\n`;
    xml += `  </url>\n`;
  }
  xml += `</urlset>\n`;
  return xml;
}

// ═══════════════════════════════════════════════════════════════
//  SITEMAP POSTS  – original + generated blog posts with images
// ═══════════════════════════════════════════════════════════════
function buildSitemapPosts(originals, generated) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Original posts – higher priority, established content
  for (const p of originals) {
    const lastmod = parseIsoDate(p.date);
    xml += `  <url>\n`;
    xml += `    <loc>${DOMAIN}/blog/${escapeXml(p.id)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;

    if (p.coverImage) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(p.coverImage)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(p.title)}</image:title>\n`;
      xml += `      <image:caption>${escapeXml(p.excerpt || p.title)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  }

  // Generated posts – slightly lower priority
  for (const p of generated) {
    const lastmod = parseIsoDate(p.date);
    const inlineImages = extractInlineImages(p.content);
    xml += `  <url>\n`;
    xml += `    <loc>${DOMAIN}/blog/${escapeXml(p.id)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.6</priority>\n`;

    // Cover image
    if (p.coverImage) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(p.coverImage)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(p.title)}</image:title>\n`;
      xml += `      <image:caption>${escapeXml(p.excerpt || p.metaDescription || p.title)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }

    // Inline images from content (up to 5 to keep sitemap lean)
    for (const img of inlineImages.slice(0, 5)) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(img.url)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(img.alt || p.title)}</image:title>\n`;
      xml += `      <image:caption>${escapeXml(img.alt || p.excerpt || p.title)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }

    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

// ═══════════════════════════════════════════════════════════════
//  SITEMAP INDEX  – entry point referenced by robots.txt
// ═══════════════════════════════════════════════════════════════
function buildSitemapIndex() {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `  <sitemap>\n`;
  xml += `    <loc>${DOMAIN}/sitemap-static.xml</loc>\n`;
  xml += `    <lastmod>${TODAY_ISO}</lastmod>\n`;
  xml += `  </sitemap>\n`;
  xml += `  <sitemap>\n`;
  xml += `    <loc>${DOMAIN}/sitemap-posts.xml</loc>\n`;
  xml += `    <lastmod>${TODAY_ISO}</lastmod>\n`;
  xml += `  </sitemap>\n`;
  xml += `</sitemapindex>\n`;
  return xml;
}

// ═══════════════════════════════════════════════════════════════
//  RSS 2.0 with media & content extensions
// ═══════════════════════════════════════════════════════════════
function buildRss(posts) {
  const allPosts = [...ORIGINAL_POSTS, ...posts];
  // Sort by date descending
  allPosts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const topPosts = allPosts.slice(0, 50);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>Trypinn Blog</title>\n`;
  xml += `    <link>${DOMAIN}/blog</link>\n`;
  xml += `    <description>Travel tips, planning guides, and stories to fuel your next adventure with Trypinn.</description>\n`;
  xml += `    <language>en</language>\n`;
  xml += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;
  xml += `    <pubDate>${new Date().toUTCString()}</pubDate>\n`;
  xml += `    <atom:link href="${DOMAIN}/rss.xml" rel="self" type="application/rss+xml" />\n`;
  xml += `    <image>\n`;
  xml += `      <url>${DOMAIN}/icon-192.png</url>\n`;
  xml += `      <title>Trypinn Blog</title>\n`;
  xml += `      <link>${DOMAIN}/blog</link>\n`;
  xml += `    </image>\n`;

  for (const p of topPosts) {
    const pubDate = p.date ? new Date(p.date).toUTCString() : new Date().toUTCString();
    const tags = p.tags || [];
    const contentHtml = mdToHtml(p.content || p.excerpt || '');
    const inlineImages = extractInlineImages(p.content || '');

    xml += `    <item>\n`;
    xml += `      <title>${escapeXml(p.title)}</title>\n`;
    xml += `      <link>${DOMAIN}/blog/${escapeXml(p.id)}</link>\n`;
    xml += `      <guid isPermaLink="true">${DOMAIN}/blog/${escapeXml(p.id)}</guid>\n`;
    xml += `      <pubDate>${pubDate}</pubDate>\n`;
    xml += `      <author>${escapeXml(p.author || 'Trypinn')}</author>\n`;

    if (tags.length > 0) {
      xml += tags.map((t) => `      <category>${escapeXml(t)}</category>\n`).join('');
    }

    if (p.coverImage) {
      xml += `      <enclosure url="${escapeXml(p.coverImage)}" type="image/webp" />\n`;
      xml += `      <media:content url="${escapeXml(p.coverImage)}" type="image/webp" medium="image">\n`;
      xml += `        <media:title>${escapeXml(p.title)}</media:title>\n`;
      xml += `        <media:thumbnail url="${escapeXml(p.coverImage)}" />\n`;
      xml += `      </media:content>\n`;
    }

    xml += `      <description>${escapeXml(p.excerpt || '')}</description>\n`;

    if (p.content) {
      xml += `      <content:encoded><![CDATA[${contentHtml}]]></content:encoded>\n`;
    }

    xml += `    </item>\n`;
  }

  xml += `  </channel>\n`;
  xml += `</rss>\n`;
  return xml;
}

// ═══════════════════════════════════════════════════════════════
//  ROBOTS.TXT  – updated to reference sitemap index
// ═══════════════════════════════════════════════════════════════
function buildRobotsTxt() {
  return `User-agent: *
Disallow: /login
Disallow: /trip/
Disallow: /trips/create
Disallow: /join/

Sitemap: ${DOMAIN}/sitemap.xml
Sitemap: ${DOMAIN}/sitemap-index.xml
`;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════
function main() {
  const generatedPosts = loadGeneratedPosts();
  const totalUrls = 2 + ORIGINAL_POSTS.length + generatedPosts.length;

  // 1. Sitemap static pages
  const sitemapStatic = buildSitemapStatic();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-static.xml'), sitemapStatic);
  console.log(`✅ sitemap-static.xml  → 2 URLs`);

  // 2. Sitemap posts (original + generated)
  const sitemapPosts = buildSitemapPosts(ORIGINAL_POSTS, generatedPosts);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-posts.xml'), sitemapPosts);
  console.log(`✅ sitemap-posts.xml   → ${ORIGINAL_POSTS.length + generatedPosts.length} URLs`);

  // 3. Sitemap index (primary entry point)
  const sitemapIndex = buildSitemapIndex();
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap-index.xml'), sitemapIndex);
  console.log(`✅ sitemap-index.xml   → 2 child sitemaps`);

  // 4. Legacy sitemap.xml = copy of index (backward compat)
  fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapIndex);
  console.log(`✅ sitemap.xml         → legacy alias to index`);

  // 5. RSS feed
  const rss = buildRss(generatedPosts);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'rss.xml'), rss);
  console.log(`✅ rss.xml             → ${Math.min(generatedPosts.length + ORIGINAL_POSTS.length, 50)} items`);

  // 6. robots.txt
  fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), buildRobotsTxt());
  console.log(`✅ robots.txt          → updated with sitemap references`);

  console.log(`\n📊 Total URLs in sitemap family: ${totalUrls}`);
}

main();
