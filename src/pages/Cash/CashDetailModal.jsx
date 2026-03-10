// src/pages/Cash/CashDetailModal.jsx
import React, { useState, useEffect } from 'react';
import {
    FiX, FiPrinter, FiDollarSign, FiCalendar,
    FiTrendingUp, FiTrendingDown, FiCheckCircle,
    FiClock, FiList, FiPackage,
} from 'react-icons/fi';
import {
    fmtDate, fmtDuration, PAYMENT_LABELS, buildDetailTicket,
} from '../../services/export/cashExport';
import './CashDetailModal.css';

const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const toSQLiteDate = (dt) => {
    if (!dt) return dt;
    if (!dt.includes('T')) return dt;
    const d = new Date(dt);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' '
        + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

const getNowSQLite = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' '
        + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

const CashDetailModal = ({ reg, onClose }) => {
    const [movements,      setMovements]      = useState([]);
    const [salesByPayment, setSalesByPayment] = useState([]);
    const [salesDetail,    setSalesDetail]    = useState([]);
    const [cashSalesGross, setCashSalesGross] = useState(0);
    const [loading,        setLoading]        = useState(true);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        const load = async () => {
            try {
                const openedAt = toSQLiteDate(reg.opened_at);
                const closedAt = reg.closed_at ? toSQLiteDate(reg.closed_at) : getNowSQLite();
                const userId   = reg.opened_by;

                const [movs, byPay, detail, cashGross] = await Promise.all([
                    // Movimientos de caja
                    window.electronAPI.database.query(
                        'SELECT cm.*, u.full_name AS user_name ' +
                        'FROM cash_movements cm ' +
                        'LEFT JOIN users u ON cm.user_id = u.id ' +
                        'WHERE cm.register_id = ? ORDER BY cm.created_at ASC',
                        [reg.id]
                    ),
                    // Ventas por método de pago — solo no canceladas (para el resumen visible)
                    window.electronAPI.database.query(
                        'SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total),0) AS total ' +
                        'FROM sales ' +
                        'WHERE is_cancelled = 0 ' +
                        '  AND created_at >= ? AND created_at <= ? ' +
                        '  AND user_id = ? ' +
                        'GROUP BY payment_method ORDER BY total DESC',
                        [openedAt, closedAt, userId]
                    ),
                    // Detalle de ventas — TODAS (incluso canceladas) para consistencia con arqueo
                    window.electronAPI.database.query(
                        'SELECT s.sale_number, s.total, s.payment_method, s.created_at, ' +
                        '       s.is_cancelled, u.full_name AS seller_name ' +
                        'FROM sales s LEFT JOIN users u ON s.user_id = u.id ' +
                        'WHERE s.created_at >= ? AND s.created_at <= ? ' +
                        '  AND s.user_id = ? ' +
                        'ORDER BY s.created_at ASC',
                        [openedAt, closedAt, userId]
                    ),
                    // Ventas en efectivo incluyendo canceladas — para el arqueo
                    window.electronAPI.database.get(
                        'SELECT COALESCE(SUM(total), 0) AS total ' +
                        'FROM sales ' +
                        'WHERE payment_method = \'efectivo\' ' +
                        '  AND created_at >= ? AND created_at <= ? ' +
                        '  AND user_id = ?',
                        [openedAt, closedAt, userId]
                    ),
                ]);

                setMovements(Array.isArray(movs) ? movs : []);
                setSalesByPayment(Array.isArray(byPay) ? byPay : []);
                setSalesDetail(Array.isArray(detail) ? detail : []);
                setCashSalesGross(cashGross?.total || 0);
            } catch (e) {
                console.error('Error cargando detalle de caja:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [reg.id, reg.opened_at, reg.closed_at, reg.opened_by]);

    const handlePrint = () => {
        const html = buildDetailTicket(reg, movements, salesByPayment, salesDetail);
        const w = window.open('', '_blank', 'width=420,height=750');
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); w.close(); }, 400);
    };

    const totalIn     = movements.filter(m => m.type === 'in').reduce((a, m) => a + m.amount, 0);
    const totalOut    = movements.filter(m => m.type === 'out').reduce((a, m) => a + m.amount, 0);
    const totalVentas = salesByPayment.reduce((a, p) => a + p.total, 0);
    const activeSales = salesDetail.filter(s => !s.is_cancelled).length;

    // Usar cashSalesGross (incluye canceladas) igual que calculateExpectedCash
    const calculatedExpected = (reg.opening_amount || 0) + totalIn - totalOut + cashSalesGross;
    const diff      = reg.closing_amount != null ? reg.closing_amount - calculatedExpected : null;
    const diffClass = diff == null ? '' : diff === 0 ? 'exact' : diff > 0 ? 'surplus' : 'shortage';
    const isOpen    = reg.status === 'open';

    if (!reg) return null;

    return (
        <div className="sdm-overlay" onClick={onClose}>
            <div className="sdm-panel sdm-panel--wide" onClick={(e) => e.stopPropagation()}>

                <div className="sdm-header">
                    <div className="sdm-header-left">
                        <div className="sdm-avatar"><FiDollarSign size={22} /></div>
                        <div>
                            <h2 className="sdm-title">Detalle del Turno</h2>
                            <div className="sdm-header-meta">
                                <span className="sdm-subtitle">{fmtDate(reg.opened_at)}</span>
                                {reg.opened_by_name && (
                                    <span className="sdm-subtitle">· {reg.opened_by_name}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="sdm-header-actions">
                        <span className={`sdm-badge ${isOpen ? 'badge-open' : 'badge-closed'}`}>
                            {isOpen ? '● Abierta' : '✓ Cerrada'}
                        </span>
                        <button className="sdm-btn-action" onClick={handlePrint}>
                            <FiPrinter size={15} /> Imprimir
                        </button>
                        <button className="sdm-btn-close" onClick={onClose} title="Cerrar (ESC)">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                <div className="sdm-body">
                    {loading ? (
                        <div className="sdm-loading-center">
                            <div className="sdm-spinner" />
                            <span>Cargando detalle...</span>
                        </div>
                    ) : (
                        <>
                            <div className="sdm-info-grid">
                                <div className="sdm-card">
                                    <div className="sdm-card-title"><FiCalendar size={13} /> Apertura</div>
                                    <div className="sdm-rows">
                                        <div className="sdm-row">
                                            <span className="sdm-label">Fecha y hora</span>
                                            <span className="sdm-value">{fmtDate(reg.opened_at)}</span>
                                        </div>
                                        <div className="sdm-row">
                                            <span className="sdm-label">Abierto por</span>
                                            <span className="sdm-value">{reg.opened_by_name || '—'}</span>
                                        </div>
                                        <div className="sdm-row">
                                            <span className="sdm-label">Efectivo inicial</span>
                                            <span className="sdm-value sdm-price-sale">{fmt(reg.opening_amount)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="sdm-card">
                                    <div className="sdm-card-title"><FiCheckCircle size={13} /> Cierre</div>
                                    <div className="sdm-rows">
                                        {reg.closed_at ? (
                                            <>
                                                <div className="sdm-row">
                                                    <span className="sdm-label">Fecha y hora</span>
                                                    <span className="sdm-value">{fmtDate(reg.closed_at)}</span>
                                                </div>
                                                <div className="sdm-row">
                                                    <span className="sdm-label">Cerrado por</span>
                                                    <span className="sdm-value">{reg.closed_by_name || '—'}</span>
                                                </div>
                                                <div className="sdm-row">
                                                    <span className="sdm-label">Efectivo contado</span>
                                                    <span className="sdm-value">{fmt(reg.closing_amount)}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <p className="sdm-empty-note">Turno aún abierto.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="sdm-card">
                                    <div className="sdm-card-title"><FiClock size={13} /> Resumen</div>
                                    <div className="sdm-rows">
                                        <div className="sdm-row">
                                            <span className="sdm-label">Duración</span>
                                            <span className="sdm-value">
                                                {fmtDuration(reg.opened_at, reg.closed_at) || (isOpen ? '⏱ En curso' : '—')}
                                            </span>
                                        </div>
                                        <div className="sdm-row">
                                            <span className="sdm-label">Total ventas</span>
                                            <span className="sdm-value sdm-profit-pos">{fmt(totalVentas)}</span>
                                        </div>
                                        <div className="sdm-row">
                                            <span className="sdm-label">Efectivo esperado</span>
                                            <span className="sdm-value">{fmt(calculatedExpected)}</span>
                                        </div>
                                        {diff != null && (
                                            <div className="sdm-row">
                                                <span className="sdm-label">Diferencia</span>
                                                <span className={`sdm-value sdm-diff--${diffClass}`}>
                                                    {diff === 0 ? 'Exacta'
                                                        : diff > 0 ? `+${fmt(diff)} sobrante`
                                                        : `${fmt(diff)} faltante`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Arqueo ── */}
                            <div className="sdm-card sdm-card--full">
                                <div className="sdm-card-title"><FiDollarSign size={13} /> Arqueo de Caja</div>
                                <div className="cdm-arqueo-grid">
                                    <div className="sdm-rows">
                                        <div className="sdm-row">
                                            <span className="sdm-label">Efectivo inicial</span>
                                            <span className="sdm-value">{fmt(reg.opening_amount)}</span>
                                        </div>
                                        {totalIn > 0 && (
                                            <div className="sdm-row">
                                                <span className="sdm-label">+ Ingresos manuales</span>
                                                <span className="sdm-value sdm-profit-pos">+{fmt(totalIn)}</span>
                                            </div>
                                        )}
                                        {totalOut > 0 && (
                                            <div className="sdm-row">
                                                <span className="sdm-label">− Egresos manuales</span>
                                                <span className="sdm-value sdm-profit-neg">−{fmt(totalOut)}</span>
                                            </div>
                                        )}
                                        <div className="sdm-row">
                                            <span className="sdm-label">+ Ventas en efectivo</span>
                                            <span className="sdm-value sdm-profit-pos">+{fmt(cashSalesGross)}</span>
                                        </div>
                                        <div className="cdm-arqueo-divider" />
                                        <div className="sdm-row cdm-arqueo-total">
                                            <span className="sdm-label">Efectivo esperado</span>
                                            <span className="sdm-value">{fmt(calculatedExpected)}</span>
                                        </div>
                                        {reg.closing_amount != null && (
                                            <div className="sdm-row cdm-arqueo-total">
                                                <span className="sdm-label">Efectivo contado</span>
                                                <span className="sdm-value">{fmt(reg.closing_amount)}</span>
                                            </div>
                                        )}
                                    </div>
                                    {diff != null && (
                                        <div className={`cdm-diff-banner cdm-diff-banner--${diffClass}`}>
                                            {diff === 0
                                                ? <><FiCheckCircle size={20} /> <span>Cuadre exacto</span></>
                                                : diff > 0
                                                    ? <><FiTrendingUp size={20} /> <span>Sobrante: {fmt(diff)}</span></>
                                                    : <><FiTrendingDown size={20} /> <span>Faltante: {fmt(Math.abs(diff))}</span></>
                                            }
                                        </div>
                                    )}
                                </div>
                                {reg.notes && (
                                    <div className="cdm-notes-box">
                                        📝 <strong>Notas:</strong> {reg.notes}
                                    </div>
                                )}
                            </div>

                            {/* ── Ventas del turno por método de pago ── */}
                            <div className="sdm-card sdm-card--full">
                                <div className="sdm-card-title">
                                    <FiDollarSign size={13} /> Ventas del Turno
                                    <span className="sdm-count-badge">{activeSales}</span>
                                    <span className="cdm-total-ventas">{fmt(totalVentas)}</span>
                                </div>
                                {salesByPayment.length === 0 ? (
                                    <p className="sdm-empty-note">Sin ventas en este turno.</p>
                                ) : (
                                    <div className="cdm-pay-list">
                                        {salesByPayment.map((p, i) => (
                                            <div key={i} className="cdm-pay-row">
                                                <span className="cdm-pay-name">
                                                    {PAYMENT_LABELS[p.payment_method] || p.payment_method}
                                                </span>
                                                <span className="cdm-pay-count">{p.count} venta{p.count !== 1 ? 's' : ''}</span>
                                                <span className="cdm-pay-amount">{fmt(p.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Detalle de ventas ── */}
                            {salesDetail.length > 0 && (
                                <div className="sdm-card sdm-card--full">
                                    <div className="sdm-card-title">
                                        <FiList size={13} /> Detalle de Ventas
                                        <span className="sdm-count-badge">{activeSales}</span>
                                    </div>
                                    <div className="sdm-table-wrap">
                                        <table className="sdm-table">
                                            <thead>
                                                <tr>
                                                    <th>N° Venta</th>
                                                    <th>Hora</th>
                                                    <th>Vendedor</th>
                                                    <th>Forma de pago</th>
                                                    <th style={{ textAlign: 'right' }}>Total</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {salesDetail.map((s, i) => (
                                                    <tr key={i} style={s.is_cancelled ? { opacity: 0.55 } : {}}>
                                                        <td><span className="sdm-mono">{s.sale_number}</span></td>
                                                        <td>
                                                            {new Date((s.created_at || '').replace(' ', 'T'))
                                                                .toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td>{s.seller_name || '—'}</td>
                                                        <td>
                                                            <span className="cdm-pm-badge">
                                                                {PAYMENT_LABELS[s.payment_method] || s.payment_method}
                                                            </span>
                                                        </td>
                                                        <td style={{
                                                            textAlign: 'right',
                                                            textDecoration: s.is_cancelled ? 'line-through' : 'none',
                                                            color: s.is_cancelled ? '#9ca3af' : 'inherit',
                                                        }}>
                                                            <strong>{fmt(s.total)}</strong>
                                                        </td>
                                                        <td>
                                                            {s.is_cancelled ? (
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    padding: '2px 7px',
                                                                    borderRadius: '4px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 600,
                                                                    background: '#fee2e2',
                                                                    color: '#dc2626',
                                                                    whiteSpace: 'nowrap',
                                                                }}>Cancelada</span>
                                                            ) : null}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ── Movimientos de efectivo ── */}
                            {movements.length > 0 && (
                                <div className="sdm-card sdm-card--full">
                                    <div className="sdm-card-title">
                                        <FiPackage size={13} /> Movimientos de Efectivo
                                        <span className="sdm-count-badge">{movements.length}</span>
                                    </div>
                                    <div className="cdm-mov-list">
                                        {movements.map((m, i) => (
                                            <div key={i} className={`cdm-mov cdm-mov--${m.type}`}>
                                                <span className="cdm-mov-arrow">{m.type === 'in' ? '↓' : '↑'}</span>
                                                <span className="cdm-mov-reason">{m.reason}</span>
                                                <span className="cdm-mov-user">{m.user_name}</span>
                                                <span className="cdm-mov-amount">
                                                    {m.type === 'in' ? '+' : '−'}{fmt(m.amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CashDetailModal;