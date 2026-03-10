import React, { useState } from 'react';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://api.nuventa.cl';

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]       = useState('');
    const [loading, setLoading]   = useState(false);

    const [recover, setRecover]               = useState('idle');
    const [recoverForm, setRecoverForm]       = useState({ email: '', licenseKey: '', code: '', newPassword: '', confirmPassword: '' });
    const [recoverError, setRecoverError]     = useState('');
    const [recoverLoading, setRecoverLoading] = useState(false);
    const [maskedEmail, setMaskedEmail]       = useState('');
    const [showNewPass, setShowNewPass]       = useState(false);
    const [showConfPass, setShowConfPass]     = useState(false);

    // ── Login normal ───────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!username || !password) { setError('Por favor completa todos los campos'); return; }
        setLoading(true);
        try {
            const result = await onLogin(username, password);
            if (!result.success) setError(result.error);
        } catch {
            setError('Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    function handleRecoverChange(e) {
        setRecoverForm(f => ({ ...f, [e.target.name]: e.target.value }));
        setRecoverError('');
    }

    function resetRecover() {
        setRecover('idle');
        setRecoverForm({ email: '', licenseKey: '', code: '', newPassword: '', confirmPassword: '' });
        setRecoverError('');
    }

    // ── Paso 1: solicitar código ───────────────────────────────────────
    const handleRequestCode = async (e) => {
        e.preventDefault();
        const { email, licenseKey } = recoverForm;
        if (!email || !licenseKey) { setRecoverError('Completa todos los campos.'); return; }

        // Verificar conectividad antes de intentar enviar el código
        if (!navigator.onLine) {
            setRecoverError('⚠️ Sin conexión a internet. Conéctate e intenta nuevamente — necesitas internet para recibir el código en tu correo.');
            return;
        }

        setRecoverLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, licenseKey }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al enviar el código');
            setMaskedEmail(data.maskedEmail || email);
            setRecoverError('');
            setRecover('code');
        } catch (err) {
            // Si el fetch falla por red, dar mensaje más claro
            if (!navigator.onLine || err.message === 'Failed to fetch') {
                setRecoverError('⚠️ Sin conexión a internet. Conéctate e intenta nuevamente — necesitas internet para recibir el código en tu correo.');
            } else {
                setRecoverError(err.message);
            }
        } finally {
            setRecoverLoading(false);
        }
    };

    // ── Paso 2: verificar código ───────────────────────────────────────
    const handleVerifyCode = async (e) => {
        e.preventDefault();
        const { email, code } = recoverForm;
        if (!code || code.length !== 6) { setRecoverError('Ingresa el código de 6 dígitos.'); return; }
        setRecoverLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/auth/verify-reset-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Código inválido o expirado');
            setRecover('newpass');
        } catch (err) {
            setRecoverError(err.message);
        } finally {
            setRecoverLoading(false);
        }
    };

    // ── Paso 3: guardar nueva contraseña en SQLite local ──────────────
    const handleNewPassword = async (e) => {
        e.preventDefault();
        const { newPassword, confirmPassword } = recoverForm;
        if (!newPassword || newPassword.length < 6) { setRecoverError('La contraseña debe tener al menos 6 caracteres.'); return; }
        if (newPassword !== confirmPassword) { setRecoverError('Las contraseñas no coinciden.'); return; }
        setRecoverLoading(true);
        try {
            const adminUser = await window.electronAPI.database.get(
                'SELECT id FROM users WHERE role = ? AND is_active = 1',
                ['admin']
            );
            if (!adminUser) throw new Error('No se encontró el usuario administrador.');

            const result = await window.electronAPI.auth.hashPassword(newPassword);
            if (!result.success) throw new Error('Error al procesar la contraseña.');

            await window.electronAPI.database.run(
                'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [result.hash, adminUser.id]
            );

            setRecover('success');
        } catch (err) {
            setRecoverError(err.message);
        } finally {
            setRecoverLoading(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1 className="login-brand">
                        Nu<span className="login-brand-v">v</span>enta
                    </h1>
                    <p>Sistema Punto de Ventas</p>
                </div>

                <Card>
                    {/* ── Login normal ─────────────────────────────── */}
                    {recover === 'idle' && (
                        <form onSubmit={handleSubmit} className="login-form">
                            <Input
                                label="Usuario"
                                placeholder="Ingresa tu usuario"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                autoFocus
                                required
                            />
                            <Input
                                label="Contraseña"
                                type="password"
                                placeholder="Ingresa tu contraseña"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                error={error}
                            />
                            <Button type="submit" variant="primary" size="large" fullWidth loading={loading}>
                                Iniciar Sesión
                            </Button>
                            <div style={{ textAlign: 'center', marginTop: 16 }}>
                                <button
                                    type="button"
                                    className="login-recover-link"
                                    onClick={() => setRecover('form')}
                                >
                                    ¿Olvidaste tu contraseña? (solo administrador)
                                </button>
                                <p className="login-recover-note">
                                    Si eres vendedor o del equipo, contacta al administrador del sistema para restablecer tu acceso.
                                </p>
                            </div>
                        </form>
                    )}

                    {/* ── Paso 1: Email + licencia ─────────────────── */}
                    {recover === 'form' && (
                        <form onSubmit={handleRequestCode} className="login-form">
                            <div className="recover-header">
                                <p className="recover-title">Recuperar contraseña — Administrador</p>
                                <p className="recover-sub">
                                    Esta opción es exclusiva para el administrador que adquirió la licencia.<br/>
                                    Si eres vendedor u otro usuario, contacta a tu administrador para que restablezca tu acceso desde el panel de usuarios.
                                </p>
                            </div>
                            <Input
                                label="Email de compra"
                                type="email"
                                name="email"
                                placeholder="tu@email.com"
                                value={recoverForm.email}
                                onChange={handleRecoverChange}
                                required
                            />
                            <Input
                                label="Clave de licencia"
                                name="licenseKey"
                                placeholder="NUVEN-XXXX-XXXX-XXXX"
                                value={recoverForm.licenseKey}
                                onChange={handleRecoverChange}
                                required
                                style={{ fontFamily: 'monospace', letterSpacing: 1 }}
                            />
                            {recoverError && <div className="recover-error">{recoverError}</div>}
                            <Button type="submit" variant="primary" size="large" fullWidth loading={recoverLoading}>
                                Enviar código al email
                            </Button>
                            <div style={{ textAlign: 'center', marginTop: 12 }}>
                                <button type="button" className="login-recover-link" onClick={resetRecover}>
                                    ← Volver al inicio de sesión
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── Paso 2: Código 6 dígitos ─────────────────── */}
                    {recover === 'code' && (
                        <form onSubmit={handleVerifyCode} className="login-form">
                            <div className="recover-header">
                                <div className="recover-email-icon">✉</div>
                                <p className="recover-title">Revisa tu email</p>
                                <p className="recover-sub">
                                    Enviamos un código de 6 dígitos a <strong>{maskedEmail}</strong>.<br />
                                    Expira en 15 minutos.
                                </p>
                            </div>
                            <Input
                                label="Código de 6 dígitos"
                                name="code"
                                placeholder="000000"
                                maxLength={6}
                                value={recoverForm.code}
                                onChange={handleRecoverChange}
                                style={{ fontFamily: 'monospace', fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
                                autoFocus
                                required
                            />
                            {recoverError && <div className="recover-error">{recoverError}</div>}
                            <Button type="submit" variant="primary" size="large" fullWidth loading={recoverLoading}>
                                Verificar código
                            </Button>
                            <div style={{ textAlign: 'center', marginTop: 12 }}>
                                <button type="button" className="login-recover-link" onClick={() => setRecover('form')}>
                                    ← Volver
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── Paso 3: Nueva contraseña ─────────────────── */}
                    {recover === 'newpass' && (
                        <form onSubmit={handleNewPassword} className="login-form">
                            <div className="recover-header">
                                <p className="recover-title">Nueva contraseña</p>
                                <p className="recover-sub">
                                    Elige una nueva contraseña para el administrador.
                                </p>
                            </div>
                            <div className="recover-pass-field">
                                <Input
                                    label="Nueva contraseña"
                                    type={showNewPass ? 'text' : 'password'}
                                    name="newPassword"
                                    placeholder="Mínimo 6 caracteres"
                                    value={recoverForm.newPassword}
                                    onChange={handleRecoverChange}
                                    autoFocus
                                    required
                                />
                                <button type="button" className="recover-eye" onClick={() => setShowNewPass(v => !v)}>
                                    {showNewPass ? '🙈' : '👁️'}
                                </button>
                            </div>
                            <div className="recover-pass-field">
                                <Input
                                    label="Confirmar contraseña"
                                    type={showConfPass ? 'text' : 'password'}
                                    name="confirmPassword"
                                    placeholder="Repite la contraseña"
                                    value={recoverForm.confirmPassword}
                                    onChange={handleRecoverChange}
                                    required
                                />
                                <button type="button" className="recover-eye" onClick={() => setShowConfPass(v => !v)}>
                                    {showConfPass ? '🙈' : '👁️'}
                                </button>
                            </div>
                            {recoverError && <div className="recover-error">{recoverError}</div>}
                            <Button type="submit" variant="primary" size="large" fullWidth loading={recoverLoading}>
                                Guardar nueva contraseña
                            </Button>
                        </form>
                    )}

                    {/* ── Éxito ─────────────────────────────────────── */}
                    {recover === 'success' && (
                        <div className="login-form">
                            <div className="recover-success">
                                <div className="recover-success__check">✓</div>
                                <p className="recover-title">¡Listo!</p>
                                <p className="recover-sub">
                                    Tu contraseña fue actualizada. Ya puedes iniciar sesión con tu nueva contraseña.
                                </p>
                            </div>
                            <Button variant="primary" size="large" fullWidth onClick={resetRecover}>
                                Ir al inicio de sesión
                            </Button>
                        </div>
                    )}
                </Card>

                <div className="login-footer">
                    <small>© 2026 Nuventa - Sistema Punto de Ventas</small>
                </div>
            </div>
        </div>
    );
}