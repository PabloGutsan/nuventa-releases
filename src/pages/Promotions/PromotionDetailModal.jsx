// src/pages/Promotions/PromotionDetailModal.jsx
import React, { useState, useEffect } from 'react';
import {
    FiX, FiTag, FiPackage, FiFilter, FiShoppingCart, FiLayers,
    FiCalendar, FiPercent, FiBarChart2, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi';
import './PromotionDetailModal.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

const formatDate = (dt) => {
    if (!dt) return null;
    return new Date(dt).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TYPE_INFO = {
    product_discount:  { label: 'Producto',      icon: FiTag,          color: '#6ee7b7', bg: 'rgba(16,185,129,0.2)' },
    category_discount: { label: 'Categoría',     icon: FiFilter,       color: '#c4b5fd', bg: 'rgba(139,92,246,0.2)' },
    pack_fixed:        { label: 'Pack fijo',      icon: FiPackage,      color: '#67e8f9', bg: 'rgba(8,145,178,0.2)' },
    pack_quantity:     { label: 'Pack cantidad',  icon: FiLayers,       color: '#67e8f9', bg: 'rgba(8,145,178,0.2)' },
    minimum_amount:    { label: 'Monto mínimo',   icon: FiShoppingCart, color: '#fcd34d', bg: 'rgba(217,119,6,0.2)' },
};

// Para las cards del body (sobre fondo claro)
const TYPE_INFO_LIGHT = {
    product_discount:  { color: '#2563eb', bg: '#dbeafe' },
    category_discount: { color: '#7c3aed', bg: '#ede9fe' },
    pack_fixed:        { color: '#0891b2', bg: '#cffafe' },
    pack_quantity:     { color: '#0891b2', bg: '#cffafe' },
    minimum_amount:    { color: '#d97706', bg: '#fef3c7' },
};

const getStatusInfo = (promo) => {
    if (!promo.is_active) return { label: 'Inactiva',   color: '#6ee7b7', bg: 'rgba(107,114,128,0.2)' };
    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now)
        return { label: 'Programada', color: '#fcd34d', bg: 'rgba(217,119,6,0.2)' };
    if (promo.ends_at && new Date(promo.ends_at) < now)
        return { label: 'Vencida',    color: '#fca5a5', bg: 'rgba(239,68,68,0.2)' };
    return { label: 'Activa', color: '#6ee7b7', bg: 'rgba(16,185,129,0.2)' };
};

// ── PromotionDetailModal ──────────────────────────────────────────────────────
const PromotionDetailModal = ({ promotion, onClose }) => {
    const [packProducts, setPackProducts] = useState([]);
    const [loading,      setLoading]      = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []); // eslint-disable-line

    useEffect(() => {
        if (promotion?.type === 'pack_fixed' || promotion?.type === 'pack_quantity') {
            loadPackProducts();
        }
    }, [promotion]); // eslint-disable-line

    const loadPackProducts = async () => {
        setLoading(true);
        try {
            const items = await window.electronAPI.database.query(
                `SELECT pp.product_id, pp.quantity, p.name, p.sale_price, p.cost_price, p.sku
                 FROM promotion_products pp
                 JOIN products p ON pp.product_id = p.id
                 WHERE pp.promotion_id = ? ORDER BY pp.id ASC`,
                [promotion.id]
            );
            setPackProducts(Array.isArray(items) ? items : []);
        } catch (err) {
            console.error('Error cargando productos del pack:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        document.body.style.overflow = '';
        onClose();
    };

    if (!promotion) return null;

    const typeInfo      = TYPE_INFO[promotion.type]       || TYPE_INFO.product_discount;
    const typeInfoLight = TYPE_INFO_LIGHT[promotion.type] || TYPE_INFO_LIGHT.product_discount;
    const statusInfo    = getStatusInfo(promotion);
    const TypeIcon      = typeInfo.icon;

    const discountDesc = () => {
        const val = parseFloat(promotion.discount_value) || 0;
        if (promotion.type === 'pack_fixed') return `Precio especial: ${fmt(val)}`;
        if (promotion.discount_type === 'percentage')  return `${val}% de descuento`;
        if (promotion.discount_type === 'fixed')       return `${fmt(val)} de descuento fijo`;
        if (promotion.discount_type === 'fixed_price') return `Precio especial: ${fmt(val)}`;
        return '—';
    };

    const packTotal = packProducts.reduce(
        (s, p) => s + (parseFloat(p.sale_price) || 0) * (p.quantity || 1), 0
    );

    return (
        <div className="pdm-overlay" onClick={handleClose}>
            <div className="pdm-panel" onClick={e => e.stopPropagation()}>

                {/* ── Header — gradiente oscuro igual que SaleDetailModal ── */}
                <div className="pdm-header">
                    <div className="pdm-header-left">
                        <div className="pdm-avatar">
                            <TypeIcon size={22} />
                        </div>
                        <div>
                            <h2 className="pdm-title">Detalle de Promoción</h2>
                            <p className="pdm-subtitle">{promotion.name}</p>
                        </div>
                    </div>
                    <div className="pdm-header-actions">
                        {/* Badge estado */}
                        <span className="pdm-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                            {statusInfo.label === 'Activa'
                                ? '✓ Activa'
                                : statusInfo.label === 'Inactiva'
                                ? '✗ Inactiva'
                                : statusInfo.label}
                        </span>
                        {/* Badge tipo */}
                        <span className="pdm-badge" style={{ background: typeInfo.bg, color: typeInfo.color }}>
                            {typeInfo.label}
                        </span>
                        <button className="pdm-btn-close" onClick={handleClose} title="Cerrar (ESC)">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="pdm-body">

                    {/* Descripción opcional */}
                    {promotion.description && (
                        <div className="pdm-desc-banner">
                            {promotion.description}
                        </div>
                    )}

                    {/* Grid 3 columnas: Configuración | Objetivo | Vigencia */}
                    <div className="pdm-info-grid">

                        {/* Configuración */}
                        <div className="pdm-card">
                            <div className="pdm-card-title">
                                <FiPercent size={13} /> Configuración
                            </div>
                            <div className="pdm-rows">
                                <div className="pdm-row">
                                    <span className="pdm-label">Tipo</span>
                                    <span className="pdm-value">
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                                            padding: '2px 8px', borderRadius: '10px',
                                            background: typeInfoLight.bg, color: typeInfoLight.color,
                                            fontSize: '12px', fontWeight: 600,
                                        }}>
                                            {typeInfo.label}
                                        </span>
                                    </span>
                                </div>
                                <div className="pdm-row">
                                    <span className="pdm-label">Descuento</span>
                                    <span className="pdm-value pdm-value--highlight">{discountDesc()}</span>
                                </div>
                                <div className="pdm-row">
                                    <span className="pdm-label">Estado</span>
                                    <span className="pdm-value">
                                        {promotion.is_active
                                            ? <span style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <FiToggleRight size={14} /> Activa
                                              </span>
                                            : <span style={{ color: '#6b7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <FiToggleLeft size={14} /> Inactiva
                                              </span>
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Aplica a */}
                        <div className="pdm-card">
                            <div className="pdm-card-title">
                                <FiTag size={13} /> Aplica a
                            </div>
                            <div className="pdm-rows">
                                {promotion.type === 'product_discount' && (
                                    <div className="pdm-row">
                                        <span className="pdm-label">Producto</span>
                                        <span className="pdm-value">{promotion.product_name || '—'}</span>
                                    </div>
                                )}
                                {promotion.type === 'category_discount' && (
                                    <div className="pdm-row">
                                        <span className="pdm-label">Categoría</span>
                                        <span className="pdm-value">{promotion.category_name || '—'}</span>
                                    </div>
                                )}
                                {promotion.type === 'minimum_amount' && (
                                    <>
                                        <div className="pdm-row">
                                            <span className="pdm-label">Monto mínimo</span>
                                            <span className="pdm-value pdm-value--highlight">
                                                {fmt(promotion.minimum_purchase_amount)}
                                            </span>
                                        </div>
                                        <div className="pdm-row">
                                            <span className="pdm-label">Alcance</span>
                                            <span className="pdm-value">Toda la venta</span>
                                        </div>
                                    </>
                                )}
                                {promotion.type === 'pack_quantity' && (
                                    <>
                                        <div className="pdm-row">
                                            <span className="pdm-label">Lleva</span>
                                            <span className="pdm-value">{promotion.pack_buy_quantity} unidades</span>
                                        </div>
                                        <div className="pdm-row">
                                            <span className="pdm-label">Paga</span>
                                            <span className="pdm-value">{promotion.pack_pay_quantity} unidades</span>
                                        </div>
                                        <div className="pdm-row">
                                            <span className="pdm-label">Gratis</span>
                                            <span className="pdm-value pdm-value--highlight">
                                                {parseInt(promotion.pack_buy_quantity) - parseInt(promotion.pack_pay_quantity)} unidades
                                            </span>
                                        </div>
                                        {promotion.pack_quantity_source === 'category' && (
                                            <div className="pdm-row">
                                                <span className="pdm-label">Categoría</span>
                                                <span className="pdm-value">{promotion.category_name || '—'}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                                {promotion.type === 'pack_fixed' && packTotal > 0 && (
                                    <div className="pdm-row">
                                        <span className="pdm-label">Precio normal</span>
                                        <span className="pdm-value">{fmt(packTotal)}</span>
                                    </div>
                                )}
                                {(promotion.type === 'pack_fixed' || promotion.type === 'pack_quantity') && (
                                    <div className="pdm-row">
                                        <span className="pdm-label">Productos</span>
                                        <span className="pdm-value">
                                            {loading ? 'Cargando...' : `${packProducts.length} ítem${packProducts.length !== 1 ? 's' : ''}`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Vigencia */}
                        <div className="pdm-card">
                            <div className="pdm-card-title">
                                <FiCalendar size={13} /> Vigencia
                            </div>
                            <div className="pdm-rows">
                                <div className="pdm-row">
                                    <span className="pdm-label">Inicio</span>
                                    <span className="pdm-value">
                                        {promotion.starts_at ? formatDate(promotion.starts_at) : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin límite</span>}
                                    </span>
                                </div>
                                <div className="pdm-row">
                                    <span className="pdm-label">Fin</span>
                                    <span className="pdm-value">
                                        {promotion.ends_at ? formatDate(promotion.ends_at) : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Sin límite</span>}
                                    </span>
                                </div>
                                {!promotion.starts_at && !promotion.ends_at && (
                                    <div className="pdm-row">
                                        <span className="pdm-label">Duración</span>
                                        <span className="pdm-value" style={{ color: '#059669' }}>Permanente</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabla productos del pack */}
                    {(promotion.type === 'pack_fixed' || promotion.type === 'pack_quantity') && (
                        <div className="pdm-card pdm-card--full">
                            <div className="pdm-card-title">
                                <FiPackage size={13} /> Productos del pack
                            </div>
                            {loading ? (
                                <p className="pdm-empty-note" style={{ padding: '12px 0' }}>Cargando productos...</p>
                            ) : packProducts.length === 0 ? (
                                <p className="pdm-empty-note" style={{ padding: '12px 0' }}>Sin productos registrados</p>
                            ) : (
                                <div className="pdm-table-wrap">
                                    <table className="pdm-table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>SKU</th>
                                                <th style={{ textAlign: 'center' }}>Cant.</th>
                                                <th style={{ textAlign: 'right' }}>Precio unit.</th>
                                                <th style={{ textAlign: 'right' }}>Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {packProducts.map((p, i) => (
                                                <tr key={i}>
                                                    <td><span className="pdm-item-name">{p.name}</span></td>
                                                    <td><span className="pdm-item-sku">{p.sku || '—'}</span></td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className="pdm-qty">{p.quantity}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(p.sale_price)}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <strong>{fmt((parseFloat(p.sale_price) || 0) * (p.quantity || 1))}</strong>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {promotion.type === 'pack_fixed' && (
                                            <tfoot>
                                                <tr className="pdm-table-total">
                                                    <td colSpan={4}>Precio normal del pack</td>
                                                    <td style={{ textAlign: 'right' }}>{fmt(packTotal)}</td>
                                                </tr>
                                                {parseFloat(promotion.discount_value) > 0 && (
                                                    <tr className="pdm-table-saving">
                                                        <td colSpan={4}>Precio especial del pack</td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {fmt(promotion.discount_value)}
                                                            <span className="pdm-saving-tag">
                                                                ahorra {fmt(packTotal - parseFloat(promotion.discount_value))}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Estadísticas de uso */}
                    {((promotion.total_sales_applied || 0) > 0 || (promotion.total_discount_given || 0) > 0) && (
                        <div className="pdm-card pdm-card--full">
                            <div className="pdm-card-title">
                                <FiBarChart2 size={13} /> Uso de la promoción
                            </div>
                            <div className="pdm-stats-row">
                                <div className="pdm-stats-item">
                                    <span>Ventas donde se aplicó</span>
                                    <span><strong>{promotion.total_sales_applied || 0}</strong> ventas</span>
                                </div>
                                {(promotion.total_discount_given || 0) > 0 && (
                                    <>
                                        <div className="pdm-stats-item">
                                            <span>Total descuentos entregados</span>
                                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                                −{fmt(promotion.total_discount_given)}
                                            </span>
                                        </div>
                                        <div className="pdm-stats-item pdm-stats-item--highlight">
                                            <span>Descuento promedio por venta</span>
                                            <span>
                                                {fmt(promotion.total_discount_given / (promotion.total_sales_applied || 1))}
                                            </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default PromotionDetailModal;