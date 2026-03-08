// src/pages/Cash/CashHistory.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FiDollarSign, FiCalendar,
    FiTrendingUp, FiTrendingDown, FiMinus,
    FiEye, FiDownload, FiPrinter, FiX, FiCheckCircle,
    FiSearch, FiRefreshCw
} from 'react-icons/fi';
import './CashHistory.css';
import CashDetailModal from './CashDetailModal';
import {
    fmtDate, fmtDuration, PAYMENT_LABELS,
    buildDetailTicket, exportCashHistoryExcel, exportCashHistoryPDF,
} from '../../services/export/cashExport';

const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const StatusBadge = ({ status }) =>
    status === 'open'
        ? <span className="ch-badge ch-badge--open">● Abierta</span>
        : <span className="ch-badge ch-badge--closed">✓ Cerrada</span>;

const DiffBadge = ({ diff }) => {
    if (diff === null || diff === undefined) return <span className="ch-diff ch-diff--na">—</span>;
    if (diff === 0)  return <span className="ch-diff ch-diff--ok"><FiMinus size={12}/> Exacta</span>;
    if (diff > 0)    return <span className="ch-diff ch-diff--surplus"><FiTrendingUp size={12}/> +{fmt(diff)}</span>;
    return                  <span className="ch-diff ch-diff--shortage"><FiTrendingDown size={12}/> {fmt(diff)}</span>;
};

const toSQLiteDate = (dt) => {
    if (!dt) return dt;
    if (!dt.includes('T')) return dt;
    const d = new Date(dt);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '
           +pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
};

const getLocalDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
};

const getNowSQLite = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '
           +pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
};

const PAGE_SIZE = 20;

// =============================================================================
// DETAIL MODAL
// =============================================================================

// =============================================================================
// FILA TABLA
// =============================================================================
const CashRow = ({ reg, onViewDetail }) => (
    <tr className="ch-row">
        <td>
            {fmtDate(reg.opened_at)}
            <div className="ch-cell-sub">{reg.opened_by_name}</div>
        </td>
        <td>
            {reg.closed_at
                ? <>{fmtDate(reg.closed_at)}<div className="ch-cell-sub">{reg.closed_by_name}</div></>
                : <span className="ch-cell-sub">En curso</span>}
        </td>
        <td><StatusBadge status={reg.status}/></td>
        <td className="ch-amount ch-amount--sales">{fmt(reg.total_sales)}</td>
        <td className="ch-amount">{fmt(reg.opening_amount)}</td>
        <td className="ch-amount">{reg.expected_cash != null ? fmt(reg.expected_cash) : '—'}</td>
        <td className="ch-amount">{reg.closing_amount != null ? fmt(reg.closing_amount) : '—'}</td>
        <td><DiffBadge diff={reg.difference}/></td>
        <td className="ch-duration">
            {fmtDuration(reg.opened_at, reg.closed_at) || (reg.status === 'open' ? '⏱ Activa' : '—')}
        </td>
        <td>
            <button className="ch-btn-eye" onClick={() => onViewDetail(reg)} title="Ver detalle">
                <FiEye size={15}/>
            </button>
        </td>
    </tr>
);

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
const CashHistory = () => {
    const [registers,    setRegisters]    = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [exporting,    setExporting]    = useState('');
    const [selectedReg,  setSelectedReg]  = useState(null);
    const [stats,        setStats]        = useState({ total: 0, open: 0, avgDiff: 0, totalShortage: 0 });
    const [searchInput,  setSearchInput]  = useState('');
    const [searchTerm,   setSearchTerm]   = useState('');
    const [dateFrom,     setDateFrom]     = useState(getLocalDate(-30));
    const [dateTo,       setDateTo]       = useState(getLocalDate());
    const [statusFilter, setStatusFilter] = useState('all');
    const [diffFilter,   setDiffFilter]   = useState('all');
    const [userFilter,   setUserFilter]   = useState('all');
    const [currentPage,  setCurrentPage]  = useState(1);
    const debounceRef = useRef(null);

    useEffect(() => { loadHistory(); }, []);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const rows = await window.electronAPI.database.query(
                'SELECT cr.*, ' +
                '  u1.full_name AS opened_by_name, ' +
                '  u2.full_name AS closed_by_name, ' +
                '  (SELECT COALESCE(SUM(s.total), 0) FROM sales s ' +
                '   WHERE s.is_cancelled = 0 ' +
                '     AND s.user_id = cr.opened_by ' +
                '     AND s.created_at >= cr.opened_at ' +
                '     AND (cr.closed_at IS NULL OR s.created_at <= cr.closed_at)' +
                '  ) AS total_sales ' +
                'FROM cash_registers cr ' +
                'LEFT JOIN users u1 ON cr.opened_by = u1.id ' +
                'LEFT JOIN users u2 ON cr.closed_by = u2.id ' +
                'ORDER BY cr.opened_at DESC LIMIT 500'
            );
            const data = Array.isArray(rows) ? rows : [];
            setRegisters(data);
            const closed   = data.filter(r => r.status === 'closed');
            const open     = data.filter(r => r.status === 'open');
            const shortage = closed.filter(r => r.difference < 0).reduce((s,r) => s + Math.abs(r.difference), 0);
            const avgDiff  = closed.length > 0
                ? closed.reduce((s,r) => s + (r.difference || 0), 0) / closed.length : 0;
            setStats({ total: data.length, open: open.length, avgDiff, totalShortage: shortage });
        } catch (err) {
            console.error('Error cargando historial:', err);
        } finally { setLoading(false); }
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchInput(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { setSearchTerm(val); setCurrentPage(1); }, 350);
    };

    const uniqueUsers = useMemo(() => {
        const names = new Set();
        registers.forEach(r => {
            if (r.opened_by_name) names.add(r.opened_by_name);
            if (r.closed_by_name) names.add(r.closed_by_name);
        });
        return [...names].sort();
    }, [registers]);

    const filtered = useMemo(() => {
        let list = [...registers];
        if (dateFrom) list = list.filter(r => (r.opened_at || '').slice(0,10) >= dateFrom);
        if (dateTo)   list = list.filter(r => (r.opened_at || '').slice(0,10) <= dateTo);
        if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
        if (diffFilter !== 'all') {
            list = list.filter(r => {
                const d = r.difference;
                if (diffFilter === 'exact')    return d === 0;
                if (diffFilter === 'surplus')  return d > 0;
                if (diffFilter === 'shortage') return d < 0;
                return true;
            });
        }
        if (userFilter !== 'all') {
            list = list.filter(r => r.opened_by_name === userFilter || r.closed_by_name === userFilter);
        }
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            list = list.filter(r =>
                (r.opened_by_name || '').toLowerCase().includes(q) ||
                (r.closed_by_name || '').toLowerCase().includes(q) ||
                (r.opened_at || '').toLowerCase().includes(q) ||
                (r.closed_at  || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [registers, dateFrom, dateTo, statusFilter, diffFilter, userFilter, searchTerm]);

    const filteredStats = useMemo(() => {
        const closed   = filtered.filter(r => r.status === 'closed');
        const open     = filtered.filter(r => r.status === 'open');
        const shortage = closed.filter(r => r.difference < 0).reduce((s,r) => s + Math.abs(r.difference), 0);
        const avgDiff  = closed.length > 0
            ? closed.reduce((s,r) => s + (r.difference || 0), 0) / closed.length : 0;
        return { total: filtered.length, open: open.length, avgDiff, totalShortage: shortage };
    }, [filtered]);

    const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged        = filtered.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE);
    const hasFilters   = !!(searchTerm.trim() || statusFilter !== 'all' || diffFilter !== 'all' || userFilter !== 'all');
    const displayStats = hasFilters ? filteredStats : stats;

    const handleExportExcel = async () => {
        setExporting('excel');
        await exportCashHistoryExcel(filtered.length ? filtered : registers);
        setExporting('');
    };
    const handleExportPDF = async () => {
        setExporting('pdf');
        await exportCashHistoryPDF(filtered.length ? filtered : registers);
        setExporting('');
    };
    const clearFilters = () => {
        setSearchInput(''); setSearchTerm('');
        setDateFrom(getLocalDate(-30)); setDateTo(getLocalDate());
        setStatusFilter('all'); setDiffFilter('all'); setUserFilter('all');
        setCurrentPage(1);
    };

    return (
        // ✅ FIX 1: Wrapper scrollable idéntico al de Reports
        <div className="main-content-scrollable">
            <div className="ch-page">

                {/* HEADER */}
                <div className="ch-header">
                    <div>
                        <h1 className="ch-title">Historial de Caja</h1>
                        <p className="ch-subtitle">Registro de aperturas y cierres de turno</p>
                    </div>
                    <div className="ch-header-actions">
                        <button className="ch-btn-excel" onClick={handleExportExcel}
                            disabled={exporting !== '' || registers.length === 0}>
                            {exporting === 'excel' ? <span className="ch-spinner-sm"/> : <FiDownload size={14}/>}
                            Descargar Excel
                        </button>
                        <button className="ch-btn-pdf" onClick={handleExportPDF}
                            disabled={exporting !== '' || registers.length === 0}>
                            {exporting === 'pdf' ? <span className="ch-spinner-sm"/> : <FiDownload size={14}/>}
                            Descargar PDF
                        </button>
                        <button className="ch-btn-refresh" onClick={loadHistory} disabled={loading}>
                            <FiRefreshCw size={14} className={loading ? 'ch-spin' : ''}/>
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* STATS */}
                <div className="ch-stats">
                    <div className="ch-stat-card">
                        <div className="ch-stat-icon" style={{ background: '#eff6ff' }}>
                            <FiCalendar size={20} color="#2563eb"/>
                        </div>
                        <div>
                            <p className="ch-stat-label">Total sesiones</p>
                            <p className="ch-stat-value">{displayStats.total}</p>
                        </div>
                    </div>
                    <div className="ch-stat-card">
                        <div className="ch-stat-icon" style={{ background: '#ecfdf5' }}>
                            <FiDollarSign size={20} color="#10b981"/>
                        </div>
                        <div>
                            <p className="ch-stat-label">Cajas abiertas</p>
                            <p className="ch-stat-value">{displayStats.open}</p>
                        </div>
                    </div>
                    <div className="ch-stat-card">
                        <div className="ch-stat-icon" style={{ background: displayStats.avgDiff >= 0 ? '#ecfdf5' : '#fff1f2' }}>
                            {displayStats.avgDiff >= 0
                                ? <FiTrendingUp size={20} color="#10b981"/>
                                : <FiTrendingDown size={20} color="#ef4444"/>}
                        </div>
                        <div>
                            <p className="ch-stat-label">Diferencia promedio</p>
                            <p className="ch-stat-value" style={{ color: displayStats.avgDiff >= 0 ? '#10b981' : '#ef4444' }}>
                                {displayStats.avgDiff >= 0 ? '+' : ''}{fmt(Math.round(displayStats.avgDiff))}
                            </p>
                        </div>
                    </div>
                    <div className="ch-stat-card">
                        <div className="ch-stat-icon" style={{ background: '#fff1f2' }}>
                            <FiTrendingDown size={20} color="#ef4444"/>
                        </div>
                        <div>
                            <p className="ch-stat-label">Faltantes acumulados</p>
                            <p className="ch-stat-value" style={{ color: '#ef4444' }}>
                                {displayStats.totalShortage > 0 ? fmt(displayStats.totalShortage) : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* FILTROS */}
                <div className="ch-filters-card">
                    <div className="ch-filters-row">
                        <div className="ch-filter-group">
                            <label className="ch-filter-label">Búsqueda</label>
                            <div className="ch-search-wrap">
                                <FiSearch size={14} className="ch-search-icon"/>
                                <input
                                    type="text"
                                    className="ch-search-input"
                                    placeholder="Usuario, fecha..."
                                    value={searchInput}
                                    onChange={handleSearchChange}
                                />
                            </div>
                        </div>
                        <div className="ch-filter-group">
                            <label className="ch-filter-label">Desde</label>
                            <input type="date" className="ch-filter-select" value={dateFrom}
                                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}/>
                        </div>
                        <div className="ch-filter-group">
                            <label className="ch-filter-label">Hasta</label>
                            <input type="date" className="ch-filter-select" value={dateTo}
                                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}/>
                        </div>
                        <div className="ch-filter-group">
                            <label className="ch-filter-label">Estado</label>
                            <select className="ch-filter-select" value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
                                <option value="all">Todos</option>
                                <option value="open">Abiertas</option>
                                <option value="closed">Cerradas</option>
                            </select>
                        </div>
                        <div className="ch-filter-group">
                            <label className="ch-filter-label">Diferencia</label>
                            <select className="ch-filter-select" value={diffFilter}
                                onChange={(e) => { setDiffFilter(e.target.value); setCurrentPage(1); }}>
                                <option value="all">Todas</option>
                                <option value="exact">Exactas</option>
                                <option value="surplus">Sobrante</option>
                                <option value="shortage">Faltante</option>
                            </select>
                        </div>
                        {uniqueUsers.length > 1 && (
                            <div className="ch-filter-group">
                                <label className="ch-filter-label">Usuario</label>
                                <select className="ch-filter-select" value={userFilter}
                                    onChange={(e) => { setUserFilter(e.target.value); setCurrentPage(1); }}>
                                    <option value="all">Todos</option>
                                    {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        )}
                        {hasFilters && (
                            <div className="ch-filter-group ch-filter-group--clear">
                                <label className="ch-filter-label">&nbsp;</label>
                                <button className="ch-btn-clear" onClick={clearFilters}>
                                    <FiX size={13}/> Limpiar
                                </button>
                            </div>
                        )}
                    </div>
                    {hasFilters && (
                        <div className="ch-filter-notice">
                            📊 Mostrando {filtered.length} de {registers.length} registros
                            {searchTerm && <strong> — «{searchTerm}»</strong>}
                        </div>
                    )}
                </div>

                {/* TABLA */}
                {loading ? (
                    <div className="ch-loading-state">
                        <div className="ch-spinner"/>
                        <p>Cargando historial...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="ch-empty-state">
                        <FiDollarSign size={48} color="#d1d5db"/>
                        <h3>{registers.length === 0 ? 'Sin registros de caja' : 'Sin resultados'}</h3>
                        <p>{registers.length === 0
                            ? 'Los turnos aparecerán aquí una vez que se realice la primera apertura'
                            : 'Intenta ajustar los filtros de búsqueda'}
                        </p>
                        {registers.length > 0 && (
                            <button className="ch-btn-clear" onClick={clearFilters} style={{marginTop:12}}>
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="ch-table-wrap">

                        {/* ✅ FIX 2: Barra de resultados — conteo a la derecha como badge, estilo Reports */}
                        <div className="ch-results-bar">
                            <div className="ch-results-bar-left">
                                {totalPages > 1 && (
                                    <span className="ch-results-page">
                                        Mostrando {(currentPage-1)*PAGE_SIZE+1}–{Math.min(currentPage*PAGE_SIZE, filtered.length)} de {filtered.length}
                                    </span>
                                )}
                            </div>
                            <div className="ch-results-bar-right">
                                <span className="ch-badge-count">
                                    {filtered.length} {filtered.length === 1 ? 'turno' : 'turnos'}
                                </span>
                                {totalPages > 1 && (
                                    <span className="ch-badge-page">
                                        Página {currentPage} / {totalPages}
                                    </span>
                                )}
                            </div>
                        </div>

                        <table className="ch-table">
                            <thead>
                                <tr>
                                    <th>Apertura</th><th>Cierre</th><th>Estado</th>
                                    <th>Total Ventas</th><th>Inicial</th><th>Esperado</th><th>Contado</th>
                                    <th>Diferencia</th><th>Duración</th><th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(reg => (
                                    <CashRow key={reg.id} reg={reg} onViewDetail={setSelectedReg}/>
                                ))}
                            </tbody>
                        </table>

                        {/* ✅ Paginador mejorado */}
                        {totalPages > 1 && (
                            <div className="ch-pagination">
                                <button className="ch-page-btn"
                                    onClick={() => setCurrentPage(1)}
                                    disabled={currentPage === 1}
                                    title="Primera página">«</button>
                                <button className="ch-page-btn"
                                    onClick={() => setCurrentPage(p => Math.max(1,p-1))}
                                    disabled={currentPage === 1}>‹</button>

                                {Array.from({length: totalPages},(_,i)=>i+1)
                                    .filter(p => p===1 || p===totalPages || Math.abs(p-currentPage)<=2)
                                    .reduce((acc,p,i,arr) => {
                                        if (i>0 && p-arr[i-1]>1) acc.push('...');
                                        acc.push(p);
                                        return acc;
                                    },[])
                                    .map((item,i) => item==='...'
                                        ? <span key={'e'+i} className="ch-page-ellipsis">…</span>
                                        : <button key={item}
                                            className={'ch-page-btn'+(currentPage===item?' active':'')}
                                            onClick={() => setCurrentPage(item)}>{item}</button>
                                    )
                                }

                                <button className="ch-page-btn"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))}
                                    disabled={currentPage === totalPages}>›</button>
                                <button className="ch-page-btn"
                                    onClick={() => setCurrentPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    title="Última página">»</button>
                            </div>
                        )}
                    </div>
                )}

            </div>

            {selectedReg && (
                <CashDetailModal reg={selectedReg} onClose={() => setSelectedReg(null)}/>
            )}
        </div>
    );
};

export default CashHistory;