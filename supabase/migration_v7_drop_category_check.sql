-- ============================================
-- MIGRATION V7: Drop hardcoded category CHECK constraint
-- ============================================
-- El esquema original tenia:
--   CHECK (category IN ('gorras','playeras','mochilas','maletas'))
-- Pero la app ahora maneja categorias dinamicas via la tabla `categories`.
-- Este constraint impide crear productos con categorias nuevas (ej. "llaveros",
-- "excelencia-charra-x-legado-san-jose"), causando "Failed to create product".
--
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
