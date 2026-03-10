// src/services/repositories/cashRegisterRepository.js

const toSQLiteDate = (isoOrDate) => {
    if (!isoOrDate) return null;
    const d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return isoOrDate;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const nowSQLite = () => toSQLiteDate(new Date());

class CashRegisterRepository {

    async getOpenRegister() {
        try {
            const row = await window.electronAPI.database.get(`
                SELECT cr.*, u.full_name as opened_by_name
                FROM cash_registers cr
                LEFT JOIN users u ON cr.opened_by = u.id
                WHERE cr.status = 'open'
                ORDER BY cr.opened_at DESC
                LIMIT 1
            `);
            return row || null;
        } catch { return null; }
    }

    async getOpenRegisterByUser(userId) {
        try {
            const row = await window.electronAPI.database.get(`
                SELECT cr.*,
                       u1.full_name AS opened_by_name,
                       u2.full_name AS closed_by_name
                FROM cash_registers cr
                LEFT JOIN users u1 ON cr.opened_by = u1.id
                LEFT JOIN users u2 ON cr.closed_by = u2.id
                WHERE cr.status = 'open'
                  AND cr.opened_by = ?
                ORDER BY cr.opened_at DESC
                LIMIT 1
            `, [userId]);
            return row || null;
        } catch (err) {
            console.error('Error en getOpenRegisterByUser:', err);
            return null;
        }
    }

    async openRegister({ userId, openingAmount }) {
        const now = nowSQLite();
        const result = await window.electronAPI.database.run(`
            INSERT INTO cash_registers (opened_by, opened_at, opening_amount, status)
            VALUES (?, ?, ?, 'open')
        `, [userId, now, openingAmount]);
        return result.lastID;
    }

    // ── Calcular efectivo esperado al cierre ──────────────────────────────────
    // Las ventas en efectivo se incluyen TODAS (incluso canceladas) porque el
    // dinero físicamente entró a la caja. Las cancelaciones generan un movimiento
    // 'out' separado (razón: "Devolución - V-XXXX") que refleja la salida del
    // dinero devuelto al cliente. Así el arqueo muestra el flujo completo:
    //   entrada por venta + salida por devolución = neto correcto.
    async calculateExpectedCash(registerId) {
        try {
            const reg = await window.electronAPI.database.get(
                'SELECT * FROM cash_registers WHERE id = ?', [registerId]
            );
            if (!reg) return 0;

            const openedAt = toSQLiteDate(reg.opened_at);

            const movs = await window.electronAPI.database.get(`
                SELECT
                    COALESCE(SUM(CASE WHEN type='in'  THEN amount ELSE 0 END), 0) AS total_in,
                    COALESCE(SUM(CASE WHEN type='out' THEN amount ELSE 0 END), 0) AS total_out
                FROM cash_movements
                WHERE register_id = ?
            `, [registerId]);

            // ── Ventas en efectivo del turno — incluye canceladas ──────────────
            // Se incluyen las canceladas porque el efectivo SÍ entró a la caja
            // al momento de la venta. La devolución queda registrada como
            // movimiento 'out' en cash_movements, no aquí.
            const cashSales = await window.electronAPI.database.get(`
                SELECT COALESCE(SUM(total), 0) AS total
                FROM sales
                WHERE payment_method = 'efectivo'
                  AND created_at >= ?
                  AND user_id = ?
            `, [openedAt, reg.opened_by]);

            const expected =
                (reg.opening_amount || 0) +
                (movs?.total_in    || 0) -
                (movs?.total_out   || 0) +
                (cashSales?.total  || 0);

            return Math.round(expected);
        } catch (e) {
            console.error('calculateExpectedCash error:', e);
            return 0;
        }
    }

    async closeRegister({ registerId, userId, closingAmount, expectedCash, notes }) {
        const now  = nowSQLite();
        const diff = closingAmount - expectedCash;
        await window.electronAPI.database.run(`
            UPDATE cash_registers
            SET closed_by      = ?,
                closed_at      = ?,
                closing_amount = ?,
                expected_cash  = ?,
                difference     = ?,
                notes          = ?,
                status         = 'closed'
            WHERE id = ?
        `, [userId, now, closingAmount, expectedCash, diff, notes || '', registerId]);
        return diff;
    }

    async addMovement({ registerId, userId, type, amount, reason }) {
        await window.electronAPI.database.run(`
            INSERT INTO cash_movements (register_id, user_id, type, amount, reason)
            VALUES (?, ?, ?, ?, ?)
        `, [registerId, userId, type, amount, reason]);
    }

    async getMovements(registerId) {
        try {
            const rows = await window.electronAPI.database.query(`
                SELECT cm.*, u.full_name as user_name
                FROM cash_movements cm
                LEFT JOIN users u ON cm.user_id = u.id
                WHERE cm.register_id = ?
                ORDER BY cm.created_at ASC
            `, [registerId]);
            return Array.isArray(rows) ? rows : [];
        } catch { return []; }
    }

    async getSalesSummary(registerId) {
        try {
            const reg = await window.electronAPI.database.get(
                'SELECT opened_at, opened_by FROM cash_registers WHERE id = ?', [registerId]
            );
            if (!reg) return { byPayment: [], total: 0, count: 0 };

            const openedAt = toSQLiteDate(reg.opened_at);

            // Solo ventas no canceladas para el resumen visible de ventas del turno
            const byPayment = await window.electronAPI.database.query(`
                SELECT payment_method,
                       COUNT(*)                AS count,
                       COALESCE(SUM(total), 0) AS total
                FROM sales
                WHERE is_cancelled = 0
                  AND created_at >= ?
                  AND user_id = ?
                GROUP BY payment_method
                ORDER BY total DESC
            `, [openedAt, reg.opened_by]);

            const totals = await window.electronAPI.database.get(`
                SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
                FROM sales
                WHERE is_cancelled = 0
                  AND created_at >= ?
                  AND user_id = ?
            `, [openedAt, reg.opened_by]);

            // cashSalesGross: efectivo recibido incluyendo ventas canceladas.
            // Usado SOLO en el arqueo visual para que la suma cuadre con
            // expectedCash. Las cancelaciones aparecen como egreso separado.
            const cashSalesGross = await window.electronAPI.database.get(`
                SELECT COALESCE(SUM(total), 0) AS total
                FROM sales
                WHERE payment_method = 'efectivo'
                  AND created_at >= ?
                  AND user_id = ?
            `, [openedAt, reg.opened_by]);

            return {
                byPayment:      Array.isArray(byPayment) ? byPayment : [],
                total:          totals?.total || 0,
                count:          totals?.count || 0,
                cashSalesGross: cashSalesGross?.total || 0,
            };
        } catch (e) {
            console.error('getSalesSummary error:', e);
            return { byPayment: [], total: 0, count: 0, cashSalesGross: 0 };
        }
    }

    async getSalesDetail(registerId) {
        try {
            const reg = await window.electronAPI.database.get(
                'SELECT opened_at, opened_by FROM cash_registers WHERE id = ?', [registerId]
            );
            if (!reg) return [];

            const openedAt = toSQLiteDate(reg.opened_at);

            // Se incluyen todas las ventas (incluso canceladas) para que
            // la lista sea consistente con el arqueo de caja.
            const rows = await window.electronAPI.database.query(`
                SELECT s.sale_number, s.total, s.payment_method, s.created_at,
                       s.is_cancelled, u.full_name as seller_name
                FROM sales s
                LEFT JOIN users u ON s.user_id = u.id
                WHERE s.created_at >= ?
                  AND s.user_id = ?
                ORDER BY s.created_at ASC
            `, [openedAt, reg.opened_by]);
            return Array.isArray(rows) ? rows : [];
        } catch (e) {
            console.error('getSalesDetail error:', e);
            return [];
        }
    }

    async getHistory(limit = 20) {
        try {
            const rows = await window.electronAPI.database.query(`
                SELECT cr.*,
                       u1.full_name AS opened_by_name,
                       u2.full_name AS closed_by_name
                FROM cash_registers cr
                LEFT JOIN users u1 ON cr.opened_by = u1.id
                LEFT JOIN users u2 ON cr.closed_by = u2.id
                ORDER BY cr.opened_at DESC
                LIMIT ?
            `, [limit]);
            return Array.isArray(rows) ? rows : [];
        } catch { return []; }
    }
}

export default CashRegisterRepository;