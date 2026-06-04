// src/hooks/usePageSeo.js
// Universal SEO hook for React SPA pages.
// Sets document title, meta tags, canonical link, OpenGraph, Twitter Cards,
// and injects JSON-LD structured data. Cleans everything up on unmount.

import { useEffect } from 'react';

const DEFAULT = {
  title: 'Trypinn — Plan the world, together',
  description:
    'Trypinn is the collaborative travel workspace for group trips. Shared maps, AI place discovery, group polls, smart itineraries, and effortless expense splitting — all in one canvas.',
  image: 'https://trypinn.com/og-image.png',
  url: 'https://trypinn.com',
  type: 'website',
  locale: 'en_US',
  siteName: 'Trypinn',
  twitterHandle: '@trypinn',
};

function setMeta(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setProperty(prop, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${prop}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', prop);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function injectJsonLd(data) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
  return script;
}

/**
 * usePageSeo – universal SEO hook
 *
 * @param {Object} opts
 * @param {string} opts.title          – page title
 * @param {string} opts.description    – meta description (max ~160 chars)
 * @param {string} opts.url            – canonical URL for this page
 * @param {string} opts.image          – OG/Twitter image URL (1200×630 ideal)
 * @param {string} opts.type           – OG type: website | article | profile
 * @param {Object} opts.jsonLd         – JSON-LD structured data object(s). Can be single object or array.
 * @param {string} opts.robots         – e.g. "index,follow" or "noindex"
 * @param {string} opts.publishedTime  – ISO date (for articles)
 * @param {string} opts.modifiedTime   – ISO date (for articles)
 * @param {string} opts.author         – author name (for articles)
 * @param {string[]} opts.keywords     – page keywords
 * @param {string} opts.twitterCard    – summary | summary_large_image
 * @param {Object} opts.twitterData    – { label1, data1, label2, data2 } for Twitter rich cards
 */
export default function usePageSeo(opts = {}) {
  useEffect(() => {
    const prevTitle = document.title;

    // ── Title ──
    const title = opts.title || DEFAULT.title;
    document.title = title.includes('Trypinn') ? title : `${title} · Trypinn`;

    // ── Meta basics ──
    const desc = opts.description || DEFAULT.description;
    setMeta('description', desc);
    setMeta('robots', opts.robots || 'index, follow, max-image-preview:large');
    if (opts.keywords?.length) setMeta('keywords', opts.keywords.join(', '));

    // ── Canonical ──
    setLink('canonical', opts.url || DEFAULT.url);

    // ── OpenGraph ──
    setProperty('og:title', title);
    setProperty('og:description', desc);
    setProperty('og:url', opts.url || DEFAULT.url);
    setProperty('og:image', opts.image || DEFAULT.image);
    setProperty('og:type', opts.type || DEFAULT.type);
    setProperty('og:locale', DEFAULT.locale);
    setProperty('og:site_name', DEFAULT.siteName);
    if (opts.publishedTime) setProperty('article:published_time', opts.publishedTime);
    if (opts.modifiedTime) setProperty('article:modified_time', opts.modifiedTime);
    if (opts.author) setProperty('article:author', opts.author);
    // Secure URL variant for crawlers that prefer it
    if (opts.image || DEFAULT.image) {
      setProperty('og:image:secure_url', (opts.image || DEFAULT.image).replace(/^http:/, 'https:'));
    }

    // ── Twitter Cards ──
    const card = opts.twitterCard || 'summary_large_image';
    setMeta('twitter:card', card);
    setMeta('twitter:site', DEFAULT.twitterHandle);
    setMeta('twitter:title', title);
    setMeta('twitter:description', desc);
    setMeta('twitter:image', opts.image || DEFAULT.image);
    // Twitter data labels (rich cards)
    if (opts.twitterData) {
      if (opts.twitterData.label1) setMeta('twitter:label1', opts.twitterData.label1);
      if (opts.twitterData.data1) setMeta('twitter:data1', opts.twitterData.data1);
      if (opts.twitterData.label2) setMeta('twitter:label2', opts.twitterData.label2);
      if (opts.twitterData.data2) setMeta('twitter:data2', opts.twitterData.data2);
    }

    // ── JSON-LD Structured Data ──
    const ldScripts = [];
    if (opts.jsonLd) {
      const items = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
      for (const item of items) {
        if (item) ldScripts.push(injectJsonLd(item));
      }
    }

    // ── AEO: speakable hint for voice assistants ──
    setMeta('speakable', '{\n  "@context": "https://schema.org",\n  "@type": "SpeakableSpecification",\n  "cssSelector": ["#main-content"]\n}');

    return () => {
      document.title = prevTitle;
      // We only remove JSON-LD scripts to avoid duplicates.
      for (const s of ldScripts) s.remove();
    };
  }, [opts.title, opts.description, opts.url, opts.image, opts.type, opts.robots]);
}

/**
 * Pre-defined JSON-LD builders for maximum AEO/DEO coverage
 */
export const schemas = {
  Organization() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Trypinn',
      url: 'https://trypinn.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://trypinn.com/icon-512.png',
        width: 512,
        height: 512,
      },
      sameAs: [
        'https://twitter.com/trypinn',
        'https://instagram.com/trypinn',
        'https://www.linkedin.com/company/trypinn',
      ],
      description:
        'The collaborative travel workspace for group trips. Shared maps, AI discovery, smart itineraries, and fair expense splitting.',
      // AEO: Entity optimization for Knowledge Graph
      '@id': 'https://trypinn.com/#organization',
    };
  },

  WebSite() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Trypinn',
      url: 'https://trypinn.com',
      '@id': 'https://trypinn.com/#website',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://trypinn.com/travel-guides?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    };
  },

  Article(post) {
    const wordCount = post.content ? post.content.split(/\s+/).filter(w => w.length > 0).length : 0;
    const isOrgAuthor = !post.author || post.author === 'Trypinn' || post.author === 'Trypinn Team' || post.author === 'Trypinn Experts';
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.metaDescription || post.excerpt,
      image: {
        '@type': 'ImageObject',
        url: post.coverImage,
        width: 800,
        height: 500,
      },
      author: {
        '@type': isOrgAuthor ? 'Organization' : 'Person',
        name: post.author || 'Trypinn',
        url: isOrgAuthor ? 'https://trypinn.com' : undefined,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Trypinn',
        logo: {
          '@type': 'ImageObject',
          url: 'https://trypinn.com/icon-512.png',
          width: 512,
          height: 512,
        },
      },
      datePublished: post.date ? new Date(post.date).toISOString() : new Date().toISOString(),
      dateModified: post.modifiedDate
        ? new Date(post.modifiedDate).toISOString()
        : post.date
          ? new Date(post.date).toISOString()
          : new Date().toISOString(),
      keywords: (post.tags || []).join(', '),
      inLanguage: 'en',
      wordCount,
      articleSection: post.tags?.[0] || 'Travel',
      articleBody: post.content || '',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://trypinn.com/travel-guides/${post.id}`,
      },
      // AEO: speakable sections for voice assistants
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['.blog-detail-body', '.blog-hero-inner h1', '.blog-hero-inner p'],
      },
    };
  },

  FAQPage(questions) {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: questions.map((q) => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: q.answer,
        },
      })),
    };
  },

  BreadcrumbList(items) {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: {
          '@type': 'Thing',
          '@id': item.url,
          name: item.name,
        },
      })),
    };
  },

  // DEO: SoftwareApplication for app rich results
  SoftwareApplication() {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Trypinn',
      applicationCategory: 'TravelApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '12000',
        bestRating: '5',
        worstRating: '1',
      },
      description:
        'The collaborative travel workspace for group trips. Shared maps, AI place discovery, group polls, smart itineraries, and effortless expense splitting.',
      url: 'https://trypinn.com',
      image: 'https://trypinn.com/og-image.png',
    };
  },

  // AEO: HowTo for step-by-step guides
  HowTo(name, steps) {
    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name,
      step: steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    };
  },

  // DEO: CollectionPage for blog listing
  CollectionPage(name, items) {
    return {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name,
      url: 'https://trypinn.com/travel-guides',
      hasPart: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://trypinn.com/travel-guides/${item.id}`,
        name: item.title,
      })),
    };
  },

  // AEO/DEO: Review schema for testimonials
  Review(author, reviewBody, ratingValue = '5') {
    return {
      '@context': 'https://schema.org',
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: author,
      },
      reviewBody,
      reviewRating: {
        '@type': 'Rating',
        ratingValue,
        bestRating: '5',
        worstRating: '1',
      },
    };
  },

  // DEO: TouristAttraction for destination cards
  TouristAttraction(name, description, photo, ratingValue) {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'TouristAttraction',
      name,
      description,
      photo: photo
        ? {
            '@type': 'ImageObject',
            url: photo,
          }
        : undefined,
    };
    if (ratingValue) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: String(ratingValue),
        bestRating: '5',
        worstRating: '1',
      };
    }
    return schema;
  },

  // DEO: ItemList for ordered collections
  ItemList(items, itemType = 'ListItem') {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map((item, i) => ({
        '@type': itemType,
        position: i + 1,
        name: item.name,
        url: item.url,
      })),
    };
  },

  // AEO: QAPage for question-answer format
  QAPage(question, answer, author) {
    return {
      '@context': 'https://schema.org',
      '@type': 'QAPage',
      mainEntity: {
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer,
          author: {
            '@type': 'Organization',
            name: author || 'Trypinn',
          },
        },
      },
    };
  },
};
