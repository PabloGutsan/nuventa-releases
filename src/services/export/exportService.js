/**
 * exportService.js
 * Servicio de exportación para el Historial de Ventas
 * Ubicación: src/services/export/exportService.js
 */

const exportService = {

    // ─── Exportar resumen de ventas a Excel ────────────────────────────────
    exportSalesToExcel: async (sales, filename = 'ventas') => {
        const ExcelJS = require('exceljs');
        const wb  = new ExcelJS.Workbook();
        const ws  = wb.addWorksheet('Resumen de Ventas');

        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
        const headerFont = { name: 'Arial', bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        const bodyFont   = { name: 'Arial', size: 10 };
        const grisClaro  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };

        // Encabezados
        ws.columns = [
            { header: 'N° Venta',       key: 'sale_number',    width: 16 },
            { header: 'Fecha',          key: 'created_at',     width: 18 },
            { header: 'Cliente',        key: 'customer_name',  width: 25 },
            { header: 'Vendedor',       key: 'seller_name',    width: 20 },
            { header: 'Items',          key: 'items_count',    width: 8  },
            { header: 'Método Pago',    key: 'payment_method', width: 16 },
            { header: 'Tipo Documento', key: 'document_type',  width: 20 },
            { header: 'N° Documento',   key: 'document_number',width: 14 },
            { header: 'Total ($)',      key: 'total',          width: 16 },
            { header: 'Estado',         key: 'status',         width: 12 },
        ];

        // Estilo de encabezados
        ws.getRow(1).eachCell(cell => {
            cell.fill = headerFill;
            cell.font = headerFont;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        ws.getRow(1).height = 22;

        const PAYMENT_LABELS = {
            efectivo: 'Efectivo', tarjeta_debito: 'Débito',
            tarjeta_credito: 'Crédito', transferencia: 'Transferencia', multiple: 'Múltiple'
        };
        const DOC_LABELS = {
            boleta_fisica: 'Boleta Física', boleta_electronica: 'Boleta Electrónica',
            factura_fisica: 'Factura Física', factura_electronica: 'Factura Electrónica',
            sin_documento: 'Sin Documento'
        };

        // Filas de datos
        sales.forEach((sale, i) => {
            const row = ws.addRow({
                sale_number:     sale.sale_number,
                created_at:      new Date(sale.created_at).toLocaleString('es-CL'),
                customer_name:   sale.customer_name || '-',
                seller_name:     sale.seller_name   || '-',
                items_count:     sale.items_count   || 0,
                payment_method:  PAYMENT_LABELS[sale.payment_method] || sale.payment_method,
                document_type:   DOC_LABELS[sale.document_type]      || sale.document_type,
                document_number: sale.document_number || '-',
                total:           sale.total,
                status:          sale.is_cancelled ? 'Cancelada' : 'Activa',
            });
            row.font = bodyFont;
            row.height = 18;
            if (i % 2 === 0) row.fill = grisClaro;
            // Formato moneda
            row.getCell('total').numFmt = '$#,##0';
            row.getCell('total').alignment = { horizontal: 'right' };
            row.getCell('items_count').alignment = { horizontal: 'center' };
            // Canceladas en rojo
            if (sale.is_cancelled) {
                row.getCell('status').font = { name: 'Arial', size: 10, color: { argb: 'EF4444' } };
            }
        });

        // Fila de total
        const totalRow = ws.addRow({
            sale_number: 'TOTAL',
            total: sales.filter(s => !s.is_cancelled).reduce((a, s) => a + (s.total || 0), 0)
        });
        totalRow.font = { name: 'Arial', bold: true, size: 10 };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF9C3' } };
        totalRow.getCell('total').numFmt = '$#,##0';
        totalRow.getCell('total').alignment = { horizontal: 'right' };
        totalRow.height = 22;

        const buffer = await wb.xlsx.writeBuffer();
        return window.electronAPI.files.save(buffer, `${filename}.xlsx`);
    },

    // ─── Exportar detalle de ventas a Excel (con productos) ───────────────
    exportSalesDetailToExcel: async (sales, filename = 'ventas_detalle') => {
        const ExcelJS = require('exceljs');
        const wb  = new ExcelJS.Workbook();
        const ws  = wb.addWorksheet('Detalle de Ventas');

        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } };
        const headerFont = { name: 'Arial', bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        const bodyFont   = { name: 'Arial', size: 10 };
        const grisClaro  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3F4F6' } };

        ws.columns = [
            { header: 'N° Venta',    key: 'sale_number',   width: 16 },
            { header: 'Fecha',       key: 'created_at',    width: 18 },
            { header: 'Cliente',     key: 'customer_name', width: 22 },
            { header: 'Producto',    key: 'product_name',  width: 30 },
            { header: 'Cantidad',    key: 'quantity',      width: 10 },
            { header: 'P. Unitario', key: 'unit_price',    width: 14 },
            { header: 'Subtotal',    key: 'subtotal',      width: 14 },
            { header: 'Método Pago', key: 'payment',       width: 16 },
            { header: 'Total Venta', key: 'total',         width: 14 },
        ];

        ws.getRow(1).eachCell(cell => {
            cell.fill = headerFill;
            cell.font = headerFont;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        ws.getRow(1).height = 22;

        const PAYMENT_LABELS = {
            efectivo: 'Efectivo', tarjeta_debito: 'Débito',
            tarjeta_credito: 'Crédito', transferencia: 'Transferencia', multiple: 'Múltiple'
        };

        let rowIdx = 0;
        for (const sale of sales) {
            if (sale.is_cancelled) continue;
            const items = sale.items || [];

            if (items.length === 0) {
                const row = ws.addRow({
                    sale_number:   sale.sale_number,
                    created_at:    new Date(sale.created_at).toLocaleString('es-CL'),
                    customer_name: sale.customer_name || '-',
                    product_name:  '(sin detalle)',
                    quantity:      '-',
                    unit_price:    '-',
                    subtotal:      '-',
                    payment:       PAYMENT_LABELS[sale.payment_method] || sale.payment_method,
                    total:         sale.total,
                });
                row.font = bodyFont;
                if (rowIdx % 2 === 0) row.fill = grisClaro;
                row.getCell('total').numFmt = '$#,##0';
                rowIdx++;
            } else {
                items.forEach((item, j) => {
                    const row = ws.addRow({
                        sale_number:   j === 0 ? sale.sale_number : '',
                        created_at:    j === 0 ? new Date(sale.created_at).toLocaleString('es-CL') : '',
                        customer_name: j === 0 ? (sale.customer_name || '-') : '',
                        product_name:  item.product_name,
                        quantity:      item.quantity,
                        unit_price:    item.unit_price,
                        subtotal:      item.quantity * item.unit_price,
                        payment:       j === 0 ? (PAYMENT_LABELS[sale.payment_method] || sale.payment_method) : '',
                        total:         j === 0 ? sale.total : '',
                    });
                    row.font = bodyFont;
                    if (rowIdx % 2 === 0) row.fill = grisClaro;
                    ['unit_price','subtotal','total'].forEach(k => {
                        if (row.getCell(k).value !== '') {
                            row.getCell(k).numFmt = '$#,##0';
                            row.getCell(k).alignment = { horizontal: 'right' };
                        }
                    });
                    row.getCell('quantity').alignment = { horizontal: 'center' };
                    rowIdx++;
                });
            }
        }

        const buffer = await wb.xlsx.writeBuffer();
        return window.electronAPI.files.save(buffer, `${filename}.xlsx`);
    },

    // ─── Exportar ventas a PDF ─────────────────────────────────────────────
    exportSalesToPDF: async (sales, filename = 'ventas', businessInfo = {}) => {
        const { jsPDF } = require('jspdf');
        require('jspdf-autotable');

        const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
        const W     = doc.internal.pageSize.getWidth();
        const AZUL  = [37, 99, 235];
        const GRIS  = [107, 114, 128];
        const GRISC = [243, 244, 246];
        const NEGRO = [17, 24, 39];

        const fmtCLP = (n) =>
            new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

        // Header
        doc.setFillColor(...AZUL);
        doc.rect(0, 0, W, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(businessInfo?.name || 'Mi Negocio', 14, 11);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Historial de Ventas', 14, 19);
        doc.setFontSize(8);
        doc.setTextColor(200, 210, 255);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}   |   ${sales.length} registros`, 14, 25);

        const PAYMENT_LABELS = {
            efectivo: 'Efectivo', tarjeta_debito: 'Débito',
            tarjeta_credito: 'Crédito', transferencia: 'Transferencia', multiple: 'Múltiple'
        };
        const DOC_LABELS = {
            boleta_fisica: 'B. Física', boleta_electronica: 'B. Electrónica',
            factura_fisica: 'F. Física', factura_electronica: 'F. Electrónica',
            sin_documento: 'Sin Doc.'
        };

        doc.autoTable({
            startY: 33,
            head: [['N° Venta', 'Fecha', 'Cliente', 'Vendedor', 'Pago', 'Documento', 'Total', 'Estado']],
            body: sales.map(s => [
                s.sale_number,
                new Date(s.created_at).toLocaleString('es-CL', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }),
                s.customer_name || '-',
                s.seller_name   || '-',
                PAYMENT_LABELS[s.payment_method] || s.payment_method,
                DOC_LABELS[s.document_type]      || s.document_type,
                fmtCLP(s.total),
                s.is_cancelled ? 'Cancelada' : 'Activa'
            ]),
            foot: [[
                '', '', '', '', '',
                'TOTAL:',
                fmtCLP(sales.filter(s => !s.is_cancelled).reduce((a, s) => a + (s.total || 0), 0)),
                ''
            ]],
            styles:           { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
            headStyles:       { fillColor: AZUL, textColor: [255,255,255], fontStyle: 'bold' },
            footStyles:       { fillColor: [254,249,195], textColor: NEGRO, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: GRISC },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { cellWidth: 30 },
                2: { cellWidth: 40 },
                3: { cellWidth: 35 },
                4: { cellWidth: 25 },
                5: { cellWidth: 28 },
                6: { cellWidth: 28, halign: 'right' },
                7: { cellWidth: 20, halign: 'center' }
            },
            margin: { left: 14, right: 14 },
        });

        // Footer páginas
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(...GRIS);
            doc.text(
                `${businessInfo?.name || 'Mi Negocio'} — Página ${i} de ${pageCount}`,
                W / 2, 200, { align: 'center' }
            );
        }

        doc.save(`${filename}.pdf`);
        return { success: true };
    }
};

export default exportService;