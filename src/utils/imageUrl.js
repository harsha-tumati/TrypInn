// src/utils/imageUrl.js
// Turns a stored image URL into one sized for the slot it actually renders in.
//
// Our blog and must-visits data ship hard-coded Unsplash URLs like
//   ...?fm=webp&w=800&q=60
// which means every device downloads the same bytes regardless of how big the
// image is on screen, and always as WebP. Three things are left on the table:
//
//   auto=format  — lets Unsplash content-negotiate AVIF (~25% smaller than
//                  WebP), falling back to WebP then JPEG on older clients.
//   fit=crop&ar  — every card renders inside a fixed aspect-ratio box under
//                  object-fit: cover, so the CDN can do the crop instead of
//                  shipping pixels the browser throws away. Around 5% on
//                  landscape originals and 25%+ on portrait ones.
//   srcset       — lets the browser pick a width for the viewport and DPR.
//
// Only Unsplash URLs are rewritten. Google Places photos (already requested at
// a bounded width) and anything else pass through untouched.
//
// Deliberately plain string manipulation rather than URL/URLSearchParams:
// srcset calls this once per width per image, and on the must-visits directory
// that is several hundred calls on first paint.

const UNSPLASH_HOST = 'images.unsplash.com';

// Params we own. Any of these already on the URL is dropped and re-added, so
// the result is the same whether or not the input was already optimised.
const MANAGED = ['fm', 'auto', 'w', 'q', 'fit', 'ar'];

// Width ladder, kept deliberately short: each extra entry is another CDN
// variant to warm and another candidate for the browser to weigh.
const WIDTHS = [320, 480, 640, 800, 1080, 1440, 1920];

export function isUnsplashUrl(url) {
    return typeof url === 'string' && url.includes(UNSPLASH_HOST);
}

/**
 * Rewrite an Unsplash URL for a given rendered width.
 *
 * @param {string} url                the stored image URL
 * @param {number} width              target width in device pixels
 * @param {object} [opts]
 * @param {number} [opts.quality=60]  Unsplash q parameter
 * @param {string} [opts.ratio]       aspect ratio to crop to, e.g. '16:10'
 * @returns {string} the rewritten URL, or the input untouched if not Unsplash
 */
export function imageSrc(url, width, { quality = 60, ratio } = {}) {
    if (!isUnsplashUrl(url)) return url;

    const hash = url.indexOf('#');
    const base = hash === -1 ? url : url.slice(0, hash);
    const fragment = hash === -1 ? '' : url.slice(hash);

    const q = base.indexOf('?');
    const path = q === -1 ? base : base.slice(0, q);
    const existing = q === -1 ? '' : base.slice(q + 1);

    // Preserve anything we don't manage (ixid, ixlib, crop hints someone set).
    const params = existing
        .split('&')
        .filter(p => p && !MANAGED.includes(p.slice(0, p.indexOf('=') === -1 ? p.length : p.indexOf('='))));

    params.push('auto=format');
    params.push(`q=${quality}`);
    if (width) params.push(`w=${Math.round(width)}`);
    if (ratio) {
        params.push('fit=crop');
        params.push(`ar=${ratio}`);
    }

    return `${path}?${params.join('&')}${fragment}`;
}

/**
 * Build a srcset across the width ladder, capped at maxWidth so card
 * thumbnails never pull a hero-sized file on a high-DPR phone.
 *
 * @returns {string|undefined} undefined when the URL isn't rewritable, so the
 *   caller can omit both srcset and sizes.
 */
export function imageSrcSet(url, { quality = 60, ratio, maxWidth = 1920 } = {}) {
    if (!isUnsplashUrl(url)) return undefined;
    const widths = WIDTHS.filter(w => w <= maxWidth);
    if (widths.length === 0) widths.push(maxWidth);
    return widths
        .map(w => `${imageSrc(url, w, { quality, ratio })} ${w}w`)
        .join(', ');
}

// ── `sizes` strings for the app's grids ──────────────────────────────────────
// Each mirrors the real CSS breakpoints, so the browser can pick a width
// before layout. Keep these in sync with the grid rules in index.css.

export const SIZES = {
    // .blog-grid — 3 cols in a 1160px container, 2 cols 768–1023, 1 col below.
    blogCard: '(min-width: 1216px) 350px, (min-width: 1024px) 30vw, (min-width: 768px) 45vw, 92vw',
    // .mv-grid / .mv-attractions-grid — auto-fill, max 3 cols in a 1200px
    // container, 2 cols 769–1024, 1 col below.
    mvCard: '(min-width: 1025px) 368px, (min-width: 769px) 45vw, 92vw',
    // .hp-dest-card on the marketing page — 3 cols wide, 2 then 1 below.
    destCard: '(min-width: 981px) 30vw, (min-width: 641px) 47vw, 92vw',
    // Full-bleed article cover.
    hero: '100vw',
    // Inline figures inside .blog-detail-body (max-width 820px, 28px padding).
    articleBody: '(min-width: 880px) 764px, 92vw',
    // Small related-article and place thumbnails.
    thumb: '(min-width: 768px) 300px, 45vw',
    // .hp-trip-collage — a 2fr/1fr grid inside .hp-trips-grid (3 cols, then 2,
    // then 1). The side tiles are half the width of the main one.
    tripCollageMain: '(min-width: 1281px) 260px, (min-width: 981px) 20vw, (min-width: 641px) 32vw, 60vw',
    tripCollageSide: '(min-width: 1281px) 130px, (min-width: 981px) 10vw, (min-width: 641px) 16vw, 30vw',
};
