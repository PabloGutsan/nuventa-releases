import React, { useState, useEffect } from 'react';
import {
    FiX, FiEdit2, FiPackage, FiTag, FiDollarSign,
    FiBarChart2, FiTruck, FiFileText, FiAlertTriangle,
} from 'react-icons/fi';
import './ProductDetailModal.css';

const ProductDetailModal = ({ product, onClose, onEdit }) => {
    const [supplier,        setSupplier]        = useState(null);
    const [loadingSupplier, setLoadingSupplier] = useState(true);

    // Bloquear scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // ESC para cerrar
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Cargar proveedor preferido
    useEffect(() => {
        if (product?.id) loadSupplier();
    }, [product?.id]); // eslint-disable-line

    const loadSupplier = async () => {
        setLoadingSupplier(true);
        try {
            const rows = await window.electronAPI.database.query(`
                SELECT s.id, s.business_name, s.contact_name, s.phone, s.email,
                       ps.supplier_sku, ps.is_preferred
                FROM suppliers s
                INNER JOIN product_suppliers ps ON s.id = ps.supplier_id
                WHERE ps.product_id = ? AND ps.is_preferred = 1
                LIMIT 1
            `, [product.id]);
            setSupplier(Array.isArray(rows) && rows.length > 0 ? rows[0] : null);
        } catch (err) {
            console.error('Error cargando proveedor:', err);
            setSupplier(null);
        } finally {
            setLoadingSupplier(false);
        }
    };

    if (!product) return null;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fmt = (v) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

    const fmtStock = (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return '0';
        return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
    };

    const profitAmount = (parseFloat(product.sale_price) || 0) - (parseFloat(product.cost_price) || 0);
    const profitPct    = (() => {
        const cost = parseFloat(product.cost_price) || 0;
        if (cost === 0) return '0';
        return ((profitAmount / cost) * 100).toLocaleString('es-CL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    })();

    const getStockStatus = () => {
        if (product.type === 'service') return null;
        if (product.unlimited_stock)    return { label: 'Siempre disponible', cls: 'sdm-stock-unlimited' };
        const stock = parseFloat(product.stock)     || 0;
        const min   = parseFloat(product.min_stock) || 0;
        if (stock <= 0)        return { label: 'Sin stock',  cls: 'sdm-stock-empty' };
        if (stock <= min)      return { label: 'Stock bajo', cls: 'sdm-stock-low'   };
        return { label: 'OK', cls: 'sdm-stock-ok' };
    };

    const stockStatus = getStockStatus();
    const isService   = product.type === 'service';

    // Abreviación para usar junto al stock ("1,5 L")
    const unitLabel   = product.unit_label || product.unit || 'un';

    // Nombre completo para mostrar en la ficha ("Litros", "Kilogramos", etc.)
    const UNIT_NAMES = {
        'L':   'Litros',
        'ml':  'Mililitros',
        'kg':  'Kilogramos',
        'g':   'Gramos',
        'm':   'Metros',
        'cm':  'Centímetros',
        'un':  'Unidad',
        'pza': 'Pieza',
        'cja': 'Caja',
        'par': 'Par',
    };
    const unitName = UNIT_NAMES[unitLabel] || unitLabel;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="sdm-overlay" onClick={onClose}>
            <div className="sdm-panel" onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="sdm-header">
                    <div className="sdm-header-left">
                        <div className="sdm-avatar">
                            {product.image_path
                                ? <img src={product.image_path} alt={product.name} />
                                : <FiPackage size={22} />}
                        </div>
                        <div>
                            <h2 className="sdm-title">{product.name}</h2>
                            <div className="sdm-header-meta">
                                {product.category_name && (
                                    <span className="sdm-subtitle">{product.category_name}</span>
                                )}
                                <span className={`sdm-type-badge ${isService ? 'service' : 'product'}`}>
                                    {isService ? 'Servicio' : 'Producto'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="sdm-header-actions">
                        <span className={`sdm-badge ${product.is_active ? 'badge-active' : 'badge-inactive'}`}>
                            {product.is_active ? '✓ Activo' : '✗ Inactivo'}
                        </span>
                        <button className="sdm-btn-action" onClick={() => { onClose(); onEdit(product); }}>
                            <FiEdit2 size={15} /> Editar
                        </button>
                        <button className="sdm-btn-close" onClick={onClose} title="Cerrar (ESC)">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="sdm-body">

                    {/* ── Fila 1: Identificación | Precios | Stock ── */}
                    <div className="sdm-info-grid">

                        {/* Identificación */}
                        <div className="sdm-card">
                            <div className="sdm-card-title"><FiTag size={13} /> Identificación</div>
                            <div className="sdm-rows">
                                <div className="sdm-row">
                                    <span className="sdm-label">SKU</span>
                                    <span className="sdm-value sdm-mono">{product.sku || '—'}</span>
                                </div>
                                <div className="sdm-row">
                                    <span className="sdm-label">Código de barras</span>
                                    <span className="sdm-value sdm-mono">{product.barcode || '—'}</span>
                                </div>
                                <div className="sdm-row">
                                    <span className="sdm-label">Categoría</span>
                                    <span className="sdm-value">{product.category_name || '—'}</span>
                                </div>
                                <div className="sdm-row">
                                    <span className="sdm-label">Unidad</span>
                                    <span className="sdm-value">{unitName}</span>
                                </div>
                                <div className="sdm-row">
                                    <span className="sdm-label">Tipo de medida</span>
                                    <span className="sdm-value">{product.unit_type || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Precios */}
                        <div className="sdm-card">
                            <div className="sdm-card-title"><FiDollarSign size={13} /> Precios</div>
                            <div className="sdm-rows">
                                <div className="sdm-row">
                                    <span className="sdm-label">Precio costo</span>
                                    <span className="sdm-value">{fmt(product.cost_price)}</span>
                                </div>
                                <div className="sdm-row">
                                    <span className="sdm-label">Precio venta</span>
                                    <span className="sdm-value sdm-price-sale">{fmt(product.sale_price)}</span>
                                </div>
                                <div className="sdm-row">
                                    <span className="sdm-label">Ganancia</span>
                                    <span className={`sdm-value ${profitAmount >= 0 ? 'sdm-profit-pos' : 'sdm-profit-neg'}`}>
                                        {fmt(profitAmount)}
                                    </span>
                                </div>
                                <div className="sdm-row">
                                    <span className="sdm-label">Margen</span>
                                    <span className={`sdm-value ${profitAmount >= 0 ? 'sdm-profit-pos' : 'sdm-profit-neg'}`}>
                                        {profitPct}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Stock */}
                        <div className="sdm-card">
                            <div className="sdm-card-title"><FiBarChart2 size={13} /> Stock</div>
                            {isService ? (
                                <p className="sdm-empty-note">Los servicios no tienen control de stock.</p>
                            ) : product.unlimited_stock ? (
                                <div className="sdm-rows">
                                    <div className="sdm-row">
                                        <span className="sdm-label">Estado</span>
                                        <span className="sdm-stock-badge sdm-stock-unlimited">Siempre disponible</span>
                                    </div>
                                    <div className="sdm-alert sdm-alert--blue">
                                        <FiAlertTriangle size={13} />
                                        <span>El stock no se controla ni descuenta al vender</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="sdm-rows">
                                    <div className="sdm-row">
                                        <span className="sdm-label">Stock actual</span>
                                        <span className="sdm-value">{fmtStock(product.stock)} {unitLabel}</span>
                                    </div>
                                    <div className="sdm-row">
                                        <span className="sdm-label">Stock mínimo</span>
                                        <span className="sdm-value">{fmtStock(product.min_stock)} {unitLabel}</span>
                                    </div>
                                    <div className="sdm-row">
                                        <span className="sdm-label">Estado</span>
                                        <span className={`sdm-stock-badge ${stockStatus?.cls}`}>
                                            {stockStatus?.label}
                                        </span>
                                    </div>
                                    {stockStatus?.cls === 'sdm-stock-low' && (
                                        <div className="sdm-alert">
                                            <FiAlertTriangle size={13} />
                                            <span>Stock por debajo del mínimo</span>
                                        </div>
                                    )}
                                    {stockStatus?.cls === 'sdm-stock-empty' && (
                                        <div className="sdm-alert sdm-alert--red">
                                            <FiAlertTriangle size={13} />
                                            <span>Producto sin stock disponible</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Descripción ── */}
                    <div className="sdm-card sdm-card--full">
                        <div className="sdm-card-title"><FiFileText size={13} /> Descripción</div>
                        {product.description?.trim() ? (
                            <p className="sdm-text">{product.description}</p>
                        ) : (
                            <p className="sdm-empty-note">Sin descripción registrada.</p>
                        )}
                    </div>

                    {/* ── Proveedor principal ── */}
                    <div className="sdm-card sdm-card--full">
                        <div className="sdm-card-title"><FiTruck size={13} /> Proveedor principal</div>

                        {loadingSupplier ? (
                            <div className="sdm-loading">
                                <div className="sdm-spinner" />
                                <span>Cargando proveedor...</span>
                            </div>
                        ) : supplier ? (
                            <div className="sdm-supplier-row">
                                <div className="sdm-supplier-avatar">
                                    {supplier.business_name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="sdm-supplier-info">
                                    <span className="sdm-supplier-name">{supplier.business_name}</span>
                                    <div className="sdm-supplier-details">
                                        {supplier.contact_name && <span>{supplier.contact_name}</span>}
                                        {supplier.phone        && <span>{supplier.phone}</span>}
                                        {supplier.email        && <span>{supplier.email}</span>}
                                        {supplier.supplier_sku && (
                                            <span className="sdm-supplier-sku">
                                                SKU proveedor: <strong>{supplier.supplier_sku}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="sdm-empty-note">
                                Sin proveedor asociado. Puedes asignarlo editando el producto.
                            </p>
                        )}
                    </div>

                </div>{/* end body */}
            </div>{/* end panel */}
        </div>
    );
};

export default ProductDetailModal;