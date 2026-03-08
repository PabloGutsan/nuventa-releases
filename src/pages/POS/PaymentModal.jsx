import React, { useState, useEffect, useRef } from 'react';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { FiX, FiDollarSign, FiCreditCard } from 'react-icons/fi';
import './PaymentModal.css';

const PaymentModal = ({ total, onComplete, onClose, isProcessing = false }) => {
    const [paymentMethod,  setPaymentMethod]  = useState('efectivo');
    const [cashReceived,   setCashReceived]   = useState('');
    const [documentType,   setDocumentType]   = useState('sin_documento');
    const [documentNumber, setDocumentNumber] = useState('');
    const [notes,          setNotes]          = useState('');
    const [errors,         setErrors]         = useState({});

    const cashInputRef       = useRef(null);
    const documentNumberRef  = useRef(null);

    // Formatear con separador de miles (punto chileno): 1234567 → 1.234.567
    const formatThousands = (val) => {
        const clean = val.replace(/\D/g, '');
        if (!clean) return '';
        return parseInt(clean, 10).toLocaleString('es-CL');
    };

    const parseCash = (val) => parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => {
        if (paymentMethod === 'efectivo') {
            setTimeout(() => cashInputRef.current?.focus(), 100);
        } else {
            setTimeout(() => {
                if (documentType !== 'sin_documento') documentNumberRef.current?.focus();
            }, 100);
        }
    }, [paymentMethod]);

    useEffect(() => { setErrors({}); }, [paymentMethod, cashReceived, documentType, documentNumber]);

    const calculateChange = () => {
        const validTotal = parseFloat(total) || 0;
        const received   = parseCash(cashReceived) || 0;
        return Math.max(0, received - validTotal);
    };

    const formatCurrency = (value) => {
        const numValue = parseFloat(value) || 0;
        return numValue.toLocaleString('es-CL');
    };

    const validateForm = () => {
        const newErrors = {};
        if (!total || total <= 0)
            newErrors.total = 'El total debe ser mayor a 0';
        if (!paymentMethod)
            newErrors.paymentMethod = 'Debes seleccionar un método de pago';
        if (paymentMethod === 'efectivo') {
            const received = parseCash(cashReceived);
            if (!cashReceived || isNaN(received))
                newErrors.cashReceived = 'Debes ingresar el monto recibido';
            else if (received < total)
                newErrors.cashReceived = `El monto recibido ($${formatCurrency(received)}) es menor al total ($${formatCurrency(total)})`;
            else if (received < 0)
                newErrors.cashReceived = 'El monto no puede ser negativo';
        }
        if (!documentType)
            newErrors.documentType = 'Debes seleccionar un tipo de documento';
        if (documentType !== 'sin_documento') {
            if (!documentNumber || !documentNumber.trim())
                newErrors.documentNumber = 'Debes ingresar el número del documento';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isProcessing) return;

        if (!validateForm()) {
            const firstError = Object.values(errors)[0];
            if (firstError) alert(firstError);
            return;
        }

        const paymentData = {
            method:         paymentMethod,
            cashReceived:   paymentMethod === 'efectivo' ? parseCash(cashReceived) : null,
            cashChange:     paymentMethod === 'efectivo' ? calculateChange()       : null,
            documentType,
            documentNumber: documentType !== 'sin_documento' ? documentNumber.trim() : null,
            notes:          notes.trim() || null
        };

        try {
            // ── Abrir gaveta SOLO si el pago es en efectivo ───────────────────
            // Se abre ANTES de llamar onComplete para que el cajero pueda
            // entregar el vuelto mientras el sistema registra la venta.
            if (paymentMethod === 'efectivo') {
                try {
                    const drawerResult = await window.electronAPI.cashDrawer.open();
                    if (!drawerResult?.success) {
                        // La gaveta falló pero NO bloqueamos la venta.
                        // Solo logueamos para diagnóstico.
                        console.warn('[CashDrawer] No se pudo abrir:', drawerResult?.error);
                    }
                } catch (drawerErr) {
                    // Si falla la gaveta, igual completamos la venta
                    console.warn('[CashDrawer] Error al abrir gaveta:', drawerErr.message);
                }
            }

            await onComplete(paymentData);
        } catch (error) {
            console.error('Error processing payment:', error);
            alert(`❌ Error al procesar el pago:\n\n${error.message || 'Error desconocido'}`);
        }
    };

    const handlePaymentMethodChange = (method) => {
        setPaymentMethod(method);
        if (method !== 'efectivo') setCashReceived('');
    };

    const handleDocumentTypeChange = (type) => {
        setDocumentType(type);
        if (type === 'sin_documento') setDocumentNumber('');
    };

    const handleCashKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (documentType !== 'sin_documento') documentNumberRef.current?.focus();
            else handleSubmit(e);
        }
    };

    const handleClose = () => {
        if (isProcessing) return;
        document.body.style.overflow = '';
        onClose();
    };

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && !isProcessing) handleClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isProcessing, onClose]);

    const change = calculateChange();

    return (
        <div className="payment-modal-overlay" onClick={isProcessing ? null : handleClose}>
            <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                <div className="payment-modal-header">
                    <h2>💳 Procesar Pago</h2>
                    <button
                        className="modal-close"
                        onClick={handleClose}
                        disabled={isProcessing}
                        title={isProcessing ? 'Procesando...' : 'Cerrar (ESC)'}
                    >
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="payment-form">
                    {/* Total a Pagar */}
                    <div className="payment-total-display">
                        <span>Total a Pagar:</span>
                        <span className="payment-total-amount">${formatCurrency(total)}</span>
                    </div>

                    {/* Método de Pago */}
                    <div className="payment-section">
                        <label className="payment-label">
                            Método de Pago
                            {errors.paymentMethod && (
                                <span className="error-text"> - {errors.paymentMethod}</span>
                            )}
                        </label>
                        <div className="payment-methods">
                            {[
                                { id: 'efectivo',        icon: <FiDollarSign />, label: 'Efectivo 🪙' },
                                { id: 'tarjeta_debito',  icon: <FiCreditCard />, label: 'Débito' },
                                { id: 'tarjeta_credito', icon: <FiCreditCard />, label: 'Crédito' },
                                { id: 'transferencia',   icon: <FiCreditCard />, label: 'Transferencia' },
                            ].map(({ id, icon, label }) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`payment-method-btn ${paymentMethod === id ? 'active' : ''}`}
                                    onClick={() => handlePaymentMethodChange(id)}
                                    disabled={isProcessing}
                                >
                                    {icon}
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                        {/* Aviso visual cuando el pago es en efectivo */}
                        {paymentMethod === 'efectivo' && (
                            <p className="pm-drawer-hint">
                                🗄️ La gaveta de dinero se abrirá automáticamente al confirmar el pago.
                            </p>
                        )}
                    </div>

                    {/* Efectivo - Cálculo de vuelto */}
                    {paymentMethod === 'efectivo' && (
                        <div className="payment-section">
                            <Input
                                ref={cashInputRef}
                                label="Efectivo Recibido"
                                type="text"
                                value={cashReceived}
                                onChange={(e) => setCashReceived(formatThousands(e.target.value))}
                                onKeyDown={handleCashKeyDown}
                                placeholder="0"
                                inputMode="numeric"
                                required
                                autoFocus
                                disabled={isProcessing}
                                error={errors.cashReceived}
                                helperText={!errors.cashReceived ? 'Presiona Enter para continuar' : undefined}
                            />
                            {cashReceived && parseCash(cashReceived) >= total && (
                                <div className="change-display">
                                    <span>Vuelto:</span>
                                    <span className="change-amount">${formatCurrency(change)}</span>
                                </div>
                            )}
                            {cashReceived && parseCash(cashReceived) < total && (
                                <div className="change-display warning">
                                    <span>⚠️ Falta:</span>
                                    <span className="change-amount">${formatCurrency(total - parseCash(cashReceived))}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Documento Tributario */}
                    <div className="payment-section">
                        <label className="payment-label">
                            Documento Tributario
                            {errors.documentType && (
                                <span className="error-text"> - {errors.documentType}</span>
                            )}
                        </label>
                        <select
                            value={documentType}
                            onChange={(e) => handleDocumentTypeChange(e.target.value)}
                            className="payment-select"
                            disabled={isProcessing}
                        >
                             <option value="sin_documento">Sin Documento</option>
                            <option value="boleta_fisica">Boleta Física</option>
                            <option value="boleta_electronica">Boleta Electrónica</option>
                            <option value="factura_fisica">Factura Física</option>
                            <option value="factura_electronica">Factura Electrónica</option>
                           
                        </select>
                        <Input
                            ref={documentNumberRef}
                            label="Número de Documento"
                            type="text"
                            value={documentNumber}
                            onChange={(e) => setDocumentNumber(e.target.value)}
                            placeholder={documentType === 'sin_documento' ? 'No aplica' : 'Ej: 12345'}
                            required={documentType !== 'sin_documento'}
                            disabled={documentType === 'sin_documento' || isProcessing}
                            error={errors.documentNumber}
                            helperText={
                                documentType === 'sin_documento'
                                    ? 'No se requiere número de documento'
                                    : 'Número de boleta o factura emitida'
                            }
                        />
                    </div>

                    {/* Notas opcionales */}
                    <div className="payment-section">
                        <label className="payment-label">Notas (opcional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas adicionales sobre la venta..."
                            className="payment-textarea"
                            rows="3"
                            disabled={isProcessing}
                            maxLength={500}
                        />
                        <small className="char-counter">{notes.length}/500 caracteres</small>
                    </div>

                    {/* Botones */}
                    <div className="payment-actions">
                        <Button type="button" variant="secondary" onClick={handleClose} disabled={isProcessing}>
                            Cancelar (ESC)
                        </Button>
                        <Button type="submit" variant="success" loading={isProcessing} disabled={isProcessing} fullWidth>
                            {isProcessing ? 'Procesando...' : 'Completar Venta'}
                        </Button>
                    </div>

                    {isProcessing && (
                        <div className="processing-indicator">
                            <div className="spinner"></div>
                            <p>Procesando venta, por favor espera...</p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default PaymentModal;