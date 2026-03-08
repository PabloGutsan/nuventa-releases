import React, { useEffect } from 'react';
import {
    FiX, FiEdit2, FiUser, FiBriefcase,
    FiPhone, FiMail, FiMapPin, FiFileText,
    FiShoppingBag, FiDollarSign, FiCalendar, FiCreditCard
} from 'react-icons/fi';
import './CustomerDetailModal.css';

// ── Helpers de formato ────────────────────────────────────────────────────────
const fmtCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
    if (!d) return '—';
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return '—'; }
};

const fmtDateRelative = (d) => {
    if (!d) return '—';
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return '—';
        const diff = Math.floor((new Date() - date) / 86400000);
        if (diff === 0) return 'Hoy';
        if (diff === 1) return 'Ayer';
        if (diff < 7)  return `Hace ${diff} días`;
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch { return '—'; }
};

// ── Fila label/valor reutilizable ─────────────────────────────────────────────
const Row = ({ label, value, mono }) => (
    <div className="sdm-row">
        <span className="sdm-label">{label}</span>
        <span className={`sdm-value${mono ? ' sdm-mono' : ''}`}>{value || '—'}</span>
    </div>
);

// ── CustomerDetailModal ───────────────────────────────────────────────────────
const CustomerDetailModal = ({ customer, onClose, onEdit }) => {

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!customer) return null;

    const isCompany      = customer.is_company === 1 || customer.is_company === true;
    const purchasesCount = parseInt(customer.purchases_count)   || 0;
    const totalPurchased = parseFloat(customer.total_purchased) || 0;
    const ticketPromedio = purchasesCount > 0 ? totalPurchased / purchasesCount : 0;
    const initials       = (customer.full_name || '?').charAt(0).toUpperCase();

    return (
        <div className="sdm-overlay" onClick={onClose}>
            <div className="sdm-panel" onClick={(e) => e.stopPropagation()}>

                {/* ── Header ── */}
                <div className="sdm-header">
                    <div className="sdm-header-left">
                        <div className="sdm-avatar sdm-avatar--circle">
                            {initials}
                        </div>
                        <div>
                            <h2 className="sdm-title">{customer.full_name}</h2>
                            <div className="sdm-header-meta">
                                <span className={`sdm-type-badge ${isCompany ? 'empresa' : 'persona'}`}>
                                    {isCompany ? <FiBriefcase size={10} /> : <FiUser size={10} />}
                                    {isCompany ? 'Empresa' : 'Persona natural'}
                                </span>
                                {isCompany && customer.company_name && (
                                    <span className="sdm-subtitle">{customer.company_name}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="sdm-header-actions">
                        <span className={`sdm-badge ${customer.is_active ? 'badge-active' : 'badge-inactive'}`}>
                            {customer.is_active ? '✓ Activo' : '✗ Inactivo'}
                        </span>
                        <button className="sdm-btn-action" onClick={() => { onClose(); onEdit(customer); }}>
                            <FiEdit2 size={15} /> Editar
                        </button>
                        <button className="sdm-btn-close" onClick={onClose} title="Cerrar (ESC)">
                            <FiX size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="sdm-body">

                    {/* ── Fila 1: Identificación | Contacto | Dirección ── */}
                    <div className="sdm-info-grid">
                        <div className="sdm-card">
                            <div className="sdm-card-title"><FiUser size={13} /> Identificación</div>
                            <div className="sdm-rows">
                                <Row label="RUN"              value={customer.rut}                mono />
                                <Row label="Fecha nacimiento" value={fmtDate(customer.birth_date)} />
                                <Row label="Tipo"             value={isCompany ? 'Empresa' : 'Persona natural'} />
                            </div>
                        </div>

                        <div className="sdm-card">
                            <div className="sdm-card-title"><FiPhone size={13} /> Contacto</div>
                            <div className="sdm-rows">
                                <Row label="Teléfono" value={customer.phone} mono />
                                <Row label="Email"    value={customer.email} />
                            </div>
                        </div>

                        <div className="sdm-card">
                            <div className="sdm-card-title"><FiMapPin size={13} /> Dirección</div>
                            <div className="sdm-rows">
                                <Row label="Dirección" value={customer.address} />
                                <Row label="Comuna"    value={customer.city} />
                                <Row label="Región"    value={customer.region} />
                            </div>
                        </div>
                    </div>

                    {/* ── Stats de compras ── */}
                    <div className="sdm-stats-row">
                        <div className="sdm-stat-card">
                            <div className="sdm-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                                <FiShoppingBag size={18} />
                            </div>
                            <div className="sdm-stat-body">
                                <span className="sdm-stat-label">Compras realizadas</span>
                                <span className="sdm-stat-value">{purchasesCount}</span>
                            </div>
                        </div>
                        <div className="sdm-stat-card">
                            <div className="sdm-stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>
                                <FiDollarSign size={18} />
                            </div>
                            <div className="sdm-stat-body">
                                <span className="sdm-stat-label">Total gastado</span>
                                <span className="sdm-stat-value sdm-stat-green">{fmtCLP(totalPurchased)}</span>
                            </div>
                        </div>
                        <div className="sdm-stat-card">
                            <div className="sdm-stat-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
                                <FiCreditCard size={18} />
                            </div>
                            <div className="sdm-stat-body">
                                <span className="sdm-stat-label">Ticket promedio</span>
                                <span className="sdm-stat-value">{fmtCLP(ticketPromedio)}</span>
                            </div>
                        </div>
                        <div className="sdm-stat-card">
                            <div className="sdm-stat-icon" style={{ background: '#fffbeb', color: '#f59e0b' }}>
                                <FiCalendar size={18} />
                            </div>
                            <div className="sdm-stat-body">
                                <span className="sdm-stat-label">Última compra</span>
                                <span className="sdm-stat-value sdm-stat-sm">
                                    {fmtDateRelative(customer.last_purchase_date)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── Datos empresa (si aplica) ── */}
                    {isCompany && (
                        <div className="sdm-card">
                            <div className="sdm-card-title"><FiBriefcase size={13} /> Datos de la Empresa</div>
                            <div className="sdm-grid-2">
                                <div className="sdm-rows">
                                    <Row label="Nombre empresa" value={customer.company_name} />
                                    <Row label="RUT empresa"    value={customer.company_rut}   mono />
                                    <Row label="Teléfono"       value={customer.company_phone} mono />
                                    <Row label="Email"          value={customer.company_email} />
                                    <Row label="Sitio web"      value={customer.company_website} />
                                </div>
                                <div className="sdm-rows">
                                    <Row label="Dirección" value={customer.company_address} />
                                    <Row label="Comuna"    value={customer.company_city} />
                                    <Row label="Región"    value={customer.company_region} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Notas ── */}
                    <div className="sdm-card">
                        <div className="sdm-card-title"><FiFileText size={13} /> Notas / Observaciones</div>
                        {customer.notes?.trim() ? (
                            <p className="sdm-text">{customer.notes}</p>
                        ) : (
                            <p className="sdm-empty-note">Sin notas registradas.</p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CustomerDetailModal;