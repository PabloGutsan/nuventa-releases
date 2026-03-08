// public/licenseManager.js
const si = require('systeminformation');
const crypto = require('crypto');
const axios = require('axios');
const Store = require('electron-store');

// const API_URL = 'https://francina-forensic-inflatedly.ngrok-free.dev'; // dev
const API_URL = 'https://api.nuventa.cl'; // producción

const store = new Store({
    name: 'nuventa-license',
    encryptionKey: 'nv_local_k8x2p_mQ9rL_wZ4hY7'
});

// ============================================================================
// GENERAR FINGERPRINT DE HARDWARE
// ============================================================================
async function generateFingerprint() {
    try {
        const [cpu, system, networkInterfaces] = await Promise.all([
            si.cpu(),
            si.system(),
            si.networkInterfaces()
        ]);

        const realInterface = Array.isArray(networkInterfaces)
            ? networkInterfaces.find(n => !n.virtual && n.mac && n.mac !== '00:00:00:00:00:00')
            : null;

        const cpuId   = cpu.brand || 'unknown-cpu';
        const moboId  = system.serial || system.uuid || 'unknown-mobo';
        const macAddr = realInterface ? realInterface.mac : 'unknown-mac';

        const raw = `${cpuId}:${moboId}:${macAddr}`;
        const fingerprint = crypto.createHash('sha256').update(raw).digest('hex');
        const label = `${process.platform}-${cpu.brand?.split(' ')[0] || 'PC'}`;

        console.log('[License] Fingerprint generado:', fingerprint.substring(0, 16) + '...');
        return { fingerprint, label };

    } catch (error) {
        console.error('[License] Error generando fingerprint:', error);
        const os = require('os');
        const fallback = `${os.hostname()}:${process.platform}:fallback`;
        return {
            fingerprint: crypto.createHash('sha256').update(fallback).digest('hex'),
            label: `${process.platform}-fallback`
        };
    }
}

// ============================================================================
// VERIFICAR LICENCIA AL ARRANCAR
//
// Reglas:
//   1. Sin licencia local → pedir activación
//   2. Sin internet       → usar licencia local (funciona siempre offline)
//   3. Servidor responde OK válido    → dejar entrar, actualizar datos locales
//   4. Servidor responde INVALID_DEVICE → bloquear (licencia en otro equipo)
//   5. Servidor responde error 4xx/5xx  → usar licencia local (servidor con problemas)
//   6. Servidor no existe / timeout / DNS fail → usar licencia local
//      (cubre el caso de empresa cerrada o API eliminada)
// ============================================================================
async function checkLicense() {
    const license = store.get('license');

    if (!license || !license.isActive) {
        console.log('[License] Sin licencia activa guardada.');
        return { hasLicense: false };
    }

    console.log('[License] Licencia local encontrada:', license.key?.substring(0, 12) + '...');

    // Intentar verificar con el servidor
    try {
        const { fingerprint } = await generateFingerprint();

        const response = await axios.post(
            `${API_URL}/api/licenses/verify`,
            { licenseKey: license.key, fingerprint },
            { timeout: 8000 }
        );

        const data = response.data;
        console.log('[License] Verificación servidor:', JSON.stringify(data));

        if (data.valid) {
            // Servidor confirma → actualizar datos locales
            store.set('license', {
                ...license,
                businessName: data.businessName || license.businessName,
                supportUntil: data.supportUntil || license.supportUntil,
                isActive: true
            });

            return {
                hasLicense: true,
                isActive: true,
                offline: false,
                key: license.key,
                email: license.email,
                businessName: data.businessName || license.businessName,
                supportUntil: data.supportUntil || license.supportUntil,
                activatedAt: license.activatedAt
            };
        }

        // El servidor respondió pero dice que es inválida
        // Solo bloqueamos en caso INVALID_DEVICE (licencia copiada a otro equipo)
        // Para cualquier otro motivo (INACTIVE, NOT_FOUND) dejamos pasar — puede
        // ser un error de datos en el servidor, no abuso del usuario
        if (data.reason === 'INVALID_DEVICE') {
            console.warn('[License] INVALID_DEVICE — licencia en otro equipo. Bloqueando.');
            store.delete('license');
            return {
                hasLicense: false,
                blocked: true,
                reason: 'INVALID_DEVICE',
                message: 'Esta licencia está registrada en otro equipo.\nIngresa a nuventa.cl/mi-cuenta para transferirla.'
            };
        }

        // Cualquier otro reason → dejar pasar con licencia local
        console.warn('[License] Servidor devolvió valid:false con reason:', data.reason, '— usando licencia local.');
        return _localLicense(license);

    } catch (error) {
        // ── Sin internet, timeout, DNS fail, servidor caído o inexistente ──
        // En todos estos casos el usuario conserva su licencia local.
        // Esto cubre intencionalmente el caso en que la empresa cierre
        // o el servidor ya no exista — el cliente no pierde su software.
        const isNetworkError = (
            error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||     // DNS no existe → API eliminada
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNABORTED' ||
            error.code === 'ERR_NETWORK' ||
            !error.response                    // cualquier error sin respuesta HTTP
        );

        if (isNetworkError) {
            console.log('[License] Servidor no disponible (', error.code, ') — usando licencia local.');
        } else {
            // Error HTTP 5xx del servidor → igual dejamos pasar
            console.warn('[License] Error del servidor (', error.response?.status, ') — usando licencia local.');
        }

        return _localLicense(license);
    }
}

// Helper interno
function _localLicense(license) {
    return {
        hasLicense: true,
        isActive: true,
        offline: true,
        key: license.key,
        email: license.email,
        businessName: license.businessName,
        supportUntil: license.supportUntil,
        activatedAt: license.activatedAt
    };
}

// Alias para compatibilidad
function checkLocalLicense() {
    const license = store.get('license');
    if (!license || !license.isActive) return { hasLicense: false };
    return _localLicense(license);
}

// ============================================================================
// ACTIVAR LICENCIA (primera vez — requiere internet)
// ============================================================================
async function activateLicense(licenseKey, email, businessName) {
    try {
        console.log('[License] Iniciando activación para:', licenseKey);

        const { fingerprint, label } = await generateFingerprint();

        const response = await axios.post(
            `${API_URL}/api/licenses/activate`,
            {
                licenseKey,
                email,
                businessName: businessName || undefined,
                fingerprint,
                machineLabel: label
            },
            { timeout: 15000 }
        );

        const data = response.data;
        console.log('[License] Respuesta del servidor:', JSON.stringify(data));

        if (data.success) {
            store.set('license', {
                key: licenseKey,
                fingerprint,
                label,
                email,
                businessName: data.businessName,
                supportUntil: data.supportUntil,
                activatedAt: new Date().toISOString(),
                isActive: true
            });

            console.log('[License] Activación exitosa para:', data.businessName);
            return { success: true, data };
        } else {
            return { success: false, error: data.message || 'Error al activar la licencia' };
        }

    } catch (error) {
        console.error('[License] Error en activación:', error.message);

        if (!error.response) {
            return {
                success: false,
                error: 'Sin conexión a internet. La activación inicial requiere internet.',
                noInternet: true
            };
        }

        const serverError = error.response.data;
        console.error('[License] Error del servidor:', error.response.status, JSON.stringify(serverError));
        return { success: false, error: serverError?.error || serverError?.message || 'Error del servidor' };
    }
}

// ============================================================================
// CHEQUEAR ACTUALIZACIÓN DISPONIBLE
// ============================================================================
async function checkForUpdate(currentVersion) {
    try {
        const response = await axios.get(`${API_URL}/api/version/latest`, { timeout: 8000 });
        const data = response.data;

        if (!data || !data.version) return { hasUpdate: false };

        const latest = data.version;
        const hasUpdate = compareVersions(latest, currentVersion) > 0;

        if (hasUpdate) {
            console.log(`[Update] Nueva versión disponible: ${latest} (actual: ${currentVersion})`);
        }

        const platform = process.platform;
        const downloadUrl = platform === 'win32' ? data.urlWindows
            : platform === 'darwin'              ? data.urlMac
            : data.urlLinux;

        return {
            hasUpdate,
            latestVersion: latest,
            currentVersion,
            isObligatory: data.obligatoria || false,
            releaseNotes: data.notasGenerales || '',
            downloadUrl: downloadUrl || null
        };

    } catch (error) {
        console.log('[Update] No se pudo verificar actualizaciones:', error.message);
        return { hasUpdate: false };
    }
}

// ============================================================================
// HELPERS
// ============================================================================
function compareVersions(a, b) {
    const partsA = String(a).split('.').map(Number);
    const partsB = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (partsA[i] || 0) - (partsB[i] || 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
}

function clearLocalLicense() {
    store.delete('license');
    console.log('[License] Licencia local eliminada.');
}

module.exports = {
    activateLicense,
    checkLicense,
    checkLocalLicense,
    checkForUpdate,
    generateFingerprint,
    clearLocalLicense
};