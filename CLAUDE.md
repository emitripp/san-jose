# Legado San José - E-commerce Merchandise Store

## Project Overview

Tienda online de mercancía para **Legado San José**, una marca de productos inspirados en el rancho. El sitio está completamente en **español**. Vende gorras, playeras, mochilas y maletas de viaje con integración de pagos via Stripe en MXN (pesos mexicanos).

**Repo:** https://github.com/emitripp/san-jose.git

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (sin frameworks)
- **Backend:** Node.js + Express.js
- **Database:** Supabase (PostgreSQL) con Row Level Security
- **Pagos:** Stripe (checkout sessions, webhooks, promotion codes API)
- **Auth Admin:** JWT (jsonwebtoken) + bcryptjs
- **Storage:** Supabase Storage (imágenes de productos y galería)
- **Emails:** Resend (emails transaccionales de confirmación y notificación)
- **AI:** Google Generative AI (Gemini) para virtual try-on
- **Analytics:** Google Analytics 4

## Project Structure

```
├── server.js                  # Express server principal (entry point)
├── routes/
│   ├── admin.js               # API routes admin (CRUD productos, categorías, órdenes, descuentos, páginas)
│   └── public.js              # API routes públicas (productos, galería, contenido, páginas)
├── lib/
│   ├── supabase.js            # Cliente Supabase
│   └── email.js               # Módulo de emails transaccionales (Resend)
├── admin/
│   ├── index.html             # Panel de administración
│   ├── admin.js               # Lógica del admin panel
│   └── admin.css              # Estilos del admin
├── index.html                 # Landing page
├── script.js                  # JS de landing page
├── styles.css                 # Estilos de landing page
├── productos.html             # Página de tienda/productos
├── productos.js               # Lógica de tienda, carrito, checkout
├── productos.css              # Estilos de productos
├── pagina.html                # Template para páginas dinámicas (legales, info)
├── pagina.js                  # Carga dinámica de contenido de página por slug
├── success.html               # Página de confirmación de orden
├── maintenance.html           # Página de modo mantenimiento
├── content-loader.js          # Carga dinámica de contenido y footer desde API
├── stripe-config.js           # Configuración de Stripe en frontend
├── supabase/
│   ├── schema.sql             # Esquema de BD (tablas, RLS, índices)
│   ├── migration_v2.sql       # Migración V2: stock, pages, button_link
│   ├── migrate_products.sql   # Datos iniciales de productos
│   └── storage_setup.sql      # Configuración de buckets de storage
├── scripts/
│   ├── create-admin.js        # Script para crear usuario admin
│   └── migrate-images.js      # Migración de imágenes a Supabase
└── Fotos/                     # Imágenes de productos y galería
    ├── optimized/             # Imágenes optimizadas
    └── playeras/              # Variantes de playeras (11 colores)
```

## Database Tables (Supabase)

| Tabla | Propósito |
|-------|-----------|
| `products` | Catálogo de productos (nombre, precio, categoría, variantes, tallas, imágenes, **stock**) |
| `site_content` | Contenido dinámico del sitio (hero, about, footer, settings, **button_link**) |
| `gallery_images` | Imágenes de la galería del landing |
| `admins` | Usuarios administradores (email, password_hash) |
| `orders` | Órdenes de compra (customer, items, total, status, tracking) |
| `pages` | Páginas dinámicas (legales, info) con título, slug, contenido HTML, is_active |

## API Routes

### Públicas (`/api/`)
- `GET /api/products` — Productos activos (incluye stock, con Cache-Control: no-store)
- `GET /api/gallery` — Imágenes de galería
- `GET /api/categories` — Categorías activas
- `GET /api/content` — Contenido del sitio
- `GET /api/pages` — Páginas activas (para footer dinámico)
- `GET /api/pages/:slug` — Contenido de una página por slug
- `POST /api/subscribe` — Suscripción a newsletter
- `POST /api/try-on` — Virtual try-on con AI

### Pagos
- `GET /config` — Stripe publishable key
- `POST /create-checkout-session` — Crear sesión de checkout (valida stock antes)
- `GET /verify-session/:sessionId` — Verificar pago
- `POST /webhook` — Webhooks de Stripe (decrementa inventario, envía emails)

### Admin (`/api/admin/`) — Requieren JWT + verifyAdmin
- CRUD completo para: products, categories, gallery, content, orders, **pages**
- **Descuentos:** `GET/POST/PATCH /discount-codes` (via Stripe Promotion Codes API)
- **Galería reorder:** `PATCH /gallery-reorder`
- **Órdenes:** `GET /orders`, `PATCH /orders/:id/status` (envía email de actualización)
- Auth: `POST /login`, `POST /change-password`, `GET /me`
- Upload: `POST /upload/product`, `POST /upload/gallery`

## Key Features

- **Carrito de compras** con persistencia en localStorage
- **Checkout Stripe** con envío a México, códigos de descuento (promotion codes)
- **Código interno GOCA** para precios de empleados con envío gratis
- **Sistema de inventario** — stock por producto (NULL=ilimitado, 0=agotado, N=disponible)
- **Códigos de descuento** — gestionados via Stripe Promotion Codes API desde admin
- **Estados de pedido** — pagado → procesado → enviado → entregado
- **Emails transaccionales** — confirmación al cliente + notificación al negocio + actualización de estado (Resend)
- **Panel de administración** completo (productos, categorías, galería, contenido, órdenes, descuentos, páginas)
- **Páginas dinámicas** — 6 páginas legales/info editables desde admin con contenido HTML
- **Footer dinámico** — links a páginas activas cargados automáticamente desde API
- **Reorden de galería** — drag-and-drop en admin para reordenar imágenes
- **Link editable del botón hero** — configurable desde admin (sección contenido)
- **Modo mantenimiento** controlado desde admin (cache de 5s)
- **Virtual try-on** con Google Gemini AI
- **Contenido dinámico** editable desde admin sin tocar código
- **Categorías dinámicas** con reordenamiento drag-and-drop

## Environment Variables

Requeridas en `.env` (ver `.env.example`):
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_API_KEY` (para Gemini)
- `JWT_SECRET`
- `PORT` (default: 3000)
- `BASE_URL` (para redirects de Stripe)
- `RESEND_API_KEY` (para emails transaccionales)
- `RESEND_FROM_EMAIL` (opcional, default: `Legado San José <onboarding@resend.dev>`)

## Commands

```bash
npm start        # Inicia server en producción
npm run dev      # Inicia con nodemon (desarrollo)
```

## Migrations

```bash
# V2 migration (ejecutar en Supabase SQL Editor):
# - Agrega columna stock a products
# - Inserta button_link en site_content
# - Crea tabla pages con RLS, índices y trigger
# - Inserta 6 páginas placeholder (inactivas)
# Archivo: supabase/migration_v2.sql
```

## Development Notes

- **Moneda:** Todos los precios en MXN (enteros en centavos para Stripe)
- **Idioma:** Todo el contenido y UI está en español
- **Envío:** Estándar $150/$250 MXN, Express $250/$350 MXN según peso
- **Imágenes:** Se suben a Supabase Storage, hay script de optimización en Python
- **RLS:** Row Level Security activo — operaciones admin usan `SUPABASE_SERVICE_ROLE_KEY`
- **Newsletter:** Se guarda en `subscribers.txt` (archivo plano)
- **GA4 ID:** G-JT5P73Z3EV
- **Inventario:** `stock` NULL = sin control (ilimitado), 0 = agotado, N = N piezas disponibles
- **Emails:** Temporal con `onboarding@resend.dev`, migrar a `pedidos@legadosanjose.com` al verificar dominio en Resend
- **Páginas dinámicas:** Contenido se renderiza con innerHTML (soporta HTML básico)
- **Descuentos:** Se usan Stripe Promotion Codes (no sistema custom). El checkout ya tiene `allow_promotion_codes: true`

## Architecture Decisions

- Vanilla JS sin frameworks para mantener simplicidad y rendimiento
- Express sirve archivos estáticos desde el root directory
- Supabase como BaaS para evitar gestionar BD propia
- JWT en localStorage para auth de admin (expira en 24h)
- Middleware de mantenimiento intercepta requests públicos pero no admin/API
- Stripe Promotion Codes API para descuentos (más seguro que sistema custom)
- Resend para emails transaccionales (simple, buen free tier)
- Orden canónica se crea en webhook (más confiable que verify-session)
- Inventario se decrementa atómicamente en webhook post-pago
- Páginas dinámicas en tabla separada `pages` (no en `site_content`) para mejor separación
