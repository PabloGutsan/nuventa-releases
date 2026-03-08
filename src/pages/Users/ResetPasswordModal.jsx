import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import UserRepository from '../../services/repositories/userRepository';
import { FiX, FiRefreshCw, FiEye, FiEyeOff, FiAlertTriangle } from 'react-icons/fi';
import './ResetPasswordModal.css';

// ── ResetPasswordModal ────────────────────────────────────────────────────────
// El admin asigna una contraseña temporal a otro usuario.
// Se activa must_change_password = 1 → el usuario deberá cambiarla en su
// próximo ingreso usando ForceChangePassword.
// ─────────────────────────────────────────────────────────────────────────────

const ResetPasswordModal = ({ user, onClose, onSave }) => {
    const { db } = useDatabase();
    const userRepo = new UserRepository(db);

    const [password,    setPassword]    = useState('');
    const [showPass,    setShowPass]    = useState(false);
    const [loading,     setLoading]     = useState(false);
    const [error,       setError]       = useState('');
    const [strength,    setStrength]    = useState({ score: 0, label: '', color: '' });

    // Bloquear scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Calcular fortaleza
    useEffect(() => {
        if (!password) { setStrength({ score: 0, label: '', color: '' }); return; }
        let score = 0;
        if (password.length >= 6)  score++;
        if (password.length >= 8)  score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        setStrength(
            score <= 2 ? { score, label: 'Débil',     color: '#ef4444' } :
            score <= 4 ? { score, label: 'Aceptable', color: '#f59e0b' } :
            score <= 6 ? { score, label: 'Buena',     color: '#10b981' } :
                         { score, label: 'Excelente', color: '#059669' }
        );
    }, [password]);

    const handleClose = () => {
        if (loading) return;
        document.body.style.overflow = '';
        onClose();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!password || password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);
        try {
            // 1. Cambiar la contraseña (sin tocar must_change_password)
            await userRepo.changePassword(user.id, password, false);

            // 2. Activar must_change_password = 1 explícitamente
            await userRepo.requirePasswordChange(user.id);

            onSave(
                `✅ Contraseña de "${user.full_name}" reseteada. El usuario deberá cambiarla en su próximo ingreso.`,
                'success'
            );
        } catch (err) {
            console.error('❌ Error reseteando contraseña:', err);
            setError(err.message || 'Error al resetear la contraseña');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rpm-overlay" onClick={handleClose}>
            <div className="rpm-modal" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="rpm-header">
                    <div className="rpm-header__left">
                        <FiRefreshCw size={18} />
                        <h2>Resetear Contraseña</h2>
                    </div>
                    <button className="rpm-close" onClick={handleClose} disabled={loading} type="button">
                        <FiX />
                    </button>
                </div>

                {/* Aviso */}
                <div className="rpm-warning">
                    <FiAlertTriangle size={16} className="rpm-warning__icon" />
                    <div>
                        <p className="rpm-warning__title">Estás reseteando la contraseña de:</p>
                        <p className="rpm-warning__user">
                            <strong>{user.full_name}</strong>
                            <span className="rpm-warning__username">@{user.username}</span>
                            <span className={`rpm-warning__role rpm-warning__role--${user.role}`}>
                                {{ admin: '👑', vendedor: '💼', inventario: '📦' }[user.role]} 
                                {{ admin: 'Admin', vendedor: 'Vendedor', inventario: 'Inventario' }[user.role]}
                            </span>
                        </p>
                        <p className="rpm-warning__note">
                            El usuario deberá cambiar esta contraseña temporal en su próximo inicio de sesión.
                        </p>
                    </div>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="rpm-body">

                    <div className="rpm-field">
                        <label className="rpm-label">
                            Contraseña temporal <span className="rpm-required">*</span>
                        </label>
                        <div className="rpm-input-group">
                            <input
                                type={showPass ? 'text' : 'password'}
                                className="rpm-input"
                                placeholder="Mínimo 6 caracteres"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                autoFocus
                                disabled={loading}
                                maxLength={255}
                            />
                            <button
                                type="button"
                                className="rpm-eye"
                                onClick={() => setShowPass(v => !v)}
                                tabIndex={-1}
                            >
                                {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                        </div>

                        {/* Barra de fortaleza */}
                        {password && (
                            <div className="rpm-strength">
                                <div className="rpm-strength__bar">
                                    <div
                                        className="rpm-strength__fill"
                                        style={{
                                            width: `${(strength.score / 7) * 100}%`,
                                            backgroundColor: strength.color
                                        }}
                                    />
                                </div>
                                <span className="rpm-strength__label" style={{ color: strength.color }}>
                                    {strength.label}
                                </span>
                            </div>
                        )}

                        {error && <p className="rpm-error">{error}</p>}
                    </div>

                    {/* Tip */}
                    <div className="rpm-tip">
                        💡 Comunica esta contraseña al usuario de forma segura y pídele que la cambie de inmediato.
                    </div>

                </form>

                {/* Footer */}
                <div className="rpm-footer">
                    <button
                        type="button"
                        className="rpm-btn rpm-btn--cancel"
                        onClick={handleClose}
                        disabled={loading}
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="rpm-btn rpm-btn--primary"
                        onClick={handleSubmit}
                        disabled={loading || !password}
                    >
                        {loading
                            ? <><span className="rpm-spinner" /> Reseteando...</>
                            : <><FiRefreshCw size={15} /> Resetear contraseña</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordModal;