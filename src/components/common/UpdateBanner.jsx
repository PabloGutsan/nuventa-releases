// src/components/common/UpdateBanner.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import './UpdateBanner.css';

const DISMISS_KEY = 'nuventa_update_dismissed_until';

function wasDismissedToday() {
    try {
        const until = localStorage.getItem(DISMISS_KEY);
        if (!until) return false;
        return new Date() < new Date(until);
    } catch {
        return false;
    }
}

function dismissUntilTomorrow() {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        localStorage.setItem(DISMISS_KEY, tomorrow.toISOString());
    } catch {}
}

const UpdateBanner = () => {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'admin';

    const [state, setState]             = useState('idle');
    const [updateInfo, setUpdateInfo]   = useState(null);
    const [progress, setProgress]       = useState(0);
    const [dismissed, setDismissed]     = useState(() => wasDismissedToday());
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        if (!window.electronAPI?.update || !isAdmin) return;

        // Pedir si hay actualización pendiente que llegó antes de que React montara
        window.electronAPI.invoke('update:get-pending').then((pending) => {
            if (pending && !wasDismissedToday()) {
                setUpdateInfo(pending);
                setState('available');
            }
        }).catch(() => {});

        const offAvailable = window.electronAPI.update.onAvailable((info) => {
            console.log('[UpdateBanner] Actualización disponible:', info);
            if (wasDismissedToday()) return;
            setUpdateInfo(info);
            setState('available');
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
            setShowConfirm(true);
            setDismissed(false); // Siempre mostrar cuando está lista para instalar
        });

        return () => {
            offAvailable?.();
            offProgress?.();
            offDownloaded?.();
        };
    }, [isAdmin]);

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
        setDismissed(true);
        dismissUntilTomorrow();
    };

    const handleDismiss = () => {
        setDismissed(true);
        dismissUntilTomorrow();
    };

    if (!isAdmin) return null;

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

    // ── Banner discreto ───────────────────────────────────────────────────────
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
                            onClick={handleDismiss}
                            title="Recordar mañana"
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