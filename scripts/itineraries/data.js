// scripts/itineraries/data.js
//
// Suggested itineraries for the travel guides that actually lay out a trip.
// Each one is transcribed from its article — the day blocks, bases and stops
// are the ones the reader has just read, so the card never offers a place the
// guide didn't mention. Where the article gives a choice ("Ninh Binh or Ha Long
// Bay") the first option becomes the stop and the alternative goes in `note`.
//
// Guides that only list destinations (honeymoon ideas, coolcations, the six
// original destination guides) are deliberately absent: they don't describe a
// trip, and an itinerary for them would have to be invented.
//
// Shape
//   [blogId]: {
//     anchor:  H2 heading the card is placed under (at the end of that section)
//     options: [{
//       id, title, country,          country drives the cost estimate
//       days?                        total days when legs carry no day labels
//       note?                        option-level aside from the article
//       legs: [{
//         days?: '1–2',              day label exactly as the article has it
//         base:  'Tirana',           where you are
//         country?                   per-leg, for multi-country trips
//         travel?: true              a transit day — shown, but no stops
//         note?
//         stops: [{ name, q, cat, min }]
//           name  display name, in the article's words
//           q     Google Places text query; precise, includes city and country
//           cat   PlaceThumb category, for the fallback emoji
//           min   rough visit length; the itinerary page uses it to fill days
//           within? [lowLat, lowLng, highLat, highLng] — restrict the search
//                 to a box when a name is shared with something elsewhere
//       }]
//     }]
//   }

export const ITINERARIES = {

    'albania-riviera-travel-guide': {
        anchor: 'A Ten-Day Route',
        options: [{
            id: 'albania-ten-days',
            title: 'Albania in ten days',
            country: 'Albania',
            legs: [
                { days: '1–2', base: 'Tirana', stops: [
                    { name: "Bunk'Art", q: "Bunk'Art 1, Tirana, Albania", cat: 'museum', min: 120 },
                    { name: 'Blloku', q: 'Blloku, Tirana, Albania', cat: 'place', min: 90 },
                ] },
                { days: '3', base: 'Berat', stops: [
                    { name: 'Berat Castle', q: 'Berat Castle, Berat, Albania', cat: 'heritage', min: 150 },
                ] },
                { days: '4–5', base: 'Gjirokastër and the Blue Eye', stops: [
                    { name: 'Gjirokastër Castle', q: 'Gjirokastër Castle, Gjirokastër, Albania', cat: 'heritage', min: 150 },
                    { name: 'Blue Eye (Syri i Kaltër)', q: 'Blue Eye Syri i Kaltër, Albania', cat: 'nature', min: 90 },
                ] },
                // Ordered south to north: the route reaches the coast from
                // Gjirokastër and then works up it towards Vlorë.
                { days: '6–8', base: 'The Riviera', stops: [
                    { name: 'Butrint', q: 'Butrint National Park, Albania', cat: 'heritage', min: 180 },
                    { name: 'Ksamil', q: 'Ksamil Beach, Ksamil, Albania', cat: 'beach', min: 240 },
                    { name: 'Himarë', q: 'Himarë, Albania', cat: 'beach', min: 180 },
                    { name: 'Gjipe Beach', q: 'Gjipe Beach, Albania', cat: 'beach', min: 240 },
                    { name: 'Dhërmi', q: 'Dhërmi Beach, Albania', cat: 'beach', min: 180 },
                    { name: 'Llogara Pass', q: 'Llogara Pass, Albania', cat: 'viewpoint', min: 60 },
                ] },
                { days: '9–10', base: 'The north', note: 'Theth if you have the time and the legs', stops: [
                    { name: 'Shkodër', q: 'Shkodër, Albania', cat: 'place', min: 120 },
                    { name: 'Lake Koman ferry', q: 'Koman Ferry, Lake Koman, Albania', cat: 'nature', min: 180 },
                    { name: 'Theth', q: 'Theth National Park, Albania', cat: 'nature', min: 360 },
                ] },
            ],
        }],
    },

    'uzbekistan-silk-road-itinerary': {
        anchor: 'A Ten-Day Itinerary',
        options: [{
            id: 'uzbekistan-ten-days',
            title: 'The Silk Road in ten days',
            country: 'Uzbekistan',
            note: 'With fourteen days, add the Nurata mountains and a yurt camp at Aydarkul Lake, or the Fergana Valley.',
            legs: [
                { days: '1–2', base: 'Tashkent', stops: [
                    { name: 'Tashkent Metro', q: 'Kosmonavtlar metro station, Tashkent, Uzbekistan', cat: 'museum', min: 60 },
                    { name: 'Chorsu Bazaar', q: 'Chorsu Bazaar, Tashkent, Uzbekistan', cat: 'market', min: 90 },
                    { name: 'Khast Imam Complex', q: 'Khast Imam Complex, Tashkent, Uzbekistan', cat: 'heritage', min: 90 },
                ] },
                { days: '3', base: 'Train to Samarkand', travel: true, stops: [] },
                { days: '4–5', base: 'Samarkand', stops: [
                    { name: 'Registan', q: 'Registan, Samarkand, Uzbekistan', cat: 'heritage', min: 120 },
                    { name: 'Shah-i-Zinda', q: 'Shah-i-Zinda, Samarkand, Uzbekistan', cat: 'heritage', min: 90 },
                    { name: 'Gur-e-Amir', q: 'Gur-e-Amir Mausoleum, Samarkand, Uzbekistan', cat: 'heritage', min: 60 },
                    { name: 'Bibi-Khanym Mosque', q: 'Bibi-Khanym Mosque, Samarkand, Uzbekistan', cat: 'heritage', min: 60 },
                    { name: 'Siab Bazaar', q: 'Siab Bazaar, Samarkand, Uzbekistan', cat: 'market', min: 60 },
                ] },
                { days: '6', base: 'Train to Bukhara', travel: true, stops: [] },
                { days: '7–8', base: 'Bukhara', stops: [
                    { name: 'Poi Kalyan', q: 'Poi Kalyan, Bukhara, Uzbekistan', cat: 'heritage', min: 90 },
                    { name: 'Lyabi-Hauz', q: 'Lyabi-Hauz, Bukhara, Uzbekistan', cat: 'place', min: 60 },
                    { name: 'The Ark', q: 'Ark of Bukhara, Bukhara, Uzbekistan', cat: 'heritage', min: 90 },
                    { name: 'Chor Minor', q: 'Chor Minor, Bukhara, Uzbekistan', cat: 'heritage', min: 30 },
                    { name: 'The trading domes', q: 'Toqi Zargaron trading dome, Bukhara, Uzbekistan', cat: 'market', min: 60 },
                ] },
                { days: '9', base: 'Overnight train or flight to Khiva', travel: true, stops: [] },
                { days: '10', base: 'Khiva', stops: [
                    { name: 'Itchan Kala', q: 'Itchan Kala, Khiva, Uzbekistan', cat: 'heritage', min: 240 },
                ] },
            ],
        }],
    },

    'saudi-arabia-first-timers-guide': {
        anchor: 'A Ten-Day First Visit',
        options: [{
            id: 'saudi-ten-days',
            title: 'Saudi Arabia in ten days',
            country: 'Saudi Arabia',
            legs: [
                { days: '1–2', base: 'Riyadh and Diriyah', stops: [
                    { name: 'At-Turaif, Diriyah', q: 'At-Turaif District, Diriyah, Saudi Arabia', cat: 'heritage', min: 150 },
                    { name: 'National Museum', q: 'National Museum of Saudi Arabia, Riyadh', cat: 'museum', min: 120 },
                    { name: 'Masmak Fortress', q: 'Masmak Fortress, Riyadh, Saudi Arabia', cat: 'heritage', min: 60 },
                    // A plain search returns a Riyadh tour operator of the same
                    // name, ~75 km from the escarpment; pin it to the real site.
                    { name: 'Edge of the World', q: 'Jabal Fihrayn, Saudi Arabia', within: [24.7, 45.7, 25.2, 46.3], cat: 'viewpoint', min: 240 },
                ] },
                { days: '3–5', base: 'AlUla', stops: [
                    { name: 'Hegra', q: 'Hegra, AlUla, Saudi Arabia', cat: 'heritage', min: 240 },
                    { name: 'Dadan', q: 'Dadan, AlUla, Saudi Arabia', cat: 'heritage', min: 90 },
                    { name: 'Jabal Ikmah', q: 'Jabal Ikmah, AlUla, Saudi Arabia', cat: 'heritage', min: 60 },
                    { name: 'AlUla Old Town', q: 'AlUla Old Town, AlUla, Saudi Arabia', cat: 'heritage', min: 90 },
                    { name: 'Elephant Rock', q: 'Elephant Rock, AlUla, Saudi Arabia', cat: 'viewpoint', min: 60 },
                ] },
                { days: '6–7', base: 'Jeddah', stops: [
                    { name: 'Al-Balad', q: 'Al-Balad, Jeddah, Saudi Arabia', cat: 'heritage', min: 180 },
                    { name: 'Jeddah Corniche', q: 'Jeddah Corniche, Jeddah, Saudi Arabia', cat: 'viewpoint', min: 90 },
                ] },
                { days: '8–10', base: 'Abha and Asir', note: 'or Red Sea diving from Jeddah or Yanbu', stops: [
                    { name: 'Abha', q: 'Abha, Asir, Saudi Arabia', cat: 'place', min: 180 },
                    { name: 'Rijal Almaa', q: 'Rijal Almaa Heritage Village, Asir, Saudi Arabia', cat: 'heritage', min: 120 },
                ] },
            ],
        }],
    },

    'vietnam-ten-day-itinerary': {
        // Card goes after the second route so both options are in view.
        anchor: 'The Alternative: South and Centre',
        options: [
            {
                id: 'vietnam-north-centre',
                title: 'North and Centre',
                country: 'Vietnam',
                legs: [
                    { days: '1–3', base: 'Hanoi', stops: [
                        { name: 'Old Quarter', q: 'Hanoi Old Quarter, Hanoi, Vietnam', cat: 'heritage', min: 180 },
                        { name: 'Hoan Kiem Lake', q: 'Hoan Kiem Lake, Hanoi, Vietnam', cat: 'park', min: 60 },
                        { name: 'Temple of Literature', q: 'Temple of Literature, Hanoi, Vietnam', cat: 'heritage', min: 90 },
                        { name: 'Ho Chi Minh Mausoleum', q: 'Ho Chi Minh Mausoleum, Hanoi, Vietnam', cat: 'heritage', min: 90 },
                        { name: 'Vietnam Museum of Ethnology', q: 'Vietnam Museum of Ethnology, Hanoi, Vietnam', cat: 'museum', min: 120 },
                    ] },
                    { days: '4–5', base: 'Ninh Binh', note: 'or Ha Long Bay — Lan Ha Bay or Bai Tu Long have far fewer boats', stops: [
                        { name: 'Trang An', q: 'Trang An Landscape Complex, Ninh Binh, Vietnam', cat: 'nature', min: 240 },
                    ] },
                    { days: '6', base: 'Fly to Da Nang', travel: true, stops: [] },
                    { days: '7–10', base: 'Hoi An and central Vietnam', note: 'Hue is optional — worth it if history interests you', stops: [
                        { name: 'Hoi An old town', q: 'Hoi An Ancient Town, Hoi An, Vietnam', cat: 'heritage', min: 240 },
                        { name: 'An Bang beach', q: 'An Bang Beach, Hoi An, Vietnam', cat: 'beach', min: 180 },
                        { name: 'My Son', q: 'My Son Sanctuary, Quang Nam, Vietnam', cat: 'heritage', min: 180 },
                        { name: 'Hai Van Pass', q: 'Hai Van Pass, Vietnam', cat: 'viewpoint', min: 180 },
                        { name: 'Hue Citadel', q: 'Imperial City, Hue, Vietnam', cat: 'heritage', min: 240 },
                    ] },
                ],
            },
            {
                id: 'vietnam-south-centre',
                title: 'South and Centre',
                country: 'Vietnam',
                legs: [
                    { days: '1–3', base: 'Ho Chi Minh City', stops: [
                        { name: 'War Remnants Museum', q: 'War Remnants Museum, Ho Chi Minh City, Vietnam', cat: 'museum', min: 120 },
                        { name: 'Reunification Palace', q: 'Independence Palace, Ho Chi Minh City, Vietnam', cat: 'heritage', min: 90 },
                        { name: 'District 1', q: 'Nguyen Hue Walking Street, District 1, Ho Chi Minh City, Vietnam', cat: 'food', min: 120 },
                        { name: 'Cu Chi tunnels', q: 'Cu Chi Tunnels, Ho Chi Minh City, Vietnam', cat: 'heritage', min: 240 },
                    ] },
                    { days: '4', base: 'Mekong Delta', note: 'stay overnight in a homestay rather than day-tripping', stops: [
                        { name: 'Mekong Delta', q: 'Ben Tre, Mekong Delta, Vietnam', cat: 'nature', min: 360 },
                    ] },
                    { days: '5–6', base: 'Fly to Da Nang', travel: true, stops: [] },
                    { days: '7–10', base: 'Hoi An and central Vietnam', stops: [
                        { name: 'Hoi An old town', q: 'Hoi An Ancient Town, Hoi An, Vietnam', cat: 'heritage', min: 240 },
                        { name: 'An Bang beach', q: 'An Bang Beach, Hoi An, Vietnam', cat: 'beach', min: 180 },
                        { name: 'My Son', q: 'My Son Sanctuary, Quang Nam, Vietnam', cat: 'heritage', min: 180 },
                        { name: 'Hai Van Pass', q: 'Hai Van Pass, Vietnam', cat: 'viewpoint', min: 180 },
                    ] },
                ],
            },
        ],
    },

    'japan-beyond-tokyo-kyoto': {
        anchor: 'A Two-Week Alternative Route',
        options: [{
            id: 'japan-two-weeks',
            title: 'Japan beyond the classics',
            country: 'Japan',
            legs: [
                { days: '1–3', base: 'Tokyo', stops: [
                    { name: 'Tokyo', q: 'Tokyo Station, Tokyo, Japan', cat: 'place', min: 480 },
                ] },
                { days: '4', base: 'Takayama', stops: [
                    { name: 'Takayama old town', q: 'Sanmachi Suji, Takayama, Gifu, Japan', cat: 'heritage', min: 120 },
                    { name: 'Takayama morning market', q: 'Miyagawa Morning Market, Takayama, Gifu, Japan', cat: 'market', min: 60 },
                ] },
                { days: '5', base: 'Shirakawa-go, then Kanazawa', stops: [
                    { name: 'Shirakawa-go', q: 'Shirakawa-go, Gifu, Japan', cat: 'heritage', min: 180 },
                ] },
                { days: '6–7', base: 'Kanazawa', stops: [
                    { name: 'Kenroku-en', q: 'Kenroku-en, Kanazawa, Ishikawa, Japan', cat: 'garden', min: 120 },
                    { name: 'Nagamachi samurai district', q: 'Nagamachi Samurai District, Kanazawa, Japan', cat: 'heritage', min: 90 },
                    { name: 'Higashi Chaya', q: 'Higashi Chaya District, Kanazawa, Japan', cat: 'heritage', min: 90 },
                    { name: '21st Century Museum of Contemporary Art', q: '21st Century Museum of Contemporary Art, Kanazawa, Japan', cat: 'museum', min: 120 },
                    { name: 'Omicho Market', q: 'Omicho Market, Kanazawa, Japan', cat: 'market', min: 60 },
                ] },
                { days: '8–9', base: 'Kiso Valley', note: 'walk the Nakasendo between the two post towns', stops: [
                    { name: 'Magome', q: 'Magome-juku, Nakatsugawa, Gifu, Japan', cat: 'heritage', min: 90 },
                    { name: 'Tsumago', q: 'Tsumago-juku, Nagiso, Nagano, Japan', cat: 'heritage', min: 90 },
                ] },
                { days: '10–11', base: 'Kyoto', note: 'briefly, and early in the mornings', stops: [
                    { name: 'Kyoto', q: 'Kyoto Station, Kyoto, Japan', cat: 'place', min: 480 },
                ] },
                { days: '12–14', base: 'Naoshima and the Inland Sea', note: 'or fly to Kyushu for onsen', stops: [
                    { name: 'Naoshima', q: 'Naoshima, Kagawa, Japan', cat: 'museum', min: 360 },
                    { name: 'Teshima', q: 'Teshima, Tonosho, Kagawa, Japan', cat: 'museum', min: 240 },
                ] },
            ],
        }],
    },

    'georgia-armenia-caucasus-road-trip': {
        anchor: 'A Two-Week Route',
        options: [{
            id: 'caucasus-two-weeks',
            title: 'Georgia and Armenia in two weeks',
            country: 'Georgia',
            note: 'With three weeks, add Tusheti in Georgia and Dilijan and Lake Sevan in Armenia.',
            legs: [
                { days: '1–3', base: 'Tbilisi', country: 'Georgia', stops: [
                    { name: 'Abanotubani sulphur baths', q: 'Abanotubani, Tbilisi, Georgia', cat: 'heritage', min: 90 },
                    { name: 'Narikala Fortress', q: 'Narikala Fortress, Tbilisi, Georgia', cat: 'heritage', min: 90 },
                    { name: 'Dry Bridge Market', q: 'Dry Bridge Market, Tbilisi, Georgia', cat: 'market', min: 60 },
                ] },
                { days: '4–5', base: 'Kazbegi and the Military Highway', country: 'Georgia', stops: [
                    { name: 'Gergeti Trinity Church', q: 'Gergeti Trinity Church, Stepantsminda, Georgia', cat: 'heritage', min: 180 },
                    { name: 'Stepantsminda', q: 'Stepantsminda, Georgia', cat: 'place', min: 120 },
                ] },
                { days: '6–7', base: 'Kakheti wine country', country: 'Georgia', stops: [
                    { name: 'Sighnaghi', q: 'Sighnaghi, Kakheti, Georgia', cat: 'heritage', min: 180 },
                    { name: 'Telavi', q: 'Telavi, Kakheti, Georgia', cat: 'food', min: 120 },
                ] },
                { days: '8–10', base: 'Svaneti', country: 'Georgia', note: 'or Vardzia and Borjomi if the mountain roads are closed', stops: [
                    { name: 'Mestia', q: 'Mestia, Svaneti, Georgia', cat: 'place', min: 240 },
                    { name: 'Ushguli', q: 'Ushguli, Svaneti, Georgia', cat: 'heritage', min: 300 },
                ] },
                { days: '11', base: 'Cross to Armenia via Haghpat and Sanahin', country: 'Armenia', stops: [
                    { name: 'Haghpat Monastery', q: 'Haghpat Monastery, Lori, Armenia', cat: 'heritage', min: 60 },
                    { name: 'Sanahin Monastery', q: 'Sanahin Monastery, Alaverdi, Armenia', cat: 'heritage', min: 60 },
                ] },
                { days: '12–13', base: 'Yerevan', country: 'Armenia', stops: [
                    { name: 'The Cascade', q: 'Cascade Complex, Yerevan, Armenia', cat: 'viewpoint', min: 90 },
                    { name: 'Republic Square', q: 'Republic Square, Yerevan, Armenia', cat: 'place', min: 45 },
                    { name: 'Armenian Genocide Memorial', q: 'Armenian Genocide Memorial, Tsitsernakaberd, Yerevan', cat: 'museum', min: 120 },
                    { name: 'Matenadaran', q: 'Matenadaran, Yerevan, Armenia', cat: 'museum', min: 90 },
                    { name: 'Khor Virap', q: 'Khor Virap Monastery, Ararat Province, Armenia', cat: 'heritage', min: 120 },
                    { name: 'Garni Temple', q: 'Garni Temple, Garni, Armenia', cat: 'heritage', min: 90 },
                    { name: 'Geghard Monastery', q: 'Geghard Monastery, Kotayk, Armenia', cat: 'heritage', min: 90 },
                ] },
                { days: '14', base: 'Tatev and the Vorotan gorge', country: 'Armenia', stops: [
                    { name: 'Tatev cable car', q: 'Wings of Tatev, Halidzor, Armenia', cat: 'viewpoint', min: 60 },
                    { name: 'Tatev Monastery', q: 'Tatev Monastery, Syunik, Armenia', cat: 'heritage', min: 180 },
                ] },
            ],
        }],
    },

    'montenegro-slovenia-adriatic-alpine': {
        // The article treats these as two separate weeks, so they are two
        // options rather than one long trip with a flight in the middle.
        anchor: 'Slovenia',
        options: [
            {
                id: 'montenegro-week',
                title: 'Montenegro in a week',
                country: 'Montenegro',
                legs: [
                    { days: '1–3', base: 'The Bay of Kotor', stops: [
                        { name: 'Kotor old town', q: 'Kotor Old Town, Kotor, Montenegro', cat: 'heritage', min: 120 },
                        { name: 'Kotor fortifications', q: 'San Giovanni Fortress, Kotor, Montenegro', cat: 'viewpoint', min: 150 },
                        { name: 'Perast', q: 'Perast, Montenegro', cat: 'heritage', min: 120 },
                        { name: 'Our Lady of the Rocks', q: 'Our Lady of the Rocks, Perast, Montenegro', cat: 'heritage', min: 60 },
                    ] },
                    { days: '4–5', base: 'The coast', stops: [
                        { name: 'Budva old town', q: 'Budva Old Town, Budva, Montenegro', cat: 'heritage', min: 90 },
                        { name: 'Sveti Stefan', q: 'Sveti Stefan, Montenegro', cat: 'viewpoint', min: 60 },
                    ] },
                    { days: '6–7', base: 'Durmitor and the north', stops: [
                        { name: 'Ostrog Monastery', q: 'Ostrog Monastery, Montenegro', cat: 'heritage', min: 90 },
                        { name: 'Durmitor National Park', q: 'Black Lake, Durmitor National Park, Žabljak, Montenegro', cat: 'nature', min: 300 },
                        { name: 'Đurđevića Tara Bridge', q: 'Đurđevića Tara Bridge, Montenegro', cat: 'viewpoint', min: 60 },
                    ] },
                ],
            },
            {
                id: 'slovenia-week',
                title: 'Slovenia in a week',
                country: 'Slovenia',
                legs: [
                    { days: '1–2', base: 'Ljubljana', stops: [
                        { name: 'Ljubljana old town', q: 'Prešeren Square, Ljubljana, Slovenia', cat: 'heritage', min: 120 },
                        { name: 'Ljubljana Castle', q: 'Ljubljana Castle, Ljubljana, Slovenia', cat: 'heritage', min: 90 },
                        { name: 'Central Market', q: 'Ljubljana Central Market, Ljubljana, Slovenia', cat: 'market', min: 60 },
                    ] },
                    { days: '3–4', base: 'Lake Bled and Lake Bohinj', stops: [
                        { name: 'Lake Bled', q: 'Lake Bled, Bled, Slovenia', cat: 'nature', min: 180 },
                        { name: 'Bled Island', q: 'Bled Island, Bled, Slovenia', cat: 'heritage', min: 60 },
                        { name: 'Ojstrica viewpoint', q: 'Ojstrica, Bled, Slovenia', cat: 'viewpoint', min: 90 },
                        { name: 'Lake Bohinj', q: 'Lake Bohinj, Slovenia', cat: 'nature', min: 180 },
                        { name: 'Savica waterfall', q: 'Savica Waterfall, Bohinj, Slovenia', cat: 'nature', min: 90 },
                    ] },
                    { days: '5–6', base: 'The Soča Valley', stops: [
                        { name: 'Vršič Pass', q: 'Vršič Pass, Slovenia', cat: 'viewpoint', min: 120 },
                        { name: 'Great Soča Gorge', q: 'Great Soča Gorge, Soča, Slovenia', cat: 'nature', min: 60 },
                        { name: 'Kobarid museum', q: 'Kobarid Museum, Kobarid, Slovenia', cat: 'museum', min: 120 },
                        { name: 'Tolmin Gorges', q: 'Tolmin Gorges, Tolmin, Slovenia', cat: 'nature', min: 120 },
                    ] },
                    { days: '7–8', base: 'The Karst and the coast', stops: [
                        { name: 'Škocjan Caves', q: 'Škocjan Caves, Slovenia', cat: 'nature', min: 180 },
                        { name: 'Postojna Cave', q: 'Postojna Cave, Postojna, Slovenia', cat: 'nature', min: 150 },
                        { name: 'Piran', q: 'Piran, Slovenia', cat: 'heritage', min: 180 },
                    ] },
                ],
            },
        ],
    },

    'krabi-over-phuket-thailand-quieter-coast': {
        anchor: 'A Twelve-Day Route',
        options: [{
            id: 'krabi-twelve-days',
            title: 'Krabi and the islands in twelve days',
            country: 'Thailand',
            note: 'For a slower trip: Railay for three nights, Lanta for eight, and nothing else.',
            legs: [
                { days: '1–2', base: 'Ao Nang or Klong Muang', note: 'with one island day trip', stops: [
                    { name: 'Ao Nang', q: 'Ao Nang Beach, Krabi, Thailand', cat: 'beach', min: 180 },
                    { name: 'Hong Island', q: 'Koh Hong, Krabi, Thailand', cat: 'beach', min: 360 },
                ] },
                { days: '3–4', base: 'Railay', stops: [
                    { name: 'Railay', q: 'Railay Beach, Krabi, Thailand', cat: 'beach', min: 240 },
                    { name: 'Tonsai', q: 'Tonsai Beach, Krabi, Thailand', cat: 'beach', min: 120 },
                ] },
                { days: '5–8', base: 'Koh Lanta', stops: [
                    { name: 'Koh Lanta', q: 'Koh Lanta, Krabi, Thailand', cat: 'beach', min: 360 },
                    { name: 'Lanta old town', q: 'Lanta Old Town, Koh Lanta, Krabi, Thailand', cat: 'heritage', min: 120 },
                ] },
                { days: '9–11', base: 'Koh Kradan', note: 'or Koh Mook and its Emerald Cave', stops: [
                    { name: 'Koh Kradan', q: 'Koh Kradan, Trang, Thailand', cat: 'beach', min: 360 },
                ] },
                { days: '12', base: 'Back to Krabi for the flight', stops: [
                    { name: 'Krabi Town', q: 'Krabi Town Walking Street, Krabi, Thailand', cat: 'market', min: 120 },
                ] },
            ],
        }],
    },

    'northeast-india-itinerary': {
        anchor: 'A Two-Week Itinerary',
        options: [{
            id: 'northeast-two-weeks',
            title: 'Northeast India in two weeks',
            country: 'India',
            note: 'For Tawang, add at least six days — much of it is driving.',
            legs: [
                { days: '1', base: 'Guwahati', stops: [
                    { name: 'Kamakhya Temple', q: 'Kamakhya Temple, Guwahati, Assam, India', cat: 'temple', min: 90 },
                ] },
                { days: '2–5', base: 'Meghalaya', stops: [
                    { name: 'Shillong', q: 'Shillong, Meghalaya, India', cat: 'place', min: 180 },
                    { name: 'Nohkalikai Falls', q: 'Nohkalikai Falls, Cherrapunji, Meghalaya, India', cat: 'nature', min: 60 },
                    { name: 'Double Decker root bridge, Nongriat', q: 'Double Decker Living Root Bridge, Nongriat, Meghalaya, India', cat: 'nature', min: 360 },
                    { name: 'Mawlynnong', q: 'Mawlynnong, Meghalaya, India', cat: 'heritage', min: 120 },
                    { name: 'Dawki and the Umngot River', q: 'Umngot River, Dawki, Meghalaya, India', cat: 'nature', min: 180 },
                ] },
                { days: '6', base: 'Back to Guwahati, on toward Kaziranga', travel: true, stops: [] },
                { days: '7–9', base: 'Kaziranga', stops: [
                    { name: 'Kaziranga National Park', q: 'Kaziranga National Park, Assam, India', cat: 'wildlife', min: 480 },
                ] },
                { days: '10–12', base: 'Majuli via Jorhat', stops: [
                    { name: 'Majuli', q: 'Majuli, Assam, India', cat: 'heritage', min: 360 },
                ] },
                { days: '13–14', base: 'Ziro Valley', note: 'or back to Guwahati; Arunachal needs a permit', stops: [
                    { name: 'Ziro Valley', q: 'Ziro Valley, Arunachal Pradesh, India', cat: 'nature', min: 360 },
                ] },
            ],
        }],
    },

    'greece-beyond-santorini-islands': {
        anchor: 'A Ten-Day Cycladic Route',
        options: [{
            id: 'cyclades-ten-days',
            title: 'The Cyclades in ten days',
            country: 'Greece',
            note: 'For a slower trip: Naxos for six nights and Milos for four.',
            legs: [
                { days: '1–2', base: 'Athens', stops: [
                    { name: 'Athens', q: 'Syntagma Square, Athens, Greece', cat: 'place', min: 480 },
                ] },
                { days: '3–5', base: 'Milos', stops: [
                    { name: 'Sarakiniko', q: 'Sarakiniko Beach, Milos, Greece', cat: 'beach', min: 120 },
                    { name: 'Kleftiko', q: 'Kleftiko, Milos, Greece', cat: 'beach', min: 240 },
                    { name: 'Firiplaka', q: 'Firiplaka Beach, Milos, Greece', cat: 'beach', min: 180 },
                    { name: 'Tsigrado', q: 'Tsigrado Beach, Milos, Greece', cat: 'beach', min: 120 },
                    { name: 'Plaka', q: 'Plaka, Milos, Greece', cat: 'viewpoint', min: 120 },
                    { name: 'Klima', q: 'Klima, Milos, Greece', cat: 'heritage', min: 60 },
                ] },
                { days: '6–8', base: 'Folegandros', note: 'or Sifnos — Chrysopigi and Kastro', stops: [
                    { name: 'Chora', q: 'Chora, Folegandros, Greece', cat: 'heritage', min: 180 },
                    { name: 'Panagia church', q: 'Panagia Church, Folegandros, Greece', cat: 'viewpoint', min: 60 },
                ] },
                { days: '9–10', base: 'Naxos', stops: [
                    { name: 'Portara', q: 'Portara, Naxos, Greece', cat: 'heritage', min: 45 },
                    { name: 'Agios Prokopios', q: 'Agios Prokopios Beach, Naxos, Greece', cat: 'beach', min: 180 },
                    { name: 'Plaka beach', q: 'Plaka Beach, Naxos, Greece', cat: 'beach', min: 180 },
                    { name: 'Halki', q: 'Halki, Naxos, Greece', cat: 'heritage', min: 90 },
                    { name: 'Apeiranthos', q: 'Apeiranthos, Naxos, Greece', cat: 'heritage', min: 90 },
                ] },
            ],
        }],
    },

    'portugal-spain-rail-trip': {
        anchor: 'The Route',
        options: [{
            id: 'iberia-by-rail',
            title: 'Lisbon to Barcelona by train',
            country: 'Spain',
            legs: [
                { days: '1–3', base: 'Lisbon', country: 'Portugal', note: 'day trip to Sintra', stops: [
                    { name: 'Alfama', q: 'Alfama, Lisbon, Portugal', cat: 'heritage', min: 150 },
                    { name: 'Belém monastery', q: 'Jerónimos Monastery, Belém, Lisbon, Portugal', cat: 'heritage', min: 120 },
                    { name: 'LX Factory', q: 'LX Factory, Lisbon, Portugal', cat: 'market', min: 90 },
                    { name: 'Sintra', q: 'Sintra, Portugal', cat: 'heritage', min: 300 },
                ] },
                { days: '4–6', base: 'Porto', country: 'Portugal', note: 'take the Douro line to Pinhão and back', stops: [
                    { name: 'Ribeira', q: 'Ribeira, Porto, Portugal', cat: 'heritage', min: 120 },
                    { name: 'Livraria Lello', q: 'Livraria Lello, Porto, Portugal', cat: 'heritage', min: 45 },
                    { name: 'São Bento station', q: 'São Bento Station, Porto, Portugal', cat: 'heritage', min: 30 },
                    { name: 'Port houses, Vila Nova de Gaia', q: 'Vila Nova de Gaia, Portugal', cat: 'food', min: 120 },
                    { name: 'Douro Valley', q: 'Pinhão, Douro Valley, Portugal', cat: 'nature', min: 480 },
                ] },
                { days: '7–9', base: 'Salamanca, then Madrid', country: 'Spain', stops: [
                    { name: 'Salamanca', q: 'Plaza Mayor, Salamanca, Spain', cat: 'heritage', min: 120 },
                    { name: 'The Prado', q: 'Museo del Prado, Madrid, Spain', cat: 'museum', min: 180 },
                    { name: 'Reina Sofía', q: 'Museo Reina Sofía, Madrid, Spain', cat: 'museum', min: 150 },
                    { name: 'The Retiro', q: 'El Retiro Park, Madrid, Spain', cat: 'park', min: 90 },
                    { name: 'Toledo', q: 'Toledo, Spain', cat: 'heritage', min: 300 },
                ] },
                { days: '10–12', base: 'Seville and Andalusia', country: 'Spain', note: 'book the Alcázar and the Alhambra weeks ahead', stops: [
                    { name: 'The Alcázar', q: 'Real Alcázar of Seville, Seville, Spain', cat: 'heritage', min: 150 },
                    { name: 'Cathedral and Giralda', q: 'Seville Cathedral, Seville, Spain', cat: 'heritage', min: 120 },
                    { name: 'Santa Cruz', q: 'Barrio Santa Cruz, Seville, Spain', cat: 'heritage', min: 90 },
                    { name: 'Triana', q: 'Triana, Seville, Spain', cat: 'food', min: 90 },
                    { name: 'Córdoba Mezquita', q: 'Mosque-Cathedral of Córdoba, Córdoba, Spain', cat: 'heritage', min: 150 },
                    { name: 'The Alhambra', q: 'Alhambra, Granada, Spain', cat: 'heritage', min: 240 },
                ] },
                { days: '13–14', base: 'Valencia', country: 'Spain', stops: [
                    { name: 'City of Arts and Sciences', q: 'City of Arts and Sciences, Valencia, Spain', cat: 'museum', min: 180 },
                    { name: 'Turia riverbed park', q: 'Turia Gardens, Valencia, Spain', cat: 'park', min: 90 },
                ] },
                { days: '15–17', base: 'Barcelona', country: 'Spain', note: 'Gaudí sites need advance timed tickets', stops: [
                    { name: 'Sagrada Família', q: 'Sagrada Família, Barcelona, Spain', cat: 'heritage', min: 120 },
                    { name: 'Park Güell', q: 'Park Güell, Barcelona, Spain', cat: 'park', min: 120 },
                    { name: 'Casa Batlló', q: 'Casa Batlló, Barcelona, Spain', cat: 'heritage', min: 90 },
                    { name: 'Gothic Quarter', q: 'Gothic Quarter, Barcelona, Spain', cat: 'heritage', min: 120 },
                    { name: 'The Boqueria', q: 'La Boqueria Market, Barcelona, Spain', cat: 'market', min: 60 },
                ] },
            ],
        }],
    },

    'kashmir-spiti-sikkim-mountain-trips': {
        // Three separate trips; the article gives routes but not day counts
        // for Kashmir and Sikkim, so those legs carry no day labels.
        anchor: 'Which One Should You Choose?',
        options: [
            {
                id: 'kashmir-route',
                title: 'Kashmir',
                country: 'India',
                legs: [
                    { base: 'Srinagar', stops: [
                        { name: 'Dal Lake', q: 'Dal Lake, Srinagar, Jammu and Kashmir, India', cat: 'nature', min: 180 },
                        { name: 'Mughal gardens', q: 'Shalimar Bagh, Srinagar, Jammu and Kashmir, India', cat: 'garden', min: 90 },
                        { name: 'Shankaracharya Hill', q: 'Shankaracharya Temple, Srinagar, Jammu and Kashmir, India', cat: 'viewpoint', min: 90 },
                    ] },
                    { base: 'Gulmarg', stops: [
                        { name: 'Gulmarg Gondola', q: 'Gulmarg Gondola, Gulmarg, Jammu and Kashmir, India', cat: 'viewpoint', min: 240 },
                    ] },
                    { base: 'Pahalgam', stops: [
                        { name: 'Aru Valley', q: 'Aru Valley, Pahalgam, Jammu and Kashmir, India', cat: 'nature', min: 180 },
                        { name: 'Betaab Valley', q: 'Betaab Valley, Pahalgam, Jammu and Kashmir, India', cat: 'nature', min: 120 },
                    ] },
                    { base: 'Sonamarg', stops: [
                        { name: 'Thajiwas Glacier', q: 'Thajiwas Glacier, Sonamarg, Jammu and Kashmir, India', cat: 'nature', min: 240 },
                    ] },
                ],
            },
            {
                id: 'spiti-route',
                title: 'Spiti Valley',
                country: 'India',
                days: 10, // "at least ten days"
                note: 'Go in via Shimla and out via Manali — the slower climb is what prevents altitude sickness.',
                legs: [
                    { base: 'Kinnaur', stops: [
                        { name: 'Kalpa', q: 'Kalpa, Kinnaur, Himachal Pradesh, India', cat: 'place', min: 240 },
                        { name: 'Nako', q: 'Nako Lake, Kinnaur, Himachal Pradesh, India', cat: 'nature', min: 120 },
                    ] },
                    { base: 'Tabo and Dhankar', stops: [
                        { name: 'Tabo Monastery', q: 'Tabo Monastery, Spiti, Himachal Pradesh, India', cat: 'heritage', min: 90 },
                        { name: 'Dhankar Monastery', q: 'Dhankar Monastery, Spiti, Himachal Pradesh, India', cat: 'heritage', min: 90 },
                    ] },
                    { base: 'Kaza', stops: [
                        { name: 'Key Monastery', q: 'Key Monastery, Spiti, Himachal Pradesh, India', cat: 'heritage', min: 120 },
                        { name: 'Kibber', q: 'Kibber, Spiti, Himachal Pradesh, India', cat: 'place', min: 90 },
                        { name: 'Hikkim', q: 'Hikkim Post Office, Spiti, Himachal Pradesh, India', cat: 'place', min: 60 },
                        { name: 'Langza', q: 'Langza, Spiti, Himachal Pradesh, India', cat: 'place', min: 90 },
                    ] },
                    { base: 'Chandratal', stops: [
                        { name: 'Chandratal', q: 'Chandratal Lake, Lahaul and Spiti, Himachal Pradesh, India', cat: 'nature', min: 240 },
                    ] },
                    { base: 'Out via the Kunzum Pass to Manali', stops: [
                        { name: 'Kunzum Pass', q: 'Kunzum Pass, Himachal Pradesh, India', cat: 'viewpoint', min: 30 },
                        { name: 'Manali', q: 'Manali, Himachal Pradesh, India', cat: 'place', min: 240 },
                    ] },
                ],
            },
            {
                id: 'sikkim-route',
                title: 'Sikkim',
                country: 'India',
                note: 'North Sikkim must be booked through a registered operator, with permits.',
                legs: [
                    { base: 'Gangtok', stops: [
                        { name: 'MG Marg', q: 'MG Marg, Gangtok, Sikkim, India', cat: 'market', min: 90 },
                        { name: 'Rumtek Monastery', q: 'Rumtek Monastery, Sikkim, India', cat: 'heritage', min: 120 },
                        { name: 'Tsomgo Lake', q: 'Tsomgo Lake, Sikkim, India', cat: 'nature', min: 120 },
                    ] },
                    { base: 'North Sikkim — Lachung and Lachen', stops: [
                        { name: 'Yumthang Valley', q: 'Yumthang Valley, Lachung, Sikkim, India', cat: 'nature', min: 240 },
                        { name: 'Gurudongmar Lake', q: 'Gurudongmar Lake, North Sikkim, India', cat: 'nature', min: 240 },
                    ] },
                    { base: 'West Sikkim — Pelling and Yuksom', stops: [
                        { name: 'Pemayangtse Monastery', q: 'Pemayangtse Monastery, Pelling, Sikkim, India', cat: 'heritage', min: 90 },
                        { name: 'Yuksom', q: 'Yuksom, West Sikkim, India', cat: 'place', min: 120 },
                    ] },
                ],
            },
        ],
    },
};
