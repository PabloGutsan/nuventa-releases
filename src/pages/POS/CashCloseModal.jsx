// src/pages/POS/CashCloseModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
    FiDollarSign, FiX, FiPrinter, FiAlertCircle,
    FiArrowDownCircle, FiArrowUpCircle, FiCheckCircle,
    FiShoppingCart, FiChevronDown, FiChevronUp
} from 'react-icons/fi';
import './CashCloseModal.css';
import useRestoreFocus from '../../hooks/useRestoreFocus';

const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtTime = (iso) => {
    if (!iso) return '—';
    const d = iso.includes('T') ? new Date(iso) : new Date(iso.replace(' ', 'T'));
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = iso.includes('T') ? new Date(iso) : new Date(iso.replace(' ', 'T'));
    return d.toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const PAYMENT_LABELS = {
    efectivo:        'Efectivo',
    tarjeta_debito:  'Débito',
    tarjeta_credito: 'Crédito',
    transferencia:   'Transferencia',
    multiple:        'Múltiple',
};

const PAYMENT_ICONS = {
    efectivo:        '💵',
    tarjeta_debito:  '💳',
    tarjeta_credito: '💳',
    transferencia:   '🏦',
    multiple:        '🔀',
};

// ── Ticket de cierre de caja — mismo estilo que Ticket.css ────────────────────
const buildTicketHTML = ({
    businessName, businessLogo, register, currentUser,
    salesSummary, salesDetail, movements,
    expectedCash, closingAmount, notes, closedAt
}) => {
    const totalIn   = movements.filter(m => m.type === 'in').reduce((a, m) => a + m.amount, 0);
    const totalOut  = movements.filter(m => m.type === 'out').reduce((a, m) => a + m.amount, 0);
    const cashSales = salesSummary.byPayment.find(p => p.payment_method === 'efectivo')?.total || 0;
    const diff      = closingAmount - expectedCash;
    const diffLabel = diff === 0 ? 'CUADRE EXACTO ✓' : diff > 0 ? `SOBRANTE: ${fmt(diff)}` : `FALTANTE: ${fmt(Math.abs(diff))}`;
    const diffColor = diff === 0 ? '#15803d' : diff > 0 ? '#1d4ed8' : '#dc2626';

    const logoHtml = businessLogo
        ? `<img src="${businessLogo}" alt="Logo" class="ticket-logo" />`
        : `<div class="ticket-logo-placeholder">🏪</div>`;


    const movRows = movements.map(m => `
        <div class="ticket-item">
            <div class="ticket-item-details">
                <span class="col-qty" style="color:${m.type==='in'?'#15803d':'#dc2626'}">${m.type==='in'?'↓ Ingreso':'↑ Egreso'}</span>
                <span class="col-price" style="font-size:8pt;grid-column:span 1">${m.reason.substring(0,14)}</span>
                <span class="col-total" style="color:${m.type==='in'?'#15803d':'#dc2626'}">${m.type==='in'?'+':'−'}${fmt(m.amount)}</span>
            </div>
        </div>`).join('');

    const paymentRows = salesSummary.byPayment.map(p => `
        <div class="ticket-total-row">
            <span>${PAYMENT_LABELS[p.payment_method]||p.payment_method} (${p.count})</span>
            <span>${fmt(p.total)}</span>
        </div>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cierre de Caja</title>
<style>
/* ── Mismos estilos que Ticket.css ── */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: white; }
.ticket {
    width: 80mm; max-width: 80mm;
    padding: 3mm 4mm 22mm 4mm;
    font-family: 'Courier New', Courier, monospace;
    font-size: 10pt; color: #000; background: white;
    box-sizing: border-box; line-height: 1.35;
}
.ticket-header        { text-align: center; margin-bottom: 8px; }
.ticket-logo          { max-width: 90px; max-height: 90px; margin-bottom: 6px; }
.ticket-logo-placeholder { font-size: 32px; margin-bottom: 6px; }
.ticket-business-name { font-size: 13pt; font-weight: bold; margin: 6px 0 3px; text-transform: uppercase; }
.ticket-rut, .ticket-address, .ticket-contact { font-size: 9pt; margin: 2px 0; }
.ticket-divider { border: none; border-top: 1px solid #000; margin: 8px 0; width: 100%; }
.ticket-info-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 9pt; }
.ticket-sale-number { font-weight: bold; }
/* Items */
.ticket-items-subheader {
    display: grid; grid-template-columns: 22mm 1fr 1fr;
    gap: 2px; font-weight: bold; font-size: 8.5pt;
    margin-bottom: 4px; padding: 2px 0;
    border-bottom: 1px dashed #000;
}
.col-qty { text-align: left; }
.col-price { text-align: right; }
.col-total { text-align: right; }
.ticket-item { margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px dotted #ccc; }
.ticket-item:last-child { border-bottom: none; }
.ticket-item-name { font-size: 9pt; font-weight: bold; margin-bottom: 1px; }
.ticket-item-details {
    display: grid; grid-template-columns: 22mm 1fr 1fr;
    gap: 2px; font-size: 9pt; margin-top: 1px;
}
/* Totales */
.ticket-totals { margin: 6px 0; }
.ticket-total-row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 9.5pt; }
.ticket-final { font-weight: bold; font-size: 12pt; margin-top: 6px; padding-top: 5px; border-top: 2px solid #000; }
/* Footer */
.ticket-footer { text-align: center; margin-top: 10px; padding-top: 6px; }
.ticket-thanks { font-size: 10pt; font-weight: bold; margin: 8px 0; }
.ticket-system { font-size: 7.5pt; color: #555; margin-top: 4px; }
/* Diff box */
.diff-box { padding: 6px 0; margin: 4px 0; text-align: center; }
.diff-label { font-size: 12pt; font-weight: bold; }
/* Sección títulos */
.section-title { font-weight: bold; font-size: 8pt; letter-spacing: 0.5px; margin: 2px 0; }
@media print {
    @page { size: 80mm auto; margin: 0 !important; }
    html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; }
    .ticket { width: 80mm !important; margin: 0 !important; }
    * { color: #000 !important; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .ticket-item-details { display: grid !important; grid-template-columns: 22mm 1fr 1fr !important; }
}
@media screen {
    .ticket { box-shadow: 0 4px 16px rgba(0,0,0,0.18); margin: 20px auto; border: 1px solid #e5e7eb; border-radius: 4px; }
}
</style>
</head>
<body>
<div class="ticket">

    <!-- Header -->
    <div class="ticket-header">
        ${logoHtml}
        <h1 class="ticket-business-name">${businessName || 'MI NEGOCIO'}</h1>
    </div>

    <hr class="ticket-divider">

    <!-- Título del documento -->
    <div style="text-align:center; font-weight:bold; font-size:11pt; margin:4px 0;">
        CIERRE DE TURNO
    </div>

    <hr class="ticket-divider">

    <!-- Info del turno -->
    <div class="ticket-info-row"><span>Cajero:</span><span>${register?.opened_by_name || '—'}</span></div>
    <div class="ticket-info-row"><span>Apertura:</span><span>${fmtDateTime(register?.opened_at)}</span></div>
    <div class="ticket-info-row"><span>Cierre:</span><span>${closedAt}</span></div>
    <div class="ticket-info-row"><span>Cerrado por:</span><span>${register?.opened_by_name || currentUser?.full_name || currentUser?.username || '—'}</span></div>

    <hr class="ticket-divider">

    <!-- Resumen de ventas -->
    <div class="section-title">VENTAS DEL TURNO</div>
    <div class="ticket-totals">
        <div class="ticket-total-row ticket-final">
            <span>Total ventas</span><span>${fmt(salesSummary.total)}</span>
        </div>
        <div class="ticket-total-row" style="color:#555">
            <span>N° transacciones</span><span>${salesSummary.count}</span>
        </div>
    </div>

    ${salesSummary.byPayment.length > 0 ? `
    <hr class="ticket-divider">
    <div class="section-title">POR MÉTODO DE PAGO</div>
    <div class="ticket-totals">${paymentRows}</div>` : ''}

    ${movements.length > 0 ? `
    <hr class="ticket-divider">
    <div class="section-title">MOVIMIENTOS DE EFECTIVO</div>
    <div class="ticket-items-subheader">
        <span class="col-qty">TIPO</span>
        <span class="col-price">MOTIVO</span>
        <span class="col-total">MONTO</span>
    </div>
    <div class="ticket-items">${movRows}</div>` : ''}

    <hr class="ticket-divider">

    <!-- Arqueo -->
    <div class="section-title">ARQUEO DE CAJA</div>
    <div class="ticket-totals">
        <div class="ticket-total-row"><span>Efectivo inicial</span><span>${fmt(register?.opening_amount)}</span></div>
        ${totalIn  > 0 ? `<div class="ticket-total-row" style="color:#15803d"><span>+ Ingresos manuales</span><span>+${fmt(totalIn)}</span></div>` : ''}
        ${totalOut > 0 ? `<div class="ticket-total-row" style="color:#dc2626"><span>− Egresos manuales</span><span>−${fmt(totalOut)}</span></div>` : ''}
        <div class="ticket-total-row" style="color:#15803d"><span>+ Ventas en efectivo</span><span>+${fmt(cashSales)}</span></div>
        <div class="ticket-total-row ticket-final"><span>Esperado en caja</span><span>${fmt(expectedCash)}</span></div>
        <div class="ticket-total-row ticket-final"><span>Contado físico</span><span>${fmt(closingAmount)}</span></div>
    </div>

    <hr class="ticket-divider">

    <!-- Diferencia -->
    <div class="diff-box">
        <div class="diff-label" style="color:${diffColor}">${diffLabel}</div>
    </div>

    ${notes ? `<hr class="ticket-divider"><div style="font-size:9pt"><strong>Notas:</strong> ${notes}</div>` : ''}

    <hr class="ticket-divider">

    <!-- Footer -->
    <div class="ticket-footer">
        <p class="ticket-thanks">Resumen de turno</p>
        <p class="ticket-system">Sistema Punto de Ventas</p>
        <p class="ticket-system">NUVENTA.CL</p>
    </div>

</div>
</body>
</html>`;
};

// ── Componente principal ───────────────────────────────────────────────────────
const CashCloseModal = ({
    register, salesSummary, salesDetail, movements,
    expectedCash, businessName, businessLogo, currentUser,
    onClose, onConfirmClose,
}) => {
    const [closingAmount, setClosingAmount] = useState('');
    const [notes,         setNotes]         = useState('');
    const [showSales,     setShowSales]     = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [confirmed,     setConfirmed]     = useState(false);
    const [closedAt,      setClosedAt]      = useState('');
    // Snapshot de datos antes de que el hook los limpie al cerrar
    const [snap,          setSnap]          = useState(null);
    const inputRef = useRef(null);

    useRestoreFocus();

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 200);
    }, []);

    const parsed        = parseInt(closingAmount.replace(/\D/g, '')) || 0;
    const snapExpected  = snap?.expectedCash ?? expectedCash;
    const difference    = parsed - snapExpected;
    const hasAmount     = closingAmount !== '';

    const diffLabel = difference === 0 ? 'Cuadre exacto ✓'
        : difference > 0 ? `Sobrante: ${fmt(difference)}`
        : `Faltante: ${fmt(Math.abs(difference))}`;
    const diffClass = difference === 0 ? 'exact' : difference > 0 ? 'surplus' : 'shortage';

    const totalIn   = movements.filter(m => m.type === 'in').reduce((a, m) => a + m.amount, 0);
    const totalOut  = movements.filter(m => m.type === 'out').reduce((a, m) => a + m.amount, 0);
    const cashSales = salesSummary.byPayment.find(p => p.payment_method === 'efectivo')?.total || 0;

    const handleConfirm = async () => {
        // Guardar snapshot ANTES de llamar onConfirmClose,
        // porque el hook limpia salesSummary/movements/etc al cerrar la caja
        const dataSnap = { salesSummary, salesDetail, movements, expectedCash, register };
        setSnap(dataSnap);
        setLoading(true);
        try {
            await onConfirmClose({ closingAmount: parsed, expectedCash, notes });
            const now = new Date().toLocaleString('es-CL', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            setClosedAt(now);
            setConfirmed(true);
        } catch {
            setSnap(null);
            setLoading(false);
        }
    };

    const handlePrint = () => {
        const d = snap || { salesSummary, salesDetail, movements, expectedCash, register };
        const html = buildTicketHTML({
            businessName,
            businessLogo,
            register:      d.register,
            currentUser,
            salesSummary:  d.salesSummary,
            salesDetail:   d.salesDetail,
            movements:     d.movements,
            expectedCash:  d.expectedCash,
            closingAmount: parsed,
            notes,
            closedAt,
        });
        const w = window.open('', '_blank', 'width=420,height=750');
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => {
            w.print();
            w.close();
            setTimeout(() => window.focus(), 100);
        }, 400);
    };

    // ── Pantalla de éxito ──────────────────────────────────────────────────────
    if (confirmed) {
        return (
            <div className="cc-overlay">
                <div className="cc-modal cc-success-modal">
                    <div className="cc-success-icon"><FiCheckCircle size={48} /></div>
                    <h2 className="cc-success-title">¡Caja Cerrada!</h2>
                    <p className="cc-success-sub">El turno ha sido registrado correctamente</p>

                    <div className={`cc-diff-box ${diffClass}`}>
                        <div className="cc-diff-row">
                            <span>Efectivo esperado</span>
                            <span>{fmt(snapExpected)}</span>
                        </div>
                        <div className="cc-diff-row">
                            <span>Efectivo contado</span>
                            <span>{fmt(parsed)}</span>
                        </div>
                        <div className="cc-diff-total">
                            <FiAlertCircle size={14} /> {diffLabel}
                        </div>
                    </div>

                    <p className="cc-print-question">¿Deseas imprimir el resumen del turno?</p>

                    <div className="cc-success-actions">
                        <button className="cc-btn-skip" onClick={onClose}>
                            Continuar sin imprimir
                        </button>
                        <button className="cc-btn-print-final" onClick={() => { handlePrint(); onClose(); }}>
                            <FiPrinter size={15} /> Imprimir resumen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Modal de cierre ────────────────────────────────────────────────────────
    return (
        <div className="cc-overlay">
            <div className="cc-modal">

                {/* Header */}
                <div className="cc-header">
                    <div className="cc-header-left">
                        <div className="cc-header-icon"><FiDollarSign size={22} /></div>
                        <div>
                            <h2 className="cc-title">Cierre de Caja</h2>
                            <p className="cc-subtitle">
                                Turno abierto a las {fmtTime(register?.opened_at)}
                                {register?.opened_by_name && ` · ${register.opened_by_name}`}
                            </p>
                        </div>
                    </div>
                    <button className="cc-close" onClick={onClose}><FiX size={18} /></button>
                </div>

                <div className="cc-body">

                    {/* Columna izquierda */}
                    <div className="cc-left">

                        {/* Ventas */}
                        <div className="cc-section">
                            <h3 className="cc-section-title">
                                <FiShoppingCart size={14} /> Ventas del turno
                            </h3>
                            <div className="cc-summary-total">
                                <span>{fmt(salesSummary.total)}</span>
                                <span className="cc-summary-count">{salesSummary.count} ventas</span>
                            </div>
                            <div className="cc-payment-list">
                                {salesSummary.byPayment.length === 0 ? (
                                    <p className="cc-empty">Sin ventas en este turno</p>
                                ) : salesSummary.byPayment.map((p, i) => (
                                    <div key={i} className="cc-payment-row">
                                        <span className="cc-payment-icon">{PAYMENT_ICONS[p.payment_method] || '💰'}</span>
                                        <span className="cc-payment-name">{PAYMENT_LABELS[p.payment_method] || p.payment_method}</span>
                                        <span className="cc-payment-count">{p.count}</span>
                                        <span className="cc-payment-amount">{fmt(p.total)}</span>
                                    </div>
                                ))}
                            </div>

                            {salesDetail.length > 0 && (
                                <button className="cc-toggle-detail" onClick={() => setShowSales(v => !v)}>
                                    {showSales ? <FiChevronUp size={13}/> : <FiChevronDown size={13}/>}
                                    {showSales ? 'Ocultar' : `Ver ${salesDetail.length} ventas`}
                                </button>
                            )}

                            {showSales && (
                                <div className="cc-sales-table-wrap">
                                    <table className="cc-sales-table">
                                        <thead>
                                            <tr><th>N°</th><th>Hora</th><th>Pago</th><th>Total</th></tr>
                                        </thead>
                                        <tbody>
                                            {salesDetail.map((s, i) => (
                                                <tr key={i}>
                                                    <td>{s.sale_number}</td>
                                                    <td>{fmtTime(s.created_at)}</td>
                                                    <td><span className="cc-pm-badge">{PAYMENT_LABELS[s.payment_method] || s.payment_method}</span></td>
                                                    <td className="cc-amount-cell">{fmt(s.total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Movimientos */}
                        {movements.length > 0 && (
                            <div className="cc-section">
                                <h3 className="cc-section-title">Movimientos de efectivo</h3>
                                <div className="cc-movements-list">
                                    {movements.map((m, i) => (
                                        <div key={i} className={`cc-movement-row ${m.type}`}>
                                            {m.type === 'in' ? <FiArrowDownCircle size={14}/> : <FiArrowUpCircle size={14}/>}
                                            <span className="cc-mov-reason">{m.reason}</span>
                                            <span className="cc-mov-time">{fmtTime(m.created_at)}</span>
                                            <span className="cc-mov-amount">{m.type === 'in' ? '+' : '-'}{fmt(m.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Columna derecha */}
                    <div className="cc-right">

                        {/* Arqueo */}
                        <div className="cc-section cc-arqueo">
                            <h3 className="cc-section-title">Arqueo de caja</h3>
                            <div className="cc-arqueo-rows">
                                <div className="cc-arqueo-row">
                                    <span>Efectivo inicial</span><span>{fmt(register?.opening_amount)}</span>
                                </div>
                                {totalIn > 0 && (
                                    <div className="cc-arqueo-row in">
                                        <span>+ Ingresos manuales</span><span>+{fmt(totalIn)}</span>
                                    </div>
                                )}
                                {totalOut > 0 && (
                                    <div className="cc-arqueo-row out">
                                        <span>− Egresos manuales</span><span>−{fmt(totalOut)}</span>
                                    </div>
                                )}
                                <div className="cc-arqueo-row in">
                                    <span>+ Ventas en efectivo</span><span>+{fmt(cashSales)}</span>
                                </div>
                                <div className="cc-arqueo-divider" />
                                <div className="cc-arqueo-row total">
                                    <span>Efectivo esperado</span><span>{fmt(expectedCash)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Conteo físico */}
                        <div className="cc-section">
                            <h3 className="cc-section-title">¿Cuánto hay físicamente en caja?</h3>
                            <div className="cc-input-wrap">
                                <span className="cc-currency">$</span>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    value={closingAmount
                                        ? parseInt(closingAmount.replace(/\D/g,'') || '0').toLocaleString('es-CL')
                                        : ''}
                                    onChange={(e) => setClosingAmount(e.target.value.replace(/\D/g,''))}
                                    className="cc-input"
                                />
                                <span className="cc-currency-label">CLP</span>
                            </div>

                            {hasAmount && (
                                <div className={`cc-diff-box ${diffClass}`}>
                                    <div className="cc-diff-row">
                                        <span>Efectivo esperado</span><span>{fmt(expectedCash)}</span>
                                    </div>
                                    <div className="cc-diff-row">
                                        <span>Efectivo contado</span><span>{fmt(parsed)}</span>
                                    </div>
                                    <div className="cc-diff-total">
                                        <FiAlertCircle size={14} /> {diffLabel}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Notas */}
                        <div className="cc-section">
                            <h3 className="cc-section-title">Comentarios (opcional)</h3>
                            <textarea
                                className="cc-notes"
                                placeholder="Ej: La caja cuadra, se realizó pago de luz..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>

                        {/* Acciones */}
                        <div className="cc-actions">
                            <button className="cc-btn-cancel" onClick={onClose} disabled={loading}>
                                Cancelar
                            </button>
                            <button
                                className="cc-btn-close-cash"
                                onClick={handleConfirm}
                                disabled={loading || !hasAmount}
                            >
                                {loading ? <span className="cc-spinner" /> : (
                                    <><FiCheckCircle size={16} /> Cerrar Caja</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CashCloseModal;