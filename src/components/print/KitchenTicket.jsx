import React from 'react';
import './KitchenTicket.css';

const KitchenTicket = React.forwardRef(({ sale, businessInfo }, ref) => {
    const formatQuantity = (item) => {
        const quantity  = parseFloat(item.quantity) || 0;
        const unitLabel = item.unit_label || 'un';
        if (quantity % 1 !== 0) {
            return `${quantity.toFixed(3).replace(/\.?0+$/, '')} ${unitLabel}`;
        }
        return `${quantity} ${unitLabel}`;
    };

    return (
        <div ref={ref} className="kitchen-ticket">

            {/* Header */}
            <div className="kitchen-header">
                <h1 className="kitchen-title">COMANDA</h1>
                <p className="kitchen-business">{businessInfo?.name || 'Mi Negocio'}</p>
            </div>

            <hr className="kitchen-divider" />

            {/* Info */}
            <div className="kitchen-info">
                <div className="kitchen-info-row">
                    <span>N° Venta:</span>
                    <span className="kitchen-sale-number">{sale.sale_number}</span>
                </div>
                <div className="kitchen-info-row">
                    <span>Fecha:</span>
                    <span>
                        {new Date(sale.created_at).toLocaleString('es-CL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </span>
                </div>
                {sale.seller_name   && <div className="kitchen-info-row"><span>Vendedor:</span><span>{sale.seller_name}</span></div>}
                {sale.customer_name && <div className="kitchen-info-row"><span>Cliente:</span><span>{sale.customer_name}</span></div>}
            </div>

            {/* Mesa / Nombre */}
            {sale.table_info && (
                <>
                    <hr className="kitchen-divider" />
                    <div className="kitchen-table-box">
                        <p className="kitchen-table-label">📍 MESA / CLIENTE</p>
                        <p className="kitchen-table-value">{sale.table_info}</p>
                    </div>
                </>
            )}

            <hr className="kitchen-divider" />

            {/* Items */}
            <div className="kitchen-items">
                <div className="kitchen-items-header">
                    <span className="kitchen-col-qty">CANT.</span>
                    <span className="kitchen-col-name">DESCRIPCIÓN</span>
                </div>
                {sale.items && sale.items.map((item, index) => (
                    <div key={index} className="kitchen-item">
                        <span className="kitchen-item-qty">{formatQuantity(item)}</span>
                        <span className="kitchen-item-name">{item.product_name}</span>
                    </div>
                ))}
            </div>

            {/* ── Observaciones del pedido ── */}
            {sale.kitchen_notes && sale.kitchen_notes.trim() && (
                <>
                    <hr className="kitchen-divider" />
                    <div className="kitchen-notes">
                        <p className="kitchen-notes-title">⚠ OBSERVACIONES:</p>
                        <p className="kitchen-notes-text">{sale.kitchen_notes}</p>
                    </div>
                </>
            )}

            {/* Notas internas de la venta (si existen) */}
            {sale.notes && (
                <>
                    <hr className="kitchen-divider" />
                    <div className="kitchen-notes">
                        <p className="kitchen-notes-title">NOTAS:</p>
                        <p className="kitchen-notes-text">{sale.notes}</p>
                    </div>
                </>
            )}

            <hr className="kitchen-divider" />

            <div className="kitchen-footer">
                <p className="kitchen-system">Comanda automática</p>
                <p className="kitchen-system">Sistema Punto de Ventas</p>
                <p className="kitchen-system">NUVENTA.CL</p>
            </div>
        </div>
    );
});

KitchenTicket.displayName = 'KitchenTicket';
export default KitchenTicket;