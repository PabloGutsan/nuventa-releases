import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, LabelList
} from 'recharts';
import {
    FiTrendingUp, FiShoppingBag, FiDollarSign, FiPercent,
    FiCalendar, FiAlertCircle, FiRefreshCw
} from 'react-icons/fi';
import './Reports.css';
import { exportToExcel, exportToPDF } from '../../services/export/reportExport';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtN = (n) =>
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n || 0);

const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) : '0.0');

const localDate = (d) => {
    const [y, m, day] = d.split('-');
    return new Date(Number(y), Number(m) - 1, Number(day));
};

const toISO = (d) => {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const MONTHS_ES_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const PERIODS = [
    { id: 'days8',  label: 'Últimos 8 días' },
    { id: 'months', label: 'Últimos 13 meses' },
    { id: 'years',  label: 'Últimos 5 años' },
    { id: 'custom', label: 'Personalizado' }
];

const PAYMENT_LABELS = {
    efectivo: 'Efectivo',
    tarjeta_debito: 'Débito',
    tarjeta_credito: 'Crédito',
    transferencia: 'Transferencia',
    multiple: 'Múltiple'
};

const PAYMENT_COLORS = {
    efectivo: '#10b981',
    tarjeta_debito: '#2563eb',
    tarjeta_credito: '#7c3aed',
    transferencia: '#f59e0b',
    multiple: '#6b7280'
};

// ─── Tooltip personalizado ───────────────────────────────────────────────────

const StackedTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const costo    = payload.find(p => p.dataKey === 'Costo')?.value    || 0;
    const utilidad = payload.find(p => p.dataKey === 'Utilidad')?.value || 0;
    const total    = costo + utilidad;
    const margen   = total > 0 ? ((utilidad / total) * 100).toFixed(1) : '0.0';
    return (
        <div className="rp-tooltip">
            <p className="rp-tooltip-label">📅 {label}</p>
            <div className="rp-tooltip-divider" />
            <p className="rp-tooltip-row" style={{ color: '#6b7280' }}>
                <span>Venta total:</span><strong>{fmt(total)}</strong>
            </p>
            <p className="rp-tooltip-row" style={{ color: '#ef4444' }}>
                <span>Costo:</span><strong>{fmt(costo)}</strong>
            </p>
            <p className="rp-tooltip-row" style={{ color: '#10b981' }}>
                <span>Utilidad:</span><strong>{fmt(utilidad)}</strong>
            </p>
            <div className="rp-tooltip-divider" />
            <p className="rp-tooltip-margin">Margen: {margen}%</p>
        </div>
    );
};

// ─── Componente principal ────────────────────────────────────────────────────

const Reports = () => {
    const now = new Date();
    const todayISO = toISO(now);

    const [period, setPeriod] = useState('days8');
    const days8From = new Date(now); days8From.setDate(now.getDate() - 7);
    const [dateFrom, setDateFrom] = useState(toISO(days8From));
    const [dateTo, setDateTo]     = useState(todayISO);
    const [loading, setLoading]   = useState(true);

    const [summary, setSummary]         = useState({ sales: 0, cost: 0, profit: 0, count: 0, avg: 0 });
    const [prevSummary, setPrevSummary] = useState({ sales: 0, cost: 0, profit: 0, count: 0 });
    const [chartData, setChartData]     = useState([]);
    const [paymentData, setPaymentData] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [noMovement, setNoMovement]   = useState([]);
    const [bySeller, setBySeller]       = useState([]);
    const [exporting, setExporting]     = useState(null);
    const [showAllProds, setShowAllProds]           = useState(false);
    const [showAllNoMovement, setShowAllNoMovement] = useState(false);
    const NO_MOV_PREVIEW = 15;
    const PROD_PREVIEW   = 15;

    const applyPeriod = (p) => {
        setPeriod(p);
        setShowAllProds(false);
        setShowAllNoMovement(false);
        const y = now.getFullYear();
        const m = now.getMonth();
        if (p === 'days8') {
            const from = new Date(now); from.setDate(now.getDate() - 7);
            setDateFrom(toISO(from)); setDateTo(todayISO);
        } else if (p === 'months') {
            const from = new Date(y, m - 12, 1);
            const to   = new Date(y, m + 1, 0);
            setDateFrom(toISO(from)); setDateTo(toISO(to));
        } else if (p === 'years') {
            setDateFrom(`${y - 4}-01-01`); setDateTo(todayISO);
        }
    };

    const loadData = async () => {
        if (!dateFrom || !dateTo) return;
        setLoading(true);
        try {
            await Promise.all([
                loadSummary(), loadPrevSummary(), loadChart(),
                loadPayments(), loadTopProducts(), loadNoMovement(), loadBySeller()
            ]);
        } catch (err) {
            console.error('Error loading reports:', err);
        } finally {
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadData(); }, [dateFrom, dateTo]);

    const loadSummary = async () => {
        const rows = await window.electronAPI.database.query(`
            SELECT
                COALESCE(SUM(s.total), 0)                        AS sales,
                COALESCE(SUM(si.cost_price * si.quantity), 0)    AS cost,
                COUNT(DISTINCT s.id)                             AS count
            FROM sales s
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE s.is_cancelled = 0
              AND DATE(s.created_at) BETWEEN ? AND ?
        `, [dateFrom, dateTo]);
        const r = rows[0] || {};
        const sales = r.sales || 0;
        const cost  = r.cost  || 0;
        const count = r.count || 0;
        setSummary({ sales, cost, profit: sales - cost, count, avg: count > 0 ? sales / count : 0 });
    };

    const loadPrevSummary = async () => {
        const from = localDate(dateFrom);
        const to   = localDate(dateTo);
        const diff = Math.round((to - from) / 86400000) + 1;
        const pFrom = new Date(from); pFrom.setDate(pFrom.getDate() - diff);
        const pTo   = new Date(from); pTo.setDate(pTo.getDate() - 1);
        const rows = await window.electronAPI.database.query(`
            SELECT
                COALESCE(SUM(s.total), 0)                     AS sales,
                COALESCE(SUM(si.cost_price * si.quantity), 0) AS cost,
                COUNT(DISTINCT s.id)                          AS count
            FROM sales s
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE s.is_cancelled = 0
              AND DATE(s.created_at) BETWEEN ? AND ?
        `, [toISO(pFrom), toISO(pTo)]);
        const r = rows[0] || {};
        setPrevSummary({
            sales: r.sales || 0, cost: r.cost || 0,
            profit: (r.sales || 0) - (r.cost || 0), count: r.count || 0
        });
    };

    const loadChart = async () => {
        let granularity = 'day';
        if (period === 'months') {
            granularity = 'month';
        } else if (period === 'years') {
            granularity = 'year';
        } else if (period === 'custom' || period === 'days8') {
            const diff = Math.round((localDate(dateTo) - localDate(dateFrom)) / 86400000);
            if (diff > 730)     granularity = 'year';
            else if (diff > 31) granularity = 'month';
            else                granularity = 'day';
        }

        let sql, mapper;

        if (granularity === 'year') {
            sql = `
                SELECT strftime('%Y', s.created_at) AS grp,
                    COALESCE(SUM(s.total), 0)                     AS sales,
                    COALESCE(SUM(si.cost_price * si.quantity), 0)  AS cost
                FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
                WHERE s.is_cancelled = 0 AND DATE(s.created_at) BETWEEN ? AND ?
                GROUP BY grp ORDER BY grp ASC`;
            mapper = r => ({ day: r.grp, Costo: Math.round(r.cost),
                Utilidad: Math.round(Math.max(0, r.sales - r.cost)), _total: Math.round(r.sales) });

        } else if (granularity === 'month') {
            sql = `
                SELECT strftime('%Y-%m', s.created_at) AS grp,
                    COALESCE(SUM(s.total), 0)                     AS sales,
                    COALESCE(SUM(si.cost_price * si.quantity), 0)  AS cost
                FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
                WHERE s.is_cancelled = 0 AND DATE(s.created_at) BETWEEN ? AND ?
                GROUP BY grp ORDER BY grp ASC`;
            mapper = r => {
                const [y, m] = r.grp.split('-');
                return { day: `${MONTHS_ES_FULL[parseInt(m)-1]} ${y}`,
                    Costo: Math.round(r.cost),
                    Utilidad: Math.round(Math.max(0, r.sales - r.cost)),
                    _total: Math.round(r.sales) };
            };

        } else {
            sql = `
                SELECT DATE(s.created_at) AS grp,
                    COALESCE(SUM(s.total), 0)                     AS sales,
                    COALESCE(SUM(si.cost_price * si.quantity), 0)  AS cost
                FROM sales s LEFT JOIN sale_items si ON si.sale_id = s.id
                WHERE s.is_cancelled = 0 AND DATE(s.created_at) BETWEEN ? AND ?
                GROUP BY grp ORDER BY grp ASC`;
            mapper = r => {
                const [yr, mo, dy] = r.grp.split('-');
                const dateObj  = new Date(Number(yr), Number(mo)-1, Number(dy));
                const dayName  = DAYS_ES[dateObj.getDay()];
                const monthName= ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][dateObj.getMonth()];
                return {
                    day:      `${dy}-${mo}`,
                    _iso:     r.grp,
                    _label:   `${dayName} ${dy} ${monthName} ${yr}`,
                    Costo:    Math.round(r.cost),
                    Utilidad: Math.round(Math.max(0, r.sales - r.cost)),
                    _total:   Math.round(r.sales)
                };
            };
        }

        let qFrom = dateFrom;
        let qTo   = dateTo;
        if (period === 'months') {
            const n  = new Date();
            const yy = n.getFullYear();
            const mm = n.getMonth();
            const f  = new Date(yy, mm - 12, 1);
            const t  = new Date(yy, mm + 1, 0);
            qFrom = `${f.getFullYear()}-${String(f.getMonth()+1).padStart(2,'0')}-01`;
            qTo   = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
        }
        const rows = await window.electronAPI.database.query(sql, [qFrom, qTo]);
        let mapped = rows.map(mapper);

        if (granularity === 'day') {
            const byDay = {};
            mapped.forEach(r => { byDay[r.day] = r; });
            const filled = [];
            const cursor = localDate(dateFrom);
            const end    = localDate(dateTo);
            while (cursor <= end) {
                const iso = toISO(cursor);
                const [cy, cm, cd] = iso.split('-');
                const key    = `${cd}-${cm}`;
                const dObj   = new Date(Number(cy), Number(cm)-1, Number(cd));
                const dName  = DAYS_ES[dObj.getDay()];
                const mName  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][dObj.getMonth()];
                filled.push(byDay[key] || { day: key, _iso: iso, _label: `${dName} ${cd} ${mName} ${cy}`, Costo: 0, Utilidad: 0, _total: 0 });
                cursor.setDate(cursor.getDate() + 1);
            }
            mapped = filled;

        } else if (granularity === 'month') {
            const byMonth = {};
            mapped.forEach(r => { byMonth[r.day] = r; });
            const filled = [];
            if (period === 'months') {
                const n2     = new Date();
                const cursor = new Date(n2.getFullYear(), n2.getMonth() - 12, 1);
                for (let i = 0; i < 13; i++) {
                    const label = `${MONTHS_ES_FULL[cursor.getMonth()]} ${cursor.getFullYear()}`;
                    filled.push(byMonth[label] || { day: label, Costo: 0, Utilidad: 0, _total: 0 });
                    cursor.setMonth(cursor.getMonth() + 1);
                }
            } else {
                const fromD = localDate(dateFrom);
                const toD   = localDate(dateTo);
                const endY  = toD.getFullYear();
                const endM  = toD.getMonth();
                const cursor = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
                while (cursor.getFullYear() < endY || (cursor.getFullYear() === endY && cursor.getMonth() <= endM)) {
                    const label = `${MONTHS_ES_FULL[cursor.getMonth()]} ${cursor.getFullYear()}`;
                    filled.push(byMonth[label] || { day: label, Costo: 0, Utilidad: 0, _total: 0 });
                    cursor.setMonth(cursor.getMonth() + 1);
                }
            }
            mapped = filled;

        } else if (granularity === 'year') {
            const byYear = {};
            mapped.forEach(r => { byYear[r.day] = r; });
            const filled = [];
            const fromYear = localDate(dateFrom).getFullYear();
            const toYear   = localDate(dateTo).getFullYear();
            for (let y = fromYear; y <= toYear; y++) {
                const label = String(y);
                filled.push(byYear[label] || { day: label, Costo: 0, Utilidad: 0, _total: 0 });
            }
            mapped = filled;
        }

        setChartData(mapped);
    };

    const loadPayments = async () => {
        const rows = await window.electronAPI.database.query(`
            SELECT payment_method, COALESCE(SUM(total), 0) AS total, COUNT(*) AS count
            FROM sales
            WHERE is_cancelled = 0 AND DATE(created_at) BETWEEN ? AND ?
            GROUP BY payment_method ORDER BY total DESC
        `, [dateFrom, dateTo]);
        setPaymentData(rows);
    };

    const loadTopProducts = async () => {
        const rows = await window.electronAPI.database.query(`
            SELECT
                si.product_name                              AS name,
                SUM(si.quantity)                             AS qty,
                SUM(si.total)                                AS revenue,
                SUM(si.cost_price * si.quantity)             AS cost,
                SUM(si.total - si.cost_price * si.quantity)  AS profit
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.is_cancelled = 0 AND DATE(s.created_at) BETWEEN ? AND ?
            GROUP BY si.product_name ORDER BY revenue DESC
        `, [dateFrom, dateTo]);
        setTopProducts(rows);
    };

    // ✅ FIX: incluir unlimited_stock para mostrarlo correctamente en la tabla
    const loadNoMovement = async () => {
        const rows = await window.electronAPI.database.query(`
            SELECT p.name, p.stock, p.sale_price, p.unlimited_stock
            FROM products p
            WHERE p.is_active = 1
              AND p.id NOT IN (
                  SELECT DISTINCT si.product_id
                  FROM sale_items si
                  JOIN sales s ON si.sale_id = s.id
                  WHERE s.is_cancelled = 0
                    AND DATE(s.created_at) BETWEEN ? AND ?
              )
            ORDER BY p.stock DESC
        `, [dateFrom, dateTo]);
        setNoMovement(rows);
    };

    const loadBySeller = async () => {
        const rows = await window.electronAPI.database.query(`
            SELECT
                u.full_name                                       AS seller,
                COUNT(DISTINCT s.id)                             AS count,
                COALESCE(SUM(s.total), 0)                        AS sales,
                COALESCE(SUM(si.cost_price * si.quantity), 0)    AS cost
            FROM sales s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE s.is_cancelled = 0 AND DATE(s.created_at) BETWEEN ? AND ?
            GROUP BY s.user_id ORDER BY sales DESC
        `, [dateFrom, dateTo]);
        setBySeller(rows.map(r => ({ ...r, profit: r.sales - r.cost })));
    };

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const businessInfo = await window.electronAPI.database.get(
                'SELECT name FROM business_info WHERE id = 1'
            );
            const params = {
                period, dateFrom, dateTo,
                summary, chartData, paymentData,
                topProducts, bySeller, noMovement,
                businessName: businessInfo?.name || 'Mi Negocio'
            };
            if (type === 'excel') await exportToExcel(params);
            else                  await exportToPDF(params);
        } catch (err) {
            console.error('Export error:', err);
        } finally {
            setExporting(null);
        }
    };

    const variation = (curr, prev) => {
        if (prev === 0) return null;
        const v = ((curr - prev) / prev) * 100;
        return { value: Math.abs(v).toFixed(1), up: v >= 0 };
    };

    const varSales  = variation(summary.sales,  prevSummary.sales);
    const varProfit = variation(summary.profit, prevSummary.profit);
    const varCount  = variation(summary.count,  prevSummary.count);
    const marginPct = pct(summary.profit, summary.sales);

    return (
        <div className="main-content-scrollable">
            <div className="rp-page">

                {/* ── HEADER ── */}
                <div className="rp-header">
                    <div>
                        <h1 className="rp-title">Reportes</h1>
                        <p className="rp-subtitle">Análisis de ventas, costos y utilidades</p>
                    </div>
                    <div className="rp-header-actions">
                        <button className="rp-btn-export rp-btn-excel"
                            onClick={() => handleExport('excel')}
                            disabled={loading || exporting !== null || summary.count === 0}>
                            {exporting === 'excel' ? 'Descargando...' : 'Descargar Excel'}
                        </button>
                        <button className="rp-btn-export rp-btn-pdf"
                            onClick={() => handleExport('pdf')}
                            disabled={loading || exporting !== null || summary.count === 0}>
                            {exporting === 'pdf' ? 'Descargando...' : 'Descargar PDF'}
                        </button>
                        <button className="rp-refresh" onClick={loadData} disabled={loading}>
                            <FiRefreshCw className={loading ? 'spin' : ''} />
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* ── SELECTOR DE PERÍODO ── */}
                <div className="rp-period-bar">
                    <div className="rp-period-btns">
                        {PERIODS.map(p => (
                            <button key={p.id}
                                className={`rp-period-btn ${period === p.id ? 'active' : ''}`}
                                onClick={() => applyPeriod(p.id)}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <div className="rp-date-range">
                        <FiCalendar size={14} />
                        <input type="date" value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setPeriod('custom'); }}
                            className="rp-date-input" />
                        <span>—</span>
                        <input type="date" value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setPeriod('custom'); }}
                            className="rp-date-input" />
                    </div>
                </div>

                {loading ? (
                    <div className="rp-loading">
                        <div className="spinner" />
                        <p>Cargando datos...</p>
                    </div>
                ) : (
                    <>
                        {/* ── MÉTRICAS ── */}
                        <div className="rp-metrics">
                            <MetricCard icon={<FiShoppingBag />} color="blue"
                                label="Total Ventas" value={fmt(summary.sales)}
                                sub={`${fmtN(summary.count)} transacciones`} variation={varSales} />
                            <MetricCard icon={<FiDollarSign />} color="red"
                                label="Costo de Ventas" value={fmt(summary.cost)}
                                sub={`${pct(summary.cost, summary.sales)}% sobre ventas`} />
                            <MetricCard icon={<FiTrendingUp />} color="green"
                                label="Utilidad Bruta" value={fmt(summary.profit)}
                                sub={`Margen: ${marginPct}%`} variation={varProfit} />
                            <MetricCard icon={<FiPercent />} color="purple"
                                label="Ticket Promedio" value={fmt(summary.avg)}
                                sub={`${fmtN(summary.count)} ventas`} variation={varCount} />
                        </div>

                        {/* ── GRÁFICO ── */}
                        <div className="rp-card">
                            <h2 className="rp-card-title">
                                Composición de Ventas —&nbsp;
                                {period === 'days8'  ? 'Últimos 8 días' :
                                 period === 'months' ? 'Últimos 13 meses' :
                                 period === 'years'  ? 'Últimos 5 años' :
                                 `${dateFrom} → ${dateTo}`}
                            </h2>
                            <div className="rp-chart-legend-custom">
                                <span className="rp-cleg rp-cleg--cost">Costo</span>
                                <span className="rp-cleg rp-cleg--profit">Utilidad</span>
                                <span className="rp-cleg rp-cleg--total">= Venta total</span>
                            </div>
                            {chartData.length === 0 ? <Empty msg="Sin ventas en el período" /> : (() => {
                                const isMonthLabel = chartData.length > 0 && chartData[0].day.length > 6;
                                const isDayPeriod  = period === 'days8' ||
                                    (period === 'custom' && chartData.length <= 31 && !isMonthLabel);

                                const CustomDayTick = ({ x, y, payload }) => {
                                    const iso   = payload.value;
                                    const entry = chartData.find(d => d.day === iso);
                                    let dayName = '';
                                    if (entry?._iso) {
                                        const [ey, em, ed] = entry._iso.split('-');
                                        dayName = DAYS_ES[new Date(Number(ey), Number(em)-1, Number(ed)).getDay()];
                                    }
                                    return (
                                        <g transform={`translate(${x},${y})`}>
                                            <text x={0} y={0} dy={12} textAnchor="middle" fontSize={10} fill="#374151" fontWeight={600}>{dayName}</text>
                                            <text x={0} y={0} dy={24} textAnchor="middle" fontSize={10} fill="#6b7280">{iso}</text>
                                        </g>
                                    );
                                };

                                const chartH  = isMonthLabel ? 340 : isDayPeriod ? 320 : 300;
                                const xAngle  = isMonthLabel ? -35 : 0;
                                const xAnchor = isMonthLabel ? 'end' : 'middle';
                                const xHeight = isMonthLabel ? 60 : isDayPeriod ? 50 : 30;

                                return (
                                    <ResponsiveContainer width="100%" height={chartH}>
                                        <BarChart data={chartData}
                                            margin={{ top: 16, right: 16, left: 8, bottom: isMonthLabel ? 10 : 0 }}
                                            barCategoryGap="30%">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                            <XAxis dataKey="day"
                                                tick={isDayPeriod ? <CustomDayTick /> : { fontSize: isMonthLabel ? 10 : 11, fill: '#6b7280' }}
                                                angle={xAngle} textAnchor={xAnchor} height={xHeight}
                                                axisLine={false} tickLine={false} />
                                            <YAxis tickFormatter={(v) => `$${new Intl.NumberFormat("es-CL").format(v)}`}
                                                tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={90} />
                                            <Tooltip content={<StackedTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                            <Bar dataKey="Costo"    stackId="a" fill="#f87171" radius={[0,0,0,0]} />
                                            <Bar dataKey="Utilidad" stackId="a" fill="#34d399" radius={[6,6,0,0]}>
                                                <LabelList dataKey="_total" position="top"
                                                    formatter={(v) => `$${new Intl.NumberFormat("es-CL").format(v)}`}
                                                    style={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                );
                            })()}
                        </div>

                        {/* ── FORMAS DE PAGO + VENDEDORES ── */}
                        <div className="rp-row-2">
                            <div className="rp-card">
                                <h2 className="rp-card-title">💳 Ventas por forma de pago</h2>
                                {paymentData.length === 0 ? <Empty msg="Sin datos" /> : (
                                    <div className="rp-payment-list">
                                        {paymentData.map((p) => {
                                            const totalSales = paymentData.reduce((a, x) => a + x.total, 0);
                                            const pctVal = pct(p.total, totalSales);
                                            const color  = PAYMENT_COLORS[p.payment_method] || '#6b7280';
                                            return (
                                                <div key={p.payment_method} className="rp-payment-row">
                                                    <div className="rp-payment-info">
                                                        <span className="rp-payment-dot" style={{ background: color }} />
                                                        <span className="rp-payment-name">{PAYMENT_LABELS[p.payment_method] || p.payment_method}</span>
                                                        <span className="rp-payment-count">{p.count} ventas</span>
                                                    </div>
                                                    <div className="rp-payment-right">
                                                        <span className="rp-payment-pct">{pctVal}%</span>
                                                        <span className="rp-payment-amount">{fmt(p.total)}</span>
                                                    </div>
                                                    <div className="rp-bar-bg">
                                                        <div className="rp-bar-fill" style={{ width: `${pctVal}%`, background: color }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="rp-card">
                                <h2 className="rp-card-title">👤 Ventas por vendedor</h2>
                                {bySeller.length === 0 ? <Empty msg="Sin datos" /> : (
                                    <div className="rp-seller-list">
                                        {bySeller.map((s, i) => (
                                            <div key={i} className="rp-seller-row">
                                                <div className="rp-seller-avatar">{s.seller?.charAt(0).toUpperCase()}</div>
                                                <div className="rp-seller-info">
                                                    <span className="rp-seller-name">{s.seller}</span>
                                                    <span className="rp-seller-count">{s.count} ventas</span>
                                                </div>
                                                <div className="rp-seller-amounts">
                                                    <span className="rp-seller-sales">{fmt(s.sales)}</span>
                                                    <span className="rp-seller-profit">Utilidad: {fmt(s.profit)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── GRÁFICO VENDEDORES ── */}
                        {bySeller.length > 1 && (
                            <div className="rp-card">
                                <h2 className="rp-card-title">Comparativa de ventas por vendedor</h2>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={bySeller} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="seller" tick={{ fontSize: 11, fill: '#6b7280' }} />
                                        <YAxis tickFormatter={(v) => `$${new Intl.NumberFormat("es-CL").format(v)}`}
                                            tick={{ fontSize: 10, fill: '#6b7280' }} width={90} axisLine={false} tickLine={false} />
                                        <Tooltip content={<StackedTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="sales"  name="Ventas"   fill="#2563eb" radius={[3,3,0,0]} />
                                        <Bar dataKey="profit" name="Utilidad" fill="#10b981" radius={[3,3,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* ── PRODUCTOS VENDIDOS ── */}
                        <div className="rp-card">
                            <div className="rp-card-header-row">
                                <h2 className="rp-card-title">🏆 Productos vendidos en el período</h2>
                                {topProducts.length > 0 && (
                                    <span className="rp-badge-count">{topProducts.length} productos</span>
                                )}
                            </div>
                            {topProducts.length === 0 ? <Empty msg="Sin ventas en el período" /> : (
                                <>
                                    <table className="rp-table">
                                        <thead>
                                            <tr>
                                                <th>#</th><th>Producto</th><th>Unidades</th>
                                                <th>Ingresos</th><th>Costo</th><th>Utilidad</th><th>Margen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(showAllProds ? topProducts : topProducts.slice(0, PROD_PREVIEW)).map((p, i) => (
                                                <tr key={i}>
                                                    <td><span className={`rp-rank rp-rank--${i < 3 ? i+1 : 'rest'}`}>{i + 1}</span></td>
                                                    <td className="rp-product-name">{p.name}</td>
                                                    <td>{fmtN(p.qty)}</td>
                                                    <td>{fmt(p.revenue)}</td>
                                                    <td className="rp-cost-cell">{fmt(p.cost)}</td>
                                                    <td><span className="rp-profit-badge">{fmt(p.profit)}</span></td>
                                                    <td>
                                                        <span className={`rp-margin-badge ${p.profit >= 0 ? 'positive' : 'negative'}`}>
                                                            {pct(p.profit, p.revenue)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {topProducts.length > PROD_PREVIEW && (
                                        <button className="rp-show-all-btn" onClick={() => setShowAllProds(v => !v)}>
                                            {showAllProds ? '▲ Ver menos' : `▼ Ver todos los productos (${topProducts.length - PROD_PREVIEW} más)`}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── PRODUCTOS SIN MOVIMIENTO ── */}
                        <div className="rp-card">
                            <div className="rp-card-header-row">
                                <h2 className="rp-card-title">
                                    <FiAlertCircle className="rp-alert-icon" />
                                    Productos sin movimiento en el período
                                </h2>
                                {noMovement.length > 0 && (
                                    <span className="rp-badge-count">{noMovement.length}</span>
                                )}
                            </div>
                            {noMovement.length === 0 ? (
                                <div className="rp-all-good">
                                    ✅ Todos los productos tuvieron movimiento en el período
                                </div>
                            ) : (
                                <>
                                    <table className="rp-table">
                                        <thead>
                                            <tr>
                                                <th>Producto</th>
                                                <th>Stock actual</th>
                                                <th>Precio venta</th>
                                                <th>Valor en stock</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(showAllNoMovement ? noMovement : noMovement.slice(0, NO_MOV_PREVIEW)).map((p, i) => {
                                                // ✅ FIX: detectar stock ilimitado para no mostrar "0 u."
                                                const isUnlimited = p.unlimited_stock === 1 || p.unlimited_stock === true;
                                                return (
                                                    <tr key={i}>
                                                        <td className="rp-product-name">{p.name}</td>
                                                        <td>
                                                            {isUnlimited ? (
                                                                <span className="rp-stock-badge unlimited">
                                                                    Siempre disponible
                                                                </span>
                                                            ) : (
                                                                <span className={`rp-stock-badge ${p.stock === 0 ? 'zero' : p.stock < 5 ? 'low' : ''}`}>
                                                                    {fmtN(p.stock)} u.
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>{fmt(p.sale_price)}</td>
                                                        <td>
                                                            {/* ✅ Valor en stock no aplica para ilimitados */}
                                                            {isUnlimited ? (
                                                                <span style={{ color: '#7c3aed', fontWeight: 500 }}>—</span>
                                                            ) : (
                                                                fmt(p.stock * p.sale_price)
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {noMovement.length > NO_MOV_PREVIEW && (
                                        <button className="rp-show-all-btn" onClick={() => setShowAllNoMovement(v => !v)}>
                                            {showAllNoMovement
                                                ? '▲ Ver menos'
                                                : `▼ Ver todos los productos sin movimiento (${noMovement.length - NO_MOV_PREVIEW} más)`}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

const MetricCard = ({ icon, color, label, value, sub, variation }) => (
    <div className={`rp-metric rp-metric--${color}`}>
        <div className="rp-metric-icon">{icon}</div>
        <div className="rp-metric-body">
            <p className="rp-metric-label">{label}</p>
            <p className="rp-metric-value">{value}</p>
            <p className="rp-metric-sub">{sub}</p>
        </div>
        {variation && (
            <div className={`rp-metric-var ${variation.up ? 'up' : 'down'}`}>
                {variation.up ? '▲' : '▼'} {variation.value}%
                <span>vs período ant.</span>
            </div>
        )}
    </div>
);

const Empty = ({ msg }) => (
    <div className="rp-empty">{msg}</div>
);

export default Reports;