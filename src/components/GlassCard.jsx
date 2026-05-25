import React from 'react';

export default function GlassCard({
    children,
    className = '',
    style = {},
    hover = true,
    padding = 24,
    radius,
    intensity = 0.72,
    blur = 22,
    as: Tag = 'div',
    ...rest
}) {
    const cls = hover ? 'glass-card' : 'glass-card-static';
    const baseStyle = {
        padding,
        ...(radius !== undefined ? { borderRadius: radius } : {}),
        ...(intensity !== 0.72 ? { background: `rgba(255, 255, 255, ${intensity})` } : {}),
        ...(blur !== 22 ? { backdropFilter: `blur(${blur}px) saturate(180%)`, WebkitBackdropFilter: `blur(${blur}px) saturate(180%)` } : {}),
        ...style,
    };

    return (
        <Tag className={`${cls} ${className}`.trim()} style={baseStyle} {...rest}>
            {children}
        </Tag>
    );
}
