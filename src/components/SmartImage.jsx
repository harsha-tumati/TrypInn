// src/components/SmartImage.jsx
// A drop-in <img> that serves the right number of pixels for the slot.
//
// Renders a bare <img> — no wrapper — because the existing CSS targets
// `.blog-card-img img`, `.mv-card-img img` and friends, and those parents
// already provide the aspect-ratio box and the placeholder background.
//
// Deliberately render-cheap: the load state lives on the DOM node as a class
// rather than in React state. A grid of twelve cards would otherwise pay two
// or three extra renders per image for a purely cosmetic fade.
import { useCallback, useState } from 'react';
import { imageSrc, imageSrcSet } from '../utils/imageUrl';

export default function SmartImage({
    src,
    alt,
    sizes,
    ratio,
    quality = 60,
    // Widest file this slot should ever pull. Card thumbnails cap low so a
    // high-DPR phone doesn't download a hero-sized image for a 350px box.
    maxWidth = 1920,
    // Width for browsers that ignore srcset, and the width asked for when the
    // URL isn't an Unsplash one we can rewrite.
    baseWidth = 800,
    // Used if both the optimised and the original URL fail.
    fallbackSrc,
    // `priority` is for the LCP candidate: load eagerly AND jump the queue.
    // `eager` is for everything in or just below the first viewport: load
    // eagerly at normal priority. Anything left lazy will not begin
    // downloading until the reader scrolls near it, which is what makes a
    // grid appear to fill in square by square.
    priority = false,
    eager = false,
    className = '',
    onError,
    ...rest
}) {
    // Index into the source chain; only ever moves on an error, so this
    // costs nothing in the normal case.
    const [stage, setStage] = useState(0);

    // Reset the chain when the image changes. Render-phase adjustment rather
    // than an effect — the pattern PlaceThumb already uses in this codebase,
    // and it avoids the extra render an effect would cause. Tracked in state
    // rather than a ref because refs must not be read during render.
    const [trackedSrc, setTrackedSrc] = useState(src);
    if (trackedSrc !== src) {
        setTrackedSrc(src);
        if (stage !== 0) setStage(0);
    }

    // Ordered fallback chain. A failure may be down to the AVIF/crop variant
    // rather than the photo, so the untouched URL gets a turn before we give
    // up on it entirely.
    const optimized = imageSrc(src, baseWidth, { quality, ratio });
    const chain = [{ src: optimized, srcSet: imageSrcSet(src, { quality, ratio, maxWidth }) }];
    if (optimized !== src) chain.push({ src, srcSet: undefined });
    if (fallbackSrc) chain.push({ src: fallbackSrc, srcSet: undefined });
    const current = chain[Math.min(stage, chain.length - 1)];

    // Mark loaded on the node itself. The ref callback covers the cached case,
    // where the image finishes before React attaches an onLoad handler.
    const markLoaded = useCallback((node) => {
        if (node && node.complete && node.naturalWidth > 0) node.classList.add('is-loaded');
    }, []);

    return (
        <img
            ref={markLoaded}
            src={current.src}
            srcSet={current.srcSet}
            sizes={current.srcSet ? sizes : undefined}
            alt={alt}
            loading={priority || eager ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            onLoad={(e) => e.currentTarget.classList.add('is-loaded')}
            onError={(e) => {
                setStage(s => Math.min(s + 1, chain.length - 1));
                if (onError) onError(e);
            }}
            className={`tp-img${className ? ' ' + className : ''}`}
            {...rest}
        />
    );
}
