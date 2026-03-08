// src/services/export/cashExport.js
// Exportación del historial de caja a Excel y PDF
// Mismo patrón que reportExport.js

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (dt) => {
    if (!dt) return '—';
    const d = dt.includes('T') ? new Date(dt) : new Date(dt.replace(' ', 'T'));
    return d.toLocaleString('es-CL', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

export const fmtDuration = (openedAt, closedAt) => {
    if (!openedAt || !closedAt) return null;
    const toD = (s) => s.includes('T') ? new Date(s) : new Date(s.replace(' ', 'T'));
    const ms = toD(closedAt) - toD(openedAt);
    const h  = Math.floor(ms / 3600000);
    const m  = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
};

export const PAYMENT_LABELS = {
    efectivo:        'Efectivo',
    tarjeta_debito:  'Débito',
    tarjeta_credito: 'Crédito',
    transferencia:   'Transferencia',
    multiple:        'Múltiple',
};

// ── Ticket térmico de impresión ───────────────────────────────────────────────
export const buildDetailTicket = (reg, movements, salesByPayment, salesDetail) => {
    const totalIn    = movements.filter(m => m.type === 'in').reduce((a, m) => a + m.amount, 0);
    const totalOut   = movements.filter(m => m.type === 'out').reduce((a, m) => a + m.amount, 0);
    const cashSales  = salesByPayment.find(p => p.payment_method === 'efectivo')?.total || 0;
    const totalVentas = salesByPayment.reduce((a, p) => a + p.total, 0);
    const diff = reg.difference;

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Cierre de Caja</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; font-size:12px; width:76mm; margin:0 auto; padding:8px 0; }
  .center { text-align:center; }
  .bold   { font-weight:bold; }
  .line   { border-top:1px dashed #000; margin:6px 0; }
  .row    { display:flex; justify-content:space-between; padding:2px 0; }
  .title  { font-size:15px; font-weight:bold; text-align:center; margin:6px 0 2px; }
  .sub    { font-size:11px; text-align:center; margin-bottom:4px; }
  .green  { color:#15803d; }
  .red    { color:#dc2626; }
  table   { width:100%; border-collapse:collapse; }
  th,td   { padding:2px 3px; font-size:11px; }
  th      { border-bottom:1px solid #000; font-weight:bold; }
  .tr     { text-align:right; }
  .tc     { text-align:center; }
  @media print { body{margin:0;} @page{margin:4mm;size:80mm auto;} }
</style></head><body>
  <p class="title">CIERRE DE CAJA</p>
  <p class="sub">Informe de Turno</p>
  <div class="line"></div>
  <div class="row"><span>Abierto por:</span><span>${reg.opened_by_name || '—'}</span></div>
  <div class="row"><span>Apertura:</span><span>${fmtDate(reg.opened_at)}</span></div>
  <div class="row"><span>Cerrado por:</span><span>${reg.closed_by_name || '—'}</span></div>
  <div class="row"><span>Cierre:</span><span>${fmtDate(reg.closed_at)}</span></div>
  <div class="line"></div>
  <p class="bold center">RESUMEN DE VENTAS</p>
  <div class="line"></div>
  <div class="row bold"><span>Total ventas:</span><span>${fmt(totalVentas)}</span></div>
  <div class="row"><span>N° transacciones:</span><span>${salesDetail.length}</span></div>
  <div class="line"></div>
  <p class="bold">Por forma de pago:</p>
  ${salesByPayment.map(p => `
  <div class="row">
    <span>${PAYMENT_LABELS[p.payment_method] || p.payment_method} (${p.count})</span>
    <span>${fmt(p.total)}</span>
  </div>`).join('')}
  ${movements.length > 0 ? `
  <div class="line"></div>
  <p class="bold">Movimientos de efectivo:</p>
  ${movements.map(m => `
  <div class="row">
    <span>${m.type === 'in' ? '+' : '-'} ${m.reason}</span>
    <span>${m.type === 'in' ? '+' : '-'}${fmt(m.amount)}</span>
  </div>`).join('')}` : ''}
  <div class="line"></div>
  <p class="bold">ARQUEO DE CAJA</p>
  <div class="row"><span>Efectivo inicial:</span><span>${fmt(reg.opening_amount)}</span></div>
  ${totalIn  > 0 ? `<div class="row"><span>+ Ingresos:</span><span>+${fmt(totalIn)}</span></div>`  : ''}
  ${totalOut > 0 ? `<div class="row"><span>- Egresos:</span><span>-${fmt(totalOut)}</span></div>` : ''}
  <div class="row"><span>+ Ventas efectivo:</span><span>+${fmt(cashSales)}</span></div>
  <div class="line"></div>
  <div class="row bold"><span>Efectivo esperado:</span><span>${fmt(reg.expected_cash)}</span></div>
  <div class="row bold"><span>Efectivo contado:</span><span>${fmt(reg.closing_amount)}</span></div>
  <div class="line"></div>
  <div class="row bold ${diff == null ? '' : diff >= 0 ? 'green' : 'red'}">
    <span>${diff == null ? '—' : diff === 0 ? 'CUADRE EXACTO' : diff > 0 ? 'SOBRANTE:' : 'FALTANTE:'}</span>
    <span>${diff == null ? '' : diff === 0 ? '✓' : fmt(Math.abs(diff))}</span>
  </div>
  ${salesDetail.length > 0 ? `
  <div class="line"></div>
  <p class="bold center">DETALLE DE VENTAS</p>
  <div class="line"></div>
  <table>
    <thead>
      <tr><th>N° Venta</th><th class="tc">Hora</th><th class="tc">Pago</th><th class="tr">Total</th></tr>
    </thead>
    <tbody>
    ${salesDetail.map(s => `
    <tr>
      <td>${s.sale_number}</td>
      <td class="tc">${new Date((s.created_at || '').replace(' ', 'T')).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td>
      <td class="tc">${(PAYMENT_LABELS[s.payment_method] || s.payment_method || '').substring(0, 7)}</td>
      <td class="tr">${fmt(s.total)}</td>
    </tr>`).join('')}
    </tbody>
  </table>` : ''}
  ${reg.notes ? `<div class="line"></div><p><span class="bold">Notas:</span> ${reg.notes}</p>` : ''}
  <div class="line"></div>
  <p class="center sub">Sistema POS · ${new Date().toLocaleDateString('es-CL')}</p>
</body></html>`;
};

// ── Exportar a Excel ──────────────────────────────────────────────────────────
export const exportCashHistoryExcel = async (registers) => {
    try {
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Sistema POS';
        wb.created = new Date();

        const ws = wb.addWorksheet('Historial de Caja');
        ws.properties.defaultRowHeight = 18;

        const C = {
            azul:    '2563EB', verde:  '10B981',
            rojo:    'EF4444', blanco: 'FFFFFF',
        };
        const headerFill = (c) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
        const hFont      = { name: 'Arial', bold: true, color: { argb: C.blanco }, size: 10 };
        const centerAlign = { horizontal: 'center', vertical: 'middle' };
        const leftAlign   = { horizontal: 'left',   vertical: 'middle' };
        const rightAlign  = { horizontal: 'right',  vertical: 'middle' };

        // ── Título ──
        ws.mergeCells('A1:I1');
        ws.getCell('A1').value     = 'Historial de Caja — Sistema POS';
        ws.getCell('A1').font      = { name: 'Arial', bold: true, size: 14, color: { argb: C.azul } };
        ws.getCell('A1').alignment = leftAlign;
        ws.getRow(1).height = 28;

        ws.mergeCells('A2:I2');
        ws.getCell('A2').value     = `Generado: ${new Date().toLocaleString('es-CL')}`;
        ws.getCell('A2').font      = { name: 'Arial', size: 9, color: { argb: '6B7280' } };
        ws.getCell('A2').alignment = leftAlign;
        ws.getRow(2).height = 14;
        ws.getRow(3).height = 6; // separador visual

        // ── Encabezados ──
        const HEADERS = [
            'Apertura', 'Abierto por', 'Cierre', 'Cerrado por',
            'Estado', 'Inicial ($)', 'Esperado ($)', 'Contado ($)', 'Diferencia ($)', 'Duración'
        ];
        ws.getRow(4).values    = HEADERS;
        ws.getRow(4).font      = hFont;
        ws.getRow(4).fill      = headerFill(C.azul);
        ws.getRow(4).height    = 22;
        ws.getRow(4).alignment = centerAlign;

        // ── Datos ──
        registers.forEach((r, i) => {
            const diff = r.difference;
            const row  = ws.getRow(5 + i);

            row.values = [
                fmtDate(r.opened_at),
                r.opened_by_name  || '—',
                r.closed_at ? fmtDate(r.closed_at) : '—',
                r.closed_by_name  || '—',
                r.status === 'open' ? 'Abierta' : 'Cerrada',
                r.opening_amount  || 0,
                r.expected_cash   ?? '',
                r.closing_amount  ?? '',
                diff              ?? '',
                fmtDuration(r.opened_at, r.closed_at) || (r.status === 'open' ? 'Activa' : '—'),
            ];
            row.font   = { name: 'Arial', size: 10 };
            row.height = 18;
            if (i % 2 === 0) row.fill = headerFill('F9FAFB');

            // Alineaciones
            ['A','B','C','D'].forEach(col => { ws.getCell(`${col}${5+i}`).alignment = leftAlign; });
            ws.getCell(`E${5+i}`).alignment = centerAlign;
            ws.getCell(`J${5+i}`).alignment = centerAlign;

            // Moneda + alineación derecha
            ['F','G','H','I'].forEach(col => {
                const cell = ws.getCell(`${col}${5+i}`);
                if (cell.value !== '' && cell.value != null) cell.numFmt = '$#,##0';
                cell.alignment = rightAlign;
            });

            // Color diferencia
            if (diff != null) {
                ws.getCell(`I${5+i}`).font = {
                    name: 'Arial', size: 10, bold: true,
                    color: { argb: diff === 0 ? C.verde : diff > 0 ? C.azul : C.rojo }
                };
            }

            // Color estado
            ws.getCell(`E${5+i}`).font = {
                name: 'Arial', size: 10, bold: true,
                color: { argb: r.status === 'open' ? '059669' : '2563EB' }
            };
        });

        // ── Anchos de columna ──
        ws.getColumn('A').width = 22; // Apertura
        ws.getColumn('B').width = 20; // Abierto por
        ws.getColumn('C').width = 22; // Cierre
        ws.getColumn('D').width = 20; // Cerrado por
        ws.getColumn('E').width = 12; // Estado
        ws.getColumn('F').width = 15; // Inicial
        ws.getColumn('G').width = 15; // Esperado
        ws.getColumn('H').width = 15; // Contado
        ws.getColumn('I').width = 18; // Diferencia
        ws.getColumn('J').width = 12; // Duración

        // ── Guardar ──
        const buffer   = await wb.xlsx.writeBuffer();
        const filename = `Historial_Caja_${new Date().toLocaleDateString('es-CL').replace(/\//g, '-')}.xlsx`;

        try {
            await window.electronAPI.files.save(buffer, filename);
        } catch {
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href = url; a.download = filename; a.click();
            URL.revokeObjectURL(url);
        }
    } catch (e) {
        console.error('Error exportando Excel de caja:', e);
        alert('Error al exportar Excel: ' + e.message);
    }
};

// ── Exportar a PDF ────────────────────────────────────────────────────────────
export const exportCashHistoryPDF = async (registers) => {
    try {
        const { jsPDF } = require('jspdf');
        require('jspdf-autotable');

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
        const W  = doc.internal.pageSize.getWidth();
        const ML = 15, MR = 15;

        // ── Encabezado ──
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.text('Historial de Caja', ML, 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text(`Generado: ${new Date().toLocaleString('es-CL')}`, ML, 24);

        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(ML, 27, W - MR, 27);

        // ── Tabla ──
        doc.autoTable({
            startY: 32,
            head: [[
                'Apertura', 'Abierto por', 'Cierre', 'Cerrado por',
                'Estado', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Duración'
            ]],
            body: registers.map(r => {
                const diff = r.difference;
                return [
                    fmtDate(r.opened_at),
                    r.opened_by_name  || '—',
                    r.closed_at ? fmtDate(r.closed_at) : '—',
                    r.closed_by_name  || '—',
                    r.status === 'open' ? 'Abierta' : 'Cerrada',
                    fmt(r.opening_amount),
                    r.expected_cash  != null ? fmt(r.expected_cash)  : '—',
                    r.closing_amount != null ? fmt(r.closing_amount) : '—',
                    diff != null
                        ? (diff === 0 ? 'Exacta' : (diff > 0 ? '+' : '') + fmt(diff))
                        : '—',
                    fmtDuration(r.opened_at, r.closed_at) || (r.status === 'open' ? 'Activa' : '—'),
                ];
            }),
            styles: {
                font: 'helvetica',
                fontSize: 7.5,
                cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
            },
            headStyles: {
                fillColor: [37, 99, 235],
                textColor: 255,
                fontStyle: 'bold',
                fontSize:  7.5,
            },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: ML, right: MR },
            didParseCell: (data) => {
                if (data.section !== 'body') return;
                // Columna Diferencia (index 8)
                if (data.column.index === 8) {
                    const val = data.cell.raw;
                    if (val === 'Exacta') {
                        data.cell.styles.textColor = [16, 185, 129];
                        data.cell.styles.fontStyle = 'bold';
                    } else if (val && val !== '—') {
                        data.cell.styles.textColor = val.startsWith('+')
                            ? [37, 99, 235]
                            : [239, 68, 68];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
                // Columna Estado (index 4)
                if (data.column.index === 4) {
                    data.cell.styles.textColor = data.cell.raw === 'Abierta'
                        ? [5, 150, 105]
                        : [37, 99, 235];
                    data.cell.styles.fontStyle = 'bold';
                }
            },
            columnStyles: {
                0: { cellWidth: 26 },             // Apertura
                1: { cellWidth: 20 },             // Abierto por
                2: { cellWidth: 26 },             // Cierre
                3: { cellWidth: 20 },             // Cerrado por
                4: { cellWidth: 16, halign: 'center' }, // Estado
                5: { cellWidth: 20, halign: 'right' },  // Inicial
                6: { cellWidth: 20, halign: 'right' },  // Esperado
                7: { cellWidth: 20, halign: 'right' },  // Contado
                8: { cellWidth: 22, halign: 'right' },  // Diferencia
                9: { cellWidth: 14, halign: 'center' }, // Duración
            },
        });

        // ── Pie de página ──
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Página ${i} de ${pageCount}`, W / 2, 200, { align: 'center' });
        }

        const filename = `Historial_Caja_${new Date().toLocaleDateString('es-CL').replace(/\//g, '-')}.pdf`;
        doc.save(filename);
    } catch (e) {
        console.error('Error exportando PDF de caja:', e);
        alert('Error al exportar PDF: ' + e.message);
    }
};