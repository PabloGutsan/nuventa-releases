// src/components/common/Select.jsx
import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import './Select.css';

const Select = ({ 
    label,
    options = [],
    value,
    onChange,
    placeholder = 'Seleccionar...',
    searchable = false,
    clearable = false,
    disabled = false,
    error,
    helperText,
    icon,
    emptyMessage = 'No hay opciones disponibles',
    renderOption,
    getOptionLabel = (option) => option.label || option.name || option,
    getOptionValue = (option) => option.value || option.id || option,
    ...props 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const selectRef = useRef(null);
    const searchInputRef = useRef(null);

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus en search input cuando se abre el dropdown
    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, searchable]);

    // Filtrar opciones según término de búsqueda
    const filteredOptions = searchable && searchTerm
        ? options.filter(option => 
            getOptionLabel(option).toLowerCase().includes(searchTerm.toLowerCase())
        )
        : options;

    // Encontrar opción seleccionada
    const selectedOption = options.find(option => 
        getOptionValue(option) === value
    );

    const handleSelect = (option) => {
        onChange(getOptionValue(option));
        setIsOpen(false);
        setSearchTerm('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange(null);
        setSearchTerm('');
    };

    const handleToggle = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    return (
        <div className="select-wrapper" ref={selectRef}>
            {label && (
                <label className="select-label">
                    {label}
                </label>
            )}
            
            <div 
                className={`select-container ${isOpen ? 'select-open' : ''} ${error ? 'select-error' : ''} ${disabled ? 'select-disabled' : ''}`}
                onClick={handleToggle}
            >
                {icon && <span className="select-icon">{icon}</span>}
                
                <div className="select-display">
                    {selectedOption ? (
                        <span className="select-value">
                            {getOptionLabel(selectedOption)}
                        </span>
                    ) : (
                        <span className="select-placeholder">{placeholder}</span>
                    )}
                </div>

                <div className="select-actions">
                    {clearable && selectedOption && !disabled && (
                        <button 
                            className="select-clear"
                            onClick={handleClear}
                            type="button"
                        >
                            <FiX size={16} />
                        </button>
                    )}
                    <span className={`select-arrow ${isOpen ? 'select-arrow-up' : ''}`}>
                        <FiChevronDown size={18} />
                    </span>
                </div>
            </div>

            {isOpen && (
                <div className="select-dropdown">
                    {searchable && (
                        <div className="select-search">
                            <FiSearch className="select-search-icon" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="select-search-input"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    <div className="select-options">
                        {filteredOptions.length === 0 ? (
                            <div className="select-empty">
                                {emptyMessage}
                            </div>
                        ) : (
                            filteredOptions.map((option, index) => (
                                <div
                                    key={index}
                                    className={`select-option ${getOptionValue(option) === value ? 'select-option-selected' : ''}`}
                                    onClick={() => handleSelect(option)}
                                >
                                    {renderOption ? renderOption(option) : getOptionLabel(option)}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            
            {error && <span className="select-error-text">{error}</span>}
            {helperText && !error && <span className="select-helper-text">{helperText}</span>}
        </div>
    );
};

export default Select;