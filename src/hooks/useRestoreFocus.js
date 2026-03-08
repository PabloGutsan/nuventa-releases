// src/hooks/useRestoreFocus.js
//
// PROBLEMA EN ELECTRON:
//   Cuando se cierra un modal, Electron a veces pierde el foco OS-level
//   de la ventana (especialmente si hubo un dialogo nativo open/save).
//   Esto hace que los inputs queden "sordos" al teclado aunque visualmente
//   parezcan normales.
//
// SOLUCIÓN:
//   1. Guardar el elemento activo antes de abrir el modal.
//   2. Al cerrar: pedir al main process que devuelva el foco OS-level.
//   3. Luego restaurar el foco al elemento guardado (o al body).
//   4. Si la ventana pierde el foco mientras el hook está montado,
//      reconectar automáticamente al recuperarlo.
//
// USO:
//   const { restoreFocus } = useRestoreFocus();        // manual
//   useRestoreFocus();                                  // automático al desmontar
//   useRestoreFocus(miInputRef);                        // restaura ref específico

import { useEffect, useRef, useCallback } from 'react';

// Contador global para evitar múltiples listeners simultáneos
let focusListenerCount = 0;

const useRestoreFocus = (targetRef = null) => {
    const savedElement  = useRef(null);
    const isMounted     = useRef(true);
    const restoreTimer  = useRef(null);

    // ── Guardar elemento activo al montar ────────────────────────────────────
    useEffect(() => {
        isMounted.current = true;
        savedElement.current = document.activeElement;

        return () => {
            isMounted.current = false;
            if (restoreTimer.current) clearTimeout(restoreTimer.current);
        };
    }, []);

    // ── Función de restauración ──────────────────────────────────────────────
    const restoreFocus = useCallback(async (customTarget = null) => {
        if (restoreTimer.current) clearTimeout(restoreTimer.current);

        // Paso 1: pedir al main process que recupere el foco OS-level
        try {
            if (window.electronAPI?.window?.refocus) {
                await window.electronAPI.window.refocus();
            }
        } catch(e) {
            console.warn('[useRestoreFocus] IPC refocus falló:', e);
        }

        // Paso 2: esperar a que Electron procese el foco y React termine de desmontar
        restoreTimer.current = setTimeout(() => {
            if (!isMounted.current && customTarget === null) {
                // El hook ya se desmontó sin customTarget: el caller maneja el foco
                return;
            }

            // Determinar el objetivo final
            const target =
                customTarget ||
                (targetRef?.current) ||
                savedElement.current;

            if (target && typeof target.focus === 'function' && document.contains(target)) {
                target.focus({ preventScroll: true });
            } else {
                // Fallback: body + window.focus() para soltar el "limbo"
                document.body.focus();
                window.focus();
            }
        }, 120); // 120ms: suficiente para que Electron libere el foco del dialogo
    }, [targetRef]);

    // ── Auto-restaurar al desmontar (comportamiento original mejorado) ───────
    useEffect(() => {
        return () => {
            restoreFocus();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Listener global: recuperar foco si la ventana lo pierde/recupera ────
    useEffect(() => {
        focusListenerCount++;
        const myCount = focusListenerCount;

        const handleWindowFocus = () => {
            // Solo el listener más reciente actúa, para no tener conflictos
            if (myCount !== focusListenerCount) return;
            // Si el body es el activo, redirigir al elemento guardado
            if (
                document.activeElement === document.body &&
                savedElement.current &&
                document.contains(savedElement.current)
            ) {
                savedElement.current.focus({ preventScroll: true });
            }
        };

        window.addEventListener('focus', handleWindowFocus);
        return () => {
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    return { restoreFocus };
};

export default useRestoreFocus;