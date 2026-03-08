import React from 'react';
import { FiTrash2, FiMinus, FiPlus } from 'react-icons/fi';
import './Cart.css';

const Cart = ({ items, onUpdateQuantity, onUpdateDiscount, onRemove }) => {
    const calculateItemTotal = (item) => {
        const subtotal = item.unit_price * item.quantity;
        const discount = item.discount || 0;
        return subtotal - discount;
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(value) || 0);

    const formatQuantity = (value) =>
        new Intl.NumberFormat("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(parseFloat(value) || 0);

    if (items.length === 0) {
        return (
            <div className="cart-empty">
                <div className="cart-empty-icon">🛒</div>
                <p>El carrito está vacío</p>
                <small>Busca productos para comenzar</small>
            </div>
        );
    }

    return (
        <div className="cart">
            <div className="cart-header">
                <span>Producto</span>
                <span>Cant.</span>
                <span>Precio</span>
                <span>Desc.</span>
                <span>Total</span>
                <span></span>
            </div>

            <div className="cart-items">
                {items.map((item) => (
                    <div key={item.product_id} className="cart-item">
                        <div className="cart-item-name">
                            <span>{item.product_name}</span>
                            {item.product_type === "service" && (
                                <span className="service-badge-mini">✂️</span>
                            )}
                        </div>

                        <div className="cart-item-quantity">
                            <button
                                className="qty-btn"
                                onClick={() => onUpdateQuantity(item.product_id, parseFloat(item.quantity) - 1)}
                            >
                                <FiMinus />
                            </button>
                            <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => onUpdateQuantity(item.product_id, parseFloat(e.target.value) || 1)}
                                min="0.001"
                                step="any"
                                className="qty-input"
                            />
                            <button
                                className="qty-btn"
                                onClick={() => onUpdateQuantity(item.product_id, parseFloat(item.quantity) + 1)}
                            >
                                <FiPlus />
                            </button>
                        </div>

                        <div className="cart-item-price">
                            ${formatCurrency(item.unit_price)}
                        </div>

                        <div className="cart-item-discount">
                            <input
                                type="number"
                                value={item.discount || 0}
                                onChange={(e) => onUpdateDiscount(item.product_id, e.target.value)}
                                min="0"
                                step="0.01"
                                className="discount-input-cart"
                                placeholder="0"
                            />
                        </div>

                        <div className="cart-item-total">
                            ${formatCurrency(calculateItemTotal(item))}
                        </div>

                        <button
                            className="cart-item-remove"
                            onClick={() => onRemove(item.product_id)}
                        >
                            <FiTrash2 />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Cart;