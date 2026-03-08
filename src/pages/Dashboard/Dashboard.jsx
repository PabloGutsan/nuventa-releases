import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import SaleRepository from '../../services/repositories/saleRepository';
import Card from '../../components/common/Card';
import {
    FiDollarSign, FiShoppingCart, FiPackage,
    FiTrendingUp, FiCalendar, FiUser, FiAlertOctagon
} from 'react-icons/fi';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LabelList, PieChart, Pie, Cell
} from 'recharts';
import './Dashboard.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatCurrency = (v) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

const formatPaymentMethod = (m) => ({
    efectivo:        'Efectivo',
    tarjeta_debito:  'Débito',
    tarjeta_credito: 'Crédito',
    transferencia:   'Transferencia',
    multiple:        'Múltiple',
}[m] || m);

const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const buildDayLabel = (isoDate) => {
    const [year, month, day] = isoDate.split('-');
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    const weekday = d.toLocaleDateString('es-CL', { weekday: 'short' });
    const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace('.', '');
    return { weekday: cap, date: `${day}-${month}` };
};

const CustomXTick = ({ x, y, payload }) => {
    const parts = payload.value.split('|');
    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} dy={14} textAnchor="middle"
                fill="#374151" fontSize={11} fontWeight={600}>{parts[0]}</text>
            <text x={0} y={0} dy={27} textAnchor="middle"
                fill="#6b7280" fontSize={10}>{parts[1]}</text>
        </g>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e7eb',
            borderRadius: 8, padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13
        }}>
            <p style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                {label?.replace('|', ' ')}
            </p>
            <p style={{ color: '#2563eb', margin: 0 }}>
                Ventas: <strong>{formatCurrency(payload[0]?.value)}</strong>
            </p>
        </div>
    );
};

const BarLabel = ({ x, y, width, value }) => {
    if (!value) return null;
    return (
        <text x={x + width / 2} y={y - 4} textAnchor="middle"
            fill="#2563eb" fontSize={9.5} fontWeight={600}>
            {formatCurrency(value)}
        </text>
    );
};

// ── StatCard ──────────────────────────────────────────────────────────────────
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
            <span className="sca-sub">{sub}</span>
        </div>
    </div>
);

// ── Componente principal ──────────────────────────────────────────────────────
const Dashboard = ({ onNavigate }) => {
    const { db }          = useDatabase();
    const { currentUser } = useAuth();
    const { salesFilter } = usePermissions();

    const isVendedor = salesFilter === 'own';
    const isAdmin    = salesFilter === 'all';

    const [stats, setStats] = useState({
        todaySales: 0, todayRevenue: 0,
        todayTransactions: 0, averageTicket: 0, lowStockCount: 0
    });
    const [last8Days,           setLast8Days]           = useState([]);
    const [topProducts,         setTopProducts]         = useState([]);
    const [salesByPayment,      setSalesByPayment]      = useState([]);
    const [recentSales,         setRecentSales]         = useState([]);
    const [myStats,             setMyStats]             = useState({
        total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0
    });
    const [myRecentSales,       setMyRecentSales]       = useState([]);
    const [myPaymentStats,      setMyPaymentStats]      = useState([]);
    const [lowStock,            setLowStock]            = useState([]);
    const [openRegisters,       setOpenRegisters]       = useState([]); // cajas +12h abiertas
    const [loading,             setLoading]             = useState(true);

    const saleRepo = new SaleRepository(db);

    useEffect(() => {
        if (db) loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const shared = [loadLowStock()];
            if (isVendedor) {
                await Promise.all([...shared, loadMyStats(), loadMyRecentSales(), loadMyPaymentStats()]);
            } else {
                await Promise.all([
                    ...shared,
                    loadTodayStats(), loadLast8DaysSales(),
                    loadTopProducts(), loadSalesByPayment(),
                    loadRecentSales(), loadOpenRegisters(),
                ]);
            }
        } catch (err) {
            console.error('Error cargando dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Loaders admin ─────────────────────────────────────────────────────────
    const loadTodayStats = async () => {
        try {
            const todayStats = await saleRepo.getTodayStats();
            if (!todayStats || typeof todayStats !== 'object') return;
            const stockResult = await window.electronAPI.database.query(`
                SELECT COUNT(*) as low_stock_count
                FROM products
                WHERE type = 'product'
                  AND (unlimited_stock = 0 OR unlimited_stock IS NULL)
                  AND stock <= min_stock
                  AND is_active = 1
            `);
            const lowStockCount = stockResult?.[0]?.low_stock_count || 0;
            setStats({
                todaySales:        todayStats.total_revenue  || 0,
                todayRevenue:      todayStats.total_revenue  || 0,
                todayTransactions: todayStats.total_sales    || 0,
                averageTicket:     todayStats.average_ticket || 0,
                lowStockCount,
            });
        } catch (err) {
            console.error('Error loading today stats:', err);
        }
    };

    const loadLast8DaysSales = async () => {
        try {
            const data = await window.electronAPI.database.query(`
                SELECT DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as transactions
                FROM sales
                WHERE DATE(created_at) >= DATE('now', 'localtime', '-7 days')
                  AND is_cancelled = 0
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `);
            if (!Array.isArray(data)) { setLast8Days([]); return; }
            const map = {};
            data.forEach(row => { map[row.date] = row; });
            const days = [];
            for (let i = 7; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const { weekday, date } = buildDayLabel(iso);
                days.push({
                    label:         `${weekday}|${date}`,
                    ventas:        map[iso]?.revenue      || 0,
                    transacciones: map[iso]?.transactions || 0,
                });
            }
            setLast8Days(days);
        } catch { setLast8Days([]); }
    };

    const loadTopProducts = async () => {
        try {
            const today = getLocalDate();
            const data = await window.electronAPI.database.query(`
                SELECT p.name, p.type, SUM(si.quantity) as quantity_sold,
                       SUM(si.total) as revenue
                FROM sale_items si
                INNER JOIN products p ON si.product_id = p.id
                INNER JOIN sales s ON si.sale_id = s.id
                WHERE s.is_cancelled = 0
                  AND DATE(s.created_at) = ?
                GROUP BY si.product_id
                ORDER BY quantity_sold DESC LIMIT 20
            `, [today]);
            setTopProducts(Array.isArray(data) ? data : []);
        } catch { setTopProducts([]); }
    };

    const loadSalesByPayment = async () => {
        try {
            const today = getLocalDate();
            const data = await window.electronAPI.database.query(`
                SELECT payment_method, COUNT(*) as count, SUM(total) as total
                FROM sales WHERE is_cancelled = 0
                  AND DATE(created_at) = ?
                GROUP BY payment_method
            `, [today]);
            if (!Array.isArray(data)) { setSalesByPayment([]); return; }
            setSalesByPayment(data.map(item => ({
                name:  formatPaymentMethod(item.payment_method),
                value: item.total || 0,
                count: item.count || 0,
            })));
        } catch { setSalesByPayment([]); }
    };

    const loadRecentSales = async () => {
        try {
            const today = getLocalDate();
            const data = await window.electronAPI.database.query(`
                SELECT s.*, u.full_name as seller_name
                FROM sales s LEFT JOIN users u ON s.user_id = u.id
                WHERE s.is_cancelled = 0 AND DATE(s.created_at) = ?
                ORDER BY s.created_at DESC LIMIT 10
            `, [today]);
            setRecentSales(Array.isArray(data) ? data : []);
        } catch { setRecentSales([]); }
    };

    // ── Alerta: cajas abiertas hace más de 12 horas ───────────────────────────
    const loadOpenRegisters = async () => {
        if (!isAdmin) return;
        try {
            const data = await window.electronAPI.database.query(`
                SELECT cr.id, cr.opened_at, cr.opening_amount,
                       u.full_name AS opened_by_name
                FROM cash_registers cr
                LEFT JOIN users u ON cr.opened_by = u.id
                WHERE cr.status = 'open'
                  AND cr.opened_at <= datetime('now', 'localtime', '-12 hours')
                ORDER BY cr.opened_at ASC
            `);
            setOpenRegisters(Array.isArray(data) ? data : []);
        } catch { setOpenRegisters([]); }
    };

    // ── Loaders vendedor ──────────────────────────────────────────────────────
    const loadMyStats = async () => {
        try {
            const today = getLocalDate();
            const data  = await saleRepo.getUserDayStats(currentUser?.id, today);
            setMyStats(data || { total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0 });
        } catch (err) { console.error('Error loading my stats:', err); }
    };

    const loadMyRecentSales = async () => {
        try {
            const today = getLocalDate();
            const data  = await window.electronAPI.database.query(`
                SELECT s.*
                FROM sales s
                WHERE s.is_cancelled = 0
                  AND s.user_id = ?
                  AND DATE(s.created_at) = ?
                ORDER BY s.created_at DESC LIMIT 10
            `, [currentUser?.id, today]);
            setMyRecentSales(Array.isArray(data) ? data : []);
        } catch { setMyRecentSales([]); }
    };

    const loadMyPaymentStats = async () => {
        try {
            const today = getLocalDate();
            const data = await window.electronAPI.database.query(`
                SELECT payment_method, COUNT(*) as count, SUM(total) as total
                FROM sales
                WHERE is_cancelled = 0
                  AND user_id = ?
                  AND DATE(created_at) = ?
                GROUP BY payment_method
            `, [currentUser?.id, today]);
            if (!Array.isArray(data)) { setMyPaymentStats([]); return; }
            setMyPaymentStats(data.map(item => ({
                name:  formatPaymentMethod(item.payment_method),
                value: item.total || 0,
                count: item.count || 0,
            })));
        } catch { setMyPaymentStats([]); }
    };

    // ── Loaders compartidos ───────────────────────────────────────────────────
    const loadLowStock = async () => {
        try {
            const data = await window.electronAPI.database.query(`
                SELECT id, name, stock, min_stock
                FROM products
                WHERE type = 'product'
                  AND (unlimited_stock = 0 OR unlimited_stock IS NULL)
                  AND stock <= min_stock
                  AND is_active = 1
                ORDER BY (stock - min_stock) ASC LIMIT 8
            `);
            setLowStock(Array.isArray(data) ? data : []);
        } catch { setLowStock([]); }
    };



    const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (loading) {
        return (
            <div className="main-content-scrollable">
                <div className="dashboard">
                    <div className="db-loading-container">
                        <div className="db-spinner" />
                        <p>Cargando dashboard...</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Render vendedor ───────────────────────────────────────────────────────
    if (isVendedor) {
        const stockOk = lowStock.length === 0;
        return (
            <div className="main-content-scrollable">
                <div className="dashboard">
                    <div className="dashboard-header">
                        <div>
                            <h1 className="dashboard-title">
                                Hola, {currentUser?.full_name || currentUser?.username} 👋
                            </h1>
                            <p className="dashboard-subtitle">Tu resumen de hoy</p>
                        </div>
                        <div className="dashboard-date">
                            <FiCalendar />
                            <span>{new Date().toLocaleDateString('es-CL', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                            })}</span>
                        </div>
                    </div>

                    <div className="stats-grid">
                        <StatCard accent="#2563eb" icon={FiShoppingCart}
                            label="Mis Ventas Hoy" value={myStats.total_sales}
                            sub="Transacciones realizadas" />
                        <StatCard accent="#10b981" icon={FiDollarSign}
                            label="Mi Total Hoy" value={formatCurrency(myStats.total_revenue)}
                            sub="Monto vendido por ti" />
                        <StatCard accent="#f59e0b" icon={FiTrendingUp}
                            label="Mi Ticket Promedio" value={formatCurrency(myStats.average_ticket)}
                            sub="Por transacción" />
                        <StatCard
                            accent={stockOk ? '#10b981' : '#f59e0b'}
                            icon={FiPackage}
                            label="Alertas de Stock"
                            value={stockOk ? '✅ Todo OK' : lowStock.length}
                            valueColor={stockOk ? '#10b981' : '#d97706'}
                            sub={stockOk
                                ? '0 productos bajo mínimo'
                                : `${lowStock.length} producto${lowStock.length > 1 ? 's' : ''} bajo mínimo`}
                        />
                    </div>

                    <Card title="⚠️ Stock Bajo">
                            <div className="table-container-dashboard">
                                {lowStock.length > 0 ? (
                                    <table className="dashboard-table">
                                        <thead><tr><th>Producto</th><th>Stock</th></tr></thead>
                                        <tbody>
                                            {lowStock.map((p, i) => (
                                                <tr key={i}>
                                                    <td className="product-name-dashboard">📦 {p.name}</td>
                                                    <td><span className="stock-low-badge">{p.stock}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="db-table-empty">
                                        <FiPackage size={40} />
                                        <p>✅ Stock adecuado</p>
                                    </div>
                                )}
                            </div>
                        </Card>

                    <Card title="💳 Mis Ventas por Método de Pago — Hoy">
                        <div className="db-chart-container">
                            {myPaymentStats.length > 0 ? (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={myPaymentStats} cx="50%" cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={95} dataKey="value">
                                            {myPaymentStats.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v) => formatCurrency(v)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="db-chart-empty"><p>No hay ventas registradas hoy</p></div>
                            )}
                        </div>
                    </Card>

                    <Card title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span>🛒 Mis Ventas de Hoy</span>
                            {onNavigate && (
                                <button onClick={() => onNavigate('ventas')} style={{
                                    fontSize: 13, fontWeight: 600, color: '#2563eb',
                                    background: 'none', border: '1px solid #bfdbfe',
                                    borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
                                }}
                                onMouseEnter={e => e.target.style.background = '#eff6ff'}
                                onMouseLeave={e => e.target.style.background = 'none'}>
                                    Ver todas →
                                </button>
                            )}
                        </div>
                    }>
                        <div className="table-container-dashboard">
                            {myRecentSales.length > 0 ? (
                                <table className="dashboard-table">
                                    <thead>
                                        <tr>
                                            <th>N° Venta</th><th>Hora</th>
                                            <th>Método de Pago</th><th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {myRecentSales.map((sale, i) => (
                                            <tr key={i}>
                                                <td className="db-sale-number">{sale.sale_number}</td>
                                                <td>{new Date(sale.created_at).toLocaleTimeString('es-CL', {
                                                    hour: '2-digit', minute: '2-digit'
                                                })}</td>
                                                <td><span className="db-payment-badge">{formatPaymentMethod(sale.payment_method)}</span></td>
                                                <td className="db-total-cell">{formatCurrency(sale.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="db-table-empty">
                                    <FiShoppingCart size={40} />
                                    <p>No tienes ventas registradas hoy</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    // ── Render admin ──────────────────────────────────────────────────────────
    const stockOk = stats.lowStockCount === 0;

    return (
        <div className="main-content-scrollable">
            <div className="dashboard">

                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title">Dashboard</h1>
                        <p className="dashboard-subtitle">Resumen general de tu negocio</p>
                    </div>
                    <div className="dashboard-date">
                        <FiCalendar />
                        <span>{new Date().toLocaleDateString('es-CL', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}</span>
                    </div>
                </div>

                {/* ── Alerta: cajas abiertas hace más de 12 horas ── */}
                {openRegisters.length > 0 && (
                    <div className="db-cash-alert">
                        <div className="db-cash-alert-icon">
                            <FiAlertOctagon size={20} color="#d97706" />
                        </div>
                        <div className="db-cash-alert-body">
                            <strong>
                                {openRegisters.length === 1
                                    ? '1 caja lleva más de 12 horas abierta'
                                    : `${openRegisters.length} cajas llevan más de 12 horas abiertas`}
                            </strong>
                            <div className="db-cash-alert-list">
                                {openRegisters.map((r) => {
                                    const opened = new Date(r.opened_at);
                                    const hours  = Math.floor((Date.now() - opened.getTime()) / 3600000);
                                    return (
                                        <span key={r.id} className="db-cash-alert-item">
                                            👤 {r.opened_by_name} — abierta hace {hours}h
                                            {' '}(desde {opened.toLocaleDateString('es-CL', {
                                                day: '2-digit', month: '2-digit'
                                            })} {opened.toLocaleTimeString('es-CL', {
                                                hour: '2-digit', minute: '2-digit'
                                            })})
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        {onNavigate && (
                            <button className="db-cash-alert-link" onClick={() => onNavigate('caja')}>
                                Ver historial →
                            </button>
                        )}
                    </div>
                )}

                <div className="stats-grid">
                    <StatCard accent="#2563eb" icon={FiDollarSign}
                        label="Ventas del Día" value={formatCurrency(stats.todaySales)} sub="Hoy" />
                    <StatCard accent="#8b5cf6" icon={FiShoppingCart}
                        label="Transacciones" value={stats.todayTransactions} sub="Hoy" />
                    <StatCard
                        accent={stockOk ? '#10b981' : '#f59e0b'}
                        icon={FiPackage}
                        label="Alertas de Stock"
                        value={stockOk ? '✅ Todo OK' : stats.lowStockCount}
                        valueColor={stockOk ? '#10b981' : '#d97706'}
                        sub={stockOk
                            ? '0 productos bajo mínimo'
                            : `${stats.lowStockCount} producto${stats.lowStockCount > 1 ? 's' : ''} bajo mínimo`}
                    />
                    <StatCard accent="#f59e0b" icon={FiTrendingUp}
                        label="Venta Promedio" value={formatCurrency(stats.averageTicket)} sub="Por transacción" />
                </div>

                <div className="db-chart-8days">
                    <Card title="📈 Ventas — Últimos 8 días">
                        <div style={{ padding: '8px 0 0' }}>
                            {last8Days.some(d => d.ventas > 0) ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={last8Days}
                                        margin={{ top: 28, right: 24, left: 16, bottom: 32 }}
                                        barCategoryGap="35%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="label" tick={<CustomXTick />}
                                            tickLine={false} axisLine={{ stroke: '#e5e7eb' }} height={48} />
                                        <YAxis
                                            tickFormatter={(v) => v === 0 ? '$0'
                                                : `$${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(v)}`}
                                            tick={{ fontSize: 11, fill: '#6b7280' }}
                                            tickLine={false} axisLine={false} width={72} />
                                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f3f4f6' }} />
                                        <Bar dataKey="ventas" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={52}>
                                            <LabelList content={<BarLabel />} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="db-chart-empty"><p>No hay datos de ventas aún</p></div>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="db-two-col">
                    <Card title="🏆 Top 20 Productos Más Vendidos — Hoy">
                        <div className="table-container-dashboard">
                            {topProducts.length > 0 ? (
                                <table className="dashboard-table">
                                    <thead>
                                        <tr><th>#</th><th>Producto / Servicio</th><th>Cant.</th><th>Ingresos</th></tr>
                                    </thead>
                                    <tbody>
                                        {topProducts.map((p, i) => (
                                            <tr key={i}>
                                                <td className="rank-cell">
                                                    <span className={`rank-badge rank-${i + 1}`}>{i + 1}</span>
                                                </td>
                                                <td><div className="product-cell">{p.type === 'service' ? '👤' : '📦'} {p.name}</div></td>
                                                <td className="quantity-cell">{p.quantity_sold}</td>
                                                <td className="revenue-cell">{formatCurrency(p.revenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="db-table-empty">
                                    <FiPackage size={40} />
                                    <p>No hay productos vendidos hoy</p>
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card title="💳 Ventas por Método de Pago">
                        <div className="db-chart-container">
                            {salesByPayment.length > 0 ? (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={salesByPayment} cx="50%" cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={95} dataKey="value">
                                            {salesByPayment.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v) => formatCurrency(v)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="db-chart-empty"><p>No hay datos de ventas aún</p></div>
                            )}
                        </div>
                    </Card>
                </div>

                <Card title="⚠️ Stock Bajo">
                    <div className="table-container-dashboard">
                            {lowStock.length > 0 ? (
                                <table className="dashboard-table">
                                    <thead><tr><th>Producto</th><th>Stock</th></tr></thead>
                                    <tbody>
                                        {lowStock.map((p, i) => (
                                            <tr key={i}>
                                                <td className="product-name-dashboard">📦 {p.name}</td>
                                                <td><span className="stock-low-badge">{p.stock}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="db-table-empty">
                                    <FiPackage size={40} />
                                    <p>✅ Stock adecuado</p>
                                </div>
                            )}
                        </div>
                    </Card>

                <Card title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span>🛒 Ventas de Hoy</span>
                        {onNavigate && (
                            <button onClick={() => onNavigate('ventas')} style={{
                                fontSize: 13, fontWeight: 600, color: '#2563eb',
                                background: 'none', border: '1px solid #bfdbfe',
                                borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
                            }}
                            onMouseEnter={e => e.target.style.background = '#eff6ff'}
                            onMouseLeave={e => e.target.style.background = 'none'}>
                                Ver todas →
                            </button>
                        )}
                    </div>
                }>
                    <div className="table-container-dashboard">
                        {recentSales.length > 0 ? (
                            <table className="dashboard-table">
                                <thead>
                                    <tr>
                                        <th>N° Venta</th><th>Fecha</th>
                                        <th>Vendedor</th><th>Método de Pago</th><th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentSales.map((sale, i) => (
                                        <tr key={i}>
                                            <td className="db-sale-number">{sale.sale_number}</td>
                                            <td>{new Date(sale.created_at).toLocaleString('es-CL', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}</td>
                                            <td>{sale.seller_name}</td>
                                            <td><span className="db-payment-badge">{formatPaymentMethod(sale.payment_method)}</span></td>
                                            <td className="db-total-cell">{formatCurrency(sale.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="db-table-empty">
                                <FiShoppingCart size={40} />
                                <p>No hay ventas registradas hoy</p>
                            </div>
                        )}
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default Dashboard;