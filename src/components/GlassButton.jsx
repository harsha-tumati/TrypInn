import React from 'react';

const VARIANTS = {
    primary: 'btn btn-primary',
    secondary: 'btn btn-secondary',
    ghost: 'btn btn-ghost',
    accent: 'btn btn-accent',
    coral: 'btn btn-coral',
    danger: 'btn btn-danger',
    cyan: 'btn btn-cyan',
    purple: 'btn btn-purple',
    white: 'btn btn-white',
    outline: 'btn btn-outline',
};

const SIZES = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
};

export default function GlassButton({
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    fullWidth = false,
    onClick,
    style = {},
    className = '',
    type = 'button',
    ariaLabel,
    ...rest
}) {
    const variantCls = VARIANTS[variant] || VARIANTS.primary;
    const sizeCls = SIZES[size] || SIZES.md;

    const baseStyle = {
        ...(fullWidth ? { width: '100%' } : {}),
        ...style,
    };

    return (
        <button
            type={type}
            className={`${variantCls} ${sizeCls} ${className}`.trim()}
            style={baseStyle}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            {...rest}
        >
            {children}
        </button>
    );
}
