import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSearch, FiX, FiChevronDown } from 'react-icons/fi';
import './SearchableSelect.css';

/**
 * SearchableSelect — <select> con buscador integrado y altura máxima.
 * El dropdown usa position:fixed para escapar de overflow:hidden en Cards/Modals.
 *
 * Props:
 *   label       {string}    Label visible sobre el control
 *   value       {string}    Valor seleccionado
 *   onChange    {fn}        (value: string) => void
 *   options     {string[]}  Lista de opciones
 *   placeholder {string}    Texto cuando no hay selección
 *   searchPlaceholder {string}
 *   disabled    {bool}
 *   error       {string}    Mensaje de error
 *   helperText  {string}
 *   required    {bool}
 */
const SearchableSelect = ({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Seleccionar...',
    searchPlaceholder = 'Buscar...',
    disabled = false,
    error,
    helperText,
    required = false,
}) => {
    const [open,       setOpen]       = useState(false);
    const [search,     setSearch]     = useState('');
    const [menuStyle,  setMenuStyle]  = useState({});
    const wrapperRef = useRef(null);
    const triggerRef = useRef(null);
    const searchRef  = useRef(null);

    // Cerrar al click fuera
    useEffect(() => {
        const handler = (e) => {
            if (
                wrapperRef.current && !wrapperRef.current.contains(e.target) &&
                // también verificar que no sea dentro del menú fixed (fuera del wrapper)
                !(e.target.closest && e.target.closest('.ss-dropdown'))
            ) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Enfocar input al abrir
    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 30);
        else      setSearch('');
    }, [open]);

    // Reposicionar si hay scroll o resize mientras está abierto
    useEffect(() => {
        if (!open) return;
        const reposition = () => calcMenuStyle();
        window.addEventListener('resize', reposition, { passive: true });
        window.addEventListener('scroll', reposition, { passive: true, capture: true });
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [open]);

    // ESC cierra
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { setOpen(false); e.stopPropagation(); }
    };

    // Calcular posición fixed del menú
    const calcMenuStyle = useCallback(() => {
        if (!triggerRef.current) return;
        const rect   = triggerRef.current.getBoundingClientRect();
        const vpH    = window.innerHeight;
        const estH   = Math.min(options.length * 34 + 48, 252);
        const openUp = vpH - rect.bottom < estH + 8 && rect.top > estH + 8;
        setMenuStyle({
            position: 'fixed',
            left:     rect.left,
            width:    rect.width,
            zIndex:   9999,
            ...(openUp
                ? { bottom: vpH - rect.top + 3 }
                : { top:    rect.bottom + 3 }),
        });
    }, [options.length]);

    const handleOpen = () => {
        if (disabled) return;
        if (!open) {
            calcMenuStyle();
            setOpen(true);
        } else {
            setOpen(false);
        }
    };

    const filtered = search.trim()
        ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
        : options;

    const handleSelect = (option) => {
        onChange(option);
        setOpen(false);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
        setOpen(false);
    };

    return (
        <div
            className={`ss-wrapper${error ? ' ss-wrapper--error' : ''}`}
            ref={wrapperRef}
            onKeyDown={handleKeyDown}
        >
            {/* Label */}
            {label && (
                <label className="ss-label">
                    {label}
                    {required && <span className="ss-required"> *</span>}
                </label>
            )}

            {/* Trigger */}
            <button
                ref={triggerRef}
                type="button"
                className={`ss-trigger${open ? ' ss-trigger--open' : ''}${value ? ' ss-trigger--filled' : ''}${disabled ? ' ss-trigger--disabled' : ''}`}
                onClick={handleOpen}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className={`ss-trigger-text${!value ? ' ss-trigger-text--placeholder' : ''}`}>
                    {value || placeholder}
                </span>
                <div className="ss-trigger-actions">
                    {value && !disabled && (
                        <span
                            className="ss-clear"
                            role="button"
                            tabIndex={-1}
                            onMouseDown={handleClear}
                            title="Limpiar"
                        >
                            <FiX size={11} />
                        </span>
                    )}
                    <FiChevronDown
                        size={14}
                        className={`ss-chevron${open ? ' ss-chevron--open' : ''}`}
                    />
                </div>
            </button>

            {/* Dropdown — position:fixed para escapar de overflow:hidden del Card */}
            {open && (
                <div className="ss-dropdown" role="listbox" style={menuStyle}>
                    {/* Buscador */}
                    <div className="ss-search-row">
                        <FiSearch size={12} className="ss-search-icon" />
                        <input
                            ref={searchRef}
                            type="text"
                            className="ss-search-input"
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoComplete="off"
                        />
                        {search && (
                            <button
                                type="button"
                                className="ss-search-clear"
                                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                                tabIndex={-1}
                            >
                                <FiX size={11} />
                            </button>
                        )}
                    </div>

                    {/* Lista */}
                    <div className="ss-list">
                        {filtered.length === 0 ? (
                            <div className="ss-empty">Sin resultados</div>
                        ) : (
                            filtered.map(option => (
                                <button
                                    key={option}
                                    type="button"
                                    role="option"
                                    aria-selected={option === value}
                                    className={`ss-option${option === value ? ' ss-option--active' : ''}`}
                                    onMouseDown={() => handleSelect(option)}
                                >
                                    {option}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Error / helper */}
            {error      && <span className="ss-error">{error}</span>}
            {helperText && !error && <span className="ss-helper">{helperText}</span>}
        </div>
    );
};

export default SearchableSelect;