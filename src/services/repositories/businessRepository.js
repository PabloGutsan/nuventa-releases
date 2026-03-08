class BusinessRepository {
    constructor(db) {
        this.db = db;
    }

    // ✅ ASYNC con AWAIT - Obtener información del negocio
    async getBusinessInfo() {
        try {
            console.log('🏢 BusinessRepository: Consultando business_info...');

            // ✅ AWAIT - Esperar la consulta
            const result = await window.electronAPI.database.query(
                'SELECT * FROM business_info WHERE id = 1'
            );

            console.log('📊 BusinessRepository result:', result);

            // ✅ VALIDACIÓN - Verificar que sea array y tenga datos
            if (!Array.isArray(result)) {
                console.warn('⚠️ Result no es array:', result);
                return null;
            }

            if (result.length === 0) {
                console.log('⚠️ No hay business_info, creando registro por defecto...');
                
                // ✅ CREAR REGISTRO POR DEFECTO
                await this.createDefaultBusinessInfo();
                
                // ✅ INTENTAR CONSULTAR NUEVAMENTE
                const newResult = await window.electronAPI.database.query(
                    'SELECT * FROM business_info WHERE id = 1'
                );
                
                return Array.isArray(newResult) && newResult.length > 0 ? newResult[0] : null;
            }

            console.log('✅ BusinessRepository: Info encontrada');
            return result[0];

        } catch (error) {
            console.error('❌ Error en getBusinessInfo:', error);
            return null;
        }
    }

    // ✅ ASYNC con AWAIT - Crear registro por defecto
    async createDefaultBusinessInfo() {
        try {
            console.log('➕ Creando business_info por defecto...');

            await window.electronAPI.database.run(`
                INSERT OR IGNORE INTO business_info (
                    id, name, footer_message, currency
                ) VALUES (1, ?, ?, ?)
            `, ['Mi Negocio', '¡Gracias por su compra!', 'CLP']);

            console.log('✅ Business info por defecto creado');
        } catch (error) {
            console.error('❌ Error creando business_info por defecto:', error);
            throw error;
        }
    }

    // ✅ ASYNC con AWAIT - Crear o actualizar información del negocio
    async saveBusinessInfo(data) {
        try {
            // ✅ VALIDACIÓN - Verificar datos
            if (!data || typeof data !== 'object') {
                throw new Error('Datos inválidos');
            }

            console.log('💾 Guardando business info...');

            // ✅ AWAIT - Verificar si existe
            const existing = await this.getBusinessInfo();

            if (existing) {
                // ✅ ACTUALIZAR
                console.log('🔄 Actualizando business info existente...');

                await window.electronAPI.database.run(`
                    UPDATE business_info SET
                        name = ?,
                        rut = ?,
                        legal_name = ?,
                        address = ?,
                        phone = ?,
                        email = ?,
                        website = ?,
                        logo_path = ?,
                        tax_id = ?,
                        footer_message = ?,
                        currency = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = 1
                `, [
                    data.name || 'Mi Negocio',
                    data.rut || null,
                    data.legal_name || null,
                    data.address || null,
                    data.phone || null,
                    data.email || null,
                    data.website || null,
                    data.logo_path || null,
                    data.tax_id || null,
                    data.footer_message || '¡Gracias por su compra!',
                    data.currency || 'CLP'
                ]);

                console.log('✅ Business info actualizado');
            } else {
                // ✅ CREAR
                console.log('➕ Creando nuevo business info...');

                await window.electronAPI.database.run(`
                    INSERT INTO business_info (
                        id, name, rut, legal_name, address, phone, email, 
                        website, logo_path, tax_id, footer_message, currency
                    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    data.name || 'Mi Negocio',
                    data.rut || null,
                    data.legal_name || null,
                    data.address || null,
                    data.phone || null,
                    data.email || null,
                    data.website || null,
                    data.logo_path || null,
                    data.tax_id || null,
                    data.footer_message || '¡Gracias por su compra!',
                    data.currency || 'CLP'
                ]);

                console.log('✅ Business info creado');
            }

            return { success: true };

        } catch (error) {
            console.error('❌ Error saving business info:', error);
            throw error;
        }
    }

    // ✅ ASYNC con AWAIT - Actualizar solo el logo
    async updateLogo(logoPath) {
        try {
            // ✅ VALIDACIÓN - Verificar que existe business_info
            const existing = await this.getBusinessInfo();

            if (!existing) {
                // Crear si no existe
                await this.createDefaultBusinessInfo();
            }

            console.log('🖼️ Actualizando logo...');

            await window.electronAPI.database.run(`
                UPDATE business_info SET
                    logo_path = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
            `, [logoPath || null]);

            console.log('✅ Logo actualizado');
            return { success: true };

        } catch (error) {
            console.error('❌ Error updating logo:', error);
            throw error;
        }
    }

    // ✅ ASYNC con AWAIT - Actualizar solo footer message
    async updateFooterMessage(message) {
        try {
            // ✅ VALIDACIÓN - Verificar que existe business_info
            const existing = await this.getBusinessInfo();

            if (!existing) {
                await this.createDefaultBusinessInfo();
            }

            console.log('📝 Actualizando mensaje de footer...');

            await window.electronAPI.database.run(`
                UPDATE business_info SET
                    footer_message = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
            `, [message || '¡Gracias por su compra!']);

            console.log('✅ Footer message actualizado');
            return { success: true };

        } catch (error) {
            console.error('❌ Error updating footer message:', error);
            throw error;
        }
    }

    // ✅ ASYNC con AWAIT - Verificar si existe business_info
    async exists() {
        try {
            const info = await this.getBusinessInfo();
            return info !== null;
        } catch (error) {
            console.error('❌ Error checking if business_info exists:', error);
            return false;
        }
    }
}

export default BusinessRepository;