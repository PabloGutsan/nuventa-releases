// public/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    // ── Información de la aplicación ────────────────────────────────────────
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // ── Invoke genérico (necesario para T&C, updates y cualquier canal) ─────
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

    // ── Utilidades ──────────────────────────────────────────────────────────
    platform: process.platform,

    // ── Base de datos ───────────────────────────────────────────────────────
    database: {
        save:        (data)        => ipcRenderer.invoke('db-save', data),
        load:        ()            => ipcRenderer.invoke('db-load'),
        query:       (sql, params) => ipcRenderer.invoke('db-query', sql, params),
        run:         (sql, params) => ipcRenderer.invoke('db-run',   sql, params),
        get:         (sql, params) => ipcRenderer.invoke('db-get',   sql, params),
        transaction: (ops)         => ipcRenderer.invoke('db-transaction', ops)
    },

    // ── Archivos ─────────────────────────────────────────────────────────────
    files: {
        save:         (data, defaultPath) => ipcRenderer.invoke('save-file',     data, defaultPath),
        selectFolder: ()                  => ipcRenderer.invoke('select-folder'),
        read:         (filePath)          => ipcRenderer.invoke('read-file',     filePath)
    },

    // ── Exportación ──────────────────────────────────────────────────────────
    export: {
        toExcel: (data, filename) => ipcRenderer.invoke('export-excel', data, filename),
        toPDF:   (data, filename) => ipcRenderer.invoke('export-pdf',   data, filename)
    },

    // ── Backup ───────────────────────────────────────────────────────────────
    backup: {
        create:  () => ipcRenderer.invoke('create-backup'),
        restore: () => ipcRenderer.invoke('restore-backup')
    },

    // ── Licencia Nuventa ──────────────────────────────────────────────────────
    license: {
        check:    ()                                => ipcRenderer.invoke('license:check'),
        activate: (licenseKey, email, businessName) => ipcRenderer.invoke('license:activate', licenseKey, email, businessName),
        clear:    ()                                => ipcRenderer.invoke('license:clear')
    },

    // ── Actualizaciones (electron-updater) ────────────────────────────────────
    // onAvailable   → descarga iniciada automáticamente en segundo plano
    // onProgress    → progreso de descarga (0-100%)
    // onDownloaded  → listo para instalar
    update: {
        check: () => ipcRenderer.invoke('update:check'),

        onAvailable: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('update:available', handler);
            return () => ipcRenderer.removeListener('update:available', handler);
        },

        onProgress: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('update:progress', handler);
            return () => ipcRenderer.removeListener('update:progress', handler);
        },

        onDownloaded: (callback) => {
            const handler = (_, data) => callback(data);
            ipcRenderer.on('update:downloaded', handler);
            return () => ipcRenderer.removeListener('update:downloaded', handler);
        },

        installNow: () => ipcRenderer.invoke('update:install-now'),

        // Compatibilidad con versión anterior del UpdateBanner
        openExternal: (url) => ipcRenderer.invoke('app:openExternal', url)
    },

    // ── Autenticación local ───────────────────────────────────────────────────
    auth: {
        hashPassword: (password) => ipcRenderer.invoke('auth:hashPassword', password)
    },

    // ── Foco de ventana ───────────────────────────────────────────────────────
    window: {
        refocus: () => ipcRenderer.invoke('window:refocus')
    },

    // ── Gaveta de dinero ──────────────────────────────────────────────────────
    cashDrawer: {
        open:        (printerName) => ipcRenderer.invoke('open-cash-drawer', printerName),
        getPrinters: ()            => ipcRenderer.invoke('get-printers')
    }

});

console.log('Preload script loaded successfully!');