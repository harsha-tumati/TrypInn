#!/usr/bin/env node
/**
 * Generate Must-Visits Data for 100 Indian Destinations
 * Uses OpenAI to generate SEO-optimized content and Unsplash for images.
 */
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const openai = new OpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });
const OUT_DIR = path.resolve(__dirname, '../public/must-visits');

fs.mkdirSync(OUT_DIR, { recursive: true });

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const DESTINATIONS = [
    'Goa', 'Leh-Ladakh', 'Manali', 'Kashmir', 'Jaipur', 'Udaipur', 'Taj Mahal', 'Rishikesh', 'Varanasi', 'Kerala Backwaters',
    'Andaman Islands', 'Darjeeling', 'Munnar', 'Coorg', 'Jaisalmer', 'Amritsar', 'Hampi', 'Meghalaya', 'Spiti Valley', 'Rann of Kutch',
    'Shimla', 'Ooty', 'Nainital', 'Mussoorie', 'Gangtok', 'Pondicherry', 'Hyderabad', 'Mysuru', 'Chikmagalur', 'Dharamshala',
    'Kodaikanal', 'Tirupati', 'Puri', 'Madurai', 'Agra', 'Delhi', 'Jodhpur', 'Pushkar', 'Auli', 'Kovalam',
    'Wayanad', 'Gokarna', 'Varkala', 'Shillong', 'Cherrapunji', 'Tawang', 'Kasol', 'Dalhousie', 'Haridwar', 'Ayodhya',
    'Rameswaram', 'Mahabalipuram', 'Thanjavur', 'Bikaner', 'Mount Abu', 'Alleppey', 'Thekkady', 'Kumarakom', 'Yercaud', 'Diu',
    'Ziro', 'Mawlynnong', 'Nubra Valley', 'Pangong Lake', 'Yumthang Valley', 'Pelling', 'Dzukou Valley', 'Orchha', 'Khajuraho', 'Sanchi',
    'Bhopal', 'Ujjain', 'Indore', 'Bhubaneswar', 'Konark', 'Gulmarg', 'Sonamarg', 'Pahalgam', 'Srinagar', 'Patnitop',
    'Jim Corbett National Park', 'Ranthambore National Park', 'Kaziranga National Park', 'Gir National Park', 'Kanha National Park', 'Bandhavgarh National Park', 'Periyar National Park', 'Nagarhole National Park', 'Majuli', 'Tarkarli',
    'Lonar', 'Lonavala', 'Mahabaleshwar', 'Aurangabad', 'Ajanta Caves', 'Ellora Caves', 'Kutch', 'Dwarka', 'Somnath', 'Daman'
];

async function fetchImages(query, perPage = 30) {
    const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}`;
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) return [];
        const data = await res.json();
        const ids = [];
        for (const r of data.results) {
            if (r.plus || r.premium) continue;
            const raw = r.urls?.raw || '';
            if (raw.includes('plus.unsplash.com')) continue;
            const m = raw.match(/photo-([a-f0-9-]+)/);
            if (m && m[1]) ids.push(m[1]);
        }
        return [...new Set(ids)];
    } catch (e) {
        return [];
    }
}

function makeImgUrl(id, w = 800) {
    return `https://images.unsplash.com/photo-${id}?fm=webp&w=${w}&q=60`;
}

async function generateDestination(destName) {
    console.log(`\n⏳ Generating content for ${destName}...`);
    const slug = slugify(destName);
    const outFile = path.join(OUT_DIR, `${slug}.json`);

    if (fs.existsSync(outFile)) {
        console.log(`✅ Skipped ${destName} (already exists)`);
        return JSON.parse(fs.readFileSync(outFile, 'utf8'));
    }

    const prompt = `
You are an expert travel content creator, SEO specialist, and UX writer.
Generate a comprehensive Must-Visit Discovery Guide for: ${destName}.

Goal: Create the most useful page on the internet for travelers searching:
- must visit places in ${destName}
- top attractions in ${destName}
- best places to visit in ${destName}
- tourist places in ${destName}
- things to do in ${destName}

REQUIREMENTS:
1. "state": The Indian state or union territory this destination belongs to.
2. "tagline": A catchy 5-10 word marketing tagline for the destination.
3. "introduction": 150-250 words SEO-optimized intro naturally containing the exact phrases:
   "must visit places in ${destName}", "best places to visit in ${destName}", "tourist attractions in ${destName}", "things to do in ${destName}", "travel guide to ${destName}".
4. "metaTitle": SEO optimized title (e.g., "25 Must Visit Places in [Dest] (2026) — Top Attractions | Trypinn")
5. "metaDescription": 150 character SEO description.
6. "categories": Array of top 3 string categories applying to this destination (e.g. ["beach", "heritage", "nightlife"]). Pick from: beach, mountain, heritage, spiritual, adventure, nature, wildlife, hill_station, city, desert, island, backwater, lake, historical, pilgrimage.
7. "attractions": Exactly 25 distinct places to visit in this destination, ordered by popularity (most popular first, ending with hidden gems).

ATTRACTION SCHEMA:
- name: Attraction name
- description: 40-80 words engaging description
- whyVisit: 1 short sentence why it's special
- bestTime: Optimal time/season/time of day to visit
- duration: Recommended duration (e.g., "2-3 hours")
- mapsSearch: Exact string to search on Google Maps (e.g., "Baga Beach, North Goa, India")
- category: One category from: beach, temple, fort, nature, heritage, adventure, lake, waterfall, museum, park, market, viewpoint, religious, cave, wildlife, garden, palace, island, monastery, glacier, desert, nightlife.
- imagePrompt: Vibrant professional travel photography prompt for this attraction (Format: "Ultra realistic travel photography, golden hour lighting, vibrant colors, [landmark], tourists enjoying the view, DSLR quality, 4k, cinematic composition, highly detailed")

Return ONLY valid raw JSON matching this structure exactly.
`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }]
        });

        const data = JSON.parse(completion.choices[0].message.content);
        data.slug = slug;
        data.name = destName;

        // Fetch images
        const destImages = await fetchImages(`${destName} India`, 10);
        data.coverImage = destImages.length > 0 ? makeImgUrl(destImages[0], 1200) : 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?fm=webp&w=1200&q=60';

        let imgIndex = 0;
        const allAttractionImages = await fetchImages(`tourist attractions ${destName} India`, 30);
        
        for (let i = 0; i < data.attractions.length; i++) {
            data.attractions[i].slug = slugify(data.attractions[i].name);
            data.attractions[i].position = i + 1;
            
            // Assign a unique real image from unsplash (fallback to destination generic if we run out)
            if (imgIndex < allAttractionImages.length) {
                data.attractions[i].coverImage = makeImgUrl(allAttractionImages[imgIndex], 800);
                imgIndex++;
            } else {
                data.attractions[i].coverImage = makeImgUrl(allAttractionImages[Math.floor(Math.random() * allAttractionImages.length)], 800);
            }
        }

        fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
        console.log(`✅ Saved ${destName} (${data.attractions.length} attractions)`);
        
        return data;
    } catch (err) {
        console.error(`❌ Failed to generate ${destName}:`, err.message);
        return null;
    }
}

async function main() {
    console.log(`🚀 Starting Must-Visits Generation (${DESTINATIONS.length} destinations)...`);
    const indexData = [];

    // Process sequentially to respect rate limits
    for (const dest of DESTINATIONS) {
        const data = await generateDestination(dest);
        if (data) {
            indexData.push({
                slug: data.slug,
                name: data.name,
                state: data.state,
                tagline: data.tagline,
                coverImage: data.coverImage,
                attractionCount: data.attractions.length,
                categories: data.categories
            });
        }
        await new Promise(r => setTimeout(r, 1000)); // Sleep between requests
    }

    fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(indexData, null, 2));
    console.log(`\n🎉 Finished! Saved index.json with ${indexData.length} destinations.`);
}

main();
