-- Migration v6: Guardar Skydropx quotation_id para reusar cotizaciones originales
-- Ejecutar en Supabase SQL Editor

-- Guardar Skydropx quotation_id en shipping_quotes para poder reusar
ALTER TABLE shipping_quotes ADD COLUMN IF NOT EXISTS quotation_id TEXT;

-- Guardar quotation_id y rate_id en orders para generar guia sin re-cotizar
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_quotation_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_rate_id TEXT;
