/**
 * DATABASE SERVICE
 * Este archivo actúa como puente entre React y la base de datos en Electron
 * Todas las operaciones se ejecutan en el proceso principal de Electron
 */

class Database {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        // No necesitamos inicializar nada aquí
        // La base de datos se inicializa en electron.js
        this.initialized = true;
        console.log('✅ Database service ready');
        return true;
    }

    /**
     * Ejecutar consulta SELECT (retorna múltiples registros)
     */
    async query(sql, params = []) {
        try {
            if (!window.electronAPI || !window.electronAPI.database) {
                throw new Error('ElectronAPI no está disponible');
            }
            
            return await window.electronAPI.database.query(sql, params);
        } catch (error) {
            console.error('Query error:', error);
            throw error;
        }
    }

    /**
     * Ejecutar INSERT, UPDATE, DELETE
     */
    async run(sql, params = []) {
        try {
            if (!window.electronAPI || !window.electronAPI.database) {
                throw new Error('ElectronAPI no está disponible');
            }
            
            const result = await window.electronAPI.database.run(sql, params);
            
            return {
                success: true,
                lastID: result.lastInsertRowid || result.lastID,
                changes: result.changes || 1
            };
        } catch (error) {
            console.error('Run error:', error.message || error);
            throw error;
        }
    }

    /**
     * Obtener un solo registro
     */
    async get(sql, params = []) {
        try {
            if (!window.electronAPI || !window.electronAPI.database) {
                throw new Error('ElectronAPI no está disponible');
            }
            
            return await window.electronAPI.database.get(sql, params);
        } catch (error) {
            console.error('Get error:', error);
            throw error;
        }
    }

    /**
     * Ejecutar transacción (múltiples operaciones)
     */
    async transaction(operations) {
        try {
            if (!window.electronAPI || !window.electronAPI.database) {
                throw new Error('ElectronAPI no está disponible');
            }
            
            return await window.electronAPI.database.transaction(operations);
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    }

    /**
     * No necesitamos guardar, Electron lo hace automáticamente
     */
    async save() {
        // No hace nada, compatibilidad con código anterior
        return true;
    }

    /**
     * No necesitamos cerrar, Electron lo maneja
     */
    close() {
        // No hace nada, compatibilidad con código anterior
    }
}

// Singleton instance
const dbInstance = new Database();

export default dbInstance;