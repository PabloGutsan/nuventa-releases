// src/pages/POS/ProductSearch.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSearch, FiPackage, FiX, FiAlertTriangle, FiTag } from 'react-icons/fi';
import './ProductSearch.css';

const isMac = () => window.electronAPI?.platform === 'darwin';
const kbd = (windowsKey, macKey) => isMac() ? macKey : windowsKey;

const restoreFocus = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    [50, 150, 300].forEach(ms =>
        setTimeout(() => { if (document.activeElement !== ref.current) ref.current?.focus(); }, ms)
    );
};

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

// ── Helpers de promociones ────────────────────────────────────────────────────
const getProductPromotion = (product, activePromotions) => {
    if (!activePromotions || activePromotions.length === 0) return null;
    const byProduct  = activePromotions.find(p => p.type === 'product_discount' && p.product_id === product.id);
    if (byProduct) return byProduct;
    const byPackFixed = activePromotions.find(p =>
        p.type === 'pack_fixed' && p.packProductIds && p.packProductIds.includes(product.id)
    );
    if (byPackFixed) return byPackFixed;
    const byPackQty = activePromotions.find(p =>
        p.type === 'pack_quantity' && (
            (p.pack_quantity_source === 'product_list' && p.packProductIds && p.packProductIds.includes(product.id)) ||
            (p.pack_quantity_source === 'category' && p.category_id === product.category_id)
        )
    );
    if (byPackQty) return byPackQty;
    const byCategory = activePromotions.find(p =>
        p.type === 'category_discount' && p.category_id === product.category_id
    );
    if (byCategory) return byCategory;
    return null;
};

/**
 * Badge de texto para mostrar en resultados de búsqueda.
 * Retorna { text, color } según el tipo de promoción.
 */
const getPromoBadge = (promo, product) => {
    if (!promo) return null;
    const val = parseFloat(promo.discount_value) || 0;

    switch (promo.type) {
        case 'product_discount':
            if (promo.discount_type === 'percentage') return { text: `${val}% off`, color: 'green' };
            if (promo.discount_type === 'fixed')      return { text: `−$${val.toLocaleString('es-CL')}`, color: 'green' };
            return { text: 'Oferta', color: 'green' };

        case 'category_discount':
            if (promo.discount_type === 'percentage') return { text: `${val}% categoría`, color: 'green' };
            if (promo.discount_type === 'fixed')      return { text: `−$${val.toLocaleString('es-CL')} categoría`, color: 'green' };
            return { text: 'Desc. categoría', color: 'green' };

        case 'pack_fixed':
            return { text: `Pack ${promo.name}`, color: 'blue' };

        case 'pack_quantity': {
            const buy  = parseInt(promo.pack_buy_quantity) || 2;
            const pay  = parseInt(promo.pack_pay_quantity) || 1;
            return { text: `${buy}x${pay} — ${buy - pay} gratis`, color: 'blue' };
        }

        default:
            return null;
    }
};

const getPriceWithPromo = (product, promo) => {
    if (!promo || promo.type === 'pack_fixed' || promo.type === 'pack_quantity' || promo.type === 'minimum_amount') return null;
    const price = parseFloat(product.sale_price) || 0;
    const val   = parseFloat(promo.discount_value) || 0;
    if (promo.discount_type === 'percentage')  return Math.round(price * (1 - val / 100));
    if (promo.discount_type === 'fixed')       return Math.max(0, price - val);
    if (promo.discount_type === 'fixed_price') return val;
    return null;
};

// ── Búsqueda ──────────────────────────────────────────────────────────────────
const searchProducts = (products, term) => {
    if (!Array.isArray(products) || !term) return [];
    const t = term.toLowerCase().trim();
    return products
        .filter(p => {
            if (!p?.name) return false;
            if (p.is_active === false || p.is_active === 0) return false;
            return (
                (p.name    || '').toLowerCase().includes(t) ||
                (p.sku     || '').toLowerCase().includes(t) ||
                (p.barcode || '').toLowerCase().includes(t)
            );
        })
        .slice(0, 10);
};

const findExactMatch = (products, code) => {
    if (!Array.isArray(products) || !code) return null;
    const c = code.trim();
    return products.find(p =>
        p.is_active !== false && p.is_active !== 0 && (
            (p.barcode && p.barcode === c) ||
            (p.sku     && p.sku     === c)
        )
    ) || null;
};

// ── ProductSearch ─────────────────────────────────────────────────────────────
const ProductSearch = ({ products, onAddToCart, searchInputRef, activePromotions = [] }) => {
    const [searchTerm,       setSearchTerm]       = useState('');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [selectedIndex,    setSelectedIndex]    = useState(0);
    const [alertMessage,     setAlertMessage]     = useState(null);

    const lastKeyTime   = useRef(0);
    const scannerBuffer = useRef('');
    const scannerTimer  = useRef(null);
    const SCANNER_MS    = 50;

    const closeAlert = () => { setAlertMessage(null); restoreFocus(searchInputRef); };

    useEffect(() => {
        requestAnimationFrame(() => {
            searchInputRef.current?.focus();
            setTimeout(() => searchInputRef.current?.focus(), 100);
        });
        const handleWindowFocus = () => setTimeout(() => searchInputRef.current?.focus(), 150);
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

    useEffect(() => {
        if (searchTerm.length === 0) { setFilteredProducts([]); return; }
        setFilteredProducts(searchProducts(products, searchTerm));
        setSelectedIndex(0);
    }, [searchTerm, products]);

    const handleSelectProduct = useCallback((product) => {
        try {
            if (!product || typeof product !== 'object') { setAlertMessage('Error: producto inválido.'); return; }
            if (product.is_active === false || product.is_active === 0) {
                setAlertMessage(`El producto "${product.name}" no está activo.`); return;
            }
            if (product.type === 'product') {
                const isUnlimited   = product.unlimited_stock    === true || product.unlimited_stock    === 1;
                const allowNegative = product.allow_negative_stock === true || product.allow_negative_stock === 1;
                if (!isUnlimited && !allowNegative) {
                    const stock = parseFloat(product.stock) || 0;
                    if (stock <= 0) {
                        setAlertMessage(`"${product.name}" no tiene stock disponible.\n\nStock actual: ${formatStock(stock)}${getUnitLabel(product) ? ' ' + getUnitLabel(product) : ''}`);
                        return;
                    }
                }
            }
            onAddToCart(product);
            setSearchTerm('');
            setFilteredProducts([]);
            setSelectedIndex(0);
            scannerBuffer.current = '';
            requestAnimationFrame(() => {
                searchInputRef.current?.focus();
                setTimeout(() => searchInputRef.current?.focus(), 50);
            });
        } catch (error) {
            console.error('Error al seleccionar producto:', error);
            setAlertMessage('Error al agregar el producto al carrito.');
        }
    }, [onAddToCart, searchInputRef]);

    const handleKeyDown = (e) => {
        const now = Date.now();
        const gap = now - lastKeyTime.current;
        lastKeyTime.current = now;

        if (e.key !== 'Enter' && e.key.length === 1 && gap < SCANNER_MS) {
            if (scannerTimer.current) clearTimeout(scannerTimer.current);
            scannerBuffer.current += e.key;
            scannerTimer.current = setTimeout(() => { scannerBuffer.current = ''; }, 300);
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            if (scannerTimer.current) clearTimeout(scannerTimer.current);
            const code = (scannerBuffer.current || e.target.value || searchTerm).trim();
            scannerBuffer.current = '';
            if (!code) return;
            const exact = findExactMatch(products, code);
            if (exact) { handleSelectProduct(exact); return; }
            if (filteredProducts.length > 0) {
                handleSelectProduct(filteredProducts[selectedIndex] || filteredProducts[0]); return;
            }
            const syncResults = searchProducts(products, code);
            if (syncResults.length === 1)      handleSelectProduct(syncResults[0]);
            else if (syncResults.length > 1) { setFilteredProducts(syncResults); setSelectedIndex(0); }
            else setAlertMessage(`No se encontró ningún producto con el código: "${code}"`);
            return;
        }

        if (filteredProducts.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => prev < filteredProducts.length - 1 ? prev + 1 : prev); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => prev > 0 ? prev - 1 : 0); }
        else if (e.key === 'Escape') { e.preventDefault(); setSearchTerm(''); setFilteredProducts([]); }
    };

    const handleClearSearch = () => {
        setSearchTerm('');
        setFilteredProducts([]);
        scannerBuffer.current = '';
        if (scannerTimer.current) clearTimeout(scannerTimer.current);
        searchInputRef.current?.focus();
    };

    const formatCurrency = (value) => (parseFloat(value) || 0).toLocaleString('es-CL');

    return (
        <div className="product-search">

            {/* ── Input ── */}
            <div className="search-input-wrapper">
                <div className="search-icon-container">
                    <FiSearch size={24} />
                </div>
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por nombre, SKU o escanear código de barras..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="search-input-flex"
                    autoFocus
                />
                {searchTerm.length > 0 && (
                    <button className="search-clear-button" onClick={handleClearSearch} title="Limpiar búsqueda (ESC)" type="button">
                        <FiX size={18} />
                    </button>
                )}
            </div>

            {/* ── Resultados ── */}
            {filteredProducts.length > 0 && (
                <div className="search-results">
                    {filteredProducts.map((product, index) => {
                        const sinStock   = !hasAvailableStock(product);
                        const promo      = getProductPromotion(product, activePromotions);
                        const badge      = getPromoBadge(promo, product);
                        const promoPrice = getPriceWithPromo(product, promo);

                        return (
                            <div
                                key={product.id}
                                className={`search-result-item ${index === selectedIndex ? 'selected' : ''} ${sinStock ? 'out-of-stock' : ''} ${promo ? 'has-promo' : ''}`}
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
                                    <div style={{ display: product.image_path ? 'none' : 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                        <FiPackage size={32} />
                                    </div>
                                    {badge && (
                                        <div className="result-promo-img-badge">
                                            <FiTag size={9} />
                                        </div>
                                    )}
                                </div>

                                <div className="result-info">
                                    <div className="result-name">
                                        {product.name}
                                        {sinStock && <span className="no-stock-badge">SIN STOCK</span>}
                                    </div>
                                    <div className="result-details">
                                        {product.sku     && <span>SKU: {product.sku}</span>}
                                        {product.barcode && <span>Cód: {product.barcode}</span>}
                                        <span className={getStockClassName(product)}>
                                            {product.type === 'service' ? 'Servicio' : getStockText(product)}
                                        </span>
                                    </div>
                                </div>

                                <div className="result-price-col">
                                    {/* Precio original tachado si hay descuento de precio */}
                                    {promoPrice !== null ? (
                                        <>
                                            <span className="result-price result-price--original">
                                                ${formatCurrency(product.sale_price)}
                                            </span>
                                            <span className="result-price result-price--promo">
                                                ${formatCurrency(promoPrice)}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="result-price">
                                            ${formatCurrency(product.sale_price)}
                                        </span>
                                    )}

                                    {/* Badge de promoción — todos los tipos */}
                                    {badge && (
                                        <span className={`result-promo-badge result-promo-badge--${badge.color}`}>
                                            <FiTag size={9} /> {badge.text}
                                        </span>
                                    )}
                                </div>
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
                    <small>Intenta con otro término o verifica el código de barras</small>
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

            {alertMessage && <AlertDialog message={alertMessage} onClose={closeAlert} />}
        </div>
    );
};

export default ProductSearch;