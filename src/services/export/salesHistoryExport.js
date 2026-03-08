/**
 * salesHistoryExport.js
 * Servicio de exportación del Historial de Ventas a Excel y PDF
 * Ubicación: src/services/export/salesHistoryExport.js
 */

// ─── Helpers de formato ────────────────────────────────────────────────────
const fmtCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtN = (n) =>
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n || 0);

const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '0.0%');

const PAYMENT_LABELS = {
    efectivo:        'Efectivo',
    tarjeta_debito:  'Débito',
    tarjeta_credito: 'Crédito',
    transferencia:   'Transferencia',
    multiple:        'Múltiple',
};

const DOCUMENT_LABELS = {
    boleta_fisica:       'Boleta Física',
    boleta_electronica:  'Boleta Electrónica',
    factura_fisica:      'Factura Física',
    factura_electronica: 'Factura Electrónica',
    sin_documento:       'Sin Documento',
};

const fmtDate = (dateStr) => {
    if (!dateStr) return '-';
    // Formato: DD-MM-YYYY HH:MM
    const d = new Date(dateStr);
    const dd   = String(d.getDate()).padStart(2, '0');
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
};

// Para formatear dateFrom/dateTo (vienen como 'YYYY-MM-DD') en encabezados
const fmtDateLabel = (isoDate) => {
    if (!isoDate) return '';
    const [yyyy, mm, dd] = isoDate.split('-');
    return `${dd}-${mm}-${yyyy}`;
};

// ─── EXPORTAR A EXCEL ──────────────────────────────────────────────────────
/**
 * @param {object} params
 * @param {string}  params.dateFrom       - Fecha inicio (YYYY-MM-DD)
 * @param {string}  params.dateTo         - Fecha fin    (YYYY-MM-DD)
 * @param {Array}   params.sales          - Array de ventas filtradas
 * @param {object}  params.stats          - { total_sales, total_revenue, average_ticket, cancelled_sales }
 * @param {string}  [params.businessName] - Nombre del negocio
 * @param {string}  [params.searchTerm]   - Filtro de búsqueda aplicado
 * @param {string}  [params.paymentFilter]- Filtro de método de pago aplicado
 */
export const exportSalesHistoryToExcel = async ({
    dateFrom,
    dateTo,
    sales = [],
    stats = {},
    businessName  = 'Mi Negocio',
    searchTerm    = '',
    paymentFilter = '',
    sellerFilter  = '',
}) => {
    const ExcelJS = require('exceljs');
    const wb      = new ExcelJS.Workbook();
    wb.creator    = businessName;
    wb.created    = new Date();

    const rangeLabel = `${fmtDateLabel(dateFrom)} al ${fmtDateLabel(dateTo)}`;
    const C = {
        azul:     '2563EB',
        verde:    '10B981',
        rojo:     'EF4444',
        grisOsc:  '374151',
        grisMed:  '6B7280',
        grisClaro:'F3F4F6',
        amarillo: 'FEF9C3',
        blanco:   'FFFFFF',
        naranja:  'F97316',
    };

    const headerFont  = { name: 'Arial', bold: true, color: { argb: C.blanco }, size: 11 };
    const titleFont   = { name: 'Arial', bold: true, size: 14, color: { argb: C.azul } };
    const subFont     = { name: 'Arial', bold: true, size: 11, color: { argb: C.grisOsc } };
    const bodyFont    = { name: 'Arial', size: 10 };
    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const leftAlign   = { horizontal: 'left',   vertical: 'middle' };
    const rightAlign  = { horizontal: 'right',  vertical: 'middle' };

    const fill = (color) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });

    // ── Encabezado de hoja reutilizable ──
    const addSheetHeader = (ws, title) => {
        ws.mergeCells('A1:J1');
        ws.getCell('A1').value     = businessName;
        ws.getCell('A1').font      = titleFont;
        ws.getCell('A1').alignment = leftAlign;

        ws.mergeCells('A2:J2');
        ws.getCell('A2').value     = title;
        ws.getCell('A2').font      = subFont;
        ws.getCell('A2').alignment = leftAlign;

        ws.mergeCells('A3:J3');
        const filterDesc = [
            `Período: ${rangeLabel}`,
            searchTerm    ? `Búsqueda: "${searchTerm}"` : '',
            paymentFilter && paymentFilter !== 'all'
                ? `Pago: ${PAYMENT_LABELS[paymentFilter] || paymentFilter}` : '',
            sellerFilter  && sellerFilter  !== 'all'
                ? `Vendedor: ${sellerFilter}` : '',
        ].filter(Boolean).join('  |  ');
        ws.getCell('A3').value     = filterDesc;
        ws.getCell('A3').font      = { name: 'Arial', size: 9, color: { argb: C.grisMed } };
        ws.getCell('A3').alignment = leftAlign;

        ws.getRow(4).height = 6; // separador visual
    };

    // ════════════════════════════════════════════════════════════════
    // HOJA 1 — Resumen del período
    // ════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Resumen');
    ws1.properties.defaultRowHeight = 18;
    addSheetHeader(ws1, 'Resumen del Período');

    ws1.getRow(5).values = ['Indicador', 'Valor', 'Detalle'];
    ws1.getRow(5).font   = headerFont;
    ws1.getRow(5).fill   = fill(C.azul);
    ws1.getRow(5).height = 22;
    ['A5', 'B5', 'C5'].forEach(c => { ws1.getCell(c).alignment = centerAlign; });

    const activeSales     = sales.filter(s => !s.is_cancelled);
    const cancelledSales  = sales.filter(s => s.is_cancelled);
    const totalRevenue    = activeSales.reduce((a, s) => a + (s.total || 0), 0);
    const avgTicket       = activeSales.length > 0 ? totalRevenue / activeSales.length : 0;

    const metricas = [
        ['Total Ventas',      fmtN(activeSales.length),    `${fmtN(sales.length)} registros en el período`],
        ['Ingresos Totales',  fmtCLP(totalRevenue),        'No incluye ventas canceladas'],
        ['Ticket Promedio',   fmtCLP(avgTicket),           'Promedio por transacción'],
        ['Ventas Canceladas', fmtN(cancelledSales.length), `${pct(cancelledSales.length, sales.length)} del total`],
    ];

    metricas.forEach((row, i) => {
        const r = ws1.getRow(6 + i);
        r.values = row;
        r.font   = bodyFont;
        r.height = 20;
        r.getCell(1).font = { name: 'Arial', bold: true, size: 10 };
        if (i % 2 === 0) r.fill = fill(C.grisClaro);
    });

    ws1.getColumn('A').width = 26;
    ws1.getColumn('B').width = 22;
    ws1.getColumn('C').width = 34;

    // ════════════════════════════════════════════════════════════════
    // HOJA 2 — Listado de Ventas
    // ════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Listado de Ventas');
    ws2.properties.defaultRowHeight = 18;
    addSheetHeader(ws2, 'Listado de Ventas');

    ws2.getRow(5).values = [
        'N° Venta', 'Fecha', 'Cliente', 'Vendedor',
        'Items', 'Método Pago', 'Documento', 'N° Doc.',
        'Total ($)', 'Estado'
    ];
    ws2.getRow(5).font   = headerFont;
    ws2.getRow(5).fill   = fill(C.azul);
    ws2.getRow(5).height = 22;

    sales.forEach((s, i) => {
        const r = ws2.getRow(6 + i);
        r.values = [
            s.sale_number,
            fmtDate(s.created_at),
            s.customer_name || '-',
            s.seller_name   || '-',
            s.items_count   || 0,
            PAYMENT_LABELS[s.payment_method]  || s.payment_method  || '-',
            DOCUMENT_LABELS[s.document_type]  || s.document_type   || '-',
            s.document_number ? `N° ${s.document_number}` : '-',
            s.total || 0,
            s.is_cancelled ? 'Cancelada' : 'Activa',
        ];
        r.font   = bodyFont;
        r.height = 18;
        if (i % 2 === 0) r.fill = fill(C.grisClaro);

        // Resaltar canceladas
        if (s.is_cancelled) {
            ws2.getCell(`J${6 + i}`).font = { name: 'Arial', size: 10, color: { argb: C.rojo }, bold: true };
        }

        ws2.getCell(`I${6 + i}`).numFmt    = '$#,##0';
        ws2.getCell(`I${6 + i}`).alignment = rightAlign;
        ws2.getCell(`E${6 + i}`).alignment = rightAlign;
        ws2.getCell(`J${6 + i}`).alignment = rightAlign;
    });

    // Fila de totales
    const totRow = ws2.getRow(6 + sales.length + 1);
    totRow.values = [
        'TOTAL', '', '', '',
        '', '', '', '',
        activeSales.reduce((a, s) => a + (s.total || 0), 0),
        `${activeSales.length} ventas / ${cancelledSales.length} canceladas`,
    ];
    totRow.font   = { name: 'Arial', bold: true, size: 10 };
    totRow.fill   = fill(C.amarillo);
    totRow.height = 22;
    ws2.getCell(`I${totRow.number}`).numFmt    = '$#,##0';
    ws2.getCell(`I${totRow.number}`).alignment = rightAlign;

    // Anchos de columnas
    ws2.getColumn('A').width = 14;
    ws2.getColumn('B').width = 18;
    ws2.getColumn('C').width = 22;
    ws2.getColumn('D').width = 22;
    ws2.getColumn('E').width = 8;
    ws2.getColumn('F').width = 16;
    ws2.getColumn('G').width = 22;
    ws2.getColumn('H').width = 14;
    ws2.getColumn('I').width = 16;
    ws2.getColumn('J').width = 12;

    // ════════════════════════════════════════════════════════════════
    // HOJA 3 — Ventas por Método de Pago
    // ════════════════════════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Por Método de Pago');
    ws3.properties.defaultRowHeight = 18;
    addSheetHeader(ws3, 'Ventas por Método de Pago');

    ws3.getRow(5).values = ['Método de Pago', 'N° Transacciones', 'Total ($)', '% del Total'];
    ws3.getRow(5).font   = headerFont;
    ws3.getRow(5).fill   = fill(C.azul);
    ws3.getRow(5).height = 22;

    // Agrupar por método de pago (solo activas)
    const byPayment = {};
    activeSales.forEach(s => {
        const key = s.payment_method || 'sin_metodo';
        if (!byPayment[key]) byPayment[key] = { count: 0, total: 0 };
        byPayment[key].count++;
        byPayment[key].total += s.total || 0;
    });

    const paymentRows = Object.entries(byPayment)
        .sort((a, b) => b[1].total - a[1].total);

    paymentRows.forEach(([method, data], i) => {
        const r = ws3.getRow(6 + i);
        r.values = [
            PAYMENT_LABELS[method] || method,
            data.count,
            data.total,
            pct(data.total, totalRevenue),
        ];
        r.font   = bodyFont;
        r.height = 20;
        if (i % 2 === 0) r.fill = fill(C.grisClaro);
        ws3.getCell(`C${6 + i}`).numFmt    = '$#,##0';
        ws3.getCell(`C${6 + i}`).alignment = rightAlign;
        ws3.getCell(`B${6 + i}`).alignment = rightAlign;
        ws3.getCell(`D${6 + i}`).alignment = rightAlign;
    });

    ws3.getColumn('A').width = 22;
    ws3.getColumn('B').width = 20;
    ws3.getColumn('C').width = 20;
    ws3.getColumn('D').width = 14;

    // ════════════════════════════════════════════════════════════════
    // HOJA 4 — Ventas por Vendedor
    // ════════════════════════════════════════════════════════════════
    const ws4 = wb.addWorksheet('Por Vendedor');
    ws4.properties.defaultRowHeight = 18;
    addSheetHeader(ws4, 'Ventas por Vendedor');

    ws4.getRow(5).values = ['Vendedor', 'N° Ventas', 'Total ($)', '% del Total', 'Ticket Promedio ($)'];
    ws4.getRow(5).font   = headerFont;
    ws4.getRow(5).fill   = fill(C.verde);
    ws4.getRow(5).height = 22;

    const bySeller = {};
    activeSales.forEach(s => {
        const key = s.seller_name || 'Sin asignar';
        if (!bySeller[key]) bySeller[key] = { count: 0, total: 0 };
        bySeller[key].count++;
        bySeller[key].total += s.total || 0;
    });

    const sellerRows = Object.entries(bySeller)
        .sort((a, b) => b[1].total - a[1].total);

    sellerRows.forEach(([seller, data], i) => {
        const avg = data.count > 0 ? data.total / data.count : 0;
        const r = ws4.getRow(6 + i);
        r.values = [
            seller,
            data.count,
            data.total,
            pct(data.total, totalRevenue),
            avg,
        ];
        r.font   = bodyFont;
        r.height = 20;
        if (i % 2 === 0) r.fill = fill(C.grisClaro);
        ['C', 'E'].forEach(col => {
            ws4.getCell(`${col}${6 + i}`).numFmt    = '$#,##0';
            ws4.getCell(`${col}${6 + i}`).alignment = rightAlign;
        });
        ws4.getCell(`B${6 + i}`).alignment = rightAlign;
        ws4.getCell(`D${6 + i}`).alignment = rightAlign;
    });

    ws4.getColumn('A').width = 28;
    ws4.getColumn('B').width = 12;
    ws4.getColumn('C').width = 20;
    ws4.getColumn('D').width = 14;
    ws4.getColumn('E').width = 20;

    // ════════════════════════════════════════════════════════════════
    // HOJA 5 — Ventas Canceladas
    // ════════════════════════════════════════════════════════════════
    const ws5 = wb.addWorksheet('Canceladas');
    ws5.properties.defaultRowHeight = 18;
    addSheetHeader(ws5, 'Ventas Canceladas en el Período');

    ws5.getRow(5).values = ['N° Venta', 'Fecha', 'Vendedor', 'Total ($)', 'Motivo de Cancelación'];
    ws5.getRow(5).font   = headerFont;
    ws5.getRow(5).fill   = fill(C.rojo);
    ws5.getRow(5).height = 22;

    if (cancelledSales.length === 0) {
        ws5.getCell('A6').value = '✅ No hubo ventas canceladas en el período';
        ws5.getCell('A6').font  = { name: 'Arial', size: 10, color: { argb: '166534' } };
    } else {
        cancelledSales.forEach((s, i) => {
            const r = ws5.getRow(6 + i);
            r.values = [
                s.sale_number,
                fmtDate(s.created_at),
                s.seller_name || '-',
                s.total || 0,
                s.cancellation_reason || '-',
            ];
            r.font   = bodyFont;
            r.height = 18;
            if (i % 2 === 0) r.fill = fill(C.grisClaro);
            ws5.getCell(`D${6 + i}`).numFmt    = '$#,##0';
            ws5.getCell(`D${6 + i}`).alignment = rightAlign;
        });
    }

    ws5.getColumn('A').width = 14;
    ws5.getColumn('B').width = 18;
    ws5.getColumn('C').width = 24;
    ws5.getColumn('D').width = 16;
    ws5.getColumn('E').width = 50;

    // ── Guardar ───────────────────────────────────────────────────────────────
    const buffer   = await wb.xlsx.writeBuffer();
    const filename = `Historial_Ventas_${dateFrom}_${dateTo}.xlsx`;

    try {
        return await window.electronAPI.files.save(buffer, filename);
    } catch {
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
    }
};

// ─── EXPORTAR A PDF ────────────────────────────────────────────────────────
/**
 * Mismo estilo que reportExport: documento monocromático tipo Word,
 * márgenes 25mm, header en primera página, header reducido en siguientes,
 * pie de página con numeración, tablas con jspdf-autotable.
 */
export const exportSalesHistoryToPDF = async ({
    dateFrom,
    dateTo,
    sales = [],
    stats = {},
    businessName  = 'Mi Negocio',
    searchTerm    = '',
    paymentFilter = '',
    sellerFilter  = '',
}) => {
    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    // ── Márgenes ──────────────────────────────────────────────────────────────
    const ML = 25;
    const MR = 25;
    const W  = doc.internal.pageSize.getWidth();
    const TW = W - ML - MR;

    let y = 0;

    // ── Paleta monocromática (idéntica a reportExport) ────────────────────────
    const NEGRO    = [0,   0,   0  ];
    const GRIS_OSC = [80,  80,  80 ];
    const GRIS_MED = [130, 130, 130];
    const GRIS_SUP = [220, 220, 220];
    const GRIS_FIL = [245, 245, 245];

    // ── Datos calculados ──────────────────────────────────────────────────────
    const activeSales    = sales.filter(s => !s.is_cancelled);
    const cancelledSales = sales.filter(s =>  s.is_cancelled);
    const totalRevenue   = activeSales.reduce((a, s) => a + (s.total || 0), 0);
    const avgTicket      = activeSales.length > 0 ? totalRevenue / activeSales.length : 0;

    const rangeLabel = `${fmtDateLabel(dateFrom)} al ${fmtDateLabel(dateTo)}`;
    const filterDesc = [
        searchTerm    ? `Búsqueda: "${searchTerm}"` : '',
        paymentFilter && paymentFilter !== 'all'
            ? `Pago: ${PAYMENT_LABELS[paymentFilter] || paymentFilter}` : '',
        sellerFilter  && sellerFilter  !== 'all'
            ? `Vendedor: ${sellerFilter}` : '',
    ].filter(Boolean).join('  |  ');

    // ── Encabezado primera página ─────────────────────────────────────────────
    // Fecha de hoy en formato DD-MM-YYYY
    const today = new Date();
    const todayLabel = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

    const addHeader = (isFirstPage = false) => {
        if (isFirstPage) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...NEGRO);
            doc.text('Historial de Ventas', ML, 22);

            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.4);
            doc.line(ML, 25, W - MR, 25);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...GRIS_OSC);
            doc.text(businessName, ML, 31);

            // Línea 1: período y fecha de descarga
            const line1 = `Período: ${rangeLabel}  |  Descargado: ${todayLabel}`;
            doc.text(line1, ML, 36);

            // Línea 2 (solo si hay filtros activos): mostrar todos los filtros
            if (filterDesc) {
                doc.setTextColor(...GRIS_MED);
                doc.text(`Filtros: ${filterDesc}`, ML, 41);
                doc.setTextColor(...GRIS_OSC);

                doc.setDrawColor(...GRIS_SUP);
                doc.line(ML, 44, W - MR, 44);
                y = 51;
            } else {
                doc.setDrawColor(...GRIS_SUP);
                doc.line(ML, 39, W - MR, 39);
                y = 46;
            }
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            // Encabezado reducido: siempre período, filtros en segunda línea si los hay
            doc.text(`Historial de Ventas — ${businessName} — ${rangeLabel}`, ML, 10);
            if (filterDesc) {
                doc.text(`Filtros: ${filterDesc}`, ML, 14);
                doc.setDrawColor(...GRIS_SUP);
                doc.setLineWidth(0.3);
                doc.line(ML, 16, W - MR, 16);
                y = 22;
            } else {
                doc.setDrawColor(...GRIS_SUP);
                doc.setLineWidth(0.3);
                doc.line(ML, 12, W - MR, 12);
                y = 18;
            }
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
            doc.text(`Página ${i} de ${pageCount}`, W / 2, 277, { align: 'center' });
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

    // ── Config base de tablas (idéntica a reportExport) ───────────────────────
    const tbl = (extra = {}) => ({
        styles: {
            font:        'helvetica',
            fontSize:    7.5,
            cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
            textColor:   NEGRO,
            lineColor:   GRIS_SUP,
            lineWidth:   0.2,
            halign:      'right', // ← todas las celdas alineadas a la derecha por defecto
        },
        headStyles: {
            fillColor:   [50, 50, 50],
            textColor:   [255, 255, 255],
            fontStyle:   'bold',
            fontSize:    7.5,
            halign:      'right',
            cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        alternateRowStyles: { fillColor: GRIS_FIL },
        bodyStyles:   { fillColor: [255, 255, 255] },
        margin:       { left: ML, right: MR },
        tableWidth:   TW,
        rowPageBreak: 'avoid',
        didDrawPage:  () => { addHeader(false); },
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
        head: [['Indicador', 'Valor', 'Detalle']],
        body: [
            ['Total Ventas',      fmtN(activeSales.length),   `${fmtN(sales.length)} registros en el período`],
            ['Ingresos Totales',  fmtCLP(totalRevenue),       'No incluye ventas canceladas'],
            ['Ticket Promedio',   fmtCLP(avgTicket),          'Promedio por transacción'],
            ['Ventas Canceladas', fmtN(cancelledSales.length),`${pct(cancelledSales.length, sales.length)} del total`],
        ],
        ...tbl({
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 52 },
                1: { cellWidth: 38 },
                2: {},
            },
        }),
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 2. Listado de ventas ──────────────────────────────────────────────────
    sectionTitle('Listado de Ventas');
    doc.autoTable({
        startY: y,
        head: [['N° Venta', 'Fecha', 'Cliente', 'Vendedor', 'Pago', 'Total', 'Estado']],
        showHead: 'everyPage',
        body: sales.map(s => [
            s.sale_number,
            fmtDate(s.created_at),
            s.customer_name || '-',
            s.seller_name   || '-',
            PAYMENT_LABELS[s.payment_method] || s.payment_method || '-',
            fmtCLP(s.total),
            s.is_cancelled ? 'Cancelada' : 'Activa',
        ]),
        foot: [[
            'TOTAL', '', '', '', '',
            fmtCLP(totalRevenue),
            `${activeSales.length} / ${sales.length}`,
        ]],
        ...tbl({
            footStyles: {
                fillColor: [230, 230, 230],
                textColor:  NEGRO,
                fontStyle:  'bold',
                fontSize:   8,
            },
            columnStyles: {
                0: { cellWidth: 22 },  // N° Venta
                1: { cellWidth: 26 },  // Fecha
                2: { cellWidth: 28 },  // Cliente
                3: { cellWidth: 28 },  // Vendedor
                4: { cellWidth: 20 },  // Pago
                5: { cellWidth: 24 },  // Total
                6: { cellWidth: 18 },  // Estado
            },
            // Colorear fila si cancelada
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const rowSale = sales[data.row.index];
                    if (rowSale?.is_cancelled) {
                        data.cell.styles.textColor = [180, 0, 0];
                    }
                }
            },
        }),
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 3. Ventas por método de pago ──────────────────────────────────────────
    sectionTitle('Ventas por Método de Pago');
    const byPayment = {};
    activeSales.forEach(s => {
        const key = s.payment_method || 'sin_metodo';
        if (!byPayment[key]) byPayment[key] = { count: 0, total: 0 };
        byPayment[key].count++;
        byPayment[key].total += s.total || 0;
    });
    const paymentRows = Object.entries(byPayment).sort((a, b) => b[1].total - a[1].total);

    doc.autoTable({
        startY: y,
        head: [['Método de Pago', 'N° Transacciones', 'Total', '% del Total']],
        body: paymentRows.map(([method, data]) => [
            PAYMENT_LABELS[method] || method,
            fmtN(data.count),
            fmtCLP(data.total),
            pct(data.total, totalRevenue),
        ]),
        ...tbl({
            columnStyles: {
                0: { cellWidth: 48 },
                1: {},
                2: {},
                3: {},
            },
        }),
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 4. Ventas por vendedor ────────────────────────────────────────────────
    sectionTitle('Ventas por Vendedor');
    const bySeller = {};
    activeSales.forEach(s => {
        const key = s.seller_name || 'Sin asignar';
        if (!bySeller[key]) bySeller[key] = { count: 0, total: 0 };
        bySeller[key].count++;
        bySeller[key].total += s.total || 0;
    });
    const sellerRows = Object.entries(bySeller).sort((a, b) => b[1].total - a[1].total);

    doc.autoTable({
        startY: y,
        head: [['Vendedor', 'N° Ventas', 'Total', '% del Total', 'Ticket Prom.']],
        body: sellerRows.map(([seller, data]) => [
            seller,
            fmtN(data.count),
            fmtCLP(data.total),
            pct(data.total, totalRevenue),
            fmtCLP(data.count > 0 ? data.total / data.count : 0),
        ]),
        ...tbl({
            columnStyles: {
                0: { cellWidth: 55 },
                1: {},
                2: {},
                3: {},
                4: {},
            },
        }),
    });
    y = doc.lastAutoTable.finalY + 6;

    // ── 5. Ventas canceladas ──────────────────────────────────────────────────
    sectionTitle('Ventas Canceladas');
    if (cancelledSales.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...GRIS_OSC);
        doc.text('No hubo ventas canceladas en el período seleccionado.', ML, y);
        y += 8;
    } else {
        doc.autoTable({
            startY: y,
            head: [['N° Venta', 'Fecha', 'Vendedor', 'Total', 'Motivo de Cancelación']],
            body: cancelledSales.map(s => [
                s.sale_number,
                fmtDate(s.created_at),
                s.seller_name || '-',
                fmtCLP(s.total),
                s.cancellation_reason || '-',
            ]),
            ...tbl({
                columnStyles: {
                    0: { cellWidth: 22 },
                    1: { cellWidth: 26 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 24 },
                    4: {},
                },
            }),
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // ── Pie de página en todas las páginas ────────────────────────────────────
    addFooters();

    // ── Guardar ───────────────────────────────────────────────────────────────
    doc.save(`Historial_Ventas_${dateFrom}_${dateTo}.pdf`);
    return { success: true };
};