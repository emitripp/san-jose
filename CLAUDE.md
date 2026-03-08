# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tienda online de mercancia para **Legado San Jose**, una marca de productos inspirados en el rancho. El sitio esta completamente en **espanol**. Vende gorras, playeras, mochilas y maletas de viaje con integracion de pagos via Stripe en MXN (pesos mexicanos).

- **Frontend:** Vanilla HTML/CSS/JS (sin frameworks)
- **Backend:** Node.js + Express.js
- **Database:** Supabase (PostgreSQL) con Row Level Security
- **Pagos:** Stripe (checkout sessions, webhooks, promotion codes API)
- **Envios:** Skydropx (cotizaciones, guias, rastreo) con fallback a tarifas fijas
- **Auth Admin:** JWT (jsonwebtoken) + bcryptjs
- **Storage:** Supabase Storage (imagenes de productos y galeria)
- **Emails:** Resend (confirmacion, notificacion, actualizacion de estado, marketing)
- **AI:** Google Generative AI (Gemini) para virtual try-on

## Commands

```bash
npm start        # Inicia server en produccion
npm run dev      # Inicia con nodemon (desarrollo)
node scripts/create-admin.js  # Crear usuario admin
```

No hay tests, linter, ni build step configurados.

## Architecture

### Request Flow

```
Cliente (browser) --> Express (server.js)
  |-- Static files: express.static('public') + express.static('public/admin')
  |-- /api/*        --> routes/public.js  (usa supabase con anon key, respeta RLS)
  |-- /api/admin/*  --> routes/admin.js   (usa supabaseAdmin con service role key, bypasea RLS)
  |-- /webhook      --> Stripe webhook handler (raw body, signature verification)
  |-- /create-checkout-session, /verify-session, /config --> directamente en server.js
  |-- /api/shipping/rates --> Skydropx quote (o fallback fijo)
  |-- /api/try-on   --> Google Gemini AI
```

### Key Design Patterns

- **Maintenance middleware** intercepta requests publicos (no admin/API/assets) y muestra `maintenance.html`. Estado cacheado 5s en memoria, se lee de `site_content` tabla.
- **Webhook es la fuente canonica** para crear ordenes. `verify-session` solo lee la orden creada por el webhook (con retry 3x/1s).
- **Inventario se decrementa en el webhook** post-pago. Tanto variant stock (`decrement_variant_stock`) como stock general (`decrement_product_stock`) usan RPCs atomicos con `FOR UPDATE`.
- **Dos clientes Supabase:** `supabase` (anon key, RLS) para rutas publicas, `supabaseAdmin` (service role key) para admin y webhook.
- **Stripe Promotion Codes API** para descuentos. El checkout tiene `allow_promotion_codes: true`.
- **Skydropx** para cotizaciones de envio con OAuth 2.0 (token cacheado). Si no esta configurado, devuelve tarifas fijas de fallback.
- **Cotizaciones se cachean** en tabla `shipping_quotes` con token unico, hash del carrito y expiracion de 15 min.
- **Codigo interno GOCA** aplica precios de empleado con envio gratis (hardcoded en `INTERNAL_PRICES` en server.js).

### Database Tables (Supabase)

| Tabla | Proposito |
|-------|-----------|
| `products` | Catalogo (nombre, precio, categoria, variantes con stock por talla, imagenes) |
| `categories` | Categorias de productos con slug, display_order, is_active |
| `orders` | Ordenes de compra con customer, items, status, tracking, shipping info |
| `site_content` | Contenido dinamico del sitio (section/key pairs) |
| `gallery_images` | Imagenes de la galeria del landing |
| `pages` | Paginas dinamicas (legales, info) con slug y contenido HTML |
| `admins` | Usuarios administradores |
| `subscribers` | Suscriptores de newsletter (email, is_active) |
| `shipping_quotes` | Cache temporal de cotizaciones de envio (expiran en 15 min) |

### Frontend Architecture

- Archivos frontend estan en `public/` (HTML, CSS, JS, Fonts, Fotos, admin).
- `public/content-loader.js` se carga en todas las paginas: trae contenido dinamico de `/api/content`, galeria de `/api/gallery`, y links de footer de `/api/pages`.
- `public/productos.js` (~1300 lineas) maneja toda la logica de tienda: carga productos, carrito (localStorage), sidebar carrito, cotizacion de envio, y checkout Stripe.
- `public/admin/admin.js` (~2800 lineas) maneja todo el panel admin: CRUD de todas las entidades, drag-and-drop reorder, modales, uploads.
- `public/pagina.js` carga contenido de paginas dinamicas por slug desde URL params.
- Cart sidebar incluye cotizacion de envio integrada (postal code -> Skydropx rates -> seleccion de tarifa).

### Email System

`lib/email.js` exporta 3 funciones:
- `sendOrderConfirmation(order)` - al cliente
- `sendOrderNotification(order)` - al negocio (legadosanjosemx@gmail.com)
- `sendStatusUpdate(order, newStatus)` - al cliente cuando cambia estado

Marketing emails se envian desde `routes/admin.js` POST `/subscribers/send-email` usando Resend batch API.

### Shipping (lib/skydropx.js)

- OAuth 2.0 con auto-refresh del token
- `selectBox(items)` selecciona cajas optimas segun tipo de producto (playera, gorra, mochila, maleta)
- `getRates()` crea cotizacion y la pollea hasta completar (max 30s)
- `generateLabel(rateId, destination, parcels, quotationId)` crea guia de envio
- Multi-paquete: cotiza el paquete mas grande y multiplica precio
- **Cotizacion original se reusa** si la orden tiene < 24h y `shipping_quotation_id` guardado. El admin auto-genera la guia con el rate_id original del cliente sin mostrar opciones.
- **Docs API:** `https://pro.skydropx.com/es-MX/api-docs`
- **POST /api/v1/shipments** requiere `consignment_note` (string, codigo SAT Carta Porte, ej: `"53102400"`) y `package_type` (string, codigo empaque, ej: `"4G"` = caja carton) a nivel de shipment (NO dentro de parcels). Tambien requiere `reference` en address_from y address_to.

## Environment Variables

Requeridas en `.env`:
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY` (para Gemini)
- `JWT_SECRET`
- `PORT` (default: 3000)
- `BASE_URL` (para redirects de Stripe)
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` (opcional) / `REPLY_TO_EMAIL` (opcional)
- `SKYDROPX_CLIENT_ID` / `SKYDROPX_CLIENT_SECRET` (opcional, sin ellos usa tarifas fijas)
- `SKYDROPX_ENV` (`production` o sandbox por default)
- `SKYDROPX_ORIGIN_*` (direccion de origen: NAME, COMPANY, EMAIL, PHONE, STREET, CITY, STATE, POSTAL_CODE, STATE_FULL, DISTRICT)

## Migrations

Ejecutar en orden en Supabase SQL Editor:
1. `supabase/schema.sql` - Esquema base
2. `supabase/migration_v2.sql` - Stock, pages, button_link
3. `supabase/migration_v3.sql` - Funcion `decrement_variant_stock` (stock atomico por variante/talla)
4. `supabase/migration_v4_shipping.sql` - Columnas de envio en orders, tabla shipping_quotes
5. `supabase/migration_v5_atomic_stock.sql` - Funcion `decrement_product_stock` (stock general atomico)
6. `supabase/migration_v6_shipping_quotation.sql` - quotation_id en shipping_quotes, shipping_quotation_id y shipping_rate_id en orders

## Development Notes

- **Moneda:** Todos los precios en MXN. Stripe recibe centavos (price * 100).
- **Idioma:** Todo el contenido y UI esta en espanol.
- **Inventario:** `stock` NULL = ilimitado, 0 = agotado, N = N piezas. Variantes tienen stock por talla en JSONB (`variant.stock.{size}: qty`).
- **RLS:** Row Level Security activo. Operaciones admin usan `SUPABASE_SERVICE_ROLE_KEY`.
- **Paginas dinamicas:** Contenido se renderiza con innerHTML (soporta HTML basico).
- **Static files:** Express sirve `public/` como directorio estatico. Archivos del backend (server.js, package.json, .env) no son accesibles.
- **Pedidos:** Estados: pagado -> procesado -> enviado -> entregado. Formato: `LSJ-00001`.
- **GA4 ID:** G-JT5P73Z3EV

## Known Issues

_Todos los issues previamente listados han sido resueltos._
