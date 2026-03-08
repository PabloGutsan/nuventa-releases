/**
 * EXPENSE REPOSITORY
 * Maneja todas las operaciones relacionadas con gastos
 */

class ExpenseRepository {
    constructor(db) {
        if (!db) {
            throw new Error('Database connection is required');
        }
        this.db = db;
    }

    /**
     * Obtener timestamp local en formato ISO
     */
    getLocalTimestamp() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localTime = new Date(now - offset);
        return localTime.toISOString().slice(0, 19).replace('T', ' ');
    }

    /**
     * Crear un nuevo gasto
     */
    async create(expenseData) {
        try {
            console.log('💰 Creando nuevo gasto:', expenseData.description);

            const sql = `
                INSERT INTO expenses (
                    category,
                    subcategory,
                    description,
                    amount,
                    supplier_name,
                    supplier_rut,
                    invoice_number,
                    receipt_path,
                    expense_date,
                    payment_method,
                    expense_type,
                    is_recurring,
                    recurrence_frequency,
                    next_due_date,
                    user_id,
                    notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const result = await window.electronAPI.database.run(sql, [
                expenseData.category,
                expenseData.subcategory || null,
                expenseData.description,
                expenseData.amount,
                expenseData.supplier_name || null,
                expenseData.supplier_rut || null,
                expenseData.invoice_number || null,
                expenseData.receipt_path || null,
                expenseData.expense_date,
                expenseData.payment_method || 'efectivo',
                expenseData.expense_type || 'variable',
                expenseData.is_recurring ? 1 : 0,
                expenseData.recurrence_frequency || null,
                expenseData.next_due_date || null,
                expenseData.user_id,
                expenseData.notes || null
            ]);

            console.log('✅ Gasto creado con ID:', result.lastID);
            return result;

        } catch (error) {
            console.error('❌ Error creating expense:', error);
            throw error;
        }
    }

    /**
     * Actualizar un gasto existente
     */
    async update(id, expenseData) {
        try {
            console.log('✏️ Actualizando gasto ID:', id);

            const sql = `
                UPDATE expenses SET
                    category = ?,
                    subcategory = ?,
                    description = ?,
                    amount = ?,
                    supplier_name = ?,
                    supplier_rut = ?,
                    invoice_number = ?,
                    receipt_path = ?,
                    expense_date = ?,
                    payment_method = ?,
                    expense_type = ?,
                    is_recurring = ?,
                    recurrence_frequency = ?,
                    next_due_date = ?,
                    notes = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            const result = await window.electronAPI.database.run(sql, [
                expenseData.category,
                expenseData.subcategory || null,
                expenseData.description,
                expenseData.amount,
                expenseData.supplier_name || null,
                expenseData.supplier_rut || null,
                expenseData.invoice_number || null,
                expenseData.receipt_path || null,
                expenseData.expense_date,
                expenseData.payment_method || 'efectivo',
                expenseData.expense_type || 'variable',
                expenseData.is_recurring ? 1 : 0,
                expenseData.recurrence_frequency || null,
                expenseData.next_due_date || null,
                expenseData.notes || null,
                id
            ]);

            console.log('✅ Gasto actualizado');
            return result;

        } catch (error) {
            console.error('❌ Error updating expense:', error);
            throw error;
        }
    }

    /**
     * Eliminar un gasto
     */
    async delete(id) {
        try {
            console.log('🗑️ Eliminando gasto ID:', id);

            const sql = 'DELETE FROM expenses WHERE id = ?';
            const result = await window.electronAPI.database.run(sql, [id]);

            console.log('✅ Gasto eliminado');
            return result;

        } catch (error) {
            console.error('❌ Error deleting expense:', error);
            throw error;
        }
    }

    /**
     * Obtener gastos con filtros
     */
    async getFiltered(filters = {}) {
        try {
            console.log('🔍 Obteniendo gastos filtrados:', filters);

            let sql = `
                SELECT e.*, u.full_name as user_name
                FROM expenses e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE 1=1
            `;

            const params = [];

            // Filtro de búsqueda
            if (filters.search) {
                sql += ` AND (
                    e.description LIKE ? OR
                    e.supplier_name LIKE ? OR
                    e.notes LIKE ?
                )`;
                const searchTerm = `%${filters.search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            // Filtro de fecha desde
            if (filters.dateFrom) {
                sql += ` AND e.expense_date >= ?`;
                params.push(filters.dateFrom);
            }

            // Filtro de fecha hasta
            if (filters.dateTo) {
                sql += ` AND e.expense_date <= ?`;
                params.push(filters.dateTo);
            }

            // Filtro de categoría
            if (filters.category) {
                sql += ` AND e.category = ?`;
                params.push(filters.category);
            }

            // ✅ NUEVO: Filtro de tipo de gasto
            if (filters.expense_type) {
                sql += ` AND e.expense_type = ?`;
                params.push(filters.expense_type);
            }

            // Ordenar por fecha descendente
            sql += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

            const expenses = await window.electronAPI.database.query(sql, params);

            console.log(`✅ ${expenses?.length || 0} gastos filtrados obtenidos`);
            return expenses || [];

        } catch (error) {
            console.error('❌ Error getting filtered expenses:', error);
            throw error;
        }
    }

    /**
     * Obtener un gasto por ID
     */
    async getById(id) {
        try {
            console.log('🔍 Obteniendo gasto ID:', id);

            const sql = `
                SELECT e.*, u.full_name as user_name
                FROM expenses e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE e.id = ?
            `;

            const expense = await window.electronAPI.database.get(sql, [id]);

            if (expense) {
                console.log('✅ Gasto encontrado:', expense.description);
            } else {
                console.log('⚠️ Gasto no encontrado');
            }

            return expense;

        } catch (error) {
            console.error('❌ Error getting expense by ID:', error);
            throw error;
        }
    }

    /**
     * Obtener todos los gastos
     */
    async getAll() {
        try {
            console.log('📋 Obteniendo todos los gastos');

            const sql = `
                SELECT e.*, u.full_name as user_name
                FROM expenses e
                LEFT JOIN users u ON e.user_id = u.id
                ORDER BY e.expense_date DESC, e.created_at DESC
            `;

            const expenses = await window.electronAPI.database.query(sql, []);

            console.log(`✅ ${expenses?.length || 0} gastos obtenidos`);
            return expenses || [];

        } catch (error) {
            console.error('❌ Error getting all expenses:', error);
            throw error;
        }
    }

    /**
     * Obtener gastos de un período específico
     */
    async getByPeriod(dateFrom, dateTo) {
        try {
            console.log(`📊 Obteniendo gastos del período: ${dateFrom} a ${dateTo}`);

            const sql = `
                SELECT e.*, u.full_name as user_name
                FROM expenses e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE e.expense_date >= ? AND e.expense_date <= ?
                ORDER BY e.expense_date DESC
            `;

            const expenses = await window.electronAPI.database.query(sql, [dateFrom, dateTo]);

            console.log(`✅ ${expenses?.length || 0} gastos del período obtenidos`);
            return expenses || [];

        } catch (error) {
            console.error('❌ Error getting expenses by period:', error);
            throw error;
        }
    }

    /**
     * Obtener gastos por categoría
     */
    async getByCategory(dateFrom, dateTo) {
        try {
            console.log(`📊 Obteniendo gastos por categoría del período: ${dateFrom} a ${dateTo}`);

            const sql = `
                SELECT 
                    category,
                    COUNT(*) as count,
                    SUM(amount) as total,
                    AVG(amount) as average
                FROM expenses
                WHERE expense_date >= ? AND expense_date <= ?
                GROUP BY category
                ORDER BY total DESC
            `;

            const categories = await window.electronAPI.database.query(sql, [dateFrom, dateTo]);

            console.log(`✅ ${categories?.length || 0} categorías obtenidas`);
            return categories || [];

        } catch (error) {
            console.error('❌ Error getting expenses by category:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de gastos de un período
     */
    async getPeriodStats(dateFrom, dateTo) {
        try {
            console.log(`📊 Obteniendo estadísticas del período: ${dateFrom} a ${dateTo}`);

            const sql = `
                SELECT 
                    COUNT(*) as total_expenses,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COALESCE(AVG(amount), 0) as average_expense
                FROM expenses
                WHERE expense_date >= ? AND expense_date <= ?
            `;

            const stats = await window.electronAPI.database.get(sql, [dateFrom, dateTo]);

            if (!stats) {
                return {
                    total_expenses: 0,
                    total_amount: 0,
                    average_expense: 0
                };
            }

            console.log('✅ Estadísticas obtenidas:', stats);
            return stats;

        } catch (error) {
            console.error('❌ Error getting period stats:', error);
            throw error;
        }
    }

    /**
     * Obtener total de gastos de un período
     */
    async getTotalByPeriod(dateFrom, dateTo) {
        try {
            const sql = `
                SELECT COALESCE(SUM(amount), 0) as total
                FROM expenses
                WHERE expense_date >= ? AND expense_date <= ?
            `;

            const result = await window.electronAPI.database.get(sql, [dateFrom, dateTo]);
            return parseFloat(result?.total || 0);

        } catch (error) {
            console.error('❌ Error getting total by period:', error);
            return 0;
        }
    }

    /**
     * Obtener gastos por proveedor
     */
    async getBySupplier(supplierName) {
        try {
            console.log('🏢 Obteniendo gastos del proveedor:', supplierName);

            const sql = `
                SELECT *
                FROM expenses
                WHERE supplier_name = ?
                ORDER BY expense_date DESC
            `;

            const expenses = await window.electronAPI.database.query(sql, [supplierName]);

            console.log(`✅ ${expenses?.length || 0} gastos del proveedor obtenidos`);
            return expenses || [];

        } catch (error) {
            console.error('❌ Error getting expenses by supplier:', error);
            throw error;
        }
    }

    /**
     * Obtener lista de proveedores únicos
     */
    async getSuppliers() {
        try {
            console.log('🏢 Obteniendo lista de proveedores');

            const sql = `
                SELECT DISTINCT supplier_name
                FROM expenses
                WHERE supplier_name IS NOT NULL AND supplier_name != ''
                ORDER BY supplier_name ASC
            `;

            const suppliers = await window.electronAPI.database.query(sql, []);

            console.log(`✅ ${suppliers?.length || 0} proveedores encontrados`);
            return suppliers || [];

        } catch (error) {
            console.error('❌ Error getting suppliers:', error);
            throw error;
        }
    }

    /**
     * Obtener gastos recurrentes
     */
    async getRecurring() {
        try {
            console.log('🔄 Obteniendo gastos recurrentes');

            const sql = `
                SELECT e.*, u.full_name as user_name
                FROM expenses e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE e.is_recurring = 1
                ORDER BY e.next_due_date ASC
            `;

            const expenses = await window.electronAPI.database.query(sql, []);

            console.log(`✅ ${expenses?.length || 0} gastos recurrentes obtenidos`);
            return expenses || [];

        } catch (error) {
            console.error('❌ Error getting recurring expenses:', error);
            throw error;
        }
    }

    // ========================================================================
    // ✅ NUEVOS MÉTODOS - ANÁLISIS FINANCIERO
    // ========================================================================

    /**
     * Obtener gastos fijos vs variables
     */
    async getFixedVsVariable(dateFrom, dateTo) {
        try {
            console.log('📊 Obteniendo gastos fijos vs variables:', { dateFrom, dateTo });

            const sql = `
                SELECT 
                    expense_type,
                    COUNT(*) as count,
                    SUM(amount) as total,
                    AVG(amount) as average
                FROM expenses
                WHERE expense_date >= ? AND expense_date <= ?
                GROUP BY expense_type
            `;

            const result = await window.electronAPI.database.query(sql, [dateFrom, dateTo]);

            console.log('✅ Gastos fijos vs variables:', result);
            return result || [];

        } catch (error) {
            console.error('❌ Error getting fixed vs variable:', error);
            throw error;
        }
    }

    /**
     * Calcular punto de equilibrio
     */
    async getBreakEvenPoint(dateFrom, dateTo) {
        try {
            console.log('🎯 Calculando punto de equilibrio:', { dateFrom, dateTo });

            const sql = `
                SELECT 
                    SUM(CASE WHEN expense_type = 'fijo' THEN amount ELSE 0 END) as fixed_expenses,
                    SUM(CASE WHEN expense_type = 'variable' THEN amount ELSE 0 END) as variable_expenses,
                    SUM(amount) as total_expenses
                FROM expenses
                WHERE expense_date >= ? AND expense_date <= ?
            `;

            const result = await window.electronAPI.database.get(sql, [dateFrom, dateTo]);

            console.log('✅ Punto de equilibrio calculado:', result);
            return result || { fixed_expenses: 0, variable_expenses: 0, total_expenses: 0 };

        } catch (error) {
            console.error('❌ Error calculating break-even point:', error);
            throw error;
        }
    }

    /**
     * Obtener próximos gastos recurrentes (próximos N días)
     */
    async getUpcomingRecurring(daysAhead = 30) {
        try {
            console.log('📅 Obteniendo gastos recurrentes próximos:', daysAhead, 'días');

            const today = new Date().toISOString().split('T')[0];
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysAhead);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const sql = `
                SELECT *
                FROM expenses
                WHERE is_recurring = 1
                AND next_due_date IS NOT NULL
                AND next_due_date >= ?
                AND next_due_date <= ?
                ORDER BY next_due_date ASC
            `;

            const result = await window.electronAPI.database.query(sql, [today, futureDateStr]);

            console.log(`✅ ${result?.length || 0} gastos recurrentes próximos`);
            return result || [];

        } catch (error) {
            console.error('❌ Error getting upcoming recurring:', error);
            throw error;
        }
    }

    /**
     * Obtener resumen de gastos por mes
     */
    async getMonthlyTrend(year) {
        try {
            console.log('📊 Obteniendo tendencia mensual para año:', year);

            const sql = `
                SELECT 
                    strftime('%m', expense_date) as month,
                    COUNT(*) as total_expenses,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_expense
                FROM expenses
                WHERE strftime('%Y', expense_date) = ?
                GROUP BY month
                ORDER BY month ASC
            `;

            const result = await window.electronAPI.database.query(sql, [year.toString()]);

            console.log(`✅ Tendencia mensual obtenida: ${result?.length || 0} meses`);
            return result || [];

        } catch (error) {
            console.error('❌ Error getting monthly trend:', error);
            throw error;
        }
    }

    /**
     * Buscar gastos por texto
     */
    async search(searchTerm) {
        try {
            console.log('🔍 Buscando gastos:', searchTerm);

            const sql = `
                SELECT e.*, u.full_name as user_name
                FROM expenses e
                LEFT JOIN users u ON e.user_id = u.id
                WHERE 
                    e.description LIKE ? OR
                    e.supplier_name LIKE ? OR
                    e.notes LIKE ? OR
                    e.invoice_number LIKE ?
                ORDER BY e.expense_date DESC
            `;

            const term = `%${searchTerm}%`;
            const expenses = await window.electronAPI.database.query(sql, [term, term, term, term]);

            console.log(`✅ ${expenses?.length || 0} gastos encontrados`);
            return expenses || [];

        } catch (error) {
            console.error('❌ Error searching expenses:', error);
            throw error;
        }
    }
}

export default ExpenseRepository;