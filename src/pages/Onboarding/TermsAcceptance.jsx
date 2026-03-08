// src/pages/Onboarding/TermsAcceptance.jsx
import React, { useState, useRef } from 'react';
import './TermsAcceptance.css';

export default function TermsAcceptance({ onAccepted }) {
    const [activeTab,   setActiveTab]   = useState('terms');
    const [termsRead,   setTermsRead]   = useState(false);
    const [privacyRead, setPrivacyRead] = useState(false);
    const [checked,     setChecked]     = useState(false);
    const [loading,     setLoading]     = useState(false);

    const termsRef   = useRef(null);
    const privacyRef = useRef(null);

    const handleScroll = (ref, type) => {
        const el = ref.current;
        if (!el) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
            if (type === 'terms')   setTermsRead(true);
            if (type === 'privacy') setPrivacyRead(true);
        }
    };

    const canAccept = termsRead && privacyRead && checked;

    const handleAccept = async () => {
        if (!canAccept) return;
        setLoading(true);
        try {
            await window.electronAPI.invoke('terms:accept');
            onAccepted();
        } catch {
            onAccepted();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ta-container">
            <div className="ta-box">

                <div className="ta-header">
                    <h1 className="ta-brand">Nu<span className="ta-brand-v">v</span>enta</h1>
                    <p className="ta-title">Términos y Condiciones de Uso</p>
                    <p className="ta-subtitle">Por favor lee y acepta los siguientes documentos antes de continuar.</p>
                </div>

                <div className="ta-tabs">
                    <button
                        className={`ta-tab ${activeTab === 'terms' ? 'ta-tab--active' : ''}`}
                        onClick={() => setActiveTab('terms')}
                    >
                        📄 Términos y Condiciones
                        {termsRead && <span className="ta-tab-check">✓</span>}
                    </button>
                    <button
                        className={`ta-tab ${activeTab === 'privacy' ? 'ta-tab--active' : ''}`}
                        onClick={() => setActiveTab('privacy')}
                    >
                        🔒 Política de Privacidad
                        {privacyRead && <span className="ta-tab-check">✓</span>}
                    </button>
                </div>

                {!termsRead && activeTab === 'terms' && (
                    <div className="ta-read-hint">↓ Desplázate hasta el final para continuar</div>
                )}
                {!privacyRead && activeTab === 'privacy' && (
                    <div className="ta-read-hint">↓ Desplázate hasta el final para continuar</div>
                )}

                <div
                    className={`ta-content ${activeTab === 'terms' ? '' : 'ta-content--hidden'}`}
                    ref={termsRef}
                    onScroll={() => handleScroll(termsRef, 'terms')}
                >
                    <TermsContent />
                </div>

                <div
                    className={`ta-content ${activeTab === 'privacy' ? '' : 'ta-content--hidden'}`}
                    ref={privacyRef}
                    onScroll={() => handleScroll(privacyRef, 'privacy')}
                >
                    <PrivacyContent />
                </div>

                <div className="ta-footer">
                    <div className="ta-progress">
                        <span className={`ta-progress-item ${termsRead ? 'done' : ''}`}>
                            {termsRead ? '✓' : '○'} Términos leídos
                        </span>
                        <span className="ta-progress-sep">·</span>
                        <span className={`ta-progress-item ${privacyRead ? 'done' : ''}`}>
                            {privacyRead ? '✓' : '○'} Privacidad leída
                        </span>
                    </div>

                    <label className={`ta-checkbox-label ${!termsRead || !privacyRead ? 'ta-checkbox-label--disabled' : ''}`}>
                        <input
                            type="checkbox"
                            className="ta-checkbox"
                            checked={checked}
                            disabled={!termsRead || !privacyRead}
                            onChange={e => setChecked(e.target.checked)}
                        />
                        <span>
                            He leído y acepto los <strong>Términos y Condiciones</strong> y la <strong>Política de Privacidad</strong> de Nuventa.
                        </span>
                    </label>

                    <button
                        className="ta-btn-accept"
                        disabled={!canAccept || loading}
                        onClick={handleAccept}
                    >
                        {loading ? 'Guardando...' : 'Aceptar y continuar →'}
                    </button>

                    <p className="ta-legal-note">
                        Al aceptar, confirmas que eres mayor de edad y tienes autoridad para obligar a tu empresa con estos términos.
                        Nuventa es desarrollado por Redinvierte SpA · RUT 77.900.539-9 · soporte@nuventa.cl
                    </p>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// TÉRMINOS Y CONDICIONES
// ============================================================================
function TermsContent() {
    return (
        <div className="ta-legal-text">
            <h2>Términos y Condiciones de Uso — Nuventa</h2>
            <p><strong>Última actualización:</strong> Enero 2026</p>
            <p>
                Los presentes Términos y Condiciones (en adelante "los Términos") regulan el acceso y uso del sitio web www.nuventa.cl y la adquisición del software Nuventa, operado por Redinvierte SpA (en adelante "Nuventa"). Al realizar una compra o acceder al software, el usuario (en adelante "el Licenciatario") acepta íntegramente estos Términos. Si no los acepta, no debe adquirir ni utilizar el software.
            </p>

            <h3>1. Definiciones</h3>
            <ul>
                <li><strong>Software:</strong> la aplicación Nuventa en su versión para escritorio (Windows, Mac y Linux), incluyendo todas sus actualizaciones durante el período de soporte.</li>
                <li><strong>Licencia:</strong> el derecho de uso no exclusivo, intransferible y para un único equipo, otorgado al Licenciatario tras el pago correspondiente.</li>
                <li><strong>Clave de licencia:</strong> el código único entregado por email que permite activar el software en un computador.</li>
                <li><strong>Licenciatario:</strong> la persona natural o jurídica que adquiere y activa una licencia de Nuventa.</li>
                <li><strong>Redinvierte SpA:</strong> empresa titular del software, RUT 77.900.539-9, responsable del sitio www.nuventa.cl.</li>
            </ul>

            <h3>2. Objeto del contrato</h3>
            <p>
                Mediante la aceptación de estos Términos y el pago del precio establecido, Nuventa otorga al Licenciatario una licencia de uso perpetuo, no exclusiva e intransferible del software para ser instalado y utilizado en un único computador de su propiedad o bajo su control.
            </p>
            <p>
                Esta licencia no implica la transferencia de propiedad intelectual del software. Nuventa y Redinvierte SpA conservan todos los derechos de propiedad intelectual sobre el software, incluyendo su código fuente, diseño, marca y documentación.
            </p>

            <h3>3. Condiciones de la licencia</h3>
            <h4>3.1 Lo que puedes hacer</h4>
            <ul>
                <li>Instalar y usar el software en un único computador.</li>
                <li>Realizar copias de respaldo del instalador para uso personal.</li>
                <li>Usar el software para gestionar tu negocio de forma interna.</li>
            </ul>
            <h4>3.2 Lo que no puedes hacer</h4>
            <ul>
                <li>Instalar la misma clave de licencia en más de un computador.</li>
                <li>Ceder, vender, sublicenciar, arrendar o transferir la licencia a un tercero.</li>
                <li>Copiar, distribuir, reproducir o compartir el software o la clave de licencia.</li>
                <li>Realizar ingeniería inversa, descompilar o modificar el software.</li>
                <li>Usar el software para actividades ilegales, fraudulentas o que violen la normativa chilena vigente.</li>
                <li>Eliminar o alterar cualquier aviso de derechos de autor o marca incluido en el software.</li>
            </ul>
            <h4>3.3 Licencia por equipo y transferencias</h4>
            <p>
                La licencia queda vinculada al computador donde se activa mediante un identificador de hardware único. Si deseas trasladar la licencia a otro equipo, puedes hacerlo directamente desde la aplicación, con un límite de 3 transferencias por año calendario. En caso de falla de hardware comprobada que impida usar el proceso de transferencia normal, contacta a soporte@nuventa.cl para asistencia sin costo adicional.
            </p>

            <h3>4. Precio, pago y facturación</h3>
            <p>
                El precio de la licencia es el indicado en el sitio web al momento de la compra, expresado en pesos chilenos (CLP) con IVA incluido. Los pagos son procesados por Flow Pagos Chile SpA mediante tarjeta de crédito, débito, Webpay y otros medios disponibles. El comprobante emitido por Flow tiene validez de boleta electrónica conforme a la Resolución Exenta SII N° 176 de 2020.
            </p>

            <h3>5. Entrega de la licencia</h3>
            <p>
                Una vez confirmado el pago, Nuventa enviará la clave de licencia al correo electrónico proporcionado, en un plazo máximo de 24 horas hábiles. En la mayoría de los casos la entrega es inmediata. Si no recibes tu clave, revisa tu carpeta de spam y luego contacta a soporte@nuventa.cl con el número de orden.
            </p>

            <h3>6. Política de reembolso</h3>
            <p>
                Dado que Nuventa es un software digital entregado de forma inmediata, no se aplica derecho a retracto conforme al artículo 3 bis letra b) de la Ley N° 19.496. Sin perjuicio de ello, Nuventa evaluará reembolsos en casos de error técnico grave imputable exclusivamente a Nuventa no resuelto en plazo razonable, o cobro duplicado. Solicitudes dentro de los 10 días siguientes a la compra a soporte@nuventa.cl.
            </p>

            <h3>7. Soporte técnico y actualizaciones</h3>
            <p>
                Con la compra de la licencia el Licenciatario tiene derecho a soporte técnico por email durante el primer año desde la fecha de compra, a través de soporte@nuventa.cl, y a las actualizaciones del software publicadas durante ese mismo período. Nuventa procurará responder dentro de los 3 días hábiles siguientes.
            </p>
            <p>
                Transcurrido el primer año, el software continúa funcionando indefinidamente sin costo adicional, pero el acceso a nuevas actualizaciones y soporte requiere la renovación anual opcional al precio vigente.
            </p>

            <h3>8. Alcance del software — sin integración con el SII</h3>
            <p>
                Nuventa es un sistema de gestión interna de ventas, inventario y clientes. No tiene integración con el Servicio de Impuestos Internos (SII) de Chile y no emite boletas electrónicas, facturas electrónicas ni ningún otro documento tributario electrónico. El Licenciatario es responsable de cumplir con sus obligaciones tributarias de forma independiente.
            </p>

            <h3>9. Propiedad intelectual</h3>
            <p>
                El software Nuventa, incluyendo su código fuente, diseño, logotipos, nombre comercial y documentación, es propiedad exclusiva de Redinvierte SpA y está protegido por la Ley N° 17.336 sobre Propiedad Intelectual de Chile y los tratados internacionales aplicables. Queda estrictamente prohibida su reproducción, distribución o modificación sin autorización escrita de Redinvierte SpA.
            </p>

            <h3>10. Limitación de responsabilidad</h3>
            <p>Nuventa no se hace responsable de:</p>
            <ul>
                <li>Pérdida de datos por mal uso del software, fallas de hardware o del sistema operativo del Licenciatario.</li>
                <li>Lucro cesante, daño indirecto o consecuencial derivado del uso o imposibilidad de uso del software.</li>
                <li>Incompatibilidades causadas por actualizaciones del sistema operativo realizadas después de la compra.</li>
                <li>Decisiones comerciales tomadas con base en la información generada por el software.</li>
            </ul>
            <p>En ningún caso la responsabilidad total de Nuventa excederá el monto efectivamente pagado por la licencia.</p>

            <h3>11. Terminación de la licencia</h3>
            <p>Nuventa podrá revocar la licencia sin reembolso en caso de uso en más de un equipo, distribución no autorizada, ingeniería inversa o cualquier uso que infrinja la legislación chilena vigente.</p>

            <h3>12. Legislación aplicable y jurisdicción</h3>
            <p>
                Estos Términos se rigen por las leyes de la República de Chile, incluyendo la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores y la Ley N° 17.336 sobre Propiedad Intelectual. Para la resolución de controversias, las partes se someten a los Tribunales Ordinarios de Justicia de Chile, sin perjuicio del derecho del consumidor a recurrir al SERNAC o a los Juzgados de Policía Local.
            </p>

            <h3>13. Modificaciones a los Términos</h3>
            <p>
                Nuventa puede modificar estos Términos en cualquier momento. Los cambios serán publicados en www.nuventa.cl/terminos. Las compras realizadas antes de la modificación se regirán por los Términos vigentes al momento de la compra.
            </p>

            <h3>14. Contacto</h3>
            <p>soporte@nuventa.cl · www.nuventa.cl · Redinvierte SpA · RUT 77.900.539-9 · Santiago, Chile</p>

            <p className="ta-end-marker">— Fin de los Términos y Condiciones —</p>
        </div>
    );
}

// ============================================================================
// POLÍTICA DE PRIVACIDAD
// ============================================================================
function PrivacyContent() {
    return (
        <div className="ta-legal-text">
            <h2>Política de Privacidad — Nuventa</h2>
            <p><strong>Última actualización:</strong> Enero 2026</p>
            <p>
                En Nuventa, operado por Redinvierte SpA (en adelante "Nuventa", "nosotros" o "el Responsable"), nos comprometemos a proteger tus datos personales conforme a la Ley N° 19.628 sobre Protección de la Vida Privada y a la Ley N° 21.719 sobre Protección y Tratamiento de Datos Personales (vigente a partir del 1 de diciembre de 2026), así como a las demás normas aplicables en Chile. Esta política explica qué datos recopilamos, para qué los usamos, cómo los protegemos y cuáles son tus derechos.
            </p>

            <h3>1. Identidad del Responsable de Datos</h3>
            <p>El responsable del tratamiento de tus datos personales es:</p>
            <ul>
                <li><strong>Razón social:</strong> Redinvierte SpA</li>
                <li><strong>RUT:</strong> 77.900.539-9</li>
                <li><strong>Nombre comercial:</strong> Nuventa</li>
                <li><strong>Sitio web:</strong> www.nuventa.cl</li>
                <li><strong>Correo para datos personales:</strong> privacidad@nuventa.cl</li>
                <li><strong>Correo de soporte general:</strong> soporte@nuventa.cl</li>
            </ul>

            <h3>2. Datos personales que recopilamos</h3>
            <p>Recopilamos únicamente los datos necesarios para los fines descritos en esta política.</p>

            <h4>2.1 Datos que tú nos proporcionas directamente</h4>
            <ul>
                <li>Nombre completo</li>
                <li>RUN (Rol Único Nacional)</li>
                <li>Dirección de correo electrónico</li>
                <li>Número de teléfono</li>
                <li>Dirección IP (registrada automáticamente al usar el sitio)</li>
            </ul>

            <h4>2.2 Datos recopilados por la aplicación de escritorio</h4>
            <p>
                La aplicación Nuventa genera un identificador de hardware (fingerprint) mediante un hash SHA-256 de características del equipo (procesador, placa madre y dirección MAC de red). Este hash es unidireccional — no permite reconstruir la información original del hardware — y se usa exclusivamente para vincular la licencia al equipo autorizado y prevenir el uso simultáneo no autorizado en múltiples equipos.
            </p>
            <p>
                Todos los datos operacionales de tu negocio (ventas, clientes, productos, inventario, etc.) se almacenan exclusivamente en una base de datos local en tu equipo. Redinvierte SpA no tiene acceso a estos datos en ningún momento.
            </p>

            <h4>2.3 Datos procesados por terceros en tu nombre</h4>
            <p>
                Los datos de tu tarjeta de crédito, débito u otros medios de pago no son almacenados por Nuventa. El procesamiento del pago es realizado directamente por Flow Pagos Chile SpA (www.flow.cl), sujeto a sus propias políticas de privacidad y seguridad. Flow, al procesar pagos con tarjeta, envía automáticamente la información de la transacción al SII, lo que genera un comprobante con validez tributaria conforme a la Resolución Exenta SII N° 176 de 2020.
            </p>

            <h3>3. Finalidad del tratamiento</h3>
            <p>Utilizamos tus datos personales exclusivamente para las siguientes finalidades:</p>
            <ul>
                <li>Procesar tu compra y generar la licencia de software correspondiente.</li>
                <li>Enviarte tu clave de licencia y documentación por correo electrónico.</li>
                <li>Brindarte soporte técnico cuando lo solicites.</li>
                <li>Enviarte comunicaciones relacionadas con actualizaciones o cambios importantes en el producto (no publicidad no solicitada).</li>
                <li>Cumplir con obligaciones legales y tributarias aplicables en Chile.</li>
                <li>Verificar la identidad del titular de la licencia en caso de disputas o solicitudes de recuperación de cuenta.</li>
            </ul>
            <p>No utilizaremos tus datos para fines distintos a los indicados anteriormente sin tu consentimiento previo y expreso.</p>

            <h3>4. Base de legitimación del tratamiento</h3>
            <ul>
                <li><strong>Ejecución de un contrato:</strong> el tratamiento es necesario para cumplir con la compra de la licencia y entregarte el software.</li>
                <li><strong>Cumplimiento de obligaciones legales:</strong> para cumplir con normas tributarias chilenas aplicables.</li>
                <li><strong>Interés legítimo:</strong> para brindarte soporte técnico y mejorar nuestro servicio.</li>
            </ul>

            <h3>5. Plazo de conservación de los datos</h3>
            <p>Conservamos tus datos personales durante el tiempo necesario para los fines indicados y conforme a los plazos legales exigidos en Chile:</p>
            <ul>
                <li><strong>Datos de compra y licencia:</strong> mínimo 6 años, conforme a la normativa tributaria del SII.</li>
                <li><strong>Datos de soporte:</strong> mientras mantengas una licencia activa y hasta 2 años después.</li>
                <li><strong>Datos eliminados a solicitud:</strong> serán eliminados dentro de 30 días hábiles, salvo obligación legal de conservarlos.</li>
            </ul>

            <h3>6. Comunicación de datos a terceros</h3>
            <p>No vendemos ni cedemos tus datos personales a terceros con fines comerciales. Solo compartimos información en los siguientes casos:</p>
            <ul>
                <li><strong>Flow Pagos Chile SpA:</strong> para procesar el pago de manera segura.</li>
                <li><strong>Resend (proveedor de envío de email):</strong> para enviarte tu licencia y comunicaciones transaccionales. Solo recibe tu dirección de correo electrónico.</li>
                <li><strong>Autoridades públicas:</strong> cuando sea requerido por ley, resolución judicial o fiscalización del SII u otro organismo competente.</li>
            </ul>
            <p>Todos los terceros con los que trabajamos están obligados contractualmente a tratar tus datos con confidencialidad y conforme a la legislación aplicable.</p>

            <h3>7. Medidas de seguridad</h3>
            <p>Implementamos medidas técnicas y organizativas razonables para proteger tus datos personales contra acceso no autorizado, pérdida, alteración o divulgación indebida:</p>
            <ul>
                <li>Comunicaciones cifradas mediante HTTPS/TLS.</li>
                <li>Almacenamiento de contraseñas con algoritmos de hashing seguros (bcrypt).</li>
                <li>Acceso restringido a los datos solo al personal autorizado de Nuventa.</li>
                <li>No almacenamos datos de tarjetas de pago en nuestros servidores.</li>
                <li>Los datos operacionales del negocio permanecen únicamente en el equipo del Licenciatario.</li>
            </ul>
            <p>En caso de una brecha de seguridad que pueda afectar tus datos, te notificaremos conforme a los plazos y procedimientos establecidos por la Ley N° 21.719.</p>

            <h3>8. Tus derechos como titular de datos</h3>
            <p>Conforme a la Ley N° 19.628 y la Ley N° 21.719, tienes los siguientes derechos respecto de tus datos personales:</p>
            <ul>
                <li><strong>Acceso:</strong> solicitar confirmación de si tratamos tus datos y obtener una copia de ellos.</li>
                <li><strong>Rectificación:</strong> corregir datos incorrectos, incompletos o desactualizados.</li>
                <li><strong>Cancelación o eliminación:</strong> solicitar que eliminemos tus datos cuando ya no sean necesarios, salvo que exista obligación legal de conservarlos.</li>
                <li><strong>Oposición:</strong> oponerte al tratamiento de tus datos en determinadas circunstancias.</li>
                <li><strong>Portabilidad:</strong> recibir tus datos en formato estructurado y de uso común.</li>
                <li><strong>Revocación del consentimiento:</strong> cuando el tratamiento se base en tu consentimiento, puedes retirarlo en cualquier momento.</li>
            </ul>
            <p>Para ejercer cualquiera de estos derechos, escríbenos a privacidad@nuventa.cl con tu nombre completo, RUN y descripción de la solicitud. Responderemos dentro de los plazos establecidos por la ley.</p>

            <h3>9. Cookies y tecnologías similares</h3>
            <p>
                Nuventa puede utilizar cookies técnicas estrictamente necesarias para el funcionamiento del sitio (por ejemplo, mantener tu sesión activa). No utilizamos cookies de seguimiento publicitario ni compartimos datos de navegación con redes publicitarias. La aplicación de escritorio no utiliza cookies. Puedes configurar tu navegador para rechazar las cookies, aunque esto puede afectar el funcionamiento de algunas partes del sitio.
            </p>

            <h3>10. Menores de edad</h3>
            <p>
                Nuventa no está dirigido a menores de 18 años. No recopilamos intencionalmente datos personales de menores. Si tienes conocimiento de que un menor nos ha proporcionado sus datos sin autorización de sus padres o tutores, contáctanos a privacidad@nuventa.cl para proceder a su eliminación.
            </p>

            <h3>11. Transferencias internacionales de datos</h3>
            <p>
                Algunos de nuestros proveedores de servicios (como el servicio de envío de email) pueden operar desde servidores ubicados fuera de Chile. En esos casos, nos aseguramos de que dichos proveedores ofrezcan garantías adecuadas de protección conforme a la legislación chilena, incluyendo cláusulas contractuales de confidencialidad.
            </p>

            <h3>12. Modificaciones a esta política</h3>
            <p>
                Podemos actualizar esta política periódicamente para reflejar cambios en nuestra práctica o en la legislación. Cuando realicemos cambios significativos, te lo notificaremos por email o mediante un aviso visible en el sitio web. La versión vigente siempre estará disponible en www.nuventa.cl/privacidad.
            </p>
            <p>El uso continuado de nuestros servicios después de cualquier modificación implica tu aceptación de la nueva versión.</p>

            <h3>13. Contacto y reclamaciones</h3>
            <p>Para cualquier consulta, solicitud o reclamación sobre el tratamiento de tus datos personales, contáctanos en:</p>
            <p>privacidad@nuventa.cl · www.nuventa.cl · Redinvierte SpA · RUT 77.900.539-9</p>
            <p>
                Si no recibes respuesta satisfactoria, tienes derecho a presentar un reclamo ante la Agencia de Protección de Datos Personales una vez que esta entre en funciones (a partir de diciembre de 2026), conforme a la Ley N° 21.719.
            </p>

            <p className="ta-end-marker">— Fin de la Política de Privacidad —</p>
        </div>
    );
}