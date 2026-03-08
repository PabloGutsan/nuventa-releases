import React, { useState, useEffect, useRef } from 'react';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import {
    FiX, FiUpload, FiPackage, FiScissors, FiTruck,
    FiPlus, FiChevronDown, FiChevronUp, FiSearch, FiUser, FiTag
} from 'react-icons/fi';
import ProductRepository from '../../services/repositories/productRepository';
import SupplierRepository from '../../services/repositories/supplierRepository';
import useRestoreFocus from '../../hooks/useRestoreFocus'; // ← NUEVO
import './ProductModal.css';

const ProductModal = ({ product, categories: categoriesProp, onSave, onClose, db }) => {
    const [formData, setFormData] = useState({
        name: '', sku: '', barcode: '', description: '',
        category_id: '', type: 'product',
        cost_price: '', sale_price: '', stock: '', min_stock: '',
        unit: 'unidad', unit_type: 'unidad', unit_label: 'un',
        allows_decimal: false, image_path: '',
        supplier_id: '', supplier_sku: '',
        unlimited_stock: false
    });
    const [errors, setErrors]               = useState({});
    const [loading, setLoading]             = useState(false);
    const [profitAmount, setProfitAmount]   = useState(0);
    const [profitPercentage, setProfitPercentage] = useState(0);

    const [categories, setCategories]             = useState(Array.isArray(categoriesProp) ? categoriesProp : []);
    const [showQuickCategory, setShowQuickCategory] = useState(false);
    const [quickCategory, setQuickCategory]         = useState({ name: '' });
    const [quickCategoryErrors, setQuickCategoryErrors] = useState({});
    const [savingQuickCategory, setSavingQuickCategory] = useState(false);

    const [suppliers, setSuppliers]         = useState([]);
    const [supplierOpen, setSupplierOpen]   = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');
    const supplierRef = useRef(null);

    const [showQuickSupplier, setShowQuickSupplier]     = useState(false);
    const [quickSupplier, setQuickSupplier]             = useState({ business_name: '', phone: '', contact_name: '' });
    const [quickSupplierErrors, setQuickSupplierErrors] = useState({});
    const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);

    // ── Ref al primer input para hacer autofocus robusto ─────────────────────
    const firstInputRef = useRef(null);

    useRestoreFocus(); // ← restaura foco al elemento anterior al cerrarse

    const productRepo  = new ProductRepository(db);
    const supplierRepo = new SupplierRepository();

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (supplierRef.current && !supplierRef.current.contains(e.target)) {
                setSupplierOpen(false);
                setSupplierSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        // Foco robusto al abrir: doble estrategia para Electron
        requestAnimationFrame(() => {
            firstInputRef.current?.focus();
            setTimeout(() => firstInputRef.current?.focus(), 100);
        });
        return () => { document.body.style.overflow = ''; };
    }, []);

    useEffect(() => { loadSuppliers(); }, []); // eslint-disable-line

    useEffect(() => {
        if (Array.isArray(categoriesProp)) setCategories(categoriesProp);
    }, [categoriesProp]);

    const loadSuppliers = async () => {
        try {
            const data = await supplierRepo.getActive();
            setSuppliers(Array.isArray(data) ? data : []);
        } catch (err) { setSuppliers([]); }
    };

    const loadCategoriesLocal = async () => {
        try {
            const data = await productRepo.getCategories();
            if (Array.isArray(data)) setCategories(data);
        } catch (err) { console.error('❌ Error recargando categorías:', err); }
    };

    useEffect(() => {
        if (product && typeof product === 'object') {
            setFormData({
                name:           product.name        || '',
                sku:            product.sku          || '',
                barcode:        product.barcode      || '',
                description:    product.description  || '',
                category_id:    product.category_id  || '',
                type:           product.type         || 'product',
                cost_price:     product.cost_price  != null ? String(product.cost_price)  : '',
                sale_price:     product.sale_price  != null ? String(product.sale_price)  : '',
                stock:          product.stock       != null ? String(product.stock)       : '',
                min_stock:      product.min_stock   != null ? String(product.min_stock)   : '',
                unit:           product.unit        || 'unidad',
                unit_type:      product.unit_type   || 'unidad',
                unit_label:     product.unit_label  || 'un',
                allows_decimal: product.allows_decimal === 1 || product.allows_decimal === true,
                image_path:     product.image_path  || '',
                supplier_id:    '',
                supplier_sku:   '',
                unlimited_stock: product.unlimited_stock === 1 || product.unlimited_stock === true
            });
            loadProductSupplier(product.id);
        }
    }, [product]); // eslint-disable-line

    const loadProductSupplier = async (productId) => {
        try {
            const rows = await window.electronAPI.database.query(
                'SELECT supplier_id, supplier_sku FROM product_suppliers WHERE product_id = ? AND is_preferred = 1 LIMIT 1',
                [productId]
            );
            if (Array.isArray(rows) && rows.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    supplier_id:  String(rows[0].supplier_id || ''),
                    supplier_sku: rows[0].supplier_sku || ''
                }));
            }
        } catch (err) { console.error('❌ Error cargando proveedor del producto:', err); }
    };

    useEffect(() => {
        const cost   = parseFloat(formData.cost_price) || 0;
        const sale   = parseFloat(formData.sale_price) || 0;
        const profit = sale - cost;
        setProfitAmount(profit);
        setProfitPercentage(cost > 0 ? (profit / cost) * 100 : 0);
    }, [formData.cost_price, formData.sale_price]);

    useEffect(() => {
        const unitConfigs = {
            'unidad':  { label: 'un', allowsDecimal: false },
            'peso':    { label: 'kg', allowsDecimal: true  },
            'volumen': { label: 'L',  allowsDecimal: true  },
            'metro':   { label: 'm',  allowsDecimal: true  }
        };
        const config = unitConfigs[formData.unit_type] || unitConfigs['unidad'];
        setFormData(prev => ({ ...prev, unit_label: config.label, allows_decimal: config.allowsDecimal }));
    }, [formData.unit_type]);

    const getLocalTimestamp = () => {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    };

    const formatInputCLP = (value) => {
        if (value === '' || value === null || value === undefined) return '';
        const str    = String(value);
        const dotIdx = str.indexOf('.');
        let intPart  = dotIdx !== -1 ? str.slice(0, dotIdx) : str;
        let decPart  = dotIdx !== -1 ? str.slice(dotIdx + 1) : null;
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decPart !== null ? `${formattedInt},${decPart}` : formattedInt;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleCurrencyChange = (e) => {
        const { name, value } = e.target;
        const raw = value.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(',', '.');
        setFormData(prev => ({ ...prev, [name]: raw }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!['image/jpeg','image/jpg','image/png','image/webp'].includes(file.type)) { alert('Solo se permiten JPG, PNG y WebP.'); return; }
        if (file.size > 2 * 1024 * 1024) { alert('Tamaño máximo: 2MB'); return; }
        const reader = new FileReader();
        reader.onloadend = () => setFormData(prev => ({ ...prev, image_path: reader.result }));
        reader.onerror   = () => alert('Error al cargar la imagen');
        reader.readAsDataURL(file);
    };

    // ── Quick Category ─────────────────────────────────────────────────────
    const handleQuickCategoryChange = (e) => {
        const { name, value } = e.target;
        setQuickCategory(prev => ({ ...prev, [name]: value }));
        if (quickCategoryErrors[name]) setQuickCategoryErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateQuickCategory = () => {
        const errs = {};
        if (!quickCategory.name.trim()) errs.name = 'El nombre es obligatorio';
        else if (quickCategory.name.trim().length < 2) errs.name = 'Mínimo 2 caracteres';
        else if (categories.some(c => c.name.toLowerCase() === quickCategory.name.trim().toLowerCase())) errs.name = 'Ya existe una categoría con ese nombre';
        setQuickCategoryErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleQuickCreateCategory = async () => {
        if (!validateQuickCategory()) return;
        setSavingQuickCategory(true);
        try {
            const ts     = getLocalTimestamp();
            const result = await window.electronAPI.database.run(
                `INSERT INTO categories (name, is_active, created_at, updated_at) VALUES (?, 1, ?, ?)`,
                [quickCategory.name.trim(), ts, ts]
            );
            const newId = result?.lastID || result?.lastInsertRowid;
            await loadCategoriesLocal();
            if (newId) setFormData(prev => ({ ...prev, category_id: String(newId) }));
            setQuickCategory({ name: '' });
            setQuickCategoryErrors({});
            setShowQuickCategory(false);
            // ← Devolver foco al primer input del modal tras crear categoría
            setTimeout(() => firstInputRef.current?.focus(), 80);
        } catch (err) {
            if (err.message?.includes('UNIQUE')) setQuickCategoryErrors({ name: 'Ya existe una categoría con ese nombre' });
            else alert('Error al crear la categoría: ' + err.message);
        } finally {
            setSavingQuickCategory(false);
        }
    };

    const handleCancelQuickCategory = () => {
        setQuickCategory({ name: '' });
        setQuickCategoryErrors({});
        setShowQuickCategory(false);
        setTimeout(() => firstInputRef.current?.focus(), 80); // ← fix
    };

    // ── Supplier dropdown ──────────────────────────────────────────────────
    const filteredSuppliers = suppliers.filter(s => {
        const q = supplierSearch.toLowerCase();
        return (s.business_name || '').toLowerCase().includes(q) ||
               (s.contact_name  || '').toLowerCase().includes(q);
    });

    const selectedSupplier = suppliers.find(s => String(s.id) === String(formData.supplier_id));

    const handleSelectSupplier = (s) => {
        setFormData(prev => ({ ...prev, supplier_id: String(s.id) }));
        setSupplierOpen(false);
        setSupplierSearch('');
    };

    const handleClearSupplier = () => {
        setFormData(prev => ({ ...prev, supplier_id: '', supplier_sku: '' }));
        setSupplierOpen(false);
    };

    // ── Quick Supplier ─────────────────────────────────────────────────────
    const handleQuickSupplierChange = (e) => {
        const { name, value } = e.target;
        setQuickSupplier(prev => ({ ...prev, [name]: value }));
        if (quickSupplierErrors[name]) setQuickSupplierErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validateQuickSupplier = () => {
        const errs = {};
        if (!quickSupplier.business_name.trim()) errs.business_name = 'El nombre es obligatorio';
        if (!quickSupplier.phone.trim()) errs.phone = 'El teléfono es obligatorio';
        else if (quickSupplier.phone.trim().length < 8) errs.phone = 'Mínimo 8 dígitos';
        setQuickSupplierErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleQuickCreateSupplier = async () => {
        if (!validateQuickSupplier()) return;
        setSavingQuickSupplier(true);
        try {
            const result = await supplierRepo.create({
                business_name: quickSupplier.business_name.trim(),
                phone:         quickSupplier.phone.trim(),
                contact_name:  quickSupplier.contact_name.trim() || null,
                is_active: 1
            });
            await loadSuppliers();
            const newId = result?.id || result?.lastID;
            if (newId) setFormData(prev => ({ ...prev, supplier_id: String(newId) }));
            setQuickSupplier({ business_name: '', phone: '', contact_name: '' });
            setQuickSupplierErrors({});
            setShowQuickSupplier(false);
            setTimeout(() => firstInputRef.current?.focus(), 80); // ← fix
        } catch (err) {
            alert('Error al crear el proveedor: ' + err.message);
        } finally {
            setSavingQuickSupplier(false);
        }
    };

    const handleCancelQuickSupplier = () => {
        setQuickSupplier({ business_name: '', phone: '', contact_name: '' });
        setQuickSupplierErrors({});
        setShowQuickSupplier(false);
        setTimeout(() => firstInputRef.current?.focus(), 80); // ← fix
    };

    // ── Validación ─────────────────────────────────────────────────────────
    const validate = () => {
        const errs = {};
        if (!formData.name?.trim()) errs.name = 'El nombre es requerido';
        else if (formData.name.trim().length < 3)   errs.name = 'Mínimo 3 caracteres';
        else if (formData.name.trim().length > 255)  errs.name = 'Máximo 255 caracteres';

        const salePrice = parseFloat(formData.sale_price);
        if (!formData.sale_price || isNaN(salePrice) || salePrice <= 0)
            errs.sale_price = 'El precio de venta debe ser mayor a 0';

        const costPrice = parseFloat(formData.cost_price);
        if (formData.cost_price && (isNaN(costPrice) || costPrice < 0))
            errs.cost_price = 'El precio de costo debe ser ≥ 0';

        if (formData.type === 'product') {
            const stock    = parseFloat(formData.stock);
            const minStock = parseFloat(formData.min_stock);
            if (formData.stock    && (isNaN(stock)    || stock    < 0)) errs.stock     = 'El stock debe ser ≥ 0';
            if (formData.min_stock && (isNaN(minStock) || minStock < 0)) errs.min_stock = 'El stock mínimo debe ser ≥ 0';
        }

        if (formData.sku     && formData.sku.length     > 50) errs.sku     = 'Máximo 50 caracteres';
        if (formData.barcode && formData.barcode.length > 50) errs.barcode = 'Máximo 50 caracteres';

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Submit ─────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            if (!db) throw new Error('Base de datos no disponible');
            const safeNum = (val) => Number.isFinite(parseFloat(val)) ? parseFloat(val) : 0;

            const productData = {
                name:           formData.name.trim(),
                sku:            formData.sku     ? formData.sku.trim()     : null,
                barcode:        formData.barcode ? formData.barcode.trim() : null,
                description:    formData.description ? formData.description.trim() : null,
                category_id:    formData.category_id || null,
                type:           formData.type,
                cost_price:     safeNum(formData.cost_price),
                sale_price:     safeNum(formData.sale_price),
                stock:          formData.type === 'service' ? 0 : safeNum(formData.stock),
                min_stock:      formData.type === 'service' ? 0 : safeNum(formData.min_stock),
                unit:           formData.type === 'service' ? 'servicio' : (formData.unit || 'unidad'),
                unit_type:      formData.type === 'service' ? 'unidad'   : formData.unit_type,
                unit_label:     formData.type === 'service' ? 'un'       : formData.unit_label,
                allows_decimal: formData.type === 'service' ? 0 : (formData.allows_decimal ? 1 : 0),
                image_path:     formData.image_path || null,
                unlimited_stock: formData.type === 'service' ? 0 : (formData.unlimited_stock ? 1 : 0)
            };

            let savedProductId = product?.id;

            if (product && product.id) {
                await productRepo.update(product.id, productData);
                savedProductId = product.id;
            } else {
                const result = await productRepo.create(productData);
                savedProductId = result?.id || result?.lastID || result?.lastInsertRowid;
                if (!savedProductId) {
                    const query = productData.sku
                        ? 'SELECT id FROM products WHERE sku = ? ORDER BY id DESC LIMIT 1'
                        : 'SELECT id FROM products WHERE name = ? ORDER BY id DESC LIMIT 1';
                    const found = await window.electronAPI.database.query(query, [productData.sku || productData.name]);
                    savedProductId = found?.[0]?.id;
                }
            }

            if (savedProductId && formData.supplier_id) {
                await saveProductSupplier(savedProductId, parseInt(formData.supplier_id), formData.supplier_sku || null);
            } else if (savedProductId && !formData.supplier_id && product?.id) {
                await window.electronAPI.database.run(
                    'UPDATE product_suppliers SET is_preferred = 0 WHERE product_id = ? AND is_preferred = 1',
                    [savedProductId]
                );
            }

            onSave();
        } catch (error) {
            console.error('❌ Error guardando producto/servicio:', error);
            let msg = 'Error al guardar el producto/servicio';
            if (error.message.includes('UNIQUE constraint failed')) {
                if      (error.message.includes('sku'))     { msg = 'Ya existe un producto con ese SKU'; setErrors(p => ({ ...p, sku: msg })); }
                else if (error.message.includes('barcode')) { msg = 'Ya existe un producto con ese código de barras'; setErrors(p => ({ ...p, barcode: msg })); }
                else msg = 'Este producto ya está registrado';
            } else if (error.message.includes('not null'))    msg = 'Falta completar campos obligatorios';
            else if (error.message.includes('FOREIGN KEY'))   msg = 'Categoría no válida';
            else msg = error.message || 'Error desconocido';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    const saveProductSupplier = async (productId, supplierId, supplierSku) => {
        const ts = getLocalTimestamp();
        try {
            const existing = await window.electronAPI.database.query(
                'SELECT id FROM product_suppliers WHERE product_id = ? AND supplier_id = ?',
                [productId, supplierId]
            );
            if (existing?.length > 0) {
                await window.electronAPI.database.run(
                    `UPDATE product_suppliers SET is_preferred = 1, supplier_sku = ?, updated_at = ? WHERE product_id = ? AND supplier_id = ?`,
                    [supplierSku, ts, productId, supplierId]
                );
            } else {
                await window.electronAPI.database.run(
                    'UPDATE product_suppliers SET is_preferred = 0 WHERE product_id = ? AND is_preferred = 1',
                    [productId]
                );
                await window.electronAPI.database.run(
                    `INSERT INTO product_suppliers (product_id, supplier_id, supplier_sku, is_preferred, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
                    [productId, supplierId, supplierSku, ts, ts]
                );
            }
        } catch (err) { console.error('⚠️ Error guardando product_supplier:', err); }
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(value) || 0);

    const handleClose = () => { document.body.style.overflow = ''; onClose(); };
    const isService   = formData.type === 'service';
    const selectedCategoryName = categories.find(c => String(c.id) === String(formData.category_id))?.name;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content large" onClick={(e) => e.stopPropagation()}>

                <div className="modal-header">
                    <h2>{product ? '✏️ Editar' : '➕ Nuevo'} {isService ? 'Servicio' : 'Producto'}</h2>
                    <button className="modal-close" onClick={handleClose} disabled={loading} type="button">
                        <FiX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">

                    {/* Tipo */}
                    <div className="form-section">
                        <label className="form-label">Tipo</label>
                        <div className="type-selector">
                            <button type="button" className={`type-btn ${formData.type === 'product' ? 'active' : ''}`}
                                onClick={() => setFormData(p => ({ ...p, type: 'product' }))} disabled={loading}>
                                <FiPackage /><span>Producto</span>
                            </button>
                            <button type="button" className={`type-btn ${formData.type === 'service' ? 'active' : ''}`}
                                onClick={() => setFormData(p => ({ ...p, type: 'service' }))} disabled={loading}>
                                <FiScissors /><span>Servicio</span>
                            </button>
                        </div>
                        <small className="form-helper">
                            {isService ? 'Los servicios no requieren control de stock' : 'Los productos requieren control de stock e inventario'}
                        </small>
                    </div>

                    <div className="form-grid">
                        {/* ── Columna Izquierda ── */}
                        <div className="form-column">

                            <div className="form-section">
                                <h3 className="section-title">📋 Información Básica</h3>

                                <Input
                                    ref={firstInputRef} // ← ref para autofocus robusto
                                    label={isService ? "Nombre del Servicio" : "Nombre del Producto"}
                                    name="name" value={formData.name} onChange={handleChange}
                                    required error={errors.name} disabled={loading} maxLength={255}
                                    placeholder={isService ? "Ej: Corte de pelo niño" : "Ej: Shampoo Sedal 400ml"} />

                                <Input label="Descripción" name="description" value={formData.description}
                                    onChange={handleChange} disabled={loading} maxLength={500}
                                    placeholder={isService ? "Descripción del servicio" : "Descripción del producto"} />

                                {!isService && (
                                    <div className="form-row">
                                        <Input label="SKU" name="sku" value={formData.sku} onChange={handleChange}
                                            placeholder="Código interno" disabled={loading} maxLength={50}
                                            error={errors.sku} helperText="Código único de identificación" />
                                        <Input label="Código de Barras" name="barcode" value={formData.barcode}
                                            onChange={handleChange} placeholder="7801234567890" disabled={loading}
                                            maxLength={50} error={errors.barcode} helperText="EAN-13, UPC, etc." />
                                    </div>
                                )}

                                {/* Categoría */}
                                <div className="form-group">
                                    <label className="form-label">
                                        <FiTag size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                                        Categoría
                                    </label>
                                    <div className="category-select-row">
                                        <select name="category_id" value={formData.category_id} onChange={handleChange}
                                            className="form-select" disabled={loading || showQuickCategory} style={{ flex: 1 }}>
                                            <option value="">— Sin categoría —</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                        <button type="button"
                                            className={`quick-category-toggle ${showQuickCategory ? 'active' : ''}`}
                                            onClick={() => setShowQuickCategory(v => !v)}
                                            disabled={loading}
                                            title={showQuickCategory ? 'Cancelar' : 'Crear nueva categoría'}>
                                            {showQuickCategory ? <FiChevronUp size={15}/> : <FiPlus size={15}/>}
                                            <span>{showQuickCategory ? 'Cancelar' : 'Nueva'}</span>
                                        </button>
                                    </div>
                                    <small className="form-helper">
                                        {formData.category_id
                                            ? `✅ ${selectedCategoryName}`
                                            : `Organiza tus ${isService ? 'servicios' : 'productos'} por categorías`}
                                    </small>

                                    {showQuickCategory && (
                                        <div className="quick-category-form">
                                            <div className="quick-category-header">
                                                <FiTag size={13}/><span>Nueva categoría</span>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">
                                                    Nombre<span className="required-asterisk">*</span>
                                                </label>
                                                <input type="text" name="name" value={quickCategory.name}
                                                    onChange={handleQuickCategoryChange}
                                                    placeholder="Ej: Bebidas, Lácteos, Limpieza..."
                                                    className={`form-input ${quickCategoryErrors.name ? 'input-error' : ''}`}
                                                    disabled={savingQuickCategory} autoFocus maxLength={80}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCreateCategory(); } }} />
                                                {quickCategoryErrors.name && <span className="error-text">{quickCategoryErrors.name}</span>}
                                            </div>
                                            <div className="quick-supplier-actions">
                                                <button type="button" className="qs-btn qs-btn--cancel"
                                                    onClick={handleCancelQuickCategory} disabled={savingQuickCategory}>Cancelar</button>
                                                <button type="button" className="qs-btn qs-btn--save"
                                                    onClick={handleQuickCreateCategory} disabled={savingQuickCategory}>
                                                    {savingQuickCategory
                                                        ? <><span className="qs-spinner"/>Guardando...</>
                                                        : <><FiPlus size={13}/>Crear y seleccionar</>}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Proveedor */}
                            <div className="form-section">
                                <h3 className="section-title">
                                    <FiTruck size={15} style={{ marginRight: 6 }}/> Proveedor
                                </h3>
                                <div className="supplier-select-row">
                                    <div className="supplier-field-wrap" ref={supplierRef}>
                                        <button type="button"
                                            className={`supplier-search-trigger ${supplierOpen ? 'open' : ''}`}
                                            onClick={() => { setSupplierOpen(v => !v); setSupplierSearch(''); }}
                                            disabled={loading || showQuickSupplier}>
                                            <FiUser className="supplier-trigger-icon" size={15}/>
                                            <span className={`supplier-trigger-text ${selectedSupplier ? 'selected' : 'placeholder'}`}>
                                                {selectedSupplier
                                                    ? `${selectedSupplier.business_name}${selectedSupplier.contact_name ? ` · ${selectedSupplier.contact_name}` : ''}`
                                                    : 'Seleccionar proveedor'}
                                            </span>
                                            <FiChevronDown className="supplier-trigger-chevron" size={14}/>
                                        </button>

                                        {supplierOpen && (
                                            <div className="supplier-dropdown">
                                                <div className="supplier-dropdown-search">
                                                    <FiSearch size={14}/>
                                                    <input type="text" placeholder="Buscar por nombre o contacto..."
                                                        value={supplierSearch}
                                                        onChange={(e) => setSupplierSearch(e.target.value)} autoFocus/>
                                                </div>
                                                <div className="supplier-dropdown-list">
                                                    {filteredSuppliers.length > 0 ? (
                                                        filteredSuppliers.map(s => (
                                                            <div key={s.id}
                                                                className={`supplier-option ${String(s.id) === String(formData.supplier_id) ? 'selected' : ''}`}
                                                                onClick={() => handleSelectSupplier(s)}>
                                                                <div className="supplier-option-avatar">
                                                                    {s.business_name?.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="supplier-option-info">
                                                                    <span className="supplier-option-name">{s.business_name}</span>
                                                                    {s.contact_name && <span className="supplier-option-contact">{s.contact_name}</span>}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="supplier-no-results">
                                                            Sin resultados —{' '}
                                                            <button type="button" className="supplier-create-link"
                                                                onClick={() => { setSupplierOpen(false); setShowQuickSupplier(true); }}>
                                                                crear nuevo
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {formData.supplier_id && (
                                                    <div className="supplier-clear-option" onClick={handleClearSupplier}>
                                                        <FiX size={12}/> Sin proveedor
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button type="button"
                                        className={`quick-supplier-toggle ${showQuickSupplier ? 'active' : ''}`}
                                        onClick={() => setShowQuickSupplier(v => !v)}
                                        disabled={loading}
                                        title={showQuickSupplier ? 'Cancelar' : 'Crear nuevo proveedor'}>
                                        {showQuickSupplier ? <FiChevronUp size={15}/> : <FiPlus size={15}/>}
                                        <span>{showQuickSupplier ? 'Cancelar' : 'Nuevo'}</span>
                                    </button>
                                </div>

                                <small className="form-helper" style={{ marginTop: 4, display: 'block' }}>
                                    {selectedSupplier ? `✅ ${selectedSupplier.business_name}` : 'Selecciona el proveedor principal de este producto'}
                                </small>

                                {formData.supplier_id && !showQuickSupplier && (
                                    <div style={{ marginTop: 10 }}>
                                        <Input label="Código del proveedor (SKU proveedor)" name="supplier_sku"
                                            value={formData.supplier_sku} onChange={handleChange}
                                            placeholder="Ej: PROV-001" disabled={loading}
                                            helperText="Código con que el proveedor identifica este producto"/>
                                    </div>
                                )}

                                {showQuickSupplier && (
                                    <div className="quick-supplier-form" style={{ marginTop: 10 }}>
                                        <div className="quick-supplier-header">
                                            <FiTruck size={13}/><span>Nuevo proveedor</span>
                                        </div>
                                        <div className="quick-supplier-fields">
                                            <div className="form-group">
                                                <label className="form-label">Nombre comercial<span className="required-asterisk">*</span></label>
                                                <input type="text" name="business_name" value={quickSupplier.business_name}
                                                    onChange={handleQuickSupplierChange} placeholder="Ej: Distribuidora ABC"
                                                    className={`form-input ${quickSupplierErrors.business_name ? 'input-error' : ''}`}
                                                    disabled={savingQuickSupplier} autoFocus maxLength={150}/>
                                                {quickSupplierErrors.business_name && <span className="error-text">{quickSupplierErrors.business_name}</span>}
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Teléfono<span className="required-asterisk">*</span></label>
                                                <input type="text" name="phone" value={quickSupplier.phone}
                                                    onChange={handleQuickSupplierChange} placeholder="+56 9 1234 5678"
                                                    className={`form-input ${quickSupplierErrors.phone ? 'input-error' : ''}`}
                                                    disabled={savingQuickSupplier} maxLength={20}/>
                                                {quickSupplierErrors.phone && <span className="error-text">{quickSupplierErrors.phone}</span>}
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Contacto (opcional)</label>
                                                <input type="text" name="contact_name" value={quickSupplier.contact_name}
                                                    onChange={handleQuickSupplierChange} placeholder="Ej: Juan Pérez"
                                                    className="form-input" disabled={savingQuickSupplier} maxLength={100}/>
                                            </div>
                                        </div>
                                        <div className="quick-supplier-actions">
                                            <button type="button" className="qs-btn qs-btn--cancel"
                                                onClick={handleCancelQuickSupplier} disabled={savingQuickSupplier}>Cancelar</button>
                                            <button type="button" className="qs-btn qs-btn--save"
                                                onClick={handleQuickCreateSupplier} disabled={savingQuickSupplier}>
                                                {savingQuickSupplier
                                                    ? <><span className="qs-spinner"/>Guardando...</>
                                                    : <><FiPlus size={13}/>Crear y seleccionar</>}
                                            </button>
                                        </div>
                                        <p className="quick-supplier-note">💡 Puedes completar el resto de los datos del proveedor luego en el módulo de Proveedores.</p>
                                    </div>
                                )}
                            </div>

                            {/* Stock y Unidades */}
                            {!isService && (
                                <div className="form-section">
                                    <h3 className="section-title">📦 Control de Stock y Unidades</h3>
                                    <div className={`unlimited-stock-toggle ${formData.unlimited_stock ? 'active' : ''}`}
                                        onClick={() => !loading && setFormData(p => ({ ...p, unlimited_stock: !p.unlimited_stock }))}>
                                        <div className="ust-left">
                                            <div className="ust-icon">{formData.unlimited_stock ? '✅' : '📦'}</div>
                                            <div className="ust-text">
                                                <span className="ust-label">Siempre disponible</span>
                                                <span className="ust-desc">
                                                    {formData.unlimited_stock
                                                        ? 'El stock no se controla ni descuenta al vender'
                                                        : 'Activa esto si no necesitas controlar el inventario'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={`ust-switch ${formData.unlimited_stock ? 'on' : 'off'}`}>
                                            <div className="ust-knob"/>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginTop: 14 }}>
                                        <label className="form-label">Tipo de Unidad de Medida<span className="required-asterisk">*</span></label>
                                        <select name="unit_type" value={formData.unit_type} onChange={handleChange}
                                            className="form-select" disabled={loading}>
                                            <option value="unidad">🔢 Unidad (productos individuales)</option>
                                            <option value="peso">⚖️ Peso (kg/g)</option>
                                            <option value="volumen">🥤 Volumen (L/ml)</option>
                                            <option value="metro">📏 Metro (m/cm)</option>
                                        </select>
                                        <small className="form-helper">
                                            {formData.unit_type === 'unidad'  && '💡 Para productos que se venden por unidad completa'}
                                            {formData.unit_type === 'peso'    && '💡 Para productos que se venden por peso (verduras, carnes)'}
                                            {formData.unit_type === 'volumen' && '💡 Para líquidos a granel (aceite, vino)'}
                                            {formData.unit_type === 'metro'   && '💡 Para productos por metro (telas, cables)'}
                                        </small>
                                    </div>
                                    {!formData.unlimited_stock && (
                                        <>
                                            {formData.unit_type !== 'unidad' && (
                                                <div className="info-box">
                                                    <strong>✨ Conversión Automática:</strong>
                                                    <p>
                                                        En el punto de venta podrás ingresar cantidades como:
                                                        {formData.unit_type === 'peso'    && ' "450g" → "0.450 kg"'}
                                                        {formData.unit_type === 'volumen' && ' "750ml" → "0.750 L"'}
                                                        {formData.unit_type === 'metro'   && ' "150cm" → "1.5 m"'}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="form-row">
                                                <Input label={`Stock Actual (${formData.unit_label})`} name="stock"
                                                    type="text" inputMode="numeric"
                                                    value={formatInputCLP(formData.stock)} onChange={handleCurrencyChange}
                                                    placeholder="0" error={errors.stock} disabled={loading}
                                                    helperText={formData.unit_type === 'unidad' ? "Cantidad disponible en unidades" : `Cantidad en ${formData.unit_label}`}/>
                                                <Input label={`Stock Mínimo (${formData.unit_label})`} name="min_stock"
                                                    type="text" inputMode="numeric"
                                                    value={formatInputCLP(formData.min_stock)} onChange={handleCurrencyChange}
                                                    placeholder="0" error={errors.min_stock} disabled={loading}
                                                    helperText="Alerta cuando llegue a este nivel"/>
                                            </div>
                                        </>
                                    )}
                                    <input type="hidden" name="unit" value={formData.unit_label}/>
                                </div>
                            )}
                        </div>

                        {/* ── Columna Derecha ── */}
                        <div className="form-column">

                            {/* Precios */}
                            <div className="form-section">
                                <h3 className="section-title">💰 Precios y Costos</h3>
                                {!isService && formData.unit_type !== 'unidad' && (
                                    <div className="warning-box">
                                        <strong>⚠️ Precio por {formData.unit_label}:</strong>
                                        <p>Ingresa el precio por {formData.unit_label}. Ej: si el kilo cuesta $1.500, ingresa 1500.</p>
                                    </div>
                                )}
                                <Input
                                    label={isService ? "Costo del Servicio" : formData.unit_type !== 'unidad' ? `Costo por ${formData.unit_label}` : "Precio de Costo"}
                                    name="cost_price" type="text" inputMode="numeric"
                                    value={formatInputCLP(formData.cost_price)} onChange={handleCurrencyChange}
                                    placeholder="0" error={errors.cost_price} disabled={loading}
                                    helperText={isService ? "Costo del profesional/insumos" : "Precio al que compras el producto"}/>
                                <Input
                                    label={formData.unit_type !== 'unidad' && !isService ? `Precio de Venta por ${formData.unit_label}` : "Precio de Venta"}
                                    name="sale_price" type="text" inputMode="numeric"
                                    value={formatInputCLP(formData.sale_price)} onChange={handleCurrencyChange}
                                    placeholder="0" required error={errors.sale_price} disabled={loading}
                                    helperText="Precio al que vendes al cliente"/>

                                <div className="profit-info">
                                    <div className="profit-card">
                                        <label>📊 Margen de Ganancia</label>
                                        <div className="profit-values">
                                            <div className="profit-amount">
                                                <span className="label">Ganancia</span>
                                                <span className={`value ${profitAmount >= 0 ? 'positive' : 'negative'}`}>
                                                    {formatCurrency(profitAmount)}
                                                    {formData.unit_type !== 'unidad' && !isService && <small> /{formData.unit_label}</small>}
                                                </span>
                                            </div>
                                            <div className="profit-percentage">
                                                <span className="label">Porcentaje</span>
                                                <span className={`value ${profitPercentage >= 0 ? 'positive' : 'negative'}`}>
                                                    {profitPercentage.toFixed(2)}%
                                                </span>
                                            </div>
                                        </div>
                                        {formData.sale_price > 0 && formData.cost_price > 0 && (
                                            <>
                                                {profitPercentage < 0        && <div className="profit-negative">⛔ ¡Pérdida! Estás vendiendo por debajo del costo.</div>}
                                                {profitPercentage >= 0  && profitPercentage < 10  && <div className="profit-very-low">⚠️ Margen muy bajo (menos del 10%)</div>}
                                                {profitPercentage >= 10 && profitPercentage < 20  && <div className="profit-warning">⚠️ Margen bajo. Considera aumentar el precio.</div>}
                                                {profitPercentage >= 20 && profitPercentage < 50  && <div className="profit-good">✅ Margen aceptable</div>}
                                                {profitPercentage >= 50 && profitPercentage < 100 && <div className="profit-excellent">🎉 Excelente margen</div>}
                                                {profitPercentage >= 100 && <div className="profit-excellent">💎 Margen excepcional</div>}
                                            </>
                                        )}
                                        {(!formData.sale_price || !formData.cost_price) && (
                                            <div className="profit-info-text">💡 Ingresa precio de costo y venta para calcular el margen</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Imagen */}
                            <div className="form-section">
                                <h3 className="section-title">📷 Imagen de Referencia</h3>
                                <div className="image-upload-container">
                                    {formData.image_path ? (
                                        <div className="image-preview">
                                            <img src={formData.image_path} alt="Preview"/>
                                            <button type="button" className="remove-image"
                                                onClick={() => setFormData(p => ({ ...p, image_path: '' }))}
                                                disabled={loading} title="Eliminar imagen"><FiX/></button>
                                        </div>
                                    ) : (
                                        <label className="image-upload-label">
                                            <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
                                                onChange={handleImageUpload} style={{ display: 'none' }} disabled={loading}/>
                                            <FiUpload size={30}/>
                                            <span>Subir imagen</span>
                                            <small>JPG, PNG, WebP (máx. 2MB)</small>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="modal-footer">
                        <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>Cancelar</Button>
                        <Button type="submit" variant="primary" loading={loading} disabled={loading}>
                            {product ? 'Actualizar' : 'Crear'} {isService ? 'Servicio' : 'Producto'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProductModal;