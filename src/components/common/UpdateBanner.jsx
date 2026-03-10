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

    const [state, setState]             = useState('idle'); // idle | confirm | downloading | ready
    const [updateInfo, setUpdateInfo]   = useState(null);
    const [progress, setProgress]       = useState(0);
    const [dismissed, setDismissed]     = useState(() => wasDismissedToday());

    useEffect(() => {
        if (!window.electronAPI?.update || !isAdmin) return;

        // Esperar 2s para que los listeners estén registrados, luego consultar pending
        setTimeout(() => {
            window.electronAPI.invoke('update:get-pending').then((pending) => {
                if (pending && !wasDismissedToday()) {
                    setUpdateInfo(pending);
                    setState('confirm');
                }
            }).catch(() => {});
        }, 2000);

        const offAvailable = window.electronAPI.update.onAvailable((info) => {
            console.log('[UpdateBanner] Actualización disponible:', info);
            if (wasDismissedToday()) return;
            setUpdateInfo(info);
            setState('confirm');
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
        });

        return () => {
            offAvailable?.();
            offProgress?.();
            offDownloaded?.();
        };
    }, [isAdmin]);

    const handleDownload = async () => {
        setState('downloading');
        try {
            await window.electronAPI.invoke('update:start-download');
        } catch (err) {
            console.error('[UpdateBanner] Error iniciando descarga:', err);
        }
    };

    const handleInstallNow = async () => {
        try {
            await window.electronAPI.update.installNow();
        } catch (err) {
            console.error('[UpdateBanner] Error instalando:', err);
        }
    };

    const handleLater = () => {
        setDismissed(true);
        dismissUntilTomorrow();
        setState('idle');
    };

    if (!isAdmin || dismissed || state === 'idle') return null;

    const isObligatory = updateInfo?.isObligatory;
    const version = updateInfo?.version || updateInfo?.latestVersion;

    // ── Diálogo de confirmación — ¿Descargar? ────────────────────────────────
    if (state === 'confirm') {
        return (
            <div className="ub-overlay">
                <div className="ub-confirm-dialog">
                    <div className="ub-confirm-icon">🔔</div>
                    <h3 className="ub-confirm-title">
                        Nueva versión v{version} disponible
                    </h3>
                    <p className="ub-confirm-text">
                        Hay una actualización disponible para Nuventa.
                        {isObligatory
                            ? ' Esta actualización es obligatoria.'
                            : ' Puedes descargarla ahora o más tarde.'}
                    </p>
                    {updateInfo?.releaseNotes && (
                        <p className="ub-confirm-notes">{updateInfo.releaseNotes}</p>
                    )}
                    <div className="ub-confirm-actions">
                        <button className="ub-confirm-btn ub-confirm-btn--primary" onClick={handleDownload}>
                            Descargar ahora
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

    // ── Diálogo de instalación — ¿Instalar? ──────────────────────────────────
    if (state === 'ready') {
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

    // ── Banner de descarga en progreso ────────────────────────────────────────
    if (state === 'downloading') {
        return (
            <div className="ub-banner ub-banner--downloading">
                <div className="ub-content">
                    <div className="ub-icon">⬇️</div>
                    <div className="ub-text">
                        <span className="ub-title">Descargando v{version}...</span>
                        <div className="ub-progress-bar">
                            <div className="ub-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="ub-notes">{Math.round(progress)}% completado</span>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default UpdateBanner;