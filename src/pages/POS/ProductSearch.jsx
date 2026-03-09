// src/pages/POS/ProductSearch.jsx

import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPackage, FiX, FiAlertTriangle } from 'react-icons/fi';
import './ProductSearch.css';

// ── Detección de plataforma ───────────────────────────────────────────────────
const isMac = () => window.electronAPI?.platform === 'darwin';
const kbd = (windowsKey, macKey) => isMac() ? macKey : windowsKey;

// ── Helper: restaurar foco (robusto Electron) ─────────────────────────────────
const restoreFocus = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    [50, 150, 300].forEach(ms =>
        setTimeout(() => { if (document.activeElement !== ref.current) ref.current?.focus(); }, ms)
    );
};

// ── Dialog React (reemplaza window.alert — evita que los inputs queden pegados) ──
const AlertDialog = ({ message, onClose }) => {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!message) return null;
    return (
        <div className="ps-alert-overlay" onClick={onClose}>
            <div className="ps-alert" onClick={e => e.stopPropagation()}>
                <FiAlertTriangle size={28} color="#f59e0b" />
                <p className="ps-alert-message">{message}</p>
                <button className="ps-alert-btn" onClick={onClose} autoFocus>Aceptar</button>
            </div>
        </div>
    );
};

// ── Helpers de stock ──────────────────────────────────────────────────────────
const formatStock = (value) => {
    const n = parseFloat(value);
    if (isNaN(n)) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
};

const getUnitLabel = (product) => {
    if (product.unit_label && product.unit_label !== 'un') return product.unit_label;
    const map = { peso: 'kg', volumen: 'L', metros: 'm', unidad: '' };
    return map[product.unit_type] || '';
};

const getStockClassName = (product) => {
    if (product.type !== 'product') return '';
    if (product.unlimited_stock === true || product.unlimited_stock === 1) return 'stock-unlimited';
    const stock    = parseFloat(product.stock)     || 0;
    const minStock = parseFloat(product.min_stock) || 0;
    if (stock <= 0)        return 'stock-out';
    if (stock <= minStock) return 'stock-low';
    return 'stock-ok';
};

const getStockText = (product) => {
    if (product.type !== 'product') return 'Servicio';
    if (product.unlimited_stock === true || product.unlimited_stock === 1) return 'Siempre disponible';
    const stock     = parseFloat(product.stock) || 0;
    const unitLabel = getUnitLabel(product);
    const stockStr  = formatStock(stock);
    return unitLabel ? `Stock: ${stockStr} ${unitLabel}` : `Stock: ${stockStr}`;
};

const hasAvailableStock = (product) => {
    if (product.type !== 'product') return true;
    if (product.unlimited_stock   === true || product.unlimited_stock   === 1) return true;
    if (product.allow_negative_stock === true || product.allow_negative_stock === 1) return true;
    return parseFloat(product.stock) > 0;
};

// ── ProductSearch ─────────────────────────────────────────────────────────────
const ProductSearch = ({ products, onAddToCart, searchInputRef }) => {
    const [searchTerm,       setSearchTerm]       = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedIndex,    setSelectedIndex]    = useState(0);
    const [alertMessage,     setAlertMessage]     = useState(null);

    const closeAlert = () => {
        setAlertMessage(null);
        restoreFocus(searchInputRef);
    };

    // ── Fix Electron: recuperar foco automáticamente ──────────────────────────
    useEffect(() => {
        requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            setTimeout(() => searchInputRef.current?.focus(), 100);
        });

        const handleWindowFocus = () => {
            setTimeout(() => searchInputRef.current?.focus(), 150);
        };

        const handleClick = (e) => {
            if (e.target.closest('.search-results'))     return;
            if (e.target.closest('.ps-alert-overlay'))   return;
            if (e.target.closest('.modal-overlay'))      return;
            if (e.target.closest('.cm-overlay'))         return;
            if (e.target.closest('.cc-overlay'))         return;
            if (e.target.closest('.co-overlay'))         return;
            if (e.target.closest('.pos-dialog-overlay')) return;
            if (e.target.closest('.cart-sidebar'))       return;
            if (e.target.closest('button'))              return;
            if (e.target.closest('input'))               return;
            if (e.target.closest('select'))              return;
            if (e.target.closest('textarea'))            return;
            setTimeout(() => searchInputRef.current?.focus(), 50);
        };

        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('click', handleClick);
        return () => {
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('click', handleClick);
        };
    }, [searchInputRef]);

    // ── Filtrar ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!Array.isArray(products) || searchTerm.length === 0) {
            setFilteredProducts([]);
            return;
        }
        const term = searchTerm.toLowerCase();
        const filtered = products
            .filter(p => {
                if (!p?.name) return false;
                if (p.is_active === false || p.is_active === 0) return false;
                return (
                    (p.name    || '').toLowerCase().includes(term) ||
                    (p.sku     || '').toLowerCase().includes(term) ||
                    (p.barcode || '').toLowerCase().includes(term)
                );
            })
            .slice(0, 10);
        setFilteredProducts(filtered);
        setSelectedIndex(0);
    }, [searchTerm, products]);

    // ── Teclado ───────────────────────────────────────────────────────────────
    const handleKeyDown = (e) => {
        if (filteredProducts.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => prev < filteredProducts.length - 1 ? prev + 1 : prev);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredProducts[selectedIndex]) handleSelectProduct(filteredProducts[selectedIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setSearchTerm('');
            setFilteredProducts([]);
        }
    };

    // ── Seleccionar producto ──────────────────────────────────────────────────
    const handleSelectProduct = (product) => {
        try {
            if (!product || typeof product !== 'object') {
                setAlertMessage('Error: producto inválido.');
                return;
            }
            if (product.is_active === false || product.is_active === 0) {
                setAlertMessage(`El producto "${product.name}" no está activo.`);
                return;
            }

            if (product.type === 'product') {
                const isUnlimited   = product.unlimited_stock   === true || product.unlimited_stock   === 1;
                const allowNegative = product.allow_negative_stock === true || product.allow_negative_stock === 1;
                if (!isUnlimited && !allowNegative) {
                    const stock     = parseFloat(product.stock) || 0;
                    const unitLabel = getUnitLabel(product);
                    if (stock <= 0) {
                        setAlertMessage(
                            `"${product.name}" no tiene stock disponible.\n\nStock actual: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}`
                        );
                        return;
                    }
                }
            }

            onAddToCart(product);
            setSearchTerm('');
            setFilteredProducts([]);
            setSelectedIndex(0);
            requestAnimationFrame(() => {
                searchInputRef.current?.focus();
                setTimeout(() => searchInputRef.current?.focus(), 50);
            });
        } catch (error) {
            console.error('Error al seleccionar producto:', error);
            setAlertMessage('Error al agregar el producto al carrito.');
        }
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setFilteredProducts([]);
        searchInputRef.current?.focus();
    };

    const formatCurrency = (value) => (parseFloat(value) || 0).toLocaleString('es-CL');

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="product-search">

            {/* ── Input de búsqueda ── */}
            <div className="search-input-wrapper">
                <div className="search-icon-container">
                    <FiSearch size={24} />
                </div>
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por nombre, SKU o código de barras... (ESC para limpiar)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="search-input-flex"
                    autoFocus
                />
                {searchTerm.length > 0 && (
                    <button className="search-clear-button" onClick={handleClearSearch}
                        title="Limpiar búsqueda (ESC)" type="button">
                        <FiX size={18} />
                    </button>
                )}
            </div>

            {/* ── Resultados ── */}
            {filteredProducts.length > 0 && (
                <div className="search-results">
                    {filteredProducts.map((product, index) => {
                        const sinStock = !hasAvailableStock(product);
                        return (
                            <div
                                key={product.id}
                                className={`search-result-item ${index === selectedIndex ? 'selected' : ''} ${sinStock ? 'out-of-stock' : ''}`}
                                onClick={() => handleSelectProduct(product)}
                                title={sinStock ? `Sin stock — ${getStockText(product)}` : undefined}
                            >
                                <div className="result-image">
                                    {product.image_path ? (
                                        <img src={product.image_path} alt={product.name}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }} />
                                    ) : null}
                                    <div style={{
                                        display: product.image_path ? 'none' : 'flex',
                                        width: '100%', height: '100%',
                                        alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <FiPackage size={32} />
                                    </div>
                                </div>

                                <div className="result-info">
                                    <div className="result-name">
                                        {product.name}
                                        {product.type === 'service' && (
                                            <span className="service-badge">SERVICIO</span>
                                        )}
                                        {sinStock && (
                                            <span className="no-stock-badge">SIN STOCK</span>
                                        )}
                                    </div>
                                    <div className="result-details">
                                        {product.sku && <span>SKU: {product.sku}</span>}
                                        <span className={getStockClassName(product)}>
                                            {getStockText(product)}
                                        </span>
                                    </div>
                                </div>

                                <div className="result-price">${formatCurrency(product.sale_price)}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Sin resultados ── */}
            {searchTerm.length > 0 && filteredProducts.length === 0 && (
                <div className="no-results">
                    <FiPackage size={48} />
                    <p>No se encontraron productos</p>
                    <small>Intenta con otro término de búsqueda</small>
                </div>
            )}

            {/* ── Estado vacío ── */}
            {searchTerm.length === 0 && (
                <div className="search-empty">
                    <FiSearch size={64} />
                    <h3>Buscar Productos o Servicios</h3>
                    <p>Escribe el nombre, SKU o escanea el código de barras</p>
                    <div className="search-tips">
                        <div className="tip"><strong>↑↓</strong> Navegar resultados</div>
                        <div className="tip"><strong>Enter</strong> Agregar al carrito</div>
                        <div className="tip"><strong>ESC</strong> Limpiar búsqueda</div>
                        <div className="tip"><strong>{kbd('F9', '⌘P')}</strong> Pagar</div>
                        <div className="tip"><strong>{kbd('F10', '⌘⌫')}</strong> Limpiar carrito</div>
                    </div>
                </div>
            )}

            {/* ── Alert Dialog React ── */}
            {alertMessage && <AlertDialog message={alertMessage} onClose={closeAlert} />}
        </div>
    );
};

export default ProductSearch;