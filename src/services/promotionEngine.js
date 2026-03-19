// src/services/promotionEngine.js
// ============================================================================
// Motor de promociones de Nuventa
// ============================================================================

// ── Helpers ───────────────────────────────────────────────────────────────────
const calcDiscount = (basePrice, discountType, discountValue) => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0) return 0;
    switch (discountType) {
        case 'percentage':
            return Math.round(basePrice * (Math.min(val, 100) / 100));
        case 'fixed':
            return Math.round(Math.min(val, basePrice));
        case 'fixed_price':
            return Math.round(Math.max(0, basePrice - val));
        default:
            return 0;
    }
};

const estimatePackDiscount = (promo, cart) => {
    if (!promo.packProducts?.length) return 0;
    const normalTotal = promo.packProducts.reduce((sum, pi) => {
        const item = cart.find(i => i.product_id === pi.product_id);
        return sum + (parseFloat(item?.unit_price) || 0) * (pi.quantity || 1);
    }, 0);
    return calcDiscount(normalTotal, promo.discount_type, promo.discount_value);
};

const estimateProductDiscount = (promo, cart) => {
    const item = cart.find(i => i.product_id === promo.product_id);
    if (!item) return 0;
    const linePrice = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
    return calcDiscount(linePrice, promo.discount_type, promo.discount_value);
};

const estimateCategoryDiscount = (promo, cart) => {
    const items = cart.filter(i => i.category_id === promo.category_id);
    return items.reduce((sum, item) => {
        const linePrice = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
        return sum + calcDiscount(linePrice, promo.discount_type, promo.discount_value);
    }, 0);
};

// ── Cache de promociones activas ─────────────────────────────────────────────
let _cachedPromotions = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30000;

const loadActivePromotions = async () => {
    const now = Date.now();
    if (_cachedPromotions && (now - _cacheTimestamp) < CACHE_TTL_MS) {
        return _cachedPromotions;
    }
    try {
        const promos = await window.electronAPI.database.query(`
            SELECT p.*, cat.name AS category_name
            FROM promotions p
            LEFT JOIN categories cat ON p.category_id = cat.id
            WHERE p.is_active = 1
              AND (p.starts_at IS NULL OR datetime(p.starts_at) <= datetime('now'))
              AND (p.ends_at   IS NULL OR datetime(p.ends_at)   >= datetime('now'))
            ORDER BY p.created_at ASC
        `);
        if (!Array.isArray(promos) || promos.length === 0) return [];

        const result = [];
        for (const promo of promos) {
            if (promo.type === 'pack_fixed' || promo.type === 'pack_quantity') {
                const items = await window.electronAPI.database.query(`
                    SELECT pp.product_id, pp.quantity, p.name, p.sale_price, p.cost_price
                    FROM promotion_products pp
                    JOIN products p ON pp.product_id = p.id
                    WHERE pp.promotion_id = ?
                `, [promo.id]);
                result.push({ ...promo, packProducts: Array.isArray(items) ? items : [] });
            } else {
                result.push({ ...promo, packProducts: [] });
            }
        }
        _cachedPromotions = result;
        _cacheTimestamp = Date.now();
        return result;
    } catch (err) {
        console.error('[PromotionEngine] Error cargando promociones:', err);
        return [];
    }
};

export const invalidatePromotionsCache = () => {
    _cachedPromotions = null;
    _cacheTimestamp = 0;
};

// ── Evaluadores ───────────────────────────────────────────────────────────────

const evalProductDiscount = (promo, cart) => {
    const discountMap = new Map();
    for (const item of cart) {
        if (item.product_id !== promo.product_id) continue;
        const linePrice = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
        const disc = calcDiscount(linePrice, promo.discount_type, promo.discount_value);
        if (disc > 0) discountMap.set(item.product_id, disc);
    }
    return discountMap;
};

const evalCategoryDiscount = (promo, cart) => {
    const discountMap = new Map();
    for (const item of cart) {
        if (item.category_id !== promo.category_id) continue;
        const linePrice = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
        const disc = calcDiscount(linePrice, promo.discount_type, promo.discount_value);
        if (disc > 0) discountMap.set(item.product_id, disc);
    }
    return discountMap;
};

const evalPackFixed = (promo, cart, usedUnitsMap = new Map()) => {
    const discountMap = new Map();
    const packUnitsMap = new Map();
    const newUsedUnits = new Map();
    let packCount = 0;

    if (!promo.packProducts?.length) return { discountMap, packUnitsMap, newUsedUnits, packCount };

    const availableQty = (pid) => {
        const cartItem = cart.find(i => i.product_id === pid);
        const inCart = parseFloat(cartItem?.quantity) || 0;
        const used = usedUnitsMap.get(pid) || 0;
        return Math.max(0, inCart - used);
    };

    packCount = Math.floor(
        Math.min(...promo.packProducts.map(pp =>
            availableQty(pp.product_id) / (pp.quantity || 1)
        ))
    );

    if (packCount === 0) return { discountMap, packUnitsMap, newUsedUnits, packCount };

    const normalPricePerPack = promo.packProducts.reduce((sum, pi) => {
        const cartItem = cart.find(i => i.product_id === pi.product_id);
        return sum + (parseFloat(cartItem?.unit_price) || 0) * (pi.quantity || 1);
    }, 0);

    if (normalPricePerPack <= 0) return { discountMap, packUnitsMap, newUsedUnits, packCount };

    const discountPerPack = calcDiscount(normalPricePerPack, promo.discount_type, promo.discount_value);
    if (discountPerPack <= 0) return { discountMap, packUnitsMap, newUsedUnits, packCount };

    const totalDiscount = discountPerPack * packCount;

    let distributed = 0;
    promo.packProducts.forEach((packItem, idx) => {
        const cartItem = cart.find(i => i.product_id === packItem.product_id);
        const unitsInPack = (packItem.quantity || 1) * packCount;
        const linePrice = (parseFloat(cartItem?.unit_price) || 0) * unitsInPack;
        const proportion = linePrice / (normalPricePerPack * packCount);

        const itemDisc = idx === promo.packProducts.length - 1
            ? totalDiscount - distributed
            : Math.round(totalDiscount * proportion);

        distributed += itemDisc;

        if (itemDisc > 0) {
            discountMap.set(packItem.product_id, itemDisc);
            const totalCartQty = parseFloat(cartItem?.quantity) || 0;
            packUnitsMap.set(
                packItem.product_id,
                unitsInPack < totalCartQty ? unitsInPack : null
            );
            newUsedUnits.set(packItem.product_id, unitsInPack);
        }
    });

    return { discountMap, packUnitsMap, newUsedUnits, packCount };
};

const evalPackQuantity = (promo, cart) => {
    const discountMap = new Map();

    let eligibleItems = [];
    if (promo.pack_quantity_source === 'category' && promo.category_id) {
        eligibleItems = cart.filter(i => i.category_id === promo.category_id);
    } else if (promo.packProducts?.length) {
        const eligibleIds = new Set(promo.packProducts.map(p => p.product_id));
        eligibleItems = cart.filter(i => eligibleIds.has(i.product_id));
    } else {
        return discountMap;
    }

    if (eligibleItems.length === 0) return discountMap;

    const buyQty = parseInt(promo.pack_buy_quantity) || 2;
    const payQty = parseInt(promo.pack_pay_quantity) || 1;
    const freeQty = buyQty - payQty;
    if (freeQty <= 0) return discountMap;

    const units = [];
    for (const item of eligibleItems) {
        const qty = Math.floor(parseFloat(item.quantity) || 0);
        const unitPrice = parseFloat(item.unit_price) || 0;
        for (let i = 0; i < qty; i++) {
            units.push({ product_id: item.product_id, price: unitPrice });
        }
    }

    if (units.length < buyQty) return discountMap;
    units.sort((a, b) => a.price - b.price);

    const totalGroups = Math.floor(units.length / buyQty);
    const freeUnits = totalGroups * freeQty;
    const tempMap = new Map();
    let freeCount = 0;

    for (let g = 0; g < totalGroups && freeCount < freeUnits; g++) {
        const groupStart = g * buyQty;
        for (let f = 0; f < freeQty && freeCount < freeUnits; f++) {
            const unit = units[groupStart + f];
            if (!unit) break;
            tempMap.set(unit.product_id, (tempMap.get(unit.product_id) || 0) + unit.price);
            freeCount++;
        }
    }

    for (const [productId, discount] of tempMap.entries()) {
        if (discount > 0) discountMap.set(productId, Math.round(discount));
    }

    const completedGroups = totalGroups;
    return { discountMap, completedGroups };
};

const evalMinimumAmount = (promo, cart) => {
    const subtotal = cart.reduce((sum, item) => {
        const price = parseFloat(item.unit_price) || 0;
        const qty = parseFloat(item.quantity) || 0;
        return sum + price * qty;
    }, 0);
    if (subtotal < (parseFloat(promo.minimum_purchase_amount) || 0)) return 0;
    return calcDiscount(subtotal, promo.discount_type, promo.discount_value);
};

// ── Núcleo de evaluación (sincrónico, reutilizado por ambas versiones) ────────
const _runEvaluation = (cart, promotions) => {
    const sortedPromotions = [...promotions].sort((a, b) => {
        const da = a.type === 'pack_fixed' ? estimatePackDiscount(a, cart)
            : a.type === 'product_discount' ? estimateProductDiscount(a, cart)
                : a.type === 'category_discount' ? estimateCategoryDiscount(a, cart)
                    : 0;
        const db = b.type === 'pack_fixed' ? estimatePackDiscount(b, cart)
            : b.type === 'product_discount' ? estimateProductDiscount(b, cart)
                : b.type === 'category_discount' ? estimateCategoryDiscount(b, cart)
                    : 0;
        return db - da;
    });

    const globalUsedUnits = new Map();
    const itemPromoEntries = new Map();
    const itemPackUnits = new Map();
    const applied = [];
    let globalDisc = 0;

    for (const promo of sortedPromotions) {
        let discountMap = new Map();
        let packUnitsResult = new Map();
        let cartLevelDiscount = 0;
        let thisPackCount = 0;

        switch (promo.type) {
            case 'product_discount':
                discountMap = evalProductDiscount(promo, cart);
                break;
            case 'category_discount':
                discountMap = evalCategoryDiscount(promo, cart);
                break;
            case 'pack_fixed': {
                const result = evalPackFixed(promo, cart, globalUsedUnits);
                discountMap = result.discountMap;
                packUnitsResult = result.packUnitsMap;
                thisPackCount = result.packCount;
                for (const [pid, used] of result.newUsedUnits.entries()) {
                    globalUsedUnits.set(pid, (globalUsedUnits.get(pid) || 0) + used);
                }
                break;
            }
            case 'pack_quantity': {
                const qResult = evalPackQuantity(promo, cart);
                // evalPackQuantity puede retornar un Map directo (early returns) o { discountMap, completedGroups }
                if (qResult instanceof Map) {
                    discountMap = qResult;
                    thisPackCount = 0;
                } else {
                    discountMap = qResult.discountMap ?? new Map();
                    thisPackCount = qResult.completedGroups || 0;
                }
                break;
            }
            case 'minimum_amount':
                cartLevelDiscount = evalMinimumAmount(promo, cart);
                break;
            default:
                break;
        }

        let totalApplied = 0;

        for (const [productId, discAmount] of discountMap.entries()) {
            const entries = itemPromoEntries.get(productId) || [];
            entries.push({
                promotionId: promo.id,
                promotionName: promo.name,
                discount: discAmount,
                packCount: thisPackCount >= 1 ? thisPackCount : null,
            });
            itemPromoEntries.set(productId, entries);

            if (packUnitsResult.has(productId)) {
                const existing = itemPackUnits.get(productId);
                const newUnits = packUnitsResult.get(productId);
                if (newUnits !== null) {
                    itemPackUnits.set(productId, (existing || 0) + (newUnits || 0));
                } else {
                    itemPackUnits.set(productId, null);
                }
            }

            totalApplied += discAmount;
        }

        if (cartLevelDiscount > 0) {
            globalDisc += cartLevelDiscount;
            totalApplied = cartLevelDiscount;
        }

        if (totalApplied > 0) {
            applied.push({
                promotion_id: promo.id,
                promotion_name: promo.name,
                promotion_type: promo.type,
                discount_applied: totalApplied,
            });
        }
    }

    const updatedCart = cart.map(item => {
        const entries = itemPromoEntries.get(item.product_id) || [];

        if (entries.length === 0) {
            return {
                ...item,
                promotion_discount: 0,
                promotion_entries: [],
                promotion_id: null,
                promotion_name: null,
                promotion_units: null,
                discount: parseFloat(item.manual_discount) || 0,
            };
        }

        const totalPromoDisc = entries.reduce((s, e) => s + e.discount, 0);
        const manualDisc = parseFloat(item.manual_discount) || 0;
        const totalDisc = Math.round(totalPromoDisc + manualDisc);
        const lineTotal = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);

        const rawPackUnits = itemPackUnits.get(item.product_id);
        const quantity = parseFloat(item.quantity) || 0;
        const promoUnits = (rawPackUnits !== null && rawPackUnits !== undefined && rawPackUnits < quantity)
            ? rawPackUnits : null;

        const mainEntry = entries[0];

        return {
            ...item,
            promotion_discount: totalPromoDisc,
            promotion_entries: entries,
            promotion_id: mainEntry.promotionId,
            promotion_name: mainEntry.promotionName,
            promotion_units: promoUnits,
            discount: Math.min(totalDisc, lineTotal),
        };
    });

    return {
        cart: updatedCart,
        globalDiscount: Math.round(globalDisc),
        applied,
    };
};

// ── Motor principal async (carga promociones desde BD si no están en cache) ──
export const evaluatePromotions = async (cart, options = {}) => {
    const { promoEnabled = true } = options;

    const baseResult = {
        cart: cart.map(item => ({
            ...item,
            promotion_discount: 0,
            promotion_entries: [],
            promotion_id: null,
            promotion_name: null,
            promotion_units: null,
            discount: parseFloat(item.manual_discount) || 0,
        })),
        globalDiscount: 0,
        applied: [],
    };

    if (!promoEnabled || !cart?.length) return baseResult;

    const promotions = await loadActivePromotions();
    if (!promotions.length) return baseResult;

    return _runEvaluation(cart, promotions);
};

// ── Motor sincrónico (usa promociones ya cargadas, para uso en handlers) ─────
// Recibe las promociones como parámetro (el estado activePromotions del componente).
// Garantiza evaluación inmediata sin gaps asíncronos.
export const evaluatePromotionsSync = (cart, promotions, options = {}) => {
    const { promoEnabled = true } = options;

    const baseResult = {
        cart: cart.map(item => ({
            ...item,
            promotion_discount: 0,
            promotion_entries: [],
            promotion_id: null,
            promotion_name: null,
            promotion_units: null,
            discount: parseFloat(item.manual_discount) || 0,
        })),
        globalDiscount: 0,
        applied: [],
    };

    if (!promoEnabled || !cart?.length || !promotions?.length) return baseResult;

    return _runEvaluation(cart, promotions);
};

export const applyPromotionsToCart = async (cart, setCart, setGlobalDiscount, options = {}) => {
    try {
        const result = await evaluatePromotions(cart, options);
        setCart(result.cart);
        if (result.globalDiscount > 0 && setGlobalDiscount) {
            setGlobalDiscount({ type: 'fixed', value: result.globalDiscount });
        }
        return result.applied;
    } catch (err) {
        console.error('[PromotionEngine] Error aplicando promociones:', err);
        return [];
    }
};

const promotionEngine = { evaluatePromotions, evaluatePromotionsSync, applyPromotionsToCart };
export default promotionEngine;