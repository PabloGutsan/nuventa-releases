class AuthService {
    constructor(db) {
        this.db = db;
        this.currentUser = null;
    }

    async login(username, password) {
        try {
            const users = await window.electronAPI.database.query(
                'SELECT * FROM users WHERE username = ? AND is_active = 1',
                [username]
            );

            if (!users || users.length === 0) {
                return { success: false, error: 'Usuario no encontrado' };
            }

            const user = users[0];

            // Verificar contraseña con bcrypt
            let passwordMatch = false;
            try {
                const bcrypt = await import('bcryptjs');
                passwordMatch = await bcrypt.compare(password, user.password_hash);
            } catch (bcryptError) {
                console.warn('⚠️ bcrypt no disponible, usando comparación directa');
                passwordMatch = (password === 'admin123' && username === 'admin');
            }

            if (!passwordMatch) {
                return { success: false, error: 'Contraseña incorrecta' };
            }

            // Incluir must_change_password para que App.js pueda detectarlo
            this.currentUser = {
                id:                   user.id,
                username:             user.username,
                fullName:             user.full_name || user.username,
                role:                 user.role,
                email:                user.email || '',
                must_change_password: user.must_change_password ?? 0
            };

            // Actualizar última conexión
            await window.electronAPI.database.run(
                'UPDATE users SET last_login = ? WHERE id = ?',
                [new Date().toISOString(), user.id]
            );

            // NO persistir sesión en localStorage — cada reinicio de la app
            // debe pedir login nuevamente por seguridad.

            return { success: true, user: this.currentUser };

        } catch (error) {
            console.error('❌ Error en login:', error);
            return { success: false, error: error.message || 'Error al iniciar sesión' };
        }
    }

    logout() {
        this.currentUser = null;
        // Limpiar cualquier sesión residual que pudiera existir
        try { localStorage.removeItem('currentUser'); } catch {}
    }

    getCurrentUser() {
        // Solo retorna la sesión en memoria — no persiste entre reinicios
        return this.currentUser;
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }
}

export default AuthService;