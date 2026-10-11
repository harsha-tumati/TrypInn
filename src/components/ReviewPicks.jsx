// src/components/ReviewPicks.jsx
// The step between picking places and adding them: each pick shows the AI's
// suggested visit length (which you can change) and the AI's best time of day
// to be there. Used by the Explore-region and must-visits-on-the-way modals.
import { useEffect, useState } from 'react';
import { Minus, Plus, RotateCcw, Sun, Loader } from 'lucide-react';
import PlaceThumb from './PlaceThumb';
import { formatBestTime } from '../utils/bestTime';

const STEP = 15;
const MIN = 15;
const MAX = 24 * 60;

function formatMins(m) {
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
}

export default function ReviewPicks({ picks, area, onBack, onConfirm, footerPadding }) {
    const suggested = picks.map((p) => p.estimatedMinutes || 60);
    const [minutes, setMinutes] = useState(suggested);
    // Best times: from the suggestion itself, else asked for here.
    const [times, setTimes] = useState(() => picks.map((p) => (p.bestTime ? { bestTime: p.bestTime, reason: p.bestTimeReason || '' } : null)));
    const missing = picks.filter((p) => !p.bestTime);
    const [loadingTimes, setLoadingTimes] = useState(missing.length > 0);

    useEffect(() => {
        if (!missing.length) return;
        let alive = true;
        (async () => {
            try {
                const { getBestVisitTimes } = await import('../config/openai');
                const r = await getBestVisitTimes(missing, area);
                const byName = Object.fromEntries(Object.entries(r?.times || {}).map(([k, v]) => [k.trim().toLowerCase(), v]));
                if (!alive) return;
                setTimes((prev) => prev.map((t, i) => {
                    if (t) return t;
                    const hit = byName[picks[i].name.trim().toLowerCase()];
                    return hit?.bestTime ? { bestTime: hit.bestTime, reason: hit.reason || '' } : null;
                }));
            } catch (e) {
                console.error('Best visit times failed', e);
            } finally {
                if (alive) setLoadingTimes(false);
            }
        })();
        return () => { alive = false; };
        // Asked once, for the picks this step opened with.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setAt = (i, v) => setMinutes((prev) => prev.map((m, j) => (j === i ? Math.min(MAX, Math.max(MIN, v)) : m)));

    const confirm = () => onConfirm(picks.map((p, i) => ({
        ...p,
        estimatedMinutes: minutes[i],
        ...(times[i] ? { bestTime: times[i].bestTime, bestTimeReason: times[i].reason } : {}),
    })));

    return (
        <>
            <div className="rp-body">
                <p className="rp-intro">
                    These are the AI’s suggested times. Change how long you’ll stay anywhere, then add them.
                </p>
                <ul className="rp-list">
                    {picks.map((p, i) => {
                        const best = times[i] && formatBestTime(times[i].bestTime);
                        const edited = minutes[i] !== suggested[i];
                        return (
                            <li key={`${p.name}-${i}`} className="rp-item">
                                <PlaceThumb place={p} size={52} radius={10} />
                                <div className="rp-main">
                                    <div className="rp-name">{p.name}</div>
                                    <div className="rp-best">
                                        {best ? (
                                            <>
                                                <Sun size={13} aria-hidden="true" />
                                                <span><b>Best time: {best}</b>{times[i].reason ? ` · ${times[i].reason}` : ''}</span>
                                            </>
                                        ) : loadingTimes ? (
                                            <><Loader size={12} className="rp-spin" aria-hidden="true" /> Finding the best time…</>
                                        ) : (
                                            <span className="rp-muted">Any time of day</span>
                                        )}
                                    </div>
                                </div>
                                <div className="rp-duration">
                                    <div className="rp-stepper" role="group" aria-label={`How long at ${p.name}`}>
                                        <button type="button" onClick={() => setAt(i, minutes[i] - STEP)} disabled={minutes[i] <= MIN} aria-label="15 minutes less"><Minus size={14} /></button>
                                        <span className="rp-value" aria-live="polite">{formatMins(minutes[i])}</span>
                                        <button type="button" onClick={() => setAt(i, minutes[i] + STEP)} disabled={minutes[i] >= MAX} aria-label="15 minutes more"><Plus size={14} /></button>
                                    </div>
                                    {edited ? (
                                        <button type="button" className="rp-reset" onClick={() => setAt(i, suggested[i])}>
                                            <RotateCcw size={11} aria-hidden="true" /> AI: {formatMins(suggested[i])}
                                        </button>
                                    ) : (
                                        <span className="rp-ai">AI ✦ suggested</span>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className="rp-foot" style={footerPadding ? { padding: footerPadding } : undefined}>
                <button type="button" className="rp-back" onClick={onBack}>Back</button>
                <button type="button" className="rp-add" onClick={confirm}>
                    Add {picks.length} place{picks.length > 1 ? 's' : ''} to trip
                </button>
            </div>
        </>
    );
}
