#!/usr/bin/env node
/**
 * Generate 1000 SEO-optimized travel blog posts for Trypinn.
 * Uses Unsplash API to fetch destination-specific images, ensuring
 * every post gets a unique, relevant photo.
 */
import fs from 'fs';
import path from 'path';

const OUT = path.resolve('public', 'blogs');
const CONTENT = path.join(OUT, 'content');
const DOMAIN = 'https://trypinn.com';
const CACHE_FILE = path.resolve('scripts', '.blog-image-cache.json');

fs.mkdirSync(CONTENT, { recursive: true });

// ── Seeded PRNG ──
let _seed = 42;
function srand(s) { _seed = s; }
function rand() { _seed = (_seed * 16807) % 2147483647; return _seed / 2147483647; }
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function hash(str) { let h = 0; for (let c of str) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return Math.abs(h); }
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').slice(0,60).replace(/-$/,''); }

// ── Utilities ──
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const AUTHORS = ['Trypinn Team','Trypinn Experts','Wanderlust Team','Travel Editors','Adventure Crew'];

function fmtDate(seed) {
  srand(hash(seed));
  const y = 2024 + Math.floor(rand() * 3);
  const m = Math.floor(rand() * 12);
  const d = 1 + Math.floor(rand() * 28);
  return `${MONTHS[m]} ${d}, ${y}`;
}
function readTime(text) {
  const w = text.split(/\s+/).length;
  return `${Math.max(3, Math.ceil(w / 200))} min read`;
}

function h2(t) { return `## ${t}`; }
function bullet(...items) { return items.map(i => `- ${i}`).join('\n'); }
function imgAlt(alt, url) { return `![${alt}](${url})`; }
function cta() { return 'Plan your trip with Trypinn and discover the best this destination has to offer.'; }

function intro(dest, style) {
  const intros = [
    `${dest} is one of those places that stays with you long after you leave. Whether you are ${style}, the experience is nothing short of transformative. Every corner holds a story, every street a memory waiting to be made. In this guide, we will walk you through everything that makes ${dest} truly special — from its hidden gems to its must-see highlights — so you can plan a trip that feels authentically yours.`,
    `There is something about ${dest} that captures the imagination of travelers worldwide. For those ${style}, this guide will show you the best of what awaits. Beyond the postcards and travel brochures lies a destination rich with culture, flavor, and adventure. We have put together everything you need to know — when to go, what to do, where to stay, and how to make the most of every moment — so your journey to ${dest} is as seamless as it is memorable.`,
    `${dest} offers a perfect blend of adventure and relaxation. If you are ${style}, you will find endless opportunities to create unforgettable memories. The sights, sounds, and flavors of ${dest} come together in a way that feels both exciting and deeply comforting. This guide breaks down the essentials — from top attractions to local secrets — helping you craft an itinerary that matches your pace and your passions.`,
    `The magic of ${dest} lies in its ability to surprise you at every turn. This guide is for anyone ${style} who wants to experience the real heart of this incredible destination. From sunrise viewpoints to late-night street food stalls, ${dest} rewards the curious traveler. We have gathered the best tips, must-visit spots, and practical advice to help you explore with confidence and leave with stories worth telling.`,
    `Few places in the world can match the allure of ${dest}. Whether you are ${style} for the first time or returning for more, there is always something new to discover. The landscapes shift, the seasons change, and the culture continues to evolve — yet the essence of ${dest} remains irresistibly captivating. Let this guide be your companion as you uncover the experiences that make this destination one of a kind.`,
  ];
  return pick(intros);
}

// ── Destinations ──
const DESTS = [
  {n:'Tokyo',c:'Japan',t:['Tokyo','Japan','City Guide']},
  {n:'Bali',c:'Indonesia',t:['Bali','Indonesia','Beaches']},
  {n:'Vietnam',c:'Vietnam',t:['Vietnam','Southeast Asia','Culture']},
  {n:'Thailand',c:'Thailand',t:['Thailand','Southeast Asia','Beaches']},
  {n:'Kyoto',c:'Japan',t:['Kyoto','Japan','Culture']},
  {n:'Sri Lanka',c:'Sri Lanka',t:['Sri Lanka','Asia','Nature']},
  {n:'Nepal',c:'Nepal',t:['Nepal','Trekking','Adventure']},
  {n:'the Maldives',c:'Maldives',t:['Maldives','Beaches','Luxury']},
  {n:'Singapore',c:'Singapore',t:['Singapore','City Guide','Asia']},
  {n:'the Philippines',c:'Philippines',t:['Philippines','Beaches','Island Hopping']},
  {n:'Taiwan',c:'Taiwan',t:['Taiwan','Street Food','Asia']},
  {n:'Laos',c:'Laos',t:['Laos','Culture','Southeast Asia']},
  {n:'Cambodia',c:'Cambodia',t:['Cambodia','Temples','Culture']},
  {n:'Myanmar',c:'Myanmar',t:['Myanmar','Temples','Asia']},
  {n:'Hong Kong',c:'Hong Kong',t:['Hong Kong','City Guide','Asia']},
  {n:'Paris',c:'France',t:['Paris','France','City Guide']},
  {n:'Iceland',c:'Iceland',t:['Iceland','Road Trip','Nature']},
  {n:'Santorini',c:'Greece',t:['Santorini','Greece','Romantic']},
  {n:'Portugal',c:'Portugal',t:['Portugal','Road Trip','Europe']},
  {n:'Croatia',c:'Croatia',t:['Croatia','Island Hopping','Europe']},
  {n:'Turkey',c:'Turkey',t:['Turkey','Istanbul','Culture']},
  {n:'the Amalfi Coast',c:'Italy',t:['Amalfi Coast','Italy','Road Trip']},
  {n:'Barcelona',c:'Spain',t:['Barcelona','Spain','City Guide']},
  {n:'the Swiss Alps',c:'Switzerland',t:['Swiss Alps','Switzerland','Hiking']},
  {n:'Dubrovnik',c:'Croatia',t:['Dubrovnik','Croatia','Europe']},
  {n:'Edinburgh',c:'Scotland',t:['Edinburgh','Scotland','City Guide']},
  {n:'Berlin',c:'Germany',t:['Berlin','Germany','City Guide']},
  {n:'Norway',c:'Norway',t:['Norway','Fjords','Europe']},
  {n:'Prague',c:'Czech Republic',t:['Prague','Czech Republic','City Guide']},
  {n:'Amsterdam',c:'Netherlands',t:['Amsterdam','Netherlands','City Guide']},
  {n:'New York City',c:'USA',t:['New York','USA','City Guide']},
  {n:'Peru',c:'Peru',t:['Peru','Machu Picchu','Adventure']},
  {n:'Costa Rica',c:'Costa Rica',t:['Costa Rica','Nature','Adventure']},
  {n:'Patagonia',c:'Argentina',t:['Patagonia','Trekking','Adventure']},
  {n:'Mexico City',c:'Mexico',t:['Mexico City','Mexico','Food']},
  {n:'Canada',c:'Canada',t:['Canada','Rockies','Nature']},
  {n:'Colombia',c:'Colombia',t:['Colombia','South America','Culture']},
  {n:'Morocco',c:'Morocco',t:['Morocco','Africa','Culture']},
  {n:'Dubai',c:'UAE',t:['Dubai','UAE','Luxury']},
  {n:'South Africa',c:'South Africa',t:['South Africa','Safari','Africa']},
  {n:'Egypt',c:'Egypt',t:['Egypt','Pyramids','Africa']},
  {n:'Jordan',c:'Jordan',t:['Jordan','Petra','Adventure']},
  {n:'Kenya',c:'Kenya',t:['Kenya','Safari','Africa']},
  {n:'Zanzibar',c:'Tanzania',t:['Zanzibar','Tanzania','Beaches']},
  {n:'Namibia',c:'Namibia',t:['Namibia','Desert','Africa']},
  {n:'New Zealand',c:'New Zealand',t:['New Zealand','Road Trip','Adventure']},
  {n:'Australia',c:'Australia',t:['Australia','Great Barrier Reef','Nature']},
  {n:'Fiji',c:'Fiji',t:['Fiji','Islands','Beaches']},
  {n:'Sydney',c:'Australia',t:['Sydney','Australia','City Guide']},
  {n:'Goa',c:'India',t:['Goa','India','Beaches']},
  {n:'Kerala',c:'India',t:['Kerala','India','Nature']},
  {n:'Leh Ladakh',c:'India',t:['Leh Ladakh','India','Adventure']},
  {n:'Rajasthan',c:'India',t:['Rajasthan','India','Heritage']},
  {n:'Mumbai',c:'India',t:['Mumbai','India','Street Food']},
  {n:'Bengaluru',c:'India',t:['Bengaluru','India','Weekend Trips']},
  {n:'Himachal Pradesh',c:'India',t:['Himachal Pradesh','India','Mountains']},
  {n:'the Andaman Islands',c:'India',t:['Andaman','India','Beaches']},
  {n:'Varanasi',c:'India',t:['Varanasi','India','Spiritual']},
  {n:'Northeast India',c:'India',t:['Northeast India','India','Offbeat']},
  {n:'Jaipur',c:'India',t:['Jaipur','Rajasthan','Heritage']},
  {n:'Delhi',c:'India',t:['Delhi','India','City Guide']},
  {n:'Kolkata',c:'India',t:['Kolkata','India','Culture']},
  {n:'Chennai',c:'India',t:['Chennai','India','Beaches']},
  {n:'Hyderabad',c:'India',t:['Hyderabad','India','Food']},
  {n:'Pune',c:'India',t:['Pune','India','Weekend Trips']},
  {n:'Indonesia',c:'Indonesia',t:['Indonesia','Southeast Asia','Islands']},
  {n:'Malaysia',c:'Malaysia',t:['Malaysia','Southeast Asia','Food']},
  {n:'Japan',c:'Japan',t:['Japan','Asia','Culture']},
  {n:'South Korea',c:'South Korea',t:['South Korea','Asia','City Guide']},
  {n:'China',c:'China',t:['China','Asia','Culture']},
  {n:'India',c:'India',t:['India','Asia','Culture']},
  {n:'the USA',c:'USA',t:['USA','North America','Road Trip']},
  {n:'the UK',c:'UK',t:['UK','Europe','Heritage']},
  {n:'France',c:'France',t:['France','Europe','Food']},
  {n:'Brazil',c:'Brazil',t:['Brazil','South America','Carnival']},
  {n:'Chile',c:'Chile',t:['Chile','South America','Adventure']},
  {n:'Tanzania',c:'Tanzania',t:['Tanzania','Safari','Africa']},
  {n:'the UAE',c:'UAE',t:['UAE','Middle East','Luxury']},
  {n:'Oman',c:'Oman',t:['Oman','Middle East','Desert']},
  {n:'Bhutan',c:'Bhutan',t:['Bhutan','Himalayas','Spiritual']},
  {n:'Bangladesh',c:'Bangladesh',t:['Bangladesh','Asia','Culture']},
  {n:'Hawaii',c:'USA',t:['Hawaii','USA','Beaches']},
  {n:'California',c:'USA',t:['California','USA','Road Trip']},
  {n:'Colorado',c:'USA',t:['Colorado','USA','Mountains']},
  {n:'Utah',c:'USA',t:['Utah','USA','National Parks']},
  {n:'Arizona',c:'USA',t:['Arizona','USA','Desert']},
  {n:'Oregon',c:'USA',t:['Oregon','USA','Nature']},
  {n:'Alaska',c:'USA',t:['Alaska','USA','Wildlife']},
  {n:'Ireland',c:'Ireland',t:['Ireland','Europe','Road Trip']},
  {n:'Denmark',c:'Denmark',t:['Denmark','Europe','City Guide']},
  {n:'Sweden',c:'Sweden',t:['Sweden','Europe','Nature']},
  {n:'Finland',c:'Finland',t:['Finland','Europe','Northern Lights']},
  {n:'Estonia',c:'Estonia',t:['Estonia','Europe','City Guide']},
  {n:'Poland',c:'Poland',t:['Poland','Europe','History']},
  {n:'Hungary',c:'Hungary',t:['Hungary','Europe','City Guide']},
  {n:'Romania',c:'Romania',t:['Romania','Europe','Castles']},
  {n:'Bulgaria',c:'Bulgaria',t:['Bulgaria','Europe','Mountains']},
  {n:'Serbia',c:'Serbia',t:['Serbia','Europe','Culture']},
  {n:'Slovenia',c:'Slovenia',t:['Slovenia','Europe','Nature']},
  {n:'Bosnia',c:'Bosnia',t:['Bosnia','Europe','History']},
  {n:'Albania',c:'Albania',t:['Albania','Europe','Beaches']},
  {n:'Ukraine',c:'Ukraine',t:['Ukraine','Europe','Culture']},
  {n:'Belarus',c:'Belarus',t:['Belarus','Europe','History']},
  {n:'Moldova',c:'Moldova',t:['Moldova','Europe','Wine']},
  {n:'Slovakia',c:'Slovakia',t:['Slovakia','Europe','Mountains']},
  {n:'Belgium',c:'Belgium',t:['Belgium','Europe','Food']},
  {n:'Luxembourg',c:'Luxembourg',t:['Luxembourg','Europe','City Guide']},
  {n:'Austria',c:'Austria',t:['Austria','Europe','Mountains']},
  {n:'Cyprus',c:'Cyprus',t:['Cyprus','Europe','Beaches']},
  {n:'Malta',c:'Malta',t:['Malta','Europe','History']},
  {n:'Greenland',c:'Greenland',t:['Greenland','Arctic','Adventure']},
  {n:'the Faroe Islands',c:'Faroe Islands',t:['Faroe Islands','Europe','Nature']},
  {n:'Russia',c:'Russia',t:['Russia','Europe','Culture']},
  {n:'Georgia',c:'Georgia',t:['Georgia','Caucasus','Food']},
  {n:'Armenia',c:'Armenia',t:['Armenia','Caucasus','History']},
  {n:'Azerbaijan',c:'Azerbaijan',t:['Azerbaijan','Caucasus','Culture']},
  {n:'Kazakhstan',c:'Kazakhstan',t:['Kazakhstan','Central Asia','Mountains']},
  {n:'Mongolia',c:'Mongolia',t:['Mongolia','Central Asia','Adventure']},
  {n:'Pakistan',c:'Pakistan',t:['Pakistan','Asia','Mountains']},
  {n:'British Columbia',c:'Canada',t:['British Columbia','Canada','Nature']},
  {n:'Alberta',c:'Canada',t:['Alberta','Canada','Mountains']},
  {n:'Quebec',c:'Canada',t:['Quebec','Canada','Culture']},
  {n:'Nova Scotia',c:'Canada',t:['Nova Scotia','Canada','Coast']},
  {n:'Belize',c:'Belize',t:['Belize','Central America','Diving']},
  {n:'Guatemala',c:'Guatemala',t:['Guatemala','Central America','Mayan']},
  {n:'Panama',c:'Panama',t:['Panama','Central America','Canal']},
  {n:'Cuba',c:'Cuba',t:['Cuba','Caribbean','Culture']},
  {n:'Jamaica',c:'Jamaica',t:['Jamaica','Caribbean','Beaches']},
  {n:'the Dominican Republic',c:'Dominican Republic',t:['Dominican Republic','Caribbean','Beaches']},
  {n:'Puerto Rico',c:'Puerto Rico',t:['Puerto Rico','Caribbean','Beaches']},
  {n:'Barbados',c:'Barbados',t:['Barbados','Caribbean','Beaches']},
  {n:'St Lucia',c:'St Lucia',t:['St Lucia','Caribbean','Honeymoon']},
  {n:'Antigua',c:'Antigua',t:['Antigua','Caribbean','Beaches']},
  {n:'the Bahamas',c:'Bahamas',t:['Bahamas','Caribbean','Luxury']},
  {n:'Maui',c:'USA',t:['Maui','Hawaii','Beaches']},
  {n:'Kauai',c:'USA',t:['Kauai','Hawaii','Nature']},
  {n:'Oahu',c:'USA',t:['Oahu','Hawaii','Surfing']},
  {n:'the Big Island',c:'USA',t:['Big Island','Hawaii','Volcano']},
  {n:'Texas',c:'USA',t:['Texas','USA','Road Trip']},
  {n:'Louisiana',c:'USA',t:['Louisiana','USA','Food']},
  {n:'Tennessee',c:'USA',t:['Tennessee','USA','Music']},
  {n:'North Carolina',c:'USA',t:['North Carolina','USA','Mountains']},
  {n:'Maine',c:'USA',t:['Maine','USA','Coast']},
  {n:'Vermont',c:'USA',t:['Vermont','USA','Fall Foliage']},
  {n:'Massachusetts',c:'USA',t:['Massachusetts','USA','History']},
  {n:'Michigan',c:'USA',t:['Michigan','USA','Lakes']},
  {n:'Wales',c:'UK',t:['Wales','UK','Castles']},
  {n:'England',c:'UK',t:['England','UK','Heritage']},
  {n:'Latvia',c:'Latvia',t:['Latvia','Europe','City Guide']},
  {n:'Lithuania',c:'Lithuania',t:['Lithuania','Europe','History']},
  {n:'Montenegro',c:'Montenegro',t:['Montenegro','Europe','Mountains']},
  {n:'Madagascar',c:'Madagascar',t:['Madagascar','Africa','Wildlife']},
  {n:'Botswana',c:'Botswana',t:['Botswana','Africa','Safari']},
  {n:'Rwanda',c:'Rwanda',t:['Rwanda','Africa','Gorillas']},
  {n:'Uganda',c:'Uganda',t:['Uganda','Africa','Gorillas']},
  {n:'Ghana',c:'Ghana',t:['Ghana','Africa','Culture']},
  {n:'Senegal',c:'Senegal',t:['Senegal','Africa','Culture']},
  {n:'Tunisia',c:'Tunisia',t:['Tunisia','Africa','History']},
  {n:'Qatar',c:'Qatar',t:['Qatar','Middle East','Luxury']},
  {n:'Bahrain',c:'Bahrain',t:['Bahrain','Middle East','Culture']},
  {n:'Kuwait',c:'Kuwait',t:['Kuwait','Middle East','Desert']},
  {n:'Lebanon',c:'Lebanon',t:['Lebanon','Middle East','Food']},
  {n:'Iran',c:'Iran',t:['Iran','Middle East','History']},
  {n:'Uzbekistan',c:'Uzbekistan',t:['Uzbekistan','Central Asia','Silk Road']},
  {n:'Tajikistan',c:'Tajikistan',t:['Tajikistan','Central Asia','Mountains']},
  {n:'Kyrgyzstan',c:'Kyrgyzstan',t:['Kyrgyzstan','Central Asia','Mountains']},
  {n:'Papua New Guinea',c:'Papua New Guinea',t:['Papua New Guinea','Oceania','Adventure']},
  {n:'Vanuatu',c:'Vanuatu',t:['Vanuatu','Oceania','Volcano']},
  {n:'Samoa',c:'Samoa',t:['Samoa','Oceania','Culture']},
  {n:'Tonga',c:'Tonga',t:['Tonga','Oceania','Whales']},
  {n:'the Cook Islands',c:'Cook Islands',t:['Cook Islands','Oceania','Beaches']},
  {n:'Tahiti',c:'Tahiti',t:['Tahiti','Oceania','Honeymoon']},
  {n:'Moorea',c:'Moorea',t:['Moorea','Oceania','Diving']},
  {n:'Rarotonga',c:'Rarotonga',t:['Rarotonga','Cook Islands','Beaches']},
  {n:'Palau',c:'Palau',t:['Palau','Oceania','Diving']},
  {n:'Guam',c:'Guam',t:['Guam','Oceania','Beaches']},
  {n:'Victoria Falls',c:'Zambia',t:['Victoria Falls','Africa','Adventure']},
  {n:'Niagara Falls',c:'Canada',t:['Niagara Falls','North America','Nature']},
  {n:'Iguazu Falls',c:'Argentina',t:['Iguazu Falls','South America','Nature']},
  {n:'Lake Baikal',c:'Russia',t:['Lake Baikal','Russia','Nature']},
  {n:'the Dead Sea',c:'Jordan',t:['Dead Sea','Middle East','Wellness']},
];

// Search query for each destination (strip "the" prefix)
function searchQuery(dest) {
  return dest.n.replace(/^the\s+/i, '');
}

// ── Fetch images from Unsplash ──
async function fetchImages(query, perPage = 15) {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}`;
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    // Only use free (non-premium) photos — plus.unsplash.com photos are inaccessible
    const ids = [];
    for (const r of data.results) {
      if (r.plus || r.premium) continue;
      const raw = r.urls?.raw || '';
      if (raw.includes('plus.unsplash.com')) continue;
      // Extract hex photo ID from the URL path (e.g. photo-1513407030348-c983a97b98d8)
      const m = raw.match(/photo-([a-f0-9-]+)/);
      if (m && m[1]) ids.push(m[1]);
    }
    return [...new Set(ids)];
  } catch (e) {
    return [];
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Build or load image cache ──
async function buildImageCache() {
  if (fs.existsSync(CACHE_FILE)) {
    console.log('📦 Loading cached images...');
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }

  console.log('🔍 Fetching destination-specific images from Unsplash...');
  const cache = { destinations: {}, templates: {}, fetchedAt: new Date().toISOString() };
  const destCounter = {};

  // Fetch images for each destination
  for (let i = 0; i < DESTS.length; i++) {
    const dest = DESTS[i];
    const q = searchQuery(dest);
    const ids = await fetchImages(q, 20);
    cache.destinations[dest.n] = ids;
    destCounter[dest.n] = 0;

    // Also search for country-level images as fallback
    if (!cache.destinations[dest.c]) {
      const countryIds = await fetchImages(dest.c, 15);
      cache.destinations[dest.c] = countryIds;
      destCounter[dest.c] = 0;
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  ... ${i + 1}/${DESTS.length} destinations fetched`);
    }
    await sleep(600); // Be nice to the API
  }

  // Fetch template-specific images
  const templateSearches = {
    guide: ['travel destination landscape', 'travel guide scenic view'],
    solo: ['solo traveler backpack', 'solo travel adventure'],
    family: ['family travel vacation', 'family trip kids'],
    couple: ['couple travel romantic', 'romantic travel sunset'],
    budget: ['budget travel backpacker', 'cheap travel hostel'],
    luxury: ['luxury travel resort', 'luxury hotel infinity pool'],
    adventure: ['adventure travel hiking', 'extreme sports outdoor'],
    food: ['local food cuisine', 'street food market'],
    culture: ['cultural heritage temple', 'traditional festival culture'],
    weekend: ['weekend getaway city', 'short trip escape'],
  };

  console.log('🔍 Fetching template-specific images...');
  for (const [tmpl, queries] of Object.entries(templateSearches)) {
    const all = [];
    for (const q of queries) {
      const ids = await fetchImages(q, 15);
      all.push(...ids);
      await sleep(600);
    }
    cache.templates[tmpl] = [...new Set(all)];
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log('✅ Image cache saved to', CACHE_FILE);
  return cache;
}

// ── Image selection ──
function makeImgUrl(id, w = 800) {
  return `https://images.unsplash.com/photo-${id}?fm=webp&w=${w}&q=60`;
}

// Track usage counters per destination and template
const destImgCounters = {};
const tmplImgCounters = {};

function getNextImage(pool, counterKey) {
  if (!pool || pool.length === 0) return null;
  const idx = (counterKey in destImgCounters) ? destImgCounters[counterKey] : 0;
  destImgCounters[counterKey] = (idx + 1) % pool.length;
  return pool[idx % pool.length];
}

function getNextTemplateImage(pool, counterKey) {
  if (!pool || pool.length === 0) return null;
  const idx = (counterKey in tmplImgCounters) ? tmplImgCounters[counterKey] : 0;
  tmplImgCounters[counterKey] = (idx + 1) % pool.length;
  return pool[idx % pool.length];
}

function getImg(cache, seed, dest, template) {
  // Strategy: destination-specific > template-specific > generic
  const destPool = cache.destinations[dest.n] || [];
  const countryPool = cache.destinations[dest.c] || [];
  const tmplPool = cache.templates[template] || [];

  // Combine destination + country images for more variety
  const combined = [...new Set([...destPool, ...countryPool])];

  // Use hash to deterministically pick, but rotate through available images
  const h = hash(seed + '-cover');

  if (combined.length > 0) {
    // Rotate through combined pool using a counter per destination
    const counterKey = dest.n;
    const idx = (destImgCounters[counterKey] || 0) % combined.length;
    destImgCounters[counterKey] = (idx + 1) % combined.length;
    return makeImgUrl(combined[idx], 800);
  }

  if (tmplPool.length > 0) {
    const idx = h % tmplPool.length;
    return makeImgUrl(tmplPool[idx], 800);
  }

  // Ultimate fallback - use a known working ID
  return makeImgUrl('1507525428034-b723cf961d3e', 800);
}

function getImgInline(cache, seed, dest, template) {
  const destPool = cache.destinations[dest.n] || [];
  const countryPool = cache.destinations[dest.c] || [];
  const tmplPool = cache.templates[template] || [];
  const combined = [...new Set([...destPool, ...countryPool])];

  const h = hash(seed + '-inline');

  // Pick a different image from the same pool for inline
  if (combined.length > 1) {
    const counterKey = dest.n + '-inline';
    const idx = ((destImgCounters[counterKey] || 0) + 1) % combined.length;
    destImgCounters[counterKey] = idx;
    return makeImgUrl(combined[idx], 1200);
  }

  if (tmplPool.length > 1) {
    const idx = (h + 1) % tmplPool.length;
    return makeImgUrl(tmplPool[idx], 1200);
  }

  return makeImgUrl('1507525428034-b723cf961d3e', 1200);
}

// ── Post generation ──
function generatePost(cache, seed, dest, template) {
  srand(hash(seed));
  const d = dest;
  let title, meta, excerpt, tags;
  let content = '';

  switch(template) {
    case 'guide': {
      title = `The Complete ${d.n} Travel Guide for 2026`;
      meta = `Plan the ultimate trip to ${d.n} with our 2026 guide. Discover the best attractions, food, neighborhoods, and hidden gems.`;
      excerpt = `${d.n} is a destination that rewards the curious traveler. Beyond the well-known attractions lies a world of hidden gems and unforgettable experiences.`;
      tags = [...d.t, 'Travel Guide'];
      content = `${intro(d.n, 'planning a trip to ' + d.n)}

${h2('Best Time to Visit')}

The ideal time to explore ${d.n} depends on what you want to experience. ${pick(['Spring brings mild weather and blooming landscapes, making it perfect for outdoor exploration and photography.','Summer offers long days perfect for outdoor adventures, though you should book accommodation well in advance.','Autumn paints the scenery in golden hues with fewer crowds, and the temperatures remain pleasant for walking tours.','Winter transforms the landscape into a magical wonderland, with festive markets and cozy indoor experiences.'])} Shoulder seasons often provide the best balance of good weather, manageable crowds, and reasonable prices.

${h2('Top Attractions')}

${bullet(
  `${pick(['Iconic landmarks','Must-see sights','Famous attractions'])} that define ${d.n} and should be on every first-time visitor's list`,
  `Hidden ${pick(['gems','treasures','spots'])} only locals know about — quiet corners away from the tourist trail`,
  `${pick(['Cultural','Historical','Natural'])} sites that tell the story of ${d.c} and its people through the ages`,
  `Scenic ${pick(['viewpoints','lookouts','vistas'])} for unforgettable photos, especially during sunrise and sunset`
)}

${imgAlt(`${d.n} landscape`, getImgInline(cache, seed, d, template))}

${h2('Local Cuisine')}

No trip to ${d.n} is complete without sampling the local food. From street-side vendors to fine dining establishments, the culinary scene reflects the region's rich heritage and innovative spirit. Morning markets overflow with fresh produce, while evening food stalls serve up aromatic dishes that draw locals and visitors alike. Do not miss the chance to try a cooking class — it is one of the best ways to take a piece of ${d.n} home with you.

${h2('Getting Around')}

${pick([
  `Public transport in ${d.n} is efficient and affordable, making it easy to explore without a car. Buses and trains connect major sights, and day passes offer excellent value for active travelers.`,
  `Renting a vehicle gives you the freedom to discover ${d.n} at your own pace, especially for remote attractions. Just be sure to familiarize yourself with local driving rules and parking options.`,
  `Walking is the best way to experience the true charm of ${d.n}, with most major sights within easy reach. Comfortable shoes are essential, as you will likely cover several kilometers each day.`,
  `A mix of public transport and occasional taxis offers the best balance of convenience and cost in ${d.n}. Ride-sharing apps are widely available and often more affordable than traditional taxis.`
])}

${h2('Where to Stay')}

${pick([
  `From boutique hotels to family-run guesthouses, ${d.n} offers accommodation for every budget and style. Staying in the city center puts you within walking distance of major sights and dining options.`,
  `Luxury resorts and budget hostels coexist in ${d.n}, giving travelers plenty of options. Consider your priorities — location, amenities, or atmosphere — and choose accordingly.`,
  `Homestays are a great way to immerse yourself in local culture while visiting ${d.n}. Your hosts can offer insider tips that no guidebook can match.`,
  `Book early during peak season to secure the best places to stay in ${d.n}. Last-minute options are available but often more expensive and less centrally located.`
])}

${h2('Money-Saving Tips')}

${bullet(
  `Visit attractions early in the morning to avoid crowds and get better photos`,
  `Eat where the locals eat — smaller restaurants often serve the most authentic food at lower prices`,
  `Look for city passes that bundle multiple attractions at a discounted rate`
)}

${cta()}`;
      break;
    }
    case 'solo': {
      title = `Solo Travel in ${d.n}: A Complete Guide for 2026`;
      meta = `Travel solo to ${d.n} with confidence. Our 2026 guide covers safety, budget tips, and the best experiences for independent travelers.`;
      excerpt = `Solo travel in ${d.n} is an empowering experience. This guide covers everything you need to know to explore independently and confidently.`;
      tags = ['Solo Travel', ...d.t.slice(0,2), 'Tips'];
      content = `${intro(d.n, 'traveling solo to ' + d.n)}

${h2('Why Solo Travel in ' + d.n + ' is Special')}

${pick([
  `Solo travel opens doors to experiences that group tours simply cannot match. In ${d.n}, the freedom to choose your own path creates memories that last a lifetime. You set the pace, change plans on a whim, and discover places you never knew existed.`,
  `There is a unique joy in traveling solo through ${d.n}. Every decision is yours, every discovery is personal, and every moment is exactly what you make of it. The confidence you gain from navigating a new place alone stays with you long after the trip ends.`,
  `The rise of solo travel has transformed how we explore the world. In ${d.n}, you will find a growing community of independent travelers proving that this approach leads to richer journeys and deeper connections.`
])}

${h2('Safety Tips')}

${bullet(
  'Share your full itinerary with someone back home and check in regularly',
  'Stay connected with a local SIM card or portable WiFi device',
  'Trust your instincts and avoid poorly lit or isolated areas after dark',
  'Keep digital and physical copies of important documents in separate places'
)}

${imgAlt(`Solo travel in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Budget-Friendly Tips')}

${pick([
  `Hostels and guesthouses in ${d.n} offer affordable accommodation without sacrificing comfort or location. Many also organize social events where you can meet fellow travelers.`,
  `Street food in ${d.n} is not just cheap — it is often the most authentic and delicious option available. Follow the locals to find the best stalls.`,
  `Free walking tours are a fantastic way to learn about ${d.n} from knowledgeable locals while keeping costs down. Just remember to tip your guide what you can afford.`,
  `Travel during shoulder season to enjoy ${d.n} with fewer crowds and lower prices. The weather is often still pleasant, and attractions feel more intimate.`
])}

${h2('Meeting Other Travelers')}

${pick([
  `Cafes, hostels, and walking tours in ${d.n} are natural meeting points for solo travelers from around the world. A simple conversation over coffee can lead to shared adventures.`,
  `Join local events and meetups to connect with both locals and fellow travelers in ${d.n}. Language exchanges and cooking classes are especially welcoming.`,
  `Social media groups dedicated to ${d.n} travel are great for finding travel buddies and getting real-time advice from people who are already there.`
])}

${h2('Solo Dining and Evenings')}

${pick([
  `Eating alone in ${d.n} is perfectly normal and often enjoyable. Bring a book, sit at the bar, or simply people-watch while savoring your meal.`,
  `Evening activities like night markets, live music venues, and cultural performances are ideal for solo travelers in ${d.n} — you can soak up the atmosphere without needing company.`
])}

${cta()}`;
      break;
    }
    case 'family': {
      title = `Family Travel in ${d.n}: The Ultimate 2026 Guide`;
      meta = `Plan the perfect family trip to ${d.n}. Kid-friendly activities, family accommodations, and tips for stress-free travel with children.`;
      excerpt = `${d.n} is a fantastic destination for families. From kid-friendly attractions to comfortable accommodations, this guide has everything you need.`;
      tags = ['Family Travel', ...d.t.slice(0,2), 'Kids'];
      content = `${intro(d.n, 'traveling with family to ' + d.n)}

${h2('Kid-Friendly Activities')}

${bullet(
  `Interactive museums and cultural centers that engage children of all ages with hands-on exhibits`,
  `Outdoor adventures like parks, beaches, and nature reserves perfect for burning energy and exploring together`,
  `Animal encounters and wildlife experiences that educate and entertain the whole family`,
  `Hands-on workshops where kids can learn local crafts and traditions while parents enjoy watching them create`
)}

${imgAlt(`Family travel in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Family Accommodation Tips')}

${pick([
  `Look for family rooms or connecting rooms in ${d.n} to keep everyone together while maintaining some privacy. Many hotels offer cribs and high chairs on request.`,
  `Apartments and vacation rentals in ${d.n} often offer better value for families, with kitchen facilities and extra space for everyone to spread out.`,
  `All-inclusive resorts in ${d.n} can be a stress-free option, with meals, activities, and childcare included — perfect for parents who want a break too.`,
  `Book accommodations near public transport to make getting around ${d.n} easier with children. A central location saves time and reduces travel fatigue.`
])}

${h2('Packing for Kids')}

${bullet(
  'Pack snacks and entertainment for transit times — hungry or bored kids make travel harder',
  'Bring comfortable walking shoes for everyone, including water-friendly options if beaches are on the itinerary',
  'Carry a small first-aid kit with familiar medications, plasters, and any prescription essentials',
  'Pack light but include comfort items from home — a favorite toy or blanket can make unfamiliar places feel safe'
)}

${h2('Keeping Everyone Happy')}

${pick([
  `Build downtime into your ${d.n} itinerary. Kids tire faster than adults, and a relaxed pace leads to better memories than a packed schedule.`,
  `Let each family member choose one activity for the trip. When everyone has something to look forward to, the whole experience becomes more enjoyable.`
])}

${cta()}`;
      break;
    }
    case 'couple': {
      title = `Romantic Getaway to ${d.n}: A Couple's Guide for 2026`;
      meta = `Plan the perfect romantic trip to ${d.n}. Sunset spots, intimate dining, and unforgettable experiences for couples in love.`;
      excerpt = `${d.n} sets the stage for romance like nowhere else. From sunset views to intimate dinners, this guide will help you plan the perfect couple's getaway.`;
      tags = ['Couple Travel', 'Romantic', ...d.t.slice(0,2)];
      content = `${intro(d.n, 'planning a romantic getaway to ' + d.n)}

${h2('Most Romantic Spots')}

${bullet(
  `Sunset viewpoints that offer breathtaking panoramas over ${d.n} — bring a blanket and a bottle of wine`,
  `Secluded beaches and hidden coves perfect for private moments away from the crowds`,
  `Candlelit restaurants serving the finest local cuisine in intimate, softly lit settings`,
  `Scenic walks through charming neighborhoods and historic streets hand in hand`
)}

${imgAlt(`Romantic ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Romantic Activities')}

${pick([
  `A private boat tour around ${d.n} at sunset is the perfect way to create lasting memories together. The golden light reflecting off the water creates a scene you will both treasure forever.`,
  `Couples spa treatments using local ingredients offer relaxation and rejuvenation in ${d.n}. Book a side-by-side massage for the ultimate shared experience.`,
  `Cooking classes for two let you learn the secrets of ${d.c}'s cuisine while bonding over delicious food. You will laugh, learn, and eat well — the perfect date.`,
  `Hot air balloon rides over ${d.n} provide a magical perspective that you will never forget. Watching the landscape unfold beneath you at sunrise is pure romance.`
])}

${h2('Where to Stay')}

${pick([
  `Boutique hotels in ${d.n} offer intimate settings with personalized service perfect for couples. Look for properties with rooftop terraces or garden courtyards.`,
  `Luxury resorts with private pools and ocean views create the ultimate romantic atmosphere in ${d.n}. Splurge on a suite with a balcony for breakfast with a view.`,
  `Charming bed and breakfasts in ${d.n} provide cozy accommodations with home-cooked breakfasts. The personal touch makes these stays feel extra special.`,
  `Villa rentals offer privacy and space for couples who want to create their own romantic retreat in ${d.n}. A private kitchen means candlelit dinners without leaving your room.`
])}

${h2('Planning the Perfect Evening')}

${pick([
  `Start with pre-dinner drinks at a rooftop bar overlooking ${d.n}, then move to a reservation at a restaurant known for both its food and its atmosphere.`,
  `Surprise your partner with a picnic at one of ${d.n}'s scenic spots. Local cheeses, fresh bread, and a sunset view make for an unforgettable evening.`
])}

${cta()}`;
      break;
    }
    case 'budget': {
      title = `${d.n} on a Budget: The Smart Traveler's 2026 Guide`;
      meta = `Experience ${d.n} without breaking the bank. Budget accommodation, cheap eats, and free activities for the savvy traveler.`;
      excerpt = `${d.n} does not have to be expensive. With the right strategy, you can experience the best of ${d.n} while keeping costs surprisingly low.`;
      tags = ['Budget Travel', ...d.t.slice(0,2), 'Tips'];
      content = `${intro(d.n, 'traveling on a budget to ' + d.n)}

${h2('Budget Accommodation')}

${bullet(
  `Hostels and guesthouses offer affordable beds without sacrificing location or cleanliness`,
  `Vacation rentals can be cheaper than hotels, especially for groups or longer stays`,
  `Homestays provide authentic experiences at a fraction of hotel prices`,
  `Camping and glamping options for outdoor enthusiasts visiting ${d.n}`
)}

${imgAlt(`Budget travel in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Eating on a Budget')}

${pick([
  `Street food in ${d.n} is not just cheap — it is often the most delicious and authentic food you will find.`,
  `Local markets in ${d.n} sell fresh produce and ready-to-eat meals at prices far below restaurants.`,
  `Lunch specials and set menus at restaurants in ${d.n} offer the same quality food at half the dinner price.`,
  `Supermarkets and convenience stores in ${d.n} are perfect for stocking up on breakfast items and snacks.`
])}

${h2('Free and Cheap Activities')}

${bullet(
  'Free walking tours with knowledgeable local guides',
  'Public parks, beaches, and hiking trails with no entry fees',
  'Free museum days and cultural events throughout the year',
  'Window shopping and people-watching in vibrant neighborhoods'
)}

${cta()}`;
      break;
    }
    case 'luxury': {
      title = `Luxury Travel in ${d.n}: The Ultimate 2026 Experience`;
      meta = `Indulge in the finest experiences ${d.n} has to offer. Luxury hotels, private tours, and exclusive activities for discerning travelers.`;
      excerpt = `${d.n} offers world-class luxury experiences for travelers who demand the very best. From five-star resorts to private excursions, this is luxury travel at its finest.`;
      tags = ['Luxury Travel', ...d.t.slice(0,2), 'Exclusive'];
      content = `${intro(d.n, 'seeking luxury in ' + d.n)}

${h2('Luxury Accommodation')}

${bullet(
  `Five-star resorts with private beaches and butler service where every need is anticipated before you ask`,
  `Boutique hotels housed in historic buildings with modern amenities and impeccable design`,
  `Private villas with infinity pools and panoramic views that make waking up a pleasure`,
  `Exclusive retreats offering personalized spa treatments and wellness programs tailored to you`
)}

${imgAlt(`Luxury in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Exclusive Experiences')}

${pick([
  `Private guided tours of ${d.n}'s most iconic landmarks, away from the crowds and at your own pace. Your expert guide shares stories that few visitors ever hear.`,
  `Helicopter tours offering breathtaking aerial views of ${d.n}'s most spectacular scenery. The perspective from above reveals patterns and beauty invisible from the ground.`,
  `Yacht charters for exploring hidden coves and islands around ${d.n} in complete privacy. A dedicated crew handles everything while you relax.`,
  `Michelin-starred dining experiences showcasing the finest culinary traditions of ${d.c}. Multi-course tasting menus paired with exceptional wines create unforgettable evenings.`
])}

${h2('VIP Services')}

${pick([
  `Personal concierge services in ${d.n} can arrange everything from restaurant reservations to private transportation. Nothing is too small or too ambitious.`,
  `Fast-track airport services ensure seamless arrivals and departures from ${d.n}. Skip queues and start your holiday the moment you land.`,
  `Private chefs and in-villa dining bring gourmet experiences directly to your accommodation in ${d.n}. Breakfast on your terrace has never tasted this good.`,
  `Luxury car rentals let you explore ${d.n} in style and comfort. A chauffeur-driven vehicle means you can enjoy the scenery without worrying about navigation.`
])}

${h2('When to Splurge')}

${pick([
  `A private sunset dinner on a secluded beach in ${d.n} is worth every penny. The combination of exceptional food, perfect setting, and total privacy creates a memory that lasts forever.`,
  `Upgrade to a suite with an ocean view in ${d.n}. Waking up to that panorama each morning transforms an ordinary trip into an extraordinary one.`
])}

${cta()}`;
      break;
    }
    case 'adventure': {
      title = `Adventure Awaits in ${d.n}: The 2026 Thrill-Seeker's Guide`;
      meta = `Push your limits in ${d.n}. From extreme sports to wilderness expeditions, this guide covers the best adventure experiences.`;
      excerpt = `For adrenaline junkies and outdoor enthusiasts, ${d.n} is a playground of epic proportions. This guide reveals the most thrilling adventures waiting for you.`;
      tags = ['Adventure', ...d.t.slice(0,2), 'Outdoor'];
      content = `${intro(d.n, 'seeking adventure in ' + d.n)}

${h2('Extreme Sports')}

${bullet(
  `Skydiving and paragliding over ${d.n}'s stunning landscapes — see the world from a perspective few ever experience`,
  `White-water rafting on raging rivers that cut through ${d.n}'s dramatic terrain`,
  `Rock climbing and bouldering on world-class routes that challenge every skill level`,
  `Bungee jumping from iconic bridges and platforms that test your courage`
)}

${imgAlt(`Adventure in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Wilderness Expeditions')}

${pick([
  `Multi-day treks through ${d.n}'s remote wilderness offer a true test of endurance and reward with incredible scenery. Pack light, prepare for changing weather, and embrace the solitude.`,
  `Wildlife safaris in ${d.n} bring you face-to-face with some of the world's most magnificent animals in their natural habitat. Early mornings yield the best sightings.`,
  `Caving expeditions reveal hidden underground worlds beneath ${d.n} that few travelers ever see. Stalactites, underground rivers, and vast chambers await.`,
  `Mountain expeditions in ${d.n} challenge experienced climbers with technical routes and high altitudes. Proper acclimatization and local guides are essential.`
])}

${h2('Water Adventures')}

${bullet(
  'Scuba diving in crystal-clear waters with vibrant marine life and coral gardens',
  'Surfing legendary breaks that attract pros from around the world — lessons available for beginners',
  'Kayaking through dramatic fjords and along rugged coastlines at your own pace',
  'Snorkeling over coral reefs teeming with colorful fish — no certification required'
)}

${h2('Planning Your Adventure')}

${pick([
  `Research operators carefully in ${d.n}. The best adventure companies prioritize safety, employ certified guides, and maintain equipment to high standards.`,
  `Travel insurance that covers adventure activities is essential for ${d.n}. Standard policies often exclude extreme sports, so read the fine print.`
])}

${cta()}`;
      break;
    }
    case 'food': {
      title = `Culinary Journey Through ${d.n}: A Food Lover's 2026 Guide`;
      meta = `Taste the best of ${d.n}. From street food to fine dining, this guide covers the culinary highlights every foodie must experience.`;
      excerpt = `${d.n} is a food lover's paradise. The flavors, aromas, and textures of ${d.c}'s cuisine will take you on an unforgettable culinary journey.`;
      tags = ['Food Travel', ...d.t.slice(0,2), 'Culinary'];
      content = `${intro(d.n, 'chasing culinary experiences in ' + d.n)}

${h2('Must-Try Dishes')}

${bullet(
  `Signature street food that locals eat daily — often the most authentic flavors in the city`,
  `Traditional dishes passed down through generations, each with a story behind its creation`,
  `Regional specialties unique to ${d.n} that you simply cannot find anywhere else`,
  `Modern interpretations of classic ${d.c} cuisine by innovative young chefs`
)}

${imgAlt(`Food in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Best Food Experiences')}

${pick([
  `Night markets in ${d.n} are a feast for the senses, with stall after stall of sizzling, aromatic dishes. Arrive hungry and sample a little of everything.`,
  `Cooking classes in ${d.n} teach you the secrets behind ${d.c}'s most beloved recipes. You will learn techniques and ingredient combinations that transform your home cooking.`,
  `Food tours led by local guides reveal hidden culinary gems that tourists rarely discover. These stories add depth to every bite.`,
  `Farm-to-table restaurants in ${d.n} showcase the freshest local ingredients in creative preparations. The menu changes with the seasons, so every visit is unique.`
])}

${h2('Dining Tips')}

${bullet(
  'Ask locals for recommendations — they know the best hidden spots that never appear in guidebooks',
  'Try the daily specials at local restaurants for authentic flavors at their freshest',
  'Visit markets early in the morning for the freshest produce and the liveliest atmosphere',
  'Do not be afraid to try unfamiliar dishes — surprises are often the best meals of your trip'
)}

${h2('Drinks and Desserts')}

${pick([
  `Local beverages in ${d.n} tell their own story. From traditional teas to craft cocktails, drinks here reflect the region's history and creativity.`,
  `Desserts in ${d.n} are an art form. Whether you prefer something light and refreshing or rich and indulgent, the local pastry scene will not disappoint.`
])}

${cta()}`;
      break;
    }
    case 'culture': {
      title = `Cultural Immersion in ${d.n}: A Traveler's 2026 Guide`;
      meta = `Dive deep into the culture of ${d.n}. Festivals, traditions, art, and history — this guide connects you with the soul of ${d.c}.`;
      excerpt = `${d.n} is a cultural treasure trove. From ancient traditions to contemporary art, every corner tells a story of ${d.c}'s rich heritage.`;
      tags = ['Culture', ...d.t.slice(0,2), 'Heritage'];
      content = `${intro(d.n, 'seeking cultural immersion in ' + d.n)}

${h2('Historical Sites')}

${bullet(
  `Ancient temples and monuments that have stood for centuries, bearing witness to the passage of time`,
  `Museums housing treasures of ${d.c}'s artistic and cultural heritage — plan for at least half a day`,
  `UNESCO World Heritage sites that preserve humanity's shared history in breathtaking settings`,
  `Historic neighborhoods where the past comes alive in architecture, layout, and daily rituals`
)}

${imgAlt(`Culture in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Living Traditions')}

${pick([
  `Festivals in ${d.n} bring ancient traditions to life with music, dance, and vibrant celebrations. Check the calendar before you travel — timing your visit around a festival transforms the experience.`,
  `Traditional craftspeople in ${d.n} keep centuries-old techniques alive through their daily work. Visiting their workshops offers a window into skills that are slowly disappearing.`,
  `Religious ceremonies in ${d.n} offer profound insights into the spiritual life of ${d.c}. Observe respectfully and you may find moments of unexpected beauty.`,
  `Folk music and dance performances in ${d.n} preserve cultural stories for new generations. The energy and emotion of live performances are impossible to replicate.`
])}

${h2('Art and Contemporary Culture')}

${bullet(
  'Contemporary art galleries showcasing emerging local artists who reinterpret tradition through modern lenses',
  'Street art tours revealing urban creativity and social commentary in unexpected places',
  'Theater and performance venues blending tradition with innovation in captivating ways',
  'Design districts where local artisans create modern interpretations of classic crafts'
)}

${h2('Respectful Travel')}

${pick([
  `Learn a few basic phrases in the local language before visiting ${d.n}. Even a simple greeting opens doors and shows respect.`,
  `Dress modestly when visiting religious or traditional sites in ${d.n}. Observing local customs is a small gesture that goes a long way.`
])}

${cta()}`;
      break;
    }
    case 'weekend': {
      title = `Weekend Escape to ${d.n}: Your 2026 Guide`;
      meta = `Make the most of a weekend in ${d.n}. The perfect two-day itinerary with must-see sights, great food, and memorable experiences.`;
      excerpt = `Short on time? ${d.n} is the perfect weekend destination. This guide shows you how to pack the best experiences into just two days.`;
      tags = ['Weekend Getaway', ...d.t.slice(0,2), 'Itinerary'];
      content = `${intro(d.n, 'planning a weekend escape to ' + d.n)}

${h2('Day 1: Arrival and Exploration')}

${bullet(
  `Check into your accommodation and get your bearings with a leisurely walk around the neighborhood`,
  `Visit the most iconic landmark for that perfect first impression and those must-have photos`,
  `Enjoy lunch at a local favorite restaurant — ask your hotel for recommendations`,
  `Spend the afternoon exploring the main cultural or historic district at a relaxed pace`
)}

${imgAlt(`Weekend in ${d.n}`, getImgInline(cache, seed, d, template))}

${h2('Day 2: Adventure and Departure')}

${bullet(
  `Start early with a sunrise activity or scenic viewpoint — the morning light is worth the alarm`,
  `Explore a neighborhood off the beaten tourist path where locals actually live and work`,
  `Indulge in a memorable farewell meal featuring local specialties you cannot find at home`,
  `Pick up souvenirs at a local market before heading home — support small businesses and bring back stories`
)}

${h2('Pro Tips for Weekend Travel')}

${pick([
  `Book accommodation centrally in ${d.n} to minimize transit time and maximize exploration time. A good location is more important than luxury for a short trip.`,
  `Make restaurant reservations in advance, especially for popular spots in ${d.n}. Weekend tables fill up fast.`,
  `Use public transport apps to navigate ${d.n} efficiently during your short stay. Buy day passes to save money and time.`,
  `Pack light so you can move quickly and avoid wasting time at baggage claim. A carry-on bag is your best friend for weekend trips.`
])}

${h2('Making It Memorable')}

${pick([
  `Even with just two days, ${d.n} can leave a lasting impression. Focus on quality over quantity — one deeply experienced moment beats five rushed ones.`,
  `Leave some room for spontaneity in your ${d.n} itinerary. The best weekend memories often come from unplanned discoveries.`
])}

${cta()}`;
      break;
    }
  }

  const date = fmtDate(seed);
  const read = readTime(content);
  const author = pick(AUTHORS);
  const coverImg = getImg(cache, seed, d, template);
  const id = slugify(title);

  return {
    id, title, metaDescription: meta, excerpt,
    coverImage: coverImg, author, date, readTime: read, tags, featured: false, content
  };
}

// ── Main ──
async function main() {
  const cache = await buildImageCache();

  // Stats
  let totalDestImages = 0;
  for (const ids of Object.values(cache.destinations)) totalDestImages += ids.length;
  let totalTmplImages = 0;
  for (const ids of Object.values(cache.templates)) totalTmplImages += ids.length;
  console.log(`📊 Image pool: ${totalDestImages} destination + ${totalTmplImages} template images`);
  console.log(`📊 Unique destinations with images: ${Object.keys(cache.destinations).filter(k => cache.destinations[k].length > 0).length}/${DESTS.length}`);

  // Clean old content
  console.log('🧹 Cleaning old content files...');
  for (const f of fs.readdirSync(CONTENT)) {
    fs.unlinkSync(path.join(CONTENT, f));
  }

  // Generate posts
  console.log('✍️ Generating 1000 blog posts...');
  const posts = [];
  const templates = ['guide','solo','family','couple','budget','luxury','adventure','food','culture','weekend'];
  const usedIds = new Set();

  for (let i = 0; i < 1000; i++) {
    const dest = DESTS[i % DESTS.length];
    const tmpl = templates[i % templates.length];
    const seed = `post-${i}-${dest.n}-${tmpl}`;

    let post = generatePost(cache, seed, dest, tmpl);

    let uniqueId = post.id;
    let suffix = 1;
    while (usedIds.has(uniqueId)) {
      suffix++;
      uniqueId = `${post.id}-${suffix}`;
    }
    usedIds.add(uniqueId);
    post.id = uniqueId;

    posts.push(post);
    fs.writeFileSync(path.join(CONTENT, `${post.id}.json`), JSON.stringify(post, null, 2));
  }

  // Write index.json — slim list view metadata only (no metaDescription, short excerpt)
  const index = posts.map(p => ({
    id: p.id,
    title: p.title,
    excerpt: p.excerpt.length > 80 ? p.excerpt.slice(0, 77).trim() + '…' : p.excerpt,
    coverImage: p.coverImage.replace(/w=800/, 'w=400'),
    author: p.author,
    date: p.date,
    readTime: p.readTime,
    tags: p.tags,
    featured: p.featured,
  }));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));

  // Write sitemap.xml
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${DOMAIN}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${DOMAIN}/blog</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${DOMAIN}/login</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
  <url><loc>${DOMAIN}/trips/create</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
`;

  const originalIds = ['split-group-trip-expenses','weekend-getaways-bengaluru','pre-trip-checklist','group-trip-planner','goa-india','bali-indonesia','santorini-greece','leh-ladakh','dubai-uae','kerala-india'];
  for (const oid of originalIds) {
    sitemap += `  <url><loc>${DOMAIN}/blog/${oid}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
  }
  for (const p of posts) {
    sitemap += `  <url><loc>${DOMAIN}/blog/${p.id}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
  }
  sitemap += '</urlset>';
  fs.writeFileSync(path.resolve('public', 'sitemap.xml'), sitemap);

  // Verify duplicates
  const urlCounts = {};
  for (const p of posts) urlCounts[p.coverImage] = (urlCounts[p.coverImage] || 0) + 1;
  const dups = Object.entries(urlCounts).filter(([u,c]) => c > 1).sort((a,b) => b[1]-a[1]);
  const maxDup = dups.length > 0 ? dups[0][1] : 1;
  const avgDup = Object.values(urlCounts).reduce((a,b) => a+b, 0) / Object.keys(urlCounts).length;

  console.log(`\n✅ Generated ${posts.length} blog posts`);
  console.log(`✅ Written: public/blogs/index.json + ${posts.length} content files`);
  console.log(`✅ Sitemap: public/sitemap.xml (${posts.length + 14} URLs)`);
  console.log(`📊 Unique cover images: ${Object.keys(urlCounts).length}`);
  console.log(`📊 Max duplicate usage: ${maxDup}x`);
  console.log(`📊 Average usage per image: ${avgDup.toFixed(1)}x`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
