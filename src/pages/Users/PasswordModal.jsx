import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import UserRepository from '../../services/repositories/userRepository';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { FiX, FiKey, FiEye, FiEyeOff } from 'react-icons/fi';
import './PasswordModal.css';

// ── PasswordModal no usa window.alert — notifica al padre via onSave(msg, variant)

const PasswordModal = ({ user, onClose, onSave }) => {
    const { db } = useDatabase();
    const userRepo = new UserRepository(db);

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
            await userRepo.changePassword(user.id, formData.newPassword);
            // Notifica al padre con mensaje de éxito → el padre muestra el Dialog
            onSave('✅ Contraseña actualizada exitosamente', 'success');
        } catch (error) {
            console.error('Error changing password:', error);
            // Notifica al padre con error, keepOpen=true para no cerrar el modal
            onSave('❌ Error al cambiar la contraseña', 'danger', /* keepOpen */ true);
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
                            <p className="modal-subtitle">Usuario: {user.full_name}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={handleClose}><FiX /></button>
                </div>

                <form onSubmit={handleSubmit} className="password-modal-body">
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