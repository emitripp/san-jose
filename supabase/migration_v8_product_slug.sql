-- ============================================
-- MIGRATION V8: Slug por producto (para URLs /producto/<slug>)
-- ============================================
-- Agrega columna slug, backfillea desde name, y crea indice unico.
-- El backfill normaliza acentos, baja a minusculas y reemplaza no-alfanumericos
-- por guion. Si hay duplicados, suma -2, -3, ... al slug.

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;

-- Funcion auxiliar para generar slug (NFD + strip acentos + lowercase + dash)
CREATE OR REPLACE FUNCTION slugify(input TEXT)
RETURNS TEXT AS $$
DECLARE
    s TEXT;
BEGIN
    s := translate(
        lower(input),
        'áéíóúñüÁÉÍÓÚÑÜ',
        'aeiounuAEIOUNU'
    );
    s := regexp_replace(s, '[^a-z0-9]+', '-', 'gi');
    s := regexp_replace(s, '^-+|-+$', '', 'g');
    s := lower(s);
    RETURN s;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill: genera slug por producto, agregando sufijo numerico si choca
DO $$
DECLARE
    rec RECORD;
    base_slug TEXT;
    final_slug TEXT;
    counter INT;
BEGIN
    FOR rec IN SELECT id, name FROM products WHERE slug IS NULL OR slug = '' ORDER BY created_at LOOP
        base_slug := slugify(rec.name);
        IF base_slug = '' THEN
            base_slug := 'producto';
        END IF;
        final_slug := base_slug;
        counter := 2;
        WHILE EXISTS (SELECT 1 FROM products WHERE slug = final_slug AND id <> rec.id) LOOP
            final_slug := base_slug || '-' || counter;
            counter := counter + 1;
        END LOOP;
        UPDATE products SET slug = final_slug WHERE id = rec.id;
    END LOOP;
END $$;

-- Constraint unico (despues de backfill para no fallar)
ALTER TABLE products ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
