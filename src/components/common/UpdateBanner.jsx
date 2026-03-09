// src/components/common/UpdateBanner.jsx
import React, { useState, useEffect } from 'react';
import './UpdateBanner.css';

const UpdateBanner = () => {
    const [state, setState]           = useState('idle'); // idle | available | downloading | ready
    const [updateInfo, setUpdateInfo] = useState(null);
    const [progress, setProgress]     = useState(0);
    const [dismissed, setDismissed]   = useState(false);
    const [showConfirm, setShowConfirm] = useState(false); // diálogo ¿instalar ahora?

    useEffect(() => {
        if (!window.electronAPI?.update) return;

        const offAvailable = window.electronAPI.update.onAvailable((info) => {
            console.log('[UpdateBanner] Actualización disponible:', info);
            setUpdateInfo(info);
            setState('available');
            setDismissed(false);
        });

        const offProgress = window.electronAPI.update.onProgress((data) => {
            setProgress(data.percent || 0);
            setState('downloading');
        });

        const offDownloaded = window.electronAPI.update.onDownloaded((data) => {
            console.log('[UpdateBanner] Lista para instalar:', data.version);
            setUpdateInfo(prev => ({ ...prev, ...data }));
            setState('ready');
            setProgress(100);
            // Mostrar diálogo de confirmación automáticamente al terminar
            setShowConfirm(true);
        });

        return () => {
            offAvailable?.();
            offProgress?.();
            offDownloaded?.();
        };
    }, []);

    const handleInstallNow = async () => {
        try {
            setShowConfirm(false);
            await window.electronAPI.update.installNow();
        } catch (err) {
            console.error('[UpdateBanner] Error instalando:', err);
        }
    };

    const handleLater = () => {
        setShowConfirm(false);
        // El banner sigue visible para que puedan instalar después
    };

    const isObligatory = updateInfo?.isObligatory;
    const version = updateInfo?.version || updateInfo?.latestVersion;

    // ── Diálogo de confirmación ───────────────────────────────────────────────
    if (showConfirm) {
        return (
            <div className="ub-overlay">
                <div className="ub-confirm-dialog">
                    <div className="ub-confirm-icon">🚀</div>
                    <h3 className="ub-confirm-title">
                        Nuventa v{version} lista para instalar
                    </h3>
                    <p className="ub-confirm-text">
                        La actualización se descargó correctamente.
                        {isObligatory
                            ? ' Esta actualización es obligatoria.'
                            : ' Puedes instalarla ahora o más tarde al cerrar la app.'}
                    </p>
                    {updateInfo?.releaseNotes && (
                        <p className="ub-confirm-notes">{updateInfo.releaseNotes}</p>
                    )}
                    <div className="ub-confirm-actions">
                        <button className="ub-confirm-btn ub-confirm-btn--primary" onClick={handleInstallNow}>
                            Instalar ahora
                        </button>
                        {!isObligatory && (
                            <button className="ub-confirm-btn ub-confirm-btn--secondary" onClick={handleLater}>
                                Más tarde
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (state === 'idle' || dismissed) return null;

    // ── Banner discreto (available / downloading / ready) ────────────────────
    return (
        <div className={`ub-banner${isObligatory ? ' ub-banner--obligatory' : ''} ub-banner--${state}`}>
            <div className="ub-content">

                <div className="ub-icon">
                    {state === 'downloading' ? '⬇️' :
                     state === 'ready'       ? '✅' :
                     isObligatory            ? '🔴' : '🔔'}
                </div>

                <div className="ub-text">
                    {state === 'available' && (
                        <>
                            <span className="ub-title">
                                {isObligatory
                                    ? `Actualización requerida v${version}`
                                    : `Nueva versión v${version} — descargando...`}
                            </span>
                            {updateInfo?.releaseNotes && (
                                <span className="ub-notes">{updateInfo.releaseNotes}</span>
                            )}
                        </>
                    )}
                    {state === 'downloading' && (
                        <>
                            <span className="ub-title">Descargando v{version}...</span>
                            <div className="ub-progress-bar">
                                <div className="ub-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="ub-notes">{Math.round(progress)}% completado</span>
                        </>
                    )}
                    {state === 'ready' && (
                        <>
                            <span className="ub-title">v{version} lista para instalar</span>
                            <span className="ub-notes">
                                Se instalará al cerrar la app, o instala ahora.
                            </span>
                        </>
                    )}
                </div>

                <div className="ub-actions">
                    {state === 'ready' && (
                        <button className="ub-btn ub-btn--install" onClick={() => setShowConfirm(true)}>
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