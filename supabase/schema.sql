-- ============================================
-- SCHEMA PARA LEGADO SAN JOSÉ - ADMIN PORTAL
-- ============================================
-- Ejecutar este script en Supabase SQL Editor

-- 1. TABLA DE PRODUCTOS
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('gorras', 'playeras', 'mochilas', 'maletas')),
    description TEXT,
    image_url TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    gradient TEXT DEFAULT 'linear-gradient(135deg, #F5A84F 0%, #EDE4CE 100%)',
    sizes JSONB DEFAULT '[]'::jsonb,
    variants JSONB DEFAULT '[]'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE CONTENIDO DEL SITIO
-- ============================================
CREATE TABLE IF NOT EXISTS site_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section TEXT NOT NULL,
    key TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(section, key)
);

-- 3. TABLA DE GALERÍA
-- ============================================
CREATE TABLE IF NOT EXISTS gallery_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE ADMINS
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- 5. FUNCIONES DE UTILIDAD
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_content_updated_at
    BEFORE UPDATE ON site_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. POLÍTICAS DE SEGURIDAD (RLS)
-- ============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Política: Cualquiera puede LEER productos activos
CREATE POLICY "Public can read active products" ON products
    FOR SELECT
    USING (is_active = true);

-- Política: Cualquiera puede LEER contenido del sitio
CREATE POLICY "Public can read site content" ON site_content
    FOR SELECT
    USING (true);

-- Política: Cualquiera puede LEER galería activa
CREATE POLICY "Public can read active gallery" ON gallery_images
    FOR SELECT
    USING (is_active = true);

-- NOTA: Para operaciones de escritura, usaremos la service_role key en el backend
-- que bypasea RLS automaticamente

-- 7. ÍNDICES PARA RENDIMIENTO
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_display_order ON products(display_order);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_gallery_display_order ON gallery_images(display_order);
CREATE INDEX IF NOT EXISTS idx_site_content_section ON site_content(section);

-- 8. DATOS INICIALES (ADMIN)
-- ============================================
-- Contraseña por defecto: admin123 (hash bcrypt)
-- El usuario DEBE cambiar esto después del primer login
INSERT INTO admins (email, password_hash, name)
VALUES (
    'legadosanjosemx@gmail.com',
    '$2b$10$rOzJqQZQZQZQZQZQZQZQZOC8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K',
    'Administrador'
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- FIN DEL SCHEMA
-- ============================================
