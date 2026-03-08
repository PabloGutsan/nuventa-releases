import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import UserRepository from '../../services/repositories/userRepository';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { FiX, FiSave, FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import './UserModal.css';

// ── UserModal no usa window.alert — notifica al padre via onSave(msg, variant)
// El padre (UsersList) muestra el Dialog React correspondiente.

const UserModal = ({ user, onClose, onSave }) => {
    const { db } = useDatabase();
    const userRepo = new UserRepository(db);

    const [formData, setFormData] = useState({
        username: '', password: '', confirmPassword: '',
        full_name: '', email: '', role: 'vendedor'
    });

    const [errors,   setErrors]   = useState({});
    const [loading,  setLoading]  = useState(false);
    const [showPassword,        setShowPassword]        = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordStrength,    setPasswordStrength]    = useState({ score: 0, label: '', color: '' });

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        if (user && typeof user === 'object') {
            setFormData({
                username: user.username || '', password: '', confirmPassword: '',
                full_name: user.full_name || '', email: user.email || '', role: user.role || 'vendedor'
            });
        }
    }, [user]);

    useEffect(() => {
        if (formData.password) calculatePasswordStrength(formData.password);
        else setPasswordStrength({ score: 0, label: '', color: '' });
    }, [formData.password]);

    const calculatePasswordStrength = (password) => {
        let score = 0;
        if (password.length >= 6)  score++;
        if (password.length >= 8)  score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        setPasswordStrength(
            score <= 2 ? { score, label: 'Débil',     color: '#ef4444' } :
            score <= 4 ? { score, label: 'Media',     color: '#f59e0b' } :
            score <= 6 ? { score, label: 'Buena',     color: '#10b981' } :
                         { score, label: 'Excelente', color: '#059669' }
        );
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.username?.trim()) newErrors.username = 'El nombre de usuario es obligatorio';
        else if (formData.username.trim().length < 3) newErrors.username = 'Debe tener al menos 3 caracteres';
        else if (formData.username.trim().length > 50) newErrors.username = 'No puede exceder 50 caracteres';
        else if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) newErrors.username = 'Solo letras, números y guión bajo';

        if (!user) {
            if (!formData.password) newErrors.password = 'La contraseña es obligatoria';
            else if (formData.password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
            if (!formData.confirmPassword) newErrors.confirmPassword = 'Debes confirmar la contraseña';
            else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden';
        }

        if (!formData.full_name?.trim()) newErrors.full_name = 'El nombre completo es obligatorio';
        else if (formData.full_name.trim().length < 3) newErrors.full_name = 'Debe tener al menos 3 caracteres';

        if (formData.email?.trim()) {
            if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim()))
                newErrors.email = 'Email inválido';
        }

        if (!['admin', 'vendedor', 'inventario'].includes(formData.role))
            newErrors.role = 'Rol inválido';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        if (!db) return;

        setLoading(true);
        try {
            if (user?.id) {
                await userRepo.update(user.id, {
                    username:  formData.username.trim(),
                    full_name: formData.full_name.trim(),
                    email:     formData.email.trim() || null,
                    role:      formData.role
                });
                onSave('Usuario actualizado exitosamente', 'success');
            } else {
                await userRepo.create({
                    username:  formData.username.trim(),
                    password:  formData.password,
                    full_name: formData.full_name.trim(),
                    email:     formData.email.trim() || null,
                    role:      formData.role
                });
                onSave('Usuario creado exitosamente', 'success');
            }
        } catch (error) {
            console.error('❌ Error saving user:', error);
            let msg = 'Error al guardar el usuario';
            if (error.message?.includes('UNIQUE constraint failed')) {
                if (error.message.includes('username')) {
                    msg = 'Ya existe un usuario con ese nombre de usuario';
                    setErrors(prev => ({ ...prev, username: msg }));
                } else {
                    msg = 'Este usuario ya está registrado';
                }
            } else if (error.message?.includes('not null')) {
                msg = 'Falta completar campos obligatorios';
            } else if (error.message?.includes('limit')) {
                msg = 'Has alcanzado el límite de usuarios';
            } else {
                msg = error.message || 'Error desconocido';
            }
            onSave(`❌ ${msg}`, 'danger', /* keepOpen */ true);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (loading) return;
        document.body.style.overflow = '';
        onClose();
    };

    return (
        <div className="user-modal-overlay" onClick={handleClose}>
            <div className="user-modal" onClick={e => e.stopPropagation()}>

                <div className="user-modal-header">
                    <h2>{user ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</h2>
                    <button className="modal-close" onClick={handleClose} disabled={loading} type="button">
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="user-modal-body">
                    <Input
                        label="Nombre de Usuario" name="username" value={formData.username}
                        onChange={handleChange} placeholder="usuario123" required
                        error={errors.username} disabled={loading} maxLength={50} autoFocus
                        icon={<FiUser />}
                        helperText="Solo letras, números y guión bajo. Min 3, máx 50 caracteres."
                    />

                    {!user && (<>
                        <Input
                            label="Contraseña" type={showPassword ? 'text' : 'password'}
                            name="password" value={formData.password} onChange={handleChange}
                            placeholder="••••••••" required error={errors.password}
                            disabled={loading} maxLength={255} icon={<FiLock />}
                            helperText="Mínimo 6 caracteres."
                            rightIcon={
                                <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                                    {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                </button>
                            }
                        />

                        {formData.password && (
                            <div className="password-strength">
                                <div className="password-strength-label">
                                    Fortaleza:
                                    <span style={{ color: passwordStrength.color, marginLeft: 8 }}>
                                        {passwordStrength.label}
                                    </span>
                                </div>
                                <div className="password-strength-bar">
                                    <div className="password-strength-fill" style={{
                                        width: `${(passwordStrength.score / 7) * 100}%`,
                                        backgroundColor: passwordStrength.color
                                    }} />
                                </div>
                                <div className="password-strength-hints">
                                    <small>
                                        💡 Consejos:
                                        {formData.password.length < 8 && ' usar 8+ caracteres'}
                                        {!/[A-Z]/.test(formData.password) && ' • agregar mayúsculas'}
                                        {!/[0-9]/.test(formData.password) && ' • agregar números'}
                                        {!/[^a-zA-Z0-9]/.test(formData.password) && ' • agregar símbolos (!@#$)'}
                                    </small>
                                </div>
                            </div>
                        )}

                        <Input
                            label="Confirmar Contraseña" type={showConfirmPassword ? 'text' : 'password'}
                            name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                            placeholder="••••••••" required error={errors.confirmPassword}
                            disabled={loading} maxLength={255} icon={<FiLock />}
                            rightIcon={
                                <button type="button" onClick={() => setShowConfirmPassword(p => !p)} tabIndex={-1}>
                                    {showConfirmPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                                </button>
                            }
                        />

                        {/* ✅ Aviso: cambio obligatorio en primer login */}
                        <div className="um-first-login-notice">
                            <span className="um-first-login-notice__icon">🔐</span>
                            <span>El usuario deberá cambiar esta contraseña en su primer inicio de sesión.</span>
                        </div>
                    </>)}

                    {user && (
                        <div className="info-box">
                            ℹ️ Para cambiar la contraseña, usa la opción "Cambiar Contraseña" desde la lista de usuarios.
                        </div>
                    )}

                    <Input
                        label="Nombre Completo" name="full_name" value={formData.full_name}
                        onChange={handleChange} placeholder="Juan Pérez González" required
                        error={errors.full_name} disabled={loading} maxLength={255}
                    />
                    <Input
                        label="Email (Opcional)" type="email" name="email" value={formData.email}
                        onChange={handleChange} placeholder="usuario@ejemplo.cl"
                        error={errors.email} disabled={loading} maxLength={255}
                        helperText="Email para notificaciones (opcional)"
                    />

                    <div className="form-field">
                        <label className="form-label">Rol <span className="required">*</span></label>
                        <div className="um-role-cards">
                            {[
                                { role: 'admin',      icon: '👑', label: 'Administrador', desc: 'Acceso total: ventas, inventario, reportes y configuración.' },
                                { role: 'vendedor',   icon: '💼', label: 'Vendedor',       desc: 'Solo ventas y su historial. Sin acceso financiero.' },
                                { role: 'inventario', icon: '📦', label: 'Inventario',     desc: 'Gestiona productos y stock. Sin acceso financiero.' },
                            ].map(({ role, icon, label, desc }) => (
                                <div key={role}
                                    className={`um-role-card${formData.role === role ? ' um-role-card--active' : ''}`}
                                    onClick={() => !loading && setFormData(prev => ({ ...prev, role }))}>
                                    <span className="um-role-card__icon">{icon}</span>
                                    <div className="um-role-card__body">
                                        <span className="um-role-card__label">{label}</span>
                                        <span className="um-role-card__desc">{desc}</span>
                                    </div>
                                    <span className="um-role-card__check">{formData.role === role ? '✓' : ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="um-perms">
                        <div className="um-perms__title">
                            {formData.role === 'admin' ? '👑' : formData.role === 'vendedor' ? '💼' : '📦'}
                            &nbsp;Permisos — {formData.role === 'admin' ? 'Administrador' : formData.role === 'vendedor' ? 'Vendedor' : 'Inventario'}
                        </div>
                        <div className="um-perms__grid">
                            {(formData.role === 'admin' ? [
                                [true, 'Gestionar usuarios'], [true, 'Acceso a todos los reportes'],
                                [true, 'Registrar ventas'], [true, 'Gestionar inventario'],
                                [true, 'Gestionar gastos'], [true, 'Configuración del sistema'],
                            ] : formData.role === 'vendedor' ? [
                                [true, 'Registrar ventas'], [true, 'Ver su historial'],
                                [true, 'Buscar productos'], [false, 'Gestionar inventario'],
                                [false, 'Reportes financieros'], [false, 'Gestionar usuarios'],
                            ] : [
                                [true, 'Gestionar productos'], [true, 'Gestionar categorías'],
                                [true, 'Ajustar stock'], [true, 'Ver movimientos'],
                                [false, 'Registrar ventas'], [false, 'Info financiera'],
                            ]).map(([ok, label], i) => (
                                <span key={i} className={`um-perm-badge ${ok ? 'um-perm-badge--ok' : 'um-perm-badge--no'}`}>
                                    {ok ? '✓' : '✕'} {label}
                                </span>
                            ))}
                        </div>
                    </div>
                </form>

                <div className="user-modal-footer">
                    <Button variant="secondary" onClick={handleClose} disabled={loading} type="button">
                        Cancelar
                    </Button>
                    <Button variant="primary" icon={<FiSave />} onClick={handleSubmit} loading={loading} disabled={loading} type="submit">
                        {user ? 'Actualizar' : 'Crear'} Usuario
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default UserModal;