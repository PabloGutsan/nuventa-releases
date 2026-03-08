// src/services/repositories/employeeRepository.js

class EmployeeRepository {
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
    
    async create(employeeData) {
        try {
            console.log('👤 Creando empleado:', employeeData.full_name);

            // ✅ VALIDACIONES
            if (!employeeData.full_name || !employeeData.full_name.trim()) {
                throw new Error('El nombre completo es obligatorio');
            }

            if (!employeeData.rut || !employeeData.rut.trim()) {
                throw new Error('El RUT es obligatorio');
            }

            const localTimestamp = this.getLocalTimestamp();

            const result = await window.electronAPI.database.run(`
                INSERT INTO employees (
                    full_name, rut, position, department, phone, email,
                    address, birth_date, salary, hire_date,
                    bank_name, bank_account, emergency_contact, emergency_phone,
                    is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                employeeData.full_name.trim(),
                employeeData.rut.trim(),
                employeeData.position || null,
                employeeData.department || null,
                employeeData.phone || null,
                employeeData.email || null,
                employeeData.address || null,
                employeeData.birth_date || null,
                employeeData.salary ? parseFloat(employeeData.salary) : null,
                employeeData.hire_date || null,
                employeeData.bank_name || null,
                employeeData.bank_account || null,
                employeeData.emergency_contact || null,
                employeeData.emergency_phone || null,
                1, // is_active
                localTimestamp,
                localTimestamp
            ]);

            let employeeId = result?.lastID || result?.lastInsertRowid;

            if (!employeeId) {
                const findResult = await window.electronAPI.database.query(
                    'SELECT id FROM employees WHERE rut = ? ORDER BY id DESC LIMIT 1',
                    [employeeData.rut.trim()]
                );
                
                if (findResult && findResult.length > 0) {
                    employeeId = findResult[0].id;
                }
            }

            console.log('✅ Empleado creado con ID:', employeeId);
            return { success: true, employeeId };
        } catch (error) {
            console.error('❌ Error creating employee:', error);
            throw error;
        }
    }

    // ============================================================================
    // READ
    // ============================================================================
    
    async getAll() {
        try {
            console.log('👥 Obteniendo todos los empleados...');

            const employees = await window.electronAPI.database.query(`
                SELECT * FROM employees
                ORDER BY is_active DESC, full_name ASC
            `);

            if (!Array.isArray(employees)) {
                console.warn('⚠️ Employees query no retornó array');
                return [];
            }

            console.log(`✅ ${employees.length} empleados obtenidos`);
            return employees;
        } catch (error) {
            console.error('❌ Error getting all employees:', error);
            return [];
        }
    }

    async getActive() {
        try {
            console.log('👥 Obteniendo empleados activos...');

            const employees = await window.electronAPI.database.query(`
                SELECT * FROM employees
                WHERE is_active = 1
                ORDER BY full_name ASC
            `);

            if (!Array.isArray(employees)) {
                console.warn('⚠️ Active employees query no retornó array');
                return [];
            }

            console.log(`✅ ${employees.length} empleados activos`);
            return employees;
        } catch (error) {
            console.error('❌ Error getting active employees:', error);
            return [];
        }
    }

    async getById(id) {
        try {
            if (!id || id <= 0) {
                console.warn('⚠️ ID inválido:', id);
                return null;
            }

            console.log('🔍 Obteniendo empleado ID:', id);

            const employees = await window.electronAPI.database.query(`
                SELECT * FROM employees WHERE id = ?
            `, [id]);

            if (!Array.isArray(employees) || employees.length === 0) {
                console.log('⚠️ Empleado no encontrado');
                return null;
            }

            console.log('✅ Empleado encontrado:', employees[0].full_name);
            return employees[0];
        } catch (error) {
            console.error('❌ Error getting employee by ID:', error);
            return null;
        }
    }

    async getByRut(rut) {
        try {
            if (!rut || !rut.trim()) {
                console.warn('⚠️ RUT inválido');
                return null;
            }

            console.log('🔍 Buscando empleado por RUT:', rut);

            const employees = await window.electronAPI.database.query(`
                SELECT * FROM employees WHERE rut = ?
            `, [rut.trim()]);

            if (!Array.isArray(employees) || employees.length === 0) {
                console.log('⚠️ Empleado no encontrado');
                return null;
            }

            console.log('✅ Empleado encontrado:', employees[0].full_name);
            return employees[0];
        } catch (error) {
            console.error('❌ Error getting employee by RUT:', error);
            return null;
        }
    }

    // ============================================================================
    // UPDATE
    // ============================================================================
    
    async update(id, employeeData) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('✏️ Actualizando empleado ID:', id);

            const localTimestamp = this.getLocalTimestamp();

            await window.electronAPI.database.run(`
                UPDATE employees SET
                    full_name = ?,
                    rut = ?,
                    position = ?,
                    department = ?,
                    phone = ?,
                    email = ?,
                    address = ?,
                    birth_date = ?,
                    salary = ?,
                    hire_date = ?,
                    bank_name = ?,
                    bank_account = ?,
                    emergency_contact = ?,
                    emergency_phone = ?,
                    updated_at = ?
                WHERE id = ?
            `, [
                employeeData.full_name.trim(),
                employeeData.rut.trim(),
                employeeData.position || null,
                employeeData.department || null,
                employeeData.phone || null,
                employeeData.email || null,
                employeeData.address || null,
                employeeData.birth_date || null,
                employeeData.salary ? parseFloat(employeeData.salary) : null,
                employeeData.hire_date || null,
                employeeData.bank_name || null,
                employeeData.bank_account || null,
                employeeData.emergency_contact || null,
                employeeData.emergency_phone || null,
                localTimestamp,
                id
            ]);

            console.log('✅ Empleado actualizado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating employee:', error);
            throw error;
        }
    }

    // ============================================================================
    // ACTIVATE / DEACTIVATE
    // ============================================================================
    
    async activate(id) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('✅ Activando empleado ID:', id);

            const localTimestamp = this.getLocalTimestamp();

            await window.electronAPI.database.run(`
                UPDATE employees SET
                    is_active = 1,
                    updated_at = ?
                WHERE id = ?
            `, [localTimestamp, id]);

            console.log('✅ Empleado activado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error activating employee:', error);
            throw error;
        }
    }

    async deactivate(id, terminationDate = null) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('🔴 Desactivando empleado ID:', id);

            const localTimestamp = this.getLocalTimestamp();

            await window.electronAPI.database.run(`
                UPDATE employees SET
                    is_active = 0,
                    termination_date = ?,
                    updated_at = ?
                WHERE id = ?
            `, [terminationDate, localTimestamp, id]);

            console.log('✅ Empleado desactivado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error deactivating employee:', error);
            throw error;
        }
    }

    // ============================================================================
    // DELETE (Solo si no tiene pagos asociados)
    // ============================================================================
    
    async delete(id) {
        try {
            if (!id || id <= 0) {
                throw new Error('ID inválido');
            }

            console.log('🗑️ Eliminando empleado ID:', id);

            // Verificar si tiene pagos asociados
            const payments = await window.electronAPI.database.query(`
                SELECT COUNT(*) as count FROM payroll WHERE employee_id = ?
            `, [id]);

            if (payments && payments[0] && payments[0].count > 0) {
                throw new Error('No se puede eliminar un empleado con pagos registrados. Desactívalo en su lugar.');
            }

            await window.electronAPI.database.run(`
                DELETE FROM employees WHERE id = ?
            `, [id]);

            console.log('✅ Empleado eliminado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting employee:', error);
            throw error;
        }
    }

    // ============================================================================
    // STATISTICS
    // ============================================================================
    
    async getStats() {
        try {
            console.log('📊 Obteniendo estadísticas de empleados...');

            const stats = await window.electronAPI.database.query(`
                SELECT 
                    COUNT(*) as total_employees,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_employees,
                    SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_employees,
                    COALESCE(AVG(CASE WHEN is_active = 1 AND salary IS NOT NULL THEN salary END), 0) as average_salary
                FROM employees
            `);

            if (!Array.isArray(stats) || stats.length === 0) {
                return {
                    total_employees: 0,
                    active_employees: 0,
                    inactive_employees: 0,
                    average_salary: 0
                };
            }

            const result = {
                total_employees: parseInt(stats[0].total_employees) || 0,
                active_employees: parseInt(stats[0].active_employees) || 0,
                inactive_employees: parseInt(stats[0].inactive_employees) || 0,
                average_salary: parseFloat(stats[0].average_salary) || 0
            };

            console.log('✅ Estadísticas obtenidas:', result);
            return result;
        } catch (error) {
            console.error('❌ Error getting employee stats:', error);
            return {
                total_employees: 0,
                active_employees: 0,
                inactive_employees: 0,
                average_salary: 0
            };
        }
    }
}

export default EmployeeRepository;