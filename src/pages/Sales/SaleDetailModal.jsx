import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import BusinessRepository from '../../services/repositories/businessRepository';
import Button from '../../components/common/Button';
import PrintModal from '../../components/print/PrintModal';
import {
    FiX, FiPrinter, FiXCircle, FiUser,
    FiCalendar, FiCreditCard, FiFileText,
    FiShoppingBag, FiDollarSign, FiTag,
} from 'react-icons/fi';
import './SaleDetailModal.css';

const SaleDetailModal = ({ sale, onClose, onCancel, isAdmin = false }) => {
    const { db } = useDatabase();
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [businessInfo, setBusinessInfo] = useState(null);

    const businessRepo = new BusinessRepository(db);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        // FIX: getBusinessInfo es async — faltaba el await, haciendo que
        // businessInfo llegara siempre undefined al PrintModal.
        const loadBusiness = async () => {
            try {
                const info = await businessRepo.getBusinessInfo();
                setBusinessInfo(info);
            } catch (err) {
                console.warn('SaleDetailModal: error cargando businessInfo:', err.message);
            }
        };
        loadBusiness();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !showPrintModal) handleClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showPrintModal]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!sale) return null;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fmt = (v) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

    const fmtPayment = (m) => ({
        efectivo: 'Efectivo',
        tarjeta_debito: 'Tarjeta de Débito',
        tarjeta_credito: 'Tarjeta de Crédito',
        transferencia: 'Transferencia',
        multiple: 'Múltiple',
    }[m] || m);

    const fmtDoc = (t) => ({
        boleta_fisica: 'Boleta Física',
        boleta_electronica: 'Boleta Electrónica',
        factura_fisica: 'Factura Física',
        factura_electronica: 'Factura Electrónica',
        sin_documento: 'Sin Documento',
    }[t] || t);

    const handleClose = () => { document.body.style.overflow = ''; onClose(); };
    const handleOpenPrint = () => setShowPrintModal(true);
    const handleClosePrint = () => { setShowPrintModal(false); document.body.style.overflow = 'hidden'; };

    const itemsCount = Array.isArray(sale.items) ? sale.items.length : 0;

    // Si la venta tiene info de comanda mostramos la card
    const hasKitchenInfo = sale.table_info || sale.kitchen_notes;

    return (
        <div className="sdm-sale-overlay" onClick={handleClose}>
            <div className="sdm-sale-panel" onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="sdm-sale-header">
                    <div className="sdm-sale-header-left">
                        <div className="sdm-sale-avatar">
                            <FiShoppingBag size={22} />
                        </div>
                        <div>
                            <h2 className="sdm-sale-title">Detalle de Venta</h2>
                            <p className="sdm-sale-subtitle">{sale.sale_number}</p>
                        </div>
                    </div>
                    <div className="sdm-sale-header-actions">
                        <span className={`sdm-sale-badge ${sale.is_cancelled ? 'badge-cancelled' : 'badge-active'}`}>
                            {sale.is_cancelled ? '✗ Cancelada' : '✓ Completada'}
                        </span>
                        <button className="sdm-sale-btn-print" onClick={handleOpenPrint} title="Reimprimir ticket">
                            <FiPrinter size={15} /> Imprimir
                        </button>
                        {isAdmin && !sale.is_cancelled && onCancel && (
                            <button className="sdm-sale-btn-cancel" onClick={() => onCancel(sale)} title="Cancelar venta">
                                <FiXCircle size={15} /> Cancelar
                            </button>
                        )}
                        <button className="sdm-sale-btn-close" onClick={handleClose} title="Cerrar (ESC)">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="sdm-sale-body">

                    {/* ── Banner cancelada ── */}
                    {sale.is_cancelled && (
                        <div className="sdm-sale-cancelled-banner">
                            <FiXCircle size={18} />
                            <div>
                                <strong>Venta Cancelada</strong>
                                {sale.cancellation_reason && <p>Motivo: {sale.cancellation_reason}</p>}
                                <div className="sdm-sale-cancelled-meta">
                                    {sale.cancelled_at && (
                                        <span><FiCalendar size={11} /> {new Date(sale.cancelled_at).toLocaleString('es-CL')}</span>
                                    )}
                                    {sale.canceller_name && (
                                        <span><FiUser size={11} /> Cancelado por: <strong>{sale.canceller_name}</strong></span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Info de comanda (mesa + observaciones) ── */}
                    {hasKitchenInfo && (
                        <div className="sdm-sale-kitchen-banner">
                            <span className="sdm-sale-kitchen-icon">🍽️</span>
                            <div className="sdm-sale-kitchen-content">
                                {sale.table_info && (
                                    <div className="sdm-sale-kitchen-row">
                                        <span className="sdm-sale-kitchen-label">🪑 Mesa / Cliente:</span>
                                        <span className="sdm-sale-kitchen-value">{sale.table_info}</span>
                                    </div>
                                )}
                                {sale.kitchen_notes && (
                                    <div className="sdm-sale-kitchen-row">
                                        <span className="sdm-sale-kitchen-label">⚠️ Observaciones:</span>
                                        <span className="sdm-sale-kitchen-value">{sale.kitchen_notes}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Grid 3 columnas: Info general | Pago | Cliente ── */}
                    <div className="sdm-sale-info-grid">

                        {/* Información general */}
                        <div className="sdm-sale-card">
                            <div className="sdm-sale-card-title"><FiCalendar size={13} /> Información General</div>
                            <div className="sdm-sale-rows">
                                <div className="sdm-sale-row">
                                    <span className="sdm-sale-label">Fecha</span>
                                    <span className="sdm-sale-value">
                                        {new Date(sale.created_at).toLocaleDateString('es-CL', {
                                            day: '2-digit', month: 'short', year: 'numeric'
                                        })}
                                    </span>
                                </div>
                                <div className="sdm-sale-row">
                                    <span className="sdm-sale-label">Hora</span>
                                    <span className="sdm-sale-value">
                                        {new Date(sale.created_at).toLocaleTimeString('es-CL', {
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                                <div className="sdm-sale-row">
                                    <span className="sdm-sale-label">Vendedor</span>
                                    <span className="sdm-sale-value">{sale.seller_name || '—'}</span>
                                </div>
                                <div className="sdm-sale-row">
                                    <span className="sdm-sale-label">Productos</span>
                                    <span className="sdm-sale-value">{itemsCount} ítem{itemsCount !== 1 ? 's' : ''}</span>
                                </div>
                            </div>
                        </div>

                        {/* Pago */}
                        <div className="sdm-sale-card">
                            <div className="sdm-sale-card-title"><FiCreditCard size={13} /> Pago</div>
                            <div className="sdm-sale-rows">
                                <div className="sdm-sale-row">
                                    <span className="sdm-sale-label">Método</span>
                                    <span className="sdm-sale-value">{fmtPayment(sale.payment_method)}</span>
                                </div>
                                {sale.document_type && (
                                    <div className="sdm-sale-row">
                                        <span className="sdm-sale-label">Documento</span>
                                        <span className="sdm-sale-value">{fmtDoc(sale.document_type)}</span>
                                    </div>
                                )}
                                {sale.document_number && (
                                    <div className="sdm-sale-row">
                                        <span className="sdm-sale-label">N° Doc.</span>
                                        <span className="sdm-sale-value sdm-sale-mono">N° {sale.document_number}</span>
                                    </div>
                                )}
                                {sale.payment_method === 'efectivo' && sale.cash_received > 0 && (
                                    <>
                                        <div className="sdm-sale-row">
                                            <span className="sdm-sale-label">Recibido</span>
                                            <span className="sdm-sale-value">{fmt(sale.cash_received)}</span>
                                        </div>
                                        <div className="sdm-sale-row">
                                            <span className="sdm-sale-label">Vuelto</span>
                                            <span className="sdm-sale-value sdm-sale-change">{fmt(sale.cash_change)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Cliente */}
                        <div className="sdm-sale-card">
                            <div className="sdm-sale-card-title"><FiUser size={13} /> Cliente</div>
                            <div className="sdm-sale-rows">
                                <div className="sdm-sale-row">
                                    <span className="sdm-sale-label">Nombre</span>
                                    <span className="sdm-sale-value">{sale.customer_name || 'Sin cliente'}</span>
                                </div>
                                {sale.customer_rut && (
                                    <div className="sdm-sale-row">
                                        <span className="sdm-sale-label">RUT</span>
                                        <span className="sdm-sale-value sdm-sale-mono">{sale.customer_rut}</span>
                                    </div>
                                )}
                                {sale.customer_phone && (
                                    <div className="sdm-sale-row">
                                        <span className="sdm-sale-label">Teléfono</span>
                                        <span className="sdm-sale-value sdm-sale-mono">{sale.customer_phone}</span>
                                    </div>
                                )}
                                {sale.customer_email && (
                                    <div className="sdm-sale-row">
                                        <span className="sdm-sale-label">Email</span>
                                        <span className="sdm-sale-value">{sale.customer_email}</span>
                                    </div>
                                )}
                                {!sale.customer_name && !sale.customer_rut && (
                                    <p className="sdm-sale-empty-note">Venta sin cliente registrado</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Tabla de productos ── */}
                    <div className="sdm-sale-card sdm-sale-card--full">
                        <div className="sdm-sale-card-title"><FiTag size={13} /> Productos / Servicios</div>
                        <div className="sdm-sale-table-wrap">
                            <table className="sdm-sale-table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th style={{ textAlign: 'center' }}>Cant.</th>
                                        <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                                        <th style={{ textAlign: 'right' }}>Descuento</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(sale.items) && sale.items.map((item, i) => (
                                        <tr key={i}>
                                            <td>
                                                <span className="sdm-sale-item-name">{item.product_name}</span>
                                                {item.product_sku && (
                                                    <span className="sdm-sale-item-sku">SKU: {item.product_sku}</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="sdm-sale-qty">{item.quantity}</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>{fmt(item.unit_price)}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                {item.discount > 0
                                                    ? <span className="sdm-sale-discount">-{fmt(item.discount)}</span>
                                                    : <span className="sdm-sale-nodiscount">—</span>}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <strong>{fmt(item.total)}</strong>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Totales + Notas ── */}
                    <div className="sdm-sale-bottom-row">

                        {/* Totales */}
                        <div className="sdm-sale-card sdm-sale-totals-card">
                            <div className="sdm-sale-card-title"><FiDollarSign size={13} /> Totales</div>
                            <div className="sdm-sale-totals">
                                <div className="sdm-sale-total-row">
                                    <span>Subtotal</span>
                                    <span>{fmt(sale.subtotal)}</span>
                                </div>
                                {(parseFloat(sale.promotion_discount) || 0) > 0 && (
                                    <div className="sdm-sale-total-row sdm-sale-total-discount">
                                        <span>Dto. promociones</span>
                                        <span>-{fmt(sale.promotion_discount)}</span>
                                    </div>
                                )}
                                {(parseFloat(sale.manual_discount) || 0) > 0 && (
                                    <div className="sdm-sale-total-row sdm-sale-total-discount">
                                        <span>Dto. manual</span>
                                        <span>-{fmt(sale.manual_discount)}</span>
                                    </div>
                                )}
                                {/* Fallback: si no hay desglose pero sí hay descuento total */}
                                {(parseFloat(sale.promotion_discount) || 0) === 0 &&
                                    (parseFloat(sale.manual_discount) || 0) === 0 &&
                                    (parseFloat(sale.discount) || 0) > 0 && (
                                        <div className="sdm-sale-total-row sdm-sale-total-discount">
                                            <span>Descuento</span>
                                            <span>-{fmt(sale.discount)}</span>
                                        </div>
                                    )}
                                {sale.tax > 0 && (
                                    <div className="sdm-sale-total-row">
                                        <span>IVA</span>
                                        <span>{fmt(sale.tax)}</span>
                                    </div>
                                )}
                                <div className="sdm-sale-total-row sdm-sale-total-final">
                                    <span>TOTAL</span>
                                    <span>{fmt(sale.total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Notas */}
                        {sale.notes && (
                            <div className="sdm-sale-card sdm-sale-notes-card">
                                <div className="sdm-sale-card-title"><FiFileText size={13} /> Notas</div>
                                <p className="sdm-sale-notes-text">{sale.notes}</p>
                            </div>
                        )}
                    </div>

                </div>{/* end body */}
            </div>{/* end panel */}

            {showPrintModal && (
                <PrintModal
                    sale={sale}
                    onClose={handleClosePrint}
                    businessInfo={businessInfo}
                />
            )}
        </div>
    );
};

export default SaleDetailModal;