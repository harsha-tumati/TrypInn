import json, os, random

OUT = "/home/harsha/Projects/TrypInn (1)/TrypInn/public/must-visits"
os.makedirs(OUT, exist_ok=True)

uids = [
    "1512343879784-a960bf40e7f2","1477587458883-47145ed94245","1626621341517-bbf3d9990a23",
    "1507525428034-b723cf961d3e","1476514525535-07fb3b4ae5f1","1524492412937-b28074a5d7da",
    "1469854523086-cc02fe5d8800","1501785888041-af3ef285b470","1506929562872-bb421503ef21",
    "1504150558240-1defce0f4ce0","1537996194471-e657df975ab4","1508672019048-805c876b67e2",
    "1436491865332-7a61a109cc05","1488085061387-422e29b40080","1500835556837-99ac94a94552",
    "1454391304352-2bf4678b1a7a","1518509562904-e7ef99cdcc86","1512453979798-5ea266f8880c",
    "1613395877344-13d4a8e0d49e","1526772662000-3f88f10405ff","1602216056096-3b40cc0c9944",
    "1501785888041-af3ef285b470","1493246507139-91e8fad9978e","1504280390367-c479b9be15ae",
    "1530789253388-582c481c54b0","1561361513-9e9f6e2e4e9e","1548013146-7b0b8c9e5a6f",
    "1555993539-173e54f2821f","1516483638261-f4dbaf036963","1528127260108-a3aef7f22f7a",
    "1564507592033-7e4f13a7e7b6","1570077188670-e3a8d69ac5ff","1494783365793-7a0b0e1a8b9e",
    "1506744038136-46273834b3fb","1518544861688-e7d33b8f7e1c","1520250497591-112c4f5e3e5e",
    "1534234828563-022d27c3f2d5","1504198458649-3128b932f49e","1562569633-944b482d2ca8",
    "1516939884455-1445c4b8d6bf","1571896349782-68c9c0c0e2a3","1544644181-7e7e4c0e5d6b",
    "1504384308090-c54be3855835","1534008897995-d0e4b4e5e6e7","1570053903894-4e0e4e4e4e4e",
    "1526772662000-3f88f10405ff","1512453979798-5ea266f8880c","1613395877344-13d4a8e0d49e",
    "1524492412937-b28074a5d7da","1469854523086-cc02fe5d8800","1501785888041-af3ef285b470"
]

def img(seed, w=800):
    return f"https://images.unsplash.com/photo-{uids[abs(hash(seed)) % len(uids)]}?fm=webp&w={w}&q=60"

def prmpt(a, d):
    return f"Ultra realistic travel photography, golden hour lighting, vibrant colors, {a} in {d}, tourists enjoying the view, DSLR quality, 4k, cinematic composition, highly detailed"

def intro(name, state, h):
    return f"When travelers search for must visit places in {name}, they discover a destination that truly rewards curiosity. The best places to visit in {name} span from {h[0]} to {h[1]}. As one of the top tourist attractions in {name}, each spot tells a unique story of {state} rich heritage. Whether you are looking for things to do in {name} over a weekend or planning a longer escape, this travel guide to {name} covers every must-see experience. From iconic landmarks to hidden corners, these curated picks ensure you experience the very best of {name}."

def slugify(s):
    return s.lower().replace("'", "").replace(",", "").replace(".", "").replace("&", "and").replace("  ", " ").strip().replace(" ", "-")

# Destination metadata: name, state, tagline, categories, highlights
META = [
("Goa","Goa","Sun, sand, and Portuguese heritage on India's western coast",["beach","heritage","nightlife"],["golden beaches","historic churches"]),
("Leh-Ladakh","Ladakh","High-altitude passes, turquoise lakes, and ancient Buddhist monasteries",["mountain","adventure","spiritual"],["pangong lake","khardung la pass"]),
("Manali","Himachal Pradesh","Snow-capped peaks, pine forests, and the adventure capital of India",["mountain","adventure","hill_station"],["rohtang pass","solang valley"]),
("Kashmir","Jammu and Kashmir","Paradise on Earth — valleys, lakes, and Himalayan grandeur",["mountain","nature","lake"],["dal lake","gulmarg meadows"]),
("Jaipur","Rajasthan","The Pink City — royal forts, vibrant bazaars, and Rajasthani grandeur",["heritage","city","desert"],["amber fort","hawamahal"]),
("Udaipur","Rajasthan","The City of Lakes — palaces, romance, and royal heritage",["heritage","lake","city"],["lake pichola","city palace"]),
("Taj Mahal","Uttar Pradesh","The timeless marble monument and symbol of eternal love",["heritage","city","historical"],["taj mahal","agra fort"]),
("Rishikesh","Uttarakhand","The yoga capital of the world on the banks of the Ganges",["spiritual","adventure","nature"],["lakshman jhula","river rafting"]),
("Varanasi","Uttar Pradesh","India's spiritual capital on the sacred Ganges",["spiritual","heritage","city"],["dashashwamedh ghat","kashi vishwanath temple"]),
("Kerala Backwaters","Kerala","A network of serene lagoons, canals, and lakes along the Arabian Sea",["backwater","nature","beach"],["alleppey houseboats","kumarakom"]),
("Andaman Islands","Andaman and Nicobar","Pristine beaches, coral reefs, and tropical rainforests in the Bay of Bengal",["island","beach","adventure"],["radhanagar beach","cellular jail"]),
("Darjeeling","West Bengal","Tea gardens, toy trains, and Himalayan vistas",["hill_station","nature","heritage"],["tiger hill","batasia loop"]),
("Munnar","Kerala","Tea-covered hills, misty valleys, and colonial charm",["hill_station","nature","adventure"],["tea gardens","eravikulam national park"]),
("Coorg","Karnataka","Coffee estates, misty hills, and Kodava culture",["nature","hill_station","adventure"],["abbey falls","coffee plantations"]),
("Jaisalmer","Rajasthan","The Golden City of sandstone forts and desert magic",["desert","heritage","adventure"],["jaisalmer fort","sam sand dunes"]),
("Amritsar","Punjab","The spiritual and culinary heart of Punjab",["spiritual","heritage","city"],["golden temple","jallianwala bagh"]),
("Hampi","Karnataka","A surreal boulder-strewn landscape of ancient Vijayanagara ruins",["heritage","nature","temple"],["virupaksha temple","vittala temple"]),
("Meghalaya","Meghalaya","Living root bridges, misty hills, and the wettest place on Earth",["nature","adventure","heritage"],["living root bridges","cherrapunji"]),
("Spiti Valley","Himachal Pradesh","A cold desert mountain valley of ancient monasteries and stark beauty",["mountain","adventure","spiritual"],["key monastery","chandratal lake"]),
("Rann of Kutch","Gujarat","The world's largest white salt desert under infinite skies",["desert","heritage","nature"],["white rann","kala dungar"]),
]

print(f"Loaded {len(META)} destinations")
META += [("Shimla","Himachal Pradesh","The Queen of Hills with colonial charm and mountain vistas",["hill_station","nature","heritage"],["mall road","jakhu temple"])]
META += [("Ooty","Tamil Nadu","The Queen of the Nilgiris with tea gardens and toy trains",["hill_station","nature","heritage"],["ooty lake","nilgiri mountain railway"])]
META += [("Nainital","Uttarakhand","A shimmering lake town in the Kumaon Hills",["hill_station","lake","nature"],["naini lake","naina peak"])]
META += [("Mussoorie","Uttarakhand","The Queen of the Hills with misty walks and colonial nostalgia",["hill_station","nature","heritage"],["kempty falls","gun hill"])]
META += [("Gangtok","Sikkim","A colorful Himalayan capital of monasteries and mountain views",["hill_station","nature","spiritual"],["rumtek monastery","tsomgo lake"])]
META += [("Pondicherry","Puducherry","French colonial charm meets Indian spirituality on the Bay of Bengal",["beach","heritage","city"],["promenade beach","auroville"])]
META += [("Hyderabad","Telangana","The City of Pearls - Nizami grandeur and tech-city energy",["city","heritage","nature"],["charminar","golconda fort"])]
META += [("Mysuru","Karnataka","The cultural capital of Karnataka with royal palaces and silk",["heritage","city","nature"],["mysore palace","chamundi hills"])]
META += [("Chikmagalur","Karnataka","Coffee country with misty hills and trekking trails",["nature","hill_station","adventure"],["mullayanagiri","coffee estates"])]
