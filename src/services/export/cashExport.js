/**
 * cashExport.js
 * Servicio de exportación del Historial de Caja a Excel y PDF
 * Mismo patrón que salesHistoryExport.js
 * Ubicación: src/services/export/cashExport.js
 */

// ─── Helpers de formato ────────────────────────────────────────────────────
const fmt = (n) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);

const fmtN = (n) =>
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n || 0);

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

// ─── Fecha de hoy formateada DD-MM-YYYY ───────────────────────────────────
const todayLabel = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
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

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR A EXCEL
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @param {object} params
 * @param {Array}   params.registers      - Array de registros de caja filtrados
 * @param {string}  params.dateFrom       - Fecha inicio (YYYY-MM-DD)
 * @param {string}  params.dateTo         - Fecha fin    (YYYY-MM-DD)
 * @param {string}  [params.businessName] - Nombre del negocio
 * @param {string}  [params.statusFilter] - Filtro de estado aplicado
 * @param {string}  [params.userFilter]   - Filtro de usuario aplicado
 */
export const exportCashHistoryExcel = async ({
    registers = [],
    dateFrom  = '',
    dateTo    = '',
    businessName = 'Mi Negocio',
    statusFilter = '',
    userFilter   = '',
} = {}) => {

    try {
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        wb.creator = businessName;
        wb.created = new Date();

        const C = {
            azul:      '2563EB',
            verde:     '10B981',
            rojo:      'EF4444',
            amarillo:  'FEF9C3',
            grisOsc:   '374151',
            grisMed:   '6B7280',
            grisClaro: 'F3F4F6',
            blanco:    'FFFFFF',
        };

        const headerFont  = { name: 'Arial', bold: true, color: { argb: C.blanco }, size: 11 };
        const titleFont   = { name: 'Arial', bold: true, size: 14, color: { argb: C.azul } };
        const subFont     = { name: 'Arial', bold: true, size: 11, color: { argb: C.grisOsc } };
        const bodyFont    = { name: 'Arial', size: 10 };
        const centerAlign = { horizontal: 'center', vertical: 'middle' };
        const leftAlign   = { horizontal: 'left',   vertical: 'middle' };
        const rightAlign  = { horizontal: 'right',  vertical: 'middle' };
        const fill = (c) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });

        const rangeLabel = dateFrom && dateTo
            ? `${dateFrom.split('-').reverse().join('-')} al ${dateTo.split('-').reverse().join('-')}`
            : new Date().toLocaleDateString('es-CL');

        const filterDesc = [
            statusFilter && statusFilter !== 'all'
                ? `Estado: ${statusFilter === 'open' ? 'Abiertas' : 'Cerradas'}` : '',
            userFilter && userFilter !== 'all'
                ? `Usuario: ${userFilter}` : '',
        ].filter(Boolean).join('  |  ');

        // ── Encabezado reutilizable ──────────────────────────────────────────
        const addSheetHeader = (ws, title, cols) => {
            const lastCol = String.fromCharCode(64 + cols);
            ws.mergeCells(`A1:${lastCol}1`);
            ws.getCell('A1').value     = businessName;
            ws.getCell('A1').font      = titleFont;
            ws.getCell('A1').alignment = leftAlign;

            ws.mergeCells(`A2:${lastCol}2`);
            ws.getCell('A2').value     = title;
            ws.getCell('A2').font      = subFont;
            ws.getCell('A2').alignment = leftAlign;

            ws.mergeCells(`A3:${lastCol}3`);
            const desc = [`Período: ${rangeLabel}`, filterDesc].filter(Boolean).join('  |  ');
            ws.getCell('A3').value     = desc;
            ws.getCell('A3').font      = { name: 'Arial', size: 9, color: { argb: C.grisMed } };
            ws.getCell('A3').alignment = leftAlign;

            ws.getRow(4).height = 6;
        };

        // ════════════════════════════════════════════════════════════
        // HOJA 1 — Resumen
        // ════════════════════════════════════════════════════════════
        const ws1 = wb.addWorksheet('Resumen');
        ws1.properties.defaultRowHeight = 18;
        addSheetHeader(ws1, 'Resumen del Período', 3);

        ws1.getRow(5).values = ['Indicador', 'Valor', 'Detalle'];
        ws1.getRow(5).font   = headerFont;
        ws1.getRow(5).fill   = fill(C.azul);
        ws1.getRow(5).height = 22;
        ['A5','B5','C5'].forEach(c => { ws1.getCell(c).alignment = centerAlign; });

        const closed      = registers.filter(r => r.status === 'closed');
        const open        = registers.filter(r => r.status === 'open');
        const totalSales  = registers.reduce((a, r) => a + (r.total_sales || 0), 0);
        const totalInit   = registers.reduce((a, r) => a + (r.opening_amount || 0), 0);
        const shortage    = closed.filter(r => r.difference < 0).reduce((a, r) => a + Math.abs(r.difference), 0);
        const surplus     = closed.filter(r => r.difference > 0).reduce((a, r) => a + r.difference, 0);
        const exact       = closed.filter(r => r.difference === 0).length;
        const avgDiff     = closed.length > 0
            ? closed.reduce((a, r) => a + (r.difference || 0), 0) / closed.length : 0;

        const metricas = [
            ['Total sesiones de caja',  fmtN(registers.length),   `${open.length} abiertas / ${closed.length} cerradas`],
            ['Total ventas registradas', fmt(totalSales),           'Suma de ventas en todos los turnos'],
            ['Efectivo inicial total',   fmt(totalInit),            'Suma de montos de apertura'],
            ['Diferencia promedio',      fmt(Math.round(avgDiff)),  avgDiff >= 0 ? 'Tendencia positiva' : 'Tendencia negativa'],
            ['Faltantes acumulados',     fmt(shortage),             `${closed.filter(r => r.difference < 0).length} turnos con faltante`],
            ['Sobrantes acumulados',     fmt(surplus),              `${closed.filter(r => r.difference > 0).length} turnos con sobrante`],
            ['Cierres exactos',          fmtN(exact),               `${closed.length > 0 ? ((exact/closed.length)*100).toFixed(1) : '0.0'}% de los turnos cerrados`],
        ];

        metricas.forEach(([ind, val, det], i) => {
            const r = ws1.getRow(6 + i);
            r.values = [ind, val, det];
            r.font   = bodyFont;
            r.height = 20;
            r.getCell(1).font = { name: 'Arial', bold: true, size: 10 };
            if (i % 2 === 0) r.fill = fill(C.grisClaro);
            r.getCell(2).alignment = rightAlign;
        });

        ws1.getColumn('A').width = 30;
        ws1.getColumn('B').width = 22;
        ws1.getColumn('C').width = 40;

        // ════════════════════════════════════════════════════════════
        // HOJA 2 — Historial completo
        // ════════════════════════════════════════════════════════════
        const ws2 = wb.addWorksheet('Historial de Caja');
        ws2.properties.defaultRowHeight = 18;
        addSheetHeader(ws2, 'Historial de Caja — Detalle', 10);

        const HEADERS = [
            'Apertura', 'Abierto por', 'Cierre', 'Cerrado por',
            'Estado', 'Inicial ($)', 'Esperado ($)', 'Contado ($)', 'Diferencia ($)', 'Duración'
        ];
        ws2.getRow(5).values    = HEADERS;
        ws2.getRow(5).font      = headerFont;
        ws2.getRow(5).fill      = fill(C.azul);
        ws2.getRow(5).height    = 22;
        ws2.getRow(5).alignment = centerAlign;

        registers.forEach((r, i) => {
            const diff = r.difference;
            const row  = ws2.getRow(6 + i);
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
            row.font   = bodyFont;
            row.height = 18;
            if (i % 2 === 0) row.fill = fill(C.grisClaro);

            ['A','B','C','D'].forEach(col => { ws2.getCell(`${col}${6+i}`).alignment = leftAlign; });
            ws2.getCell(`E${6+i}`).alignment = centerAlign;
            ws2.getCell(`J${6+i}`).alignment = centerAlign;
            ['F','G','H','I'].forEach(col => {
                const cell = ws2.getCell(`${col}${6+i}`);
                if (cell.value !== '' && cell.value != null) cell.numFmt = '$#,##0';
                cell.alignment = rightAlign;
            });

            // Color diferencia
            if (diff != null) {
                ws2.getCell(`I${6+i}`).font = {
                    name: 'Arial', size: 10, bold: true,
                    color: { argb: diff === 0 ? C.verde : diff > 0 ? C.azul : C.rojo }
                };
            }
            // Color estado
            ws2.getCell(`E${6+i}`).font = {
                name: 'Arial', size: 10, bold: true,
                color: { argb: r.status === 'open' ? '059669' : C.azul }
            };
        });

        // Fila totales
        const totRow = ws2.getRow(6 + registers.length + 1);
        totRow.values = ['TOTAL', '', '', '', '', totalInit, '', '', '', ''];
        totRow.font   = { name: 'Arial', bold: true, size: 10 };
        totRow.fill   = fill(C.amarillo);
        totRow.height = 22;
        ws2.getCell(`F${totRow.number}`).numFmt    = '$#,##0';
        ws2.getCell(`F${totRow.number}`).alignment = rightAlign;

        ws2.getColumn('A').width = 22;
        ws2.getColumn('B').width = 20;
        ws2.getColumn('C').width = 22;
        ws2.getColumn('D').width = 20;
        ws2.getColumn('E').width = 12;
        ws2.getColumn('F').width = 15;
        ws2.getColumn('G').width = 15;
        ws2.getColumn('H').width = 15;
        ws2.getColumn('I').width = 18;
        ws2.getColumn('J').width = 12;

        // ════════════════════════════════════════════════════════════
        // HOJA 3 — Análisis de diferencias
        // ════════════════════════════════════════════════════════════
        const ws3 = wb.addWorksheet('Análisis Diferencias');
        ws3.properties.defaultRowHeight = 18;
        addSheetHeader(ws3, 'Análisis de Diferencias de Caja', 4);

        ws3.getRow(5).values = ['Tipo', 'N° Turnos', 'Monto Total', '% del Total'];
        ws3.getRow(5).font   = headerFont;
        ws3.getRow(5).fill   = fill(C.azul);
        ws3.getRow(5).height = 22;

        const totalDiff = shortage + surplus;
        const diffRows = [
            ['Cuadre exacto',  exact,                                               0,        closed.length > 0 ? ((exact/closed.length)*100).toFixed(1)+'%' : '0.0%'],
            ['Sobrante',       closed.filter(r => r.difference > 0).length,         surplus,  totalDiff > 0 ? ((surplus/totalDiff)*100).toFixed(1)+'%' : '0.0%'],
            ['Faltante',       closed.filter(r => r.difference < 0).length,         shortage, totalDiff > 0 ? ((shortage/totalDiff)*100).toFixed(1)+'%' : '0.0%'],
            ['Sin cerrar',     open.length,                                          0,        '—'],
        ];

        diffRows.forEach(([tipo, count, monto, pct], i) => {
            const r = ws3.getRow(6 + i);
            r.values = [tipo, count, monto, pct];
            r.font   = bodyFont;
            r.height = 20;
            if (i % 2 === 0) r.fill = fill(C.grisClaro);
            ws3.getCell(`C${6+i}`).numFmt    = '$#,##0';
            ws3.getCell(`C${6+i}`).alignment = rightAlign;
            ws3.getCell(`B${6+i}`).alignment = rightAlign;
            ws3.getCell(`D${6+i}`).alignment = rightAlign;
        });

        ws3.getColumn('A').width = 22;
        ws3.getColumn('B').width = 14;
        ws3.getColumn('C').width = 20;
        ws3.getColumn('D').width = 14;

        // ════════════════════════════════════════════════════════════
        // HOJA 4 — Por usuario
        // ════════════════════════════════════════════════════════════
        const ws4 = wb.addWorksheet('Por Usuario');
        ws4.properties.defaultRowHeight = 18;
        addSheetHeader(ws4, 'Historial por Usuario', 5);

        ws4.getRow(5).values = ['Usuario', 'N° Turnos', 'Total Ventas ($)', 'Diferencia Total ($)', 'Faltantes ($)'];
        ws4.getRow(5).font   = headerFont;
        ws4.getRow(5).fill   = fill(C.verde);
        ws4.getRow(5).height = 22;

        const byUser = {};
        registers.forEach(r => {
            const key = r.opened_by_name || 'Sin asignar';
            if (!byUser[key]) byUser[key] = { count: 0, sales: 0, diff: 0, shortage: 0 };
            byUser[key].count++;
            byUser[key].sales += r.total_sales || 0;
            byUser[key].diff  += r.difference || 0;
            if (r.difference < 0) byUser[key].shortage += Math.abs(r.difference);
        });

        Object.entries(byUser).sort((a, b) => b[1].sales - a[1].sales).forEach(([user, data], i) => {
            const r = ws4.getRow(6 + i);
            r.values = [user, data.count, data.sales, data.diff, data.shortage || 0];
            r.font   = bodyFont;
            r.height = 20;
            if (i % 2 === 0) r.fill = fill(C.grisClaro);
            ['C','D','E'].forEach(col => {
                ws4.getCell(`${col}${6+i}`).numFmt    = '$#,##0';
                ws4.getCell(`${col}${6+i}`).alignment = rightAlign;
            });
            ws4.getCell(`B${6+i}`).alignment = rightAlign;

            if (data.diff < 0) {
                ws4.getCell(`D${6+i}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: C.rojo } };
            } else if (data.diff > 0) {
                ws4.getCell(`D${6+i}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: C.verde } };
            }
        });

        ws4.getColumn('A').width = 28;
        ws4.getColumn('B').width = 12;
        ws4.getColumn('C').width = 20;
        ws4.getColumn('D').width = 22;
        ws4.getColumn('E').width = 18;

        // ── Guardar ──────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR A PDF
// ═══════════════════════════════════════════════════════════════════════════
/**
 * @param {object} params
 * @param {Array}   params.registers      - Array de registros de caja
 * @param {string}  params.dateFrom       - Fecha inicio (YYYY-MM-DD)
 * @param {string}  params.dateTo         - Fecha fin    (YYYY-MM-DD)
 * @param {string}  [params.businessName] - Nombre del negocio
 * @param {string}  [params.statusFilter] - Filtro de estado aplicado
 * @param {string}  [params.userFilter]   - Filtro de usuario aplicado
 */
export const exportCashHistoryPDF = async ({
    registers = [],
    dateFrom  = '',
    dateTo    = '',
    businessName = 'Mi Negocio',
    statusFilter = '',
    userFilter   = '',
} = {}) => {
    

    try {
        const { jsPDF } = require('jspdf');
        require('jspdf-autotable');

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

        // ── Márgenes ─────────────────────────────────────────────────────────
        const ML = 25;
        const MR = 25;
        const W  = doc.internal.pageSize.getWidth();
        const TW = W - ML - MR;

        let y = 0;

        // ── Paleta monocromática (idéntica a salesHistoryExport) ──────────────
        const NEGRO    = [0,   0,   0  ];
        const GRIS_OSC = [80,  80,  80 ];
        const GRIS_MED = [130, 130, 130];
        const GRIS_SUP = [220, 220, 220];
        const GRIS_FIL = [245, 245, 245];

        // ── Datos calculados ──────────────────────────────────────────────────
        const closed     = registers.filter(r => r.status === 'closed');
        const open       = registers.filter(r => r.status === 'open');
        const totalSales = registers.reduce((a, r) => a + (r.total_sales || 0), 0);
        const shortage   = closed.filter(r => r.difference < 0).reduce((a, r) => a + Math.abs(r.difference), 0);
        const surplus    = closed.filter(r => r.difference > 0).reduce((a, r) => a + r.difference, 0);
        const exact      = closed.filter(r => r.difference === 0).length;
        const avgDiff    = closed.length > 0
            ? closed.reduce((a, r) => a + (r.difference || 0), 0) / closed.length : 0;

        const rangeLabel = dateFrom && dateTo
            ? `${dateFrom.split('-').reverse().join('-')} al ${dateTo.split('-').reverse().join('-')}`
            : new Date().toLocaleDateString('es-CL');

        const filterDesc = [
            statusFilter && statusFilter !== 'all'
                ? `Estado: ${statusFilter === 'open' ? 'Abiertas' : 'Cerradas'}` : '',
            userFilter && userFilter !== 'all'
                ? `Usuario: ${userFilter}` : '',
        ].filter(Boolean).join('  |  ');

        // ── Encabezado primera página ─────────────────────────────────────────
        const addHeader = (isFirstPage = false) => {
            if (isFirstPage) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(...NEGRO);
                doc.text('Historial de Caja', ML, 22);

                doc.setDrawColor(...GRIS_SUP);
                doc.setLineWidth(0.4);
                doc.line(ML, 25, W - MR, 25);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(...GRIS_OSC);
                doc.text(businessName, ML, 31);

                const line1 = `Período: ${rangeLabel}  |  Descargado: ${todayLabel()}`;
                doc.text(line1, ML, 36);

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
                doc.text(`Historial de Caja — ${businessName} — ${rangeLabel}`, ML, 10);
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

        // ── Pie de página ─────────────────────────────────────────────────────
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

        // ── Título de sección ─────────────────────────────────────────────────
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

        // ── Config base de tablas (idéntica a salesHistoryExport) ─────────────
        const tbl = (extra = {}) => ({
            styles: {
                font:        'helvetica',
                fontSize:    7.5,
                cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
                textColor:   NEGRO,
                lineColor:   GRIS_SUP,
                lineWidth:   0.2,
                halign:      'right',
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

        // ── 1. Resumen ejecutivo ──────────────────────────────────────────────
        sectionTitle('Resumen Ejecutivo');
        doc.autoTable({
            startY: y,
            head: [['Indicador', 'Valor', 'Detalle']],
            body: [
                ['Total sesiones',        fmtN(registers.length),          `${open.length} abiertas / ${closed.length} cerradas`],
                ['Total ventas',          fmt(totalSales),                  'Suma de ventas en todos los turnos'],
                ['Diferencia promedio',   fmt(Math.round(avgDiff)),         avgDiff >= 0 ? 'Tendencia positiva' : 'Tendencia negativa'],
                ['Faltantes acumulados',  fmt(shortage),                    `${closed.filter(r=>r.difference<0).length} turnos con faltante`],
                ['Sobrantes acumulados',  fmt(surplus),                     `${closed.filter(r=>r.difference>0).length} turnos con sobrante`],
                ['Cierres exactos',       fmtN(exact),                      `${closed.length > 0 ? ((exact/closed.length)*100).toFixed(1) : '0.0'}% de los turnos cerrados`],
            ],
            ...tbl({
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 50, halign: 'left' },
                    1: { cellWidth: 35 },
                    2: { halign: 'left' },
                },
            }),
        });
        y = doc.lastAutoTable.finalY + 6;

        // ── 2. Historial de caja ──────────────────────────────────────────────
        sectionTitle('Historial de Caja');
        doc.autoTable({
            startY: y,
            head: [['Apertura', 'Abierto por', 'Cierre', 'Cerrado por', 'Estado', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Duración']],
            showHead: 'everyPage',
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
            ...tbl({
                columnStyles: {
                    0: { cellWidth: 24, halign: 'left' },
                    1: { cellWidth: 18, halign: 'left' },
                    2: { cellWidth: 24, halign: 'left' },
                    3: { cellWidth: 18, halign: 'left' },
                    4: { cellWidth: 14, halign: 'center' },
                    5: { cellWidth: 18 },
                    6: { cellWidth: 18 },
                    7: { cellWidth: 18 },
                    8: { cellWidth: 20 },
                    9: { cellWidth: 12, halign: 'center' },
                },
                didParseCell: (data) => {
                    if (data.section !== 'body') return;
                    // Color diferencia
                    if (data.column.index === 8) {
                        const val = data.cell.raw;
                        if (val === 'Exacta') {
                            data.cell.styles.textColor = [22, 101, 52];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val && val !== '—') {
                            data.cell.styles.textColor = val.startsWith('+')
                                ? [37, 99, 235] : [239, 68, 68];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                    // Color estado
                    if (data.column.index === 4) {
                        data.cell.styles.textColor = data.cell.raw === 'Abierta'
                            ? [5, 150, 105] : [37, 99, 235];
                        data.cell.styles.fontStyle = 'bold';
                    }
                },
            }),
        });
        y = doc.lastAutoTable.finalY + 6;

        // ── 3. Análisis de diferencias ────────────────────────────────────────
        sectionTitle('Análisis de Diferencias');
        doc.autoTable({
            startY: y,
            head: [['Tipo', 'N° Turnos', 'Monto Total', '% del Total']],
            body: [
                ['Cuadre exacto',  fmtN(exact),                                              fmt(0),      closed.length > 0 ? ((exact/closed.length)*100).toFixed(1)+'%' : '0.0%'],
                ['Sobrante',       fmtN(closed.filter(r=>r.difference>0).length),            fmt(surplus),  (shortage+surplus)>0?((surplus/(shortage+surplus))*100).toFixed(1)+'%':'0.0%'],
                ['Faltante',       fmtN(closed.filter(r=>r.difference<0).length),            fmt(shortage), (shortage+surplus)>0?((shortage/(shortage+surplus))*100).toFixed(1)+'%':'0.0%'],
                ['Sin cerrar',     fmtN(open.length),                                        '—',           '—'],
            ],
            ...tbl({
                columnStyles: {
                    0: { cellWidth: 45, halign: 'left' },
                    1: {},
                    2: {},
                    3: {},
                },
                didParseCell: (data) => {
                    if (data.section !== 'body') return;
                    if (data.column.index === 0) {
                        if (data.cell.raw === 'Faltante') data.cell.styles.textColor = [239, 68, 68];
                        if (data.cell.raw === 'Sobrante') data.cell.styles.textColor = [37, 99, 235];
                        if (data.cell.raw === 'Cuadre exacto') data.cell.styles.textColor = [22, 101, 52];
                    }
                },
            }),
        });
        y = doc.lastAutoTable.finalY + 6;

        // ── 4. Por usuario ────────────────────────────────────────────────────
        sectionTitle('Resumen por Usuario');
        const byUser = {};
        registers.forEach(r => {
            const key = r.opened_by_name || 'Sin asignar';
            if (!byUser[key]) byUser[key] = { count: 0, sales: 0, diff: 0, shortage: 0 };
            byUser[key].count++;
            byUser[key].sales += r.total_sales || 0;
            byUser[key].diff  += r.difference  || 0;
            if (r.difference < 0) byUser[key].shortage += Math.abs(r.difference);
        });

        doc.autoTable({
            startY: y,
            head: [['Usuario', 'N° Turnos', 'Total Ventas', 'Diferencia Total', 'Faltantes']],
            body: Object.entries(byUser).sort((a,b) => b[1].sales - a[1].sales).map(([user, data]) => [
                user,
                fmtN(data.count),
                fmt(data.sales),
                (data.diff >= 0 ? '+' : '') + fmt(data.diff),
                fmt(data.shortage),
            ]),
            ...tbl({
                columnStyles: {
                    0: { cellWidth: 50, halign: 'left' },
                    1: {},
                    2: {},
                    3: {},
                    4: {},
                },
                didParseCell: (data) => {
                    if (data.section !== 'body') return;
                    if (data.column.index === 3) {
                        const val = data.cell.raw;
                        if (val && val !== '—') {
                            data.cell.styles.textColor = val.startsWith('+')
                                ? [37, 99, 235] : val.startsWith('-')
                                ? [239, 68, 68] : [22, 101, 52];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
            }),
        });
        y = doc.lastAutoTable.finalY + 6;

        // ── Pie de página en todas las páginas ────────────────────────────────
        addFooters();

        // ── Guardar ───────────────────────────────────────────────────────────
        const filename = `Historial_Caja_${new Date().toLocaleDateString('es-CL').replace(/\//g, '-')}.pdf`;
        doc.save(filename);
        return { success: true };

    } catch (e) {
        console.error('Error exportando PDF de caja:', e);
        alert('Error al exportar PDF: ' + e.message);
    }
};