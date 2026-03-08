class CustomerRepository {
    constructor(db) {
        this.db = db;
    }

    // ── Crear cliente ─────────────────────────────────────────────────────────
    async create(customerData) {
        try {
            if (!customerData || typeof customerData !== 'object')
                throw new Error('Datos del cliente inválidos');
            if (!customerData.full_name?.trim())
                throw new Error('El nombre completo es obligatorio');
            if (!customerData.phone?.trim())
                throw new Error('El teléfono es obligatorio');

            const result = await window.electronAPI.database.run(`
                INSERT INTO customers (
                    full_name, rut, phone, email,
                    address, city, region, birth_date,
                    notes, is_active,
                    is_company,
                    company_name, company_rut, company_address,
                    company_region, company_city,
                    company_phone, company_email, company_website
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                customerData.full_name.trim(),
                customerData.rut          ? customerData.rut.trim()          : null,
                customerData.phone.trim(),
                customerData.email        ? customerData.email.trim()        : null,
                customerData.address      ? customerData.address.trim()      : null,
                customerData.city         ? customerData.city.trim()         : null,
                customerData.region       || null,
                customerData.birth_date   || null,
                customerData.notes        ? customerData.notes.trim()        : null,
                customerData.is_active !== undefined ? customerData.is_active : 1,
                customerData.is_company   ? 1 : 0,
                customerData.company_name    ? customerData.company_name.trim()    : null,
                customerData.company_rut     ? customerData.company_rut.trim()     : null,
                customerData.company_address ? customerData.company_address.trim() : null,
                customerData.company_region  || null,
                customerData.company_city    || null,
                customerData.company_phone   ? customerData.company_phone.trim()   : null,
                customerData.company_email   ? customerData.company_email.trim()   : null,
                customerData.company_website ? customerData.company_website.trim() : null,
            ]);

            const newId = result?.lastInsertRowid ?? result?.lastID ?? result?.id;
            return { success: true, id: newId };
        } catch (error) {
            console.error('❌ Error creating customer:', error);
            throw error;
        }
    }

    // ── Actualizar cliente ────────────────────────────────────────────────────
    async update(id, customerData) {
        try {
            if (!id || id <= 0) throw new Error('ID de cliente inválido');
            if (!customerData || typeof customerData !== 'object')
                throw new Error('Datos del cliente inválidos');

            await window.electronAPI.database.run(`
                UPDATE customers SET
                    full_name        = ?,
                    rut              = ?,
                    phone            = ?,
                    email            = ?,
                    address          = ?,
                    city             = ?,
                    region           = ?,
                    birth_date       = ?,
                    notes            = ?,
                    is_active        = ?,
                    is_company       = ?,
                    company_name     = ?,
                    company_rut      = ?,
                    company_address  = ?,
                    company_region   = ?,
                    company_city     = ?,
                    company_phone    = ?,
                    company_email    = ?,
                    company_website  = ?,
                    updated_at       = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                customerData.full_name.trim(),
                customerData.rut          ? customerData.rut.trim()          : null,
                customerData.phone.trim(),
                customerData.email        ? customerData.email.trim()        : null,
                customerData.address      ? customerData.address.trim()      : null,
                customerData.city         ? customerData.city.trim()         : null,
                customerData.region       || null,
                customerData.birth_date   || null,
                customerData.notes        ? customerData.notes.trim()        : null,
                customerData.is_active !== undefined ? customerData.is_active : 1,
                customerData.is_company   ? 1 : 0,
                customerData.company_name    ? customerData.company_name.trim()    : null,
                customerData.company_rut     ? customerData.company_rut.trim()     : null,
                customerData.company_address ? customerData.company_address.trim() : null,
                customerData.company_region  || null,
                customerData.company_city    || null,
                customerData.company_phone   ? customerData.company_phone.trim()   : null,
                customerData.company_email   ? customerData.company_email.trim()   : null,
                customerData.company_website ? customerData.company_website.trim() : null,
                id,
            ]);

            return { success: true };
        } catch (error) {
            console.error('❌ Error updating customer:', error);
            throw error;
        }
    }

    // ── Obtener todos los clientes con estadísticas reales ────────────────────
    // JOIN por rut y phone (sales no tiene customer_id)
    async getAll() {
        try {
            const customers = await window.electronAPI.database.query(`
                SELECT
                    c.*,
                    (
                        SELECT COUNT(*)
                        FROM sales s
                        WHERE s.is_cancelled = 0
                          AND (
                              (c.rut IS NOT NULL AND c.rut != '' AND TRIM(s.customer_rut) = TRIM(c.rut))
                              OR (c.phone IS NOT NULL AND c.phone != ''
                                  AND SUBSTR(REPLACE(REPLACE(COALESCE(s.customer_phone,''),' ',''),'+56',''), -9)
                                    = SUBSTR(REPLACE(REPLACE(COALESCE(c.phone,''),' ',''),'+56',''), -9))
                              OR (c.full_name IS NOT NULL AND s.customer_name IS NOT NULL
                                  AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(c.full_name)))
                          )
                    ) AS purchases_count,
                    (
                        SELECT COALESCE(SUM(s.total), 0)
                        FROM sales s
                        WHERE s.is_cancelled = 0
                          AND (
                              (c.rut IS NOT NULL AND c.rut != '' AND TRIM(s.customer_rut) = TRIM(c.rut))
                              OR (c.phone IS NOT NULL AND c.phone != ''
                                  AND SUBSTR(REPLACE(REPLACE(COALESCE(s.customer_phone,''),' ',''),'+56',''), -9)
                                    = SUBSTR(REPLACE(REPLACE(COALESCE(c.phone,''),' ',''),'+56',''), -9))
                              OR (c.full_name IS NOT NULL AND s.customer_name IS NOT NULL
                                  AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(c.full_name)))
                          )
                    ) AS total_purchased,
                    (
                        SELECT MAX(s.created_at)
                        FROM sales s
                        WHERE s.is_cancelled = 0
                          AND (
                              (c.rut IS NOT NULL AND c.rut != '' AND TRIM(s.customer_rut) = TRIM(c.rut))
                              OR (c.phone IS NOT NULL AND c.phone != ''
                                  AND SUBSTR(REPLACE(REPLACE(COALESCE(s.customer_phone,''),' ',''),'+56',''), -9)
                                    = SUBSTR(REPLACE(REPLACE(COALESCE(c.phone,''),' ',''),'+56',''), -9))
                              OR (c.full_name IS NOT NULL AND s.customer_name IS NOT NULL
                                  AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(c.full_name)))
                          )
                    ) AS last_purchase_date
                FROM customers c
                ORDER BY c.full_name ASC
            `);

            return Array.isArray(customers) ? customers : [];
        } catch (error) {
            console.error('❌ Error getting customers:', error);
            return [];
        }
    }

    // ── Obtener clientes activos ──────────────────────────────────────────────
    async getActive() {
        try {
            const customers = await window.electronAPI.database.query(`
                SELECT * FROM customers
                WHERE is_active = 1
                ORDER BY full_name ASC
            `);
            return Array.isArray(customers) ? customers : [];
        } catch (error) {
            console.error('❌ Error getting active customers:', error);
            return [];
        }
    }

    // ── Obtener cliente por ID ────────────────────────────────────────────────
    async getById(id) {
        try {
            if (!id || id <= 0) return null;

            const customers = await window.electronAPI.database.query(`
                SELECT
                    c.*,
                    (
                        SELECT COUNT(*)
                        FROM sales s
                        WHERE s.is_cancelled = 0
                          AND (
                              (c.rut IS NOT NULL AND c.rut != '' AND TRIM(s.customer_rut) = TRIM(c.rut))
                              OR (c.phone IS NOT NULL AND c.phone != ''
                                  AND SUBSTR(REPLACE(REPLACE(COALESCE(s.customer_phone,''),' ',''),'+56',''), -9)
                                    = SUBSTR(REPLACE(REPLACE(COALESCE(c.phone,''),' ',''),'+56',''), -9))
                              OR (c.full_name IS NOT NULL AND s.customer_name IS NOT NULL
                                  AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(c.full_name)))
                          )
                    ) AS purchases_count,
                    (
                        SELECT COALESCE(SUM(s.total), 0)
                        FROM sales s
                        WHERE s.is_cancelled = 0
                          AND (
                              (c.rut IS NOT NULL AND c.rut != '' AND TRIM(s.customer_rut) = TRIM(c.rut))
                              OR (c.phone IS NOT NULL AND c.phone != ''
                                  AND SUBSTR(REPLACE(REPLACE(COALESCE(s.customer_phone,''),' ',''),'+56',''), -9)
                                    = SUBSTR(REPLACE(REPLACE(COALESCE(c.phone,''),' ',''),'+56',''), -9))
                              OR (c.full_name IS NOT NULL AND s.customer_name IS NOT NULL
                                  AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(c.full_name)))
                          )
                    ) AS total_purchased,
                    (
                        SELECT MAX(s.created_at)
                        FROM sales s
                        WHERE s.is_cancelled = 0
                          AND (
                              (c.rut IS NOT NULL AND c.rut != '' AND TRIM(s.customer_rut) = TRIM(c.rut))
                              OR (c.phone IS NOT NULL AND c.phone != ''
                                  AND SUBSTR(REPLACE(REPLACE(COALESCE(s.customer_phone,''),' ',''),'+56',''), -9)
                                    = SUBSTR(REPLACE(REPLACE(COALESCE(c.phone,''),' ',''),'+56',''), -9))
                              OR (c.full_name IS NOT NULL AND s.customer_name IS NOT NULL
                                  AND LOWER(TRIM(s.customer_name)) = LOWER(TRIM(c.full_name)))
                          )
                    ) AS last_purchase_date
                FROM customers c
                WHERE c.id = ?
            `, [id]);

            if (!Array.isArray(customers) || customers.length === 0) return null;
            return customers[0];
        } catch (error) {
            console.error('❌ Error getting customer by id:', error);
            return null;
        }
    }

    // ── Obtener cliente por RUT ───────────────────────────────────────────────
    async getByRUT(rut) {
        try {
            if (!rut?.trim()) return null;
            const customers = await window.electronAPI.database.query(
                `SELECT * FROM customers WHERE rut = ?`, [rut.trim()]
            );
            if (!Array.isArray(customers) || customers.length === 0) return null;
            return customers[0];
        } catch (error) {
            console.error('❌ Error getting customer by RUT:', error);
            return null;
        }
    }

    // ── Buscar clientes ───────────────────────────────────────────────────────
    async search(searchTerm) {
        try {
            if (!searchTerm?.trim()) return [];
            const term = `%${searchTerm.trim()}%`;
            const customers = await window.electronAPI.database.query(`
                SELECT
                    c.*,
                    COUNT(DISTINCT s.id) AS purchases_count
                FROM customers c
                LEFT JOIN sales s
                    ON s.is_cancelled = 0
                    AND (
                        (c.rut   IS NOT NULL AND c.rut   != '' AND s.customer_rut   = c.rut)
                        OR (c.phone IS NOT NULL AND c.phone != '' AND s.customer_phone = c.phone)
                    )
                WHERE c.full_name    LIKE ?
                   OR c.rut         LIKE ?
                   OR c.phone       LIKE ?
                   OR c.email       LIKE ?
                   OR c.company_name LIKE ?
                GROUP BY c.id
                ORDER BY c.full_name ASC
            `, [term, term, term, term, term]);
            return Array.isArray(customers) ? customers : [];
        } catch (error) {
            console.error('❌ Error searching customers:', error);
            return [];
        }
    }

    // ── Desactivar / Activar cliente ──────────────────────────────────────────
    async deactivate(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de cliente inválido');
            await window.electronAPI.database.run(
                `UPDATE customers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error deactivating customer:', error);
            throw error;
        }
    }

    async activate(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de cliente inválido');
            await window.electronAPI.database.run(
                `UPDATE customers SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error activating customer:', error);
            throw error;
        }
    }

    // ── Eliminar cliente (solo si no tiene compras) ───────────────────────────
    async delete(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de cliente inválido');
            const customer = await this.getById(id);
            if (!customer) throw new Error('Cliente no encontrado');
            const purchasesCount = parseInt(customer.purchases_count) || 0;
            if (purchasesCount > 0)
                throw new Error(`No se puede eliminar el cliente porque tiene ${purchasesCount} compra(s) registrada(s)`);
            await window.electronAPI.database.run('DELETE FROM customers WHERE id = ?', [id]);
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting customer:', error);
            throw error;
        }
    }

    // ── Historial de compras del cliente ──────────────────────────────────────
    async getCustomerPurchases(customerId) {
        try {
            if (!customerId || customerId <= 0) return [];
            const customer = await this.getById(customerId);
            if (!customer) return [];

            const purchases = await window.electronAPI.database.query(`
                SELECT
                    s.*,
                    u.full_name AS seller_name,
                    (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) AS items_count
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.is_cancelled = 0
                  AND (
                  AND (? IS NOT NULL AND ? != '' AND s.customer_rut   = ?)
                      OR (? IS NOT NULL AND ? != '' AND s.customer_phone = ?)
                  )
                ORDER BY s.created_at DESC
            `, [
                customerId,
                customer.rut,   customer.rut,   customer.rut,
                customer.phone, customer.phone, customer.phone
            ]);

            return Array.isArray(purchases) ? purchases : [];
        } catch (error) {
            console.error('❌ Error getting customer purchases:', error);
            return [];
        }
    }

    // ── Estadísticas del cliente ──────────────────────────────────────────────
    async getCustomerStats(customerId) {
        const empty = { total_purchases: 0, total_amount: 0, average_purchase: 0, last_purchase: null };
        try {
            if (!customerId || customerId <= 0) return empty;
            const customer = await this.getById(customerId);
            if (!customer) return empty;

            const stats = await window.electronAPI.database.query(`
                SELECT
                    COUNT(*)                    AS total_purchases,
                    COALESCE(SUM(total), 0)     AS total_amount,
                    COALESCE(AVG(total), 0)     AS average_purchase,
                    MAX(created_at)             AS last_purchase
                FROM sales
                WHERE is_cancelled = 0
                  AND (
                  AND (? IS NOT NULL AND ? != '' AND customer_rut   = ?)
                      OR (? IS NOT NULL AND ? != '' AND customer_phone = ?)
                  )
            `, [
                customerId,
                customer.rut,   customer.rut,   customer.rut,
                customer.phone, customer.phone, customer.phone
            ]);

            if (!Array.isArray(stats) || stats.length === 0) return empty;
            return {
                total_purchases:  parseInt(stats[0].total_purchases)    || 0,
                total_amount:     parseFloat(stats[0].total_amount)     || 0,
                average_purchase: parseFloat(stats[0].average_purchase) || 0,
                last_purchase:    stats[0].last_purchase                || null,
            };
        } catch (error) {
            console.error('❌ Error getting customer stats:', error);
            return empty;
        }
    }

    // ── Top productos del cliente ─────────────────────────────────────────────
    async getCustomerTopProducts(customerId, limit = 5) {
        try {
            if (!customerId || customerId <= 0) return [];
            const customer = await this.getById(customerId);
            if (!customer) return [];

            const products = await window.electronAPI.database.query(`
                SELECT
                    si.product_name,
                    SUM(si.quantity)         AS total_quantity,
                    COUNT(DISTINCT s.id)     AS times_purchased,
                    SUM(si.total)            AS total_spent
                FROM sale_items si
                INNER JOIN sales s ON si.sale_id = s.id
                WHERE s.is_cancelled = 0
                  AND (
                      (? IS NOT NULL AND ? != '' AND s.customer_rut   = ?)
                      OR (? IS NOT NULL AND ? != '' AND s.customer_phone = ?)
                  )
                GROUP BY si.product_id, si.product_name
                ORDER BY total_quantity DESC
                LIMIT ?
            `, [
                customer.rut,   customer.rut,   customer.rut,
                customer.phone, customer.phone, customer.phone,
                parseInt(limit) || 5
            ]);

            return Array.isArray(products) ? products : [];
        } catch (error) {
            console.error('❌ Error getting customer top products:', error);
            return [];
        }
    }

    // ── DEBUG: ver qué datos de cliente tienen las ventas ────────────────────
    async diagSalesCustomerData() {
        try {
            const rows = await window.electronAPI.database.query(`
                SELECT DISTINCT
                    customer_name,
                    customer_rut,
                    customer_phone,
                    COUNT(*) AS sale_count
                FROM sales
                WHERE is_cancelled = 0
                  AND (customer_name IS NOT NULL OR customer_rut IS NOT NULL OR customer_phone IS NOT NULL)
                GROUP BY customer_name, customer_rut, customer_phone
                ORDER BY sale_count DESC
                LIMIT 30
            `);
            console.table(rows);
            return rows;
        } catch (error) {
            console.error('Diag error:', error);
            return [];
        }
    }
}

export default CustomerRepository;