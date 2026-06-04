#!/usr/bin/env python3
import json
import os
import random
import re
import time

random.seed(42)

OUT_DIR = "/home/harsha/Projects/TrypInn (1)/TrypInn/public/must-visits"
os.makedirs(OUT_DIR, exist_ok=True)

UNSPLASH_IDS = [
    "1512343879784-a960bf40e7f2", "1477587458883-47145ed94245", "1626621341517-bbf3d9990a23",
    "1507525428034-b723cf961d3e", "1476514525535-07fb3b4ae5f1", "1524492412937-b28074a5d7da",
    "1469854523086-cc02fe5d8800", "1501785888041-af3ef285b470", "1506929562872-bb421503ef21",
    "1504150558240-1defce0f4ce0", "1537996194471-e657df975ab4", "1508672019048-805c876b67e2",
    "1436491865332-7a61a109cc05", "1488085061387-422e29b40080", "1500835556837-99ac94a94552",
    "1454391304352-2bf4678b1a7a", "1518509562904-e7ef99cdcc86", "1512453979798-5ea266f8880c",
    "1613395877344-13d4a8e0d49e", "1526772662000-3f88f10405ff", "1602216056096-3b40cc0c9944",
    "1493246507139-91e8fad9978e", "1504280390367-c479b9be15ae", "1530789253388-582c481c54b0",
    "1561361513-9e9f6e2e4e9e", "1548013146-7b0b8c9e5a6f", "1555993539-173e54f2821f",
    "1516483638261-f4dbaf036963", "1528127260108-a3aef7f22f7a", "1564507592033-7e4f13a7e7b6"
]

def make_img_url(idx, width):
    return f"https://images.unsplash.com/photo-{UNSPLASH_IDS[idx % len(UNSPLASH_IDS)]}?fm=webp&w={width}&q=60"

def slugify(s):
    return re.sub(r'-+', '-', re.sub(r'\s+', '-', re.sub(r'[^a-z0-9\s-]', '', s.lower()))).strip('-')

DESTINATIONS = [
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
]

import openai
from dotenv import load_dotenv
load_dotenv('/home/harsha/Projects/TrypInn (1)/TrypInn/.env')
openai.api_key = os.getenv('VITE_OPENAI_API_KEY')

def generate_batch(destinations):
    dests_str = ', '.join(destinations)
    prompt = f"""
Generate comprehensive Must-Visit Discovery Guides for these Indian destinations: {dests_str}.

For EACH destination, return a JSON object with:
- "state": Indian state or UT
- "tagline": catchy 5-10 word tagline
- "introduction": 150-250 word SEO intro containing: must visit places in [dest], best places to visit in [dest], tourist attractions in [dest], things to do in [dest], travel guide to [dest]
- "metaTitle": "25 Must Visit Places in [Dest] (2026) — Top Attractions | Trypinn"
- "metaDescription": 150 char SEO description
- "categories": array of 3 categories from: beach, mountain, heritage, spiritual, adventure, nature, wildlife, hill_station, city, desert, island, backwater, lake, historical, pilgrimage
- "attractions": exactly 25 attractions ordered by popularity, each with:
  - name, description (40-80 words), whyVisit (1 short sentence), bestTime, duration, mapsSearch (e.g. "Baga Beach, North Goa, India"), category (beach, temple, fort, nature, heritage, adventure, lake, waterfall, museum, park, market, viewpoint, religious, cave, wildlife, garden, palace, island, monastery, glacier, desert, nightlife), imagePrompt (vibrant travel photography prompt)

Return a JSON object where keys are destination names and values are the guide objects.
"""
    try:
        resp = openai.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        print(f"API error: {e}")
        return {}

def create_destination(dest_name, data):
    slug = slugify(dest_name)
    idx = DESTINATIONS.index(dest_name)
    dest_data = {
        "slug": slug,
        "name": dest_name,
        "state": data.get("state", ""),
        "tagline": data.get("tagline", ""),
        "categories": data.get("categories", []),
        "introduction": data.get("introduction", ""),
        "metaTitle": data.get("metaTitle", f"25 Must Visit Places in {dest_name} (2026) — Top Attractions | Trypinn"),
        "metaDescription": data.get("metaDescription", ""),
        "coverImage": make_img_url(idx, 1200),
        "attractions": []
    }
    for i, attr in enumerate(data.get("attractions", [])[:25]):
        attr["slug"] = slugify(attr["name"])
        attr["position"] = i + 1
        attr["coverImage"] = make_img_url(idx * 25 + i, 800)
        dest_data["attractions"].append(attr)
    with open(os.path.join(OUT_DIR, f"{slug}.json"), "w") as f:
        json.dump(dest_data, f, indent=2)
    return dest_data

def main():
    batch_size = 5
    index = []
    for i in range(0, len(DESTINATIONS), batch_size):
        batch = DESTINATIONS[i:i+batch_size]
        print(f"Generating batch {i//batch_size + 1}: {batch}")
        data = generate_batch(batch)
        for dest_name in batch:
            dest_data = data.get(dest_name, {})
            if dest_data:
                result = create_destination(dest_name, dest_data)
                index.append({
                    "slug": result["slug"],
                    "name": result["name"],
                    "state": result["state"],
                    "tagline": result["tagline"],
                    "coverImage": result["coverImage"],
                    "attractionCount": len(result["attractions"]),
                    "categories": result["categories"]
                })
            else:
                print(f"  Warning: no data for {dest_name}")
        time.sleep(2)
    with open(os.path.join(OUT_DIR, "index.json"), "w") as f:
        json.dump(index, f, indent=2)
    print(f"Done! Generated {len(index)} destinations.")

if __name__ == "__main__":
    main()

# Known destinations with real attractions (first 26)
KNOWN_DESTINATIONS = [
("Goa","Goa","Sun, sand, and Portuguese heritage on India's western coast",["beach","heritage","nightlife"],["Baga Beach:beach","Basilica of Bom Jesus:heritage","Dudhsagar Falls:waterfall","Anjuna Beach:beach","Fort Aguada:fort","Palolem Beach:beach","Chapora Fort:fort","Calangute Beach:beach","Se Cathedral:heritage","Arambol Beach:beach","Spice Plantations:nature","Dona Paula:viewpoint","Butterfly Beach:beach","Naval Aviation Museum:museum","Anjuna Flea Market:market","Reis Magos Fort:fort","Sinquerim Beach:beach","Shanta Durga Temple:temple","Tito's Street:nightlife","Colva Beach:beach","Church of St. Cajetan:heritage","Mollem National Park:wildlife","Vagator Beach:beach","Fontainhas:heritage","Mangeshi Temple:temple"]),
("Leh-Ladakh","Ladakh","High-altitude passes, turquoise lakes, and ancient Buddhist monasteries",["mountain","adventure","spiritual"],["Pangong Lake:lake","Nubra Valley:nature","Magnetic Hill:nature","Thiksey Monastery:monastery","Khardung La Pass:adventure","Hemis Monastery:monastery","Shanti Stupa:religious","Zanskar Valley:nature","Leh Palace:palace","Tso Moriri Lake:lake","Lamayuru Monastery:monastery","Chang La Pass:adventure","Alchi Monastery:monastery","Diskit Monastery:monastery","Hall of Fame:museum","Sangam Point:viewpoint","Turtuk Village:heritage","Stok Palace:palace","Shey Palace:palace","Dras Valley:nature","Kargil War Memorial:heritage","Markha Valley Trek:adventure","Tso Kar Lake:lake","Phyang Monastery:monastery","Spituk Monastery:monastery"]),
("Manali","Himachal Pradesh","A Himalayan paradise of snow-capped peaks and alpine meadows",["mountain","adventure","hill_station"],["Rohtang Pass:adventure","Solang Valley:adventure","Hadimba Temple:temple","Old Manali:heritage","Vashisht Hot Springs:nature","Manu Temple:temple","Jogini Waterfall:waterfall","Great Himalayan National Park:wildlife","Bhrigu Lake:lake","Hampta Pass:adventure","Mall Road Manali:market","Naggar Castle:fort","Beas River Rafting:adventure","Van Vihar:park","Gulaba Village:nature","Kothi Village:nature","Rahala Falls:waterfall","Manali Sanctuary:wildlife","Tibetan Monasteries:monastery","Hidimba Devi Temple:temple","Sissu Valley:nature","Atal Tunnel:heritage","Kasol Day Trip:nature","Manali Gompa:monastery","Chandratal Lake Trek:adventure"]),
("Kashmir","Jammu and Kashmir","Heaven on Earth with valleys, lakes, and Himalayan grandeur",["mountain","lake","heritage"],["Dal Lake:lake","Gulmarg:hill_station","Pahalgam:nature","Sonamarg:nature","Mughal Gardens:garden","Shankaracharya Temple:temple","Betaab Valley:nature","Aru Valley:nature","Yusmarg:nature","Hazratbal Shrine:religious","Jamia Masjid:religious","Nishat Bagh:garden","Shalimar Bagh:garden","Chashme Shahi:heritage","Awantipora Ruins:heritage","Thajiwas Glacier:glacier","Dachigam National Park:wildlife","Verinag Spring:nature","Kokernag:nature","Aharbal Waterfall:waterfall","Martand Sun Temple:heritage","Lolab Valley:nature","Doodhpathri:nature","Charar-e-Sharief:religious","Wular Lake:lake"]),
("Jaipur","Rajasthan","The Pink City — royal forts, vibrant bazaars, and Rajasthani grandeur",["heritage","city","desert"],["Amber Fort:fort","Hawa Mahal:palace","City Palace:palace","Jantar Mantar:heritage","Jal Mahal:palace","Nahargarh Fort:fort","Jaigarh Fort:fort","Albert Hall Museum:museum","Birla Mandir:temple","Johari Bazaar:market","Rambagh Palace:palace","Chokhi Dhani:heritage","Galta Ji Temple:temple","Sisodia Rani Garden:garden","Central Park:park","Anokhi Museum:museum","Raj Mandir Cinema:heritage","Bapu Bazaar:market","Panna Meena Ka Kund:heritage","Sargasuli Tower:heritage","Museum of Legacies:museum","Jawahar Kala Kendra:heritage","Ram Niwas Garden:garden","Abhaneri Stepwell Day Trip:heritage","Elefantastic Sanctuary:wildlife"]),
("Udaipur","Rajasthan","The City of Lakes — romance, palaces, and royal elegance",["heritage","lake","city"],["Lake Pichola:lake","City Palace Udaipur:palace","Jag Mandir:palace","Jagdish Temple:temple","Saheliyon Ki Bari:garden","Fateh Sagar Lake:lake","Sajjangarh Monsoon Palace:palace","Bagore Ki Haveli:heritage","Shilpgram:heritage","Ambrai Ghat:viewpoint","Vintage Car Museum:museum","Bada Bazaar:market","Eklingji Temple:temple","Nathdwara Temple:temple","Gulab Bagh:garden","Doodh Talai:lake","Ahar Cenotaphs:heritage","Lok Kala Mandal:museum","Sukhadia Circle:park","Under the Sun Aquarium:museum","Jaisamand Lake:lake","Haldi Ghati:heritage","Karni Mata Ropeway:adventure","Bhartiya Lok Kala Museum:museum","Neemach Mata Temple:temple"]),
("Taj Mahal","Uttar Pradesh","The timeless marble masterpiece and symbol of eternal love",["heritage","city","historical"],["Taj Mahal:heritage","Agra Fort:fort","Fatehpur Sikri:heritage","Mehtab Bagh:garden","Itmad-ud-Daulah's Tomb:heritage","Akbar's Tomb:heritage","Jama Masjid Agra:religious","Chini Ka Rauza:heritage","Mankameshwar Temple:temple","Ram Bagh:garden","Taj Museum:museum","Mariam's Tomb:heritage","Gurudwara Guru Ka Taal:religious","Wildlife SOS:wildlife","Sikandra Fort:fort","Anguri Bagh:garden","Diwan-i-Am Agra Fort:heritage","Musamman Burj:heritage","Jahangir Mahal:palace","Kinari Bazaar:market","Sadar Bazaar Agra:market","Taj Nature Walk:nature","Mughal Heritage Walk:heritage","Sur Sarovar Bird Sanctuary:wildlife","Bagh Mughal Gardens:garden"]),
("Rishikesh","Uttarakhand","The Yoga Capital of the World on the banks of the holy Ganges",["spiritual","adventure","nature"],["Laxman Jhula:heritage","Ram Jhula:heritage","Triveni Ghat:religious","Neelkanth Mahadev Temple:temple","White Water Rafting:adventure","Parmarth Niketan:religious","Beatles Ashram:heritage","Neer Garh Waterfall:waterfall","Kunjapuri Temple:temple","Swarg Ashram:religious","Gita Bhawan:religious","Vashishta Gufa:cave","Shivpuri Beach:beach","Jumpin Heights Bungee:adventure","Tera Manzil Temple:temple","Rishikund:heritage","Bharat Mandir:temple","Trayambakeshwar Temple:temple","Byasi:adventure","Marine Drive Rishikesh:nature","Phool Chatti Ashram:religious","Sivananda Ashram:religious","Rajaji National Park:wildlife","Garbhari Temple:temple","Kaudiyala:adventure"]),
("Varanasi","Uttar Pradesh","India's spiritual capital on the sacred Ganges",["spiritual","heritage","city"],["Kashi Vishwanath Temple:temple","Dashashwamedh Ghat:religious","Assi Ghat:religious","Sarnath:heritage","Manikarnika Ghat:religious","Ramnagar Fort:fort","Bharat Kala Bhavan:museum","Tulsi Manas Temple:temple","Durga Temple:temple","Banaras Hindu University:heritage","Chunar Fort:fort","Gyanvapi Mosque:religious","Vishalakshi Temple:temple","Alamgir Mosque:heritage","Sankat Mochan Temple:temple","Godowlia Market:market","Chowk Bazaar:market","Jantar Mantar Varanasi:heritage","Man Mandir Ghat:religious","Nepali Temple:temple","Kedar Ghat:religious","Rana Mahal Ghat:heritage","Harishchandra Ghat:religious","Panchganga Ghat:religious","Varanasi Silk Weavers:heritage"]),
("Kerala Backwaters","Kerala","Serene waterways, houseboats, and coconut-fringed village life",["backwater","nature","heritage"],["Alleppey Houseboat Cruise:backwater","Kumarakom Bird Sanctuary:wildlife","Vembanad Lake:lake","Pathiramanal Island:island","Kuttanad Region:backwater","Marari Beach:beach","Ambalappuzha Temple:temple","St. Mary's Forane Church:heritage","Karumadi Kuttan:heritage","Punnamada Lake:lake","Krishnapuram Palace:palace","Thottappally Beach:beach","R Block:backwater","Chavara Bhavan:heritage","Mannarasala Temple:temple","Triveni Floating Market:market","Kavalam Backwaters:backwater","Pulinkunnu:backwater","Nedumudi Village:heritage","Champakulam Church:heritage","Alappuzha Beach:beach","Vijay Beach Park:park","Mullakkal Temple:temple","Kuttanad Kayaking:adventure","Coconut Groves of Kumarakom:nature"]),
("Andaman Islands","Andaman and Nicobar","Pristine beaches, coral reefs, and tropical island paradise",["island","beach","adventure"],["Radhanagar Beach:beach","Cellular Jail:heritage","Havelock Island:island","Ross Island:island","Neil Island:island","Baratang Island:island","Scuba Diving at North Bay:adventure","Mahatma Gandhi Marine Park:wildlife","Chidiya Tapu:viewpoint","Limestone Caves:cave","Elephant Beach:beach","Kalapathar Beach:beach","Viper Island:island","Jolly Buoy Island:island","Mount Harriet National Park:wildlife","Cinque Island:island","Laxmanpur Beach:beach","Samudrika Marine Museum:museum","Anthropological Museum:museum","Wandoor Beach:beach","Saddle Peak:adventure","Diglipur:nature","Little Andaman:island","Long Island:island","Aberdeen Bazaar:market"]),
("Darjeeling","West Bengal","Tea gardens, toy trains, and Himalayan panoramas",["hill_station","nature","heritage"],["Tiger Hill:viewpoint","Darjeeling Himalayan Railway:heritage","Batasia Loop:viewpoint","Happy Valley Tea Estate:nature","Padmaja Naidu Zoo:wildlife","Ghoom Monastery:monastery","Japanese Peace Pagoda:religious","Rock Garden:garden","Observatory Hill:viewpoint","Himalayan Mountaineering Institute:museum","Senchal Lake:lake","Singalila National Park:wildlife","Lloyd's Botanical Garden:garden","Ava Art Gallery:museum","St. Andrew's Church:heritage","Mahakal Temple:temple","Chowrasta Mall:market","Tenzing Rock:adventure","Lebong Race Course:heritage","Dali Monastery:monastery","Rangeet Valley:nature","Darjeeling Ropeway:adventure","Nightingale Park:park","Bengal Natural History Museum:museum","Kurseong Day Trip:hill_station"]),
("Munnar","Kerala","Rolling tea plantations, misty hills, and aromatic spice gardens",["hill_station","nature","adventure"],["Eravikulam National Park:wildlife","Tea Museum:museum","Mattupetty Dam:lake","Anamudi Peak:adventure","Echo Point:viewpoint","Kundala Lake:lake","Top Station:viewpoint","Attukal Waterfalls:waterfall","Pothamedu Viewpoint:viewpoint","Marayoor Sandalwood Forest:nature","Chinnar Wildlife Sanctuary:wildlife","Blossom Park:park","Lockhart Gap:viewpoint","Lakkam Waterfalls:waterfall","Devikulam:nature","Nyayamkad Waterfalls:waterfall","Thoovanam Falls:waterfall","Kolukkumalai Tea Estate:nature","Meesapulimala:adventure","Rose Garden Munnar:garden","Photo Point:viewpoint","Carmelagiri Elephant Park:wildlife","Salim Ali Bird Sanctuary:wildlife","Pallivasal:nature","Munnar Spice Plantations:nature"]),
("Coorg","Karnataka","Scotland of India with coffee estates and misty Western Ghats",["hill_station","nature","adventure"],["Abbey Falls:waterfall","Raja's Seat:viewpoint","Dubare Elephant Camp:wildlife","Talakaveri:religious","Namdroling Monastery:monastery","Madikeri Fort:fort","Chelavara Falls:waterfall","Iruppu Falls:waterfall","Brahmagiri Peak:adventure","Pushpagiri Wildlife Sanctuary:wildlife","Cauvery Nisargadhama:nature","Omkareshwara Temple:temple","Mandalpatti:viewpoint","Tadiandamol Peak:adventure","Harangi Dam:lake","Golden Temple Bylakuppe:monastery","Coffee Plantations Tour:nature","Kotebetta:adventure","Nisargadhama Forest:nature","Gaddige Tombs:heritage","Mallalli Falls:waterfall","Nalknad Palace:palace","Chelavara Elephant Camp:wildlife","Honey Valley:nature","Kakkabe:nature"]),
("Jaisalmer","Rajasthan","The Golden City of desert forts and havelis in the Thar",["desert","heritage","adventure"],["Jaisalmer Fort:fort","Sam Sand Dunes:desert","Patwon Ki Haveli:heritage","Gadisar Lake:lake","Bada Bagh:heritage","Kuldhara Village:heritage","Salim Singh Ki Haveli:heritage","Nathmal Ki Haveli:heritage","Desert National Park:wildlife","Tanot Mata Temple:temple","Longewala War Memorial:heritage","Akal Wood Fossil Park:park","Khaba Fort:fort","Tazia Tower:heritage","Vyas Chhatri:heritage","Amar Sagar Jain Temple:temple","Mool Sagar:heritage","Desert Camel Safari:adventure","Dune Bashing:adventure","Desert Camping:adventure","Jaisalmer War Museum:museum","Gopa Chowk:market","Surya Gate:heritage","Laxminath Temple:temple","Silk Route Art Gallery:museum"]),
("Amritsar","Punjab","The spiritual and cultural heart of Sikhism",["spiritual","heritage","city"],["Golden Temple:religious","Jallianwala Bagh:heritage","Wagah Border Ceremony:heritage","Partition Museum:museum","Durgiana Temple:temple","Gobindgarh Fort:fort","Maharaja Ranjit Singh Museum:museum","Jama Masjid Khairuddin:religious","Ram Bagh Garden:garden","Pul Kanjri:heritage","Bhalla's Chaat Street:market","Hall Bazaar:market","Gurdwara Baba Atal:religious","Serai Amanat Khan:heritage","Mata Lal Devi Temple:temple","Sadda Pind:heritage","Khalsa College:heritage","Sun City Amritsar:park","Bharawan Da Dhaba:market","Gurdwara Tarn Taran Sahib:religious","Harike Wetland:wildlife","Rambagh Gardens:garden","Company Bagh:park","Gurdwara Chheharta Sahib:religious","Amritsar Heritage Walk:heritage"]),
("Hampi","Karnataka","The hauntingly beautiful ruins of the Vijayanagara Empire",["heritage","nature","adventure"],["Virupaksha Temple:temple","Vittala Temple Complex:heritage","Stone Chariot:heritage","Hemakuta Hill Temples:temple","Elephant Stables:heritage","Queen's Bath:heritage","Hazara Rama Temple:temple","Lakshmi Narasimha Statue:heritage","Tungabhadra River:nature","Matanga Hill:adventure","Anegundi Village:heritage","Sanapur Lake:lake","Coracle Ride:adventure","Underground Temple:temple","Sasivekalu Ganesha:heritage","Kadalekalu Ganesha:heritage","Badavi Linga:temple","Zenana Enclosure:heritage","Lotus Mahal:palace","Hampi Bazaar:market","Monolithic Bull:heritage","Talarigatta Gate:heritage","Riverside Ruins:heritage","Daroji Bear Sanctuary:wildlife","Anjanadri Hill:adventure"]),
("Meghalaya","Meghalaya","Living root bridges, misty hills, and the wettest place on Earth",["nature","adventure","heritage"],["Cherrapunji:nature","Living Root Bridges:heritage","Mawlynnong Village:heritage","Dawki River:nature","Nohkalikai Falls:waterfall","Mawsynram:nature","Umiam Lake:lake","Elephant Falls:waterfall","Shillong Peak:viewpoint","Laitlum Canyons:viewpoint","Mawphlang Sacred Forest:nature","Nohsngithiang Falls:waterfall","Wei Sawdong Falls:waterfall","Double Decker Living Root Bridge:heritage","Krang Suri Falls:waterfall","Balpakram National Park:wildlife","Nongkhnum Island:island","Mawkdok Dympep Valley:viewpoint","Siju Caves:cave","Jakrem Hot Springs:nature","Don Bosco Museum:museum","Ward's Lake:lake","Lady Hydari Park:park","Cathedral of Mary Help:heritage","David Scott Trail:adventure"]),
("Spiti Valley","Himachal Pradesh","Cold desert mountains, ancient monasteries, and stark Himalayan beauty",["mountain","adventure","spiritual"],["Key Monastery:monastery","Chandratal Lake:lake","Kunzum Pass:adventure","Tabo Monastery:monastery","Dhankar Monastery:monastery","Pin Valley National Park:wildlife","Kaza:nature","Kibber Village:nature","Langza Village:nature","Hikkim Village:heritage","Komic Village:nature","Lhalung Monastery:monastery","Sakya Tangyud Monastery:monastery","Gette Village:nature","Tashigang Village:nature","Demul Village:nature","Mudh Village:nature","Sagnam Village:nature","Shilla Peak:adventure","Chicham Bridge:heritage","Suraj Tal:lake","Baralacha La:adventure","Gue Mummy:heritage","Tangyud Monastery:monastery","Spiti River:nature"]),
("Rann of Kutch","Gujarat","The endless white salt desert under starlit skies",["desert","heritage","nature"],["White Rann:desert","Kala Dungar:viewpoint","Kutch Museum:museum","Aina Mahal:palace","Prag Mahal:palace","Bhujodi Village:heritage","Mandvi Beach:beach","Vijay Vilas Palace:palace","Narayan Sarovar:religious","Lakhpat Fort:fort","Dholavira:heritage","Great Rann Festival:heritage","Chhari Dhand Wetland:wildlife","Banni Grasslands:nature","Hamirsar Lake:lake","Sharad Baug Palace:palace","Rohda Village:heritage","Anjar:heritage","Tera Fort:fort","Koteshwar Temple:temple","Siyot Caves:cave","Indian Wild Ass Sanctuary:wildlife","Dhordo Village:heritage","Gandhi Nu Gam:heritage","Rann Utsav Tent City:heritage"]),
("Shimla","Himachal Pradesh","The Queen of Hills with colonial charm and mountain vistas",["hill_station","heritage","nature"],["The Ridge:viewpoint","Mall Road Shimla:market","Jakhoo Temple:temple","Kufri:hill_station","Christ Church:heritage","Green Valley:nature","Tara Devi Temple:temple","Indian Institute of Advanced Study:heritage","Kali Bari Temple:temple","Annandale:park","Shimla State Museum:museum","Chadwick Falls:waterfall","Summer Hill:nature","Himalayan Bird Park:wildlife","Shimla Heritage Walk:heritage","Gaiety Theatre:heritage","Viceregal Lodge:heritage","Johnnie's Wax Museum:museum","Naldehra Golf Course:park","Shaily Peak:viewpoint","Hatu Peak:adventure","Tattapani:nature","Mashobra:nature","Narkanda:hill_station","Kiala Forest:nature"]),
("Ooty","Tamil Nadu","Queen of the Nilgiris with toy trains and tea gardens",["hill_station","nature","heritage"],["Ooty Lake:lake","Botanical Gardens:garden","Nilgiri Mountain Railway:heritage","Doddabetta Peak:viewpoint","Rose Garden:garden","Emerald Lake:lake","Avalanche Lake:lake","Tea Museum:museum","St. Stephen's Church:heritage","Pykara Falls:waterfall","Kalhatty Waterfalls:waterfall","Mudumalai National Park:wildlife","Needle Rock Viewpoint:viewpoint","Kamraj Sagar Lake:lake","Wax World Museum:museum","Tribal Museum:museum","Elk Hill Murugan Temple:temple","Thread Garden:garden","Catherine Falls:waterfall","Ketti Valley:viewpoint","Pine Forest:nature","Upper Bhavani Lake:lake","Fernhill Palace:palace","Kodanad View Point:viewpoint","Bison Valley:nature"]),
("Nainital","Uttarakhand","The Lake District of India nestled in the Kumaon Hills",["hill_station","lake","nature"],["Naini Lake:lake","Naina Devi Temple:temple","Snow View Point:viewpoint","Tiffin Top:viewpoint","Eco Cave Gardens:cave","Raj Bhavan:heritage","Gurney House:heritage","Kilbury Bird Sanctuary:wildlife","High Altitude Zoo:wildlife","Pangot Village:nature","Sattal Lake:lake","Bhimtal Lake:lake","Naukuchiatal:lake","Mall Road Nainital:market","Aerial Ropeway:adventure","Land's End:viewpoint","Hanuman Garhi:temple","Nainital Ropeway:adventure","Jeolikot:nature","Khurpatal Lake:lake","Betal Ghat:nature","Kainchi Dham:temple","Mukteshwar Day Trip:hill_station","Ghorakhal Temple:temple","Sariyatal:lake"]),
("Mussoorie","Uttarakhand","The Queen of Hills with waterfalls and colonial architecture",["hill_station","nature","adventure"],["Kempty Falls:waterfall","Gun Hill:viewpoint","Mall Road Mussoorie:market","Lal Tibba:viewpoint","Company Garden:garden","Camel's Back Road:nature","Mussoorie Lake:lake","Jharipani Falls:waterfall","Bhatta Falls:waterfall","Nag Devta Temple:temple","Benog Wildlife Sanctuary:wildlife","Cloud's End:viewpoint","Happy Valley:nature","Jwalaji Temple:temple","Christ Church Mussoorie:heritage","Shedup Choepelling Temple:monastery","Sir George Everest House:heritage","Dhanaulti:nature","Landour:hill_station","Mossy Falls:waterfall","Soham Heritage Centre:museum","Jwala Devi Temple:temple","K Dev Bhoomi Wax Museum:museum","Lake Mist:lake","Drikshala Devi Temple:temple"]),
("Gangtok","Sikkim","A vibrant Himalayan city of monasteries, lakes, and mountain views",["hill_station","spiritual","nature"],["Nathula Pass:adventure","Tsomgo Lake:lake","Rumtek Monastery:monastery","MG Marg:market","Baba Harbhajan Singh Temple:temple","Enchey Monastery:monastery","Tashi Viewpoint:viewpoint","Ganesh Tok:temple","Hanuman Tok:temple","Namgyal Institute of Tibetology:museum","Do Drul Chorten:religious","Ban Jhakri Falls:waterfall","Himalayan Zoological Park:wildlife","Fambong Lho Wildlife Sanctuary:wildlife","Tinkitam:nature","Kanchenjunga Viewpoint:viewpoint","Pelling Day Trip:nature","Lachen Day Trip:nature","Yumthang Valley Day Trip:nature","Saramsa Garden:garden","Kyongnosla Alpine Sanctuary:wildlife","Seven Sisters Waterfalls:waterfall","Ranka Monastery:monastery","Institute of Tibetology:museum","Gonjang Monastery:monastery"]),
("Pondicherry","Puducherry","French colonial charm meets Indian coastal culture",["beach","heritage","city"],["Promenade Beach:beach","Auroville:heritage","Matrimandir:religious","French Quarter:heritage","Paradise Beach:beach","Aurobindo Ashram:religious","Basilica of the Sacred Heart:heritage","Chunnambar Boat House:lake","Serenity Beach:beach","Botanical Garden Pondicherry:garden","Pondicherry Museum:museum","Goubert Avenue:heritage","Manakula Vinayagar Temple:temple","Ousteri Lake:lake","Arikamedu:heritage","Rock Beach:beach","Veerampattinam Beach:beach","Raj Nivas:heritage","Eglise de Notre Dame:heritage","Church of Our Lady of Angels:heritage","Bharathi Park:park","Karaikal Beach:beach","Pichavaram Mangroves:nature","Kallialay Temple:temple","Heritage Walk White Town:heritage"]),
("Hyderabad","Telangana","The City of Pearls where Nizami heritage meets modern tech",["city","heritage","market"],["Charminar:heritage","Golconda Fort:fort","Ramoji Film City:park","Hussain Sagar Lake:lake","Salar Jung Museum:museum","Qutb Shahi Tombs:heritage","Chowmahalla Palace:palace","Birla Mandir Hyderabad:temple","Laad Bazaar:market","Mecca Masjid:religious","Nehru Zoological Park:wildlife","Lumbini Park:park","Taramati Baradari:heritage","Paigah Tombs:heritage","NTR Gardens:garden","Shilparamam:heritage","Durgam Cheruvu:lake","Snow World:park","Jagannath Temple Hyderabad:temple","Chilkur Balaji Temple:temple","KBR National Park:wildlife","Gandipet Lake:lake","Moula Ali Dargah:religious","Sanghi Temple:temple","Wonderla Amusement Park:park"]),
("Mysuru","Karnataka","The cultural capital with royal palaces and sandalwood heritage",["heritage","city","nature"],["Mysore Palace:palace","Chamundi Hills:temple","Brindavan Gardens:garden","St. Philomena's Church:heritage","Mysore Zoo:wildlife","Jaganmohan Palace:palace","Karanji Lake:lake","Rail Museum Mysore:museum","Devaraja Market:market","Srirangapatna:heritage","Ranganathittu Bird Sanctuary:wildlife","Kukkarahalli Lake:lake","Lalitha Mahal Palace:palace","GRS Fantasy Park:park","Folklore Museum:museum","Wax Museum Mysore:museum","KRS Dam:lake","Bonsai Garden:garden","Freedom Fighters Park:park","Regional Museum of Natural History:museum","Chamundeshwari Temple:temple","Nandi Statue:heritage","Happy Man Park:park","Crawford Hall:heritage","Sandalwood Oil Factory:heritage"]),
("Chikmagalur","Karnataka","Coffee land of Karnataka with misty hills and waterfalls",["hill_station","nature","adventure"],["Mullayanagiri Peak:adventure","Baba Budangiri:nature","Hebbe Falls:waterfall","Kudremukh National Park:wildlife","Coffee Plantations:nature","Kemmangundi:hill_station","Z Point:viewpoint","Kalhatti Falls:waterfall","Bhadra Wildlife Sanctuary:wildlife","Horanadu Annapoorneshwari Temple:temple","Ayyanakere Lake:lake","Balehonnur:nature","Belavadi Temple:temple","Amruthapura Temple:temple","Kallathigiri Falls:waterfall","Jhari Waterfalls:waterfall","Datta Peeta:religious","Sringeri Sharada Peetham:temple","Hanumana Gundi Falls:waterfall","Gangamoola:nature","Kyatanamakki Hills:viewpoint","Devaramane Viewpoint:viewpoint","Aldur Lake:lake","Koppa:nature","Lakkavalli:nature"]),

# Template pools for generating attractions programmatically
POOLS = {
    "beach": ["Main Beach","Sunset Beach","Lighthouse Beach","Paradise Beach","Rock Beach","Golden Beach","Silver Beach","Coral Beach","Palm Beach","Secret Beach","Hidden Cove","Beach Shacks","Water Sports Centre","Beach Market","Fishing Village","Coastal Temple","Sea View Point","Marine Aquarium","Beach Park","Sunset Point","Beach Resort","Backwater Estuary","Lagoon","Coral Reef","Dolphin Point"],
    "temple": ["Ancient Temple","Shiva Temple","Vishnu Temple","Devi Temple","Hanuman Temple","Ganesha Temple","Krishna Temple","Jain Temple","Buddhist Temple","Sun Temple","Moon Temple","Cave Temple","Hilltop Temple","Riverside Temple","Temple Complex","Sacred Pond","Temple Tank","Prayer Hall","Monastery","Ashram","Gurudwara","Mosque","Church","Cathedral","Basilica"],
    "fort": ["Main Fort","Hill Fort","Desert Fort","Sea Fort","Palace Fort","Old Fort","Citadel","Watchtower","Bastion","Ramparts","Fort Museum","Fort Temple","Fort Garden","Secret Tunnel","Dungeon","Armory","Royal Chambers","Durbar Hall","Fort Lake","Fort Market","Heritage Walk","Light and Sound Show","Fort Viewpoint","War Memorial","Canon Point"],
    "nature": ["National Park","Wildlife Sanctuary","Bird Sanctuary","Nature Reserve","Forest Trail","Valley View","Mountain Pass","Waterfall","Cascades","Natural Pool","Hot Springs","Meadow","Grassland","Wetland","Mangrove Forest","Rainforest","Alpine Meadow","Canyon","Gorge","Cliff Face","Rock Formation","Cave System","Natural Bridge","Arch","Sinkhole"],
    "heritage": ["Old City","Heritage Walk","Ancient Ruins","Archaeological Site","Stepwell","Monument","Memorial","Mausoleum","Cenotaph","Gateway","Clock Tower","Town Hall","Old Market","Heritage Hotel","Colonial Building","Traditional Village","Craft Village","Pottery Centre","Weaving Centre","Art Gallery","Folk Museum","Cultural Centre","Dance School","Music Academy","Heritage Festival"],
    "adventure": ["Trekking Base","Rock Climbing Point","Paragliding Site","River Rafting","Kayaking Point","Zip Line","Rope Bridge","Mountain Bike Trail","Jeep Safari","Camel Safari","Elephant Ride","Horse Riding","Ski Slope","Snowboarding","Ice Climbing","Caving Expedition","Scuba Diving","Snorkelling Point","Deep Sea Fishing","Surfing Point","Bungee Jumping","Skydiving","Helicopter Ride","Balloon Ride","Night Safari"],
    "lake": ["Main Lake","Upper Lake","Lower Lake","Hidden Lake","Backwaters","Reservoir","Dam","Barrage","Lagoon","Estuary","Lake Garden","Boat House","Lake Temple","Lake Palace","Floating Market","Lake Viewpoint","Sunset Lake","Moonlight Lake","Fishing Lake","Bird Lake","Lotus Lake","Crocodile Lake","Sailing Club","Water Sports Lake","Lake Island"],
    "waterfall": ["Main Falls","Upper Falls","Lower Falls","Hidden Falls","Twin Falls","Rainbow Falls","Misty Falls","Thunder Falls","Cascading Falls","Tiered Falls","Plunge Falls","Horsetail Falls","Frozen Falls","Sacred Falls","Medicinal Falls","Swimming Falls","Picnic Falls","Trekking Falls","Monsoon Falls","Dry Falls","Seasonal Falls","Cave Falls","Temple Falls","Village Falls","Sunset Falls"],
    "museum": ["City Museum","State Museum","Rail Museum","Art Museum","Science Museum","Natural History Museum","Folk Museum","War Museum","Maritime Museum","Aviation Museum","Archaeological Museum","Textile Museum","Toy Museum","Wax Museum","Tribal Museum","Handicraft Museum","Photography Museum","Numismatics Museum","Botanical Museum","Zoological Museum","Planetarium","Observatory"," aquarium","Heritage Centre","Cultural Museum"],
    "park": ["City Park","Central Park","Botanical Park","Rose Garden","Orchid Garden","Butterfly Park","Deer Park","Elephant Park","Tiger Park","Lion Park","Bear Park","Monkey Park","Bird Park","Peacock Park","Crocodile Park","Snake Park","Turtle Park","Fish Park","Dinosaur Park","Amusement Park","Water Park","Theme Park","Adventure Park","Safari Park","Eco Park"],
    "market": ["Main Bazaar","Old Market","Night Market","Flea Market","Fish Market","Flower Market","Spice Market","Vegetable Market","Fruit Market","Textile Market","Jewelry Market","Handicraft Market","Pottery Market","Sandalwood Market","Silk Market","Carpet Market","Leather Market","Metalware Market","Antique Market","Book Market","Art Market","Street Food Market","Sweet Market","Tea Market","Coffee Market"],
    "viewpoint": ["Sunrise Point","Sunset Point","Panorama Point","Valley View","Peak View","Cliff View","Hill View","Mountain View","Sea View","Lake View","River View","Forest View","City View","Fort View","Temple View","Waterfall View","Bird's Eye View","Eagle's Nest","Lovers Point","Honeymoon Point","Photography Point","Selfie Point","Trekking Point","Camping Point","Picnic Point"],
    "religious": ["Main Shrine","Holy Pond","Sacred Tree","Prayer Hall","Meditation Centre","Pilgrim Centre","Religious School","Charitable Kitchen","Community Hall","Religious Library","Scripture House","Bell Tower","Flag Pole","Sacred Fire","Holy Mountain","Sacred River","Divine Spring","Blessed Cave","Miracle Site","Healing Centre","Spiritual Retreat","Yoga Centre","Astrology Centre","Ritual Bath","Festival Ground"],
    "cave": ["Ancient Cave","Rock Cut Cave","Buddhist Cave","Jain Cave","Hindu Cave","Shiva Cave","Vishnu Cave","Elephant Cave","Tiger Cave","Lion Cave","Bear Cave","Bat Cave","Crystal Cave","Limestone Cave","Sandstone Cave","Granite Cave","Water Cave","Dry Cave","Underground River","Subterranean Lake","Cave Temple","Cave Monastery","Cave Dwelling","Cave Painting","Cave Museum"],
    "wildlife": ["Tiger Reserve","Elephant Corridor","Leopard Spot","Lion Safari","Bear Habitat","Deer Park","Antelope Ground","Bison Range","Wolf Den","Fox Burrow","Jackal Zone","Hyena Lair","Crocodile Bank","Turtle Beach","Dolphin Bay","Whale Point","Shark Reef","Coral Garden","Butterfly Garden","Moth Colony","Bee Farm","Bird Observatory","Eagle Point","Vulture Cliff","Stork Colony"],
    "garden": ["Rose Garden","Orchid House","Lily Pond","Lotus Garden","Sunflower Field","Marigold Garden","Jasmine Walk","Lavender Field","Herb Garden","Medicinal Garden","Spice Garden","Tea Garden","Coffee Estate","Fruit Orchard","Vegetable Patch","Bonsai Garden","Cactus Garden","Fern House","Palm Grove","Bamboo Grove","Pine Forest","Cedar Walk","Maple Avenue","Cherry Blossom","Wisteria Lane"],
    "palace": ["Main Palace","Summer Palace","Winter Palace","Lake Palace","Hill Palace","Fort Palace","City Palace","Royal Palace","Maharaja Palace","Maharani Palace","Crown Palace","Golden Palace","Silver Palace","Marble Palace","Crystal Palace","Mirror Palace","Music Room","Dance Hall","Durbar Hall","Private Chambers","Royal Kitchen","Royal Stable","Royal Garden","Royal Museum","Royal Tomb"],
    "island": ["Main Island","North Island","South Island","East Island","West Island","Coral Island","Volcanic Island","Desert Island","Forest Island","Mountain Island","Bird Island","Turtle Island","Dolphin Island","Whale Island","Monkey Island","Lion Island","Elephant Island","Tiger Island","Snake Island","Crocodile Island","Pearl Island","Gem Island","Spice Island","Tea Island","Coffee Island"],
    "monastery": ["Main Gompa","Ancient Monastery","Hill Monastery","Valley Monastery","Cave Monastery","Forest Monastery","Lake Monastery","River Monastery","Snow Monastery","Desert Monastery","Meditation Hall","Prayer Wheel","Stupa","Chorten","Mani Wall","Prayer Flag","Monk Quarters","Library","Scripture Room","Art Studio","Mask Workshop","Festival Ground","Pilgrim Path","Holy Spring","Sacred Tree"],
    "glacier": ["Main Glacier","Tributary Glacier","Ice Field","Ice Cap","Ice Shelf","Ice Cave","Ice Bridge","Icefall","Serac Field","Moraine Lake","Glacial Lake","Ice Lake","Frozen Waterfall","Ice Tunnel","Crevasse","Ice Ridge","Ice Peak","Ice Valley","Ice River","Ice Stream","Snow Bridge","Snow Field","Snow Dome","Firn Basin","Neve Bowl"],
    "desert": ["Sand Dunes","Salt Flats","Rock Desert","Stone Desert","Clay Desert","Gypsum Desert","Oasis","Desert Spring","Desert Well","Desert Lake","Desert River","Desert Garden","Desert Farm","Desert Village","Desert Fort","Desert Palace","Desert Temple","Desert Shrine","Desert Market","Desert Camp","Camel Farm","Desert Observatory","Desert Museum","Desert Park","Desert Reserve"],
    "nightlife": ["Club Street","Pub Lane","Bar District","Lounge Area","Rooftop Bar","Beach Club","Pool Party","DJ Arena","Live Music Venue","Jazz Club","Comedy Club","Karaoke Bar","Dance Floor","Night Market","Late Night Cafe","Midnight Diner","24-Hour Restaurant","Casino","Bowling Alley","Arcade","Night Cinema","Drive-In Theatre","Sunset Cruise","Moonlight Cruise","Stargazing Point"],
    "hill_station": ["Mall Road","The Ridge","The Mall","Chowk","Bazaar Road","Temple Road","Church Road","School Road","Hospital Road","Post Office","Library Hill","Club House","Tennis Court","Golf Course","Polo Ground","Race Course","Ice Skating Rink","Toboggan Run","Sledging Hill","Snow Point","Zero Point","View Tower","Observation Deck","Weather Station","Radio Tower"],
    "backwater": ["Main Canal","Branch Canal","Side Channel","Cross Canal","Link Canal","Feeder Canal","Navigation Canal","Irrigation Canal","Drainage Canal","Creek","Inlet","Outlet","Delta","Estuary","Marsh","Swamp","Fen","Bog","Paddy Field","Coconut Grove","Mangrove Bank","Fishing Village","Boat Jetty","Ferry Point","Bridge Crossing"],
}

CATEGORY_MAP = {
    "beach": ["beach","heritage","nightlife","nature","market","viewpoint","religious","park","museum","adventure"],
    "mountain": ["nature","adventure","viewpoint","lake","waterfall","temple","monastery","heritage","wildlife","park"],
    "heritage": ["heritage","temple","fort","palace","museum","market","garden","religious","cave","park"],
    "spiritual": ["temple","religious","monastery","heritage","lake","nature","waterfall","cave","garden","viewpoint"],
    "adventure": ["adventure","nature","viewpoint","waterfall","lake","temple","heritage","wildlife","park","glacier"],
    "nature": ["nature","wildlife","waterfall","lake","viewpoint","heritage","temple","adventure","park","garden"],
    "wildlife": ["wildlife","nature","lake","viewpoint","temple","heritage","adventure","park","garden","museum"],
    "hill_station": ["viewpoint","lake","garden","heritage","temple","waterfall","nature","park","adventure","museum"],
    "city": ["heritage","market","museum","temple","park","palace","religious","garden","lake","nightlife"],
    "desert": ["desert","heritage","temple","lake","nature","adventure","viewpoint","park","wildlife","museum"],
    "island": ["beach","island","nature","adventure","heritage","temple","viewpoint","museum","park","religious"],
    "backwater": ["backwater","lake","nature","heritage","temple","bird sanctuary","park","garden","viewpoint","market"],
    "lake": ["lake","viewpoint","nature","heritage","temple","park","garden","adventure","museum","religious"],
    "historical": ["heritage","fort","palace","museum","temple","market","garden","religious","lake","nature"],
    "pilgrimage": ["temple","religious","lake","heritage","garden","nature","cave","monastery","museum","viewpoint"],
}
("Kodaikanal","Tamil Nadu","The Princess of Hill Stations with misty forests and star-shaped lake",["hill_station","nature","adventure"]),
("Tirupati","Andhra Pradesh","The spiritual powerhouse atop the Seven Hills of Tirumala",["spiritual","heritage","nature"]),
("Puri","Odisha","Sacred shores and the abode of Lord Jagannath on the Bay of Bengal",["spiritual","beach","heritage"]),
("Madurai","Tamil Nadu","The Athens of the East with ancient temples and vibrant culture",["heritage","spiritual","city"]),
("Agra","Uttar Pradesh","Mughal grandeur and timeless architectural masterpieces",["heritage","city","historical"]),
("Delhi","Delhi","India's historic capital where ancient monuments meet modern culture",["city","heritage","market"]),
("Jodhpur","Rajasthan","The Blue City dominated by the mighty Mehrangarh Fort",["heritage","desert","city"]),
("Pushkar","Rajasthan","A sacred lake town surrounded by desert hills and camel fairs",["spiritual","desert","heritage"]),
("Auli","Uttarakhand","India's premier ski resort with panoramic Himalayan views",["mountain","adventure","nature"]),
("Kovalam","Kerala","Crescent-shaped beaches and Ayurvedic retreats on the Arabian Sea",["beach","nature","heritage"]),
("Wayanad","Kerala","Lush green hills, spice plantations, and ancient caves in the Western Ghats",["nature","adventure","heritage"]),
("Gokarna","Karnataka","Serene beaches and ancient temples on Karnataka's sacred coast",["beach","spiritual","nature"]),
("Varkala","Kerala","Cliffside beaches and Ayurvedic wellness on the Arabian Sea",["beach","spiritual","nature"]),
("Shillong","Meghalaya","The Scotland of the East with rolling hills and vibrant music",["hill_station","nature","heritage"]),
("Cherrapunji","Meghalaya","The wettest place on Earth with living root bridges and waterfalls",["nature","adventure","heritage"]),
("Kodaikanal","Tamil Nadu","The Princess of Hill Stations",["hill_station","nature","adventure"]),
("Tirupati","Andhra Pradesh","The spiritual powerhouse",["spiritual","heritage","nature"]),("Puri","Odisha","Sacred shores",["spiritual","beach","heritage"]),
("Madurai","Tamil Nadu","The Athens of the East",["heritage","spiritual","city"]),("Agra","Uttar Pradesh","Mughal grandeur",["heritage","city","historical"]),("Delhi","Delhi","India's historic capital",["city","heritage","market"]),
("Jodhpur","Rajasthan","The Blue City",["heritage","desert","city"]),("Pushkar","Rajasthan","A sacred lake town",["spiritual","desert","heritage"]),("Auli","Uttarakhand","India's premier ski resort",["mountain","adventure","nature"]),
("Kovalam","Kerala","Crescent-shaped beaches",["beach","nature","heritage"]),("Wayanad","Kerala","Lush green hills",["nature","adventure","heritage"]),("Gokarna","Karnataka","Serene beaches",["beach","spiritual","nature"]),
("Varkala","Kerala","Cliffside beaches",["beach","spiritual","nature"]),("Shillong","Meghalaya","The Scotland of the East",["hill_station","nature","heritage"]),("Cherrapunji","Meghalaya","The wettest place",["nature","adventure","heritage"]),
