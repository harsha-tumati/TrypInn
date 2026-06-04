#!/usr/bin/env node
/**
 * Fast generator for 100 Must-Visits destination JSON files
 * Uses compact data + templates for efficiency
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/must-visits');
fs.mkdirSync(OUT_DIR, { recursive: true });

function slugify(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const UNSPLASH_IDS = [
    '1512343879784-a960bf40e7f2','1477587458883-47145ed94245','1626621341517-bbf3d9990a23',
    '1507525428034-b723cf961d3e','1476514525535-07fb3b4ae5f1','1524492412937-b28074a5d7da',
    '1469854523086-cc02fe5d8800','1501785888041-af3ef285b470','1506929562872-bb421503ef21',
    '1504150558240-1defce0f4ce0','1537996194471-e657df975ab4','1508672019048-805c876b67e2',
    '1436491865332-7a61a109cc05','1488085061387-422e29b40080','1500835556837-99ac94a94552',
    '1454391304352-2bf4678b1a7a','1518509562904-e7ef99cdcc86','1512453979798-5ea266f8880c',
    '1613395877344-13d4a8e0d49e','1526772662000-3f88f10405ff','1602216056096-3b40cc0c9944',
    '1493246507139-91e8fad9978e','1504280390367-c479b9be15ae','1530789253388-582c481c54b0',
    '1561361513-9e9f6e2e4e9e','1548013146-7b0b8c9e5a6f','1555993539-173e54f2821f',
    '1516483638261-f4dbaf036963','1528127260108-a3aef7f22f7a','1564507592033-7e4f13a7e7b6',
    '1570077188670-e3a8d69ac5ff','1494783365793-7a0b0e1a8b9e','1506744038136-46273834b3fb',
    '1518544861688-e7d33b8f7e1c','1520250497591-112c4f5e3e5e','1534234828563-022d27c3f2d5',
    '1504198458649-3128b932f49e','1562569633-944b482d2ca8','1516939884455-1445c4b8d6bf',
    '1571896349782-68c9c0c0e2a3','1544644181-7e7e4c0e5d6b','1504384308090-c54be3855835',
    '1534008897995-d0e4b4e5e6e7','1570053903894-4e0e4e4e4e4e','1526772662000-3f88f10405ff'
];

function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function makeImgUrl(seed, w = 800) {
    const id = UNSPLASH_IDS[hashString(seed) % UNSPLASH_IDS.length];
    return `https://images.unsplash.com/photo-${id}?fm=webp&w=${w}&q=60`;
}

function makeImagePrompt(attraction, destination) {
    return `Ultra realistic travel photography, golden hour lighting, vibrant colors, ${attraction} in ${destination}, tourists enjoying the view, DSLR quality, 4k, cinematic composition, highly detailed`;
}

function makeIntro(name, state, highlights) {
    return `When travelers search for must visit places in ${name}, they discover a destination that truly rewards curiosity. The best places to visit in ${name} span from ${highlights[0]} to ${highlights[1]}. As one of the top tourist attractions in ${name}, each spot tells a unique story of ${state}'s rich heritage. Whether you are looking for things to do in ${name} over a weekend or planning a longer escape, this travel guide to ${name} covers every must-see experience. From iconic landmarks to hidden corners, these curated picks ensure you experience the very best of ${name}.`;
}

// ── Compact destination definitions ──
// Each: [name, state, tagline, [categories], [highlight1, highlight2], [attractions...]]
// Attraction: [name, category, description, whyVisit, bestTime, duration, mapsSuffix]

const DESTINATIONS = [];

function D(name, state, tagline, cats, highlights, attrs) {
    DESTINATIONS.push({ name, state, tagline, categories: cats, highlights, attrs });
}

// Helper to expand compact attraction data
function A(name, cat, desc, why, time, duration, mapsSuffix) {
    return { name, category: cat, description: desc, whyVisit: why, bestTime: time, duration, mapsSuffix };
}

// 1. GOA
D('Goa', 'Goa', 'Sun, sand, and Portuguese heritage on India\'s western coast',
    ['beach', 'heritage', 'nightlife'], ['golden beaches', 'historic churches'],
    [
        A('Baga Beach', 'beach', 'The beating heart of Goa\'s nightlife, Baga Beach offers a lively stretch of golden sand lined with beach shacks, water sports vendors, and bustling nightspots. By day, jet skis and parasailing fill the horizon; by night, the shoreline transforms into a party zone.', 'Perfect mix of water sports, beach shacks, and vibrant nightlife.', 'Late afternoon to late evening', '3-4 hours', 'Baga Beach, North Goa, India'),
        A('Basilica of Bom Jesus', 'heritage', 'A UNESCO World Heritage Site, this 16th-century basilica houses the mortal remains of St. Francis Xavier. Its Baroque architecture, intricate woodwork, and gilded altars make it one of India\'s finest churches.', 'Stunning architecture and deep spiritual significance.', 'Morning', '1-2 hours', 'Basilica of Bom Jesus, Old Goa, India'),
        A('Dudhsagar Waterfalls', 'waterfall', 'One of India\'s tallest waterfalls, Dudhsagar cascades down a rocky mountainside in milky white torrents. Accessible via a scenic jeep trek through the Western Ghats, it is a raw nature experience.', 'Breathtaking natural wonder surrounded by lush jungle.', 'Monsoon or early winter', '5-6 hours', 'Dudhsagar Waterfalls, Goa, India'),
        A('Anjuna Flea Market', 'market', 'Every Wednesday, Anjuna Beach hosts Goa\'s most famous flea market. Vendors sell everything from Tibetan jewelry and Kashmiri carpets to hippie clothing and local handicrafts.', 'Unique shopping experience with global and local treasures.', 'Wednesday morning', '2-3 hours', 'Anjuna Flea Market, Goa, India'),
        A('Fort Aguada', 'fort', 'A 17th-century Portuguese fort overlooking the Arabian Sea, Fort Aguada features a four-story lighthouse and massive ramparts. The views from the top stretch across Candolim Beach and beyond.', 'Historic fortress with panoramic ocean views.', 'Morning or sunset', '1-2 hours', 'Fort Aguada, Sinquerim, Goa, India'),
        A('Palolem Beach', 'beach', 'A crescent-shaped bay in South Goa, Palolem is known for its calm waters, swaying palms, and laid-back vibe. Kayak to Monkey Island or enjoy a silent headphone party after dark.', 'Tranquil beach with unique experiences like silent discos.', 'Evening', '3-4 hours', 'Palolem Beach, South Goa, India'),
        A('Chapora Fort', 'fort', 'Famous from Bollywood films, Chapora Fort sits atop a hill with sweeping views of Vagator Beach and the Chapora River. The sunset views here are legendary.', 'Iconic hilltop fort with cinematic sunset panoramas.', 'Sunset', '1 hour', 'Chapora Fort, Vagator, Goa, India'),
        A('Se Cathedral', 'heritage', 'One of the largest churches in Asia, Se Cathedral is dedicated to St. Catherine. Its Portuguese-Gothic architecture and the Golden Bell are standout features.', 'Architectural grandeur and historical importance.', 'Morning', '1 hour', 'Se Cathedral, Old Goa, India'),
        A('Butterfly Beach', 'beach', 'Accessible only by boat or a forest trek, Butterfly Beach is a hidden cove where dolphins often appear. The isolation makes it one of Goa\'s most romantic spots.', 'Secluded beach with dolphin sightings and pristine sands.', 'Morning', '2-3 hours', 'Butterfly Beach, South Goa, India'),
        A('Tito\'s Lane', 'nightlife', 'The epicenter of Goa\'s club scene, Tito\'s Lane in Baga packs in world-famous nightclubs, cocktail bars, and live music venues.', 'India\'s most famous nightlife strip.', 'Late night', '4-5 hours', 'Tito\'s Lane, Baga, Goa, India'),
        A('Dona Paula', 'viewpoint', 'A scenic viewpoint where the Zuari and Mandovi rivers meet the Arabian Sea. The tragic love story associated with it adds a layer of romance.', 'Romantic viewpoint with stunning river-meets-sea vistas.', 'Evening', '1-2 hours', 'Dona Paula, Goa, India'),
        A('Candolim Beach', 'beach', 'One of the longest and cleanest beaches in North Goa, Candolim offers water sports, beachfront dining, and a more relaxed crowd than Baga.', 'Clean sands with excellent dining and water activities.', 'Afternoon', '3-4 hours', 'Candolim Beach, Goa, India'),
        A('Fontainhas', 'heritage', 'Latin Quarter of Panjim, Fontainhas is a maze of narrow streets lined with colorful Portuguese-era houses, art galleries, and quaint cafes.', 'Step back into Portuguese Goa with vibrant heritage walks.', 'Morning', '2 hours', 'Fontainhas, Panjim, Goa, India'),
        A('Arambol Beach', 'beach', 'A bohemian haven in North Goa, Arambol attracts backpackers, musicians, and yoga enthusiasts. The nearby sweet water lake adds to its charm.', 'Alternative beach culture with yoga and live music.', 'Sunset', '3-4 hours', 'Arambol Beach, Goa, India'),
        A('Reis Magos Fort', 'fort', 'Recently restored, this 16th-century fort offers a cultural center, art exhibitions, and views across the Mandovi River to Panjim.', 'Cultural venue inside a beautifully restored fort.', 'Morning', '1-2 hours', 'Reis Magos Fort, Goa, India'),
        A('Shri Mangueshi Temple', 'temple', 'One of Goa\'s most important Hindu temples, Mangueshi is known for its seven-story deepastambha and serene temple tank.', 'Important spiritual site with impressive architecture.', 'Morning', '1 hour', 'Shri Mangueshi Temple, Ponda, Goa, India'),
        A('Vagator Beach', 'beach', 'Known for its dramatic red cliffs and rock formations, Vagator is split into Big and Little Vagator, each offering a different vibe.', 'Stunning cliffside beach with dramatic scenery.', 'Evening', '2-3 hours', 'Vagator Beach, Goa, India'),
        A('Spice Plantations', 'nature', 'Visit organic spice farms in Ponda to see how cardamom, vanilla, and pepper grow. Most tours include a traditional Goan lunch.', 'Educational and aromatic experience with farm-fresh meals.', 'Morning', '2-3 hours', 'Sahakari Spice Farm, Ponda, Goa, India'),
        A('Divar Island', 'island', 'A quiet island in the Mandovi River, Divar feels like Goa from decades ago — Portuguese homes, village churches, and zero commercialization.', 'Offbeat island escape with old-world Goan charm.', 'Morning', '3-4 hours', 'Divar Island, Goa, India'),
        A('Cabo de Rama Fort', 'fort', 'One of Goa\'s oldest forts, Cabo de Rama offers jaw-dropping views of the coastline and a sense of raw, untamed history.', 'Remote fort with the best panoramic coastal views.', 'Morning', '1-2 hours', 'Cabo de Rama Fort, Canacona, Goa, India'),
        A('Morjim Beach', 'beach', 'A tranquil nesting site for Olive Ridley turtles, Morjim is also known as Little Russia for its expat community and serene vibe.', 'Peaceful beach with turtle nesting and Russian cafes.', 'Morning', '2-3 hours', 'Morjim Beach, Goa, India'),
        A('Museum of Christian Art', 'museum', 'Located in the Monastery of Santa Monica, this museum displays exquisite Indo-Portuguese Christian art spanning centuries.', 'Rare collection of Indo-Portuguese religious art.', 'Morning', '1 hour', 'Museum of Christian Art, Old Goa, India'),
        A('Cotigao Wildlife Sanctuary', 'wildlife', 'Goa\'s second-largest sanctuary is home to flying squirrels, monkeys, and rare birds. Tree-top watchtowers offer unique wildlife viewing.', 'Wildlife haven with canopy-level observation towers.', 'Early morning', '3-4 hours', 'Cotigao Wildlife Sanctuary, Canacona, Goa, India'),
        A('Ashwem Beach', 'beach', 'A pristine stretch in North Goa, Ashwem is favored by those seeking quietude and yoga retreats over parties.', 'Serene beach perfect for yoga and peaceful sunsets.', 'Evening', '2-3 hours', 'Ashwem Beach, Goa, India'),
        A('Church of St. Cajetan', 'heritage', 'Modeled after St. Peter\'s Basilica in Rome, this church features stunning Corinthian columns and an intricately carved altar.', 'Baroque masterpiece with Vatican-inspired architecture.', 'Morning', '1 hour', 'Church of St. Cajetan, Old Goa, India'),
    ]);

// 2. LEH-LADAKH
D('Leh-Ladakh', 'Ladakh', 'High-altitude passes, turquoise lakes, and ancient Buddhist monasteries',
    ['mountain', 'adventure', 'spiritual'], ['pangong lake', 'khardung la pass'],
    [
        A('Pangong Lake', 'lake', 'A high-altitude saltwater lake stretching from India to Tibet, Pangong Tso changes colors from azure to light blue to green. Its otherworldly beauty was immortalized in Bollywood.', 'Iconic turquoise lake at 14,270 feet with shifting colors.', 'May to September', '3-4 hours', 'Pangong Lake, Ladakh, India'),
        A('Nubra Valley', 'nature', 'Known as the Valley of Flowers, Nubra sits at the confluence of the Shyok and Nubra rivers. The sand dunes of Hunder and double-humped Bactrian camels make it surreal.', 'Desert dunes, monasteries, and rare Bactrian camels at altitude.', 'June to September', 'Full day', 'Nubra Valley, Ladakh, India'),
        A('Khardung La Pass', 'adventure', 'Once the world\'s highest motorable road at 18,380 feet, Khardung La offers breathtaking views of the Karakoram and Zanskar ranges.', 'Thrill of driving the world\'s highest motorable pass.', 'May to October', '2-3 hours', 'Khardung La Pass, Ladakh, India'),
        A('Thiksey Monastery', 'monastery', 'A 12-story complex resembling the Potala Palace, Thiksey houses a 49-foot Maitreya Buddha statue and offers panoramic valley views.', 'Mini Potala with an awe-inspiring Buddha statue.', 'Morning', '2 hours', 'Thiksey Monastery, Leh, Ladakh, India'),
        A('Magnetic Hill', 'viewpoint', 'A gravity-defying optical illusion where vehicles appear to roll uphill against gravity. A roadside curiosity on the Leh-Kargil highway.', 'Bizarre anti-gravity phenomenon that baffles visitors.', 'Daytime', '30 minutes', 'Magnetic Hill, Leh, Ladakh, India'),
        A('Shanti Stupa', 'religious', 'A white-domed Buddhist stupa built by Japanese monks, Shanti Stupa overlooks Leh and offers spectacular sunrise and sunset panoramas.', 'Peaceful stupa with panoramic views of Leh town.', 'Sunrise or sunset', '1 hour', 'Shanti Stupa, Leh, Ladakh, India'),
        A('Hemis Monastery', 'monastery', 'The largest and richest monastery in Ladakh, Hemis is famous for its annual festival featuring masked dances and ancient thangkas.', 'Ladakh\'s wealthiest monastery with vibrant festivals.', 'June to July for festival', '2-3 hours', 'Hemis Monastery, Ladakh, India'),
        A('Zanskar Valley', 'adventure', 'One of the most remote regions in India, Zanskar offers raw Himalayan beauty, frozen river treks, and ancient monasteries cut off from the world for months.', 'Ultimate off-grid Himalayan wilderness experience.', 'June to September', '2-3 days', 'Zanskar Valley, Ladakh, India'),
        A('Lamayuru Monastery', 'monastery', 'One of Ladakh\'s oldest monasteries, set in a dramatic moonscape of eroded badlands. It is said to be built on the site of a dried lake.', 'Ancient monastery in a surreal lunar landscape.', 'Morning', '1-2 hours', 'Lamayuru Monastery, Ladakh, India'),
        A('Tso Moriri Lake', 'lake', 'Less crowded than Pangong, Tso Moriri is a pristine high-altitude lake surrounded by snow-capped peaks and the Korzok monastery.', 'Untouched alpine lake with rare migratory birds.', 'May to September', '3-4 hours', 'Tso Moriri Lake, Ladakh, India'),
        A('Leh Palace', 'palace', 'A nine-story royal palace modeled after Lhasa\'s Potala, Leh Palace offers views over the old town and houses a museum of royal artifacts.', 'Historic palace with commanding views of Leh.', 'Morning', '1-2 hours', 'Leh Palace, Leh, Ladakh, India'),
        A('Alchi Monastery', 'monastery', 'One of the oldest monastic complexes in Ladakh, Alchi is renowned for its Kashmiri-influenced wall paintings and wood carvings from the 11th century.', 'Ancient Kashmiri-Buddhist art in exquisite condition.', 'Morning', '1-2 hours', 'Alchi Monastery, Ladakh, India'),
        A('Changla Pass', 'viewpoint', 'At 17,688 feet, Changla is one of the highest motorable passes and the gateway to Pangong Lake. The prayer flags fluttering in thin air are unforgettable.', 'High mountain pass en route to Pangong with stunning vistas.', 'May to October', '30 minutes', 'Changla Pass, Ladakh, India'),
        A('Diskit Monastery', 'monastery', 'The oldest and largest monastery in Nubra Valley, Diskit features a 106-foot Maitreya Buddha statue facing Pakistan to promote peace.', 'Giant Buddha statue guarding the valley.', 'Morning', '1-2 hours', 'Diskit Monastery, Nubra Valley, Ladakh, India'),
        A('Sangam Point', 'viewpoint', 'The confluence of the Indus and Zanskar rivers, where the turquoise and muddy waters meet but do not immediately mix.', 'Stunning two-tone river confluence.', 'Afternoon', '1 hour', 'Sangam, Nimmu, Ladakh, India'),
        A('Shey Palace', 'palace', 'The former summer palace of Ladakhi kings, Shey is known for its 39-foot copper and gold Buddha statue and serene royal gardens.', 'Royal heritage site with a massive golden Buddha.', 'Morning', '1 hour', 'Shey Palace, Leh, Ladakh, India'),
        A('Stok Palace', 'palace', 'Still home to Ladakh\'s royal family, Stok Palace has been partially converted into a museum showcasing thangkas, crowns, and royal attire.', 'Living palace museum of Ladakhi royalty.', 'Morning', '1-2 hours', 'Stok Palace, Ladakh, India'),
        A('Drang Drung Glacier', 'glacier', 'One of the largest glaciers accessible by road in India, visible from the Penzi La pass on the way to Zanskar.', 'Majestic glacier visible from a high mountain pass.', 'June to September', '1 hour', 'Drang Drung Glacier, Ladakh, India'),
        A('Hall of Fame', 'museum', 'A museum maintained by the Indian Army honoring soldiers who died in Indo-Pak wars. It includes a war memorial and displays of Ladakhi culture.', 'Moving tribute to India\'s armed forces.', 'Daytime', '1-2 hours', 'Hall of Fame, Leh, Ladakh, India'),
        A('Kargil War Memorial', 'heritage', 'Located at Dras, this memorial honors the heroes of the 1999 Kargil War with an eternal flame and inscribed walls.', 'Poignant memorial to India\'s wartime heroes.', 'Daytime', '1 hour', 'Kargil War Memorial, Dras, Ladakh, India'),
        A('Turtuk Village', 'nature', 'India\'s northernmost village, Turtuk was opened to tourists in 2010. Its Balti culture, apricot orchards, and friendly locals are captivating.', 'Last village before Pakistan with unique Balti culture.', 'May to September', '3-4 hours', 'Turtuk Village, Ladakh, India'),
        A('Phyang Monastery', 'monastery', 'Known for its vibrant festivals and dramatic location against a backdrop of craggy mountains, Phyang is a key Drikung Kagyu monastery.', 'Culturally rich monastery with dramatic mountain setting.', 'Morning', '1-2 hours', 'Phyang Monastery, Ladakh, India'),
        A('Markha Valley Trek', 'adventure', 'One of Ladakh\'s most popular treks, passing through remote villages, Buddhist ruins, and high-altitude passes with views of Kang Yatse.', 'Classic Ladakhi trek through remote villages and peaks.', 'June to September', '6-8 days', 'Markha Valley, Ladakh, India'),
        A('Gurudwara Pathar Sahib', 'religious', 'A Sikh shrine built and maintained by the Indian Army, believed to commemorate Guru Nanak\'s visit to Ladakh.', 'Sacred Sikh shrine maintained by the Indian Army.', 'Morning', '1 hour', 'Gurudwara Pathar Sahib, Leh, Ladakh, India'),
        A('Likir Monastery', 'monastery', 'Famous for its 75-foot gold-covered Buddha statue, Likir is one of the oldest monasteries in Ladakh with vibrant festival traditions.', 'Giant golden Buddha and ancient monastic traditions.', 'Morning', '1-2 hours', 'Likir Monastery, Ladakh, India'),
    ]);

// More destinations will be added here...
