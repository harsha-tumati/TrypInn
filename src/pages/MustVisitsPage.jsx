// src/pages/MustVisitsPage.jsx
// Travel discovery directory — must-visit attractions for 100+ Indian destinations.
// Public page, no auth required.
import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { MapPin, Clock, Calendar, ChevronRight, Search, ArrowLeft, ExternalLink, Star, Compass, Filter } from 'lucide-react';
import usePageSeo, { schemas } from '../hooks/usePageSeo';

// ── Category config ──
const CATEGORIES = {
    beach: { label: 'Beach', emoji: '🏖️', color: '#0ea5e9' },
    temple: { label: 'Temple', emoji: '🛕', color: '#f59e0b' },
    fort: { label: 'Fort', emoji: '🏰', color: '#8b5cf6' },
    nature: { label: 'Nature', emoji: '🌿', color: '#22c55e' },
    heritage: { label: 'Heritage', emoji: '🏛️', color: '#e11d48' },
    adventure: { label: 'Adventure', emoji: '🧗', color: '#f97316' },
    lake: { label: 'Lake', emoji: '💧', color: '#06b6d4' },
    waterfall: { label: 'Waterfall', emoji: '🌊', color: '#3b82f6' },
    museum: { label: 'Museum', emoji: '🎨', color: '#a855f7' },
    park: { label: 'Park', emoji: '🌳', color: '#16a34a' },
    market: { label: 'Market', emoji: '🛍️', color: '#ec4899' },
    viewpoint: { label: 'Viewpoint', emoji: '🏔️', color: '#6366f1' },
    religious: { label: 'Religious', emoji: '🙏', color: '#eab308' },
    cave: { label: 'Cave', emoji: '🕳️', color: '#78716c' },
    wildlife: { label: 'Wildlife', emoji: '🐅', color: '#65a30d' },
    garden: { label: 'Garden', emoji: '🌺', color: '#d946ef' },
    palace: { label: 'Palace', emoji: '👑', color: '#b45309' },
    island: { label: 'Island', emoji: '🏝️', color: '#0891b2' },
    monastery: { label: 'Monastery', emoji: '⛩️', color: '#dc2626' },
    glacier: { label: 'Glacier', emoji: '🧊', color: '#7dd3fc' },
    desert: { label: 'Desert', emoji: '🏜️', color: '#d97706' },
    nightlife: { label: 'Nightlife', emoji: '🌙', color: '#7c3aed' },
};

const DEST_TYPES = {
    beach: { label: 'Beach', emoji: '🏖️' },
    mountain: { label: 'Mountain', emoji: '🏔️' },
    heritage: { label: 'Heritage', emoji: '🏛️' },
    spiritual: { label: 'Spiritual', emoji: '🙏' },
    adventure: { label: 'Adventure', emoji: '🧗' },
    nature: { label: 'Nature', emoji: '🌿' },
    wildlife: { label: 'Wildlife', emoji: '🐅' },
    hill_station: { label: 'Hill Station', emoji: '⛰️' },
    city: { label: 'City', emoji: '🏙️' },
    desert: { label: 'Desert', emoji: '🏜️' },
    island: { label: 'Island', emoji: '🏝️' },
    backwater: { label: 'Backwater', emoji: '🚣' },
    lake: { label: 'Lake', emoji: '💧' },
    historical: { label: 'Historical', emoji: '📜' },
    pilgrimage: { label: 'Pilgrimage', emoji: '🕉️' },
};

// ── Skeleton ──
function MustVisitsSkeleton() {
    return (
        <div className="mv-page">
            <div className="mv-hero mv-hero-loading" />
            <div className="mv-container">
                <div className="mv-grid">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="mv-card mv-card-skeleton">
                            <div className="mv-card-img skeleton-pulse" />
                            <div className="mv-card-body">
                                <div className="skeleton-pulse" style={{ height: 20, width: '70%', borderRadius: 6 }} />
                                <div className="skeleton-pulse" style={{ height: 14, width: '100%', borderRadius: 6, marginTop: 10 }} />
                                <div className="skeleton-pulse" style={{ height: 14, width: '60%', borderRadius: 6, marginTop: 6 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Destination Card (for directory) ──
const DestinationCard = memo(function DestinationCard({ dest }) {
    return (
        <Link to={`/must-visits/${dest.slug}`} className="mv-card" aria-label={`Must visit places in ${dest.name}`}>
            <div className="mv-card-img">
                <img
                    src={dest.coverImage}
                    alt={`Must visit places in ${dest.name}`}
                    loading="lazy"
                    decoding="async"
                    width="400"
                    height="250"
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?fm=webp&w=800&q=60'; }}
                />
                <span className="mv-card-count">{dest.attractionCount} places</span>
            </div>
            <div className="mv-card-body">
                <h3>{dest.name}</h3>
                <p className="mv-card-tagline">{dest.tagline}</p>
                <div className="mv-card-tags">
                    {(dest.categories || []).slice(0, 3).map(cat => (
                        <span key={cat} className="mv-tag" style={{ '--tag-color': DEST_TYPES[cat]?.emoji ? undefined : '#6366f1' }}>
                            {DEST_TYPES[cat]?.emoji || '📍'} {DEST_TYPES[cat]?.label || cat}
                        </span>
                    ))}
                </div>
            </div>
        </Link>
    );
});

// ── Attraction Card (for detail page) ──
const AttractionCard = memo(function AttractionCard({ attraction, destination }) {
    const [expanded, setExpanded] = useState(false);
    const cat = CATEGORIES[attraction.category] || { label: attraction.category, emoji: '📍', color: '#6366f1' };

    return (
        <article className={`mv-attraction${expanded ? ' is-expanded' : ''}`} onClick={() => setExpanded(e => !e)}>
            <div className="mv-attraction-img">
                <img
                    src={attraction.coverImage}
                    alt={attraction.name}
                    loading="lazy"
                    decoding="async"
                    width="400"
                    height="250"
                    onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?fm=webp&w=800&q=60'; }}
                />
                <span className="mv-attraction-badge" style={{ background: cat.color }}>
                    {cat.emoji} {cat.label}
                </span>
            </div>
            <div className="mv-attraction-body">
                <h3>{attraction.name}</h3>
                <p className="mv-attraction-desc">{attraction.description}</p>

                {expanded && (
                    <div className="mv-attraction-details">
                        <div className="mv-attraction-detail">
                            <Star size={14} />
                            <div>
                                <strong>Why visit</strong>
                                <p>{attraction.whyVisit}</p>
                            </div>
                        </div>
                        <div className="mv-attraction-meta-row">
                            <span className="mv-attraction-meta">
                                <Calendar size={13} /> {attraction.bestTime}
                            </span>
                            <span className="mv-attraction-meta">
                                <Clock size={13} /> {attraction.duration}
                            </span>
                        </div>
                        <a
                            href={`https://www.google.com/maps/search/${encodeURIComponent(attraction.mapsSearch || `${attraction.name}, ${destination}, India`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mv-maps-btn"
                            onClick={e => e.stopPropagation()}
                        >
                            <MapPin size={14} /> View on Google Maps <ExternalLink size={12} />
                        </a>
                    </div>
                )}

                {!expanded && (
                    <div className="mv-attraction-meta-row">
                        <span className="mv-attraction-meta">
                            <Calendar size={13} /> {attraction.bestTime}
                        </span>
                        <span className="mv-attraction-meta">
                            <Clock size={13} /> {attraction.duration}
                        </span>
                    </div>
                )}
            </div>
        </article>
    );
});

// ── Directory View ──
const MustVisitsDirectory = memo(function MustVisitsDirectory({ destinations }) {
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    usePageSeo({
        title: 'Must Visit Places in India — Top Tourist Attractions | Trypinn',
        description: 'Discover the best places to visit across 100+ Indian destinations. Curated travel guides with top attractions, hidden gems, and practical tips for every traveler.',
        url: 'https://trypinn.com/must-visits',
        type: 'website',
        jsonLd: [
            schemas.BreadcrumbList([
                { name: 'Home', url: 'https://trypinn.com/' },
                { name: 'Must Visit Places', url: 'https://trypinn.com/must-visits' },
            ]),
            {
                '@context': 'https://schema.org',
                '@type': 'CollectionPage',
                name: 'Must Visit Places in India',
                url: 'https://trypinn.com/must-visits',
                description: 'Curated travel guides for 100+ Indian destinations with top attractions and hidden gems.',
                hasPart: destinations.slice(0, 20).map((d, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    url: `https://trypinn.com/must-visits/${d.slug}`,
                    name: `Must Visit Places in ${d.name}`,
                })),
            },
        ],
    });

    const typeFilters = useMemo(() => {
        const types = new Set();
        destinations.forEach(d => (d.categories || []).forEach(c => types.add(c)));
        return ['all', ...Array.from(types).sort()];
    }, [destinations]);

    const filtered = useMemo(() => {
        let result = destinations;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(d =>
                d.name.toLowerCase().includes(q) ||
                d.state?.toLowerCase().includes(q) ||
                d.tagline?.toLowerCase().includes(q)
            );
        }
        if (activeFilter !== 'all') {
            result = result.filter(d => (d.categories || []).includes(activeFilter));
        }
        return result;
    }, [destinations, search, activeFilter]);

    return (
        <div className="mv-page">
            <div className="mv-hero">
                <div className="mv-hero-inner">
                    <h1>Must Visit Places in India</h1>
                    <p>Curated travel guides for 100+ destinations — top attractions, hidden gems, and everything in between</p>
                </div>
            </div>

            <div className="mv-container">
                {/* Search + Filters */}
                <div className="mv-toolbar">
                    <div className="mv-search">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search destinations…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            aria-label="Search destinations"
                        />
                    </div>
                    <div className="mv-filters">
                        {typeFilters.slice(0, 10).map(type => (
                            <button
                                key={type}
                                type="button"
                                className={`mv-filter-btn${activeFilter === type ? ' active' : ''}`}
                                onClick={() => setActiveFilter(type)}
                            >
                                {type === 'all' ? '✦ All' : `${DEST_TYPES[type]?.emoji || '📍'} ${DEST_TYPES[type]?.label || type}`}
                            </button>
                        ))}
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="mv-empty">
                        <Compass size={48} />
                        <h3>No destinations found</h3>
                        <p>Try a different search or filter</p>
                    </div>
                ) : (
                    <div className="mv-grid">
                        {filtered.map(dest => (
                            <DestinationCard key={dest.slug} dest={dest} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

// ── Detail View ──
const MustVisitsDetail = memo(function MustVisitsDetail({ data }) {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('all');

    const categories = useMemo(() => {
        const cats = new Set();
        (data.attractions || []).forEach(a => cats.add(a.category));
        return ['all', ...Array.from(cats)];
    }, [data.attractions]);

    const filtered = useMemo(() => {
        if (activeCategory === 'all') return data.attractions || [];
        return (data.attractions || []).filter(a => a.category === activeCategory);
    }, [data.attractions, activeCategory]);

    usePageSeo({
        title: data.metaTitle || `Must Visit Places in ${data.name} — Top Attractions | Trypinn`,
        description: data.metaDescription || `Discover the best places to visit in ${data.name}. Top attractions, hidden gems, and travel tips.`,
        url: `https://trypinn.com/must-visits/${data.slug}`,
        image: data.coverImage,
        type: 'website',
        jsonLd: [
            schemas.BreadcrumbList([
                { name: 'Home', url: 'https://trypinn.com/' },
                { name: 'Must Visit Places', url: 'https://trypinn.com/must-visits' },
                { name: data.name, url: `https://trypinn.com/must-visits/${data.slug}` },
            ]),
            {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `Must Visit Places in ${data.name}`,
                url: `https://trypinn.com/must-visits/${data.slug}`,
                numberOfItems: (data.attractions || []).length,
                itemListElement: (data.attractions || []).map((a, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    item: {
                        '@type': 'TouristAttraction',
                        name: a.name,
                        description: a.description,
                        image: a.coverImage,
                        geo: undefined,
                    },
                })),
            },
        ],
    });

    return (
        <div className="mv-page">
            <div 
                className="mv-detail-hero" 
                style={{ backgroundImage: `url(${data.coverImage}), url(https://images.unsplash.com/photo-1524492412937-b28074a5d7da?fm=webp&w=1200&q=60)` }}
            >
                <div className="mv-detail-hero-overlay" />
                <div className="mv-detail-hero-content">
                    <button type="button" className="mv-back-btn" onClick={() => navigate('/must-visits')}>
                        <ArrowLeft size={16} /> All Destinations
                    </button>
                    <h1>Must Visit Places in {data.name}</h1>
                    <p>{(data.attractions || []).length} curated attractions · {data.state}</p>
                </div>
            </div>

            <div className="mv-container">
                {/* Breadcrumbs */}
                <nav className="mv-breadcrumb" aria-label="Breadcrumb">
                    <ol>
                        <li><Link to="/">Home</Link></li>
                        <li aria-hidden="true">›</li>
                        <li><Link to="/must-visits">Must Visits</Link></li>
                        <li aria-hidden="true">›</li>
                        <li aria-current="page">{data.name}</li>
                    </ol>
                </nav>

                {/* Introduction */}
                <div className="mv-intro">
                    <p>{data.introduction}</p>
                </div>

                {/* Category filters */}
                <div className="mv-filters" style={{ marginBottom: 32 }}>
                    {categories.map(cat => {
                        const c = CATEGORIES[cat];
                        return (
                            <button
                                key={cat}
                                type="button"
                                className={`mv-filter-btn${activeCategory === cat ? ' active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat === 'all' ? '✦ All' : `${c?.emoji || '📍'} ${c?.label || cat}`}
                            </button>
                        );
                    })}
                </div>

                {/* Attractions grid */}
                <div className="mv-attractions-grid">
                    {filtered.map((attraction, i) => (
                        <AttractionCard
                            key={attraction.slug || i}
                            attraction={attraction}
                            destination={data.name}
                        />
                    ))}
                </div>

                {/* Long-form travel guide (SEO page content) */}
                {Array.isArray(data.pageContent) && data.pageContent.length > 0 && (
                    <section className="mv-pagecontent">
                        <h2>Travel Guide to {data.name}</h2>
                        {data.pageContent.map((para, i) => (
                            <p key={i}>{para}</p>
                        ))}
                    </section>
                )}

                {/* Plan a trip CTA */}
                <div className="mv-cta">
                    <h3>Ready to explore {data.name}?</h3>
                    <p>Plan your trip with Trypinn — add these places to your itinerary, invite your crew, and go.</p>
                    <Link to="/" state={{ openPlanModal: true }} className="mv-cta-btn">
                        Plan a Trip to {data.name} <ChevronRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
});

// ── Main Component ──
export default function MustVisitsPage() {
    const { destination } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Prevent rendering with mismatched data during route transitions
    const isDataMismatch = data !== null && (destination ? Array.isArray(data) : !Array.isArray(data));

    useEffect(() => {
        setLoading(true);
        setError(null);

        const file = destination
            ? `/must-visits/${destination}.json`
            : '/must-visits/index.json';

        fetch(file)
            .then(r => {
                if (!r.ok) throw new Error('not_found');
                return r.json();
            })
            .then(d => { setData(d); setLoading(false); })
            .catch(() => { setError('not_found'); setLoading(false); });
    }, [destination]);

    if (loading || isDataMismatch) return <MustVisitsSkeleton />;

    if (error || !data) {
        return (
            <div className="mv-page">
                <div className="mv-empty" style={{ minHeight: '60vh' }}>
                    <Compass size={56} />
                    <h2>Destination not found</h2>
                    <p>We could not find that destination. Try browsing all must-visit guides.</p>
                    <Link to="/must-visits" className="mv-cta-btn" style={{ marginTop: 16 }}>
                        Browse All Destinations <ChevronRight size={16} />
                    </Link>
                </div>
            </div>
        );
    }

    if (destination) {
        return <MustVisitsDetail data={data} />;
    }

    return <MustVisitsDirectory destinations={data} />;
}
