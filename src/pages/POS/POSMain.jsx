// src/pages/POS/POSMain.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import ProductRepository from '../../services/repositories/productRepository';
import SaleRepository from '../../services/repositories/saleRepository';
import CustomerRepository from '../../services/repositories/customerRepository';
import ProductSearch from './ProductSearch';
import CartSidebar from './CartSidebar';
import PaymentModal from './PaymentModal';
import PrintModal from '../../components/print/PrintModal';
import BusinessRepository from '../../services/repositories/businessRepository';
import QuantityModal from './QuantityModal';

// ── Caja ──────────────────────────────────────────────────────────────────────
import useCashRegister from '../../hooks/useCashRegister';
import CashOpenModal from './CashOpenModal';
import CashMovementModal from './CashMovementModal';
import CashCloseModal from './CashCloseModal';
import CashButton from './CashButton';

import './POSMain.css';

// ── Helper: restaurar foco al input de búsqueda ───────────────────────────────
const restoreSearchFocus = (ref) => {
    requestAnimationFrame(() => {
        ref.current?.focus();
        setTimeout(() => ref.current?.focus(), 80);
        setTimeout(() => ref.current?.focus(), 200);
    });
};

// ── Helpers de stock ──────────────────────────────────────────────────────────
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

// ── Dialog React ──────────────────────────────────────────────────────────────
const POSDialog = ({ dialog, onClose }) => {
    useEffect(() => {
        if (!dialog) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (dialog.onCancel) dialog.onCancel(); else onClose?.();
            }
            if (e.key === 'Enter' && dialog.mode === 'alert') {
                dialog.onConfirm?.();
            }
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
                    {confirmVariant === 'danger'  ? '⚠️' :
                     confirmVariant === 'success' ? '✅' : 'ℹ️'}
                </div>
                <p className="pos-dialog-message">{message}</p>
                <div className="pos-dialog-actions">
                    {mode === 'confirm' && onCancel && (
                        <button className="pos-dialog-btn pos-dialog-btn--cancel" onClick={onCancel}>
                            Cancelar
                        </button>
                    )}
                    <button
                        className={`pos-dialog-btn pos-dialog-btn--${confirmVariant}`}
                        onClick={onConfirm}
                        autoFocus>
                        {confirmLabel || 'Aceptar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── POSMain ───────────────────────────────────────────────────────────────────
const POSMain = ({ onNavigate }) => {
    const { db }          = useDatabase();
    const { currentUser } = useAuth();

    const [cart,             setCart]             = useState([]);
    const [products,         setProducts]         = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [customerId,       setCustomerId]       = useState(null);
    const [showPrintModal,   setShowPrintModal]   = useState(false);
    const [lastSale,         setLastSale]         = useState(null);
    const [isProcessingSale, setIsProcessingSale] = useState(false);
    const [businessInfo,     setBusinessInfo]     = useState(null);
    const [loading,          setLoading]          = useState(true);

    const [showQuantityModal, setShowQuantityModal] = useState(false);
    const [selectedProduct,   setSelectedProduct]   = useState(null);

    const [showSuccessToast, setShowSuccessToast] = useState(false);
    const [successMessage,   setSuccessMessage]   = useState('');

    // ── Configuración de límites de caja ──────────────────────────────────────
    // Se carga desde system_settings y se pasa a CashButton para mostrar alertas
    const [cashSettings, setCashSettings] = useState(null);

    // ── Dialog React ──────────────────────────────────────────────────────────
    const [dialog, setDialog] = useState(null);

    const searchInputRef = useRef(null);

    const closeDialog = useCallback(() => {
        setDialog(null);
        restoreSearchFocus(searchInputRef);
    }, []);

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
            onCancel:  () => { setDialog(null); restoreSearchFocus(searchInputRef); },
        });
    }, []);

    const productRepo  = new ProductRepository(db);
    const saleRepo     = new SaleRepository(db);
    const customerRepo = new CustomerRepository(db);
    const businessRepo = new BusinessRepository(db);

    // ── Hook de caja ─────────────────────────────────────────────────────────
    const {
        register, expectedCash, salesSummary, salesDetail, movements,
        loading: cashLoading,
        showOpenModal, showMovementModal, showCloseModal,
        setShowOpenModal, setShowMovementModal, setShowCloseModal,
        handleOpen, handleAddMovement, handleClose,
        prepareClose, openMovementModal, movementType, loadCashData,
    } = useCashRegister({ currentUser });

    useEffect(() => {
        if (db && currentUser) initializePOS();
    }, [db, currentUser]); // eslint-disable-line

    // ── Teclas globales ───────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (showPaymentModal || showPrintModal || showQuantityModal || dialog) return;
            if (e.key === 'F9' && cart.length > 0 && !isProcessingSale) {
                e.preventDefault();
                handleOpenPayment();
            }
            if (e.key === 'F10') {
                e.preventDefault();
                handleClearCart();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [cart, isProcessingSale, showPaymentModal, showPrintModal, showQuantityModal, dialog]); // eslint-disable-line

    const initializePOS = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadBusinessInfo(),
                loadProducts(),
                loadCashSettings(),   // ← carga límites de caja
            ]);
            requestAnimationFrame(() => searchInputRef.current?.focus());
        } catch (error) {
            console.error('❌ Error inicializando POS:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Cargar configuración de límites de caja ───────────────────────────────
    const loadCashSettings = async () => {
        try {
            const limitRow = await window.electronAPI.database.get(
                `SELECT value FROM system_settings WHERE key = 'cash_limit_alert'`
            );
            const withdrawalRow = await window.electronAPI.database.get(
                `SELECT value FROM system_settings WHERE key = 'cash_withdrawal_amount'`
            );
            setCashSettings({
                limitAlert:       parseInt(limitRow?.value      || '350000'),
                withdrawalAmount: parseInt(withdrawalRow?.value || '300000'),
            });
        } catch {
            // Si falla usar defaults
            setCashSettings({ limitAlert: 350000, withdrawalAmount: 300000 });
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
                id: info.id || 1, name: info.name || 'Mi Negocio',
                rut: info.rut || '', address: info.address || '',
                phone: info.phone || '', email: info.email || '',
                logo_path: info.logo_path || null,
            });
        } catch (error) {
            console.error('❌ Error loading business info:', error);
            setBusinessInfo({ id: 1, name: 'Mi Negocio', rut: '', address: '', phone: '', email: '', logo_path: null });
        }
    };

    const loadProducts = async () => {
        try {
            const data = await productRepo.getAll();
            if (!Array.isArray(data)) { setProducts([]); return; }
            setProducts(data.filter(p => p.is_active === 1 || p.is_active === true));
        } catch (error) {
            console.error('❌ Error loading products:', error);
            setProducts([]);
        }
    };

    // ── Agregar al carrito ────────────────────────────────────────────────────
    const handleAddToCart = (product) => {
        if (!product || typeof product !== 'object') return;

        if (product.type === 'product') {
            const isUnlimited   = product.unlimited_stock   === 1 || product.unlimited_stock   === true;
            const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
            if (!isUnlimited && !allowNegative) {
                const stock     = parseFloat(product.stock) || 0;
                const unitLabel = getUnitLabel(product);
                if (stock <= 0) {
                    showAlert(
                        `"${product.name}" no tiene stock disponible.\n\nStock actual: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}`,
                        'danger'
                    );
                    return;
                }
            }
        }

        const unitType      = product.unit_type || 'unidad';
        const allowsDecimal = product.allows_decimal === 1 || product.allows_decimal === true;

        if (unitType !== 'unidad' || allowsDecimal) {
            setSelectedProduct(product);
            setShowQuantityModal(true);
            return;
        }

        const existingItem = cart.find(item => item.product_id === product.id);

        if (existingItem) {
            if (product.type === 'product') {
                const isUnlimited   = product.unlimited_stock   === 1 || product.unlimited_stock   === true;
                const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
                const stock     = parseFloat(product.stock) || 0;
                const unitLabel = getUnitLabel(product);
                if (!isUnlimited && !allowNegative && existingItem.quantity + 1 > stock) {
                    showAlert(
                        `Stock insuficiente de "${product.name}".\n\nDisponible: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}\nEn carrito: ${existingItem.quantity}`,
                        'danger'
                    );
                    return;
                }
            }
            setCart(prev => prev.map(item =>
                item.product_id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart(prev => [...prev, {
                product_id:   product.id,
                product_name: product.name,
                product_sku:  product.sku   || '',
                product_type: product.type  || 'product',
                unit_price:   parseFloat(product.sale_price) || 0,
                cost_price:   parseFloat(product.cost_price) || 0,
                quantity:     1,
                unit_label:   product.unit_label || 'un',
                unit_type:    product.unit_type  || 'unidad',
                discount:     0,
            }]);
        }

        searchInputRef.current?.focus();
    };

    // ── Cantidad decimal ──────────────────────────────────────────────────────
    const handleQuantityConfirm = (quantity) => {
        if (!selectedProduct) return;
        if (quantity <= 0) {
            showAlert('La cantidad debe ser mayor a 0.', 'danger');
            return;
        }

        if (selectedProduct.type === 'product') {
            const isUnlimited   = selectedProduct.unlimited_stock   === 1 || selectedProduct.unlimited_stock   === true;
            const allowNegative = selectedProduct.allow_negative_stock === 1 || selectedProduct.allow_negative_stock === true;
            const stock     = parseFloat(selectedProduct.stock) || 0;
            const unitLabel = getUnitLabel(selectedProduct);
            if (!isUnlimited && !allowNegative && quantity > stock) {
                showAlert(
                    `Stock insuficiente de "${selectedProduct.name}".\n\nDisponible: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}\nSolicitado: ${formatStock(quantity)}${unitLabel ? ' ' + unitLabel : ''}`,
                    'danger'
                );
                return;
            }
        }

        const existingItem = cart.find(item => item.product_id === selectedProduct.id);
        if (existingItem) {
            setCart(prev => prev.map(item =>
                item.product_id === selectedProduct.id
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            ));
        } else {
            setCart(prev => [...prev, {
                product_id:   selectedProduct.id,
                product_name: selectedProduct.name,
                product_sku:  selectedProduct.sku   || '',
                product_type: selectedProduct.type  || 'product',
                unit_price:   parseFloat(selectedProduct.sale_price) || 0,
                cost_price:   parseFloat(selectedProduct.cost_price) || 0,
                quantity,
                unit_label:   selectedProduct.unit_label || 'un',
                unit_type:    selectedProduct.unit_type  || 'unidad',
                discount:     0,
            }]);
        }

        setShowQuantityModal(false);
        setSelectedProduct(null);
        requestAnimationFrame(() => searchInputRef.current?.focus());
    };

    // ── Actualizar cantidad ───────────────────────────────────────────────────
    const handleUpdateQuantity = (productId, newQuantity) => {
        const quantity = parseFloat(newQuantity);
        if (isNaN(quantity) || quantity < 0) return;
        if (quantity === 0) { handleRemoveFromCart(productId); return; }

        const product = products.find(p => p.id === productId);
        if (product && product.type === 'product') {
            const isUnlimited   = product.unlimited_stock   === 1 || product.unlimited_stock   === true;
            const allowNegative = product.allow_negative_stock === 1 || product.allow_negative_stock === true;
            const stock     = parseFloat(product.stock) || 0;
            const unitLabel = getUnitLabel(product);
            if (!isUnlimited && !allowNegative && quantity > stock) {
                showAlert(
                    `Stock insuficiente de "${product.name}".\n\nDisponible: ${formatStock(stock)}${unitLabel ? ' ' + unitLabel : ''}\nSolicitado: ${formatStock(quantity)}${unitLabel ? ' ' + unitLabel : ''}`,
                    'danger'
                );
                return;
            }
        }

        setCart(prev => prev.map(item =>
            item.product_id === productId ? { ...item, quantity } : item
        ));
    };

    // ── Descuento por item ────────────────────────────────────────────────────
    const handleUpdateItemDiscount = (productId, discount) => {
        const numDiscount   = parseFloat(discount);
        const validDiscount = isNaN(numDiscount) ? 0 : Math.max(0, numDiscount);

        const item = cart.find(i => i.product_id === productId);
        if (item) {
            const itemSubtotal = item.unit_price * item.quantity;
            if (validDiscount > itemSubtotal) {
                showAlert(
                    `El descuento no puede ser mayor que el subtotal del producto.\n\nSubtotal: ${formatCurrency(itemSubtotal)}`,
                    'danger'
                );
                return;
            }
        }

        setCart(prev => prev.map(item =>
            item.product_id === productId ? { ...item, discount: validDiscount } : item
        ));
    };

    const handleRemoveFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.product_id !== productId));
    };

    const handleClearCart = () => {
        if (cart.length === 0) return;
        showConfirm({
            message:        '¿Limpiar todo el carrito?',
            confirmLabel:   'Sí, limpiar',
            confirmVariant: 'danger',
            onConfirm: () => {
                setCart([]);
                setCustomerId(null);
                restoreSearchFocus(searchInputRef);
            },
        });
    };

    const handleUpdateCustomer = (selectedCustomerId) => {
        setCustomerId(selectedCustomerId);
    };

    // ── Totales ───────────────────────────────────────────────────────────────
    const calculateTotals = () => {
        if (!Array.isArray(cart)) return { subtotal: 0, total: 0 };
        const subtotal = cart.reduce((sum, item) => {
            const unitPrice = parseFloat(item.unit_price) || 0;
            const quantity  = parseFloat(item.quantity)   || 0;
            const discount  = parseFloat(item.discount)   || 0;
            return sum + (unitPrice * quantity - discount);
        }, 0);
        return {
            subtotal: Math.round(Math.max(0, subtotal)),
            total:    Math.round(Math.max(0, subtotal)),
        };
    };

    // ── Abrir pago ────────────────────────────────────────────────────────────
    const handleOpenPayment = () => {
        if (!cart || cart.length === 0) {
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
                        customerRut  = customer.rut       || null;
                    }
                } catch (error) {
                    console.error('⚠️ Error cargando cliente:', error);
                }
            }

            const saleData = {
                sale_number:      saleNumber,
                user_id:          currentUser.id,
                customer_name:    customerName,
                customer_rut:     customerRut,
                subtotal:         totals.subtotal,
                discount:         0,
                discount_percent: 0,
                total:            totals.total,
                payment_method:   paymentData.method,
                cash_received:    paymentData.cashReceived   || null,
                cash_change:      paymentData.cashChange     || null,
                document_type:    paymentData.documentType   || null,
                document_number:  paymentData.documentNumber || null,
                notes:            paymentData.notes          || null,
            };

            const items = cart.map(item => {
                const quantity  = parseFloat(item.quantity)   || 1;
                const unitPrice = parseFloat(item.unit_price) || 0;
                const costPrice = parseFloat(item.cost_price) || 0;
                const discount  = parseFloat(item.discount)   || 0;
                const subtotal  = unitPrice * quantity;
                return {
                    product_id:   item.product_id,
                    product_name: item.product_name,
                    product_sku:  item.product_sku  || '',
                    product_type: item.product_type || 'product',
                    quantity,
                    unit_label:   item.unit_label || 'un',
                    unit_type:    item.unit_type  || 'unidad',
                    unit_price:   unitPrice,
                    cost_price:   costPrice,
                    subtotal,
                    discount,
                    total: Math.round(subtotal - discount),
                };
            });

            const result = await saleRepo.createSale(saleData, items);
            if (!result || !result.success) throw new Error('La venta no se completó correctamente');
            if (!result.saleId || result.saleId === 0) throw new Error(`ID de venta inválido: ${result.saleId}`);

            const completedSaleId = result.saleId;

            setCart([]);
            setCustomerId(null);
            setShowPaymentModal(false);
            setIsProcessingSale(false);
            setSuccessMessage('Venta completada');
            setShowSuccessToast(true);
            setTimeout(() => setShowSuccessToast(false), 3000);

            restoreSearchFocus(searchInputRef);

            setTimeout(async () => {
                try {
                    const completeSale = await saleRepo.getSaleById(completedSaleId);
                    if (completeSale) {
                        setLastSale(completeSale);
                        setTimeout(() => setShowPrintModal(true), 100);
                    }
                } catch (error) {
                    console.error('⚠️ Error cargando venta para imprimir:', error);
                }
            }, 100);

            setTimeout(() => loadProducts(), 200);
            // Actualizar efectivo estimado en caja para reflejar la venta
            // y disparar la alerta de retiro si corresponde
            if (register?.id) setTimeout(() => loadCashData(register.id), 300);

        } catch (error) {
            console.error('❌ Error completing sale:', error);
            showAlert(`Error al completar la venta:\n\n${error.message}`, 'danger');
            setIsProcessingSale(false);
            restoreSearchFocus(searchInputRef);
        }
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-CL', {
            style: 'currency', currency: 'CLP',
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(parseFloat(value) || 0);

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

            {/* ── Toast de éxito ── */}
            {showSuccessToast && (
                <div className="success-toast">
                    <div className="success-toast-content">
                        <span className="success-icon">✅</span>
                        <span className="success-message">{successMessage}</span>
                    </div>
                </div>
            )}

            <div className="pos-center">
                <div className="pos-header">
                    <div className="pos-header-top">
                        <div>
                            <h1 className="pos-title">Punto de Venta</h1>
                            <p className="pos-subtitle">
                                Busca y agrega productos al carrito
                                <span className="keyboard-hints">
                                    F9: Pagar | F10: Limpiar | ESC: Buscar
                                </span>
                            </p>
                        </div>
                        {/* CashButton recibe expectedCash y cashSettings para mostrar alerta de exceso */}
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
                />
            </div>

            <CartSidebar
                items={cart}
                totals={totals}
                customerId={customerId}
                onUpdateCustomer={handleUpdateCustomer}
                onUpdateQuantity={handleUpdateQuantity}
                onUpdateItemDiscount={handleUpdateItemDiscount}
                onRemove={handleRemoveFromCart}
                onClear={handleClearCart}
                onPay={handleOpenPayment}
                isProcessing={isProcessingSale}
            />

            {/* ── Modales generales ── */}
            {showQuantityModal && selectedProduct && (
                <QuantityModal
                    product={selectedProduct}
                    onConfirm={handleQuantityConfirm}
                    onClose={() => {
                        setShowQuantityModal(false);
                        setSelectedProduct(null);
                        restoreSearchFocus(searchInputRef);
                    }}
                />
            )}

            {showPaymentModal && (
                <PaymentModal
                    total={totals.total}
                    onComplete={handleCompleteSale}
                    onClose={() => {
                        setShowPaymentModal(false);
                        restoreSearchFocus(searchInputRef);
                    }}
                    isProcessing={isProcessingSale}
                />
            )}

            {showPrintModal && lastSale && (
                <PrintModal
                    sale={lastSale}
                    onClose={() => {
                        setShowPrintModal(false);
                        restoreSearchFocus(searchInputRef);
                    }}
                    businessInfo={businessInfo}
                />
            )}

            {/* ── Modales de caja ── */}
            {showOpenModal && (
                <CashOpenModal
                    currentUser={currentUser}
                    onOpen={handleOpen}
                    onCancel={() => {
                        setShowOpenModal(false);
                        restoreSearchFocus(searchInputRef);
                    }}
                />
            )}

            {showMovementModal && (
                <CashMovementModal
                    initialType={movementType}
                    onAdd={handleAddMovement}
                    onClose={() => {
                        setShowMovementModal(false);
                        restoreSearchFocus(searchInputRef);
                    }}
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
                    onClose={() => {
                        setShowCloseModal(false);
                        restoreSearchFocus(searchInputRef);
                    }}
                    onConfirmClose={async (data) => {
                        await handleClose(data);
                        // NO cerramos el modal aquí — el modal muestra la pantalla
                        // de éxito con opción de imprimir y se cierra solo después
                    }}
                />
            )}

            {/* ── POSDialog ── */}
            <POSDialog dialog={dialog} onClose={closeDialog} />

        </div>
    );
};

export default POSMain;