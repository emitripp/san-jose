-- ============================================
-- MIGRACIÓN DE PRODUCTOS EXISTENTES
-- ============================================
-- Ejecutar DESPUÉS de schema.sql

-- Gorra Legado (Original)
INSERT INTO products (name, price, category, description, image_url, images, gradient, sizes, variants, display_order)
VALUES (
    'Gorra Legado',
    250,
    'gorras',
    'Gorra de alta calidad con diseño exclusivo de Legado San José.',
    'Fotos/optimized/gorra1 frente.png',
    '["Fotos/optimized/gorra1 frente.png", "Fotos/optimized/gorra-legado-foto2.png", "Fotos/optimized/modelo2 gorra1.png", "Fotos/optimized/gorra-legado-foto4.png"]'::jsonb,
    'linear-gradient(135deg, #F5A84F 0%, #EDE4CE 100%)',
    '[]'::jsonb,
    '[]'::jsonb,
    1
);

-- Gorra Legado Ámbar
INSERT INTO products (name, price, category, description, image_url, images, gradient, sizes, variants, display_order)
VALUES (
    'Gorra Legado Ámbar',
    250,
    'gorras',
    'Nuevo diseño con malla transpirable en tono ámbar.',
    'Fotos/optimized/gorra2.png',
    '["Fotos/optimized/gorra2.png", "Fotos/optimized/gorra-ambar-foto2.png", "Fotos/optimized/modelo2 gorra ambar.png", "Fotos/optimized/gorra-ambar-foto4.png"]'::jsonb,
    'linear-gradient(135deg, #F5A84F 0%, #EDE4CE 100%)',
    '[]'::jsonb,
    '[]'::jsonb,
    2
);

-- Gorra Legado Verde
INSERT INTO products (name, price, category, description, image_url, images, gradient, sizes, variants, display_order)
VALUES (
    'Gorra Legado Verde',
    250,
    'gorras',
    'Estilo exclusivo en verde bosque para completar tu outfit.',
    'Fotos/optimized/gorra3.png',
    '["Fotos/optimized/gorra3.png", "Fotos/optimized/gorra-verde-foto1.png", "Fotos/optimized/modelo2 gorra verde.png", "Fotos/optimized/gorra-verde-foto2.png"]'::jsonb,
    'linear-gradient(135deg, #2E8B57 0%, #000 100%)',
    '[]'::jsonb,
    '[]'::jsonb,
    3
);

-- Mochila Legado
INSERT INTO products (name, price, category, description, image_url, images, gradient, sizes, variants, display_order)
VALUES (
    'Mochila Legado',
    3000,
    'mochilas',
    'Mochila espaciosa y resistente, ideal para el día a día.',
    'Fotos/optimized/Mochila.png',
    '["Fotos/optimized/Mochila.png", "Fotos/optimized/modelo mochila1.png", "Fotos/optimized/modelo mochila2.png"]'::jsonb,
    'linear-gradient(135deg, #64401B 0%, #EDE4CE 100%)',
    '[]'::jsonb,
    '[]'::jsonb,
    4
);

-- Maleta de Viaje
INSERT INTO products (name, price, category, description, image_url, images, gradient, sizes, variants, display_order)
VALUES (
    'Maleta de Viaje',
    4000,
    'maletas',
    'Maleta premium con gran capacidad y durabilidad.',
    'Fotos/optimized/Maleta.png',
    '["Fotos/optimized/Maleta.png", "Fotos/optimized/foto-maleta-1.png", "Fotos/optimized/maleta modelo2.png", "Fotos/optimized/foto-maleta-2.png"]'::jsonb,
    'linear-gradient(135deg, #000 0%, #F5A84F 100%)',
    '[]'::jsonb,
    '[]'::jsonb,
    5
);

-- Playera Oficial (con variantes de color)
INSERT INTO products (name, price, category, description, image_url, images, gradient, sizes, variants, display_order)
VALUES (
    'Playera Oficial',
    200,
    'playeras',
    'Playera cómoda con el diseño auténtico de Legado San José.',
    'Fotos/playeras/optimized/blanco.png',
    '[]'::jsonb,
    'linear-gradient(135deg, #64401B 0%, #000 100%)',
    '["S", "M", "L"]'::jsonb,
    '[
        {"name": "Blanca", "color": "#FFFFFF", "image": "Fotos/playeras/optimized/blanco.png"},
        {"name": "Azul Cielo", "color": "#87CEEB", "image": "Fotos/playeras/optimized/azul cielo.png"},
        {"name": "Azul Marino", "color": "#000080", "image": "Fotos/playeras/optimized/azul marino.png"},
        {"name": "Azul Rey", "color": "#4169E1", "image": "Fotos/playeras/optimized/azul rey.png"},
        {"name": "Gris", "color": "#808080", "image": "Fotos/playeras/optimized/gris.png"},
        {"name": "Hueso", "color": "#F5F5DC", "image": "Fotos/playeras/optimized/hueso.png"},
        {"name": "Lila", "color": "#C8A2C8", "image": "Fotos/playeras/optimized/lila.png"},
        {"name": "Roja", "color": "#DC143C", "image": "Fotos/playeras/optimized/rojo.png"},
        {"name": "Verde Militar", "color": "#4B5320", "image": "Fotos/playeras/optimized/verde militar.png"},
        {"name": "Verde", "color": "#008000", "image": "Fotos/playeras/optimized/verde.png"},
        {"name": "Vino", "color": "#722F37", "image": "Fotos/playeras/optimized/vino.png"}
    ]'::jsonb,
    6
);

-- ============================================
-- MIGRACIÓN DE GALERÍA
-- ============================================

INSERT INTO gallery_images (image_url, alt_text, display_order) VALUES
('Fotos/foto 1.jpg', 'Rancho San José - Foto 1', 1),
('Fotos/foto 2.jpg', 'Rancho San José - Foto 2', 2),
('Fotos/foto 3.jpg', 'Rancho San José - Foto 3', 3),
('Fotos/foto1-galeria.jpg', 'Rancho San José - Foto 4', 4),
('Fotos/foto3-galeria.jpg', 'Rancho San José - Foto 5', 5),
('Fotos/foto2-galeria.jpg', 'Rancho San José - Foto 6', 6),
('Fotos/foto 7.jpg', 'Rancho San José - Foto 7', 7);

-- ============================================
-- CONTENIDO INICIAL DEL SITIO
-- ============================================

INSERT INTO site_content (section, key, content) VALUES
('hero', 'subtitle', 'Tradición y Estilo'),
('hero', 'title', 'Vive el Legado'),
('hero', 'description', 'Descubre nuestra colección exclusiva inspirada en la autenticidad del rancho'),
('hero', 'video_url', 'Fotos/Video_Generation_With_Specific_Details.mp4'),
('about', 'title', 'Nuestro Legado'),
('about', 'paragraph1', 'En Legado San José, cada prenda cuenta una historia de tradición, autenticidad y orgullo ranchero. Nuestro merch no es solo ropa, es una forma de vida.'),
('about', 'paragraph2', 'Diseñado con pasión y fabricado con los más altos estándares de calidad, cada pieza refleja el espíritu indomable del rancho.'),
('footer', 'tagline', 'Tradición que se viste');

-- ============================================
-- FIN DE MIGRACIÓN
-- ============================================
