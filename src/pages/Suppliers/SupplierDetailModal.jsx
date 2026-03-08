import React, { useState, useEffect } from 'react';
import { FiX, FiEdit2, FiPackage, FiPhone, FiMapPin, FiFileText, FiDollarSign } from 'react-icons/fi';
import './SupplierDetailModal.css';

const SupplierDetailModal = ({ supplier, onClose, onEdit }) => {
    const [products,        setProducts]        = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    useEffect(() => {
        if (supplier?.id) loadProducts();
    }, [supplier?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadProducts = async () => {
        setLoadingProducts(true);
        try {
            const result = await window.electronAPI.database.query(`
                SELECT
                    p.id, p.name, p.sku, p.sale_price, p.cost_price,
                    p.stock, p.min_stock, p.is_active, p.unlimited_stock,
                    p.unit_label, p.unit_type,
                    ps.supplier_sku, ps.is_preferred,
                    c.name as category_name
                FROM products p
                INNER JOIN product_suppliers ps ON p.id = ps.product_id
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE ps.supplier_id = ?
                ORDER BY p.name ASC
            `, [supplier.id]);
            setProducts(Array.isArray(result) ? result : []);
        } catch (err) {
            console.error('Error cargando productos del proveedor:', err);
            setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    };

    const formatCurrency = (val) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val || 0);

    // Formatea stock con separadores chilenos: punto miles, coma decimal
    const fmtStock = (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return '0';
        return n.toLocaleString('es-CL', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3,
        });
    };

    // Nombres completos de unidades para mostrar en la tabla
    const UNIT_NAMES = {
        'L':   'L',       // Litros — abreviado en tabla para no ocupar espacio
        'ml':  'ml',
        'kg':  'kg',
        'g':   'g',
        'm':   'm',
        'cm':  'cm',
        'un':  'un',
        'pza': 'pza',
        'cja': 'cja',
        'par': 'par',
    };

    const getUnitLabel = (p) => {
        const label = p.unit_label || p.unit || '';
        return UNIT_NAMES[label] || label || 'un';
    };

    const getStockStatus = (p) => {
        if (p.unlimited_stock) return { label: 'Siempre disponible', cls: 'stock-unlimited', showQty: false };
        const stock = parseFloat(p.stock) || 0;
        const min   = parseFloat(p.min_stock) || 0;
        if (stock <= 0)    return { label: 'Sin stock',  cls: 'stock-empty', showQty: true };
        if (stock <= min)  return { label: 'Stock bajo', cls: 'stock-low',   showQty: true };
        return               { label: 'OK',          cls: 'stock-ok',    showQty: true };
    };

    if (!supplier) return null;

    return (
        <div className="sdm-overlay" onClick={onClose}>
            <div className="sdm-panel" onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="sdm-header">
                    <div className="sdm-header-left">
                        <div className="sdm-avatar">
                            {supplier.business_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="sdm-title">{supplier.business_name}</h2>
                            {supplier.legal_name && (
                                <p className="sdm-subtitle">{supplier.legal_name}</p>
                            )}
                        </div>
                    </div>
                    <div className="sdm-header-actions">
                        <span className={`sdm-badge ${supplier.is_active ? 'badge-active' : 'badge-inactive'}`}>
                            {supplier.is_active ? '✓ Activo' : '✗ Inactivo'}
                        </span>
                        <button className="sdm-btn-edit" onClick={() => { onClose(); onEdit(supplier); }}>
                            <FiEdit2 size={15} /> Editar
                        </button>
                        <button className="sdm-btn-close" onClick={onClose} title="Cerrar (ESC)">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                <div className="sdm-body">

                    {/* ── Fila 1: Contacto | Dirección | Condiciones ── */}
                    <div className="sdm-info-grid">

                        {/* Contacto */}
                        <div className="sdm-info-card">
                            <div className="sdm-info-card-title"><FiPhone size={14} /> Contacto</div>
                            <div className="sdm-info-rows">
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Nombre contacto</span>
                                    <span className="sdm-info-value">{supplier.contact_name || '—'}</span>
                                </div>
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Teléfono</span>
                                    <span className="sdm-info-value">{supplier.phone || '—'}</span>
                                </div>
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Email</span>
                                    <span className="sdm-info-value">{supplier.email || '—'}</span>
                                </div>
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">RUT</span>
                                    <span className="sdm-info-value">{supplier.rut || '—'}</span>
                                </div>
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Giro / Industria</span>
                                    <span className="sdm-info-value">{supplier.industry || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Dirección */}
                        <div className="sdm-info-card">
                            <div className="sdm-info-card-title"><FiMapPin size={14} /> Dirección</div>
                            <div className="sdm-info-rows">
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Dirección</span>
                                    <span className="sdm-info-value">{supplier.address || '—'}</span>
                                </div>
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Ciudad</span>
                                    <span className="sdm-info-value">{supplier.city || '—'}</span>
                                </div>
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Región</span>
                                    <span className="sdm-info-value">{supplier.region || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Condiciones comerciales */}
                        <div className="sdm-info-card">
                            <div className="sdm-info-card-title"><FiDollarSign size={14} /> Condiciones</div>
                            <div className="sdm-info-rows">
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Condiciones de pago</span>
                                    <span className="sdm-info-value">{supplier.payment_terms || '—'}</span>
                                </div>
                                <div className="sdm-info-row">
                                    <span className="sdm-info-label">Días de crédito</span>
                                    <span className="sdm-info-value">
                                        {supplier.credit_days > 0 ? `${supplier.credit_days} días` : 'Contado'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Notas ── */}
                    <div className="sdm-info-card sdm-info-card--full">
                        <div className="sdm-info-card-title"><FiFileText size={14} /> Notas / Observaciones</div>
                        {supplier.notes?.trim() ? (
                            <p className="sdm-notes-text">{supplier.notes}</p>
                        ) : (
                            <p className="sdm-notes-empty">Sin notas registradas. Puedes agregar notas editando el proveedor.</p>
                        )}
                    </div>

                    {/* ── Productos asociados ── */}
                    <div className="sdm-products-section">
                        <div className="sdm-products-header">
                            <div className="sdm-products-title">
                                <FiPackage size={16} />
                                <span>Productos asociados</span>
                                <span className="sdm-products-count">{products.length}</span>
                            </div>
                        </div>

                        {loadingProducts ? (
                            <div className="sdm-loading">
                                <div className="sdm-spinner" />
                                <span>Cargando productos...</span>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="sdm-empty">
                                <FiPackage size={32} />
                                <p>Este proveedor no tiene productos asociados aún.</p>
                                <span>Puedes asociar productos desde el módulo de Inventario.</span>
                            </div>
                        ) : (
                            <div className="sdm-products-table-wrap">
                                <table className="sdm-products-table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>SKU</th>
                                            <th>SKU Proveedor</th>
                                            <th>Categoría</th>
                                            <th>Costo</th>
                                            <th>Precio venta</th>
                                            <th>Stock</th>
                                            <th>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.map((p) => {
                                            const stock     = getStockStatus(p);
                                            const unitLabel = getUnitLabel(p);
                                            return (
                                                <tr key={p.id}>
                                                    <td>
                                                        <div className="sdm-product-name">
                                                            {p.name}
                                                            {p.is_preferred === 1 && (
                                                                <span className="sdm-preferred" title="Proveedor preferido">★</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="sdm-sku">{p.sku || '—'}</td>
                                                    <td className="sdm-sku">{p.supplier_sku || '—'}</td>
                                                    <td>{p.category_name || '—'}</td>
                                                    <td>{formatCurrency(p.cost_price)}</td>
                                                    <td>{formatCurrency(p.sale_price)}</td>
                                                    <td>
                                                        {/* Ej: "1.240 un — OK"  |  "19,5 L — OK"  |  "Siempre disponible" */}
                                                        <span className={`sdm-stock-badge ${stock.cls}`}>
                                                            {p.unlimited_stock
                                                                ? 'Siempre disponible'
                                                                : `${fmtStock(p.stock)} ${unitLabel} — ${stock.label}`
                                                            }
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`sdm-active-badge ${p.is_active ? 'active' : 'inactive'}`}>
                                                            {p.is_active ? 'Activo' : 'Inactivo'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierDetailModal;