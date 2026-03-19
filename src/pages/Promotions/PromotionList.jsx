// src/pages/Promotions/PromotionList.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import {
    FiTag, FiPlus, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight,
    FiRefreshCw, FiSearch, FiFilter, FiAlertCircle,
    FiPackage, FiPercent, FiShoppingCart, FiLayers, FiEye,
} from 'react-icons/fi';
import PromotionFormModal   from './PromotionFormModal';
import PromotionDetailModal from './PromotionDetailModal';
import './PromotionList.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatCurrency = (v) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);

const formatDate = (dt) => {
    if (!dt) return null;
    return new Date(dt).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const TYPE_LABELS = {
    product_discount:  { label: 'Producto',      icon: FiTag,          color: '#2563eb', bg: '#dbeafe' },
    category_discount: { label: 'Categoría',     icon: FiFilter,       color: '#7c3aed', bg: '#ede9fe' },
    pack_fixed:        { label: 'Pack fijo',      icon: FiPackage,      color: '#0891b2', bg: '#cffafe' },
    pack_quantity:     { label: 'Pack cantidad',  icon: FiLayers,       color: '#0891b2', bg: '#cffafe' },
    minimum_amount:    { label: 'Monto mínimo',   icon: FiShoppingCart, color: '#d97706', bg: '#fef3c7' },
};

const DISC_LABELS = {
    percentage:  (v) => `${v}% off`,
    fixed:       (v) => `${formatCurrency(v)} off`,
    fixed_price: (v) => `Precio fijo ${formatCurrency(v)}`,
};

const getStatusInfo = (promo) => {
    if (!promo.is_active) return { label: 'Inactiva',   color: '#6b7280', bg: '#f3f4f6' };
    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now)
        return { label: 'Programada', color: '#d97706', bg: '#fef3c7' };
    if (promo.ends_at && new Date(promo.ends_at) < now)
        return { label: 'Vencida',    color: '#dc2626', bg: '#fee2e2' };
    return { label: 'Activa',     color: '#059669', bg: '#d1fae5' };
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({ accent, icon: Icon, label, value, sub }) => (
    <div className="stat-card-a" style={{ '--sc-accent': accent }}>
        <div className="sca-icon"><Icon size={20} color={accent} /></div>
        <div className="sca-body">
            <span className="sca-label">{label}</span>
            <span className="sca-value">{value}</span>
            {sub && <span className="sca-sub">{sub}</span>}
        </div>
    </div>
);

// ── Dialog ────────────────────────────────────────────────────────────────────
const PLDialog = ({ dialog, onClose }) => {
    useEffect(() => {
        if (!dialog) return;
        const onKey = (e) => {
            if (e.key === 'Escape') { if (dialog.onCancel) dialog.onCancel(); else onClose?.(); }
            if (e.key === 'Enter' && dialog.mode === 'alert') dialog.onConfirm?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog, onClose]);

    if (!dialog) return null;
    const { mode, message, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel } = dialog;
    return (
        <div className="sh-dialog-overlay" onClick={onCancel || onClose}>
            <div className="sh-dialog" onClick={e => e.stopPropagation()}>
                <div className="sh-dialog-icon">
                    {confirmVariant === 'danger' ? '⚠️' : confirmVariant === 'success' ? '✅' : 'ℹ️'}
                </div>
                <p className="sh-dialog-message">{message}</p>
                <div className="sh-dialog-actions">
                    {mode === 'confirm' && onCancel && (
                        <button className="sh-dialog-btn sh-dialog-btn--cancel" onClick={onCancel}>Cancelar</button>
                    )}
                    <button className={`sh-dialog-btn sh-dialog-btn--${confirmVariant}`} onClick={onConfirm} autoFocus>
                        {confirmLabel || 'Aceptar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── PromotionList ─────────────────────────────────────────────────────────────
const PromotionList = () => {
    const { db }          = useDatabase();
    const { currentUser } = useAuth();

    const isAdmin = currentUser?.role === 'admin';

    const [promotions,    setPromotions]    = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [searchInput,   setSearchInput]   = useState('');
    const [searchTerm,    setSearchTerm]    = useState('');
    const [typeFilter,    setTypeFilter]    = useState('all');
    const [statusFilter,  setStatusFilter]  = useState('all');
    const [dialog,        setDialog]        = useState(null);
    const [showForm,      setShowForm]      = useState(false);
    const [editingPromo,  setEditingPromo]  = useState(null);
    const [detailPromo,   setDetailPromo]   = useState(null); // para el modal de detalle
    const [stats,         setStats]         = useState({ total: 0, active: 0, scheduled: 0, expired: 0 });

    const searchRef   = useRef(null);
    const debounceRef = useRef(null);

    const closeDialog = useCallback(() => {
        setDialog(null);
        searchRef.current?.focus();
    }, []);

    const showAlert = useCallback((message, variant = 'primary') => {
        setDialog({
            mode: 'alert', message, confirmVariant: variant, confirmLabel: 'Aceptar',
            onConfirm: () => { setDialog(null); searchRef.current?.focus(); },
        });
    }, []);

    const showConfirm = useCallback(({ message, confirmLabel, confirmVariant = 'danger', onConfirm }) => {
        setDialog({
            mode: 'confirm', message, confirmLabel, confirmVariant,
            onConfirm: () => { setDialog(null); onConfirm(); },
            onCancel:  () => { setDialog(null); searchRef.current?.focus(); },
        });
    }, []);

    useEffect(() => { loadPromotions(); }, []); // eslint-disable-line

    const loadPromotions = async () => {
        setLoading(true);
        try {
            const rows = await window.electronAPI.database.query(`
                SELECT
                    p.*,
                    pr.name  AS product_name,
                    cat.name AS category_name,
                    COUNT(DISTINCT sp.sale_id)            AS total_sales_applied,
                    COALESCE(SUM(sp.discount_applied), 0) AS total_discount_given
                FROM promotions p
                LEFT JOIN products    pr  ON p.product_id  = pr.id
                LEFT JOIN categories  cat ON p.category_id = cat.id
                LEFT JOIN sale_promotions sp ON p.id = sp.promotion_id
                GROUP BY p.id
                ORDER BY p.created_at DESC
            `);
            const list = Array.isArray(rows) ? rows : [];
            setPromotions(list);

            const now = new Date();
            let active = 0, scheduled = 0, expired = 0;
            for (const p of list) {
                if (!p.is_active) continue;
                if (p.starts_at && new Date(p.starts_at) > now) { scheduled++; continue; }
                if (p.ends_at   && new Date(p.ends_at)   < now) { expired++;   continue; }
                active++;
            }
            setStats({ total: list.length, active, scheduled, expired });
        } catch (err) {
            console.error('Error loading promotions:', err);
            showAlert('Error al cargar las promociones.', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchChange = (e) => {
        setSearchInput(e.target.value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setSearchTerm(e.target.value), 300);
    };

    // ── Filtros ───────────────────────────────────────────────────────────────
    const filtered = promotions.filter(p => {
        if (typeFilter !== 'all' && p.type !== typeFilter) return false;
        if (statusFilter !== 'all') {
            const status = getStatusInfo(p);
            if (statusFilter === 'active'    && status.label !== 'Activa')     return false;
            if (statusFilter === 'inactive'  && status.label !== 'Inactiva')   return false;
            if (statusFilter === 'scheduled' && status.label !== 'Programada') return false;
            if (statusFilter === 'expired'   && status.label !== 'Vencida')    return false;
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            if (!(p.name || '').toLowerCase().includes(q) &&
                !(p.description || '').toLowerCase().includes(q) &&
                !(p.product_name || '').toLowerCase().includes(q) &&
                !(p.category_name || '').toLowerCase().includes(q)) return false;
        }
        return true;
    });

    // ── Acciones (solo admin) ─────────────────────────────────────────────────
    const handleToggleActive = (promo) => {
        if (!isAdmin) return;
        const newValue = promo.is_active ? 0 : 1;
        showConfirm({
            message:        `¿Deseas ${newValue ? 'activar' : 'desactivar'} la promoción "${promo.name}"?`,
            confirmLabel:   newValue ? 'Sí, activar' : 'Sí, desactivar',
            confirmVariant: newValue ? 'success' : 'danger',
            onConfirm: async () => {
                try {
                    await window.electronAPI.database.run(
                        `UPDATE promotions SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [newValue, promo.id]
                    );
                    await loadPromotions();
                    showAlert(`Promoción ${newValue ? 'activada' : 'desactivada'} correctamente.`, 'success');
                } catch (err) {
                    showAlert(`Error al actualizar: ${err.message}`, 'danger');
                }
            },
        });
    };

    const handleDelete = (promo) => {
        if (!isAdmin) return;
        showConfirm({
            message:        `¿Eliminar la promoción "${promo.name}"?\n\nEsta acción no se puede deshacer.`,
            confirmLabel:   'Sí, eliminar',
            confirmVariant: 'danger',
            onConfirm: async () => {
                try {
                    await window.electronAPI.database.run(`DELETE FROM promotions WHERE id = ?`, [promo.id]);
                    await loadPromotions();
                    showAlert('Promoción eliminada correctamente.', 'success');
                } catch (err) {
                    showAlert(`Error al eliminar: ${err.message}`, 'danger');
                }
            },
        });
    };

    const handleEdit = (promo) => {
        if (!isAdmin) return;
        setEditingPromo(promo);
        setShowForm(true);
    };

    const handleNew = () => {
        if (!isAdmin) return;
        setEditingPromo(null);
        setShowForm(true);
    };

    const handleFormSaved = async () => {
        setShowForm(false);
        setEditingPromo(null);
        await loadPromotions();
        showAlert(
            editingPromo ? 'Promoción actualizada correctamente.' : 'Promoción creada correctamente.',
            'success'
        );
    };

    // ── Render de fila ────────────────────────────────────────────────────────
    const renderPromoRow = (promo) => {
        const typeInfo   = TYPE_LABELS[promo.type] || { label: promo.type, color: '#6b7280', bg: '#f3f4f6', icon: FiTag };
        const statusInfo = getStatusInfo(promo);
        const TypeIcon   = typeInfo.icon;
        const discLabel  = DISC_LABELS[promo.discount_type]?.(promo.discount_value) || '';

        let targetDesc = '';
        if (promo.type === 'product_discount')  targetDesc = promo.product_name  || '—';
        else if (promo.type === 'category_discount') targetDesc = promo.category_name || '—';
        else if (promo.type === 'minimum_amount')    targetDesc = `≥ ${formatCurrency(promo.minimum_purchase_amount)}`;
        else if (promo.type === 'pack_quantity')
            targetDesc = `Lleva ${promo.pack_buy_quantity} paga ${promo.pack_pay_quantity}`;

        return (
            <tr key={promo.id} className={!promo.is_active ? 'promo-row--inactive' : ''}>
                <td>
                    <div className="promo-name-cell">
                        <div className="promo-type-badge" style={{ background: typeInfo.bg, color: typeInfo.color }}>
                            <TypeIcon size={11} /> {typeInfo.label}
                        </div>
                        <span className="promo-name">{promo.name}</span>
                        {promo.description && <span className="promo-desc">{promo.description}</span>}
                    </div>
                </td>
                <td>
                    <span className="promo-target-name">{targetDesc}</span>
                </td>
                <td>
                    <span className="promo-discount-badge">{discLabel}</span>
                </td>
                <td>
                    <div className="promo-dates-cell">
                        {promo.starts_at || promo.ends_at ? (
                            <>
                                {promo.starts_at && <span className="promo-date">Desde {formatDate(promo.starts_at)}</span>}
                                {promo.ends_at   && <span className="promo-date">Hasta {formatDate(promo.ends_at)}</span>}
                            </>
                        ) : (
                            <span className="promo-date promo-date--always">Sin límite</span>
                        )}
                    </div>
                </td>
                <td>
                    <div className="promo-usage-cell">
                        <span className="promo-usage-count">{promo.total_sales_applied || 0} ventas</span>
                        {promo.total_discount_given > 0 && (
                            <span className="promo-usage-amount">{formatCurrency(promo.total_discount_given)}</span>
                        )}
                    </div>
                </td>
                <td>
                    <span className="promo-status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                    </span>
                </td>
                <td>
                    <div className="action-buttons-compact">
                        {/* Ver detalle — todos los roles */}
                        <button
                            className="action-btn-compact view"
                            onClick={() => setDetailPromo(promo)}
                            title="Ver detalle"
                        >
                            <FiEye size={14} />
                        </button>

                        {/* Acciones solo admin */}
                        {isAdmin && (
                            <>
                                <button
                                    className={`action-btn-compact ${promo.is_active ? 'promo-deactivate' : 'promo-activate'}`}
                                    onClick={() => handleToggleActive(promo)}
                                    title={promo.is_active ? 'Desactivar' : 'Activar'}
                                >
                                    {promo.is_active ? <FiToggleRight size={15} /> : <FiToggleLeft size={15} />}
                                </button>
                                <button
                                    className="action-btn-compact edit"
                                    onClick={() => handleEdit(promo)}
                                    title="Editar"
                                >
                                    <FiEdit2 size={14} />
                                </button>
                                <button
                                    className="action-btn-compact cancel"
                                    onClick={() => handleDelete(promo)}
                                    title="Eliminar"
                                >
                                    <FiTrash2 size={14} />
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="main-content-scrollable">
            <div className="promo-list">

                {/* Header */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Promociones</h1>
                        <p className="page-subtitle">Crea y gestiona descuentos automáticos para el punto de venta</p>
                    </div>
                    <div className="header-actions">
                        <button className="rp-refresh" onClick={loadPromotions} disabled={loading}>
                            <FiRefreshCw className={loading ? 'spin' : ''} />
                            Actualizar
                        </button>
                        {isAdmin && (
                            <button className="promo-new-btn" onClick={handleNew}>
                                <FiPlus size={16} /> Nueva Promoción
                            </button>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="sales-stats-grid">
                    <StatCard accent="#2563eb" icon={FiTag}        label="Total"       value={stats.total}     sub="Registradas" />
                    <StatCard accent="#059669" icon={FiPercent}    label="Activas"     value={stats.active}    sub="Aplicando ahora" />
                    <StatCard accent="#d97706" icon={FiFilter}     label="Programadas" value={stats.scheduled} sub="Pendientes de inicio" />
                    <StatCard accent="#dc2626" icon={FiAlertCircle} label="Vencidas"   value={stats.expired}   sub="Fuera de fecha" />
                </div>

                {/* Filtros */}
                <div className="promo-filters-card">
                    <div className="promo-filters-row">
                        <div className="filter-group-sales">
                            <label>Búsqueda</label>
                            <div className="search-input-group">
                                <FiSearch />
                                <input ref={searchRef} type="text"
                                    placeholder="Nombre, producto, categoría..."
                                    value={searchInput} onChange={handleSearchChange} />
                            </div>
                        </div>
                        <div className="filter-group-sales">
                            <label>Tipo</label>
                            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                                <option value="all">Todos los tipos</option>
                                <option value="product_discount">Producto</option>
                                <option value="category_discount">Categoría</option>
                                <option value="pack_fixed">Pack fijo</option>
                                <option value="pack_quantity">Pack cantidad</option>
                                <option value="minimum_amount">Monto mínimo</option>
                            </select>
                        </div>
                        <div className="filter-group-sales">
                            <label>Estado</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="all">Todos</option>
                                <option value="active">Activas</option>
                                <option value="inactive">Inactivas</option>
                                <option value="scheduled">Programadas</option>
                                <option value="expired">Vencidas</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tabla */}
                <div className="promo-table-card">
                    {loading ? (
                        <div className="loading-container">
                            <div className="spinner" />
                            <p>Cargando promociones...</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="empty-state">
                            <FiTag size={48} />
                            <p>{promotions.length === 0 ? 'No hay promociones creadas' : 'Sin resultados'}</p>
                            {promotions.length === 0 && isAdmin && (
                                <span>Crea tu primera promoción haciendo click en "Nueva Promoción"</span>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="sh-results-bar">
                                <span className="sh-results-count">
                                    {filtered.length === 1 ? '1 promoción' : `${filtered.length} promociones`}
                                </span>
                            </div>
                            <table className="promo-table">
                                <thead>
                                    <tr>
                                        <th>Nombre / Tipo</th>
                                        <th>Aplica a</th>
                                        <th>Descuento</th>
                                        <th>Vigencia</th>
                                        <th>Uso</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>{filtered.map(renderPromoRow)}</tbody>
                            </table>
                        </>
                    )}
                </div>

            </div>

            {/* Modal formulario (admin) */}
            {showForm && (
                <PromotionFormModal
                    db={db}
                    promotion={editingPromo}
                    onSaved={handleFormSaved}
                    onClose={() => { setShowForm(false); setEditingPromo(null); searchRef.current?.focus(); }}
                />
            )}

            {/* Modal detalle (todos los roles) */}
            {detailPromo && (
                <PromotionDetailModal
                    promotion={detailPromo}
                    onClose={() => { setDetailPromo(null); searchRef.current?.focus(); }}
                />
            )}

            <PLDialog dialog={dialog} onClose={closeDialog} />
        </div>
    );
};

export default PromotionList;