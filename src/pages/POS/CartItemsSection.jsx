// src/pages/POS/CartItemsSection.jsx
import React, { useState, useEffect } from 'react';
import {
    FiTrash2, FiMinus, FiPlus, FiTag, FiPercent,
    FiX, FiShoppingCart, FiPackage,
} from 'react-icons/fi';
import './CartItemsSection.css';

const CartItemsSection = ({
    items = [],
    discountSettings,
    onUpdateQuantity,
    onUpdateItemDiscount,
    onRemove,
    isProcessing = false,
}) => {
    const [editingItemId, setEditingItemId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [discountItemId, setDiscountItemId] = useState(null);
    const [discountValue, setDiscountValue] = useState('');
    const [discountMode, setDiscountMode] = useState('fixed');

    // ── Confirmación de eliminar ──────────────────────────────────────────────
    const [confirmRemove, setConfirmRemove] = useState(null); // { productId, productName }

    useEffect(() => {
        if (!confirmRemove) return;
        const onKey = (e) => {
            if (e.key === 'Enter') { onRemove(confirmRemove.productId); setConfirmRemove(null); }
            if (e.key === 'Escape') { setConfirmRemove(null); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirmRemove, onRemove]);

    const settings = {
        itemEnabled: discountSettings?.itemEnabled !== false,
        maxPercent: discountSettings?.maxPercent ?? 100,
    };

    const formatCurrency = (v) =>
        new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
            .format(parseFloat(v) || 0);

    const formatQuantity = (item) => {
        const qty = parseFloat(item.quantity) || 0;
        const unit = item.unit_label || 'un';
        const fmt = new Intl.NumberFormat('es-CL', {
            minimumFractionDigits: 0, maximumFractionDigits: 3,
        }).format(qty);
        return `${fmt} ${unit}`;
    };

    const calculateItemTotal = (item) => {
        const price = parseFloat(item.unit_price) || 0;
        const qty = parseFloat(item.quantity) || 0;
        const disc = parseFloat(item.discount) || 0;
        return Math.round(Math.max(0, price * qty - disc));
    };

    const allowsSimpleIncrement = (item) => (item.unit_label || 'un') === 'un';

    const handleIncrement = (item) => {
        if (!allowsSimpleIncrement(item)) { startEditing(item); return; }
        onUpdateQuantity(item.product_id, parseFloat(item.quantity) + 1);
    };

    const handleDecrement = (item) => {
        if (!allowsSimpleIncrement(item)) { startEditing(item); return; }
        const newQty = parseFloat(item.quantity) - 1;
        if (newQty <= 0) {
            setConfirmRemove({ productId: item.product_id, productName: item.product_name });
        } else {
            onUpdateQuantity(item.product_id, newQty);
        }
    };

    const startEditing = (item) => { setEditingItemId(item.product_id); setEditValue(item.quantity.toString()); };
    const cancelEditing = () => { setEditingItemId(null); setEditValue(''); };

    const saveEdit = (productId) => {
        const num = parseFloat(editValue);
        if (isNaN(num) || num <= 0) { cancelEditing(); return; }
        onUpdateQuantity(productId, num);
        cancelEditing();
    };

    const handleEditKeyDown = (e, productId) => {
        if (e.key === 'Enter') { e.preventDefault(); saveEdit(productId); }
        if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
    };

    const openItemDiscount = (item) => {
        setDiscountItemId(item.product_id);
        setDiscountValue(parseFloat(item.manual_discount) > 0 ? String(item.manual_discount) : '');
        setDiscountMode('fixed');
    };

    const closeItemDiscount = () => { setDiscountItemId(null); setDiscountValue(''); };

    const applyItemDiscount = (item) => {
        const raw = parseFloat(discountValue);
        if (isNaN(raw) || raw < 0) { closeItemDiscount(); return; }
        const itemSubtotal = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
        const maxDiscount = itemSubtotal * (settings.maxPercent / 100);
        let discountAmount;
        if (discountMode === 'percent') {
            if (raw > settings.maxPercent) {
                setDiscountValue(String(settings.maxPercent));
                return; // no aplicar, dejar al usuario corregir
            }
            discountAmount = Math.round(itemSubtotal * raw / 100);
        } else {
            discountAmount = Math.round(Math.min(raw, maxDiscount));
        }
        // Verificación final del límite
        const pctResultante = itemSubtotal > 0 ? (discountAmount / itemSubtotal) * 100 : 0;
        if (pctResultante > settings.maxPercent + 0.01) {
            // silently cap — ya fue advertido arriba
            discountAmount = Math.round(itemSubtotal * settings.maxPercent / 100);
        }
        onUpdateItemDiscount(item.product_id, discountAmount);
        closeItemDiscount();
    };

    const handleDiscountKeyDown = (e, item) => {
        if (e.key === 'Enter') { e.preventDefault(); applyItemDiscount(item); }
        if (e.key === 'Escape') { e.preventDefault(); closeItemDiscount(); }
    };

    // ── Empty state ───────────────────────────────────────────────────────────
    if (items.length === 0) {
        return (
            <div className="pci-empty">
                <FiShoppingCart size={40} className="pci-empty-icon" />
                <p className="pci-empty-title">Carrito vacío</p>
                <small className="pci-empty-sub">Busca y agrega productos con el buscador</small>
            </div>
        );
    }
    // ── Items list ────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Header con contador ── */}
            <div className="pci-header">
                <div className="pci-header-left">
                    <FiShoppingCart size={16} className="pci-header-icon" />
                    <span className="pci-header-title">Carrito</span>
                </div>
                <span className="pci-header-count">{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
            </div>

            <div className="pci-area">
                {items.map((item, rowIndex) => {
                    const isEditingDiscount = discountItemId === item.product_id;
                    const hasPromotion = (parseFloat(item.promotion_discount) || 0) > 0;
                    const hasManualDiscount = (parseFloat(item.manual_discount) || 0) > 0;
                    const hasAnyDiscount = hasPromotion || hasManualDiscount;
                    const itemTotal = calculateItemTotal(item);
                    const qty = parseFloat(item.quantity) || 0;
                    const unitPrice = parseFloat(item.unit_price) || 0;
                    const subtotalBruto = unitPrice * qty;

                    return (
                        <div
                            key={item.product_id}
                            className={`pci-item${hasAnyDiscount ? ' pci-item--discounted' : ''}`}
                        >
                            {/* ── Número de línea ── */}
                            <div className="pci-line-num">{rowIndex + 1}</div>

                            {/* ── Icono / imagen ── */}
                            <div className="pci-icon">
                                {item.image_path ? (
                                    <img
                                        src={item.image_path}
                                        alt={item.product_name}
                                        className="pci-icon-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div
                                    className="pci-icon-fallback"
                                    style={{ display: item.image_path ? 'none' : 'flex' }}
                                >
                                    {item.product_type === 'service'
                                        ? <span className="pci-icon-emoji">✂️</span>
                                        : <FiPackage size={20} className="pci-icon-pkg" />
                                    }
                                </div>
                            </div>

                            {/* ── Info central ── */}
                            <div className="pci-info">
                                <div className="pci-name">
                                    {item.product_name}
                                </div>
                                <div className="pci-meta">
                                    ${formatCurrency(unitPrice)} c/u
                                    {item.product_sku ? ` · ${item.product_sku}` : ''}
                                </div>

                                {/* ── Tags de descuento ── */}
                                {hasAnyDiscount && !isEditingDiscount && (
                                    <div className="pci-tags">
                                        {/* Una etiqueta por cada promoción aplicada */}
                                        {Array.isArray(item.promotion_entries) && item.promotion_entries.length > 0
                                            ? item.promotion_entries.map((entry, ei) => (
                                                <span key={ei} className="pci-tag pci-tag--promo">
                                                    <FiTag size={9} />
                                                    {entry.promotionName}
                                                    {entry.packCount >= 1
                                                        ? ` (${entry.packCount} ${entry.packCount === 1 ? 'grupo' : 'grupos'})`
                                                        : ''}
                                                    {': '}−${formatCurrency(entry.discount)}
                                                </span>
                                            ))
                                            : hasPromotion && (
                                                // fallback para ítems cargados antes del cambio
                                                <span className="pci-tag pci-tag--promo">
                                                    <FiTag size={9} />
                                                    {item.promotion_name || 'Promoción'}
                                                    {item.promotion_units && item.promotion_units < (parseFloat(item.quantity) || 0)
                                                        ? `: 1 un en pack −$${formatCurrency(item.promotion_discount)}`
                                                        : `: −$${formatCurrency(item.promotion_discount)}`}
                                                </span>
                                            )
                                        }
                                        {hasManualDiscount && (
                                            <span className="pci-tag pci-tag--manual">
                                                <FiPercent size={9} />
                                                Dto. manual −${formatCurrency(item.manual_discount)}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* ── Editor de descuento ── */}
                                {isEditingDiscount && (
                                    <div className="pci-disc-editor">
                                        <div className="pci-disc-modes">
                                            <button
                                                className={`pci-disc-mode${discountMode === 'fixed' ? ' active' : ''}`}
                                                onClick={() => setDiscountMode('fixed')}
                                                type="button"
                                            >
                                                $ monto
                                            </button>
                                            <button
                                                className={`pci-disc-mode${discountMode === 'percent' ? ' active' : ''}`}
                                                onClick={() => setDiscountMode('percent')}
                                                type="button"
                                            >
                                                % porcentaje
                                            </button>
                                        </div>
                                        <div className="pci-disc-row">
                                            <span className="pci-disc-prefix">
                                                {discountMode === 'fixed' ? '$' : '%'}
                                            </span>
                                            <input
                                                type="number"
                                                className="pci-disc-input"
                                                placeholder={discountMode === 'fixed' ? '0' : `0–${settings.maxPercent}`}
                                                value={discountValue}
                                                onChange={(e) => setDiscountValue(e.target.value)}
                                                onKeyDown={(e) => handleDiscountKeyDown(e, item)}
                                                autoFocus
                                                min="0"
                                                max={discountMode === 'percent' ? settings.maxPercent : undefined}
                                            />
                                            <button
                                                className="pci-disc-apply"
                                                onClick={() => applyItemDiscount(item)}
                                                type="button"
                                            >
                                                Aplicar
                                            </button>
                                            {hasManualDiscount && (
                                                <button
                                                    className="pci-disc-clear"
                                                    onClick={() => {
                                                        onUpdateItemDiscount(item.product_id, 0);
                                                        closeItemDiscount();
                                                    }}
                                                    type="button"
                                                    title="Quitar descuento"
                                                >
                                                     <FiTrash2 size={11} />
                                                    
                                                </button>
                                            )}
                                            <button
                                                className="pci-disc-cancel"
                                                onClick={closeItemDiscount}
                                                type="button"
                                                title="Cerrar"
                                            >
                                                <FiX size={11} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Cantidad ── */}
                            <div className="pci-qty">
                                {editingItemId === item.product_id ? (
                                    <div className="pci-qty-edit">
                                        <input
                                            type="text"
                                            className="pci-qty-input"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onKeyDown={(e) => handleEditKeyDown(e, item.product_id)}
                                            onBlur={() => saveEdit(item.product_id)}
                                            autoFocus
                                            disabled={isProcessing}
                                        />
                                        <span className="pci-qty-unit">{item.unit_label || 'un'}</span>
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            className="pci-qty-btn"
                                            onClick={() => handleDecrement(item)}
                                            disabled={isProcessing}
                                        >
                                            <FiMinus size={11} />
                                        </button>
                                        <button
                                            className="pci-qty-val"
                                            onClick={() => startEditing(item)}
                                            disabled={isProcessing}
                                            title="Click para editar cantidad"
                                        >
                                            {formatQuantity(item)}
                                        </button>
                                        <button
                                            className="pci-qty-btn"
                                            onClick={() => handleIncrement(item)}
                                            disabled={isProcessing}
                                        >
                                            <FiPlus size={11} />
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* ── Precio ── */}
                            <div className="pci-price">
                                {hasAnyDiscount && (
                                    <>
                                        <span className="pci-price-orig">${formatCurrency(subtotalBruto)}</span>
                                        <span className="pci-price-disc">−${formatCurrency(parseFloat(item.discount) || 0)}</span>
                                    </>
                                )}
                                <span className={`pci-price-total${hasAnyDiscount ? ' pci-price-total--disc' : ''}`}>
                                    ${formatCurrency(itemTotal)}
                                </span>
                            </div>

                            {/* ── Acciones ── */}
                            <div className="pci-actions">
                                {settings.itemEnabled && !isProcessing && (
                                    <button
                                        className={`pci-btn pci-btn--tag${hasManualDiscount ? ' pci-btn--tag-active' : ''}`}
                                        onClick={() => isEditingDiscount ? closeItemDiscount() : openItemDiscount(item)}
                                        title="Descuento manual"
                                        disabled={isProcessing}
                                    >
                                        <FiTag size={13} />
                                    </button>
                                )}
                                <button
                                    className="pci-btn pci-btn--del"
                                    onClick={() => setConfirmRemove({ productId: item.product_id, productName: item.product_name })}
                                    title="Eliminar producto"
                                    disabled={isProcessing}
                                >
                                    <FiTrash2 size={13} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Dialog de confirmación eliminar ── */}
            {confirmRemove && (
                <div className="pci-dialog-overlay" onClick={() => setConfirmRemove(null)}>
                    <div className="pci-dialog" onClick={e => e.stopPropagation()}>
                        <div className="pci-dialog-icon">🗑️</div>
                        <p className="pci-dialog-message">
                            ¿Eliminar <strong>{confirmRemove.productName}</strong> del carrito?
                        </p>
                        <div className="pci-dialog-actions">
                            <button
                                className="pci-dialog-btn pci-dialog-btn--cancel"
                                onClick={() => setConfirmRemove(null)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="pci-dialog-btn pci-dialog-btn--danger"
                                onClick={() => { onRemove(confirmRemove.productId); setConfirmRemove(null); }}
                                autoFocus
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CartItemsSection;