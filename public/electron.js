const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
const Database = require('better-sqlite3');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');
const {
    activateLicense,
    checkLicense,
    checkLocalLicense,
    clearLocalLicense
} = require('./licenseManager');

let mainWindow;
let db;
let pendingUpdate = null;

const appStore = new Store({ name: 'nuventa-app-prefs' });

// ============================================================================
// AUTO UPDATER
// ============================================================================

function setupAutoUpdater() {
    if (isDev) {
        console.log('[Updater] Modo desarrollo — auto-update desactivado');
        return;
    }

    autoUpdater.autoDownload         = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.setFeedURL({
        provider: 'github',
        owner:    'PabloGutsan',
        repo:     'nuventa-releases',
        private:  false,
    });

    autoUpdater.on('checking-for-update', () => {
        console.log('[Updater] Verificando actualizaciones...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[Updater] Nueva versión disponible:', info.version);
        pendingUpdate = {
            hasUpdate:     true,
            latestVersion: info.version,
            releaseNotes:  typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
            isObligatory:  false,
            autoDownload:  true
        };
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:available', pendingUpdate);
        }
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[Updater] App al día.');
        pendingUpdate = null;
    });

    autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:progress', { percent });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Actualización descargada:', info.version);
        pendingUpdate = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update:downloaded', {
                version:      info.version,
                releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
            });
        }
    });

    autoUpdater.on('error', (error) => {
        console.error('[Updater] Error:', error.message);
    });
}

ipcMain.handle('update:start-download', () => {
    autoUpdater.downloadUpdate();
});

ipcMain.handle('update:install-now', () => {
    autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('update:check', async () => {
    if (isDev) return { hasUpdate: false };
    try {
        await autoUpdater.checkForUpdates();
        return { success: true };
    } catch (error) {
        return { hasUpdate: false };
    }
});

ipcMain.handle('update:get-pending', () => {
    return pendingUpdate;
});

// ============================================================================
// TÉRMINOS Y CONDICIONES
// ============================================================================

ipcMain.handle('terms:accepted', () => {
    return appStore.get('termsAccepted', false);
});

ipcMain.handle('terms:accept', () => {
    appStore.set('termsAccepted', true);
    appStore.set('termsAcceptedAt', new Date().toISOString());
    console.log('[Terms] T&C aceptados');
    return { success: true };
});

// ============================================================================
// VENTANA
// ============================================================================

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 1024,
        minHeight: 600,
        title: 'Nuventa - Punto de Ventas',
        icon: path.join(__dirname, 'assets/icons/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#ffffff',
        show: false
    });

    mainWindow.loadURL(
        isDev
            ? 'http://localhost:3000'
            : `file://${path.join(__dirname, '../build/index.html')}`
    );

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (pendingUpdate) {
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('update:available', pendingUpdate);
                }
            }, 3000);
        }
    });

    if (isDev) mainWindow.webContents.openDevTools();

    mainWindow.on('close', async (e) => {
        if (app.isQuitting) return;

        e.preventDefault();

        try {
            const openRegister = db
                ? db.prepare(`SELECT id, opened_at FROM cash_registers WHERE status = 'open' LIMIT 1`).get()
                : null;

            const hasOpenCash = !!openRegister;

            const message = hasOpenCash
                ? `Hay una caja abierta desde ${new Date(openRegister.opened_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.\n\n¿Seguro que quieres cerrar Nuventa?`
                : '¿Seguro que quieres cerrar Nuventa?';

            const { response } = await dialog.showMessageBox(mainWindow, {
                type:      hasOpenCash ? 'warning' : 'question',
                buttons:   ['Cerrar Nuventa', 'Cancelar'],
                defaultId: 1,
                cancelId:  1,
                title:     'Cerrar Nuventa',
                message:   hasOpenCash ? '⚠️ Caja abierta' : 'Confirmar cierre',
                detail:    message,
            });

            if (response === 0) {
                app.isQuitting = true;
                app.quit();
            }
        } catch (err) {
            app.isQuitting = true;
            app.quit();
        }
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

function refocusWindow() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
        }, 100);
    }
}

// ============================================================================
// BASE DE DATOS
// ============================================================================

function initDatabase() {
    try {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'pos.db');
        console.log('Database path:', dbPath);

        db = new Database(dbPath);
        db.pragma('foreign_keys = ON');

        const schemaPath = isDev
            ? path.join(__dirname, '../database/schema.sql')
            : path.join(process.resourcesPath, 'database/schema.sql');

        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            db.exec(schema);
            console.log('✅ Database schema v2.1 initialized');
        } else {
            console.error('❌ schema.sql no encontrado en:', schemaPath);
        }

        createDefaultAdmin();
        console.log('✅ Database initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing database:', error);
        dialog.showErrorBox('Error de Base de Datos', `No se pudo inicializar la base de datos: ${error.message}`);
        return false;
    }
}

function createDefaultAdmin() {
    try {
        const bcrypt = require('bcryptjs');
        const existingAdmin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
        if (!existingAdmin) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.prepare(`
                INSERT INTO users (username, password_hash, full_name, role, is_active, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('admin', hashedPassword, 'Administrador', 'admin', 1, 1);
            console.log('✅ Admin por defecto creado');
        }
    } catch (error) {
        console.error('Error creating default admin:', error);
    }
}

// ============================================================================
// IPC — DATABASE
// ============================================================================

ipcMain.handle('db-query', async (event, sql, params = []) => {
    try { return db.prepare(sql).all(...params); }
    catch (error) { console.error('DB query error:', error); throw error; }
});

ipcMain.handle('db-run', async (event, sql, params = []) => {
    try { return db.prepare(sql).run(...params); }
    catch (error) { console.error('DB run error:', error); throw error; }
});

ipcMain.handle('db-get', async (event, sql, params = []) => {
    try { return db.prepare(sql).get(...params); }
    catch (error) { console.error('DB get error:', error); throw error; }
});

ipcMain.handle('db-transaction', async (event, operations) => {
    const transaction = db.transaction(() => {
        const results = [];
        for (const op of operations) {
            results.push(db.prepare(op.sql).run(...(op.params || [])));
        }
        return results;
    });
    try { return transaction(); }
    catch (error) { console.error('Transaction error:', error); throw error; }
});

// ============================================================================
// IPC — LICENCIA
// ============================================================================

ipcMain.handle('license:check',    async ()  => checkLicense());
ipcMain.handle('license:activate', async (event, licenseKey, email, businessName) =>
    await activateLicense(licenseKey, email, businessName)
);
ipcMain.handle('license:clear', async () => {
    if (isDev) { clearLocalLicense(); return { success: true }; }
    return { success: false, error: 'No disponible en producción' };
});

// ============================================================================
// IPC — AUTH
// ============================================================================

ipcMain.handle('auth:hashPassword', async (event, plainPassword) => {
    try {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(plainPassword, 10);
        return { success: true, hash };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================================================================
// IPC — ARCHIVOS
// ============================================================================

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    refocusWindow();
    return (!result.canceled && result.filePaths.length > 0) ? result.filePaths[0] : null;
});

ipcMain.handle('save-file', async (event, data, defaultPath) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters: [
            { name: 'Excel Files', extensions: ['xlsx'] },
            { name: 'PDF Files',   extensions: ['pdf']  },
            { name: 'CSV Files',   extensions: ['csv']  },
            { name: 'All Files',   extensions: ['*']    }
        ]
    });
    refocusWindow();
    if (!result.canceled && result.filePath) {
        try { fs.writeFileSync(result.filePath, data); return { success: true, path: result.filePath }; }
        catch (error) { return { success: false, error: error.message }; }
    }
    return { success: false, error: 'Cancelled' };
});

ipcMain.handle('read-file', async (event, filePath) => {
    try { return { success: true, data: fs.readFileSync(filePath) }; }
    catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('app:openExternal', async (event, url) => {
    if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        await shell.openExternal(url);
        return true;
    }
    return false;
});

// ============================================================================
// IPC — EXPORTACIÓN
// ============================================================================

ipcMain.handle('export-excel', async (event, data, filename) => {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Datos');
        worksheet.columns = data.columns;
        worksheet.addRows(data.rows);
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        const buffer = await workbook.xlsx.writeBuffer();
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: filename,
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });
        refocusWindow();
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, buffer);
            return { success: true, path: result.filePath };
        }
        return { success: false, error: 'Cancelled' };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('export-pdf', async (event, data, filename) => {
    try {
        const { jsPDF } = require('jspdf');
        require('jspdf-autotable');
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(data.title || 'Reporte', 14, 20);
        doc.autoTable({
            head: [data.columns.map(col => col.header)],
            body: data.rows.map(row => data.columns.map(col => row[col.key])),
            startY: 30
        });
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: filename,
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });
        refocusWindow();
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, pdfBuffer);
            return { success: true, path: result.filePath };
        }
        return { success: false, error: 'Cancelled' };
    } catch (error) { return { success: false, error: error.message }; }
});

// ============================================================================
// IPC — BACKUP
// ============================================================================

ipcMain.handle('create-backup', async () => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: `backup-nuventa-${timestamp}.db`,
            filters: [{ name: 'Database Files', extensions: ['db'] }]
        });
        refocusWindow();
        if (!result.canceled && result.filePath) {
            fs.copyFileSync(path.join(app.getPath('userData'), 'pos.db'), result.filePath);
            return { success: true, path: result.filePath };
        }
        return { success: false, error: 'Cancelled' };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle('restore-backup', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            filters: [{ name: 'Database Files', extensions: ['db'] }],
            properties: ['openFile']
        });
        refocusWindow();
        if (!result.canceled && result.filePaths.length > 0) {
            db.close();
            const dbPath = path.join(app.getPath('userData'), 'pos.db');
            fs.copyFileSync(result.filePaths[0], dbPath);
            db = new Database(dbPath);
            db.pragma('foreign_keys = ON');
            return { success: true };
        }
        return { success: false, error: 'Cancelled' };
    } catch (error) { return { success: false, error: error.message }; }
});

// ============================================================================
// IPC — VARIOS
// ============================================================================

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('window:refocus', () => {
    try {
        if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
            }, 80);
        }
        return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
});

// ============================================================================
// IPC — GAVETA DE DINERO
// FIX: este handler faltaba — preload.js expone cashDrawer.open(printerName)
// invocando 'open-cash-drawer', pero el handler no existía en electron.js.
// La gaveta se abre enviando el comando ESC/POS kick (ESC p 0 25 250)
// a la impresora de recibos que tenga conectada la gaveta.
// ============================================================================

ipcMain.handle('open-cash-drawer', async (event, printerName) => {
    try {
        const drawerWin = new BrowserWindow({
            show: false,
            width: 1,
            height: 1,
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });

        // Comando ESC/POS estándar para abrir gaveta (compatible Epson, Star, Bixolon, etc.)
        // ESC p 0 25 250  →  \x1B\x70\x00\x19\xFA
        const drawerHTML = `<!DOCTYPE html>
<html><head><style>
  @page { size: 1mm 1mm; margin: 0; }
  body { margin: 0; font-size: 1px; color: white; }
</style></head>
<body>\u001Bp\u0000\u0019\u00FA</body></html>`;

        await drawerWin.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(drawerHTML)}`
        );
        await new Promise(resolve => setTimeout(resolve, 200));

        const result = await new Promise((resolve) => {
            drawerWin.webContents.print(
                {
                    silent:          true,
                    printBackground: true,
                    deviceName:      printerName || '',
                    margins:         { marginType: 'none' },
                },
                (success, reason) => resolve({ success, reason })
            );
        });

        drawerWin.destroy();
        console.log(`[CashDrawer] ${result.success ? 'Abierta OK' : 'Error: ' + result.reason}`);
        return { success: result.success, error: result.reason };
    } catch (error) {
        console.error('[CashDrawer] Error:', error.message);
        return { success: false, error: error.message };
    }
});

// ============================================================================
// IPC — IMPRESORA DE COCINA
// ============================================================================

// Listar impresoras del sistema
// Usado por BusinessSettings.jsx (selector) y cashDrawer
ipcMain.handle('get-printers', async () => {
    try {
        const printers = await mainWindow.webContents.getPrintersAsync();
        return printers.map(p => ({
            name:        p.name,
            description: p.description || p.name,
            isDefault:   p.isDefault,
            status:      p.status,
        }));
    } catch (error) {
        console.error('[Printers] Error listando impresoras:', error);
        return [];
    }
});

// Imprimir HTML silenciosamente en impresora específica (sin diálogo del SO)
// FIX: pageSize.height subido de 297000 (297 mm = A4) a 600000 (600 mm)
// para que comandas con muchos productos no se corten.
ipcMain.handle('print-silent', async (event, { html, printerName, copies = 1 }) => {
    try {
        const printWin = new BrowserWindow({
            show: false,
            width: 400,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            }
        });

        await printWin.loadURL(
            `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
        );

        // Esperar a que el renderer pinte el contenido completo
        await new Promise(resolve => setTimeout(resolve, 800));

        const printResult = await new Promise((resolve) => {
            printWin.webContents.print(
                {
                    silent:          true,
                    printBackground: true,
                    deviceName:      printerName,
                    copies:          copies,
                    margins:         { marginType: 'none' },
                    // 80 mm de ancho, 600 mm de alto — suficiente para cualquier comanda
                    pageSize:        { width: 80000, height: 600000 },
                },
                (success, reason) => resolve({ success, reason })
            );
        });

        printWin.destroy();

        if (printResult.success) {
            console.log(`[Kitchen] Comanda enviada a "${printerName}" (${copies} copia/s)`);
            return { success: true };
        } else {
            console.error(`[Kitchen] Error imprimiendo en "${printerName}":`, printResult.reason);
            return { success: false, error: printResult.reason };
        }

    } catch (error) {
        console.error('[Kitchen] Error en impresión silenciosa:', error);
        return { success: false, error: error.message };
    }
});

// ============================================================================
// LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
    if (initDatabase()) {
        setupAutoUpdater();
        createWindow();

        if (!isDev) {
            setTimeout(() => {
                autoUpdater.checkForUpdates().catch(err => {
                    console.log('[Updater] Error en verificación inicial:', err.message);
                });
            }, 15000);
        }

        setInterval(async () => {
            try {
                console.log("[License] Verificacion periodica...");
                const result = await checkLicense();
                if (!result.hasLicense || result.blocked) {
                    console.warn("[License] Licencia invalida en verificacion periodica:", result.reason);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send("license:revoked", {
                            reason:  result.reason  || "INACTIVE",
                            message: result.message || "Tu licencia ha sido cancelada. Contacta a soporte en nuventa.cl."
                        });
                    }
                }
            } catch (err) {
                console.log("[License] Error en verificacion periodica:", err.message);
            }
        }, 60 * 60 * 1000);
    } else {
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (db) db.close();
        app.quit();
    }
});

app.on('before-quit', () => {
    if (db) db.close();
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    dialog.showErrorBox('Error Fatal', error.message);
});