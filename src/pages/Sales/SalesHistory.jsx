// src/pages/Sales/SalesHistory.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import SaleRepository from '../../services/repositories/saleRepository';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import SaleDetailModal from './SaleDetailModal';
import CancelSaleModal from './CancelSaleModal';
import { exportSalesHistoryToExcel, exportSalesHistoryToPDF } from '../../services/export/salesHistoryExport';
import {
    FiSearch, FiDollarSign, FiShoppingCart, FiTrendingUp,
    FiEye, FiXCircle, FiRefreshCw, FiChevronLeft, FiChevronRight,
    FiDownload,
} from 'react-icons/fi';
import './SalesHistory.css';

const PAGE_SIZE = 20;

// ── Helper: restaurar foco tras cerrar dialogs/modales (robusto Electron) ─────
const restoreFocus = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    [50, 150, 300, 500].forEach(ms =>
        setTimeout(() => { if (document.activeElement !== ref.current) ref.current?.focus(); }, ms)
    );
};

// ── Componente estadística ─────────────────────────────────────────────────────
const StatCard = ({ accent, icon: Icon, label, value, sub, valueColor }) => (
    <div className="stat-card-a" style={{ '--sc-accent': accent }}>
        <div className="sca-icon">
            <Icon size={20} color={accent} />
        </div>
        <div className="sca-body">
            <span className="sca-label">{label}</span>
            <span className="sca-value" style={valueColor ? { color: valueColor } : undefined}>
                {value}
            </span>
            {sub && <span className="sca-sub">{sub}</span>}
        </div>
    </div>
);

// ── Dialog React ───────────────────────────────────────────────────────────────
// Reemplaza window.alert, window.confirm y window.prompt
// mode: 'alert' | 'confirm' | 'prompt'
const SHDialog = ({ dialog, onClose }) => {
    const [inputValue, setInputValue] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        if (!dialog) return;
        if (dialog.mode === 'prompt') {
            setInputValue('');
            setTimeout(() => textareaRef.current?.focus(), 80);
        }
    }, [dialog]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && dialog) {
                if (dialog.onCancel) dialog.onCancel();
                else onClose?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog, onClose]);

    if (!dialog) return null;

    const { mode, title, message, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel } = dialog;

    const handleConfirm = () => {
        if (mode === 'prompt') {
            if (!inputValue.trim()) { textareaRef.current?.focus(); return; }
            onConfirm(inputValue.trim());
        } else {
            onConfirm();
        }
    };

    return (
        <div className="sh-dialog-overlay" onClick={onCancel || onClose}>
            <div className="sh-dialog" onClick={e => e.stopPropagation()}>
                <div className="sh-dialog-icon">
                    {confirmVariant === 'danger'  ? '⚠️' :
                     confirmVariant === 'success' ? '✅' : 'ℹ️'}
                </div>
                {title && <p className="sh-dialog-title">{title}</p>}
                <p className="sh-dialog-message">{message}</p>

                {mode === 'prompt' && (
                    <textarea
                        ref={textareaRef}
                        className="sh-dialog-textarea"
                        placeholder="Escribe el motivo de cancelación aquí..."
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        rows={3}
                        maxLength={300}
                    />
                )}

                <div className="sh-dialog-actions">
                    {(mode === 'confirm' || mode === 'prompt') && onCancel && (
                        <button className="sh-dialog-btn sh-dialog-btn--cancel" onClick={onCancel}>
                            Cancelar
                        </button>
                    )}
                    <button
                        className={`sh-dialog-btn sh-dialog-btn--${confirmVariant}`}
                        onClick={handleConfirm}
                        disabled={mode === 'prompt' && !inputValue.trim()}
                    >
                        {confirmLabel || 'Aceptar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── SalesHistory ───────────────────────────────────────────────────────────────
const SalesHistory = ({ salesFilter = 'all', currentUser: userProp }) => {
    const { db } = useDatabase();
    const { currentUser: authUser } = useAuth();
    const currentUser = userProp || authUser;

    const isOwnOnly = salesFilter === 'own';
    const isAdmin   = salesFilter === 'all';

    const [sales, setSales]           = useState([]);
    const [stats, setStats]           = useState({ total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0 });
    const [loading, setLoading]       = useState(false);
    const [exporting, setExporting]   = useState(null);

    const [searchInput, setSearchInput]     = useState('');
    const [searchTerm, setSearchTerm]       = useState('');
    const [dateFrom, setDateFrom]           = useState('');
    const [dateTo, setDateTo]               = useState('');
    const [paymentMethod, setPaymentMethod] = useState('all');
    const [sellerFilter, setSellerFilter]   = useState('all');
    const [showCancelled, setShowCancelled] = useState(false);
    const [sellers, setSellers]             = useState([]);
    const [currentPage, setCurrentPage]     = useState(1);

    const [selectedSale, setSelectedSale]         = useState(null);
    const [showDetailModal, setShowDetailModal]   = useState(false);
    const [cancelTarget, setCancelTarget]         = useState(null);

    // ── Dialog React ──────────────────────────────────────────────────────────
    const [dialog, setDialog] = useState(null);
    const searchRef = useRef(null);

    const closeDialog = useCallback(() => {
        setDialog(null);
        restoreFocus(searchRef);
    }, []);

    const showAlert = useCallback((message, variant = 'primary') => {
        setDialog({
            mode: 'alert', message, confirmVariant: variant, confirmLabel: 'Aceptar',
            onConfirm: () => { setDialog(null); restoreFocus(searchRef); },
        });
    }, []);

    const saleRepo    = new SaleRepository(db);
    const debounceRef = useRef(null);

    const getLocalDate = (offsetDays = 0) => {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    useEffect(() => {
        if (isOwnOnly) {
            const today = getLocalDate();
            setDateFrom(today);
            setDateTo(today);
        } else {
            setDateFrom(getLocalDate(-30));
            setDateTo(getLocalDate());
        }
    }, [isOwnOnly]);

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchInput(value);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setSearchTerm(value);
            setCurrentPage(1);
        }, 400);
    };

    useEffect(() => {
        if (dateFrom && dateTo) {
            setCurrentPage(1);
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFrom, dateTo, searchTerm, paymentMethod, sellerFilter, showCancelled]);

    useEffect(() => {
        if (dateFrom && dateTo) loadSellers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFrom, dateTo]);

    const loadData = async () => {
        setLoading(true);
        try {
            await Promise.all([loadSales(), loadStats()]);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadSales = async () => {
        try {
            const filters = {
                search:        searchTerm,
                dateFrom,
                dateTo,
                paymentMethod: paymentMethod !== 'all' ? paymentMethod : null,
                sellerName:    isOwnOnly ? null : (sellerFilter !== 'all' ? sellerFilter : null),
                userId:        isOwnOnly ? currentUser?.id : null,
                showCancelled,
            };
            const data = await saleRepo.getSalesFiltered(filters);
            setSales(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error loading sales:', err);
            setSales([]);
        }
    };

    const loadStats = async () => {
        try {
            const data = isOwnOnly
                ? await saleRepo.getUserDayStats(currentUser?.id, dateFrom)
                : await saleRepo.getPeriodStats(dateFrom, dateTo);
            if (!data || typeof data !== 'object') return;
            setStats({
                total_sales:     data.total_sales     || 0,
                total_revenue:   data.total_revenue   || 0,
                average_ticket:  data.average_ticket  || 0,
                cancelled_sales: data.cancelled_sales || 0,
            });
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    const loadSellers = async () => {
        if (isOwnOnly) return;
        try {
            const rows = await window.electronAPI.database.query(`
                SELECT DISTINCT u.full_name AS seller_name
                FROM sales s
                JOIN users u ON s.user_id = u.id
                WHERE DATE(s.created_at) BETWEEN ? AND ?
                ORDER BY u.full_name ASC
            `, [dateFrom, dateTo]);
            const list = Array.isArray(rows) ? rows.map(r => r.seller_name).filter(Boolean) : [];
            setSellers(list);
        } catch {
            const unique = [...new Set(sales.map(s => s.seller_name).filter(Boolean))].sort();
            setSellers(unique);
        }
    };

    const hasActiveFilter = searchTerm.trim() !== '' || paymentMethod !== 'all' || sellerFilter !== 'all';

    const filteredStats = useMemo(() => {
        if (!hasActiveFilter) return null;
        const active    = sales.filter(s => !s.is_cancelled);
        const revenue   = active.reduce((a, s) => a + (s.total || 0), 0);
        const cancelled = sales.filter(s => s.is_cancelled).length;
        return {
            total_sales:     active.length,
            total_revenue:   revenue,
            average_ticket:  active.length > 0 ? revenue / active.length : 0,
            cancelled_sales: cancelled,
        };
    }, [sales, hasActiveFilter]);

    const displayStats = filteredStats || stats;
    const totalPages   = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
    const pagedSales   = sales.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    // ── Ver detalle ───────────────────────────────────────────────────────────
    const handleViewDetail = async (sale) => {
        try {
            const detail = await saleRepo.getSaleById(sale.id);
            if (!detail) {
                showAlert('No se pudo cargar el detalle de la venta.', 'danger');
                return;
            }
            setSelectedSale(detail);
            setShowDetailModal(true);
        } catch (err) {
            showAlert(`Error al cargar el detalle: ${err.message}`, 'danger');
        }
    };

    // ── Cancelar venta ────────────────────────────────────────────────────────
    // Admin: Dialog React de 2 pasos (motivo → confirmación)
    // Vendedor: usa CancelSaleModal con autenticación de admin
    const handleCancelClick = useCallback((sale) => {
        if (sale.is_cancelled) {
            showAlert('Esta venta ya está cancelada.', 'primary');
            return;
        }

        if (!isAdmin) {
            // Vendedor: requiere autorización de admin → CancelSaleModal
            setCancelTarget(sale);
            return;
        }

        // Admin: paso 1 — pedir motivo
        setDialog({
            mode:           'prompt',
            title:          `Cancelar venta ${sale.sale_number}`,
            message:        'Ingresa el motivo de la cancelación. Se devolverá el stock de todos los productos incluidos.',
            confirmLabel:   'Continuar →',
            confirmVariant: 'danger',
            onCancel:       closeDialog,
            onConfirm:      (reason) => {
                // Paso 2 — confirmar con resumen
                setDialog({
                    mode:           'confirm',
                    title:          'Confirmar cancelación',
                    message:        `¿Cancelar definitivamente la venta ${sale.sale_number}?\n\nMotivo: "${reason}"\n\nEsta acción no se puede deshacer.`,
                    confirmLabel:   'Sí, cancelar venta',
                    confirmVariant: 'danger',
                    onCancel:       closeDialog,
                    onConfirm:      async () => {
                        setDialog(null);
                        try {
                            await saleRepo.cancelSale(sale.id, currentUser.id, reason);
                            await loadData();
                            setShowDetailModal(false);
                            showAlert('Venta cancelada exitosamente.', 'success');
                        } catch (err) {
                            showAlert(`Error al cancelar la venta: ${err.message}`, 'danger');
                        }
                    },
                });
            },
        });
    }, [isAdmin, saleRepo, currentUser, closeDialog, showAlert]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Cancelación desde CancelSaleModal (vendedor con auth de admin) ────────
    const handleCancelConfirm = async (sale, reason) => {
        try {
            await saleRepo.cancelSale(sale.id, currentUser.id, reason);
            setCancelTarget(null);
            setShowDetailModal(false);
            await loadData();
            showAlert('Venta cancelada exitosamente.', 'success');
        } catch (err) {
            console.error('Error al cancelar la venta:', err);
            throw err;
        }
    };

    // ── Exportación ───────────────────────────────────────────────────────────
    const handleExport = async (type) => {
        if (!sales.length) return;
        setExporting(type);
        try {
            let businessName = 'Mi Negocio';
            try {
                const bi = await window.electronAPI.database.get('SELECT name FROM business_info WHERE id = 1');
                if (bi?.name) businessName = bi.name;
            } catch { /* usar default */ }

            const params = {
                dateFrom, dateTo, sales, stats, businessName,
                searchTerm:    searchInput.trim() || searchTerm.trim(),
                paymentFilter: paymentMethod !== 'all' ? paymentMethod : '',
                sellerFilter:  sellerFilter  !== 'all' ? sellerFilter  : '',
            };
            if (type === 'excel') await exportSalesHistoryToExcel(params);
            else                  await exportSalesHistoryToPDF(params);
        } catch (err) {
            showAlert(`Error al exportar: ${err.message}`, 'danger');
        } finally {
            setExporting(null);
        }
    };

    // ── Formateadores ─────────────────────────────────────────────────────────
    const formatCurrency = (v) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(v || 0);

    const formatPaymentMethod = (m) => ({
        efectivo: 'Efectivo', tarjeta_debito: 'Débito',
        tarjeta_credito: 'Crédito', transferencia: 'Transferencia', multiple: 'Múltiple',
    }[m] || m);

    const formatDocumentType = (t) => ({
        boleta_fisica: 'Boleta Física', boleta_electronica: 'Boleta Electrónica',
        factura_fisica: 'Factura Física', factura_electronica: 'Factura Electrónica',
        sin_documento: 'Sin Documento',
    }[t] || t);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="main-content-scrollable">
            <div className="sales-history">

                {/* ── HEADER ── */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">
                            {isOwnOnly ? 'Mis Ventas de Hoy' : 'Historial de Ventas'}
                        </h1>
                        <p className="page-subtitle">
                            {isOwnOnly
                                ? `Ventas registradas hoy por ${currentUser?.full_name || currentUser?.username}`
                                : 'Administra y consulta todas las ventas'}
                        </p>
                    </div>
                    <div className="header-actions">
                        {isAdmin && (
                            <>
                                <button
                                    className="rp-btn-export rp-btn-excel"
                                    onClick={() => handleExport('excel')}
                                    disabled={loading || exporting !== null || sales.length === 0}>
                                    <FiDownload size={14} />
                                    {exporting === 'excel' ? 'Descargando...' : 'Descargar Excel'}
                                </button>
                                <button
                                    className="rp-btn-export rp-btn-pdf"
                                    onClick={() => handleExport('pdf')}
                                    disabled={loading || exporting !== null || sales.length === 0}>
                                    <FiDownload size={14} />
                                    {exporting === 'pdf' ? 'Descargando...' : 'Descargar PDF'}
                                </button>
                            </>
                        )}
                        <button
                            className="rp-refresh"
                            onClick={() => { setCurrentPage(1); loadData(); }}
                            disabled={loading}>
                            <FiRefreshCw className={loading ? 'spin' : ''} />
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* ── Avisos de filtro ── */}
                {isOwnOnly && (
                    <div className="sh-filter-notice">
                        📅 Mostrando solo tus ventas del día de hoy.
                        Para ver el historial completo contacta al administrador.
                    </div>
                )}
                {hasActiveFilter && (
                    <div className="sh-filter-notice">
                        📊 Métricas mostrando resultados filtrados
                        {searchTerm    && <strong> — «{searchTerm}»</strong>}
                        {sellerFilter !== 'all' && <strong> — {sellerFilter}</strong>}
                    </div>
                )}

                {/* ── STATS ── */}
                <div className="sales-stats-grid">
                    <StatCard accent="#2563eb" icon={FiShoppingCart}
                        label="Total Ventas" value={displayStats.total_sales} sub="En el período" />
                    <StatCard accent="#10b981" icon={FiDollarSign}
                        label="Ingresos Totales" value={formatCurrency(displayStats.total_revenue)} sub="Sin canceladas" />
                    <StatCard accent="#f59e0b" icon={FiTrendingUp}
                        label="Ticket Promedio" value={formatCurrency(displayStats.average_ticket)} sub="Por transacción" />
                    <StatCard accent="#ef4444" icon={FiXCircle}
                        label="Canceladas" value={displayStats.cancelled_sales}
                        valueColor={displayStats.cancelled_sales > 0 ? '#ef4444' : undefined}
                        sub="En el período" />
                </div>

                {/* ── FILTROS ── */}
                <Card>
                    <div className="filters-section">
                        <div className="filters-row">
                            <div className="filter-group-sales">
                                <label>Búsqueda</label>
                                <div className="search-input-group">
                                    <FiSearch />
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="N° venta, cliente, documento..."
                                        value={searchInput}
                                        onChange={handleSearchChange}
                                    />
                                </div>
                            </div>
                            <div className="filter-group-sales">
                                <label>Desde</label>
                                <input type="date" value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    disabled={loading || isOwnOnly} />
                            </div>
                            <div className="filter-group-sales">
                                <label>Hasta</label>
                                <input type="date" value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    disabled={loading || isOwnOnly} />
                            </div>
                            <div className="filter-group-sales">
                                <label>Método de Pago</label>
                                <select value={paymentMethod}
                                    onChange={(e) => { setPaymentMethod(e.target.value); setCurrentPage(1); }}
                                    disabled={loading}>
                                    <option value="all">Todos</option>
                                    <option value="efectivo">Efectivo</option>
                                    <option value="tarjeta_debito">Débito</option>
                                    <option value="tarjeta_credito">Crédito</option>
                                    <option value="transferencia">Transferencia</option>
                                </select>
                            </div>
                            {isAdmin && (
                                <div className="filter-group-sales">
                                    <label>Vendedor</label>
                                    <select value={sellerFilter}
                                        onChange={(e) => { setSellerFilter(e.target.value); setCurrentPage(1); }}
                                        disabled={loading || sellers.length === 0}>
                                        <option value="all">Todos</option>
                                        {sellers.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="filter-group-sales">
                                <label className="checkbox-label">
                                    <input type="checkbox" checked={showCancelled}
                                        onChange={(e) => { setShowCancelled(e.target.checked); setCurrentPage(1); }}
                                        disabled={loading} />
                                    <span>Mostrar canceladas</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* ── TABLA ── */}
                <Card>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading-container">
                                <div className="spinner" />
                                <p>Cargando ventas...</p>
                            </div>
                        ) : sales.length === 0 ? (
                            <div className="empty-state">
                                <FiShoppingCart size={48} />
                                <p>{isOwnOnly ? 'No tienes ventas registradas hoy' : 'No se encontraron ventas'}</p>
                                <span>Intenta ajustar los filtros de búsqueda</span>
                            </div>
                        ) : (
                            <>
                                <div className="sh-results-bar">
                                    <span className="sh-results-count">
                                        {sales.length === 1 ? '1 resultado' : `${sales.length} resultados`}
                                        {searchTerm && <span className="sh-results-filter"> — «{searchTerm}»</span>}
                                    </span>
                                    <span className="sh-results-page">
                                        Mostrando {(currentPage - 1) * PAGE_SIZE + 1}
                                        –{Math.min(currentPage * PAGE_SIZE, sales.length)} de {sales.length}
                                    </span>
                                </div>

                                <table className="sales-table">
                                    <thead>
                                        <tr>
                                            <th>N° Venta</th>
                                            <th>Fecha</th>
                                            <th>Cliente</th>
                                            {isAdmin && <th>Vendedor</th>}
                                            <th>Items</th>
                                            <th>Método Pago</th>
                                            <th>Documento</th>
                                            <th>Total</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedSales.map((sale) => (
                                            <tr key={sale.id} className={sale.is_cancelled ? 'cancelled-row' : ''}>
                                                <td className="sale-number">{sale.sale_number}</td>
                                                <td>
                                                    {new Date(sale.created_at).toLocaleString('es-CL', {
                                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                                        hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </td>
                                                <td>{sale.customer_name || '-'}</td>
                                                {isAdmin && <td>{sale.seller_name || '-'}</td>}
                                                <td className="items-count">{sale.items_count || 0} items</td>
                                                <td>
                                                    <span className="payment-badge-small">
                                                        {formatPaymentMethod(sale.payment_method)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="document-cell">
                                                        <span className="document-type">
                                                            {formatDocumentType(sale.document_type)}
                                                        </span>
                                                        {sale.document_number && (
                                                            <span className="document-number">N° {sale.document_number}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="total-cell">{formatCurrency(sale.total)}</td>
                                                <td>
                                                    {sale.is_cancelled
                                                        ? <span className="status-badge cancelled">Cancelada</span>
                                                        : <span className="status-badge active">Activa</span>}
                                                </td>
                                                <td>
                                                    <div className="action-buttons-compact">
                                                        <button className="action-btn-compact view"
                                                            onClick={() => handleViewDetail(sale)}
                                                            title="Ver detalle">
                                                            <FiEye />
                                                        </button>
                                                        {!sale.is_cancelled && (
                                                            <button
                                                                className="action-btn-compact cancel"
                                                                onClick={() => handleCancelClick(sale)}
                                                                title={isAdmin ? 'Cancelar venta' : 'Solicitar cancelación'}>
                                                                <FiXCircle />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* ── Paginación ── */}
                                {totalPages > 1 && (
                                    <div className="sh-pagination">
                                        <button className="sh-page-btn"
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1} title="Primera">«</button>
                                        <button className="sh-page-btn"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}>
                                            <FiChevronLeft />
                                        </button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                            .reduce((acc, p, i, arr) => {
                                                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                                acc.push(p);
                                                return acc;
                                            }, [])
                                            .map((item, i) =>
                                                item === '...' ? (
                                                    <span key={`e-${i}`} className="sh-page-ellipsis">…</span>
                                                ) : (
                                                    <button key={item}
                                                        className={`sh-page-btn ${currentPage === item ? 'active' : ''}`}
                                                        onClick={() => setCurrentPage(item)}>
                                                        {item}
                                                    </button>
                                                )
                                            )
                                        }
                                        <button className="sh-page-btn"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}>
                                            <FiChevronRight />
                                        </button>
                                        <button className="sh-page-btn"
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages} title="Última">»</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Card>

                {/* ── Modal de detalle ── */}
                {showDetailModal && selectedSale && (
                    <SaleDetailModal
                        sale={selectedSale}
                        onClose={() => {
                            setShowDetailModal(false);
                            restoreFocus(searchRef);
                        }}
                        onCancel={isAdmin
                            ? (sale) => { setShowDetailModal(false); handleCancelClick(sale); }
                            : (sale) => handleCancelClick(sale)
                        }
                        isAdmin={isAdmin}
                    />
                )}

                {/* ── Modal de cancelación con auth (vendedor no-admin) ── */}
                {cancelTarget && (
                    <CancelSaleModal
                        sale={cancelTarget}
                        isAdmin={isAdmin}
                        onConfirm={handleCancelConfirm}
                        onClose={() => {
                            setCancelTarget(null);
                            restoreFocus(searchRef);
                        }}
                    />
                )}

                {/* ── Dialog React: reemplaza window.alert / confirm / prompt ── */}
                <SHDialog dialog={dialog} onClose={closeDialog} />

            </div>
        </div>
    );
};

export default SalesHistory;