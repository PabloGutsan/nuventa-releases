import React, { useState, useEffect } from 'react';
import { FiX, FiSave } from 'react-icons/fi';
import CustomerRepository from '../../services/repositories/customerRepository';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { REGIONES, getComunasByRegion } from '../../data/regionesComunas';
import SearchableSelect from '../../components/common/SearchableSelect';
import './CustomerModal.css';

const CustomerModal = ({ customer, onSave, onClose, db }) => {
    const [formData, setFormData] = useState({
        full_name:       '',
        rut:             '',
        phone:           '',
        email:           '',
        address:         '',
        region:          '',
        city:            '',
        birth_date:      '',
        notes:           '',
        is_active:       1,
        // Empresa
        is_company:      false,
        company_name:    '',
        company_rut:     '',
        company_address: '',
        company_region:  '',
        company_city:    '',
        company_phone:   '',
        company_email:   '',
        company_website: '',
    });
    const [errors,         setErrors]         = useState({});
    const [saving,         setSaving]         = useState(false);
    const [savedOk,        setSavedOk]        = useState(false);
    const [savedMsg,       setSavedMsg]       = useState('');
    const [saveError,      setSaveError]      = useState('');
    const [comunas,        setComunas]        = useState([]);
    const [companyComunas, setCompanyComunas] = useState([]);

    const customerRepo = new CustomerRepository(db);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        if (customer && typeof customer === 'object') {
            setFormData({
                full_name:       customer.full_name       || '',
                rut:             customer.rut             || '',
                phone:           customer.phone           || '',
                email:           customer.email           || '',
                address:         customer.address         || '',
                region:          customer.region          || '',
                city:            customer.city            || '',
                birth_date:      customer.birth_date      || '',
                notes:           customer.notes           || '',
                is_active:       customer.is_active !== undefined ? customer.is_active : 1,
                is_company:      customer.is_company === 1 || customer.is_company === true || !!customer.company_name,
                company_name:    customer.company_name    || '',
                company_rut:     customer.company_rut     || '',
                company_address: customer.company_address || '',
                company_region:  customer.company_region  || '',
                company_city:    customer.company_city    || '',
                company_phone:   customer.company_phone   || '',
                company_email:   customer.company_email   || '',
                company_website: customer.company_website || '',
            });
            if (customer.region)         setComunas(getComunasByRegion(customer.region));
            if (customer.company_region) setCompanyComunas(getComunasByRegion(customer.company_region));
        }
    }, [customer]);

    useEffect(() => {
        const list = getComunasByRegion(formData.region);
        setComunas(list);
        if (formData.city && !list.includes(formData.city))
            setFormData(prev => ({ ...prev, city: '' }));
    }, [formData.region]);

    useEffect(() => {
        const list = getComunasByRegion(formData.company_region);
        setCompanyComunas(list);
        if (formData.company_city && !list.includes(formData.company_city))
            setFormData(prev => ({ ...prev, company_city: '' }));
    }, [formData.company_region]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    const isValidEmail = (email) =>
        /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);

    const isValidRUN = (run) => {
        try {
            const clean = run.replace(/[.-]/g, '');
            if (clean.length < 8 || clean.length > 9) return false;
            const body = clean.slice(0, -1);
            const dv   = clean.slice(-1).toUpperCase();
            if (!/^\d+$/.test(body)) return false;
            let sum = 0, mult = 2;
            for (let i = body.length - 1; i >= 0; i--) {
                sum += parseInt(body.charAt(i)) * mult;
                mult = mult === 7 ? 2 : mult + 1;
            }
            const exp  = 11 - (sum % 11);
            const calc = exp === 11 ? '0' : exp === 10 ? 'K' : exp.toString();
            return dv === calc;
        } catch { return false; }
    };

    const formatRUN = (run) => {
        try {
            const clean = run.replace(/[.-]/g, '');
            if (clean.length <= 1) return clean;
            const body = clean.slice(0, -1);
            const dv   = clean.slice(-1);
            let fmt = '';
            for (let i = 0; i < body.length; i++) {
                if (i > 0 && (body.length - i) % 3 === 0) fmt += '.';
                fmt += body[i];
            }
            return `${fmt}-${dv}`;
        } catch { return run; }
    };

    const handleRUNChange = (value) => {
        const clean = value.replace(/[^0-9kK]/g, '');
        if (clean.length <= 9) handleChange('rut', formatRUN(clean));
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.full_name?.trim())
            newErrors.full_name = 'El nombre es obligatorio';
        else if (formData.full_name.trim().length < 3)
            newErrors.full_name = 'El nombre debe tener al menos 3 caracteres';

        if (!formData.phone?.trim())
            newErrors.phone = 'El teléfono es obligatorio';
        else if (formData.phone.trim().length < 8)
            newErrors.phone = 'Teléfono debe tener al menos 8 dígitos';

        if (formData.email?.trim() && !isValidEmail(formData.email.trim()))
            newErrors.email = 'Email inválido';

        if (formData.rut?.trim() && !isValidRUN(formData.rut))
            newErrors.rut = 'RUN inválido';

        if (formData.birth_date && new Date(formData.birth_date) > new Date())
            newErrors.birth_date = 'La fecha no puede ser futura';

        if (formData.is_company) {
            if (!formData.company_name?.trim())
                newErrors.company_name = 'El nombre de la empresa es obligatorio';
            if (formData.company_email?.trim() && !isValidEmail(formData.company_email.trim()))
                newErrors.company_email = 'Email de empresa inválido';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ── Submit — mismo patrón que SupplierModal ───────────────────────────────
    // onSave(msg, variant)           → éxito: padre cierra modal y muestra alerta
    // onSave(msg, 'danger', true)    → error: padre NO cierra modal, muestra alerta
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaving(true);
        try {
            if (!db) throw new Error('Base de datos no disponible');

            const cleanData = {
                full_name:   formData.full_name.trim(),
                rut:         formData.rut?.trim()     || null,
                phone:       formData.phone.trim(),
                email:       formData.email?.trim()   || null,
                address:     formData.address?.trim() || null,
                region:      formData.region          || null,
                city:        formData.city            || null,
                birth_date:  formData.birth_date      || null,
                notes:       formData.notes?.trim()   || null,
                is_active:   formData.is_active,
                is_company:  formData.is_company ? 1 : 0,
                company_name:    formData.is_company ? (formData.company_name?.trim()    || null) : null,
                company_rut:     formData.is_company ? (formData.company_rut?.trim()     || null) : null,
                company_address: formData.is_company ? (formData.company_address?.trim() || null) : null,
                company_region:  formData.is_company ? (formData.company_region          || null) : null,
                company_city:    formData.is_company ? (formData.company_city            || null) : null,
                company_phone:   formData.is_company ? (formData.company_phone?.trim()   || null) : null,
                company_email:   formData.is_company ? (formData.company_email?.trim()   || null) : null,
                company_website: formData.is_company ? (formData.company_website?.trim() || null) : null,
            };

            if (customer?.id) {
                await customerRepo.update(customer.id, cleanData);
                setSavedMsg('Cliente actualizado exitosamente');
                setSavedOk(true);
            } else {
                await customerRepo.create(cleanData);
                setSavedMsg('Cliente creado exitosamente');
                setSavedOk(true);
            }
        } catch (error) {
            console.error('Error guardando cliente:', error);
            let msg = 'Error al guardar el cliente';
            if (error.message?.includes('UNIQUE constraint failed')) {
                if (error.message.includes('rut')) {
                    msg = 'Ya existe un cliente con ese RUN';
                    setErrors(prev => ({ ...prev, rut: msg }));
                } else if (error.message.includes('phone')) {
                    msg = 'Ya existe un cliente con ese teléfono';
                    setErrors(prev => ({ ...prev, phone: msg }));
                } else {
                    msg = 'Este cliente ya está registrado';
                }
            } else {
                msg = error.message || msg;
            }
            setSaveError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        document.body.style.overflow = '';
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content customer-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {customer ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}
                    </h2>
                    <button className="modal-close" onClick={handleClose} disabled={saving} type="button">
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">

                    {/* ── Información Básica ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">📋 Información Básica</h3>
                        <div className="form-row">
                            <Input
                                label="Nombre Completo"
                                value={formData.full_name}
                                onChange={(e) => handleChange('full_name', e.target.value)}
                                error={errors.full_name}
                                required
                                placeholder="Ej: Juan Pérez González"
                                autoFocus
                                disabled={saving}
                                maxLength={255}
                            />
                        </div>
                        <div className="form-row-2">
                            <Input
                                label="RUN"
                                value={formData.rut}
                                onChange={(e) => handleRUNChange(e.target.value)}
                                error={errors.rut}
                                placeholder="12.345.678-9 (opcional)"
                                disabled={saving}
                                helperText="RUN chileno"
                            />
                            <Input
                                label="Fecha de Nacimiento"
                                type="date"
                                value={formData.birth_date}
                                onChange={(e) => handleChange('birth_date', e.target.value)}
                                error={errors.birth_date}
                                disabled={saving}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    </div>

                    {/* ── Contacto ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">📞 Contacto</h3>
                        <div className="form-row-2">
                            <Input
                                label="Teléfono"
                                value={formData.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                error={errors.phone}
                                required
                                placeholder="+56 9 1234 5678"
                                disabled={saving}
                                maxLength={20}
                            />
                            <Input
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                error={errors.email}
                                placeholder="cliente@email.com"
                                disabled={saving}
                                maxLength={255}
                            />
                        </div>
                    </div>

                    {/* ── Dirección ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">📍 Dirección</h3>
                        <div className="form-row">
                            <Input
                                label="Dirección"
                                value={formData.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                                placeholder="Calle, número, depto/casa"
                                disabled={saving}
                                maxLength={255}
                            />
                        </div>
                        <div className="form-row-2">
                            <SearchableSelect
                                label="Región"
                                value={formData.region}
                                onChange={(v) => handleChange('region', v)}
                                options={REGIONES}
                                placeholder="Seleccionar región"
                                searchPlaceholder="Buscar región..."
                                disabled={saving}
                            />
                            <SearchableSelect
                                label="Comuna"
                                value={formData.city}
                                onChange={(v) => handleChange('city', v)}
                                options={comunas}
                                placeholder={formData.region ? 'Seleccionar comuna' : 'Primero elige región'}
                                searchPlaceholder="Buscar comuna..."
                                disabled={saving || !formData.region}
                            />
                        </div>
                    </div>

                    {/* ── Notas ── */}
                    <div className="form-section">
                        <h3 className="form-section-title">📝 Notas</h3>
                        <div className="form-row">
                            <div className="input-wrapper">
                                <label className="input-label">Notas</label>
                                <textarea
                                    className="input-field textarea-field"
                                    value={formData.notes}
                                    onChange={(e) => handleChange('notes', e.target.value)}
                                    placeholder="Preferencias, observaciones..."
                                    rows="3"
                                    disabled={saving}
                                    maxLength={1000}
                                />
                                {formData.notes && (
                                    <span className="input-helper-text">
                                        {formData.notes.length}/1000 caracteres
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Estado (solo edición) ── */}
                    {customer && (
                        <div className="form-section">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active === 1}
                                    onChange={(e) => handleChange('is_active', e.target.checked ? 1 : 0)}
                                    disabled={saving}
                                />
                                <span>Cliente activo</span>
                            </label>
                        </div>
                    )}

                    {/* ── Empresa ── */}
                    <div className="form-section">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.is_company}
                                onChange={(e) => handleChange('is_company', e.target.checked)}
                                disabled={saving}
                            />
                            <span>Representa a una empresa</span>
                        </label>

                        {formData.is_company && (
                            <div className="company-fields">
                                <h4 className="form-section-subtitle">🏢 Datos de la Empresa</h4>

                                <div className="form-row-2">
                                    <Input
                                        label="Nombre Empresa *"
                                        value={formData.company_name}
                                        onChange={(e) => handleChange('company_name', e.target.value)}
                                        error={errors.company_name}
                                        required
                                        placeholder="Ej: Empresa SpA"
                                        disabled={saving}
                                        maxLength={255}
                                    />
                                    <Input
                                        label="RUT Empresa"
                                        value={formData.company_rut}
                                        onChange={(e) => handleChange('company_rut', e.target.value)}
                                        placeholder="76.123.456-7"
                                        disabled={saving}
                                        maxLength={12}
                                    />
                                </div>

                                <div className="form-row-2">
                                    <Input
                                        label="Teléfono Empresa"
                                        value={formData.company_phone}
                                        onChange={(e) => handleChange('company_phone', e.target.value)}
                                        placeholder="+56 2 1234 5678"
                                        disabled={saving}
                                        maxLength={20}
                                    />
                                    <Input
                                        label="Email Empresa"
                                        type="email"
                                        value={formData.company_email}
                                        onChange={(e) => handleChange('company_email', e.target.value)}
                                        error={errors.company_email}
                                        placeholder="contacto@empresa.cl"
                                        disabled={saving}
                                        maxLength={255}
                                    />
                                </div>

                                <div className="form-row">
                                    <Input
                                        label="Sitio Web"
                                        value={formData.company_website}
                                        onChange={(e) => handleChange('company_website', e.target.value)}
                                        placeholder="https://www.empresa.cl"
                                        disabled={saving}
                                        maxLength={255}
                                    />
                                </div>

                                <div className="form-row">
                                    <Input
                                        label="Dirección Empresa"
                                        value={formData.company_address}
                                        onChange={(e) => handleChange('company_address', e.target.value)}
                                        placeholder="Calle, número, oficina"
                                        disabled={saving}
                                        maxLength={255}
                                    />
                                </div>

                                <div className="form-row-2">
                                    <SearchableSelect
                                        label="Región Empresa"
                                        value={formData.company_region}
                                        onChange={(v) => handleChange('company_region', v)}
                                        options={REGIONES}
                                        placeholder="Seleccionar región"
                                        searchPlaceholder="Buscar región..."
                                        disabled={saving}
                                    />
                                    <SearchableSelect
                                        label="Comuna Empresa"
                                        value={formData.company_city}
                                        onChange={(v) => handleChange('company_city', v)}
                                        options={companyComunas}
                                        placeholder={formData.company_region ? 'Seleccionar comuna' : 'Primero elige región'}
                                        searchPlaceholder="Buscar comuna..."
                                        disabled={saving || !formData.company_region}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                </form>

                <div className="modal-footer">
                    <Button variant="secondary" onClick={handleClose} disabled={saving} type="button">
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        icon={<FiSave />}
                        onClick={handleSubmit}
                        loading={saving}
                        disabled={saving}
                        type="submit"
                    >
                        {customer ? 'Actualizar' : 'Guardar'} Cliente
                    </Button>
                </div>

                {/* ── Banner de error inline ── */}
                {saveError && !savedOk && (
                    <div className="cm-error-banner">
                        ❌ {saveError}
                        <button className="cm-banner-close" onClick={() => setSaveError('')}>✕</button>
                    </div>
                )}

                {/* ── Overlay de éxito — tarjeta centrada ── */}
                {savedOk && (
                    <div className="cm-success-overlay">
                        <div className="cm-success-card">
                            <div className="cm-success-icon">✅</div>
                            <p className="cm-success-msg">{savedMsg}</p>
                            <button className="cm-success-btn" onClick={onSave}>Aceptar</button>
                        </div>
                    </div>
                )}

                {saving && !savedOk && (
                    <div className="saving-overlay">
                        <div className="spinner"></div>
                        <p>Guardando cliente...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerModal;