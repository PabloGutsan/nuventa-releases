// src/services/repositories/productRepository.js

class ProductRepository {
    constructor(db) {
        this.db = db;
    }

    // ✅ ASYNC con AWAIT - Obtener todos los productos
    async getAll() {
        try {
            console.log('📦 Obteniendo todos los productos...');

            // ✅ AWAIT - Esperar consulta (INCLUYE NUEVOS CAMPOS)
            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    (p.sale_price - p.cost_price) as profit_amount,
                    CASE 
                        WHEN p.cost_price > 0 
                        THEN ROUND(((p.sale_price - p.cost_price) / p.cost_price) * 100, 2)
                        ELSE 0 
                    END as profit_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1
                ORDER BY p.name ASC
            `);

            if (!Array.isArray(products)) {
                console.warn('⚠️ Products query no retornó array');
                return [];
            }

            console.log(`✅ ${products.length} productos obtenidos`);
            return products;
        } catch (error) {
            console.error('❌ Error getting all products:', error);
            return [];
        }
    }

    async search(term) {
        try {
            if (!term || !term.trim()) {
                console.warn('⚠️ Término de búsqueda vacío');
                return [];
            }

            console.log('🔍 Buscando productos:', term);

            const searchTerm = `%${term.trim()}%`;

            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    (p.sale_price - p.cost_price) as profit_amount,
                    CASE 
                        WHEN p.cost_price > 0 
                        THEN ROUND(((p.sale_price - p.cost_price) / p.cost_price) * 100, 2)
                        ELSE 0 
                    END as profit_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1 
                AND (
                    p.name LIKE ? 
                    OR p.sku LIKE ?
                    OR p.barcode LIKE ?
                )
                ORDER BY p.name ASC
            `, [searchTerm, searchTerm, searchTerm]);

            if (!Array.isArray(products)) {
                console.warn('⚠️ Search query no retornó array');
                return [];
            }

            console.log(`✅ ${products.length} productos encontrados`);
            return products;
        } catch (error) {
            console.error('❌ Error searching products:', error);
            return [];
        }
    }

    async getByBarcode(barcode) {
        try {
            if (!barcode || !barcode.trim()) {
                console.warn('⚠️ Código de barras inválido');
                return null;
            }

            console.log('🔍 Buscando producto por código de barras:', barcode);

            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    (p.sale_price - p.cost_price) as profit_amount,
                    CASE 
                        WHEN p.cost_price > 0 
                        THEN ROUND(((p.sale_price - p.cost_price) / p.cost_price) * 100, 2)
                        ELSE 0 
                    END as profit_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.barcode = ? AND p.is_active = 1
            `, [barcode.trim()]);

            if (!Array.isArray(products) || products.length === 0) {
                console.log('⚠️ Producto no encontrado por código de barras');
                return null;
            }

            console.log('✅ Producto encontrado:', products[0].name);
            return products[0];
        } catch (error) {
            console.error('❌ Error getting product by barcode:', error);
            return null;
        }
    }

    async getBySKU(sku) {
        try {
            if (!sku || !sku.trim()) {
                console.warn('⚠️ SKU inválido');
                return null;
            }

            console.log('🔍 Buscando producto por SKU:', sku);

            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    (p.sale_price - p.cost_price) as profit_amount,
                    CASE 
                        WHEN p.cost_price > 0 
                        THEN ROUND(((p.sale_price - p.cost_price) / p.cost_price) * 100, 2)
                        ELSE 0 
                    END as profit_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.sku = ? AND p.is_active = 1
            `, [sku.trim()]);

            if (!Array.isArray(products) || products.length === 0) {
                console.log('⚠️ Producto no encontrado por SKU');
                return null;
            }

            console.log('✅ Producto encontrado:', products[0].name);
            return products[0];
        } catch (error) {
            console.error('❌ Error getting product by SKU:', error);
            return null;
        }
    }

    async getById(id) {
        try {
            if (!id || id <= 0) {
                console.warn('⚠️ ID inválido:', id);
                return null;
            }

            console.log('🔍 Buscando producto ID:', id);

            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    (p.sale_price - p.cost_price) as profit_amount,
                    CASE 
                        WHEN p.cost_price > 0 
                        THEN ROUND(((p.sale_price - p.cost_price) / p.cost_price) * 100, 2)
                        ELSE 0 
                    END as profit_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.id = ?
            `, [id]);

            if (!Array.isArray(products) || products.length === 0) {
                console.log('⚠️ Producto no encontrado');
                return null;
            }

            console.log('✅ Producto encontrado:', products[0].name);
            return products[0];
        } catch (error) {
            console.error('❌ Error getting product by id:', error);
            return null;
        }
    }

    // ✅ MEJORADO: Crear producto con unit_type, unit_label, allows_decimal
    async create(product) {
        try {
            if (!product || typeof product !== 'object') {
                throw new Error('Datos del producto inválidos');
            }

            if (!product.name || !product.name.trim()) {
                throw new Error('El nombre del producto es obligatorio');
            }

            if (!product.sale_price || product.sale_price <= 0) {
                throw new Error('El precio de venta debe ser mayor a 0');
            }

            // Validar SKU único
            if (product.sku && product.sku.trim()) {
                const existingSKU = await this.getBySKU(product.sku.trim());
                if (existingSKU) {
                    throw new Error(`Ya existe un producto con el SKU: ${product.sku}`);
                }
            }

            // Validar código de barras único
            if (product.barcode && product.barcode.trim()) {
                const existingBarcode = await this.getByBarcode(product.barcode.trim());
                if (existingBarcode) {
                    throw new Error(`Ya existe un producto con el código de barras: ${product.barcode}`);
                }
            }

            console.log('➕ Creando producto:', product.name);

            // ✅ NUEVO: Incluir unit_type, unit_label, allows_decimal
            const result = await window.electronAPI.database.run(`
                INSERT INTO products (
                    type, sku, barcode, name, description, category_id,
                    cost_price, sale_price, stock, min_stock,
                    unit, unit_type, unit_label, allows_decimal,
                   image_path, is_active, unlimited_stock
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                product.type || 'product',
                product.sku ? product.sku.trim() : null,
                product.barcode ? product.barcode.trim() : null,
                product.name.trim(),
                product.description ? product.description.trim() : null,
                product.category_id || null,
                parseFloat(product.cost_price) || 0,
                parseFloat(product.sale_price),
                parseFloat(product.stock) || 0,
                parseFloat(product.min_stock) || 0,
                product.unit ? product.unit.trim() : 'unidad',
                product.unit_type || 'unidad',
                product.unit_label || 'un',
                product.allows_decimal ? 1 : 0,
                product.image_path || null,
                product.is_active !== undefined ? product.is_active : 1,
                product.unlimited_stock ? 1 : 0
            ]);

            console.log('✅ Producto creado con ID:', result.lastID);
            return { success: true, productId: result.lastID };
        } catch (error) {
            console.error('❌ Error creating product:', error);
            throw error;
        }
    }

    // ✅ MEJORADO: Actualizar producto con unit_type, unit_label, allows_decimal
    async update(id, product) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID de producto inválido');
            }

            if (!product || typeof product !== 'object') {
                throw new Error('Datos del producto inválidos');
            }

            if (!product.name || !product.name.trim()) {
                throw new Error('El nombre del producto es obligatorio');
            }

            if (!product.sale_price || product.sale_price <= 0) {
                throw new Error('El precio de venta debe ser mayor a 0');
            }

            // Validar SKU único (si se cambió)
            if (product.sku && product.sku.trim()) {
                const existingSKU = await this.getBySKU(product.sku.trim());
                if (existingSKU && existingSKU.id !== id) {
                    throw new Error(`Ya existe otro producto con el SKU: ${product.sku}`);
                }
            }

            // Validar código de barras único (si se cambió)
            if (product.barcode && product.barcode.trim()) {
                const existingBarcode = await this.getByBarcode(product.barcode.trim());
                if (existingBarcode && existingBarcode.id !== id) {
                    throw new Error(`Ya existe otro producto con el código de barras: ${product.barcode}`);
                }
            }

            console.log('🔄 Actualizando producto ID:', id);

            // ✅ DESPUÉS — agregar stock = ? después de sale_price
            await window.electronAPI.database.run(`
                UPDATE products SET
                    type = ?,
                    sku = ?,
                    barcode = ?,
                    name = ?,
                    description = ?,
                    category_id = ?,
                    cost_price = ?,
                    sale_price = ?,
                    stock = ?, 
                    min_stock = ?,
                    unit = ?,
                    unit_type = ?,
                    unit_label = ?,
                    allows_decimal = ?,
                    image_path = ?,
                    is_active = ?,
                    unlimited_stock = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                product.type || 'product',
                product.sku ? product.sku.trim() : null,
                product.barcode ? product.barcode.trim() : null,
                product.name.trim(),
                product.description ? product.description.trim() : null,
                product.category_id || null,
                parseFloat(product.cost_price) || 0,
                parseFloat(product.sale_price),
                parseFloat(product.stock) || 0,
                parseFloat(product.min_stock) || 0,
                product.unit ? product.unit.trim() : 'unidad',
                product.unit_type || 'unidad',
                product.unit_label || 'un',
                product.allows_decimal ? 1 : 0,
                product.image_path || null,
                product.is_active !== undefined ? product.is_active : 1,
                product.unlimited_stock ? 1 : 0,
                id
            ]);

            console.log('✅ Producto actualizado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating product:', error);
            throw error;
        }
    }

    // ✅ MEJORADO: Actualizar stock (ahora soporta decimales)
    async updateStock(id, quantity, reason = 'ajuste') {
        try {
            if (!id || id <= 0) {
                throw new Error('ID de producto inválido');
            }

            if (quantity === undefined || quantity === null) {
                throw new Error('La cantidad es obligatoria');
            }

            console.log(`📊 Actualizando stock del producto ID ${id}: ${quantity > 0 ? '+' : ''}${quantity}`);

            const product = await this.getById(id);

            if (!product) {
                throw new Error('Producto no encontrado');
            }

            const previousStock = parseFloat(product.stock) || 0;
            const quantityChange = parseFloat(quantity);
            const newStock = previousStock + quantityChange;

            if (newStock < 0 && !product.allow_negative_stock) {
                throw new Error('El stock no puede ser negativo para este producto');
            }

            await window.electronAPI.database.run(`
                UPDATE products 
                SET stock = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [newStock, id]);

            // Registrar movimiento (ahora con cantidades decimales)
            await window.electronAPI.database.run(`
                INSERT INTO inventory_movements (
                    product_id, movement_type, quantity,
                    previous_stock, new_stock, reason
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                id,
                quantity > 0 ? 'entrada' : 'salida',
                Math.abs(quantityChange),
                previousStock,
                newStock,
                reason
            ]);

            console.log(`✅ Stock actualizado: ${previousStock} → ${newStock}`);
            return {
                success: true,
                previousStock,
                newStock
            };
        } catch (error) {
            console.error('❌ Error updating stock:', error);
            throw error;
        }
    }

    // ✅ MEJORADO: Establecer stock exacto (ahora soporta decimales)
    async setStock(id, newStock, reason = 'ajuste manual') {
        try {
            if (!id || id <= 0) {
                throw new Error('ID de producto inválido');
            }

            if (newStock === undefined || newStock === null || newStock < 0) {
                throw new Error('El stock debe ser un número positivo');
            }

            console.log(`📊 Estableciendo stock del producto ID ${id} a: ${newStock}`);

            const product = await this.getById(id);

            if (!product) {
                throw new Error('Producto no encontrado');
            }

            const previousStock = parseFloat(product.stock) || 0;
            const validNewStock = parseFloat(newStock);
            const difference = validNewStock - previousStock;

            await window.electronAPI.database.run(`
                UPDATE products 
                SET stock = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [validNewStock, id]);

            if (difference !== 0) {
                await window.electronAPI.database.run(`
                    INSERT INTO inventory_movements (
                        product_id, movement_type, quantity,
                        previous_stock, new_stock, reason
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    id,
                    'ajuste',
                    Math.abs(difference),
                    previousStock,
                    validNewStock,
                    reason
                ]);
            }

            console.log(`✅ Stock establecido: ${previousStock} → ${validNewStock}`);
            return {
                success: true,
                previousStock,
                newStock: validNewStock
            };
        } catch (error) {
            console.error('❌ Error setting stock:', error);
            throw error;
        }
    }

    async delete(id) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID de producto inválido');
            }

            console.log('🔒 Desactivando producto ID:', id);

            await window.electronAPI.database.run(`
                UPDATE products 
                SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);

            console.log('✅ Producto desactivado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting product:', error);
            throw error;
        }
    }

    async activate(id) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID de producto inválido');
            }

            console.log('🔓 Activando producto ID:', id);

            await window.electronAPI.database.run(`
                UPDATE products 
                SET is_active = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);

            console.log('✅ Producto activado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error activating product:', error);
            throw error;
        }
    }

    // ✅ FIX: Solo contar productos (type='product') con stock bajo, NO servicios
    async getLowStock() {
        try {
            console.log('⚠️ Obteniendo productos con stock bajo...');

            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1 
                AND p.type = 'product'
                AND p.unlimited_stock = 0
                AND p.stock <= p.min_stock
                ORDER BY p.stock ASC
            `);

            if (!Array.isArray(products)) {
                console.warn('⚠️ Low stock query no retornó array');
                return [];
            }

            console.log(`✅ ${products.length} productos con stock bajo`);
            return products;
        } catch (error) {
            console.error('❌ Error getting low stock products:', error);
            return [];
        }
    }

    async getOutOfStock() {
        try {
            console.log('🚫 Obteniendo productos sin stock...');

            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1 
                AND p.type = 'product'
                AND p.stock <= 0
                ORDER BY p.name ASC
            `);

            if (!Array.isArray(products)) {
                console.warn('⚠️ Out of stock query no retornó array');
                return [];
            }

            console.log(`✅ ${products.length} productos sin stock`);
            return products;
        } catch (error) {
            console.error('❌ Error getting out of stock products:', error);
            return [];
        }
    }

    async getByCategory(categoryId) {
        try {
            if (!categoryId || categoryId <= 0) {
                console.warn('⚠️ ID de categoría inválido');
                return [];
            }

            console.log('📂 Obteniendo productos de categoría ID:', categoryId);

            const products = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    (p.sale_price - p.cost_price) as profit_amount,
                    CASE 
                        WHEN p.cost_price > 0 
                        THEN ROUND(((p.sale_price - p.cost_price) / p.cost_price) * 100, 2)
                        ELSE 0 
                    END as profit_percentage
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                WHERE p.is_active = 1 
                AND p.category_id = ?
                ORDER BY p.name ASC
            `, [categoryId]);

            if (!Array.isArray(products)) {
                console.warn('⚠️ Category products query no retornó array');
                return [];
            }

            console.log(`✅ ${products.length} productos de la categoría obtenidos`);
            return products;
        } catch (error) {
            console.error('❌ Error getting products by category:', error);
            return [];
        }
    }

    async getInventoryValue() {
        try {
            console.log('💰 Calculando valorización del inventario...');

            const result = await window.electronAPI.database.query(`
                SELECT 
                    COUNT(*) as total_products,
                    SUM(stock) as total_units,
                    SUM(stock * cost_price) as cost_value,
                    SUM(stock * sale_price) as sale_value,
                    SUM(stock * (sale_price - cost_price)) as potential_profit
                FROM products
                WHERE is_active = 1 AND type = 'product'
            `);

            if (!Array.isArray(result) || result.length === 0) {
                console.warn('⚠️ Inventory value query no retornó datos');
                return {
                    total_products: 0,
                    total_units: 0,
                    cost_value: 0,
                    sale_value: 0,
                    potential_profit: 0
                };
            }

            const stats = {
                total_products: parseInt(result[0].total_products) || 0,
                total_units: parseFloat(result[0].total_units) || 0,
                cost_value: parseFloat(result[0].cost_value) || 0,
                sale_value: parseFloat(result[0].sale_value) || 0,
                potential_profit: parseFloat(result[0].potential_profit) || 0
            };

            console.log('✅ Valorización calculada:', stats);
            return stats;
        } catch (error) {
            console.error('❌ Error getting inventory value:', error);
            return {
                total_products: 0,
                total_units: 0,
                cost_value: 0,
                sale_value: 0,
                potential_profit: 0
            };
        }
    }

    async getCategories() {
        try {
            console.log('📂 Obteniendo categorías...');

            const categories = await window.electronAPI.database.query(`
                SELECT * FROM categories 
                WHERE is_active = 1 
                ORDER BY name ASC
            `);

            if (!Array.isArray(categories)) {
                console.warn('⚠️ Categories query no retornó array');
                return [];
            }

            console.log(`✅ ${categories.length} categorías obtenidas`);
            return categories;
        } catch (error) {
            console.error('❌ Error getting categories:', error);
            return [];
        }
    }
}

export default ProductRepository;