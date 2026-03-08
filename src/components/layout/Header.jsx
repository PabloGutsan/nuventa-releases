// src/components/layout/Header.jsx
import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiLogOut, FiX } from 'react-icons/fi';
import Button from '../common/Button';
import './Header.css';

// ── Dialog React (evita window.confirm que pega inputs en Electron) ───────────
const HeaderDialog = ({ dialog }) => {
    useEffect(() => {
        if (!dialog) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && dialog.onCancel) dialog.onCancel();
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

const Header = ({ user, onLogout, sidebarOpen, businessName = "Sistema POS" }) => {
    const [searchTerm,    setSearchTerm]    = useState('');
    const [results,       setResults]       = useState([]);
    const [showDropdown,  setShowDropdown]  = useState(false);
    const [searching,     setSearching]     = useState(false);
    const [dialog,        setDialog]        = useState(null);

    const searchRef  = useRef(null);
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

    // ── Verificar si el usuario tiene caja abierta ────────────────────────────
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
        } catch {
            return null;
        }
    };

    // ── Logout con verificación de caja ──────────────────────────────────────
    const handleLogoutClick = async () => {
        const openRegister = await checkOpenRegister();

        if (!openRegister) {
            // Sin caja abierta → cerrar sesión directo
            onLogout();
            return;
        }

        // Tiene caja abierta → mostrar dialog de advertencia
        setDialog({
            title:   '⚠️ Tienes una caja abierta',
            message: `Tu caja lleva activa desde las ${
                (() => {
                    const d = new Date(openRegister.opened_at);
                    const hoy = new Date();
                    const esHoy = d.toDateString() === hoy.toDateString();
                    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
                    const esAyer = d.toDateString() === ayer.toDateString();
                    const hora = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                    if (esHoy)  return `hoy a las ${hora}`;
                    if (esAyer) return `ayer a las ${hora}`;
                    return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }) + ` a las ${hora}`;
                })()
            }. Si cierras sesión sin cerrar la caja, quedará disponible cuando vuelvas a iniciar sesión.`,
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

                {/* Marca */}
                <div className="header-brand">
                    <span className="header-title">
                        Nu<span className="brand-v">v</span>enta
                    </span>
                </div>

                {/* Búsqueda rápida de stock */}
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

                {/* Usuario + Logout */}
                <div className="header-actions">
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

            {/* Dialog de advertencia de caja — fuera del header para z-index correcto */}
            <HeaderDialog dialog={dialog} />
        </>
    );
};

export default Header;