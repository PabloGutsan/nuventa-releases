import React from 'react';
import './Button.css';

const Button = ({ 
    children, 
    variant = 'primary', 
    size = 'medium',
    disabled = false,
    loading = false,
    onClick,
    type = 'button',
    fullWidth = false,
    ...props 
}) => {
    const classNames = [
        'btn',
        `btn-${variant}`,
        `btn-${size}`,
        fullWidth && 'btn-full-width',
        disabled && 'btn-disabled',
        loading && 'btn-loading'
    ].filter(Boolean).join(' ');

    return (
        <button
            className={classNames}
            onClick={onClick}
            disabled={disabled || loading}
            type={type}
            {...props}
        >
            {loading && <span className="btn-spinner"></span>}
            <span className="btn-text">{children}</span>
        </button>
    );
};

export default Button;