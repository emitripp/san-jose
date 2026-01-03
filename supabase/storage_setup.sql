-- ============================================
-- CONFIGURACIÓN DE STORAGE EN SUPABASE
-- ============================================
-- NOTA: Este script es solo referencia.
-- Los buckets se crean desde el Dashboard de Supabase > Storage

-- 1. Crear bucket "products" para imágenes de productos
--    - Acceso: Público (para que se muestren en la tienda)
--    - Límite de archivo: 5MB
--    - Tipos permitidos: image/png, image/jpeg, image/webp

-- 2. Crear bucket "gallery" para imágenes de galería
--    - Acceso: Público
--    - Límite de archivo: 5MB
--    - Tipos permitidos: image/png, image/jpeg, image/webp

-- 3. Crear bucket "site" para contenido del sitio (videos, otros)
--    - Acceso: Público
--    - Límite de archivo: 50MB (para videos)
--    - Tipos permitidos: image/*, video/mp4

-- ============================================
-- POLÍTICAS DE STORAGE (ejecutar en SQL Editor)
-- ============================================

-- Política para lectura pública de productos
CREATE POLICY "Public read access for products"
ON storage.objects FOR SELECT
USING (bucket_id = 'products');

-- Política para lectura pública de galería
CREATE POLICY "Public read access for gallery"
ON storage.objects FOR SELECT
USING (bucket_id = 'gallery');

-- Política para lectura pública de contenido del sitio
CREATE POLICY "Public read access for site content"
ON storage.objects FOR SELECT
USING (bucket_id = 'site');

-- Las políticas de INSERT/UPDATE/DELETE se manejan con service_role key en el backend
