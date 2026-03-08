// src/pages/Sales/CancelSaleModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import bcrypt from 'bcryptjs';
import { FiX, FiXCircle, FiLock, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import './CancelSaleModal.css';

/**
 * Modal de cancelación de venta.
 * - isAdmin=true  → pide solo motivo y confirma directo
 * - isAdmin=false → pide usuario + contraseña de un admin para autorizar
 */
const CancelSaleModal = ({ sale, isAdmin, onConfirm, onClose }) => {
    const [step, setStep]           = useState(isAdmin ? 'reason' : 'auth');
    const [reason, setReason]       = useState('');
    const [adminUser, setAdminUser] = useState('');
    const [adminPass, setAdminPass] = useState('');
    const [authError, setAuthError] = useState('');
    const [loading, setLoading]     = useState(false);
    const reasonRef = useRef(null);
    const userRef   = useRef(null);

    useEffect(() => {
        setTimeout(() => {
            if (step === 'auth'   && userRef.current)   userRef.current.focus();
            if (step === 'reason' && reasonRef.current) reasonRef.current.focus();
        }, 80);
    }, [step]);

    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // ── Paso 1 (solo vendedor): verificar credenciales admin ─────────────────
    const handleAuth = async (e) => {
        e.preventDefault();
        if (!adminUser.trim() || !adminPass.trim()) {
            setAuthError('Ingresa usuario y contraseña del administrador.');
            return;
        }
        setLoading(true);
        setAuthError('');
        try {
            // ✅ Igual que userRepository.getByUsername — query directo
            const rows = await window.electronAPI.database.query(
                `SELECT id, username, full_name, password_hash, role, is_active
                 FROM users
                 WHERE username = ?
                 LIMIT 1`,
                [adminUser.trim()]
            );

            if (!rows || rows.length === 0) {
                setAuthError('No se encontró un usuario con ese nombre de usuario.');
                setLoading(false);
                return;
            }

            const user = rows[0];

            if (user.role !== 'admin') {
                setAuthError('El usuario ingresado no tiene rol de administrador.');
                setLoading(false);
                return;
            }

            if (!user.is_active) {
                setAuthError('El usuario administrador está inactivo.');
                setLoading(false);
                return;
            }

            // ✅ bcrypt.compareSync — exactamente como userRepository.verifyPassword
            const valid = bcrypt.compareSync(adminPass, user.password_hash);

            if (!valid) {
                setAuthError('Contraseña incorrecta.');
                setLoading(false);
                return;
            }

            // ✅ Autorizado — ir al paso de motivo
            setStep('reason');
        } catch (err) {
            console.error('Error verificando admin:', err);
            setAuthError('Error al verificar credenciales. Intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    // ── Paso 2: confirmar motivo y ejecutar cancelación ──────────────────────
    const handleConfirm = async (e) => {
        e.preventDefault();
        if (!reason.trim()) return;
        setLoading(true);
        try {
            await onConfirm(sale, reason.trim());
        } catch (err) {
            console.error('Error al cancelar:', err);
            setAuthError('Error al cancelar la venta. Intenta nuevamente.');
            setLoading(false);
        }
    };

    const formatCurrency = (v) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

    return (
        <div className="csm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="csm-modal">

                {/* ── HEADER ── */}
                <div className="csm-header">
                    <div className="csm-header-icon">
                        <FiXCircle size={22} color="#ef4444" />
                    </div>
                    <div>
                        <h2 className="csm-title">Cancelar Venta</h2>
                        <p className="csm-sub">{sale.sale_number} — {formatCurrency(sale.total)}</p>
                    </div>
                    <button className="csm-close" onClick={onClose} disabled={loading}>
                        <FiX size={18} />
                    </button>
                </div>

                {/* ── AVISO ── */}
                <div className="csm-warning">
                    <FiAlertTriangle size={15} />
                    <span>Esta acción devolverá el stock de los productos y no se puede deshacer.</span>
                </div>

                {/* ══ PASO AUTH (solo vendedor) ════════════════════════════ */}
                {step === 'auth' && (
                    <form className="csm-body" onSubmit={handleAuth}>
                        <div className="csm-auth-info">
                            <FiLock size={32} color="#7c3aed" />
                            <p>Para cancelar una venta se requiere la autorización de un <strong>administrador</strong>.</p>
                        </div>

                        <div className="csm-field">
                            <label>Usuario administrador</label>
                            <input
                                ref={userRef}
                                type="text"
                                placeholder="Nombre de usuario (ej: admin)"
                                value={adminUser}
                                onChange={(e) => { setAdminUser(e.target.value); setAuthError(''); }}
                                disabled={loading}
                                autoComplete="off"
                            />
                        </div>

                        <div className="csm-field">
                            <label>Contraseña</label>
                            <input
                                type="password"
                                placeholder="Contraseña del administrador"
                                value={adminPass}
                                onChange={(e) => { setAdminPass(e.target.value); setAuthError(''); }}
                                disabled={loading}
                                autoComplete="new-password"
                            />
                        </div>

                        {authError && (
                            <div className="csm-error">
                                <FiAlertTriangle size={13} /> {authError}
                            </div>
                        )}

                        <div className="csm-footer">
                            <button type="button" className="csm-btn csm-btn--secondary"
                                onClick={onClose} disabled={loading}>
                                Cancelar
                            </button>
                            <button type="submit" className="csm-btn csm-btn--purple"
                                disabled={loading || !adminUser.trim() || !adminPass.trim()}>
                                {loading ? <span className="csm-spinner" /> : <><FiLock size={14} /> Verificar</>}
                            </button>
                        </div>
                    </form>
                )}

                {/* ══ PASO REASON ══════════════════════════════════════════ */}
                {step === 'reason' && (
                    <form className="csm-body" onSubmit={handleConfirm}>
                        {!isAdmin && (
                            <div className="csm-auth-ok">
                                <FiCheckCircle size={15} color="#10b981" />
                                <span>Administrador verificado correctamente.</span>
                            </div>
                        )}

                        <div className="csm-field">
                            <label>Motivo de la cancelación <span className="csm-required">*</span></label>
                            <textarea
                                ref={reasonRef}
                                placeholder="Ej: Error en el precio, producto incorrecto, devolución del cliente..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                disabled={loading}
                                rows={3}
                                maxLength={300}
                            />
                            <span className="csm-char-count">{reason.length}/300</span>
                        </div>

                        {authError && (
                            <div className="csm-error">
                                <FiAlertTriangle size={13} /> {authError}
                            </div>
                        )}

                        <div className="csm-footer">
                            <button type="button" className="csm-btn csm-btn--secondary"
                                onClick={onClose} disabled={loading}>
                                Cancelar
                            </button>
                            <button type="submit" className="csm-btn csm-btn--danger"
                                disabled={loading || !reason.trim()}>
                                {loading
                                    ? <span className="csm-spinner" />
                                    : <><FiXCircle size={14} /> Confirmar cancelación</>}
                            </button>
                        </div>
                    </form>
                )}

            </div>
        </div>
    );
};

export default CancelSaleModal;