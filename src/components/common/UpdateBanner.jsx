// src/components/common/UpdateBanner.jsx
import React, { useState, useEffect } from 'react';
import './UpdateBanner.css';

const UpdateBanner = () => {
    const [state, setState] = useState('idle'); // idle | available | downloading | ready
    const [updateInfo, setUpdateInfo] = useState(null);
    const [progress, setProgress] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!window.electronAPI) return;

        // ── Actualización disponible → descarga automática en curso ──────────
        const offAvailable = window.electronAPI.onUpdateAvailable?.((info) => {
            console.log('[UpdateBanner] Actualización disponible:', info);
            setUpdateInfo(info);
            setState('available');
            setDismissed(false);
        });

        // ── Progreso de descarga ──────────────────────────────────────────────
        const offProgress = window.electronAPI.onUpdateProgress?.((data) => {
            setProgress(data.percent || 0);
            setState('downloading');
        });

        // ── Descarga completada → listo para instalar ─────────────────────────
        const offDownloaded = window.electronAPI.onUpdateDownloaded?.((data) => {
            console.log('[UpdateBanner] Lista para instalar:', data.version);
            setUpdateInfo(prev => ({ ...prev, ...data }));
            setState('ready');
            setProgress(100);
        });

        return () => {
            offAvailable?.();
            offProgress?.();
            offDownloaded?.();
        };
    }, []);

    const handleInstallNow = async () => {
        try {
            await window.electronAPI.invoke('update:install-now');
        } catch (err) {
            console.error('[UpdateBanner] Error instalando:', err);
        }
    };

    if (state === 'idle' || dismissed) return null;

    const isObligatory = updateInfo?.isObligatory;

    return (
        <div className={`ub-banner ${isObligatory ? 'ub-banner--obligatory' : ''} ub-banner--${state}`}>
            <div className="ub-content">

                {/* Ícono */}
                <div className="ub-icon">
                    {state === 'downloading' ? '⬇️' :
                     state === 'ready'       ? '✅' :
                     isObligatory            ? '🔴' : '🔔'}
                </div>

                {/* Texto */}
                <div className="ub-text">
                    {state === 'available' && (
                        <>
                            <span className="ub-title">
                                {isObligatory
                                    ? `Actualización requerida v${updateInfo?.latestVersion}`
                                    : `Nueva versión v${updateInfo?.latestVersion} — descargando...`}
                            </span>
                            {updateInfo?.releaseNotes && (
                                <span className="ub-notes">{updateInfo.releaseNotes}</span>
                            )}
                        </>
                    )}
                    {state === 'downloading' && (
                        <>
                            <span className="ub-title">Descargando v{updateInfo?.latestVersion}...</span>
                            <div className="ub-progress-bar">
                                <div className="ub-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="ub-notes">{progress}% completado</span>
                        </>
                    )}
                    {state === 'ready' && (
                        <>
                            <span className="ub-title">
                                v{updateInfo?.version || updateInfo?.latestVersion} lista para instalar
                            </span>
                            <span className="ub-notes">
                                Se instalará automáticamente al cerrar la app, o instala ahora.
                            </span>
                        </>
                    )}
                </div>

                {/* Acciones */}
                <div className="ub-actions">
                    {state === 'ready' && (
                        <button className="ub-btn ub-btn--install" onClick={handleInstallNow}>
                            Instalar ahora
                        </button>
                    )}
                    {!isObligatory && state !== 'downloading' && (
                        <button
                            className="ub-btn ub-btn--dismiss"
                            onClick={() => setDismissed(true)}
                            title="Recordar más tarde"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {isObligatory && (
                <div className="ub-obligatory-msg">
                    ⚠ Esta actualización es requerida. Por favor instálala para continuar usando el sistema.
                </div>
            )}
        </div>
    );
};

export default UpdateBanner;