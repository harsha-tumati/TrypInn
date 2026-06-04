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
// ── Post generation ──
function generatePost(cache, seed, dest, template) {
  srand(hash(seed));
  const d = dest;
  let title, meta, excerpt, tags;
  let content = '';

  // Helper for narrative paragraphs — avoids bullet lists
  function para(...sentences) {
    return sentences.filter(Boolean).join(' ');
  }

  switch(template) {
    case 'guide': {
      title = `The Complete ${d.n} Travel Guide for 2026`;
      meta = `Plan the ultimate trip to ${d.n} with our 2026 guide. Discover the best attractions, food, neighborhoods, and hidden gems.`;
      excerpt = `${d.n} is a destination that rewards the curious traveler. Beyond the well-known attractions lies a world of hidden gems and unforgettable experiences.`;
      tags = [...d.t, 'Travel Guide'];
      content = para(
        pick([
          `There is a moment in every great trip when you stop being a tourist and start feeling like you belong. In ${d.n}, that moment comes faster than you expect.`,
          `Some destinations surprise you quietly. ${d.n} is one of them — not loud or flashy, but layered with experiences that unfold the longer you stay.`,
          `If you have ever stared at a map and wondered where your next adventure should begin, ${d.n} deserves a long, hard look.`
        ]),
        pick([
          `Maybe it is the way the morning light hits the old streets, or the smell of something incredible drifting from a food stall you would have walked right past.`,
          `Maybe it is the conversation you strike up with a local who points you toward a beach, a viewpoint, or a family-run restaurant that changes how you think about food.`,
          `Maybe it is simply the feeling that here, in this place, the world slows down just enough for you to catch your breath.`
        ]),
        `Whatever draws you in, this guide will help you make the most of it.`
      ) + `\n\n${h2('When to Go')}\n\n` + para(
        pick([
          `Timing your visit to ${d.n} can be the difference between a good trip and an unforgettable one.`,
          `Choosing the right season for ${d.n} is less about perfect weather and more about what kind of experience you want.`
        ]),
        pick([
          `The ${pick(['spring months','summer stretch','autumn season','winter period'])} brings ${pick(['mild temperatures and blooming landscapes','long sunny days perfect for exploring','golden light and thinner crowds','a quieter, more intimate atmosphere'])}.`,
          `If you ask locals, many will tell you that ${pick(['spring','autumn','the shoulder months'])} is when ${d.n} truly shines — the weather is pleasant, the tourist buses have thinned out, and the pace feels more natural.`
        ]),
        pick([
          `Peak season has its perks too — everything is open, the energy is high, and there is a buzz in the air that can be contagious.`,
          `That said, visiting during the quieter months means lower prices, easier restaurant reservations, and a chance to see ${d.n} as the locals do.`
        ]),
        `Weigh the trade-offs, but do not overthink it — ${d.n} has something to offer year-round.`
      ) + `\n\n${h2('What to See and Do')}\n\n` + para(
        `Start with the obvious, then wander off-script.`,
        pick([
          `The ${pick(['iconic landmarks','historic center','famous waterfront','beloved old town'])} is worth every minute you spend there, but do not let it consume your entire itinerary.`,
          `Yes, you should see the sights everyone talks about — they are famous for a reason. But set aside time to get lost, too.`
        ]),
        pick([
          `Some of the best moments in ${d.n} happen when you turn down a street with no plan and find a quiet courtyard, a local cafe, or a view that stops you in your tracks.`,
          `The neighborhoods just outside the main tourist drag often hold the real soul of the city — family shops, street art, and conversations that do not feel rehearsed.`
        ])
      ) + `\n\n` + para(
        pick([
          `For outdoor lovers, ${d.n} delivers in unexpected ways.`,
          `If you are the type who needs nature in your travels, ${d.n} will not disappoint.`
        ]),
        pick([
          `There are ${pick(['hiking trails with views that stretch for miles','coastal walks where the sea crashes against rocky cliffs','parks and gardens that feel worlds away from the city bustle','hidden beaches where you can swim in crystal-clear water'])}.`,
          `The landscape around ${d.n} shifts quickly — one minute you are in a bustling square, the next you are surrounded by ${pick(['green hills and silence','ocean spray and salt air','mountain peaks and fresh pine','rice paddies and the sound of birds'])}.`
        ]),
        `Bring comfortable shoes. You will want to walk more than you planned.`
      ) + `\n\n${imgAlt(`${d.n} landscape`, getImgInline(cache, seed, d, template))}\n\n${h2('The Food Scene')}\n\n` + para(
        `The food in ${d.n} is not just sustenance — it is storytelling on a plate.`,
        pick([
          `Morning markets overflow with produce that looks too beautiful to eat: vibrant fruits, fragrant herbs, and fresh catches still glistening on ice.`,
          `Breakfast here is an event, not a rushed affair. Locals take their time, and after a day or two, you will find yourself doing the same.`
        ]),
        pick([
          `Street vendors serve dishes that have been perfected over generations — recipes passed down, tweaked, and guarded like family heirlooms.`,
          `The street food in ${d.n} does not apologize for being bold. Flavors are loud, textures are varied, and every bite carries the confidence of a cook who has made this dish ten thousand times.`
        ])
      ) + `\n\n` + para(
        pick([
          `For dinner, follow your nose. The restaurants that smell incredible from the sidewalk usually are.`,
          `In the evenings, the dining scene shifts. Small restaurants fill with locals, candles flicker on outdoor tables, and the pace slows to match the mood.`
        ]),
        pick([
          `Do not skip the ${pick(['local wine','regional beer','traditional tea','fresh juice'])} — it is part of the story.`,
          `Ask your server for recommendations. They will steer you toward dishes that never make the English menu, and you will be glad they did.`
        ]),
        `If you can, take a cooking class before you leave. It is the best souvenir you can bring home.`
      ) + `\n\n${h2('Where to Stay')}\n\n` + para(
        pick([
          `Accommodation in ${d.n} ranges from no-frills guesthouses to luxury properties that could double as art museums.`,
          `Where you stay in ${d.n} shapes your experience more than you might expect.`
        ]),
        pick([
          `Boutique hotels in the old town put you within walking distance of everything, but do not overlook the quieter neighborhoods a little further out — they offer more space, lower prices, and a glimpse of real daily life.`,
          `A central location means you can wander back to your room for afternoon breaks, but staying on the outskirts often means better views, more privacy, and unexpected local encounters.`
        ]),
        pick([
          `Homestays are a hidden gem here. You will wake up to home-cooked breakfast, get tips no guidebook offers, and leave feeling like you have family in ${d.n}.`,
          `If you are traveling with friends, a rental apartment can be surprisingly affordable and gives you a kitchen for those market-fresh breakfasts.`
        ])
      ) + `\n\n${h2('A Few Honest Tips')}\n\n` + para(
        `Before you go, a quick reality check.`,
        pick([
          `${d.n} is not perfect — no place is. You will encounter crowds at the famous spots, the occasional overpriced cafe, and days when the weather refuses to cooperate.`,
          `Like any popular destination, ${d.n} has its frustrations. Traffic, language barriers, and the odd tourist trap are part of the package.`
        ]),
        `But the moments in between — the unexpected kindness, the view that takes your breath away, the meal you still dream about months later — those are what stay with you.`
      ) + `\n\n` + para(
        `Pack light, stay flexible, and leave room in your schedule for the unplanned. The best stories rarely come from the itinerary.`,
        `${cta()}`
      );
      break;
    }

    case 'solo': {
      title = `Solo Travel in ${d.n}: A Complete Guide for 2026`;
      meta = `Travel solo to ${d.n} with confidence. Our 2026 guide covers safety, budget tips, and the best experiences for independent travelers.`;
      excerpt = `Solo travel in ${d.n} is an empowering experience. This guide covers everything you need to know to explore independently and confidently.`;
      tags = ['Solo Travel', ...d.t.slice(0,2), 'Tips'];
      content = para(
        pick([
          `The first time you sit down for dinner alone in ${d.n}, you might feel self-conscious. By the third time, you will wonder why you ever traveled any other way.`,
          `There is a particular kind of freedom that comes with solo travel, and ${d.n} is the kind of place that amplifies it.`
        ]),
        pick([
          `No compromises, no waiting for anyone to get ready, no negotiating over where to eat. Just you, your curiosity, and a destination that unfolds at your pace.`,
          `You choose when to wake up, where to wander, and how long to linger at that viewpoint. Every decision is yours, and every mistake is a story.`
        ]),
        pick([
          `Solo travel in ${d.n} is not about being alone — it is about being fully present.`,
          `If you have been considering a solo trip, ${d.n} is a forgiving place to start.`
        ])
      ) + `\n\n${h2(`Why ${d.n} Works for Solo Travelers`)}\n\n` + para(
        pick([
          `${d.n} has a rhythm that suits independent explorers. The infrastructure is solid, locals are generally welcoming, and there is enough variety to keep every day interesting without overwhelming you.`,
          `What makes ${d.n} ideal for solo travelers is the balance it strikes. It is accessible enough that you will never feel stranded, but foreign enough to feel like a real adventure.`
        ]),
        pick([
          `You can spend a morning lost in a museum, an afternoon hiking to a viewpoint, and an evening at a communal dinner table where conversations flow as freely as the drinks.`,
          `One day you might join a group tour to a hard-to-reach spot; the next, you might spend six hours in a single neighborhood, chatting with shopkeepers and sampling everything that smells good.`
        ]),
        pick([
          `The city rewards spontaneity, and when you are traveling alone, spontaneity is your superpower.`,
          `Solo travelers often report that ${d.n} feels safer and more welcoming than they expected. The key is confidence — walk like you know where you are going, even when you do not.`
        ])
      ) + `\n\n${h2('Staying Safe and Connected')}\n\n` + para(
        `Safety is a valid concern, but it should not stop you from going.`,
        pick([
          `${d.n} is generally safe for solo travelers, especially in the main tourist areas. Still, the usual rules apply: stay aware of your surroundings, avoid poorly lit areas late at night, and trust your gut.`,
          `Most visitors to ${d.n} have no issues at all, but a little caution goes a long way. Keep your valuables secure, share your itinerary with someone back home, and do not flash expensive gear.`
        ]),
        pick([
          `A local SIM card or eSIM is worth every penny. Having data means you can navigate, translate, and call for help if needed — and it removes that low-level anxiety of being disconnected.`,
          `Pick up a local SIM at the airport. It is cheap, fast, and having Google Maps in your pocket changes everything.`
        ])
      ) + `\n\n` + para(
        pick([
          `Download offline maps before you head out each day. They work even when your signal does not, and they save you from looking lost — which is when opportunists tend to approach.`,
          `Make copies of your passport and keep them separate from the original. A photo on your phone is good; a physical copy in your day bag is better.`
        ]),
        `Common sense and a little preparation go a long way.`
      ) + `\n\n${imgAlt(`Solo travel in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Making Friends on the Road')}\n\n` + para(
        `One of the biggest myths about solo travel is that you will be lonely. In ${d.n}, the opposite is usually true.`,
        pick([
          `Hostels are obvious social hubs, but you do not need to stay in one to meet people. Walking tours, cooking classes, and shared day trips are natural places to strike up conversations.`,
          `Some of the best connections happen in the most ordinary places — a cafe where you ask someone about their order, a bench where you bond over a shared sunset, a queue where you swap stories with another traveler.`
        ]),
        pick([
          `Locals in ${d.n} are often curious about solo travelers. A simple question about directions can turn into a 20-minute conversation and an invitation you did not see coming.`,
          `Do not be afraid to eat alone. Bring a book, sit at the bar, or simply people-watch. Some of the most memorable evenings happen in your own company.`
        ])
      ) + `\n\n${h2('Budgeting Without Stress')}\n\n` + para(
        `Solo travel does not have to be expensive. In fact, ${d.n} can be surprisingly kind to your wallet if you plan smart.`,
        pick([
          `Street food is your best friend — not just because it is cheap, but because it is often the most authentic food you will find. A $3 meal from a vendor can beat a $30 restaurant plate.`,
          `Markets are goldmines for budget travelers. Fresh fruit, baked goods, and prepared meals cost a fraction of restaurant prices and give you a reason to chat with vendors.`
        ]),
        pick([
          `Many of ${d.n}'s best experiences are free: wandering historic streets, hiking to viewpoints, browsing markets, and watching the world go by from a park bench.`,
          `Free walking tours operate in most major areas. They are tip-based, so you pay what you can afford, and the guides usually know stories you will never find online.`
        ]),
        `Travel in shoulder season, book accommodation early, and do not be afraid to ask locals where they eat. Your bank account will thank you.`
      ) + `\n\n` + para(
        `Solo travel in ${d.n} is not just a trip — it is a reminder of what you are capable of. You will navigate unfamiliar streets, order food in a language you do not speak, and solve problems you did not know you could handle.`,
        `By the end, you will leave with more than photos. You will leave with proof that you can do hard things — and enjoy every minute of them.`,
        `${cta()}`
      );
      break;
    }

    case 'family': {
      title = `Family Travel in ${d.n}: The Ultimate 2026 Guide`;
      meta = `Plan the perfect family trip to ${d.n}. Kid-friendly activities, family accommodations, and tips for stress-free travel with children.`;
      excerpt = `${d.n} is a fantastic destination for families. From kid-friendly attractions to comfortable accommodations, this guide has everything you need.`;
      tags = ['Family Travel', ...d.t.slice(0,2), 'Kids'];
      content = para(
        pick([
          `Family trips are rarely perfect. Someone gets tired, someone else gets hungry, and at some point you will wonder why you thought this was a good idea. But then something magical happens — and ${d.n} is full of those moments.`,
          `Traveling with kids is not a vacation. It is a relocation of your daily chaos to a prettier setting. But ${d.n} makes the chaos worth it.`
        ]),
        pick([
          `Maybe it is your child's face when they see the ocean for the first time, or the way they confidently order their own snack in broken local language. These are the moments you came for.`,
          `The best family memories are rarely planned. They happen in the gaps — the wrong turn that leads to a perfect beach, the rainy afternoon that becomes a board game marathon, the restaurant where the owner insists on teaching your kids a local song.`
        ]),
        `Here is how to make it work without losing your mind.`
      ) + `\n\n${h2('What Kids Will Actually Love')}\n\n` + para(
        pick([
          `Children do not care about museums unless those museums let them touch things, climb on things, or press buttons that make loud noises.`,
          `The secret to happy kids on vacation is simple: give them something to do, not just something to look at.`
        ]),
        pick([
          `In ${d.n}, that is not hard. There are interactive museums where they can dress up in traditional costumes, nature reserves where they can spot wildlife, and beaches where the only agenda is building the biggest sandcastle on the shore.`,
          `${d.n} delivers hands-on experiences that keep kids engaged for hours. Workshops where they can paint, cook, or craft alongside local artisans. Boat rides where dolphins sometimes race the bow. Markets where the colors and smells are an adventure in themselves.`
        ]),
        pick([
          `Older kids and teenagers might roll their eyes at "educational" activities, but even they tend to get quietly absorbed by things like snorkeling, zip-lining, or learning to surf.`,
          `Teenagers will pretend they are unimpressed by everything, but secretly they love the freedom of exploring a new place. Give them a camera and a map, and watch them turn into accidental photographers.`
        ])
      ) + `\n\n${imgAlt(`Family travel in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Where to Stay With Kids')}\n\n` + para(
        `Accommodation can make or break a family trip.`,
        pick([
          `In ${d.n}, apartments and vacation rentals often make more sense than hotels. You get a kitchen for early breakfasts, a living room for evening wind-downs, and separate bedrooms so everyone sleeps better.`,
          `Hotels with pools are an obvious win, but do not underestimate the value of location. Being able to walk back to your room for a midday break saves more sanity than any hotel amenity.`
        ]),
        pick([
          `Look for places near a park or beach — somewhere kids can burn off energy while you sit on a bench with coffee and actually relax for twenty minutes.`,
          `If you do choose a hotel, ask about family rooms, cribs, and kids' menus before you book. Not every property is genuinely family-friendly, even if they claim to be.`
        ]),
        `A little research upfront saves a lot of frustration later.`
      ) + `\n\n${h2('Pacing and Expectations')}\n\n` + para(
        `The biggest mistake families make is trying to do too much.`,
        pick([
          `Kids have limits. After three hours of walking, they are done — and pretending otherwise just leads to meltdowns in public places.`,
          `A packed itinerary looks good on paper but falls apart in real life. Kids need downtime, snack breaks, and the occasional afternoon where nothing is planned at all.`
        ]),
        pick([
          `Build buffer time into every day. Plan one major activity in the morning, leave the afternoon loose, and let the kids help decide what comes next.`,
          `Our rule: one big thing per day, everything else is bonus. Some days the big thing is a castle. Other days it is a really good ice cream shop. Both count.`
        ])
      ) + `\n\n` + para(
        pick([
          `Pack snacks. Always pack snacks. Hungry children are different creatures from fed children, and the transformation is immediate.`,
          `Bring familiar comfort items — a stuffed animal, a favorite book, a tablet loaded with offline games. New places are exciting but also exhausting, and kids need anchors.`
        ]),
        `Most importantly, lower your standards. The photo album will not look like a travel magazine, and that is okay. The messy, chaotic, imperfect moments are the ones you will actually remember.`
      ) + `\n\n` + para(
        `${d.n} will not give you a perfect family vacation — nothing can. But it will give you moments that matter: shared laughter, unexpected discoveries, and the quiet satisfaction of watching your kids become more curious about the world.`,
        `${cta()}`
      );
      break;
    }

    case 'couple': {
      title = `Romantic Getaway to ${d.n}: A Couple's Guide for 2026`;
      meta = `Plan the perfect romantic trip to ${d.n}. Sunset spots, intimate dining, and unforgettable experiences for couples in love.`;
      excerpt = `${d.n} sets the stage for romance like nowhere else. From sunset views to intimate dinners, this guide will help you plan the perfect couple's getaway.`;
      tags = ['Couple Travel', 'Romantic', ...d.t.slice(0,2)];
      content = para(
        pick([
          `There is a reason couples keep coming back to ${d.n}. It is not just the sunsets, though those are hard to beat. It is the way the place seems to slow down time, as if the world agrees that right now, nothing matters except the two of you.`,
          `Romance means different things to different people. For some, it is a candlelit dinner overlooking the water. For others, it is getting gloriously lost together on a mountain trail. ${d.n} somehow manages to offer both.`
        ]),
        pick([
          `Whether you are celebrating something specific or simply escaping the daily grind, ${d.n} provides the backdrop you need.`,
          `This is a place that rewards intention. Show up with someone you love, put your phones away, and let ${d.n} do the rest.`
        ])
      ) + `\n\n${h2('Moments Worth Planning')}\n\n` + para(
        `Some experiences are too good to leave to chance.`,
        pick([
          `Sunset in ${d.n} is not just a time of day — it is an event. Locals and visitors alike pause whatever they are doing to watch the sky turn shades of orange and pink you did not know existed. Find a viewpoint, bring a bottle of wine, and let the evening unfold.`,
          `The golden hour in ${d.n} is something you feel as much as see. The light softens everything — faces, landscapes, conversations. Plan at least one evening around it.`
        ]),
        pick([
          `A private boat trip changes everything. Being on the water, away from the crowds, with nothing but horizon and each other's company — that is the kind of memory that outlasts any souvenir.`,
          `Book one splurge experience. A hot air balloon at dawn, a couples massage with local oils, a private cooking class where you learn to make the dishes you have been eating all week.`
        ])
      ) + `\n\n${imgAlt(`Romantic ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Where Romance Lives')}\n\n` + para(
        pick([
          `The most romantic spots in ${d.n} are not always the obvious ones. Yes, the famous viewpoints and waterfront restaurants are lovely. But sometimes the magic hides in a quiet garden, a hidden courtyard, or a neighborhood cafe where the owner remembers your order.`,
          `Romance in ${d.n} is not about grand gestures. It is about small moments that feel grand because you are sharing them.`
        ]),
        pick([
          `Take a walk through the old streets after dinner, when the day-trippers have gone home and the city belongs to the locals and the lovers. The cobblestones, the warm glow of shop windows, the distant sound of music — it is cinematic in the best way.`,
          `Wake up early one morning and watch the city come alive together. Empty streets, fresh bread smells, the soft clatter of cafes opening their shutters. There is an intimacy to these quiet hours that you can not replicate at midday.`
        ])
      ) + `\n\n${h2('Dining for Two')}\n\n` + para(
        `Food is love in ${d.n}, and the restaurants know it.`,
        pick([
          `Skip the tourist-packed places with picture menus and head where the locals go. The best romantic dinners often happen in unassuming restaurants with handwritten menus and owners who treat you like guests, not customers.`,
          `A memorable meal does not have to be expensive. Some of the most romantic evenings we have had involved plastic stools, street food, and the shared joy of discovering something incredible together.`
        ]),
        pick([
          `If you do want the full fine-dining experience, book well in advance. The best tables in ${d.n} fill up weeks ahead, especially on weekends.`,
          `Consider a progressive dinner: appetizers at one spot, mains at another, dessert somewhere else. It turns the evening into an adventure.`
        ]),
        `Share everything. Order too many dishes. Linger over the last bite. The best meals are the ones where you forget to check the time.`
      ) + `\n\n${h2('Staying Somewhere Special')}\n\n` + para(
        `Where you sleep matters almost as much as what you do.`,
        pick([
          `In ${d.n}, boutique hotels and private rentals offer intimacy that big chains simply can not replicate. A balcony with a view, a clawfoot tub, breakfast delivered to your door — these details turn a trip into a retreat.`,
          `Look for places with character: a restored villa, a treehouse, a room above a family bakery. The story behind your accommodation becomes part of your story.`
        ]),
        pick([
          `If budget allows, splurge on at least one night somewhere extraordinary. The memory of waking up to ${pick(['an ocean view','mountain silence','a garden full of birds','a skyline lit by dawn'])} is worth the cost.`,
          `Even a modest room can feel romantic with the right mindset. Candles, music, a bottle of something local — the atmosphere is what you make it.`
        ])
      ) + `\n\n` + para(
        `${d.n} will not fix a broken relationship, but it will deepen a good one. The shared experiences, the inside jokes, the moments of quiet connection — these are the things that remind you why you chose each other.`,
        `${cta()}`
      );
      break;
    }

    case 'budget': {
      title = `${d.n} on a Budget: The Smart Traveler's 2026 Guide`;
      meta = `Experience ${d.n} without breaking the bank. Budget accommodation, cheap eats, and free activities for the savvy traveler.`;
      excerpt = `${d.n} does not have to be expensive. With the right strategy, you can experience the best of ${d.n} while keeping costs surprisingly low.`;
      tags = ['Budget Travel', ...d.t.slice(0,2), 'Tips'];
      content = para(
        pick([
          `Here is the truth about ${d.n}: it can be shockingly affordable if you know where to look. The trick is avoiding the tourist-priced bubble and slipping into the rhythm of how locals actually live.`,
          `Travel blogs love to talk about luxury experiences, but the real magic of ${d.n} often costs almost nothing.`
        ]),
        pick([
          `Some of the best meals we have had here cost less than a coffee back home. Some of the best days involved nothing but walking, people-watching, and the occasional cheap beer on a sunny plaza.`,
          `The locals do not spend $50 on dinner every night, and neither should you. Follow their lead, and ${d.n} opens up in unexpected ways.`
        ]),
        `This guide is for anyone who wants to experience ${d.n} fully without draining their savings account.`
      ) + `\n\n${h2('Sleeping for Less')}\n\n` + para(
        `Accommodation is usually the biggest expense, but it does not have to be.`,
        pick([
          `Hostels in ${d.n} have evolved. Many now offer private rooms that rival budget hotels in comfort, plus common areas where you can cook your own meals and swap tips with other travelers.`,
          `Guesthouses and homestays are the budget traveler's secret weapon. You get a bed, breakfast, and a local who actually wants to help you experience their city.`
        ]),
        pick([
          `If you are staying more than a few days, look into short-term rentals. Having a kitchen saves an unbelievable amount of money — one home-cooked dinner pays for the price difference.`,
          `Location matters more than luxury. A simple room in the heart of the city beats a fancy resort on the outskirts when you are trying to explore on foot.`
        ]),
        `Book early for the best deals, but do not be afraid to walk into places and negotiate in person. It still works in ${d.n}.`
      ) + `\n\n${imgAlt(`Budget travel in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Eating Well on a Shoestring')}\n\n` + para(
        `The food in ${d.n} is too good to miss, and luckily it is also too cheap to skip.`,
        pick([
          `Morning markets are where the real action is. Vendors sell fresh fruit, pastries, and savory bites that locals grab on their way to work. Follow the longest line — it never lies.`,
          `Street food is not just budget-friendly; it is often the most authentic food in the city. The vendors have been making the same dishes for decades, and they have perfected them.`
        ]),
        pick([
          `Look for the "menu del dia" or local equivalent — a set lunch that includes a starter, main, and drink for a fraction of a la carte prices.`,
          `Supermarkets in ${d.n} are surprisingly fun to explore. Grab bread, cheese, and fruit for a picnic, and you have lunch for under $5 with a view included.`
        ])
      ) + `\n\n` + para(
        `Eat your big meal at lunch. Dinner prices often double for the same food.`,
        `Carry a reusable water bottle. Tap water in ${d.n} is safe to drink, and buying bottled water all day adds up faster than you think.`
      ) + `\n\n${h2('Free and Almost-Free Experiences')}\n\n` + para(
        `The best things in ${d.n} often cost nothing at all.`,
        pick([
          `Walking is the original free activity, and ${d.n} is made for it. Every neighborhood has its own personality, and the only way to truly understand the city is to wander without a destination.`,
          `Public parks and gardens are everywhere, and they are not just for tourists. Locals use them for exercise, picnics, and afternoon naps — and you should too.`
        ]),
        pick([
          `Free walking tours operate daily in most neighborhoods. The guides work for tips, so bring cash and reward the good ones generously.`,
          `Many museums have free entry days or hours. Check online before you go, and plan your cultural fixes around them.`
        ]),
        pick([
          `Markets, street performances, religious ceremonies, local festivals — these are the experiences that make travel meaningful, and they rarely charge admission.`,
          `Beaches, hiking trails, viewpoints, and sunsets are always free. Prioritize them.`
        ])
      ) + `\n\n` + para(
        `Budget travel in ${d.n} is not about deprivation. It is about redirecting your money toward experiences instead of comfort, and discovering that the experiences are usually better anyway.`,
        `${cta()}`
      );
      break;
    }

    case 'luxury': {
      title = `Luxury Travel in ${d.n}: The Ultimate 2026 Experience`;
      meta = `Indulge in the finest experiences ${d.n} has to offer. Luxury hotels, private tours, and exclusive activities for discerning travelers.`;
      excerpt = `${d.n} offers world-class luxury experiences for travelers who demand the very best. From five-star resorts to private excursions, this is luxury travel at its finest.`;
      tags = ['Luxury Travel', ...d.t.slice(0,2), 'Exclusive'];
      content = para(
        pick([
          `There is luxury, and then there is ${d.n}. The kind of place where details matter — where the pillow is already the right temperature, where the staff remembers your name, where every meal feels like a celebration.`,
          `Some people collect stamps. Others collect extraordinary experiences. If you are in the second category, ${d.n} belongs on your list.`
        ]),
        pick([
          `This is not about showing off. It is about removing friction from travel so completely that the only thing left to focus on is the joy of being somewhere beautiful with people you care about.`,
          `Luxury in ${d.n} is not loud or ostentatious. It is quiet, confident, and deeply attuned to what makes a moment memorable.`
        ]),
        `Here is how to do it right.`
      ) + `\n\n${h2('Where to Stay')}\n\n` + para(
        `In ${d.n}, your hotel is not just a place to sleep — it is part of the experience.`,
        pick([
          `The best properties here understand that true luxury is invisible. It is the concierge who secures a table at the restaurant that was "fully booked." It is the housekeeper who notices you prefer extra pillows and leaves them without being asked.`,
          `Boutique hotels in restored heritage buildings offer character that new construction simply cannot replicate. High ceilings, original artwork, and terraces with views that make you late for dinner.`
        ]),
        pick([
          `Private villas take it a step further. Your own pool, your own kitchen, your own staff. The only schedule is the one you create.`,
          `If you prefer resorts, look for properties with a strong sense of place. Generic luxury is forgettable. The places that reflect ${d.n}'s culture and landscape are the ones that stay with you.`
        ])
      ) + `\n\n${imgAlt(`Luxury in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Experiences Worth the Splurge')}\n\n` + para(
        `Money can not buy happiness, but it can buy a helicopter over ${d.n} at sunset — which is pretty close.`,
        pick([
          `Private guided tours are where the magic happens. A knowledgeable guide, a flexible schedule, and access to places the group tours never see. You ask the questions, set the pace, and absorb everything without distraction.`,
          `A private boat charter changes your relationship with ${d.n} entirely. The coastline looks different from the water — quieter, more intimate, more yours.`
        ]),
        pick([
          `Fine dining in ${d.n} is an art form. Multi-course tasting menus, wine pairings chosen by sommeliers who genuinely care, and ingredients so fresh they were probably picked that morning.`,
          `Spa treatments using local ingredients — volcanic stone massages, mineral baths, aromatherapy with native herbs — connect you to the place in a way that sightseeing cannot.`
        ])
      ) + `\n\n${h2('The Details That Matter')}\n\n` + para(
        `Luxury is not one big thing. It is a hundred small things done right.`,
        pick([
          `It is the airport transfer that waits even when your flight is delayed. It is the restaurant that remembers your anniversary and saves your favorite table. It is the guide who brings an umbrella because they checked the weather while you were still asleep.`,
          `In ${d.n}, the best luxury providers anticipate needs you did not know you had. That is the difference between expensive and truly luxurious.`
        ]),
        pick([
          `Do not over-schedule. The whole point of luxury travel is having time — time to linger over breakfast, time to swim instead of sightseeing, time to do nothing and feel good about it.`,
          `Leave gaps in your itinerary. The best luxury moments are often unplanned: an invitation to a private tasting, a conversation with a local artist, an unexpected view from a road you took by mistake.`
        ])
      ) + `\n\n` + para(
        `${d.n} at its most luxurious is not about excess. It is about attention — to you, to the place, to the moment. That is what you are paying for, and that is what you will remember.`,
        `${cta()}`
      );
      break;
    }

    case 'adventure': {
      title = `Adventure Awaits in ${d.n}: The 2026 Thrill-Seeker's Guide`;
      meta = `Push your limits in ${d.n}. From extreme sports to wilderness expeditions, this guide covers the best adventure experiences.`;
      excerpt = `For adrenaline junkies and outdoor enthusiasts, ${d.n} is a playground of epic proportions. This guide reveals the most thrilling adventures waiting for you.`;
      tags = ['Adventure', ...d.t.slice(0,2), 'Outdoor'];
      content = para(
        pick([
          `Your comfort zone is a nice place, but nothing grows there. ${d.n} is the antidote — a place that demands you show up fully, lean into the unknown, and discover what you are actually capable of.`,
          `Some people travel to relax. Others travel to feel alive. If you are in the second camp, ${d.n} is calling your name.`
        ]),
        pick([
          `The landscape here does not do gentle. It does dramatic. Towering peaks, rushing rivers, vast wilderness — ${d.n} was built for people who want to earn their views.`,
          `Adventure in ${d.n} is not a marketing slogan. It is a requirement. The terrain demands effort, and the reward is a kind of clarity you can not find in a spa.`
        ]),
        `Strap in. This is going to be unforgettable.`
      ) + `\n\n${h2('The Thrill Factor')}\n\n` + para(
        pick([
          `If your idea of a good time involves heart-pounding moments and stories that make your friends nervous, ${d.n} delivers.`,
          `For those who measure a trip by their pulse, ${d.n} is paradise.`
        ]),
        pick([
          `Imagine standing at the edge of a platform, the wind in your face, nothing but air between you and the ground below. Bungee jumping here is not just an activity — it is a conversation with gravity.`,
          `White-water rafting on ${d.n}'s rivers is controlled chaos. The water is cold, the rapids are loud, and the teamwork required to navigate them creates bonds faster than any icebreaker.`
        ]),
        pick([
          `Paragliding gives you a perspective that changes everything. From above, ${d.n} reveals patterns and scale that are invisible from the trail. You land with dirt on your shoes and a grin you can not wipe off.`,
          `Rock climbing here ranges from beginner-friendly to genuinely terrifying. The routes are well-maintained, the scenery is distracting in the best way, and the sense of accomplishment at the top is addictive.`
        ])
      ) + `\n\n${imgAlt(`Adventure in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Into the Wild')}\n\n` + para(
        `Not all adventure requires an adrenaline spike. Sometimes it is just you, a trail, and the sound of your own breathing.`,
        pick([
          `${d.n}'s backcountry is where the real magic lives. Multi-day treks take you through landscapes that look untouched — valleys where the only footprints are yours, ridges where eagles circle below you, campsites where the stars feel close enough to touch.`,
          `The wilderness around ${d.n} does not coddle you. Weather changes fast, trails can be challenging, and help is not always nearby. That is exactly why it is worth it.`
        ]),
        pick([
          `Wildlife encounters here are raw and real. Not zoo animals behind glass, but creatures in their element — curious, wild, and completely indifferent to your presence.`,
          `Caving expeditions reveal underground worlds that feel like another planet. Stalactites drip with mineral water, underground rivers carve tunnels through ancient rock, and the silence is so complete you can hear your own heartbeat.`
        ])
      ) + `\n\n${h2('Water Adventures')}\n\n` + para(
        `If ${d.n} has a coastline or rivers — and it does — the water is part of the adventure.`,
        pick([
          `Scuba diving reveals an entirely different ${d.n}. Coral gardens, shipwrecks, and marine life that moves in synchronized patterns. The silence underwater is meditative, broken only by the sound of your own breath.`,
          `Surfing here attracts both beginners and pros. The breaks are consistent, the water is clear, and the local surf community is welcoming to anyone willing to paddle out.`
        ]),
        pick([
          `Kayaking along the coast lets you access beaches and coves that no road reaches. Pack lunch, bring sunscreen, and let the current do some of the work.`,
          `Snorkeling requires no certification and offers instant rewards. Within minutes of entering the water, you are surrounded by fish in colors that seem impossible.`
        ]),
        `Water has a way of washing away stress. After a day on or in it, you will sleep harder and dream bigger.`
      ) + `\n\n${h2('Before You Go')}\n\n` + para(
        `Adventure travel requires preparation, not fear.`,
        pick([
          `Research your operators carefully. The best companies in ${d.n} prioritize safety, employ certified guides, and maintain equipment rigorously. Cheap is not always safe, and safe is not always expensive.`,
          `Get travel insurance that covers adventure activities. Standard policies often exclude extreme sports, and a hospital bill in a foreign country is not the kind of surprise anyone wants.`
        ]),
        pick([
          `Train before you arrive. You do not need to be an athlete, but a basic fitness level makes everything more enjoyable and safer.`,
          `Pack layers, not bulk. Weather in adventure destinations changes fast, and being able to add or remove clothing quickly is essential.`
        ]),
        `Most importantly, listen to your guides. They know the terrain, the conditions, and the risks. Their job is to get you home with great stories and all your limbs intact.`
      ) + `\n\n` + para(
        `${d.n} will challenge you. It will push you past what you thought were your limits. And when you come out the other side — tired, dirty, and grinning — you will understand why people get addicted to adventure.`,
        `${cta()}`
      );
      break;
    }

    case 'food': {
      title = `Culinary Journey Through ${d.n}: A Food Lover's 2026 Guide`;
      meta = `Taste the best of ${d.n}. From street food to fine dining, this guide covers the culinary highlights every foodie must experience.`;
      excerpt = `${d.n} is a food lover's paradise. The flavors, aromas, and textures of ${d.c}'s cuisine will take you on an unforgettable culinary journey.`;
      tags = ['Food Travel', ...d.t.slice(0,2), 'Culinary'];
      content = para(
        pick([
          `The first thing you notice about ${d.n} is the smell. Not traffic or concrete — though there is some of that — but something alive and aromatic drifting from a nearby kitchen, market, or street cart. It stops you in your tracks. You follow it. And that is how the journey begins.`,
          `If you believe that the best way to understand a place is through its food, ${d.n} will be your favorite classroom.`
        ]),
        pick([
          `Eating in ${d.n} is not just about fuel. It is about history, geography, family, and tradition — all served on a plate, often for less than the cost of a taxi ride.`,
          `The cuisine here tells the story of the land: what grows in the soil, what swims in the water, what traders brought centuries ago, and what grandmothers refused to let disappear.`
        ]),
        `Come hungry. Leave obsessed.`
      ) + `\n\n${h2('The Dishes You Cannot Miss')}\n\n` + para(
        `Every destination has its signature bites, and ${d.n} is no exception.`,
        pick([
          `Start with the street food. The vendors here are not amateurs — many have been perfecting a single dish for decades. Watch them work: the practiced hand movements, the instinctive seasoning, the way they know exactly when something is ready without looking at a clock.`,
          `The markets are where the real education happens. Piles of produce in colors you did not know existed, cuts of meat hanging from hooks, barrels of pickles fermenting in the corner. Ask questions. Sample everything.`
        ]),
        pick([
          `Then there are the classics — the dishes that locals grew up with and tourists pilgrimage for. They are famous for a reason, but do not stop there. The best meals often hide on side streets, in unmarked restaurants, or at family tables you are lucky enough to be invited to.`,
          `Look for the restaurants with no English menu. That is where the real food lives. Point, smile, and trust the process.`
        ])
      ) + `\n\n${imgAlt(`Food in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Dining Experiences')}\n\n` + para(
        `Food in ${d.n} is not just about what you eat — it is about where and how you eat it.`,
        pick([
          `Night markets are sensory overload in the best way. Sizzling grills, clouds of steam, vendors calling out their specialties, and the constant movement of people eating, shopping, and socializing. You do not just eat at a night market — you participate in it.`,
          `Cooking classes here are worth every minute. Not the touristy ones where you decorate a plate for Instagram, but the real ones where you pound curry paste until your arm aches and learn why timing matters more than technique.`
        ]),
        pick([
          `Fine dining in ${d.n} has entered a golden age. Young chefs are reimagining traditional dishes with modern techniques, sourcing ingredients from local farms, and creating tasting menus that tell the story of the region in twelve courses.`,
          `Farm-to-table is not a trend here — it is how things have always been done. The best restaurants source their ingredients from nearby farms and fisheries, and the freshness is undeniable.`
        ])
      ) + `\n\n${h2('Eating Like a Local')}\n\n` + para(
        `The secret to eating well in ${d.n} is simple: watch where the locals go, and follow them.`,
        pick([
          `If a place is packed at noon with office workers in a hurry, the food is good and the price is fair. If it is empty at 7 PM when everything else is full, there is a reason. Trust the crowds.`,
          `Eat breakfast where taxi drivers eat. Eat dinner where families with kids eat. These are the places that survive on repeat customers, not tourists who will never come back.`
        ]),
        pick([
          `Learn the local dining customs. In some places, sharing is expected. In others, finishing your plate is a compliment. A little cultural awareness goes a long way and often earns you better treatment.`,
          `Do not rush. Meals in ${d.n} are social events, not refueling stops. Sit down, order slowly, and let the evening unfold.`
        ]),
        `And when someone offers you something you have never tried before — say yes. The worst-case scenario is a story. The best-case scenario is a new favorite.`
      ) + `\n\n` + para(
        `By the end of your trip, you will have a new understanding of what food can be. Not just sustenance, but connection — to a place, to its people, to centuries of tradition that somehow end up on your plate.`,
        `${cta()}`
      );
      break;
    }

    case 'culture': {
      title = `Cultural Immersion in ${d.n}: A Traveler's 2026 Guide`;
      meta = `Dive deep into the culture of ${d.n}. Festivals, traditions, art, and history — this guide connects you with the soul of ${d.c}.`;
      excerpt = `${d.n} is a cultural treasure trove. From ancient traditions to contemporary art, every corner tells a story of ${d.c}'s rich heritage.`;
      tags = ['Culture', ...d.t.slice(0,2), 'Heritage'];
      content = para(
        pick([
          `Culture is not something you watch in ${d.n}. It is something you walk through, breathe in, and accidentally become part of. It is the old man playing chess in the park at dawn. It is the group of women in traditional dress heading to church. It is the sound of a language you do not speak being argued, sung, and whispered all around you.`,
          `The most powerful travel experiences do not happen at monuments. They happen in the spaces between monuments — in conversations, in rituals, in the daily rhythms of a place that has been living its own life long before you arrived.`
        ]),
        pick([
          `${d.n} rewards the culturally curious. Not the ones who tick boxes, but the ones who slow down, pay attention, and allow themselves to be changed by what they see.`,
          `If you want to understand ${d.n}, do not start with the guidebook. Start with the people.`
        ]),
        `Here is how to do it with respect and genuine curiosity.`
      ) + `\n\n${h2('Living History')}\n\n` + para(
        `The past in ${d.n} is not behind glass. It is alive.`,
        pick([
          `Walk through the old quarter and you will see buildings that have stood for centuries, their walls weathered by storms and wars and the slow passage of time. Some have been restored; others lean gently into the future, refusing to be replaced.`,
          `The historical sites here are not just monuments — they are part of the ongoing story. Temples still host ceremonies. Palaces still echo with footsteps. The past is not preserved; it is participated in.`
        ]),
        pick([
          `Museums in ${d.n} range from grand national institutions to tiny private collections run by passionate locals. Both have value. The big ones give you context; the small ones give you stories.`,
          `Do not skip the religious sites, even if you are not religious. The architecture, the art, the atmosphere of devotion — these transcend belief and speak to something universal.`
        ]),
        `Hire local guides when you can. They do not just explain what you are looking at — they explain why it matters.`
      ) + `\n\n${imgAlt(`Culture in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Traditions in Motion')}\n\n` + para(
        `The best way to experience culture is to catch it in action.`,
        pick([
          `Festivals in ${d.n} are not tourist attractions — they are communal expressions of identity, faith, and joy. The music, the costumes, the food, the dancing — everything means something, and everything connects to something older than memory.`,
          `Markets are cultural crossroads. Farmers, artisans, cooks, and shoppers converge in spaces that have served this function for generations. The banter, the bargaining, the shared meals — this is culture in its most democratic form.`
        ]),
        pick([
          `Traditional crafts are not souvenirs — they are survival. The weaver, the potter, the woodworker — these are people keeping skills alive that would otherwise disappear. Buying their work is not charity; it is investment.`,
          `Music and dance in ${d.n} are not performances for visitors. They are living traditions that young people still learn, still practice, still care about. Find a local venue and watch something authentic.`
        ])
      ) + `\n\n${h2('The Modern Side')}\n\n` + para(
        `Culture is not only about preservation. It is also about creation.`,
        pick([
          `${d.n} has a thriving contemporary art scene that speaks to the present while honoring the past. Galleries showcase work that challenges, provokes, and sometimes confuses — which is exactly what good art should do.`,
          `Street art in ${d.n} tells stories that the official narratives miss. Political commentary, personal expression, humor, and beauty — all painted on walls that belong to everyone.`
        ]),
        pick([
          `The design and fashion scenes here are increasingly influential. Young creators are blending traditional techniques with modern aesthetics, producing work that feels both rooted and revolutionary.`,
          `Food culture in ${d.n} is evolving too. Traditional dishes are being reinterpreted by chefs who respect the past but are not imprisoned by it. The result is a cuisine that feels alive.`
        ]),
        `Old and new are not opposites here. They are in conversation.`
      ) + `\n\n${h2('Traveling Respectfully')}\n\n` + para(
        `With cultural immersion comes responsibility.`,
        pick([
          `Learn a few phrases in the local language. Not just "hello" and "thank you" — though those matter — but enough to show that you are making an effort. People notice, and they appreciate it.`,
          `Dress appropriately for religious and traditional sites. When in doubt, cover your shoulders and knees. It is a small gesture of respect that opens doors.`
        ]),
        pick([
          `Ask permission before photographing people. Some will say yes enthusiastically; others will prefer not to. Both responses deserve respect.`,
          `Listen more than you speak. You are a guest in a story that started long before you arrived and will continue long after you leave.`
        ]),
        `The goal is not to consume culture. It is to participate in it, however briefly and humbly.`
      ) + `\n\n` + para(
        `${d.n} will not give you its culture all at once. It reveals itself slowly, in fragments, to those who pay attention. Stay open, stay curious, and let the place teach you.`,
        `${cta()}`
      );
      break;
    }

    case 'weekend': {
      title = `Weekend Escape to ${d.n}: Your 2026 Guide`;
      meta = `Make the most of a weekend in ${d.n}. The perfect two-day itinerary with must-see sights, great food, and memorable experiences.`;
      excerpt = `Short on time? ${d.n} is the perfect weekend destination. This guide shows you how to pack the best experiences into just two days.`;
      tags = ['Weekend Getaway', ...d.t.slice(0,2), 'Itinerary'];
      content = para(
        pick([
          `Forty-eight hours is not long. But in ${d.n}, it can be enough — if you use it wisely.`,
          `Not every trip needs to be two weeks long. Sometimes the best escapes are the short ones, the ones that feel stolen from real life.`
        ]),
        pick([
          `A weekend in ${d.n} is like a perfectly edited film: no wasted scenes, no slow moments, just the highlights compressed into something that leaves you satisfied and slightly breathless.`,
          `The key to a great weekend trip is intention. You do not have time to see everything, so you choose carefully. You prioritize experiences over checklists.`
        ]),
        `Here is how to make every hour count.`
      ) + `\n\n${h2('Saturday: First Impressions')}\n\n` + para(
        `Start early. The morning belongs to you before the crowds wake up.`,
        pick([
          `Drop your bags and head straight for the ${pick(['old town','waterfront','main square','historic district'])}. The light is soft, the streets are quiet, and you get to see ${d.n} before it puts on its show for the day-trippers.`,
          `Your first walk through ${d.n} should be aimless. No map, no agenda, just curiosity. Turn down streets that look interesting. Pop into shops that smell good.`
        ]),
        pick([
          `By mid-morning, you are ready for coffee. Find a cafe with outdoor seating, order whatever the locals are drinking, and watch the city wake up around you. This is not wasted time — it is orientation.`,
          `Breakfast in ${d.n} is worth prioritizing. Not a rushed hotel buffet, but a proper local meal. Pastries, eggs, something savory — whatever the tradition is here, embrace it.`
        ])
      ) + `\n\n` + para(
        pick([
          `Spend the afternoon at the one attraction you would regret missing. Not the most famous one — the one that genuinely excites you. A museum, a viewpoint, a neighborhood that speaks to your interests. Give it two hours of focused attention.`,
          `The afternoon is for your must-see. Whatever drew you to ${d.n} in the first place — prioritize it now, while your energy is high.`
        ]),
        pick([
          `Dinner on your first night should set the tone. Choose a restaurant with atmosphere — candles, local music, food that makes you close your eyes on the first bite. You are only here for two nights. Make both memorable.`,
          `Saturday evening in ${d.n} is for immersion. Find a restaurant where the menu is not in English, point at what looks good, and trust the kitchen.`
        ])
      ) + `\n\n${imgAlt(`Weekend in ${d.n}`, getImgInline(cache, seed, d, template))}\n\n${h2('Sunday: Depth and Departure')}\n\n` + para(
        `Sunday morning is for depth.`,
        pick([
          `Sleep in if you need to, but try to catch the early hours at least once. The city has a different personality before 9 AM — softer, more honest, less performative.`,
          `Start with a walk. No destination, just movement. Sunday mornings in ${d.n} have a particular energy — slower, more local, more real.`
        ]),
        pick([
          `Visit a market. Not the tourist market — the real one where locals buy their groceries. The produce, the conversations, the everyday commerce — this is where you see ${d.n} unfiltered.`,
          `Find a park or garden and sit for a while. Watch families, dogs, old men reading newspapers. This is the ${d.n} that exists when no one is performing.`
        ])
      ) + `\n\n` + para(
        pick([
          `Your final meal should be something you can not get at home. Order the local specialty, the dish this place is known for, the thing you will think about on the plane home.`,
          `Before you leave, buy one thing. Not a souvenir — something useful or edible. A spice, a piece of pottery, a bottle of local wine. Something that will remind you of this weekend when you use it back home.`
        ]),
        `Leave a little early for the airport or station. Not because you need to, but because rushing on your last day ruins the memory.`
      ) + `\n\n${h2('The Weekend Mindset')}\n\n` + para(
        `The secret to a great weekend trip is not cramming more in. It is caring less about seeing everything and more about experiencing something.`,
        pick([
          `You will miss things. That is the deal. But the things you do see, the meals you share, the walks you take — those will be vivid and complete because you were fully present for them.`,
          `Two days is short, but it is also forgiving. There is no time for boredom, no room for filler. Every moment matters, which is exactly how travel should feel.`
        ]),
        pick([
          `${d.n} does not require a week to love. It just requires an open mind and a willingness to show up.`,
          `Weekend trips prove that you do not need endless time to have a meaningful escape. You just need a destination worth your attention — and ${d.n} absolutely is.`
        ])
      ) + `\n\n` + para(
        `Go home tired, happy, and already planning your return.`,
        `${cta()}`
      );
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
  <url><loc>${DOMAIN}/travel-guides</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>${DOMAIN}/login</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>
  <url><loc>${DOMAIN}/trips/create</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
`;

  const originalIds = ['split-group-trip-expenses','weekend-getaways-bengaluru','pre-trip-checklist','group-trip-planner','goa-india','bali-indonesia','santorini-greece','leh-ladakh','dubai-uae','kerala-india'];
  for (const oid of originalIds) {
    sitemap += `  <url><loc>${DOMAIN}/travel-guides/${oid}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
  }
  for (const p of posts) {
    sitemap += `  <url><loc>${DOMAIN}/travel-guides/${p.id}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
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
