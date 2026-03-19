// src/pages/Promotions/PromotionFormModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    FiX, FiSave, FiTag, FiPackage, FiFilter, FiShoppingCart,
    FiCalendar, FiPercent, FiDollarSign, FiChevronDown,
    FiTrash2, FiAlertTriangle, FiTrendingUp, FiLayers, FiSearch,
} from 'react-icons/fi';
import './PromotionList.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v || 0);

const fmtPct = (v) => `${parseFloat(v || 0).toFixed(1)}%`;

const toDateInput = (dt) => {
    if (!dt) return '';
    return new Date(dt).toISOString().slice(0, 10);
};

// Formatea con separador de miles chileno
const formatThousands = (val) => {
    const num = String(val).replace(/\D/g, '');
    if (!num) return '';
    return new Intl.NumberFormat('es-CL').format(parseInt(num));
};

// Parsea valor con separador de miles → número
const parseFormatted = (val) =>
    parseFloat(String(val).replace(/\./g, '').replace(',', '.')) || 0;

// ── SearchableSelect ──────────────────────────────────────────────────────────
// Select con buscador interno y altura máxima, reemplaza el <select> nativo.
const SearchableSelect = ({ options, value, onChange, placeholder = '— Seleccionar —', disabled = false }) => {
    const [open,    setOpen]    = useState(false);
    const [query,   setQuery]   = useState('');
    const wrapRef  = useRef(null);
    const inputRef = useRef(null);

    const selected = options.find(o => String(o.value) === String(value));

    const filtered = useMemo(() => {
        if (!query.trim()) return options;
        const q = query.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(q));
    }, [options, query]);

    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = () => {
        if (disabled) return;
        setOpen(true);
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 30);
    };

    const handleSelect = (optValue) => {
        onChange(optValue);
        setOpen(false);
        setQuery('');
    };

    return (
        <div className="ss-wrap" ref={wrapRef} style={{ position: 'relative' }}>
            <button
                type="button"
                className={`ss-trigger${open ? ' ss-trigger--open' : ''}${disabled ? ' ss-trigger--disabled' : ''}`}
                onClick={handleOpen}
                disabled={disabled}
            >
                <span className={`ss-trigger-text${!selected ? ' ss-trigger-placeholder' : ''}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <FiChevronDown size={14} className="select-chevron" />
            </button>

            {open && (
                <div className="ss-dropdown">
                    <div className="ss-search">
                        <FiSearch size={12} className="ss-search-icon" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="ss-search-input"
                            placeholder="Buscar..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoComplete="off"
                        />
                        {query && (
                            <button type="button" className="ss-search-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                                <FiX size={10} />
                            </button>
                        )}
                    </div>
                    <div className="ss-list">
                        {filtered.length === 0 ? (
                            <div className="ss-empty">Sin resultados</div>
                        ) : (
                            filtered.map(o => (
                                <button
                                    key={o.value}
                                    type="button"
                                    className={`ss-item${String(o.value) === String(value) ? ' ss-item--active' : ''}`}
                                    onClick={() => handleSelect(o.value)}
                                >
                                    {o.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── SearchableAddSelect ───────────────────────────────────────────────────────
// Variante del select para "agregar" productos (no tiene valor seleccionado permanente).
const SearchableAddSelect = ({ options, onSelect, placeholder = '+ Agregar...', disabled = false }) => {
    const [open,   setOpen]   = useState(false);
    const [query,  setQuery]  = useState('');
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    const filtered = useMemo(() => {
        if (!query.trim()) return options;
        const q = query.toLowerCase();
        return options.filter(o => o.label.toLowerCase().includes(q));
    }, [options, query]);

    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleOpen = () => {
        if (disabled) return;
        setOpen(true);
        setQuery('');
        setTimeout(() => inputRef.current?.focus(), 30);
    };

    const handleSelect = (optValue) => {
        onSelect(optValue);
        setOpen(false);
        setQuery('');
    };

    return (
        <div className="ss-wrap" ref={wrapRef} style={{ position: 'relative', flex: 1 }}>
            <button
                type="button"
                className={`ss-trigger ss-trigger--add${open ? ' ss-trigger--open' : ''}${disabled ? ' ss-trigger--disabled' : ''}`}
                onClick={handleOpen}
                disabled={disabled || options.length === 0}
            >
                <span className="ss-trigger-placeholder">{options.length === 0 ? 'No hay más productos' : placeholder}</span>
                <FiChevronDown size={14} className="select-chevron" />
            </button>

            {open && (
                <div className="ss-dropdown">
                    <div className="ss-search">
                        <FiSearch size={12} className="ss-search-icon" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="ss-search-input"
                            placeholder="Buscar..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoComplete="off"
                        />
                        {query && (
                            <button type="button" className="ss-search-clear" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                                <FiX size={10} />
                            </button>
                        )}
                    </div>
                    <div className="ss-list">
                        {filtered.length === 0 ? (
                            <div className="ss-empty">Sin resultados</div>
                        ) : (
                            filtered.map(o => (
                                <button
                                    key={o.value}
                                    type="button"
                                    className="ss-item"
                                    onClick={() => handleSelect(o.value)}
                                >
                                    {o.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Tipo card ─────────────────────────────────────────────────────────────────
const TypeCard = ({ value, icon: Icon, label, desc, selected, onClick }) => (
    <button type="button"
        className={`promo-type-card${selected ? ' promo-type-card--selected' : ''}`}
        onClick={() => onClick(value)}>
        <div className="ptc-icon"><Icon size={18} /></div>
        <div className="ptc-body">
            <span className="ptc-label">{label}</span>
            <span className="ptc-desc">{desc}</span>
        </div>
    </button>
);

// ── Panel financiero ──────────────────────────────────────────────────────────
const FinancialPanel = ({ products, discountType, discountValue, promoType, packFixedItems }) => {
    const items = useMemo(() => {
        if (promoType === 'pack_fixed') {
            return packFixedItems.filter(i => i.product).map(i => ({
                name:      i.product.name,
                qty:       i.quantity,
                salePrice: parseFloat(i.product.sale_price) || 0,
                costPrice: parseFloat(i.product.cost_price) || 0,
            }));
        }
        return products.filter(p => p).map(p => ({
            name:      p.name,
            qty:       1,
            salePrice: parseFloat(p.sale_price) || 0,
            costPrice: parseFloat(p.cost_price) || 0,
        }));
    }, [products, promoType, packFixedItems]);

    if (items.length === 0) return null;

    const totalSale  = items.reduce((s, i) => s + i.salePrice * i.qty, 0);
    const totalCost  = items.reduce((s, i) => s + i.costPrice * i.qty, 0);
    const marginOrig = totalSale > 0 ? ((totalSale - totalCost) / totalSale) * 100 : 0;

    let finalPrice = totalSale;
    // Parsear el valor limpiando separadores de miles
    const val = parseFormatted(discountValue);
    if (val > 0) {
        if (discountType === 'percentage')  finalPrice = totalSale * (1 - Math.min(val, 100) / 100);
        else if (discountType === 'fixed')  finalPrice = Math.max(0, totalSale - val);
        else if (discountType === 'fixed_price') finalPrice = val;
    }

    const discountAmount = totalSale - finalPrice;
    const marginNew      = finalPrice > 0 ? ((finalPrice - totalCost) / finalPrice) * 100 : -Infinity;
    const losing         = finalPrice < totalCost;
    const marginDelta    = isFinite(marginNew) ? marginNew - marginOrig : -marginOrig;

    return (
        <div className="promo-financial-panel">
            <div className="pfp-header">
                <FiTrendingUp size={14} />
                Análisis financiero
            </div>

            <table className="pfp-table">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant.</th>
                        <th>Venta</th>
                        <th>Costo</th>
                        <th>Margen</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, i) => {
                        const lm = item.salePrice > 0
                            ? ((item.salePrice - item.costPrice) / item.salePrice) * 100 : 0;
                        return (
                            <tr key={i}>
                                <td className="pfp-product-name">{item.name}</td>
                                <td className="pfp-center">{item.qty}</td>
                                <td className="pfp-right">{fmt(item.salePrice * item.qty)}</td>
                                <td className="pfp-right pfp-cost">{fmt(item.costPrice * item.qty)}</td>
                                <td className="pfp-right">
                                    <span className={`pfp-margin-badge ${lm < 0 ? 'pfp-margin-badge--neg' : lm < 15 ? 'pfp-margin-badge--low' : 'pfp-margin-badge--ok'}`}>
                                        {fmtPct(lm)}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <div className="pfp-summary">
                <div className="pfp-row">
                    <span className="pfp-row-label">Precio venta total</span>
                    <span className="pfp-row-value">{fmt(totalSale)}</span>
                </div>
                <div className="pfp-row">
                    <span className="pfp-row-label">Costo total</span>
                    <span className="pfp-row-value pfp-cost">{fmt(totalCost)}</span>
                </div>
                <div className="pfp-row">
                    <span className="pfp-row-label">Margen actual</span>
                    <span className={`pfp-row-value ${marginOrig < 0 ? 'pfp-neg' : marginOrig < 15 ? 'pfp-warn' : 'pfp-ok'}`}>
                        {fmtPct(marginOrig)} — {fmt(totalSale - totalCost)}
                    </span>
                </div>

                {val > 0 && (
                    <>
                        <div className="pfp-divider" />
                        <div className="pfp-row">
                            <span className="pfp-row-label">Descuento aplicado</span>
                            <span className="pfp-row-value pfp-neg">−{fmt(discountAmount)}</span>
                        </div>
                        <div className="pfp-row pfp-row--highlight">
                            <span className="pfp-row-label">Precio final</span>
                            <span className="pfp-row-value pfp-bold">{fmt(finalPrice)}</span>
                        </div>
                        <div className="pfp-row pfp-row--highlight">
                            <span className="pfp-row-label">Margen con descuento</span>
                            <span className={`pfp-row-value pfp-bold ${losing ? 'pfp-neg' : isFinite(marginNew) && marginNew < 10 ? 'pfp-warn' : 'pfp-ok'}`}>
                                {losing
                                    ? `−${fmtPct(Math.abs(marginNew))} ⚠️ PÉRDIDA`
                                    : isFinite(marginNew) ? fmtPct(marginNew) : '—'}
                                {isFinite(marginDelta) && (
                                    <span className={`pfp-delta ${marginDelta < 0 ? 'pfp-neg' : 'pfp-ok'}`}>
                                        {' '}{marginDelta < 0 ? `▼ ${fmtPct(Math.abs(marginDelta))}` : `▲ ${fmtPct(marginDelta)}`}
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="pfp-row pfp-row--highlight">
                            <span className="pfp-row-label">Ganancia por venta</span>
                            <span className={`pfp-row-value pfp-bold ${losing ? 'pfp-neg' : 'pfp-ok'}`}>
                                {fmt(finalPrice - totalCost)}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {losing && val > 0 && (
                <div className="pfp-loss-alert">
                    <FiAlertTriangle size={14} />
                    <span>Estás vendiendo <strong>bajo el costo</strong>. Perderás <strong>{fmt(totalCost - finalPrice)}</strong> por cada venta.</span>
                </div>
            )}
            {!losing && val > 0 && isFinite(marginNew) && marginNew < 10 && marginNew >= 0 && (
                <div className="pfp-warn-alert">
                    <FiAlertTriangle size={14} />
                    <span>Margen muy bajo ({fmtPct(marginNew)}). Verifica que cubra tus gastos operativos.</span>
                </div>
            )}
        </div>
    );
};

// ── PromotionFormModal ────────────────────────────────────────────────────────
const PromotionFormModal = ({ db, promotion, onSaved, onClose }) => {
    const isEdit = !!promotion;

    const [form, setForm] = useState({
        name: '', description: '',
        type: 'product_discount',
        discount_type: 'percentage', discount_value: '',
        product_id: '', category_id: '',
        pack_buy_quantity: '3', pack_pay_quantity: '2',
        pack_quantity_source: 'product_list',
        minimum_purchase_amount: '',
        starts_at: '', ends_at: '',
        is_active: true,
    });

    const [packFixedItems,  setPackFixedItems]  = useState([]);
    const [packQtyProducts, setPackQtyProducts] = useState([]);
    const [allProducts,     setAllProducts]     = useState([]);
    const [allCategories,   setAllCategories]   = useState([]);
    const [errors,          setErrors]          = useState({});
    const [saving,          setSaving]          = useState(false);
    const [saveError,       setSaveError]       = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);

    const nameRef = useRef(null);

    useEffect(() => {
        loadReferenceData();
        if (isEdit) populateForm(promotion);
        setTimeout(() => nameRef.current?.focus(), 100);
    }, []); // eslint-disable-line

    useEffect(() => {
        if (form.product_id && allProducts.length > 0) {
            setSelectedProduct(allProducts.find(p => p.id === parseInt(form.product_id)) || null);
        } else { setSelectedProduct(null); }
    }, [form.product_id, allProducts]);

    const loadReferenceData = async () => {
        try {
            const [prods, cats] = await Promise.all([
                window.electronAPI.database.query(
                    `SELECT id, name, sku, sale_price, cost_price FROM products WHERE is_active = 1 ORDER BY name ASC`
                ),
                window.electronAPI.database.query(
                    `SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name ASC`
                ),
            ]);
            setAllProducts(Array.isArray(prods) ? prods : []);
            setAllCategories(Array.isArray(cats) ? cats : []);
        } catch (err) { console.error('Error loading reference data:', err); }
    };

    const populateForm = async (p) => {
        // Al editar, mostramos los valores con formato
        const discVal = p.discount_value || '';
        const minAmt  = p.minimum_purchase_amount || '';
        setForm({
            name: p.name || '', description: p.description || '',
            type: p.type || 'product_discount',
            discount_type: p.discount_type || 'percentage',
            discount_value: (p.discount_type === 'percentage')
                ? String(discVal)
                : discVal ? formatThousands(discVal) : '',
            product_id: String(p.product_id || ''),
            category_id: String(p.category_id || ''),
            pack_buy_quantity: String(p.pack_buy_quantity || '3'),
            pack_pay_quantity: String(p.pack_pay_quantity || '2'),
            pack_quantity_source: p.pack_quantity_source || 'product_list',
            minimum_purchase_amount: minAmt ? formatThousands(minAmt) : '',
            starts_at: toDateInput(p.starts_at),
            ends_at:   toDateInput(p.ends_at),
            is_active: p.is_active === 1 || p.is_active === true,
        });
        if (p.type === 'pack_fixed' || p.type === 'pack_quantity') {
            try {
                const items = await window.electronAPI.database.query(
                    `SELECT pp.product_id, pp.quantity, pr.name, pr.sale_price, pr.cost_price, pr.sku
                     FROM promotion_products pp JOIN products pr ON pp.product_id = pr.id
                     WHERE pp.promotion_id = ? ORDER BY pp.id ASC`, [p.id]
                );
                if (Array.isArray(items)) {
                    const mapped = items.map(i => ({
                        product_id: i.product_id, quantity: i.quantity || 1,
                        product: { id: i.product_id, name: i.name, sale_price: i.sale_price, cost_price: i.cost_price, sku: i.sku },
                    }));
                    if (p.type === 'pack_fixed')   setPackFixedItems(mapped);
                    if (p.type === 'pack_quantity') setPackQtyProducts(mapped);
                }
            } catch (err) { console.error('Error cargando productos del pack:', err); }
        }
    };

    const set = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
        if (saveError) setSaveError('');
    };

    const handleTypeChange = (newType) => {
        setForm(prev => ({
            ...prev, type: newType, product_id: '', category_id: '',
            discount_value: '',
            discount_type: (newType === 'pack_fixed' || newType === 'pack_quantity') ? 'fixed_price' : 'percentage',
        }));
        setErrors({});
        setSelectedProduct(null);
    };

    // ── Handlers para discount_value con formato ──────────────────────────────
    const handleDiscountValueChange = (raw) => {
        if (form.discount_type === 'percentage') {
            const digits = raw.replace(/\D/g, '');
            if (digits === '') { set('discount_value', ''); return; }
            set('discount_value', String(Math.min(parseInt(digits), 100)));
        } else {
            set('discount_value', formatThousands(raw));
        }
    };

    // ── Pack fijo ─────────────────────────────────────────────────────────────
    const addPackFixedItem = (productId) => {
        if (!productId) return;
        const pid = parseInt(productId);
        if (packFixedItems.find(i => i.product_id === pid)) return;
        const product = allProducts.find(p => p.id === pid);
        if (product) setPackFixedItems(prev => [...prev, { product_id: pid, quantity: 1, product }]);
    };

    const removePackFixedItem = (pid) => setPackFixedItems(prev => prev.filter(i => i.product_id !== pid));

    const updatePackFixedQty = (pid, qty) => {
        setPackFixedItems(prev => prev.map(i => i.product_id === pid ? { ...i, quantity: Math.max(1, parseInt(qty) || 1) } : i));
    };

    // ── Pack cantidad ─────────────────────────────────────────────────────────
    const addPackQtyProduct = (productId) => {
        if (!productId) return;
        const pid = parseInt(productId);
        if (packQtyProducts.find(i => i.product_id === pid)) return;
        const product = allProducts.find(p => p.id === pid);
        if (product) setPackQtyProducts(prev => [...prev, { product_id: pid, quantity: 1, product }]);
    };

    const removePackQtyProduct = (pid) => setPackQtyProducts(prev => prev.filter(i => i.product_id !== pid));

    const availableForFixed = allProducts.filter(p => !packFixedItems.find(i => i.product_id === p.id));
    const availableForQty   = allProducts.filter(p => !packQtyProducts.find(i => i.product_id === p.id));

    // Opciones para SearchableSelect
    const productOptions = useMemo(() =>
        allProducts.map(p => ({
            value: String(p.id),
            label: `${p.name}${p.sku ? ` (${p.sku})` : ''} — ${fmt(p.sale_price)}`,
        })),
    [allProducts]);

    const categoryOptions = useMemo(() =>
        allCategories.map(c => ({ value: String(c.id), label: c.name })),
    [allCategories]);

    const availableFixedOptions = useMemo(() =>
        availableForFixed.map(p => ({
            value: String(p.id),
            label: `${p.name}${p.sku ? ` (${p.sku})` : ''} — ${fmt(p.sale_price)}`,
        })),
    [availableForFixed]);

    const availableQtyOptions = useMemo(() =>
        availableForQty.map(p => ({
            value: String(p.id),
            label: `${p.name}${p.sku ? ` (${p.sku})` : ''} — ${fmt(p.sale_price)}`,
        })),
    [availableForQty]);

    // ── Panel financiero ──────────────────────────────────────────────────────
    const financialProducts = useMemo(() => {
        if (form.type === 'pack_fixed')    return packFixedItems.map(i => i.product).filter(Boolean);
        if (form.type === 'pack_quantity') return packQtyProducts.map(i => i.product).filter(Boolean);
        if (form.type === 'product_discount' && selectedProduct) return [selectedProduct];
        return [];
    }, [form.type, packFixedItems, packQtyProducts, selectedProduct]);

    const showFinancial = financialProducts.length > 0 && form.type !== 'minimum_amount' && form.type !== 'category_discount';

    const packFixedTotal = useMemo(() =>
        packFixedItems.reduce((s, i) => s + (parseFloat(i.product?.sale_price) || 0) * i.quantity, 0),
    [packFixedItems]);

    // ── Validación ────────────────────────────────────────────────────────────
    const validate = () => {
        const e = {};
        if (!form.name.trim()) e.name = 'El nombre es obligatorio';

        const discVal = parseFormatted(form.discount_value);
        if (form.type !== 'pack_fixed') {
            if (!form.discount_value || discVal <= 0)
                e.discount_value = 'Ingresa un valor mayor a 0';
            if (form.discount_type === 'percentage' && discVal > 100)
                e.discount_value = 'El porcentaje no puede superar 100';
        } else {
            if (!form.discount_value || discVal <= 0)
                e.discount_value = 'Ingresa el precio especial del pack';
        }

        if (form.type === 'product_discount'  && !form.product_id)  e.product_id  = 'Selecciona un producto';
        if (form.type === 'category_discount' && !form.category_id) e.category_id = 'Selecciona una categoría';

        const minAmt = parseFormatted(form.minimum_purchase_amount);
        if (form.type === 'minimum_amount' && (!form.minimum_purchase_amount || minAmt <= 0))
            e.minimum_purchase_amount = 'Ingresa un monto mínimo válido';

        if (form.type === 'pack_fixed' && packFixedItems.length < 2)
            e.pack_fixed = 'El pack debe tener al menos 2 productos';

        if (form.type === 'pack_quantity') {
            if (!form.pack_buy_quantity || parseInt(form.pack_buy_quantity) < 2) e.pack_buy_quantity = 'Mínimo 2 unidades';
            if (!form.pack_pay_quantity  || parseInt(form.pack_pay_quantity)  < 1) e.pack_pay_quantity  = 'Mínimo 1 unidad';
            if (parseInt(form.pack_pay_quantity) >= parseInt(form.pack_buy_quantity))
                e.pack_pay_quantity = 'Debe ser menor a las unidades que lleva';
            if (form.pack_quantity_source === 'product_list' && packQtyProducts.length < 1)
                e.pack_qty_products = 'Agrega al menos 1 producto elegible';
            if (form.pack_quantity_source === 'category' && !form.category_id)
                e.category_id = 'Selecciona una categoría';
        }

        if (form.starts_at && form.ends_at && form.ends_at < form.starts_at)
            e.ends_at = 'La fecha de fin debe ser posterior al inicio';

        return e;
    };

    // ── Guardar ───────────────────────────────────────────────────────────────
    const handleSave = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }

        setSaving(true);
        setSaveError('');
        try {
            const data = {
                name:                    form.name.trim(),
                description:             form.description.trim() || null,
                type:                    form.type,
                discount_type:           form.discount_type,
                // Parsear limpiando separadores de miles antes de guardar
                discount_value:          parseFormatted(form.discount_value),
                product_id:              form.product_id  ? parseInt(form.product_id)  : null,
                category_id:             form.category_id ? parseInt(form.category_id) : null,
                pack_buy_quantity:       parseInt(form.pack_buy_quantity) || 1,
                pack_pay_quantity:       parseInt(form.pack_pay_quantity) || 1,
                pack_quantity_source:    form.pack_quantity_source,
                minimum_purchase_amount: form.minimum_purchase_amount ? parseFormatted(form.minimum_purchase_amount) : 0,
                starts_at:               form.starts_at || null,
                ends_at:                 form.ends_at   || null,
                is_active:               form.is_active ? 1 : 0,
            };

            let promoId = isEdit ? promotion.id : null;

            if (isEdit) {
                await window.electronAPI.database.run(`
                    UPDATE promotions SET
                        name=?, description=?, type=?, discount_type=?, discount_value=?,
                        product_id=?, category_id=?, pack_buy_quantity=?, pack_pay_quantity=?,
                        pack_quantity_source=?, minimum_purchase_amount=?,
                        starts_at=?, ends_at=?, is_active=?, updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                `, [
                    data.name, data.description, data.type, data.discount_type, data.discount_value,
                    data.product_id, data.category_id, data.pack_buy_quantity, data.pack_pay_quantity,
                    data.pack_quantity_source, data.minimum_purchase_amount,
                    data.starts_at, data.ends_at, data.is_active, promotion.id,
                ]);
            } else {
                const result = await window.electronAPI.database.run(`
                    INSERT INTO promotions (
                        name, description, type, discount_type, discount_value,
                        product_id, category_id, pack_buy_quantity, pack_pay_quantity,
                        pack_quantity_source, minimum_purchase_amount, starts_at, ends_at, is_active
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                `, [
                    data.name, data.description, data.type, data.discount_type, data.discount_value,
                    data.product_id, data.category_id, data.pack_buy_quantity, data.pack_pay_quantity,
                    data.pack_quantity_source, data.minimum_purchase_amount,
                    data.starts_at, data.ends_at, data.is_active,
                ]);
                promoId = result.lastInsertRowid;
            }

            if (form.type === 'pack_fixed' || form.type === 'pack_quantity') {
                await window.electronAPI.database.run(
                    `DELETE FROM promotion_products WHERE promotion_id = ?`, [promoId]
                );
                const items = form.type === 'pack_fixed' ? packFixedItems : packQtyProducts;
                for (const item of items) {
                    await window.electronAPI.database.run(
                        `INSERT INTO promotion_products (promotion_id, product_id, quantity) VALUES (?,?,?)`,
                        [promoId, item.product_id, item.quantity || 1]
                    );
                }
            }

            onSaved();
        } catch (err) {
            console.error('Error saving promotion:', err);
            setSaveError(`Error al guardar: ${err.message}`);
        } finally { setSaving(false); }
    };

    const getDiscountPreview = () => {
        const val = parseFormatted(form.discount_value);
        if (!val || val <= 0) return null;
        if (form.type === 'pack_fixed') return `Precio especial del pack: ${fmt(val)} (precio normal: ${fmt(packFixedTotal)})`;
        if (form.discount_type === 'percentage')  return `${val}% de descuento`;
        if (form.discount_type === 'fixed')       return `${fmt(val)} de descuento fijo`;
        if (form.discount_type === 'fixed_price') return `Precio especial: ${fmt(val)}`;
        return null;
    };

    const discountTypeOptions = () => {
        if (form.type === 'pack_fixed')    return [{ val: 'fixed_price', label: 'Precio especial del pack', Icon: FiTag }];
        if (form.type === 'pack_quantity') return [
            { val: 'fixed_price', label: 'Precio especial', Icon: FiTag },
            { val: 'percentage',  label: 'Porcentaje (%)',  Icon: FiPercent },
        ];
        return [
            { val: 'percentage', label: 'Porcentaje', Icon: FiPercent },
            { val: 'fixed',      label: 'Monto fijo',  Icon: FiDollarSign },
        ];
    };

    return (
        <div className="promo-modal-overlay" onClick={onClose}>
            <div className={`promo-modal${showFinancial ? ' promo-modal--wide' : ''}`} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="promo-modal-header">
                    <div className="promo-modal-title">
                        <FiTag size={18} />
                        {isEdit ? 'Editar Promoción' : 'Nueva Promoción'}
                    </div>
                    <button className="promo-modal-close" onClick={onClose} type="button">
                        <FiX size={18} />
                    </button>
                </div>

                <div className="promo-modal-layout">

                    {/* ── Formulario ── */}
                    <div className="promo-modal-body promo-modal-form">

                        {/* Nombre */}
                        <div className="promo-form-section">
                            <div className="promo-field">
                                <label>Nombre <span className="req">*</span></label>
                                <input ref={nameRef} type="text" value={form.name}
                                    onChange={(e) => set('name', e.target.value)}
                                    placeholder="Ej: Pack verano, 20% en tecnología..."
                                    className={errors.name ? 'input--error' : ''} maxLength={100} />
                                {errors.name && <small className="field-error">⚠️ {errors.name}</small>}
                            </div>
                            <div className="promo-field">
                                <label>Descripción <span className="field-optional">(opcional)</span></label>
                                <input type="text" value={form.description}
                                    onChange={(e) => set('description', e.target.value)}
                                    placeholder="Detalle interno" maxLength={200} />
                            </div>
                        </div>

                        {/* Tipo — grid que siempre envuelve correctamente */}
                        <div className="promo-form-section">
                            <label className="promo-section-label">Tipo <span className="req">*</span></label>
                            <div className="promo-type-grid">
                                <TypeCard value="product_discount"  icon={FiTag}          label="Producto"      desc="% o $ off en un producto específico"          selected={form.type === 'product_discount'}  onClick={handleTypeChange} />
                                <TypeCard value="category_discount" icon={FiFilter}       label="Categoría"     desc="% off en todos los de una categoría"          selected={form.type === 'category_discount'} onClick={handleTypeChange} />
                                <TypeCard value="pack_fixed"        icon={FiPackage}      label="Pack fijo"     desc="Combo de productos a precio especial"         selected={form.type === 'pack_fixed'}        onClick={handleTypeChange} />
                                <TypeCard value="pack_quantity"     icon={FiLayers}       label="Pack cantidad" desc="Lleva N, paga M de una lista o categoría"    selected={form.type === 'pack_quantity'}     onClick={handleTypeChange} />
                                <TypeCard value="minimum_amount"    icon={FiShoppingCart} label="Monto mínimo"  desc="Descuento al superar un monto de compra"      selected={form.type === 'minimum_amount'}    onClick={handleTypeChange} />
                            </div>
                        </div>

                        {/* product_discount */}
                        {form.type === 'product_discount' && (
                            <div className="promo-form-section">
                                <div className="promo-field">
                                    <label>Producto <span className="req">*</span></label>
                                    <SearchableSelect
                                        options={productOptions}
                                        value={form.product_id}
                                        onChange={(v) => set('product_id', v)}
                                        placeholder="— Seleccionar producto —"
                                    />
                                    {errors.product_id && <small className="field-error">⚠️ {errors.product_id}</small>}
                                </div>
                            </div>
                        )}

                        {/* category_discount */}
                        {form.type === 'category_discount' && (
                            <div className="promo-form-section">
                                <div className="promo-field">
                                    <label>Categoría <span className="req">*</span></label>
                                    <SearchableSelect
                                        options={categoryOptions}
                                        value={form.category_id}
                                        onChange={(v) => set('category_id', v)}
                                        placeholder="— Seleccionar categoría —"
                                    />
                                    {errors.category_id && <small className="field-error">⚠️ {errors.category_id}</small>}
                                </div>
                            </div>
                        )}

                        {/* minimum_amount */}
                        {form.type === 'minimum_amount' && (
                            <div className="promo-form-section">
                                <div className="promo-field">
                                    <label>Monto mínimo <span className="req">*</span></label>
                                    <div className="promo-input-prefix">
                                        <span>$</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={form.minimum_purchase_amount}
                                            onChange={(e) => set('minimum_purchase_amount', formatThousands(e.target.value))}
                                            placeholder="Ej: 50.000"
                                            className={errors.minimum_purchase_amount ? 'input--error' : ''}
                                        />
                                    </div>
                                    {errors.minimum_purchase_amount && <small className="field-error">⚠️ {errors.minimum_purchase_amount}</small>}
                                    <small className="field-helper">Si el total del carrito supera este monto se aplica el descuento</small>
                                </div>
                            </div>
                        )}

                        {/* pack_fixed */}
                        {form.type === 'pack_fixed' && (
                            <div className="promo-form-section">
                                <label className="promo-section-label">
                                    <FiPackage size={14} /> Productos del pack <span className="req">*</span>
                                    <span className="field-optional"> (mínimo 2)</span>
                                </label>

                                {packFixedItems.length > 0 && (
                                    <table className="pack-items-table">
                                        <thead>
                                            <tr><th>Producto</th><th>Cant.</th><th>P. venta unit.</th><th>Subtotal</th><th></th></tr>
                                        </thead>
                                        <tbody>
                                            {packFixedItems.map(item => (
                                                <tr key={item.product_id}>
                                                    <td className="pack-product-name">{item.product?.name}</td>
                                                    <td>
                                                        <input type="number" className="pack-qty-input"
                                                            value={item.quantity} min="1" max="99"
                                                            onChange={(e) => updatePackFixedQty(item.product_id, e.target.value)} />
                                                    </td>
                                                    <td className="pack-price">{fmt(item.product?.sale_price)}</td>
                                                    <td className="pack-price pack-subtotal">{fmt((item.product?.sale_price || 0) * item.quantity)}</td>
                                                    <td>
                                                        <button type="button" className="pack-remove-btn"
                                                            onClick={() => removePackFixedItem(item.product_id)}>
                                                            <FiTrash2 size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="pack-total-row">
                                                <td colSpan={3}>Total precio normal</td>
                                                <td className="pack-price pack-subtotal">{fmt(packFixedTotal)}</td>
                                                <td></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                )}

                                <div className="pack-add-row">
                                    <SearchableAddSelect
                                        options={availableFixedOptions}
                                        onSelect={(v) => addPackFixedItem(v)}
                                        placeholder="+ Agregar producto al pack..."
                                        disabled={availableFixedOptions.length === 0}
                                    />
                                </div>
                                {errors.pack_fixed && <small className="field-error">⚠️ {errors.pack_fixed}</small>}
                            </div>
                        )}

                        {/* pack_quantity */}
                        {form.type === 'pack_quantity' && (
                            <>
                                <div className="promo-form-section">
                                    <label className="promo-section-label">Reglas del pack</label>
                                    <div className="promo-pack-row">
                                        <div className="promo-field">
                                            <label>El cliente lleva</label>
                                            <div className="promo-input-suffix">
                                                <input type="number" value={form.pack_buy_quantity}
                                                    onChange={(e) => set('pack_buy_quantity', e.target.value)}
                                                    min="2" max="99" className={errors.pack_buy_quantity ? 'input--error' : ''} />
                                                <span>unidades</span>
                                            </div>
                                            {errors.pack_buy_quantity && <small className="field-error">⚠️ {errors.pack_buy_quantity}</small>}
                                        </div>
                                        <div className="promo-pack-arrow">→</div>
                                        <div className="promo-field">
                                            <label>Paga solo</label>
                                            <div className="promo-input-suffix">
                                                <input type="number" value={form.pack_pay_quantity}
                                                    onChange={(e) => set('pack_pay_quantity', e.target.value)}
                                                    min="1" max="98" className={errors.pack_pay_quantity ? 'input--error' : ''} />
                                                <span>unidades</span>
                                            </div>
                                            {errors.pack_pay_quantity && <small className="field-error">⚠️ {errors.pack_pay_quantity}</small>}
                                        </div>
                                    </div>
                                    {parseInt(form.pack_buy_quantity) > 0 && parseInt(form.pack_pay_quantity) > 0 &&
                                     parseInt(form.pack_pay_quantity) < parseInt(form.pack_buy_quantity) && (
                                        <div className="promo-preview-box">
                                            🎁 Lleva <strong>{form.pack_buy_quantity}</strong> paga <strong>{form.pack_pay_quantity}</strong>
                                            {' '}({parseInt(form.pack_buy_quantity) - parseInt(form.pack_pay_quantity)} gratis)
                                        </div>
                                    )}
                                </div>

                                <div className="promo-form-section">
                                    <label className="promo-section-label">Productos elegibles</label>
                                    <div className="promo-disc-type-btns" style={{ marginBottom: 12 }}>
                                        <button type="button"
                                            className={`disc-mode-btn${form.pack_quantity_source === 'product_list' ? ' disc-mode-btn--active' : ''}`}
                                            onClick={() => set('pack_quantity_source', 'product_list')}>
                                            <FiPackage size={12} /> Lista de productos
                                        </button>
                                        <button type="button"
                                            className={`disc-mode-btn${form.pack_quantity_source === 'category' ? ' disc-mode-btn--active' : ''}`}
                                            onClick={() => set('pack_quantity_source', 'category')}>
                                            <FiFilter size={12} /> Por categoría
                                        </button>
                                    </div>

                                    {form.pack_quantity_source === 'category' ? (
                                        <div className="promo-field">
                                            <SearchableSelect
                                                options={categoryOptions}
                                                value={form.category_id}
                                                onChange={(v) => set('category_id', v)}
                                                placeholder="— Seleccionar categoría —"
                                            />
                                            {errors.category_id && <small className="field-error">⚠️ {errors.category_id}</small>}
                                            <small className="field-helper">El pack aplica a cualquier producto de esta categoría</small>
                                        </div>
                                    ) : (
                                        <>
                                            {packQtyProducts.length > 0 && (
                                                <div className="pack-qty-chips">
                                                    {packQtyProducts.map(item => (
                                                        <div key={item.product_id} className="pack-qty-chip">
                                                            <span>{item.product?.name}</span>
                                                            <span className="pack-qty-chip-price">{fmt(item.product?.sale_price)}</span>
                                                            <button type="button" onClick={() => removePackQtyProduct(item.product_id)}>
                                                                <FiX size={11} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="pack-add-row">
                                                <SearchableAddSelect
                                                    options={availableQtyOptions}
                                                    onSelect={(v) => addPackQtyProduct(v)}
                                                    placeholder="+ Agregar producto elegible..."
                                                    disabled={availableQtyOptions.length === 0}
                                                />
                                            </div>
                                            {errors.pack_qty_products && <small className="field-error">⚠️ {errors.pack_qty_products}</small>}
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Valor del descuento */}
                        <div className="promo-form-section">
                            <label className="promo-section-label">
                                Valor del descuento <span className="req">*</span>
                                {form.type === 'pack_fixed' && packFixedTotal > 0 && (
                                    <span className="field-optional"> — precio normal: {fmt(packFixedTotal)}</span>
                                )}
                            </label>
                            <div className="promo-discount-row">
                                <div className="promo-field promo-field--disc-type">
                                    <label>Forma</label>
                                    <div className="promo-disc-type-btns">
                                        {discountTypeOptions().map(opt => (
                                            <button key={opt.val} type="button"
                                                className={`disc-mode-btn${form.discount_type === opt.val ? ' disc-mode-btn--active' : ''}`}
                                                onClick={() => { set('discount_type', opt.val); set('discount_value', ''); }}>
                                                <opt.Icon size={12} />
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="promo-field promo-field--disc-value">
                                    <label>Valor</label>
                                    <div className="promo-input-prefix">
                                        <span>{form.discount_type === 'percentage' ? '%' : '$'}</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={form.discount_value}
                                            onChange={(e) => handleDiscountValueChange(e.target.value)}
                                            placeholder={form.discount_type === 'percentage' ? '0–100' : '0'}
                                            className={errors.discount_value ? 'input--error' : ''}
                                        />
                                    </div>
                                    {errors.discount_value && <small className="field-error">⚠️ {errors.discount_value}</small>}
                                </div>
                            </div>
                            {getDiscountPreview() && <div className="promo-preview-box">🏷️ {getDiscountPreview()}</div>}
                        </div>

                        {/* Vigencia */}
                        <div className="promo-form-section">
                            <label className="promo-section-label">
                                <FiCalendar size={14} /> Vigencia <span className="field-optional">(sin fechas = sin límite)</span>
                            </label>
                            <div className="promo-dates-row">
                                <div className="promo-field">
                                    <label>Fecha inicio</label>
                                    <input type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} />
                                </div>
                                <div className="promo-field">
                                    <label>Fecha fin</label>
                                    <input type="date" value={form.ends_at}
                                        onChange={(e) => set('ends_at', e.target.value)}
                                        className={errors.ends_at ? 'input--error' : ''} />
                                    {errors.ends_at && <small className="field-error">⚠️ {errors.ends_at}</small>}
                                </div>
                            </div>
                        </div>

                        {/* Toggle activo */}
                        <div className="promo-form-section">
                            <div className="promo-toggle-row">
                                <div>
                                    <p className="setting-toggle-title">Promoción activa</p>
                                    <p className="setting-toggle-desc">Solo las promociones activas se aplican en el POS.</p>
                                </div>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={form.is_active}
                                        onChange={(e) => set('is_active', e.target.checked)} />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        {saveError && <div className="promo-save-error"><FiX size={14} />{saveError}</div>}
                    </div>

                    {/* ── Panel financiero ── */}
                    {showFinancial && (
                        <div className="promo-modal-financial">
                            <FinancialPanel
                                products={financialProducts}
                                discountType={form.discount_type}
                                discountValue={form.discount_value}
                                promoType={form.type}
                                packFixedItems={packFixedItems}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="promo-modal-footer">
                    <button type="button" className="promo-btn-cancel" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button type="button" className="promo-btn-save" onClick={handleSave} disabled={saving}>
                        <FiSave size={15} />
                        {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Promoción'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromotionFormModal;