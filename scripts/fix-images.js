import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/must-visits');

async function fetchImages(query, perPage = 3) {
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

async function fixDestination(file) {
    if (file === 'index.json') return;
    const filePath = path.join(OUT_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Fixing images for ${data.name}...`);
    
    const destImages = await fetchImages(`${data.name} India`, 10);
    const fallbackIds = destImages.length > 0 ? destImages : ['1524492412937-b28074a5d7da'];
    
    let updated = false;
    for (let i = 0; i < data.attractions.length; i++) {
        const attr = data.attractions[i];
        
        // Let's only fetch if the image is a Taj Mahal image or if the user wants PERFECT alignment.
        // The user said they want images PERFECTLY ALIGNED to the name. So we MUST fetch for all.
        const attrImages = await fetchImages(`${attr.name} ${data.name} India`, 3);
        if (attrImages.length > 0) {
            attr.coverImage = makeImgUrl(attrImages[0], 800);
        } else {
            attr.coverImage = makeImgUrl(fallbackIds[Math.floor(Math.random() * fallbackIds.length)], 800);
        }
        updated = true;
        await new Promise(r => setTimeout(r, 400)); // 400ms delay to respect Unsplash rate limits somewhat
    }
    
    if (updated) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
}

async function main() {
    const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');
    // We already did pondicherry, so let's skip it
    for (const file of files) {
        if (file === 'pondicherry.json') continue;
        await fixDestination(file);
    }
    console.log('Finished fixing all destinations!');
}

main();
