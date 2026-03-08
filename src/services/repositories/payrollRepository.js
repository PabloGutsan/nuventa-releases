// src/services/repositories/payrollRepository.js

class PayrollRepository {
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

    // ============================================================================
    // CREATE
    // ============================================================================
    
    async create(payrollData) {
        try {
            console.log('💰 Creando pago de sueldo...');

            // ✅ VALIDACIONES
            if (!payrollData.employee_id) {
                throw new Error('El ID del empleado es obligatorio');
            }

            if (!payrollData.payment_type || !['dia', 'semana', 'mes'].includes(payrollData.payment_type)) {
                throw new Error('Tipo de pago inválido');
            }

            if (!payrollData.period_month || payrollData.period_month < 1 || payrollData.period_month > 12) {
                throw new Error('Mes inválido');
            }

            if (!payrollData.period_year) {
                throw new Error('Año inválido');
            }

            if (payrollData.base_salary === undefined || payrollData.base_salary <= 0) {
                throw new Error('El sueldo bruto debe ser mayor a 0');
            }

            const localTimestamp = this.getLocalTimestamp();

            const baseSalary = parseFloat(payrollData.base_salary) || 0;
            const legalDeductions = parseFloat(payrollData.legal_deductions) || 0;
            const otherDeductions = parseFloat(payrollData.other_deductions) || 0;
            const totalNet = Math.max(0, baseSalary - legalDeductions - otherDeductions);

            const result = await window.electronAPI.database.run(`
                INSERT INTO payroll (
                    employee_id, payment_type, period_month, period_year, period_description,
                    base_salary, legal_deductions, other_deductions, total_net,
                    payment_date, payment_method, bank_name, bank_account,
                    notes, is_paid, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                payrollData.employee_id,
                payrollData.payment_type,
                payrollData.period_month,
                payrollData.period_year,
                payrollData.period_description || null,
                baseSalary,
                legalDeductions,
                otherDeductions,
                totalNet,
                payrollData.payment_date || null,
                payrollData.payment_method || null,
                payrollData.bank_name || null,
                payrollData.bank_account || null,
                payrollData.notes || null,
                payrollData.is_paid ? 1 : 0,
                localTimestamp,
                localTimestamp
            ]);

            let payrollId = result?.lastID || result?.lastInsertRowid;

            if (!payrollId) {
                const findResult = await window.electronAPI.database.query(
                    `SELECT id FROM payroll 
                     WHERE employee_id = ? AND period_month = ? AND period_year = ?
                     ORDER BY id DESC LIMIT 1`,
                    [payrollData.employee_id, payrollData.period_month, payrollData.period_year]
                );
                
                if (findResult && findResult.length > 0) {
                    payrollId = findResult[0].id;
                }
            }

            console.log('✅ Pago de sueldo creado con ID:', payrollId);
            return { success: true, payrollId };
        } catch (error) {
            console.error('❌ Error creating payroll:', error);
            throw error;
        }
    }

    // ============================================================================
    // READ
    // ============================================================================
    
    async getAll() {
        try {
            console.log('💼 Obteniendo todos los pagos...');

            const payrolls = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    e.full_name as employee_name,
                    e.rut as employee_rut,
                    e.position as employee_position
                FROM payroll p
                LEFT JOIN employees e ON p.employee_id = e.id
                ORDER BY p.period_year DESC, p.period_month DESC, p.created_at DESC
            `);

            if (!Array.isArray(payrolls)) {
                console.warn('⚠️ Payroll query no retornó array');
                return [];
            }

            console.log(`✅ ${payrolls.length} pagos obtenidos`);
            return payrolls;
        } catch (error) {
            console.error('❌ Error getting all payrolls:', error);
            return [];
        }
    }

    async getById(id) {
        try {
            if (!id || id <= 0) {
                console.warn('⚠️ ID inválido:', id);
                return null;
            }

            console.log('🔍 Obteniendo pago ID:', id);

            const payrolls = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    e.full_name as employee_name,
                    e.rut as employee_rut,
                    e.position as employee_position,
                    e.bank_name as employee_bank_name,
                    e.bank_account as employee_bank_account
                FROM payroll p
                LEFT JOIN employees e ON p.employee_id = e.id
                WHERE p.id = ?
            `, [id]);

            if (!Array.isArray(payrolls) || payrolls.length === 0) {
                console.log('⚠️ Pago no encontrado');
                return null;
            }

            console.log('✅ Pago encontrado');
            return payrolls[0];
        } catch (error) {
            console.error('❌ Error getting payroll by ID:', error);
            return null;
        }
    }

    async getByEmployee(employeeId) {
        try {
            if (!employeeId || employeeId <= 0) {
                console.warn('⚠️ Employee ID inválido');
                return [];
            }

            console.log('💼 Obteniendo pagos del empleado:', employeeId);

            const payrolls = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    e.full_name as employee_name,
                    e.rut as employee_rut
                FROM payroll p
                LEFT JOIN employees e ON p.employee_id = e.id
                WHERE p.employee_id = ?
                ORDER BY p.period_year DESC, p.period_month DESC, p.created_at DESC
            `, [employeeId]);

            if (!Array.isArray(payrolls)) {
                console.warn('⚠️ Employee payroll query no retornó array');
                return [];
            }

            console.log(`✅ ${payrolls.length} pagos del empleado obtenidos`);
            return payrolls;
        } catch (error) {
            console.error('❌ Error getting payrolls by employee:', error);
            return [];
        }
    }

    async getByPeriod(month, year) {
        try {
            if (!month || month < 1 || month > 12) {
                throw new Error('Mes inválido');
            }

            if (!year) {
                throw new Error('Año inválido');
            }

            console.log(`💼 Obteniendo pagos de ${month}/${year}...`);

            const payrolls = await window.electronAPI.database.query(`
                SELECT 
                    p.*,
                    e.full_name as employee_name,
                    e.rut as employee_rut,
                    e.position as employee_position
                FROM payroll p
                LEFT JOIN employees e ON p.employee_id = e.id
                WHERE p.period_month = ? AND p.period_year = ?
                ORDER BY e.full_name ASC
            `, [month, year]);

            if (!Array.isArray(payrolls)) {
                console.warn('⚠️ Period payroll query no retornó array');
                return [];
            }

            console.log(`✅ ${payrolls.length} pagos del período obtenidos`);
            return payrolls;
        } catch (error) {
            console.error('❌ Error getting payrolls by period:', error);
            return [];
        }
    }

    // ============================================================================
    // UPDATE
    // ============================================================================
    
    async update(id, payrollData) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('✏️ Actualizando pago ID:', id);

            const localTimestamp = this.getLocalTimestamp();

            const baseSalary = parseFloat(payrollData.base_salary) || 0;
            const legalDeductions = parseFloat(payrollData.legal_deductions) || 0;
            const otherDeductions = parseFloat(payrollData.other_deductions) || 0;
            const totalNet = Math.max(0, baseSalary - legalDeductions - otherDeductions);

            await window.electronAPI.database.run(`
                UPDATE payroll SET
                    payment_type = ?,
                    period_month = ?,
                    period_year = ?,
                    period_description = ?,
                    base_salary = ?,
                    legal_deductions = ?,
                    other_deductions = ?,
                    total_net = ?,
                    payment_date = ?,
                    payment_method = ?,
                    bank_name = ?,
                    bank_account = ?,
                    notes = ?,
                    is_paid = ?,
                    updated_at = ?
                WHERE id = ?
            `, [
                payrollData.payment_type,
                payrollData.period_month,
                payrollData.period_year,
                payrollData.period_description || null,
                baseSalary,
                legalDeductions,
                otherDeductions,
                totalNet,
                payrollData.payment_date || null,
                payrollData.payment_method || null,
                payrollData.bank_name || null,
                payrollData.bank_account || null,
                payrollData.notes || null,
                payrollData.is_paid ? 1 : 0,
                localTimestamp,
                id
            ]);

            console.log('✅ Pago actualizado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating payroll:', error);
            throw error;
        }
    }

    // ============================================================================
    // MARK AS PAID / UNPAID
    // ============================================================================
    
    async markAsPaid(id, paymentDate = null) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('✅ Marcando como pagado:', id);

            const localTimestamp = this.getLocalTimestamp();
            const payDate = paymentDate || localTimestamp.split(' ')[0];

            await window.electronAPI.database.run(`
                UPDATE payroll SET
                    is_paid = 1,
                    payment_date = ?,
                    updated_at = ?
                WHERE id = ?
            `, [payDate, localTimestamp, id]);

            console.log('✅ Marcado como pagado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error marking as paid:', error);
            throw error;
        }
    }

    async markAsUnpaid(id) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('⏳ Marcando como pendiente:', id);

            const localTimestamp = this.getLocalTimestamp();

            await window.electronAPI.database.run(`
                UPDATE payroll SET
                    is_paid = 0,
                    updated_at = ?
                WHERE id = ?
            `, [localTimestamp, id]);

            console.log('✅ Marcado como pendiente');
            return { success: true };
        } catch (error) {
            console.error('❌ Error marking as unpaid:', error);
            throw error;
        }
    }

    // ============================================================================
    // DELETE
    // ============================================================================
    
    async delete(id) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('🗑️ Eliminando pago ID:', id);

            await window.electronAPI.database.run(`
                DELETE FROM payroll WHERE id = ?
            `, [id]);

            console.log('✅ Pago eliminado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting payroll:', error);
            throw error;
        }
    }

    // ============================================================================
    // STATISTICS
    // ============================================================================
    
    async getMonthlyTotal(month, year) {
        try {
            console.log(`📊 Calculando total de sueldos ${month}/${year}...`);

            const result = await window.electronAPI.database.query(`
                SELECT 
                    COALESCE(SUM(total_net), 0) as total_paid,
                    COALESCE(SUM(CASE WHEN is_paid = 1 THEN total_net ELSE 0 END), 0) as paid,
                    COALESCE(SUM(CASE WHEN is_paid = 0 THEN total_net ELSE 0 END), 0) as pending,
                    COUNT(*) as total_count,
                    SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END) as paid_count,
                    SUM(CASE WHEN is_paid = 0 THEN 1 ELSE 0 END) as pending_count
                FROM payroll
                WHERE period_month = ? AND period_year = ?
            `, [month, year]);

            if (!Array.isArray(result) || result.length === 0) {
                return {
                    total_paid: 0,
                    paid: 0,
                    pending: 0,
                    total_count: 0,
                    paid_count: 0,
                    pending_count: 0
                };
            }

            const stats = {
                total_paid: parseFloat(result[0].total_paid) || 0,
                paid: parseFloat(result[0].paid) || 0,
                pending: parseFloat(result[0].pending) || 0,
                total_count: parseInt(result[0].total_count) || 0,
                paid_count: parseInt(result[0].paid_count) || 0,
                pending_count: parseInt(result[0].pending_count) || 0
            };

            console.log('✅ Estadísticas calculadas:', stats);
            return stats;
        } catch (error) {
            console.error('❌ Error getting monthly total:', error);
            return {
                total_paid: 0,
                paid: 0,
                pending: 0,
                total_count: 0,
                paid_count: 0,
                pending_count: 0
            };
        }
    }

    async getYearlyTotal(year) {
        try {
            console.log(`📊 Calculando total anual ${year}...`);

            const result = await window.electronAPI.database.query(`
                SELECT 
                    period_month,
                    COALESCE(SUM(total_net), 0) as total
                FROM payroll
                WHERE period_year = ?
                GROUP BY period_month
                ORDER BY period_month ASC
            `, [year]);

            if (!Array.isArray(result)) {
                return [];
            }

            console.log(`✅ Totales por mes obtenidos: ${result.length} meses`);
            return result;
        } catch (error) {
            console.error('❌ Error getting yearly total:', error);
            return [];
        }
    }

    // ============================================================================
    // FILTERS
    // ============================================================================
    
    async getFiltered(filters = {}) {
        try {
            console.log('🔍 Obteniendo pagos filtrados:', filters);

            let sql = `
                SELECT 
                    p.*,
                    e.full_name as employee_name,
                    e.rut as employee_rut,
                    e.position as employee_position
                FROM payroll p
                LEFT JOIN employees e ON p.employee_id = e.id
                WHERE 1=1
            `;

            const params = [];

            // Filtro por empleado
            if (filters.employee_id) {
                sql += ` AND p.employee_id = ?`;
                params.push(filters.employee_id);
            }

            // Filtro por tipo de pago
            if (filters.payment_type) {
                sql += ` AND p.payment_type = ?`;
                params.push(filters.payment_type);
            }

            // Filtro por mes
            if (filters.period_month) {
                sql += ` AND p.period_month = ?`;
                params.push(filters.period_month);
            }

            // Filtro por año
            if (filters.period_year) {
                sql += ` AND p.period_year = ?`;
                params.push(filters.period_year);
            }

            // Filtro por estado
            if (filters.is_paid !== undefined && filters.is_paid !== null) {
                sql += ` AND p.is_paid = ?`;
                params.push(filters.is_paid ? 1 : 0);
            }

            // Búsqueda libre
            if (filters.search && filters.search.trim()) {
                sql += ` AND (
                    e.full_name LIKE ? OR
                    e.rut LIKE ? OR
                    p.period_description LIKE ?
                )`;
                const searchTerm = `%${filters.search.trim()}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            sql += ` ORDER BY p.period_year DESC, p.period_month DESC, p.created_at DESC`;

            // Límite
            if (filters.limit && parseInt(filters.limit) > 0) {
                sql += ` LIMIT ?`;
                params.push(parseInt(filters.limit));
            }

            const payrolls = await window.electronAPI.database.query(sql, params);

            if (!Array.isArray(payrolls)) {
                console.warn('⚠️ Filtered payroll query no retornó array');
                return [];
            }

            console.log(`✅ ${payrolls.length} pagos filtrados obtenidos`);
            return payrolls;
        } catch (error) {
            console.error('❌ Error getting filtered payrolls:', error);
            return [];
        }
    }
}

export default PayrollRepository;