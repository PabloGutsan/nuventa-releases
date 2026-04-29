// database/migrations.js
// ============================================================================
//
//  SISTEMA DE MIGRACIONES — Nuventa POS
//  ─────────────────────────────────────────────────────────────────────────
//  Usa PRAGMA user_version (integer nativo de SQLite, siempre disponible).
//
//  REGLAS:
//   1. NUNCA modificar una migración ya publicada (versión ≤ user_version actual).
//   2. SIEMPRE agregar nuevas migraciones al FINAL del array.
//   3. El campo `appVersion` es informativo — indica en qué release se incluyó.
//   4. NO usar ALTER TABLE ... ADD COLUMN IF NOT EXISTS — no compatible con
//      SQLite < 3.37. Usar el helper addCol() que hace try/catch por columna.
//   5. schema.sql debe mantenerse actualizado con el último estado completo
//      (para instalaciones nuevas). Las migraciones son solo para upgrades.
//
//  CÓMO USAR:
//      const runMigrations = require('./migrations');
//      runMigrations(db);  // llamar después de db.exec(schema)
//
// ============================================================================

// ── Helper compatible con cualquier versión de SQLite ─────────────────────
// ALTER TABLE IF NOT EXISTS no existe en SQLite < 3.37.
// Si la columna ya existe lanza 'duplicate column name' → se ignora.
// Cualquier otro error se relanza para no silenciar problemas reales.
function addCol(db, table, col, def) {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
    } catch (e) {
        if (!e.message.includes('duplicate column name')) throw e;
    }
}

const MIGRATIONS = [

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 1 — Baseline v1.0.1
    // Schema v2.1 consolidado. Tablas base del sistema más cocina y
    // campo unlimited_stock en productos.
    // Publicado en: v1.0.1 (17 Mar 2026)
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    1,
        appVersion: '1.0.1',
        description: 'Baseline schema v2.1 — kitchen fields + unlimited_stock',
        up(db) {
            // Campos de cocina en sales (agregados en v2.1)
            addCol(db, 'sales', 'table_info',    'TEXT');
            addCol(db, 'sales', 'kitchen_notes', 'TEXT');

            // unlimited_stock en products (agregado en v2.1)
            addCol(db, 'products', 'unlimited_stock', 'INTEGER NOT NULL DEFAULT 0');

            // region y city en business_info (agregados en v2.1)
            addCol(db, 'business_info', 'region', 'TEXT');
            addCol(db, 'business_info', 'city',   'TEXT');

            // allow_negative_stock en products (por si no estaba)
            addCol(db, 'products', 'allow_negative_stock', 'INTEGER NOT NULL DEFAULT 0');
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 2 — Motor de promociones v1.0.2
    // Tablas para el sistema de promociones automáticas del POS.
    // Publicado en: v1.0.2 (18 Mar 2026)
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    2,
        appVersion: '1.0.2',
        description: 'Tablas promotions, promotion_products, sale_promotions',
        up(db) {
            // CREATE TABLE IF NOT EXISTS es compatible con SQLite antiguo
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
                    pack_buy_quantity        INTEGER DEFAULT 1,
                    pack_pay_quantity        INTEGER DEFAULT 1,
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

                CREATE INDEX IF NOT EXISTS idx_promotions_is_active     ON promotions(is_active);
                CREATE INDEX IF NOT EXISTS idx_promotion_products_promo ON promotion_products(promotion_id);
                CREATE INDEX IF NOT EXISTS idx_sale_promotions_sale     ON sale_promotions(sale_id);
            `);

            // Columnas nuevas en tablas existentes
            addCol(db, 'sales',      'applied_promotions',   'TEXT');
            addCol(db, 'sale_items', 'manual_discount',      'INTEGER NOT NULL DEFAULT 0');
            addCol(db, 'sale_items', 'promotion_discount',   'INTEGER NOT NULL DEFAULT 0');
            addCol(db, 'sale_items', 'promotion_id',         'INTEGER');
            addCol(db, 'sale_items', 'promotion_name',       'TEXT');
            addCol(db, 'sale_items', 'promotion_units',      'REAL');
            addCol(db, 'sale_items', 'promotion_pack_times', 'INTEGER');

            // Settings para control de descuentos y promociones en el POS
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
    // Separar promotion_discount y manual_discount a nivel de venta completa
    // para mostrar desglose correcto en ticket, historial y detalle de venta.
    // Publicado en: v1.0.2 (19 Mar 2026)
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    3,
        appVersion: '1.0.2',
        description: 'promotion_discount y manual_discount en tabla sales',
        up(db) {
            addCol(db, 'sales', 'promotion_discount', 'INTEGER NOT NULL DEFAULT 0');
            addCol(db, 'sales', 'manual_discount',    'INTEGER NOT NULL DEFAULT 0');
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 4 — Reparación usuarios con BD existente pre-migraciones
    //
    // CONTEXTO: Las migraciones 1, 2 y 3 usaban originalmente
    // ALTER TABLE ... ADD COLUMN IF NOT EXISTS que no existe en SQLite < 3.37.
    // Usuarios con BD antigua y user_version = 0 fallaban al arrancar.
    //
    // Esta migración re-aplica todo de forma segura con addCol() (try/catch).
    // Para usuarios que ya tienen user_version = 3 esto no corre.
    // Para usuarios con user_version = 0 y BD existente, esto los repara.
    //
    // Publicado en: v1.0.3 (28 Abr 2026)
    // ══════════════════════════════════════════════════════════════════════════
    {
        version:    4,
        appVersion: '1.0.3',
        description: 'Reparacion columnas faltantes — compatible SQLite antiguo',
        up(db) {
            // ── Re-aplicar migración 1 ────────────────────────────────────────
            addCol(db, 'sales',         'table_info',           'TEXT');
            addCol(db, 'sales',         'kitchen_notes',        'TEXT');
            addCol(db, 'products',      'unlimited_stock',      'INTEGER NOT NULL DEFAULT 0');
            addCol(db, 'business_info', 'region',               'TEXT');
            addCol(db, 'business_info', 'city',                 'TEXT');
            addCol(db, 'products',      'allow_negative_stock', 'INTEGER NOT NULL DEFAULT 0');

            // ── Re-aplicar migración 2 — tablas (CREATE IF NOT EXISTS es seguro) ──
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
                    pack_buy_quantity        INTEGER DEFAULT 1,
                    pack_pay_quantity        INTEGER DEFAULT 1,
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
                CREATE INDEX IF NOT EXISTS idx_promotions_is_active     ON promotions(is_active);
                CREATE INDEX IF NOT EXISTS idx_promotion_products_promo ON promotion_products(promotion_id);
                CREATE INDEX IF NOT EXISTS idx_sale_promotions_sale     ON sale_promotions(sale_id);
            `);

            // ── Re-aplicar migración 2 — columnas ────────────────────────────
            addCol(db, 'sales',      'applied_promotions',   'TEXT');
            addCol(db, 'sale_items', 'manual_discount',      'INTEGER NOT NULL DEFAULT 0');
            addCol(db, 'sale_items', 'promotion_discount',   'INTEGER NOT NULL DEFAULT 0');
            addCol(db, 'sale_items', 'promotion_id',         'INTEGER');
            addCol(db, 'sale_items', 'promotion_name',       'TEXT');
            addCol(db, 'sale_items', 'promotion_units',      'REAL');
            addCol(db, 'sale_items', 'promotion_pack_times', 'INTEGER');

            db.exec(`
                INSERT OR IGNORE INTO system_settings (key, value) VALUES
                    ('promotions_enabled',             '1'),
                    ('discount_manual_item_enabled',   '1'),
                    ('discount_manual_global_enabled', '1'),
                    ('discount_max_percent',           '100');
            `);

            // ── Re-aplicar migración 3 ────────────────────────────────────────
            addCol(db, 'sales', 'promotion_discount', 'INTEGER NOT NULL DEFAULT 0');
            addCol(db, 'sales', 'manual_discount',    'INTEGER NOT NULL DEFAULT 0');
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 5 — (reservada para v1.1.0)
    // Para agregar cambios futuros: agregar un objeto al final del array
    // con version: 5 y la función up(db). Usar siempre addCol() para columnas.
    // Ejemplo:
    // {
    //     version:    5,
    //     appVersion: '1.1.0',
    //     description: 'Tabla dte_emitidos para integración SII',
    //     up(db) {
    //         db.exec(`CREATE TABLE IF NOT EXISTS dte_emitidos (...)`);
    //         addCol(db, 'sales', 'dte_id', 'INTEGER');
    //     },
    // },
    // ══════════════════════════════════════════════════════════════════════════

];

// ============================================================================
//  RUNNER — no modificar salvo que cambies la estrategia de versionado
// ============================================================================
function runMigrations(db) {
    // PRAGMA user_version es un entero nativo de SQLite (siempre disponible).
    // Valor 0 = BD nueva o antes del sistema de migraciones.
    const userVersion = db.pragma('user_version')[0]?.user_version ?? 0;

    const pending = MIGRATIONS.filter(m => m.version > userVersion);

    if (pending.length === 0) {
        console.log(`[DB] ✅ Schema actualizado (versión ${userVersion})`);
        return;
    }

    console.log(`[DB] Aplicando ${pending.length} migración(es) pendientes (desde v${userVersion})...`);

    for (const migration of pending) {
        const applyMigration = db.transaction(() => {
            migration.up(db);
            // Actualizar user_version dentro de la transacción
            db.pragma(`user_version = ${migration.version}`);
        });

        try {
            applyMigration();
            console.log(`[DB] ✅ Migración ${migration.version} aplicada: ${migration.description} (app v${migration.appVersion})`);
        } catch (err) {
            console.error(`[DB] ❌ Error en migración ${migration.version} (${migration.description}):`, err.message);
            // Detenemos — no aplicar migraciones siguientes si una falla.
            // La BD queda en el último estado consistente (transacción rollback).
            throw new Error(
                `Fallo en migración ${migration.version} — ${migration.description}.\n` +
                `La base de datos no fue modificada.\nDetalle: ${err.message}`
            );
        }
    }

    const finalVersion = db.pragma('user_version')[0]?.user_version ?? 0;
    console.log(`[DB] 🎉 BD actualizada a versión ${finalVersion}`);
}

module.exports = runMigrations;