// src/pages/POS/CashOpenModal.jsx
import React, { useState, useRef, useEffect } from 'react';
import { FiDollarSign, FiUser, FiCalendar, FiAlertCircle } from 'react-icons/fi';
import './CashOpenModal.css';
import useRestoreFocus from '../../hooks/useRestoreFocus'; // ← NUEVO

const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const CashOpenModal = ({ currentUser, onOpen, onCancel }) => {
    const [amount, setAmount]   = useState('');
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    useRestoreFocus(); // ← restaura el foco al elemento anterior al cerrarse

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 100);
    }, []);

    const handleAmountChange = (e) => {
        const raw = e.target.value.replace(/\D/g, '');
        setAmount(raw);
        if (error) setError('');
    };

    const handleOpen = async () => {
        const parsed = parseInt(amount) || 0;
        if (parsed < 0) { setError('El monto no puede ser negativo'); return; }
        setLoading(true);
        try {
            await onOpen({ openingAmount: parsed });
        } catch (err) {
            setError('Error al abrir la caja. Intenta de nuevo.');
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleOpen();
    };

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CL', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="co-overlay">
            <div className="co-modal">

                <div className="co-header">
                    <div className="co-header-icon"><FiDollarSign size={28} /></div>
                    <div>
                        <h2 className="co-title">Apertura de Caja</h2>
                        <p className="co-subtitle">Ingresa el efectivo inicial para comenzar el día</p>
                    </div>
                </div>

                <div className="co-info-row">
                    <div className="co-info-item">
                        <FiUser size={14} />
                        <span>{currentUser?.full_name || currentUser?.username}</span>
                    </div>
                    <div className="co-info-item">
                        <FiCalendar size={14} />
                        <span className="co-info-date">{dateStr} · {timeStr}</span>
                    </div>
                </div>

                <div className="co-field">
                    <label className="co-label">Efectivo inicial en caja</label>
                    <div className="co-input-wrap">
                        <span className="co-currency">$</span>
                        <input
                            ref={inputRef}
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={amount ? parseInt(amount).toLocaleString('es-CL') : ''}
                            onChange={handleAmountChange}
                            onKeyDown={handleKeyDown}
                            className={`co-input ${error ? 'error' : ''}`}
                        />
                        <span className="co-currency-label">CLP</span>
                    </div>
                    {amount && !error && (
                        <p className="co-amount-preview">{fmt(parseInt(amount) || 0)}</p>
                    )}
                    {error && (
                        <p className="co-error"><FiAlertCircle size={13} /> {error}</p>
                    )}
                    <p className="co-hint">
                        Puedes ingresar 0 si la caja comienza vacía. Este valor quedará registrado.
                    </p>
                </div>

                <div className="co-actions">
                    {onCancel && (
                        <button className="co-btn-cancel" onClick={onCancel} disabled={loading}>
                            Cancelar
                        </button>
                    )}
                    <button className="co-btn-open" onClick={handleOpen} disabled={loading}>
                        {loading ? <span className="co-spinner" /> : 'Abrir Caja'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CashOpenModal;