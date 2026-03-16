import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import ReactDOMServer from 'react-dom/server';
import Ticket from './Ticket';
import KitchenTicket from './KitchenTicket';
import SaleRepository from '../../services/repositories/saleRepository';
import { useDatabase } from '../../context/DatabaseContext';
import { FiX, FiPrinter, FiCheckCircle } from 'react-icons/fi';
import './PrintModal.css';

const THERMAL_PAGE_STYLE = `
    @page {
        size: 80mm auto;
        margin: 0 !important;
    }
    @media print {
        html, body {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
        }
        .print-block {
            page-break-after: always;
            break-after: page;
        }
        .print-block:last-child {
            page-break-after: avoid;
            break-after: avoid;
        }
    }
`;

// Genera HTML completo para impresión silenciosa de la comanda
const buildKitchenHTML = (kitchenTicketHTML) => `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 80mm; }
</style>
</head>
<body>${kitchenTicketHTML}</body>
</html>`;

const PrintModal = ({ sale, onClose, businessInfo }) => {
    const { db } = useDatabase();
    const saleRepo = new SaleRepository(db);

    const ticketOnlyRef  = useRef();
    const kitchenOnlyRef = useRef();
    const bothRef        = useRef(); // ticket + 1 comanda
    const bothTwoRef     = useRef(); // ticket + 2 comandas

    const [activeTab,       setActiveTab]       = useState('ticket');
    const [kitchenEnabled,  setKitchenEnabled]  = useState(false);
    const [kitchenCopies,   setKitchenCopies]   = useState(1);
    const [kitchenPrinter,  setKitchenPrinter]  = useState('');
    const [kitchenCopyDest, setKitchenCopyDest] = useState('kitchen');
    const [ticketPrinter,   setTicketPrinter]   = useState('');
    const [tableInfo,       setTableInfo]       = useState(sale?.table_info || '');
    const [kitchenNotes,    setKitchenNotes]    = useState(sale?.kitchen_notes || '');
    const [printingKitchen, setPrintingKitchen] = useState(false);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const loadSettings = async () => {
            try {
                const kitchenResult  = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_enabled'`);
                const copiesResult   = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_copies'`);
                const printerResult  = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_printer'`);
                const copyDestResult = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'kitchen_copy_dest'`);
                const ticketPrinterResult = await window.electronAPI.database.get(`SELECT value FROM system_settings WHERE key = 'ticket_printer'`);

                setKitchenEnabled(kitchenResult?.value === '1');
                setKitchenCopies(parseInt(copiesResult?.value || '1'));
                setKitchenPrinter(printerResult?.value || '');
                setKitchenCopyDest(copyDestResult?.value || 'kitchen');
                setTicketPrinter(ticketPrinterResult?.value || '');

                await window.electronAPI.database.run(
                    `INSERT OR IGNORE INTO system_settings (key, value) VALUES ('paper_width', '80')`
                );
            } catch {
                setKitchenEnabled(false);
                setKitchenCopies(1);
                setKitchenPrinter('');
                setKitchenCopyDest('kitchen');
            }
        };
        loadSettings();
        return () => {
            document.body.style.overflow = '';
            setTimeout(() => { if (document.body) document.body.focus(); }, 50);
        };
    }, []);

    // FIX: useCallback para evitar stale closure en onAfterPrint
    const handleClose = useCallback(() => {
        document.body.style.overflow = '';
        onClose();
    }, [onClose]);

    const saleWithTable = { ...sale, table_info: tableInfo, kitchen_notes: kitchenNotes };

    // ── Impresión silenciosa a impresora de cocina ────────────────────────────
    const printKitchenSilent = useCallback(async (copies = 1) => {
        if (!kitchenPrinter || !window.electronAPI?.kitchen) return false;
        try {
            setPrintingKitchen(true);
            const kitchenHTML = ReactDOMServer.renderToStaticMarkup(
                <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
            );
            const fullHTML = buildKitchenHTML(kitchenHTML);
            const result = await window.electronAPI.kitchen.printSilent(
                fullHTML, kitchenPrinter, copies
            );
            if (!result?.success) {
                console.warn('[Kitchen] Error impresión silenciosa:', result?.error);
            }
            return result?.success ?? false;
        } catch (err) {
            console.error('[Kitchen] Error:', err);
            return false;
        } finally {
            setPrintingKitchen(false);
        }
    }, [kitchenPrinter, saleWithTable, businessInfo]);

    // ── Impresión silenciosa del ticket ───────────────────────────────────────
    // Solo se usa si el usuario configuró una impresora de tickets en Settings.
    // Renderiza el Ticket como HTML y lo envía al mismo handler print-silent
    // que usa la cocina, pero apuntando a la impresora de tickets.
    const printTicketSilent = useCallback(async () => {
        if (!ticketPrinter || !window.electronAPI?.kitchen) return false;
        try {
            const ticketHTML = ReactDOMServer.renderToStaticMarkup(
                <Ticket sale={sale} businessInfo={businessInfo} />
            );
            const fullHTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; width: 80mm; }
</style>
</head>
<body>${ticketHTML}</body>
</html>`;
            const result = await window.electronAPI.kitchen.printSilent(
                fullHTML, ticketPrinter, 1
            );
            if (!result?.success) {
                console.warn('[Ticket] Error impresión silenciosa:', result?.error);
            }
            return result?.success ?? false;
        } catch (err) {
            console.error('[Ticket] Error:', err);
            return false;
        }
    }, [ticketPrinter, sale, businessInfo]);

    // ── Handlers de impresión ─────────────────────────────────────────────────

    const doPrintTicket = useReactToPrint({
        content:          () => ticketOnlyRef.current,
        documentTitle:    `Nuventa - Ticket ${sale.sale_number}`,
        pageStyle:        THERMAL_PAGE_STYLE,
        removeAfterPrint: true,
        onAfterPrint:     handleClose,
    });

    const doPrintKitchen = useReactToPrint({
        content:          () => kitchenOnlyRef.current,
        documentTitle:    `Nuventa - Comanda ${sale.sale_number}`,
        pageStyle:        THERMAL_PAGE_STYLE,
        removeAfterPrint: true,
        onAfterPrint:     handleClose,
    });

    // Ticket + 1 comanda juntos (para cajero cuando dest=cajero con 1 copia,
    // o dest=split con 2 copias)
    const doPrintBoth = useReactToPrint({
        content:          () => bothRef.current,
        documentTitle:    `Nuventa - Impresión ${sale.sale_number}`,
        pageStyle:        THERMAL_PAGE_STYLE,
        removeAfterPrint: true,
        onAfterPrint:     handleClose,
    });

    // Ticket + 2 comandas juntos (para cajero cuando dest=both_cajero con 2 copias)
    const doPrintBothTwo = useReactToPrint({
        content:          () => bothTwoRef.current,
        documentTitle:    `Nuventa - Impresión ${sale.sale_number}`,
        pageStyle:        THERMAL_PAGE_STYLE,
        removeAfterPrint: true,
        onAfterPrint:     handleClose,
    });

    // ── Guardar mesa/notas antes de imprimir ─────────────────────────────────
    // La venta ya existe en BD (fue creada en PaymentModal). Actualizamos
    // table_info y kitchen_notes para que queden persistidos y se puedan
    // ver al reimprimir desde el historial de ventas.
    const saveKitchenInfo = useCallback(async () => {
        if (!sale?.id) return;
        await saleRepo.updateKitchenInfo(sale.id, tableInfo, kitchenNotes);
    }, [sale?.id, tableInfo, kitchenNotes]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Botón principal inteligente ────────────────────────────────────────────
    //
    // Tabla de comportamiento completa:
    //
    // Sin impresora (o cocina desactivada):
    //   → doPrintTicket()  (user usa botones manuales para la comanda)
    //
    // Con impresora, 1 copia, dest=kitchen:
    //   → printKitchenSilent(1) + doPrintTicket()
    //
    // Con impresora, 1 copia, dest=cajero:
    //   → doPrintBoth()  (ticket + 1 comanda juntos, sin envío automático)
    //
    // Con impresora, 2 copias, dest=both_kitchen:
    //   → printKitchenSilent(2) + doPrintTicket()
    //
    // Con impresora, 2 copias, dest=split:
    //   → printKitchenSilent(1) + doPrintBoth()  (ticket + 1 comanda al cajero)
    //
    // Con impresora, 2 copias, dest=both_cajero:
    //   → doPrintBothTwo()  (ticket + 2 comandas juntos, sin envío automático)
    //
    const handlePrintTicket = async () => {
        // Guardar siempre mesa/notas antes de imprimir
        await saveKitchenInfo();

        if (!kitchenEnabled || !kitchenPrinter) {
            // Sin comanda automática — solo imprimir el ticket
            if (ticketPrinter) {
                await printTicketSilent();
                handleClose();
            } else {
                doPrintTicket();
            }
            return;
        }

        if (kitchenCopies === 1) {
            if (kitchenCopyDest === 'cajero') {
                // Ticket + comanda juntos al cajero
                if (ticketPrinter) {
                    const kitchenHTML = ReactDOMServer.renderToStaticMarkup(
                        <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                    );
                    const ticketHTML = ReactDOMServer.renderToStaticMarkup(
                        <Ticket sale={sale} businessInfo={businessInfo} />
                    );
                    const combined = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; width:80mm; }
  .print-block { page-break-after: always; break-after: page; }
  .print-block:last-child { page-break-after: avoid; break-after: avoid; }
</style></head>
<body>
  <div class="print-block">${ticketHTML}</div>
  <div class="print-block">${kitchenHTML}</div>
</body></html>`;
                    await window.electronAPI.kitchen.printSilent(combined, ticketPrinter, 1);
                    handleClose();
                } else {
                    doPrintBoth();
                }
            } else {
                // Comanda silenciosa a cocina, ticket al cajero
                await printKitchenSilent(1);
                if (ticketPrinter) {
                    await printTicketSilent();
                    handleClose();
                } else {
                    doPrintTicket();
                }
            }
        } else {
            // 2 copias
            if (kitchenCopyDest === 'both_cajero') {
                // Ticket + 2 comandas juntos al cajero
                if (ticketPrinter) {
                    const kHTML = ReactDOMServer.renderToStaticMarkup(<KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />);
                    const tHTML = ReactDOMServer.renderToStaticMarkup(<Ticket sale={sale} businessInfo={businessInfo} />);
                    const combined = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; width:80mm; }
  .print-block { page-break-after: always; break-after: page; }
  .print-block:last-child { page-break-after: avoid; break-after: avoid; }
</style></head>
<body>
  <div class="print-block">${tHTML}</div>
  <div class="print-block">${kHTML}</div>
  <div class="print-block">${kHTML}</div>
</body></html>`;
                    await window.electronAPI.kitchen.printSilent(combined, ticketPrinter, 1);
                    handleClose();
                } else {
                    doPrintBothTwo();
                }
            } else if (kitchenCopyDest === 'split') {
                // 1 comanda silenciosa a cocina + ticket al cajero (con 1 comanda)
                await printKitchenSilent(1);
                if (ticketPrinter) {
                    // Con impresora de ticket: la segunda comanda se imprime junto con el ticket
                    // en la impresora de tickets (ambos silenciosos)
                    const kitchenHTML = ReactDOMServer.renderToStaticMarkup(
                        <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                    );
                    const ticketHTML = ReactDOMServer.renderToStaticMarkup(
                        <Ticket sale={sale} businessInfo={businessInfo} />
                    );
                    const combined = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Courier New',monospace; width:80mm; }
  .print-block { page-break-after: always; break-after: page; }
  .print-block:last-child { page-break-after: avoid; break-after: avoid; }
</style></head>
<body>
  <div class="print-block">${ticketHTML}</div>
  <div class="print-block">${kitchenHTML}</div>
</body></html>`;
                    await window.electronAPI.kitchen.printSilent(combined, ticketPrinter, 1);
                    handleClose();
                } else {
                    doPrintBoth();
                }
            } else {
                // both_kitchen: 2 comandas silenciosas a cocina, ticket al cajero
                await printKitchenSilent(2);
                if (ticketPrinter) {
                    await printTicketSilent();
                    handleClose();
                } else {
                    doPrintTicket();
                }
            }
        }
    };

    // ── Texto del hint de comportamiento ──────────────────────────────────────
    const getBehaviorHint = () => {
        if (!kitchenEnabled || !kitchenPrinter) {
            if (ticketPrinter)
                return `El ticket se enviará automáticamente a "${ticketPrinter}" sin diálogo.`;
            return null;
        }

        const ticketPart = ticketPrinter
            ? `El ticket irá a "${ticketPrinter}".`
            : 'El ticket saldrá por el diálogo de impresión.';

        if (kitchenCopies === 1) {
            if (kitchenCopyDest === 'cajero')
                return `La comanda saldrá junto con el ticket. ${ticketPrinter ? `Ambos a "${ticketPrinter}" automáticamente.` : ''}`;
            return `1 comanda irá automáticamente a "${kitchenPrinter}". ${ticketPart}`;
        }
        if (kitchenCopyDest === 'both_cajero')
            return `2 comandas saldrán con el ticket. ${ticketPrinter ? `Todo a "${ticketPrinter}" automáticamente.` : ''}`;
        if (kitchenCopyDest === 'split')
            return `1 comanda a "${kitchenPrinter}", otra con el ticket. ${ticketPart}`;
        return `2 comandas a "${kitchenPrinter}". ${ticketPart}`;
    };

    const behaviorHint = getBehaviorHint();

    return (
        <div className="pm-overlay" onClick={handleClose}>
            <div className="pm-modal" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="pm-header">
                    <h2 className="pm-title">Vista Previa de Impresión</h2>
                    <button className="pm-close" onClick={handleClose}><FiX /></button>
                </div>

                {/* Tabs */}
                {kitchenEnabled && (
                    <div className="pm-tabs">
                        <button
                            className={`pm-tab ${activeTab === 'ticket' ? 'pm-tab--active' : ''}`}
                            onClick={() => setActiveTab('ticket')}>
                            <span className="pm-tab-icon">🧾</span>
                            <span>Ticket de Venta</span>
                        </button>
                        <button
                            className={`pm-tab ${activeTab === 'kitchen' ? 'pm-tab--active' : ''}`}
                            onClick={() => setActiveTab('kitchen')}>
                            <span className="pm-tab-icon">🍽️</span>
                            <span>Comanda Cocina</span>
                        </button>
                    </div>
                )}

                {/* Campos cocina */}
                {kitchenEnabled && (
                    <div className="pm-kitchen-fields">
                        <div className="pm-field-group">
                            <label className="pm-field-label">🪑 Mesa o nombre del cliente</label>
                            <input
                                type="text"
                                className="pm-field-input"
                                placeholder="Ej: Mesa 5 · Juan · Para llevar"
                                value={tableInfo}
                                onChange={(e) => setTableInfo(e.target.value)}
                                maxLength={50}
                            />
                        </div>
                        <div className="pm-field-group">
                            <label className="pm-field-label">⚠️ Observaciones del pedido</label>
                            <textarea
                                className="pm-field-textarea"
                                placeholder="Ej: Sin sal en las papas · Sin hielo en las bebidas · Término jugoso"
                                value={kitchenNotes}
                                onChange={(e) => setKitchenNotes(e.target.value)}
                                maxLength={200}
                                rows={3}
                            />
                            {kitchenNotes.length > 0 && (
                                <span className="pm-field-counter">{kitchenNotes.length}/200</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Aviso de comportamiento automático */}
                {behaviorHint && (
                    <div className="pm-auto-hint">
                        <span>🖨️</span>
                        <span>{behaviorHint}</span>
                    </div>
                )}

                {/* Preview visible */}
                <div className="pm-body">
                    <div className="pm-preview">
                        <div style={{ display: activeTab === 'ticket' ? 'block' : 'none' }}>
                            <Ticket sale={sale} businessInfo={businessInfo} />
                        </div>
                        {kitchenEnabled && (
                            <div style={{ display: activeTab === 'kitchen' ? 'block' : 'none' }}>
                                <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Contenedores ocultos para impresión ── */}

                {/* Solo ticket */}
                <div style={{ display: 'none' }}>
                    <div ref={ticketOnlyRef}>
                        <Ticket sale={sale} businessInfo={businessInfo} />
                    </div>
                </div>

                {/* Solo comanda(s) — para el botón "Comanda manual" */}
                {kitchenEnabled && (
                    <div style={{ display: 'none' }}>
                        <div ref={kitchenOnlyRef}>
                            <div className="print-block">
                                <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                            </div>
                            {kitchenCopies === 2 && (
                                <div className="print-block">
                                    <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Ticket + 1 comanda (dest=cajero con 1 copia, o dest=split con 2 copias) */}
                {kitchenEnabled && (
                    <div style={{ display: 'none' }}>
                        <div ref={bothRef}>
                            <div className="print-block">
                                <Ticket sale={sale} businessInfo={businessInfo} />
                            </div>
                            <div className="print-block">
                                <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Ticket + 2 comandas (dest=both_cajero con 2 copias) */}
                {kitchenEnabled && kitchenCopies === 2 && (
                    <div style={{ display: 'none' }}>
                        <div ref={bothTwoRef}>
                            <div className="print-block">
                                <Ticket sale={sale} businessInfo={businessInfo} />
                            </div>
                            <div className="print-block">
                                <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                            </div>
                            <div className="print-block">
                                <KitchenTicket sale={saleWithTable} businessInfo={businessInfo} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="pm-footer">
                    <button className="pm-btn pm-btn--ghost" onClick={handleClose}>
                        <FiCheckCircle />
                        <span>Terminar sin imprimir</span>
                    </button>

                    <div className="pm-footer-actions">

                        {/* Botón principal — comportamiento inteligente según configuración */}
                        <button
                            className="pm-btn pm-btn--ticket"
                            onClick={handlePrintTicket}
                            disabled={printingKitchen}
                        >
                            {printingKitchen ? (
                                <><span className="pm-spinner-sm" /><span>Enviando a cocina...</span></>
                            ) : (
                                <><FiPrinter /><span>Imprimir Ticket</span></>
                            )}
                        </button>

                        {/* Botones manuales — solo si cocina activa pero SIN impresora automática */}
                        {kitchenEnabled && !kitchenPrinter && (
                            <>
                                <button className="pm-btn pm-btn--kitchen" onClick={doPrintKitchen}>
                                    <FiPrinter />
                                    <span>
                                        Imprimir Comanda
                                        {kitchenCopies === 2 && (
                                            <span className="pm-copies-badge">×2</span>
                                        )}
                                    </span>
                                </button>
                                <button className="pm-btn pm-btn--both" onClick={doPrintBoth}>
                                    <FiPrinter />
                                    <span>Imprimir Ambos</span>
                                </button>
                            </>
                        )}

                        {/* Comanda manual — siempre disponible cuando hay impresora automática
                            para que el cajero pueda reimprimir si algo falla */}
                        {kitchenEnabled && kitchenPrinter && (
                            <button
                                className="pm-btn pm-btn--kitchen"
                                onClick={doPrintKitchen}
                                title="Reimprimir comanda manualmente"
                                disabled={printingKitchen}
                            >
                                <FiPrinter />
                                <span>Comanda manual</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PrintModal;