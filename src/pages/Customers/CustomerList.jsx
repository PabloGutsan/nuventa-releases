import React, { useState, useEffect, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import CustomerRepository from '../../services/repositories/customerRepository';
import { exportCustomersToExcel, exportCustomersToPDF } from '../../services/export/customerExport';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import CustomerModal from './CustomerModal';
import CustomerDetailModal from './CustomerDetailModal';
import {
    FiPlus, FiSearch, FiEdit2, FiUsers,
    FiDollarSign, FiBriefcase, FiUser, FiXCircle, FiCheckCircle,
    FiChevronLeft, FiChevronRight, FiPhone, FiMail,
    FiDownload, FiRefreshCw, FiTrendingUp, FiEye
} from 'react-icons/fi';
import './CustomerList.css';

const PAGE_SIZE = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
    if (!d) return '-';
    try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return '-';
        const now  = new Date();
        const diff = Math.floor((now - date) / 86400000);
        if (diff === 0) return 'Hoy';
        if (diff === 1) return 'Ayer';
        if (diff < 7)   return `Hace ${diff} días`;
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: '2-digit' });
    } catch { return '-'; }
};

const restoreFocus = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    [50, 150, 300, 500].forEach(ms =>
        setTimeout(() => { if (document.activeElement !== ref.current) ref.current?.focus(); }, ms)
    );
};

// ── Modal de confirmación / éxito / alerta ────────────────────────────────────
const DIALOG_ICONS = { danger: '⚠️', success: '✅', primary: 'ℹ️', warning: '⚠️' };

const ConfirmDialog = ({ message, confirmLabel = 'Confirmar', confirmVariant = 'danger', onConfirm, onCancel }) => (
    <div className="cl-confirm-overlay" onClick={onCancel || undefined}>
        <div className="cl-confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="cl-confirm-icon">{DIALOG_ICONS[confirmVariant] || 'ℹ️'}</div>
            <p className="cl-confirm-message">{message}</p>
            <div className="cl-confirm-actions">
                {onCancel && (
                    <button className="cl-confirm-btn cl-confirm-btn--cancel" onClick={onCancel}>
                        Cancelar
                    </button>
                )}
                <button className={`cl-confirm-btn cl-confirm-btn--${confirmVariant}`} onClick={onConfirm}>
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ accent, icon: Icon, label, value, sub, valueColor }) => (
    <div className="stat-card-a" style={{ '--sc-accent': accent }}>
        <div className="sca-icon"><Icon size={20} color={accent} /></div>
        <div className="sca-body">
            <span className="sca-label">{label}</span>
            <span className="sca-value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
            {sub && <span className="sca-sub">{sub}</span>}
        </div>
    </div>
);

// ── Componente principal ──────────────────────────────────────────────────────
const CustomerList = () => {
    const { db } = useDatabase();

    const [customers,       setCustomers]       = useState([]);
    const [searchTerm,      setSearchTerm]      = useState('');
    const [filterActive,    setFilterActive]    = useState('all');
    const [showModal,       setShowModal]       = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);
    const [viewingCustomer, setViewingCustomer] = useState(null);
    const [loading,         setLoading]         = useState(true);
    const [exporting,       setExporting]       = useState(null);
    const [currentPage,     setCurrentPage]     = useState(1);
    const [dialog,          setDialog]          = useState(null);

    const searchInputRef = React.useRef(null);
    const customerRepo   = useMemo(() => new CustomerRepository(db), [db]);

    useEffect(() => { loadCustomers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setCurrentPage(1); }, [searchTerm, filterActive]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && dialog) {
                setDialog(null);
                restoreFocus(searchInputRef);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog]);

    const showConfirm = ({ message, confirmLabel, confirmVariant = 'danger', onConfirm }) => {
        setDialog({ message, confirmLabel, confirmVariant, onConfirm });
    };

    const showAlert = (message) => {
        setDialog({
            message,
            confirmLabel:    'Aceptar',
            confirmVariant:  'primary',
            onConfirm: () => { setDialog(null); restoreFocus(searchInputRef); },
            hideCancel: true,
        });
    };

    const showSuccess = (message) => {
        setDialog({
            message,
            confirmLabel:    'Aceptar',
            confirmVariant:  'success',
            onConfirm: () => { setDialog(null); restoreFocus(searchInputRef); },
            hideCancel: true,
        });
    };

    const loadCustomers = async () => {
        try {
            setLoading(true);
            const data = await customerRepo.getAll();
            setCustomers(Array.isArray(data) ? data : []);

            // Diagnóstico: ver datos de cliente en ventas (solo en dev)
            if (process.env.NODE_ENV === 'development') {
                console.log('🔍 Datos de cliente en ventas:');
                await customerRepo.diagSalesCustomerData();
                console.log('👥 Clientes cargados:', data?.map(c => ({
                    id: c.id, name: c.full_name, rut: c.rut, phone: c.phone,
                    purchases: c.purchases_count, total: c.total_purchased
                })));
            }
        } catch (error) {
            console.error('❌ Error loading customers:', error);
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    };

    // ── Filtrado ──────────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = [...customers];
        if (filterActive === 'active')   list = list.filter(c => c.is_active === 1);
        if (filterActive === 'inactive') list = list.filter(c => c.is_active === 0);
        if (filterActive === 'company')  list = list.filter(c => c.is_company);
        if (searchTerm.trim()) {
            const term      = searchTerm.toLowerCase().trim();
            const termClean = term.replace(/[.-]/g, '');
            list = list.filter(c => {
                const rut = (c.rut || '').toLowerCase();
                return (
                    (c.full_name    || '').toLowerCase().includes(term) ||
                    rut.includes(term) ||
                    rut.replace(/[.-]/g, '').includes(termClean) ||
                    (c.phone        || '').toLowerCase().includes(term) ||
                    (c.email        || '').toLowerCase().includes(term) ||
                    (c.company_name || '').toLowerCase().includes(term) ||
                    (c.city         || '').toLowerCase().includes(term) ||
                    (c.region       || '').toLowerCase().includes(term)
                );
            });
        }
        return list;
    }, [customers, searchTerm, filterActive]);

    // ── Paginación ────────────────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const goToPage   = (p) => setCurrentPage(Math.min(Math.max(1, p), totalPages));

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const totalRecaudado = customers.reduce((s, c) => s + (parseFloat(c.total_purchased) || 0), 0);
        const totalCompras   = customers.reduce((s, c) => s + (parseInt(c.purchases_count)   || 0), 0);
        const conCompras     = customers.filter(c => (parseInt(c.purchases_count) || 0) > 0).length;
        return {
            total:          customers.length,
            active:         customers.filter(c => c.is_active === 1).length,
            totalRecaudado,
            totalCompras,
            conCompras,
            ticketPromedio: totalCompras > 0 ? totalRecaudado / totalCompras : 0,
        };
    }, [customers]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleCreate = () => { setEditingCustomer(null); setShowModal(true); };
    const handleEdit   = (c) => { setEditingCustomer(c);   setShowModal(true); };
    const handleView   = (c) => setViewingCustomer(c);

    const handleToggleActive = (c) => {
        const action    = c.is_active ? 'desactivar' : 'activar';
        const actionCap = action.charAt(0).toUpperCase() + action.slice(1);
        const variant   = c.is_active ? 'danger' : 'success';
        const pastTense = c.is_active ? 'desactivado' : 'activado';

        showConfirm({
            message:        `¿${actionCap} al cliente "${c.full_name}"?`,
            confirmLabel:   actionCap,
            confirmVariant: variant,
            onConfirm: async () => {
                setDialog(null);
                try {
                    if (c.is_active) await customerRepo.deactivate(c.id);
                    else             await customerRepo.activate(c.id);
                    await loadCustomers();
                    showSuccess(`Cliente "${c.full_name}" ${pastTense} exitosamente.`);
                } catch (error) {
                    showAlert(`Error al ${action}: ${error.message}`);
                }
            }
        });
    };

    const handleSave = async () => { setShowModal(false); await loadCustomers(); };

    // ── Exportación ───────────────────────────────────────────────────────────
    const handleExport = async (type) => {
        if (filtered.length === 0) return;
        setExporting(type);
        try {
            const businessInfo = await window.electronAPI.database.get(
                'SELECT name FROM business_info WHERE id = 1'
            );
            const params = { customers: filtered, businessName: businessInfo?.name || 'Mi Negocio' };
            if (type === 'excel') await exportCustomersToExcel(params);
            else                  await exportCustomersToPDF(params);
        } catch (err) {
            showAlert('Error al exportar: ' + err.message);
        } finally {
            setExporting(null);
        }
    };

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabs = [
        { key: 'all',      label: 'Todos',     count: customers.length },
        { key: 'active',   label: 'Activos',   count: customers.filter(c => c.is_active === 1).length },
        { key: 'inactive', label: 'Inactivos', count: customers.filter(c => c.is_active === 0).length },
        { key: 'company',  label: 'Empresas',  count: customers.filter(c => c.is_company).length },
    ];

    if (loading) {
        return (
            <div className="main-content-scrollable">
                <div className="customer-list">
                    <div className="loading-container">
                        <div className="spinner" />
                        <p>Cargando clientes...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="main-content-scrollable">
            <div className="customer-list">

                {/* ── Header ── */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Clientes</h1>
                        <p className="page-subtitle">Gestiona tu base de clientes</p>
                    </div>
                    <div className="cl-header-actions">
                        <button className="rp-btn-export rp-btn-excel"
                            onClick={() => handleExport('excel')}
                            disabled={exporting !== null || filtered.length === 0}>
                            <FiDownload size={14} />
                            {exporting === 'excel' ? 'Exportando...' : 'Descargar Excel'}
                        </button>
                        <button className="rp-btn-export rp-btn-pdf"
                            onClick={() => handleExport('pdf')}
                            disabled={exporting !== null || filtered.length === 0}>
                            <FiDownload size={14} />
                            {exporting === 'pdf' ? 'Exportando...' : 'Descargar PDF'}
                        </button>
                        <button className="rp-refresh" onClick={loadCustomers} disabled={loading}>
                            <FiRefreshCw size={14} className={loading ? 'spin' : ''} />
                            Actualizar
                        </button>
                        <Button variant="primary" icon={<FiPlus />} onClick={handleCreate}>
                            Nuevo Cliente
                        </Button>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="cl-stats-grid">
                    <StatCard accent="#2563eb" icon={FiUsers}     label="Total Clientes"  value={stats.total}                 sub={`${stats.active} activos`} />
                    <StatCard accent="#10b981" icon={FiTrendingUp} label="Total Recaudado" value={fmtCLP(stats.totalRecaudado)} sub={`${stats.totalCompras} compras`} />
                    <StatCard accent="#8b5cf6" icon={FiDollarSign} label="Ticket Promedio" value={fmtCLP(stats.ticketPromedio)} sub={`${stats.conCompras} con historial`} />
                    <StatCard accent="#f59e0b" icon={FiBriefcase}  label="Empresas"        value={customers.filter(c => c.is_company).length} sub={`${customers.filter(c => !c.is_company).length} personas naturales`} />
                </div>

                {/* ── Toolbar ── */}
                <div className="cl-toolbar">
                    <div className="cl-tabs">
                        {tabs.map(tab => (
                            <button key={tab.key}
                                className={`cl-tab ${filterActive === tab.key ? 'active' : ''}`}
                                onClick={() => setFilterActive(tab.key)}>
                                {tab.label}
                                <span className="cl-tab-count">{tab.count}</span>
                            </button>
                        ))}
                    </div>
                    <div className="cl-search-wrap">
                        <FiSearch className="cl-search-icon" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar por nombre, RUN, teléfono, email, empresa, región..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="cl-search-input"
                        />
                        {searchTerm && (
                            <button className="cl-search-clear"
                                onClick={() => { setSearchTerm(''); restoreFocus(searchInputRef); }}>✕</button>
                        )}
                    </div>
                </div>

                {/* ── Tabla ── */}
                <Card>
                    {filtered.length === 0 ? (
                        <div className="empty-state">
                            <FiUsers size={48} />
                            <p>
                                {searchTerm || filterActive !== 'all'
                                    ? 'No se encontraron clientes con los filtros aplicados'
                                    : 'No hay clientes registrados aún'}
                            </p>
                            {!searchTerm && filterActive === 'all' && (
                                <Button variant="primary" icon={<FiPlus />} onClick={handleCreate} style={{ marginTop: 16 }}>
                                    Crear Primer Cliente
                                </Button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="sh-results-bar">
                                <span className="sh-results-count">
                                    {filtered.length === 1 ? '1 resultado' : `${filtered.length} resultados`}
                                    {searchTerm && <span className="sh-results-filter"> — «{searchTerm}»</span>}
                                </span>
                                {filtered.length > PAGE_SIZE && (
                                    <span className="sh-results-page">
                                        Mostrando {(currentPage - 1) * PAGE_SIZE + 1}
                                        –{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
                                    </span>
                                )}
                            </div>

                            <div className="table-container">
                                <table className="customers-table">
                                    <thead>
                                        <tr>
                                            <th>Cliente</th>
                                            <th>RUN</th>
                                            <th>Contacto</th>
                                            <th>Región</th>
                                            <th>Comuna</th>
                                            <th style={{ textAlign: 'center' }}>Compras</th>
                                            <th style={{ textAlign: 'right' }}>Total Gastado</th>
                                            <th>Últ. Compra</th>
                                            <th style={{ textAlign: 'center' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginated.map(c => {
                                            const purchasesCount  = parseInt(c.purchases_count)  || 0;
                                            const totalPurchased  = parseFloat(c.total_purchased) || 0;

                                            return (
                                                <tr key={c.id} className={!c.is_active ? 'cl-row-inactive' : ''}>
                                                    {/* Cliente */}
                                                    <td>
                                                        <div className="cl-name-cell">
                                                            <div className="cl-name-row">
                                                                <span className={`cl-type-badge ${c.is_company ? 'empresa' : 'persona'}`}>
                                                                    {c.is_company ? <FiBriefcase size={10} /> : <FiUser size={10} />}
                                                                    {c.is_company ? 'Empresa' : 'Persona'}
                                                                </span>
                                                                <strong className="cl-fullname">{c.full_name}</strong>
                                                            </div>
                                                            {c.company_name && <span className="cl-company-sub">{c.company_name}</span>}
                                                        </div>
                                                    </td>

                                                    {/* RUN */}
                                                    <td><span className="cl-rut">{c.rut || '—'}</span></td>

                                                    {/* Contacto */}
                                                    <td>
                                                        <div className="cl-contact-cell">
                                                            {c.phone && (
                                                                <a href={`tel:${c.phone}`} className="cl-contact-phone" title="Llamar">
                                                                    <FiPhone size={11} /> {c.phone}
                                                                </a>
                                                            )}
                                                            {c.email && (
                                                                <a href={`mailto:${c.email}`} className="cl-contact-email" title="Enviar email">
                                                                    <FiMail size={11} /> {c.email}
                                                                </a>
                                                            )}
                                                            {!c.phone && !c.email && <span className="cl-no-data">—</span>}
                                                        </div>
                                                    </td>

                                                    {/* Región */}
                                                    <td>
                                                        <span className="cl-region">{c.region || '—'}</span>
                                                    </td>

                                                    {/* Comuna (campo city en DB) */}
                                                    <td>
                                                        <span className="cl-city">{c.city || '—'}</span>
                                                    </td>

                                                    {/* Compras */}
                                                    <td style={{ textAlign: 'center' }}>
                                                        <span className={`cl-count-badge ${purchasesCount > 0 ? 'has-purchases' : ''}`}>
                                                            {purchasesCount}
                                                        </span>
                                                    </td>

                                                    {/* Total Gastado */}
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className={`cl-total ${totalPurchased > 0 ? 'positive' : ''}`}>
                                                            {fmtCLP(totalPurchased)}
                                                        </span>
                                                    </td>

                                                    {/* Última Compra */}
                                                    <td>
                                                        <span className={`cl-last-purchase ${!c.last_purchase_date ? 'never' : ''}`}>
                                                            {fmtDate(c.last_purchase_date)}
                                                        </span>
                                                    </td>

                                                    {/* Acciones */}
                                                    <td>
                                                        <div className="action-buttons-compact" style={{ justifyContent: 'center' }}>
                                                            <button className="action-btn-compact view"
                                                                onClick={() => handleView(c)} title="Ver detalle">
                                                                <FiEye />
                                                            </button>
                                                            <button className="action-btn-compact edit"
                                                                onClick={() => handleEdit(c)} title="Editar cliente">
                                                                <FiEdit2 />
                                                            </button>
                                                            <button
                                                                className={`action-btn-compact ${c.is_active ? 'cancel' : 'activate'}`}
                                                                onClick={() => handleToggleActive(c)}
                                                                title={c.is_active ? 'Desactivar cliente' : 'Activar cliente'}>
                                                                {c.is_active ? <FiXCircle /> : <FiCheckCircle />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Paginación ── */}
                            {totalPages > 1 && (
                                <div className="sh-pagination">
                                    <button className="sh-page-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                                        <FiChevronLeft />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                        .reduce((acc, p, idx, arr) => {
                                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((item, i) =>
                                            item === '...'
                                                ? <span key={`e-${i}`} className="sh-page-ellipsis">…</span>
                                                : <button key={item}
                                                    className={`sh-page-btn ${currentPage === item ? 'active' : ''}`}
                                                    onClick={() => goToPage(item)}>{item}</button>
                                        )}
                                    <button className="sh-page-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                                        <FiChevronRight />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </Card>
            </div>

            {/* ── Modales ── */}
            {showModal && (
                <CustomerModal
                    customer={editingCustomer}
                    onSave={handleSave}
                    onClose={() => setShowModal(false)}
                    db={db}
                />
            )}
            {viewingCustomer && (
                <CustomerDetailModal
                    customer={viewingCustomer}
                    onClose={() => setViewingCustomer(null)}
                    onEdit={(c) => { setViewingCustomer(null); handleEdit(c); }}
                />
            )}

            {/* ── Diálogo React ── */}
            {dialog && (
                <ConfirmDialog
                    message={dialog.message}
                    confirmLabel={dialog.confirmLabel}
                    confirmVariant={dialog.confirmVariant}
                    onConfirm={dialog.onConfirm}
                    onCancel={dialog.hideCancel ? null : () => {
                        setDialog(null);
                        restoreFocus(searchInputRef);
                    }}
                />
            )}
        </div>
    );
};

export default CustomerList;