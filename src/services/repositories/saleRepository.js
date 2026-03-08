// src/services/repositories/saleRepository.js

class SaleRepository {
    constructor(db) {
        this.db = db;
    }

    // ============================================================================
    // HELPER: Obtener timestamp local
    // ============================================================================

    getLocalTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    getLocalDate() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // ============================================================================
    // CORE: Generar número de venta único
    // ============================================================================

    async generateSaleNumber() {
        try {
            console.log('🔢 Generando número de venta...');
            const now = new Date();
            const timestamp = now.getTime();
            const saleNumber = `V-${timestamp}`;
            const existing = await window.electronAPI.database.query(
                'SELECT id FROM sales WHERE sale_number = ?',
                [saleNumber]
            );
            if (existing && existing.length > 0) {
                return `V-${timestamp}-${Math.random().toString(36).substr(2, 5)}`;
            }
            console.log('✅ Número de venta generado:', saleNumber);
            return saleNumber;
        } catch (error) {
            console.error('❌ Error generating sale number:', error);
            return `V-${Date.now()}`;
        }
    }

    // ============================================================================
    // CORE: Crear venta completa con transacción
    // ============================================================================

    async createSale(saleData, items) {
        try {
            if (!saleData || typeof saleData !== 'object') throw new Error('Datos de venta inválidos');
            if (!saleData.user_id) throw new Error('El ID de usuario es obligatorio');
            if (!saleData.total || saleData.total <= 0) throw new Error('El total de la venta debe ser mayor a 0');
            if (!saleData.payment_method || !saleData.payment_method.trim()) throw new Error('El método de pago es obligatorio');
            if (!Array.isArray(items) || items.length === 0) throw new Error('La venta debe tener al menos un item');

            for (const item of items) {
                if (!item.product_id) throw new Error('Cada item debe tener un product_id');
                if (!item.quantity || item.quantity <= 0) throw new Error('La cantidad debe ser mayor a 0');
                if (item.unit_price === undefined || item.unit_price < 0) throw new Error('El precio unitario no puede ser negativo');
            }

            console.log('💰 Creando venta:', saleData.sale_number);
            console.log('📦 Items:', items.length);

            for (const item of items) {
                if (item.product_type !== 'service') {
                    const productResult = await window.electronAPI.database.query(
                        'SELECT stock, allow_negative_stock, unlimited_stock, name FROM products WHERE id = ?',
                        [item.product_id]
                    );
                    if (!productResult || productResult.length === 0) throw new Error(`Producto con ID ${item.product_id} no encontrado`);
                    const product = productResult[0];
                    const itemQuantity = parseFloat(item.quantity);
                    // ✅ FIX: respetar unlimited_stock antes de validar stock físico
                    const isUnlimited = product.unlimited_stock === 1 || product.unlimited_stock === true;
                    const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
                    if (!isUnlimited && !allowNegative && product.stock < itemQuantity) {
                        throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Requerido: ${itemQuantity}`);
                    }
                }
            }

            const localTimestamp = this.getLocalTimestamp();
            console.log('🕐 Timestamp local:', localTimestamp);

            const saleResult = await window.electronAPI.database.run(`
                INSERT INTO sales (
                    sale_number, user_id, customer_name, customer_rut, customer_email, customer_phone,
                    subtotal, discount, discount_percent, tax, total,
                    payment_method, cash_received, cash_change,
                    document_type, document_number, notes,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                saleData.sale_number,
                saleData.user_id,
                saleData.customer_name ? saleData.customer_name.trim() : null,
                saleData.customer_rut ? saleData.customer_rut.trim() : null,
                saleData.customer_email ? saleData.customer_email.trim() : null,
                saleData.customer_phone ? saleData.customer_phone.trim() : null,
                parseFloat(saleData.subtotal) || 0,
                parseFloat(saleData.discount) || 0,
                parseFloat(saleData.discount_percent) || 0,
                parseFloat(saleData.tax) || 0,
                parseFloat(saleData.total),
                saleData.payment_method.trim(),
                saleData.cash_received ? parseFloat(saleData.cash_received) : null,
                saleData.cash_change ? parseFloat(saleData.cash_change) : null,
                saleData.document_type ? saleData.document_type.trim() : null,
                saleData.document_number ? saleData.document_number.trim() : null,
                saleData.notes ? saleData.notes.trim() : null,
                localTimestamp,
                localTimestamp
            ]);

            console.log('📊 Sale result:', saleResult);

            let saleId;
            if (saleResult && typeof saleResult === 'object') {
                saleId = saleResult.lastID || saleResult.lastInsertRowid || saleResult.id || saleResult.insertId;
                if (!saleId && saleResult.changes) {
                    console.log('🔍 Buscando ID por sale_number...');
                    const findResult = await window.electronAPI.database.query(
                        'SELECT id FROM sales WHERE sale_number = ? ORDER BY id DESC LIMIT 1',
                        [saleData.sale_number]
                    );
                    if (findResult && findResult.length > 0) {
                        saleId = findResult[0].id;
                        console.log('✅ ID encontrado:', saleId);
                    }
                }
            }

            console.log('🆔 Sale ID obtenido:', saleId);

            if (!saleId || saleId === 0) {
                console.warn('⚠️ No se obtuvo lastID, buscando...');
                const findResult = await window.electronAPI.database.query(
                    'SELECT id FROM sales WHERE sale_number = ? ORDER BY id DESC LIMIT 1',
                    [saleData.sale_number]
                );
                if (findResult && findResult.length > 0) {
                    saleId = findResult[0].id;
                    console.log('✅ ID recuperado:', saleId);
                } else {
                    throw new Error('No se pudo obtener el ID de la venta creada');
                }
            }

            for (const item of items) {
                console.log('📦 Agregando item:', item.product_name);
                const itemQuantity = parseFloat(item.quantity);
                const itemUnitPrice = parseFloat(item.unit_price);
                const itemCostPrice = parseFloat(item.cost_price) || 0;
                const itemSubtotal = parseFloat(item.subtotal);
                const itemDiscount = parseFloat(item.discount) || 0;
                const itemTax = parseFloat(item.tax) || 0;
                const itemTotal = parseFloat(item.total);

                console.log(`  📊 Cantidad: ${itemQuantity} ${item.unit_label || ''}`);

                await window.electronAPI.database.run(`
                    INSERT INTO sale_items (
                        sale_id, product_id, product_name, product_sku,
                        quantity, unit_label, unit_type,
                        unit_price, cost_price, subtotal,
                        discount, tax, total,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    saleId, item.product_id, item.product_name, item.product_sku || null,
                    itemQuantity, item.unit_label || 'un', item.unit_type || 'unidad',
                    itemUnitPrice, itemCostPrice, itemSubtotal,
                    itemDiscount, itemTax, itemTotal,
                    localTimestamp
                ]);

                if (item.product_type !== 'service') {
                    // ✅ FIX: verificar unlimited_stock antes de descontar stock
                    const prodCheck = await window.electronAPI.database.query(
                        'SELECT stock, unlimited_stock FROM products WHERE id = ?', [item.product_id]
                    );
                    const prodData = prodCheck && prodCheck.length > 0 ? prodCheck[0] : {};
                    const prodUnlimited = prodData.unlimited_stock === 1 || prodData.unlimited_stock === true;

                    if (!prodUnlimited) {
                        console.log(`📉 Actualizando stock del producto ${item.product_id}: -${itemQuantity}`);
                        const previousStock = parseFloat(prodData.stock) || 0;

                        await window.electronAPI.database.run(`
                            UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?
                        `, [itemQuantity, localTimestamp, item.product_id]);

                        await window.electronAPI.database.run(`
                            INSERT INTO inventory_movements (
                                product_id, movement_type, quantity,
                                previous_stock, new_stock, reason,
                                reference_type, reference_id, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `, [
                            item.product_id, 'venta', itemQuantity,
                            previousStock, previousStock - itemQuantity,
                            `Venta ${saleData.sale_number}`, 'sale', saleId, localTimestamp
                        ]);
                    } else {
                        console.log(`♾️ Producto ${item.product_id} es unlimited_stock — sin descuento de stock`);
                    }
                }
            }

            console.log('✅ Venta completada exitosamente con ID:', saleId);
            return {
                success: true,
                saleId: Number(saleId),
                saleNumber: saleData.sale_number,
                timestamp: localTimestamp
            };
        } catch (error) {
            console.error('❌ Error creating sale:', error);
            throw error;
        }
    }

    // ============================================================================
    // QUERIES: Obtener ventas
    // ============================================================================

    async getSaleById(id) {
    try {
        const sales = await window.electronAPI.database.query(`
            SELECT
                s.*,
                u.full_name  AS seller_name,
                cu.full_name AS canceller_name
            FROM sales s
            LEFT JOIN users u  ON s.user_id      = u.id
            LEFT JOIN users cu ON s.cancelled_by = cu.id
            WHERE s.id = ?
        `, [id]);

        if (!Array.isArray(sales) || sales.length === 0) return null;

        const items = await window.electronAPI.database.query(`
            SELECT * FROM sale_items
            WHERE sale_id = ?
            ORDER BY id ASC
        `, [id]);

        return {
            ...sales[0],
            items: Array.isArray(items) ? items : [],
        };
    } catch (error) {
        console.error('❌ Error getting sale by ID:', error);
        return null;
    }
}

    async getSaleByNumber(saleNumber) {
        try {
            if (!saleNumber || !saleNumber.trim()) { console.warn('⚠️ Número de venta inválido'); return null; }
            console.log('🔍 Buscando venta:', saleNumber);
            const sales = await window.electronAPI.database.query(`
                SELECT s.*, u.full_name as seller_name
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.sale_number = ?
            `, [saleNumber.trim()]);
            if (!Array.isArray(sales) || sales.length === 0) { console.log('⚠️ Venta no encontrada'); return null; }
            const items = await window.electronAPI.database.query(`
                SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id
            `, [sales[0].id]);
            const sale = { ...sales[0], items: Array.isArray(items) ? items : [] };
            console.log('✅ Venta encontrada:', sale.sale_number);
            return sale;
        } catch (error) {
            console.error('❌ Error getting sale by number:', error);
            return null;
        }
    }

    async getAll() {
        try {
            console.log('💰 Obteniendo todas las ventas...');
            const sales = await window.electronAPI.database.query(`
                SELECT 
                    s.*,
                    u.full_name as seller_name,
                    (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count,
                    (SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id) as total_items
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.is_cancelled = 0
                ORDER BY s.created_at DESC
            `);
            if (!Array.isArray(sales)) { console.warn('⚠️ Sales query no retornó array'); return []; }
            console.log(`✅ ${sales.length} ventas obtenidas`);
            return sales;
        } catch (error) {
            console.error('❌ Error getting all sales:', error);
            return [];
        }
    }

    async getTodaySales() {
        try {
            console.log('📅 Obteniendo ventas de hoy...');
            const todayDate = this.getLocalDate();
            console.log('📅 Fecha de hoy:', todayDate);
            const sales = await window.electronAPI.database.query(`
                SELECT 
                    s.*,
                    u.full_name as seller_name,
                    (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count,
                    (SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id) as total_items
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE DATE(s.created_at) = ?
                AND s.is_cancelled = 0
                ORDER BY s.created_at DESC
            `, [todayDate]);
            if (!Array.isArray(sales)) { console.warn('⚠️ Today sales query no retornó array'); return []; }
            console.log(`✅ ${sales.length} ventas de hoy obtenidas`);
            return sales;
        } catch (error) {
            console.error('❌ Error getting today sales:', error);
            return [];
        }
    }

    // ============================================================================
    // ACTIONS: Cancelar venta
    // ============================================================================

    async cancelSale(id, userId, reason) {
        try {
            if (!id || id <= 0) throw new Error('ID de venta inválido');
            if (!userId) throw new Error('ID de usuario es obligatorio');
            if (!reason || !reason.trim()) throw new Error('La razón de cancelación es obligatoria');

            console.log('🚫 Cancelando venta ID:', id);
            const sale = await this.getSaleById(id);
            if (!sale) throw new Error('Venta no encontrada');
            if (sale.is_cancelled) throw new Error('La venta ya está cancelada');

            const localTimestamp = this.getLocalTimestamp();

            // ✅ FIX: traer unlimited_stock para no restaurar stock en productos ilimitados
            const items = await window.electronAPI.database.query(`
            SELECT si.*, p.allow_negative_stock, p.unlimited_stock
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ?
        `, [id]);

            for (const item of items) {
                // ✅ FIX: saltar productos con stock ilimitado — igual que en createSale
                const isUnlimited = item.unlimited_stock === 1 || item.unlimited_stock === true;
                if (isUnlimited) {
                    console.log(`♾️ Producto ${item.product_id} es unlimited_stock — sin devolución de stock`);
                    continue;
                }

                const productExists = await window.electronAPI.database.query(
                    'SELECT id, stock FROM products WHERE id = ?', [item.product_id]
                );

                if (productExists && productExists.length > 0) {
                    const itemQuantity = parseFloat(item.quantity);
                    const previousStock = parseFloat(productExists[0].stock);

                    console.log(`📈 Devolviendo stock producto ${item.product_id}: +${itemQuantity}`);

                    await window.electronAPI.database.run(`
                    UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?
                `, [itemQuantity, localTimestamp, item.product_id]);

                    await window.electronAPI.database.run(`
                    INSERT INTO inventory_movements (
                        product_id, movement_type, quantity,
                        previous_stock, new_stock, reason,
                        reference_type, reference_id, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                        item.product_id, 'devolucion', itemQuantity,
                        previousStock, previousStock + itemQuantity,
                        `Cancelación de venta ${sale.sale_number}`,
                        'sale_cancellation', id, localTimestamp
                    ]);
                }
            }

            await window.electronAPI.database.run(`
            UPDATE sales
            SET is_cancelled = 1, cancelled_at = ?, cancelled_by = ?,
                cancellation_reason = ?, updated_at = ?
            WHERE id = ?
        `, [localTimestamp, userId, reason.trim(), localTimestamp, id]);

            console.log('✅ Venta cancelada exitosamente');
            return { success: true };
        } catch (error) {
            console.error('❌ Error cancelling sale:', error);
            throw error;
        }
    }

    // ============================================================================
    // STATS: Estadísticas
    // ============================================================================

    async getTodayStats() {
        try {
            console.log('📊 Obteniendo estadísticas de hoy...');
            const todayDate = this.getLocalDate();
            const stats = await window.electronAPI.database.query(`
                SELECT 
                    COUNT(*) as total_sales,
                    COALESCE(SUM(total), 0) as total_revenue,
                    COALESCE(AVG(total), 0) as average_ticket,
                    COALESCE(SUM(subtotal), 0) as total_subtotal,
                    COALESCE(SUM(discount), 0) as total_discount,
                    COALESCE(SUM(tax), 0) as total_tax
                FROM sales
                WHERE DATE(created_at) = ? AND is_cancelled = 0
            `, [todayDate]);
            if (!Array.isArray(stats) || stats.length === 0) {
                return { total_sales: 0, total_revenue: 0, average_ticket: 0, total_subtotal: 0, total_discount: 0, total_tax: 0 };
            }
            const result = {
                total_sales: parseInt(stats[0].total_sales) || 0,
                total_revenue: parseFloat(stats[0].total_revenue) || 0,
                average_ticket: parseFloat(stats[0].average_ticket) || 0,
                total_subtotal: parseFloat(stats[0].total_subtotal) || 0,
                total_discount: parseFloat(stats[0].total_discount) || 0,
                total_tax: parseFloat(stats[0].total_tax) || 0
            };
            console.log('✅ Estadísticas de hoy:', result);
            return result;
        } catch (error) {
            console.error('❌ Error getting today stats:', error);
            return { total_sales: 0, total_revenue: 0, average_ticket: 0, total_subtotal: 0, total_discount: 0, total_tax: 0 };
        }
    }

    async getPeriodStats(dateFrom, dateTo) {
        try {
            if (!dateFrom || !dateTo) {
                console.warn('⚠️ Fechas inválidas');
                return { total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0, cancelled_revenue: 0 };
            }
            console.log('📊 Estadísticas:', dateFrom, 'a', dateTo);
            const results = await window.electronAPI.database.query(`
                SELECT 
                    COUNT(*) as total_sales,
                    COALESCE(SUM(total), 0) as total_revenue,
                    COALESCE(AVG(total), 0) as average_ticket,
                    COALESCE(SUM(CASE WHEN is_cancelled = 1 THEN 1 ELSE 0 END), 0) as cancelled_sales,
                    COALESCE(SUM(CASE WHEN is_cancelled = 1 THEN total ELSE 0 END), 0) as cancelled_revenue,
                    COALESCE(SUM(subtotal), 0) as total_subtotal,
                    COALESCE(SUM(discount), 0) as total_discount,
                    COALESCE(SUM(tax), 0) as total_tax
                FROM sales
                WHERE DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
            `, [dateFrom, dateTo]);
            if (!Array.isArray(results) || results.length === 0) {
                return { total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0, cancelled_revenue: 0, total_subtotal: 0, total_discount: 0, total_tax: 0 };
            }
            const stats = {
                total_sales: parseInt(results[0].total_sales) || 0,
                total_revenue: parseFloat(results[0].total_revenue) || 0,
                average_ticket: parseFloat(results[0].average_ticket) || 0,
                cancelled_sales: parseInt(results[0].cancelled_sales) || 0,
                cancelled_revenue: parseFloat(results[0].cancelled_revenue) || 0,
                total_subtotal: parseFloat(results[0].total_subtotal) || 0,
                total_discount: parseFloat(results[0].total_discount) || 0,
                total_tax: parseFloat(results[0].total_tax) || 0
            };
            console.log('✅ Estadísticas del período:', stats);
            return stats;
        } catch (error) {
            console.error('❌ Error getting period stats:', error);
            return { total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0, cancelled_revenue: 0 };
        }
    }

    // ✅ NUEVO: Stats de un usuario para un día específico (rol vendedor)
    async getUserDayStats(userId, date) {
        try {
            if (!userId || !date) {
                console.warn('⚠️ userId o date inválido');
                return { total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0 };
            }

            console.log('📊 Stats de usuario:', userId, 'fecha:', date);

            const result = await window.electronAPI.database.query(`
                SELECT
                    COUNT(CASE WHEN is_cancelled = 0 THEN 1 END)          as total_sales,
                    COALESCE(SUM(CASE WHEN is_cancelled = 0 THEN total ELSE 0 END), 0) as total_revenue,
                    COALESCE(AVG(CASE WHEN is_cancelled = 0 THEN total END), 0)        as average_ticket,
                    COUNT(CASE WHEN is_cancelled = 1 THEN 1 END)          as cancelled_sales
                FROM sales
                WHERE user_id = ?
                AND DATE(created_at) = DATE(?)
            `, [userId, date]);

            if (!Array.isArray(result) || result.length === 0) {
                return { total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0 };
            }

            const stats = {
                total_sales: parseInt(result[0].total_sales) || 0,
                total_revenue: parseFloat(result[0].total_revenue) || 0,
                average_ticket: parseFloat(result[0].average_ticket) || 0,
                cancelled_sales: parseInt(result[0].cancelled_sales) || 0,
            };

            console.log('✅ Stats de usuario:', stats);
            return stats;
        } catch (error) {
            console.error('❌ Error getting user day stats:', error);
            return { total_sales: 0, total_revenue: 0, average_ticket: 0, cancelled_sales: 0 };
        }
    }

    async getSalesFiltered(filters = {}) {
        try {
            console.log('🔍 Ventas filtradas:', filters);

            let sql = `
                SELECT 
                    s.*,
                    u.full_name as seller_name,
                    (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as items_count,
                    (SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id) as total_items
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE 1=1
            `;

            const params = [];

            if (filters.search && filters.search.trim()) {
                sql += ` AND (
                    s.sale_number LIKE ? 
                    OR s.customer_name LIKE ? 
                    OR s.document_number LIKE ?
                    OR s.customer_rut LIKE ?
                )`;
                const searchTerm = `%${filters.search.trim()}%`;
                params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            }

            if (filters.dateFrom) {
                sql += ` AND DATE(s.created_at) >= DATE(?)`;
                params.push(filters.dateFrom);
            }

            if (filters.dateTo) {
                sql += ` AND DATE(s.created_at) <= DATE(?)`;
                params.push(filters.dateTo);
            }

            // ✅ Filtro por user_id (rol vendedor — solo sus ventas)
            if (filters.userId) {
                sql += ` AND s.user_id = ?`;
                params.push(filters.userId);
            }

            if (filters.paymentMethod && filters.paymentMethod.trim()) {
                sql += ` AND s.payment_method = ?`;
                params.push(filters.paymentMethod.trim());
            }

            // ✅ NUEVO: Filtro por nombre de vendedor (admin — selector de vendedor)
            if (filters.sellerName && filters.sellerName.trim()) {
                sql += ` AND u.full_name = ?`;
                params.push(filters.sellerName.trim());
            }

            if (filters.documentType && filters.documentType.trim()) {
                sql += ` AND s.document_type = ?`;
                params.push(filters.documentType.trim());
            }

            if (filters.showCancelled === false || filters.showCancelled === 0) {
                sql += ` AND s.is_cancelled = 0`;
            } else if (filters.showCancelled === true || filters.showCancelled === 1) {
                sql += ` AND s.is_cancelled = 1`;
            }

            sql += ` ORDER BY s.created_at DESC`;

            if (filters.limit && parseInt(filters.limit) > 0) {
                sql += ` LIMIT ?`;
                params.push(parseInt(filters.limit));
            }

            const sales = await window.electronAPI.database.query(sql, params);

            if (!Array.isArray(sales)) return [];

            console.log(`✅ ${sales.length} ventas filtradas`);
            return sales;
        } catch (error) {
            console.error('❌ Error getting filtered sales:', error);
            return [];
        }
    }

    async getSalesByPaymentMethod(dateFrom, dateTo) {
        try {
            if (!dateFrom || !dateTo) return [];
            const paymentMethods = await window.electronAPI.database.query(`
                SELECT 
                    payment_method,
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total
                FROM sales
                WHERE DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
                AND is_cancelled = 0
                GROUP BY payment_method
                ORDER BY total DESC
            `, [dateFrom, dateTo]);
            return Array.isArray(paymentMethods) ? paymentMethods : [];
        } catch (error) {
            console.error('❌ Error getting sales by payment method:', error);
            return [];
        }
    }

    async getTopSellingProducts(dateFrom, dateTo, limit = 10) {
        try {
            if (!dateFrom || !dateTo) return [];
            const products = await window.electronAPI.database.query(`
                SELECT 
                    si.product_name,
                    si.product_sku,
                    SUM(si.quantity) as total_quantity,
                    COUNT(DISTINCT si.sale_id) as times_sold,
                    COALESCE(SUM(si.total), 0) as total_revenue,
                    COALESCE(SUM(si.total - (si.cost_price * si.quantity)), 0) as total_profit
                FROM sale_items si
                INNER JOIN sales s ON si.sale_id = s.id
                WHERE DATE(s.created_at) >= DATE(?) AND DATE(s.created_at) <= DATE(?)
                AND s.is_cancelled = 0
                GROUP BY si.product_id, si.product_name, si.product_sku
                ORDER BY total_quantity DESC
                LIMIT ?
            `, [dateFrom, dateTo, parseInt(limit) || 10]);
            return Array.isArray(products) ? products : [];
        } catch (error) {
            console.error('❌ Error getting top selling products:', error);
            return [];
        }
    }

    async getSalesBySeller(dateFrom, dateTo) {
        try {
            if (!dateFrom || !dateTo) return [];
            const sellers = await window.electronAPI.database.query(`
                SELECT 
                    s.user_id,
                    u.full_name as seller_name,
                    COUNT(*) as total_sales,
                    COALESCE(SUM(s.total), 0) as total_revenue,
                    COALESCE(AVG(s.total), 0) as average_ticket
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE DATE(s.created_at) >= DATE(?) AND DATE(s.created_at) <= DATE(?)
                AND s.is_cancelled = 0
                GROUP BY s.user_id, u.full_name
                ORDER BY total_revenue DESC
            `, [dateFrom, dateTo]);
            return Array.isArray(sellers) ? sellers : [];
        } catch (error) {
            console.error('❌ Error getting sales by seller:', error);
            return [];
        }
    }

    async getMonthlyComparison(months = 12) {
        try {
            const comparison = await window.electronAPI.database.query(`
                SELECT 
                    strftime('%Y-%m', created_at) as month,
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total,
                    COALESCE(AVG(total), 0) as average
                FROM sales
                WHERE created_at >= datetime('now', '-${parseInt(months) || 12} months')
                AND is_cancelled = 0
                GROUP BY month
                ORDER BY month DESC
            `);
            return Array.isArray(comparison) ? comparison : [];
        } catch (error) {
            console.error('❌ Error getting monthly comparison:', error);
            return [];
        }
    }
}

export default SaleRepository;