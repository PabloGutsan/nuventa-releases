// src/pages/Auth/ForceChangePassword.jsx
// Se muestra cuando must_change_password = 1 (primer login con clave por defecto)
import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import './ForceChangePassword.css';

export default function ForceChangePassword({ user, onPasswordChanged }) {
    const [form, setForm]     = useState({ newPassword: '', confirmPassword: '' });
    const [error, setError]   = useState('');
    const [loading, setLoading] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConf, setShowConf] = useState(false);

    const handleChange = (e) => {
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const { newPassword, confirmPassword } = form;

        if (!newPassword || newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.'); return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.'); return;
        }
        // No permitir que sigan usando la clave por defecto
        if (newPassword === 'admin123') {
            setError('No puedes usar la contraseña por defecto. Elige una nueva.'); return;
        }

        setLoading(true);
        try {
            const result = await window.electronAPI.auth.hashPassword(newPassword);
            if (!result.success) throw new Error('Error al procesar la contraseña.');

            await window.electronAPI.database.run(
                `UPDATE users
                 SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [result.hash, user.id]
            );

            onPasswordChanged();
        } catch (err) {
            setError(err.message || 'Error al guardar la contraseña.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fcp-container">
            <div className="fcp-box">

                <div className="fcp-header">
                    <h1 className="fcp-brand">
                        Nu<span className="fcp-brand-v">v</span>enta
                    </h1>
                    <p className="fcp-title">Bienvenido</p>
                    <p className="fcp-sub">
                        Por seguridad, debes cambiar la contraseña antes de continuar.
                    </p>
                </div>

                <Card>
                    <form onSubmit={handleSubmit} className="fcp-form">

                        <div className="fcp-user-badge">
                            <span className="fcp-user-icon">👤</span>
                            <span className="fcp-user-name">{user?.full_name || user?.username}</span>
                            <span className="fcp-role-badge">{user?.role}</span>
                        </div>

                        <div className="fcp-field-wrap">
                            <label className="fcp-input-label">Nueva contraseña <span className="fcp-required">*</span></label>
                            <div className="fcp-input-group">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    name="newPassword"
                                    className="fcp-input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={form.newPassword}
                                    onChange={handleChange}
                                    autoFocus
                                    required
                                />
                                <button
                                    type="button"
                                    className="fcp-eye"
                                    onClick={() => setShowNew(v => !v)}
                                    tabIndex={-1}
                                >
                                    {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="fcp-field-wrap">
                            <label className="fcp-input-label">Confirmar contraseña <span className="fcp-required">*</span></label>
                            <div className="fcp-input-group">
                                <input
                                    type={showConf ? 'text' : 'password'}
                                    name="confirmPassword"
                                    className="fcp-input"
                                    placeholder="Repite la contraseña"
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="fcp-eye"
                                    onClick={() => setShowConf(v => !v)}
                                    tabIndex={-1}
                                >
                                    {showConf ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Indicador de fortaleza */}
                        {form.newPassword.length > 0 && (
                            <div className="fcp-strength">
                                <div className={`fcp-strength-bar fcp-strength-bar--${
                                    form.newPassword.length < 6 ? 'weak' :
                                    form.newPassword.length < 10 ? 'medium' : 'strong'
                                }`} />
                                <span className="fcp-strength-label">
                                    {form.newPassword.length < 6 ? 'Muy corta' :
                                     form.newPassword.length < 10 ? 'Aceptable' : 'Segura ✓'}
                                </span>
                            </div>
                        )}

                        {error && <div className="fcp-error">{error}</div>}

                        <Button
                            type="submit"
                            variant="primary"
                            size="large"
                            fullWidth
                            loading={loading}
                        >
                            Guardar y continuar
                        </Button>

                        <p className="fcp-hint">
                            Esta acción es obligatoria y solo se solicita una vez.
                        </p>
                    </form>
                </Card>
            </div>
        </div>
    );
}