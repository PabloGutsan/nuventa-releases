// database/migrations.js
// ============================================================================
//
//  SISTEMA DE MIGRACIONES — Nuventa POS
//  ─────────────────────────────────────────────────────────────────────────
//  Usa PRAGMA user_version (integer nativo de SQLite, siempre disponible).
//
// ============================================================================

const MIGRATIONS = [

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 1 — Baseline v1.0.1
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    1,
        appVersion: '1.0.1',
        description: 'Baseline schema v2.1 — kitchen fields + unlimited_stock',
        up(db) {
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS table_info TEXT`);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS kitchen_notes TEXT`);
            db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unlimited_stock INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE business_info ADD COLUMN IF NOT EXISTS region TEXT`);
            db.exec(`ALTER TABLE business_info ADD COLUMN IF NOT EXISTS city TEXT`);
            db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_negative_stock INTEGER NOT NULL DEFAULT 0`);
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 2 — Motor de promociones v1.0.2
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    2,
        appVersion: '1.0.2',
        description: 'Tablas promotions, promotion_products, sale_promotions',
        up(db) {
            db.exec(`
                CREATE TABLE IF NOT EXISTS promotions (
                    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
                    name                     TEXT    NOT NULL,
                    description              TEXT,
                    type                     TEXT    NOT NULL,
                    discount_type            TEXT    NOT NULL DEFAULT 'percentage',
                    discount_value           REAL    NOT NULL DEFAULT 0,
                    product_id               INTEGER REFERENCES products(id) ON DELETE SET NULL,
                    category_id              INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                    pack_buy_quantity         INTEGER DEFAULT 1,
                    pack_pay_quantity         INTEGER DEFAULT 1,
                    pack_quantity_source     TEXT    DEFAULT 'product_list',
                    minimum_purchase_amount  REAL    DEFAULT 0,
                    starts_at                TEXT,
                    ends_at                  TEXT,
                    is_active                INTEGER NOT NULL DEFAULT 1,
                    created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
                    updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS promotion_products (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
                    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    quantity     INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS sale_promotions (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id          INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                    promotion_id     INTEGER REFERENCES promotions(id) ON DELETE SET NULL,
                    promotion_name   TEXT,
                    promotion_type   TEXT,
                    discount_applied REAL NOT NULL DEFAULT 0,
                    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_promotions_is_active      ON promotions(is_active);
                CREATE INDEX IF NOT EXISTS idx_promotion_products_promo  ON promotion_products(promotion_id);
                CREATE INDEX IF NOT EXISTS idx_sale_promotions_sale      ON sale_promotions(sale_id);
            `);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS applied_promotions TEXT`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS manual_discount      INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_discount   INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_id         INTEGER`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_name       TEXT`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_units      REAL`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_pack_times INTEGER`);
            db.exec(`
                INSERT OR IGNORE INTO system_settings (key, value) VALUES
                    ('promotions_enabled',             '1'),
                    ('discount_manual_item_enabled',   '1'),
                    ('discount_manual_global_enabled', '1'),
                    ('discount_max_percent',           '100');
            `);
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 3 — Descuento desglosado en ventas v1.0.2
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    3,
        appVersion: '1.0.2',
        description: 'promotion_discount y manual_discount en tabla sales',
        up(db) {
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS promotion_discount INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount    INTEGER NOT NULL DEFAULT 0`);
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 4 — Reparacion usuarios pre-migraciones v1.0.3
    //
    // PROBLEMA: Usuarios con la app instalada ANTES del sistema de migraciones
    // tenian user_version = 0. electron.js los trataba como instalacion nueva
    // y estampaba user_version = 3 SIN correr migraciones 1, 2 y 3.
    // Resultado: faltaban todas las columnas de promociones en sale_items,
    // causando el error: "table sale_items has no column named promotion_units"
    //
    // SOLUCION: Re-aplica todas las columnas con IF NOT EXISTS.
    // Si ya existen no hace nada. Si faltan las agrega. 100% segura.
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    4,
        appVersion: '1.0.3',
        description: 'Reparacion columnas faltantes en usuarios pre-migraciones',
        up(db) {
            // Re-aplicar migracion 1
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS table_info TEXT`);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS kitchen_notes TEXT`);
            db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unlimited_stock INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE business_info ADD COLUMN IF NOT EXISTS region TEXT`);
            db.exec(`ALTER TABLE business_info ADD COLUMN IF NOT EXISTS city TEXT`);
            db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_negative_stock INTEGER NOT NULL DEFAULT 0`);

            // Re-aplicar migracion 2
            db.exec(`
                CREATE TABLE IF NOT EXISTS promotions (
                    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
                    name                     TEXT    NOT NULL,
                    description              TEXT,
                    type                     TEXT    NOT NULL,
                    discount_type            TEXT    NOT NULL DEFAULT 'percentage',
                    discount_value           REAL    NOT NULL DEFAULT 0,
                    product_id               INTEGER REFERENCES products(id) ON DELETE SET NULL,
                    category_id              INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                    pack_buy_quantity         INTEGER DEFAULT 1,
                    pack_pay_quantity         INTEGER DEFAULT 1,
                    pack_quantity_source     TEXT    DEFAULT 'product_list',
                    minimum_purchase_amount  REAL    DEFAULT 0,
                    starts_at                TEXT,
                    ends_at                  TEXT,
                    is_active                INTEGER NOT NULL DEFAULT 1,
                    created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
                    updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS promotion_products (
                    id           INTEGER PRIMARY KEY AUTOINCREMENT,
                    promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
                    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    quantity     INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS sale_promotions (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id          INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                    promotion_id     INTEGER REFERENCES promotions(id) ON DELETE SET NULL,
                    promotion_name   TEXT,
                    promotion_type   TEXT,
                    discount_applied REAL NOT NULL DEFAULT 0,
                    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_promotions_is_active      ON promotions(is_active);
                CREATE INDEX IF NOT EXISTS idx_promotion_products_promo  ON promotion_products(promotion_id);
                CREATE INDEX IF NOT EXISTS idx_sale_promotions_sale      ON sale_promotions(sale_id);
            `);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS applied_promotions TEXT`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS manual_discount      INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_discount   INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_id         INTEGER`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_name       TEXT`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_units      REAL`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_pack_times INTEGER`);
            db.exec(`
                INSERT OR IGNORE INTO system_settings (key, value) VALUES
                    ('promotions_enabled',             '1'),
                    ('discount_manual_item_enabled',   '1'),
                    ('discount_manual_global_enabled', '1'),
                    ('discount_max_percent',           '100');
            `);

            // Re-aplicar migracion 3
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS promotion_discount INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount    INTEGER NOT NULL DEFAULT 0`);
        },
    },

];

// ============================================================================
//  RUNNER
// ============================================================================
function runMigrations(db) {
    const userVersion = db.pragma('user_version')[0]?.user_version ?? 0;
    const pending = MIGRATIONS.filter(m => m.version > userVersion);

    if (pending.length === 0) {
        console.log(`[DB] Schema actualizado (version ${userVersion})`);
        return;
    }

    console.log(`[DB] Aplicando ${pending.length} migracion(es) pendientes (desde v${userVersion})...`);

    for (const migration of pending) {
        const applyMigration = db.transaction(() => {
            migration.up(db);
            db.pragma(`user_version = ${migration.version}`);
        });

        try {
            applyMigration();
            console.log(`[DB] Migracion ${migration.version} aplicada: ${migration.description} (app v${migration.appVersion})`);
        } catch (err) {
            console.error(`[DB] Error en migracion ${migration.version}:`, err.message);
            throw new Error(
                `Fallo en migracion ${migration.version} — ${migration.description}.\n` +
                `La base de datos no fue modificada.\nDetalle: ${err.message}`
            );
        }
    }

    const finalVersion = db.pragma('user_version')[0]?.user_version ?? 0;
    console.log(`[DB] BD actualizada a version ${finalVersion}`);
}

module.exports = runMigrations;