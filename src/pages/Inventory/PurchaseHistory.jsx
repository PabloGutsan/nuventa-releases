// src/pages/Inventory/PurchaseHistory.jsx
import React, { useState, useEffect, useRef } from 'react';
import Card from '../../components/common/Card';
import PurchaseRepository from '../../services/repositories/purchaseRepository';
import PurchaseDetailPanel from './PurchaseDetailPanel';
import PurchaseOrderModal from './PurchaseOrderModal';
import { useAuth } from '../../context/AuthContext';
import {
    exportPurchaseHistoryToExcel,
    exportPurchaseHistoryToPDF,
} from '../../services/export/purchaseHistoryExport';
import {
    FiTruck, FiSearch, FiEye, FiRefreshCw, FiDownload,
    FiFileText, FiCheckCircle, FiClock, FiDollarSign,
    FiEdit2, FiTrash2, FiAlertTriangle,
} from 'react-icons/fi';
import './PurchaseHistory.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = String(d).split('T')[0].split('-');
    return `${day}/${m}/${y}`;
};

const getLocalDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const StatCard = ({ accent, icon: Icon, label, value, sub }) => (
    <div className="stat-card-a" style={{ '--sc-accent': accent }}>
        <div className="sca-icon"><Icon size={20} color={accent} /></div>
        <div className="sca-body">
            <span className="sca-label">{label}</span>
            <span className="sca-value">{value}</span>
            {sub && <span className="sca-sub">{sub}</span>}
        </div>
    </div>
);

const StatusBadge = ({ status }) => {
    const map = {
        pagado:    { label: 'Pagado',    cls: 'ph-badge-paid'    },
        pendiente: { label: 'Pendiente', cls: 'ph-badge-pending' },
        parcial:   { label: 'Parcial',   cls: 'ph-badge-partial' },
    };
    const { label, cls } = map[status] || map.pendiente;
    return <span className={`status-badge ${cls}`}>{label}</span>;
};

const DocBadge = ({ type }) => {
    const labels = {
        factura: 'Factura', boleta: 'Boleta',
        nota_debito: 'Nota Déb.', sin_documento: 'Sin doc.',
    };
    return <span className="category-badge">{labels[type] || type || '—'}</span>;
};

// ── Modal de confirmación de eliminación ──────────────────────────────────────
const DeleteConfirmModal = ({ purchase, onConfirm, onCancel, deleting }) => (
    <div className="ph-delete-overlay" onClick={(e) => e.target === e.currentTarget && !deleting && onCancel()}>
        <div className="ph-delete-modal">
            <div className="ph-delete-icon">
                <FiAlertTriangle size={32} color="#ef4444" />
            </div>
            <h3 className="ph-delete-title">¿Eliminar esta compra?</h3>
            <p className="ph-delete-desc">
                Se eliminará la compra <strong>{purchase?.purchase_number}</strong> y todos sus ítems.
                <br />
                <span className="ph-delete-warn">⚠️ El stock de los productos ingresados en esta compra será revertido automáticamente.</span>
            </p>
            <div className="ph-delete-actions">
                <button className="ph-del-btn ph-del-btn--cancel" onClick={onCancel} disabled={deleting}>
                    Cancelar
                </button>
                <button className="ph-del-btn ph-del-btn--confirm" onClick={onConfirm} disabled={deleting}>
                    {deleting
                        ? <><span className="ph-mini-spin" /> Eliminando...</>
                        : <><FiTrash2 size={13} /> Eliminar compra</>}
                </button>
            </div>
        </div>
    </div>
);

// ── Modal de resultado (éxito o error) ───────────────────────────────────────
const ResultModal = ({ type, message, onClose }) => (
    <div className="ph-result-overlay" onClick={onClose}>
        <div className="ph-result-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`ph-result-icon ph-result-icon--${type}`}>
                <span>{type === 'success' ? '✅' : '⚠️'}</span>
            </div>
            <h3 className="ph-result-title">
                {type === 'success' ? 'Compra eliminada' : 'Error al eliminar'}
            </h3>
            <p className="ph-result-message">{message}</p>
            <button className={`ph-result-btn ph-result-btn--${type}`} onClick={onClose}>
                Aceptar
            </button>
        </div>
    </div>
);

const PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════════════════
const PurchaseHistory = () => {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';

    const [purchases,        setPurchases]        = useState([]);
    const [filtered,         setFiltered]         = useState([]);
    const [loading,          setLoading]          = useState(false);
    const [suppliers,        setSuppliers]        = useState([]);
    const [allProducts,      setAllProducts]      = useState([]);
    const [detailPurch,      setDetailPurch]      = useState(null);
    const [loadingDetail,    setLoadingDetail]    = useState(false);
    const [currentPage,      setCurrentPage]      = useState(1);
    const [showModal,        setShowModal]        = useState(false);
    const [editingPurchase,  setEditingPurchase]  = useState(null);
    const [deletingPurchase, setDeletingPurchase] = useState(null);
    const [deleting,         setDeleting]         = useState(false);
    const [exporting,        setExporting]        = useState(null);
    const [resultModal,      setResultModal]      = useState(null);
    // resultModal = { type: 'success' | 'error', message: string } | null

    // Filtros
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm,  setSearchTerm]  = useState('');
    const [dateFrom,    setDateFrom]    = useState('');
    const [dateTo,      setDateTo]      = useState('');
    const [supplierId,  setSupplierId]  = useState('all');
    const [payStatus,   setPayStatus]   = useState('all');
    const [docType,     setDocType]     = useState('all');

    const debounceRef  = useRef(null);
    const purchaseRepo = new PurchaseRepository();

    useEffect(() => {
        setDateFrom(getLocalDate(-30));
        setDateTo(getLocalDate());
    }, []);

    useEffect(() => {
        if (dateFrom && dateTo) { setCurrentPage(1); loadAll(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFrom, dateTo, supplierId, payStatus, docType]);

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchInput(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setSearchTerm(val); setCurrentPage(1); }, 400);
    };

    const loadAll = async () => {
        setLoading(true);
        try {
            const [pData, sData, prodData] = await Promise.all([
                purchaseRepo.getAll(),
                window.electronAPI.database.query(
                    'SELECT id, business_name FROM suppliers WHERE is_active = 1 ORDER BY business_name ASC'
                ),
                window.electronAPI.database.query(
                    'SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC'
                ),
            ]);
            setPurchases(Array.isArray(pData)      ? pData    : []);
            setSuppliers(Array.isArray(sData)      ? sData    : []);
            setAllProducts(Array.isArray(prodData) ? prodData : []);
        } catch (e) {
            console.error('Error cargando compras:', e);
        } finally {
            setLoading(false);
        }
    };

    const filtered_ = React.useMemo(() => {
        let list = [...purchases];
        if (dateFrom) list = list.filter(p => p.invoice_date >= dateFrom);
        if (dateTo)   list = list.filter(p => p.invoice_date <= dateTo);
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(p =>
                (p.purchase_number || '').toLowerCase().includes(q) ||
                (p.invoice_number  || '').toLowerCase().includes(q) ||
                (p.supplier_name   || '').toLowerCase().includes(q)
            );
        }
        if (supplierId !== 'all') list = list.filter(p => String(p.supplier_id) === supplierId);
        if (payStatus  !== 'all') list = list.filter(p => p.payment_status === payStatus);
        if (docType    !== 'all') list = list.filter(p => p.document_type   === docType);
        return list;
    }, [purchases, dateFrom, dateTo, searchTerm, supplierId, payStatus, docType]);

    useEffect(() => { setFiltered(filtered_); }, [filtered_]);

    const handleOpenDetail = async (p) => {
        setLoadingDetail(true);
        try {
            const detail = await purchaseRepo.getById(p.id);
            setDetailPurch(detail || p);
        } catch {
            setDetailPurch(p);
        } finally {
            setLoadingDetail(false);
        }
    };

    // ── Editar ────────────────────────────────────────────────────────────────
    const handleEdit = async (p, e) => {
        e.stopPropagation();
        try {
            const detail = await purchaseRepo.getById(p.id);
            setEditingPurchase(detail || p);
            setShowModal(true);
        } catch {
            setEditingPurchase(p);
            setShowModal(true);
        }
    };

    // ── Eliminar: pedir confirmación ──────────────────────────────────────────
    const handleDeleteRequest = (p, e) => {
        e.stopPropagation();
        setDeletingPurchase(p);
    };

    // ── Eliminar: confirmar y revertir stock ──────────────────────────────────
    const handleDeleteConfirm = async () => {
        if (!deletingPurchase) return;
        setDeleting(true);
        const purchaseNumber = deletingPurchase.purchase_number;
        try {
            const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);

            // 1. Obtener ítems para revertir stock
            const items = await window.electronAPI.database.query(
                'SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?',
                [deletingPurchase.id]
            );

            // 2. Revertir stock de cada producto (no afecta productos con stock ilimitado)
            for (const item of (items || [])) {
                try {
                    const prod = await window.electronAPI.database.get(
                        'SELECT stock, unlimited_stock FROM products WHERE id = ?',
                        [item.product_id]
                    );
                    if (prod && !prod.unlimited_stock) {
                        const newStock = Math.max(0, (parseFloat(prod.stock) || 0) - parseFloat(item.quantity));
                        await window.electronAPI.database.run(
                            'UPDATE products SET stock = ?, updated_at = ? WHERE id = ?',
                            [newStock, ts, item.product_id]
                        );
                    }
                } catch (stockErr) {
                    console.warn(`⚠️ No se pudo revertir stock del producto ${item.product_id}:`, stockErr.message);
                }
            }

            // 3. Eliminar ítems de la compra
            await window.electronAPI.database.run(
                'DELETE FROM purchase_items WHERE purchase_id = ?',
                [deletingPurchase.id]
            );

            // 4. Eliminar la compra
            await window.electronAPI.database.run(
                'DELETE FROM purchases WHERE id = ?',
                [deletingPurchase.id]
            );

            setDeletingPurchase(null);
            await loadAll();

            // Mostrar éxito
            setResultModal({
                type:    'success',
                message: `La compra ${purchaseNumber} fue eliminada exitosamente y el stock fue revertido.`,
            });
        } catch (err) {
            console.error('Error eliminando compra:', err);
            setDeletingPurchase(null);
            setResultModal({
                type:    'error',
                message: 'Error al eliminar: ' + err.message,
            });
        } finally {
            setDeleting(false);
        }
    };

    // ── Exportar ──────────────────────────────────────────────────────────────
    const handleExport = async (type) => {
        if (!filtered.length) return;
        setExporting(type);
        try {
            let businessName = 'Mi Negocio';
            try {
                const bi = await window.electronAPI.database.get(
                    'SELECT name FROM business_info WHERE id = 1'
                );
                if (bi?.name) businessName = bi.name;
            } catch { /* usar default */ }

            const activeSupplier = supplierId !== 'all'
                ? suppliers.find(s => String(s.id) === supplierId)?.business_name
                : null;

            const params = {
                purchases: filtered,
                filters: {
                    dateFrom, dateTo,
                    supplier:  activeSupplier,
                    payStatus: payStatus !== 'all' ? payStatus : null,
                    docType:   docType   !== 'all' ? docType   : null,
                    search:    searchTerm.trim()   || null,
                },
                businessName,
            };
            if (type === 'excel') await exportPurchaseHistoryToExcel(params);
            else                  await exportPurchaseHistoryToPDF(params);
        } catch (err) {
            console.error('Error al exportar:', err);
        } finally {
            setExporting(null);
        }
    };

    const hasActiveFilter = searchTerm.trim() !== '' || supplierId !== 'all' || payStatus !== 'all' || docType !== 'all';

    const periodStats = React.useMemo(() => ({
        total:       filtered.length,
        totalAmount: filtered.reduce((s, p) => s + (parseFloat(p.total) || 0), 0),
        pending:     filtered.reduce((s, p) =>
            p.payment_status !== 'pagado'
                ? s + Math.max(0, (parseFloat(p.total) || 0) - (parseFloat(p.paid_amount) || 0))
                : s, 0),
        iva: filtered.reduce((s, p) =>
            p.has_recoverable_tax ? s + (parseFloat(p.tax) || 0) : s, 0),
    }), [filtered]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pagedList  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    if (loading && purchases.length === 0) {
        return (
            <div className="main-content-scrollable">
                <div className="purchases-history">
                    <div className="loading-container">
                        <div className="spinner" /><p>Cargando historial de compras...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="main-content-scrollable">
            <div className="purchases-history">

                {/* ── HEADER ── */}
                <div className="page-header">
                    <div>
                        <h1 className="page-title">Historial de Compras</h1>
                        <p className="page-subtitle">Registro de todas las entradas de inventario y compras a proveedores</p>
                    </div>
                    <div className="header-actions">
                        <button className="rp-btn-export rp-btn-excel"
                            onClick={() => handleExport('excel')}
                            disabled={loading || exporting !== null || filtered.length === 0}>
                            <FiDownload size={14} />
                            {exporting === 'excel' ? 'Descargando...' : 'Descargar Excel'}
                        </button>
                        <button className="rp-btn-export rp-btn-pdf"
                            onClick={() => handleExport('pdf')}
                            disabled={loading || exporting !== null || filtered.length === 0}>
                            <FiDownload size={14} />
                            {exporting === 'pdf' ? 'Descargando...' : 'Descargar PDF'}
                        </button>
                        <button className="rp-refresh"
                            onClick={() => { setCurrentPage(1); loadAll(); }}
                            disabled={loading}>
                            <FiRefreshCw className={loading ? 'spin' : ''} /> Actualizar
                        </button>
                        <button className="ph-btn-register"
                            onClick={() => { setEditingPurchase(null); setShowModal(true); }}
                            disabled={loading}>
                            <FiTruck size={15} /> Registrar Compra
                        </button>
                    </div>
                </div>

                {hasActiveFilter && (
                    <div className="sh-filter-notice">
                        📊 Mostrando resultados filtrados
                        {searchTerm && <strong> — «{searchTerm}»</strong>}
                    </div>
                )}

                {/* ── STATS ── */}
                <div className="sales-stats-grid">
                    <StatCard accent="#2563eb" icon={FiFileText}       label="Compras"         value={periodStats.total}            sub="En el período" />
                    <StatCard accent="#10b981" icon={FiDollarSign}      label="Total Comprado"  value={fmt(periodStats.totalAmount)} sub="Suma de facturas" />
                    {periodStats.pending > 0 && (
                        <StatCard accent="#f59e0b" icon={FiClock}       label="Por Pagar"       value={fmt(periodStats.pending)}     sub="Saldo pendiente" />
                    )}
                    {periodStats.iva > 0 && (
                        <StatCard accent="#7c3aed" icon={FiCheckCircle} label="IVA Recuperable" value={fmt(periodStats.iva)}         sub="Facturas con IVA" />
                    )}
                </div>

                {/* ── FILTROS ── */}
                <Card>
                    <div className="filters-section">
                        <div className="ph-filters-row">
                            <div className="filter-group-sales">
                                <label>Búsqueda</label>
                                <div className="search-input-group">
                                    <FiSearch />
                                    <input type="text" placeholder="N° compra, N° doc. o proveedor..."
                                        value={searchInput} onChange={handleSearchChange} />
                                </div>
                            </div>
                            <div className="filter-group-sales">
                                <label>Desde</label>
                                <input type="date" value={dateFrom}
                                    onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                                    disabled={loading} />
                            </div>
                            <div className="filter-group-sales">
                                <label>Hasta</label>
                                <input type="date" value={dateTo}
                                    onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                                    disabled={loading} />
                            </div>
                            <div className="filter-group-sales">
                                <label>Proveedor</label>
                                <select value={supplierId}
                                    onChange={(e) => { setSupplierId(e.target.value); setCurrentPage(1); }}
                                    disabled={loading}>
                                    <option value="all">Todos</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={String(s.id)}>{s.business_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="filter-group-sales">
                                <label>Estado de pago</label>
                                <select value={payStatus}
                                    onChange={(e) => { setPayStatus(e.target.value); setCurrentPage(1); }}
                                    disabled={loading}>
                                    <option value="all">Todos</option>
                                    <option value="pagado">Pagado</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="parcial">Parcial</option>
                                </select>
                            </div>
                            <div className="filter-group-sales">
                                <label>Documento</label>
                                <select value={docType}
                                    onChange={(e) => { setDocType(e.target.value); setCurrentPage(1); }}
                                    disabled={loading}>
                                    <option value="all">Todos</option>
                                    <option value="factura">Factura</option>
                                    <option value="boleta">Boleta</option>
                                    <option value="nota_debito">Nota de débito</option>
                                    <option value="sin_documento">Sin documento</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* ── TABLA ── */}
                <Card>
                    <div className="table-container">
                        {loading ? (
                            <div className="loading-container">
                                <div className="spinner" /><p>Cargando compras...</p>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="empty-state">
                                <FiTruck size={48} />
                                <p>No se encontraron compras</p>
                                <span>Intenta ajustar los filtros de búsqueda</span>
                            </div>
                        ) : (
                            <>
                                <div className="sh-results-bar">
                                    <span className="sh-results-count">
                                        {filtered.length === 1 ? '1 resultado' : `${filtered.length} resultados`}
                                        {searchTerm && <span className="sh-results-filter"> — «{searchTerm}»</span>}
                                    </span>
                                    <span className="sh-results-page">
                                        Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
                                    </span>
                                </div>

                                <table className="products-table">
                                    <thead>
                                        <tr>
                                            <th>N° Compra</th>
                                            <th>Fecha</th>
                                            <th>Proveedor</th>
                                            <th>Documento</th>
                                            <th className="ph-ta-right">Prods.</th>
                                            <th className="ph-ta-right">Subtotal</th>
                                            <th className="ph-ta-right">IVA</th>
                                            <th className="ph-ta-right">Total</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedList.map(p => (
                                            <tr key={p.id} className="ph-row-clickable" onClick={() => handleOpenDetail(p)}>
                                                <td>
                                                    <div className="product-name-cell">
                                                        <strong className="ph-purchase-number">{p.purchase_number}</strong>
                                                        {p.invoice_number && (
                                                            <span className="product-desc">Doc: {p.invoice_number}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="ph-nowrap">{fmtDate(p.invoice_date)}</td>
                                                <td>{p.supplier_name || <span className="ph-muted">—</span>}</td>
                                                <td><DocBadge type={p.document_type} /></td>
                                                <td className="ph-ta-right items-count">{p.items_count || 0}</td>
                                                <td className="ph-ta-right">{fmt(p.subtotal)}</td>
                                                <td className="ph-ta-right ph-muted">
                                                    {parseFloat(p.tax) > 0 ? fmt(p.tax) : '—'}
                                                </td>
                                                <td className="ph-ta-right total-cell">{fmt(p.total)}</td>
                                                <td><StatusBadge status={p.payment_status} /></td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <div className="action-buttons">
                                                        <button
                                                            className="action-btn view"
                                                            title="Ver detalle"
                                                            onClick={(e) => { e.stopPropagation(); handleOpenDetail(p); }}
                                                            disabled={loadingDetail}>
                                                            {loadingDetail ? <span className="ph-mini-spin" /> : <FiEye />}
                                                        </button>
                                                        <button
                                                            className="action-btn edit"
                                                            title="Editar compra"
                                                            onClick={(e) => handleEdit(p, e)}>
                                                            <FiEdit2 />
                                                        </button>
                                                        {isAdmin && (
                                                            <button
                                                                className="action-btn delete"
                                                                title="Eliminar compra (solo admin)"
                                                                onClick={(e) => handleDeleteRequest(p, e)}>
                                                                <FiTrash2 />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="ph-tfoot">
                                            <td colSpan={5} className="ph-tfoot-label">
                                                Total ({filtered.length} compra{filtered.length !== 1 ? 's' : ''})
                                            </td>
                                            <td className="ph-ta-right">
                                                {fmt(filtered.reduce((s, p) => s + (parseFloat(p.subtotal)||0), 0))}
                                            </td>
                                            <td className="ph-ta-right ph-muted">
                                                {fmt(filtered.reduce((s, p) => s + (parseFloat(p.tax)||0), 0))}
                                            </td>
                                            <td className="ph-ta-right total-cell">
                                                {fmt(filtered.reduce((s, p) => s + (parseFloat(p.total)||0), 0))}
                                            </td>
                                            <td colSpan={2} />
                                        </tr>
                                    </tfoot>
                                </table>

                                {totalPages > 1 && (
                                    <div className="sh-pagination">
                                        <button className="sh-page-btn" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="Primera">«</button>
                                        <button className="sh-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                                            .reduce((acc, p, i, arr) => {
                                                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                                                acc.push(p); return acc;
                                            }, [])
                                            .map((item, i) => item === '...'
                                                ? <span key={`e-${i}`} className="sh-page-ellipsis">…</span>
                                                : <button key={item}
                                                    className={`sh-page-btn ${currentPage === item ? 'active' : ''}`}
                                                    onClick={() => setCurrentPage(item)}>{item}
                                                  </button>
                                            )}
                                        <button className="sh-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
                                        <button className="sh-page-btn" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Última">»</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Card>

                {/* Panel lateral de detalle */}
                {detailPurch && (
                    <PurchaseDetailPanel
                        purchase={detailPurch}
                        onClose={() => setDetailPurch(null)}
                    />
                )}

                {/* Modal registrar / editar compra */}
                {showModal && (
                    <PurchaseOrderModal
                        purchase={editingPurchase}
                        allProducts={allProducts}
                        suppliers={suppliers}
                        currentUser={currentUser}
                        onClose={() => { setShowModal(false); setEditingPurchase(null); }}
                        onSaved={async () => {
                            setShowModal(false);
                            setEditingPurchase(null);
                            await loadAll();
                        }}
                    />
                )}

                {/* Modal confirmar eliminación */}
                {deletingPurchase && (
                    <DeleteConfirmModal
                        purchase={deletingPurchase}
                        onConfirm={handleDeleteConfirm}
                        onCancel={() => setDeletingPurchase(null)}
                        deleting={deleting}
                    />
                )}

                {/* Modal resultado eliminación (éxito / error) */}
                {resultModal && (
                    <ResultModal
                        type={resultModal.type}
                        message={resultModal.message}
                        onClose={() => setResultModal(null)}
                    />
                )}

            </div>
        </div>
    );
};

export default PurchaseHistory;