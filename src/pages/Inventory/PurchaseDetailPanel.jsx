// src/pages/Inventory/PurchaseDetailPanel.jsx
import React, { useEffect } from 'react';
import {
    FiX, FiTruck, FiFileText, FiDollarSign,
    FiTag, FiList, FiCheckCircle, FiAlertTriangle, FiPackage
} from 'react-icons/fi';
import './PurchaseDetailPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = String(d).split('T')[0].split('-');
    return `${day}/${m}/${y}`;
};

const DOC_LABELS = {
    factura:       'Factura',
    boleta:        'Boleta',
    nota_debito:   'Nota de Débito',
    sin_documento: 'Sin Documento',
};

// ── Badges ────────────────────────────────────────────────────────────────────
const StockBadge = ({ status }) => {
    const map = {
        pagado:    { label: 'Pagado',    cls: 'pdb-badge--ok'      },
        parcial:   { label: 'Parcial',   cls: 'pdb-badge--warning' },
        pendiente: { label: 'Pendiente', cls: 'pdb-badge--danger'  },
    };
    const { label, cls } = map[status] || map.pendiente;
    return <span className={`pdb-stock-badge ${cls}`}>{label}</span>;
};

const DocBadge = ({ type }) => (
    <span className="pdb-doc-badge">{DOC_LABELS[type] || type || '—'}</span>
);

// ── Componente principal ──────────────────────────────────────────────────────
const PurchaseDetailPanel = ({ purchase, onClose }) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        const fn = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, [onClose]);

    if (!purchase) return null;

    const items      = purchase.items || [];
    const totalUnits = items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0);
    const isPaid     = purchase.payment_status === 'pagado';
    const saldo      = Math.max(0, (parseFloat(purchase.total) || 0) - (parseFloat(purchase.paid_amount) || 0));
    const docLabel   = DOC_LABELS[purchase.document_type] || purchase.document_type || 'Sin documento';

    return (
        <div className="pdb-overlay" onClick={onClose}>
            <div className="pdb-panel" onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="pdb-header">
                    <div className="pdb-header-left">
                        <div className="pdb-avatar">
                            <FiTruck size={22} />
                        </div>
                        <div className="pdb-header-text">
                            <h2 className="pdb-title">{purchase.purchase_number}</h2>
                            <div className="pdb-header-meta">
                                {purchase.supplier_name && (
                                    <span className="pdb-subtitle">{purchase.supplier_name}</span>
                                )}
                                <span className="pdb-type-badge">{docLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div className="pdb-header-actions">
                        <span className={`pdb-status-badge ${isPaid ? 'pdb-status--active' : 'pdb-status--inactive'}`}>
                            {isPaid ? '✓ Pagado' : '⏳ Pendiente'}
                        </span>
                        <button className="pdb-btn-close" onClick={onClose} title="Cerrar (ESC)">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="pdb-body">

                    {/* Fila de tarjetas */}
                    <div className="pdb-cards-grid">

                        {/* Información */}
                        <div className="pdb-card">
                            <div className="pdb-card-title"><FiFileText size={13} /> Información</div>
                            <div className="pdb-rows">
                                <div className="pdb-row">
                                    <span className="pdb-label">N° Compra</span>
                                    <span className="pdb-value pdb-mono">{purchase.purchase_number}</span>
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">N° Documento</span>
                                    <span className="pdb-value pdb-mono">{purchase.invoice_number || '—'}</span>
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">Fecha</span>
                                    <span className="pdb-value">{fmtDate(purchase.invoice_date)}</span>
                                </div>
                                {purchase.due_date && (
                                    <div className="pdb-row">
                                        <span className="pdb-label">Vencimiento</span>
                                        <span className="pdb-value">{fmtDate(purchase.due_date)}</span>
                                    </div>
                                )}
                                <div className="pdb-row">
                                    <span className="pdb-label">Tipo doc.</span>
                                    <span className="pdb-value"><DocBadge type={purchase.document_type} /></span>
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">Registrado por</span>
                                    <span className="pdb-value">{purchase.user_name || '—'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Montos */}
                        <div className="pdb-card">
                            <div className="pdb-card-title"><FiDollarSign size={13} /> Montos</div>
                            <div className="pdb-rows">
                                {parseFloat(purchase.subtotal) !== parseFloat(purchase.total) && (
                                    <>
                                        <div className="pdb-row">
                                            <span className="pdb-label">Subtotal neto</span>
                                            <span className="pdb-value">{fmt(purchase.subtotal)}</span>
                                        </div>
                                        <div className="pdb-row">
                                            <span className="pdb-label">IVA (19%)</span>
                                            <span className="pdb-value">{fmt(purchase.tax)}</span>
                                        </div>
                                    </>
                                )}
                                {parseFloat(purchase.discount) > 0 && (
                                    <div className="pdb-row">
                                        <span className="pdb-label">Descuento</span>
                                        <span className="pdb-value pdb-value--green">-{fmt(purchase.discount)}</span>
                                    </div>
                                )}
                                <div className="pdb-row">
                                    <span className="pdb-label">Total</span>
                                    <span className="pdb-value pdb-value--total">{fmt(purchase.total)}</span>
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">Pagado</span>
                                    <span className="pdb-value pdb-value--green">{fmt(purchase.paid_amount)}</span>
                                </div>
                                {!isPaid && (
                                    <div className="pdb-row">
                                        <span className="pdb-label">Saldo</span>
                                        <span className="pdb-value pdb-value--red">{fmt(saldo)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pago */}
                        <div className="pdb-card">
                            <div className="pdb-card-title"><FiTag size={13} /> Pago</div>
                            <div className="pdb-rows">
                                <div className="pdb-row">
                                    <span className="pdb-label">Estado</span>
                                    <StockBadge status={purchase.payment_status} />
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">Método</span>
                                    <span className="pdb-value pdb-capitalize">{purchase.payment_method || '—'}</span>
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">Condición</span>
                                    <span className="pdb-value pdb-capitalize">
                                        {purchase.payment_condition || 'contado'}
                                        {purchase.payment_condition === 'credito' && purchase.credit_days
                                            ? ` (${purchase.credit_days} días)` : ''}
                                    </span>
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">Productos</span>
                                    <span className="pdb-value">{items.length} tipo{items.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="pdb-row">
                                    <span className="pdb-label">Unidades</span>
                                    <span className="pdb-value">{totalUnits}</span>
                                </div>
                            </div>
                            {purchase.has_recoverable_tax === 1 && (
                                <div className="pdb-alert pdb-alert--blue">
                                    <FiCheckCircle size={13} />
                                    <span>IVA recuperable — declarar en SII</span>
                                </div>
                            )}
                            {!isPaid && saldo > 0 && (
                                <div className="pdb-alert pdb-alert--warning">
                                    <FiAlertTriangle size={13} />
                                    <span>Saldo pendiente de pago</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Productos */}
                    <div className="pdb-card pdb-card--full">
                        <div className="pdb-card-title"><FiList size={13} /> Productos ({items.length})</div>
                        {items.length === 0 ? (
                            <div className="pdb-empty">
                                <FiPackage size={28} />
                                <span>Sin productos registrados en esta compra.</span>
                            </div>
                        ) : (
                            <div className="pdb-table-wrap">
                                <table className="pdb-table">
                                    <thead>
                                        <tr>
                                            <th>Producto</th>
                                            <th>Cantidad</th>
                                            <th>Costo unit.</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, i) => (
                                            <tr key={i}>
                                                <td>
                                                    <div className="pdb-product-cell">
                                                        <strong>{item.product_name}</strong>
                                                        {item.product_sku && (
                                                            <span className="pdb-sku">SKU: {item.product_sku}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="pdb-td-right pdb-qty">
                                                    {item.quantity} {item.unit_label || 'un'}
                                                </td>
                                                <td className="pdb-td-right">{fmt(item.unit_price)}</td>
                                                <td className="pdb-td-right"><strong>{fmt(item.total)}</strong></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Proveedor */}
                    <div className="pdb-card pdb-card--full">
                        <div className="pdb-card-title"><FiTruck size={13} /> Proveedor</div>
                        {purchase.supplier_name ? (
                            <div className="pdb-supplier">
                                <div className="pdb-supplier-avatar">
                                    {purchase.supplier_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="pdb-supplier-info">
                                    <span className="pdb-supplier-name">{purchase.supplier_name}</span>
                                    {purchase.invoice_number && (
                                        <div className="pdb-supplier-meta">
                                            <span className="pdb-supplier-sku">
                                                N° doc.: <strong>{purchase.invoice_number}</strong>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="pdb-empty-text">Sin proveedor registrado en esta compra.</p>
                        )}
                    </div>

                    {/* Notas */}
                    {purchase.notes && (
                        <div className="pdb-card pdb-card--full">
                            <div className="pdb-card-title"><FiFileText size={13} /> Notas</div>
                            <p className="pdb-notes-text">{purchase.notes}</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default PurchaseDetailPanel;