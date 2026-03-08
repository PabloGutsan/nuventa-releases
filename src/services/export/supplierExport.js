/**
 * supplierExport.js
 * Exportación de lista de proveedores a Excel y PDF
 * Ubicación: src/services/export/supplierExport.js
 */

const fmtCLP = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtN = (n) =>
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n || 0);

// ── EXPORTAR A EXCEL ──────────────────────────────────────────────────────────
export const exportSuppliersToExcel = async ({ suppliers, businessName = 'Mi Negocio' }) => {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = businessName;
    wb.created = new Date();

    const today = new Date().toLocaleDateString('es-CL');

    const C = {
        azul:      '2563EB',
        verde:     '10B981',
        grisOsc:   '374151',
        grisMed:   '6B7280',
        grisClaro: 'F3F4F6',
        blanco:    'FFFFFF',
        amarillo:  'FEF9C3',
        rojo:      'EF4444',
    };

    const headerFont  = { name: 'Arial', bold: true, color: { argb: C.blanco }, size: 10 };
    const titleFont   = { name: 'Arial', bold: true, size: 14, color: { argb: C.azul } };
    const bodyFont    = { name: 'Arial', size: 9 };
    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const leftAlign   = { horizontal: 'left',   vertical: 'middle' };
    const rightAlign  = { horizontal: 'right',  vertical: 'middle' };
    const fill        = (color) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: color } });

    // ════════════════════════════════════════════
    // HOJA 1: Lista completa de proveedores
    // ════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Proveedores');
    ws1.properties.defaultRowHeight = 18;

    ws1.mergeCells('A1:J1');
    ws1.getCell('A1').value     = businessName;
    ws1.getCell('A1').font      = titleFont;
    ws1.getCell('A1').alignment = leftAlign;

    ws1.mergeCells('A2:J2');
    ws1.getCell('A2').value = 'Base de Datos de Proveedores';
    ws1.getCell('A2').font  = { name: 'Arial', bold: true, size: 11, color: { argb: C.grisOsc } };

    ws1.mergeCells('A3:J3');
    ws1.getCell('A3').value = `Exportado el ${today}  |  ${suppliers.length} proveedores`;
    ws1.getCell('A3').font  = { name: 'Arial', size: 9, color: { argb: C.grisMed } };

    ws1.getRow(4).height = 6;

    const headers = ['#', 'Razón Social', 'RUT', 'Contacto', 'Teléfono', 'Email', 'Ciudad', 'Productos', 'Compras', 'Estado'];
    ws1.getRow(5).values = headers;
    ws1.getRow(5).font   = headerFont;
    ws1.getRow(5).fill   = fill(C.azul);
    ws1.getRow(5).height = 22;
    headers.forEach((_, i) => {
        ws1.getCell(`${String.fromCharCode(65 + i)}5`).alignment = centerAlign;
    });

    suppliers.forEach((s, i) => {
        const r = ws1.getRow(6 + i);
        r.values = [
            i + 1,
            s.business_name,
            s.rut || '-',
            s.contact_name || '-',
            s.phone || '-',
            s.email || '-',
            s.city || '-',
            parseInt(s.products_count) || 0,
            parseInt(s.purchases_count) || 0,
            s.is_active ? 'Activo' : 'Inactivo',
        ];
        r.font   = bodyFont;
        r.height = 18;
        if (i % 2 === 0) r.fill = fill(C.grisClaro);

        ws1.getCell(`A${6+i}`).alignment = centerAlign;
        ws1.getCell(`H${6+i}`).alignment = centerAlign;
        ws1.getCell(`I${6+i}`).alignment = centerAlign;
        ws1.getCell(`J${6+i}`).alignment = centerAlign;

        // Color estado
        if (!s.is_active) {
            ws1.getCell(`J${6+i}`).font = { name: 'Arial', size: 9, color: { argb: C.rojo } };
        } else {
            ws1.getCell(`J${6+i}`).font = { name: 'Arial', size: 9, color: { argb: C.verde } };
        }
    });

    // Fila de totales
    const lastRow = ws1.getRow(6 + suppliers.length + 1);
    const totalProductos = suppliers.reduce((a, s) => a + (parseInt(s.products_count) || 0), 0);
    const totalCompras   = suppliers.reduce((a, s) => a + (parseInt(s.purchases_count) || 0), 0);
    lastRow.values = ['', 'TOTAL', '', '', '', '', '', totalProductos, totalCompras, ''];
    lastRow.font   = { name: 'Arial', bold: true, size: 10 };
    lastRow.fill   = fill(C.amarillo);
    lastRow.height = 22;
    ws1.getCell(`H${lastRow.number}`).alignment = centerAlign;
    ws1.getCell(`I${lastRow.number}`).alignment = centerAlign;

    ws1.getColumn('A').width = 5;
    ws1.getColumn('B').width = 32;
    ws1.getColumn('C').width = 14;
    ws1.getColumn('D').width = 22;
    ws1.getColumn('E').width = 16;
    ws1.getColumn('F').width = 30;
    ws1.getColumn('G').width = 16;
    ws1.getColumn('H').width = 11;
    ws1.getColumn('I').width = 11;
    ws1.getColumn('J').width = 12;

    // ════════════════════════════════════════════
    // HOJA 2: Resumen
    // ════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Resumen');
    ws2.properties.defaultRowHeight = 18;

    ws2.mergeCells('A1:D1');
    ws2.getCell('A1').value     = businessName;
    ws2.getCell('A1').font      = titleFont;
    ws2.getCell('A1').alignment = leftAlign;

    ws2.mergeCells('A2:D2');
    ws2.getCell('A2').value = 'Resumen de Proveedores';
    ws2.getCell('A2').font  = { name: 'Arial', bold: true, size: 11, color: { argb: C.grisOsc } };

    ws2.getRow(3).height = 6;

    const activos   = suppliers.filter(s => s.is_active === 1).length;
    const inactivos = suppliers.filter(s => s.is_active !== 1).length;
    const conProds  = suppliers.filter(s => (parseInt(s.products_count) || 0) > 0).length;

    ws2.getRow(4).values = ['Indicador', 'Valor'];
    ws2.getRow(4).font   = headerFont;
    ws2.getRow(4).fill   = fill(C.azul);
    ws2.getRow(4).height = 22;

    const resumen = [
        ['Total Proveedores',            suppliers.length],
        ['Proveedores Activos',          activos],
        ['Proveedores Inactivos',        inactivos],
        ['Con productos asociados',      conProds],
        ['Total Productos Registrados',  totalProductos],
        ['Total Compras Realizadas',     totalCompras],
    ];

    resumen.forEach(([label, value], i) => {
        const r = ws2.getRow(5 + i);
        r.values = [label, value];
        r.font   = bodyFont;
        r.height = 20;
        r.getCell(1).font = { name: 'Arial', bold: true, size: 9 };
        if (i % 2 === 0) r.fill = fill(C.grisClaro);
    });

    ws2.getColumn('A').width = 30;
    ws2.getColumn('B').width = 20;

    // ── Guardar ──
    const buffer   = await wb.xlsx.writeBuffer();
    const filename = `Proveedores_${today.replace(/\//g, '-')}.xlsx`;

    try {
        return await window.electronAPI.files.save(buffer, filename);
    } catch {
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        return { success: true };
    }
};

// ── EXPORTAR A PDF ────────────────────────────────────────────────────────────
export const exportSuppliersToPDF = async ({ suppliers, businessName = 'Mi Negocio' }) => {
    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const today = new Date().toLocaleDateString('es-CL');

    const W  = doc.internal.pageSize.getWidth();
    const ML = 15;
    const MR = 15;
    const TW = W - ML - MR;

    const NEGRO    = [0,   0,   0  ];
    const GRIS_OSC = [80,  80,  80 ];
    const GRIS_MED = [130, 130, 130];
    const GRIS_SUP = [220, 220, 220];
    const GRIS_FIL = [245, 245, 245];

    let y = 0;

    const addHeader = (isFirst = false) => {
        if (isFirst) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.setTextColor(...NEGRO);
            doc.text('Base de Datos de Proveedores', ML, 20);

            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.4);
            doc.line(ML, 23, W - MR, 23);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...GRIS_OSC);
            doc.text(`${businessName}  |  Exportado: ${today}  |  ${suppliers.length} proveedores`, ML, 29);
            doc.setDrawColor(...GRIS_SUP);
            doc.line(ML, 32, W - MR, 32);
            y = 38;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(...GRIS_MED);
            doc.text(`Proveedores — ${businessName} — ${today}`, ML, 10);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 12, W - MR, 12);
            y = 17;
        }
    };

    const addFooters = () => {
        const pages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pages; i++) {
            doc.setPage(i);
            doc.setDrawColor(...GRIS_SUP);
            doc.setLineWidth(0.3);
            doc.line(ML, 198, W - MR, 198);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...GRIS_MED);
            doc.text(`Página ${i} de ${pages}`, W / 2, 202, { align: 'center' });
        }
    };

    const tblOpts = (extra = {}) => ({
        styles: {
            font: 'helvetica', fontSize: 7,
            cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
            textColor: NEGRO, lineColor: GRIS_SUP, lineWidth: 0.2,
        },
        headStyles: {
            fillColor: [50, 50, 50], textColor: [255, 255, 255],
            fontStyle: 'bold', fontSize: 7.5,
            cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
        },
        alternateRowStyles: { fillColor: GRIS_FIL },
        bodyStyles: { fillColor: [255, 255, 255] },
        margin: { left: ML, right: MR },
        tableWidth: TW,
        rowPageBreak: 'avoid',
        didDrawPage: () => addHeader(false),
        ...extra
    });

    addHeader(true);

    // Tabla principal
    doc.autoTable({
        startY: y,
        head: [['#', 'Razón Social', 'RUT', 'Contacto', 'Teléfono', 'Email', 'Ciudad', 'Productos', 'Compras', 'Estado']],
        body: suppliers.map((s, i) => [
            i + 1,
            s.business_name,
            s.rut || '-',
            s.contact_name || '-',
            s.phone || '-',
            s.email || '-',
            s.city || '-',
            parseInt(s.products_count) || 0,
            parseInt(s.purchases_count) || 0,
            s.is_active ? 'Activo' : 'Inactivo',
        ]),
        foot: [[
            '', 'TOTAL', '', '', '', '', '',
            fmtN(suppliers.reduce((a, s) => a + (parseInt(s.products_count) || 0), 0)),
            fmtN(suppliers.reduce((a, s) => a + (parseInt(s.purchases_count) || 0), 0)),
            '',
        ]],
        ...tblOpts({
            footStyles: {
                fillColor: [230, 230, 230], textColor: NEGRO,
                fontStyle: 'bold', fontSize: 8,
            },
            columnStyles: {
                0: { cellWidth: 8,  halign: 'center' },
                1: { cellWidth: 52 },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 32 },
                4: { cellWidth: 24 },
                5: { cellWidth: 46 },
                6: { cellWidth: 22 },
                7: { cellWidth: 16, halign: 'center' },
                8: { cellWidth: 16, halign: 'center' },
                9: { cellWidth: 18, halign: 'center' },
            }
        })
    });

    addFooters();

    const filename = `Proveedores_${today.replace(/\//g, '-')}.pdf`;
    doc.save(filename);
    return { success: true };
};