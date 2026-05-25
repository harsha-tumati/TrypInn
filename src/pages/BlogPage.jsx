// src/pages/BlogPage.jsx — SEO Blog Section
import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User, Star } from 'lucide-react';

// Sets the document title, meta description and Article JSON-LD for SEO.
// Cleans up on unmount so list ↔ detail navigation stays correct.
function useBlogSeo(post) {
    useEffect(() => {
        const prevTitle = document.title;
        const metaEl = document.querySelector('meta[name="description"]');
        const prevDesc = metaEl?.getAttribute('content') || '';

        document.title = post
            ? `${post.title} · TripSync Blog`
            : 'TripSync Blog — Travel tips & trip-planning guides';
        const desc = post
            ? post.metaDescription
            : 'Travel tips, planning guides, and stories to fuel your next adventure with TripSync.';
        if (metaEl) metaEl.setAttribute('content', desc);

        let ld;
        if (post) {
            ld = document.createElement('script');
            ld.type = 'application/ld+json';
            ld.textContent = JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: post.title,
                description: post.metaDescription,
                image: post.coverImage,
                author: { '@type': 'Organization', name: post.author || 'TripSync' },
                publisher: { '@type': 'Organization', name: 'TripSync' },
                keywords: (post.tags || []).join(', '),
            });
            document.head.appendChild(ld);
        }
        return () => {
            document.title = prevTitle;
            if (metaEl) metaEl.setAttribute('content', prevDesc);
            if (ld) ld.remove();
        };
    }, [post]);
}

const BLOG_POSTS = [
    {
        id: 'split-group-trip-expenses',
        title: "How to Split Group Trip Expenses Fairly — Without the Awkward Money Talk",
        metaDescription: "Money is the No.1 cause of group-trip friction. Learn a simple, fair system to split travel expenses, track who paid what, and settle up with zero awkwardness.",
        excerpt: "One person always ends up paying for the cab, another for dinner, and by day three nobody remembers who owes whom. Here's a fair, drama-free way to handle trip money.",
        coverImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',
        author: 'TripSync Team',
        date: 'May 20, 2026',
        readTime: '6 min read',
        tags: ['Group Travel', 'Expenses', 'Trip Planning'],
        featured: false,
        content: `Every group trip has that one quiet tension nobody wants to name: money. One friend fronts the hotel booking, another covers all the cab rides, someone always "forgets" their wallet at lunch — and by the time you're home, the group chat has become a spreadsheet of guilt.

It doesn't have to be this way. After dozens of trips, we've landed on a system that keeps things fair and friendships intact.

---

## Agree on the Rules Before You Leave

The single biggest mistake is figuring out the money *during* the trip. Have a five-minute conversation before you go and decide:

- **What's shared vs. personal:** Stays, fuel, group meals and tickets are shared. Souvenirs, that extra cocktail, and the spa day are personal.
- **The splitting style:** Equal split is simplest. If incomes vary a lot, a "fair share" split (everyone contributes a comfortable amount) can work better.
- **One source of truth:** Pick one place to log every shared expense — not three different chats and a memory.

![Friends planning a budget together](https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80)

## Log Expenses the Moment They Happen

Receipts fade, memories fade faster. The trick is to log a shared expense the second it happens — who paid, how much, and who it covers. Thirty seconds in the moment saves an hour of arguing later.

This is exactly why TripSync has a built-in **Expenses** tab: anyone in the group can add a cost, tag who it's split among, and the running balance updates live for everyone.

## Let the Math Settle Itself

Here's the part people overcomplicate. You don't need everyone to pay everyone back. With all expenses logged, a good tool calculates the **minimum number of transfers** to settle up — so instead of twelve confusing payments, you get two or three clean ones.

- **Fewer transfers** means fewer chances for error.
- **A clear "X owes Y ₹Z"** removes any debate.
- **Settling once, at the end,** beats nickel-and-diming all trip.

## Keep It Human

Money systems work best when they stay invisible. Log quietly, settle once, and never let a ₹200 cab ride turn into a cold shoulder. The goal of the trip is the trip — not the accounting.

Plan your next group getaway on TripSync and let the Expenses tab do the awkward math for you.`,
    },
    {
        id: 'weekend-getaways-bengaluru',
        title: "12 Underrated Weekend Getaways Near Bengaluru for 2026",
        metaDescription: "Skip the crowds. Discover 12 underrated weekend getaways near Bengaluru — hills, waterfalls, heritage towns and quiet beaches, all within a comfortable drive.",
        excerpt: "Coorg and Ooty are lovely — and packed. Here are twelve quieter escapes within driving distance of Bengaluru, perfect for a spontaneous two-day reset.",
        coverImage: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&q=80',
        author: 'TripSync Team',
        date: 'May 18, 2026',
        readTime: '9 min read',
        tags: ['Weekend Trips', 'India', 'Itinerary'],
        featured: false,
        content: `Bengaluru is blessed with options — but everyone seems to drive to the *same* three. If your idea of a weekend escape doesn't include bumper-to-bumper traffic and a fully-booked homestay, this list is for you.

Here are twelve underrated getaways, all within a comfortable drive.

---

## Hills & Forests

- **Kotagiri** — The quiet, third sister of the Nilgiris. Tea slopes and viewpoints without Ooty's chaos.
- **BR Hills** — A wildlife sanctuary where the Eastern and Western Ghats meet. Early-morning safaris, very few tourists.
- **Yelagiri** — A compact hill station ideal for a one-night reset: paragliding, a calm lake, and cool air.
- **Chikmagalur's edges** — Skip the town centre; the estates around Mullayanagiri stay peaceful midweek and shoulder-season.

![Misty hills near Bengaluru](https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&q=80)

## Water & Waterfalls

- **Hogenakkal** — The "Niagara of India" is loudest and best right after the monsoon. Take the coracle ride.
- **Sakleshpur** — Rolling hills, rail trails, and waterfalls tucked into coffee country.
- **Chunchi Falls** — A short, dramatic gorge near Kanakapura — a genuine half-day trip.

## Heritage & Quiet Towns

- **Hampi** — Not exactly a secret, but go in the off-season and the boulder-strewn ruins feel like they're yours alone.
- **Belur & Halebidu** — Hoysala temple carving so fine it looks unreal. A calm, soulful day out.
- **Melukote** — A hill-top temple town with stepwells, silence, and the best puliyogare you'll ever eat.

## Toward the Coast

- **Gokarna** — Beach-town calm without Goa's volume. Walk the cliff path between Om and Half Moon beaches.
- **Murudeshwar** — A towering Shiva statue over the Arabian Sea, plus easy scuba day-trips to Netrani Island.

---

## How to Actually Pull It Off

The difference between a great weekend trip and a stressful one is rarely the destination — it's the logistics. Lock the dates early, map your stops in order so you're not doubling back, and share the plan so nobody's asking "what's next?" at every turn.

Drop any of these into TripSync, let it route your stops in the smartest order, and you'll spend the weekend exploring instead of negotiating.`,
    },
    {
        id: 'pre-trip-checklist',
        title: "The Smart Traveler's Pre-Trip Checklist: 9 Things People Always Forget",
        metaDescription: "A practical pre-trip checklist for stress-free travel. Nine things travelers consistently forget — from offline maps to power banks — and how to never miss them again.",
        excerpt: "It's never the passport people forget — it's the small stuff that quietly wrecks a trip. Here's the checklist we run before every single departure.",
        coverImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
        author: 'TripSync Team',
        date: 'May 14, 2026',
        readTime: '5 min read',
        tags: ['Trip Planning', 'Travel Tips', 'Checklist'],
        featured: false,
        content: `Nobody forgets the big things. The passport, the tickets, the phone — those are safe. It's the small, boring items that quietly turn a great trip into a frustrating one.

Here's the nine-point checklist we run before every departure.

---

## Documents & Money

- **Offline copies of every booking** — Hotels, transport, IDs. Screenshots in one folder beat hunting through email on weak airport Wi-Fi.
- **A backup payment method** — One card, one UPI app, and a little cash. Cards get blocked at the worst possible moment.
- **Emergency contacts written down** — Not just saved in a phone that can die.

## Tech That Saves the Day

- **A power bank — charged.** An uncharged power bank is just a heavy paperweight.
- **Offline maps downloaded** — Save your destination's map before you lose signal in the hills.
- **The right adapters and cables** — Count your devices, then count your cables. They rarely match.

![Travel essentials laid out before packing](https://images.unsplash.com/photo-1553969546-2dc10dcc7c89?w=1200&q=80)

## The Quietly Important Stuff

- **A basic medkit** — Painkillers, band-aids, motion-sickness tablets, and any personal medication with a buffer of extra days.
- **Weather-checked layers** — Check the forecast for your actual travel dates, not the season's average. Hill mornings are colder than the brochure suggests.
- **A shared itinerary everyone can see** — The most-forgotten "item" isn't a thing at all. When the whole group can see the plan, nobody's lost, nobody's late, and nobody's asking the same question five times.

---

## Make the Checklist a Habit

The best travelers aren't lucky — they're systematic. Build the plan once, share it, and let everyone tick off their own list. TripSync keeps your route, itinerary and group on the same page, so the only surprises on your trip are the good ones.`,
    },
    {
        id: 'group-trip-planner',
        title: "Planning a Group Trip Without Losing Your Mind — Here's the App That Saved Us",
        metaDescription: "Planning a trip with friends doesn't have to be stressful. Discover how a group trip planner app can save your sanity, coordinate itineraries, and keep everyone happy.",
        excerpt: "We've all been there — that excited WhatsApp group that quickly spirals into chaos. Here's how we broke the curse and planned a seamless itinerary across India.",
        coverImage: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=800&q=80',
        author: 'TripSync Team',
        date: 'May 16, 2026',
        readTime: '8 min read',
        tags: ['Group Travel', 'Trip Planning', 'AI', 'India'],
        featured: true,
        content: `We've all been there. You're sitting around a table with your closest friends, a few drinks in, buzzing with excitement. Someone says, *"We should totally go to Goa next month!"* Everyone cheers. A WhatsApp group is instantly created with a flurry of beach emojis. You're convinced this is going to be the legendary trip your group talks about for years.

Then, reality hits.

Fast forward two weeks, and that enthusiastic WhatsApp group has transformed into a chaotic graveyard of unanswered polls, conflicting flight screenshots, and radio silence. Rahul wants an action-packed itinerary with scuba diving and trek routes; Sneha wants to spend four hours sipping iced lattes at a bohemian cafe; and half the group hasn't even confirmed if they can get leave from work.

![Friends checking map](https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=1200&q=80)

Trying to organize a group vacation can feel less like a holiday and more like a second full-time job. In fact, it's a running joke that the hardest part of any group trip isn't saving up the money—it's actually making it out of the group chat.

But it doesn't have to be that way. On our last big adventure, my friends and I managed to break the curse. We planned a seamless, jam-packed itinerary across India without a single argument. Our secret weapon? Moving away from messy spreadsheets and switching to a dedicated **group trip planner app**.

Here is exactly how we saved our sanity, kept everyone on the same page, and how you can do the same for your next getaway.

---

## The Anatomy of Group Travel Chaos (And Why Spreadsheets Fail)

Before we dive into the solution, let's look at the problem. Traditional travel planning tools simply aren't built for collaboration.

When you use a shared Google Sheet or a running note, a few things invariably go wrong:

- **The Version Control Nightmare:** Someone edits the itinerary on their phone, accidentally deletes a row, and suddenly nobody knows what time the train leaves.
- **The Endless Scroll:** Crucial hotel recommendations and links get buried under 300 messages discussing where to eat dinner on night one.
- **The Visualization Gap:** Looking at a list of addresses on a spreadsheet doesn't help you realize that the cute cafe you picked is a two-hour drive in the opposite direction from your afternoon museum tour.

![Messy planning vs App](https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80)

Whether you're organizing a massive family reunion or planning a tight backpacking stint where you occasionally meet up with friends, mapping out logistics requires a visual, real-time approach.

---

## Enter TripSync: The Collaborative Tool We Didn't Know We Needed

After abandoning our third attempt at a shared spreadsheet, we decided to try something different. We moved our entire brainstorming phase to a **travel planning app** called **TripSync**.

If you haven't heard of it yet, **TripSync** is a collaborative trip-planning web application designed specifically to let groups map out their journeys together in real-time. Think of it like Google Docs, but entirely optimized for maps, routes, and travel itineraries.

The moment we opened our shared dashboard, the dynamic changed. Instead of one designated "trip captain" bearing the brunt of the logistics, everyone became an active participant.

Here are the standout features that completely transformed how we put our route together.

---

### 1. Real-Time Collaboration Without the Cross-Talk

The biggest game-changer was the ability for multiple users to add, remove, and reorder destinations simultaneously. If Sneha found a stunning cliffside viewpoint, she could drop it right into the itinerary. If Rahul noticed that a beach was right next to it, he could drag and drop it into the next time slot.

![Group of friends laughing](https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=1200&q=80)

Seeing pins appear on the map in real-time as people added ideas turned a stressful chore into a fun, interactive pre-trip ritual. It gave everyone ownership over the vacation, completely eliminating the post-trip complaints of *"We only did what you wanted to do!"*

### 2. Built-In AI Smart Suggestions

We knew the major landmarks we wanted to hit, but we were clueless about the hidden gems along the route. TripSync features an integrated AI engine that analyzes your current stops and suggests nearby places to visit.

### 3. Route Optimization That Saves Hours

There is nothing worse than backtracking through city traffic because you planned your day inefficiently. TripSync automatically visualizes your entire itinerary on an interactive map and shows you the optimal routes between stops. If you've placed your lunch spot miles away from your morning activity, the visual layout instantly alerts you, allowing you to reorder your day with a simple drag-and-drop gesture.

---

## How to Structure Your Group Itinerary for Maximum Harmony

Using a great tool is only half the battle; you also need a solid strategy. When putting your schedule together in the app, keep these golden rules of group travel in mind:

### Mix Big Landmark Days with "Choose Your Own Adventure" Blocks

Don't over-schedule every waking minute. Break your days down into blocks. Keep mornings open for high-priority group sightseeing, but leave late afternoons free. In our itinerary, we left three-hour gaps where the group could split up—some headed back to the hostel to rest, while others went hunting for local street food.

### Map Out Your Stays Early

If you are traveling on a budget, your accommodation sets the tone for your entire trip. Use the planner to pin your accommodations first, then build your daily sightseeing loops radially outward from that central point to minimize transit times.

---

## Ready to Plan Your Next Unforgettable Getaway?

Group travel doesn't have to be synonymous with stress. With the right strategy and a collaborative mindset, building your dream vacation can be just as exciting as the trip itself. Stop drowning in chaotic group chat threads and disjointed spreadsheets.

Gather your travel crew, fire up your browser, and start mapping out your next collective adventure in real-time on TripSync!`,
    },
    {
        id: 'goa-india',
        title: "The Ultimate Guide to Goa: Beaches, Heritage, and Nightlife",
        metaDescription: "Discover the best beaches, historical Portuguese architecture, and vibrant nightlife in Goa. Perfect for group trips and solo adventures.",
        excerpt: "Pristine beaches, vibrant nightlife, and Portuguese heritage. Perfect for groups seeking sun, sand, and adventure.",
        coverImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=80',
        author: 'TripSync Experts',
        date: 'May 10, 2026',
        readTime: '6 min read',
        tags: ['Beach', 'Nightlife', 'India', 'Heritage'],
        featured: false,
        suggestedPlaces: [
            { name: "Baga Beach", rating: 4.5, image: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&q=80" },
            { name: "Fort Aguada", rating: 4.6, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Fort_aguada.jpg/800px-Fort_aguada.jpg" },
            { name: "Dudhsagar Falls", rating: 4.8, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Doodhsagar_Fall.jpg/800px-Doodhsagar_Fall.jpg" },
            { name: "Grande Island", rating: 4.7, image: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80" }
        ],
        content: `Goa is India's pocket-sized paradise, a kaleidoscopic blend of Indian and Portuguese cultures, sun, sea, sand, seafood, and spirituality.

![Goa Beaches](https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&q=80)

---

## Top Activities: Dive into the Adventure!

Goa isn't just about lounging on the sand; it's an adventurer's playground. Whether you are looking for a wild weekend getaway with friends or a peaceful retreat by the sea, Goa has something for everyone.

### 🤿 Scuba Diving at Grande Island
The waters around Grande Island offer some of the best scuba diving experiences in India. Explore vibrant coral reefs, swim alongside exotic marine life, and discover historical shipwrecks hidden beneath the Arabian Sea.

![Scuba Diving in Goa](https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80)

### 🏄‍♂️ Water Sports at Baga & Calangute
Get your adrenaline pumping with parasailing, jet skiing, and banana boat rides on the bustling shores of Baga and Calangute beaches.

---

## Must-Visit Beaches

- **Baga Beach:** The heart of North Goa's nightlife. Perfect for water sports, vibrant beach shacks like *Britto's*, and dancing the night away at Tito's Lane.
- **Palolem Beach:** A picturesque, crescent-shaped beach in South Goa, known for its calm, shallow waters and laid-back "silent noise" parties.
- **Anjuna Beach:** Famous for its trance parties, rocky shores, and the legendary Wednesday flea market where you can hunt for bohemian treasures.

![Palolem Beach](https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&q=80)

---

## Heritage and Historical Monuments

Goa's rich Portuguese history is etched into its stunning architecture and towering monuments.

### Basilica of Bom Jesus
Located in Old Goa, this UNESCO World Heritage site showcases stunning baroque architecture and holds the mortal remains of St. Francis Xavier.

![Basilica of Bom Jesus](https://images.unsplash.com/photo-1620766165457-a8025baa82e0?w=1200&q=80)

### Fort Aguada
A well-preserved 17th-century Portuguese fort standing tall on Sinquerim Beach. It offers panoramic views of the Arabian Sea and features a historic four-storey lighthouse.

### Dudhsagar Waterfalls
Though technically a natural wonder, it's a monumental sight. This majestic four-tiered waterfall looks like a sea of milk cascading down the lush Western Ghats, especially spectacular during the monsoon.

---

## Plan Your Goa Trip
Planning a group trip to Goa? Keep track of everyone's beach preferences, coordinate your scuba diving slots, and organize your restaurant choices using **TripSync**.`
    },
    {
        id: 'bali-indonesia',
        title: "Bali Backpacking: Temples, Terraces, and Tropical Bliss",
        metaDescription: "Explore Bali's ancient temples, lush rice terraces, and vibrant culture. The ultimate guide to a tropical Indonesian getaway.",
        excerpt: "Lush rice terraces, ancient temples, and tropical paradise. Experience culture, wellness, and natural beauty.",
        coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
        author: 'Wanderlust Team',
        date: 'May 08, 2026',
        readTime: '7 min read',
        tags: ['Tropical', 'Wellness', 'Indonesia'],
        featured: false,
        suggestedPlaces: [
            { name: "Ubud Monkey Forest", rating: 4.7, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Monkey_Forest.jpg/800px-Monkey_Forest.jpg" },
            { name: "Uluwatu Temple", rating: 4.8, image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80" },
            { name: "Tanah Lot", rating: 4.6, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/TanahLot_2014.JPG/800px-TanahLot_2014.JPG" },
            { name: "Mount Batur", rating: 4.9, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/View_Of_Mt.Batur_on_April_8th_2026.jpg/800px-View_Of_Mt.Batur_on_April_8th_2026.jpg" }
        ],
        content: `Bali, the famed Island of the Gods, stakes a serious claim to be paradise on earth. Its varied landscape of hills and mountains, rugged coastlines, and sandy beaches provide a picturesque backdrop to its colorful, deeply spiritual culture.

![Bali Rice Terraces](https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80)

---

## Top Activities: Tropical Adventures!

Bali offers everything from deep relaxation to extreme sports.

### 🏄‍♂️ Surfing at Uluwatu
Catch some of the world's most famous waves at Uluwatu. Whether you're a seasoned pro or taking your first lesson, the Indian Ocean swells here are legendary.

![Surfing in Bali](https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80)

### 🧘‍♀️ Yoga and Wellness in Ubud
Immerse yourself in a holistic retreat. Ubud is the epicenter of Bali's spiritual wellness scene, featuring open-air yoga studios surrounded by the jungle.

---

## Highlight Spots in Bali

### Ubud
The cultural heart of Bali, famous for its lush rainforests and terraced rice paddies.
- **Tegallalang Rice Terrace:** Iconic, terraced landscapes perfect for photography.
- **Sacred Monkey Forest Sanctuary:** A nature reserve and temple complex home to hundreds of macaques.

![Monkey Forest Ubud](https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Monkey_Forest.jpg/1200px-Monkey_Forest.jpg)

### Uluwatu
Known for its stunning cliffside ocean views.
- **Uluwatu Temple:** A spectacular temple perched on a steep cliff, famous for sunset Kecak fire dances.

---

## Must-Visit Places
- **Tanah Lot:** A rock formation home to the ancient Hindu pilgrimage temple Pura Tanah Lot.
- **Mount Batur:** An active volcano offering breathtaking sunrise treks.

![Mount Batur Sunrise](https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1200&q=80)

Organize your Bali adventure seamlessly with **TripSync**, ensuring you never miss a sunset or a temple visit.`
    },
    {
        id: 'santorini-greece',
        title: "Santorini Sunsets: The Jewel of the Aegean",
        metaDescription: "Discover Santorini's blue domes, whitewashed villages, and dramatic sunsets. A complete guide to the romantic Greek island.",
        excerpt: "Iconic blue domes, stunning sunsets, and whitewashed villages. The ultimate romantic Mediterranean escape.",
        coverImage: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80',
        author: 'TripSync Experts',
        date: 'May 05, 2026',
        readTime: '5 min read',
        tags: ['Romantic', 'Mediterranean', 'Greece'],
        featured: false,
        suggestedPlaces: [
            { name: "Oia Blue Domes", rating: 4.9, image: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80" },
            { name: "Red Beach", rating: 4.5, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Red_Beach_Santorini.jpg/800px-Red_Beach_Santorini.jpg" },
            { name: "Amoudi Bay", rating: 4.8, image: "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80" },
            { name: "Santo Wines", rating: 4.7, image: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&q=80" }
        ],
        content: `Santorini is a crescent-shaped island in the Aegean Sea, famous for its dramatic views, stunning sunsets, and white-washed houses clinging to cliffs.

![Santorini Caldera](https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200&q=80)

---

## Top Activities: Romance and Exploration

### ⛵ Sunset Catamaran Cruise
Experience the iconic Santorini sunset from the water. Sail around the caldera, swim in the volcanic hot springs, and enjoy a fresh Greek barbecue on board.

![Catamaran Cruise](https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=1200&q=80)

### 🍷 Wine Tasting Tour
Volcanic ash soil makes for unique, crisp wines. Visit local vineyards to taste the island's famous Assyrtiko wine overlooking the Aegean Sea.

---

## The Best of Santorini

### Oia
The most famous village in Santorini, renowned for its breathtaking sunset views over the caldera.
- **Blue Dome Churches:** The iconic, photogenic spots seen on every postcard.
- **Amoudi Bay:** A picturesque port at the base of Oia, perfect for fresh seafood.

![Oia Blue Domes](https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&q=80)

### Fira
The vibrant capital of the island, offering stunning views, shopping, and nightlife.

### Unique Beaches
- **Red Beach:** Famous for its striking red volcanic sand and towering red cliffs.
- **Kamari Beach:** A popular black sand beach with excellent facilities.

![Red Beach Santorini](https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&q=80)

---

Coordinate your romantic getaway or group holiday using **TripSync** to share flight details and accommodation links easily.`
    },
    {
        id: 'leh-ladakh',
        title: "Adventure Awaits: Conquering Leh Ladakh",
        metaDescription: "A comprehensive guide to traveling Leh Ladakh, featuring high-altitude lakes, mountain passes, and ancient monasteries.",
        excerpt: "Breathtaking mountain passes, pristine lakes, and Buddhist monasteries. A paradise for adventurous souls.",
        coverImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&q=80',
        author: 'Mountain Explorer',
        date: 'May 02, 2026',
        readTime: '9 min read',
        tags: ['Adventure', 'Mountains', 'India'],
        featured: false,
        suggestedPlaces: [
            { name: "Pangong Lake", rating: 4.9, image: "https://images.unsplash.com/photo-1582293041079-7814c2f12063?w=800&q=80" },
            { name: "Nubra Valley", rating: 4.8, image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80" },
            { name: "Thiksey Monastery", rating: 4.7, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Thikse_Monastery.jpg/800px-Thikse_Monastery.jpg" },
            { name: "Khardung La", rating: 4.6, image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&q=80" }
        ],
        content: `Ladakh, the "Land of High Passes," is a region in northern India known for its stunning, rugged landscapes, clear blue skies, and deep-rooted Buddhist culture.

![Leh Landscape](https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80)

---

## Top Activities: Epic Adrenaline

### 🏍️ Motorcycle Expeditions
Riding a Royal Enfield through the barren, majestic mountains of Ladakh is the ultimate road trip dream.

![Motorcycle in Ladakh](https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80)

### ⛺ Stargazing in Nubra
Far from city lights, the high-altitude cold desert of Nubra Valley offers some of the clearest, most spectacular starry skies in the world.

---

## Must-Visit Places in Ladakh

### Pangong Tso
A high-altitude lake famous for its ever-changing hues of blue. It spans across India and Tibet, offering surreal, mesmerizing views.

![Pangong Lake](https://images.unsplash.com/photo-1582293041079-7814c2f12063?w=1200&q=80)

### Nubra Valley
A high-altitude cold desert where you can ride the double-humped Bactrian camels among the sand dunes of Hunder.

### Khardung La Pass
Once claimed as the highest motorable road in the world, this pass offers thrilling drives and spectacular mountain panoramas.

### Monasteries
- **Thiksey Monastery:** Strikingly resembling the Potala Palace in Tibet.
- **Hemis Monastery:** The largest and wealthiest monastery in Ladakh.

![Thiksey Monastery](https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Thikse_Monastery.jpg/1200px-Thikse_Monastery.jpg)

---

Planning a road trip to Ladakh requires careful route mapping and acclimatization stops. Use **TripSync** to plot your exact daily driving routes.`
    },
    {
        id: 'dubai-uae',
        title: "Dubai Uncovered: Luxury, Skyscrapers, and Deserts",
        metaDescription: "Experience the ultimate luxury in Dubai. From the Burj Khalifa to desert safaris, plan your extravagant UAE trip.",
        excerpt: "Futuristic skyline, world-class shopping, and desert adventures. Where modern luxury meets Arabian culture.",
        coverImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
        author: 'TripSync Experts',
        date: 'April 28, 2026',
        readTime: '6 min read',
        tags: ['Luxury', 'Cityscape', 'UAE'],
        featured: false,
        suggestedPlaces: [
            { name: "Burj Khalifa", rating: 4.8, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg/800px-Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg" },
            { name: "Dubai Desert Safari", rating: 4.9, image: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=800&q=80" },
            { name: "The Dubai Mall", rating: 4.7, image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80" },
            { name: "Palm Jumeirah", rating: 4.8, image: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=80" }
        ],
        content: `Dubai is a city of superlatives—home to the world's tallest building, largest mall, and most luxurious hotels. It's a dazzling metropolis that emerged from the desert sands.

![Dubai Skyline](https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80)

---

## Top Activities: Limitless Luxury

### 🐪 Desert Safari & Dune Bashing
Escape the city skyline and head into the vast Arabian desert. Experience adrenaline-pumping dune bashing, camel riding, and traditional Bedouin dinners under the stars.

![Desert Safari](https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=1200&q=80)

### 🪂 Skydiving over Palm Jumeirah
For the ultimate thrill, jump out of a plane and freefall over the iconic man-made Palm Jumeirah island.

---

## Highlight Spots

### The Landmarks
- **Burj Khalifa:** Stand on the observation deck of the tallest building in the world.
- **The Dubai Mall:** An expansive shopping and entertainment hub featuring an indoor aquarium and ice rink.
- **Burj Al Arab:** The iconic sail-shaped luxury hotel.

![Burj Khalifa](https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg/1200px-Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg)

### Old Dubai
Explore the historic Al Fahidi neighborhood, ride a traditional Abra across Dubai Creek, and wander through the fragrant Spice and Gold Souks.

---

Share your lavish Dubai itinerary with your friends using **TripSync**.`
    },
    {
        id: 'kerala-india',
        title: "God's Own Country: The Serenity of Kerala",
        metaDescription: "Discover the tranquil backwaters, lush tea estates, and rich culture of Kerala, India.",
        excerpt: "Serene backwaters, lush tea plantations, and Ayurvedic retreats. God's Own Country awaits.",
        coverImage: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80',
        author: 'TripSync Team',
        date: 'April 25, 2026',
        readTime: '7 min read',
        tags: ['Nature', 'Relaxation', 'India'],
        featured: false,
        suggestedPlaces: [
            { name: "Alleppey Houseboats", rating: 4.9, image: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80" },
            { name: "Munnar Tea Estates", rating: 4.8, image: "https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=800&q=80" },
            { name: "Fort Kochi", rating: 4.6, image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800&q=80" },
            { name: "Wayanad", rating: 4.7, image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Blue%2C_Green_%26_White.jpg/800px-Blue%2C_Green_%26_White.jpg" }
        ],
        content: `Kerala, located on the tropical Malabar Coast of southwestern India, is famous for its palm-lined beaches, tranquil backwaters, and network of canals.

![Kerala Backwaters](https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=80)

---

## Top Activities: Finding Serenity

### 🚤 Houseboat Cruise in Alleppey
Cruising through the serene backwaters on a traditional wooden houseboat is a quintessential Kerala experience. Wake up to the sounds of water birds and enjoy authentic South Indian cuisine cooked on board.

![Alleppey Houseboat](https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80)

### 🌿 Ayurvedic Wellness Retreats
Kerala is the birthplace of Ayurveda. Rejuvenate with traditional massages, herbal therapies, and yoga in the tranquil surroundings of luxury wellness resorts.

---

## Highlight Spots

### Munnar Tea Estates
A breathtaking hill station known for its rolling hills covered in emerald-green tea plantations. The climate is cool and the views are spectacular.

![Munnar Tea Plantations](https://images.unsplash.com/photo-1593693411515-c20261bcad6e?w=1200&q=80)

### Culture and Heritage
- **Kochi (Cochin):** A fascinating mix of Chinese fishing nets, Jewish synagogues, Portuguese houses, and Dutch architecture.
- **Wayanad:** Known for its spice plantations, waterfalls, and wildlife sanctuaries.

---

Build your Kerala road trip step-by-step with **TripSync**, allowing everyone in your family to pitch in their favorite stops.`
    }
];

function renderMarkdown(text) {
    // Simple markdown renderer for blog posts
    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith('## ')) {
            elements.push(<h2 key={i} className="blog-h2">{line.slice(3)}</h2>);
        } else if (line.startsWith('### ')) {
            elements.push(<h3 key={i} className="blog-h3">{line.slice(4)}</h3>);
        } else if (line === '---') {
            elements.push(<hr key={i} className="blog-hr" />);
        } else if (line.startsWith('- ')) {
            elements.push(
                <li key={i} className="blog-li" dangerouslySetInnerHTML={{
                    __html: line.slice(2)
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                }} />
            );
        } else if (line.trim() === '') {
            // skip empty lines
        } else if (line.startsWith('![')) {
            const match = line.match(/!\[(.*?)\]\((.*?)\)/);
            if (match) {
                elements.push(
                    <div key={i} style={{ margin: '24px 0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                        <img src={match[2]} alt={match[1]} style={{ width: '100%', maxHeight: '450px', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    </div>
                );
            }
        } else {
            // Regular paragraph
            const html = line
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>');
            elements.push(<p key={i} className="blog-p" dangerouslySetInnerHTML={{ __html: html }} />);
        }
        i++;
    }
    return elements;
}

// ── Blog List View ──
function BlogList({ onSelectPost }) {
    useBlogSeo(null);
    const rest = BLOG_POSTS.filter(p => !p.featured);
    return (
        <div className="blog-page">
            <div className="blog-hero">
                <div className="blog-hero-inner">
                    <h1>TripSync Blog</h1>
                    <p>Travel tips, planning guides, and stories to fuel your next adventure</p>
                </div>
            </div>

            <div className="blog-container">
                {/* Featured Post */}
                {BLOG_POSTS.filter(p => p.featured).map(post => (
                    <article key={post.id} className="blog-featured-card" onClick={() => onSelectPost(post.id)}>
                        <div className="blog-featured-img">
                            <img src={post.coverImage} alt={post.title} loading="lazy" />
                            <div className="overlay" />
                            <div className="blog-featured-badge">Featured</div>
                            <div className="blog-featured-content">
                                <div className="blog-card-tags">
                                    {post.tags.slice(0, 2).map(t => (
                                        <span key={t} className="blog-tag">{t}</span>
                                    ))}
                                </div>
                                <h2>{post.title}</h2>
                                <p className="blog-featured-excerpt">{post.excerpt}</p>
                                <div className="blog-card-meta">
                                    <span><User size={14} /> {post.author}</span>
                                    <span><Clock size={14} /> {post.readTime}</span>
                                    <span>{post.date}</span>
                                </div>
                            </div>
                        </div>
                    </article>
                ))}

                {/* All Posts Grid */}
                <h2 className="blog-section-title">All articles</h2>
                <div className="blog-grid">
                    {rest.map(post => (
                        <article key={post.id} className="blog-card" onClick={() => onSelectPost(post.id)}>
                            <div className="blog-card-img">
                                <img src={post.coverImage} alt={post.title} loading="lazy" />
                            </div>
                            <div className="blog-card-body">
                                <div className="blog-card-tags">
                                    {post.tags.slice(0, 2).map(t => (
                                        <span key={t} className="blog-tag">{t}</span>
                                    ))}
                                </div>
                                <h3>{post.title}</h3>
                                <p className="blog-card-excerpt">{post.excerpt}</p>
                                <div className="blog-card-meta">
                                    <span><Clock size={14} /> {post.readTime}</span>
                                    <span>{post.date}</span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Blog Post Detail View ──
function BlogDetail({ post, onBack }) {
    useBlogSeo(post);
    return (
        <article className="blog-detail">
            <div className="blog-detail-hero">
                <img src={post.coverImage} alt={post.title} />
                <div className="overlay" />
                <button className="blog-back-btn" onClick={onBack}>
                    <ArrowLeft size={18} /> Back to all articles
                </button>
                <div className="blog-detail-hero-content">
                    <div className="blog-card-tags">
                        {post.tags.map(t => (
                            <span key={t} className="blog-tag">{t}</span>
                        ))}
                    </div>
                    <h1>{post.title}</h1>
                    <div className="blog-card-meta" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        <span><User size={14} /> {post.author}</span>
                        <span><Clock size={14} /> {post.readTime}</span>
                        <span>{post.date}</span>
                    </div>
                </div>
            </div>

            <div className="blog-detail-body">
                <div className="blog-article">{renderMarkdown(post.content)}</div>

                {/* AI Suggested Places Carousel */}
                {post.suggestedPlaces && post.suggestedPlaces.length > 0 && (
                    <div style={{ marginTop: 48, marginBottom: 32 }}>
                        <h3 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.25rem)', fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.2rem' }}>✨</span> AI Suggested Places
                        </h3>
                        <div style={{ display: 'flex', gap: 'clamp(12px, 2vw, 20px)', overflowX: 'auto', paddingBottom: 24, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                            {post.suggestedPlaces.map((place, idx) => (
                                <div key={idx} style={{ 
                                    minWidth: 'clamp(160px, 56vw, 220px)', 
                                    width: 'clamp(160px, 56vw, 220px)', 
                                    borderRadius: 16, overflow: 'hidden', 
                                    border: '1px solid #e5e7eb', backgroundColor: '#fff', 
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', 
                                    flexShrink: 0, cursor: 'pointer', transition: 'transform 0.3s, box-shadow 0.3s' 
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.12)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'; }}
                                >
                                    <div style={{ width: '100%', height: 'clamp(140px, 30vw, 180px)', backgroundColor: '#f3f4f6' }}>
                                        <img src={place.image} alt={place.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                    </div>
                                    <div style={{ padding: 'clamp(12px, 2vw, 16px)' }}>
                                        <h4 style={{ margin: 0, fontSize: 'clamp(1rem, 2.2vw, 1.1rem)', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</h4>
                                        <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, gap: 4 }}>
                                            <Star size={16} fill="#facc15" color="#facc15" />
                                            <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 600 }}>{place.rating}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* CTA */}
                <div className="blog-cta">
                    <h3>Ready to plan your trip?</h3>
                    <p>Start collaborating with your group in real-time on TripSync</p>
                    <Link to="/trips" className="blog-cta-btn">Start Planning Free →</Link>
                </div>
            </div>
        </article>
    );
}

// ── Main Blog Page ──
export default function BlogPage() {
    const { postId } = useParams();
    const navigate = useNavigate();
    const [selectedPostId, setSelectedPostId] = useState(null);
    
    // If URL has a postId, use that. Otherwise use local state (if any).
    const activePostId = postId || selectedPostId;
    const selectedPost = BLOG_POSTS.find(p => p.id === activePostId);

    if (selectedPost) {
        return <BlogDetail post={selectedPost} onBack={() => {
            navigate('/blog');
            setSelectedPostId(null);
        }} />;
    }

    return <BlogList onSelectPost={(id) => navigate(`/blog/${id}`)} />;
}
