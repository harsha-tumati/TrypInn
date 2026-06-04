
import json, os

OUT = "/home/harsha/Projects/TrypInn (1)/TrypInn/public/must-visits"
os.makedirs(OUT, exist_ok=True)

uids = ["1512343879784-a960bf40e7f2","1477587458883-47145ed94245","1626621341517-bbf3d9990a23"]
def img(s,w=800): return f"https://images.unsplash.com/photo-{uids[abs(hash(s))%len(uids)]}?fm=webp&w={w}&q=60"
def prm(a,d): return f"Ultra realistic travel photography, golden hour lighting, vibrant colors, {a} in {d}, tourists enjoying the view, DSLR quality, 4k, cinematic composition, highly detailed"
def intro(n,st,h): return f"When travelers search for must visit places in {n}, they discover a destination that truly rewards curiosity. The best places to visit in {n} span from {h[0]} to {h[1]}. As one of the top tourist attractions in {n}, each spot tells a unique story of {st} rich heritage. Whether you are looking for things to do in {n} over a weekend or planning a longer escape, this travel guide to {n} covers every must-see experience. From iconic landmarks to hidden corners, these curated picks ensure you experience the very best of {n}."
def slug(s): return s.lower().replace(chr(39),"").replace(",","").replace(".","").replace("&","and").replace("  "," ").strip().replace(" ","-")

# Destination metadata: name, state, tagline, categories, highlights
META = [
("Goa","Goa","Sun sand and Portuguese heritage",["beach","heritage","nightlife"],["golden beaches","historic churches"]),
("Leh-Ladakh","Ladakh","High-altitude passes turquoise lakes monasteries",["mountain","adventure","spiritual"],["pangong lake","khardung la pass"]),
("Manali","Himachal Pradesh","Snow peaks pine forests adventure capital",["mountain","adventure","hill_station"],["rohtang pass","solang valley"]),
("Kashmir","Jammu and Kashmir","Paradise on Earth valleys lakes Himalayas",["mountain","nature","lake"],["dal lake","gulmarg meadows"]),
("Jaipur","Rajasthan","Pink City royal forts vibrant bazaars",["heritage","city","desert"],["amber fort","hawamahal"]),
("Udaipur","Rajasthan","City of Lakes palaces romance heritage",["heritage","lake","city"],["lake pichola","city palace"]),
("Taj Mahal","Uttar Pradesh","Timeless marble monument eternal love",["heritage","city","historical"],["taj mahal","agra fort"]),
("Rishikesh","Uttarakhand","Yoga capital on the Ganges",["spiritual","adventure","nature"],["lakshman jhula","river rafting"]),
("Varanasi","Uttar Pradesh","Spiritual capital on the sacred Ganges",["spiritual","heritage","city"],["dashashwamedh ghat","kashi vishwanath temple"]),
("Kerala Backwaters","Kerala","Serene lagoons canals lakes Arabian Sea",["backwater","nature","beach"],["alleppey houseboats","kumarakom"]),
("Andaman Islands","Andaman and Nicobar","Pristine beaches coral reefs rainforests",["island","beach","adventure"],["radhanagar beach","cellular jail"]),
("Darjeeling","West Bengal","Tea gardens toy trains Himalayan vistas",["hill_station","nature","heritage"],["tiger hill","batasia loop"]),
("Munnar","Kerala","Tea hills misty valleys colonial charm",["hill_station","nature","adventure"],["tea gardens","eravikulam national park"]),
("Coorg","Karnataka","Coffee estates misty hills Kodava culture",["nature","hill_station","adventure"],["abbey falls","coffee plantations"]),
("Jaisalmer","Rajasthan","Golden City sandstone forts desert magic",["desert","heritage","adventure"],["jaisalmer fort","sam sand dunes"]),
("Amritsar","Punjab","Spiritual and culinary heart of Punjab",["spiritual","heritage","city"],["golden temple","jallianwala bagh"]),
("Hampi","Karnataka","Ancient Vijayanagara ruins boulder landscape",["heritage","nature","temple"],["virupaksha temple","vittala temple"]),
("Meghalaya","Meghalaya","Living root bridges misty hills wettest place",["nature","adventure","heritage"],["living root bridges","cherrapunji"]),
("Spiti Valley","Himachal Pradesh","Cold desert monasteries stark beauty",["mountain","adventure","spiritual"],["key monastery","chandratal lake"]),
("Rann of Kutch","Gujarat","Worlds largest white salt desert",["desert","heritage","nature"],["white rann","kala dungar"]),
("Shimla","Himachal Pradesh","Queen of Hills colonial charm vistas",["hill_station","nature","heritage"],["mall road","jakhu temple"]),
("Ooty","Tamil Nadu","Queen of Nilgiris tea gardens toy trains",["hill_station","nature","heritage"],["ooty lake","nilgiri mountain railway"]),
("Nainital","Uttarakhand","Shimmering lake town Kumaon Hills",["hill_station","lake","nature"],["naini lake","naina peak"]),
("Mussoorie","Uttarakhand","Queen of Hills misty walks colonial nostalgia",["hill_station","nature","heritage"],["kempty falls","gun hill"]),
("Gangtok","Sikkim","Himalayan capital monasteries mountain views",["hill_station","nature","spiritual"],["rumtek monastery","tsomgo lake"]),
("Pondicherry","Puducherry","French colonial charm Indian spirituality",["beach","heritage","city"],["promenade beach","auroville"]),
("Hyderabad","Telangana","City of Pearls Nizami grandeur tech energy",["city","heritage","nature"],["charminar","golconda fort"]),
("Mysuru","Karnataka","Cultural capital royal palaces silk",["heritage","city","nature"],["mysore palace","chamundi hills"]),
("Chikmagalur","Karnataka","Coffee country misty hills trekking",["nature","hill_station","adventure"],["mullayanagiri","coffee estates"]),
hello
test line
(
hello
("test")
