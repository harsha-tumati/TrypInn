// src/pages/PlannerPage.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTrip } from '../context/TripContext';
import { useGuestMode } from '../context/GuestModeContext';
import { useAuth } from '../context/AuthContext';
import { isTripClaimed } from '../utils/draftTrips';
import { addPlaces, updatePlace, updatePlaceOrder, deletePlace, updateTrip, createStopPoll } from '../services/firestoreService';
import { enrichPlacesWithGoogle, forwardGeocode } from '../services/placesService';
import LocationAutocomplete from '../components/LocationAutocomplete';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { hasCoords } from '../utils/geo';
import { getRegionPlaces, getRouteMustVisits } from '../config/openai';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import MapsProvider from '../components/MapsProvider';
import { MAPS_ENABLED } from '../config/maps';
import { Plus, X, Clock, ChevronRight, Loader, Star, Route, ArrowUp, ArrowDown, Map as MapIcon, MapPin, Calendar, Pencil, Check, Compass, Search, Vote } from 'lucide-react';
import ReadMore from '../components/ReadMore';
import Modal from '../components/Modal';
import { formatDate } from '../utils/dateHelpers';
import { useNavigate, useParams } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import MapView from './TripDetailPage';
import PlaceThumb from '../components/PlaceThumb';
import ReviewPicks from '../components/ReviewPicks';
import { formatBestTime } from '../utils/bestTime';
import usePageSeo from '../hooks/usePageSeo';
import { publicSummaryFor } from '../utils/publicTrips';

// Map a Firestore place doc to an editable planner stop.
function placeToStop(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    category: p.category || 'default',
    estimatedMinutes: p.estimatedMinutes || 60,
    lat: p.lat,
    lng: p.lng,
    imageUrl: p.imageUrl || null,
    googlePlaceId: p.googlePlaceId || null,
    group: p.group || null,
    bestTime: p.bestTime || null,
    bestTimeReason: p.bestTimeReason || null,
    geocoding: false,
  };
}

// Stops added in the planner but not yet written to Firestore.
const isLocalId = (id) => /^(stop|region|route)-/.test(id || '');
const normName = (s) => (s || '').trim().toLowerCase();

// A, B, … Z, then 27, 28 — past Z the alphabet runs out.
const stopLetter = (i) => (i < 26 ? String.fromCharCode(65 + i) : String(i + 1));

// "goa, india" → "Goa". The region's name is the group's heading.
function regionLabel(text) {
  const first = (text || '').split(',')[0].trim();
  return first === first.toLowerCase() ? first.replace(/\b\w/g, c => c.toUpperCase()) : first;
}

// Consecutive stops picked from the same explored region render as one block,
// nested under the region's name. Everything else is a block of one.
function groupStops(stops) {
  const blocks = [];
  stops.forEach((stop, index) => {
    const last = blocks[blocks.length - 1];
    if (stop.group && last?.group === stop.group) last.entries.push({ stop, index });
    else blocks.push({ key: stop.group ? `region:${stop.id}` : stop.id, group: stop.group || null, entries: [{ stop, index }] });
  });
  return blocks;
}

const SYNCED_FIELDS = ['estimatedMinutes', 'group', 'lat', 'lng', 'description'];
const fieldValue = (key, v) => (key === 'description' ? (v || '') : (v ?? null));

/**
 * Write the planner's stops to the trip. Returns the saved ids in order, plus
 * a map from local ids to the doc ids they were saved under.
 *
 * This runs after every edit, so it avoids a read per stop: places the trip
 * already has are updated directly (and only when something changed), and
 * only new stops go through addPlaces. Saved places the planner no longer
 * lists are deleted.
 */
async function savePlan(tripId, stops, savedPlaces) {
  const saved = new Map(savedPlaces.filter(p => p.tripId === tripId).map(p => [p.id, p]));
  const toSave = stops.filter(s => s.lat).map(s => ({
    id: s.id,
    name: s.name, description: s.description || '', category: s.category || '',
    lat: s.lat, lng: s.lng, imageUrl: s.imageUrl || null, estimatedMinutes: s.estimatedMinutes || 60,
    group: s.group || null,
    ...(s.bestTime ? { bestTime: s.bestTime, bestTimeReason: s.bestTimeReason || null } : {}),
  }));

  const fresh = toSave.filter(s => !saved.has(s.id));
  const freshIds = fresh.length ? await addPlaces(tripId, fresh) : [];

  await Promise.all(toSave.filter(s => saved.has(s.id)).map(s => {
    const place = saved.get(s.id);
    const fields = {};
    for (const key of SYNCED_FIELDS) {
      if (fieldValue(key, place[key]) !== fieldValue(key, s[key])) fields[key] = fieldValue(key, s[key]);
    }
    return Object.keys(fields).length ? updatePlace(s.id, fields) : null;
  }));

  let f = 0;
  const ids = toSave.map(s => (saved.has(s.id) ? s.id : freshIds[f++]));
  // A saved place still listed without coordinates is kept, not deleted.
  const keep = new Set([...ids, ...stops.map(s => s.id)]);
  await Promise.all([...saved.keys()].filter(id => !keep.has(id)).map(id => deletePlace(id)));
  await updatePlaceOrder(tripId, ids, toSave.map((s, i) => ({ ...s, id: ids[i] })));

  const idMap = {};
  toSave.forEach((s, i) => { if (s.id !== ids[i]) idMap[s.id] = ids[i]; });
  return { ids, idMap };
}

function formatMins(m) {
  if (!m) return '';
  const h = Math.floor(m / 60), mn = m % 60;
  return h > 0 ? (mn > 0 ? `${h}h ${mn}m` : `${h}h`) : `${mn}m`;
}

// ── Geocode helper (uses Google JS API) ─────────────────────────────────────
function geocodeName(name) {
  return new Promise(resolve => {
    if (!window.google?.maps) return resolve(null);
    new window.google.maps.Geocoder().geocode({ address: name }, (res, status) => {
      if (status === 'OK' && res?.length) {
        const r = res[0];
        resolve({ lat: r.geometry.location.lat(), lng: r.geometry.location.lng(), placeId: r.place_id, formatted: r.formatted_address });
      } else resolve(null);
    });
  });
}

// Wait until window.google.maps.places is available (loaded by useMapsLibrary)
function waitForPlaces(timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) return resolve();
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.google?.maps?.places) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error('Google Places library timed out'));
      }
    }, 100);
  });
}

// ── RegionModal: pick specific places inside a region ───────────────────────
function RegionModal({ regionName, label, existingStopsNames, onConfirm, onClose, cache, setCache, canPoll }) {
  const [places, setPlaces] = useState(cache[label] || []);
  const [loading, setLoading] = useState(!cache[label]);
  const [selected, setSelected] = useState({});
  const [excluded, setExcluded] = useState([...existingStopsNames, ...(cache[label] || []).map(p => p.name)]);
  const inTrip = new Set(existingStopsNames.map(normName));
  const isMobile = useIsMobile();

  const loadMore = async () => {
    setLoading(true);
    try {
      const r = await getRegionPlaces(regionName, excluded);
      const aiPlaces = r.places || [];
      await waitForPlaces().catch(() => {});
      const enriched = await enrichPlacesWithGoogle(aiPlaces, regionName).catch(() => aiPlaces);
      const newPlaces = [...places, ...enriched];
      setPlaces(newPlaces);
      setCache(c => ({ ...c, [label]: newPlaces }));
      setExcluded(e => [...e, ...aiPlaces.map(a => a.name)]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // One-shot fetch when the modal mounts; loadMore owns its own loading
    // state and must not refire on cache/region identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!cache[label]) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Places already in the trip are shown, but can't be picked twice.
  const toggle = (i) => { if (!inTrip.has(normName(places[i]?.name))) setSelected(p => ({ ...p, [i]: !p[i] })); };
  const pickedCount = Object.values(selected).filter(Boolean).length;
  // After picking: a review step with the AI's visit lengths and best times.
  const [reviewing, setReviewing] = useState(false);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? 12 : 16 }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: isMobile ? '16px 16px 12px' : '24px 24px 16px', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight:800, color:'#0f172a', margin:0 }}>Explore {label} ✨</h2>
              <p style={{ fontSize:14, color:'#64748b', margin:'4px 0 0' }}>{reviewing ? 'Check the timings before adding' : 'Pick the spots you want to visit'}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={24}/></button>
          </div>
        </div>
        {reviewing ? (
          <ReviewPicks
            picks={places.filter((_, i) => selected[i])}
            area={regionName}
            onBack={() => setReviewing(false)}
            onConfirm={onConfirm}
            canPoll={canPoll}
          />
        ) : (<>
        <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '12px 16px' : '16px 24px' }}>
          {places.length === 0 && loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding: isMobile ? 40 : 60, gap:16 }}>
              <Loader size={32} style={{ color:'#1E3A8A', animation:'spin 1s linear infinite' }}/>
              <span style={{ fontSize:14, color:'#64748b', fontWeight:500 }}>Finding top spots and fetching photos…</span>
            </div>
          ) : (
            <>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {places.map((p, i) => {
                const added = inTrip.has(normName(p.name));
                return (
                <div key={i} onClick={() => toggle(i)} aria-disabled={added || undefined}
                  style={{ display:'flex', alignItems:'stretch', gap: isMobile ? 12 : 16, padding:'12px', borderRadius:16, border: selected[i] ? '2px solid #1E3A8A' : '1px solid #e2e8f0', background: selected[i] ? '#EEF3FC' : '#fff', cursor: added ? 'default' : 'pointer', opacity: added ? 0.55 : 1, transition:'all 200ms', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                  
                  {/* Photo Thumbnail */}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <PlaceThumb place={p} size={isMobile ? 72 : 100} radius={12} />
                    {/* Selected Overlay */}
                    {selected[i] && (
                      <div style={{ position:'absolute', inset:0, borderRadius:12, background:'rgba(30, 58, 138,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <div style={{ width:32, height:32, borderRadius:'50%', background:'#1E3A8A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✓</div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', minWidth: isMobile ? '60%' : 0 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                      <div style={{ fontSize: isMobile ? 14 : 15, fontWeight:800, color:'#0f172a' }}>{p.name}</div>
                      {p.rating && (
                        <div style={{ display:'flex', alignItems:'center', gap:4, background:'#fef3c7', padding:'2px 6px', borderRadius:6, flexShrink:0 }}>
                          <Star size={12} fill="#d97706" color="#d97706" />
                          <span style={{ fontSize:12, fontWeight:700, color:'#d97706' }}>{p.rating}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize:13, color:'#475569', marginTop:4, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</div>
                    <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
                      {p.estimatedMinutes && <div style={{ fontSize:11, color:'#1E3A8A', fontWeight:700, background:'#E5EDFB', padding:'2px 8px', borderRadius:6 }}>⏱ {formatMins(p.estimatedMinutes)}</div>}
                      {formatBestTime(p.bestTime) && <div title={p.bestTimeReason || 'Best time to visit'} style={{ fontSize:11, color:'#92400e', fontWeight:700, background:'#fef3c7', padding:'2px 8px', borderRadius:6 }}>☀ Best {formatBestTime(p.bestTime)}</div>}
                      <div style={{ fontSize:11, color:'#64748b', fontWeight:600, background:'#f1f5f9', padding:'2px 8px', borderRadius:6, textTransform:'capitalize' }}>{p.category}</div>
                      {added && <div style={{ fontSize:11, color:'#047857', fontWeight:700, background:'#d1fae5', padding:'2px 8px', borderRadius:6 }}>✓ In your trip</div>}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
            
            {loading && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:20, gap:12 }}>
                <Loader size={24} style={{ color:'#1E3A8A', animation:'spin 1s linear infinite' }}/>
                <span style={{ fontSize:13, color:'#64748b', fontWeight:500 }}>Fetching places...</span>
              </div>
            )}
            
            {!loading && (
              <button type="button" onClick={loadMore} style={{ background:'none', border:'1px dashed #BFD0F0', borderRadius:12, padding:'14px', color:'#1E3A8A', fontWeight:700, fontSize:14, cursor:'pointer', marginTop:12, width:'100%' }}>
                + Load more places
              </button>
            )}
          </>
          )}
        </div>
        <div style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderTop:'1px solid #f1f5f9', flexShrink:0 }}>
          <button type="button" disabled={pickedCount === 0}
            onClick={() => setReviewing(true)}
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background: pickedCount > 0 ? 'linear-gradient(135deg,#1E3A8A,#1E3A8A)' : '#e2e8f0', color: pickedCount > 0 ? '#fff' : '#6b7280', fontWeight:700, fontSize:15, cursor: pickedCount > 0 ? 'pointer' : 'default', transition:'all 200ms', minHeight:44 }}>
            Add {pickedCount > 0 ? `${pickedCount} place${pickedCount>1?'s':''}` : 'places'} to trip
          </button>
        </div>
        </>)}
      </div>
    </div>
  );
}

// ── AddStopModal: specific vs region choice ──────────────────────────────────
function AddStopModal({ onClose, onAddSpecific, onExploreRegion, canPoll }) {
  const [input, setInput] = useState('');
  const [askCrew, setAskCrew] = useState(false);
  const [selectedPlaceInfo, setSelectedPlaceInfo] = useState(null);
  const [mode, setMode] = useState(null); // null | 'specific' | 'region'
  const inputRef = React.useRef(null);
  const placesLib = useMapsLibrary('places');
  const acRef = React.useRef(null);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    if (!placesLib || !inputRef.current || acRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      fields: ['name', 'formatted_address', 'geometry', 'place_id', 'photos'],
    });
    acRef.current = ac;
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place || !place.name) return;
      const name = place.name || place.formatted_address?.split(',')[0];
      setInput(name);
      if (inputRef.current) inputRef.current.value = name;
      
      if (place.geometry?.location) {
        setSelectedPlaceInfo({
          name: name,
          formatted: place.formatted_address,
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          imageUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
        });
      }
    });
    
    // Prevent enter from submitting the form when selecting autocomplete
    inputRef.current.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.preventDefault();
    });
  }, [placesLib]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    
    // Check if the user selected a place from the dropdown and didn't alter the text
    if (selectedPlaceInfo && input.trim() === selectedPlaceInfo.name) {
      if (mode === 'specific') onAddSpecific(selectedPlaceInfo.name, selectedPlaceInfo, { askCrew });
      else if (mode === 'region') onExploreRegion(selectedPlaceInfo.formatted || selectedPlaceInfo.name, selectedPlaceInfo.name);
    } else {
      if (mode === 'specific') onAddSpecific(input.trim(), null, { askCrew });
      else if (mode === 'region') onExploreRegion(input.trim(), input.trim());
    }
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? 12 : 16 }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:460, overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: isMobile ? 20 : 24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight:800, color:'#0f172a', margin:0 }}>Add a stop</h2>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={20}/></button>
          </div>
          <input ref={inputRef} value={input} onChange={e => { setInput(e.target.value); setSelectedPlaceInfo(null); }} placeholder="e.g. Puducherry  or  Hotel Amigos"
            style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'1.5px solid #e2e8f0', fontSize:16, outline:'none', marginBottom:20, boxSizing:'border-box', color:'#0f172a' }}
            onKeyDown={e => { if(e.key==='Enter' && mode) handleSubmit(); }}
            autoFocus/>

          <p style={{ fontSize:13, fontWeight:600, color:'#475569', marginBottom:12 }}>What kind of stop is this?</p>
          <div style={{ display:'flex', gap:12, marginBottom:20, flexDirection: isMobile ? 'column' : 'row' }}>
            <div onClick={() => { setMode('specific'); if (!input.trim()) inputRef.current?.focus(); }}
              style={{ flex:1, padding:'14px 12px', borderRadius:14, border:`2px solid ${mode==='specific'?'#1E3A8A':'#e2e8f0'}`, background: mode==='specific'?'#EEF3FC':'#fafafa', cursor:'pointer', textAlign:'center', transition:'all 200ms' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>📍</div>
              <div style={{ fontSize:13, fontWeight:700, color: mode==='specific'?'#1E3A8A':'#0f172a' }}>Specific Place</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>I know exactly what I want to visit</div>
            </div>
            <div onClick={() => { setMode('region'); if (!input.trim()) inputRef.current?.focus(); }}
              style={{ flex:1, padding:'14px 12px', borderRadius:14, border:`2px solid ${mode==='region'?'#1E3A8A':'#e2e8f0'}`, background: mode==='region'?'#EEF3FC':'#fafafa', cursor:'pointer', textAlign:'center', transition:'all 200ms' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>🗺️</div>
              <div style={{ fontSize:13, fontWeight:700, color: mode==='region'?'#1E3A8A':'#0f172a' }}>Explore Region</div>
              <div style={{ fontSize:11, color:'#64748b', marginTop:3 }}>Show me what's there, I'll pick</div>
            </div>
          </div>

          {canPoll && mode === 'specific' && (
            <label className="planner-ask-crew">
              <input type="checkbox" checked={askCrew} onChange={e => setAskCrew(e.target.checked)} />
              <Vote size={16} aria-hidden="true" />
              <span><strong>Let the crew vote</strong> on whether to keep this stop</span>
            </label>
          )}

          <button type="button" disabled={!input.trim() || !mode} onClick={handleSubmit}
            style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background: (!input.trim()||!mode)?'#e2e8f0':'linear-gradient(135deg,#1E3A8A,#1E3A8A)', color:(!input.trim()||!mode)?'#6b7280':'#fff', fontWeight:700, fontSize:15, cursor:(!input.trim()||!mode)?'default':'pointer', transition:'all 200ms', minHeight:44 }}>
            {mode==='region' ? '🗺️ Explore places' : mode==='specific' ? '📍 Add stop' : 'Select type above'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StopDescription: Expandable description ───────────────────────────────────
function StopDescription({ text }) {
  if (!text) return null;
  return (
    <ReadMore lines={2} className="compact" fadeHeight={24} expandText="Read more" collapseText="Show less">
      <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{text}</span>
    </ReadMore>
  );
}

// ── Haversine detour calculator ─────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function calcDetourKm(fromCoords, toCoords, viaLat, viaLng) {
  if (!fromCoords?.lat || !toCoords?.lat || !viaLat || !viaLng) return null;
  const direct = haversineKm(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
  const via = haversineKm(fromCoords.lat, fromCoords.lng, viaLat, viaLng) + haversineKm(viaLat, viaLng, toCoords.lat, toCoords.lng);
  return Math.max(0, (via - direct) * 1.3); // ~1.3x road factor
}

// ── RouteModal: AI must-visits between two stops ────────────────────────────
function RouteModal({ fromName, toName, fromCoords, toCoords, existingStopsNames, onConfirm, onClose, cache, setCache, canPoll }) {
  const cacheKey = `${fromName}-${toName}`;
  const [places, setPlaces] = useState(cache[cacheKey] || []);
  const [loading, setLoading] = useState(!cache[cacheKey]);
  const [selected, setSelected] = useState({});
  const [excluded, setExcluded] = useState([...existingStopsNames, ...(cache[cacheKey] || []).map(p => p.name)]);
  const isMobile = useIsMobile();

  const loadMore = async () => {
    setLoading(true);
    try {
      const r = await getRouteMustVisits(fromName, toName, excluded);
      const aiPlaces = r.suggestions || [];
      await waitForPlaces().catch(() => {});
      const enriched = await enrichPlacesWithGoogle(aiPlaces, fromName).catch(() => aiPlaces);
      const newPlaces = [...places, ...enriched];
      setPlaces(newPlaces);
      setCache(c => ({ ...c, [cacheKey]: newPlaces }));
      setExcluded(e => [...e, ...aiPlaces.map(a => a.name)]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // One-shot fetch when the modal mounts; loadMore owns its own loading
    // state and must not refire on cache/key identity changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!cache[cacheKey]) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (i) => setSelected(p => ({ ...p, [i]: !p[i] }));
  const pickedCount = Object.values(selected).filter(Boolean).length;
  // After picking: a review step with the AI's visit lengths and best times.
  const [reviewing, setReviewing] = useState(false);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding: isMobile ? 12 : 16 }}>
      <div style={{ background:'#fff', borderRadius:20, width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: isMobile ? '16px 16px 12px' : '24px 24px 16px', borderBottom:'1px solid #f1f5f9', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight:800, color:'#0f172a', margin:0 }}>Must-visits on the way 🚗</h2>
              <p style={{ fontSize:14, color:'#64748b', margin:'4px 0 0' }}>{reviewing ? 'Check the timings before adding' : <>Between {fromName} & {toName}</>}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background:'none', border:'none', cursor:'pointer', color:'#6b7280', minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={24}/></button>
          </div>
        </div>
        {reviewing ? (
          <ReviewPicks
            picks={places.filter((_, i) => selected[i])}
            area={`${fromName} and ${toName}`}
            onBack={() => setReviewing(false)}
            onConfirm={onConfirm}
            canPoll={canPoll}
          />
        ) : (<>
        <div style={{ flex:1, overflowY:'auto', padding: isMobile ? '12px 16px' : '16px 24px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {places.map((p, i) => (
              <div key={i} onClick={() => toggle(i)}
                style={{ display:'flex', alignItems:'stretch', gap: isMobile ? 12 : 16, padding:'12px', borderRadius:16, border: selected[i] ? '2px solid #1E3A8A' : '1px solid #e2e8f0', background: selected[i] ? '#EEF3FC' : '#fff', cursor:'pointer', transition:'all 200ms', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <PlaceThumb place={p} size={isMobile ? 72 : 100} radius={12} />
                  {selected[i] && (
                    <div style={{ position:'absolute', inset:0, borderRadius:12, background:'rgba(30, 58, 138,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'#1E3A8A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✓</div>
                    </div>
                  )}
                </div>
                <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', minWidth: isMobile ? '60%' : 0 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                    <div style={{ fontSize: isMobile ? 14 : 15, fontWeight:800, color:'#0f172a' }}>{p.name}</div>
                    {p.rating && (
                      <div style={{ display:'flex', alignItems:'center', gap:4, background:'#fef3c7', padding:'2px 6px', borderRadius:6, flexShrink:0 }}>
                        <Star size={12} fill="#d97706" color="#d97706" />
                        <span style={{ fontSize:12, fontWeight:700, color:'#d97706' }}>{p.rating}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize:13, color:'#475569', marginTop:4, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{p.description}</div>
                  <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap', alignItems:'center' }}>
                    {p.estimatedMinutes && <div style={{ fontSize:11, color:'#1E3A8A', fontWeight:700, background:'#E5EDFB', padding:'2px 8px', borderRadius:6 }}>⏱ {formatMins(p.estimatedMinutes)}</div>}
                      {formatBestTime(p.bestTime) && <div title={p.bestTimeReason || 'Best time to visit'} style={{ fontSize:11, color:'#92400e', fontWeight:700, background:'#fef3c7', padding:'2px 8px', borderRadius:6 }}>☀ Best {formatBestTime(p.bestTime)}</div>}
                    <div style={{ fontSize:11, color:'#64748b', fontWeight:600, background:'#f1f5f9', padding:'2px 8px', borderRadius:6, textTransform:'capitalize' }}>{p.category}</div>
                    {(() => {
                      const detour = calcDetourKm(fromCoords, toCoords, p.lat, p.lng);
                      if (detour === null) return null;
                      const label = detour < 1 ? `~${Math.round(detour * 1000)} m detour` : `~${detour.toFixed(1)} km detour`;
                      return (
                        <div style={{ fontSize:11, color:'#0369a1', fontWeight:700, background:'#e0f2fe', padding:'2px 8px', borderRadius:6, display:'flex', alignItems:'center', gap:3 }}>
                          🔀 {label}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:20, gap:12 }}>
                <Loader size={24} style={{ color:'#1E3A8A', animation:'spin 1s linear infinite' }}/>
                <span style={{ fontSize:13, color:'#64748b', fontWeight:500 }}>Fetching places...</span>
              </div>
            )}
            
            {!loading && (
              <button type="button" onClick={loadMore} style={{ background:'none', border:'1px dashed #BFD0F0', borderRadius:12, padding:'14px', color:'#1E3A8A', fontWeight:700, fontSize:14, cursor:'pointer', marginTop:8, width:'100%' }}>
                + Load more places
              </button>
            )}
          </div>
        </div>
        <div style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderTop:'1px solid #f1f5f9', flexShrink:0 }}>
          <button type="button" disabled={pickedCount === 0}
            onClick={() => setReviewing(true)}
            style={{ width:'100%', padding:'12px', borderRadius:12, border:'none', background: pickedCount > 0 ? 'linear-gradient(135deg,#1E3A8A,#1E3A8A)' : '#e2e8f0', color: pickedCount > 0 ? '#fff' : '#6b7280', fontWeight:700, fontSize:15, cursor: pickedCount > 0 ? 'pointer' : 'default', transition:'all 200ms', minHeight:44 }}>
            Add {pickedCount > 0 ? `${pickedCount} place${pickedCount>1?'s':''}` : 'places'} to trip
          </button>
        </div>
        </>)}
      </div>
    </div>
  );
}

// ── EditTripModal: update the trip's start/end points and dates ─────────────
function EditTripModal({ trip, onClose, onSaved }) {
  const sameEnd = !trip.endingPoint || trip.endingPoint?.name === trip.startingPoint?.name;
  const [startName, setStartName] = useState(trip.startingPoint?.name || '');
  const [startPoint, setStartPoint] = useState(trip.startingPoint || null);
  const [differentEnd, setDifferentEnd] = useState(!sameEnd);
  const [endName, setEndName] = useState(sameEnd ? '' : (trip.endingPoint?.name || ''));
  const [endPoint, setEndPoint] = useState(sameEnd ? null : (trip.endingPoint || null));
  const [startDate, setStartDate] = useState(trip.startDate ? new Date(trip.startDate) : null);
  const [endDate, setEndDate] = useState(trip.endDate ? new Date(trip.endDate) : null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      // Geocode a typed-only point so it lands on the map. startPoint/endPoint
      // are cleared by the onChange handlers the moment the text is edited, so
      // a stale earlier selection is never reused for a freshly-typed name.
      const resolvePoint = async (point) => {
        if (!point || hasCoords(point) || !MAPS_ENABLED) return point;
        try {
          const geo = await forwardGeocode(point.name);
          return geo
            ? { ...point, lat: geo.lat, lng: geo.lng, placeId: point.placeId || geo.placeId, formatted: point.formatted || geo.formatted }
            : point;
        } catch { return point; }
      };
      const rawStart = startPoint || (startName.trim() ? { name: startName.trim() } : null);
      const startingPoint = await resolvePoint(rawStart);
      let endingPoint = startingPoint;
      if (differentEnd) {
        const rawEnd = endPoint || (endName.trim() ? { name: endName.trim() } : null);
        endingPoint = await resolvePoint(rawEnd);
      }
      const fields = {
        startingPoint: startingPoint || null,
        endingPoint: endingPoint || null,
        startDate: startDate ? startDate.toISOString().split('T')[0] : null,
        endDate: endDate ? endDate.toISOString().split('T')[0] : null,
      };
      await updateTrip(trip.id, fields);
      onSaved(fields);
      onClose();
    } catch (e) {
      console.error('Failed to update trip', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit trip details" subtitle="Update where the trip starts, ends, and when.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label">Starting point</label>
          <LocationAutocomplete
            value={startName}
            placeholder="Where does the trip start?"
            onChange={(t) => { setStartName(t); setStartPoint((prev) => (prev && t !== prev.name) ? null : prev); }}
            onSelect={(p) => { setStartPoint(p); if (p) setStartName(p.name); }}
          />
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={differentEnd} onChange={(e) => setDifferentEnd(e.target.checked)} />
          <span>The trip ends at a different place</span>
        </label>
        {differentEnd && (
          <div>
            <label className="input-label">Ending point</label>
            <LocationAutocomplete
              value={endName}
              placeholder="Where does the trip end?"
              onChange={(t) => { setEndName(t); setEndPoint((prev) => (prev && t !== prev.name) ? null : prev); }}
              onSelect={(p) => { setEndPoint(p); if (p) setEndName(p.name); }}
            />
          </div>
        )}
        <div>
          <label className="input-label">Trip dates</label>
          <div className="form-row">
            <DatePicker selected={startDate} onChange={(d) => setStartDate(d)} selectsStart startDate={startDate} endDate={endDate} className="input-field" placeholderText="Start date" dateFormat="MMM d, yyyy" />
            <DatePicker selected={endDate} onChange={(d) => setEndDate(d)} selectsEnd startDate={startDate} endDate={endDate} minDate={startDate || undefined} className="input-field" placeholderText="End date" dateFormat="MMM d, yyyy" />
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost btn-md" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary btn-md" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}

// AI suggestions for regions and routes, kept for the session. They're paid
// calls; leaving the tab and reopening an explorer shouldn't repeat them.
const regionSuggestions = {};
const routeSuggestions = {};

// ── Main PlannerContent ──────────────────────────────────────────────────────
function PlannerContent({ onOpenMap }) {
  const { selectedTrip, setSelectedTrip, places, polls } = useTrip();
  const { user } = useAuth();
  const { tripId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  // Below 1024px the discovery sidebar folds into a dock under the plan:
  // collapsed by default, expandable, with "Go to itinerary" always in reach.
  const isNarrow = useIsMobile(1024);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const isGuest = useGuestMode();

  // plannerStops: [{ id, name, description, category, estimatedMinutes, lat, lng, group, geocoding }]
  const [stops, setStops] = useState([]);
  const [trackedTripId, setTrackedTripId] = useState(tripId);
  const [trackedPlacesSig, setTrackedPlacesSig] = useState('');
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [regionModal, setRegionModal] = useState(null); // { query, label }
  const [routeModal, setRouteModal] = useState(null); // { fromName, toName, afterIndex }
  const [regionCache, setRegionCache] = useState(() => ({ ...regionSuggestions }));
  const [routeCache, setRouteCache] = useState(() => ({ ...routeSuggestions }));
  useEffect(() => { Object.assign(regionSuggestions, regionCache); }, [regionCache]);
  useEffect(() => { Object.assign(routeSuggestions, routeCache); }, [routeCache]);
  const [, setGeocodingId] = useState(null);
  const [nearbyQuery, setNearbyQuery] = useState('');
  const [nearbyResults, setNearbyResults] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);

  // Clear sidebar state on trip change
  React.useEffect(() => {
    setNearbyResults([]);
    setNearbyQuery('');
  }, [selectedTrip?.id]);

  // Keep the editable `stops` list in sync with the trip's saved places.
  // Done synchronously during render (React's sanctioned "adjust state when a
  // prop changes" pattern) so there is no cascading-render effect.
  const placesSig = places.map(p => p.id).join(',');
  if (tripId !== trackedTripId) {
    // Trip switched — reseed the stops list from the new trip's places.
    setTrackedTripId(tripId);
    setTrackedPlacesSig(placesSig);
    setStops(places.map(placeToStop));
  } else if (placesSig !== trackedPlacesSig) {
    // Same trip, saved place set changed (e.g. edited from the map view, or
    // our own autosave landing) — reconcile without discarding the user's
    // local, not-yet-saved edits.
    const prevPlaceIds = new Set(trackedPlacesSig ? trackedPlacesSig.split(',') : []);
    const currentPlaceIds = new Set(places.map(p => p.id));
    setTrackedPlacesSig(placesSig);
    setStops(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      // Drop stops that came from Firestore but have since been deleted there
      // (e.g. removed in map mode) — otherwise the next save would re-create
      // them. Locally-added, not-yet-saved stops are kept: their ids were
      // never in `places`, so they can't match prevPlaceIds.
      const pruned = prev.filter(s => !(prevPlaceIds.has(s.id) && !currentPlaceIds.has(s.id)));
      // Places that are genuinely new since the last sync. A saved place the
      // user removed locally stays in prevPlaceIds, so it is NOT re-added.
      const incoming = places.filter(p => !existingIds.has(p.id) && !prevPlaceIds.has(p.id));
      // A stop saved from here comes back under its new doc id, often before
      // the save call returns. Adopt that id rather than listing it twice.
      let adopted = false;
      const merged = pruned.map(s => {
        if (!isLocalId(s.id)) return s;
        const at = incoming.findIndex(p => normName(p.name) === normName(s.name));
        if (at === -1) return s;
        adopted = true;
        return { ...s, id: incoming.splice(at, 1)[0].id };
      });
      if (!adopted && incoming.length === 0 && pruned.length === prev.length) return prev;
      return [...merged, ...incoming.map(placeToStop)];
    });
  }

  // ── Autosave ──────────────────────────────────────────────────────────────
  // Every edit is written to the trip shortly after it's made, so switching
  // to the Itinerary tab (or closing the planner any other way) never loses
  // stops. Only the user's own edits trigger a save — a change arriving from
  // Firestore (another member, the map view) must not be written back over.
  const [editVersion, setEditVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const stopsRef = useRef(stops);
  const placesRef = useRef(places);
  const tripIdRef = useRef(tripId);
  const versionRef = useRef(editVersion);
  const isPublicRef = useRef(!!selectedTrip?.isPublic);
  const pendingRef = useRef(null); // trip id with an edit waiting to be saved
  const chainRef = useRef(Promise.resolve());

  useEffect(() => {
    stopsRef.current = stops;
    placesRef.current = places;
    tripIdRef.current = tripId;
    versionRef.current = editVersion;
    isPublicRef.current = !!selectedTrip?.isPublic;
  });

  /** setStops for a user edit: same signature, but schedules a save. */
  const edit = useCallback((update) => {
    setStops(update);
    setEditVersion(v => v + 1);
  }, []);

  // Saves run one at a time, each with the latest stops, so a slow save can
  // never land after a newer one and undo it.
  const flush = useCallback(() => {
    const tid = pendingRef.current;
    pendingRef.current = null;
    if (!tid || tid !== tripIdRef.current) return chainRef.current;
    chainRef.current = chainRef.current.then(async () => {
      const version = versionRef.current;
      try {
        const { ids, idMap } = await savePlan(tid, stopsRef.current, placesRef.current);
        setSelectedTrip(prev => (prev?.id === tid ? { ...prev, placeOrder: ids } : prev));
        if (Object.keys(idMap).length) setStops(prev => prev.map(s => (idMap[s.id] ? { ...s, id: idMap[s.id] } : s)));
        // A publicly listed trip keeps its card's stop count and highlights current.
        if (isPublicRef.current) await updateTrip(tid, publicSummaryFor(stopsRef.current));
        setSavedVersion(v => Math.max(v, version));
        setSaveError(false);
      } catch (e) {
        console.error('Saving the plan failed', e);
        setSaveError(true);
      }
    });
    return chainRef.current;
  }, [setSelectedTrip]);

  useEffect(() => {
    if (editVersion === 0 || isGuest || !tripId) return;
    pendingRef.current = tripId;
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
  }, [editVersion, isGuest, tripId, flush]);

  // Leaving the planner (Itinerary tab, back button, trip list) saves
  // whatever is still waiting rather than dropping it.
  useEffect(() => () => { flush(); }, [flush]);

  const retrySave = () => {
    pendingRef.current = tripId;
    flush();
  };

  const goToItinerary = async () => {
    setLeaving(true);
    if (editVersion > savedVersion) pendingRef.current = tripId;
    await flush();
    navigate(`/trip/${tripId}/itinerary`);
  };

  // Force-load the Places library so RegionModal/RouteModal can enrich places.
  useMapsLibrary('places');

  const hasName = (list, name) => list.some(s => normName(s.name) === normName(name));

  const removeStop = (id) => edit(p => p.filter(s => s.id !== id));

  // Swap a stop with its neighbour. Inside a region the buttons only offer
  // moves within that region, so a stop never leaves its group this way.
  const moveStop = (index, direction) => {
    edit(prev => {
      const j = index + direction;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  // Move a whole block — a lone stop, or a region with all its places — past
  // the neighbouring block, so moving a stop never splits a region apart.
  const moveBlock = (blockIndex, direction) => {
    edit(prev => {
      const blocks = groupStops(prev);
      const j = blockIndex + direction;
      if (j < 0 || j >= blocks.length) return prev;
      [blocks[blockIndex], blocks[j]] = [blocks[j], blocks[blockIndex]];
      return blocks.flatMap(b => b.entries.map(e => e.stop));
    });
  };

  const removeBlock = (block) => {
    const ids = new Set(block.entries.map(e => e.stop.id));
    edit(p => p.filter(s => !ids.has(s.id)));
  };

  // ── Crew votes on stops ──────────────────────────────────────────────────
  // Polls are a saved-trip feature (like the Polls tab), so only members of a
  // claimed trip can start one.
  const canPoll = !isGuest && !!user && isTripClaimed(selectedTrip);
  // Names polled this session count as "voting" straight away — before the
  // new poll arrives from Firestore — so a quick second tap can't start a
  // duplicate.
  const [startedPolls, setStartedPolls] = useState(() => new Map()); // name -> polls it had when started
  const norm = (n) => n?.trim().toLowerCase() || '';
  const stopPolls = (name) => (polls || []).filter(p => p.kind === 'include' && norm(p.subjectName) === norm(name));
  const openStopPoll = (name) => {
    const found = stopPolls(name);
    if (found.some(p => p.status === 'open')) return true;
    // Just started and not back from Firestore yet.
    return startedPolls.has(norm(name)) && found.length <= startedPolls.get(norm(name));
  };
  const [pollBusy, setPollBusy] = useState(null);
  const askCrew = async (names) => {
    if (!canPoll) return;
    for (const name of names) {
      if (!name || openStopPoll(name)) continue;
      setStartedPolls(prev => new Map(prev).set(norm(name), stopPolls(name).length));
      const saved = places.find(p => p.name?.trim().toLowerCase() === name.trim().toLowerCase());
      try {
        await createStopPoll({ tripId: selectedTrip.id, placeName: name, placeId: saved?.id || null, createdBy: user.uid });
      } catch (e) {
        console.error('Could not start the poll', e);
        setStartedPolls(prev => { const n = new Map(prev); n.delete(norm(name)); return n; });
      }
    }
  };
  const askCrewAbout = async (stop) => {
    setPollBusy(stop.id);
    try { await askCrew([stop.name]); } finally { setPollBusy(null); }
  };

  const addSpecificStop = async (name, placeObj = null, opts = {}) => {
    if (opts.askCrew) askCrew([placeObj?.name || name]);
    setShowAddModal(false);
    if (hasName(stops, placeObj?.name || name)) return; // already in the trip
    const id = `stop-${Date.now()}`;
    if (placeObj) {
      edit(p => [...p, {
        id, name: placeObj.name, description: placeObj.formatted || '', category: 'default',
        estimatedMinutes: 60, lat: placeObj.lat, lng: placeObj.lng, imageUrl: placeObj.imageUrl || null, geocoding: false
      }]);
    } else {
      const tempStop = { id, name, description: '', category: 'default', estimatedMinutes: 60, lat: null, lng: null, geocoding: true };
      setStops(p => [...p, tempStop]);
      setGeocodingId(id);
      try {
        const geo = await geocodeName(name);
        edit(p => p.map(s => s.id === id ? { ...s, lat: geo?.lat, lng: geo?.lng, description: geo?.formatted || '', geocoding: false } : s));
      } catch {
        setStops(p => p.map(s => s.id === id ? { ...s, geocoding: false } : s));
      }
      setGeocodingId(null);
    }
  };

  const openRegionExplorer = (query, label) => {
    setShowAddModal(false);
    setRegionModal({ query, label: regionLabel(label || query) });
  };

  // Places picked from a region join that region's block — appended after
  // its last place if the region is already in the trip, else at the end.
  const confirmRegionPicks = (pickedPlaces, opts = {}) => {
    if (opts.askCrew) askCrew(pickedPlaces.map(p => p.name));
    const region = regionModal;
    setRegionModal(null);
    const stamp = Date.now();
    edit(prev => {
      let at = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].group && normName(prev[i].group) === normName(region.label)) { at = i; break; }
      }
      const group = at === -1 ? region.label : prev[at].group;
      const fresh = pickedPlaces
        .filter(p => !hasName(prev, p.name))
        .map((p, i) => ({
          id: `region-${stamp}-${i}`,
          name: p.name,
          description: p.description || '',
          category: p.category || 'default',
          estimatedMinutes: p.estimatedMinutes || 90,
          lat: p.lat || null,
          lng: p.lng || null,
          imageUrl: p.imageUrl || null,
          group,
          bestTime: p.bestTime || null,
          bestTimeReason: p.bestTimeReason || null,
          geocoding: false,
        }));
      if (!fresh.length) return prev;
      if (at === -1) return [...prev, ...fresh];
      return [...prev.slice(0, at + 1), ...fresh, ...prev.slice(at + 1)];
    });
  };

  const insertRouteStops = (pickedPlaces, opts = {}) => {
    if (opts.askCrew) askCrew(pickedPlaces.map(p => p.name));
    if (!routeModal) return;
    const { afterIndex } = routeModal;
    setRouteModal(null);
    const stamp = Date.now();
    edit(p => {
      const newStops = pickedPlaces.filter(pl => !hasName(p, pl.name)).map((pl, i) => ({
        id: `route-${stamp}-${i}`,
        name: pl.name,
        description: pl.description || '',
        category: pl.category || 'default',
        estimatedMinutes: pl.estimatedMinutes || 60,
        lat: pl.lat || null,
        lng: pl.lng || null,
        imageUrl: pl.imageUrl || null,
        bestTime: pl.bestTime || null,
        bestTimeReason: pl.bestTimeReason || null,
        geocoding: false,
      }));
      const copy = [...p];
      copy.splice(afterIndex + 1, 0, ...newStops);
      return copy;
    });
  };

  // Only geocoded endpoints become timeline stops — a typed-only label has no
  // coordinates and would render an unplaceable pin.
  const startStop = hasCoords(selectedTrip?.startingPoint)
    ? { id:'_start', name:selectedTrip.startingPoint.name, lat:selectedTrip.startingPoint.lat, lng:selectedTrip.startingPoint.lng, description:'Trip starts here', category:'start', estimatedMinutes:0, imageUrl:null }
    : null;
  const endStop = hasCoords(selectedTrip?.endingPoint)
    ? { id:'_end', name:selectedTrip.endingPoint.name, lat:selectedTrip.endingPoint.lat, lng:selectedTrip.endingPoint.lng, description:'Trip ends here', category:'end', estimatedMinutes:0, imageUrl:null }
    : null;
  const blocks = groupStops(stops);
  const isEmpty = !startStop && !endStop && stops.length === 0;

  // One stop on the timeline: its node (letter, or 🏠 / 🏁) and its card.
  // Nested stops sit inside a region's thread, one size smaller.
  const renderStop = (stop, { kind = 'stop', index = -1, nested = false, canUp = false, canDown = false, onMove, isLast = false } = {}) => {
    const isStart = kind === 'start';
    const isEnd = kind === 'end';
    const isReal = kind === 'stop';
    const letter = isStart ? '🏠' : isEnd ? '🏁' : stopLetter(index);
    const nodeBg = isStart ? 'linear-gradient(135deg,#10B981,#059669)' : isEnd ? 'linear-gradient(135deg,#EF4444,#B91C1C)' : 'linear-gradient(135deg,#1E3A8A,#1E3A8A)';
    const node = nested ? 26 : 32;
    return (
      <div key={stop.id} style={{ display:'flex', alignItems:'flex-start', gap: nested ? 10 : 12 }}>
        {/* Timeline node */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', alignSelf:'stretch', paddingTop: nested ? 8 : 4, width: nested ? 28 : 36, flexShrink:0 }}>
          <div style={{ width:node, height:node, borderRadius:'50%', background:nodeBg, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize: isStart || isEnd ? 14 : nested ? 11 : 13 }}>
            {letter}
          </div>
          {!isLast && <div style={{ width:2, flex:1, minHeight: nested ? 16 : 40, background:'#e2e8f0', margin:'6px 0' }}/>}
        </div>

        <div className="planner-stop-card" style={{ flex: 1, minWidth: 0, padding: nested ? (isMobile ? '10px 12px' : '12px 16px') : (isMobile ? '14px 16px' : '16px 20px'), marginBottom: nested ? 8 : 0, background: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 8 : 0 }}>
            {/* On phones the name keeps ~200px; the minutes box wraps below
                it instead of squeezing the name to a letter per line. */}
            <div style={{ display:'flex', alignItems:'center', gap:12, flex: isMobile ? '1 1 200px' : 1, minWidth:0 }}>
              <PlaceThumb place={stop} size={nested ? 40 : 48} radius={8} />
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize: nested ? 14 : 15, fontWeight:700, color:'#0f172a', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {stop.name}
                  {isReal && stop.geocoding && <Loader size={12} style={{ color:'#1E3A8A', animation:'spin 1s linear infinite' }}/>}
                  {isReal && !stop.lat && !stop.geocoding && <span style={{ fontSize:10, color:'#ef4444', fontWeight:600, background:'#fee2e2', padding:'1px 6px', borderRadius:4 }}>No location</span>}
                  {isStart && <span style={{ fontSize:10, color:'#059669', fontWeight:600, background:'#d1fae5', padding:'1px 6px', borderRadius:4 }}>Start</span>}
                  {isEnd && <span style={{ fontSize:10, color:'#b91c1c', fontWeight:600, background:'#fee2e2', padding:'1px 6px', borderRadius:4 }}>End</span>}
                </div>
                <StopDescription text={stop.description} />
              </div>
            </div>
            {isReal && !isGuest && (
              <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 6 : 8, flexShrink: isMobile ? 1 : 0, flexWrap: isMobile ? 'wrap' : 'nowrap', minWidth: 0, marginLeft: isMobile ? (nested ? 52 : 60) : 0 }}>
                {/* Reorder buttons */}
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button type="button" onClick={() => onMove(-1)} disabled={!canUp} title="Move up" aria-label={`Move ${stop.name} up`} style={{ background:'none', border:'none', cursor: canUp ? 'pointer' : 'default', color: canUp ? '#64748b' : '#cbd5e1', padding:2, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', minHeight:28, minWidth:32 }}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" onClick={() => onMove(1)} disabled={!canDown} title="Move down" aria-label={`Move ${stop.name} down`} style={{ background:'none', border:'none', cursor: canDown ? 'pointer' : 'default', color: canDown ? '#64748b' : '#cbd5e1', padding:2, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', minHeight:28, minWidth:32 }}>
                    <ArrowDown size={14} />
                  </button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4, background:'#f1f5f9', borderRadius:8, padding: isMobile ? '6px 12px' : '4px 10px' }}>
                  <Clock size={12} color="#1E3A8A"/>
                  <input type="number" min={15} step={15} value={stop.estimatedMinutes} aria-label={`Minutes at ${stop.name}`}
                    onChange={e => edit(p => p.map(s => s.id === stop.id ? {...s, estimatedMinutes: parseInt(e.target.value)||30} : s))}
                    style={{ width:isMobile ? 60 : 52, border:'none', background:'transparent', fontSize:16, fontWeight:700, color:'#0f172a', outline:'none', textAlign:'center' }}/>
                  <span style={{ fontSize:11, color:'#64748b' }}>min</span>
                </div>
                {canPoll && (openStopPoll(stop.name) ? (
                  <button type="button" className="planner-vote-chip is-live" onClick={() => navigate(`/trip/${selectedTrip.id}/polls`)} title="The crew is voting on this stop — see the poll" aria-label={`The crew is voting on ${stop.name} — see the poll`}>
                    <Vote size={14} aria-hidden="true" />{!isMobile && ' Voting'}
                  </button>
                ) : (
                  <button type="button" className="planner-vote-chip" onClick={() => askCrewAbout(stop)} disabled={pollBusy === stop.id} aria-label={`Ask the crew whether to keep ${stop.name}`} title="Ask the crew whether to keep this stop">
                    <Vote size={14} aria-hidden="true" />{!isMobile && <span>{pollBusy === stop.id ? 'Starting…' : 'Ask crew'}</span>}
                  </button>
                ))}
                <button type="button" onClick={() => removeStop(stop.id)} aria-label={`Remove ${stop.name}`} title="Remove stop" style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:4, borderRadius:6, minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}><X size={16}/></button>
              </div>
            )}
            {isReal && isGuest && (
              <div style={{ display:'flex', alignItems:'center', gap:4, background:'#f1f5f9', borderRadius:8, padding: isMobile ? '6px 12px' : '4px 10px', flexShrink:0, marginLeft: isMobile ? 60 : 0 }}>
                <Clock size={12} color="#94a3b8"/>
                <span style={{ fontSize:14, fontWeight:700, color:'#64748b', minWidth: isMobile ? 40 : 32, textAlign:'center' }}>{stop.estimatedMinutes}</span>
                <span style={{ fontSize:11, color:'#94a3b8' }}>min</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // An explored region: its own node and heading, with the places picked
  // there threaded underneath.
  const renderRegion = (block, b, isLast) => {
    const count = block.entries.length;
    const minutes = block.entries.reduce((n, e) => n + (e.stop.estimatedMinutes || 0), 0);
    return (
      <div key={block.key} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        {/* On a phone the region box takes the full width instead — its own
            thread already carries the timeline, and every pixel counts. */}
        {!isMobile && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', alignSelf:'stretch', paddingTop:4, width:36, flexShrink:0 }}>
            <div className="planner-region-node" aria-hidden="true"><Compass size={16} /></div>
            {!isLast && <div style={{ width:2, flex:1, minHeight:40, background:'#e2e8f0', margin:'6px 0' }}/>}
          </div>
        )}
        <section className="planner-region" aria-label={`${block.group}: ${count} place${count > 1 ? 's' : ''}`}>
          <div className="planner-region-head">
            <div style={{ minWidth:0 }}>
              <span className="planner-region-kicker">Region</span>
              <h3 className="planner-region-name">{block.group}</h3>
              <span className="planner-region-meta">{count} place{count > 1 ? 's' : ''}{minutes ? ` · ${formatMins(minutes)}` : ''}</span>
            </div>
            {!isGuest && (
              <div className="planner-region-actions">
                <button type="button" className="planner-region-add" onClick={() => setRegionModal({ query: block.group, label: block.group })}>
                  <Plus size={14} aria-hidden="true" /> Add places
                </button>
                <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                  <button type="button" onClick={() => moveBlock(b, -1)} disabled={b === 0} title="Move region up" aria-label={`Move ${block.group} up`} className="planner-region-icon"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => moveBlock(b, 1)} disabled={b === blocks.length - 1} title="Move region down" aria-label={`Move ${block.group} down`} className="planner-region-icon"><ArrowDown size={14} /></button>
                </div>
                <button type="button" onClick={() => removeBlock(block)} title="Remove region" aria-label={`Remove ${block.group} and its places`} className="planner-region-icon is-danger"><X size={16} /></button>
              </div>
            )}
          </div>
          <div className="planner-region-thread">
            {block.entries.map((e, k) => renderStop(e.stop, {
              index: e.index,
              nested: true,
              canUp: k > 0,
              canDown: k < count - 1,
              onMove: dir => moveStop(e.index, dir),
              isLast: k === count - 1,
            }))}
          </div>
        </section>
      </div>
    );
  };

  // "See must-visits on the way" between two consecutive blocks.
  const renderRouteButton = (from, to) => (
    <div style={{ margin: isMobile ? '4px 0 4px 44px' : '4px 0 4px 48px' }}>
      <button type="button" onClick={() => setRouteModal({ fromName: from.stop.name, toName: to.stop.name, afterIndex: from.index, fromCoords: from.stop.lat ? { lat: from.stop.lat, lng: from.stop.lng } : null, toCoords: to.stop.lat ? { lat: to.stop.lat, lng: to.stop.lng } : null })} className="planner-route-btn">
        <Route size={12}/> See must-visits on the way
      </button>
    </div>
  );

  const pendingSave = editVersion > savedVersion;
  const canOpenItinerary = stops.some(s => s.lat) || places.length > 0;
  const missingCount = stops.filter(s => !s.lat).length;

  // Nearby search: chips, a search box and results to add. Shown in the
  // sidebar on desktop and in the "Discover nearby" pop-up on smaller screens.
  const discoverBody = (
            <>
              <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Search near your first stop</p>
              {/* Quick suggestion chips */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                {['cafe', 'restaurant', 'temple', 'museum', 'park', 'hotel', 'beach', 'mall', 'ATM', 'pharmacy'].map(chip => (
                  <button type="button" key={chip} onClick={async () => {
                    setNearbyQuery(chip);
                    if (!stops.find(s=>s.lat)) return;
                    setLoadingNearby(true);
                    try {
                      const { searchNearby } = await import('../services/placesService');
                      const first = stops.find(s=>s.lat);
                      const r = await searchNearby({ lat:first.lat, lng:first.lng, query:chip });
                      setNearbyResults(r);
                    } catch { /* ignore */ } finally { setLoadingNearby(false); }
                  }}
                    style={{ padding:'5px 10px', borderRadius:20, border:'1px solid #e2e8f0', background: nearbyQuery === chip ? '#1E3A8A' : '#f8fafc', color: nearbyQuery === chip ? '#fff' : '#475569', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 150ms', whiteSpace:'nowrap' }}
                  >{chip}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                <div style={{ flex: 1 }}>
                  <LocationAutocomplete
                    value={nearbyQuery}
                    onChange={(val) => setNearbyQuery(val)}
                    onSelect={async (p) => {
                      if (!p) return;
                      const query = p.name;
                      setNearbyQuery(query);
                      if (!stops.find(s=>s.lat)) return;
                      setLoadingNearby(true);
                      try {
                        const { searchNearby } = await import('../services/placesService');
                        const first = stops.find(s=>s.lat);
                        const r = await searchNearby({ lat:first.lat, lng:first.lng, query });
                        setNearbyResults(r);
                      } catch { /* ignore */ } finally { setLoadingNearby(false); }
                    }}
                    placeholder="e.g. cafe, temple…"
                  />
                </div>
                <button type="button"
                  onClick={async () => {
                    if (!nearbyQuery.trim() || !stops.find(s=>s.lat)) return;
                    setLoadingNearby(true);
                    try {
                      const { searchNearby } = await import('../services/placesService');
                      const first = stops.find(s=>s.lat);
                      const r = await searchNearby({ lat:first.lat, lng:first.lng, query:nearbyQuery.trim() });
                      setNearbyResults(r);
                    } catch { /* ignore */ } finally { setLoadingNearby(false); }
                  }}
                  style={{ padding:'7px 12px', borderRadius:7, border:'none', background:'#0f172a', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:12, minHeight:36 }}
                >{loadingNearby ? '…' : '🔍'}</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {nearbyResults.map((r,i) => (
                  <div key={i} style={{ display:'flex', gap:10, padding:'10px', border:'1px solid #e2e8f0', borderRadius:10, cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='#BFD0F0'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#e2e8f0'}>
                    <PlaceThumb place={r} size={48} radius={8} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.name}</div>
                      <ReadMore lines={2} className="compact" fadeHeight={22}>
                        <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{r.description}</span>
                      </ReadMore>
                      {r.rating && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>⭐ {r.rating}</div>}
                    </div>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); addSpecificStop(r.name, { ...r, formatted: r.description }); }}
                      style={{ flexShrink:0, background:'#EEF3FC', color:'#1E3A8A', border:'none', borderRadius:8, padding:'6px 10px', fontSize:12, fontWeight:700, cursor:'pointer', alignSelf:'center' }}>
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </>
  );

  return (
    <div className="planner-page" style={isNarrow ? { display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}>
      {/* Main panel */}
      <div className="planner-main" style={isNarrow ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' } : undefined}>
        {/* Header */}
        <div className="trip-head">
          <div className="trip-head-text">
            <span className="eyebrow" style={{ color: 'var(--color-indigo)' }}>Trip Planner</span>
            <h1 className="trip-head-title">Map out the journey.</h1>
            <p className="trip-head-sub">
              Add stops, explore regions, and let AI surface hidden gems on the way. Your day-by-day itinerary builds itself.
            </p>
          </div>
          {onOpenMap && (
            <button type="button" className="trip-map-btn" onClick={onOpenMap} aria-label="Open map view">
              <MapIcon size={16} aria-hidden="true" /> Map
            </button>
          )}
        </div>

        {/* Trip details — tap to edit start/end points and dates */}
        {isGuest ? (
          <div className="planner-trip-card" style={{ cursor: 'default' }}>
            <span className="planner-trip-card-rows">
              <span className="planner-trip-card-row">
                <MapPin size={14} aria-hidden="true" />
                {selectedTrip?.startingPoint?.name || 'Start not set'}
                {' → '}
                {(selectedTrip?.endingPoint && selectedTrip.endingPoint.name !== selectedTrip.startingPoint?.name)
                  ? selectedTrip.endingPoint.name
                  : (selectedTrip?.startingPoint?.name ? 'round trip' : 'End not set')}
              </span>
              <span className="planner-trip-card-row">
                <Calendar size={14} aria-hidden="true" />
                {selectedTrip?.startDate
                  ? `${formatDate(selectedTrip.startDate)}${selectedTrip.endDate ? ' — ' + formatDate(selectedTrip.endDate) : ''}`
                  : 'No dates set'}
              </span>
            </span>
          </div>
        ) : (
          <button type="button" className="planner-trip-card" onClick={() => setShowEditTrip(true)} aria-label="Edit trip details">
            <span className="planner-trip-card-rows">
              <span className="planner-trip-card-row">
                <MapPin size={14} aria-hidden="true" />
                {selectedTrip?.startingPoint?.name || 'Start not set'}
                {' → '}
                {(selectedTrip?.endingPoint && selectedTrip.endingPoint.name !== selectedTrip.startingPoint?.name)
                  ? selectedTrip.endingPoint.name
                  : (selectedTrip?.startingPoint?.name ? 'round trip' : 'End not set')}
              </span>
              <span className="planner-trip-card-row">
                <Calendar size={14} aria-hidden="true" />
                {selectedTrip?.startDate
                  ? `${formatDate(selectedTrip.startDate)}${selectedTrip.endDate ? ' — ' + formatDate(selectedTrip.endDate) : ''}`
                  : 'No dates set'}
              </span>
            </span>
            <span className="planner-trip-card-edit"><Pencil size={13} aria-hidden="true" /> Edit</span>
          </button>
        )}

        {/* Stops list */}
        {isEmpty && (
          <div className="glass-card-static" style={{ padding: isMobile ? '36px 24px' : '48px 32px', textAlign: 'center', border: '2px dashed rgba(91,92,246,0.25)' }}>
            <div style={{ fontSize: 56, marginBottom: 16, animation: 'floatSoft 4s ease-in-out infinite', display: 'inline-block', filter: 'drop-shadow(0 6px 16px rgba(91,92,246,0.18))' }} aria-hidden="true">🗺️</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.4px' }}>Your trip is a blank canvas</h3>
            <p style={{ fontSize: 14.5, color: 'var(--text-tertiary)', maxWidth: 420, margin: '0 auto', lineHeight: 1.55 }}>Add a first stop below — a city, a beach, or a region you want to explore — and we'll take it from there.</p>
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {startStop && renderStop(startStop, { kind: 'start', isLast: blocks.length === 0 && !endStop })}

          {blocks.map((block, b) => {
            const isLastBlock = b === blocks.length - 1;
            const next = blocks[b + 1];
            const last = block.entries[block.entries.length - 1];
            return (
              <React.Fragment key={block.key}>
                {block.group
                  ? renderRegion(block, b, isLastBlock && !endStop)
                  : renderStop(last.stop, {
                      index: last.index,
                      canUp: b > 0,
                      canDown: !isLastBlock,
                      onMove: dir => moveBlock(b, dir),
                      isLast: isLastBlock && !endStop,
                    })}
                {/* Route suggestions between consecutive blocks — hidden for guests */}
                {!isGuest && next && renderRouteButton(last, next.entries[0])}
              </React.Fragment>
            );
          })}

          {endStop && renderStop(endStop, { kind: 'end', isLast: true })}
        </div>

        {/* A new trip has no stops yet: offer the places picked when it was
            created (its destination) as regions to explore. */}
        {!isGuest && stops.length === 0 && (selectedTrip?.destination || '').trim() && (
          <div className="planner-start-with">
            <span className="planner-start-with-label">Start with</span>
            {selectedTrip.destination.split(',').map(d => d.trim()).filter(Boolean).slice(0, 4).map(d => (
              <button key={d} type="button" className="planner-start-chip" onClick={() => setRegionModal({ query: d, label: d })}>
                <Compass size={15} aria-hidden="true" /> Explore {d}
              </button>
            ))}
          </div>
        )}

        {/* Add stop button — hidden for guests */}
        {!isGuest && (
          <div className={isNarrow ? 'planner-add-row' : undefined}>
            <button type="button" onClick={() => setShowAddModal(true)} className="planner-add-btn" style={{ padding: isMobile ? '14px 20px' : '12px 20px' }}>
              <Plus size={18}/> Add stop
            </button>
            {isNarrow && (
              <button type="button" onClick={() => setDiscoverOpen(true)} className="planner-discover-btn">
                <Search size={17} aria-hidden="true"/> Discover nearby
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right panel: Tabbed Discovery Sidebar + Pinned Build Itinerary */}
      {(!isNarrow || isGuest || editVersion > 0 || missingCount > 0) && (
      <aside
        className={`planner-sidebar${isNarrow ? ' is-docked' : ''}`}
        style={isNarrow ? {
          width: '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderLeft: 'none', borderTop: '1px solid var(--line)',
          background: 'rgba(255,255,255,0.96)', padding: 0,
        } : undefined}
      >

        {/* On phones and tablets the discovery tools open from the "Discover
            nearby" button under the stops instead of a pull-up bar. */}
        {!isNarrow && <div className="planner-discover-head">Discover more places</div>}

        {/* Sidebar content — scrollable */}
        {!isNarrow && (
        <div id="planner-discover-panel" className="planner-sidebar-content">
          {discoverBody}
        </div>
        )}

        {/* Pinned itinerary button. The plan saves itself, so this only has
            to wait for a save in flight before opening the itinerary. */}
        {(!isNarrow || isGuest || editVersion > 0 || missingCount > 0) && (
        <div style={{ padding: isNarrow ? '10px 16px 12px' : '14px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
          {/* On phones and tablets the Itinerary tab is always on screen, so
              the dock doesn't repeat it with its own button. */}
          {isGuest ? (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: isNarrow ? 0 : 12 }}>🔒 Join this trip to edit the plan</div>
              {!isNarrow && <button type="button"
                onClick={() => navigate(`/trip/${selectedTrip.id}/itinerary`)}
                className="planner-build-btn"
                style={{ background: '#f8fafc', color: '#334155', border: '1px solid #e2e8f0', cursor: 'pointer' }}
              >
                Go to itinerary <ChevronRight size={16} />
              </button>}
            </div>
          ) : (
            <>
              {!isNarrow && <button type="button"
                onClick={goToItinerary}
                disabled={!canOpenItinerary || leaving}
                className={`planner-build-btn ${canOpenItinerary ? 'is-built' : ''}`}
                style={canOpenItinerary ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', cursor: 'pointer' } : undefined}
              >
                {leaving ? (
                  <><Loader size={16} style={{ animation:'spin 1s linear infinite' }} aria-hidden="true"/> Saving your trip…</>
                ) : (
                  <>Go to itinerary <ChevronRight size={16} aria-hidden="true"/></>
                )}
              </button>}
              {editVersion > 0 && (
                <p className="planner-save-status" role="status">
                  {saveError ? (
                    <>Couldn’t save your changes. <button type="button" onClick={retrySave}>Try again</button></>
                  ) : pendingSave ? (
                    <><Loader size={12} style={{ animation:'spin 1s linear infinite' }} aria-hidden="true"/> Saving…</>
                  ) : (
                    <><Check size={12} aria-hidden="true"/> All changes saved</>
                  )}
                </p>
              )}
            </>
          )}
          {!isGuest && missingCount > 0 && (
            <p style={{ fontSize: 11.5, color: '#b45309', textAlign:'center', margin:'10px 0 0', display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center', width: '100%', fontWeight: 600 }}>
              ⚠️ {missingCount} stop(s) missing location — they won’t be saved
            </p>
          )}
        </div>
        )}
      </aside>
      )}

      {/* Phones and tablets: discovery tools in a pop-up */}
      <Modal open={isNarrow && discoverOpen} onClose={() => setDiscoverOpen(false)} title="Discover nearby" subtitle="Cafes, temples, beaches and more near your first stop">
        <div className="planner-sidebar-content planner-discover-modal">
          {discoverBody}
        </div>
      </Modal>

      {/* Modals */}
      {showEditTrip && selectedTrip && (
        <EditTripModal
          trip={selectedTrip}
          onClose={() => setShowEditTrip(false)}
          onSaved={(fields) => setSelectedTrip({ ...selectedTrip, ...fields })}
        />
      )}
      {showAddModal && <AddStopModal onClose={() => setShowAddModal(false)} onAddSpecific={addSpecificStop} onExploreRegion={openRegionExplorer} canPoll={canPoll}/>}
      {regionModal && <RegionModal key={regionModal.label} regionName={regionModal.query} label={regionModal.label} existingStopsNames={stops.map(s => s.name)} cache={regionCache} setCache={setRegionCache} onClose={() => setRegionModal(null)} onConfirm={confirmRegionPicks} canPoll={canPoll}/>}
      {routeModal && <RouteModal fromName={routeModal.fromName} toName={routeModal.toName} fromCoords={routeModal.fromCoords} toCoords={routeModal.toCoords} existingStopsNames={stops.map(s => s.name)} cache={routeCache} setCache={setRouteCache} onClose={() => setRouteModal(null)} onConfirm={insertRouteStops} canPoll={canPoll}/>}
    </div>
  );
}

export default function PlannerPage() {
  usePageSeo({ title: 'Trip Planner', robots: 'noindex, nofollow' });
  const [showMap, setShowMap] = useState(false);
  // The map needs Google Maps. Without a key, never mount MapView (its
  // <Map> would render outside an APIProvider and crash) or its toggle.
  const mapOpen = showMap && MAPS_ENABLED;
  return (
    <MapsProvider>
      {/* PlannerContent stays mounted (just hidden) while the map is shown so
          unsaved planner edits — added stops, reordering, visit durations —
          survive the toggle. MapView writes its changes to Firestore directly,
          so it can safely mount only when needed. */}
      <div style={{ display: mapOpen ? 'none' : 'contents' }}>
        <PlannerContent onOpenMap={MAPS_ENABLED ? () => setShowMap(true) : null} />
      </div>
      {mapOpen && <MapView onExitMap={() => setShowMap(false)} exitLabel="Plan" />}
    </MapsProvider>
  );
}
