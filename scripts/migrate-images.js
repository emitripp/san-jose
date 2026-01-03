// Script para migrar imágenes locales a Supabase Storage
// Ejecutar con: node scripts/migrate-images.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Verificar variables de entorno
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeo de imágenes a subir
const imagesToMigrate = {
    products: [
        // Gorras
        'Fotos/optimized/gorra1 frente.png',
        'Fotos/optimized/gorra-legado-foto2.png',
        'Fotos/optimized/modelo2 gorra1.png',
        'Fotos/optimized/gorra-legado-foto4.png',
        'Fotos/optimized/gorra2.png',
        'Fotos/optimized/gorra-ambar-foto2.png',
        'Fotos/optimized/modelo2 gorra ambar.png',
        'Fotos/optimized/gorra-ambar-foto4.png',
        'Fotos/optimized/gorra3.png',
        'Fotos/optimized/gorra-verde-foto1.png',
        'Fotos/optimized/modelo2 gorra verde.png',
        'Fotos/optimized/gorra-verde-foto2.png',
        // Mochila
        'Fotos/optimized/Mochila.png',
        'Fotos/optimized/modelo mochila1.png',
        'Fotos/optimized/modelo mochila2.png',
        // Maleta
        'Fotos/optimized/Maleta.png',
        'Fotos/optimized/foto-maleta-1.png',
        'Fotos/optimized/maleta modelo2.png',
        'Fotos/optimized/foto-maleta-2.png',
        // Playeras
        'Fotos/playeras/optimized/blanco.png',
        'Fotos/playeras/optimized/azul cielo.png',
        'Fotos/playeras/optimized/azul marino.png',
        'Fotos/playeras/optimized/azul rey.png',
        'Fotos/playeras/optimized/gris.png',
        'Fotos/playeras/optimized/hueso.png',
        'Fotos/playeras/optimized/lila.png',
        'Fotos/playeras/optimized/rojo.png',
        'Fotos/playeras/optimized/verde militar.png',
        'Fotos/playeras/optimized/verde.png',
        'Fotos/playeras/optimized/vino.png'
    ],
    gallery: [
        'Fotos/Galeria/galeria1.jpg',
        'Fotos/Galeria/galeria2.jpg',
        'Fotos/Galeria/galeria3.jpg',
        'Fotos/Galeria/galeria4.jpg',
        'Fotos/Galeria/galeria5.jpg',
        'Fotos/Galeria/galeria6.jpg',
        'Fotos/Galeria/galeria7.jpg',
        'Fotos/Galeria/galeria8.jpg'
    ]
};

// Función para subir una imagen
async function uploadImage(localPath, bucket) {
    const absolutePath = path.join(__dirname, '..', localPath);

    // Verificar si existe
    if (!fs.existsSync(absolutePath)) {
        console.log(`⚠️  Archivo no existe: ${localPath}`);
        return null;
    }

    // Leer archivo
    const fileBuffer = fs.readFileSync(absolutePath);
    const fileName = path.basename(localPath).replace(/\s+/g, '_').toLowerCase();
    const ext = path.extname(fileName).toLowerCase();

    // Determinar tipo MIME
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
    };
    const contentType = mimeTypes[ext] || 'image/png';

    // Generar nombre único para evitar conflictos
    const uniqueFileName = `${Date.now()}-${fileName}`;
    const storagePath = `migrated/${uniqueFileName}`;

    try {
        // Subir a Supabase
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(storagePath, fileBuffer, {
                contentType,
                upsert: true
            });

        if (error) {
            console.log(`❌ Error subiendo ${localPath}: ${error.message}`);
            return null;
        }

        // Obtener URL pública
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(storagePath);

        console.log(`✅ Subido: ${localPath} → ${urlData.publicUrl}`);

        return {
            localPath,
            supabaseUrl: urlData.publicUrl
        };

    } catch (err) {
        console.log(`❌ Error en ${localPath}: ${err.message}`);
        return null;
    }
}

// Función para actualizar URLs en la base de datos
async function updateProductUrls(urlMappings) {
    console.log('\n📝 Actualizando URLs en base de datos...\n');

    for (const mapping of urlMappings) {
        if (!mapping) continue;

        // Actualizar image_url principal
        const { error: mainError } = await supabase
            .from('products')
            .update({ image_url: mapping.supabaseUrl })
            .eq('image_url', mapping.localPath);

        if (!mainError) {
            console.log(`   ✅ Actualizado image_url: ${mapping.localPath}`);
        }

        // También actualizar en arrays de images (más complejo)
        // Esto requiere buscar productos que contengan esta ruta en su array
        const { data: products } = await supabase
            .from('products')
            .select('id, images');

        for (const product of products || []) {
            if (product.images && product.images.includes(mapping.localPath)) {
                const newImages = product.images.map(img =>
                    img === mapping.localPath ? mapping.supabaseUrl : img
                );
                await supabase
                    .from('products')
                    .update({ images: newImages })
                    .eq('id', product.id);
                console.log(`   ✅ Actualizado images[] en producto ${product.id}`);
            }
        }
    }
}

async function updateGalleryUrls(urlMappings) {
    console.log('\n🖼️  Actualizando URLs de galería...\n');

    for (const mapping of urlMappings) {
        if (!mapping) continue;

        const { error } = await supabase
            .from('gallery_images')
            .update({ image_url: mapping.supabaseUrl })
            .eq('image_url', mapping.localPath);

        if (!error) {
            console.log(`   ✅ Actualizado: ${mapping.localPath}`);
        }
    }
}

// Función principal
async function migrateImages() {
    console.log('🚀 Iniciando migración de imágenes a Supabase Storage...\n');
    console.log(`   📦 Bucket 'products': ${imagesToMigrate.products.length} imágenes`);
    console.log(`   🖼️  Bucket 'gallery': ${imagesToMigrate.gallery.length} imágenes\n`);

    // Migrar imágenes de productos
    console.log('═══════════════════════════════════════════');
    console.log('📦 MIGRANDO IMÁGENES DE PRODUCTOS');
    console.log('═══════════════════════════════════════════\n');

    const productMappings = [];
    for (const imagePath of imagesToMigrate.products) {
        const result = await uploadImage(imagePath, 'products');
        productMappings.push(result);
        // Pequeña pausa para no saturar
        await new Promise(r => setTimeout(r, 200));
    }

    // Actualizar URLs en base de datos
    await updateProductUrls(productMappings.filter(m => m !== null));

    // Migrar imágenes de galería
    console.log('\n═══════════════════════════════════════════');
    console.log('🖼️  MIGRANDO IMÁGENES DE GALERÍA');
    console.log('═══════════════════════════════════════════\n');

    const galleryMappings = [];
    for (const imagePath of imagesToMigrate.gallery) {
        const result = await uploadImage(imagePath, 'gallery');
        galleryMappings.push(result);
        await new Promise(r => setTimeout(r, 200));
    }

    // Actualizar URLs en base de datos
    await updateGalleryUrls(galleryMappings.filter(m => m !== null));

    // Resumen
    const successProducts = productMappings.filter(m => m !== null).length;
    const successGallery = galleryMappings.filter(m => m !== null).length;

    console.log('\n═══════════════════════════════════════════');
    console.log('✨ MIGRACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════');
    console.log(`   📦 Productos: ${successProducts}/${imagesToMigrate.products.length} imágenes`);
    console.log(`   🖼️  Galería: ${successGallery}/${imagesToMigrate.gallery.length} imágenes`);
    console.log('═══════════════════════════════════════════\n');
}

// Ejecutar
migrateImages().catch(console.error);
