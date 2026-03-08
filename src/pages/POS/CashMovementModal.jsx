// src/pages/POS/CashMovementModal.jsx
import React, { useState, useRef, useEffect } from 'react';
import { FiArrowDownCircle, FiArrowUpCircle, FiX, FiAlertCircle } from 'react-icons/fi';
import './CashMovementModal.css';
import useRestoreFocus from '../../hooks/useRestoreFocus';

const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const REASONS_IN  = ['Fondo para vuelto', 'Depósito de efectivo', 'Otro ingreso'];
const REASONS_OUT = ['Pago a proveedor', 'Gastos menores', 'Retiro de efectivo', 'Otro egreso'];

// initialType: 'in' | 'out' — determina qué pestaña se abre primero
const CashMovementModal = ({ onAdd, onClose, initialType = 'in' }) => {
    const [type,         setType]         = useState(initialType); // ← usa el prop
    const [amount,       setAmount]       = useState('');
    const [reason,       setReason]       = useState('');
    const [customReason, setCustomReason] = useState('');
    const [error,        setError]        = useState('');
    const [loading,      setLoading]      = useState(false);
    const amountRef = useRef(null);

    useRestoreFocus();

    useEffect(() => {
        setTimeout(() => amountRef.current?.focus(), 100);
    }, []);

    const handleAmountChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setAmount(raw);
        if (error) setError('');
    };

    const handleReasonChange = (e) => {
        setReason(e.target.value);
        setCustomReason('');
        if (error) setError('');
    };

    const handleTypeChange = (newType) => {
        setType(newType);
        setReason('');      // limpiar motivo al cambiar tipo
        setError('');
    };

    const finalReason = reason === 'Otro ingreso' || reason === 'Otro egreso'
        ? customReason.trim()
        : reason;

    const handleSubmit = async () => {
        const parsed = parseInt(amount) || 0;
        if (parsed <= 0) { setError('Ingresa un monto válido mayor a 0'); return; }
        if (!finalReason) { setError('Selecciona o escribe un motivo'); return; }

        setLoading(true);
        try {
            await onAdd({ type, amount: parsed, reason: finalReason });
            onClose();
        } catch {
            setError('Error al registrar el movimiento');
            setLoading(false);
        }
    };

    const reasons = type === 'in' ? REASONS_IN : REASONS_OUT;
    const isOther = reason === 'Otro ingreso' || reason === 'Otro egreso';

    return (
        <div className="cm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="cm-modal">

                {/* Header */}
                <div className="cm-header">
                    <h2 className="cm-title">Movimiento de Efectivo</h2>
                    <button className="cm-close" onClick={onClose}>
                        <FiX size={18} />
                    </button>
                </div>

                {/* Tipo */}
                <div className="cm-type-toggle">
                    <button
                        className={`cm-type-btn cm-type-in ${type === 'in' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('in')}
                    >
                        <FiArrowDownCircle size={18} /> Ingreso de efectivo
                    </button>
                    <button
                        className={`cm-type-btn cm-type-out ${type === 'out' ? 'active' : ''}`}
                        onClick={() => handleTypeChange('out')}
                    >
                        <FiArrowUpCircle size={18} /> Egreso de efectivo
                    </button>
                </div>

                {/* Monto */}
                <div className="cm-field">
                    <label className="cm-label">Monto</label>
                    <div className={`cm-input-wrap ${type}`}>
                        <span className="cm-currency">$</span>
                        <input
                            ref={amountRef}
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={amount ? parseInt(amount).toLocaleString('es-CL') : ''}
                            onChange={handleAmountChange}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            className="cm-input"
                        />
                        <span className="cm-currency-label">CLP</span>
                    </div>
                    {amount && (
                        <p className={`cm-preview ${type}`}>{fmt(parseInt(amount) || 0)}</p>
                    )}
                </div>

                {/* Motivo */}
                <div className="cm-field">
                    <label className="cm-label">Motivo</label>
                    <div className="cm-reasons">
                        {reasons.map(r => (
                            <button
                                key={r}
                                className={`cm-reason-btn ${reason === r ? 'active' : ''}`}
                                onClick={() => handleReasonChange({ target: { value: r } })}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    {isOther && (
                        <input
                            type="text"
                            placeholder="Describe el motivo..."
                            value={customReason}
                            onChange={(e) => { setCustomReason(e.target.value); if(error) setError(''); }}
                            className="cm-custom-reason"
                            autoFocus
                        />
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="cm-error">
                        <FiAlertCircle size={14} /> {error}
                    </div>
                )}

                {/* Acciones */}
                <div className="cm-actions">
                    <button className="cm-btn-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button
                        className={`cm-btn-submit ${type}`}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? <span className="cm-spinner" /> : (
                            <>
                                {type === 'in'
                                    ? <FiArrowDownCircle size={16} />
                                    : <FiArrowUpCircle  size={16} />}
                                {type === 'in' ? 'Registrar Ingreso' : 'Registrar Egreso'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashMovementModal;