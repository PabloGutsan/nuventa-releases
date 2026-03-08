/**
 * purchaseHistoryExport.js
 * Exportación del historial de compras a Excel y PDF
 * Ubicación: src/services/export/purchaseHistoryExport.js
 * Mismo patrón que inventoryExport.js
 */

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = String(d).split('T')[0].split('-');
    return `${day}/${m}/${y}`;
};

const DOC_LABELS = {
    factura:       'Factura',
    boleta:        'Boleta',
    nota_debito:   'Nota de Débito',
    sin_documento: 'Sin Documento',
};

const PAY_LABELS = {
    pagado:    'Pagado',
    pendiente: 'Pendiente',
    parcial:   'Parcial',
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEL
// ═══════════════════════════════════════════════════════════════════════════════
export const exportPurchaseHistoryToExcel = async ({
    purchases    = [],
    filters      = {},
    businessName = 'Mi Negocio',
}) => {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = businessName;
    wb.created = new Date();

    const dateStr = new Date().toLocaleDateString('es-CL');

    // ── Paleta — idéntica a inventoryExport ──────────────────────────────────
    const C = {
        azul:      '2563EB',
        verde:     '10B981',
        rojo:      'EF4444',
        morado:    '7C3AED',
        amarillo:  'F59E0B',
        grisOsc:   '374151',
        grisMed:   '6B7280',
        grisClaro: 'F3F4F6',
        blanco:    'FFFFFF',
        footerBg:  'FEF9C3',
        paidBg:    'D1FAE5',
        pendBg:    'FEF3C7',
        partBg:    'DBEAFE',
    };

    const headerFont   = { name: 'Arial', bold: true, color: { argb: C.blanco }, size: 10 };
    const titleFont    = { name: 'Arial', bold: true, size: 14, color: { argb: C.azul } };
    const subTitleFont = { name: 'Arial', bold: true, size: 11, color: { argb: C.grisOsc } };
    const bodyFont     = { name: 'Arial', size: 10 };
    const centerAlign  = { horizontal: 'center', vertical: 'middle' };
    const leftAlign    = { horizontal: 'left',   vertical: 'middle' };
    const rightAlign   = { horizontal: 'right',  vertical: 'middle' };
    const fill = (color) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });

    // ── Encabezado de hoja — mismo patrón que inventoryExport ───────────────
    const addSheetHeader = (ws, title, cols = 'K') => {
        ws.mergeCells(`A1:${cols}1`);
        ws.getCell('A1').value     = businessName;
        ws.getCell('A1').font      = titleFont;
        ws.getCell('A1').alignment = leftAlign;

        ws.mergeCells(`A2:${cols}2`);
        ws.getCell('A2').value     = title;
        ws.getCell('A2').font      = subTitleFont;
        ws.getCell('A2').alignment = leftAlign;

        const parts = [`Generado el ${dateStr}`];
        if (filters.dateFrom) parts.push(`Desde: ${fmtDate(filters.dateFrom)}`);
        if (filters.dateTo)   parts.push(`Hasta: ${fmtDate(filters.dateTo)}`);
        if (filters.supplier) parts.push(`Proveedor: ${filters.supplier}`);
        if (filters.payStatus) parts.push(`Estado: ${PAY_LABELS[filters.payStatus] || filters.payStatus}`);
        if (filters.docType)   parts.push(`Documento: ${DOC_LABELS[filters.docType] || filters.docType}`);

        ws.mergeCells(`A3:${cols}3`);
        ws.getCell('A3').value     = parts.join(' | ');
        ws.getCell('A3').font      = { name: 'Arial', size: 9, color: { argb: C.grisMed } };
        ws.getCell('A3').alignment = leftAlign;
        ws.getRow(4).height = 6;
    };

    // ── Cálculos globales ────────────────────────────────────────────────────
    const totalMonto     = purchases.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
    const totalIVA       = purchases.reduce((s, p) => s + (parseFloat(p.tax)   || 0), 0);
    const totalPending   = purchases.reduce((s, p) =>
        p.payment_status !== 'pagado'
            ? s + Math.max(0, (parseFloat(p.total) || 0) - (parseFloat(p.paid_amount) || 0))
            : s, 0);
    const ivaRecuperable = purchases.reduce((s, p) =>
        p.has_recoverable_tax ? s + (parseFloat(p.tax) || 0) : s, 0);
    const pendientes_    = purchases.filter(p => p.payment_status !== 'pagado');

    // ════════════════════════════════════════════════════════════════
    // HOJA 1 — Resumen (igual que inventoryExport → Hoja Resumen)
    // ════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Resumen');
    ws1.properties.defaultRowHeight = 18;
    addSheetHeader(ws1, 'Resumen del Historial de Compras', 'B');

    ws1.getRow(5).values = ['Indicador', 'Valor'];
    ws1.getRow(5).font   = headerFont;
    ws1.getRow(5).fill   = fill(C.azul);
    ws1.getRow(5).height = 22;
    ['A5','B5'].forEach(c => { ws1.getCell(c).alignment = centerAlign; });

    const resumen = [
        ['Total de compras',         purchases.length],
        ['Monto total comprado',     fmtCLP(totalMonto)],
        ['Total IVA',                fmtCLP(totalIVA)],
        ['IVA recuperable (SII)',    fmtCLP(ivaRecuperable)],
        ['Saldo pendiente de pago',  fmtCLP(totalPending)],
        ['Compras pagadas',          purchases.filter(p => p.payment_status === 'pagado').length],
        ['Compras pendientes',       purchases.filter(p => p.payment_status === 'pendiente').length],
        ['Compras con pago parcial', purchases.filter(p => p.payment_status === 'parcial').length],
    ];

    resumen.forEach(([label, val], i) => {
        const r = ws1.getRow(6 + i);
        r.values = [label, val];
        r.font   = bodyFont;
        r.height = 20;
        r.getCell(1).font = { name: 'Arial', bold: true, size: 10 };
        if (i % 2 === 0) r.fill = fill(C.grisClaro);
    });

    ws1.getColumn('A').width = 36;
    ws1.getColumn('B').width = 24;

    // ════════════════════════════════════════════════════════════════
    // HOJA 2 — Detalle compras (igual que inventoryExport → Hoja Productos)
    // ════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Compras');
    ws2.properties.defaultRowHeight = 18;
    addSheetHeader(ws2, 'Detalle de Compras');

    const headers2 = ['N° Compra','Fecha','Proveedor','Documento','N° Doc.','Subtotal','IVA','Descuento','Total','Pagado','Estado'];
    ws2.getRow(5).values = headers2;
    ws2.getRow(5).font   = headerFont;
    ws2.getRow(5).fill   = fill(C.azul);
    ws2.getRow(5).height = 22;
    headers2.forEach((_, i) => ws2.getRow(5).getCell(i + 1).alignment = centerAlign);

    purchases.forEach((p, i) => {
        const r = ws2.getRow(6 + i);
        r.values = [
            p.purchase_number,
            fmtDate(p.invoice_date),
            p.supplier_name || '—',
            DOC_LABELS[p.document_type] || p.document_type || '—',
            p.invoice_number || '—',
            parseFloat(p.subtotal)    || 0,
            parseFloat(p.tax)         || 0,
            parseFloat(p.discount)    || 0,
            parseFloat(p.total)       || 0,
            parseFloat(p.paid_amount) || 0,
            PAY_LABELS[p.payment_status] || p.payment_status || '—',
        ];
        r.font   = bodyFont;
        r.height = 18;

        const bgMap = { pagado: C.paidBg, pendiente: C.pendBg, parcial: C.partBg };
        const bg    = bgMap[p.payment_status];
        r.fill = bg ? fill(bg) : (i % 2 === 0 ? fill(C.grisClaro) : fill(C.blanco));

        [6,7,8,9,10].forEach(col => {
            ws2.getRow(6+i).getCell(col).numFmt    = '$#,##0';
            ws2.getRow(6+i).getCell(col).alignment = rightAlign;
        });
        ws2.getRow(6+i).getCell(11).alignment = centerAlign;
    });

    // Fila totales — igual que inventoryExport
    if (purchases.length > 0) {
        const ft = ws2.getRow(6 + purchases.length + 1);
        ft.values = [
            '', 'TOTALES', '', '', '',
            purchases.reduce((s,p) => s + (parseFloat(p.subtotal)||0), 0),
            purchases.reduce((s,p) => s + (parseFloat(p.tax)||0),      0),
            purchases.reduce((s,p) => s + (parseFloat(p.discount)||0), 0),
            totalMonto,
            purchases.reduce((s,p) => s + (parseFloat(p.paid_amount)||0), 0),
            '',
        ];
        ft.font   = { name: 'Arial', bold: true, size: 10 };
        ft.fill   = fill(C.footerBg);
        ft.height = 22;
        [6,7,8,9,10].forEach(col => {
            ws2.getRow(ft.number).getCell(col).numFmt    = '$#,##0';
            ws2.getRow(ft.number).getCell(col).alignment = rightAlign;
        });
    }

    ws2.getColumn(1).width  = 18;
    ws2.getColumn(2).width  = 14;
    ws2.getColumn(3).width  = 30;
    ws2.getColumn(4).width  = 18;
    ws2.getColumn(5).width  = 16;
    ws2.getColumn(6).width  = 16;
    ws2.getColumn(7).width  = 14;
    ws2.getColumn(8).width  = 14;
    ws2.getColumn(9).width  = 16;
    ws2.getColumn(10).width = 16;
    ws2.getColumn(11).width = 14;

    // ════════════════════════════════════════════════════════════════
    // HOJA 3 — Pendientes (igual que inventoryExport → Hoja Alertas de Stock)
    // ════════════════════════════════════════════════════════════════
    if (pendientes_.length > 0) {
        const ws3 = wb.addWorksheet('Pendientes');
        ws3.properties.defaultRowHeight = 18;
        addSheetHeader(ws3, 'Compras con Saldo Pendiente', 'H');

        const headers3 = ['N° Compra','Fecha','Vencimiento','Proveedor','Total','Pagado','Saldo','Estado'];
        ws3.getRow(5).values = headers3;
        ws3.getRow(5).font   = headerFont;
        ws3.getRow(5).fill   = fill(C.amarillo);
        ws3.getRow(5).height = 22;
        headers3.forEach((_, i) => ws3.getRow(5).getCell(i + 1).alignment = centerAlign);

        pendientes_.forEach((p, i) => {
            const saldo = Math.max(0, (parseFloat(p.total)||0) - (parseFloat(p.paid_amount)||0));
            const r = ws3.getRow(6 + i);
            r.values = [
                p.purchase_number,
                fmtDate(p.invoice_date),
                fmtDate(p.due_date),
                p.supplier_name || '—',
                parseFloat(p.total)       || 0,
                parseFloat(p.paid_amount) || 0,
                saldo,
                PAY_LABELS[p.payment_status] || p.payment_status,
            ];
            r.font   = bodyFont;
            r.height = 18;
            r.fill   = fill(p.payment_status === 'parcial' ? C.partBg : C.pendBg);
            [5,6,7].forEach(col => {
                ws3.getRow(6+i).getCell(col).numFmt    = '$#,##0';
                ws3.getRow(6+i).getCell(col).alignment = rightAlign;
            });
            ws3.getRow(6+i).getCell(8).alignment = centerAlign;
        });

        const ft3 = ws3.getRow(6 + pendientes_.length + 1);
        ft3.values = ['','','','SALDO TOTAL PENDIENTE','','',totalPending,''];
        ft3.font   = { name: 'Arial', bold: true, size: 10 };
        ft3.fill   = fill(C.footerBg);
        ft3.height = 22;
        ws3.getRow(ft3.number).getCell(7).numFmt    = '$#,##0';
        ws3.getRow(ft3.number).getCell(7).alignment = rightAlign;

        ws3.getColumn(1).width = 18;
        ws3.getColumn(2).width = 14;
        ws3.getColumn(3).width = 14;
        ws3.getColumn(4).width = 30;
        ws3.getColumn(5).width = 16;
        ws3.getColumn(6).width = 16;
        ws3.getColumn(7).width = 16;
        ws3.getColumn(8).width = 14;
    }

    // ── Guardar — mismo bloque que inventoryExport ───────────────────────────
    const buffer   = await wb.xlsx.writeBuffer();
    const filename = `Compras_${dateStr.replace(/\//g, '-')}.xlsx`;

    try {
        return await window.electronAPI.files.save(buffer, filename);
    } catch {
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        return { success: true };
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PDF
// ═══════════════════════════════════════════════════════════════════════════════
export const exportPurchaseHistoryToPDF = async ({
    purchases    = [],
    filters      = {},
    businessName = 'Mi Negocio',
}) => {
    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const doc     = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const dateStr = new Date().toLocaleDateString('es-CL');

    const ML = 15;
    const MR = 15;
    const W  = doc.internal.pageSize.getWidth();
    const TW = W - ML - MR;

    // Colores — idénticos a inventoryExport.js
    const NEGRO    = [0,   0,   0  ];
    const GRIS_OSC = [80,  80,  80 ];
    const GRIS_MED = [130, 130, 130];
    const GRIS_SUP = [220, 220, 220];
    const GRIS_FIL = [245, 245, 245];
    const AZUL_H   = [37,  99,  235];

    let y = 0;

    // ── addHeader — mismo patrón exacto que inventoryExport ─────────────────
    const addHeader = (isFirst = false) => {
        if (isFirst) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.setTextColor(...NEGRO);
            doc.text('Historial de Compras', ML, 20);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.4);
            doc.line(ML, 23, W - MR, 23);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...GRIS_OSC);
            doc.text(businessName, ML, 29);

            const parts = [`Generado el ${dateStr}`];
            if (filters.dateFrom) parts.push(`Desde: ${fmtDate(filters.dateFrom)}`);
            if (filters.dateTo)   parts.push(`Hasta: ${fmtDate(filters.dateTo)}`);
            if (filters.supplier) parts.push(`Proveedor: ${filters.supplier}`);
            if (filters.payStatus) parts.push(`Estado: ${PAY_LABELS[filters.payStatus] || filters.payStatus}`);
            doc.text(parts.join('  |  '), ML, 34);
            doc.setDrawColor(...GRIS_SUP);
            doc.line(ML, 37, W - MR, 37);
            y = 44;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            doc.text(`Historial de Compras — ${businessName} — ${dateStr}`, ML, 10);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 12, W - MR, 12);
            y = 18;
        }
    };

    const addFooters = () => {
        const total = doc.internal.getNumberOfPages();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 195, W - MR, 195);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            doc.text(`Página ${i} de ${total}`, W / 2, 200, { align: 'center' });
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

    // tbl() — mismo patrón que inventoryExport, con headStyles azul
    const tbl = (extra = {}) => ({
        styles: {
            font: 'helvetica', fontSize: 7.5,
            cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
            textColor: NEGRO, lineColor: GRIS_SUP, lineWidth: 0.2,
        },
        headStyles: {
            fillColor: AZUL_H, textColor: [255, 255, 255],
            fontStyle: 'bold', fontSize: 7.5,
            cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
        },
        alternateRowStyles: { fillColor: GRIS_FIL },
        bodyStyles: { fillColor: [255, 255, 255] },
        margin: { left: ML, right: MR },
        tableWidth: TW,
        rowPageBreak: 'avoid',
        didDrawPage: () => { addHeader(false); },
        ...extra,
    });

    // ── Cálculos ─────────────────────────────────────────────────────────────
    const totalMonto   = purchases.reduce((s, p) => s + (parseFloat(p.total)||0), 0);
    const totalIVA     = purchases.reduce((s, p) => s + (parseFloat(p.tax)||0),   0);
    const totalPending = purchases.reduce((s, p) =>
        p.payment_status !== 'pagado'
            ? s + Math.max(0, (parseFloat(p.total)||0) - (parseFloat(p.paid_amount)||0))
            : s, 0);
    const ivaRec   = purchases.reduce((s, p) => p.has_recoverable_tax ? s + (parseFloat(p.tax)||0) : s, 0);
    const pends_   = purchases.filter(p => p.payment_status !== 'pagado');

    addHeader(true);

    // 1. Resumen
    sectionTitle('Resumen del Período');
    doc.autoTable({
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
            ['Total de compras',        String(purchases.length)],
            ['Monto total comprado',    fmtCLP(totalMonto)],
            ['Total IVA',               fmtCLP(totalIVA)],
            ['IVA recuperable (SII)',   fmtCLP(ivaRec)],
            ['Saldo pendiente de pago', fmtCLP(totalPending)],
        ],
        ...tbl({ columnStyles: { 0: { cellWidth: 70, fontStyle: 'bold' }, 1: { cellWidth: 50, halign: 'right' } } })
    });
    y = doc.lastAutoTable.finalY + 6;

    // 2. Listado compras
    sectionTitle('Listado de Compras');
    if (purchases.length === 0) {
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIS_OSC);
        doc.text('No hay compras registradas para el período seleccionado.', ML, y);
        y += 8;
    } else {
        const statusColors = { pagado:[209,250,229], pendiente:[254,243,199], parcial:[219,234,254] };
        doc.autoTable({
            startY: y,
            head: [['N° Compra','Fecha','Proveedor','Documento','Subtotal','IVA','Total','Estado']],
            body: purchases.map(p => [
                p.purchase_number,
                fmtDate(p.invoice_date),
                p.supplier_name || '—',
                DOC_LABELS[p.document_type] || p.document_type || '—',
                fmtCLP(p.subtotal),
                parseFloat(p.tax) > 0 ? fmtCLP(p.tax) : '—',
                fmtCLP(p.total),
                PAY_LABELS[p.payment_status] || p.payment_status || '—',
            ]),
            ...tbl({
                didBodyCell: (data) => {
                    const p = purchases[data.row.index];
                    if (p && statusColors[p.payment_status])
                        data.cell.styles.fillColor = statusColors[p.payment_status];
                },
                columnStyles: {
                    0: { cellWidth: 28, fontStyle: 'bold' },
                    1: { cellWidth: 20 },
                    2: { cellWidth: 52 },
                    3: { cellWidth: 24 },
                    4: { cellWidth: 26, halign: 'right' },
                    5: { cellWidth: 22, halign: 'right' },
                    6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
                    7: { cellWidth: 20, halign: 'center' },
                },
                foot: [['TOTALES','','','', fmtCLP(purchases.reduce((s,p)=>s+(parseFloat(p.subtotal)||0),0)), fmtCLP(totalIVA), fmtCLP(totalMonto),'']],
                footStyles: { fillColor: [254,249,195], fontStyle:'bold', fontSize:7.5, textColor: NEGRO },
            })
        });
        y = doc.lastAutoTable.finalY + 6;
    }

    // 3. Pendientes
    if (pends_.length > 0) {
        sectionTitle('Compras con Saldo Pendiente');
        doc.autoTable({
            startY: y,
            head: [['N° Compra','Fecha','Vencimiento','Proveedor','Total','Pagado','Saldo','Estado']],
            body: pends_.map(p => {
                const saldo = Math.max(0, (parseFloat(p.total)||0) - (parseFloat(p.paid_amount)||0));
                return [
                    p.purchase_number, fmtDate(p.invoice_date), fmtDate(p.due_date),
                    p.supplier_name || '—', fmtCLP(p.total), fmtCLP(p.paid_amount),
                    fmtCLP(saldo), PAY_LABELS[p.payment_status] || p.payment_status,
                ];
            }),
            ...tbl({
                headStyles: { fillColor: [217,119,6], textColor:[255,255,255], fontStyle:'bold', fontSize:7.5 },
                columnStyles: {
                    0: { cellWidth: 28, fontStyle: 'bold' }, 1: { cellWidth: 20 },
                    2: { cellWidth: 20 }, 3: { cellWidth: 52 },
                    4: { cellWidth: 24, halign: 'right' }, 5: { cellWidth: 24, halign: 'right' },
                    6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
                    7: { cellWidth: 20, halign: 'center' },
                },
                foot: [['','','','SALDO TOTAL PENDIENTE','','',fmtCLP(totalPending),'']],
                footStyles: { fillColor: [254,249,195], fontStyle:'bold', fontSize:7.5, textColor: NEGRO },
            })
        });
    }

    addFooters();
    doc.save(`Compras_${dateStr.replace(/\//g, '-')}.pdf`);
    return { success: true };
};