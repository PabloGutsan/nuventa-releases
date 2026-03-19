-- ============================================================================
-- NUVENTA - ESQUEMA DE BASE DE DATOS
-- SQLite — Versión 2.3 consolidada
-- Incluye: sistema de promociones (pack_fixed, pack_quantity), descuentos
--          manuales, settings de control
-- ============================================================================

-- ============================================================================
-- TABLA: business_info
-- ============================================================================
CREATE TABLE IF NOT EXISTS business_info (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    name            TEXT NOT NULL,
    rut             TEXT,
    address         TEXT,
    phone           TEXT,
    email           TEXT,
    website         TEXT,
    logo_path       TEXT,
    currency        TEXT DEFAULT 'CLP',
    tax_id          TEXT,
    legal_name      TEXT,
    footer_message  TEXT DEFAULT 'Gracias por su compra',
    region          TEXT,
    city            TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA: users
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    username             TEXT UNIQUE NOT NULL,
    password_hash        TEXT NOT NULL,
    full_name            TEXT NOT NULL,
    email                TEXT,
    role                 TEXT NOT NULL CHECK(role IN ('admin', 'vendedor', 'inventario')),
    is_active            BOOLEAN DEFAULT 1,
    must_change_password INTEGER DEFAULT 0,
    last_login           DATETIME,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username  ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- TABLA: license
-- ============================================================================
CREATE TABLE IF NOT EXISTS license (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    license_key         TEXT UNIQUE NOT NULL,
    hardware_id         TEXT NOT NULL,
    activation_date     DATETIME,
    expiration_date     DATETIME,
    is_active           BOOLEAN DEFAULT 1,
    plan                TEXT DEFAULT 'basic' CHECK(plan IN ('basic', 'premium')),
    last_validation     DATETIME,
    validation_attempts INTEGER DEFAULT 0,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA: categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    description   TEXT,
    parent_id     INTEGER,
    is_active     BOOLEAN DEFAULT 1,
    display_order INTEGER DEFAULT 0,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_categories_parent    ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- ============================================================================
-- TABLA: suppliers
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    legal_name      TEXT,
    business_name   TEXT,
    rut             TEXT UNIQUE,
    contact_name    TEXT,
    phone           TEXT,
    email           TEXT,
    address         TEXT,
    city            TEXT,
    region          TEXT,
    country         TEXT DEFAULT 'Chile',
    website         TEXT,
    industry        TEXT,
    payment_terms   TEXT,
    payment_methods TEXT,
    credit_days     INTEGER DEFAULT 0,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name      ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_rut       ON suppliers(rut);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

-- ============================================================================
-- TABLA: products
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    sku                  TEXT UNIQUE,
    barcode              TEXT,
    name                 TEXT NOT NULL,
    description          TEXT,
    category_id          INTEGER,
    cost_price           DECIMAL(10,2) NOT NULL DEFAULT 0,
    sale_price           DECIMAL(10,2) NOT NULL,
    profit_margin        DECIMAL(5,2) GENERATED ALWAYS AS (
                             CASE
                                 WHEN cost_price > 0 THEN ((sale_price - cost_price) / cost_price * 100)
                                 ELSE 0
                             END
                         ) STORED,
    stock                INTEGER DEFAULT 0,
    min_stock            INTEGER DEFAULT 0,
    max_stock            INTEGER,
    unit                 TEXT DEFAULT 'unidad',
    tax_rate             DECIMAL(5,2) DEFAULT 19.00,
    image_path           TEXT,
    is_active            BOOLEAN DEFAULT 1,
    allow_negative_stock BOOLEAN DEFAULT 0,
    type                 TEXT DEFAULT 'product' CHECK(type IN ('product', 'service')),
    unit_type            TEXT DEFAULT 'unidad',
    unit_label           TEXT DEFAULT 'un',
    allows_decimal       BOOLEAN DEFAULT 0,
    unlimited_stock      INTEGER DEFAULT 0,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_products_sku       ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode   ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name      ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock     ON products(stock);

-- ============================================================================
-- TABLA: product_suppliers
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_suppliers (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id         INTEGER NOT NULL,
    supplier_id        INTEGER NOT NULL,
    supplier_sku       TEXT,
    cost_price         DECIMAL(10,2),
    lead_time_days     INTEGER DEFAULT 0,
    min_order_quantity INTEGER DEFAULT 1,
    is_preferred       BOOLEAN DEFAULT 0,
    notes              TEXT,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    UNIQUE(product_id, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_product_suppliers_product   ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_supplier  ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_preferred ON product_suppliers(is_preferred);

-- ============================================================================
-- TABLA: purchases
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchases (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id         INTEGER,
    purchase_number     TEXT UNIQUE NOT NULL,
    invoice_number      TEXT,
    invoice_date        DATE NOT NULL,
    due_date            DATE,
    subtotal            DECIMAL(10,2) NOT NULL,
    tax                 DECIMAL(10,2) DEFAULT 0,
    discount            DECIMAL(10,2) DEFAULT 0,
    shipping_cost       DECIMAL(10,2) DEFAULT 0,
    total               DECIMAL(10,2) NOT NULL,
    payment_method      TEXT,
    payment_status      TEXT DEFAULT 'pendiente' CHECK(payment_status IN ('pendiente', 'parcial', 'pagado')),
    paid_amount         DECIMAL(10,2) DEFAULT 0,
    amount_paid         DECIMAL(10,2) DEFAULT 0,
    document_type       TEXT,
    has_recoverable_tax INTEGER DEFAULT 0,
    tax_included        INTEGER DEFAULT 1,
    payment_condition   TEXT DEFAULT 'contado',
    credit_days         INTEGER DEFAULT 0,
    notes               TEXT,
    user_id             INTEGER NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (user_id)     REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchases_supplier       ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_invoice_date   ON purchases(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_status ON purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_purchases_user           ON purchases(user_id);

-- ============================================================================
-- TABLA: purchase_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_id  INTEGER NOT NULL,
    product_id   INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    quantity     INTEGER NOT NULL,
    unit_price   DECIMAL(10,2) NOT NULL,
    subtotal     DECIMAL(10,2) NOT NULL,
    tax          DECIMAL(10,2) DEFAULT 0,
    discount     DECIMAL(10,2) DEFAULT 0,
    total        DECIMAL(10,2) NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product  ON purchase_items(product_id);

-- ============================================================================
-- TABLA: customers
-- ============================================================================
CREATE TABLE IF NOT EXISTS customers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT NOT NULL,
    rut             TEXT UNIQUE,
    phone           TEXT NOT NULL,
    email           TEXT,
    address         TEXT,
    region          TEXT,
    city            TEXT,
    birth_date      DATE,
    notes           TEXT,
    is_active       BOOLEAN DEFAULT 1,
    is_company      BOOLEAN DEFAULT 0,
    company_name    TEXT,
    company_rut     TEXT,
    company_address TEXT,
    company_region  TEXT,
    company_city    TEXT,
    company_phone   TEXT,
    company_email   TEXT,
    company_website TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_rut          ON customers(rut);
CREATE INDEX IF NOT EXISTS idx_customers_phone        ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_full_name    ON customers(full_name);
CREATE INDEX IF NOT EXISTS idx_customers_is_active    ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_is_company   ON customers(is_company);
CREATE INDEX IF NOT EXISTS idx_customers_company_name ON customers(company_name);

-- ============================================================================
-- TABLA: promotions   [v2.2]
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotions (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Identificación
    name                    TEXT NOT NULL,
    description             TEXT,

    -- Tipo de promoción:
    --   product_discount  → % o monto fijo sobre un producto específico
    --   category_discount → % sobre todos los productos de una categoría
    --   pack_fixed        → combo de productos fijos a precio especial
    --   pack_quantity     → lleva N paga M de una lista o categoría
    --   minimum_amount    → descuento si el total supera $X
    type                    TEXT NOT NULL CHECK(type IN (
                                'product_discount',
                                'category_discount',
                                'pack_fixed',
                                'pack_quantity',
                                'minimum_amount'
                            )),

    -- Forma del descuento:
    --   percentage  → % sobre el precio (discount_value = 0..100)
    --   fixed       → monto fijo en CLP  (discount_value = monto)
    --   fixed_price → precio especial fijo (discount_value = precio final)
    discount_type           TEXT NOT NULL CHECK(discount_type IN (
                                'percentage',
                                'fixed',
                                'fixed_price'
                            )),

    discount_value          DECIMAL(10,2) NOT NULL DEFAULT 0,

    -- Objetivo (según type)
    product_id              INTEGER,   -- requerido para product_discount
    category_id             INTEGER,   -- requerido para category_discount y pack_quantity por categoría

    -- Reglas de pack_quantity (lleva N paga M de una lista o categoría)
    --   Ejemplo 3x2: pack_buy_quantity=3, pack_pay_quantity=2
    pack_buy_quantity       INTEGER DEFAULT 1,
    pack_pay_quantity       INTEGER DEFAULT 1,
    -- Fuente del pack_quantity: 'category' | 'product_list'
    pack_quantity_source    TEXT DEFAULT 'product_list',
    -- Monto mínimo de compra (solo type = 'minimum_amount')
    minimum_purchase_amount DECIMAL(10,2) DEFAULT 0,

    -- Vigencia (NULL = sin límite de fecha)
    starts_at               DATETIME,
    ends_at                 DATETIME,

    -- Estado
    is_active               BOOLEAN DEFAULT 1,

    -- Auditoría
    created_by              INTEGER,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id)  REFERENCES products(id)    ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id)  ON DELETE SET NULL,
    FOREIGN KEY (created_by)  REFERENCES users(id)       ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_promotions_type       ON promotions(type);
CREATE INDEX IF NOT EXISTS idx_promotions_is_active  ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_product    ON promotions(product_id);
CREATE INDEX IF NOT EXISTS idx_promotions_category   ON promotions(category_id);
CREATE INDEX IF NOT EXISTS idx_promotions_starts_at  ON promotions(starts_at);
CREATE INDEX IF NOT EXISTS idx_promotions_ends_at    ON promotions(ends_at);

-- ============================================================================
-- TABLA: promotion_products   [v2.3]
-- Productos que forman parte de un pack o lista de pack_quantity.
--   pack_fixed    → cada fila es un producto del pack con su cantidad
--   pack_quantity → cada fila es un producto elegible para el pack
-- ============================================================================
CREATE TABLE IF NOT EXISTS promotion_products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    promotion_id INTEGER NOT NULL,
    product_id   INTEGER NOT NULL,
    quantity     INTEGER DEFAULT 1,   -- cantidad requerida (solo pack_fixed)
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)   REFERENCES products(id)   ON DELETE CASCADE,
    UNIQUE(promotion_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_products_promo   ON promotion_products(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(product_id);

-- ============================================================================
-- TABLA: sales
-- ============================================================================
CREATE TABLE IF NOT EXISTS sales (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_number         TEXT UNIQUE NOT NULL,
    user_id             INTEGER NOT NULL,
    customer_name       TEXT,
    customer_rut        TEXT,
    customer_email      TEXT,
    customer_phone      TEXT,
    subtotal            DECIMAL(10,2) NOT NULL,
    discount            DECIMAL(10,2) DEFAULT 0,         -- total descontado (manual + promociones)
    discount_percent    DECIMAL(5,2)  DEFAULT 0,
    promotion_discount  DECIMAL(10,2) DEFAULT 0,         -- parte automática por promociones
    manual_discount     DECIMAL(10,2) DEFAULT 0,         -- parte ingresada manualmente por el cajero
    tax                 DECIMAL(10,2) DEFAULT 0,
    total               DECIMAL(10,2) NOT NULL,
    payment_method      TEXT NOT NULL CHECK(payment_method IN ('efectivo','tarjeta_debito','tarjeta_credito','transferencia','multiple')),
    cash_received       DECIMAL(10,2),
    cash_change         DECIMAL(10,2),
    document_type       TEXT CHECK(document_type IN ('boleta_fisica','boleta_electronica','factura_fisica','factura_electronica','sin_documento')),
    document_number     TEXT,
    notes               TEXT,
    table_info          TEXT,
    kitchen_notes       TEXT,
    is_cancelled        BOOLEAN DEFAULT 0,
    cancelled_at        DATETIME,
    cancelled_by        INTEGER,
    cancellation_reason TEXT,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)      REFERENCES users(id),
    FOREIGN KEY (cancelled_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_sale_number     ON sales(sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_user_id         ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at      ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_document_type   ON sales(document_type);
CREATE INDEX IF NOT EXISTS idx_sales_document_number ON sales(document_number);
CREATE INDEX IF NOT EXISTS idx_sales_is_cancelled    ON sales(is_cancelled);

-- ============================================================================
-- TABLA: sale_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id            INTEGER NOT NULL,
    product_id         INTEGER NOT NULL,
    product_name       TEXT NOT NULL,
    product_sku        TEXT,
    quantity           INTEGER NOT NULL,
    unit_price         DECIMAL(10,2) NOT NULL,
    cost_price         DECIMAL(10,2) NOT NULL DEFAULT 0,
    subtotal           DECIMAL(10,2) NOT NULL,
    discount           DECIMAL(10,2) DEFAULT 0,          -- total descontado en esta línea
    promotion_discount DECIMAL(10,2) DEFAULT 0,          -- parte del descuento por promoción
    manual_discount    DECIMAL(10,2) DEFAULT 0,          -- parte del descuento manual del cajero
    promotion_id       INTEGER,                          -- FK a la promoción aplicada
    promotion_name     TEXT,                             -- snapshot del nombre al momento de venta
    tax                DECIMAL(10,2) DEFAULT 0,
    total              DECIMAL(10,2) NOT NULL,
    profit             DECIMAL(10,2) GENERATED ALWAYS AS (total - (cost_price * quantity)) STORED,
    unit_label         TEXT DEFAULT 'un',
    unit_type          TEXT DEFAULT 'unidad',
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id)      REFERENCES sales(id)      ON DELETE CASCADE,
    FOREIGN KEY (product_id)   REFERENCES products(id),
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id      ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id   ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_promotion_id ON sale_items(promotion_id);

-- ============================================================================
-- TABLA: sale_promotions   [v2.2]
-- Registro de qué promociones se aplicaron en cada venta.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sale_promotions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id          INTEGER NOT NULL,
    promotion_id     INTEGER,                  -- NULL si la promoción fue eliminada después
    promotion_name   TEXT NOT NULL,            -- snapshot del nombre al momento de la venta
    promotion_type   TEXT NOT NULL,            -- snapshot del tipo
    discount_applied DECIMAL(10,2) NOT NULL,   -- monto total descontado por esta promoción
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id)      REFERENCES sales(id)      ON DELETE CASCADE,
    FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_promotions_sale      ON sale_promotions(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_promotions_promotion ON sale_promotions(promotion_id);

-- ============================================================================
-- TABLA: cash_registers
-- ============================================================================
CREATE TABLE IF NOT EXISTS cash_registers (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    opened_by      INTEGER NOT NULL,
    opened_at      TEXT    NOT NULL,
    opening_amount REAL    NOT NULL DEFAULT 0,
    closed_by      INTEGER,
    closed_at      TEXT,
    closing_amount REAL,
    expected_cash  REAL,
    difference     REAL,
    notes          TEXT,
    status         TEXT NOT NULL DEFAULT 'open',
    FOREIGN KEY (opened_by) REFERENCES users(id),
    FOREIGN KEY (closed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON cash_registers(status);

-- ============================================================================
-- TABLA: cash_movements
-- ============================================================================
CREATE TABLE IF NOT EXISTS cash_movements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    register_id INTEGER NOT NULL,
    user_id     INTEGER NOT NULL,
    type        TEXT    NOT NULL,
    amount      REAL    NOT NULL,
    reason      TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (register_id) REFERENCES cash_registers(id),
    FOREIGN KEY (user_id)     REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON cash_movements(register_id);

-- ============================================================================
-- TABLA: inventory_movements
-- ============================================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id     INTEGER NOT NULL,
    movement_type  TEXT NOT NULL CHECK(movement_type IN ('entrada','salida','ajuste','venta','devolucion')),
    quantity       INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock      INTEGER NOT NULL,
    cost_per_unit  DECIMAL(10,2),
    total_cost     DECIMAL(10,2),
    reason         TEXT,
    reference_type TEXT,
    reference_id   INTEGER,
    user_id        INTEGER,
    notes          TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product    ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type       ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference  ON inventory_movements(reference_type, reference_id);

-- ============================================================================
-- TABLA: expenses
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    category             TEXT NOT NULL CHECK(category IN ('sueldos','servicios','arriendo','insumos','impuestos','marketing','mantenimiento','transporte','otros')),
    subcategory          TEXT,
    description          TEXT NOT NULL,
    amount               DECIMAL(10,2) NOT NULL,
    supplier_name        TEXT,
    supplier_rut         TEXT,
    invoice_number       TEXT,
    receipt_path         TEXT,
    expense_date         DATE NOT NULL,
    payment_method       TEXT,
    expense_type         TEXT DEFAULT 'variable' CHECK(expense_type IN ('fijo','variable')),
    is_recurring         BOOLEAN DEFAULT 0,
    recurrence_frequency TEXT CHECK(recurrence_frequency IN ('mensual','trimestral','semestral','anual')),
    next_due_date        DATE,
    user_id              INTEGER NOT NULL,
    notes                TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_category      ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_date          ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id       ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type  ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_is_recurring  ON expenses(is_recurring);
CREATE INDEX IF NOT EXISTS idx_expenses_next_due_date ON expenses(next_due_date);

-- ============================================================================
-- TABLA: employees
-- ============================================================================
CREATE TABLE IF NOT EXISTS employees (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name         TEXT NOT NULL,
    rut               TEXT UNIQUE NOT NULL,
    position          TEXT,
    department        TEXT,
    phone             TEXT,
    email             TEXT,
    address           TEXT,
    birth_date        DATE,
    salary            DECIMAL(10,2),
    hire_date         DATE,
    termination_date  DATE,
    bank_name         TEXT,
    bank_account      TEXT,
    emergency_contact TEXT,
    emergency_phone   TEXT,
    is_active         BOOLEAN DEFAULT 1,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_rut       ON employees(rut);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);

-- ============================================================================
-- TABLA: payroll
-- ============================================================================
CREATE TABLE IF NOT EXISTS payroll (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id      INTEGER NOT NULL,
    period_month     INTEGER NOT NULL CHECK(period_month BETWEEN 1 AND 12),
    period_year      INTEGER NOT NULL,
    base_salary      DECIMAL(10,2) NOT NULL,
    bonuses          DECIMAL(10,2) DEFAULT 0,
    extra_hours      DECIMAL(10,2) DEFAULT 0,
    deductions       DECIMAL(10,2) DEFAULT 0,
    advance_payment  DECIMAL(10,2) DEFAULT 0,
    total_gross      DECIMAL(10,2) NOT NULL,
    total_deductions DECIMAL(10,2) NOT NULL,
    total_net        DECIMAL(10,2) NOT NULL,
    payment_date     DATE,
    payment_method   TEXT,
    notes            TEXT,
    is_paid          BOOLEAN DEFAULT 0,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period   ON payroll(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payroll_is_paid  ON payroll(is_paid);

-- ============================================================================
-- TABLA: system_settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT,
    description TEXT,
    data_type   TEXT CHECK(data_type IN ('string','number','boolean','json')),
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLA: audit_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   INTEGER,
    old_value   TEXT,
    new_value   TEXT,
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user       ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================================================
-- VISTAS
-- ============================================================================

CREATE VIEW IF NOT EXISTS products_with_stock_status AS
SELECT
    p.*,
    c.name AS category_name,
    CASE
        WHEN p.stock <= 0                                       THEN 'sin_stock'
        WHEN p.stock <= p.min_stock                             THEN 'stock_bajo'
        WHEN p.max_stock IS NOT NULL AND p.stock >= p.max_stock THEN 'stock_alto'
        ELSE 'stock_normal'
    END AS stock_status
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;

CREATE VIEW IF NOT EXISTS sales_summary AS
SELECT
    s.*,
    u.full_name          AS seller_name,
    COUNT(si.id)         AS items_count,
    SUM(si.quantity)     AS total_items_quantity,
    SUM(si.profit)       AS total_profit
FROM sales s
LEFT JOIN users u       ON s.user_id = u.id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id;

CREATE VIEW IF NOT EXISTS monthly_sales_report AS
SELECT
    strftime('%Y', created_at) AS year,
    strftime('%m', created_at) AS month,
    COUNT(*)                   AS total_sales,
    SUM(total)                 AS total_revenue,
    AVG(total)                 AS average_sale,
    SUM(discount)              AS total_discounts,
    SUM(promotion_discount)    AS total_promotion_discounts,
    SUM(manual_discount)       AS total_manual_discounts,
    SUM(CASE WHEN is_cancelled = 1 THEN 1 ELSE 0 END) AS cancelled_sales
FROM sales
GROUP BY year, month
ORDER BY year DESC, month DESC;

CREATE VIEW IF NOT EXISTS top_products AS
SELECT
    p.id,
    p.name,
    p.sku,
    p.sale_price,
    SUM(si.quantity)           AS total_sold,
    SUM(si.total)              AS total_revenue,
    SUM(si.profit)             AS total_profit,
    COUNT(DISTINCT si.sale_id) AS times_sold
FROM products p
INNER JOIN sale_items si ON p.id = si.product_id
INNER JOIN sales s       ON si.sale_id = s.id
WHERE s.is_cancelled = 0
GROUP BY p.id
ORDER BY total_sold DESC;

-- Vista resumen de promociones   [v2.2]
CREATE VIEW IF NOT EXISTS promotions_summary AS
SELECT
    p.id,
    p.name,
    p.type,
    p.discount_type,
    p.discount_value,
    p.is_active,
    p.starts_at,
    p.ends_at,
    COUNT(DISTINCT sp.sale_id)            AS total_sales_applied,
    COALESCE(SUM(sp.discount_applied), 0) AS total_discount_given,
    pr.name                               AS product_name,
    cat.name                              AS category_name
FROM promotions p
LEFT JOIN sale_promotions sp ON p.id = sp.promotion_id
LEFT JOIN products pr        ON p.product_id = pr.id
LEFT JOIN categories cat     ON p.category_id = cat.id
GROUP BY p.id
ORDER BY total_discount_given DESC;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS update_products_timestamp
AFTER UPDATE ON products
BEGIN
    UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_customers_timestamp
AFTER UPDATE ON customers
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_sales_timestamp
AFTER UPDATE ON sales
BEGIN
    UPDATE sales SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_promotions_timestamp
AFTER UPDATE ON promotions
BEGIN
    UPDATE promotions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS log_inventory_on_product_update
AFTER UPDATE OF stock ON products
WHEN NEW.stock != OLD.stock
BEGIN
    INSERT INTO inventory_movements (
        product_id, movement_type, quantity,
        previous_stock, new_stock, reason
    ) VALUES (
        NEW.id, 'ajuste', NEW.stock - OLD.stock,
        OLD.stock, NEW.stock, 'Ajuste manual de stock'
    );
END;

-- ============================================================================
-- DATOS INICIALES
-- ============================================================================

INSERT OR IGNORE INTO system_settings (key, value, description, data_type) VALUES
-- General
('app_version',                    '2.3.0',                'Versión de la aplicación',                               'string'),
('currency_symbol',                '$',                    'Símbolo de moneda',                                      'string'),
('tax_rate',                       '19',                   'Tasa de impuesto por defecto (%)',                       'number'),
-- Stock
('low_stock_alert',                '1',                    'Activar alertas de stock bajo',                          'boolean'),
-- Backup
('auto_backup',                    '1',                    'Backup automático activado',                             'boolean'),
('backup_frequency',               '7',                    'Frecuencia de backup en días',                           'number'),
-- Impresión
('printer_name',                   '',                     'Nombre de la impresora por defecto',                     'string'),
('ticket_footer',                  'Gracias por su compra','Mensaje de pie de ticket',                               'string'),
('ticket_printer',                 '',                     'Impresora de tickets (silenciosa)',                      'string'),
('kitchen_enabled',                '0',                    'Activar impresión de comanda para cocina',               'boolean'),
('kitchen_copies',                 '1',                    'Cantidad de copias de comanda (1 o 2)',                  'number'),
('kitchen_printer',                '',                     'Impresora de cocina',                                    'string'),
('kitchen_copy_dest',              'kitchen',              'Destino de copias de comanda',                           'string'),
-- Caja
('cash_limit_alert',               '350000',               'Límite de alerta de efectivo en caja',                   'number'),
('cash_withdrawal_amount',         '300000',               'Monto sugerido de retiro de caja',                       'number'),
-- Gastos
('breakeven_alert',                '1',                    'Alertar cuando ventas no cubren gastos fijos',           'boolean'),
('fixed_expense_percentage_limit', '40',                   'Porcentaje máximo recomendado de gastos fijos / ventas', 'number'),
-- Descuentos y promociones   [v2.2]
('promotions_enabled',             '1',                    'Activar promociones automáticas en el POS',              'boolean'),
('discount_manual_item_enabled',   '1',                    'Permitir descuento manual por producto en el carrito',   'boolean'),
('discount_manual_global_enabled', '1',                    'Permitir descuento global manual en el carrito',         'boolean'),
('discount_max_percent',           '100',                  'Límite máximo de descuento permitido (%)',               'number');

INSERT OR IGNORE INTO categories (id, name, description, is_active) VALUES
(1, 'General',          'Categoría general',      1),
(2, 'Alimentos',        'Productos alimenticios', 1),
(3, 'Bebidas',          'Todo tipo de bebidas',   1),
(4, 'Limpieza',         'Productos de limpieza',  1),
(5, 'Higiene Personal', 'Productos de higiene',   1);

-- ============================================================================
-- FIN DEL ESQUEMA v2.3
-- ============================================================================