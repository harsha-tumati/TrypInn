import React from 'react';

export default function AnimatedContainer({
    children,
    delay = 0,
    direction = 'up',
    duration = 0.5,
    style = {},
    className = '',
}) {
    const transforms = {
        up: 'translateY(16px)',
        down: 'translateY(-16px)',
        left: 'translateX(16px)',
        right: 'translateX(-16px)',
        none: 'none',
    };

    return (
        <div
            className={`animated-container ${className}`}
            style={{
                animation: `fadeInSlide ${duration}s ease ${delay}s both`,
                '--initial-transform': transforms[direction] || transforms.up,
                ...style,
            }}
        >
            {children}
        </div>
    );
}
