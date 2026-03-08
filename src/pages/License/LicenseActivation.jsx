// src/pages/License/LicenseActivation.jsx
import React, { useState } from 'react';
import './LicenseActivation.css';

const LicenseActivation = ({ onActivated }) => {
    const [licenseKey, setLicenseKey]     = useState('');
    const [email, setEmail]               = useState('');
    const [businessName, setBusinessName] = useState('');
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');
    const [step, setStep]                 = useState('input');

    const handleKeyChange = (e) => {
        // Limpiar todo excepto letras y números
        const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);

        // Reconstruir con guiones: NUVEN-XXXX-XXXX-XXXX
        let formatted = '';
        for (let i = 0; i < clean.length; i++) {
            // Insertar guión después de pos 5, 9, 13
            if (i === 5 || i === 9 || i === 13) formatted += '-';
            formatted += clean[i];
        }

        setLicenseKey(formatted);
        setError('');
    };

    const isValidFormat = () => {
        return /^NUVEN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey);
    };

    const isValidEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const canSubmit = () => isValidFormat() && isValidEmail() && businessName.trim().length >= 2;

    const handleActivate = async () => {
        if (!isValidFormat()) {
            setError('Formato de clave inválido. Debe ser NUVEN-XXXX-XXXX-XXXX');
            return;
        }
        if (!isValidEmail()) {
            setError('Ingresa un correo electrónico válido');
            return;
        }

        setLoading(true);
        setStep('activating');
        setError('');

        try {
            const result = await window.electronAPI.license.activate(
                licenseKey,
                email.trim(),
                businessName.trim()
            );

            if (result.success) {
                setStep('success');
                // Esperar 1.5s para mostrar el éxito antes de continuar
                setTimeout(() => {
                    onActivated(result.data);
                }, 1500);
            } else {
                setStep('input');
                if (result.noInternet) {
                    setError('Sin conexión a internet. La activación inicial requiere internet. Intenta de nuevo con conexión.');
                } else {
                    setError(result.error || 'No se pudo activar la licencia. Verifica la clave e inténtalo de nuevo.');
                }
            }
        } catch (err) {
            setStep('input');
            setError('Error inesperado. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && canSubmit() && !loading) {
            handleActivate();
        }
    };

    return (
        <div className="la-container">
            {/* Fondo decorativo */}
            <div className="la-bg-decoration" />

            <div className="la-card">
                {/* Logo / Marca */}
                <div className="la-header">
                    <div className="la-logo-wrapper">
                        <div className="la-logo-icon">
                            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="40" height="40" rx="10" fill="#4F46E5"/>
                                <path d="M10 28 L20 12 L30 28 H22 L20 24 L18 28 H10Z" fill="white" opacity="0.9"/>
                                <circle cx="20" cy="20" r="3" fill="#F97316"/>
                            </svg>
                        </div>
                        <div className="la-logo-text">
                            <span className="la-logo-name">POS System</span>
                            <span className="la-logo-sub">Powered by Nuventa</span>
                        </div>
                    </div>
                </div>

                {/* Contenido según step */}
                {step === 'success' ? (
                    <div className="la-success">
                        <div className="la-success-icon">✓</div>
                        <h2 className="la-success-title">¡Licencia activada!</h2>
                        <p className="la-success-msg">Bienvenido. Iniciando el sistema...</p>
                    </div>
                ) : (
                    <>
                        <div className="la-body">
                            <h1 className="la-title">Activar licencia</h1>
                            <p className="la-description">
                                Ingresa la clave de licencia que recibiste en tu correo
                                al realizar la compra en <strong>nuventa.cl</strong>
                            </p>

                            <div className="la-input-group">
                                <label className="la-label" htmlFor="licenseKey">
                                    Clave de licencia
                                </label>
                                <input
                                    id="licenseKey"
                                    type="text"
                                    className={`la-input ${isValidFormat() ? 'la-input--valid' : ''}`}
                                    value={licenseKey}
                                    onChange={handleKeyChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="NUVEN-XXXX-XXXX-XXXX"
                                    maxLength={20}
                                    disabled={loading}
                                    autoFocus
                                    spellCheck={false}
                                    autoComplete="off"
                                />
                            </div>

                            <div className="la-input-group">
                                <label className="la-label" htmlFor="email">
                                    Correo de compra
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    className={`la-input-text ${isValidEmail() ? 'la-input-text--valid' : ''}`}
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="correo@ejemplo.cl"
                                    disabled={loading}
                                    autoComplete="email"
                                />
                                <p className="la-field-hint">El mismo correo con que compraste en nuventa.cl</p>
                            </div>

                            <div className="la-input-group">
                                <label className="la-label" htmlFor="businessName">
                                    Nombre de tu negocio
                                </label>
                                <input
                                    id="businessName"
                                    type="text"
                                    className={`la-input-text ${businessName.trim().length >= 2 ? 'la-input-text--valid' : ''}`}
                                    value={businessName}
                                    onChange={(e) => { setBusinessName(e.target.value); setError(''); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ej: Minimarket Don José"
                                    disabled={loading}
                                    autoComplete="organization"
                                />
                            </div>

                            {error && (
                                <p className="la-error-msg">
                                    <span>⚠</span> {error}
                                </p>
                            )}

                            <button
                                className={`la-btn ${loading ? 'la-btn--loading' : ''}`}
                                onClick={handleActivate}
                                disabled={!canSubmit() || loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="la-spinner" />
                                        Activando licencia...
                                    </>
                                ) : (
                                    'Activar licencia'
                                )}
                            </button>

                            {/* Info box */}
                            <div className="la-info-box">
                                <div className="la-info-icon">ℹ</div>
                                <div className="la-info-text">
                                    <p>La activación requiere internet <strong>solo esta vez</strong>. Después el sistema funciona completamente offline.</p>
                                    <p>¿No tienes tu clave? Revisa tu correo o visita <strong>nuventa.cl</strong></p>
                                </div>
                            </div>
                        </div>

                        <div className="la-footer">
                            <button
                                className="la-help-link"
                                onClick={() => window.electronAPI.update.openExternal('https://nuventa.cl/soporte')}
                            >
                                ¿Necesitas ayuda? → soporte@nuventa.cl
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LicenseActivation;