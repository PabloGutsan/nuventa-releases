/**
 * reportExport.js
 * Servicio de exportación de reportes a Excel y PDF
 * Ubicación: src/services/export/reportExport.js
 */

// ─── Helpers de formato ────────────────────────────────────────────────────
const fmtCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtN = (n) =>
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n || 0);

const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0.0%');

const PERIOD_LABELS = {
    days8:  'Últimos 8 días',
    months: 'Últimos 13 meses',
    years:  'Últimos 5 años',
    custom: 'Período personalizado'
};

// ─── EXPORTAR A EXCEL ──────────────────────────────────────────────────────
export const exportToExcel = async ({
    period, dateFrom, dateTo,
    summary, chartData, paymentData,
    topProducts, bySeller, noMovement,
    businessName = 'Mi Negocio'
}) => {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = businessName;
    wb.created = new Date();

    const periodLabel = PERIOD_LABELS[period] || 'Personalizado';
    const rangeLabel  = `${dateFrom} al ${dateTo}`;

    // ── Colores corporativos ──
    const C = {
        azul:     '2563EB',
        verde:    '10B981',
        rojo:     'EF4444',
        grisOsc:  '374151',
        grisMed:  '6B7280',
        grisClaro:'F3F4F6',
        blanco:   'FFFFFF',
        amarillo: 'FEF9C3',
    };

    const headerFont   = { name: 'Arial', bold: true, color: { argb: C.blanco }, size: 11 };
    const titleFont    = { name: 'Arial', bold: true, size: 14, color: { argb: C.azul } };
    const subTitleFont = { name: 'Arial', bold: true, size: 11, color: { argb: C.grisOsc } };
    const bodyFont     = { name: 'Arial', size: 10 };
    const centerAlign  = { horizontal: 'center', vertical: 'middle' };
    const leftAlign    = { horizontal: 'left',   vertical: 'middle' };
    const rightAlign   = { horizontal: 'right',  vertical: 'middle' };

    const headerFill = (color) => ({
        type: 'pattern', pattern: 'solid', fgColor: { argb: color }
    });

    const addSheetHeader = (ws, title, subtitle) => {
        ws.mergeCells('A1:G1');
        ws.getCell('A1').value     = businessName;
        ws.getCell('A1').font      = titleFont;
        ws.getCell('A1').alignment = leftAlign;

        ws.mergeCells('A2:G2');
        ws.getCell('A2').value     = title;
        ws.getCell('A2').font      = subTitleFont;
        ws.getCell('A2').alignment = leftAlign;

        ws.mergeCells('A3:G3');
        ws.getCell('A3').value     = `${periodLabel} | ${rangeLabel}`;
        ws.getCell('A3').font      = { name: 'Arial', size: 9, color: { argb: C.grisMed } };
        ws.getCell('A3').alignment = leftAlign;

        ws.getRow(4).height = 6; // separador
    };

    // ════════════════════════════════════════════════════════════════
    // HOJA 1: Resumen General
    // ════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Resumen General');
    ws1.properties.defaultRowHeight = 18;

    addSheetHeader(ws1, 'Resumen General de Ventas', '');

    // Métricas principales
    ws1.getRow(5).values  = ['Indicador', 'Valor', 'Detalle'];
    ws1.getRow(5).font    = headerFont;
    ws1.getRow(5).fill    = headerFill(C.azul);
    ws1.getRow(5).height  = 22;
    ['A5','B5','C5'].forEach(c => { ws1.getCell(c).alignment = centerAlign; });

    const metricas = [
        ['Total Ventas',    fmtCLP(summary.sales),   `${fmtN(summary.count)} transacciones`],
        ['Costo de Ventas', fmtCLP(summary.cost),    `${pct(summary.cost, summary.sales)} sobre ventas`],
        ['Utilidad Bruta',  fmtCLP(summary.profit),  `Margen: ${pct(summary.profit, summary.sales)}`],
        ['Ticket Promedio', fmtCLP(summary.avg),     `${fmtN(summary.count)} ventas registradas`],
    ];

    metricas.forEach((row, i) => {
        const r = ws1.getRow(6 + i);
        r.values = row;
        r.font   = bodyFont;
        r.height = 20;
        r.getCell(1).font = { name: 'Arial', bold: true, size: 10 };
        if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
    });

    ws1.getColumn('A').width = 22;
    ws1.getColumn('B').width = 20;
    ws1.getColumn('C').width = 30;

    // ════════════════════════════════════════════════════════════════
    // HOJA 2: Ventas por Período
    // ════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Ventas por Período');
    ws2.properties.defaultRowHeight = 18;
    addSheetHeader(ws2, 'Ventas por Período', '');

    ws2.getRow(5).values = ['Período', 'Costo ($)', 'Utilidad ($)', 'Total Venta ($)', 'Margen (%)'];
    ws2.getRow(5).font   = headerFont;
    ws2.getRow(5).fill   = headerFill(C.azul);
    ws2.getRow(5).height = 22;

    chartData.forEach((row, i) => {
        const total = row.Costo + row.Utilidad;
        const r = ws2.getRow(6 + i);
        r.values = [
            row._label || row.day,   // fecha completa si existe ("Mié 19 Feb 2026")
            row.Costo,
            row.Utilidad,
            total,
            total > 0 ? (row.Utilidad / total * 100).toFixed(1) + '%' : '0.0%'
        ];
        r.font   = bodyFont;
        r.height = 18;
        if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
        // Formato moneda
        ['B','C','D'].forEach(col => {
            ws2.getCell(`${col}${6+i}`).numFmt = '$#,##0';
            ws2.getCell(`${col}${6+i}`).alignment = rightAlign;
        });
        ws2.getCell(`E${6+i}`).alignment = centerAlign;
    });

    // Fila de totales
    const totalRow = ws2.getRow(6 + chartData.length + 1);
    totalRow.values = [
        'TOTAL',
        chartData.reduce((a, r) => a + r.Costo, 0),
        chartData.reduce((a, r) => a + r.Utilidad, 0),
        summary.sales,
        pct(summary.profit, summary.sales)
    ];
    totalRow.font   = { name: 'Arial', bold: true, size: 10 };
    totalRow.fill   = headerFill(C.amarillo);
    totalRow.height = 22;
    ['B','C','D'].forEach(col => {
        ws2.getCell(`${col}${totalRow.number}`).numFmt = '$#,##0';
        ws2.getCell(`${col}${totalRow.number}`).alignment = rightAlign;
    });

    ws2.getColumn('A').width = 28; // más ancho para 'Mié 19 Feb 2026'
    ['B','C','D'].forEach(col => { ws2.getColumn(col).width = 18; });
    ws2.getColumn('E').width = 14;

    // ════════════════════════════════════════════════════════════════
    // HOJA 3: Top 10 Productos
    // ════════════════════════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Productos Vendidos');
    ws3.properties.defaultRowHeight = 18;
    addSheetHeader(ws3, 'Productos Vendidos en el Período', '');

    ws3.getRow(5).values = ['#', 'Producto', 'Unidades', 'Ingresos ($)', 'Costo ($)', 'Utilidad ($)', 'Margen (%)'];
    ws3.getRow(5).font   = headerFont;
    ws3.getRow(5).fill   = headerFill(C.verde);
    ws3.getRow(5).height = 22;

    topProducts.forEach((p, i) => {
        const r = ws3.getRow(6 + i);
        r.values = [
            i + 1,
            p.name,
            p.qty,
            p.revenue,
            p.cost,
            p.profit,
            pct(p.profit, p.revenue)
        ];
        r.font   = bodyFont;
        r.height = 18;
        if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
        ['D','E','F'].forEach(col => {
            ws3.getCell(`${col}${6+i}`).numFmt = '$#,##0';
            ws3.getCell(`${col}${6+i}`).alignment = rightAlign;
        });
        ws3.getCell(`C${6+i}`).alignment = centerAlign;
        ws3.getCell(`G${6+i}`).alignment = centerAlign;
        ws3.getCell(`A${6+i}`).alignment = centerAlign;
    });

    ws3.getColumn('A').width = 5;
    ws3.getColumn('B').width = 35;
    ws3.getColumn('C').width = 12;
    ['D','E','F'].forEach(col => { ws3.getColumn(col).width = 18; });
    ws3.getColumn('G').width = 12;

    // ════════════════════════════════════════════════════════════════
    // HOJA 4: Vendedores
    // ════════════════════════════════════════════════════════════════
    const ws4 = wb.addWorksheet('Ventas por Vendedor');
    ws4.properties.defaultRowHeight = 18;
    addSheetHeader(ws4, 'Ventas por Vendedor', '');

    ws4.getRow(5).values = ['Vendedor', 'N° Ventas', 'Total Ventas ($)', 'Costo ($)', 'Utilidad ($)', 'Margen (%)'];
    ws4.getRow(5).font   = headerFont;
    ws4.getRow(5).fill   = headerFill(C.azul);
    ws4.getRow(5).height = 22;

    bySeller.forEach((s, i) => {
        const r = ws4.getRow(6 + i);
        r.values = [
            s.seller,
            s.count,
            s.sales,
            s.cost,
            s.profit,
            pct(s.profit, s.sales)
        ];
        r.font   = bodyFont;
        r.height = 20;
        if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
        ['C','D','E'].forEach(col => {
            ws4.getCell(`${col}${6+i}`).numFmt = '$#,##0';
            ws4.getCell(`${col}${6+i}`).alignment = rightAlign;
        });
        ws4.getCell(`B${6+i}`).alignment = centerAlign;
        ws4.getCell(`F${6+i}`).alignment = centerAlign;
    });

    ws4.getColumn('A').width = 28;
    ws4.getColumn('B').width = 12;
    ['C','D','E'].forEach(col => { ws4.getColumn(col).width = 18; });
    ws4.getColumn('F').width = 12;

    // ════════════════════════════════════════════════════════════════
    // HOJA 5: Formas de Pago
    // ════════════════════════════════════════════════════════════════
    const ws5 = wb.addWorksheet('Formas de Pago');
    ws5.properties.defaultRowHeight = 18;
    addSheetHeader(ws5, 'Ventas por Forma de Pago', '');

    const PAYMENT_LABELS = {
        efectivo: 'Efectivo', tarjeta_debito: 'Débito',
        tarjeta_credito: 'Crédito', transferencia: 'Transferencia', multiple: 'Múltiple'
    };
    const totalPagos = paymentData.reduce((a, p) => a + p.total, 0);

    ws5.getRow(5).values = ['Forma de Pago', 'N° Transacciones', 'Total ($)', '% del Total'];
    ws5.getRow(5).font   = headerFont;
    ws5.getRow(5).fill   = headerFill(C.azul);
    ws5.getRow(5).height = 22;

    paymentData.forEach((p, i) => {
        const r = ws5.getRow(6 + i);
        r.values = [
            PAYMENT_LABELS[p.payment_method] || p.payment_method,
            p.count,
            p.total,
            pct(p.total, totalPagos)
        ];
        r.font   = bodyFont;
        r.height = 20;
        if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
        ws5.getCell(`C${6+i}`).numFmt = '$#,##0';
        ws5.getCell(`C${6+i}`).alignment = rightAlign;
        ws5.getCell(`B${6+i}`).alignment = centerAlign;
        ws5.getCell(`D${6+i}`).alignment = centerAlign;
    });

    ws5.getColumn('A').width = 22;
    ws5.getColumn('B').width = 18;
    ws5.getColumn('C').width = 18;
    ws5.getColumn('D').width = 14;

    // ════════════════════════════════════════════════════════════════
    // HOJA 6: Productos sin Movimiento
    // ════════════════════════════════════════════════════════════════
    const ws6 = wb.addWorksheet('Sin Movimiento');
    ws6.properties.defaultRowHeight = 18;
    addSheetHeader(ws6, 'Productos sin Movimiento en el Período', '');

    ws6.getRow(5).values = ['Producto', 'Stock Actual', 'Precio Venta ($)', 'Valor en Stock ($)'];
    ws6.getRow(5).font   = headerFont;
    ws6.getRow(5).fill   = headerFill(C.rojo);
    ws6.getRow(5).height = 22;

    if (noMovement.length === 0) {
        ws6.getCell('A6').value = '✅ Todos los productos tuvieron movimiento en el período';
        ws6.getCell('A6').font  = { name: 'Arial', size: 10, color: { argb: '166534' } };
    } else {
        noMovement.forEach((p, i) => {
            const r = ws6.getRow(6 + i);
            r.values = [p.name, p.stock, p.sale_price, p.stock * p.sale_price];
            r.font   = bodyFont;
            r.height = 18;
            if (i % 2 === 0) r.fill = headerFill(C.grisClaro);
            ['C','D'].forEach(col => {
                ws6.getCell(`${col}${6+i}`).numFmt = '$#,##0';
                ws6.getCell(`${col}${6+i}`).alignment = rightAlign;
            });
            ws6.getCell(`B${6+i}`).alignment = centerAlign;
        });
    }

    ws6.getColumn('A').width = 35;
    ws6.getColumn('B').width = 14;
    ws6.getColumn('C').width = 18;
    ws6.getColumn('D').width = 20;

    // ── Guardar ──────────────────────────────────────────────────────
    const buffer   = await wb.xlsx.writeBuffer();
    const filename = `Reporte_${periodLabel.replace(/ /g,'_')}_${dateFrom}_${dateTo}.xlsx`;
    // Guardar usando el diálogo nativo de Electron
    try {
        return await window.electronAPI.files.save(buffer, filename);
    } catch {
        // Fallback: descarga directa por el navegador
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

// ─── EXPORTAR A PDF (diseño limpio tipo documento) ───────────────────────────

// ─── EXPORTAR A PDF (estilo documento Word, minimalista, B&N) ─────────────────
export const exportToPDF = async ({
    period, dateFrom, dateTo,
    summary, chartData, paymentData,
    topProducts, bySeller, noMovement,
    businessName = 'Mi Negocio'
}) => {
    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const doc         = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const periodLabel = PERIOD_LABELS[period] || 'Personalizado';

    // ── Márgenes tipo Word ────────────────────────────────────────────────────
    const ML = 25;   // margen izquierdo
    const MR = 25;   // margen derecho
    const MT = 20;   // margen superior (después del header)
    const W  = doc.internal.pageSize.getWidth();   // 215.9mm
    const TW = W - ML - MR;                        // ancho disponible tabla

    let y = 0;

    // ── Paleta monocromática ──────────────────────────────────────────────────
    const NEGRO    = [0,   0,   0  ];
    const GRIS_OSC = [80,  80,  80 ];
    const GRIS_MED = [130, 130, 130];
    const GRIS_SUP = [220, 220, 220]; // líneas divisoras
    const GRIS_FIL = [245, 245, 245]; // filas alternas

    const fmtCLP = (n) =>
        new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

    // ── Encabezado de página ──────────────────────────────────────────────────
    const addHeader = (isFirstPage = false) => {
        if (isFirstPage) {
            // Nombre del documento (grande, negrita)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...NEGRO);
            doc.text('Informe de Ventas y Rentabilidad', ML, 22);

            // Línea divisora bajo el título
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.4);
            doc.line(ML, 25, W - MR, 25);

            // Meta info
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...GRIS_OSC);
            doc.text(`${businessName}`, ML, 31);
            doc.text(`Período: ${periodLabel}  |  ${dateFrom} al ${dateTo}  |  Descargado: ${new Date().toLocaleDateString('es-CL')}`, ML, 36);

            // Segunda línea divisora
            doc.setDrawColor(...GRIS_SUP);
            doc.line(ML, 39, W - MR, 39);

            y = MT + 26; // ~46mm desde el top
        } else {
            // Header reducido en páginas siguientes
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            doc.text(`Informe de Ventas — ${businessName} — ${periodLabel}`, ML, 12);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 14, W - MR, 14);
            y = 20;
        }
    };

    // ── Pie de página ─────────────────────────────────────────────────────────
    const addFooters = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 272, W - MR, 272);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            doc.text(
                `Página ${i} de ${pageCount}`,
                W / 2, 277, { align: 'center' }
            );
        }
    };

    // ── Título de sección ─────────────────────────────────────────────────────
    const sectionTitle = (text) => {
        if (y > 252) { doc.addPage(); addHeader(false); }
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

    // ── Opciones base para todas las tablas ───────────────────────────────────
    const tbl = (extra = {}) => ({
        styles: {
            font:        'helvetica',
            fontSize:    7.5,
            cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
            textColor:   NEGRO,
            lineColor:   GRIS_SUP,
            lineWidth:   0.2,
        },
        headStyles: {
            fillColor:  [50, 50, 50],
            textColor:  [255, 255, 255],
            fontStyle:  'bold',
            fontSize:   7.5,
            cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        alternateRowStyles: { fillColor: GRIS_FIL },
        bodyStyles:  { fillColor: [255, 255, 255] },
        margin:      { left: ML, right: MR },
        tableWidth:  TW,
        rowPageBreak: 'avoid',   // evita cortar filas entre páginas
        didDrawPage: (_data) => { addHeader(false); },
        ...extra
    });

    // ════════════════════════════════════════════
    // CONTENIDO
    // ════════════════════════════════════════════
    addHeader(true);

    // ── 1. Resumen ejecutivo ──────────────────────────────────────────────────
    sectionTitle('Resumen Ejecutivo');
    doc.autoTable({
        startY: y,
        head:   [['Indicador', 'Valor', 'Detalle']],
        body:   [
            ['Total Ventas',    fmtCLP(summary.sales),  `${fmtN(summary.count)} transacciones`],
            ['Costo de Ventas', fmtCLP(summary.cost),   `${pct(summary.cost, summary.sales)} sobre ventas`],
            ['Utilidad Bruta',  fmtCLP(summary.profit), `Margen ${pct(summary.profit, summary.sales)}`],
            ['Ticket Promedio', fmtCLP(summary.avg),    'Promedio por transacción'],
        ],
        ...tbl({
            didDrawPage: (_d) => { addHeader(false); },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 50 },
                1: { cellWidth: 38, halign: 'right' },
                2: {}
            }
        })
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 2. Ventas por período ─────────────────────────────────────────────────
    sectionTitle('Ventas por Período');
    doc.autoTable({
        startY: y,
        head:   [['Período', 'Costo', 'Utilidad', 'Total', 'Margen']],
        showHead: 'everyPage',
        body:   chartData.map(r => {
            const t     = r.Costo + r.Utilidad;
            const label = r._label || r.day; // usar etiqueta completa si existe
            return [label, fmtCLP(r.Costo), fmtCLP(r.Utilidad), fmtCLP(t),
                t > 0 ? (r.Utilidad / t * 100).toFixed(1) + '%' : '0%'];
        }),
        foot:   [['TOTAL',
            fmtCLP(chartData.reduce((a,r) => a + r.Costo,    0)),
            fmtCLP(chartData.reduce((a,r) => a + r.Utilidad, 0)),
            fmtCLP(summary.sales),
            pct(summary.profit, summary.sales)
        ]],
        ...tbl({
            footStyles: {
                fillColor:  [230, 230, 230],
                textColor:  NEGRO,
                fontStyle:  'bold',
                fontSize:   8.5,
                halign:     'right',
            },
            columnStyles: {
                0: { cellWidth: 46, halign: 'left' }, // ancho para "Mié 19 Ene 2026"
                1: { halign: 'right' }, 2: { halign: 'right' },
                3: { halign: 'right' }, 4: { halign: 'center' }
            }
        })
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 3. Formas de pago ─────────────────────────────────────────────────────
    sectionTitle('Ventas por Forma de Pago');
    const PLABELS = {
        efectivo: 'Efectivo', tarjeta_debito: 'Débito',
        tarjeta_credito: 'Crédito', transferencia: 'Transferencia', multiple: 'Múltiple'
    };
    const totalPagos = paymentData.reduce((a, p) => a + p.total, 0);
    doc.autoTable({
        startY: y,
        head:   [['Forma de Pago', 'N° Transacciones', 'Total', '% del Total']],
        body:   paymentData.map(p => [
            PLABELS[p.payment_method] || p.payment_method,
            fmtN(p.count), fmtCLP(p.total), pct(p.total, totalPagos)
        ]),
        ...tbl({
            columnStyles: {
                0: { cellWidth: 48 },
                1: { halign: 'center' },
                2: { halign: 'right' },
                3: { halign: 'center' }
            }
        })
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 4. Productos vendidos ─────────────────────────────────────────────────
    sectionTitle('Productos Vendidos en el Período');
    doc.autoTable({
        startY: y,
        head:   [['#', 'Producto', 'Unidades', 'Ingresos', 'Costo', 'Utilidad', 'Margen']],
        body:   topProducts.map((p, i) => [
            i + 1, p.name, fmtN(p.qty),
            fmtCLP(p.revenue), fmtCLP(p.cost), fmtCLP(p.profit),
            pct(p.profit, p.revenue)
        ]),
        ...tbl({
            columnStyles: {
                0: { cellWidth: 8,  halign: 'center' },
                1: { cellWidth: 58 },
                2: { halign: 'center' },
                3: { halign: 'right' }, 4: { halign: 'right' },
                5: { halign: 'right' }, 6: { halign: 'center' }
            }
        })
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 5. Vendedores ─────────────────────────────────────────────────────────
    sectionTitle('Ventas por Vendedor');
    doc.autoTable({
        startY: y,
        head:   [['Vendedor', 'N° Ventas', 'Total Ventas', 'Costo', 'Utilidad', 'Margen']],
        body:   bySeller.map(s => [
            s.seller, fmtN(s.count), fmtCLP(s.sales),
            fmtCLP(s.cost), fmtCLP(s.profit), pct(s.profit, s.sales)
        ]),
        ...tbl({
            columnStyles: {
                0: { cellWidth: 52 },
                1: { halign: 'center' },
                2: { halign: 'right' }, 3: { halign: 'right' },
                4: { halign: 'right' }, 5: { halign: 'center' }
            }
        })
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 6. Sin movimiento ─────────────────────────────────────────────────────
    sectionTitle('Productos sin Movimiento en el Período');
    if (noMovement.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...GRIS_OSC);
        doc.text('Todos los productos tuvieron movimiento en el período seleccionado.', ML, y);
        y += 8;
    } else {
        doc.autoTable({
            startY: y,
            head:   [['Producto', 'Stock Actual', 'Precio Venta', 'Valor en Stock']],
            body:   noMovement.map(p => [
                p.name, fmtN(p.stock) + ' u.',
                fmtCLP(p.sale_price), fmtCLP(p.stock * p.sale_price)
            ]),
            ...tbl({
                columnStyles: {
                    0: { cellWidth: 80 },
                    1: { halign: 'center' },
                    2: { halign: 'right' },
                    3: { halign: 'right' }
                }
            })
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ── Pie de página en todas las páginas ────────────────────────────────────
    addFooters();

    // ── Guardar ───────────────────────────────────────────────────────────────
    doc.save(`Reporte_${periodLabel.replace(/ /g,'_')}_${dateFrom}_${dateTo}.pdf`);
    return { success: true };
};