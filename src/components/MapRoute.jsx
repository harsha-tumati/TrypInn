// src/components/MapRoute.jsx
import { useEffect } from 'react';
import { useMap, useMapsLibrary, AdvancedMarker } from '@vis.gl/react-google-maps';

export default function MapRoute({ directionsResult, color = '#1A73E8', isDashed = false }) {
    const map = useMap();
    const routesLibrary = useMapsLibrary('routes');

    // The DirectionsRenderer is an imperative Google Maps object, not React
    // state — manage it entirely inside the effect and tear it down on cleanup.
    useEffect(() => {
        if (!routesLibrary || !map) return;
        const renderer = new routesLibrary.DirectionsRenderer({
            map,
            suppressMarkers: true, // We draw our own custom markers
            preserveViewport: true, // MapCamera owns the camera
            polylineOptions: {
                strokeColor: isDashed ? 'transparent' : color,
                strokeWeight: 6,
                strokeOpacity: isDashed ? 0 : 0.9,
                icons: isDashed ? [{
                    icon: { path: 'M 0,-1 0,1', strokeColor: color, strokeOpacity: 1, scale: 4 },
                    offset: '0',
                    repeat: '20px'
                }] : [{
                    icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, strokeColor: color, fillColor: color, fillOpacity: 1, scale: 2 },
                    offset: '50%',
                    repeat: '100px'
                }]
            }
        });
        if (directionsResult) renderer.setDirections(directionsResult);
        return () => renderer.setMap(null);
    }, [routesLibrary, map, color, isDashed, directionsResult]);

    if (!directionsResult?.routes?.[0]?.legs) return null;

    return (
        <>
            {directionsResult.routes[0].legs.map((leg, idx) => {
                const halfDist = leg.distance?.value / 2;
                let acc = 0;
                let position = leg.start_location;
                
                if (halfDist) {
                    for (const step of leg.steps) {
                        if (acc + step.distance.value >= halfDist) {
                            position = step.start_location;
                            break;
                        }
                        acc += step.distance.value;
                    }
                }
                
                const latLng = typeof position.lat === 'function' ? { lat: position.lat(), lng: position.lng() } : position;

                return (
                    <AdvancedMarker key={`leg-${idx}`} position={latLng} zIndex={50}>
                        <div style={{ 
                            background: color, 
                            color: '#ffffff', 
                            padding: '4px 12px', 
                            borderRadius: '16px', 
                            fontSize: '14px', 
                            fontWeight: '600', 
                            fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.4)', 
                            transform: 'translateY(-50%)',
                            letterSpacing: '0.2px'
                        }}>
                            {leg.duration.text}
                        </div>
                    </AdvancedMarker>
                );
            })}
        </>
    );
}
