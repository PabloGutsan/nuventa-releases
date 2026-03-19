// src/pages/POS/CartSidebar.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FiShoppingCart, FiCreditCard, FiUser, FiUserPlus,
    FiSearch, FiX, FiPause, FiPlay, FiClock, FiTag, FiPercent,
} from 'react-icons/fi';
import { useDatabase } from '../../context/DatabaseContext';
import CustomerRepository from '../../services/repositories/customerRepository';
import QuickAddCustomerModal from './QuickAddCustomerModal';
import Button from '../../components/common/Button';
import './CartSidebar.css';

const isMac = () => window.electronAPI?.platform === 'darwin';
const kbd = (windowsKey, macKey) => isMac() ? macKey : windowsKey;

// ── Formatea número con separador de miles chileno ────────────────────────────
const formatThousands = (val) => {
    const num = String(val).replace(/\D/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('es-CL').format(parseInt(num));
};

// ── Hints de promociones ──────────────────────────────────────────────────────
const PromoHints = ({ hints }) => {
    if (!hints?.length) return null;
    return (
        <div className="pack-hints-wrapper">
            <div className="pack-hints">
                {hints.map((hint, i) => (
                    <div key={i} className="pack-hint">
                        <span className="pack-hint-icon">{hint.icon || '🎁'}</span>
                        <div className="pack-hint-text">
                            <span className="pack-hint-name">{hint.promoName}</span>
                            <span className="pack-hint-desc">{hint.message}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── CartSidebar ───────────────────────────────────────────────────────────────
const CartSidebar = ({
    items = [],
    totals,
    customerId,
    discountSettings,
    globalDiscount,
    promoGlobalDiscount = 0,
    appliedPromotions = [],
    onUpdateCustomer,
    onUpdateGlobalDiscount,
    onClear,
    onPay,
    isProcessing = false,
    holds = [],
    onHold,
    onResumeHold,
    onDeleteHold,
    activePromotions = [],
}) => {
    const { db } = useDatabase();

    const [allCustomers, setAllCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showHoldsPanel, setShowHoldsPanel] = useState(false);

    // ── Descuento global ──────────────────────────────────────────────────────
    const [globalDiscMode, setGlobalDiscMode] = useState(globalDiscount?.type || 'percent');
    const [globalDiscValue, setGlobalDiscValue] = useState(
        globalDiscount?.value > 0
            ? (globalDiscount.type === 'fixed' ? formatThousands(globalDiscount.value) : String(globalDiscount.value))
            : ''
    );
    const [showGlobalDisc, setShowGlobalDisc] = useState(false);

    const wrapperRef = useRef(null);
    const searchRef = useRef(null);
    const customerRepo = new CustomerRepository(db);

    const settings = {
        globalEnabled: discountSettings?.globalEnabled !== false,
        maxPercent: discountSettings?.maxPercent ?? 100,
    };

    // ── Calcula el ahorro potencial de un pack ────────────────────────────────
    const calcPackSavings = (promo, cartItems) => {
        if (!promo.packProducts?.length) return 0;
        const normalTotal = promo.packProducts.reduce((sum, pp) => {
            const item = cartItems.find(i => i.product_id === pp.product_id);
            const price = parseFloat(item?.unit_price) || 0;
            return sum + price * (pp.quantity || 1);
        }, 0);
        if (normalTotal <= 0) return 0;
        const val = parseFloat(promo.discount_value) || 0;
        switch (promo.discount_type) {
            case 'percentage': return Math.round(normalTotal * Math.min(val, 100) / 100);
            case 'fixed': return Math.round(Math.min(val, normalTotal));
            case 'fixed_price': return Math.round(Math.max(0, normalTotal - val));
            default: return 0;
        }
    };

    // ── Calcula descuento potencial para un ítem individual ───────────────────
    const calcItemDiscount = (promo, unitPrice, quantity) => {
        const linePrice = unitPrice * quantity;
        if (linePrice <= 0) return 0;
        const val = parseFloat(promo.discount_value) || 0;
        switch (promo.discount_type) {
            case 'percentage': return Math.round(linePrice * Math.min(val, 100) / 100);
            case 'fixed': return Math.round(Math.min(val, linePrice));
            case 'fixed_price': return Math.round(Math.max(0, linePrice - val));
            default: return 0;
        }
    };

    // ── Pack hints ────────────────────────────────────────────────────────────
    const promoHints = useMemo(() => {
        if (!activePromotions?.length || !items.length) return [];
        const hints = [];

        const freeQty = (pid) => {
            const item = items.find(i => i.product_id === pid);
            if (!item) return 0;
            const total = parseFloat(item.quantity) || 0;
            const entries = Array.isArray(item.promotion_entries) ? item.promotion_entries : [];
            const packEntries = entries.filter(e => e.packCount !== undefined && e.packCount !== null);
            if (packEntries.length === 0 && item.promotion_units === null) return total;
            if (item.promotion_units === null && packEntries.length > 0) return 0;
            if (item.promotion_units !== null && item.promotion_units !== undefined) {
                return Math.max(0, total - parseFloat(item.promotion_units));
            }
            return total;
        };

        const fmt = (v) =>
            new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

        for (const promo of activePromotions) {

            // ── pack_fixed ─────────────────────────────────────────────────────
            if (promo.type === 'pack_fixed') {
                if (!promo.packProducts?.length) continue;

                const anyWithFreeUnits = promo.packProducts.some(pp => freeQty(pp.product_id) > 0);
                if (!anyWithFreeUnits) continue;

                const alreadyApplied = items.some(item =>
                    Array.isArray(item.promotion_entries) &&
                    item.promotion_entries.some(e => e.promotionId === promo.id)
                );

                const freeComplete = Math.floor(
                    Math.min(...promo.packProducts.map(pp =>
                        freeQty(pp.product_id) / (pp.quantity || 1)
                    ))
                );

                if (alreadyApplied && freeComplete === 0) continue;
                if (freeComplete >= 1) continue;

                const missing = promo.packProducts
                    .map(pp => ({
                        ...pp,
                        needed: (pp.quantity || 1) - Math.floor(freeQty(pp.product_id)),
                    }))
                    .filter(pp => pp.needed > 0);

                if (!missing.length) continue;

                const savings = calcPackSavings(promo, items);

                hints.push({
                    icon: '🎁',
                    promoName: promo.name,
                    message: (
                        <span>
                            Agrega{' '}
                            {missing.map((mp, idx) => (
                                <span key={mp.product_id}>
                                    {idx > 0 && ' + '}
                                    <strong>{mp.needed} {mp.product_name || 'producto'}</strong>
                                </span>
                            ))}
                            {' '}para activar el pack
                            {savings > 0
                                ? <span className="pack-hint-savings"> y ahorra ${fmt(savings)}</span>
                                : null
                            }
                        </span>
                    ),
                });
                continue;
            }

            // ── pack_quantity (ej. 3x2) ────────────────────────────────────────
            if (promo.type === 'pack_quantity') {
                const buyQty = parseInt(promo.pack_buy_quantity) || 3;
                const payQty = parseInt(promo.pack_pay_quantity) || 2;
                const freeN = buyQty - payQty;
                if (freeN <= 0) continue;

                let eligibleItems = [];
                if (promo.pack_quantity_source === 'category' && promo.category_id) {
                    eligibleItems = items.filter(i => i.category_id === promo.category_id);
                } else if (promo.packProducts?.length) {
                    const ids = new Set(promo.packProducts.map(p => p.product_id));
                    eligibleItems = items.filter(i => ids.has(i.product_id));
                }

                const totalUnits = eligibleItems.reduce((s, i) => s + (Math.floor(parseFloat(i.quantity) || 0)), 0);
                if (totalUnits === 0) continue;

                const remainder = totalUnits % buyQty;
                const needed = remainder === 0 ? 0 : buyQty - remainder;
                const completeGroups = Math.floor(totalUnits / buyQty);

                if (needed === 0) continue;

                const avgPrice = eligibleItems.length > 0
                    ? eligibleItems.reduce((s, i) => s + (parseFloat(i.unit_price) || 0), 0) / eligibleItems.length
                    : 0;
                const potentialSavings = Math.round(avgPrice * freeN);

                const scope = promo.pack_quantity_source === 'category' && promo.category_name
                    ? `de "${promo.category_name}"`
                    : '';

                hints.push({
                    icon: '🛒',
                    promoName: promo.name,
                    message: (
                        <span>
                            Agrega <strong>{needed} {needed === 1 ? 'unidad' : 'unidades'}</strong>
                            {scope ? ` ${scope}` : ''}{' '}
                            {completeGroups > 0
                                ? <span>(ya tienes {completeGroups} grupo{completeGroups > 1 ? 's' : ''}, agrega {needed} más para otro)</span>
                                : <span>para activar lleva {buyQty} paga {payQty}</span>
                            }
                            {' '}
                            <span className="pack-hint-savings">
                                ({freeN} {freeN === 1 ? 'gratis' : 'gratis'}
                                {potentialSavings > 0 ? ` · ahorra $${fmt(potentialSavings)}` : ''})
                            </span>
                        </span>
                    ),
                });
                continue;
            }

            // ── product_discount ───────────────────────────────────────────────
            if (promo.type === 'product_discount') {
                const cartItem = items.find(i => i.product_id === promo.product_id);
                if (cartItem) {
                    const alreadyApplied = Array.isArray(cartItem.promotion_entries) &&
                        cartItem.promotion_entries.some(e => e.promotionId === promo.id);
                    if (alreadyApplied) continue;
                }
                if (cartItem) continue;
                const unitPrice = parseFloat(promo.product_sale_price) || 0;
                const disc = unitPrice > 0 ? calcItemDiscount(promo, unitPrice, 1) : 0;
                hints.push({
                    icon: '🏷️',
                    promoName: promo.name,
                    message: (
                        <span>
                            Agrega <strong>{promo.product_name || 'el producto'}</strong> y obtén
                            {disc > 0
                                ? <span className="pack-hint-savings"> ${fmt(disc)} de descuento</span>
                                : ' un descuento especial'
                            }
                        </span>
                    ),
                });
                continue;
            }

            // ── category_discount ──────────────────────────────────────────────
            if (promo.type === 'category_discount') {
                const categoryItems = items.filter(i => i.category_id === promo.category_id);
                if (categoryItems.length > 0) {
                    const alreadyApplied = categoryItems.some(item =>
                        Array.isArray(item.promotion_entries) &&
                        item.promotion_entries.some(e => e.promotionId === promo.id)
                    );
                    if (alreadyApplied) continue;
                }
                if (categoryItems.length > 0) continue;
                const val = parseFloat(promo.discount_value) || 0;
                const discLabel = promo.discount_type === 'percentage'
                    ? `${val}% de descuento`
                    : promo.discount_type === 'fixed'
                        ? `$${fmt(val)} de descuento`
                        : 'descuento especial';
                hints.push({
                    icon: '🏷️',
                    promoName: promo.name,
                    message: (
                        <span>
                            Agrega productos de <strong>{promo.category_name || 'esta categoría'}</strong> y obtén{' '}
                            <span className="pack-hint-savings">{discLabel}</span>
                        </span>
                    ),
                });
                continue;
            }

            // ── minimum_amount ─────────────────────────────────────────────────
            if (promo.type === 'minimum_amount') {
                const minAmount = parseFloat(promo.minimum_purchase_amount) || 0;
                const subtotal = items.reduce((s, i) => s + (parseFloat(i.unit_price) || 0) * (parseFloat(i.quantity) || 0), 0);
                if (subtotal >= minAmount) continue;

                const pct = subtotal / minAmount;
                if (pct < 0.4) continue;

                const faltaAmount = minAmount - subtotal;
                const val = parseFloat(promo.discount_value) || 0;
                const potDisc = promo.discount_type === 'percentage'
                    ? Math.round(minAmount * val / 100)
                    : Math.round(val);

                hints.push({
                    icon: '💰',
                    promoName: promo.name,
                    message: (
                        <span>
                            Agrega <strong>${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0 }).format(faltaAmount)}</strong> más
                            {potDisc > 0
                                ? <span className="pack-hint-savings"> y obtén ${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0 }).format(potDisc)} de descuento</span>
                                : ' para activar el descuento'
                            }
                        </span>
                    ),
                });
                continue;
            }
        }

        return hints;
    }, [activePromotions, items]);

    useEffect(() => { loadCustomers(); }, []);

    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target))
                setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (holds.length === 0) setShowHoldsPanel(false);
    }, [holds]);

    useEffect(() => {
        if (globalDiscount) {
            setGlobalDiscMode(globalDiscount.type || 'percent');
            if (globalDiscount.value > 0) {
                setGlobalDiscValue(
                    globalDiscount.type === 'fixed'
                        ? formatThousands(globalDiscount.value)
                        : String(globalDiscount.value)
                );
            } else {
                setGlobalDiscValue('');
            }
        }
    }, [globalDiscount]);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const active = await customerRepo.getActive();
            setAllCustomers(Array.isArray(active) ? active : []);
        } catch { setAllCustomers([]); }
        finally { setLoading(false); }
    };

    const filteredCustomers = (() => {
        if (!search.trim()) return allCustomers.slice(0, 8);
        const q = search.toLowerCase().trim();
        const runQ = q.replace(/[.\-]/g, '');
        return allCustomers.filter(c => {
            const name = (c.full_name || '').toLowerCase();
            const run = (c.rut || '').toLowerCase().replace(/[.\-]/g, '');
            return name.includes(q) || run.includes(runQ);
        }).slice(0, 10);
    })();

    const selectedCustomer = customerId ? allCustomers.find(c => c.id === customerId) : null;

    const handleSelectCustomer = (customer) => {
        onUpdateCustomer(customer.id);
        setSearch('');
        setShowDropdown(false);
    };

    const handleClearCustomer = () => {
        onUpdateCustomer(null);
        setSearch('');
        setShowDropdown(false);
    };

    const handleCustomerCreated = (newCustomer) => {
        setAllCustomers(prev => [...prev, newCustomer]);
        onUpdateCustomer(newCustomer.id);
        setShowQuickAdd(false);
    };

    const formatCurrency = (v) =>
        new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
            .format(parseFloat(v) || 0);

    // ── Descuento manual al total ─────────────────────────────────────────────
    const globalDiscountAmount = (() => {
        if (!globalDiscount || globalDiscount.value <= 0) return 0;
        const sub = totals?.subtotalBeforeGlobal ?? totals?.subtotal ?? 0;
        if (globalDiscount.type === 'percent') return Math.round(sub * globalDiscount.value / 100);
        return Math.min(globalDiscount.value, sub);
    })();

    const applyGlobalDiscount = () => {
        // Parsear limpiando puntos de miles antes de convertir a número
        const raw = parseFloat(String(globalDiscValue).replace(/\./g, '').replace(',', '.'));
        if (isNaN(raw) || raw <= 0) {
            onUpdateGlobalDiscount({ type: globalDiscMode, value: 0 });
            setGlobalDiscValue('');
            setShowGlobalDisc(false);
            return;
        }
        if (globalDiscMode === 'percent' && raw > settings.maxPercent) {
            // Mostrar alerta — usar el mismo dialog de POSMain no es posible desde aquí,
            // así que usamos window.alert momentáneamente o simplemente cappear con feedback visual
            setGlobalDiscValue(String(settings.maxPercent));
            return;
        }
        const value = globalDiscMode === 'percent' ? Math.min(raw, settings.maxPercent) : raw;
        onUpdateGlobalDiscount({ type: globalDiscMode, value });
        setShowGlobalDisc(false);
    };

    const clearGlobalDiscount = () => {
        onUpdateGlobalDiscount({ type: 'percent', value: 0 });
        setGlobalDiscValue('');
        setShowGlobalDisc(false);
    };

    const handleGlobalDiscKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyGlobalDiscount(); }
        if (e.key === 'Escape') { e.preventDefault(); setShowGlobalDisc(false); }
    };

    // Limpiar valor al cambiar de modo
    const handleChangeMode = (mode) => {
        setGlobalDiscMode(mode);
        setGlobalDiscValue('');
    };

    // ── Holds helpers ─────────────────────────────────────────────────────────
    const getHoldCustomerName = (hold) =>
        hold.customerId ? allCustomers.find(c => c.id === hold.customerId)?.full_name || null : null;

    const getHoldTotal = (hold) =>
        hold.cart.reduce((sum, item) => {
            const p = parseFloat(item.unit_price) || 0;
            const q = parseFloat(item.quantity) || 0;
            const d = parseFloat(item.discount) || 0;
            return sum + Math.max(0, p * q - d);
        }, 0);

    const formatHoldTime = (savedAt) =>
        new Date(savedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <div className="cart-sidebar">

                {/* ── Header ── */}
                <div className="cart-sidebar-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FiShoppingCart size={18} />
                        <h3>Resumen del pedido</h3>
                    </div>
                    {holds.length > 0 && (
                        <button
                            className={`holds-toggle-btn${showHoldsPanel ? ' holds-toggle-btn--active' : ''}`}
                            onClick={() => setShowHoldsPanel(v => !v)}
                        >
                            <FiClock size={13} />
                            <span>En espera</span>
                            <span className="holds-badge">{holds.length}</span>
                        </button>
                    )}
                </div>

                {/* ── Panel holds ── */}
                {showHoldsPanel && holds.length > 0 && (
                    <div className="holds-panel">
                        <div className="holds-panel-title">
                            <FiClock size={12} /> Ventas pausadas
                        </div>
                        {holds.map((hold, idx) => {
                            const customerName = getHoldCustomerName(hold);
                            const holdTotal = getHoldTotal(hold);
                            const itemsCount = hold.cart.length;
                            return (
                                <div key={hold.id} className="hold-item">
                                    <div className="hold-item-info">
                                        <div className="hold-item-top">
                                            <span className="hold-item-label">
                                                {customerName || `Venta #${idx + 1}`}
                                            </span>
                                            <span className="hold-item-time">
                                                {formatHoldTime(hold.savedAt)}
                                            </span>
                                        </div>
                                        <div className="hold-item-meta">
                                            {itemsCount} {itemsCount === 1 ? 'producto' : 'productos'} · ${formatCurrency(holdTotal)}
                                        </div>
                                    </div>
                                    <div className="hold-item-actions">
                                        <button
                                            className="hold-btn hold-btn--resume"
                                            onClick={() => { onResumeHold(hold.id); setShowHoldsPanel(false); }}
                                        >
                                            <FiPlay size={11} />
                                        </button>
                                        <button
                                            className="hold-btn hold-btn--delete"
                                            onClick={() => onDeleteHold(hold.id)}
                                        >
                                            <FiX size={11} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Selector de cliente ── */}
                <div className="cart-customer">
                    <div className="cc-row" ref={wrapperRef}>
                        <button
                            type="button"
                            className={`cc-trigger${showDropdown ? ' cc-trigger--open' : ''}${selectedCustomer ? ' cc-trigger--filled' : ''}`}
                            onClick={() => {
                                if (isProcessing || loading) return;
                                const next = !showDropdown;
                                setShowDropdown(next);
                                if (next) setTimeout(() => searchRef.current?.focus(), 30);
                            }}
                            disabled={isProcessing || loading}
                        >
                            <FiUser size={14} className="cc-trigger-icon" />
                            <span className="cc-trigger-text">
                                {selectedCustomer
                                    ? selectedCustomer.full_name
                                    : loading ? 'Cargando...' : 'Seleccionar cliente'}
                            </span>
                            {selectedCustomer?.rut && (
                                <span className="cc-trigger-rut">{selectedCustomer.rut}</span>
                            )}
                            <svg className="cc-chevron" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {selectedCustomer && (
                            <button type="button" className="cc-clear-btn" onClick={handleClearCustomer} disabled={isProcessing}>
                                <FiX size={14} />
                            </button>
                        )}
                        <button type="button" className="cc-add-btn" onClick={() => setShowQuickAdd(true)} disabled={isProcessing}>
                            <FiUserPlus size={15} />
                        </button>

                        {showDropdown && (
                            <div className="cc-dropdown">
                                <div className="cc-search">
                                    <FiSearch size={13} className="cc-search-icon" />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        className="cc-search-input"
                                        placeholder="Buscar por nombre o RUN..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        autoComplete="off"
                                    />
                                    {search && (
                                        <button type="button" className="cc-search-clear"
                                            onClick={() => { setSearch(''); searchRef.current?.focus(); }}>
                                            <FiX size={11} />
                                        </button>
                                    )}
                                </div>
                                <div className="cc-list">
                                    {loading ? (
                                        <div className="cc-empty">Cargando...</div>
                                    ) : filteredCustomers.length === 0 ? (
                                        <div className="cc-empty">
                                            Sin resultados —&nbsp;
                                            <button type="button" className="cc-empty-link"
                                                onClick={() => { setShowDropdown(false); setShowQuickAdd(true); }}>
                                                crear nuevo
                                            </button>
                                        </div>
                                    ) : (
                                        filteredCustomers.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                className={`cc-item${c.id === customerId ? ' cc-item--active' : ''}`}
                                                onClick={() => handleSelectCustomer(c)}
                                            >
                                                <span className="cc-item-name">{c.full_name}</span>
                                                {c.rut && <span className="cc-item-rut">{c.rut}</span>}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Zona scrollable: hints ── */}
                <div className="cart-sidebar-scroll">
                    {promoHints.length > 0 && <PromoHints hints={promoHints} />}
                </div>

                {/* ── Totales ── */}
                <div className="cart-sidebar-totals">
                    <div className="total-row-compact">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(totals?.subtotal ?? 0)}</span>
                    </div>

                    {/* Descuento automático por minimum_amount */}
                    {(() => {
                        const minP = appliedPromotions.find(p => p.promotion_type === 'minimum_amount');
                        if (!minP || promoGlobalDiscount <= 0) return null;
                        return (
                            <div className="total-row-compact" style={{ color: '#15803d' }}>
                                <span style={{ fontSize: '12px', fontWeight: 500 }}>
                                    🏷 {minP.promotion_name || 'Descuento por monto'}:
                                </span>
                                <span style={{ fontWeight: 700 }}>−${formatCurrency(promoGlobalDiscount)}</span>
                            </div>
                        );
                    })()}

                    {/* Descuento manual al total */}
                    {settings.globalEnabled && items.length > 0 && (
                        <>
                            {showGlobalDisc ? (
                                <div className="global-discount-editor">
                                    <div className="global-discount-header">
                                        <span className="global-discount-label">Descuento al total</span>
                                        <button className="global-discount-close" onClick={() => setShowGlobalDisc(false)} type="button">
                                            <FiX size={12} />
                                        </button>
                                    </div>
                                    <div className="global-discount-row">
                                        <div className="global-discount-modes">
                                            <button
                                                className={`disc-mode-btn${globalDiscMode === 'percent' ? ' disc-mode-btn--active' : ''}`}
                                                onClick={() => handleChangeMode('percent')} type="button"
                                            >
                                                porcentaje
                                            </button>
                                            <button
                                                className={`disc-mode-btn${globalDiscMode === 'fixed' ? ' disc-mode-btn--active' : ''}`}
                                                onClick={() => handleChangeMode('fixed')} type="button"
                                            >
                                                monto
                                            </button>
                                        </div>
                                        <span className="disc-prefix">
                                            {globalDiscMode === 'percent' ? '%' : '$'}
                                        </span>
                                        {/* ── Input con separador de miles (monto) o límite 0-100 (%) ── */}
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="global-discount-input"
                                            placeholder={globalDiscMode === 'percent' ? '0–100' : '0'}
                                            value={globalDiscValue}
                                            onChange={(e) => {
                                                if (globalDiscMode === 'percent') {
                                                    // Solo dígitos, máximo 100
                                                    const digits = e.target.value.replace(/\D/g, '');
                                                    const num = parseInt(digits || '0');
                                                    if (digits === '') { setGlobalDiscValue(''); return; }
                                                    if (num > settings.maxPercent) {
                                                        // No dejar escribir más del límite
                                                        setGlobalDiscValue(String(settings.maxPercent));
                                                    } else {
                                                        setGlobalDiscValue(String(num));
                                                    }
                                                } else {
                                                    // Monto: formatear con separador de miles
                                                    setGlobalDiscValue(formatThousands(e.target.value));
                                                }
                                            }}
                                            onKeyDown={handleGlobalDiscKeyDown}
                                            autoFocus
                                        />
                                        <button className="disc-apply-btn" onClick={applyGlobalDiscount} type="button">
                                            Aplicar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="total-row-compact total-row-discount-toggle">
                                    {globalDiscountAmount > 0 ? (
                                        <>
                                            <span className="discount-toggle-label">
                                                Dto. global{globalDiscount?.type === 'percent' && ` (${globalDiscount.value}%)`}:
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span className="discount-amount-label">−${formatCurrency(globalDiscountAmount)}</span>
                                                <button className="discount-edit-btn" onClick={() => setShowGlobalDisc(true)}>
                                                    <FiTag size={11} />
                                                </button>
                                                <button className="discount-clear-btn" onClick={clearGlobalDiscount}>
                                                    <FiX size={11} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <button className="add-global-discount-btn" onClick={() => setShowGlobalDisc(true)} type="button">
                                            <FiTag size={12} />
                                            Agregar descuento al total
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <div className="total-row-compact final">
                        <span>TOTAL:</span>
                        <span>${formatCurrency(totals?.total ?? 0)}</span>
                    </div>
                </div>

                {/* ── Acciones ── */}
                <div className="cart-sidebar-actions">
                    {items.length > 0 && onHold && (
                        <button className="hold-action-btn" onClick={onHold} disabled={isProcessing}>
                            <FiPause size={13} />
                            Poner en espera
                        </button>
                    )}
                    <Button variant="danger" size="small" onClick={onClear}
                        disabled={items.length === 0 || isProcessing} fullWidth>
                        Limpiar ({kbd('F10', '⌘⌫')})
                    </Button>
                    <Button variant="success" icon={<FiCreditCard />} onClick={onPay}
                        disabled={items.length === 0 || isProcessing} loading={isProcessing} fullWidth>
                        {isProcessing ? 'Procesando...' : `Pagar (${kbd('F9', '⌘P')})`}
                    </Button>
                </div>
            </div>

            {showQuickAdd && (
                <QuickAddCustomerModal
                    db={db}
                    onCreated={handleCustomerCreated}
                    onClose={() => setShowQuickAdd(false)}
                />
            )}
        </>
    );
};

export default CartSidebar;