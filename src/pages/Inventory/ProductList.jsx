import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import ProductRepository from '../../services/repositories/productRepository';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import ProductModal from './ProductModal';
import ProductDetailModal from './ProductDetailModal';
import PurchaseOrderModal from './PurchaseOrderModal';
import { exportInventoryToExcel, exportInventoryToPDF } from '../../services/export/inventoryExport';
import {
    FiPlus, FiSearch, FiEdit2, FiTrash2, FiPackage,
    FiAlertCircle, FiCreditCard, FiEye, FiTag,
    FiChevronDown, FiX, FiDownload, FiRefreshCw, FiTruck,
} from 'react-icons/fi';
import './ProductList.css';

const isMac = () => window.electronAPI?.platform === 'darwin';

const restoreFocus = (ref) => {
    requestAnimationFrame(() => {
        ref.current?.focus();
        setTimeout(() => ref.current?.focus(), 80);
    });
};

const PlDialog = ({ dialog }) => {
    if (!dialog) return null;
    const isConfirm = dialog.type === 'confirm';
    const isSuccess = dialog.type === 'success';
    const handleOverlayClick = (e) => {
        if (!isConfirm && e.target === e.currentTarget) dialog.onClose?.();
    };
    return (
        <div className="pl-dialog-overlay" onClick={handleOverlayClick}>
            <div className="pl-dialog" onClick={e => e.stopPropagation()}>
                <div className="pl-dialog-icon">{dialog.icon}</div>
                <p className="pl-dialog-message">{dialog.message}</p>
                <div className="pl-dialog-actions">
                    {isConfirm && (
                        <>
                            <button className="pl-dialog-btn pl-dialog-btn--cancel" onClick={dialog.onClose}>Cancelar</button>
                            <button className={`pl-dialog-btn pl-dialog-btn--${dialog.confirmVariant || 'danger'}`} onClick={dialog.onConfirm}>
                                {dialog.confirmLabel || 'Confirmar'}
                            </button>
                        </>
                    )}
                    {(isSuccess || dialog.type === 'error') && (
                        <button
                            className={`pl-dialog-btn ${isSuccess ? 'pl-dialog-btn--success' : 'pl-dialog-btn--cancel'}`}
                            onClick={dialog.onClose}
                            style={{ width: '100%' }}
                        >
                            Aceptar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProductList = () => {
    const { db } = useDatabase();
    const [products,          setProducts]          = useState([]);
    const [filteredProducts,  setFilteredProducts]  = useState([]);
    const [searchTerm,        setSearchTerm]        = useState('');
    const [selectedCategory,  setSelectedCategory]  = useState('all');
    const [categoryOpen,      setCategoryOpen]      = useState(false);
    const [categorySearch,    setCategorySearch]    = useState('');
    const categoryRef = useRef(null);
    const [selectedType,      setSelectedType]      = useState('all');
    const [categories,        setCategories]        = useState([]);
    const [showModal,         setShowModal]         = useState(false);
    const [editingProduct,    setEditingProduct]    = useState(null);
    const [selectedProduct,   setSelectedProduct]   = useState(null);
    const [scannerActive,     setScannerActive]     = useState(false);
    const [scannedCode,       setScannedCode]       = useState('');
    const [loading,           setLoading]           = useState(true);
    const [exporting,         setExporting]         = useState(null);
    const [dialog,            setDialog]            = useState(null);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);
    const [suppliers,         setSuppliers]         = useState([]);

    const scannerInputRef = useRef(null);
    const searchInputRef  = useRef(null);

    // Detección de pistola láser en buscador principal
    const lastKeyTime   = useRef(0);
    const scannerBuffer = useRef('');
    const scannerTimer  = useRef(null);
    const SCANNER_MS    = 50;

    const productRepo = new ProductRepository(db);

    useEffect(() => { if (db) loadData(); }, [db]);
    useEffect(() => { filterProducts(); }, [searchTerm, selectedCategory, selectedType, products]);

    useEffect(() => {
        const handleKeyPress = (e) => {
            const isActivate = e.key === 'F2' || (isMac() && e.metaKey && e.key === 'b');
            if (isActivate) { e.preventDefault(); activateScanner(); }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (categoryRef.current && !categoryRef.current.contains(e.target)) {
                setCategoryOpen(false);
                setCategorySearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([loadProducts(), loadCategories(), loadSuppliers()]);
        } catch (error) {
            console.error('Error cargando datos:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            const data = await window.electronAPI.database.query(
                'SELECT p.*, c.name as category_name ' +
                'FROM products p LEFT JOIN categories c ON p.category_id = c.id ' +
                'WHERE p.is_active = 1 ORDER BY p.name ASC'
            );
            if (!Array.isArray(data)) { setProducts([]); setFilteredProducts([]); return; }
            const mapped = data.map(p => ({
                ...p,
                profit_amount:     (parseFloat(p.sale_price) || 0) - (parseFloat(p.cost_price) || 0),
                profit_percentage: (parseFloat(p.cost_price) || 0) > 0
                    ? ((((parseFloat(p.sale_price) || 0) - (parseFloat(p.cost_price) || 0)) / (parseFloat(p.cost_price) || 0)) * 100).toFixed(2) : 0,
                stock:     parseInt(p.stock)     || 0,
                min_stock: parseInt(p.min_stock) || 0,
            }));
            setProducts(mapped);
            setFilteredProducts(mapped);
        } catch (error) {
            console.error('Error loading products:', error);
            setProducts([]); setFilteredProducts([]);
        }
    };

    const loadCategories = async () => {
        try {
            const data = await productRepo.getCategories();
            setCategories(Array.isArray(data) ? data : []);
        } catch (error) { setCategories([]); }
    };

    const loadSuppliers = async () => {
        try {
            const data = await window.electronAPI.database.query(
                'SELECT id, business_name, contact_name FROM suppliers WHERE is_active = 1 ORDER BY business_name ASC'
            );
            setSuppliers(Array.isArray(data) ? data : []);
        } catch (error) { setSuppliers([]); }
    };

    const filterProducts = () => {
        if (!Array.isArray(products)) { setFilteredProducts([]); return; }
        let filtered = [...products];
        if (selectedType !== 'all') filtered = filtered.filter(p => p.type === selectedType);
        if (searchTerm?.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(p =>
                (p.name    || '').toLowerCase().includes(term) ||
                (p.sku     || '').toLowerCase().includes(term) ||
                (p.barcode || '').toLowerCase().includes(term)
            );
        }
        if (selectedCategory !== 'all') {
            filtered = filtered.filter(p => p.category_id === parseInt(selectedCategory));
        }
        setFilteredProducts(filtered);
    };

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const businessInfo = await window.electronAPI.database.get('SELECT name FROM business_info WHERE id = 1');
            const activeCategoryName = selectedCategory !== 'all'
                ? categories.find(c => String(c.id) === String(selectedCategory))?.name : null;
            const params = {
                products: filteredProducts,
                filters:  { type: selectedType, category: activeCategoryName, search: searchTerm || null },
                businessName: businessInfo?.name || 'Mi Negocio'
            };
            if (type === 'excel') await exportInventoryToExcel(params);
            else                  await exportInventoryToPDF(params);
        } catch (err) {
            console.error('Export error:', err);
        } finally {
            setExporting(null);
        }
    };

    const handleCreateProduct = () => { setEditingProduct(null); setShowModal(true); };

    const handleEditProduct = (product) => {
        if (!product || typeof product !== 'object') return;
        setEditingProduct(product);
        setShowModal(true);
    };

    const handleDeleteProduct = (product) => {
        if (!product || typeof product !== 'object') return;
        const tipo = product.type === 'service' ? 'servicio' : 'producto';
        setDialog({
            type: 'confirm', icon: '🗑️',
            message: `¿Eliminar el ${tipo} "${product.name}"?\nEsta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar', confirmVariant: 'danger',
            onConfirm: async () => {
                setDialog(null);
                try {
                    await window.electronAPI.database.run('UPDATE products SET is_active = 0 WHERE id = ?', [product.id]);
                    await loadProducts();
                    setDialog({
                        type: 'success', icon: '✅',
                        message: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} "${product.name}" eliminado exitosamente`,
                        onClose: () => { setDialog(null); restoreFocus(searchInputRef); }
                    });
                } catch (error) {
                    setDialog({
                        type: 'error', icon: '⚠️',
                        message: error.message || 'Error desconocido',
                        onClose: () => { setDialog(null); restoreFocus(searchInputRef); }
                    });
                }
            },
            onClose: () => { setDialog(null); restoreFocus(searchInputRef); }
        });
    };

    const handleSaveProduct = async () => {
        setShowModal(false);
        await loadProducts();
        restoreFocus(searchInputRef);
    };

    const activateScanner = () => {
        setScannerActive(true);
        setScannedCode('');
        setTimeout(() => scannerInputRef.current?.focus(), 100);
    };

    // Scanner modal F2 — busca y abre editor
    const handleScannerInput = async (e) => {
        if (e.key === 'Enter' && scannedCode?.trim()) {
            const code = scannedCode.trim();
            setScannerActive(false);
            setScannedCode('');
            try {
                const product = await productRepo.getByBarcode(code);
                if (product && typeof product === 'object') {
                    handleEditProduct(product);
                } else {
                    setDialog({
                        type: 'error', icon: '🔍',
                        message: `No se encontró ningún producto con el código "${code}"`,
                        onClose: () => { setDialog(null); restoreFocus(searchInputRef); }
                    });
                }
            } catch {
                setDialog({
                    type: 'error', icon: '⚠️',
                    message: 'Error al buscar el producto. Intenta de nuevo.',
                    onClose: () => { setDialog(null); restoreFocus(searchInputRef); }
                });
            } finally {
                restoreFocus(searchInputRef);
            }
        } else if (e.key === 'Escape') {
            setScannerActive(false);
            setScannedCode('');
            restoreFocus(searchInputRef);
        }
    };

    // Buscador principal — soporte pistola láser directo (sin F2)
    const handleSearchKeyDown = (e) => {
        const now = Date.now();
        const gap = now - lastKeyTime.current;
        lastKeyTime.current = now;

        // Acumular en buffer si las teclas vienen muy rápido (pistola)
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
            if (!code) return;

            // Match exacto por barcode o SKU → abrir editor directamente
            const exact = products.find(p =>
                p.is_active !== false && p.is_active !== 0 && (
                    (p.barcode && p.barcode === code) ||
                    (p.sku     && p.sku     === code)
                )
            );
            if (exact) {
                setSearchTerm('');
                handleEditProduct(exact);
            }
            return;
        }

        if (e.key === 'Escape') {
            setSearchTerm('');
            restoreFocus(searchInputRef);
        }
    };

    const formatCurrency = (value) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(parseFloat(value) || 0);

    const getStats = () => {
        if (!Array.isArray(products)) return { total: 0, lowStock: 0, productsCount: 0, servicesCount: 0 };
        return {
            total:         products.length,
            lowStock:      products.filter(p => !p.unlimited_stock && p.type !== 'service' && (parseFloat(p.stock) || 0) <= (parseFloat(p.min_stock) || 0)).length,
            productsCount: products.filter(p => p.type === 'product').length,
            servicesCount: products.filter(p => p.type === 'service').length,
        };
    };

    const stats = getStats();
    const scannerLabel = isMac() ? 'Scanner (⌘B)' : 'Scanner (F2)';

    if (loading) {
        return (
            <div className="main-content-scrollable">
                <div className="product-list">
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <p>Cargando inventario...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="main-content-scrollable">
            <div className="product-list">

                <div className="page-header">
                    <div>
                        <h1 className="page-title">Inventario</h1>
                        <p className="page-subtitle">Gestiona tu catálogo de productos y servicios</p>
                    </div>
                    <div className="pl-header-actions">
                        <button className="rp-btn-export rp-btn-excel" onClick={() => handleExport('excel')}
                            disabled={loading || exporting !== null || filteredProducts.length === 0}>
                            <FiDownload size={14} />{exporting === 'excel' ? 'Descargando...' : 'Descargar Excel'}
                        </button>
                        <button className="rp-btn-export rp-btn-pdf" onClick={() => handleExport('pdf')}
                            disabled={loading || exporting !== null || filteredProducts.length === 0}>
                            <FiDownload size={14} />{exporting === 'pdf' ? 'Descargando...' : 'Descargar PDF'}
                        </button>
                        <button className="rp-refresh" onClick={loadData} disabled={loading}>
                            <FiRefreshCw size={14} className={loading ? 'spin' : ''} />Actualizar
                        </button>
                        <button className="rp-btn-export pl-btn-purchase" onClick={() => setShowPurchaseModal(true)} disabled={loading}>
                            <FiTruck size={14} />Registrar Compra
                        </button>
                        <Button variant="primary" icon={<FiPlus />} onClick={handleCreateProduct}>
                            Nuevo Producto/Servicio
                        </Button>
                    </div>
                </div>

                <div className="inventory-stats">
                    <div className="stat-item">
                        <div className="stat-icon-wrap stat-icon-wrap--blue"><FiPackage size={20} color="#2563eb" /></div>
                        <div className="stat-item-body">
                            <div className="stat-value">{stats.total}</div>
                            <div className="stat-label">Total Items</div>
                        </div>
                    </div>
                    <div className="stat-item warning">
                        <div className="stat-icon-wrap stat-icon-wrap--warning"><FiAlertCircle size={20} color="#f59e0b" /></div>
                        <div className="stat-item-body">
                            <div className="stat-value">{stats.lowStock}</div>
                            <div className="stat-label">Productos con Stock Bajo</div>
                        </div>
                    </div>
                </div>

                <div className="pl-toolbar">
                    <div className="type-tabs">
                        <button className={`type-tab ${selectedType === 'all'     ? 'active' : ''}`} onClick={() => setSelectedType('all')}>
                            <span className="tab-icon">📋</span><span className="tab-label">Todos</span>
                            <span className="tab-count">{filteredProducts.length}</span>
                        </button>
                        <button className={`type-tab ${selectedType === 'product' ? 'active' : ''}`} onClick={() => setSelectedType('product')}>
                            <span className="tab-icon">📦</span><span className="tab-label">Productos</span>
                            <span className="tab-count">{stats.productsCount}</span>
                        </button>
                        <button className={`type-tab ${selectedType === 'service' ? 'active' : ''}`} onClick={() => setSelectedType('service')}>
                            <span className="tab-icon">👤</span><span className="tab-label">Servicios</span>
                            <span className="tab-count">{stats.servicesCount}</span>
                        </button>
                    </div>

                    <div className="pl-search-wrap">
                        <FiSearch className="pl-search-icon" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Buscar por nombre, SKU o escanear código de barras..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="pl-search-input"
                        />
                        {searchTerm && (
                            <button className="pl-search-clear"
                                onClick={() => { setSearchTerm(''); restoreFocus(searchInputRef); }}
                                title="Limpiar búsqueda">✕</button>
                        )}
                    </div>

                    <div className="pl-category-wrap" ref={categoryRef}>
                        <button type="button"
                            className={`pl-category-trigger ${categoryOpen ? 'open' : ''}`}
                            onClick={() => { setCategoryOpen(v => !v); setCategorySearch(''); }}>
                            <FiTag size={14} className="pl-cat-icon" />
                            <span className={`pl-cat-text ${selectedCategory !== 'all' ? 'selected' : ''}`}>
                                {selectedCategory === 'all'
                                    ? 'Todas las categorías'
                                    : categories.find(c => String(c.id) === String(selectedCategory))?.name || 'Todas las categorías'}
                            </span>
                            <FiChevronDown size={13} className={`pl-cat-chevron ${categoryOpen ? 'open' : ''}`} />
                        </button>
                        {categoryOpen && (
                            <div className="pl-category-dropdown">
                                <div className="pl-cat-search">
                                    <FiSearch size={13} />
                                    <input type="text" placeholder="Buscar categoría..."
                                        value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} autoFocus />
                                </div>
                                <div className="pl-cat-list">
                                    <div className={`pl-cat-option ${selectedCategory === 'all' ? 'selected' : ''}`}
                                        onClick={() => { setSelectedCategory('all'); setCategoryOpen(false); setCategorySearch(''); }}>
                                        <span className="pl-cat-option-name">Todas las categorías</span>
                                    </div>
                                    {categories
                                        .filter(c => (c.name || '').toLowerCase().includes(categorySearch.toLowerCase()))
                                        .map(cat => (
                                            <div key={cat.id}
                                                className={`pl-cat-option ${String(selectedCategory) === String(cat.id) ? 'selected' : ''}`}
                                                onClick={() => { setSelectedCategory(String(cat.id)); setCategoryOpen(false); setCategorySearch(''); }}>
                                                <span className="pl-cat-option-name">{cat.name}</span>
                                            </div>
                                        ))}
                                    {categorySearch && categories.filter(c =>
                                        (c.name || '').toLowerCase().includes(categorySearch.toLowerCase())
                                    ).length === 0 && (
                                        <div className="pl-cat-no-results">Sin resultados</div>
                                    )}
                                </div>
                                {selectedCategory !== 'all' && (
                                    <div className="pl-cat-clear" onClick={() => { setSelectedCategory('all'); setCategoryOpen(false); }}>
                                        <FiX size={11} /> Quitar filtro
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <Button variant="secondary" icon={<FiCreditCard />} onClick={activateScanner}>
                        {scannerLabel}
                    </Button>
                </div>

                <Card>
                    <div className="table-container">
                        {filteredProducts.length === 0 ? (
                            <div className="empty-state">
                                <FiPackage size={48} />
                                <p>
                                    {searchTerm || selectedCategory !== 'all' || selectedType !== 'all'
                                        ? 'No se encontraron productos con los filtros aplicados'
                                        : 'No hay productos registrados'}
                                </p>
                                {!searchTerm && selectedCategory === 'all' && selectedType === 'all' && (
                                    <Button variant="primary" icon={<FiPlus />} onClick={handleCreateProduct} style={{ marginTop: '16px' }}>
                                        Crear Primer Producto
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <table className="products-table">
                                <thead>
                                    <tr>
                                        <th>Imagen</th><th>Producto</th><th>SKU / Código</th>
                                        <th>Categoría</th><th>Stock / Disponibilidad</th>
                                        <th>Costo</th><th>Precio Venta</th><th>Margen</th><th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.map(product => (
                                        <tr key={product.id}>
                                            <td>
                                                <div className="product-image">
                                                    {product.image_path
                                                        ? <img src={product.image_path} alt={product.name} />
                                                        : <FiPackage size={24} />}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="product-name-cell">
                                                    <div className="product-name-with-badge">
                                                        <strong>{product.name}</strong>
                                                        {product.type === 'service' && <span className="service-badge">Servicio</span>}
                                                    </div>
                                                    {product.description && <span className="product-desc">{product.description}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="product-codes">
                                                    {product.sku     && <span>SKU: {product.sku}</span>}
                                                    {product.barcode && <span>CB: {product.barcode}</span>}
                                                    {!product.sku && !product.barcode && <span style={{ color: '#9ca3af' }}>-</span>}
                                                </div>
                                            </td>
                                            <td><span className="category-badge">{product.category_name || 'Sin categoría'}</span></td>
                                            <td>
                                                {product.type === 'service' ? (
                                                    <span className={`availability-badge ${product.is_active ? 'available' : 'unavailable'}`}>
                                                        {product.is_active ? '✓ Disponible' : '✗ No Disponible'}
                                                    </span>
                                                ) : product.unlimited_stock ? (
                                                    <span className="stock-badge unlimited">Siempre disponible</span>
                                                ) : (
                                                    <span className={`stock-badge ${product.stock <= product.min_stock ? 'low' : 'normal'}`}>
                                                        {product.stock} {product.unit}
                                                    </span>
                                                )}
                                            </td>
                                            <td>{formatCurrency(product.cost_price)}</td>
                                            <td><strong>{formatCurrency(product.sale_price)}</strong></td>
                                            <td>
                                                <div className="margin-cell">
                                                    <span className="margin-amount">{formatCurrency(product.profit_amount)}</span>
                                                    <span className="margin-percentage">({product.profit_percentage}%)</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="action-btn view" onClick={() => setSelectedProduct(product)} title="Ver detalle"><FiEye /></button>
                                                    <button className="action-btn edit" onClick={() => handleEditProduct(product)} title="Editar"><FiEdit2 /></button>
                                                    <button className="action-btn delete" onClick={() => handleDeleteProduct(product)} title="Eliminar"><FiTrash2 /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>

                {showModal && (
                    <ProductModal product={editingProduct} categories={categories}
                        onSave={handleSaveProduct}
                        onClose={() => { setShowModal(false); restoreFocus(searchInputRef); }}
                        db={db} />
                )}

                {selectedProduct && (
                    <ProductDetailModal product={selectedProduct}
                        onClose={() => { setSelectedProduct(null); restoreFocus(searchInputRef); }}
                        onEdit={(p) => { setSelectedProduct(null); handleEditProduct(p); }} />
                )}

                {showPurchaseModal && (
                    <PurchaseOrderModal allProducts={products} suppliers={suppliers} currentUser={null}
                        onClose={() => { setShowPurchaseModal(false); restoreFocus(searchInputRef); }}
                        onSaved={async () => { setShowPurchaseModal(false); await loadProducts(); restoreFocus(searchInputRef); }} />
                )}

                {scannerActive && (
                    <div className="scanner-modal" onClick={() => { setScannerActive(false); restoreFocus(searchInputRef); }}>
                        <div className="scanner-content" onClick={(e) => e.stopPropagation()}>
                            <FiCreditCard size={64} />
                            <h2>Esperando código de barras...</h2>
                            <p>Escanea el producto o presiona ESC para cancelar</p>
                            <input
                                ref={scannerInputRef}
                                type="text"
                                value={scannedCode}
                                onChange={(e) => setScannedCode(e.target.value)}
                                onKeyDown={handleScannerInput}
                                className="scanner-input"
                                placeholder="Ingresa o escanea el código..."
                                autoFocus
                            />
                        </div>
                    </div>
                )}
            </div>

            {dialog && <PlDialog dialog={dialog} />}
        </div>
    );
};

export default ProductList;