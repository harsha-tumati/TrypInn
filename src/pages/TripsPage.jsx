// src/pages/TripsPage.jsx — Trypinn home (Gen-Z vibrant revamp)
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SmartImage from '../components/SmartImage';
import { SIZES } from '../utils/imageUrl';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
// firestoreService and placesService are dynamically imported where needed
// to keep them out of the critical initial bundle.
import { getDraftIds, addDraftId, isTripClaimed } from '../utils/draftTrips';
import { formatDate } from '../utils/dateHelpers';
import { suggestTripName } from '../utils/tripName';
import { hasCoords } from '../utils/geo';
import { MAPS_ENABLED } from '../config/maps';
// PlacesPicker renders in the above-the-fold hero, so it is imported eagerly
// (not lazy): this lets it be server-prerendered and hydrated without a node
// swap, keeping LCP fast. Its Maps dependency is already on the homepage path
// via MapsProvider, so this adds no extra initial chunk.
import PlacesPicker from '../components/PlacesPicker';
// Modal is always present in the homepage tree (rendered with open=false), so a
// lazy import would suspend during prerender and collapse the page to the route
// spinner. Import it eagerly; its heavy children below stay lazy (the closed
// modal returns null, so they are never rendered until the modal opens).
import Modal from '../components/Modal';
const DateRangePicker = lazy(() => import('../components/DateRangePicker'));
const LocationAutocomplete = lazy(() => import('../components/LocationAutocomplete'));
import {
    Plus, Link2, MapPin, Calendar, Users, Sparkles, Star, MessageCircle,
    Send, X, ArrowRight, Compass, Flame, Quote, Zap, ChevronRight, BookOpen,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

// Trending destinations — also imported by other pages (map, etc.)
export const TRENDING = [
    { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503, emoji: '🗼' },
    { name: 'Paris, France', lat: 48.8566, lng: 2.3522, emoji: '🥐' },
    { name: 'Bali, Indonesia', lat: -8.4095, lng: 115.1889, emoji: '🌴' },
    { name: 'Rome, Italy', lat: 41.9028, lng: 12.4964, emoji: '🏛️' },
    { name: 'New York, USA', lat: 40.7128, lng: -74.0060, emoji: '🍎' },
    { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708, emoji: '🐪' },
    { name: 'Barcelona, Spain', lat: 41.3851, lng: 2.1734, emoji: '🍷' },
    { name: 'London, UK', lat: 51.5074, lng: -0.1278, emoji: '🎡' },
    { name: 'Santorini, Greece', lat: 36.3932, lng: 25.4615, emoji: '🧿' },
    { name: 'Goa, India', lat: 15.2993, lng: 73.9512, emoji: '🏖️' },
    { name: 'Jaipur, India', lat: 26.9124, lng: 75.7873, emoji: '🐘' },
    { name: 'Kerala, India', lat: 10.8505, lng: 76.2711, emoji: '🌴' },
    { name: 'Varanasi, India', lat: 25.3176, lng: 83.0068, emoji: '🛕' },
    { name: 'Leh, Ladakh', lat: 34.1526, lng: 77.5771, emoji: '⛺' },
];

const HOT_DESTINATIONS = [
    {
        name: 'Goa, India',
        image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?fm=webp&w=300&q=60',
        rating: 4.8, badge: '🔥 Trending', tag: 'Beaches & nightlife',
        desc: 'Sun-soaked beaches, sunset shacks and Portuguese charm — the group-trip classic.',
    },
    {
        name: 'Bali, Indonesia',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?fm=webp&w=300&q=60',
        rating: 4.9, badge: '⭐ Loved', tag: 'Temples & rice fields',
        desc: 'Rice terraces, jungle villas and waterfalls — wellness energy with a view.',
    },
    {
        name: 'Santorini, Greece',
        image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?fm=webp&w=300&q=60',
        rating: 4.9, badge: '📸 Aesthetic', tag: 'Sunsets & blue domes',
        desc: 'Whitewashed cliffs and the most photogenic sunsets on the planet.',
    },
    {
        name: 'Leh, Ladakh',
        image: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?fm=webp&w=300&q=60',
        rating: 4.7, badge: '🏔️ Epic', tag: 'High passes & lakes',
        desc: 'Sky-high mountain passes, neon lakes and monasteries — the ultimate road trip.',
    },
    {
        name: 'Dubai, UAE',
        image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?fm=webp&w=300&q=60',
        rating: 4.8, badge: '✨ Luxe', tag: 'Skyline & desert',
        desc: 'Futuristic skyline by day, desert dunes by night — main-character energy.',
    },
    {
        name: 'Kerala, India',
        image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?fm=webp&w=300&q=60',
        rating: 4.9, badge: '🌿 Calm', tag: 'Backwaters & tea hills',
        desc: 'Houseboats, misty tea plantations and slow mornings — a proper reset.',
    },
];

// Must-visit destination-type → emoji, for the homepage preview tags.
const MV_TAG_EMOJI = {
    beach: '🏖️', mountain: '🏔️', heritage: '🏛️', spiritual: '🙏', adventure: '🧗',
    nature: '🌿', wildlife: '🐅', hill_station: '⛰️', city: '🏙️', desert: '🏜️',
    island: '🏝️', backwater: '🚣', lake: '💧', historical: '📜', pilgrimage: '🕉️',
    nightlife: '🌙',
};

// Featured must-visit guides shown on the homepage. Acts as the no-JS / prerender
// fallback; at runtime the top 3 are pulled live from /must-visits/index.json.
const MV_FEATURED_FALLBACK = [
    { slug: 'goa', name: 'Goa', tagline: "Sun, sand, and Portuguese heritage on India's western coast", coverImage: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?fm=webp&w=400&q=60', attractionCount: 25, categories: ['beach', 'heritage', 'city'] },
    { slug: 'leh-ladakh', name: 'Leh-Ladakh', tagline: 'High-altitude passes, turquoise lakes, and ancient Buddhist monasteries', coverImage: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?fm=webp&w=400&q=60', attractionCount: 25, categories: ['mountain', 'adventure', 'spiritual'] },
    { slug: 'jaipur', name: 'Jaipur', tagline: 'The Pink City — royal forts, vibrant bazaars, and Rajasthani grandeur', coverImage: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?fm=webp&w=400&q=60', attractionCount: 25, categories: ['heritage', 'city', 'historical'] },
];

// Travel-vibe shortcuts — each kicks off a trip seeded with a destination.
const VIBES = [
    { emoji: '🏖️', label: 'Beach days', dest: 'Goa, India', c: '#FF6B4A' },
    { emoji: '🏔️', label: 'Mountain high', dest: 'Leh, Ladakh', c: '#1E3A8A' },
    { emoji: '🏙️', label: 'City lights', dest: 'Mumbai, India', c: '#2A7AA0' },
    { emoji: '🛕', label: 'Culture trip', dest: 'Jaipur, India', c: '#F4B400' },
    { emoji: '🌴', label: 'Backwater chill', dest: 'Kerala, India', c: '#16A34A' },
    { emoji: '🎒', label: 'Adventure mode', dest: 'Rishikesh, India', c: '#BC3F88' },
];

const STEPS = [
    { n: '01', emoji: '📍', title: 'Drop your spots', text: 'Search and pin everywhere you wanna go. Fly solo or build it with the whole squad.' },
    { n: '02', emoji: '🫶', title: 'Rally the crew', text: 'Share one link. Everyone votes, comments and throws in their own must-sees.' },
    { n: '03', emoji: '🚀', title: 'Hit the road', text: 'Get a smart day-by-day plan with drive times and breaks. Then just… go.' },
];

const QUOTES = [
    { emoji: '🌊', text: 'Planned our entire Goa trip in like 20 minutes. The expense split alone saved three friendships.', name: 'Ananya', meta: 'Bengaluru · 22' },
    { emoji: '🏍️', text: 'No more 200-message group chats. We voted, it sorted itself out. Genuinely unreal.', name: 'Rohan', meta: 'Pune · 24' },
    { emoji: '💫', text: 'The AI found a waterfall none of us had ever heard of. Easily the trip of the year.', name: 'Meher', meta: 'Delhi · 21' },
];

const COLLAGE_IMAGES = [
    'https://images.unsplash.com/photo-1501504905252-473c47e087f8?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1488085061387-422e29b40080?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1508672019048-805c876b67e2?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1454391304352-2bf4678b1a7a?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1500835556837-99ac94a94552?fm=webp&w=170&q=60',
    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?fm=webp&w=170&q=60',
];

// Deterministic trio of images for a trip card collage, keyed by trip id.
function getTripImages(tripId) {
    let hash = 0;
    if (tripId) {
        for (let i = 0; i < tripId.length; i++) {
            hash = tripId.charCodeAt(i) + ((hash << 5) - hash);
        }
    }
    hash = Math.abs(hash);
    return [
        COLLAGE_IMAGES[hash % COLLAGE_IMAGES.length],
        COLLAGE_IMAGES[(hash + 5) % COLLAGE_IMAGES.length],
        COLLAGE_IMAGES[(hash + 9) % COLLAGE_IMAGES.length],
    ];
}

// Scroll-reveal wrapper — fades + lifts content in once it enters the viewport.
function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }) {
    const ref = useRef(null);
    const [shown, setShown] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setShown(true); io.disconnect(); } },
            { threshold: 0.12 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <Tag ref={ref} className={`hp-reveal${shown ? ' is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
            {children}
        </Tag>
    );
}

function useWindowWidth() {
    const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return width;
}

export default function TripsPage() {
    const { user } = useAuth();
    const { setSelectedTrip } = useTrip();
    const navigate = useNavigate();
    const windowWidth = useWindowWidth();
    const isMobile = windowWidth < 768;
    const location = useLocation();

    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mvFeatured, setMvFeatured] = useState(MV_FEATURED_FALLBACK);
    const [showAIChat, setShowAIChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        { id: '1', type: 'ai', content: "Hey! I'm your Trypinn AI concierge ✨ Tell me a vibe, a budget or a city — I'll help you build the trip." },
    ]);
    const [chatInput, setChatInput] = useState('');

    // Modals
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({ startDate: null, endDate: null, budget: '' });
    const [tripPlaces, setTripPlaces] = useState([]);
    const [startName, setStartName] = useState('');
    const [startPoint, setStartPoint] = useState(null);
    const [differentEnd, setDifferentEnd] = useState(false);
    const [endName, setEndName] = useState('');
    const [endPoint, setEndPoint] = useState(null);
    const [nameSeed, setNameSeed] = useState(0);
    const [createError, setCreateError] = useState('');
    const [creating, setCreating] = useState(false);

    // A trip list = the signed-in user's claimed trips + anonymous drafts
    // created on this device. Drafts are tracked in localStorage.
    const fetchAllTrips = useCallback(async () => {
        const { getUserTrips, getTripsByIds } = await import('../services/firestoreService');
        const claimed = user ? await getUserTrips(user.uid) : [];
        const draftIds = getDraftIds();
        const draftTrips = draftIds.length ? await getTripsByIds(draftIds) : [];
        const claimedIds = new Set(claimed.map((t) => t.id));
        const drafts = draftTrips.filter((t) => !isTripClaimed(t) && !claimedIds.has(t.id));
        return [...drafts, ...claimed];
    }, [user]);

    const loadTrips = useCallback(async () => {
        try { setTrips(await fetchAllTrips()); }
        catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [fetchAllTrips]);

    // Open the create modal when the router state requests it (e.g. from Navbar button)
    useEffect(() => {
        if (location.state?.openPlanModal) {
            resetCreateForm();
            setCreateOpen(true);
            // Clear the state so refreshing or navigating back doesn't re-trigger
            navigate('.', { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // Defer trip fetching until after initial paint to avoid blocking LCP
    useEffect(() => {
        let cancelled = false;
        const schedule = typeof requestIdleCallback !== 'undefined'
            ? requestIdleCallback
            : (cb) => setTimeout(cb, 200);
        const id = schedule(async () => {
            try {
                const result = await fetchAllTrips();
                if (!cancelled) setTrips(result);
            } catch (e) {
                console.error(e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        });
        return () => {
            cancelled = true;
            if (typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(id);
            else clearTimeout(id);
        };
    }, [fetchAllTrips]);

    // Hide the browser scrollbar while the home page is mounted, for a
    // cleaner full-bleed landing. Scrolling itself still works.
    useEffect(() => {
        document.documentElement.classList.add('hide-scrollbar');
        return () => document.documentElement.classList.remove('hide-scrollbar');
    }, []);

    // Pull the top 3 must-visit guides live so the homepage preview always
    // matches the directory (counts, images, tags). Falls back silently.
    useEffect(() => {
        let cancelled = false;
        fetch('/must-visits/index.json')
            .then(r => (r.ok ? r.json() : null))
            .then(list => {
                if (!cancelled && Array.isArray(list) && list.length) {
                    setMvFeatured(list.slice(0, 3));
                }
            })
            .catch(() => { /* keep fallback */ });
        return () => { cancelled = true; };
    }, []);

    function openTrip(trip) {
        setSelectedTrip(trip);
        navigate(`/trip/${trip.id}`);
    }

    function resetCreateForm(places = []) {
        setCreateForm({ startDate: null, endDate: null, budget: '' });
        setTripPlaces(places);
        setStartName(''); setStartPoint(null);
        setDifferentEnd(false);
        setEndName(''); setEndPoint(null);
        setCreateError('');
        setNameSeed((s) => s + 1);
    }

    function openCreateEmpty() {
        resetCreateForm();
        setCreateOpen(true);
    }

    function openCreateForDest(destName) {
        resetCreateForm(destName ? [{ name: destName }] : []);
        setCreateOpen(true);
    }

    const suggestedTripName = suggestTripName({
        destination: tripPlaces[0]?.name || '',
        startDate: createForm.startDate,
        seed: nameSeed,
    });

    async function handleCreateTrip(e) {
        e.preventDefault();
        // Planning never requires login — every trip starts as an anonymous
        // draft. It's claimed to a profile later via "Add to my profile".
        if (!startName.trim()) { setCreateError('Add where your trip starts.'); return; }
        if (differentEnd && !endName.trim()) {
            setCreateError('Add where your trip ends — or uncheck the different-ending option.');
            return;
        }
        if (tripPlaces.length === 0) { setCreateError('Add at least one place you want to visit.'); return; }
        setCreateError('');
        setCreating(true);
        try {
            const [{ createTrip, addPlaces }, { forwardGeocode }] = await Promise.all([
                import('../services/firestoreService'),
                import('../services/placesService'),
            ]);
            const geocodeIfNeeded = async (place) => {
                if (!place || hasCoords(place) || !MAPS_ENABLED) return place;
                try {
                    const geo = await forwardGeocode(place.name);
                    if (!geo) return place;
                    return {
                        ...place,
                        lat: geo.lat,
                        lng: geo.lng,
                        placeId: place.placeId || geo.placeId,
                        formatted: place.formatted || geo.formatted,
                    };
                } catch {
                    return place;
                }
            };

            const resolvedStart = await geocodeIfNeeded(startPoint || { name: startName.trim() });
            const resolvedEnd = differentEnd
                ? await geocodeIfNeeded(endPoint || { name: endName.trim() })
                : resolvedStart;
            const resolvedPlaces = await Promise.all(tripPlaces.map(geocodeIfNeeded));

            const startDateStr = createForm.startDate ? createForm.startDate.toISOString().split('T')[0] : null;
            const endDateStr = createForm.endDate ? createForm.endDate.toISOString().split('T')[0] : null;
            const destination = resolvedPlaces.map(p => p.name).join(', ');
            const tripId = await createTrip({
                name: suggestedTripName,
                destination,
                startDate: startDateStr,
                endDate: endDateStr,
                budget: createForm.budget || null,
                userId: null, // anonymous draft — claimed later from the itinerary
                startingPoint: resolvedStart,
                endingPoint: resolvedEnd,
            });
            await addPlaces(tripId, resolvedPlaces.map(p => ({
                name: p.name,
                lat: p.lat ?? null,
                lng: p.lng ?? null,
                description: p.formatted || '',
                category: 'destination',
                estimatedMinutes: 0,
                imageUrl: null,
                placeId: p.placeId ?? null,
                source: 'user',
            })));
            addDraftId(tripId);
            setCreateOpen(false);
            loadTrips();
            navigate(`/trip/${tripId}`);
        } catch (e) { setCreateError(e.message); }
        finally { setCreating(false); }
    }

    function handlePlanFromSearch() {
        setNameSeed((s) => s + 1);
        setCreateOpen(true);
    }

    const chatEndRef = useRef(null);
    const [chatLoading, setChatLoading] = useState(false);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    async function handleSendChat() {
        if (!chatInput.trim() || chatLoading) return;
        const userMsg = chatInput.trim();
        const msg = { id: Date.now().toString(), type: 'user', content: userMsg };
        setChatMessages(prev => [...prev, msg]);
        setChatInput('');
        setChatLoading(true);
        // Add a typing indicator
        const typingId = (Date.now() + 1).toString();
        setChatMessages(prev => [...prev, { id: typingId, type: 'ai', content: '__typing__' }]);
        try {
            const { getSuggestions } = await import('../config/openai');
            // Build a simple context string from conversation history
            const history = chatMessages
                .filter(m => m.content !== '__typing__')
                .slice(-6) // last 6 messages for context
                .map(m => (m.type === 'user' ? `User: ${m.content}` : `AI: ${m.content}`))
                .join('\n');
            // We use getSuggestions with a travel-assistant prompt
            const prompt = `You are a friendly AI travel concierge for Trypinn. Answer this travel question helpfully and concisely (2-4 sentences max). Conversation so far:\n${history}\n\nUser: ${userMsg}`;
            // Directly call our proxy via the openai config helper
            const { default: openai } = await import('../config/openai');
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
            });
            const reply = completion.choices[0]?.message?.content?.trim() || "I'm here to help plan your trip! Tell me more about where you'd like to go.";
            setChatMessages(prev => prev.map(m => m.id === typingId ? { ...m, content: reply } : m));
        } catch (e) {
            console.error('AI chat error:', e);
            setChatMessages(prev => prev.map(m => m.id === typingId ? { ...m, content: "Sorry, I couldn't connect right now. Try telling me your dream destination and I'll build an itinerary!" } : m));
        } finally {
            setChatLoading(false);
        }
    }

    const upcomingTrips = trips.filter(t => !t.endDate || new Date(t.endDate) >= new Date());
    const pastTrips = trips.filter(t => t.endDate && new Date(t.endDate) < new Date());

    const renderTripCard = (trip, past = false) => (
        <div key={trip.id} className={`hp-trip-card${past ? ' is-past' : ''}`} onClick={() => openTrip(trip)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') openTrip(trip); }}>
            <div className="hp-trip-collage">
                {/* The first tile spans both rows, so it is twice the width
                    of the two beside it and needs its own sizes. */}
                {getTripImages(trip.id).map((img, i) => (
                    <SmartImage
                        key={i}
                        src={img}
                        alt=""
                        aria-hidden="true"
                        ratio="3:2"
                        sizes={i === 0 ? SIZES.tripCollageMain : SIZES.tripCollageSide}
                        baseWidth={i === 0 ? 320 : 160}
                        maxWidth={i === 0 ? 640 : 320}
                        style={{ filter: past ? 'grayscale(0.55)' : 'none' }}
                    />
                ))}
                {!isTripClaimed(trip) && <span className="hp-trip-draft">Draft</span>}
                <span className="hp-trip-collage-fade" />
            </div>
            <div className="hp-trip-body">
                <h3>{trip.name}</h3>
                <div className="hp-trip-meta"><MapPin size={13} aria-hidden="true" /><span>{trip.destination || 'Somewhere amazing'}</span></div>
                <div className="hp-trip-foot">
                    {trip.startDate ? (
                        <span className="hp-trip-date"><Calendar size={13} aria-hidden="true" /> {formatDate(trip.startDate)}{trip.endDate ? ` – ${formatDate(trip.endDate)}` : ''}</span>
                    ) : (
                        <span className="hp-trip-date"><Users size={13} aria-hidden="true" /> Dates TBD</span>
                    )}
                    <span className="hp-trip-open">Open <ArrowRight size={13} aria-hidden="true" /></span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="hp">
            {/* ══ HERO ══ */}
            <section className="hp-hero">
                <span className="hp-blob hp-blob-1" aria-hidden="true" />
                <span className="hp-blob hp-blob-2" aria-hidden="true" />
                <span className="hp-blob hp-blob-3" aria-hidden="true" />

                <div className="hp-hero-inner">
                    <span className="hp-eyebrow hp-pop">
                        <Sparkles size={13} aria-hidden="true" /> Group travel, minus the group-chat chaos
                    </span>
                    <h1 className="hp-h1 hp-pop hp-pop-1">
                        Plan trips that<br />actually <span className="hp-hl">happen.</span>
                    </h1>
                    <p className="hp-sub hp-pop hp-pop-2">
                        Drop your dream destinations, rally the crew, vote on the plan and split the costs —
                        Trypinn handles the boring bits so you can just go.
                    </p>

                    <div className="hp-search hp-pop hp-pop-3">
                        <div className="hp-search-field">
                            <PlacesPicker
                                id="home-search"
                                places={tripPlaces}
                                onChange={(next) => setTripPlaces(next)}
                            />
                            {tripPlaces.length === 0 && (
                                <p className="hp-search-hint">Try “Goa”, “Tokyo” or a tiny town no one's heard of…</p>
                            )}
                        </div>
                        <button type="button" className="hp-search-btn" onClick={handlePlanFromSearch} aria-label="Plan a trip">
                            <Zap size={17} aria-hidden="true" />
                            {tripPlaces.length > 0 ? `Plan trip (${tripPlaces.length})` : 'Plan a trip'}
                        </button>
                    </div>

                    <div className="hp-hero-foot hp-pop hp-pop-4">
                        <span className="hp-trust">✦ Free to start · No login needed · 12K+ trips planned</span>
                    </div>
                </div>
            </section>

            {/* ══ MARQUEE ══ */}
            <div className="hp-marquee" aria-hidden="true">
                <div className="hp-marquee-track">
                    {[...TRENDING, ...TRENDING].map((d, i) => (
                        <span key={i} className="hp-marquee-item">
                            <span className="hp-marquee-emoji">{d.emoji}</span>
                            {d.name.split(',')[0]}
                            <span className="hp-marquee-dot">✦</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* ══ STATS ══ */}
            <section className="hp-stats">
                <Reveal className="hp-stats-grid">
                    {[
                        { big: '12K+', small: 'Trips planned' },
                        { big: '68', small: 'Cities & towns' },
                        { big: '4.9★', small: 'Traveler rating' },
                        { big: '₹0', small: 'To get started' },
                    ].map((s) => (
                        <div key={s.small} className="hp-stat">
                            <div className="hp-stat-big">{s.big}</div>
                            <div className="hp-stat-small">{s.small}</div>
                        </div>
                    ))}
                </Reveal>
            </section>

            {/* ══ TRENDING ══ */}
            <section className="hp-section">
                <Reveal className="hp-head">
                    <span className="hp-kicker"><Flame size={13} aria-hidden="true" /> Trending now</span>
                    <h2 className="hp-h2">Where everyone's going 🔥</h2>
                    <p className="hp-section-sub">Hand-picked spots your group will <em>actually</em> agree on.</p>
                </Reveal>
                <div className="hp-trending-grid">
                    {HOT_DESTINATIONS.map((dest, i) => (
                        <Reveal key={dest.name} delay={(i % 3) * 90} className={`hp-tilt hp-tilt-${i % 3}`}>
                            <div className="hp-dest-card">
                                <div className="hp-dest-img" onClick={() => navigate(`/travel-guides/${dest.name.toLowerCase().replace(/,?\s+/g, '-')}`)}>
                                    <SmartImage src={dest.image} alt={dest.name} width="300" height="198" sizes={SIZES.destCard} ratio="3:2" baseWidth={480} maxWidth={960} eager={i < 6} />
                                    <span className="hp-dest-badge">{dest.badge}</span>
                                    <span className="hp-dest-rating"><Star size={12} fill="#fff" color="#fff" aria-hidden="true" /> {dest.rating}</span>
                                </div>
                                <div className="hp-dest-body">
                                    <div className="hp-dest-tag">{dest.tag}</div>
                                    <h3>{dest.name}</h3>
                                    <p>{dest.desc}</p>
                                    <button type="button" onClick={() => openCreateForDest(dest.name)}>
                                        Plan a trip here <ArrowRight size={14} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ══ VIBE PICKER ══ */}
            <section className="hp-section hp-section-warm">
                <Reveal className="hp-head">
                    <span className="hp-kicker"><Compass size={13} aria-hidden="true" /> Pick your energy</span>
                    <h2 className="hp-h2">What's the vibe?</h2>
                    <p className="hp-section-sub">Tap a mood — we'll spin up a trip around it.</p>
                </Reveal>
                <Reveal className="hp-vibe-grid">
                    {VIBES.map((v) => (
                        <button type="button" key={v.label} className="hp-vibe" style={{ '--vibe': v.c }} onClick={() => openCreateForDest(v.dest)}>
                            <span className="hp-vibe-emoji">{v.emoji}</span>
                            <span className="hp-vibe-label">{v.label}</span>
                            <span className="hp-vibe-go"><ArrowRight size={15} aria-hidden="true" /></span>
                        </button>
                    ))}
                </Reveal>
            </section>

            {/* ══ MUST-VISITS PREVIEW ══ */}
            <section className="hp-section">
                <Reveal className="hp-head">
                    <span className="hp-kicker"><BookOpen size={13} aria-hidden="true" /> Explore destinations</span>
                    <h2 className="hp-h2">Must-Visit Places 🗺️</h2>
                    <p className="hp-section-sub">Curated guides with top attractions, hidden gems, and everything you need to plan.</p>
                </Reveal>
                <div className="hp-mv-grid">
                    {mvFeatured.map(dest => (
                        <Reveal key={dest.slug} className="mv-card" as="div">
                            <Link to={`/must-visits/${dest.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div className="mv-card-img">
                                    <SmartImage src={dest.coverImage} alt={`Must visit places in ${dest.name}`} width="400" height="250" sizes={SIZES.mvCard} ratio="16:10" baseWidth={400} maxWidth={640} />
                                    <span className="mv-card-count">{dest.attractionCount} places</span>
                                </div>
                                <div className="mv-card-body">
                                    <h3>{dest.name}</h3>
                                    <p className="mv-card-tagline">{dest.tagline}</p>
                                    <div className="mv-card-tags">
                                        {(dest.categories || []).slice(0, 3).map(t => (
                                            <span key={t} className="mv-tag">{MV_TAG_EMOJI[t] || '📍'} {t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                        ))}
                                    </div>
                                </div>
                            </Link>
                        </Reveal>
                    ))}
                </div>
                <Reveal>
                    <Link to="/must-visits" className="hp-mv-see-all">
                        See all must-visit guides <ChevronRight size={16} />
                    </Link>
                </Reveal>
            </section>

            {/* ══ HOW IT WORKS ══ */}
            <section className="hp-section">
                <Reveal className="hp-head">
                    <span className="hp-kicker"><Zap size={13} aria-hidden="true" /> How it works</span>
                    <h2 className="hp-h2">Stupid easy. Promise. 🤞</h2>
                    <p className="hp-section-sub">From scattered ideas to a real plan in three moves.</p>
                </Reveal>
                <div className="hp-steps">
                    {STEPS.map((s, i) => (
                        <Reveal key={s.n} delay={i * 110} className="hp-step">
                            <div className="hp-step-top">
                                <span className="hp-step-emoji">{s.emoji}</span>
                                <span className="hp-step-n" aria-hidden="true">{s.n}</span>
                            </div>
                            <h3>{s.title}</h3>
                            <p>{s.text}</p>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ══ AI CONCIERGE ══ */}
            <section className="hp-section">
                <Reveal className="hp-ai">
                    <div className="hp-ai-glow" aria-hidden="true" />
                    <div className="hp-ai-text">
                        <span className="hp-kicker hp-kicker-light"><Sparkles size={13} aria-hidden="true" /> Meet your AI bestie</span>
                        <h2>An AI concierge that gets the assignment.</h2>
                        <p>Tell it a vibe, a budget or a city. It finds hidden gems, builds day-by-day itineraries and answers the “but what do we DO there” question — instantly.</p>
                        <div className="hp-ai-btns">
                            <button type="button" className="hp-btn hp-btn-coral" onClick={() => setShowAIChat(true)}>
                                <MessageCircle size={16} aria-hidden="true" /> Chat with AI
                            </button>
                            <button type="button" className="hp-btn hp-btn-glass" onClick={openCreateEmpty}>
                                <Plus size={16} aria-hidden="true" /> Start a trip
                            </button>
                        </div>
                    </div>
                    <div className="hp-ai-bubble" aria-hidden="true">
                        <div className="hp-ai-msg hp-ai-msg-u">3 days in Goa, beaches + cafés ✨</div>
                        <div className="hp-ai-msg hp-ai-msg-a">On it! Day 1: Palolem sunrise → Café stop → Butterfly Beach…</div>
                        <div className="hp-ai-msg hp-ai-msg-a hp-ai-typing"><span /><span /><span /></div>
                    </div>
                </Reveal>
            </section>

            {/* ══ MY TRIPS ══ */}
            <section className="hp-section" id="my-trips-section">
                <Reveal className="hp-head hp-head-row">
                    <div>
                        <span className="hp-kicker"><MapPin size={13} aria-hidden="true" /> Your trips</span>
                        <h2 className="hp-h2">Pick up where you left off</h2>
                    </div>
                    <button type="button" className="hp-btn hp-btn-indigo" onClick={openCreateEmpty}>
                        <Plus size={16} aria-hidden="true" /> New trip
                    </button>
                </Reveal>

                {loading ? (
                    <div className="hp-trips-loading"><div className="spinner" /></div>
                ) : trips.length === 0 ? (
                    <Reveal className="hp-empty">
                        <div className="hp-empty-emoji">🧭</div>
                        <h3>No trips yet — let's fix that</h3>
                        <p>Plan your first adventure, no login needed. Join with a code if a friend already started one.</p>
                        <div className="hp-empty-btns">
                            <button type="button" className="hp-btn hp-btn-coral" onClick={openCreateEmpty}><Plus size={16} aria-hidden="true" /> Plan your first trip</button>
                        </div>
                    </Reveal>
                ) : (
                    <>
                        {upcomingTrips.length > 0 && (
                            <>
                                <Reveal as="h3" className="hp-trips-label">✈️ Upcoming</Reveal>
                                <div className="hp-trips-grid">
                                    {upcomingTrips.map((t) => renderTripCard(t, false))}
                                </div>
                            </>
                        )}
                        {pastTrips.length > 0 && (
                            <>
                                <Reveal as="h3" className="hp-trips-label" delay={60}>📸 Past adventures</Reveal>
                                <div className="hp-trips-grid">
                                    {pastTrips.map((t) => renderTripCard(t, true))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </section>

            {/* ══ TESTIMONIALS ══ */}
            <section className="hp-section hp-section-warm">
                <Reveal className="hp-head">
                    <span className="hp-kicker"><Quote size={13} aria-hidden="true" /> Real travelers</span>
                    <h2 className="hp-h2">The group chat approves 💬</h2>
                </Reveal>
                <div className="hp-quotes">
                    {QUOTES.map((q, i) => (
                        <Reveal key={q.name} delay={(i % 3) * 100} className="hp-quote">
                            <Quote size={26} className="hp-quote-mark" aria-hidden="true" />
                            <p>{q.text}</p>
                            <div className="hp-quote-by">
                                <span className="hp-quote-av">{q.emoji}</span>
                                <div>
                                    <strong>{q.name}</strong>
                                    <span>{q.meta}</span>
                                </div>
                                <span className="hp-quote-stars">★★★★★</span>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ══ FINAL CTA ══ */}
            <section className="hp-finalcta">
                <Reveal className="hp-finalcta-card">
                    <span className="hp-blob hp-blob-c1" aria-hidden="true" />
                    <span className="hp-blob hp-blob-c2" aria-hidden="true" />
                    <span className="hp-finalcta-emoji" aria-hidden="true">🌍</span>
                    <h2>Stop talking about it.<br />Start planning it.</h2>
                    <p>Your next trip is one tap away — no login, no friction, no flaky group chat.</p>
                    <div className="hp-finalcta-btns">
                        <button type="button" className="hp-btn hp-btn-coral hp-btn-lg" onClick={openCreateEmpty}>
                            <Plus size={18} aria-hidden="true" /> Plan a trip — free
                        </button>
                        <button type="button" className="hp-btn hp-btn-glass hp-btn-lg" onClick={() => setShowAIChat(true)}>
                            <Sparkles size={18} aria-hidden="true" /> Ask the AI
                        </button>
                    </div>
                </Reveal>
            </section>

            {/* ══ FLOATING AI BUTTON ══ */}
            {!showAIChat && (
                <button type="button" className="hp-ai-fab" onClick={() => setShowAIChat(true)} aria-label="Chat with AI travel assistant">
                    <Sparkles size={22} aria-hidden="true" />
                    <span className="hp-ai-fab-ping" aria-hidden="true" />
                </button>
            )}

            {/* ══ AI CHAT PANEL ══ */}
            {showAIChat && (
                <div className="ai-chat-panel" role="dialog" aria-label="AI travel assistant">
                    <div className="ai-chat-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1 }}>
                            <div style={{ padding: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.2)' }} aria-hidden="true">
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>AI Travel Concierge</div>
                                <div style={{ fontSize: 11, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#86efac', boxShadow: '0 0 8px #86efac' }} aria-hidden="true" />
                                    Online · Ready to help
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAIChat(false)}
                            aria-label="Close AI assistant"
                            style={{ background: 'rgba(255,255,255,0.14)', border: 'none', color: '#fff', cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, position: 'relative', zIndex: 1 }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="ai-chat-messages">
                        {chatMessages.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', gap: 10, justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start' }}>
                                {msg.type === 'ai' && (
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-indigo), var(--color-violet))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 10px rgba(91,92,246,0.3)' }} aria-hidden="true">
                                        <Sparkles size={15} color="#fff" />
                                    </div>
                                )}
                                {msg.content === '__typing__' ? (
                                    <div className="chat-bubble chat-bubble-ai hp-ai-typing" style={{ padding: '10px 16px' }}>
                                        <span /><span /><span />
                                    </div>
                                ) : (
                                    <div className={msg.type === 'ai' ? 'chat-bubble chat-bubble-ai' : 'chat-bubble chat-bubble-user'} style={{ maxWidth: '75%', fontSize: 13.5 }}>
                                        {msg.content}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="ai-chat-input">
                        <input
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                            placeholder="Ask anything about your trip…"
                            aria-label="Message AI assistant"
                        />
                        <button type="button" onClick={handleSendChat} disabled={!chatInput.trim()} aria-label="Send message" style={{ minWidth: 46 }}>
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* ══ PLAN A TRIP MODAL ══ */}
            <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Plan a trip"
                subtitle="Pick where you're going and set your dates — we'll handle the rest.">
                <form onSubmit={handleCreateTrip} className="create-trip-form">
                    <div>
                        <label className="input-label" htmlFor="trip-start">Starting Point</label>
                        <LocationAutocomplete
                            id="trip-start"
                            autoFocus
                            value={startName}
                            placeholder="Where does your trip start?"
                            onChange={(t) => { setStartName(t); if (t.trim()) setCreateError(''); }}
                            onSelect={(p) => { setStartPoint(p); if (p) setStartName(p.name); }}
                        />
                        <label className="checkbox-row" style={{ marginTop: 12 }}>
                            <input
                                type="checkbox"
                                checked={differentEnd}
                                onChange={(e) => setDifferentEnd(e.target.checked)}
                            />
                            <span>My trip ends at a different place</span>
                        </label>
                    </div>

                    {differentEnd && (
                        <div>
                            <label className="input-label" htmlFor="trip-end">Ending Point</label>
                            <LocationAutocomplete
                                id="trip-end"
                                value={endName}
                                placeholder="Where does your trip end?"
                                onChange={(t) => { setEndName(t); if (t.trim()) setCreateError(''); }}
                                onSelect={(p) => { setEndPoint(p); if (p) setEndName(p.name); }}
                            />
                        </div>
                    )}

                    <div>
                        <label className="input-label" htmlFor="trip-places">Places you want to visit</label>
                        <Suspense fallback={<div className="input-field" style={{ minHeight: 48 }}>Loading…</div>}>
                            <PlacesPicker
                                id="trip-places"
                                places={tripPlaces}
                                onChange={(next) => { setTripPlaces(next); if (next.length) setCreateError(''); }}
                            />
                        </Suspense>
                        {tripPlaces.length === 0 ? (
                            <p className="field-hint">
                                {MAPS_ENABLED
                                    ? 'Search and add one or more destinations.'
                                    : 'Add one or more destinations. Live map search turns on once a Google Maps API key is configured.'}
                            </p>
                        ) : (
                            <p className="field-hint">
                                We'll name this trip <strong>"{suggestedTripName}"</strong>.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="input-label">Trip Dates</label>
                        <Suspense fallback={<div className="input-field" style={{ minHeight: 48 }}>Loading…</div>}>
                            <DateRangePicker
                                startDate={createForm.startDate}
                                endDate={createForm.endDate}
                                onStartChange={(date) => setCreateForm({ ...createForm, startDate: date })}
                                onEndChange={(date) => setCreateForm({ ...createForm, endDate: date })}
                                isMobile={isMobile}
                            />
                        </Suspense>
                    </div>

                    <div>
                        <label className="input-label" htmlFor="modal-budget">
                            Estimated Budget <span className="input-label-hint">optional</span>
                        </label>
                        <div className="input-prefix-wrap">
                            <span className="input-prefix">₹</span>
                            <input id="modal-budget" type="number" min="0" className="input-field" placeholder="15,000" value={createForm.budget} onChange={e => setCreateForm({ ...createForm, budget: e.target.value })} />
                        </div>
                    </div>

                    {createError && <p className="form-error">{createError}</p>}

                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost btn-md" onClick={() => setCreateOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary btn-md" disabled={creating}>
                            {creating ? <div className="spinner spinner-sm" /> : 'Plan a Trip →'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
