// Email Service - Resend integration for Legado San José
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Email sender - use onboarding@resend.dev for testing, later switch to pedidos@legadosanjose.com
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Legado San José <onboarding@resend.dev>';
const BUSINESS_EMAIL = 'legadosanjosemx@gmail.com';
const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || BUSINESS_EMAIL;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function formatOrderId(order) {
    if (order.order_number) return `LSJ-${String(order.order_number).padStart(5, '0')}`;
    return order.id || 'N/A';
}

/**
 * Send order confirmation email to customer
 */
async function sendOrderConfirmation(order) {
    if (!process.env.RESEND_API_KEY) {
        console.log('RESEND_API_KEY not configured, skipping customer email');
        return;
    }

    const customerEmail = order.customer?.email;
    if (!customerEmail) {
        console.log('No customer email, skipping confirmation');
        return;
    }

    const itemsHtml = (order.items || []).map(item => `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ' - Talla: ' + item.size : ''}${item.variant ? ' - Color: ' + item.variant : ''}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price || 0).toLocaleString('es-MX')} MXN</td>
        </tr>
    `).join('');

    const address = order.customer?.address || {};
    const addressStr = address.line1
        ? `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postal_code || ''}`
        : '';

    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; text-align: center;">
            <h1 style="color: #F5A84F; font-size: 24px; margin: 0; letter-spacing: 3px;">LEGADO SAN JOSÉ</h1>
        </div>

        <div style="padding: 30px; background: #fff;">
            <h2 style="color: #1a1a1a; margin-top: 0;">¡Gracias por tu compra!</h2>
            <p>Hola ${order.customer?.name || 'Cliente'},</p>
            <p>Hemos recibido tu pedido correctamente. Aquí están los detalles:</p>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #888;">Número de pedido</p>
                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #F5A84F;">${order.id}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #888;">Producto</th>
                        <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #888;">Cant.</th>
                        <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: #888;">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div style="text-align: right; margin: 16px 0; padding-top: 12px; border-top: 2px solid #1a1a1a;">
                ${order.shipping ? `<p style="margin: 4px 0; color: #666;">Envío: $${order.shipping.toLocaleString('es-MX')} MXN</p>` : ''}
                <p style="font-size: 18px; font-weight: 700; margin: 8px 0;">Total: $${(order.total || 0).toLocaleString('es-MX')} MXN</p>
            </div>

            ${addressStr ? `
            <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-weight: 600;">Dirección de envío:</p>
                <p style="margin: 0; color: #666;">${addressStr}</p>
                ${order.customer?.phone ? `<p style="margin: 8px 0 0; color: #666;">Tel: ${order.customer.phone}</p>` : ''}
            </div>
            ` : ''}

            ${order.customer?.rfc ? `
            <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 4px; font-weight: 600;">Datos de facturación:</p>
                <p style="margin: 0; color: #666;">RFC: ${order.customer.rfc}</p>
            </div>
            ` : ''}

            <p style="color: #666; font-size: 14px; margin-top: 24px;">
                Si tienes alguna duda sobre tu pedido, escríbenos a
                <a href="mailto:legadosanjosemx@gmail.com" style="color: #F5A84F;">legadosanjosemx@gmail.com</a>
            </p>
        </div>

        <div style="background: #1a1a1a; padding: 20px; text-align: center;">
            <p style="color: #888; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Legado San José. Todos los derechos reservados.</p>
        </div>
    </div>
    `;

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: [customerEmail],
            reply_to: REPLY_TO_EMAIL,
            subject: `Confirmación de pedido ${order.id} - Legado San José`,
            html
        });
        console.log('Email de confirmación enviado a:', customerEmail);
    } catch (error) {
        console.error('Error enviando email de confirmación:', error);
    }
}

/**
 * Send order notification email to business
 */
async function sendOrderNotification(order) {
    if (!process.env.RESEND_API_KEY) {
        console.log('RESEND_API_KEY not configured, skipping notification email');
        return;
    }

    const itemsHtml = (order.items || []).map(item => `
        <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.name}${item.size ? ' - Talla: ' + item.size : ''}${item.variant ? ' - Color: ' + item.variant : ''}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price || 0).toLocaleString('es-MX')} MXN</td>
        </tr>
    `).join('');

    const address = order.customer?.address || {};
    const addressStr = address.line1
        ? `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postal_code || ''}`
        : '';

    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; text-align: center;">
            <h1 style="color: #F5A84F; font-size: 24px; margin: 0; letter-spacing: 3px;">LEGADO SAN JOSÉ</h1>
        </div>

        <div style="padding: 30px; background: #fff;">
            <h2 style="color: #1a1a1a; margin-top: 0;">Nueva Venta Recibida</h2>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #888;">Número de pedido</p>
                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #F5A84F;">${order.id}</p>
            </div>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-weight: 600;">Datos del cliente:</p>
                <p style="margin: 4px 0; color: #666;"><strong>Nombre:</strong> ${order.customer?.name || 'N/A'}</p>
                <p style="margin: 4px 0; color: #666;"><strong>Email:</strong> ${order.customer?.email || 'N/A'}</p>
                ${order.customer?.phone ? `<p style="margin: 4px 0; color: #666;"><strong>Teléfono:</strong> ${order.customer.phone}</p>` : ''}
                ${order.customer?.rfc ? `<p style="margin: 4px 0; color: #666;"><strong>RFC:</strong> ${order.customer.rfc}</p>` : ''}
            </div>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 10px 12px; text-align: left; font-size: 13px; color: #888;">Producto</th>
                        <th style="padding: 10px 12px; text-align: center; font-size: 13px; color: #888;">Cant.</th>
                        <th style="padding: 10px 12px; text-align: right; font-size: 13px; color: #888;">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div style="text-align: right; margin: 16px 0; padding-top: 12px; border-top: 2px solid #1a1a1a;">
                ${order.shipping ? `<p style="margin: 4px 0; color: #666;">Envío: $${order.shipping.toLocaleString('es-MX')} MXN</p>` : ''}
                <p style="font-size: 18px; font-weight: 700; margin: 8px 0;">Total: $${(order.total || 0).toLocaleString('es-MX')} MXN</p>
            </div>

            ${addressStr ? `
            <div style="background: #f9f9f9; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-weight: 600;">Dirección de envío:</p>
                <p style="margin: 0; color: #666;">${addressStr}</p>
                ${order.customer?.phone ? `<p style="margin: 8px 0 0; color: #666;">Tel: ${order.customer.phone}</p>` : ''}
            </div>
            ` : ''}

            <p style="margin-top: 24px; text-align: center;">
                <a href="${BASE_URL}/admin/" style="background: #F5A84F; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                    Ver en Admin Panel
                </a>
            </p>
        </div>

        <div style="background: #1a1a1a; padding: 20px; text-align: center;">
            <p style="color: #888; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Legado San José. Todos los derechos reservados.</p>
        </div>
    </div>
    `;

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: [BUSINESS_EMAIL],
            subject: `Nueva venta: ${order.id} - $${(order.total || 0).toLocaleString('es-MX')} MXN`,
            html
        });
        console.log('Email de notificación enviado a:', BUSINESS_EMAIL);
    } catch (error) {
        console.error('Error enviando email de notificación:', error);
    }
}

/**
 * Send status update email to customer
 */
async function sendStatusUpdate(order, newStatus) {
    if (!process.env.RESEND_API_KEY) return;

    const customerEmail = order.customer?.email;
    if (!customerEmail) return;

    const statusMessages = {
        'procesado': 'Tu pedido está siendo procesado.',
        'enviado': `Tu pedido ha sido enviado.${order.tracking_number ? ' Número de rastreo: ' + order.tracking_number : ''}`,
        'entregado': 'Tu pedido ha sido entregado. ¡Gracias por tu compra!'
    };

    const message = statusMessages[newStatus];
    if (!message) return;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; text-align: center;">
            <h1 style="color: #F5A84F; font-size: 24px; margin: 0; letter-spacing: 3px;">LEGADO SAN JOSÉ</h1>
        </div>
        <div style="padding: 30px;">
            <h2>Actualización de tu pedido</h2>
            <p>Hola ${order.customer?.name || 'Cliente'},</p>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; color: #888; font-size: 14px;">Pedido ${formatOrderId(order)}</p>
                <p style="margin: 8px 0 0; font-size: 18px; font-weight: 700; color: #F5A84F;">${newStatus.toUpperCase()}</p>
            </div>

            <p>${message}</p>

            <p style="color: #666; font-size: 14px;">
                Si tienes alguna duda, escríbenos a
                <a href="mailto:legadosanjosemx@gmail.com" style="color: #F5A84F;">legadosanjosemx@gmail.com</a>
            </p>
        </div>
        <div style="background: #1a1a1a; padding: 20px; text-align: center;">
            <p style="color: #888; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} Legado San José.</p>
        </div>
    </div>
    `;

    try {
        await resend.emails.send({
            from: FROM_EMAIL,
            to: [customerEmail],
            reply_to: REPLY_TO_EMAIL,
            subject: `Tu pedido ${order.id} - ${newStatus.toUpperCase()} | Legado San José`,
            html
        });
        console.log('Email de actualización enviado a:', customerEmail);
    } catch (error) {
        console.error('Error enviando email de actualización:', error);
    }
}

module.exports = { sendOrderConfirmation, sendOrderNotification, sendStatusUpdate };
