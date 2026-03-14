import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import UserRepository from '../../services/repositories/userRepository';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { FiX, FiKey, FiEye, FiEyeOff, FiAlertTriangle } from 'react-icons/fi';
import './PasswordModal.css';

const PasswordModal = ({ user, onClose, onSave }) => {
    const { db } = useDatabase();
    const { currentUser } = useAuth();
    const userRepo = new UserRepository(db);

    const isOwnPassword = currentUser && currentUser.id === user.id;

    const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
    const [errors,   setErrors]   = useState({});
    const [loading,  setLoading]  = useState(false);
    const [showNew,     setShowNew]     = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.newPassword) newErrors.newPassword = 'La contraseña es obligatoria';
        else if (formData.newPassword.length < 6) newErrors.newPassword = 'Mínimo 6 caracteres';
        if (formData.newPassword !== formData.confirmPassword)
            newErrors.confirmPassword = 'Las contraseñas no coinciden';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            // Cambiar contraseña
            // - Si es el propio usuario: clearMustChange = true (limpia el flag)
            // - Si es otro usuario: clearMustChange = false (no toca el flag)
            await userRepo.changePassword(user.id, formData.newPassword, isOwnPassword);

            // Si el admin cambia la contraseña de otro usuario,
            // siempre activar must_change_password — sin excepción
            if (!isOwnPassword) {
                await userRepo.requirePasswordChange(user.id);
            }

            const msg = !isOwnPassword
                ? `✅ Contraseña actualizada. ${user.full_name} deberá cambiarla en su próximo ingreso.`
                : '✅ Contraseña actualizada exitosamente';

            onSave(msg, 'success');
        } catch (error) {
            console.error('Error changing password:', error);
            onSave('❌ Error al cambiar la contraseña', 'danger', true);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        document.body.style.overflow = '';
        onClose();
    };

    return (
        <div className="password-modal-overlay" onClick={handleClose}>
            <div className="password-modal" onClick={e => e.stopPropagation()}>

                <div className="password-modal-header">
                    <div className="header-with-icon">
                        <FiKey size={24} />
                        <div>
                            <h2>Cambiar Contraseña</h2>
                            <p className="modal-subtitle">
                                {isOwnPassword ? 'Tu contraseña' : `Usuario: ${user.full_name}`}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={handleClose}><FiX /></button>
                </div>

                <form onSubmit={handleSubmit} className="password-modal-body">

                    {/* Aviso obligatorio si el admin cambia la contraseña de otro */}
                    {!isOwnPassword && (
                        <div className="pm-admin-notice">
                            <FiAlertTriangle size={15} />
                            <span>
                                Estás cambiando la contraseña de <strong>{user.full_name}</strong> (@{user.username}).
                                Por seguridad, se le pedirá que la cambie en su próximo ingreso.
                            </span>
                        </div>
                    )}

                    <Input
                        label="Nueva Contraseña"
                        type={showNew ? 'text' : 'password'}
                        name="newPassword" value={formData.newPassword}
                        onChange={handleChange} placeholder="••••••••"
                        required error={errors.newPassword} helperText="Mínimo 6 caracteres" autoFocus
                        rightIcon={
                            <button type="button" onClick={() => setShowNew(p => !p)} tabIndex={-1}>
                                {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                        }
                    />
                    <Input
                        label="Confirmar Nueva Contraseña"
                        type={showConfirm ? 'text' : 'password'}
                        name="confirmPassword" value={formData.confirmPassword}
                        onChange={handleChange} placeholder="••••••••"
                        required error={errors.confirmPassword}
                        rightIcon={
                            <button type="button" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                                {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                        }
                    />

                    <div className="password-tips">
                        <strong>💡 Consejos para una contraseña segura:</strong>
                        <ul>
                            <li>Usa al menos 8 caracteres</li>
                            <li>Combina mayúsculas y minúsculas</li>
                            <li>Incluye números y símbolos</li>
                            <li>Evita palabras comunes o datos personales</li>
                        </ul>
                    </div>
                </form>

                <div className="password-modal-footer">
                    <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
                    <Button variant="primary" icon={<FiKey />} onClick={handleSubmit} loading={loading}>
                        Cambiar Contraseña
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default PasswordModal;