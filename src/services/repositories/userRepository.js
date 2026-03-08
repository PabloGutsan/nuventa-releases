// src/services/repositories/userRepository.js
import bcrypt from 'bcryptjs';

const MAX_ACTIVE_USERS = 20;

class UserRepository {
    constructor(db) {
        this.db = db;
    }

    async getAll() {
        try {
            const users = await window.electronAPI.database.query(`
                SELECT id, username, full_name, email, role,
                    is_active, must_change_password,
                    last_login, created_at, updated_at
                FROM users ORDER BY created_at DESC
            `);
            if (!Array.isArray(users)) return [];
            console.log(`✅ ${users.length} usuarios obtenidos`);
            return users;
        } catch (error) {
            console.error('❌ Error getting all users:', error);
            return [];
        }
    }

    async getActive() {
        try {
            const users = await window.electronAPI.database.query(`
                SELECT id, username, full_name, email, role,
                    is_active, must_change_password, last_login, created_at
                FROM users WHERE is_active = 1 ORDER BY full_name ASC
            `);
            if (!Array.isArray(users)) return [];
            return users;
        } catch (error) {
            console.error('❌ Error getting active users:', error);
            return [];
        }
    }

    async getById(id) {
        try {
            if (!id || id <= 0) return null;
            const users = await window.electronAPI.database.query(`
                SELECT id, username, full_name, email, role,
                    is_active, must_change_password,
                    last_login, created_at, updated_at
                FROM users WHERE id = ?
            `, [id]);
            if (!Array.isArray(users) || users.length === 0) return null;
            return users[0];
        } catch (error) {
            console.error('❌ Error getting user by id:', error);
            return null;
        }
    }

    async getByUsername(username) {
        try {
            if (!username || !username.trim()) return null;
            const users = await window.electronAPI.database.query(
                'SELECT * FROM users WHERE username = ?',
                [username.trim()]
            );
            if (!Array.isArray(users) || users.length === 0) return null;
            return users[0];
        } catch (error) {
            console.error('❌ Error getting user by username:', error);
            return null;
        }
    }

    async create(userData) {
        try {
            if (!userData || typeof userData !== 'object') throw new Error('Datos de usuario inválidos');
            if (!userData.username?.trim()) throw new Error('El nombre de usuario es obligatorio');
            if (!userData.password || userData.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
            if (!userData.full_name?.trim()) throw new Error('El nombre completo es obligatorio');
            if (!['admin', 'vendedor', 'inventario'].includes(userData.role)) throw new Error('Rol inválido');

            console.log('➕ Creando usuario:', userData.username);

            const activeUsers = await window.electronAPI.database.query(
                'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
            );
            if (activeUsers?.[0]?.count >= MAX_ACTIVE_USERS) {
                throw new Error(`Límite de ${MAX_ACTIVE_USERS} usuarios activos alcanzado. Desactive un usuario existente para crear uno nuevo.`);
            }

            const existing = await this.getByUsername(userData.username.trim());
            if (existing) throw new Error(`El nombre de usuario "${userData.username}" ya existe`);

            if (userData.email?.trim()) {
                const existingEmail = await window.electronAPI.database.query(
                    'SELECT id FROM users WHERE email = ?', [userData.email.trim()]
                );
                if (existingEmail?.length > 0) throw new Error(`El email "${userData.email}" ya está en uso`);
            }

            const passwordHash = bcrypt.hashSync(userData.password, 10);

            const result = await window.electronAPI.database.run(`
                INSERT INTO users (username, password_hash, full_name, email, role, is_active, must_change_password)
                VALUES (?, ?, ?, ?, ?, 1, 1)
            `, [
                userData.username.trim(), passwordHash, userData.full_name.trim(),
                userData.email ? userData.email.trim() : null, userData.role
            ]);

            console.log('✅ Usuario creado con ID:', result.lastID);
            return { success: true, userId: result.lastID };
        } catch (error) {
            console.error('❌ Error creating user:', error);
            throw error;
        }
    }

    async update(id, userData) {
        try {
            if (!id || id <= 0) throw new Error('ID de usuario inválido');
            if (!userData?.username?.trim()) throw new Error('El nombre de usuario es obligatorio');
            if (!userData?.full_name?.trim()) throw new Error('El nombre completo es obligatorio');
            if (!['admin', 'vendedor', 'inventario'].includes(userData.role)) throw new Error('Rol inválido');

            const existing = await window.electronAPI.database.query(
                'SELECT id FROM users WHERE username = ? AND id != ?', [userData.username.trim(), id]
            );
            if (existing?.length > 0) throw new Error(`El nombre de usuario "${userData.username}" ya está en uso`);

            if (userData.email?.trim()) {
                const existingEmail = await window.electronAPI.database.query(
                    'SELECT id FROM users WHERE email = ? AND id != ?', [userData.email.trim(), id]
                );
                if (existingEmail?.length > 0) throw new Error(`El email "${userData.email}" ya está en uso`);
            }

            await window.electronAPI.database.run(`
                UPDATE users SET username = ?, full_name = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [userData.username.trim(), userData.full_name.trim(), userData.email?.trim() || null, userData.role, id]);

            console.log('✅ Usuario actualizado');
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating user:', error);
            throw error;
        }
    }

    async changePassword(id, newPassword, clearMustChange = false) {
        try {
            if (!id || id <= 0) throw new Error('ID de usuario inválido');
            if (!newPassword || newPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

            const passwordHash = bcrypt.hashSync(newPassword, 10);

            await window.electronAPI.database.run(`
                UPDATE users SET
                    password_hash        = ?,
                    must_change_password = CASE WHEN ? = 1 THEN 0 ELSE must_change_password END,
                    updated_at           = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [passwordHash, clearMustChange ? 1 : 0, id]);

            console.log('✅ Contraseña actualizada');
            return { success: true };
        } catch (error) {
            console.error('❌ Error changing password:', error);
            throw error;
        }
    }

    async requirePasswordChange(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de usuario inválido');
            await window.electronAPI.database.run(`
                UPDATE users SET must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `, [id]);
            return { success: true };
        } catch (error) {
            console.error('❌ Error requiring password change:', error);
            throw error;
        }
    }

    async toggleActive(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de usuario inválido');
            const user = await this.getById(id);
            if (!user) throw new Error('Usuario no encontrado');

            if (user.role === 'admin' && user.is_active) {
                const activeAdmins = await window.electronAPI.database.query(
                    'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1', ['admin']
                );
                if (activeAdmins?.[0]?.count <= 1) throw new Error('No se puede desactivar el último administrador activo');
            }

            await window.electronAPI.database.run(`
                UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [id]);

            const newStatus = user.is_active ? 'desactivado' : 'activado';
            return { success: true, newStatus };
        } catch (error) {
            console.error('❌ Error toggling user active:', error);
            throw error;
        }
    }

    async deactivate(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de usuario inválido');
            const user = await this.getById(id);
            if (!user) throw new Error('Usuario no encontrado');

            if (user.role === 'admin') {
                const activeAdmins = await window.electronAPI.database.query(
                    'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1', ['admin']
                );
                if (activeAdmins?.[0]?.count <= 1) throw new Error('No se puede desactivar el último administrador activo');
            }

            await window.electronAPI.database.run(
                'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error deactivating user:', error);
            throw error;
        }
    }

    async activate(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de usuario inválido');
            const activeCount = await this.countActiveUsers();
            if (activeCount >= MAX_ACTIVE_USERS) {
                throw new Error(`Límite de ${MAX_ACTIVE_USERS} usuarios activos alcanzado. Desactive un usuario existente primero.`);
            }
            await window.electronAPI.database.run(
                'UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error activating user:', error);
            throw error;
        }
    }

    async delete(id) {
        try {
            if (!id || id <= 0) throw new Error('ID de usuario inválido');
            const user = await this.getById(id);
            if (!user) throw new Error('Usuario no encontrado');

            if (user.role === 'admin' && user.is_active) {
                const activeAdmins = await window.electronAPI.database.query(
                    'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1', ['admin']
                );
                if (activeAdmins?.[0]?.count <= 1) throw new Error('No se puede eliminar el último administrador activo');
            }

            await window.electronAPI.database.run(
                'UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]
            );
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting user:', error);
            throw error;
        }
    }

    async verifyPassword(username, password) {
        try {
            if (!username?.trim() || !password) return false;
            const user = await this.getByUsername(username.trim());
            if (!user || !user.is_active) return false;
            return bcrypt.compareSync(password, user.password_hash);
        } catch (error) {
            console.error('❌ Error verifying password:', error);
            return false;
        }
    }

    async login(username, password) {
        try {
            if (!username?.trim()) throw new Error('El nombre de usuario es obligatorio');
            if (!password) throw new Error('La contraseña es obligatoria');

            const user = await this.getByUsername(username.trim());
            if (!user) throw new Error('Usuario o contraseña incorrectos');
            if (!user.is_active) throw new Error('Usuario inactivo. Contacte al administrador.');

            const isValid = bcrypt.compareSync(password, user.password_hash);
            if (!isValid) throw new Error('Usuario o contraseña incorrectos');

            await this.updateLastLogin(user.id);

            const { password_hash, ...userWithoutPassword } = user;
            return { success: true, user: userWithoutPassword };
        } catch (error) {
            console.error('❌ Error en login:', error);
            throw error;
        }
    }

    async updateLastLogin(id) {
        try {
            if (!id || id <= 0) return { success: false };
            await window.electronAPI.database.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [id]
            );
            return { success: true };
        } catch (error) {
            return { success: false };
        }
    }

    async countActiveUsers() {
        try {
            const result = await window.electronAPI.database.query(
                'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
            );
            return parseInt(result?.[0]?.count) || 0;
        } catch (error) {
            return 0;
        }
    }

    async countByRole(role) {
        try {
            if (!['admin', 'vendedor', 'inventario'].includes(role)) return 0;
            const result = await window.electronAPI.database.query(
                'SELECT COUNT(*) as count FROM users WHERE role = ? AND is_active = 1', [role]
            );
            return parseInt(result?.[0]?.count) || 0;
        } catch (error) {
            return 0;
        }
    }

    async getByRole(role) {
        try {
            if (!['admin', 'vendedor', 'inventario'].includes(role)) return [];
            const users = await window.electronAPI.database.query(`
                SELECT id, username, full_name, email, role,
                    is_active, must_change_password, last_login, created_at
                FROM users WHERE role = ? ORDER BY full_name ASC
            `, [role]);
            return Array.isArray(users) ? users : [];
        } catch (error) {
            return [];
        }
    }

    async search(searchTerm) {
        try {
            if (!searchTerm?.trim()) return [];
            const term = `%${searchTerm.trim()}%`;
            const users = await window.electronAPI.database.query(`
                SELECT id, username, full_name, email, role,
                    is_active, must_change_password, last_login, created_at
                FROM users
                WHERE username LIKE ? OR full_name LIKE ? OR email LIKE ?
                ORDER BY full_name ASC
            `, [term, term, term]);
            return Array.isArray(users) ? users : [];
        } catch (error) {
            return [];
        }
    }

    async canAddMoreUsers() {
        try {
            const activeCount = await this.countActiveUsers();
            return activeCount < MAX_ACTIVE_USERS;
        } catch (error) {
            return false;
        }
    }
}

export default UserRepository;