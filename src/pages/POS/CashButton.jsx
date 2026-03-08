// src/pages/POS/CashButton.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
    FiDollarSign, FiArrowDownCircle, FiArrowUpCircle,
    FiXCircle, FiChevronDown, FiClock, FiAlertTriangle
} from 'react-icons/fi';
import './CashButton.css';

const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

// cashSettings: { limitAlert, withdrawalAmount } leído desde system_settings
// expectedCash: efectivo actual estimado en caja
const CashButton = ({ register, onMovement, onClose, expectedCash = 0, cashSettings = null }) => {
    const [open, setOpen] = useState(false);
    const dropdownRef     = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (!register) return null;

    const openedAt   = new Date(register.opened_at);
    const elapsed    = Math.floor((Date.now() - openedAt.getTime()) / 60000);
    const elapsedStr = elapsed < 60
        ? `${elapsed} min`
        : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`;

    // ── Alerta de exceso de efectivo ──────────────────────────────────────────
    const limitAlert      = cashSettings?.limitAlert      || 350000;
    const withdrawalAmount = cashSettings?.withdrawalAmount || 300000;
    const remainingAfter  = expectedCash - withdrawalAmount;
    const overLimit       = expectedCash > 0 && expectedCash >= limitAlert;

    return (
        <div className="cb-wrap" ref={dropdownRef}>
            <button
                className={`cb-btn ${open ? 'active' : ''} ${overLimit ? 'cb-btn--alert' : ''}`}
                onClick={() => setOpen(v => !v)}
                title="Gestión de caja"
            >
                {overLimit
                    ? <FiAlertTriangle size={15} className="cb-alert-icon" />
                    : <span className="cb-dot" />
                }
                <span className="cb-label">{overLimit ? '¡Retirar efectivo!' : 'Caja Abierta'}</span>
                <FiChevronDown size={13} className={`cb-chevron ${open ? 'rotated' : ''}`} />
            </button>

            {open && (
                <div className="cb-dropdown">

                    {/* ── Alerta de exceso de efectivo ── */}
                    {overLimit && (
                        <div className="cb-cash-alert">
                            <div className="cb-cash-alert-title">
                                <FiAlertTriangle size={14} />
                                Exceso de efectivo en caja
                            </div>
                            <p className="cb-cash-alert-body">
                                Hay <strong>{fmt(expectedCash)}</strong> en caja.
                                Se recomienda retirar <strong>{fmt(withdrawalAmount)}</strong> y
                                dejar <strong>{fmt(remainingAfter > 0 ? remainingAfter : expectedCash - withdrawalAmount)}</strong> como fondo de vuelto.
                            </p>
                            <button
                                className="cb-cash-alert-btn"
                                onClick={() => { setOpen(false); onMovement('out'); }}
                            >
                                Registrar retiro ahora →
                            </button>
                        </div>
                    )}

                    {/* ── Info del turno ── */}
                    <div className="cb-info">
                        <div className="cb-info-row">
                            <FiClock size={12} />
                            <span>Turno activo hace {elapsedStr}</span>
                        </div>
                        <div className="cb-info-row">
                            <FiDollarSign size={12} />
                            <span>Inicial: {fmt(register.opening_amount)}</span>
                        </div>
                        {expectedCash > 0 && (
                            <div className="cb-info-row">
                                <FiDollarSign size={12} />
                                <span>Efectivo estimado: {fmt(expectedCash)}</span>
                            </div>
                        )}
                    </div>
                    <div className="cb-divider" />

                    {/* ── Opciones ── */}
                    <button className="cb-option cb-option-in" onClick={() => { setOpen(false); onMovement('in'); }}>
                        <FiArrowDownCircle size={16} />
                        <div>
                            <span className="cb-opt-label">Ingreso de efectivo</span>
                            <span className="cb-opt-sub">Agregar dinero a la caja</span>
                        </div>
                    </button>
                    <button className="cb-option cb-option-out" onClick={() => { setOpen(false); onMovement('out'); }}>
                        <FiArrowUpCircle size={16} />
                        <div>
                            <span className="cb-opt-label">Egreso de efectivo</span>
                            <span className="cb-opt-sub">Retirar dinero de la caja</span>
                        </div>
                    </button>
                    <div className="cb-divider" />
                    <button className="cb-option cb-option-close" onClick={() => { setOpen(false); onClose(); }}>
                        <FiXCircle size={16} />
                        <div>
                            <span className="cb-opt-label">Cerrar Caja</span>
                            <span className="cb-opt-sub">Finalizar el turno</span>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};

export default CashButton;