import React, { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import SupplierRepository from '../../services/repositories/supplierRepository';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import './SupplierModal.css';

// ── SupplierModal no usa window.alert/confirm ─────────────────────────────────
// Notifica al padre via onSave(msg, variant, keepOpen):
//   onSave('✅ mensaje', 'success')         → éxito: padre cierra modal y muestra alert
//   onSave('❌ mensaje', 'danger', true)    → error: padre NO cierra modal, muestra alert

const SupplierModal = ({ supplier, onSave, onClose, db }) => {
    const [formData, setFormData] = useState({
        business_name: '', legal_name: '', rut: '', industry: '',
        contact_name: '', phone: '', email: '', address: '',
        city: '', region: '', payment_terms: '', credit_days: 0,
        notes: '', is_active: 1
    });

    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const supplierRepo = new SupplierRepository(db);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        if (supplier) {
            setFormData({
                business_name: supplier.business_name || '',
                legal_name:    supplier.legal_name    || '',
                rut:           supplier.rut           || '',
                industry:      supplier.industry      || '',
                contact_name:  supplier.contact_name  || '',
                phone:         supplier.phone         || '',
                email:         supplier.email         || '',
                address:       supplier.address       || '',
                city:          supplier.city          || '',
                region:        supplier.region        || '',
                payment_terms: supplier.payment_terms || '',
                credit_days:   supplier.credit_days   || 0,
                notes:         supplier.notes         || '',
                is_active:     supplier.is_active !== undefined ? supplier.is_active : 1,
            });
        }
    }, [supplier]);

    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape' && !saving) handleClose(); };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [saving]); // eslint-disable-line

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    // ── Validación ────────────────────────────────────────────────────────────
    const validateForm = () => {
        const newErrors = {};
        if (!formData.business_name?.trim())
            newErrors.business_name = 'El nombre comercial es obligatorio';
        if (!formData.phone?.trim())
            newErrors.phone = 'El teléfono es obligatorio';
        else if (formData.phone.trim().length < 8)
            newErrors.phone = 'El teléfono debe tener al menos 8 dígitos';
        if (formData.email?.trim() && !isValidEmail(formData.email))
            newErrors.email = 'Email inválido';
        if (formData.rut?.trim() && !isValidRUT(formData.rut))
            newErrors.rut = 'RUT inválido';
        const creditDays = parseInt(formData.credit_days);
        if (isNaN(creditDays) || creditDays < 0)
            newErrors.credit_days = 'Los días de crédito deben ser un número positivo';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    const isValidRUT = (rut) => {
        try {
            const cleanRUT = rut.replace(/[.-]/g, '');
            if (cleanRUT.length < 8 || cleanRUT.length > 9) return false;
            const body = cleanRUT.slice(0, -1);
            const dv   = cleanRUT.slice(-1).toUpperCase();
            if (!/^\d+$/.test(body)) return false;
            let sum = 0, multiplier = 2;
            for (let i = body.length - 1; i >= 0; i--) {
                sum += parseInt(body.charAt(i)) * multiplier;
                multiplier = multiplier === 7 ? 2 : multiplier + 1;
            }
            const expected = 11 - (sum % 11);
            const calc = expected === 11 ? '0' : expected === 10 ? 'K' : expected.toString();
            return dv === calc;
        } catch { return false; }
    };

    const formatRUT = (rut) => {
        const clean = rut.replace(/[.-]/g, '');
        if (clean.length <= 1) return clean;
        const body = clean.slice(0, -1);
        const dv   = clean.slice(-1);
        let formatted = '';
        for (let i = 0; i < body.length; i++) {
            if (i > 0 && (body.length - i) % 3 === 0) formatted += '.';
            formatted += body[i];
        }
        return `${formatted}-${dv}`;
    };

    const handleRUTChange = (value) => {
        const clean = value.replace(/[^0-9kK]/g, '');
        if (clean.length <= 9) {
            handleChange('rut', clean.length > 1 ? formatRUT(clean) : clean);
        }
    };

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (saving) return;
        if (!validateForm()) return; // errores inline, sin alert

        setSaving(true);
        try {
            const cleanedData = {
                business_name: formData.business_name.trim(),
                legal_name:    formData.legal_name.trim(),
                rut:           formData.rut.trim(),
                industry:      formData.industry.trim(),
                contact_name:  formData.contact_name.trim(),
                phone:         formData.phone.trim(),
                email:         formData.email.trim(),
                address:       formData.address.trim(),
                city:          formData.city.trim(),
                region:        formData.region,
                payment_terms: formData.payment_terms.trim(),
                credit_days:   parseInt(formData.credit_days) || 0,
                notes:         formData.notes.trim(),
                is_active:     formData.is_active,
            };

            if (supplier) {
                await supplierRepo.update(supplier.id, cleanedData);
                onSave('Proveedor actualizado exitosamente', 'success');
            } else {
                await supplierRepo.create(cleanedData);
                onSave('Proveedor creado exitosamente', 'success');
            }
        } catch (error) {
            console.error('❌ Error saving supplier:', error);
            // keepOpen=true → el padre no cierra el modal, solo muestra el alert
            onSave(`❌ Error al guardar el proveedor: ${error.message}`, 'danger', true);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (saving) return;
        document.body.style.overflow = '';
        onClose();
    };

    const regiones = [
        'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo',
        'Valparaíso', 'Metropolitana', "O'Higgins", 'Maule', 'Ñuble',
        'Biobío', 'Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
    ];

    return (
        <div className="modal-overlay" onClick={saving ? null : handleClose}>
            <div className="modal-content supplier-modal" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <h2 className="modal-title">
                        {supplier ? '✏️ Editar Proveedor' : '➕ Nuevo Proveedor'}
                    </h2>
                    <button className="modal-close" onClick={handleClose}
                        disabled={saving} title={saving ? 'Guardando...' : 'Cerrar (ESC)'}>
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">

                    {/* Información Básica */}
                    <div className="form-section">
                        <h3 className="form-section-title">📋 Información Básica</h3>
                        <div className="form-row">
                            <Input label="Nombre Comercial" value={formData.business_name}
                                onChange={(e) => handleChange('business_name', e.target.value)}
                                error={errors.business_name} required
                                placeholder="Ej: Distribuidora ABC" autoFocus disabled={saving} />
                        </div>
                        <div className="form-row">
                            <Input label="Razón Social" value={formData.legal_name}
                                onChange={(e) => handleChange('legal_name', e.target.value)}
                                placeholder="Ej: Distribuidora ABC Ltda." disabled={saving} />
                        </div>
                        <div className="form-row-2">
                            <Input label="RUT" value={formData.rut}
                                onChange={(e) => handleRUTChange(e.target.value)}
                                error={errors.rut} placeholder="12.345.678-9"
                                disabled={saving} helperText="Formato: 12345678-9" />
                            <Input label="Giro/Industria" value={formData.industry}
                                onChange={(e) => handleChange('industry', e.target.value)}
                                placeholder="Ej: Distribución de alimentos" disabled={saving} />
                        </div>
                    </div>

                    {/* Contacto */}
                    <div className="form-section">
                        <h3 className="form-section-title">📞 Contacto</h3>
                        <div className="form-row">
                            <Input label="Nombre de Contacto" value={formData.contact_name}
                                onChange={(e) => handleChange('contact_name', e.target.value)}
                                placeholder="Ej: Juan Pérez" disabled={saving} />
                        </div>
                        <div className="form-row-2">
                            <Input label="Teléfono" value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                error={errors.phone} required placeholder="+56 9 1234 5678"
                                disabled={saving} />
                            <Input label="Email" type="email" value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                error={errors.email} placeholder="contacto@proveedor.cl"
                                disabled={saving} />
                        </div>
                    </div>

                    {/* Dirección */}
                    <div className="form-section">
                        <h3 className="form-section-title">📍 Dirección</h3>
                        <div className="form-row">
                            <Input label="Dirección" value={formData.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                                placeholder="Calle, número, depto/oficina" disabled={saving} />
                        </div>
                        <div className="form-row-2">
                            <Input label="Ciudad" value={formData.city}
                                onChange={(e) => handleChange('city', e.target.value)}
                                placeholder="Ej: Santiago" disabled={saving} />
                            <div className="input-wrapper">
                                <label className="input-label">Región</label>
                                <select className="input-field select-field"
                                    value={formData.region}
                                    onChange={(e) => handleChange('region', e.target.value)}
                                    disabled={saving}>
                                    <option value="">Seleccionar región</option>
                                    {regiones.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Condiciones Comerciales */}
                    <div className="form-section">
                        <h3 className="form-section-title">💼 Condiciones Comerciales</h3>
                        <div className="form-row">
                            <Input label="Condiciones de Pago" value={formData.payment_terms}
                                onChange={(e) => handleChange('payment_terms', e.target.value)}
                                placeholder="Ej: 30 días plazo, contado, etc." disabled={saving} />
                        </div>
                        <div className="form-row">
                            <Input label="Días de Crédito" type="number"
                                value={formData.credit_days}
                                onChange={(e) => handleChange('credit_days', parseInt(e.target.value) || 0)}
                                error={errors.credit_days} placeholder="0" min="0"
                                disabled={saving} helperText="Número de días de crédito otorgado" />
                        </div>
                    </div>

                    {/* Notas */}
                    <div className="form-section">
                        <h3 className="form-section-title">📝 Notas</h3>
                        <div className="form-row">
                            <div className="input-wrapper">
                                <label className="input-label">Notas/Observaciones</label>
                                <textarea className="input-field textarea-field"
                                    value={formData.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    placeholder="Información adicional sobre el proveedor..."
                                    rows="4" disabled={saving} maxLength={500} />
                                <small className="char-counter">{formData.notes.length}/500 caracteres</small>
                            </div>
                        </div>
                    </div>

                    {/* Estado (solo al editar) */}
                    {supplier && (
                        <div className="form-section">
                            <div className="form-row">
                                <label className="checkbox-label">
                                    <input type="checkbox"
                                        checked={formData.is_active === 1}
                                        onChange={(e) => handleChange('is_active', e.target.checked ? 1 : 0)}
                                        disabled={saving} />
                                    <span>Proveedor activo</span>
                                </label>
                            </div>
                        </div>
                    )}
                </form>

                <div className="modal-footer">
                    <Button variant="secondary" onClick={handleClose} disabled={saving}>
                        Cancelar (ESC)
                    </Button>
                    <Button variant="primary" icon={<FiSave />} onClick={handleSubmit}
                        loading={saving} disabled={saving}>
                        {saving ? 'Guardando...' : supplier ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
                    </Button>
                </div>

                {saving && (
                    <div className="saving-overlay">
                        <div className="spinner"></div>
                        <p>Guardando proveedor...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SupplierModal;