import React, { useRef, useState, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import Ticket from './Ticket';
import KitchenTicket from './KitchenTicket';
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
        /* Cada ticket en su propia "página" de rollo */
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

const PrintModal = ({ sale, onClose, businessInfo }) => {
    // ── Un solo ref que agrupa TODO lo que se imprime ──
    const ticketOnlyRef   = useRef();   // solo ticket
    const kitchenOnlyRef  = useRef();   // solo comanda(s)
    const bothRef         = useRef();   // ticket + comanda(s)

    const [activeTab,      setActiveTab]      = useState('ticket');
    const [kitchenEnabled, setKitchenEnabled] = useState(false);
    const [kitchenCopies,  setKitchenCopies]  = useState(1);
    const [tableInfo,      setTableInfo]      = useState(sale?.table_info || '');
    const [kitchenNotes,   setKitchenNotes]   = useState(sale?.kitchen_notes || '');

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        const loadSettings = async () => {
            try {
                const kitchenResult = await window.electronAPI.database.get(
                    `SELECT value FROM system_settings WHERE key = 'kitchen_enabled'`
                );
                setKitchenEnabled(kitchenResult?.value === '1');

                const copiesResult = await window.electronAPI.database.get(
                    `SELECT value FROM system_settings WHERE key = 'kitchen_copies'`
                );
                setKitchenCopies(parseInt(copiesResult?.value || '1'));

                await window.electronAPI.database.run(
                    `INSERT OR IGNORE INTO system_settings (key, value)
                     VALUES ('paper_width', '80')`
                );
            } catch {
                setKitchenEnabled(false);
                setKitchenCopies(1);
            }
        };
        loadSettings();
        return () => {
            document.body.style.overflow = '';
            setTimeout(() => { if (document.body) document.body.focus(); }, 50);
        };
    }, []);

    const handleClose = () => {
        document.body.style.overflow = '';
        onClose();
    };

    const saleWithTable = { ...sale, table_info: tableInfo, kitchen_notes: kitchenNotes };

    // ── UN SOLO diálogo por botón ─────────────────────────────────────────────

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

    const doPrintBoth = useReactToPrint({
        content:          () => bothRef.current,
        documentTitle:    `Nuventa - Impresión ${sale.sale_number}`,
        pageStyle:        THERMAL_PAGE_STYLE,
        removeAfterPrint: true,
        onAfterPrint:     handleClose,
    });

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

                {/* ── Contenedores ocultos para impresión ──────────────────────────────── */}
                {/* Solo ticket */}
                <div style={{ display: 'none' }}>
                    <div ref={ticketOnlyRef}>
                        <Ticket sale={sale} businessInfo={businessInfo} />
                    </div>
                </div>

                {/* Solo comanda(s) — repetida según kitchenCopies */}
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

                {/* Ticket + comanda(s) combinados */}
                {kitchenEnabled && (
                    <div style={{ display: 'none' }}>
                        <div ref={bothRef}>
                            <div className="print-block">
                                <Ticket sale={sale} businessInfo={businessInfo} />
                            </div>
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

                {/* Footer */}
                <div className="pm-footer">
                    <button className="pm-btn pm-btn--ghost" onClick={handleClose}>
                        <FiCheckCircle />
                        <span>Terminar sin imprimir</span>
                    </button>

                    <div className="pm-footer-actions">
                        <button className="pm-btn pm-btn--ticket" onClick={doPrintTicket}>
                            <FiPrinter />
                            <span>Imprimir Ticket</span>
                        </button>

                        {kitchenEnabled && (
                            <button className="pm-btn pm-btn--kitchen" onClick={doPrintKitchen}>
                                <FiPrinter />
                                <span>
                                    Imprimir Comanda
                                    {kitchenCopies === 2 && (
                                        <span className="pm-copies-badge">×2</span>
                                    )}
                                </span>
                            </button>
                        )}

                        {kitchenEnabled && (
                            <button className="pm-btn pm-btn--both" onClick={doPrintBoth}>
                                <FiPrinter />
                                <span>Imprimir Ambos</span>
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PrintModal;