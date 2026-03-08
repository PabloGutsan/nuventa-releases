// src/hooks/useCashRegister.js
// Hook que encapsula toda la lógica del sistema de caja
// CAJA PERSONAL: cada usuario solo ve y opera su propia caja abierta.
// Otros usuarios pueden iniciar/cerrar sesión sin afectar la caja ajena.

import { useState, useEffect, useCallback } from 'react';
import CashRegisterRepository from '../services/repositories/cashRegisterRepository';

const useCashRegister = ({ currentUser }) => {
    const [register,       setRegister]       = useState(null);
    const [expectedCash,   setExpectedCash]   = useState(0);
    const [salesSummary,   setSalesSummary]   = useState({ byPayment: [], total: 0, count: 0 });
    const [salesDetail,    setSalesDetail]    = useState([]);
    const [movements,      setMovements]      = useState([]);
    const [loading,        setLoading]        = useState(true);

    // ── Modales ──────────────────────────────────────────────────────────────
    const [showOpenModal,     setShowOpenModal]     = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [showCloseModal,    setShowCloseModal]    = useState(false);
    const [movementType,      setMovementType]      = useState('in');

    const repo = new CashRegisterRepository();

    // ── Cargar caja del usuario actual (no cualquier caja abierta) ────────────
    const loadRegister = useCallback(async () => {
        if (!currentUser?.id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            // CAJA PERSONAL: buscar caja abierta cuyo opened_by sea el usuario actual
            const open = await repo.getOpenRegisterByUser(currentUser.id);
            setRegister(open);
            if (open) {
                await loadCashData(open.id);
            }
        } catch (err) {
            console.error('Error cargando caja:', err);
        } finally {
            setLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        loadRegister();
    }, [loadRegister]);

    const loadCashData = async (registerId) => {
        try {
            const [exp, summary, detail, movs] = await Promise.all([
                repo.calculateExpectedCash(registerId),
                repo.getSalesSummary(registerId),
                repo.getSalesDetail(registerId),
                repo.getMovements(registerId),
            ]);
            setExpectedCash(exp);
            setSalesSummary(summary);
            setSalesDetail(detail);
            setMovements(movs);
        } catch (err) {
            console.error('Error cargando datos de caja:', err);
        }
    };

    // ── Abrir caja ────────────────────────────────────────────────────────────
    const handleOpen = async ({ openingAmount }) => {
        const id = await repo.openRegister({
            userId: currentUser?.id,
            openingAmount,
        });
        // Recargar usando la query filtrada por usuario
        const open = await repo.getOpenRegisterByUser(currentUser.id);
        setRegister(open);
        setShowOpenModal(false);
        await loadCashData(id);
    };

    // ── Agregar movimiento ────────────────────────────────────────────────────
    const handleAddMovement = async ({ type, amount, reason }) => {
        if (!register) return;
        await repo.addMovement({
            registerId: register.id,
            userId:     currentUser?.id,
            type, amount, reason,
        });
        await loadCashData(register.id);
    };

    // ── Cerrar caja ───────────────────────────────────────────────────────────
    const handleClose = async ({ closingAmount, expectedCash: exp, notes }) => {
        if (!register) return;
        await repo.closeRegister({
            registerId:    register.id,
            userId:        currentUser?.id,
            closingAmount,
            expectedCash:  exp,
            notes,
        });
        setRegister(null);
        setMovements([]);
        setSalesSummary({ byPayment: [], total: 0, count: 0 });
        setSalesDetail([]);
        setExpectedCash(0);
    };

    // ── Preparar cierre ───────────────────────────────────────────────────────
    const prepareClose = async () => {
        if (register) {
            await loadCashData(register.id);
        }
        setShowCloseModal(true);
    };

    // ── Abrir modal de movimiento ─────────────────────────────────────────────
    const openMovementModal = (type = 'in') => {
        setMovementType(type);
        setShowMovementModal(true);
    };

    return {
        register,
        expectedCash,
        salesSummary,
        salesDetail,
        movements,
        loading,
        showOpenModal,
        showMovementModal,
        showCloseModal,
        movementType,
        setShowOpenModal,
        setShowMovementModal,
        setShowCloseModal,
        handleOpen,
        handleAddMovement,
        handleClose,
        prepareClose,
        openMovementModal,
        loadCashData,
    };
};

export default useCashRegister;