import React from 'react';
import './Ticket.css';

const Ticket = React.forwardRef(({ sale, businessInfo }, ref) => {
    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-CL', {
            style: 'currency', currency: 'CLP',
            minimumFractionDigits: 0, maximumFractionDigits: 0
        }).format(value);

    const formatQuantity = (item) => {
        const quantity  = parseFloat(item.quantity) || 0;
        const unitLabel = item.unit_label || 'un';
        if (quantity % 1 !== 0) {
            return `${quantity.toFixed(3).replace(/\.?0+$/, '')} ${unitLabel}`;
        }
        return `${quantity} ${unitLabel}`;
    };

    const formatPaymentMethod = (method) => {
        const methods = {
            efectivo:        'Efectivo',
            tarjeta_debito:  'Tarjeta de Débito',
            tarjeta_credito: 'Tarjeta de Crédito',
            transferencia:   'Transferencia',
            multiple:        'Múltiple',
        };
        return methods[method] || method;
    };

    const formatDocumentType = (type) => {
        const types = {
            boleta_fisica:        'Boleta Física',
            boleta_electronica:   'Boleta Electrónica',
            factura_fisica:       'Factura Física',
            factura_electronica:  'Factura Electrónica',
            sin_documento:        'Sin Documento',
        };
        return types[type] || type;
    };

    return (
        <div ref={ref} className="ticket">

            {/* Header */}
            <div className="ticket-header">
                {businessInfo?.logo_path
                    ? <img src={businessInfo.logo_path} alt="Logo" className="ticket-logo" />
                    : <div className="ticket-logo-placeholder"></div>
                }
                <h1 className="ticket-business-name">{businessInfo?.name || 'Mi Negocio'}</h1>
                {businessInfo?.rut     && <p className="ticket-rut">RUT: {businessInfo.rut}</p>}
                {businessInfo?.address && <p className="ticket-address">{businessInfo.address}</p>}
                {businessInfo?.phone   && <p className="ticket-contact">Tel: {businessInfo.phone}</p>}
                {businessInfo?.email   && <p className="ticket-contact">{businessInfo.email}</p>}
            </div>

            <hr className="ticket-divider" />

            {/* Info venta */}
            <div className="ticket-info">
                <div className="ticket-info-row">
                    <span>N° Venta:</span>
                    <span className="ticket-sale-number">{sale.sale_number}</span>
                </div>
                <div className="ticket-info-row">
                    <span>Fecha:</span>
                    <span>
                        {new Date(sale.created_at).toLocaleString('es-CL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </span>
                </div>
                <div className="ticket-info-row">
                    <span>Vendedor:</span>
                    <span>{sale.seller_name}</span>
                </div>
                {sale.customer_name && (
                    <div className="ticket-info-row">
                        <span>Cliente:</span><span>{sale.customer_name}</span>
                    </div>
                )}
                {sale.customer_rut && (
                    <div className="ticket-info-row">
                        <span>RUT Cliente:</span><span>{sale.customer_rut}</span>
                    </div>
                )}
            </div>

            <hr className="ticket-divider" />

            {/* Items */}
            <div className="ticket-items">
                <div className="ticket-items-header">
                    <span className="col-desc">DESCRIPCIÓN</span>
                </div>
                <div className="ticket-items-subheader">
                    <span className="col-qty">CANT.</span>
                    <span className="col-price">P.UNIT</span>
                    <span className="col-total">TOTAL</span>
                </div>

                {sale.items && sale.items.map((item, index) => (
                    <div key={index} className="ticket-item">
                        <div className="ticket-item-name">{item.product_name}</div>
                        {item.product_sku && (
                            <div className="ticket-item-sku">SKU: {item.product_sku}</div>
                        )}
                        <div className="ticket-item-details">
                            <span className="col-qty">{formatQuantity(item)}</span>
                            <span className="col-price">{formatCurrency(item.unit_price)}</span>
                            <span className="col-total">{formatCurrency(item.total)}</span>
                        </div>
                        {item.discount > 0 && (
                            <div className="ticket-item-discount">
                                Desc: -{formatCurrency(item.discount)}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <hr className="ticket-divider" />

            {/* Totales */}
            <div className="ticket-totals">
                <div className="ticket-total-row">
                    <span>Subtotal:</span><span>{formatCurrency(sale.subtotal)}</span>
                </div>
                {sale.discount > 0 && (
                    <div className="ticket-total-row ticket-discount">
                        <span>Descuento:</span><span>-{formatCurrency(sale.discount)}</span>
                    </div>
                )}
                <div className="ticket-total-row ticket-final">
                    <span>TOTAL:</span><span>{formatCurrency(sale.total)}</span>
                </div>
            </div>

            <hr className="ticket-divider" />

            {/* Pago */}
            <div className="ticket-payment">
                <div className="ticket-payment-row">
                    <span>Método de Pago:</span>
                    <span>{formatPaymentMethod(sale.payment_method)}</span>
                </div>
                {sale.payment_method === 'efectivo' && sale.cash_received && (
                    <>
                        <div className="ticket-payment-row">
                            <span>Efectivo Recibido:</span>
                            <span>{formatCurrency(sale.cash_received)}</span>
                        </div>
                        <div className="ticket-payment-row ticket-change">
                            <span>Vuelto:</span>
                            <span>{formatCurrency(sale.cash_change)}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Documento tributario */}
            {sale.document_type && sale.document_type !== 'sin_documento' && (
                <>
                    <hr className="ticket-divider" />
                    <div className="ticket-document">
                        <div className="ticket-document-row">
                            <span>Documento:</span>
                            <span>{formatDocumentType(sale.document_type)}</span>
                        </div>
                        {sale.document_number && (
                            <div className="ticket-document-row">
                                <span>N° Documento:</span>
                                <span className="ticket-doc-number">{sale.document_number}</span>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Notas */}
            {sale.notes && (
                <>
                    <hr className="ticket-divider" />
                    <div className="ticket-notes">
                        <strong>Notas:</strong>
                        <p>{sale.notes}</p>
                    </div>
                </>
            )}

            <hr className="ticket-divider" />

            {/* Footer */}
            <div className="ticket-footer">
                <p className="ticket-thanks">
                    {businessInfo?.footer_message || '¡Gracias por su compra!'}
                </p>
                <p className="ticket-system">Sistema Punto de Ventas</p>
                <p className="ticket-system">NUVENTA.CL</p>
            </div>

            {/* ── Aviso legal — siempre al pie, letra pequeña ── */}
            <hr className="ticket-divider ticket-divider--dashed" />
            <p className="ticket-legal-notice">
                Este comprobante no es válido 
                como boleta o factura.
            </p>

        </div>
    );
});

Ticket.displayName = 'Ticket';
export default Ticket;