import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import SupplierRepository from '../../services/repositories/supplierRepository';
import { exportSuppliersToExcel, exportSuppliersToPDF } from '../../services/export/supplierExport';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import SupplierModal from './SupplierModal';
import SupplierDetailModal from './SupplierDetailModal';
import {
    FiPlus, FiSearch, FiEdit2, FiEye, FiTruck, FiUsers,
    FiShoppingBag, FiCheckCircle, FiXCircle, FiDownload, FiRefreshCw,
} from 'react-icons/fi';
import './SupplierList.css';

// ── Helper: restaurar foco (robusto para Electron) ────────────────────────────
const restoreFocus = (ref) => {
    if (!ref?.current) return;
    ref.current.focus();
    [50, 150, 300, 500].forEach(ms =>
        setTimeout(() => { if (document.activeElement !== ref.current) ref.current?.focus(); }, ms)
    );
};

// ── Dialog React (reemplaza window.confirm / window.alert) ───────────────────
const DIALOG_ICONS = { danger: '⚠️', success: '✅', warning: '⚠️', primary: 'ℹ️' };

const Dialog = ({ message, confirmLabel = 'Confirmar', confirmVariant = 'danger', onConfirm, onCancel }) => (
    <div className="sl-dialog-overlay" onClick={onCancel || undefined}>
        <div className="sl-dialog" onClick={e => e.stopPropagation()}>
            <div className="sl-dialog-icon">
                {DIALOG_ICONS[confirmVariant] || 'ℹ️'}
            </div>
            <p className="sl-dialog-message">{message}</p>
            <div className="sl-dialog-actions">
                {onCancel && (
                    <button className="sl-dialog-btn sl-dialog-btn--cancel" onClick={onCancel}>
                        Cancelar
                    </button>
                )}
                <button className={`sl-dialog-btn sl-dialog-btn--${confirmVariant}`} onClick={onConfirm}>
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

const SupplierList = () => {
    const { db } = useDatabase();
    const [suppliers,         setSuppliers]         = useState([]);
    const [filteredSuppliers, setFilteredSuppliers] = useState([]);
    const [searchTerm,        setSearchTerm]        = useState('');
    const [filterActive,      setFilterActive]      = useState('all');
    const [showModal,         setShowModal]         = useState(false);
    const [editingSupplier,   setEditingSupplier]   = useState(null);
    const [selectedSupplier,  setSelectedSupplier]  = useState(null);
    const [loading,           setLoading]           = useState(true);
    const [exporting,         setExporting]         = useState(null);

    // ── Dialog React ──────────────────────────────────────────────────────────
    const [dialog, setDialog] = useState(null);
    const searchInputRef      = useRef(null);

    const supplierRepo = new SupplierRepository(db);

    useEffect(() => { loadSuppliers(); }, []); // eslint-disable-line
    useEffect(() => { filterSuppliers(); }, [searchTerm, filterActive, suppliers]); // eslint-disable-line

    // Cerrar dialog con Escape
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && dialog) {
                if (dialog.onCancel) dialog.onCancel();
                else setDialog(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog]);

    // ── Helpers de dialog ─────────────────────────────────────────────────────
    const showConfirm = ({ message, confirmLabel, confirmVariant = 'danger', onConfirm }) => {
        setDialog({ message, confirmLabel, confirmVariant, onConfirm,
            onCancel: () => { setDialog(null); restoreFocus(searchInputRef); }
        });
    };

    const showAlert = (message, variant = 'primary') => {
        setDialog({
            message, confirmLabel: 'Aceptar', confirmVariant: variant,
            onConfirm: () => { setDialog(null); restoreFocus(searchInputRef); },
            onCancel: null,
        });
    };

    const showSuccess = (message) => {
        setDialog({
            message, confirmLabel: 'Aceptar', confirmVariant: 'success',
            onConfirm: () => { setDialog(null); restoreFocus(searchInputRef); },
            onCancel: null,
        });
    };

    // ── Carga ─────────────────────────────────────────────────────────────────
    const loadSuppliers = async () => {
        try {
            setLoading(true);
            const data = await supplierRepo.getAll();
            if (!Array.isArray(data)) { setSuppliers([]); setFilteredSuppliers([]); return; }
            setSuppliers(data);
            setFilteredSuppliers(data);
        } catch (error) {
            console.error('Error loading suppliers:', error);
            setSuppliers([]); setFilteredSuppliers([]);
        } finally {
            setLoading(false);
        }
    };

    const filterSuppliers = () => {
        if (!Array.isArray(suppliers)) { setFilteredSuppliers([]); return; }
        let filtered = [...suppliers];
        if (filterActive !== 'all') {
            const isActive = filterActive === 'active' ? 1 : 0;
            filtered = filtered.filter(s => s.is_active === isActive);
        }
        if (searchTerm?.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(s =>
                (s.business_name || '').toLowerCase().includes(term) ||
                (s.rut           || '').toLowerCase().includes(term) ||
                (s.contact_name  || '').toLowerCase().includes(term) ||
                (s.phone         || '').toLowerCase().includes(term)
            );
        }
        setFilteredSuppliers(filtered);
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleCreateSupplier = () => { setEditingSupplier(null); setShowModal(true); };

    const handleEditSupplier = (supplier) => {
        if (!supplier || typeof supplier !== 'object') return;
        setEditingSupplier(supplier);
        setShowModal(true);
    };

    const handleToggleActive = (supplier) => {
        if (!supplier || typeof supplier !== 'object') return;
        const action    = supplier.is_active ? 'desactivar' : 'activar';
        const actionCap = action.charAt(0).toUpperCase() + action.slice(1);
        const variant   = supplier.is_active ? 'danger' : 'success';
        const pastTense = supplier.is_active ? 'desactivado' : 'activado';

        showConfirm({
            message:        `¿${actionCap} el proveedor "${supplier.business_name}"?`,
            confirmLabel:   actionCap,
            confirmVariant: variant,
            onConfirm: async () => {
                setDialog(null);
                try {
                    if (supplier.is_active) await supplierRepo.deactivate(supplier.id);
                    else                    await supplierRepo.activate(supplier.id);
                    await loadSuppliers();
                    showSuccess(`Proveedor "${supplier.business_name}" ${pastTense} exitosamente.`);
                } catch (error) {
                    showAlert(`Error al ${action} el proveedor: ${error.message}`, 'danger');
                }
            }
        });
    };

    // onSave recibe (msg?, variant?, keepOpen?) desde SupplierModal
    const handleSaveSupplier = async (msg, variant = 'success', keepOpen = false) => {
        if (!keepOpen) {
            setShowModal(false);
            await loadSuppliers();
        }
        if (msg) showAlert(msg, variant);
    };

    const handleExport = async (type) => {
        if (filteredSuppliers.length === 0) return;
        setExporting(type);
        try {
            const businessInfo = await window.electronAPI.database.get(
                'SELECT name FROM business_info WHERE id = 1'
            );
            const params = {
                suppliers:    filteredSuppliers,
                businessName: businessInfo?.name || 'Mi Negocio',
            };
            if (type === 'excel') await exportSuppliersToExcel(params);
            else                  await exportSuppliersToPDF(params);
        } catch (err) {
            showAlert('Error al exportar: ' + err.message, 'danger');
        } finally {
            setExporting(null);
        }
    };

    const getStats = () => {
        if (!Array.isArray(suppliers)) return { total: 0, active: 0, totalPurchases: 0 };
        return {
            total:          suppliers.length,
            active:         suppliers.filter(s => s.is_active === 1).length,
            totalPurchases: suppliers.reduce((sum, s) => sum + (parseInt(s.purchases_count) || 0), 0),
        };
    };

    const stats = getStats();

    if (loading) {
        return (
            <div className="main-content-scrollable">
                <div className="supplier-list">
                    <div className="sl-loading">
                        <div className="sl-spinner"></div>
                        <p>Cargando proveedores...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="main-content-scrollable">
            <div className="supplier-list">

                {/* ── HEADER ── */}
                <div className="sl-page-header">
                    <div>
                        <h1 className="sl-page-title">Proveedores</h1>
                        <p className="sl-page-subtitle">Gestiona tus proveedores y sus contactos</p>
                    </div>
                    <div className="sl-header-actions">
                        <button className="rp-btn-export rp-btn-excel"
                            onClick={() => handleExport('excel')}
                            disabled={exporting !== null || filteredSuppliers.length === 0}>
                            <FiDownload size={14} />
                            {exporting === 'excel' ? 'Exportando...' : 'Descargar Excel'}
                        </button>
                        <button className="rp-btn-export rp-btn-pdf"
                            onClick={() => handleExport('pdf')}
                            disabled={exporting !== null || filteredSuppliers.length === 0}>
                            <FiDownload size={14} />
                            {exporting === 'pdf' ? 'Exportando...' : 'Descargar PDF'}
                        </button>
                        <button className="rp-refresh" onClick={loadSuppliers} disabled={loading}>
                            <FiRefreshCw size={14} className={loading ? 'spin' : ''} />
                            Actualizar
                        </button>
                        <Button variant="primary" icon={<FiPlus />} onClick={handleCreateSupplier}>
                            Nuevo Proveedor
                        </Button>
                    </div>
                </div>

                {/* ── STATS ── */}
                <div className="sl-stats">
                    <div className="sl-stat-card">
                        <div className="sl-stat-icon sl-stat-icon--blue"><FiTruck size={20} color="#2563eb" /></div>
                        <div className="sl-stat-body">
                            <div className="sl-stat-value">{stats.total}</div>
                            <div className="sl-stat-label">Total Proveedores</div>
                        </div>
                    </div>
                    <div className="sl-stat-card sl-stat-card--green">
                        <div className="sl-stat-icon sl-stat-icon--green"><FiUsers size={20} color="#10b981" /></div>
                        <div className="sl-stat-body">
                            <div className="sl-stat-value">{stats.active}</div>
                            <div className="sl-stat-label">Activos</div>
                        </div>
                    </div>
                    <div className="sl-stat-card sl-stat-card--purple">
                        <div className="sl-stat-icon sl-stat-icon--purple"><FiShoppingBag size={20} color="#8b5cf6" /></div>
                        <div className="sl-stat-body">
                            <div className="sl-stat-value">{stats.totalPurchases}</div>
                            <div className="sl-stat-label">Compras Totales</div>
                        </div>
                    </div>
                </div>

                {/* ── TOOLBAR ── */}
                <div className="sl-toolbar">
                    <div className="sl-tabs">
                        <button className={`sl-tab ${filterActive === 'all'      ? 'active' : ''}`} onClick={() => setFilterActive('all')}>
                            <span className="sl-tab-icon">📋</span>
                            <span className="sl-tab-label">Todos</span>
                            <span className="sl-tab-count">{stats.total}</span>
                        </button>
                        <button className={`sl-tab ${filterActive === 'active'   ? 'active' : ''}`} onClick={() => setFilterActive('active')}>
                            <span className="sl-tab-icon">✅</span>
                            <span className="sl-tab-label">Activos</span>
                            <span className="sl-tab-count">{stats.active}</span>
                        </button>
                        <button className={`sl-tab ${filterActive === 'inactive' ? 'active' : ''}`} onClick={() => setFilterActive('inactive')}>
                            <span className="sl-tab-icon">❌</span>
                            <span className="sl-tab-label">Inactivos</span>
                            <span className="sl-tab-count">{stats.total - stats.active}</span>
                        </button>
                    </div>
                    <div className="sl-search-wrap">
                        <FiSearch className="sl-search-icon" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar por nombre, RUT, contacto o teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="sl-search-input"
                        />
                        {searchTerm && (
                            <button className="sl-search-clear"
                                onClick={() => { setSearchTerm(''); restoreFocus(searchInputRef); }}>✕</button>
                        )}
                    </div>
                </div>

                {/* ── TABLA ── */}
                <Card>
                    <div className="sl-table-container">
                        {filteredSuppliers.length === 0 ? (
                            <div className="sl-empty-state">
                                <FiTruck size={48} />
                                <p>
                                    {searchTerm || filterActive !== 'all'
                                        ? 'No se encontraron proveedores con los filtros aplicados'
                                        : 'No hay proveedores registrados'}
                                </p>
                                {!searchTerm && filterActive === 'all' && (
                                    <Button variant="primary" icon={<FiPlus />} onClick={handleCreateSupplier} style={{ marginTop: '16px' }}>
                                        Crear Primer Proveedor
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <table className="suppliers-table">
                                <thead>
                                    <tr>
                                        <th>Proveedor</th>
                                        <th>RUT</th>
                                        <th>Contacto</th>
                                        <th>Teléfono</th>
                                        <th>Email</th>
                                        <th>Productos</th>
                                        <th>Compras</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.map(supplier => (
                                        <tr key={supplier.id} className={!supplier.is_active ? 'inactive-row' : ''}>
                                            <td>
                                                <div className="supplier-name-cell">
                                                    <strong>{supplier.business_name}</strong>
                                                    {supplier.legal_name && (
                                                        <span className="supplier-legal-name">{supplier.legal_name}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td><span className="supplier-rut">{supplier.rut || '-'}</span></td>
                                            <td>{supplier.contact_name || '-'}</td>
                                            <td><span className="supplier-phone">{supplier.phone || '-'}</span></td>
                                            <td>
                                                {supplier.email
                                                    ? <a href={`mailto:${supplier.email}`} className="supplier-email">{supplier.email}</a>
                                                    : '-'}
                                            </td>
                                            <td><span className="count-badge">{supplier.products_count || 0}</span></td>
                                            <td><span className="count-badge">{supplier.purchases_count || 0}</span></td>
                                            <td>
                                                <span className={`status-badge ${supplier.is_active ? 'active' : 'inactive'}`}>
                                                    {supplier.is_active
                                                        ? <><FiCheckCircle size={14} /> Activo</>
                                                        : <><FiXCircle size={14} /> Inactivo</>}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="sl-action-buttons">
                                                    <button className="sl-action-btn view"
                                                        onClick={() => setSelectedSupplier(supplier)}
                                                        title="Ver detalle y productos">
                                                        <FiEye />
                                                    </button>
                                                    <button className="sl-action-btn edit"
                                                        onClick={() => handleEditSupplier(supplier)}
                                                        title="Editar">
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        className={`sl-action-btn ${supplier.is_active ? 'delete' : 'activate'}`}
                                                        onClick={() => handleToggleActive(supplier)}
                                                        title={supplier.is_active ? 'Desactivar' : 'Activar'}>
                                                        {supplier.is_active ? <FiXCircle /> : <FiCheckCircle />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>

                {/* ── Modales ── */}
                {showModal && (
                    <SupplierModal
                        supplier={editingSupplier}
                        onSave={handleSaveSupplier}
                        onClose={() => setShowModal(false)}
                        db={db}
                    />
                )}
                {selectedSupplier && (
                    <SupplierDetailModal
                        supplier={selectedSupplier}
                        onClose={() => setSelectedSupplier(null)}
                        onEdit={(s) => { setSelectedSupplier(null); handleEditSupplier(s); }}
                    />
                )}

                {/* ── Dialog React (reemplaza window.confirm / window.alert) ── */}
                {dialog && (
                    <Dialog
                        message={dialog.message}
                        confirmLabel={dialog.confirmLabel}
                        confirmVariant={dialog.confirmVariant}
                        onConfirm={dialog.onConfirm}
                        onCancel={dialog.onCancel}
                    />
                )}
            </div>
        </div>
    );
};

export default SupplierList;