// src/services/repositories/supplierRepository.js

class SupplierRepository {
    constructor() {
        this._migrated = false;
    }

    // ============================================================================
    // AUTO-MIGRACIÓN: agrega columnas faltantes si no existen
    // Se ejecuta una sola vez por sesión, antes del primer INSERT/UPDATE
    // ============================================================================
    async ensureMigrated() {
        if (this._migrated) return;

        try {
            const cols = await window.electronAPI.database.query(
                "SELECT name FROM pragma_table_info('suppliers')"
            );
            const existing = Array.isArray(cols) ? cols.map(c => c.name) : [];

            const missing = [
                { name: 'legal_name',    def: 'TEXT' },
                { name: 'industry',      def: 'TEXT' },
                { name: 'contact_name',  def: 'TEXT' },
                { name: 'region',        def: 'TEXT' },
                { name: 'business_name', def: 'TEXT' },
            ].filter(c => !existing.includes(c.name));

            for (const col of missing) {
                await window.electronAPI.database.run(
                    `ALTER TABLE suppliers ADD COLUMN ${col.name} ${col.def}`
                );
                console.log(`✅ Migración suppliers: columna '${col.name}' agregada`);
            }

            this._migrated = true;
        } catch (err) {
            console.error('❌ Error en migración de suppliers:', err);
            this._migrated = true; // no bloquear el flujo
        }
    }

    // ============================================================================
    // HELPER: Obtener timestamp local
    // ============================================================================
    getLocalTimestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }

    // ============================================================================
    // CREAR proveedor
    // ============================================================================
    async create(supplierData) {
        await this.ensureMigrated(); // ← asegurar columnas antes de insertar

        try {
            if (!supplierData || typeof supplierData !== 'object') {
                throw new Error('Datos del proveedor inválidos');
            }
            if (!supplierData.business_name || !supplierData.business_name.trim()) {
                throw new Error('El nombre comercial es obligatorio');
            }
            if (!supplierData.phone || !supplierData.phone.trim()) {
                throw new Error('El teléfono es obligatorio');
            }

            if (supplierData.rut && supplierData.rut.trim()) {
                const existingRut = await this.getByRut(supplierData.rut.trim());
                if (existingRut) {
                    throw new Error(`Ya existe un proveedor con el RUT: ${supplierData.rut}`);
                }
            }

            console.log('➕ Creando proveedor:', supplierData.business_name);

            const ts = this.getLocalTimestamp();

            const result = await window.electronAPI.database.run(`
                INSERT INTO suppliers (
                    name, business_name, legal_name, rut, industry,
                    contact_name, phone, email, address,
                    city, region, payment_terms, credit_days,
                    notes, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                supplierData.business_name.trim(),   // name (NOT NULL requerido por schema)
                supplierData.business_name.trim(),   // business_name
                supplierData.legal_name    ? supplierData.legal_name.trim()    : null,
                supplierData.rut           ? supplierData.rut.trim()           : null,
                supplierData.industry      ? supplierData.industry.trim()      : null,
                supplierData.contact_name  ? supplierData.contact_name.trim()  : null,
                supplierData.phone.trim(),
                supplierData.email         ? supplierData.email.trim()         : null,
                supplierData.address       ? supplierData.address.trim()       : null,
                supplierData.city          ? supplierData.city.trim()          : null,
                supplierData.region        || null,
                supplierData.payment_terms ? supplierData.payment_terms.trim() : null,
                parseInt(supplierData.credit_days) || 0,
                supplierData.notes         ? supplierData.notes.trim()         : null,
                supplierData.is_active !== undefined ? supplierData.is_active : 1,
                ts,
                ts
            ]);

            let supplierId = result?.lastID || result?.lastInsertRowid;

            if (!supplierId) {
                const found = await window.electronAPI.database.query(
                    'SELECT id FROM suppliers WHERE business_name = ? ORDER BY id DESC LIMIT 1',
                    [supplierData.business_name.trim()]
                );
                if (Array.isArray(found) && found.length > 0) {
                    supplierId = found[0].id;
                }
            }

            console.log('✅ Proveedor creado con ID:', supplierId);
            return { success: true, id: supplierId };
        } catch (error) {
            console.error('❌ Error creating supplier:', error);
            throw error;
        }
    }

    // ============================================================================
    // ACTUALIZAR proveedor
    // ============================================================================
    async update(id, supplierData) {
        await this.ensureMigrated(); // ← asegurar columnas antes de actualizar

        try {
            if (!id || id <= 0) throw new Error('ID de proveedor inválido');
            if (!supplierData || typeof supplierData !== 'object') throw new Error('Datos inválidos');
            if (!supplierData.business_name?.trim()) throw new Error('El nombre comercial es obligatorio');
            if (!supplierData.phone?.trim()) throw new Error('El teléfono es obligatorio');

            if (supplierData.rut && supplierData.rut.trim()) {
                const existingRut = await this.getByRut(supplierData.rut.trim());
                if (existingRut && existingRut.id !== id) {
                    throw new Error(`Ya existe otro proveedor con el RUT: ${supplierData.rut}`);
                }
            }

            console.log('🔄 Actualizando proveedor ID:', id);
            const ts = this.getLocalTimestamp();

            await window.electronAPI.database.run(`
                UPDATE suppliers SET
                    business_name  = ?,
                    legal_name     = ?,
                    rut            = ?,
                    industry       = ?,
                    contact_name   = ?,
                    phone          = ?,
                    email          = ?,
                    address        = ?,
                    city           = ?,
                    region         = ?,
                    payment_terms  = ?,
                    credit_days    = ?,
                    notes          = ?,
                    is_active      = ?,
                    updated_at     = ?
                WHERE id = ?
            `, [
                supplierData.business_name.trim(),
                supplierData.legal_name    ? supplierData.legal_name.trim()    : null,
                supplierData.rut           ? supplierData.rut.trim()           : null,
                supplierData.industry      ? supplierData.industry.trim()      : null,
                supplierData.contact_name  ? supplierData.contact_name.trim()  : null,
                supplierData.phone.trim(),
                supplierData.email         ? supplierData.email.trim()         : null,
                supplierData.address       ? supplierData.address.trim()       : null,
                supplierData.city          ? supplierData.city.trim()          : null,
                supplierData.region        || null,
                supplierData.payment_terms ? supplierData.payment_terms.trim() : null,
                parseInt(supplierData.credit_days) || 0,
                supplierData.notes         ? supplierData.notes.trim()         : null,
                supplierData.is_active !== undefined ? supplierData.is_active : 1,
                ts,
                id
            ]);

            console.log('✅ Proveedor actualizado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating supplier:', error);
            throw error;
        }
    }

    // ============================================================================
    // OBTENER TODOS
    // ============================================================================
    async getAll() {
        try {
            const suppliers = await window.electronAPI.database.query(`
                SELECT 
                    s.*,
                    (SELECT COUNT(*) FROM product_suppliers WHERE supplier_id = s.id) as products_count,
                    (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) as purchases_count,
                    (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE supplier_id = s.id) as total_purchases_amount
                FROM suppliers s
                ORDER BY s.business_name ASC
            `);
            return Array.isArray(suppliers) ? suppliers : [];
        } catch (error) {
            console.error('❌ Error getting all suppliers:', error);
            return [];
        }
    }

    // ============================================================================
    // OBTENER ACTIVOS (para selector en ProductModal)
    // ============================================================================
    async getActive() {
        try {
            const suppliers = await window.electronAPI.database.query(`
                SELECT id, business_name, contact_name, phone
                FROM suppliers
                WHERE is_active = 1
                ORDER BY business_name ASC
            `);
            return Array.isArray(suppliers) ? suppliers : [];
        } catch (error) {
            console.error('❌ Error getting active suppliers:', error);
            return [];
        }
    }

    // ============================================================================
    // OBTENER POR ID
    // ============================================================================
    async getById(id) {
        try {
            if (!id || id <= 0) return null;
            const suppliers = await window.electronAPI.database.query(`
                SELECT 
                    s.*,
                    (SELECT COUNT(*) FROM product_suppliers WHERE supplier_id = s.id) as products_count,
                    (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) as purchases_count,
                    (SELECT COALESCE(SUM(total), 0) FROM purchases WHERE supplier_id = s.id) as total_purchases,
                    (SELECT MAX(invoice_date) FROM purchases WHERE supplier_id = s.id) as last_purchase_date
                FROM suppliers s
                WHERE s.id = ?
            `, [id]);
            return Array.isArray(suppliers) && suppliers.length > 0 ? suppliers[0] : null;
        } catch (error) {
            console.error('❌ Error getting supplier by id:', error);
            return null;
        }
    }

    // ============================================================================
    // OBTENER POR RUT
    // ============================================================================
    async getByRut(rut) {
        try {
            if (!rut?.trim()) return null;
            const suppliers = await window.electronAPI.database.query(
                'SELECT * FROM suppliers WHERE rut = ?',
                [rut.trim()]
            );
            return Array.isArray(suppliers) && suppliers.length > 0 ? suppliers[0] : null;
        } catch (error) {
            console.error('❌ Error getting supplier by RUT:', error);
            return null;
        }
    }

    // ============================================================================
    // BUSCAR
    // ============================================================================
    async search(searchTerm) {
        try {
            if (!searchTerm?.trim()) return [];
            const term = `%${searchTerm.trim()}%`;
            const suppliers = await window.electronAPI.database.query(`
                SELECT s.*,
                    (SELECT COUNT(*) FROM product_suppliers WHERE supplier_id = s.id) as products_count,
                    (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) as purchases_count
                FROM suppliers s
                WHERE s.business_name LIKE ? OR s.rut LIKE ? OR s.contact_name LIKE ?
                   OR s.phone LIKE ? OR s.email LIKE ?
                ORDER BY s.business_name ASC
            `, [term, term, term, term, term]);
            return Array.isArray(suppliers) ? suppliers : [];
        } catch (error) {
            console.error('❌ Error searching suppliers:', error);
            return [];
        }
    }

    // ============================================================================
    // DESACTIVAR / ACTIVAR
    // ============================================================================
    async deactivate(id) {
        try {
            if (!id || id <= 0) throw new Error('ID inválido');
            await window.electronAPI.database.run(
                'UPDATE suppliers SET is_active = 0, updated_at = ? WHERE id = ?',
                [this.getLocalTimestamp(), id]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error deactivating supplier:', error);
            throw error;
        }
    }

    async activate(id) {
        try {
            if (!id || id <= 0) throw new Error('ID inválido');
            await window.electronAPI.database.run(
                'UPDATE suppliers SET is_active = 1, updated_at = ? WHERE id = ?',
                [this.getLocalTimestamp(), id]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error activating supplier:', error);
            throw error;
        }
    }

    // ============================================================================
    // ELIMINAR
    // ============================================================================
    async delete(id) {
        try {
            if (!id || id <= 0) throw new Error('ID inválido');

            const [pc, pur] = await Promise.all([
                window.electronAPI.database.query(
                    'SELECT COUNT(*) as count FROM product_suppliers WHERE supplier_id = ?', [id]
                ),
                window.electronAPI.database.query(
                    'SELECT COUNT(*) as count FROM purchases WHERE supplier_id = ?', [id]
                )
            ]);

            if (pc?.[0]?.count > 0)
                throw new Error(`No se puede eliminar: tiene ${pc[0].count} producto(s) asociado(s)`);
            if (pur?.[0]?.count > 0)
                throw new Error(`No se puede eliminar: tiene ${pur[0].count} compra(s) registrada(s)`);

            await window.electronAPI.database.run('DELETE FROM suppliers WHERE id = ?', [id]);
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting supplier:', error);
            throw error;
        }
    }

    // ============================================================================
    // HELPERS adicionales
    // ============================================================================
    async getSupplierProducts(supplierId) {
        try {
            if (!supplierId || supplierId <= 0) return [];
            const products = await window.electronAPI.database.query(`
                SELECT p.*, ps.supplier_sku, ps.last_cost, ps.last_purchase_date,
                       ps.is_preferred, c.name as category_name
                FROM products p
                INNER JOIN product_suppliers ps ON p.id = ps.product_id
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE ps.supplier_id = ?
                ORDER BY p.name ASC
            `, [supplierId]);
            return Array.isArray(products) ? products : [];
        } catch (error) {
            console.error('❌ Error getting supplier products:', error);
            return [];
        }
    }

    async getSupplierStats(supplierId) {
        try {
            if (!supplierId || supplierId <= 0) return { total_purchases: 0, total_amount: 0 };
            const stats = await window.electronAPI.database.query(`
                SELECT COUNT(*) as total_purchases,
                       COALESCE(SUM(total), 0) as total_amount,
                       COALESCE(AVG(total), 0) as average_purchase,
                       COALESCE(SUM(CASE WHEN payment_status = 'pendiente' THEN total ELSE 0 END), 0) as pending_amount,
                       COALESCE(SUM(CASE WHEN payment_status = 'pagado'    THEN total ELSE 0 END), 0) as paid_amount
                FROM purchases WHERE supplier_id = ?
            `, [supplierId]);
            const r = stats?.[0] || {};
            return {
                total_purchases:  parseInt(r.total_purchases)  || 0,
                total_amount:     parseFloat(r.total_amount)   || 0,
                average_purchase: parseFloat(r.average_purchase)|| 0,
                pending_amount:   parseFloat(r.pending_amount) || 0,
                paid_amount:      parseFloat(r.paid_amount)    || 0,
            };
        } catch (error) {
            console.error('❌ Error getting supplier stats:', error);
            return { total_purchases: 0, total_amount: 0, average_purchase: 0, pending_amount: 0, paid_amount: 0 };
        }
    }

    async getTopSuppliers(limit = 10) {
        try {
            const suppliers = await window.electronAPI.database.query(`
                SELECT s.*, COUNT(p.id) as purchases_count,
                       COALESCE(SUM(p.total), 0) as total_purchases_amount
                FROM suppliers s
                LEFT JOIN purchases p ON s.id = p.supplier_id
                WHERE s.is_active = 1
                GROUP BY s.id
                ORDER BY total_purchases_amount DESC
                LIMIT ?
            `, [parseInt(limit) || 10]);
            return Array.isArray(suppliers) ? suppliers : [];
        } catch (error) {
            console.error('❌ Error getting top suppliers:', error);
            return [];
        }
    }

    async getSuppliersWithPendingPayments() {
        try {
            const suppliers = await window.electronAPI.database.query(`
                SELECT s.*, COUNT(p.id) as pending_purchases,
                       COALESCE(SUM(p.total), 0) as pending_amount
                FROM suppliers s
                INNER JOIN purchases p ON s.id = p.supplier_id
                WHERE p.payment_status = 'pendiente' AND s.is_active = 1
                GROUP BY s.id
                ORDER BY pending_amount DESC
            `);
            return Array.isArray(suppliers) ? suppliers : [];
        } catch (error) {
            console.error('❌ Error getting suppliers with pending payments:', error);
            return [];
        }
    }
}

export default SupplierRepository;