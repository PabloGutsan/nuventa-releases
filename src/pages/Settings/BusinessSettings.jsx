import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import BusinessRepository from '../../services/repositories/businessRepository';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import SearchableSelect from '../../components/common/SearchableSelect';
import { FiSave, FiUpload, FiX, FiRefreshCw } from 'react-icons/fi';
import { REGIONES, getComunasByRegion } from '../../data/regionesComunas';
import './BusinessSettings.css';

// ── Validación de URL/sitio web ───────────────────────────────────────────────
const WEBSITE_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w]{2,}(\/\S*)?$/i;
const validateWebsite = (value) => {
    if (!value.trim()) return true;
    return WEBSITE_REGEX.test(value.trim());
};

// ── Formateo automático de RUT chileno ────────────────────────────────────────
const formatRUT = (raw) => {
    let clean = raw.replace(/[^0-9kK]/g, '').toUpperCase();
    if (!clean) return '';
    const dv   = clean.slice(-1);
    const body = clean.slice(0, -1);
    let formatted = '';
    for (let i = 0; i < body.length; i++) {
        if (i > 0 && (body.length - i) % 3 === 0) formatted += '.';
        formatted += body[i];
    }
    return formatted ? `${formatted}-${dv}` : dv;
};

// ── Validación de RUT chileno (Módulo 11) ─────────────────────────────────────
const validateRUTDigit = (rut) => {
    if (!rut) return true;
    const clean = rut.replace(/[.\-\s]/g, '').toUpperCase();
    if (clean.length < 2) return false;
    const body = clean.slice(0, -1);
    const dv   = clean.slice(-1);
    if (!/^\d+$/.test(body)) return false;
    let sum = 0, factor = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const remainder = 11 - (sum % 11);
    const expected  = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
    return dv === expected;
};

// ── Formateo automático de teléfono chileno ───────────────────────────────────
const formatPhone = (raw) => {
    let clean    = raw.replace(/(?!^\+)[^0-9]/g, '');
    const hasPlus = raw.startsWith('+');
    const digits  = clean.replace(/^\+/, '');
    if (hasPlus) {
        const d = digits;
        if (d.length <= 2)  return '+' + d;
        if (d.length <= 3)  return '+' + d.slice(0,2) + ' ' + d.slice(2);
        if (d.length <= 7)  return '+' + d.slice(0,2) + ' ' + d.slice(2,3) + ' ' + d.slice(3);
        if (d.length <= 11) return '+' + d.slice(0,2) + ' ' + d.slice(2,3) + ' ' + d.slice(3,7) + ' ' + d.slice(7);
        return '+' + d.slice(0,2) + ' ' + d.slice(2,3) + ' ' + d.slice(3,7) + ' ' + d.slice(7,11);
    } else {
        const d = digits;
        if (d.length <= 1) return d;
        if (d.length <= 5) return d.slice(0,1) + ' ' + d.slice(1);
        if (d.length <= 9) return d.slice(0,1) + ' ' + d.slice(1,5) + ' ' + d.slice(5);
        return d.slice(0,1) + ' ' + d.slice(1,5) + ' ' + d.slice(5,9);
    }
};

// ── Formato moneda chilena para inputs numéricos ──────────────────────────────
const formatCLP = (raw) => {
    const clean = String(raw).replace(/\D/g, '');
    if (!clean) return '';
    return parseInt(clean, 10).toLocaleString('es-CL');
};
const parseCLP = (val) => parseInt(String(val).replace(/\./g, '').replace(/\D/g, '')) || 0;

// ── Estado inicial vacío ──────────────────────────────────────────────────────
const makeEmpty = () => ({
    name: '', rut: '', legal_name: '', address: '',
    phone: '', email: '', website: '', footer_message: '',
    logo_path: '', region: '', city: ''
});

const BusinessSettings = ({ onNavigate }) => {
    const { db } = useDatabase();
    const fileInputRef = useRef();
    const businessRepo = new BusinessRepository(db);

    const [formData,       setFormData]       = useState(makeEmpty());
    const [savedData,      setSavedData]      = useState(null);
    const [savedKitchen,   setSavedKitchen]   = useState(null);
    const [savedCash,      setSavedCash]      = useState(null);
    const [comunas,        setComunas]        = useState([]);
    const [logoPreview,    setLogoPreview]    = useState(null);
    const [loading,        setLoading]        = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [errorMsg,       setErrorMsg]       = useState('');
    const [fieldErrors,    setFieldErrors]    = useState({});

    // ── Configuración de impresora de tickets ────────────────────────────────
    // Si está configurada, el ticket se imprime silenciosamente sin diálogo del SO.
    const [ticketPrinter,  setTicketPrinter]  = useState('');
    const [savedTicket,    setSavedTicket]    = useState(null);

    // ── Configuración de cocina ───────────────────────────────────────────────
    // kitchenCopyDest valores posibles:
    //   1 copia:  'kitchen' (→ impresora cocina) | 'cajero' (→ junto con ticket)
    //   2 copias: 'both_kitchen' (→ 2 a cocina)  | 'split' (→ 1 cocina + 1 cajero) | 'both_cajero' (→ 2 al cajero)
    const [kitchenEnabled,    setKitchenEnabled]    = useState(false);
    const [kitchenCopies,     setKitchenCopies]     = useState(1);
    const [kitchenPrinter,    setKitchenPrinter]    = useState('');
    const [kitchenCopyDest,   setKitchenCopyDest]   = useState('kitchen');
    const [availablePrinters, setAvailablePrinters] = useState([]);

    // ── Configuración de caja ─────────────────────────────────────────────────
    const [cashLimitAlert,       setCashLimitAlert]       = useState('350.000');
    const [cashWithdrawalAmount, setCashWithdrawalAmount] = useState('300.000');

    // ── Dialogs ───────────────────────────────────────────────────────────────
    const [dialog, setDialog] = useState(null);

    // ── Detectar cambios sin guardar ──────────────────────────────────────────
    const hasUnsavedChanges = useCallback(() => {
        if (!savedData || !savedKitchen || !savedCash || !savedTicket) return false;
        const formChanged    = JSON.stringify(formData) !== JSON.stringify(savedData);
        const ticketChanged  = ticketPrinter !== savedTicket.printer;
        const kitchenChanged = kitchenEnabled  !== savedKitchen.enabled
                            || kitchenCopies   !== savedKitchen.copies
                            || kitchenPrinter  !== savedKitchen.printer
                            || kitchenCopyDest !== savedKitchen.copyDest;
        const cashChanged    = parseCLP(cashLimitAlert)       !== savedCash.limit
                            || parseCLP(cashWithdrawalAmount) !== savedCash.withdrawal;
        return formChanged || ticketChanged || kitchenChanged || cashChanged;
    }, [formData, savedData, ticketPrinter, savedTicket,
        kitchenEnabled, kitchenCopies, kitchenPrinter, kitchenCopyDest,
        savedKitchen, cashLimitAlert, cashWithdrawalAmount, savedCash]);

    // ── Interceptor de navegación ─────────────────────────────────────────────
    useEffect(() => {
        window.__requestNavigate = (destination) => {
            if (!hasUnsavedChanges()) {
                if (onNavigate) onNavigate(destination);
                return;
            }
            setDialog({ type: 'unsaved', destination });
        };
        return () => { delete window.__requestNavigate; };
    }, [hasUnsavedChanges, onNavigate]);

    // ── Carga inicial ─────────────────────────────────────────────────────────
    useEffect(() => { loadBusinessInfo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const list = getComunasByRegion(formData.region);
        setComunas(list);
        if (formData.city && list.length > 0 && !list.includes(formData.city))
            setFormData(prev => ({ ...prev, city: '' }));
    }, [formData.region]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && dialog) setDialog(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog]);

    // ── Cargar lista de impresoras ────────────────────────────────────────────
    const loadPrinters = async () => {
        try {
            const printers = await window.electronAPI.kitchen.getPrinters();
            setAvailablePrinters(printers || []);
        } catch {
            setAvailablePrinters([]);
        }
    };

    const loadBusinessInfo = async () => {
        try {
            setInitialLoading(true);

            await window.electronAPI.database.run(
                `INSERT OR IGNORE INTO system_settings (key, value, description, data_type)
                 VALUES ('cash_limit_alert', '350000', 'Límite de alerta de efectivo en caja', 'number')`
            );
            await window.electronAPI.database.run(
                `INSERT OR IGNORE INTO system_settings (key, value, description, data_type)
                 VALUES ('cash_withdrawal_amount', '300000', 'Monto sugerido de retiro de caja', 'number')`
            );

            const info   = await businessRepo.getBusinessInfo();
            const loaded = makeEmpty();
            if (info && typeof info === 'object') {
                Object.assign(loaded, {
                    name:           info.name           || '',
                    rut:            info.rut            || '',
                    legal_name:     info.legal_name     || '',
                    address:        info.address        || '',
                    phone:          info.phone          || '',
                    email:          info.email          || '',
                    website:        info.website        || '',
                    footer_message: info.footer_message || '',
                    logo_path:      info.logo_path      || '',
                    region:         info.region         || '',
                    city:           info.city           || '',
                });
                if (info.region) setComunas(getComunasByRegion(info.region));
                if (info.logo_path) setLogoPreview(info.logo_path);
            }
            setFormData(loaded);
            setSavedData({ ...loaded });

            // Impresora de tickets
            const ticketPrinterResult = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'ticket_printer'`);
            const tp = ticketPrinterResult?.value || '';
            setTicketPrinter(tp);
            setSavedTicket({ printer: tp });

            // Cocina
            const kitchenResult  = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_enabled'`);
            const copiesResult   = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_copies'`);
            const printerResult  = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_printer'`);
            const copyDestResult = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_copy_dest'`);

            const ke = kitchenResult?.value === '1';
            const kc = parseInt(copiesResult?.value || '1');
            const kp = printerResult?.value || '';
            // Normalizar el valor guardado: si viene 'both_kitchen' con kc=1, usar 'kitchen'
            const rawDest = copyDestResult?.value || '';
            const kd = rawDest || (kc === 1 ? 'kitchen' : 'both_kitchen');

            setKitchenEnabled(ke);
            setKitchenCopies(kc);
            setKitchenPrinter(kp);
            setKitchenCopyDest(kd);
            setSavedKitchen({ enabled: ke, copies: kc, printer: kp, copyDest: kd });

            await loadPrinters();

            // Caja
            const limitResult      = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'cash_limit_alert'`);
            const withdrawalResult = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'cash_withdrawal_amount'`);
            const cl = parseInt(limitResult?.value      || '350000');
            const cw = parseInt(withdrawalResult?.value || '300000');
            setCashLimitAlert(cl.toLocaleString('es-CL'));
            setCashWithdrawalAmount(cw.toLocaleString('es-CL'));
            setSavedCash({ limit: cl, withdrawal: cw });

        } catch (error) {
            console.error('Error loading:', error);
            setErrorMsg('Error al cargar la configuración');
        } finally {
            setInitialLoading(false);
        }
    };

    // ── Helpers errores ───────────────────────────────────────────────────────
    const setFieldError   = (field, msg) => setFieldErrors(prev => ({ ...prev, [field]: msg }));
    const clearFieldError = (field)      => setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });

    // ── Handler cambio de copias — resetea copyDest al default del modo ───────
    const handleSetCopies = (n) => {
        setKitchenCopies(n);
        // Reset al default de cada modo para evitar estados inválidos
        setKitchenCopyDest(n === 1 ? 'kitchen' : 'both_kitchen');
    };

    // ── Handlers formulario ───────────────────────────────────────────────────
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errorMsg) setErrorMsg('');
        if (name === 'email') {
            if (value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
                setFieldError('email', 'Correo inválido — Ej: contacto@negocio.cl');
            else clearFieldError('email');
        }
        if (name === 'website') {
            if (!value.trim()) clearFieldError('website');
        }
        if (name === 'name') {
            if (!value.trim()) setFieldError('name', 'El nombre de fantasía es obligatorio');
            else clearFieldError('name');
        }
    };

    const handleRUTChange = (e) => {
        const formatted = formatRUT(e.target.value);
        setFormData(prev => ({ ...prev, rut: formatted }));
        if (errorMsg) setErrorMsg('');
        if (formatted.length >= 3) {
            if (validateRUTDigit(formatted)) clearFieldError('rut');
            else setFieldError('rut', 'RUT inválido — verifica el dígito verificador');
        } else {
            clearFieldError('rut');
        }
    };

    const handlePhoneChange = (e) => {
        const formatted = formatPhone(e.target.value);
        setFormData(prev => ({ ...prev, phone: formatted }));
        if (errorMsg) setErrorMsg('');
    };

    const handleWebsiteBlur = () => {
        if (formData.website.trim() && !validateWebsite(formData.website))
            setFieldError('website', 'Sitio web inválido — Ej: www.minegocio.cl o https://minegocio.cl');
        else clearFieldError('website');
    };

    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errorMsg) setErrorMsg('');
    };

    const handleCashLimitChange = (e) => {
        setCashLimitAlert(formatCLP(e.target.value));
        if (errorMsg) setErrorMsg('');
    };
    const handleCashWithdrawalChange = (e) => {
        setCashWithdrawalAmount(formatCLP(e.target.value));
        if (errorMsg) setErrorMsg('');
    };

    const handleLogoClick  = () => fileInputRef.current?.click();
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/'))   { setErrorMsg('Selecciona una imagen válida (PNG, JPG, etc.)'); return; }
        if (file.size > 2 * 1024 * 1024)       { setErrorMsg('La imagen debe ser menor a 2MB'); return; }
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoPreview(reader.result);
            setFormData(prev => ({ ...prev, logo_path: reader.result }));
            setErrorMsg('');
        };
        reader.onerror = () => setErrorMsg('Error al leer el archivo');
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setLogoPreview(null);
        setFormData(prev => ({ ...prev, logo_path: '' }));
        if (fileInputRef.current) fileInputRef.current.value = '';
        setErrorMsg('');
    };

    // ── Validación ────────────────────────────────────────────────────────────
    const validateForm = () => {
        const errors = {};
        if (!formData.name?.trim())
            errors.name = 'El nombre de fantasía es obligatorio';
        if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))
            errors.email = 'Correo inválido — Ej: contacto@negocio.cl';
        if (formData.rut?.trim() && !validateRUTDigit(formData.rut))
            errors.rut = 'RUT inválido — verifica el dígito verificador';
        if (formData.website?.trim() && !validateWebsite(formData.website))
            errors.website = 'Sitio web inválido — Ej: www.minegocio.cl o https://minegocio.cl';
        const limit      = parseCLP(cashLimitAlert);
        const withdrawal = parseCLP(cashWithdrawalAmount);
        if (limit <= 0)
            errors.cashLimitAlert = 'El límite de alerta debe ser mayor a $0';
        if (withdrawal <= 0)
            errors.cashWithdrawalAmount = 'El monto de retiro debe ser mayor a $0';
        if (withdrawal >= limit)
            errors.cashWithdrawalAmount = 'El monto de retiro debe ser menor al límite de alerta';
        return errors;
    };

    // ── Guardar ───────────────────────────────────────────────────────────────
    const doSave = async () => {
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(prev => ({ ...prev, ...errors }));
            setErrorMsg('Corrige los campos marcados en rojo antes de guardar.');
            return false;
        }
        setLoading(true);
        setErrorMsg('');
        try {
            await businessRepo.saveBusinessInfo({
                name:           formData.name.trim(),
                rut:            formData.rut.trim(),
                legal_name:     formData.legal_name.trim(),
                address:        formData.address.trim(),
                phone:          formData.phone.trim(),
                email:          formData.email.trim(),
                website:        formData.website.trim(),
                footer_message: formData.footer_message.trim(),
                logo_path:      formData.logo_path,
                region:         formData.region || null,
                city:           formData.city   || null,
            });

            // Impresora de tickets
            await window.electronAPI.database.run(
                `INSERT OR REPLACE INTO system_settings (key, value, description, data_type)
                 VALUES ('ticket_printer', ?, 'Impresora de tickets (silenciosa)', 'string')`,
                [ticketPrinter]
            );

            // Cocina
            await window.electronAPI.database.run(
                `INSERT OR REPLACE INTO system_settings (key, value, description, data_type)
                 VALUES ('kitchen_enabled', ?, 'Activar comanda para cocina', 'boolean')`,
                [kitchenEnabled ? '1' : '0']
            );
            await window.electronAPI.database.run(
                `INSERT OR REPLACE INTO system_settings (key, value, description, data_type)
                 VALUES ('kitchen_copies', ?, 'Cantidad de copias de comanda', 'number')`,
                [String(kitchenCopies)]
            );
            await window.electronAPI.database.run(
                `INSERT OR REPLACE INTO system_settings (key, value, description, data_type)
                 VALUES ('kitchen_printer', ?, 'Impresora de cocina', 'string')`,
                [kitchenPrinter]
            );
            await window.electronAPI.database.run(
                `INSERT OR REPLACE INTO system_settings (key, value, description, data_type)
                 VALUES ('kitchen_copy_dest', ?, 'Destino de copias de comanda', 'string')`,
                [kitchenCopyDest]
            );

            // Caja
            const limitVal      = parseCLP(cashLimitAlert);
            const withdrawalVal = parseCLP(cashWithdrawalAmount);
            await window.electronAPI.database.run(
                `INSERT OR REPLACE INTO system_settings (key, value, description, data_type)
                 VALUES ('cash_limit_alert', ?, 'Límite de alerta de efectivo en caja', 'number')`,
                [String(limitVal)]
            );
            await window.electronAPI.database.run(
                `INSERT OR REPLACE INTO system_settings (key, value, description, data_type)
                 VALUES ('cash_withdrawal_amount', ?, 'Monto sugerido de retiro de caja', 'number')`,
                [String(withdrawalVal)]
            );

            setSavedData({ ...formData });
            setSavedTicket({ printer: ticketPrinter });
            setSavedKitchen({ enabled: kitchenEnabled, copies: kitchenCopies, printer: kitchenPrinter, copyDest: kitchenCopyDest });
            setSavedCash({ limit: limitVal, withdrawal: withdrawalVal });
            return true;
        } catch (error) {
            console.error('Error saving:', error);
            setErrorMsg(`Error al guardar: ${error.message}`);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const saved = await doSave();
        if (saved) setDialog({ type: 'success' });
    };

    const handleSaveAndLeave = async () => {
        const dest = dialog?.destination;
        setDialog(null);
        const saved = await doSave();
        if (saved && dest && onNavigate) onNavigate(dest);
    };

    const handleLeaveWithout = () => {
        const dest = dialog?.destination;
        setDialog(null);
        if (dest && onNavigate) onNavigate(dest);
    };

    // ── Texto de vista previa del comportamiento ──────────────────────────────
    const getBehaviorPreview = () => {
        if (!kitchenPrinter) {
            return 'Al finalizar la venta, aparecerá el diálogo de impresión para elegir la impresora manualmente.';
        }
        if (kitchenCopies === 1) {
            if (kitchenCopyDest === 'cajero')
                return `1 comanda saldrá junto con el ticket en el cajero al imprimir.`;
            return `1 comanda se enviará automáticamente a "${kitchenPrinter}" al imprimir el ticket.`;
        }
        // 2 copias
        if (kitchenCopyDest === 'both_cajero')
            return `2 comandas saldrán junto con el ticket en el cajero al imprimir.`;
        if (kitchenCopyDest === 'split')
            return `1 comanda irá automáticamente a "${kitchenPrinter}" y la otra saldrá junto con el ticket del cajero.`;
        return `2 comandas se enviarán automáticamente a "${kitchenPrinter}" al imprimir el ticket.`;
    };

    if (initialLoading) {
        return (
            <div className="main-content-scrollable">
                <div className="business-settings">
                    <div className="bs-loading">
                        <div className="bs-spinner"></div>
                        <p>Cargando configuración...</p>
                    </div>
                </div>
            </div>
        );
    }

    const isDirty = hasUnsavedChanges();

    return (
        <div className="main-content-scrollable">
            <div className="business-settings">

                {/* ── Header ── */}
                <div className="bs-page-header">
                    <div>
                        <h1 className="bs-page-title">Configuración del Negocio</h1>
                        <p className="bs-page-subtitle">Personaliza la información de tu negocio</p>
                    </div>
                    {isDirty && (
                        <div className="bs-unsaved-badge">
                            <span className="bs-unsaved-dot" />
                            Cambios sin guardar
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit}>

                    {/* ── Logo ── */}
                    <Card title="Logo del Negocio">
                        <div className="logo-section">
                            <div className="logo-preview-container">
                                {logoPreview ? (
                                    <div className="logo-preview">
                                        <img src={logoPreview} alt="Logo del negocio" />
                                        <button type="button" className="logo-remove"
                                            onClick={handleRemoveLogo} disabled={loading}>
                                            <FiX />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="logo-placeholder"
                                        onClick={loading ? undefined : handleLogoClick}
                                        style={{ cursor: loading ? 'not-allowed' : 'pointer' }}>
                                        <FiUpload size={32} />
                                        <p>Subir logo</p>
                                        <small>PNG, JPG · máx. 2MB</small>
                                    </div>
                                )}
                            </div>
                            <div className="logo-info">
                                <p>Aparecerá en los tickets y documentos impresos.</p>
                                <p>Formato recomendado: fondo blanco o transparente.</p>
                                {logoPreview && (
                                    <Button type="button" variant="outline" icon={<FiUpload />}
                                        onClick={handleLogoClick} disabled={loading}>
                                        Cambiar Logo
                                    </Button>
                                )}
                            </div>
                            <input ref={fileInputRef} type="file" accept="image/*"
                                onChange={handleLogoChange} style={{ display: 'none' }} disabled={loading} />
                        </div>
                    </Card>

                    {/* ── Información del Negocio ── */}
                    <Card title="Información del Negocio">
                        <div className="form-grid">
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">
                                    Nombre de Fantasía <span style={{color:'#ef4444'}}>*</span>
                                </label>
                                <input
                                    type="text" name="name" value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Ej: Minimarket Don José"
                                    disabled={loading}
                                    className={`bs-field-input ${fieldErrors.name ? 'bs-field-input--error' : ''}`}
                                />
                                {fieldErrors.name ? (
                                    <small className="bs-field-helper bs-field-error">⚠️ {fieldErrors.name}</small>
                                ) : (
                                    <small className="bs-field-helper">Nombre comercial que aparecerá en los tickets</small>
                                )}
                            </div>
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">Razón Social</label>
                                <input
                                    type="text" name="legal_name" value={formData.legal_name}
                                    onChange={handleChange}
                                    placeholder="Nombre legal completo ante el SII"
                                    disabled={loading} className="bs-field-input" autoComplete="off"
                                />
                                <small className="bs-field-helper">Nombre legal registrado en el SII</small>
                            </div>
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">RUT</label>
                                <input
                                    type="text" name="rut" value={formData.rut}
                                    onChange={handleRUTChange}
                                    placeholder="12.345.678-9"
                                    disabled={loading} maxLength={12}
                                    className={`bs-field-input ${fieldErrors.rut ? 'bs-field-input--error' : ''}`}
                                    autoComplete="off"
                                />
                                {fieldErrors.rut ? (
                                    <small className="bs-field-helper bs-field-error">⚠️ {fieldErrors.rut}</small>
                                ) : (
                                    <small className="bs-field-helper">Se formatea automáticamente al escribir</small>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* ── Información de Contacto ── */}
                    <Card title="Información de Contacto">
                        <div className="form-grid">
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">Teléfono</label>
                                <input
                                    type="text" name="phone" value={formData.phone}
                                    onChange={handlePhoneChange}
                                    placeholder="+56 9 1234 5678"
                                    disabled={loading} maxLength={16}
                                    className="bs-field-input" autoComplete="off"
                                />
                                <small className="bs-field-helper">Escribe con + para formato internacional</small>
                            </div>
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">Email</label>
                                <input
                                    type="text" name="email" value={formData.email}
                                    onChange={handleChange}
                                    onBlur={() => {
                                        const v = formData.email.trim();
                                        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
                                            setFieldError('email', 'Correo inválido — Ej: contacto@negocio.cl');
                                        else clearFieldError('email');
                                    }}
                                    placeholder="contacto@minegocio.cl"
                                    disabled={loading}
                                    className={`bs-field-input ${fieldErrors.email ? 'bs-field-input--error' : ''}`}
                                    autoComplete="off"
                                />
                                {fieldErrors.email ? (
                                    <small className="bs-field-helper bs-field-error">⚠️ {fieldErrors.email}</small>
                                ) : (
                                    <small className="bs-field-helper">Ej: contacto@minegocio.cl</small>
                                )}
                            </div>
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">Sitio Web</label>
                                <input
                                    type="text" name="website" value={formData.website}
                                    onChange={handleChange} onBlur={handleWebsiteBlur}
                                    placeholder="www.minegocio.cl"
                                    disabled={loading}
                                    className={`bs-field-input ${fieldErrors.website ? 'bs-field-input--error' : ''}`}
                                    autoComplete="off"
                                />
                                {fieldErrors.website ? (
                                    <small className="bs-field-helper bs-field-error">⚠️ {fieldErrors.website}</small>
                                ) : (
                                    <small className="bs-field-helper">Ej: www.minegocio.cl o https://minegocio.cl</small>
                                )}
                            </div>
                        </div>
                        <div className="bs-full-row">
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">Dirección</label>
                                <input
                                    type="text" name="address" value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Calle Principal #123"
                                    disabled={loading}
                                    className="bs-field-input bs-field-input--full" autoComplete="off"
                                />
                            </div>
                        </div>
                        <div className="bs-region-row">
                            <SearchableSelect
                                label="Región" value={formData.region}
                                onChange={(v) => handleFieldChange('region', v)}
                                options={REGIONES} placeholder="Seleccionar región"
                                searchPlaceholder="Buscar región..." disabled={loading}
                            />
                            <SearchableSelect
                                label="Comuna" value={formData.city}
                                onChange={(v) => handleFieldChange('city', v)}
                                options={comunas}
                                placeholder={formData.region ? 'Seleccionar comuna' : 'Primero elige una región'}
                                searchPlaceholder="Buscar comuna..."
                                disabled={loading || !formData.region}
                            />
                        </div>
                    </Card>

                    {/* ── Personalización del Ticket ── */}
                    <Card title="🧾 Ticket de Venta">
                        {/* Impresora de tickets */}
                        <div className="kitchen-setting-row">
                            <div className="setting-toggle-info">
                                <p className="setting-toggle-title">Impresora de tickets</p>
                                <p className="setting-toggle-desc">
                                    El ticket se enviará automáticamente a esta impresora al finalizar la venta,
                                    sin mostrar el diálogo del sistema. Si no seleccionas una, se abrirá el
                                    diálogo de impresión normal.
                                </p>
                            </div>
                            <div className="kitchen-printer-select-wrap">
                                <select
                                    className="bs-field-input kitchen-printer-select"
                                    value={ticketPrinter}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val && val === kitchenPrinter) return; // bloquear misma impresora
                                        setTicketPrinter(val);
                                    }}
                                    disabled={loading}
                                >
                                    <option value="">— Diálogo manual (por defecto) —</option>
                                    {availablePrinters.map(p => (
                                        <option
                                            key={p.name}
                                            value={p.name}
                                            disabled={kitchenPrinter && p.name === kitchenPrinter}
                                        >
                                            {p.isDefault ? `⭐ ${p.name}` : p.name}
                                            {kitchenPrinter && p.name === kitchenPrinter ? ' (en uso por cocina)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="kitchen-refresh-btn"
                                    onClick={loadPrinters}
                                    disabled={loading}
                                    title="Actualizar lista de impresoras"
                                >
                                    <FiRefreshCw size={14} />
                                </button>
                            </div>
                        </div>

                        {ticketPrinter && (
                            <div className="kitchen-behavior-preview">
                                <span className="kitchen-preview-icon">👁️</span>
                                <span className="kitchen-preview-text">
                                    El ticket se enviará automáticamente a <strong>{ticketPrinter}</strong> al imprimir, sin ningún diálogo.
                                </span>
                            </div>
                        )}

                        {/* Mensaje de agradecimiento */}
                        <div className="form-field" style={{ marginTop: ticketPrinter ? '16px' : '0' }}>
                            <label className="form-label">Mensaje de Agradecimiento</label>
                            <textarea
                                name="footer_message" value={formData.footer_message}
                                onChange={handleChange}
                                placeholder="¡Gracias por su compra! Vuelva pronto"
                                className="form-textarea" rows="3"
                                disabled={loading} maxLength={200}
                            />
                            <small className="form-helper">
                                Aparecerá al final de cada ticket ({formData.footer_message.length}/200)
                            </small>
                        </div>
                    </Card>

                    {/* ── Comanda para Cocina ── */}
                    <Card title="🍽️ Comanda para Cocina">

                        {/* 1 — Toggle activar comanda */}
                        <div className="setting-toggle-row">
                            <div className="setting-toggle-info">
                                <p className="setting-toggle-title">Activar impresión de comanda</p>
                                <p className="setting-toggle-desc">
                                    Al finalizar una venta podrás imprimir una comanda separada para la cocina.
                                </p>
                            </div>
                            <label className="toggle-switch">
                                <input type="checkbox" checked={kitchenEnabled}
                                    onChange={(e) => setKitchenEnabled(e.target.checked)}
                                    disabled={loading} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>

                        {kitchenEnabled && (
                            <>
                                {/* 2 — Copias de comanda */}
                                <div className="kitchen-copies-row">
                                    <div className="setting-toggle-info">
                                        <p className="setting-toggle-title">Copias de comanda</p>
                                        <p className="setting-toggle-desc">
                                            ¿Cuántas comandas imprimir por venta?
                                        </p>
                                    </div>
                                    <div className="copies-selector">
                                        <button type="button"
                                            className={`copy-btn ${kitchenCopies === 1 ? 'copy-btn--active' : ''}`}
                                            onClick={() => handleSetCopies(1)} disabled={loading}>
                                            1 copia
                                        </button>
                                        <button type="button"
                                            className={`copy-btn ${kitchenCopies === 2 ? 'copy-btn--active' : ''}`}
                                            onClick={() => handleSetCopies(2)} disabled={loading}>
                                            2 copias
                                        </button>
                                    </div>
                                </div>

                                {/* 3 — Destino de la(s) copia(s)
                                    Visible siempre que hay impresora configurada.
                                    Para 1 copia: kitchen | cajero
                                    Para 2 copias: both_kitchen | split | both_cajero        */}
                                {kitchenPrinter && kitchenCopies === 1 && (
                                    <div className="kitchen-copies-dest-row">
                                        <div className="setting-toggle-info">
                                            <p className="setting-toggle-title">Destino de la comanda</p>
                                            <p className="setting-toggle-desc">
                                                ¿Dónde debe aparecer la comanda al imprimir el ticket?
                                            </p>
                                        </div>
                                        <div className="copies-dest-selector">
                                            <button
                                                type="button"
                                                className={`copy-dest-btn ${kitchenCopyDest === 'kitchen' ? 'copy-dest-btn--active' : ''}`}
                                                onClick={() => setKitchenCopyDest('kitchen')}
                                                disabled={loading}
                                            >
                                                <span className="copy-dest-icon">🍳</span>
                                                <span className="copy-dest-label">A la cocina</span>
                                                <span className="copy-dest-desc">Se envía automáticamente a la impresora de cocina</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`copy-dest-btn ${kitchenCopyDest === 'cajero' ? 'copy-dest-btn--active' : ''}`}
                                                onClick={() => setKitchenCopyDest('cajero')}
                                                disabled={loading}
                                            >
                                                <span className="copy-dest-icon">🧾</span>
                                                <span className="copy-dest-label">Al cajero</span>
                                                <span className="copy-dest-desc">Sale junto con el ticket en el diálogo de impresión</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {kitchenPrinter && kitchenCopies === 2 && (
                                    <div className="kitchen-copies-dest-row">
                                        <div className="setting-toggle-info">
                                            <p className="setting-toggle-title">Destino de las 2 copias</p>
                                            <p className="setting-toggle-desc">
                                                Define a dónde va cada copia de la comanda.
                                            </p>
                                        </div>
                                        <div className="copies-dest-selector">
                                            <button
                                                type="button"
                                                className={`copy-dest-btn ${kitchenCopyDest === 'both_kitchen' ? 'copy-dest-btn--active' : ''}`}
                                                onClick={() => setKitchenCopyDest('both_kitchen')}
                                                disabled={loading}
                                            >
                                                <span className="copy-dest-icon">🍳🍳</span>
                                                <span className="copy-dest-label">Ambas a cocina</span>
                                                <span className="copy-dest-desc">Las 2 van automáticamente a la impresora de cocina</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`copy-dest-btn ${kitchenCopyDest === 'split' ? 'copy-dest-btn--active' : ''}`}
                                                onClick={() => setKitchenCopyDest('split')}
                                                disabled={loading}
                                            >
                                                <span className="copy-dest-icon">🍳🧾</span>
                                                <span className="copy-dest-label">Una a cocina + una al cajero</span>
                                                <span className="copy-dest-desc">1 va automática a cocina, 1 sale con el ticket del cajero</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`copy-dest-btn ${kitchenCopyDest === 'both_cajero' ? 'copy-dest-btn--active' : ''}`}
                                                onClick={() => setKitchenCopyDest('both_cajero')}
                                                disabled={loading}
                                            >
                                                <span className="copy-dest-icon">🧾🧾</span>
                                                <span className="copy-dest-label">Ambas al cajero</span>
                                                <span className="copy-dest-desc">Las 2 salen junto con el ticket en el diálogo de impresión</span>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 4 — Impresora de cocina
                                    Va después del destino porque el selector de destino
                                    solo aparece cuando hay impresora — esto crea el flujo:
                                    copias → (si hay printer) destino → printer        */}
                                <div className="kitchen-setting-row">
                                    <div className="setting-toggle-info">
                                        <p className="setting-toggle-title">Impresora de cocina</p>
                                        <p className="setting-toggle-desc">
                                            La comanda se enviará automáticamente a esta impresora al finalizar la venta.
                                            Si no seleccionas una, aparecerá el diálogo de impresión normal.
                                        </p>
                                    </div>
                                    <div className="kitchen-printer-select-wrap">
                                        <select
                                            className="bs-field-input kitchen-printer-select"
                                            value={kitchenPrinter}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val && val === ticketPrinter) return;
                                                setKitchenPrinter(val);
                                            }}
                                            disabled={loading}
                                        >
                                            <option value="">— Sin impresora automática —</option>
                                            {availablePrinters.map(p => (
                                                <option
                                                    key={p.name}
                                                    value={p.name}
                                                    disabled={ticketPrinter && p.name === ticketPrinter}
                                                >
                                                    {p.isDefault ? `⭐ ${p.name}` : p.name}
                                                    {ticketPrinter && p.name === ticketPrinter ? ' (en uso por tickets)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="kitchen-refresh-btn"
                                            onClick={loadPrinters}
                                            disabled={loading}
                                            title="Actualizar lista de impresoras"
                                        >
                                            <FiRefreshCw size={14} />
                                        </button>
                                    </div>
                                </div>

                                {/* 5 — Vista previa del comportamiento */}
                                <div className="kitchen-behavior-preview">
                                    <span className="kitchen-preview-icon">👁️</span>
                                    <span className="kitchen-preview-text">
                                        {getBehaviorPreview()}
                                    </span>
                                </div>
                            </>
                        )}
                    </Card>

                    {/* ── Control de Efectivo en Caja ── */}
                    <Card title="💵 Control de Efectivo en Caja">
                        <p className="bs-section-desc">
                            Define cuándo alertar al cajero que hay demasiado efectivo en caja y cuánto debe retirar.
                            Esto reduce el riesgo de pérdida y facilita el arqueo final.
                        </p>
                        <div className="form-grid">
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">Límite de alerta de efectivo</label>
                                <div className="bs-field-prefix-wrap">
                                    <span className="bs-field-prefix">$</span>
                                    <input
                                        type="text"
                                        value={cashLimitAlert}
                                        onChange={handleCashLimitChange}
                                        placeholder="350.000"
                                        disabled={loading}
                                        inputMode="numeric"
                                        className={`bs-field-input bs-field-input--prefixed ${fieldErrors.cashLimitAlert ? 'bs-field-input--error' : ''}`}
                                    />
                                </div>
                                {fieldErrors.cashLimitAlert ? (
                                    <small className="bs-field-helper bs-field-error">⚠️ {fieldErrors.cashLimitAlert}</small>
                                ) : (
                                    <small className="bs-field-helper">Cuando la caja supere este monto aparecerá una alerta de retiro</small>
                                )}
                            </div>
                            <div className="bs-field-wrap">
                                <label className="bs-field-label">Monto sugerido de retiro</label>
                                <div className="bs-field-prefix-wrap">
                                    <span className="bs-field-prefix">$</span>
                                    <input
                                        type="text"
                                        value={cashWithdrawalAmount}
                                        onChange={handleCashWithdrawalChange}
                                        placeholder="300.000"
                                        disabled={loading}
                                        inputMode="numeric"
                                        className={`bs-field-input bs-field-input--prefixed ${fieldErrors.cashWithdrawalAmount ? 'bs-field-input--error' : ''}`}
                                    />
                                </div>
                                {fieldErrors.cashWithdrawalAmount ? (
                                    <small className="bs-field-helper bs-field-error">⚠️ {fieldErrors.cashWithdrawalAmount}</small>
                                ) : (
                                    <small className="bs-field-helper">Monto a retirar al admin, dejando el resto como fondo de vuelto</small>
                                )}
                            </div>
                        </div>
                        {parseCLP(cashLimitAlert) > 0 && parseCLP(cashWithdrawalAmount) > 0 &&
                         parseCLP(cashWithdrawalAmount) < parseCLP(cashLimitAlert) && (
                            <div className="bs-cash-preview">
                                <span className="bs-cash-preview-icon">👁️</span>
                                <span>
                                    Cuando la caja supere{' '}
                                    <strong>${parseCLP(cashLimitAlert).toLocaleString('es-CL')}</strong>,
                                    el cajero verá: <em>"Se recomienda retirar{' '}
                                    <strong>${parseCLP(cashWithdrawalAmount).toLocaleString('es-CL')}</strong>{' '}
                                    y dejar{' '}
                                    <strong>${(parseCLP(cashLimitAlert) - parseCLP(cashWithdrawalAmount)).toLocaleString('es-CL')}</strong>{' '}
                                    como fondo de vuelto."</em>
                                </span>
                            </div>
                        )}
                    </Card>

                    {/* ── Error inline ── */}
                    {errorMsg && (
                        <div className="bs-error-box">
                            <span>⚠️</span>
                            <span style={{ whiteSpace: 'pre-line' }}>{errorMsg}</span>
                        </div>
                    )}

                    <div className="form-actions">
                        <Button type="submit" variant="primary" icon={<FiSave />}
                            loading={loading} disabled={loading} size="large">
                            {loading ? 'Guardando...' : 'Guardar Configuración'}
                        </Button>
                    </div>
                </form>
            </div>

            {/* ── Dialog: éxito al guardar ── */}
            {dialog?.type === 'success' && (
                <div className="bs-dialog-overlay">
                    <div className="bs-dialog" onClick={e => e.stopPropagation()}>
                        <div className="bs-dialog-icon">✅</div>
                        <p className="bs-dialog-message">Configuración guardada exitosamente.</p>
                        <div className="bs-dialog-actions">
                            <button className="bs-dialog-btn bs-dialog-btn--success" onClick={() => setDialog(null)}>
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Dialog: cambios sin guardar ── */}
            {dialog?.type === 'unsaved' && (
                <div className="bs-dialog-overlay">
                    <div className="bs-dialog" onClick={e => e.stopPropagation()}>
                        <div className="bs-dialog-icon">⚠️</div>
                        <p className="bs-dialog-message">
                            Tienes cambios sin guardar en la configuración.{'\n\n'}¿Qué deseas hacer?
                        </p>
                        <div className="bs-dialog-actions bs-dialog-actions--col">
                            <button className="bs-dialog-btn bs-dialog-btn--success" onClick={handleSaveAndLeave}>
                                Guardar y salir
                            </button>
                            <button className="bs-dialog-btn bs-dialog-btn--danger" onClick={handleLeaveWithout}>
                                Salir sin guardar
                            </button>
                            <button className="bs-dialog-btn bs-dialog-btn--cancel" onClick={() => setDialog(null)}>
                                Seguir editando
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BusinessSettings;