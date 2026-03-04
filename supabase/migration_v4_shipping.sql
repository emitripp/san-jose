-- ============================================
-- MIGRATION V4 - Integración Envia.com Shipping
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columnas de envío a la tabla orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_carrier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_service TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS label_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_packages JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS destination_postal_code TEXT;

-- 2. Índice para buscar por shipment_id
CREATE INDEX IF NOT EXISTS idx_orders_shipment_id ON orders(shipment_id);

-- 3. Crear tabla shipping_quotes (cache temporal de cotizaciones)
CREATE TABLE IF NOT EXISTS shipping_quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quote_token TEXT UNIQUE NOT NULL,
    postal_code TEXT NOT NULL,
    packages JSONB NOT NULL,
    rates JSONB NOT NULL,
    cart_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes')
);

-- Enable RLS
ALTER TABLE shipping_quotes ENABLE ROW LEVEL SECURITY;

-- Índices para shipping_quotes
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_token ON shipping_quotes(quote_token);
CREATE INDEX IF NOT EXISTS idx_shipping_quotes_expires ON shipping_quotes(expires_at);
