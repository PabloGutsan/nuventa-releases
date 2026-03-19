// src/pages/POS/POSMain.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import ProductRepository from '../../services/repositories/productRepository';
import SaleRepository from '../../services/repositories/saleRepository';
import CustomerRepository from '../../services/repositories/customerRepository';
import ProductSearch from './ProductSearch';
import CartItemsSection from './CartItemsSection';
import CartSidebar from './CartSidebar';
import PaymentModal from './PaymentModal';
import PrintModal from '../../components/print/PrintModal';
import BusinessRepository from '../../services/repositories/businessRepository';
import QuantityModal from './QuantityModal';
import { evaluatePromotionsSync } from '../../services/promotionEngine';

import useCashRegister from '../../hooks/useCashRegister';
import CashOpenModal from './CashOpenModal';
import CashMovementModal from './CashMovementModal';
import CashCloseModal from './CashCloseModal';
import CashButton from './CashButton';

import './POSMain.css';

// ── Borrador ──────────────────────────────────────────────────────────────────
const DRAFT_KEY = 'nuventa_pos_draft';
const saveDraft = (cart, customerId, globalDiscount) => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ cart, customerId, globalDiscount, savedAt: new Date().toISOString() })); }
    catch { /* noop */ }
};
const loadDraft = () => {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const draft = JSON.parse(raw);
        return draft?.cart?.length ? draft : null;
    } catch { return null; }
};
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ } };

// ── Holds ─────────────────────────────────────────────────────────────────────
const HOLDS_KEY = 'nuventa_pos_holds';
const MAX_HOLDS = 5;
const getStoredHolds = () => { try { return JSON.parse(localStorage.getItem(HOLDS_KEY) || '[]'); } catch { return []; } };
const storeHolds = (h) => { try { localStorage.setItem(HOLDS_KEY, JSON.stringify(h)); } catch { /* noop */ } };

// ── Ítem vacío — siempre incluye promotion_entries para evitar errores ────────
const makeCartItem = (product, quantity = 1) => ({
    product_id: product.id,
    product_name: product.name,
    product_sku: product.sku || '',
    product_type: product.type || 'product',
    image_path: product.image_path || null,
    unit_price: parseFloat(product.sale_price) || 0,
    cost_price: parseFloat(product.cost_price) || 0,
    category_id: product.category_id || null,
    quantity,
    unit_label: product.unit_label || 'un',
    unit_type: product.unit_type || 'unidad',
    discount: 0,
    manual_discount: 0,
    promotion_discount: 0,
    promotion_entries: [],   // ← siempre inicializado
    promotion_id: null,
    promotion_name: null,
    promotion_units: null,
});

// ── Platform ──────────────────────────────────────────────────────────────────
const isMac = () => window.electronAPI?.platform === 'darwin';
const kbd = (w, m) => isMac() ? m : w;

const restoreSearchFocus = (ref) => {
    requestAnimationFrame(() => {
        ref.current?.focus();
        setTimeout(() => ref.current?.focus(), 80);
        setTimeout(() => ref.current?.focus(), 200);
    });
};

const formatStock = (value) => {
    const n = parseFloat(value);
    if (isNaN(n)) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, '');
};

const getUnitLabel = (product) => {
    if (!product) return '';
    if (product.unit_label && product.unit_label !== 'un') return product.unit_label;
    const map = { peso: 'kg', volumen: 'L', metros: 'm', unidad: '' };
    return map[product.unit_type] || '';
};

// ── POSDialog ─────────────────────────────────────────────────────────────────
const POSDialog = ({ dialog, onClose }) => {
    useEffect(() => {
        if (!dialog) return;
        const onKey = (e) => {
            if (e.key === 'Escape') { if (dialog.onCancel) dialog.onCancel(); else onClose?.(); }
            if (e.key === 'Enter' && dialog.mode === 'alert') dialog.onConfirm?.();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [dialog, onClose]);

    if (!dialog) return null;
    const { mode, message, confirmLabel, confirmVariant = 'danger', onConfirm, onCancel } = dialog;
    return (
        <div className="pos-dialog-overlay" onClick={onCancel || onClose}>
            <div className="pos-dialog" onClick={e => e.stopPropagation()}>
                <div className="pos-dialog-icon">
                    {confirmVariant === 'danger' ? '⚠️' : confirmVariant === 'success' ? '✅' : 'ℹ️'}
                </div>
                <p className="pos-dialog-message">{message}</p>
                <div className="pos-dialog-actions">
                    {mode === 'confirm' && onCancel && (
                        <button className="pos-dialog-btn pos-dialog-btn--cancel" onClick={onCancel}>Cancelar</button>
                    )}
                    <button className={`pos-dialog-btn pos-dialog-btn--${confirmVariant}`} onClick={onConfirm} autoFocus>
                        {confirmLabel || 'Aceptar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── POSMain ───────────────────────────────────────────────────────────────────
const POSMain = ({ onNavigate }) => {
    const { db } = useDatabase();
    const { currentUser } = useAuth();

    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [customerId, setCustomerId] = useState(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [lastSale, setLastSale] = useState(null);
    const [isProcessingSale, setIsProcessingSale] = useState(false);
    const [businessInfo, setBusinessInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [cashSettings, setCashSettings] = useState(null);
    const [discountSettings, setDiscountSettings] = useState({ itemEnabled: true, globalEnabled: true, maxPercent: 100, promoEnabled: true });
    const [activePromotions, setActivePromotions] = useState([]);
    const [globalDiscount, setGlobalDiscount] = useState({ type: 'percent', value: 0 });
    const [promoGlobalDiscount, setPromoGlobalDiscount] = useState(0);
    const [appliedPromotions, setAppliedPromotions] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [holds, setHoldsState] = useState(() => getStoredHolds());

    const searchInputRef = useRef(null);

    // Refs para siempre tener el valor actual en callbacks sin recrearlos
    const cartRef = useRef([]);
    const activePromosRef = useRef([]);
    const discountSettingsRef = useRef(discountSettings);
    cartRef.current = cart;
    activePromosRef.current = activePromotions;
    discountSettingsRef.current = discountSettings;

    // Ref al applyPromosToCart actualizado (para usar desde closures estáticas)
    const applyPromosToCartRef = useRef(null);

    // ── Borrador ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (cart.length > 0) saveDraft(cart, customerId, globalDiscount);
    }, [cart, customerId, globalDiscount]);

    // ── Evaluación sincrónica ─────────────────────────────────────────────────
    // Recibe el cart completo, evalúa con las promos activas y actualiza estado.
    const applyPromosToCart = useCallback((newCart) => {
        const promos = activePromosRef.current;
        const promoEnabled = discountSettingsRef.current.promoEnabled;

        if (!newCart?.length) {
            setCart([]);
            setAppliedPromotions([]);
            setPromoGlobalDiscount(0);
            return;
        }

        if (!promoEnabled || !promos?.length) {
            // Sin promos: limpiar campos de promoción pero conservar el resto
            setCart(newCart.map(item => ({
                ...item,
                promotion_discount: 0,
                promotion_entries: [],
                promotion_id: null,
                promotion_name: null,
                promotion_units: null,
                discount: parseFloat(item.manual_discount) || 0,
            })));
            setAppliedPromotions([]);
            setPromoGlobalDiscount(0);
            return;
        }

        const result = evaluatePromotionsSync(newCart, promos, { promoEnabled });
        setCart(result.cart);
        setAppliedPromotions(result.applied || []);
        setPromoGlobalDiscount(result.globalDiscount || 0);
    }, []); // sin deps: usa refs que siempre están actualizados

    applyPromosToCartRef.current = applyPromosToCart;

    // ── Re-evaluar cuando activePromotions carga o cambia ────────────────────
    // Cubre el caso donde el carrito fue restaurado antes de que cargaran las promos.
    useEffect(() => {
        if (activePromotions.length > 0 && cartRef.current.length > 0) {
            applyPromosToCartRef.current(cartRef.current);
        }
    }, [activePromotions]); // eslint-disable-line

    // ── Dialogs ───────────────────────────────────────────────────────────────
    const closeDialog = useCallback(() => { setDialog(null); restoreSearchFocus(searchInputRef); }, []);

    const showAlert = useCallback((message, variant = 'primary') => {
        setDialog({
            mode: 'alert', message, confirmVariant: variant, confirmLabel: 'Aceptar',
            onConfirm: () => { setDialog(null); restoreSearchFocus(searchInputRef); },
        });
    }, []);

    const showConfirm = useCallback(({ message, confirmLabel, confirmVariant = 'danger', onConfirm }) => {
        setDialog({
            mode: 'confirm', message, confirmLabel, confirmVariant,
            onConfirm: () => { setDialog(null); onConfirm(); },
            onCancel: () => { setDialog(null); restoreSearchFocus(searchInputRef); },
        });
    }, []);

    // ── Holds ─────────────────────────────────────────────────────────────────
    const handleHold = useCallback(() => {
        if (cart.length === 0) return;
        const current = getStoredHolds();
        if (current.length >= MAX_HOLDS) {
            showAlert(`Máximo ${MAX_HOLDS} ventas en espera.`, 'danger');
            return;
        }
        const updated = [...current, { id: Date.now(), cart, customerId, globalDiscount, savedAt: new Date().toISOString() }];
        storeHolds(updated);
        setHoldsState(updated);
        clearDraft();
        setCart([]); setCustomerId(null); setGlobalDiscount({ type: 'percent', value: 0 });
        setAppliedPromotions([]); setPromoGlobalDiscount(0);
        restoreSearchFocus(searchInputRef);
    }, [cart, customerId, globalDiscount, showAlert]);

    const handleResumeHold = useCallback((holdId) => {
        const current = getStoredHolds();
        const hold = current.find(h => h.id === holdId);
        if (!hold) return;
        const updated = cart.length > 0
            ? [...current.filter(h => h.id !== holdId), { id: Date.now(), cart, customerId, globalDiscount, savedAt: new Date().toISOString() }]
            : current.filter(h => h.id !== holdId);
        storeHolds(updated);
        setHoldsState(updated);
        applyPromosToCartRef.current(hold.cart);
        setCustomerId(hold.customerId);
        setGlobalDiscount(hold.globalDiscount || { type: 'percent', value: 0 });
        clearDraft();
        restoreSearchFocus(searchInputRef);
    }, [cart, customerId, globalDiscount]);

    const handleDeleteHold = useCallback((holdId) => {
        const updated = getStoredHolds().filter(h => h.id !== holdId);
        storeHolds(updated);
        setHoldsState(updated);
    }, []);

    // ── Repos ─────────────────────────────────────────────────────────────────
    const productRepo = new ProductRepository(db);
    const saleRepo = new SaleRepository(db);
    const customerRepo = new CustomerRepository(db);
    const businessRepo = new BusinessRepository(db);

    // ── Caja ──────────────────────────────────────────────────────────────────
    const {
        register, expectedCash, salesSummary, salesDetail, movements,
        loading: cashLoading,
        showOpenModal, showMovementModal, showCloseModal,
        setShowOpenModal, setShowMovementModal, setShowCloseModal,
        handleOpen, handleAddMovement, handleClose,
        prepareClose, openMovementModal, movementType, loadCashData,
    } = useCashRegister({ currentUser });

    useEffect(() => { if (db && currentUser) initializePOS(); }, [db, currentUser]); // eslint-disable-line

    // ── Teclas globales ───────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (showPaymentModal || showPrintModal || showQuantityModal || dialog) return;
            const mac = isMac();
            const isPay = e.key === 'F9' || (mac && e.metaKey && e.key === 'p');
            const isClear = e.key === 'F10' || (mac && e.metaKey && e.key === 'Backspace');
            if (isPay && cart.length > 0 && !isProcessingSale) { e.preventDefault(); handleOpenPayment(); }
            if (isClear) { e.preventDefault(); handleClearCart(); }
            if (e.key === 'Escape') { e.preventDefault(); searchInputRef.current?.focus(); }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [cart, isProcessingSale, showPaymentModal, showPrintModal, showQuantityModal, dialog]); // eslint-disable-line

    // ── Init ──────────────────────────────────────────────────────────────────
    const initializePOS = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadBusinessInfo(), loadProducts(), loadCashSettings(),
                loadDiscountSettings(), loadActivePromotions(),
            ]);
            requestAnimationFrame(() => searchInputRef.current?.focus());
            const draft = loadDraft();
            if (draft) {
                const savedAt = new Date(draft.savedAt);
                const timeStr = savedAt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                const dateStr = savedAt.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
                const itemsStr = draft.cart.length === 1 ? '1 producto' : `${draft.cart.length} productos`;
                setDialog({
                    mode: 'confirm',
                    message: `Tienes un carrito guardado del ${dateStr} a las ${timeStr} con ${itemsStr}.\n\n¿Deseas recuperarlo?`,
                    confirmLabel: 'Recuperar carrito',
                    confirmVariant: 'primary',
                    onConfirm: () => {
                        applyPromosToCartRef.current(draft.cart);
                        setCustomerId(draft.customerId || null);
                        if (draft.globalDiscount) setGlobalDiscount(draft.globalDiscount);
                        clearDraft(); setDialog(null); restoreSearchFocus(searchInputRef);
                    },
                    onCancel: () => { clearDraft(); setDialog(null); restoreSearchFocus(searchInputRef); },
                });
            }
        } catch (error) {
            console.error('❌ Error inicializando POS:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadCashSettings = async () => {
        try {
            const limitRow = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'cash_limit_alert'`);
            const withdrawalRow = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'cash_withdrawal_amount'`);
            setCashSettings({
                limitAlert: parseInt(limitRow?.value || '350000'),
                withdrawalAmount: parseInt(withdrawalRow?.value || '300000'),
            });
        } catch {
            setCashSettings({ limitAlert: 350000, withdrawalAmount: 300000 });
        }
    };

    const loadDiscountSettings = async () => {
        try {
            const rows = await window.electronAPI.database.query(`
                SELECT key, value FROM system_settings
                WHERE key IN ('discount_manual_item_enabled','discount_manual_global_enabled','discount_max_percent','promotions_enabled')
            `);
            const map = {};
            for (const row of (rows || [])) map[row.key] = row.value;
            setDiscountSettings({
                itemEnabled: map['discount_manual_item_enabled'] !== '0',
                globalEnabled: map['discount_manual_global_enabled'] !== '0',
                maxPercent: parseInt(map['discount_max_percent'] || '100'),
                promoEnabled: map['promotions_enabled'] !== '0',
            });
        } catch {
            setDiscountSettings({ itemEnabled: true, globalEnabled: true, maxPercent: 100, promoEnabled: true });
        }
    };

    const loadActivePromotions = async () => {
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
            if (!Array.isArray(promos) || promos.length === 0) { setActivePromotions([]); return; }
            const enriched = await Promise.all(promos.map(async (promo) => {
                if (promo.type === 'pack_fixed' || promo.type === 'pack_quantity') {
                    try {
                        const items = await window.electronAPI.database.query(
                            `SELECT pp.product_id, pp.quantity, p.name AS product_name
                             FROM promotion_products pp JOIN products p ON pp.product_id = p.id
                             WHERE pp.promotion_id = ?`,
                            [promo.id]
                        );
                        return {
                            ...promo,
                            packProductIds: Array.isArray(items) ? items.map(i => i.product_id) : [],
                            packProducts: Array.isArray(items) ? items : [],
                        };
                    } catch { return { ...promo, packProductIds: [], packProducts: [] }; }
                }
                return { ...promo, packProductIds: [], packProducts: [] };
            }));
            setActivePromotions(enriched);
        } catch (err) {
            console.error('[POS] Error cargando promociones:', err);
            setActivePromotions([]);
        }
    };

    const loadBusinessInfo = async () => {
        try {
            const info = await businessRepo.getBusinessInfo();
            if (!info || typeof info !== 'object') {
                setBusinessInfo({ id: 1, name: 'Mi Negocio', rut: '', address: '', phone: '', email: '', logo_path: null });
                return;
            }
            setBusinessInfo({
                id: info.id || 1,
                name: info.name || 'Mi Negocio',
                rut: info.rut || '',
                address: info.address || '',
                phone: info.phone || '',
                email: info.email || '',
                logo_path: info.logo_path || null,
            });
        } catch {
            setBusinessInfo({ id: 1, name: 'Mi Negocio', rut: '', address: '', phone: '', email: '', logo_path: null });
        }
    };

    const loadProducts = async () => {
        try {
            const data = await productRepo.getAll();
            if (!Array.isArray(data)) { setProducts([]); return; }
            setProducts(data.filter(p => p.is_active === 1 || p.is_active === true));
        } catch { setProducts([]); }
    };

    // ── Agregar al carrito ────────────────────────────────────────────────────
    const handleAddToCart = (product) => {
        if (!product || typeof product !== 'object') return;
        if (product.type === 'product') {
            const isUnlimited = product.unlimited_stock === 1 || product.unlimited_stock === true;
            const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
            if (!isUnlimited && !allowNegative) {
                const stock = parseFloat(product.stock) || 0;
                const unitLabel = getUnitLabel(product);
                if (stock <= 0) {
                    showAlert(`"${product.name}" no tiene stock disponible.\n\nStock actual: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}`, 'danger');
                    return;
                }
            }
        }
        const unitType = product.unit_type || 'unidad';
        const allowsDecimal = product.allows_decimal === 1 || product.allows_decimal === true;
        if (unitType !== 'unidad' || allowsDecimal) {
            setSelectedProduct(product);
            setShowQuantityModal(true);
            return;
        }

        const existingItem = cart.find(item => item.product_id === product.id);
        let newCart;

        if (existingItem) {
            if (product.type === 'product') {
                const isUnlimited = product.unlimited_stock === 1 || product.unlimited_stock === true;
                const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
                const stock = parseFloat(product.stock) || 0;
                const unitLabel = getUnitLabel(product);
                if (!isUnlimited && !allowNegative && existingItem.quantity + 1 > stock) {
                    showAlert(`Stock insuficiente de "${product.name}".\n\nDisponible: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}\nEn carrito: ${existingItem.quantity}`, 'danger');
                    return;
                }
            }
            newCart = cart.map(item =>
                item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
            );
        } else {
            newCart = [...cart, makeCartItem(product, 1)];
        }

        applyPromosToCart(newCart);
        searchInputRef.current?.focus();
    };

    const handleQuantityConfirm = (quantity) => {
        if (!selectedProduct) return;
        if (quantity <= 0) { showAlert('La cantidad debe ser mayor a 0.', 'danger'); return; }
        if (selectedProduct.type === 'product') {
            const isUnlimited = selectedProduct.unlimited_stock === 1 || selectedProduct.unlimited_stock === true;
            const allowNegative = selectedProduct.allow_negative_stock === 1 || selectedProduct.allow_negative_stock === true;
            const stock = parseFloat(selectedProduct.stock) || 0;
            const unitLabel = getUnitLabel(selectedProduct);
            if (!isUnlimited && !allowNegative && quantity > stock) {
                showAlert(`Stock insuficiente de "${selectedProduct.name}".\n\nDisponible: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}\nSolicitado: ${formatStock(quantity)}${unitLabel ? ' ' + unitLabel : ''}`, 'danger');
                return;
            }
        }
        const existingItem = cart.find(item => item.product_id === selectedProduct.id);
        let newCart;

        if (existingItem) {
            newCart = cart.map(item =>
                item.product_id === selectedProduct.id ? { ...item, quantity: item.quantity + quantity } : item
            );
        } else {
            newCart = [...cart, makeCartItem(selectedProduct, quantity)];
        }

        applyPromosToCart(newCart);
        setShowQuantityModal(false);
        setSelectedProduct(null);
        requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    const handleUpdateQuantity = (productId, newQuantity) => {
        const quantity = parseFloat(newQuantity);
        if (isNaN(quantity) || quantity < 0) return;
        if (quantity === 0) { handleRemoveFromCart(productId); return; }
        const product = products.find(p => p.id === productId);
        if (product && product.type === 'product') {
            const isUnlimited = product.unlimited_stock === 1 || product.unlimited_stock === true;
            const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
            const stock = parseFloat(product.stock) || 0;
            const unitLabel = getUnitLabel(product);
            if (!isUnlimited && !allowNegative && quantity > stock) {
                showAlert(`Stock insuficiente de "${product.name}".\n\nDisponible: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}\nSolicitado: ${formatStock(quantity)}${unitLabel ? ' ' + unitLabel : ''}`, 'danger');
                return;
            }
        }
        const newCart = cart.map(item => item.product_id === productId ? { ...item, quantity } : item);
        applyPromosToCart(newCart);
    };

    const handleUpdateItemDiscount = (productId, manualDiscount) => {
        const numDiscount = parseFloat(manualDiscount);
        const validDiscount = isNaN(numDiscount) ? 0 : Math.max(0, numDiscount);
        const item = cart.find(i => i.product_id === productId);
        if (!item) return;
        const itemSubtotal = item.unit_price * item.quantity;
        if (validDiscount > itemSubtotal) {
            showAlert(`El descuento no puede ser mayor que el subtotal.\n\nSubtotal: ${formatCurrency(itemSubtotal)}`, 'danger');
            return;
        }
        const maxAllowed = itemSubtotal * (discountSettings.maxPercent / 100);
        const capped = Math.min(validDiscount, maxAllowed);
        const newCart = cart.map(i =>
            i.product_id === productId ? { ...i, manual_discount: capped } : i
        );
        applyPromosToCart(newCart);
    };

    const handleUpdateGlobalDiscount = (discountData) => {
        if (!discountData) { setGlobalDiscount({ type: 'percent', value: 0 }); return; }
        if (discountData.type === 'percent' && discountData.value > discountSettings.maxPercent) {
            showAlert(
                `El descuento global no puede superar el ${discountSettings.maxPercent}% configurado como límite máximo.`,
                'danger'
            );
            return;
        }
        setGlobalDiscount(discountData);
    };

    const handleRemoveFromCart = (productId) => {
        const newCart = cart.filter(item => item.product_id !== productId);
        if (newCart.length === 0) {
            setCart([]);
            setAppliedPromotions([]);
            setPromoGlobalDiscount(0);
            setGlobalDiscount(prev => prev.value > 0 ? { type: 'percent', value: 0 } : prev);
        } else {
            applyPromosToCart(newCart);
        }
    };

    const handleClearCart = () => {
        if (cart.length === 0) return;
        showConfirm({
            message: '¿Limpiar todo el carrito?',
            confirmLabel: 'Sí, limpiar',
            confirmVariant: 'danger',
            onConfirm: () => {
                setCart([]); setCustomerId(null); setGlobalDiscount({ type: 'percent', value: 0 });
                setAppliedPromotions([]); setPromoGlobalDiscount(0);
                clearDraft(); restoreSearchFocus(searchInputRef);
            },
        });
    };

    const handleUpdateCustomer = (selectedCustomerId) => setCustomerId(selectedCustomerId);

    // ── Totales ───────────────────────────────────────────────────────────────
    const calculateTotals = () => {
        if (!Array.isArray(cart)) return { subtotal: 0, subtotalBeforeGlobal: 0, total: 0, totalDiscount: 0 };
        const subtotalAfterItems = cart.reduce((sum, item) => {
            const unitPrice = parseFloat(item.unit_price) || 0;
            const quantity = parseFloat(item.quantity) || 0;
            const discount = parseFloat(item.discount) || 0;
            return sum + Math.max(0, unitPrice * quantity - discount);
        }, 0);
        const subtotalRaw = Math.round(Math.max(0, subtotalAfterItems));
        const subtotalBruto = cart.reduce((sum, item) => {
            return sum + (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
        }, 0);

        let manualDiscountAmount = 0;
        if (globalDiscount && globalDiscount.value > 0) {
            if (globalDiscount.type === 'percent') {
                manualDiscountAmount = Math.round(subtotalRaw * globalDiscount.value / 100);
            } else {
                manualDiscountAmount = Math.min(Math.round(globalDiscount.value), subtotalRaw);
            }
        }

        const promoDiscount = promoGlobalDiscount || 0;
        const globalDiscountAmount = manualDiscountAmount + promoDiscount;
        const total = Math.max(0, subtotalRaw - globalDiscountAmount);
        const itemDiscount = Math.round(subtotalBruto) - subtotalRaw;
        const totalDiscount = itemDiscount + globalDiscountAmount;

        return {
            subtotal: subtotalRaw,
            subtotalBeforeGlobal: subtotalRaw,
            subtotalBruto: Math.round(subtotalBruto),
            globalDiscountAmount,
            manualDiscountAmount,
            promoDiscountAmount: promoDiscount,
            total: Math.round(total),
            totalDiscount: Math.round(totalDiscount),
        };
    };

    const handleOpenPayment = () => {
        if (!cart?.length) {
            showAlert('El carrito está vacío.\n\nAgrega productos antes de procesar el pago.', 'primary');
            return;
        }
        if (calculateTotals().total <= 0) {
            showAlert('El total debe ser mayor a $0.', 'primary');
            return;
        }
        setShowPaymentModal(true);
    };

    // ── Completar venta ───────────────────────────────────────────────────────
    const handleCompleteSale = async (paymentData) => {
        if (isProcessingSale) return;
        if (!paymentData || typeof paymentData !== 'object') {
            showAlert('Error: datos de pago inválidos.', 'danger');
            return;
        }
        try {
            setIsProcessingSale(true);
            const totals = calculateTotals();
            if (totals.total <= 0) throw new Error('El total de la venta debe ser mayor a $0');
            const saleNumber = await saleRepo.generateSaleNumber();
            let customerName = null, customerRut = null;
            if (customerId) {
                try {
                    const customer = await customerRepo.getById(customerId);
                    if (customer && typeof customer === 'object') {
                        customerName = customer.full_name || null;
                        customerRut = customer.rut || null;
                    }
                } catch { /* noop */ }
            }
            const totalItemDiscount = cart.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
            const totalManualItemDisc = cart.reduce((s, i) => s + (parseFloat(i.manual_discount) || 0), 0);
            const totalPromoItemDisc = cart.reduce((s, i) => s + (parseFloat(i.promotion_discount) || 0), 0);
            const saleData = {
                sale_number: saleNumber,
                user_id: currentUser.id,
                customer_name: customerName,
                customer_rut: customerRut,
                subtotal: totals.subtotalBruto,
                discount: Math.round(totalItemDiscount + totals.globalDiscountAmount),
                discount_percent: totals.subtotalBruto > 0
                    ? Math.round((totalItemDiscount + totals.globalDiscountAmount) / totals.subtotalBruto * 100 * 100) / 100 : 0,
                promotion_discount: Math.round(totalPromoItemDisc + totals.promoDiscountAmount),
                manual_discount: Math.round(totalManualItemDisc + totals.manualDiscountAmount),
                total: totals.total,
                payment_method: paymentData.method,
                cash_received: paymentData.cashReceived || null,
                cash_change: paymentData.cashChange || null,
                document_type: paymentData.documentType || null,
                document_number: paymentData.documentNumber || null,
                notes: paymentData.notes || null,
                applied_promotions: appliedPromotions,
            };
            const items = cart.map(item => {
                const quantity = parseFloat(item.quantity) || 1;
                const unitPrice = parseFloat(item.unit_price) || 0;
                const costPrice = parseFloat(item.cost_price) || 0;
                const discount = parseFloat(item.discount) || 0;
                const manualDisc = parseFloat(item.manual_discount) || 0;
                const promoDisc = parseFloat(item.promotion_discount) || 0;
                const subtotal = unitPrice * quantity;
                return {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product_sku: item.product_sku || '',
                    product_type: item.product_type || 'product',
                    quantity,
                    unit_label: item.unit_label || 'un',
                    unit_type: item.unit_type || 'unidad',
                    unit_price: unitPrice,
                    cost_price: costPrice,
                    subtotal,
                    discount: Math.round(discount),
                    manual_discount: Math.round(manualDisc),
                    promotion_discount: Math.round(promoDisc),
                    promotion_id: item.promotion_id || null,
                    promotion_name: item.promotion_name || null,
                    promotion_units: item.promotion_units || null,
                    promotion_pack_times: item.promotion_pack_times || null,
                    total: Math.round(subtotal - discount),
                };
            });
            const result = await saleRepo.createSale(saleData, items);
            if (!result?.success) throw new Error('La venta no se completó correctamente');
            if (!result.saleId || result.saleId === 0) throw new Error(`ID de venta inválido: ${result.saleId}`);
            const completedSaleId = result.saleId;
            clearDraft();
            setCart([]); setCustomerId(null); setGlobalDiscount({ type: 'percent', value: 0 });
            setAppliedPromotions([]); setPromoGlobalDiscount(0);
            setShowPaymentModal(false); setIsProcessingSale(false);
            setSuccessMessage('Venta completada'); setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);
            restoreSearchFocus(searchInputRef);
            setTimeout(async () => {
                try {
                    const completeSale = await saleRepo.getSaleById(completedSaleId);
                    if (completeSale) { setLastSale(completeSale); setTimeout(() => setShowPrintModal(true), 100); }
                } catch { /* noop */ }
            }, 100);
            setTimeout(() => loadProducts(), 200);
            if (register?.id) setTimeout(() => loadCashData(register.id), 300);
        } catch (error) {
            console.error('❌ Error completing sale:', error);
            showAlert(`Error al completar la venta:\n\n${error.message}`, 'danger');
            setIsProcessingSale(false);
            restoreSearchFocus(searchInputRef);
        }
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 })
            .format(parseFloat(value) || 0);

    const totals = calculateTotals();

    // ── Loading ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="pos-main">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Iniciando Punto de Venta...</p>
                </div>
            </div>
        );
    }

    if (!cashLoading && !register && !showCloseModal) {
        return (
            <CashOpenModal
                currentUser={currentUser}
                onOpen={handleOpen}
                onCancel={onNavigate ? () => onNavigate('dashboard') : undefined}
            />
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="pos-main">

            {showSuccessToast && (
                <div className="success-toast">
                    <div className="success-toast-content">
                        <span className="success-icon">✅</span>
                        <span className="success-message">{successMessage}</span>
                    </div>
                </div>
            )}

            <div className="pos-left">
                <div className="pos-header">
                    <div className="pos-header-top">
                        <div>
                            <h1 className="pos-title">Punto de Venta</h1>
                            <p className="pos-subtitle">
                                Busca y agrega productos al carrito
                                <span className="keyboard-hints">
                                    {kbd('F9', '⌘P')}: Pagar | {kbd('F10', '⌘⌫')}: Limpiar | ESC: Buscar
                                </span>
                            </p>
                        </div>
                        <CashButton
                            register={register}
                            onMovement={openMovementModal}
                            onClose={prepareClose}
                            expectedCash={expectedCash}
                            cashSettings={cashSettings}
                        />
                    </div>
                </div>

                <ProductSearch
                    products={products}
                    onAddToCart={handleAddToCart}
                    searchInputRef={searchInputRef}
                    activePromotions={activePromotions}
                    compact={true}
                />

                <CartItemsSection
                    items={cart}
                    discountSettings={discountSettings}
                    onUpdateQuantity={handleUpdateQuantity}
                    onUpdateItemDiscount={handleUpdateItemDiscount}
                    onRemove={handleRemoveFromCart}
                    isProcessing={isProcessingSale}
                />
            </div>

            <CartSidebar
                items={cart}
                totals={totals}
                customerId={customerId}
                discountSettings={discountSettings}
                globalDiscount={globalDiscount}
                promoGlobalDiscount={promoGlobalDiscount}
                appliedPromotions={appliedPromotions}
                onUpdateCustomer={handleUpdateCustomer}
                onUpdateGlobalDiscount={handleUpdateGlobalDiscount}
                onClear={handleClearCart}
                onPay={handleOpenPayment}
                isProcessing={isProcessingSale}
                holds={holds}
                onHold={handleHold}
                onResumeHold={handleResumeHold}
                onDeleteHold={handleDeleteHold}
                activePromotions={activePromotions}
            />

            {showQuantityModal && selectedProduct && (
                <QuantityModal
                    product={selectedProduct}
                    onConfirm={handleQuantityConfirm}
                    onClose={() => { setShowQuantityModal(false); setSelectedProduct(null); restoreSearchFocus(searchInputRef); }}
                />
            )}
            {showPaymentModal && (
                <PaymentModal
                    total={totals.total}
                    onComplete={handleCompleteSale}
                    onClose={() => { setShowPaymentModal(false); restoreSearchFocus(searchInputRef); }}
                    isProcessing={isProcessingSale}
                />
            )}
            {showPrintModal && lastSale && (
                <PrintModal
                    sale={lastSale}
                    onClose={() => { setShowPrintModal(false); restoreSearchFocus(searchInputRef); }}
                    businessInfo={businessInfo}
                />
            )}
            {showOpenModal && (
                <CashOpenModal
                    currentUser={currentUser}
                    onOpen={handleOpen}
                    onCancel={() => { setShowOpenModal(false); restoreSearchFocus(searchInputRef); }}
                />
            )}
            {showMovementModal && (
                <CashMovementModal
                    initialType={movementType}
                    onAdd={handleAddMovement}
                    onClose={() => { setShowMovementModal(false); restoreSearchFocus(searchInputRef); }}
                />
            )}
            {showCloseModal && (
                <CashCloseModal
                    register={register}
                    salesSummary={salesSummary}
                    salesDetail={salesDetail}
                    movements={movements}
                    expectedCash={expectedCash}
                    businessName={businessInfo?.name}
                    businessLogo={businessInfo?.logo_path}
                    currentUser={currentUser}
                    onClose={() => { setShowCloseModal(false); restoreSearchFocus(searchInputRef); }}
                    onConfirmClose={async (data) => { await handleClose(data); }}
                />
            )}

            <POSDialog dialog={dialog} onClose={closeDialog} />
        </div>
    );
};

export default POSMain;