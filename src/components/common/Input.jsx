import React, { forwardRef } from 'react';
import './Input.css';

const Input = forwardRef(({ 
    label,
    error,
    helperText,
    icon,
    rightIcon,
    type = 'text',
    placeholder,
    value,
    onChange,
    onBlur,
    disabled = false,
    required = false,
    ...props 
}, ref) => {
    return (
        <div className="input-wrapper">
            {label && (
                <label className="input-label">
                    {label}
                    {required && <span className="input-required">*</span>}
                </label>
            )}
            
            <div className={`input-container ${error ? 'input-error' : ''}`}>
                {icon && <span className="input-icon">{icon}</span>}
                <input
                    ref={ref}
                    type={type}
                    className="input-field"
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    disabled={disabled}
                    {...props}
                />
                {rightIcon && <span className="input-right-icon">{rightIcon}</span>}
            </div>
            
            {error && <span className="input-error-text">{error}</span>}
            {helperText && !error && <span className="input-helper-text">{helperText}</span>}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;