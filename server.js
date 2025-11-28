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

// In-memory storage for orders (REMOVED: Managed by Stripe Dashboard)
// let orders = [];

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
