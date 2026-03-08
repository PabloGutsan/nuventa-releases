import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import UserRepository from '../../services/repositories/userRepository';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import UserModal from './UserModal';
import PasswordModal from './PasswordModal';
import ResetPasswordModal from './ResetPasswordModal';
import {
    FiPlus, FiEdit, FiKey, FiRefreshCw,
    FiToggleLeft, FiToggleRight,
    FiUser, FiUserCheck, FiUserX, FiShield
} from 'react-icons/fi';
import './UsersList.css';

// ── Modal de confirmación / alerta React ──────────────────────────────────────
const Dialog = ({ message, confirmLabel = 'Confirmar', confirmVariant = 'danger', onConfirm, onCancel }) => (
    <div className="ul-dialog-overlay" onClick={onCancel || undefined}>
        <div className="ul-dialog" onClick={e => e.stopPropagation()}>
            <div className="ul-dialog-icon">
                {confirmVariant === 'danger'   ? '⚠️' :
                 confirmVariant === 'success'  ? '✅' :
                 confirmVariant === 'warning'  ? '⚠️' : 'ℹ️'}
            </div>
            <p className="ul-dialog-message">{message}</p>
            <div className="ul-dialog-actions">
                {onCancel && (
                    <button className="ul-dialog-btn ul-dialog-btn--cancel" onClick={onCancel}>
                        Cancelar
                    </button>
                )}
                <button className={`ul-dialog-btn ul-dialog-btn--${confirmVariant}`} onClick={onConfirm}>
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

const UsersList = () => {
    const { db } = useDatabase();
    const { currentUser } = useAuth();
    const [users,   setUsers]   = useState([]);
    const [stats,   setStats]   = useState({ total: 0, active: 0, inactive: 0, admins: 0 });
    const [loading, setLoading] = useState(true);

    const [showUserModal,          setShowUserModal]          = useState(false);
    const [showPasswordModal,      setShowPasswordModal]      = useState(false);
    const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
    const [selectedUser,           setSelectedUser]           = useState(null);

    const [dialog, setDialog] = useState(null);

    const mainRef  = useRef(null);
    const userRepo = new UserRepository(db);

    // ── Helpers de diálogo ────────────────────────────────────────────────────
    const showConfirm = ({ message, confirmLabel, confirmVariant = 'danger', onConfirm }) => {
        setDialog({
            message, confirmLabel, confirmVariant,
            onConfirm,
            onCancel: () => { setDialog(null); }
        });
    };

    const showAlert = (message, variant = 'primary') => {
        setDialog({
            message,
            confirmLabel:   'Aceptar',
            confirmVariant: variant,
            onConfirm: () => { setDialog(null); },
            onCancel:  null,
        });
    };

    // ── Carga de datos ────────────────────────────────────────────────────────
    // ORDEN IMPORTANTE: loadUsers → loadStats → loadData → useEffect
    // loadData usa useCallback para poder incluirse como dep del useEffect
    // sin causar bucle infinito.

    const loadUsers = async () => {
        try {
            const data = await userRepo.getAll();
            if (!Array.isArray(data)) { setUsers([]); return; }
            setUsers(data.map(u => ({
                ...u,
                is_active:  u.is_active === 1 || u.is_active === true,
                last_login: u.last_login || null
            })));
        } catch (error) {
            console.error('❌ Error loading users:', error);
            setUsers([]);
        }
    };

    const loadStats = async () => {
        try {
            const allUsers = await userRepo.getAll();
            if (!Array.isArray(allUsers)) { setStats({ total: 0, active: 0, inactive: 0, admins: 0 }); return; }
            setStats({
                total:    allUsers.length,
                active:   allUsers.filter(u => u.is_active === 1 || u.is_active === true).length,
                inactive: allUsers.filter(u => u.is_active === 0 || u.is_active === false).length,
                admins:   allUsers.filter(u => u.role === 'admin').length
            });
        } catch (error) {
            console.error('❌ Error loading stats:', error);
            setStats({ total: 0, active: 0, inactive: 0, admins: 0 });
        }
    };

    // loadData DEBE ir después de loadUsers y loadStats
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            await Promise.all([loadUsers(), loadStats()]);
        } catch (error) {
            console.error('❌ Error cargando datos:', error);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    // useEffect DEBE ir después de loadData
    useEffect(() => { if (db) loadData(); }, [db, loadData]);

    // Cerrar diálogo con Escape
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && dialog) {
                if (dialog.onCancel) dialog.onCancel();
                else { setDialog(null); }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleAdd = () => {
        if (stats.active >= 20) {
            showAlert('⚠️ Límite de 20 usuarios activos alcanzado\n\nDesactiva un usuario existente antes de agregar uno nuevo.', 'warning');
            return;
        }
        setSelectedUser(null);
        setShowUserModal(true);
    };

    const handleEdit = (user) => {
        if (!user || typeof user !== 'object') { showAlert('Error: Usuario inválido'); return; }
        setSelectedUser(user);
        setShowUserModal(true);
    };

    const handleChangePassword = (user) => {
        if (!user || typeof user !== 'object') { showAlert('Error: Usuario inválido'); return; }
        setSelectedUser(user);
        setShowPasswordModal(true);
    };

    const handleResetPassword = (user) => {
        if (!user || typeof user !== 'object') { showAlert('Error: Usuario inválido'); return; }
        setSelectedUser(user);
        setShowResetPasswordModal(true);
    };

    const handleToggleActive = (user) => {
        if (!user || typeof user !== 'object') { showAlert('Error: Usuario inválido'); return; }

        if (currentUser && user.id === currentUser.id) {
            showAlert('⚠️ No puedes desactivarte a ti mismo', 'warning');
            return;
        }

        if (user.role === 'admin' && user.is_active) {
            const activeAdmins = users.filter(u =>
                u.role === 'admin' &&
                (u.is_active === 1 || u.is_active === true) &&
                u.id !== user.id
            );
            if (activeAdmins.length === 0) {
                showAlert('⚠️ No puedes desactivar el último administrador activo\n\nDebe haber al menos un administrador activo en el sistema.', 'warning');
                return;
            }
        }

        const action    = user.is_active ? 'desactivar' : 'activar';
        const actionCap = action.charAt(0).toUpperCase() + action.slice(1);
        const variant   = user.is_active ? 'danger' : 'success';

        showConfirm({
            message:        `¿${actionCap} al usuario "${user.full_name}" (@${user.username})?`,
            confirmLabel:   actionCap,
            confirmVariant: variant,
            onConfirm: async () => {
                setDialog(null);
                try {
                    await userRepo.toggleActive(user.id);
                    await loadData();
                    showAlert(`Usuario ${action}ado exitosamente`, 'success');
                } catch (error) {
                    console.error('❌ Error toggling user:', error);
                    const msg = error.message?.includes('last admin')
                        ? 'No puedes desactivar el último administrador'
                        : error.message || 'Error desconocido';
                    showAlert(`❌ ${msg}`, 'danger');
                }
            }
        });
    };

    const handleSave = async (msg, variant = 'success', keepOpen = false) => {
        if (!keepOpen) {
            setShowUserModal(false);
            setShowPasswordModal(false);
            setShowResetPasswordModal(false);
            await loadData();
        }
        if (msg) showAlert(msg, variant);
    };

    // ── Formato ───────────────────────────────────────────────────────────────
    const formatRole = (role) =>
        ({ admin: 'Administrador', vendedor: 'Vendedor', inventario: 'Inventario' }[role] || role);

    const getRoleIcon = (role) =>
        ({ admin: '👑', vendedor: '💼', inventario: '📦' }[role] || '👤');

    const formatLastLogin = (lastLogin) => {
        if (!lastLogin) return 'Nunca';
        try {
            const date = new Date(lastLogin);
            if (isNaN(date.getTime())) return 'Nunca';
            const now  = new Date();
            const diff = now - date;
            const mins  = Math.floor(diff / 60000);
            const hours = Math.floor(diff / 3600000);
            const days  = Math.floor(diff / 86400000);
            if (mins  < 1)  return 'Hace un momento';
            if (mins  < 60) return `Hace ${mins} min`;
            if (hours < 24) return `Hace ${hours}h`;
            if (days  < 7)  return `Hace ${days}d`;
            return date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch { return 'Nunca'; }
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="main-content-scrollable">
                <div className="users-list">
                    <div className="ul-loading">
                        <div className="ul-spinner"></div>
                        <p>Cargando usuarios...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="main-content-scrollable">
            <div className="users-list" ref={mainRef} tabIndex={-1}>

                {/* ── 1. HEADER ── */}
                <div className="ul-page-header">
                    <div>
                        <h1 className="ul-page-title">Gestión de Usuarios</h1>
                        <p className="ul-page-subtitle">Administra los usuarios del sistema (máximo 20 activos)</p>
                    </div>
                    <Button variant="primary" icon={<FiPlus />} onClick={handleAdd} disabled={stats.active >= 20}>
                        {stats.active >= 20 ? 'Límite Alcanzado' : 'Agregar Usuario'}
                    </Button>
                </div>

                {stats.active >= 20 && (
                    <div className="ul-alert ul-alert--warning">
                        ⚠️ Has alcanzado el límite de 20 usuarios activos. Desactiva uno existente para agregar uno nuevo.
                    </div>
                )}

                {/* ── 2. STATS ── */}
                <div className="ul-stats">
                    <div className="ul-stat-card">
                        <div className="ul-stat-icon ul-stat-icon--blue"><FiUser size={20} color="#2563eb" /></div>
                        <div className="ul-stat-body">
                            <div className="ul-stat-value">{stats.total}</div>
                            <div className="ul-stat-label">Total Usuarios</div>
                        </div>
                    </div>
                    <div className="ul-stat-card ul-stat-card--green">
                        <div className="ul-stat-icon ul-stat-icon--green"><FiUserCheck size={20} color="#10b981" /></div>
                        <div className="ul-stat-body">
                            <div className="ul-stat-value">{stats.active} / 20</div>
                            <div className="ul-stat-label">Activos</div>
                            <div className="ul-stat-sub">{20 - stats.active} disponibles</div>
                        </div>
                    </div>
                    <div className="ul-stat-card ul-stat-card--red">
                        <div className="ul-stat-icon ul-stat-icon--red"><FiUserX size={20} color="#ef4444" /></div>
                        <div className="ul-stat-body">
                            <div className="ul-stat-value">{stats.inactive}</div>
                            <div className="ul-stat-label">Inactivos</div>
                        </div>
                    </div>
                    <div className="ul-stat-card ul-stat-card--yellow">
                        <div className="ul-stat-icon ul-stat-icon--yellow"><FiShield size={20} color="#f59e0b" /></div>
                        <div className="ul-stat-body">
                            <div className="ul-stat-value">{stats.admins}</div>
                            <div className="ul-stat-label">Administradores</div>
                        </div>
                    </div>
                </div>

                {/* ── 3. TABLA ── */}
                <Card>
                    <div className="ul-table-container">
                        {users.length === 0 ? (
                            <div className="ul-empty-state">
                                <FiUser size={48} />
                                <p>No hay usuarios registrados</p>
                                <Button variant="primary" icon={<FiPlus />} onClick={handleAdd} style={{ marginTop: '16px' }}>
                                    Crear Primer Usuario
                                </Button>
                            </div>
                        ) : (
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>Usuario</th>
                                        <th>Nombre Completo</th>
                                        <th>Email</th>
                                        <th>Rol</th>
                                        <th>Último Acceso</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id} className={!user.is_active ? 'inactive-row' : ''}>
                                            <td>
                                                <div className="ul-username-cell">
                                                    <FiUser size={15} />
                                                    <span>{user.username}</span>
                                                    {currentUser && user.id === currentUser.id && (
                                                        <span className="ul-current-badge">Tú</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{user.full_name}</td>
                                            <td>{user.email || '-'}</td>
                                            <td>
                                                <span className={`ul-role-badge ul-role-badge--${user.role}`}>
                                                    {getRoleIcon(user.role)} {formatRole(user.role)}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={user.last_login ? 'ul-login-recent' : 'ul-login-never'}>
                                                    {formatLastLogin(user.last_login)}
                                                </span>
                                            </td>
                                            <td>
                                                {user.is_active
                                                    ? <span className="ul-status-badge ul-status-badge--active"><FiUserCheck size={13} /> Activo</span>
                                                    : <span className="ul-status-badge ul-status-badge--inactive"><FiUserX size={13} /> Inactivo</span>}
                                            </td>
                                            <td>
                                                <div className="ul-action-buttons">
                                                    {/* Editar */}
                                                    <button
                                                        className="ul-action-btn edit"
                                                        onClick={() => handleEdit(user)}
                                                        title="Editar usuario"
                                                    >
                                                        <FiEdit />
                                                    </button>

                                                    {/* Cambiar contraseña */}
                                                    <button
                                                        className="ul-action-btn password"
                                                        onClick={() => handleChangePassword(user)}
                                                        title="Cambiar contraseña"
                                                    >
                                                        <FiKey />
                                                    </button>

                                                    {/* Resetear contraseña — solo para otros usuarios */}
                                                    {currentUser && user.id !== currentUser.id && (
                                                        <button
                                                            className="ul-action-btn reset"
                                                            onClick={() => handleResetPassword(user)}
                                                            title="Resetear contraseña — asigna una clave temporal"
                                                        >
                                                            <FiRefreshCw />
                                                        </button>
                                                    )}

                                                    {/* Activar / Desactivar */}
                                                    <button
                                                        className={`ul-action-btn ${user.is_active ? 'deactivate' : 'activate'}`}
                                                        onClick={() => handleToggleActive(user)}
                                                        title={user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                                                        disabled={currentUser && user.id === currentUser.id}
                                                    >
                                                        {user.is_active ? <FiToggleRight /> : <FiToggleLeft />}
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

                {/* ── 4. INFO ── */}
                <Card>
                    <div className="ul-info-section">
                        <h3>Información sobre Usuarios</h3>
                        <ul className="ul-info-list">
                            <li><strong>Límite</strong> Máximo 20 usuarios activos simultáneamente</li>
                            <li>
                                <strong>Roles</strong>
                                <ul className="ul-roles-list">
                                    <li>👑 <strong>Administrador:</strong> Acceso completo al sistema</li>
                                    <li>💼 <strong>Vendedor:</strong> Realizar ventas y ver sus propias transacciones</li>
                                    <li>📦 <strong>Inventario:</strong> Gestionar productos y stock</li>
                                </ul>
                            </li>
                            <li><strong>Seguridad</strong> No puedes desactivarte a ti mismo ni desactivar el último administrador</li>
                            <li><strong>Recuperación de acceso</strong> Usa el botón <FiRefreshCw size={12} style={{ verticalAlign: 'middle', marginInline: 2 }} /> para asignar una contraseña temporal a un usuario que olvidó la suya. Deberá cambiarla en su próximo ingreso.</li>
                        </ul>
                    </div>
                </Card>

                {/* ── Modales ── */}
                {showUserModal && (
                    <UserModal
                        user={selectedUser}
                        onClose={() => setShowUserModal(false)}
                        onSave={handleSave}
                    />
                )}
                {showPasswordModal && selectedUser && (
                    <PasswordModal
                        user={selectedUser}
                        onClose={() => setShowPasswordModal(false)}
                        onSave={handleSave}
                    />
                )}
                {showResetPasswordModal && selectedUser && (
                    <ResetPasswordModal
                        user={selectedUser}
                        onClose={() => setShowResetPasswordModal(false)}
                        onSave={handleSave}
                    />
                )}

                {/* ── Diálogo React ── */}
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

export default UsersList;