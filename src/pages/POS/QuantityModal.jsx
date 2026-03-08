import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiCheck } from 'react-icons/fi';
import Button from '../../components/common/Button';
import './QuantityModal.css';

// ── Helpers de formato numérico (Chile: punto = miles, coma = decimal) ─────────

/**
 * Formatea un número entero con punto como separador de miles.
 * Ejemplos: 19500 → "19.500"  |  1000 → "1.000"  |  750 → "750"
 */
const fmtInt = (value) =>
    Math.floor(parseFloat(value) || 0).toLocaleString('es-CL');

/**
 * Formatea un decimal con hasta 3 decimales, sin ceros finales.
 * Usa coma como separador decimal (es-CL).
 * Ejemplos: 19.5 → "19,5"  |  0.75 → "0,75"  |  2 → "2"
 */
const fmtDec = (value) => {
    const n = parseFloat(value);
    if (isNaN(n)) return '0';
    return n.toLocaleString('es-CL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
};

/**
 * Formatea el valor que el usuario escribe en el input mostrando
 * punto de miles automáticamente mientras tipea, sin alterar la posición
 * del cursor ni los decimales en progreso.
 *
 * Estrategia:
 *  - El estado interno guarda el valor "crudo" (lo que el usuario escribe).
 *  - El display muestra el valor formateado con punto de miles.
 *  - Al parsear se normaliza la coma → punto para parseFloat.
 */
const formatInputDisplay = (raw) => {
    if (!raw) return '';
    // Separar parte entera y decimal (acepta tanto punto como coma)
    const normalized = raw.replace(',', '.');
    const [intPart, decPart] = normalized.split('.');
    const intFormatted = parseInt(intPart || '0', 10).toLocaleString('es-CL');
    if (decPart !== undefined) return `${intFormatted},${decPart}`;
    // Si termina en punto/coma (usuario escribiendo decimal), mostrar la coma
    if (raw.endsWith('.') || raw.endsWith(',')) return `${intFormatted},`;
    return intFormatted;
};

/**
 * Convierte lo que el usuario escribe (con o sin puntos de miles, con coma decimal)
 * a un número JS válido para parseFloat.
 */
const rawToNumber = (raw) => {
    if (!raw) return NaN;
    // Eliminar puntos de miles, cambiar coma decimal por punto
    const normalized = raw.replace(/\./g, '').replace(',', '.');
    return parseFloat(normalized);
};

// ── QuantityModal ──────────────────────────────────────────────────────────────
const QuantityModal = ({ product, onConfirm, onClose }) => {
    // raw: lo que el usuario escribe (puede tener coma o punto como decimal)
    const [raw,   setRaw]   = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(timer);
    }, []);

    const isUnlimited = () => {
        const v = product?.unlimited_stock;
        return v === true || v === 1 || v === '1';
    };

    const getUnitConfig = () => {
        const unitType  = product.unit_type  || 'unidad';
        const unitLabel = product.unit_label || 'un';
        const configs = {
            'peso':    { inputUnit: 'g',  mainUnit: 'kg', conversionFactor: 1000, placeholder: 'Ej: 450, 1.200, 250', label: 'Peso en gramos',       icon: '⚖️', helpText: 'Ingresa el peso en gramos (g)' },
            'volumen': { inputUnit: 'ml', mainUnit: 'L',  conversionFactor: 1000, placeholder: 'Ej: 500, 750, 1.500', label: 'Volumen en mililitros', icon: '🥤', helpText: 'Ingresa el volumen en mililitros (ml)' },
            'metro':   { inputUnit: 'cm', mainUnit: 'm',  conversionFactor: 100,  placeholder: 'Ej: 50, 150, 250',   label: 'Longitud en centímetros', icon: '📏', helpText: 'Ingresa la longitud en centímetros (cm)' },
            'unidad':  { inputUnit: unitLabel, mainUnit: unitLabel, conversionFactor: 1, placeholder: 'Ej: 1, 2, 3', label: 'Cantidad', icon: '📦', helpText: 'Ingresa la cantidad de unidades' },
        };
        return configs[unitType] || configs['unidad'];
    };

    const config = getUnitConfig();

    // ── Parsear lo que escribe el usuario ─────────────────────────────────────
    const parseQuantityValue = (input) => {
        if (!input || input.trim() === '') return { inputValue: null, convertedValue: null, isValid: false };
        const numericValue = rawToNumber(input.trim());
        if (isNaN(numericValue) || numericValue <= 0) return { inputValue: null, convertedValue: null, isValid: false };
        return {
            inputValue:     numericValue,
            convertedValue: numericValue / config.conversionFactor,
            isValid:        true,
        };
    };

    // ── Input: solo permite dígitos + un separador decimal (punto o coma) ──────
    const handleQuantityChange = (e) => {
        let val = e.target.value;

        // Eliminar todo excepto dígitos, punto y coma
        // Permitir punto como separador de miles (el usuario puede escribirlo)
        // o como separador decimal — se normaliza al parsear
        val = val.replace(/[^0-9.,]/g, '');

        // Solo permitir un separador decimal (coma o punto)
        // Si ya hay coma, no permitir punto y viceversa
        const commas = (val.match(/,/g) || []).length;
        const dots   = (val.match(/\./g) || []).length;
        if (commas > 1 || dots > 1 || (commas > 0 && dots > 0)) return;

        setRaw(val);
        if (error) setError('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); handleClose(); }
        // Enter lo maneja el form onSubmit
    };

    const calculateTotal = () => {
        const parsed = parseQuantityValue(raw);
        if (!parsed.isValid) return null;
        return Math.round((parseFloat(product.sale_price) || 0) * parsed.convertedValue);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const parsed = parseQuantityValue(raw);

        if (!parsed.isValid) {
            setError(`❌ Ingresa una cantidad válida en ${config.inputUnit}`);
            inputRef.current?.focus();
            return;
        }
        if (parsed.convertedValue <= 0) {
            setError('❌ La cantidad debe ser mayor a 0');
            inputRef.current?.focus();
            return;
        }

        if (product.type === 'product') {
            const unlimited     = isUnlimited();
            const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
            if (!unlimited && !allowNegative) {
                const stock = parseFloat(product.stock) || 0;
                if (parsed.convertedValue > stock) {
                    // Stock disponible formateado con unidades y separador de miles
                    const stockMainFmt  = fmtDec(stock);
                    const stockInputFmt = fmtInt(stock * config.conversionFactor);
                    setError(`❌ Stock insuficiente. Disponible: ${stockMainFmt} ${config.mainUnit} (${stockInputFmt} ${config.inputUnit})`);
                    inputRef.current?.focus();
                    return;
                }
            }
        }

        onConfirm(parsed.convertedValue);
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(value) || 0);

    const handleClose = () => {
        document.body.style.overflow = '';
        onClose();
    };

    const parsed  = parseQuantityValue(raw);
    const total   = calculateTotal();
    const unlimited = isUnlimited();

    // ── Stock formateado para mostrar en la tarjeta del producto ──────────────
    const stockNum      = parseFloat(product.stock) || 0;
    const stockMainFmt  = fmtDec(stockNum);                              // "19,5"
    const stockInputFmt = fmtInt(stockNum * config.conversionFactor);    // "19.500"

    // ── Display del input: formatea mientras el usuario escribe ───────────────
    const inputDisplay = formatInputDisplay(raw);

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="quantity-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{config.icon} {config.label}</h2>
                    <button className="modal-close-btn" onClick={handleClose} type="button">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* ── Tarjeta del producto ── */}
                    <div className="product-info-box">
                        <div className="product-info-name">{product.name}</div>
                        <div className="product-info-price">
                            {formatCurrency(product.sale_price)} por {config.mainUnit}
                        </div>
                        {product.type === 'product' && (
                            <div className="product-info-stock">
                                {unlimited
                                    ? '✅ Siempre disponible'
                                    : <>
                                        {/* "Stock: 19,5 L (19.500 ml)" — con formato correcto */}
                                        Stock: {stockMainFmt} {config.mainUnit}
                                        {config.conversionFactor > 1 && (
                                            <span className="stock-converted">
                                                {' '}({stockInputFmt} {config.inputUnit})
                                            </span>
                                        )}
                                      </>
                                }
                            </div>
                        )}
                    </div>

                    {/* ── Formulario ── */}
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">{config.helpText}</label>
                            <div className="input-with-unit">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="decimal"
                                    className={`form-input ${error ? 'input-error' : ''}`}
                                    placeholder={config.placeholder}
                                    // Muestra el valor formateado con puntos de miles
                                    value={inputDisplay}
                                    onChange={handleQuantityChange}
                                    onKeyDown={handleKeyDown}
                                    autoComplete="off"
                                />
                                <span className="input-unit-label">{config.inputUnit}</span>
                            </div>
                            {error && <div className="input-error-message">{error}</div>}
                        </div>

                        {/* ── Total calculado ── */}
                        {total !== null && (
                            <div className="total-preview">
                                <div className="total-preview-left">
                                    <div className="total-preview-label">Total a pagar:</div>
                                    {parsed.isValid && (
                                        <div className="total-preview-detail">
                                            {/* "1.500 ml × $3.000/L" — con formato */}
                                            {fmtInt(parsed.inputValue)} {config.inputUnit} × {formatCurrency(product.sale_price)}/{config.mainUnit}
                                        </div>
                                    )}
                                </div>
                                <div className="total-preview-amount">{formatCurrency(total)}</div>
                            </div>
                        )}

                        {/* ── Ayuda ── */}
                        <div className="help-box">
                            <strong>💡 Ejemplos comunes:</strong>
                            <ul>
                                {config.inputUnit === 'g' && (<>
                                    <li>250 → un cuarto de kilo</li>
                                    <li>500 → medio kilo</li>
                                    <li>1.000 → un kilo completo</li>
                                </>)}
                                {config.inputUnit === 'ml' && (<>
                                    <li>250 → un cuarto de litro</li>
                                    <li>500 → medio litro</li>
                                    <li>1.000 → un litro completo</li>
                                </>)}
                                {config.inputUnit === 'cm' && (<>
                                    <li>50 → medio metro</li>
                                    <li>100 → un metro</li>
                                    <li>150 → metro y medio</li>
                                </>)}
                            </ul>
                        </div>

                        {/* ── Botones ── */}
                        <div className="modal-actions">
                            <Button type="button" variant="secondary" onClick={handleClose}>
                                Cancelar (ESC)
                            </Button>
                            <Button
                                type="submit"
                                variant="success"
                                icon={<FiCheck />}
                                disabled={!raw || !parsed.isValid}
                            >
                                Agregar al Carrito (Enter)
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default QuantityModal;