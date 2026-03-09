import React, { useState, useEffect, useRef } from 'react';
import {
    FiTrash2, FiMinus, FiPlus, FiShoppingCart,
    FiCreditCard, FiUser, FiUserPlus, FiSearch, FiX,
    FiPause, FiPlay, FiClock,
} from 'react-icons/fi';
import { useDatabase } from '../../context/DatabaseContext';
import CustomerRepository from '../../services/repositories/customerRepository';
import QuickAddCustomerModal from './QuickAddCustomerModal';
import Button from '../../components/common/Button';
import './CartSidebar.css';

// ── Detección de plataforma ───────────────────────────────────────────────────
const isMac = () => window.electronAPI?.platform === 'darwin';
const kbd = (windowsKey, macKey) => isMac() ? macKey : windowsKey;

const CartSidebar = ({
    items,
    totals,
    customerId,
    onUpdateCustomer,
    onUpdateQuantity,
    onUpdateItemDiscount,
    onRemove,
    onClear,
    onPay,
    isProcessing = false,
    // Ventas en espera
    holds        = [],
    onHold,
    onResumeHold,
    onDeleteHold,
}) => {
    const { db } = useDatabase();
    const [allCustomers,   setAllCustomers]   = useState([]);
    const [search,         setSearch]         = useState('');
    const [showDropdown,   setShowDropdown]   = useState(false);
    const [loading,        setLoading]        = useState(false);
    const [editingItemId,  setEditingItemId]  = useState(null);
    const [editValue,      setEditValue]      = useState('');
    const [showQuickAdd,   setShowQuickAdd]   = useState(false);
    const [showHoldsPanel, setShowHoldsPanel] = useState(false);

    const wrapperRef   = useRef(null);
    const searchRef    = useRef(null);
    const customerRepo = new CustomerRepository(db);

    useEffect(() => { loadCustomers(); }, []);

    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target))
                setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Cerrar panel si ya no hay holds
    useEffect(() => {
        if (holds.length === 0) setShowHoldsPanel(false);
    }, [holds]);

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const active = await customerRepo.getActive();
            setAllCustomers(Array.isArray(active) ? active : []);
        } catch (err) {
            console.error('Error loading customers:', err);
            setAllCustomers([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = (() => {
        if (!search.trim()) return allCustomers.slice(0, 8);
        const q    = search.toLowerCase().trim();
        const runQ = q.replace(/[.\-]/g, '');
        return allCustomers.filter(c => {
            const name = (c.full_name || '').toLowerCase();
            const run  = (c.rut || '').toLowerCase().replace(/[.\-]/g, '');
            return name.includes(q) || run.includes(runQ);
        }).slice(0, 10);
    })();

    const selectedCustomer = customerId
        ? allCustomers.find(c => c.id === customerId)
        : null;

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

    // ── Helpers del carrito ───────────────────────────────────────────────────
    const calculateItemTotal = (item) => {
        const unitPrice = parseFloat(item.unit_price) || 0;
        const quantity  = parseFloat(item.quantity)   || 0;
        const discount  = parseFloat(item.discount)   || 0;
        return Math.round(Math.max(0, unitPrice * quantity - discount));
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(value) || 0);

    const formatQuantity = (item) => {
        const quantity  = parseFloat(item.quantity) || 0;
        const unitLabel = item.unit_label || 'un';
        const formatted = new Intl.NumberFormat('es-CL', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        }).format(quantity);
        return `${formatted} ${unitLabel}`;
    };

    const allowsSimpleIncrement = (item) => (item.unit_label || 'un') === 'un';

    const handleIncrement = (item) => {
        if (!allowsSimpleIncrement(item)) { startEditing(item); return; }
        onUpdateQuantity(item.product_id, parseFloat(item.quantity) + 1);
    };

    const handleDecrement = (item) => {
        if (!allowsSimpleIncrement(item)) { startEditing(item); return; }
        const newQty = parseFloat(item.quantity) - 1;
        if (newQty <= 0) {
            if (window.confirm(`¿Eliminar "${item.product_name}" del carrito?`))
                onRemove(item.product_id);
        } else {
            onUpdateQuantity(item.product_id, newQty);
        }
    };

    const startEditing  = (item) => { setEditingItemId(item.product_id); setEditValue(item.quantity.toString()); };
    const cancelEditing = ()     => { setEditingItemId(null); setEditValue(''); };

    const saveEdit = (productId) => {
        const num = parseFloat(editValue);
        if (isNaN(num) || num <= 0) { alert('Ingresa una cantidad válida mayor a 0'); return; }
        onUpdateQuantity(productId, num);
        cancelEditing();
    };

    const handleEditKeyDown = (e, productId) => {
        if (e.key === 'Enter')  { e.preventDefault(); saveEdit(productId); }
        if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
    };

    // ── Helpers de holds ──────────────────────────────────────────────────────
    const getHoldCustomerName = (hold) => {
        if (!hold.customerId) return null;
        return allCustomers.find(c => c.id === hold.customerId)?.full_name || null;
    };

    const getHoldTotal = (hold) =>
        hold.cart.reduce((sum, item) => {
            const unitPrice = parseFloat(item.unit_price) || 0;
            const quantity  = parseFloat(item.quantity)   || 0;
            const discount  = parseFloat(item.discount)   || 0;
            return sum + Math.max(0, unitPrice * quantity - discount);
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
                        <FiShoppingCart size={20} />
                        <h3>Carrito ({items.length})</h3>
                    </div>

                    {holds.length > 0 && (
                        <button
                            className={`holds-toggle-btn${showHoldsPanel ? ' holds-toggle-btn--active' : ''}`}
                            onClick={() => setShowHoldsPanel(v => !v)}
                            title="Ver ventas en espera"
                        >
                            <FiClock size={13} />
                            <span>En espera</span>
                            <span className="holds-badge">{holds.length}</span>
                        </button>
                    )}
                </div>

                {/* ── Panel de ventas en espera ── */}
                {showHoldsPanel && holds.length > 0 && (
                    <div className="holds-panel">
                        <div className="holds-panel-title">
                            <FiClock size={12} />
                            Ventas pausadas
                        </div>
                        {holds.map((hold, idx) => {
                            const customerName = getHoldCustomerName(hold);
                            const holdTotal    = getHoldTotal(hold);
                            const itemsCount   = hold.cart.length;
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
                                            title="Retomar esta venta"
                                        >
                                            <FiPlay size={11} />
                                        </button>
                                        <button
                                            className="hold-btn hold-btn--delete"
                                            onClick={() => onDeleteHold(hold.id)}
                                            title="Eliminar esta espera"
                                        >
                                            <FiX size={11} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Selector de Cliente ── */}
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
                                    : loading ? 'Cargando clientes...' : 'Seleccionar cliente'}
                            </span>
                            {selectedCustomer?.rut && (
                                <span className="cc-trigger-rut">{selectedCustomer.rut}</span>
                            )}
                            <svg className="cc-chevron" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {selectedCustomer && (
                            <button
                                type="button"
                                className="cc-clear-btn"
                                onClick={handleClearCustomer}
                                disabled={isProcessing}
                                title="Quitar cliente"
                            >
                                <FiX size={14} />
                            </button>
                        )}

                        <button
                            type="button"
                            className="cc-add-btn"
                            onClick={() => setShowQuickAdd(true)}
                            disabled={isProcessing}
                            title="Crear nuevo cliente"
                        >
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
                                        <button
                                            type="button"
                                            className="cc-search-clear"
                                            onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                                        >
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

                {/* ── Items ── */}
                <div className="cart-sidebar-items">
                    {items.length === 0 ? (
                        <div className="cart-sidebar-empty">
                            <FiShoppingCart size={48} />
                            <p>Carrito vacío</p>
                            <small>Busca productos para agregar</small>
                        </div>
                    ) : (
                        items.map((item) => (
                            <div key={item.product_id} className="cart-sidebar-item">
                                <div className="cart-item-header">
                                    <span className="cart-item-name-compact">
                                        {item.product_name}
                                        {item.product_type === 'service' && (
                                            <span className="service-badge-tiny">✂️</span>
                                        )}
                                    </span>
                                    <button
                                        className="cart-item-remove-btn"
                                        onClick={() => onRemove(item.product_id)}
                                        title="Eliminar"
                                        disabled={isProcessing}
                                    >
                                        <FiTrash2 size={14} />
                                    </button>
                                </div>

                                <div className="cart-item-controls">
                                    <div className="cart-item-qty-compact">
                                        {editingItemId === item.product_id ? (
                                            <div className="qty-edit-mode">
                                                <input
                                                    type="text"
                                                    className="qty-edit-input"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onKeyDown={(e) => handleEditKeyDown(e, item.product_id)}
                                                    onBlur={() => saveEdit(item.product_id)}
                                                    autoFocus
                                                    disabled={isProcessing}
                                                />
                                                <span className="qty-edit-unit">{item.unit_label}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <button className="qty-btn-compact" onClick={() => handleDecrement(item)} disabled={isProcessing}>
                                                    <FiMinus size={12} />
                                                </button>
                                                <button className="qty-display" onClick={() => startEditing(item)} disabled={isProcessing} title="Click para editar">
                                                    {formatQuantity(item)}
                                                </button>
                                                <button className="qty-btn-compact" onClick={() => handleIncrement(item)} disabled={isProcessing}>
                                                    <FiPlus size={12} />
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    <div className="cart-item-price-compact">
                                        <span className="price-label">x ${formatCurrency(item.unit_price)}</span>
                                        <span className="price-total">${formatCurrency(calculateItemTotal(item))}</span>
                                    </div>
                                </div>

                                {item.discount > 0 && (
                                    <div className="cart-item-discount-info">
                                        Descuento: ${formatCurrency(item.discount)}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* ── Totales ── */}
                <div className="cart-sidebar-totals">
                    <div className="total-row-compact">
                        <span>Subtotal:</span>
                        <span>${formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="total-row-compact final">
                        <span>TOTAL:</span>
                        <span>${formatCurrency(totals.total)}</span>
                    </div>
                </div>

                {/* ── Acciones ── */}
                <div className="cart-sidebar-actions">
                    {items.length > 0 && onHold && (
                        <button
                            className="hold-action-btn"
                            onClick={onHold}
                            disabled={isProcessing}
                            title="Pausar esta venta y atender otro cliente"
                        >
                            <FiPause size={13} />
                            Poner en espera
                        </button>
                    )}
                    <Button variant="danger" size="small" onClick={onClear} disabled={items.length === 0 || isProcessing} fullWidth>
                        Limpiar ({kbd('F10', '⌘⌫')})
                    </Button>
                    <Button variant="success" icon={<FiCreditCard />} onClick={onPay} disabled={items.length === 0 || isProcessing} loading={isProcessing} fullWidth>
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