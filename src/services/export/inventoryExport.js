/**
 * inventoryExport.js
 * Servicio de exportación del inventario a Excel y PDF
 * Ubicación: src/services/export/inventoryExport.js
 */

// ─── Helpers de formato ────────────────────────────────────────────────────
const fmtCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtN = (n) =>
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n || 0);

// ─── EXPORTAR A EXCEL ──────────────────────────────────────────────────────
export const exportInventoryToExcel = async ({
    products,
    filters = {},
    businessName = 'Mi Negocio'
}) => {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = businessName;
    wb.created = new Date();

    const dateStr = new Date().toLocaleDateString('es-CL');

    // ── Colores corporativos ──
    const C = {
        azul:      '2563EB',
        verde:     '10B981',
        rojo:      'EF4444',
        morado:    '7C3AED',
        amarillo:  'F59E0B',
        grisOsc:   '374151',
        grisMed:   '6B7280',
        grisClaro: 'F3F4F6',
        grisFilas: 'F9FAFB',
        blanco:    'FFFFFF',
        amarilloFoot: 'FEF9C3',
    };

    const headerFont   = { name: 'Arial', bold: true, color: { argb: C.blanco }, size: 10 };
    const titleFont    = { name: 'Arial', bold: true, size: 14, color: { argb: C.azul } };
    const subTitleFont = { name: 'Arial', bold: true, size: 11, color: { argb: C.grisOsc } };
    const bodyFont     = { name: 'Arial', size: 10 };
    const centerAlign  = { horizontal: 'center', vertical: 'middle' };
    const leftAlign    = { horizontal: 'left',   vertical: 'middle' };
    const rightAlign   = { horizontal: 'right',  vertical: 'middle' };

    const headerFill = (color) => ({
        type: 'pattern', pattern: 'solid', fgColor: { argb: color }
    });

    const addSheetHeader = (ws, title) => {
        ws.mergeCells('A1:J1');
        ws.getCell('A1').value     = businessName;
        ws.getCell('A1').font      = titleFont;
        ws.getCell('A1').alignment = leftAlign;

        ws.mergeCells('A2:J2');
        ws.getCell('A2').value     = title;
        ws.getCell('A2').font      = subTitleFont;
        ws.getCell('A2').alignment = leftAlign;

        ws.mergeCells('A3:J3');
        ws.getCell('A3').value     = `Generado el ${dateStr}${filters.type && filters.type !== 'all' ? ` | Tipo: ${filters.type === 'product' ? 'Productos' : 'Servicios'}` : ''}${filters.category ? ` | Categoría: ${filters.category}` : ''}`;
        ws.getCell('A3').font      = { name: 'Arial', size: 9, color: { argb: C.grisMed } };
        ws.getCell('A3').alignment = leftAlign;

        ws.getRow(4).height = 6;
    };

    // Separar productos y servicios
    const productos  = products.filter(p => p.type !== 'service');
    const servicios  = products.filter(p => p.type === 'service');

    // ════════════════════════════════════════════════════════════════
    // HOJA 1: Resumen General
    // ════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Resumen');
    ws1.properties.defaultRowHeight = 18;
    addSheetHeader(ws1, 'Resumen del Inventario');

    ws1.getRow(5).values  = ['Indicador', 'Valor'];
    ws1.getRow(5).font    = headerFont;
    ws1.getRow(5).fill    = headerFill(C.azul);
    ws1.getRow(5).height  = 22;
    ['A5','B5'].forEach(c => { ws1.getCell(c).alignment = centerAlign; });

    const totalProductos   = productos.length;
    const totalServicios   = servicios.length;
    const stockBajo        = productos.filter(p => !p.unlimited_stock && (parseInt(p.stock) || 0) <= (parseInt(p.min_stock) || 0)).length;
    const sinStock         = productos.filter(p => !p.unlimited_stock && (parseInt(p.stock) || 0) === 0).length;
    const valorInventario  = productos.reduce((a, p) => a + ((parseFloat(p.cost_price) || 0) * (parseInt(p.stock) || 0)), 0);
    const valorVenta       = productos.reduce((a, p) => a + ((parseFloat(p.sale_price) || 0) * (parseInt(p.stock) || 0)), 0);
    const utilidadPotencial = valorVenta - valorInventario;

    const resumen = [
        ['Total productos en inventario', totalProductos],
        ['Total servicios',               totalServicios],
        ['Productos con stock bajo',      stockBajo],
        ['Productos sin stock',           sinStock],
        ['Valor costo del inventario',    fmtCLP(valorInventario)],
        ['Valor venta del inventario',    fmtCLP(valorVenta)],
        ['Utilidad potencial',            fmtCLP(utilidadPotencial)],
    ];

    resumen.forEach(([label, val], i) => {
        const r = ws1.getRow(6 + i);
        r.values = [label, val];
        r.font   = bodyFont;
        r.height = 20;
        r.getCell(1).font = { name: 'Arial', bold: true, size: 10 };
        if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
    });

    ws1.getColumn('A').width = 36;
    ws1.getColumn('B').width = 24;

    // ════════════════════════════════════════════════════════════════
    // HOJA 2: Productos (con stock)
    // ════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Productos');
    ws2.properties.defaultRowHeight = 18;
    addSheetHeader(ws2, 'Listado de Productos');

    const prodHeaders = ['SKU', 'Nombre', 'Categoría', 'Stock', 'Stock Mín.', 'Unidad', 'Costo ($)', 'Precio Venta ($)', 'Margen ($)', 'Margen (%)'];
    ws2.getRow(5).values = prodHeaders;
    ws2.getRow(5).font   = headerFont;
    ws2.getRow(5).fill   = headerFill(C.azul);
    ws2.getRow(5).height = 22;
    prodHeaders.forEach((_, i) => {
        ws2.getRow(5).getCell(i + 1).alignment = centerAlign;
    });

    productos.forEach((p, i) => {
        const cost      = parseFloat(p.cost_price)  || 0;
        const sale      = parseFloat(p.sale_price)  || 0;
        const stock     = parseInt(p.stock)          || 0;
        const minStock  = parseInt(p.min_stock)      || 0;
        const margin    = sale - cost;
        const marginPct = cost > 0 ? ((margin / cost) * 100).toFixed(1) + '%' : '0.0%';
        const isLow     = !p.unlimited_stock && stock <= minStock;

        const r = ws2.getRow(6 + i);
        r.values = [p.sku || '-', p.name, p.category_name || 'Sin categoría', p.unlimited_stock ? 'Ilimitado' : stock, minStock, p.unit || '-', cost, sale, margin, marginPct];
        r.font   = bodyFont;
        r.height = 18;

        if (isLow && !p.unlimited_stock) {
            r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
        } else if (i % 2 === 0) {
            r.fill = headerFill(C.grisClaro);
        }

        ['G', 'H', 'I'].forEach(col => {
            ws2.getCell(`${col}${6+i}`).numFmt = '$#,##0';
            ws2.getCell(`${col}${6+i}`).alignment = rightAlign;
        });
        ['D', 'E'].forEach(col => ws2.getCell(`${col}${6+i}`).alignment = centerAlign);
        ws2.getCell(`J${6+i}`).alignment = centerAlign;
    });

    // Fila de totales
    if (productos.length > 0) {
        const totRow = ws2.getRow(6 + productos.length + 1);
        const totalCosto = productos.reduce((a, p) => a + ((parseFloat(p.cost_price) || 0) * (parseInt(p.stock) || 0)), 0);
        const totalVenta = productos.reduce((a, p) => a + ((parseFloat(p.sale_price) || 0) * (parseInt(p.stock) || 0)), 0);
        totRow.values = ['', 'TOTAL EN STOCK', '', '', '', '', totalCosto, totalVenta, totalVenta - totalCosto, ''];
        totRow.font   = { name: 'Arial', bold: true, size: 10 };
        totRow.fill   = headerFill(C.amarilloFoot);
        totRow.height = 22;
        ['G', 'H', 'I'].forEach(col => {
            ws2.getCell(`${col}${totRow.number}`).numFmt = '$#,##0';
            ws2.getCell(`${col}${totRow.number}`).alignment = rightAlign;
        });
    }

    ws2.getColumn('A').width = 14;
    ws2.getColumn('B').width = 36;
    ws2.getColumn('C').width = 18;
    ws2.getColumn('D').width = 10;
    ws2.getColumn('E').width = 10;
    ws2.getColumn('F').width = 10;
    ws2.getColumn('G').width = 16;
    ws2.getColumn('H').width = 18;
    ws2.getColumn('I').width = 16;
    ws2.getColumn('J').width = 12;

    // ════════════════════════════════════════════════════════════════
    // HOJA 3: Stock Bajo / Sin Stock
    // ════════════════════════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Alertas de Stock');
    ws3.properties.defaultRowHeight = 18;
    addSheetHeader(ws3, 'Alertas de Stock Bajo y Sin Stock');

    ws3.getRow(5).values = ['SKU', 'Nombre', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Estado', 'Precio Venta ($)'];
    ws3.getRow(5).font   = headerFont;
    ws3.getRow(5).fill   = headerFill(C.rojo);
    ws3.getRow(5).height = 22;

    const alertas = productos.filter(p => !p.unlimited_stock && (parseInt(p.stock) || 0) <= (parseInt(p.min_stock) || 0));

    if (alertas.length === 0) {
        ws3.getCell('A6').value = '✅ Todos los productos tienen stock suficiente';
        ws3.getCell('A6').font  = { name: 'Arial', size: 10, color: { argb: '166534' } };
    } else {
        alertas.forEach((p, i) => {
            const stock    = parseInt(p.stock)     || 0;
            const minStock = parseInt(p.min_stock) || 0;
            const estado   = stock === 0 ? 'SIN STOCK' : 'STOCK BAJO';

            const r = ws3.getRow(6 + i);
            r.values = [p.sku || '-', p.name, p.category_name || 'Sin categoría', stock, minStock, estado, parseFloat(p.sale_price) || 0];
            r.font   = bodyFont;
            r.height = 18;

            const fillColor = stock === 0 ? 'FEE2E2' : 'FEF3C7';
            r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };

            ws3.getCell(`G${6+i}`).numFmt    = '$#,##0';
            ws3.getCell(`G${6+i}`).alignment = rightAlign;
            ws3.getCell(`D${6+i}`).alignment = centerAlign;
            ws3.getCell(`E${6+i}`).alignment = centerAlign;
            ws3.getCell(`F${6+i}`).alignment = centerAlign;
            ws3.getCell(`F${6+i}`).font = { name: 'Arial', bold: true, size: 10,
                color: { argb: stock === 0 ? 'DC2626' : '92400E' } };
        });
    }

    ws3.getColumn('A').width = 14;
    ws3.getColumn('B').width = 36;
    ws3.getColumn('C').width = 18;
    ws3.getColumn('D').width = 14;
    ws3.getColumn('E').width = 14;
    ws3.getColumn('F').width = 14;
    ws3.getColumn('G').width = 18;

    // ════════════════════════════════════════════════════════════════
    // HOJA 4: Servicios
    // ════════════════════════════════════════════════════════════════
    if (servicios.length > 0) {
        const ws4 = wb.addWorksheet('Servicios');
        ws4.properties.defaultRowHeight = 18;
        addSheetHeader(ws4, 'Listado de Servicios');

        ws4.getRow(5).values = ['Nombre', 'Categoría', 'Precio ($)', 'Estado', 'Descripción'];
        ws4.getRow(5).font   = headerFont;
        ws4.getRow(5).fill   = headerFill(C.morado);
        ws4.getRow(5).height = 22;

        servicios.forEach((s, i) => {
            const r = ws4.getRow(6 + i);
            r.values = [s.name, s.category_name || 'Sin categoría', parseFloat(s.sale_price) || 0, s.is_active ? 'Activo' : 'Inactivo', s.description || '-'];
            r.font   = bodyFont;
            r.height = 18;
            if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
            ws4.getCell(`C${6+i}`).numFmt    = '$#,##0';
            ws4.getCell(`C${6+i}`).alignment = rightAlign;
            ws4.getCell(`D${6+i}`).alignment = centerAlign;
        });

        ws4.getColumn('A').width = 36;
        ws4.getColumn('B').width = 18;
        ws4.getColumn('C').width = 16;
        ws4.getColumn('D').width = 12;
        ws4.getColumn('E').width = 40;
    }

    // ── Guardar ──────────────────────────────────────────────────────
    const buffer   = await wb.xlsx.writeBuffer();
    const filename = `Inventario_${dateStr.replace(/\//g,'-')}.xlsx`;

    try {
        return await window.electronAPI.files.save(buffer, filename);
    } catch {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
    }
};

// ─── EXPORTAR A PDF ────────────────────────────────────────────────────────
export const exportInventoryToPDF = async ({
    products,
    filters = {},
    businessName = 'Mi Negocio'
}) => {
    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const doc     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const dateStr = new Date().toLocaleDateString('es-CL');

    const ML = 15;
    const MR = 15;
    const W  = doc.internal.pageSize.getWidth();
    const TW = W - ML - MR;

    const NEGRO    = [0,   0,   0  ];
    const GRIS_OSC = [80,  80,  80 ];
    const GRIS_MED = [130, 130, 130];
    const GRIS_SUP = [220, 220, 220];
    const GRIS_FIL = [245, 245, 245];

    let y = 0;

    const productos = products.filter(p => p.type !== 'service');
    const servicios = products.filter(p => p.type === 'service');
    const alertas   = productos.filter(p => !p.unlimited_stock && (parseInt(p.stock) || 0) <= (parseInt(p.min_stock) || 0));

    const addHeader = (isFirst = false) => {
        if (isFirst) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...NEGRO);
            doc.text('Informe de Inventario', ML, 20);

            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.4);
            doc.line(ML, 23, W - MR, 23);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...GRIS_OSC);
            doc.text(businessName, ML, 29);

            let filterText = `Generado el ${dateStr}`;
            if (filters.type && filters.type !== 'all')
                filterText += ` | Tipo: ${filters.type === 'product' ? 'Productos' : 'Servicios'}`;
            if (filters.category)
                filterText += ` | Categoría: ${filters.category}`;
            doc.text(filterText, ML, 34);

            doc.setDrawColor(...GRIS_SUP);
            doc.line(ML, 37, W - MR, 37);
            y = 44;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            doc.text(`Inventario — ${businessName} — ${dateStr}`, ML, 10);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 12, W - MR, 12);
            y = 18;
        }
    };

    const addFooters = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 195, W - MR, 195);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            doc.text(`Página ${i} de ${pageCount}`, W / 2, 200, { align: 'center' });
        }
    };

    const sectionTitle = (text) => {
        if (y > 178) { doc.addPage(); addHeader(false); }
        y += 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...NEGRO);
        doc.text(text, ML, y);
        y += 2;
        doc.setDrawColor(...GRIS_SUP);
        doc.setLineWidth(0.3);
        doc.line(ML, y, W - MR, y);
        y += 4;
    };

    const tbl = (extra = {}) => ({
        styles: {
            font: 'helvetica', fontSize: 7.5,
            cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
            textColor: NEGRO, lineColor: GRIS_SUP, lineWidth: 0.2,
        },
        headStyles: {
            fillColor: [50, 50, 50], textColor: [255, 255, 255],
            fontStyle: 'bold', fontSize: 7.5,
            cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        alternateRowStyles: { fillColor: GRIS_FIL },
        bodyStyles: { fillColor: [255, 255, 255] },
        margin: { left: ML, right: MR },
        tableWidth: TW,
        rowPageBreak: 'avoid',
        didDrawPage: () => { addHeader(false); },
        ...extra
    });

    // ── Contenido ─────────────────────────────────────────────────────────────
    addHeader(true);

    // 1. Resumen
    sectionTitle('Resumen del Inventario');
    const totalValorCosto = productos.reduce((a, p) => a + ((parseFloat(p.cost_price) || 0) * (parseInt(p.stock) || 0)), 0);
    const totalValorVenta = productos.reduce((a, p) => a + ((parseFloat(p.sale_price) || 0) * (parseInt(p.stock) || 0)), 0);

    doc.autoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
            ['Total productos',            `${productos.length}`],
            ['Total servicios',            `${servicios.length}`],
            ['Productos con stock bajo',   `${alertas.length}`],
            ['Valor costo del inventario', `${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalValorCosto)}`],
            ['Valor venta del inventario', `${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalValorVenta)}`],
            ['Utilidad potencial',         `${new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalValorVenta - totalValorCosto)}`],
        ],
        ...tbl({
            columnStyles: {
                0: { cellWidth: 70, fontStyle: 'bold' },
                1: { cellWidth: 50, halign: 'right' }
            }
        })
    });
    y = doc.lastAutoTable.finalY + 6;

    // 2. Listado de productos
    sectionTitle('Listado de Productos');
    if (productos.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...GRIS_OSC);
        doc.text('No hay productos registrados.', ML, y);
        y += 8;
    } else {
        const fmtCLPPdf = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
        doc.autoTable({
            startY: y,
            head: [['SKU', 'Nombre', 'Categoría', 'Stock', 'Costo', 'P. Venta', 'Margen', 'Margen %']],
            body: productos.map(p => {
                const cost    = parseFloat(p.cost_price) || 0;
                const sale    = parseFloat(p.sale_price) || 0;
                const stock   = p.unlimited_stock ? '∞' : (parseInt(p.stock) || 0);
                const margin  = sale - cost;
                const mPct    = cost > 0 ? ((margin / cost) * 100).toFixed(1) + '%' : '0%';
                return [p.sku || '-', p.name, p.category_name || '-', stock, fmtCLPPdf(cost), fmtCLPPdf(sale), fmtCLPPdf(margin), mPct];
            }),
            ...tbl({
                didBodyCell: (data) => {
                    const prod = productos[data.row.index];
                    if (prod && !prod.unlimited_stock) {
                        const s = parseInt(prod.stock) || 0;
                        const m = parseInt(prod.min_stock) || 0;
                        if (s === 0) data.cell.styles.fillColor = [254, 226, 226];
                        else if (s <= m) data.cell.styles.fillColor = [254, 243, 199];
                    }
                },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 60 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 14, halign: 'center' },
                    4: { halign: 'right' },
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                    7: { cellWidth: 16, halign: 'center' }
                }
            })
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // 3. Alertas de stock
    if (alertas.length > 0) {
        sectionTitle('Alertas de Stock Bajo y Sin Stock');
        const fmtCLPPdf = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
        doc.autoTable({
            startY: y,
            head: [['SKU', 'Nombre', 'Categoría', 'Stock', 'Stock Mín.', 'Estado', 'Precio Venta']],
            body: alertas.map(p => {
                const stock  = parseInt(p.stock)     || 0;
                const minSt  = parseInt(p.min_stock) || 0;
                const estado = stock === 0 ? 'SIN STOCK' : 'STOCK BAJO';
                return [p.sku || '-', p.name, p.category_name || '-', stock, minSt, estado, fmtCLPPdf(p.sale_price)];
            }),
            ...tbl({
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 14, halign: 'center' },
                    4: { cellWidth: 18, halign: 'center' },
                    5: { cellWidth: 20, halign: 'center' },
                    6: { halign: 'right' }
                }
            })
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // 4. Servicios
    if (servicios.length > 0) {
        sectionTitle('Servicios');
        const fmtCLPPdf = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
        doc.autoTable({
            startY: y,
            head: [['Nombre', 'Categoría', 'Precio', 'Estado', 'Descripción']],
            body: servicios.map(s => [s.name, s.category_name || '-', fmtCLPPdf(s.sale_price), s.is_active ? 'Activo' : 'Inactivo', s.description || '-']),
            ...tbl({
                columnStyles: {
                    0: { cellWidth: 60 },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 28, halign: 'right' },
                    3: { cellWidth: 18, halign: 'center' },
                    4: {}
                }
            })
        });
    }

    addFooters();
    doc.save(`Inventario_${dateStr.replace(/\//g,'-')}.pdf`);
    return { success: true };
};