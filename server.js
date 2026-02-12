// Backend Node.js para Legado San José
// Este servidor maneja los pagos con Stripe y gestiona los pedidos

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Import API and Database
const { supabaseAdmin } = require('./lib/supabase');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// --- Maintenance Mode Middleware ---
let maintenanceMode = false;
let lastCheck = 0;
const CACHE_TTL = 5000; // 5 seconds for better responsiveness during setup

async function checkMaintenanceStatus() {
    const now = Date.now();
    if (now - lastCheck < CACHE_TTL) return maintenanceMode;

    try {
        if (supabaseAdmin) {
            const { data, error } = await supabaseAdmin
                .from('site_content')
                .select('content')
                .eq('section', 'settings')
                .eq('key', 'maintenance_mode')
                .single();

            if (!error && data) {
                maintenanceMode = data.content === 'true';
            } else if (error && error.code === 'PGRST116') {
                console.log('Maintenance mode setting not found, initializing...');
                await supabaseAdmin
                    .from('site_content')
                    .insert({ section: 'settings', key: 'maintenance_mode', content: 'false' });
                maintenanceMode = false;
            }
        }
    } catch (err) {
        console.error('Error checking maintenance status:', err);
    }

    lastCheck = now;
    return maintenanceMode;
}

app.use(async (req, res, next) => {
    // Skip logical check for admin, webhooks and API
    const isExcluded =
        req.path.startsWith('/admin') ||
        req.path.startsWith('/api/') ||
        req.path.startsWith('/webhook') ||
        req.path === '/maintenance.html' ||
        req.path.includes('favicon') ||
        req.path.includes('.png') ||
        req.path.includes('.jpg') ||
        req.path.includes('.css') ||
        req.path.includes('.js');

    if (isExcluded) return next();

    const isMaintenance = await checkMaintenanceStatus();
    if (isMaintenance) {
        // If it's a page request (no extension or .html), show maintenance
        const isPageRequest = !req.path.includes('.') || req.path.endsWith('.html');
        if (isPageRequest) {
            return res.sendFile(path.join(__dirname, 'maintenance.html'));
        }
    }
    next();
});
// -----------------------------------

// General Middleware
app.use(cors());
// Exclude /webhook from JSON parsing — Stripe needs the raw body for signature verification
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next();
    } else {
        express.json()(req, res, next);
    }
});

// Main Static delivery
app.use(express.static('.'));
app.use('/admin', express.static('admin'));

// API Routes
app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);


// Endpoint for Virtual Try-On
app.post('/api/try-on', upload.single('image'), async (req, res) => {
    try {
        if (!req.file || !req.body.productImage) {
            return res.status(400).json({ error: 'Missing user image or product image' });
        }

        const userImageBuffer = req.file.buffer;
        const productImageUrl = req.body.productImage;

        // Fetch product image (if it's a URL) or use it directly if it's base64 (assuming URL for now)
        // For simplicity, we'll assume the frontend sends the URL and we fetch it, 
        // OR the frontend sends base64. Let's assume URL and fetch it here.
        // Actually, to avoid fetching, let's ask frontend to send base64 or we fetch local file.
        // Since product images are local, we can read them from disk.

        let productImageBuffer;
        if (productImageUrl.startsWith('http')) {
            // Fetch remote image (e.g., Supabase)
            const imageResponse = await fetch(productImageUrl);
            if (!imageResponse.ok) {
                return res.status(404).json({ error: 'Failed to fetch remote product image' });
            }
            const arrayBuffer = await imageResponse.arrayBuffer();
            productImageBuffer = Buffer.from(arrayBuffer);
        } else if (productImageUrl.startsWith('data:')) {
            // Handle base64 data URI
            const base64Data = productImageUrl.split(';base64,').pop();
            productImageBuffer = Buffer.from(base64Data, 'base64');
        } else {
            // Local file path
            // Remove leading slash if present to avoid absolute path confusion
            const cleanPath = productImageUrl.startsWith('/') ? productImageUrl.slice(1) : productImageUrl;
            const localPath = path.join(__dirname, cleanPath);

            if (fs.existsSync(localPath)) {
                productImageBuffer = fs.readFileSync(localPath);
            } else {
                console.error('Local image not found:', localPath);
                return res.status(404).json({ error: 'Product image not found locally' });
            }
        }

        // Prepare parts for Gemini
        const prompt = "Generate a photorealistic image of the person in the first image wearing the product shown in the second image. Maintain the person's pose, facial features, and background. The result should be high quality and look natural.";

        const imageParts = [
            {
                inlineData: {
                    data: userImageBuffer.toString('base64'),
                    mimeType: req.file.mimetype
                }
            },
            {
                inlineData: {
                    data: productImageBuffer.toString('base64'),
                    mimeType: 'image/png' // Assuming PNG for product images, or detect from ext
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;

        console.log('--- Gemini API Response ---');
        console.log(JSON.stringify(response, null, 2));
        console.log('---------------------------');

        let outputData = '';

        // Try to get text
        try {
            outputData = response.text();
        } catch (e) {
            console.log('No text in response');
        }

        // If no text, check for inline images in candidates
        if (!outputData && response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    console.log('Found inline image data!');
                    outputData = part.inlineData.data; // This is the base64 image
                    break;
                }
            }
        }

        res.json({ result: outputData });

    } catch (error) {
        console.error('Error generating try-on:', error);

        let errorMessage = 'Failed to generate image';
        if (error.status === 429) {
            errorMessage = 'El servidor de IA está saturado (Límite de cuota). Por favor espera 1 minuto e intenta de nuevo.';
        } else if (error.message && error.message.includes('SAFETY')) {
            errorMessage = 'La imagen no pudo ser generada por motivos de seguridad/contenido.';
        }

        res.status(500).json({ error: errorMessage, details: error.message });
    }
});

// Endpoint para obtener configuración del frontend
app.get('/config', (req, res) => {
    res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// Endpoint para crear sesión de checkout de Stripe
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items, pickupCode } = req.body;

        // Validar stock antes de crear sesión
        if (supabaseAdmin) {
            for (const item of items) {
                const { data: product } = await supabaseAdmin
                    .from('products')
                    .select('id, stock, name, variants')
                    .eq('name', item.name)
                    .single();

                if (!product) continue;

                const hasVariantStock = product.variants && product.variants.some(v => v.stock);

                if (hasVariantStock && item.variant) {
                    // Stock por variante/talla
                    const variant = product.variants.find(v => v.name === item.variant);
                    if (variant && variant.stock) {
                        const sizeKey = item.size || '_default';
                        const sizeStock = variant.stock[sizeKey];
                        if (sizeStock !== null && sizeStock !== undefined && sizeStock < item.quantity) {
                            return res.status(400).json({
                                error: `Stock insuficiente para "${item.name}" (${item.variant}, Talla ${item.size}). Disponible: ${sizeStock}`
                            });
                        }
                    }
                } else if (product.stock !== null && product.stock !== undefined) {
                    // Stock general del producto
                    if (product.stock < item.quantity) {
                        return res.status(400).json({
                            error: `Stock insuficiente para "${item.name}". Disponible: ${product.stock}`
                        });
                    }
                }
            }
        }

        // Verificar código interno
        const isInternalOrder = pickupCode === 'GOCA';

        // Mapa de precios internos (Precio Goca)
        const INTERNAL_PRICES = {
            'Gorra Legado': 170,
            'Mochila Legado': 1677,
            'Maleta de Viaje': 2574,
            'Playera Oficial': 100
        };

        // Lógica de precios internos
        let finalItems = items;
        if (isInternalOrder) {
            finalItems = items.map(item => {
                const internalPrice = INTERNAL_PRICES[item.name];
                return {
                    ...item,
                    price: internalPrice !== undefined ? internalPrice : item.price
                };
            });
        }

        // Detectar si hay artículos pesados (Maleta o Mochila)
        const hasHeavyItems = items.some(item =>
            item.name.includes('Maleta') || item.name.includes('Mochila')
        );

        // Definir opciones de envío base
        let shippingOptions = [
            {
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: hasHeavyItems ? 25000 : 15000, // $250 si es pesado, $150 normal
                        currency: 'mxn',
                    },
                    display_name: hasHeavyItems ? 'Envío Estándar (Voluminoso)' : 'Envío Estándar',
                    delivery_estimate: {
                        minimum: { unit: 'business_day', value: 5 },
                        maximum: { unit: 'business_day', value: 7 },
                    },
                },
            },
            {
                shipping_rate_data: {
                    type: 'fixed_amount',
                    fixed_amount: {
                        amount: hasHeavyItems ? 35000 : 25000, // $350 si es pesado, $250 normal
                        currency: 'mxn',
                    },
                    display_name: hasHeavyItems ? 'Envío Express (Voluminoso)' : 'Envío Express',
                    delivery_estimate: {
                        minimum: { unit: 'business_day', value: 1 },
                        maximum: { unit: 'business_day', value: 3 },
                    },
                },
            },
        ];

        // Si es pedido interno, reemplazar opciones de envío con "Recoger en Oficina"
        if (isInternalOrder) {
            shippingOptions = [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: {
                            amount: 0,
                            currency: 'mxn',
                        },
                        display_name: 'Recoger en Oficina (Interno)',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 1 },
                            maximum: { unit: 'business_day', value: 2 },
                        },
                    },
                }
            ];
        }

        const lineItems = finalItems.map(item => {
            const description = [item.size ? `Talla: ${item.size}` : '', item.variant ? `Color: ${item.variant}` : ''].filter(Boolean).join(' | ');
            return {
                price_data: {
                    currency: 'mxn',
                    product_data: {
                        name: item.name,
                        ...(description && { description }),
                        metadata: {
                            size: item.size || '',
                            variant: item.variant || ''
                        }
                    },
                    unit_amount: item.price * 100, // Stripe espera centavos
                },
                quantity: item.quantity,
            };
        });

        // Crear sesión de Stripe Checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            allow_promotion_codes: true, // Habilitar códigos de descuento
            success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.BASE_URL}/productos.html`,
            shipping_address_collection: {
                allowed_countries: ['MX'], // Solo México
            },
            phone_number_collection: {
                enabled: true,
            },
            custom_fields: [
                {
                    key: 'rfc',
                    label: { type: 'custom', custom: 'RFC (opcional, para facturación)' },
                    type: 'text',
                    optional: true,
                }
            ],
            shipping_options: shippingOptions,
            metadata: {
                items: JSON.stringify(items)
            }
        });

        res.json({ sessionId: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
});

// Newsletter Subscription Endpoint
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Upsert: if email exists but was unsubscribed, reactivate it
        const { data, error } = await supabaseAdmin
            .from('subscribers')
            .upsert(
                { email: email.toLowerCase().trim(), is_active: true, unsubscribed_at: null },
                { onConflict: 'email' }
            )
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Subscribed successfully' });

    } catch (error) {
        console.error('Error saving subscription:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Endpoint para verificar el pago después del checkout
app.get('/verify-session/:sessionId', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
            expand: ['line_items']
        });

        if (session.payment_status === 'paid') {
            const items = session.metadata?.items ? JSON.parse(session.metadata.items) : [];
            const totalCents = session.amount_total || 0;
            const shippingCents = session.total_details?.amount_shipping || 0;

            const rfcField = session.custom_fields?.find(f => f.key === 'rfc');
            const rfc = rfcField?.text?.value || '';

            const customer = {
                email: session.customer_details?.email || 'No disponible',
                name: session.customer_details?.name || 'Cliente',
                phone: session.customer_details?.phone || '',
                rfc: rfc,
                address: session.shipping_details?.address || {}
            };

            // Buscar la orden creada por el webhook para obtener el número de pedido
            let orderNumber = 'Procesando...';
            if (supabaseAdmin) {
                // Intentar hasta 3 veces con espera, por si el webhook aún no termina
                for (let i = 0; i < 3; i++) {
                    const { data: order } = await supabaseAdmin
                        .from('orders')
                        .select('order_number')
                        .eq('stripe_session_id', req.params.sessionId)
                        .single();

                    if (order?.order_number) {
                        orderNumber = `LSJ-${String(order.order_number).padStart(5, '0')}`;
                        break;
                    }
                    // Esperar 1 segundo antes de reintentar
                    if (i < 2) await new Promise(r => setTimeout(r, 1000));
                }
            }

            res.json({
                success: true,
                order: {
                    id: orderNumber,
                    customer: customer,
                    items: items,
                    total: totalCents / 100,
                    shipping: shippingCents / 100,
                    status: 'pagado'
                }
            });
        } else {
            res.json({
                success: false,
                message: 'Pago no completado'
            });
        }
    } catch (error) {
        console.error('Error verifying session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Webhook para recibir eventos de Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Manejar eventos de Stripe
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            console.log('Pago completado:', session.id);

            // Retrieve full session data
            const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
                expand: ['line_items']
            });

            const items = session.metadata?.items ? JSON.parse(session.metadata.items) : [];
            const totalCents = fullSession.amount_total || 0;
            const shippingCents = fullSession.total_details?.amount_shipping || 0;
            const subtotalCents = totalCents - shippingCents;

            // Extraer RFC de custom_fields
            const webhookRfcField = fullSession.custom_fields?.find(f => f.key === 'rfc');
            const webhookRfc = webhookRfcField?.text?.value || '';

            const customerData = {
                email: fullSession.customer_details?.email || 'No disponible',
                name: fullSession.customer_details?.name || 'Cliente',
                phone: fullSession.customer_details?.phone || '',
                rfc: webhookRfc,
                address: fullSession.shipping_details?.address || {}
            };

            // 1. Guardar pedido en Supabase
            let savedOrderId = null;
            let savedOrderNumber = null;
            try {
                if (supabaseAdmin) {
                    const { data, error: dbError } = await supabaseAdmin
                        .from('orders')
                        .insert({
                            stripe_session_id: session.id,
                            customer: customerData,
                            items: items,
                            subtotal: subtotalCents,
                            shipping: shippingCents,
                            total: totalCents,
                            status: 'pagado'
                        })
                        .select('id, order_number')
                        .single();

                    if (dbError) {
                        console.error('Error saving order to Supabase:', dbError);
                    } else {
                        savedOrderId = data.id;
                        savedOrderNumber = data.order_number;
                        console.log('Orden guardada:', savedOrderId, 'Número:', savedOrderNumber);
                    }
                }
            } catch (orderError) {
                console.error('Error creating order:', orderError);
            }

            // 2. Decrementar inventario
            try {
                if (supabaseAdmin) {
                    for (const item of items) {
                        const { data: product } = await supabaseAdmin
                            .from('products')
                            .select('id, stock, variants')
                            .eq('name', item.name)
                            .single();

                        if (!product) continue;

                        const hasVariantStock = product.variants && product.variants.some(v => v.stock);

                        if (hasVariantStock && item.variant) {
                            // Decremento atómico por variante/talla via función SQL
                            const { error: rpcError } = await supabaseAdmin.rpc('decrement_variant_stock', {
                                p_product_id: product.id,
                                p_variant_name: item.variant,
                                p_size: item.size || '_default',
                                p_quantity: item.quantity || 1
                            });
                            if (rpcError) {
                                console.error(`Error decrementando stock variante: ${item.name} ${item.variant} ${item.size}`, rpcError);
                            } else {
                                console.log(`Stock variante actualizado: ${item.name} - ${item.variant} - ${item.size}`);
                            }
                        } else if (product.stock !== null && product.stock !== undefined) {
                            // Decremento stock general
                            const newStock = Math.max(0, product.stock - (item.quantity || 1));
                            await supabaseAdmin
                                .from('products')
                                .update({ stock: newStock })
                                .eq('id', product.id);
                            console.log(`Stock actualizado: ${item.name} -> ${newStock}`);
                        }
                    }
                }
            } catch (stockError) {
                console.error('Error actualizando inventario:', stockError);
            }

            // 3. Enviar emails de confirmación
            try {
                const { sendOrderConfirmation, sendOrderNotification } = require('./lib/email');
                const emailOrderNumber = savedOrderNumber
                    ? `LSJ-${String(savedOrderNumber).padStart(5, '0')}`
                    : savedOrderId || `ORD-${Date.now()}`;
                const orderForEmail = {
                    id: emailOrderNumber,
                    customer: customerData,
                    items: items,
                    total: totalCents / 100,
                    shipping: shippingCents / 100
                };

                await sendOrderConfirmation(orderForEmail);
                await sendOrderNotification(orderForEmail);
                console.log('Emails enviados para orden:', emailOrderNumber);
            } catch (emailError) {
                console.error('Error enviando emails:', emailError);
            }
            break;
        }

        case 'payment_intent.succeeded':
            console.log('PaymentIntent exitoso');
            break;

        case 'payment_intent.payment_failed':
            console.log('PaymentIntent falló');
            break;

        default:
            console.log(`Evento no manejado: ${event.type}`);
    }

    res.json({ received: true });
});

// Endpoints para administración de pedidos (REMOVED: Managed by Stripe Dashboard)

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Configuración:');
    console.log('- BASE_URL:', process.env.BASE_URL);
    console.log('- Stripe Key Set:', !!process.env.STRIPE_SECRET_KEY);
});
