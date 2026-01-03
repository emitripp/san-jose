// Backend Node.js para Legado San José
// Este servidor maneja los pagos con Stripe y gestiona los pedidos

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Serve admin folder as static
app.use('/admin', express.static('admin'));

// Google Generative AI Setup
const { GoogleGenerativeAI } = require('@google/generative-ai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Import API Routes
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

// Use API Routes
app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });


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
        if (productImageUrl.startsWith('http') || productImageUrl.startsWith('data:')) {
            // If it's a remote URL or data URI (not expected for local files), handle accordingly
            // For this local app, productImageUrl is likely 'Fotos/...'
            // We can read it from the file system.
            const localPath = path.join(__dirname, productImageUrl);
            if (fs.existsSync(localPath)) {
                productImageBuffer = fs.readFileSync(localPath);
            } else {
                return res.status(404).json({ error: 'Product image not found' });
            }
        } else {
            // Relative path
            const localPath = path.join(__dirname, productImageUrl);
            if (fs.existsSync(localPath)) {
                productImageBuffer = fs.readFileSync(localPath);
            } else {
                return res.status(404).json({ error: 'Product image not found' });
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

        // Verificar código interno
        const isInternalOrder = pickupCode === 'DES-GOCA';

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

        const lineItems = finalItems.map(item => ({
            price_data: {
                currency: 'mxn',
                product_data: {
                    name: item.name,
                    metadata: {
                        size: item.size
                    }
                },
                unit_amount: item.price * 100, // Stripe espera centavos
            },
            quantity: item.quantity,
        }));

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
app.post('/api/subscribe', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const filePath = path.join(__dirname, 'subscribers.txt');
    const date = new Date().toLocaleString('es-MX');
    const entry = `${date} - ${email}\n`;

    fs.appendFile(filePath, entry, (err) => {
        if (err) {
            console.error('Error saving subscription:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.json({ message: 'Subscribed successfully' });
    });
});

// Admin View for Subscribers (Simple Password Protection)
app.get('/admin/subscribers', (req, res) => {
    const { pwd } = req.query;
    if (pwd !== 'legadoadmin') { // Simple password
        return res.status(403).send('<h1>Acceso Denegado</h1><p>Contraseña incorrecta.</p>');
    }

    const filePath = path.join(__dirname, 'subscribers.txt');
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() !== '');

        let html = `
            <html>
            <head>
                <title>Admin - Suscriptores</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    h1 { color: #333; }
                    ul { list-style: none; padding: 0; }
                    li { background: #f4f4f4; margin: 5px 0; padding: 10px; border-radius: 4px; border-left: 4px solid #F5A84F; }
                    .count { font-weight: bold; color: #666; }
                </style>
            </head>
            <body>
                <h1>Lista de Suscriptores</h1>
                <p class="count">Total: ${lines.length}</p>
                <ul>
                    ${lines.map(line => `<li>${line}</li>`).join('')}
                </ul>
            </body>
            </html>
        `;
        res.send(html);
    } else {
        res.send('<h1>No hay suscriptores aún.</h1>');
    }
});

// Endpoint para verificar el pago después del checkout
app.get('/verify-session/:sessionId', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.sessionId, {
            expand: ['line_items', 'customer']
        });

        console.log('Session retrieved:', session.payment_status);

        if (session.payment_status === 'paid') {
            // Guardar pedido
            const order = {
                id: `ORD-${Date.now()}`,
                sessionId: req.params.sessionId,
                customer: {
                    email: session.customer_details?.email || 'No disponible',
                    name: session.customer_details?.name || 'Cliente',
                    address: session.shipping_details?.address || session.customer_details?.address || {}
                },
                items: session.metadata?.items ? JSON.parse(session.metadata.items) : [],
                total: session.amount_total / 100,
                shipping: session.total_details?.amount_shipping ? session.total_details.amount_shipping / 100 : 0,
                status: 'pendiente',
                createdAt: new Date(),
                paid: true
            };

            // orders.push(order); // REMOVED: No local storage

            console.log('Order created:', order.id);

            res.json({
                success: true,
                order: order
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
        case 'checkout.session.completed':
            const session = event.data.object;
            console.log('Pago completado:', session.id);

            // Aquí puedes:
            // - Enviar email de confirmación
            // - Actualizar inventario
            // - Notificar al equipo
            break;

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
