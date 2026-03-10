// src/pages/Inventory/PurchaseOrderModal.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    FiX, FiSearch, FiPlus, FiTrash2, FiAlertTriangle,
    FiCheckCircle, FiPackage, FiTruck, FiFileText,
    FiInfo, FiChevronDown, FiTag
} from 'react-icons/fi';
import PurchaseRepository from '../../services/repositories/purchaseRepository';
import SupplierRepository from '../../services/repositories/supplierRepository';
import './PurchaseOrderModal.css';

const fmt = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n || 0);
const toDisplay = (val) => { const raw = String(val || '').replace(/\D/g, ''); return raw ? parseInt(raw, 10).toLocaleString('es-CL') : ''; };
const fromDisplay = (val) => String(val || '').replace(/\./g, '').replace(/[^0-9]/g, '');

const UNIT_CONFIGS = {
    unidad: { label: 'un', allowsDecimal: false },
    peso: { label: 'kg', allowsDecimal: true },
    volumen: { label: 'L', allowsDecimal: true },
    metro: { label: 'm', allowsDecimal: true },
};

const getLocalTimestamp = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// QuickProductCreate
// ─────────────────────────────────────────────────────────────────────────────
const QuickProductCreate = ({ initialName, initialCost, onCreated, onCancel }) => {
    const [name, setName] = useState(initialName || '');
    const [sku, setSku] = useState('');
    const [barcode, setBarcode] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [categories, setCategories] = useState([]);
    const [unitType, setUnitType] = useState('unidad');
    const [costPrice, setCostPrice] = useState(initialCost ? String(initialCost) : '');
    const [salePrice, setSalePrice] = useState('');
    const [unlimitedStock, setUnlimitedStock] = useState(false);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const [showQuickCat, setShowQuickCat] = useState(false);
    const [quickCatName, setQuickCatName] = useState('');
    const [quickCatErr, setQuickCatErr] = useState('');
    const [savingCat, setSavingCat] = useState(false);

    const nameRef = useRef(null);
    const quickCatRef = useRef(null);

    useEffect(() => { setTimeout(() => nameRef.current?.focus(), 80); }, []);
    useEffect(() => { loadCategories(); }, []);

    const loadCategories = async () => {
        try {
            const rows = await window.electronAPI.database.query(
                'SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name ASC'
            );
            setCategories(Array.isArray(rows) ? rows : []);
        } catch { setCategories([]); }
    };

    const handleQuickCatSave = async () => {
        const trimmed = quickCatName.trim();
        if (!trimmed || trimmed.length < 2) { setQuickCatErr('Mínimo 2 caracteres'); return; }
        if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) { setQuickCatErr('Ya existe esa categoría'); return; }
        setSavingCat(true);
        try {
            const ts = getLocalTimestamp();
            const result = await window.electronAPI.database.run(
                'INSERT INTO categories (name, is_active, created_at, updated_at) VALUES (?, 1, ?, ?)',
                [trimmed, ts, ts]
            );
            const newId = result?.lastID || result?.lastInsertRowid;
            await loadCategories();
            if (newId) setCategoryId(String(newId));
            setQuickCatName(''); setQuickCatErr(''); setShowQuickCat(false);
        } catch (err) {
            if (err.message?.includes('UNIQUE')) setQuickCatErr('Ya existe esa categoría');
            else setQuickCatErr('Error al crear: ' + err.message);
        } finally { setSavingCat(false); }
    };

    const validate = () => {
        const errs = {};
        if (!name.trim() || name.trim().length < 2) errs.name = 'Mínimo 2 caracteres';
        const sp = parseFloat(salePrice);
        if (!salePrice || isNaN(sp) || sp <= 0) errs.salePrice = 'El precio de venta es requerido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCreate = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const cfg = UNIT_CONFIGS[unitType] || UNIT_CONFIGS.unidad;
            const ts = getLocalTimestamp();
            const costVal = parseFloat(costPrice) || 0;
            const saleVal = parseFloat(salePrice);

            const result = await window.electronAPI.database.run(
                `INSERT INTO products
                    (name, sku, barcode, type,
                     sale_price, cost_price,
                     stock, min_stock,
                     unit, unit_type, unit_label, allows_decimal, unlimited_stock,
                     category_id, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, 'product', ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [
                    name.trim(), sku.trim() || null, barcode.trim() || null,
                    saleVal, costVal,
                    cfg.label, unitType, cfg.label,
                    cfg.allowsDecimal ? 1 : 0,
                    unlimitedStock ? 1 : 0,
                    categoryId ? parseInt(categoryId) : null,
                    ts, ts,
                ]
            );

            const newId = result?.lastID || result?.lastInsertRowid;
            if (!newId) throw new Error('No se obtuvo el ID del nuevo producto');

            const categoryName = categories.find(c => String(c.id) === String(categoryId))?.name || '';

            onCreated({
                id: newId, name: name.trim(),
                sku: sku.trim() || null, barcode: barcode.trim() || null,
                sale_price: saleVal, cost_price: costVal, stock: 0,
                unit_type: unitType, unit_label: cfg.label, unit: cfg.label,
                allows_decimal: cfg.allowsDecimal ? 1 : 0,
                unlimited_stock: unlimitedStock ? 1 : 0,
                category_id: categoryId || null, category_name: categoryName,
                isNew: true,
            });
        } catch (err) {
            if (err.message?.includes('UNIQUE')) {
                if (err.message.includes('sku')) setErrors(p => ({ ...p, sku: 'Ya existe un producto con ese SKU' }));
                else if (err.message.includes('barcode')) setErrors(p => ({ ...p, barcode: 'Ya existe un producto con ese código de barras' }));
                else setErrors(p => ({ ...p, name: 'Ya existe un producto con ese nombre' }));
            } else {
                setErrors({ name: err.message });
            }
        } finally { setSaving(false); }
    };

    return (
        <div className="por-quickcreate">
            <div className="por-qc-header"><FiPlus size={12} /> Crear nuevo producto</div>
            <div className="por-qc-fields">
                <div className="por-qc-field por-qc-field--full">
                    <label>Nombre <span className="por-qc-req">*</span></label>
                    <input ref={nameRef} type="text" value={name}
                        onChange={(e) => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                        className={`por-qc-input ${errors.name ? 'error' : ''}`}
                        placeholder="Nombre del producto" disabled={saving} maxLength={255}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onCancel(); }} />
                    {errors.name && <span className="por-qc-err">{errors.name}</span>}
                </div>
                <div className="por-qc-field">
                    <label>SKU <span className="por-qc-optional">(opcional)</span></label>
                    <input type="text" value={sku}
                        onChange={(e) => { setSku(e.target.value); setErrors(p => ({ ...p, sku: '' })); }}
                        className={`por-qc-input ${errors.sku ? 'error' : ''}`}
                        placeholder="Ej: PROD-001" disabled={saving} maxLength={50}
                        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} />
                    {errors.sku && <span className="por-qc-err">{errors.sku}</span>}
                </div>
                <div className="por-qc-field">
                    <label>Código de barras <span className="por-qc-optional">(opcional)</span></label>
                    <input type="text" value={barcode}
                        onChange={(e) => { setBarcode(e.target.value); setErrors(p => ({ ...p, barcode: '' })); }}
                        className={`por-qc-input ${errors.barcode ? 'error' : ''}`}
                        placeholder="Ej: 7801234567890" disabled={saving} maxLength={50}
                        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }} />
                    {errors.barcode && <span className="por-qc-err">{errors.barcode}</span>}
                </div>
                <div className="por-qc-field por-qc-field--full">
                    <label><FiTag size={11} style={{ marginRight: 4 }} />Categoría <span className="por-qc-optional">(opcional)</span></label>
                    <div className="por-qc-cat-row">
                        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                            className="por-qc-select" disabled={saving || showQuickCat} style={{ flex: 1 }}>
                            <option value="">— Sin categoría —</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button type="button"
                            className={`por-qc-cat-toggle ${showQuickCat ? 'active' : ''}`}
                            onClick={() => { setShowQuickCat(v => !v); setQuickCatName(''); setQuickCatErr(''); }}
                            disabled={saving}
                            title={showQuickCat ? 'Cancelar' : 'Crear nueva categoría'}>
                            <FiPlus size={13} />
                            <span>{showQuickCat ? 'Cancelar' : 'Nueva'}</span>
                        </button>
                    </div>
                    {showQuickCat && (
                        <div className="por-qc-newcat">
                            <div className="por-qc-newcat-header"><FiTag size={11} /> Nueva categoría</div>
                            <input ref={quickCatRef} type="text" value={quickCatName}
                                onChange={(e) => { setQuickCatName(e.target.value); setQuickCatErr(''); }}
                                className={`por-qc-input ${quickCatErr ? 'error' : ''}`}
                                placeholder="Ej: Bebidas, Lácteos..." disabled={savingCat}
                                autoFocus maxLength={80}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleQuickCatSave(); } if (e.key === 'Escape') { setShowQuickCat(false); } }} />
                            {quickCatErr && <span className="por-qc-err">{quickCatErr}</span>}
                            <div className="por-qc-newcat-actions">
                                <button type="button" className="por-qc-btn por-qc-btn--cancel"
                                    onClick={() => { setShowQuickCat(false); setQuickCatName(''); setQuickCatErr(''); }}
                                    disabled={savingCat}>Cancelar</button>
                                <button type="button" className="por-qc-btn por-qc-btn--save"
                                    onClick={handleQuickCatSave} disabled={savingCat}>
                                    {savingCat ? <><span className="pom-spinner" /> Creando...</> : <><FiPlus size={12} /> Crear y seleccionar</>}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="por-qc-field">
                    <label>Unidad de medida</label>
                    <select value={unitType} onChange={(e) => setUnitType(e.target.value)}
                        className="por-qc-select" disabled={saving}>
                        <option value="unidad">📦 Unidad (un)</option>
                        <option value="peso">⚖️ Peso (kg)</option>
                        <option value="volumen">🥤 Volumen (L)</option>
                        <option value="metro">📏 Metro (m)</option>
                    </select>
                </div>
                <div className="por-qc-field">
                    <label>Precio de costo</label>
                    <input type="text" inputMode="numeric"
                        value={toDisplay(costPrice)} onChange={(e) => setCostPrice(fromDisplay(e.target.value))}
                        className="por-qc-input" placeholder="0" disabled={saving}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onCancel(); }} />
                </div>
                <div className="por-qc-field">
                    <label>Precio de venta <span className="por-qc-req">*</span></label>
                    <input type="text" inputMode="numeric"
                        value={toDisplay(salePrice)}
                        onChange={(e) => { setSalePrice(fromDisplay(e.target.value)); setErrors(p => ({ ...p, salePrice: '' })); }}
                        className={`por-qc-input ${errors.salePrice ? 'error' : ''}`}
                        placeholder="0" disabled={saving}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onCancel(); }} />
                    {errors.salePrice && <span className="por-qc-err">{errors.salePrice}</span>}
                </div>
            </div>
            <div className="por-qc-unlimited" onClick={() => !saving && setUnlimitedStock(v => !v)}>
                <div className={`por-qcu-switch ${unlimitedStock ? 'on' : 'off'}`}><div className="por-qcu-knob" /></div>
                <span className="por-qcu-label">
                    {unlimitedStock ? '✅ Siempre disponible (stock no se descuenta)' : 'Control de stock normal'}
                </span>
            </div>
            <div className="por-qc-supplier-note">
                <FiTruck size={12} />
                <span>
                    El proveedor de esta compra queda registrado en el <strong>historial de compras</strong>.
                    Para asignarlo como proveedor principal del producto, ve a{' '}
                    <strong>Inventario → editar producto</strong>.
                </span>
            </div>
            <div className="por-qc-note">
                💡 El stock inicial quedará en <strong>0</strong> y se actualizará con la cantidad ingresada al confirmar la compra.
            </div>
            <div className="por-qc-actions">
                <button type="button" className="por-qc-btn por-qc-btn--cancel" onClick={onCancel} disabled={saving}>Cancelar</button>
                <button type="button" className="por-qc-btn por-qc-btn--save" onClick={handleCreate} disabled={saving}>
                    {saving ? <><span className="pom-spinner" /> Creando...</> : <><FiPlus size={12} /> Crear y agregar</>}
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// ProductRow — fila editable
// ─────────────────────────────────────────────────────────────────────────────
const ProductRow = ({ row, index, onUpdate, onRemove, allProducts, isEditing }) => {
    const [searchTerm, setSearchTerm] = useState(row.productName || '');
    const [showDrop, setShowDrop] = useState(false);
    const [results, setResults] = useState([]);
    const [showQuickCreate, setShowQuickCreate] = useState(false);
    const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
    const inputRef = useRef(null);
    const wrapRef = useRef(null);

    // ── Detección de pistola láser ────────────────────────────────────────────
    // La pistola envía todos los caracteres en < 50ms por tecla y termina con Enter.
    const lastKeyTime   = useRef(0);
    const scannerBuffer = useRef('');
    const scannerTimer  = useRef(null);
    const SCANNER_MS    = 50;

    const handleSearchKeyDown = (e) => {
        const now = Date.now();
        const gap = now - lastKeyTime.current;
        lastKeyTime.current = now;

        // Acumular buffer si las teclas vienen muy rápido (pistola)
        if (e.key !== 'Enter' && e.key.length === 1 && gap < SCANNER_MS) {
            if (scannerTimer.current) clearTimeout(scannerTimer.current);
            scannerBuffer.current += e.key;
            scannerTimer.current = setTimeout(() => { scannerBuffer.current = ''; }, 300);
            return;
        }

        if (e.key === 'Enter') {
            if (scannerTimer.current) clearTimeout(scannerTimer.current);
            const code = (scannerBuffer.current || e.target.value || searchTerm).trim();
            scannerBuffer.current = '';

            if (!code || row.productId) return;

            // Match exacto por barcode o SKU (no servicios)
            const exact = allProducts.find(p =>
                p.type !== 'service' && (
                    (p.barcode && p.barcode === code) ||
                    (p.sku     && p.sku     === code)
                )
            );
            if (exact) {
                setShowDrop(false);
                handleSelect(exact);
            }
            // Si no hay match exacto, el dropdown sigue mostrando resultados por texto
        }

        if (e.key === 'Escape') {
            setShowDrop(false);
            scannerBuffer.current = '';
        }
    };

    useEffect(() => {
        const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    useEffect(() => {
        if (showDrop && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropPos({ top: rect.bottom + 3, left: rect.left, width: rect.width });
        }
    }, [showDrop]);

    useEffect(() => {
        if (!searchTerm.trim() || row.productId) { setResults([]); return; }
        const q = searchTerm.toLowerCase();
        const found = allProducts.filter(p =>
            p.type !== 'service' && (
                p.name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.barcode?.toLowerCase().includes(q)
            )
        ).slice(0, 8);
        setResults(found);
        setShowDrop(found.length > 0 || searchTerm.trim().length >= 2);
    }, [searchTerm, allProducts, row.productId]);

    const handleSelect = (product) => {
        setSearchTerm(product.name);
        setShowDrop(false);
        onUpdate(index, {
            productId: product.id,
            productName: product.name,
            currentCost: parseFloat(product.cost_price) || 0,
            currentSalePrice: parseFloat(product.sale_price) || 0,
            unit_cost: String(parseFloat(product.cost_price) || ''),
            sale_price: String(parseFloat(product.sale_price) || ''),
            unit: product.unit_label || product.unit || 'un',
            isUnlimited: product.unlimited_stock === 1 || product.unlimited_stock === true,
            currentStock: parseInt(product.stock) || 0,
            isNew: false,
        });
    };

    const handleClear = () => {
        setSearchTerm('');
        setShowQuickCreate(false);
        onUpdate(index, {
            productId: null, productName: '', currentCost: 0, currentSalePrice: 0,
            unit_cost: '', quantity: '', sale_price: '', isNew: false,
        });
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleQuickCreated = (product) => {
        setSearchTerm(product.name);
        setShowQuickCreate(false);
        onUpdate(index, {
            productId: product.id,
            productName: product.name,
            currentCost: product.cost_price || 0,
            currentSalePrice: product.sale_price || 0,
            unit_cost: String(parseFloat(row.unit_cost) || product.cost_price || ''),
            sale_price: String(product.sale_price || ''),
            unit: product.unit_label || 'un',
            isUnlimited: product.unlimited_stock === 1 || product.unlimited_stock === true,
            currentStock: 0,
            isNew: true,
        });
    };

    const isExactMatch = allProducts.some(p =>
        p.name?.toLowerCase() === searchTerm.trim().toLowerCase() ||
        p.sku?.toLowerCase() === searchTerm.trim().toLowerCase()
    );
    const showCreateOption = searchTerm.trim().length >= 2 && !row.productId && !isExactMatch;

    return (
        <tr className={`por-row ${!row.productId ? 'por-row--empty' : ''} ${row.isNew ? 'por-row--new' : ''}`}>
            <td className="por-td por-td--num">{index + 1}</td>
            <td className="por-td por-td--product">
                <div className="por-product-wrap" ref={wrapRef}>
                    {row.productId && !showQuickCreate ? (
                        <div className={`por-product-selected ${row.isNew ? 'por-product-selected--new' : ''}`}>
                            <FiPackage size={13} className="por-product-icon" />
                            <span className="por-product-name">{row.productName}</span>
                            {row.isNew && <span className="por-new-tag">Nuevo</span>}
                            <button type="button" className="por-product-clear" onClick={handleClear}><FiX size={11} /></button>
                        </div>
                    ) : showQuickCreate ? (
                        <QuickProductCreate
                            initialName={searchTerm}
                            initialCost={row.unit_cost}
                            onCreated={handleQuickCreated}
                            onCancel={() => { setShowQuickCreate(false); setTimeout(() => inputRef.current?.focus(), 50); }}
                        />
                    ) : (
                        <div className="por-search-wrap">
                            <FiSearch size={13} className="por-search-icon" />
                            <input ref={inputRef} type="text" className="por-search-input"
                                placeholder="Buscar nombre, SKU o escanear código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                onFocus={() => (results.length > 0 || showCreateOption) && setShowDrop(true)}
                                autoComplete="off" />
                            {showDrop && (results.length > 0 || showCreateOption) && createPortal(
                                <div className="por-dropdown"
                                    style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 99999 }}
                                    onMouseDown={(e) => e.preventDefault()}>
                                    {results.map(p => (
                                        <div key={p.id} className="por-dropdown-item"
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(p); }}>
                                            <div className="por-dd-name">{p.name}</div>
                                            <div className="por-dd-meta">
                                                {p.sku && <span>SKU: {p.sku}</span>}
                                                {p.barcode && <span>Cód: {p.barcode}</span>}
                                                <span className={`por-dd-stock ${p.unlimited_stock ? 'unlimited' : p.stock <= 0 ? 'zero' : ''}`}>
                                                    {p.unlimited_stock ? 'Siempre disponible' : `Stock: ${fmtNum(p.stock)} ${p.unit_label || ''}`}
                                                </span>
                                                <span className="por-dd-cost">Costo: {fmt(p.cost_price)}</span>
                                                <span className="por-dd-sale">Venta: {fmt(p.sale_price)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {showCreateOption && (
                                        <div className="por-dropdown-create"
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowDrop(false); setShowQuickCreate(true); }}>
                                            <FiPlus size={13} />
                                            <span>Crear <strong>"{searchTerm.trim()}"</strong> como nuevo producto</span>
                                        </div>
                                    )}
                                </div>,
                                document.body
                            )}
                        </div>
                    )}
                </div>
            </td>
            <td className="por-td por-td--stock">
                {row.productId
                    ? row.isNew
                        ? <span className="por-tag por-tag--new">Nuevo</span>
                        : row.isUnlimited
                            ? <span className="por-tag por-tag--unlimited">Siempre disp.</span>
                            : isEditing && row.originalQty > 0
                                ? <div className="por-stock-edit">
                                    <span className={`por-tag ${row.currentStock <= 0 ? 'por-tag--zero' : 'por-tag--normal'}`}>
                                        {fmtNum(row.currentStock)} {row.unit}
                                    </span>
                                    <span className="por-stock-edit-note">
                                        incluye {fmtNum(row.originalQty)} de esta compra
                                    </span>
                                  </div>
                                : <span className={`por-tag ${row.currentStock <= 0 ? 'por-tag--zero' : 'por-tag--normal'}`}>
                                    {fmtNum(row.currentStock)} {row.unit}
                                  </span>
                    : <span className="por-placeholder">—</span>}
            </td>
            <td className="por-td por-td--qty">
                {row.productId && row.isUnlimited ? (
                    <span className="por-qty-unlimited">Siempre disponible</span>
                ) : (
                    <input type="number" className="por-num-input" placeholder="0" min="0" step="1"
                        value={row.quantity}
                        onChange={(e) => onUpdate(index, { quantity: e.target.value })}
                        disabled={!row.productId || showQuickCreate} />
                )}
            </td>
            <td className="por-td por-td--cost">
                <input type="text" inputMode="numeric" className="por-num-input" placeholder="0"
                    value={toDisplay(row.unit_cost)}
                    onChange={(e) => onUpdate(index, { unit_cost: fromDisplay(e.target.value) })}
                    disabled={!row.productId || showQuickCreate} />
            </td>
            <td className="por-td por-td--sale">
                {row.productId && !showQuickCreate ? (
                    <div className="por-sale-wrap">
                        <input type="text" inputMode="numeric"
                            className={`por-num-input ${row.isNew && (!row.sale_price || parseFloat(row.sale_price) <= 0) ? 'por-num-input--warn' : ''}`}
                            placeholder={row.isNew ? 'Requerido' : 'Sin cambio'}
                            value={toDisplay(row.sale_price)}
                            onChange={(e) => onUpdate(index, { sale_price: fromDisplay(e.target.value) })}
                        />
                        {!row.isNew && row.currentSalePrice > 0 && (
                            <span className="por-sale-hint">actual: {fmt(row.currentSalePrice)}</span>
                        )}
                    </div>
                ) : (
                    <span className="por-placeholder">—</span>
                )}
            </td>
            <td className="por-td por-td--remove">
                <button type="button" className="por-remove-btn" onClick={() => onRemove(index)} title="Eliminar fila">
                    <FiTrash2 size={14} />
                </button>
            </td>
        </tr>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const PurchaseOrderModal = ({ purchase = null, onClose, onSaved, allProducts = [], suppliers: suppliersProp = [], currentUser }) => {
    const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const isEditing = !!purchase?.id;

    const [supplierId,        setSupplierId]        = useState('');
    const [suppliers,         setSuppliers]         = useState(Array.isArray(suppliersProp) ? suppliersProp : []);
    const [documentType,      setDocumentType]      = useState('boleta');
    const [documentNumber,    setDocumentNumber]    = useState('');
    const [purchaseDate,      setPurchaseDate]      = useState(today);
    const [hasRecoverableTax, setHasRecoverableTax] = useState(false);
    const [taxIncluded,       setTaxIncluded]       = useState(true);
    const [paymentCondition,  setPaymentCondition]  = useState('contado');
    const [creditDays,        setCreditDays]        = useState(30);
    const [paymentMethod,     setPaymentMethod]     = useState('transferencia');
    const [notes,             setNotes]             = useState('');
    const [saving,            setSaving]            = useState(false);
    const [errors,            setErrors]            = useState({});
    const [savedOk,           setSavedOk]           = useState(false);
    const [savedMsg,          setSavedMsg]          = useState('');
    const [supplierOpen,      setSupplierOpen]      = useState(false);
    const [supplierSearch,    setSupplierSearch]    = useState('');

    const [showQuickSupplier,   setShowQuickSupplier]   = useState(false);
    const [quickSupplier,       setQuickSupplier]       = useState({ business_name: '', phone: '', contact_name: '' });
    const [quickSupplierErrors, setQuickSupplierErrors] = useState({});
    const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);

    const supplierRef  = useRef(null);
    const purchaseRepo = new PurchaseRepository();
    const supplierRepo = new SupplierRepository();

    const emptyRow = () => ({
        productId: null, productName: '', currentCost: 0, currentSalePrice: 0,
        unit_cost: '', quantity: '', sale_price: '',
        isUnlimited: false, currentStock: 0, unit: 'un', isNew: false,
    });

    const [rows, setRows] = useState(() => Array.from({ length: 5 }, emptyRow));

    useEffect(() => {
        if (Array.isArray(suppliersProp)) setSuppliers(suppliersProp);
    }, [suppliersProp]);

    useEffect(() => {
        if (!purchase) return;
        if (purchase.supplier_id)       setSupplierId(String(purchase.supplier_id));
        if (purchase.document_type)     setDocumentType(purchase.document_type);
        if (purchase.invoice_number)    setDocumentNumber(purchase.invoice_number);
        if (purchase.invoice_date)      setPurchaseDate(String(purchase.invoice_date).split('T')[0]);
        if (purchase.payment_condition) setPaymentCondition(purchase.payment_condition);
        if (purchase.credit_days)       setCreditDays(purchase.credit_days);
        if (purchase.payment_method)    setPaymentMethod(purchase.payment_method);
        if (purchase.notes)             setNotes(purchase.notes);
        if (purchase.tax_included !== undefined) setTaxIncluded(!!purchase.tax_included);
    }, [purchase]);

    useEffect(() => {
        if (!purchase?.items?.length) return;
        const preloadedRows = purchase.items.map(item => {
            const isUnlimited = item.unlimited_stock === 1 || item.unlimited_stock === true;
            return {
                productId:        item.product_id,
                productName:      item.product_name || item.name || '',
                currentCost:      parseFloat(item.unit_price) || 0,
                currentSalePrice: parseFloat(item.sale_price) || 0,
                unit_cost:        String(parseFloat(item.unit_price) || ''),
                quantity:         isUnlimited ? '' : String(parseFloat(item.quantity) || ''),
                sale_price:       String(parseFloat(item.sale_price) || ''),
                unit:             item.unit_label || 'un',
                isUnlimited,
                currentStock:     parseInt(item.stock) || 0,
                originalQty:      isUnlimited ? 0 : (parseFloat(item.quantity) || 0),
                isNew:            false,
            };
        });
        const extra = Math.max(0, 5 - preloadedRows.length);
        setRows([...preloadedRows, ...Array.from({ length: extra }, emptyRow)]);
    }, [purchase]);

    useEffect(() => { setHasRecoverableTax(documentType === 'factura'); }, [documentType]);

    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [saving, onClose]);

    useEffect(() => {
        const h = (e) => {
            if (supplierRef.current && !supplierRef.current.contains(e.target)) {
                setSupplierOpen(false); setSupplierSearch('');
            }
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const updateRow = useCallback((index, changes) => {
        setRows(prev => prev.map((r, i) => i === index ? { ...r, ...changes } : r));
    }, []);

    const removeRow = useCallback((index) => {
        setRows(prev => { const n = prev.filter((_, i) => i !== index); return n.length === 0 ? [emptyRow()] : n; });
    }, []);

    const addRows = (n) => setRows(prev => [...prev, ...Array.from({ length: n }, emptyRow)]);

    const filledRows = rows.filter(r =>
        r.productId && parseFloat(r.unit_cost) >= 0 && (
            r.isUnlimited ? true : parseFloat(r.quantity) > 0
        )
    );
    const activeItems = filledRows.map(r => ({
        product_id:   r.productId,
        product_name: r.productName || '',
        quantity:     r.isUnlimited ? (parseFloat(r.quantity) || 1) : parseFloat(r.quantity),
        unit_cost:    parseFloat(r.unit_cost),
        sale_price:   r.sale_price ? parseFloat(r.sale_price) : null,
        is_new:       r.isNew || false,
        is_unlimited: r.isUnlimited || false,
    }));
    const totalBruto        = activeItems.reduce((s, r) => s + (r.quantity * r.unit_cost), 0);
    const selectedSupplier  = suppliers.find(s => String(s.id) === String(supplierId));
    const filteredSuppliers = suppliers.filter(s => {
        const q = supplierSearch.toLowerCase();
        return (s.business_name || '').toLowerCase().includes(q) || (s.contact_name || '').toLowerCase().includes(q);
    });
    const newProductsCount = filledRows.filter(r => r.isNew).length;

    const loadSuppliers = async () => {
        try {
            const data = await supplierRepo.getActive();
            setSuppliers(Array.isArray(data) ? data : []);
        } catch { /* mantener lista actual */ }
    };

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

    const handleQuickSupplierSave = async () => {
        if (!validateQuickSupplier()) return;
        setSavingQuickSupplier(true);
        try {
            const result = await supplierRepo.create({
                business_name: quickSupplier.business_name.trim(),
                phone: quickSupplier.phone.trim(),
                contact_name: quickSupplier.contact_name.trim() || null,
                is_active: 1,
            });
            await loadSuppliers();
            const newId = result?.id || result?.lastID || result?.lastInsertRowid;
            if (newId) setSupplierId(String(newId));
            setQuickSupplier({ business_name: '', phone: '', contact_name: '' });
            setQuickSupplierErrors({});
            setShowQuickSupplier(false);
            setErrors(p => ({ ...p, supplier: '' }));
        } catch (err) {
            setQuickSupplierErrors({ business_name: 'Error al crear: ' + err.message });
        } finally { setSavingQuickSupplier(false); }
    };

    const validate = () => {
        const errs = {};
        if (!purchaseDate) errs.purchaseDate = 'La fecha es obligatoria';
        if (!documentType) errs.documentType = 'Selecciona el tipo de documento';
        const newWithoutSale = filledRows.filter(r => r.isNew && (!r.sale_price || parseFloat(r.sale_price) <= 0));
        if (newWithoutSale.length > 0)
            errs.rows = `${newWithoutSale.length} producto(s) nuevo(s) sin precio de venta definido.`;
        else if (filledRows.length === 0)
            errs.rows = 'Agrega al menos un producto con cantidad y costo.';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const ts = getLocalTimestamp();

            if (isEditing) {
                const originalItems = await window.electronAPI.database.query(
                    'SELECT product_id, quantity FROM purchase_items WHERE purchase_id = ?',
                    [purchase.id]
                );
                for (const orig of (originalItems || [])) {
                    try {
                        const prod = await window.electronAPI.database.get(
                            'SELECT stock, unlimited_stock FROM products WHERE id = ?',
                            [orig.product_id]
                        );
                        if (prod && !prod.unlimited_stock) {
                            const reverted = Math.max(0, (parseFloat(prod.stock) || 0) - parseFloat(orig.quantity));
                            await window.electronAPI.database.run(
                                'UPDATE products SET stock = ?, updated_at = ? WHERE id = ?',
                                [reverted, ts, orig.product_id]
                            );
                        }
                    } catch (e) {
                        console.warn('No se pudo revertir stock de producto', orig.product_id, e.message);
                    }
                }

                const subtotal = activeItems.reduce((s, r) => s + (r.quantity * r.unit_cost), 0);
                let tax = 0;
                let total = subtotal;
                if (hasRecoverableTax) {
                    if (taxIncluded) { tax = subtotal - subtotal / 1.19; total = subtotal; }
                    else             { tax = subtotal * 0.19; total = subtotal + tax; }
                }

                await window.electronAPI.database.run(`
                    UPDATE purchases SET
                        supplier_id         = ?,
                        invoice_number      = ?,
                        invoice_date        = ?,
                        document_type       = ?,
                        has_recoverable_tax = ?,
                        tax_included        = ?,
                        payment_condition   = ?,
                        credit_days         = ?,
                        payment_method      = ?,
                        notes               = ?,
                        subtotal            = ?,
                        tax                 = ?,
                        total               = ?,
                        updated_at          = ?
                    WHERE id = ?
                `, [
                    supplierId ? parseInt(supplierId) : null,
                    documentNumber || null,
                    purchaseDate,
                    documentType,
                    hasRecoverableTax ? 1 : 0,
                    taxIncluded ? 1 : 0,
                    paymentCondition,
                    paymentCondition === 'credito' ? parseInt(creditDays) : 0,
                    paymentMethod,
                    notes || null,
                    subtotal, tax, total,
                    ts,
                    purchase.id,
                ]);

                await window.electronAPI.database.run(
                    'DELETE FROM purchase_items WHERE purchase_id = ?',
                    [purchase.id]
                );
                for (const item of activeItems) {
                    await window.electronAPI.database.run(`
                        INSERT INTO purchase_items
                            (purchase_id, product_id, product_name, quantity, unit_price, subtotal, tax, discount, total, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        purchase.id, item.product_id, item.product_name, item.quantity, item.unit_cost,
                        item.quantity * item.unit_cost, 0, 0, item.quantity * item.unit_cost, ts,
                    ]);
                }

                for (const item of activeItems) {
                    try {
                        const prod = await window.electronAPI.database.get(
                            'SELECT stock, unlimited_stock FROM products WHERE id = ?',
                            [item.product_id]
                        );
                        if (prod) {
                            if (!prod.unlimited_stock) {
                                const newStock = (parseFloat(prod.stock) || 0) + item.quantity;
                                await window.electronAPI.database.run(
                                    'UPDATE products SET stock = ?, cost_price = ?, updated_at = ? WHERE id = ?',
                                    [newStock, item.unit_cost, ts, item.product_id]
                                );
                            } else {
                                await window.electronAPI.database.run(
                                    'UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?',
                                    [item.unit_cost, ts, item.product_id]
                                );
                            }
                            if (item.sale_price && parseFloat(item.sale_price) > 0) {
                                await window.electronAPI.database.run(
                                    'UPDATE products SET sale_price = ?, updated_at = ? WHERE id = ?',
                                    [parseFloat(item.sale_price), ts, item.product_id]
                                );
                            }
                        }
                    } catch (e) {
                        console.warn('No se pudo actualizar producto', item.product_id, e.message);
                    }
                }

                setSavedMsg(`Compra ${purchase.purchase_number} actualizada correctamente`);

            } else {
                const result = await purchaseRepo.create({
                    supplier_id:         supplierId ? parseInt(supplierId) : null,
                    purchase_date:       purchaseDate,
                    document_type:       documentType,
                    document_number:     documentNumber || null,
                    has_recoverable_tax: hasRecoverableTax,
                    tax_included:        taxIncluded,
                    payment_condition:   paymentCondition,
                    credit_days:         paymentCondition === 'credito' ? parseInt(creditDays) : 0,
                    payment_method:      paymentMethod,
                    items:               activeItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: i.unit_cost })),
                    notes:               notes || null,
                    user_id:             currentUser?.id || null,
                });
                if (!result.success) throw new Error(result.error || 'Error desconocido');

                for (const item of activeItems) {
                    if (item.sale_price && parseFloat(item.sale_price) > 0) {
                        await window.electronAPI.database.run(
                            'UPDATE products SET sale_price = ?, updated_at = ? WHERE id = ?',
                            [parseFloat(item.sale_price), ts, item.product_id]
                        );
                    }
                    if (item.is_new) {
                        const prodCheck = await window.electronAPI.database.get(
                            'SELECT unlimited_stock FROM products WHERE id = ?',
                            [item.product_id]
                        );
                        const isUnlim = prodCheck?.unlimited_stock === 1 || prodCheck?.unlimited_stock === true;
                        if (isUnlim) {
                            await window.electronAPI.database.run(
                                'UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?',
                                [item.unit_cost, ts, item.product_id]
                            );
                        } else {
                            await window.electronAPI.database.run(
                                'UPDATE products SET stock = ?, cost_price = ?, updated_at = ? WHERE id = ?',
                                [item.quantity, item.unit_cost, ts, item.product_id]
                            );
                        }
                    }
                }

                setSavedMsg(result.message || '');
            }

            setSavedOk(true);
            setTimeout(() => { onSaved?.(); onClose(); }, 1600);
        } catch (err) {
            setErrors({ global: err.message });
            setSaving(false);
        }
    };

    if (savedOk) {
        return (
            <div className="pom-overlay">
                <div className="pom-success">
                    <FiCheckCircle size={52} color="#10b981" />
                    <h2>{isEditing ? '¡Compra actualizada!' : '¡Compra registrada!'}</h2>
                    <p>{savedMsg || `${activeItems.length} producto${activeItems.length !== 1 ? 's' : ''} actualizados`}</p>
                    {newProductsCount > 0 && (
                        <p className="pom-success-sub">
                            🆕 {newProductsCount} producto{newProductsCount !== 1 ? 's' : ''} creado{newProductsCount !== 1 ? 's' : ''} en el inventario
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="pom-overlay" onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
            <div className="pom-modal">

                <div className="pom-header">
                    <div className="pom-header-left">
                        <div className="pom-header-icon"><FiTruck size={20} color="#2563eb" /></div>
                        <div>
                            <h1 className="pom-title">
                                {isEditing
                                    ? `Editar Compra — ${purchase.purchase_number}`
                                    : 'Registrar Compra / Entrada de Inventario'}
                            </h1>
                            <p className="pom-subtitle">
                                {isEditing
                                    ? 'Modifica los datos y productos de esta compra'
                                    : 'Registra entradas de inventario y actualiza costos y precios'}
                            </p>
                        </div>
                    </div>
                    <button className="pom-close" onClick={onClose} disabled={saving}><FiX size={20} /></button>
                </div>

                <div className="pom-body">
                    <div className="pom-head-form">

                        {/* Proveedor */}
                        <div className="pom-field pom-field--supplier-block">
                            <label className="pom-label"><FiTruck size={13} /> Proveedor <span className="pom-optional">(opcional)</span></label>
                            <div className="pom-supplier-row">
                                <div className="pom-supplier-wrap" ref={supplierRef} style={{ flex: 1 }}>
                                    <button type="button"
                                        className={`pom-supplier-btn ${supplierOpen ? 'open' : ''} ${errors.supplier ? 'error' : ''}`}
                                        onClick={() => { if (!showQuickSupplier) { setSupplierOpen(v => !v); setSupplierSearch(''); } }}
                                        disabled={saving || showQuickSupplier}>
                                        <span className={selectedSupplier ? 'selected' : 'placeholder'}>
                                            {selectedSupplier ? selectedSupplier.business_name : 'Seleccionar proveedor...'}
                                        </span>
                                        <FiChevronDown size={14} className={`pom-chevron ${supplierOpen ? 'open' : ''}`} />
                                    </button>
                                    {errors.supplier && <span className="pom-error-text">{errors.supplier}</span>}
                                    {supplierOpen && !showQuickSupplier && (
                                        <div className="pom-supplier-drop">
                                            <div className="pom-supplier-search">
                                                <FiSearch size={13} />
                                                <input type="text" placeholder="Buscar proveedor..."
                                                    value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)} autoFocus />
                                            </div>
                                            <div className="pom-supplier-list">
                                                {filteredSuppliers.map(s => (
                                                    <div key={s.id} className={`pom-supplier-opt ${String(s.id) === String(supplierId) ? 'selected' : ''}`}
                                                        onClick={() => { setSupplierId(String(s.id)); setSupplierOpen(false); setSupplierSearch(''); setErrors(p => ({ ...p, supplier: '' })); }}>
                                                        <span className="pom-supplier-name">{s.business_name}</span>
                                                        {s.contact_name && <span className="pom-supplier-contact">{s.contact_name}</span>}
                                                    </div>
                                                ))}
                                                {filteredSuppliers.length === 0 && (
                                                    <div className="pom-supplier-empty">
                                                        Sin resultados —{' '}
                                                        <button type="button" className="pom-supplier-create-link"
                                                            onClick={() => { setSupplierOpen(false); setShowQuickSupplier(true); }}>
                                                            crear nuevo
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {supplierId && (
                                                <div className="pom-supplier-clear"
                                                    onClick={() => { setSupplierId(''); setSupplierOpen(false); }}>
                                                    <FiX size={11} /> Sin proveedor
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button type="button"
                                    className={`pom-quick-supplier-toggle ${showQuickSupplier ? 'active' : ''}`}
                                    onClick={() => { setShowQuickSupplier(v => !v); setSupplierOpen(false); setQuickSupplier({ business_name: '', phone: '', contact_name: '' }); setQuickSupplierErrors({}); }}
                                    disabled={saving}
                                    title={showQuickSupplier ? 'Cancelar' : 'Crear nuevo proveedor'}>
                                    <FiPlus size={14} />
                                    <span>{showQuickSupplier ? 'Cancelar' : 'Nuevo'}</span>
                                </button>
                            </div>
                            {showQuickSupplier && (
                                <div className="pom-quick-supplier-form">
                                    <div className="pom-qs-header"><FiTruck size={12} /> Nuevo proveedor</div>
                                    <div className="pom-qs-fields">
                                        <div className="pom-qs-field">
                                            <label>Nombre comercial <span className="por-qc-req">*</span></label>
                                            <input type="text" name="business_name"
                                                value={quickSupplier.business_name}
                                                onChange={handleQuickSupplierChange}
                                                className={`pom-input ${quickSupplierErrors.business_name ? 'pom-input--error' : ''}`}
                                                placeholder="Ej: Distribuidora ABC"
                                                disabled={savingQuickSupplier} autoFocus maxLength={150}
                                                onKeyDown={(e) => { if (e.key === 'Escape') setShowQuickSupplier(false); }} />
                                            {quickSupplierErrors.business_name && <span className="pom-error-text">{quickSupplierErrors.business_name}</span>}
                                        </div>
                                        <div className="pom-qs-field">
                                            <label>Teléfono <span className="por-qc-req">*</span></label>
                                            <input type="text" name="phone"
                                                value={quickSupplier.phone}
                                                onChange={handleQuickSupplierChange}
                                                className={`pom-input ${quickSupplierErrors.phone ? 'pom-input--error' : ''}`}
                                                placeholder="+56 9 1234 5678"
                                                disabled={savingQuickSupplier} maxLength={20}
                                                onKeyDown={(e) => { if (e.key === 'Escape') setShowQuickSupplier(false); }} />
                                            {quickSupplierErrors.phone && <span className="pom-error-text">{quickSupplierErrors.phone}</span>}
                                        </div>
                                        <div className="pom-qs-field">
                                            <label>Contacto <span className="pom-optional">(opcional)</span></label>
                                            <input type="text" name="contact_name"
                                                value={quickSupplier.contact_name}
                                                onChange={handleQuickSupplierChange}
                                                className="pom-input" placeholder="Ej: Juan Pérez"
                                                disabled={savingQuickSupplier} maxLength={100}
                                                onKeyDown={(e) => { if (e.key === 'Escape') setShowQuickSupplier(false); }} />
                                        </div>
                                    </div>
                                    <div className="pom-qs-actions">
                                        <button type="button" className="por-qc-btn por-qc-btn--cancel"
                                            onClick={() => { setShowQuickSupplier(false); setQuickSupplier({ business_name: '', phone: '', contact_name: '' }); setQuickSupplierErrors({}); }}
                                            disabled={savingQuickSupplier}>Cancelar</button>
                                        <button type="button" className="por-qc-btn por-qc-btn--save"
                                            onClick={handleQuickSupplierSave} disabled={savingQuickSupplier}>
                                            {savingQuickSupplier
                                                ? <><span className="pom-spinner" /> Creando...</>
                                                : <><FiPlus size={12} /> Crear y seleccionar</>}
                                        </button>
                                    </div>
                                    <p className="pom-qs-note">💡 Puedes completar el resto de los datos luego en el módulo de Proveedores.</p>
                                </div>
                            )}
                        </div>

                        {/* Tipo documento */}
                        <div className="pom-field">
                            <label className="pom-label"><FiFileText size={13} /> Tipo de documento <span className="pom-required">*</span></label>
                            <select className="pom-input" value={documentType} onChange={(e) => setDocumentType(e.target.value)} disabled={saving}>
                                <option value="boleta">Boleta</option>
                                <option value="factura">Factura (IVA recuperable)</option>
                                <option value="nota_debito">Nota de débito</option>
                                <option value="sin_documento">Sin documento</option>
                            </select>
                        </div>

                        <div className="pom-field">
                            <label className="pom-label">N° Documento</label>
                            <input type="text" className="pom-input" placeholder="Ej: 001234"
                                value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} disabled={saving} maxLength={60} />
                        </div>

                        <div className="pom-field">
                            <label className="pom-label">📅 Fecha <span className="pom-required">*</span></label>
                            <input type="date" className={`pom-input ${errors.purchaseDate ? 'pom-input--error' : ''}`}
                                value={purchaseDate} onChange={(e) => { setPurchaseDate(e.target.value); setErrors(p => ({ ...p, purchaseDate: '' })); }} disabled={saving} />
                            {errors.purchaseDate && <span className="pom-error-text">{errors.purchaseDate}</span>}
                        </div>

                        <div className="pom-field">
                            <label className="pom-label">💳 Condición de pago</label>
                            <select className="pom-input" value={paymentCondition} onChange={(e) => setPaymentCondition(e.target.value)} disabled={saving}>
                                <option value="contado">Contado</option>
                                <option value="credito">Crédito</option>
                            </select>
                        </div>

                        {paymentCondition === 'credito' && (
                            <div className="pom-field">
                                <label className="pom-label">Días de crédito</label>
                                <input type="number" className="pom-input" min="1" max="365"
                                    value={creditDays} onChange={(e) => setCreditDays(e.target.value)} disabled={saving} />
                            </div>
                        )}

                        <div className="pom-field">
                            <label className="pom-label">Método de pago</label>
                            <select className="pom-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={saving}>
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="cheque">Cheque</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="credito">Crédito (pago diferido)</option>
                            </select>
                        </div>

                        <div className="pom-field">
                            <label className="pom-label">📝 Notas</label>
                            <input type="text" className="pom-input" placeholder="Observaciones opcionales..."
                                value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} maxLength={300} />
                        </div>

                        {hasRecoverableTax && (
                            <div className="pom-field">
                                <label className="pom-label">IVA en el precio</label>
                                <select className="pom-input" value={taxIncluded ? 'included' : 'excluded'}
                                    onChange={(e) => setTaxIncluded(e.target.value === 'included')} disabled={saving}>
                                    <option value="included">Incluido en el precio</option>
                                    <option value="excluded">Precio es neto (sin IVA)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {hasRecoverableTax && (
                        <div className="pom-info-box pom-info-box--green">
                            <FiInfo size={14} />
                            <span>Factura con IVA recuperable — el sistema calculará el neto e IVA separados.
                                {taxIncluded ? ' Los precios incluyen IVA.' : ' Los precios son netos y el IVA se calculará aparte.'}
                            </span>
                        </div>
                    )}

                    <div className="pom-table-wrap">
                        <table className="pom-table">
                            <thead>
                                <tr className="pom-thead-row">
                                    <th className="pom-th pom-th--num">#</th>
                                    <th className="pom-th pom-th--product">Producto</th>
                                    <th className="pom-th pom-th--stock">Stock actual</th>
                                    <th className="pom-th pom-th--qty">Cantidad</th>
                                    <th className="pom-th pom-th--cost">Costo unit. pagado</th>
                                    <th className="pom-th pom-th--sale">Precio venta<span className="pom-th-hint"> (opcional)</span></th>
                                    <th className="pom-th pom-th--del"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <ProductRow key={i} index={i} row={row}
                                        onUpdate={updateRow} onRemove={removeRow}
                                        allProducts={allProducts} isEditing={isEditing} />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pom-add-rows">
                        <button type="button" className="pom-add-btn" onClick={() => addRows(1)} disabled={saving}><FiPlus size={14} /> Agregar fila</button>
                        <button type="button" className="pom-add-btn" onClick={() => addRows(5)} disabled={saving}><FiPlus size={14} /> +5 filas</button>
                        <button type="button" className="pom-add-btn" onClick={() => addRows(10)} disabled={saving}><FiPlus size={14} /> +10 filas</button>
                        <span className="pom-filled-count">
                            {filledRows.length} producto{filledRows.length !== 1 ? 's' : ''} con datos
                            {newProductsCount > 0 && <span className="pom-new-badge"> · {newProductsCount} nuevo{newProductsCount !== 1 ? 's' : ''} 🆕</span>}
                        </span>
                    </div>

                    {errors.rows   && <div className="pom-error-banner"><FiAlertTriangle size={14} /> {errors.rows}</div>}
                    {errors.global && <div className="pom-error-banner"><FiAlertTriangle size={14} /> {errors.global}</div>}

                    {activeItems.length > 0 && (
                        <div className="pom-summary-strip">
                            <span className="pom-ss-item"><strong>{activeItems.length}</strong> producto{activeItems.length !== 1 ? 's' : ''}</span>
                            <span className="pom-ss-sep">·</span>
                            <span className="pom-ss-item"><strong>{fmtNum(activeItems.reduce((s, r) => s + r.quantity, 0))}</strong> uds. totales</span>
                            {newProductsCount > 0 && <><span className="pom-ss-sep">·</span><span className="pom-ss-new"><strong>{newProductsCount}</strong> nuevo{newProductsCount !== 1 ? 's' : ''} 🆕</span></>}
                            {hasRecoverableTax && <><span className="pom-ss-sep">·</span><span className="pom-ss-item">IVA rec. <strong>{fmt(taxIncluded ? totalBruto - totalBruto / 1.19 : totalBruto * 0.19)}</strong></span></>}
                            <span className="pom-ss-total">{fmt(totalBruto)}</span>
                        </div>
                    )}
                </div>

                <div className="pom-footer">
                    <button type="button" className="pom-btn pom-btn--cancel" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button type="button" className="pom-btn pom-btn--save" onClick={handleSave}
                        disabled={saving || activeItems.length === 0}>
                        {saving
                            ? <><span className="pom-spinner" /> Guardando...</>
                            : isEditing
                                ? <><FiCheckCircle size={15} /> Guardar cambios ({activeItems.length} producto{activeItems.length !== 1 ? 's' : ''})</>
                                : <><FiCheckCircle size={15} /> Confirmar compra ({activeItems.length} producto{activeItems.length !== 1 ? 's' : ''})</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrderModal;