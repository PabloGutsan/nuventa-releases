// src/hooks/useCashDrawer.js
// ─────────────────────────────────────────────────────────────────────────────
// Hook para abrir la gaveta de dinero desde cualquier componente React.
//
// Uso:
//   const { openDrawer } = useCashDrawer();
//   await openDrawer();          // solo si el pago es en efectivo
//
// La función openDrawer():
//   - Solo actúa si el método de pago es efectivo (o 'multiple' con efectivo)
//   - Lee la impresora configurada en system_settings (cash_drawer_printer)
//   - Falla silenciosamente si no hay gaveta conectada (log en consola)
// ─────────────────────────────────────────────────────────────────────────────

const useCashDrawer = () => {

    /**
     * Abre la gaveta de dinero.
     * @param {string} paymentMethod - 'efectivo' | 'tarjeta_debito' | etc.
     * @param {string} [printerName] - Opcional: forzar una impresora específica.
     */
    const openDrawer = async (paymentMethod = 'efectivo', printerName = null) => {
        // Solo abrir si el pago involucra efectivo
        const needsDrawer = paymentMethod === 'efectivo' || paymentMethod === 'multiple';
        if (!needsDrawer) return;

        // Verificar que la API está disponible (entorno Electron)
        if (!window.electronAPI?.cashDrawer?.open) {
            console.warn('[CashDrawer] API no disponible (¿entorno web?)');
            return;
        }

        try {
            const result = await window.electronAPI.cashDrawer.open(printerName);
            if (result?.success) {
                console.log('[CashDrawer] ✅ Gaveta abierta');
            } else {
                console.warn('[CashDrawer] ⚠️ No se pudo abrir:', result?.error);
            }
        } catch (error) {
            // Falla silenciosamente — no interrumpir el flujo de venta
            console.error('[CashDrawer] Error:', error.message);
        }
    };

    return { openDrawer };
};

export default useCashDrawer;