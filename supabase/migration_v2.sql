-- ============================================
-- MIGRATION V2 - Legado San José
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columna stock a productos
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT NULL;

-- 2. Agregar button_link a site_content
INSERT INTO site_content (section, key, content)
VALUES ('hero', 'button_link', 'productos.html')
ON CONFLICT (section, key) DO NOTHING;

-- 3. Crear tabla pages
CREATE TABLE IF NOT EXISTS pages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on pages
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Public can read active pages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public can read active pages' AND tablename = 'pages'
    ) THEN
        CREATE POLICY "Public can read active pages" ON pages FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- Index for pages
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_display_order ON pages(display_order);

-- Auto-update updated_at trigger for pages (reuse existing function)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_pages_updated_at'
    ) THEN
        CREATE TRIGGER update_pages_updated_at
            BEFORE UPDATE ON pages
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 4. Insert placeholder pages (inactive, waiting for content)
INSERT INTO pages (title, slug, content, is_active, display_order) VALUES
    ('Cuidado y Uso', 'cuidado-y-uso', '', false, 1),
    ('Preguntas Frecuentes', 'faqs', '', false, 2),
    ('Aviso de Privacidad', 'aviso-de-privacidad', '', false, 3),
    ('Política de Devoluciones', 'politica-de-devoluciones', '', false, 4),
    ('Términos y Condiciones', 'terminos-y-condiciones', '', false, 5),
    ('Sustentabilidad y RSC', 'sustentabilidad-y-rsc', '', false, 6)
ON CONFLICT (slug) DO NOTHING;
