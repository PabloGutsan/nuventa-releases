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
//   4. Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` cuando sea posible
//      (SQLite ≥ 3.37, disponible en Electron desde v18).
//      Si el campo ya existe (instalación nueva desde schema.sql), no hace nada.
//   5. schema.sql debe mantenerse actualizado con el último estado completo
//      (para instalaciones nuevas). Las migraciones son solo para upgrades.
//
//  CÓMO USAR:
//      const runMigrations = require('./migrations');
//      runMigrations(db);  // llamar después de db.exec(schema)
//
// ============================================================================

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
            // Si el usuario ya tenía la app con schema.sql v2.1, las tablas
            // existen. Solo aseguramos que los campos de v2.1 estén presentes.

            // Campos de cocina en sales (agregados en v2.1)
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS table_info TEXT`);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS kitchen_notes TEXT`);

            // unlimited_stock en products (agregado en v2.1)
            db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unlimited_stock INTEGER NOT NULL DEFAULT 0`);

            // region y city en business_info (agregados en v2.1)
            db.exec(`ALTER TABLE business_info ADD COLUMN IF NOT EXISTS region TEXT`);
            db.exec(`ALTER TABLE business_info ADD COLUMN IF NOT EXISTS city TEXT`);

            // allow_negative_stock en products (por si no estaba)
            db.exec(`ALTER TABLE products ADD COLUMN IF NOT EXISTS allow_negative_stock INTEGER NOT NULL DEFAULT 0`);
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
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id         INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                    promotion_id    INTEGER REFERENCES promotions(id) ON DELETE SET NULL,
                    promotion_name  TEXT,
                    promotion_type  TEXT,
                    discount_applied REAL   NOT NULL DEFAULT 0,
                    created_at      TEXT   NOT NULL DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_promotions_is_active
                    ON promotions(is_active);

                CREATE INDEX IF NOT EXISTS idx_promotion_products_promo
                    ON promotion_products(promotion_id);

                CREATE INDEX IF NOT EXISTS idx_sale_promotions_sale
                    ON sale_promotions(sale_id);
            `);

            // Campo applied_promotions en sales (JSON blob con el resumen)
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS applied_promotions TEXT`);

            // Campos de descuento desglosado en sale_items
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS manual_discount     INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_discount  INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_id        INTEGER`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_name      TEXT`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_units     REAL`);
            db.exec(`ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS promotion_pack_times INTEGER`);

            // Settings para control de descuentos y promociones en el POS
            db.exec(`
                INSERT OR IGNORE INTO system_settings (key, value) VALUES
                    ('promotions_enabled',              '1'),
                    ('discount_manual_item_enabled',    '1'),
                    ('discount_manual_global_enabled',  '1'),
                    ('discount_max_percent',            '100');
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
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS promotion_discount INTEGER NOT NULL DEFAULT 0`);
            db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS manual_discount    INTEGER NOT NULL DEFAULT 0`);
        },
    },

    // ══════════════════════════════════════════════════════════════════════════
    // MIGRACIÓN 4 — (reservada para v1.1.0)
    // Agrega aquí los cambios de la próxima versión.
    // Ejemplo:
    // {
    //     version:    4,
    //     appVersion: '1.1.0',
    //     description: 'Tabla dte_emitidos para integración SII',
    //     up(db) {
    //         db.exec(`
    //             CREATE TABLE IF NOT EXISTS dte_emitidos (
    //                 id           INTEGER PRIMARY KEY AUTOINCREMENT,
    //                 sale_id      INTEGER NOT NULL REFERENCES sales(id),
    //                 tipo_dte     INTEGER NOT NULL,  -- 39=boleta, 33=factura
    //                 folio        INTEGER NOT NULL,
    //                 fecha_emision TEXT NOT NULL,
    //                 xml          TEXT,
    //                 pdf_path     TEXT,
    //                 estado       TEXT NOT NULL DEFAULT 'pendiente',
    //                 created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    //             );
    //         `);
    //         db.exec(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS dte_id INTEGER REFERENCES dte_emitidos(id)`);
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
    const { user_version: currentVersion } = db.pragma('user_version', { simple: true })
        ? { user_version: db.pragma('user_version')[0]?.user_version ?? 0 }
        : { user_version: 0 };

    const pending = MIGRATIONS.filter(m => m.version > currentVersion);

    if (pending.length === 0) {
        console.log(`[DB] ✅ Schema actualizado (versión ${currentVersion})`);
        return;
    }

    console.log(`[DB] Aplicando ${pending.length} migración(es) pendientes (desde v${currentVersion})...`);

    for (const migration of pending) {
        const applyMigration = db.transaction(() => {
            migration.up(db);
            // Actualizar user_version — debe hacerse dentro de la transacción
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