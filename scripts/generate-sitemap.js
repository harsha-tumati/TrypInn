#!/usr/bin/env node
/**
 * Enhanced sitemap generator for Trypinn.
 * Produces sitemap.xml with <lastmod>, image extensions, and proper priorities.
 * Also generates rss.xml for blog feed discovery with original posts included.
 */
import fs from 'fs';
import path from 'path';

const DOMAIN = 'https://trypinn.com';
const BLOG_DIR = path.resolve('public', 'blogs');
const CONTENT_DIR = path.join(BLOG_DIR, 'content');
const OUT_SITEMAP = path.resolve('public', 'sitemap.xml');
const OUT_RSS = path.resolve('public', 'rss.xml');

const TODAY = new Date().toISOString().split('T')[0];

// ── Static pages ──
const STATIC_PAGES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/blog', changefreq: 'weekly', priority: '0.9' },
];

// ── Original manual posts with full metadata for RSS ──
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

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return TODAY;
}

// ── Load generated posts ──
function loadGeneratedPosts() {
  const indexPath = path.join(BLOG_DIR, 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  return index.map((p) => {
    let coverImage = p.coverImage;
    const contentPath = path.join(CONTENT_DIR, `${p.id}.json`);
    if (fs.existsSync(contentPath)) {
      try {
        const full = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
        coverImage = full.coverImage || coverImage;
      } catch {}
    }
    return { ...p, coverImage };
  });
}

// ── Build sitemap.xml with accurate lastmod ──
function buildSitemap(posts) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Static pages
  for (const p of STATIC_PAGES) {
    xml += `  <url>\n`;
    xml += `    <loc>${DOMAIN}${escapeXml(p.loc)}</loc>\n`;
    xml += `    <lastmod>${TODAY}</lastmod>\n`;
    xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
    xml += `    <priority>${p.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  // Original posts with their actual publication dates as lastmod
  for (const p of ORIGINAL_POSTS) {
    xml += `  <url>\n`;
    xml += `    <loc>${DOMAIN}/blog/${escapeXml(p.id)}</loc>\n`;
    xml += `    <lastmod>${parseDate(p.date)}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `  </url>\n`;
  }

  // Generated posts with image sitemap extensions and actual post dates
  for (const p of posts) {
    xml += `  <url>\n`;
    xml += `    <loc>${DOMAIN}/blog/${escapeXml(p.id)}</loc>\n`;
    xml += `    <lastmod>${parseDate(p.date)}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    if (p.coverImage) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(p.coverImage)}</image:loc>\n`;
      xml += `      <image:caption>${escapeXml(p.title)}</image:caption>\n`;
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

// ── Build rss.xml with original posts included ──
function buildRss(posts) {
  // Use generated posts' actual titles from index, merged with originals
  const allPosts = [...ORIGINAL_POSTS, ...posts];
  const topPosts = allPosts.slice(0, 50);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>Trypinn Blog</title>\n`;
  xml += `    <link>${DOMAIN}/blog</link>\n`;
  xml += `    <description>Travel tips, planning guides, and stories to fuel your next adventure with Trypinn.</description>\n`;
  xml += `    <language>en-us</language>\n`;
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
    }
    xml += `      <description>${escapeXml(p.excerpt || '')}</description>\n`;
    if (p.content) {
      xml += `      <content:encoded><![CDATA[${p.content.slice(0, 2000)}]]></content:encoded>\n`;
    }
    xml += `    </item>\n`;
  }

  xml += `  </channel>\n`;
  xml += `</rss>\n`;
  return xml;
}

// ── Main ──
function main() {
  const posts = loadGeneratedPosts();
  console.log(`📄 Loaded ${posts.length} blog posts from index.json`);

  const sitemap = buildSitemap(posts);
  fs.writeFileSync(OUT_SITEMAP, sitemap);
  console.log(`✅ Sitemap written: ${OUT_SITEMAP} (${posts.length + STATIC_PAGES.length + ORIGINAL_POSTS.length} URLs)`);

  const rss = buildRss(posts);
  fs.writeFileSync(OUT_RSS, rss);
  console.log(`✅ RSS feed written: ${OUT_RSS} (${Math.min(posts.length + ORIGINAL_POSTS.length, 50)} items)`);
}

main();
