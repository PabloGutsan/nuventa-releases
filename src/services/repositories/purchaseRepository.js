// src/services/repositories/purchaseRepository.js

/**
 * ============================================================================
 * PURCHASE REPOSITORY
 * Gestión completa de compras a proveedores
 * ✅ Compatible con window.electronAPI
 * ✅ Alineado al schema real de la DB (v1.2)
 * ✅ Soporte para CREATE y UPDATE de compras
 * ============================================================================
 */

// eslint-disable-next-line no-useless-constructor
class PurchaseRepository {

    // ============================================================================
    // HELPER: Timestamp local
    // ============================================================================

    getLocalTimestamp() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }

    // ============================================================================
    // MIGRACIÓN: añade columnas que NO están en el schema original pero que
    // necesitamos para el módulo de compras (document_type, IVA, condición pago).
    // Los errores "duplicate column" los captura el try/catch — son inofensivos.
    // ============================================================================

    async ensureExtraColumns() {
        const newColumns = [
            { name: 'document_type',       def: "TEXT DEFAULT 'boleta'" },
            { name: 'has_recoverable_tax', def: 'INTEGER DEFAULT 0' },
            { name: 'tax_included',        def: 'INTEGER DEFAULT 1' },
            { name: 'payment_condition',   def: "TEXT DEFAULT 'contado'" },
            { name: 'credit_days',         def: 'INTEGER DEFAULT 0' },
        ];

        for (const col of newColumns) {
            try {
                await window.electronAPI.database.run(
                    `ALTER TABLE purchases ADD COLUMN ${col.name} ${col.def}`
                );
            } catch {
                // "duplicate column name" → ya existe. Ignorar silenciosamente.
            }
        }
    }

    // ============================================================================
    // HELPER: Tasa de impuesto
    // ============================================================================

    async getTaxRate() {
        try {
            const rows = await window.electronAPI.database.query(
                "SELECT value FROM system_settings WHERE key = 'tax_rate'"
            );
            return (Array.isArray(rows) && rows.length > 0) ? parseFloat(rows[0].value) || 19 : 19;
        } catch {
            return 19;
        }
    }

    // ============================================================================
    // HELPER: Calcular totales (neto + IVA)
    // ============================================================================

    async calculateTotals(items, has_recoverable_tax, tax_included) {
        const taxRate = await this.getTaxRate();
        const gross = items.reduce((s, i) => s + (i.quantity * i.unit_cost), 0);

        let subtotal, tax;
        if (!has_recoverable_tax) {
            subtotal = gross; tax = 0;
        } else if (tax_included) {
            subtotal = gross / (1 + taxRate / 100);
            tax = gross - subtotal;
        } else {
            subtotal = gross;
            tax = gross * (taxRate / 100);
        }

        return {
            subtotal: Math.round(subtotal),
            tax:      Math.round(tax),
            total:    Math.round(subtotal + tax)
        };
    }

    // ============================================================================
    // HELPER: Generar número de compra (COMP-YYYY-NNNN)
    // ============================================================================

    async generatePurchaseNumber() {
        try {
            const year = new Date().getFullYear();
            const rows = await window.electronAPI.database.query(
                `SELECT purchase_number FROM purchases WHERE purchase_number LIKE ? ORDER BY id DESC LIMIT 1`,
                [`COMP-${year}-%`]
            );
            if (!Array.isArray(rows) || rows.length === 0) return `COMP-${year}-0001`;
            const n = parseInt(rows[0].purchase_number.split('-')[2] || '0');
            return `COMP-${year}-${String(n + 1).padStart(4, '0')}`;
        } catch {
            return `COMP-${new Date().getFullYear()}-0001`;
        }
    }

    // ============================================================================
    // HELPER: Resolver user_id — si no viene, busca el primer usuario activo
    // ============================================================================

    async resolveUserId(user_id) {
        if (user_id && user_id > 0) return user_id;
        try {
            const rows = await window.electronAPI.database.query(
                'SELECT id FROM users WHERE is_active = 1 ORDER BY id ASC LIMIT 1'
            );
            if (Array.isArray(rows) && rows.length > 0) return rows[0].id;
            const any = await window.electronAPI.database.query(
                'SELECT id FROM users ORDER BY id ASC LIMIT 1'
            );
            if (Array.isArray(any) && any.length > 0) return any[0].id;
        } catch (e) {
            console.warn('⚠️ No se pudo resolver user_id:', e.message);
        }
        return null;
    }

    // ============================================================================
    // CREATE: Registrar nueva compra
    // ============================================================================

    async create(purchaseData) {
        const {
            supplier_id,
            purchase_date,
            document_type,
            document_number,
            has_recoverable_tax,
            tax_included,
            payment_condition,
            credit_days,
            payment_method,
            items,
            notes,
            user_id
        } = purchaseData;

        try {
            console.log('🛒 Creando nueva compra...');

            // Validaciones
            if (!Array.isArray(items) || items.length === 0) throw new Error('Debe agregar al menos un producto');
            if (!document_type) throw new Error('Debe seleccionar el tipo de documento');

            // Migrar columnas nuevas si no existen
            await this.ensureExtraColumns();

            // Resolver user
            const resolved_user_id = await this.resolveUserId(user_id);

            // Número de compra
            const purchase_number = await this.generatePurchaseNumber();
            console.log('📄 Número de compra:', purchase_number);

            // Totales
            const { subtotal, tax, total } = await this.calculateTotals(items, has_recoverable_tax, tax_included);
            console.log('💰 Totales calculados:', { subtotal, tax, total });

            // Fecha vencimiento (crédito)
            let due_date = null;
            if (payment_condition === 'credito' && credit_days > 0) {
                const d = new Date(purchase_date);
                d.setDate(d.getDate() + parseInt(credit_days));
                due_date = d.toISOString().split('T')[0];
            }

            const ts = this.getLocalTimestamp();

            // ── INSERT purchases ──────────────────────────────────────────────
            const purchaseResult = await window.electronAPI.database.run(`
                INSERT INTO purchases (
                    supplier_id,
                    purchase_number,
                    invoice_number,
                    invoice_date,
                    due_date,
                    subtotal,
                    tax,
                    discount,
                    shipping_cost,
                    total,
                    payment_method,
                    payment_status,
                    paid_amount,
                    notes,
                    user_id,
                    document_type,
                    has_recoverable_tax,
                    tax_included,
                    payment_condition,
                    credit_days,
                    created_at,
                    updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `, [
                supplier_id || null,
                purchase_number,
                document_number || null,
                purchase_date,
                due_date,
                subtotal,
                tax,
                0,
                0,
                total,
                payment_method,
                payment_condition === 'contado' ? 'pagado' : 'pendiente',
                payment_condition === 'contado' ? total : 0,
                notes || null,
                resolved_user_id,
                document_type,
                has_recoverable_tax ? 1 : 0,
                tax_included ? 1 : 0,
                payment_condition || 'contado',
                credit_days || 0,
                ts,
                ts
            ]);

            // Obtener ID
            let purchase_id = purchaseResult?.lastID || purchaseResult?.lastInsertRowid;
            if (!purchase_id) {
                const row = await window.electronAPI.database.query(
                    'SELECT id FROM purchases WHERE purchase_number = ? ORDER BY id DESC LIMIT 1',
                    [purchase_number]
                );
                purchase_id = row?.[0]?.id;
            }
            if (!purchase_id) throw new Error('No se pudo obtener el ID de la compra');

            console.log('✅ Compra creada con ID:', purchase_id);

            // ── Procesar ítems ────────────────────────────────────────────────
            for (const item of items) {
                console.log(`📦 Procesando producto ID ${item.product_id}...`);

                const prodRows = await window.electronAPI.database.query(
                    'SELECT id, name, stock, cost_price, unlimited_stock FROM products WHERE id = ?',
                    [item.product_id]
                );
                if (!Array.isArray(prodRows) || !prodRows.length) {
                    console.warn(`⚠️ Producto ${item.product_id} no encontrado, saltando`);
                    continue;
                }
                const product    = prodRows[0];
                const item_total = item.quantity * item.unit_cost;

                // ── INSERT purchase_items ─────────────────────────────────────
                await window.electronAPI.database.run(`
                    INSERT INTO purchase_items (
                        purchase_id,
                        product_id,
                        product_name,
                        quantity,
                        unit_price,
                        subtotal,
                        tax,
                        discount,
                        total,
                        created_at
                    ) VALUES (?,?,?,?,?,?,?,?,?,?)
                `, [
                    purchase_id,
                    item.product_id,
                    product.name,
                    item.quantity,
                    item.unit_cost,
                    item_total,
                    0,
                    0,
                    item_total,
                    ts
                ]);

                // ── Actualizar stock y costo ──────────────────────────────────
                const prev_stock   = parseFloat(product.stock) || 0;
                const is_unlimited = product.unlimited_stock === 1 || product.unlimited_stock === true;
                const new_stock    = is_unlimited ? prev_stock : prev_stock + parseFloat(item.quantity);
                const new_cost     = parseFloat(item.unit_cost);

                console.log(`📊 Stock: ${prev_stock} → ${new_stock} | Costo: ${product.cost_price} → ${new_cost}`);

                if (is_unlimited) {
                    // Solo actualizar costo, el stock no se toca
                    await window.electronAPI.database.run(
                        'UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?',
                        [new_cost, ts, item.product_id]
                    );
                } else {
                    await window.electronAPI.database.run(
                        'UPDATE products SET stock = ?, cost_price = ?, updated_at = ? WHERE id = ?',
                        [new_stock, new_cost, ts, item.product_id]
                    );
                }

                // ── Movimiento de inventario ──────────────────────────────────
                try {
                    await window.electronAPI.database.run(`
                        INSERT INTO inventory_movements (
                            product_id, movement_type, quantity,
                            previous_stock, new_stock,
                            cost_per_unit, total_cost,
                            reason, reference_type, reference_id,
                            user_id, created_at
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                    `, [
                        item.product_id, 'entrada', item.quantity,
                        prev_stock, new_stock,
                        item.unit_cost, item_total,
                        `Compra ${purchase_number}`, 'purchase', purchase_id,
                        resolved_user_id, ts
                    ]);
                } catch (movErr) {
                    console.warn('⚠️ inventory_movements insert falló:', movErr.message);
                }

                // ── Relación producto-proveedor ───────────────────────────────
                if (supplier_id) {
                    await this.updateProductSupplierRelation(item.product_id, supplier_id, item.unit_cost, purchase_date);
                }
            }

            console.log('✅ Compra registrada exitosamente:', purchase_number);

            const purchase = await this.getById(purchase_id);
            return {
                success:  true,
                purchase: purchase,
                message:  `Compra ${purchase_number} registrada exitosamente`
            };

        } catch (error) {
            console.error('❌ Error creating purchase:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // UPDATE: Editar compra existente
    // ▶ Revierte stock original → actualiza cabecera → reemplaza ítems → aplica nuevo stock
    // ============================================================================

    async update(purchase_id, purchaseData) {
        const {
            supplier_id,
            purchase_date,
            document_type,
            document_number,
            has_recoverable_tax,
            tax_included,
            payment_condition,
            credit_days,
            payment_method,
            items,
            notes,
        } = purchaseData;

        try {
            console.log('✏️ Actualizando compra ID:', purchase_id);

            // Validaciones
            if (!purchase_id || purchase_id <= 0) throw new Error('ID de compra inválido');
            if (!Array.isArray(items) || items.length === 0) throw new Error('Debe agregar al menos un producto');
            if (!document_type) throw new Error('Debe seleccionar el tipo de documento');

            // Obtener datos actuales de la compra
            const existing = await window.electronAPI.database.query(
                'SELECT id, purchase_number, payment_condition FROM purchases WHERE id = ?',
                [purchase_id]
            );
            if (!Array.isArray(existing) || !existing.length) throw new Error('Compra no encontrada');
            const { purchase_number } = existing[0];

            const ts = this.getLocalTimestamp();

            // ── 1. Revertir stock de los ítems originales ─────────────────────
            const originalItems = await window.electronAPI.database.query(
                'SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?',
                [purchase_id]
            );

            for (const orig of (originalItems || [])) {
                try {
                    const prodRows = await window.electronAPI.database.query(
                        'SELECT stock, unlimited_stock FROM products WHERE id = ?',
                        [orig.product_id]
                    );
                    if (Array.isArray(prodRows) && prodRows.length > 0) {
                        const prod = prodRows[0];
                        if (!prod.unlimited_stock) {
                            const reverted = Math.max(0, (parseFloat(prod.stock) || 0) - parseFloat(orig.quantity));
                            await window.electronAPI.database.run(
                                'UPDATE products SET stock = ?, updated_at = ? WHERE id = ?',
                                [reverted, ts, orig.product_id]
                            );
                            console.log(`↩️ Stock revertido para producto ${orig.product_id}: +${orig.quantity} descontado`);
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ No se pudo revertir stock de producto', orig.product_id, e.message);
                }
            }

            // ── 2. Calcular nuevos totales ────────────────────────────────────
            const { subtotal, tax, total } = await this.calculateTotals(items, has_recoverable_tax, tax_included);
            console.log('💰 Nuevos totales:', { subtotal, tax, total });

            // ── 3. Recalcular fecha de vencimiento si es crédito ──────────────
            let due_date = null;
            if (payment_condition === 'credito' && credit_days > 0) {
                const d = new Date(purchase_date);
                d.setDate(d.getDate() + parseInt(credit_days));
                due_date = d.toISOString().split('T')[0];
            }

            // ── 4. UPDATE cabecera ────────────────────────────────────────────
            await window.electronAPI.database.run(`
                UPDATE purchases SET
                    supplier_id         = ?,
                    invoice_number      = ?,
                    invoice_date        = ?,
                    due_date            = ?,
                    document_type       = ?,
                    has_recoverable_tax = ?,
                    tax_included        = ?,
                    payment_condition   = ?,
                    credit_days         = ?,
                    payment_method      = ?,
                    notes               = ?,
                    subtotal            = ?,
                    tax                 = ?,
                    total               = ?,
                    payment_status      = ?,
                    paid_amount         = ?,
                    updated_at          = ?
                WHERE id = ?
            `, [
                supplier_id || null,
                document_number || null,
                purchase_date,
                due_date,
                document_type,
                has_recoverable_tax ? 1 : 0,
                tax_included ? 1 : 0,
                payment_condition || 'contado',
                payment_condition === 'credito' ? parseInt(credit_days) || 0 : 0,
                payment_method,
                notes || null,
                subtotal,
                tax,
                total,
                payment_condition === 'contado' ? 'pagado' : 'pendiente',
                payment_condition === 'contado' ? total : 0,
                ts,
                purchase_id,
            ]);

            console.log('✅ Cabecera actualizada para compra:', purchase_number);

            // ── 5. Eliminar ítems anteriores ──────────────────────────────────
            await window.electronAPI.database.run(
                'DELETE FROM purchase_items WHERE purchase_id = ?',
                [purchase_id]
            );

            // ── 6. Insertar nuevos ítems y aplicar stock ──────────────────────
            for (const item of items) {
                const prodRows = await window.electronAPI.database.query(
                    'SELECT id, name, stock, cost_price, unlimited_stock FROM products WHERE id = ?',
                    [item.product_id]
                );
                if (!Array.isArray(prodRows) || !prodRows.length) {
                    console.warn(`⚠️ Producto ${item.product_id} no encontrado, saltando`);
                    continue;
                }
                const product    = prodRows[0];
                const item_total = item.quantity * item.unit_cost;

                // INSERT purchase_item
                await window.electronAPI.database.run(`
                    INSERT INTO purchase_items (
                        purchase_id,
                        product_id,
                        product_name,
                        quantity,
                        unit_price,
                        subtotal,
                        tax,
                        discount,
                        total,
                        created_at
                    ) VALUES (?,?,?,?,?,?,?,?,?,?)
                `, [
                    purchase_id,
                    item.product_id,
                    product.name,
                    item.quantity,
                    item.unit_cost,
                    item_total,
                    0,
                    0,
                    item_total,
                    ts,
                ]);

                // Actualizar stock y costo
                const prev_stock   = parseFloat(product.stock) || 0;
                const is_unlimited = product.unlimited_stock === 1 || product.unlimited_stock === true;
                const new_stock    = is_unlimited ? prev_stock : prev_stock + parseFloat(item.quantity);
                const new_cost     = parseFloat(item.unit_cost);

                if (is_unlimited) {
                    // Solo actualizar costo, el stock no se toca
                    await window.electronAPI.database.run(
                        'UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?',
                        [new_cost, ts, item.product_id]
                    );
                } else {
                    await window.electronAPI.database.run(
                        'UPDATE products SET stock = ?, cost_price = ?, updated_at = ? WHERE id = ?',
                        [new_stock, new_cost, ts, item.product_id]
                    );
                }

                // Actualizar precio de venta si viene
                if (item.sale_price && parseFloat(item.sale_price) > 0) {
                    await window.electronAPI.database.run(
                        'UPDATE products SET sale_price = ?, updated_at = ? WHERE id = ?',
                        [parseFloat(item.sale_price), ts, item.product_id]
                    );
                }

                console.log(`📦 Ítem actualizado: producto ${item.product_id}, stock ${prev_stock} → ${new_stock}`);

                // Movimiento de inventario (ajuste por edición)
                try {
                    await window.electronAPI.database.run(`
                        INSERT INTO inventory_movements (
                            product_id, movement_type, quantity,
                            previous_stock, new_stock,
                            cost_per_unit, total_cost,
                            reason, reference_type, reference_id,
                            user_id, created_at
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                    `, [
                        item.product_id, 'entrada', item.quantity,
                        prev_stock, new_stock,
                        item.unit_cost, item_total,
                        `Edición compra ${purchase_number}`, 'purchase', purchase_id,
                        null, ts
                    ]);
                } catch (movErr) {
                    console.warn('⚠️ inventory_movements insert falló:', movErr.message);
                }

                // Relación producto-proveedor
                if (supplier_id) {
                    await this.updateProductSupplierRelation(item.product_id, supplier_id, item.unit_cost, purchase_date);
                }
            }

            console.log('✅ Compra actualizada exitosamente:', purchase_number);

            const updated = await this.getById(purchase_id);
            return {
                success:  true,
                purchase: updated,
                message:  `Compra ${purchase_number} actualizada exitosamente`
            };

        } catch (error) {
            console.error('❌ Error updating purchase:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // HELPER: Relación producto-proveedor
    // ============================================================================

    async updateProductSupplierRelation(product_id, supplier_id, last_cost, purchase_date) {
        try {
            const ts = this.getLocalTimestamp();
            const existing = await window.electronAPI.database.query(
                'SELECT id FROM product_suppliers WHERE product_id = ? AND supplier_id = ?',
                [product_id, supplier_id]
            );
            if (Array.isArray(existing) && existing.length > 0) {
                await window.electronAPI.database.run(
                    'UPDATE product_suppliers SET cost_price = ?, updated_at = ? WHERE product_id = ? AND supplier_id = ?',
                    [last_cost, ts, product_id, supplier_id]
                );
            } else {
                await window.electronAPI.database.run(`
                    INSERT INTO product_suppliers (product_id, supplier_id, cost_price, created_at, updated_at)
                    VALUES (?,?,?,?,?)
                `, [product_id, supplier_id, last_cost, ts, ts]);
            }
        } catch (e) {
            console.warn('⚠️ product_suppliers update falló:', e.message);
        }
    }

    // ============================================================================
    // DELETE: Eliminar compra y revertir stock
    // ============================================================================

    async delete(purchase_id) {
        try {
            console.log('🗑️ Eliminando compra ID:', purchase_id);

            if (!purchase_id || purchase_id <= 0) throw new Error('ID de compra inválido');

            const existing = await window.electronAPI.database.query(
                'SELECT id, purchase_number FROM purchases WHERE id = ?',
                [purchase_id]
            );
            if (!Array.isArray(existing) || !existing.length) throw new Error('Compra no encontrada');
            const { purchase_number } = existing[0];

            const ts = this.getLocalTimestamp();

            // ── Revertir stock ────────────────────────────────────────────────
            const items = await window.electronAPI.database.query(
                'SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?',
                [purchase_id]
            );

            for (const item of (items || [])) {
                try {
                    const prodRows = await window.electronAPI.database.query(
                        'SELECT stock, unlimited_stock FROM products WHERE id = ?',
                        [item.product_id]
                    );
                    if (Array.isArray(prodRows) && prodRows.length > 0) {
                        const prod = prodRows[0];
                        if (!prod.unlimited_stock) {
                            const reverted = Math.max(0, (parseFloat(prod.stock) || 0) - parseFloat(item.quantity));
                            await window.electronAPI.database.run(
                                'UPDATE products SET stock = ?, updated_at = ? WHERE id = ?',
                                [reverted, ts, item.product_id]
                            );
                            console.log(`↩️ Stock revertido para producto ${item.product_id}`);
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ No se pudo revertir stock de producto', item.product_id, e.message);
                }
            }

            // ── Eliminar ítems y cabecera ─────────────────────────────────────
            await window.electronAPI.database.run(
                'DELETE FROM purchase_items WHERE purchase_id = ?',
                [purchase_id]
            );
            await window.electronAPI.database.run(
                'DELETE FROM purchases WHERE id = ?',
                [purchase_id]
            );

            console.log('✅ Compra eliminada:', purchase_number);
            return { success: true, message: `Compra ${purchase_number} eliminada exitosamente` };

        } catch (error) {
            console.error('❌ Error deleting purchase:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================================================
    // READ: Obtener compra por ID
    // ============================================================================

    async getById(id) {
        try {
            if (!id || id <= 0) return null;

            const purchases = await window.electronAPI.database.query(`
                SELECT p.*,
                       s.business_name as supplier_name,
                       s.rut           as supplier_rut,
                       s.phone         as supplier_phone,
                       u.full_name     as user_name
                FROM purchases p
                LEFT JOIN suppliers s ON p.supplier_id = s.id
                LEFT JOIN users     u ON p.user_id     = u.id
                WHERE p.id = ?
            `, [id]);

            if (!Array.isArray(purchases) || purchases.length === 0) return null;

            const items = await window.electronAPI.database.query(`
                SELECT pi.*,
                       pr.name            as product_name,
                       pr.sku             as product_sku,
                       pr.unit_label,
                       pr.stock           as stock,
                       pr.sale_price      as sale_price,
                       pr.unlimited_stock as unlimited_stock
                FROM purchase_items pi
                LEFT JOIN products pr ON pi.product_id = pr.id
                WHERE pi.purchase_id = ?
                ORDER BY pi.id
            `, [id]);

            return { ...purchases[0], items: Array.isArray(items) ? items : [] };
        } catch (e) {
            console.error('❌ getById:', e);
            return null;
        }
    }

    // ============================================================================
    // READ: Listar compras con filtros
    // ============================================================================

    async getAll(filters = {}) {
        try {
            const { supplier_id, document_type, payment_status, date_from, date_to, search } = filters;

            let query = `
                SELECT p.*,
                       s.business_name as supplier_name,
                       u.full_name     as user_name,
                       (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as items_count
                FROM purchases p
                LEFT JOIN suppliers s ON p.supplier_id = s.id
                LEFT JOIN users     u ON p.user_id     = u.id
                WHERE 1=1
            `;
            const params = [];

            if (supplier_id)    { query += ' AND p.supplier_id = ?';      params.push(supplier_id); }
            if (document_type)  { query += ' AND p.document_type = ?';    params.push(document_type); }
            if (payment_status) { query += ' AND p.payment_status = ?';   params.push(payment_status); }
            if (date_from)      { query += ' AND p.invoice_date >= ?';    params.push(date_from); }
            if (date_to)        { query += ' AND p.invoice_date <= ?';    params.push(date_to); }
            if (search) {
                query += ' AND (p.purchase_number LIKE ? OR p.invoice_number LIKE ? OR s.business_name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`, `%${search}%`);
            }

            query += ' ORDER BY p.invoice_date DESC, p.id DESC';

            const rows = await window.electronAPI.database.query(query, params);
            return Array.isArray(rows) ? rows : [];
        } catch (e) {
            console.error('❌ getAll:', e);
            return [];
        }
    }

    // ============================================================================
    // UPDATE: Registrar pago
    // ============================================================================

    async registerPayment(purchase_id, amount, payment_method, payment_date) {
        try {
            if (!purchase_id || purchase_id <= 0) throw new Error('ID de compra inválido');

            const rows = await window.electronAPI.database.query(
                'SELECT total, paid_amount FROM purchases WHERE id = ?',
                [purchase_id]
            );
            if (!Array.isArray(rows) || !rows.length) throw new Error('Compra no encontrada');

            const p          = rows[0];
            const new_paid   = parseFloat(p.paid_amount) + parseFloat(amount);
            const total_val  = parseFloat(p.total);
            const new_status = new_paid >= total_val ? 'pagado' : new_paid > 0 ? 'parcial' : 'pendiente';

            await window.electronAPI.database.run(`
                UPDATE purchases
                SET paid_amount = ?, payment_status = ?, payment_method = ?, updated_at = ?
                WHERE id = ?
            `, [new_paid, new_status, payment_method, this.getLocalTimestamp(), purchase_id]);

            return { success: true, message: 'Pago registrado exitosamente' };
        } catch (e) {
            console.error('❌ registerPayment:', e);
            throw e;
        }
    }

    // ============================================================================
    // STATISTICS: Resumen IVA por período
    // ============================================================================

    async getTaxSummary(month, year) {
        try {
            const m = String(month).padStart(2, '0'), y = String(year);

            const salesTaxR = await window.electronAPI.database.query(`
                SELECT COALESCE(SUM(tax), 0) as total FROM sales
                WHERE strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
                AND document_type IN ('boleta_electronica','factura_electronica','factura_fisica')
                AND is_cancelled = 0
            `, [y, m]);

            const purchTaxR = await window.electronAPI.database.query(`
                SELECT COALESCE(SUM(tax), 0) as total FROM purchases
                WHERE strftime('%Y', invoice_date) = ? AND strftime('%m', invoice_date) = ?
                AND document_type = 'factura' AND has_recoverable_tax = 1
            `, [y, m]);

            const salesTax     = parseFloat(salesTaxR?.[0]?.total) || 0;
            const purchasesTax = parseFloat(purchTaxR?.[0]?.total) || 0;
            const taxToPay     = salesTax - purchasesTax;

            const taxCfg = await window.electronAPI.database.query(
                "SELECT value FROM system_settings WHERE key = 'tax_name'"
            );
            const taxName = taxCfg?.[0]?.value || 'IVA';

            return { taxName, salesTax, purchasesRecoverable: purchasesTax, taxToPay, status: taxToPay > 0 ? 'Por pagar al SII' : 'A tu favor' };
        } catch (e) {
            console.error('❌ getTaxSummary:', e);
            return { taxName: 'IVA', salesTax: 0, purchasesRecoverable: 0, taxToPay: 0, status: 'Error' };
        }
    }

    // ============================================================================
    // STATISTICS: Estadísticas por mes
    // ============================================================================

    async getStats(month, year) {
        try {
            const m = String(month).padStart(2, '0'), y = String(year);

            const rows = await window.electronAPI.database.query(`
                SELECT
                    COUNT(*) as total_purchases,
                    COALESCE(SUM(total), 0) as total_amount,
                    COALESCE(SUM(CASE WHEN payment_status = 'pendiente' THEN total - paid_amount ELSE 0 END), 0) as pending_amount,
                    COALESCE(SUM(CASE WHEN has_recoverable_tax = 1 THEN tax ELSE 0 END), 0) as recoverable_tax
                FROM purchases
                WHERE strftime('%Y', invoice_date) = ? AND strftime('%m', invoice_date) = ?
            `, [y, m]);

            const r = rows?.[0] || {};
            return {
                total_purchases: parseInt(r.total_purchases)   || 0,
                total_amount:    parseFloat(r.total_amount)    || 0,
                pending_amount:  parseFloat(r.pending_amount)  || 0,
                recoverable_tax: parseFloat(r.recoverable_tax) || 0,
            };
        } catch (e) {
            console.error('❌ getStats:', e);
            return { total_purchases: 0, total_amount: 0, pending_amount: 0, recoverable_tax: 0 };
        }
    }

    // ============================================================================
    // READ: Compras por proveedor
    // ============================================================================

    async getBySupplier(supplier_id) {
        try {
            if (!supplier_id || supplier_id <= 0) return [];

            const rows = await window.electronAPI.database.query(`
                SELECT p.*,
                       (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) as items_count
                FROM purchases p
                WHERE p.supplier_id = ?
                ORDER BY p.invoice_date DESC
            `, [supplier_id]);

            return Array.isArray(rows) ? rows : [];
        } catch (e) {
            console.error('❌ getBySupplier:', e);
            return [];
        }
    }
}

export default PurchaseRepository;