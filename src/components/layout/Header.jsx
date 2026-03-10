// src/components/layout/Header.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiSearch, FiLogOut, FiX, FiBell } from 'react-icons/fi';
import Button from '../common/Button';
import './Header.css';

const CASH_MAX_HOURS = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────
function horasAbiertas(openedAt) {
    return (Date.now() - new Date(openedAt).getTime()) / (1000 * 60 * 60);
}

function formatHorasAbiertas(openedAt) {
    const totalMinutos = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
    const horas   = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    if (horas === 0)   return `${minutos}min`;
    if (minutos === 0) return `${horas}h`;
    return `${horas}h ${minutos}min`;
}

function formatFechaAbierta(openedAt) {
    const d    = new Date(openedAt);
    const hoy  = new Date();
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoy.toDateString())  return `Hoy a las ${hora}`;
    if (d.toDateString() === ayer.toDateString()) return `Ayer a las ${hora}`;
    return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }) + ` a las ${hora}`;
}

// ── Dialog React ──────────────────────────────────────────────────────────────
const HeaderDialog = ({ dialog }) => {
    useEffect(() => {
        if (!dialog) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && dialog.onCancel)  dialog.onCancel();
            if (e.key === 'Enter'  && dialog.onConfirm) dialog.onConfirm();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog]);

    if (!dialog) return null;

    return (
        <div className="hd-dialog-overlay">
            <div className="hd-dialog" onClick={e => e.stopPropagation()}>
                <div className="hd-dialog-icon">⚠️</div>
                <p className="hd-dialog-title">{dialog.title}</p>
                <p className="hd-dialog-message">{dialog.message}</p>
                <div className="hd-dialog-actions">
                    {dialog.actions.map((action, i) => (
                        <button
                            key={i}
                            className={`hd-dialog-btn hd-dialog-btn--${action.variant || 'cancel'}`}
                            onClick={action.onClick}
                            autoFocus={action.autoFocus}>
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ── Notificación de cajas abiertas ────────────────────────────────────────────
const CashAlert = ({ user }) => {
    const [cajasAbiertas, setCajasAbiertas] = useState([]);
    const [open,          setOpen]          = useState(false);
    const dropdownRef = useRef(null);

    const loadCajas = useCallback(async () => {
        if (!user) return;
        try {
            const sql = user.role === 'admin'
                ? `SELECT cr.id, cr.opened_at, u.full_name as userName
                   FROM cash_registers cr
                   JOIN users u ON cr.opened_by = u.id
                   WHERE cr.status = 'open'`
                : `SELECT cr.id, cr.opened_at, u.full_name as userName
                   FROM cash_registers cr
                   JOIN users u ON cr.opened_by = u.id
                   WHERE cr.status = 'open' AND cr.opened_by = ?`;
            const params = user.role === 'admin' ? [] : [user.id];
            const rows   = await window.electronAPI.database.query(sql, params);
            const viejas = (rows || []).filter(r => horasAbiertas(r.opened_at) >= CASH_MAX_HOURS);
            setCajasAbiertas(viejas);
        } catch (err) {
            console.error('[CashAlert] Error:', err);
        }
    }, [user]);

    useEffect(() => {
        loadCajas();
        const interval = setInterval(loadCajas, 5 * 60 * 1000);
        window.addEventListener('cash:closed', loadCajas);
        return () => {
            clearInterval(interval);
            window.removeEventListener('cash:closed', loadCajas);
        };
    }, [loadCajas]);

    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    if (cajasAbiertas.length === 0) return null;

    return (
        <div className="cash-alert-wrapper" ref={dropdownRef}>
            <button
                className="cash-alert-btn"
                onClick={() => setOpen(o => !o)}
                title={`${cajasAbiertas.length} caja${cajasAbiertas.length > 1 ? 's' : ''} abierta${cajasAbiertas.length > 1 ? 's' : ''} por más de ${CASH_MAX_HOURS}h`}
            >
                <FiBell size={18} />
                <span className="cash-alert-badge">{cajasAbiertas.length}</span>
            </button>

            {open && (
                <div className="cash-alert-dropdown">
                    <div className="cash-alert-header">
                        ⚠️ {cajasAbiertas.length === 1
                            ? 'Caja con mucho tiempo abierta'
                            : `${cajasAbiertas.length} cajas con mucho tiempo abiertas`}
                    </div>
                    {cajasAbiertas.map(caja => (
                        <div key={caja.id} className="cash-alert-item">
                            <div className="cash-alert-item__user">
                                <span className="cash-alert-item__avatar">
                                    {caja.userName?.charAt(0)?.toUpperCase()}
                                </span>
                                <div>
                                    <div className="cash-alert-item__name">{caja.userName}</div>
                                    <div className="cash-alert-item__since">{formatFechaAbierta(caja.opened_at)}</div>
                                </div>
                            </div>
                            <div className="cash-alert-item__time">
                                {formatHorasAbiertas(caja.opened_at)}
                            </div>
                        </div>
                    ))}

                </div>
            )}
        </div>
    );
};

// ── Header principal ──────────────────────────────────────────────────────────
const Header = ({ user, onLogout, sidebarOpen, businessName = "Sistema POS" }) => {
    const [searchTerm,   setSearchTerm]   = useState('');
    const [results,      setResults]      = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [searching,    setSearching]    = useState(false);
    const [dialog,       setDialog]       = useState(null);

    const searchRef   = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target))
                setShowDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!searchTerm.trim() || searchTerm.length < 2) {
            setResults([]); setShowDropdown(false); return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const data = await window.electronAPI.database.query(`
                    SELECT id, name, sale_price, stock, min_stock, unit, type,
                           is_active, unlimited_stock
                    FROM products
                    WHERE (name LIKE ? OR sku LIKE ? OR barcode LIKE ?)
                    AND is_active = 1
                    ORDER BY name ASC
                    LIMIT 8
                `, [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);
                setResults(Array.isArray(data) ? data : []);
                setShowDropdown(true);
            } catch (error) {
                console.error('Error buscando productos:', error);
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    }, [searchTerm]);

    const handleClear = () => {
        setSearchTerm(''); setResults([]); setShowDropdown(false);
    };

    const checkOpenRegister = async () => {
        try {
            const row = await window.electronAPI.database.get(
                `SELECT id, opening_amount, opened_at
                 FROM cash_registers
                 WHERE status = 'open' AND opened_by = ?
                 LIMIT 1`,
                [user?.id]
            );
            return row || null;
        } catch { return null; }
    };

    const handleLogoutClick = async () => {
        const openRegister = await checkOpenRegister();
        if (!openRegister) { onLogout(); return; }
        setDialog({
            title:   '⚠️ Tienes una caja abierta',
            message: `Tu caja lleva activa desde ${formatFechaAbierta(openRegister.opened_at)}. Si cierras sesión sin cerrar la caja, quedará disponible cuando vuelvas a iniciar sesión.`,
            actions: [
                {
                    label:     'Cerrar sesión igual',
                    variant:   'warning',
                    autoFocus: false,
                    onClick:   () => { setDialog(null); onLogout(); }
                },
                {
                    label:     'Cancelar',
                    variant:   'cancel',
                    autoFocus: true,
                    onClick:   () => setDialog(null)
                },
            ]
        });
    };

    const formatCurrency = (value) => new Intl.NumberFormat('es-CL', {
        style: 'currency', currency: 'CLP'
    }).format(value);

    const formatStock = (value, unit) => {
        const num = parseFloat(value) || 0;
        const formatted = new Intl.NumberFormat('es-CL', {
            minimumFractionDigits: 0, maximumFractionDigits: 3,
        }).format(num);
        return `${formatted} ${unit || 'un'}`;
    };

    const getStockStatus = (product) => {
        if (product.type === 'service')
            return { label: 'Servicio', color: '#6b7280' };
        if (product.unlimited_stock === 1 || product.unlimited_stock === true)
            return { label: 'Siempre disponible', color: '#7c3aed' };
        const stock    = parseFloat(product.stock)     || 0;
        const minStock = parseFloat(product.min_stock) || 0;
        if (stock <= 0)        return { label: 'Sin stock',                              color: '#ef4444' };
        if (stock <= minStock) return { label: `${formatStock(stock, product.unit)} ⚠️`, color: '#f59e0b' };
        return                        { label: formatStock(stock, product.unit),          color: '#10b981' };
    };

    const roleLabel = (role) => {
        const map = { admin: 'Administrador', vendedor: 'Vendedor', cajero: 'Cajero' };
        return map[role] || role;
    };

    return (
        <>
            <header className={`app-header ${sidebarOpen ? 'header-expanded' : 'header-collapsed'}`}>

                <div className="header-brand">
                    <span className="header-title">
                        Nu<span className="brand-v">v</span>enta
                    </span>
                </div>

                <div className="header-search" ref={searchRef}>
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Consultar precio y stock de producto o servicio..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => results.length > 0 && setShowDropdown(true)}
                    />
                    {searchTerm && (
                        <button className="search-clear-btn" onClick={handleClear}>
                            <FiX size={14} />
                        </button>
                    )}
                    {showDropdown && (
                        <div className="search-dropdown">
                            {searching && (
                                <div className="search-dropdown-loading">Buscando...</div>
                            )}
                            {!searching && results.length === 0 && (
                                <div className="search-dropdown-empty">
                                    Sin resultados para "{searchTerm}"
                                </div>
                            )}
                            {!searching && results.map((product) => {
                                const stockStatus = getStockStatus(product);
                                return (
                                    <div key={product.id} className="search-dropdown-item">
                                        <div className="search-item-icon">
                                            {product.type === 'service' ? '👤' : '📦'}
                                        </div>
                                        <div className="search-item-info">
                                            <span className="search-item-name">{product.name}</span>
                                            <span className="search-item-stock" style={{ color: stockStatus.color }}>
                                                {stockStatus.label}
                                            </span>
                                        </div>
                                        <div className="search-item-price">
                                            {formatCurrency(product.sale_price)}
                                        </div>
                                    </div>
                                );
                            })}
                            {!searching && results.length > 0 && (
                                <div className="search-dropdown-footer">
                                    Solo consulta · Para vender usa el Punto de Venta
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="header-actions">
                    {/* Alerta de caja abierta */}
                    <CashAlert user={user} />

                    <div className="header-user">
                        <div className="user-avatar">
                            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="user-info">
                            <span className="user-name">{user?.fullName}</span>
                            <span className="user-role">{roleLabel(user?.role)}</span>
                        </div>
                    </div>
                    <Button
                        variant="danger"
                        size="small"
                        icon={<FiLogOut />}
                        onClick={handleLogoutClick}
                    >
                        Salir
                    </Button>
                </div>
            </header>

            <HeaderDialog dialog={dialog} />
        </>
    );
};

export default Header;