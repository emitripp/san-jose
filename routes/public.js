// Public API Routes for Legado San José
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// ============================================
// PUBLIC PRODUCTS ROUTES
// ============================================

// GET /api/products - Get all active products (public)
router.get('/products', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;

        // Transform data to match existing frontend format
        const products = data.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            category: p.category,
            description: p.description,
            image: p.image_url,
            images: p.images || [],
            gradient: p.gradient,
            sizes: p.sizes || [],
            variants: p.variants || [],
            stock: p.stock
        }));

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json(products);

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// GET /api/products/:id - Get single product (public)
router.get('/products/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', req.params.id)
            .eq('is_active', true)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Product not found' });

        // Transform to match frontend format
        const product = {
            id: data.id,
            name: data.name,
            price: data.price,
            category: data.category,
            description: data.description,
            image: data.image_url,
            images: data.images || [],
            gradient: data.gradient,
            sizes: data.sizes || [],
            variants: data.variants || []
        };

        res.json(product);

    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// ============================================
// PUBLIC GALLERY ROUTES
// ============================================

// GET /api/gallery - Get all active gallery images (public)
router.get('/gallery', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('gallery_images')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get gallery error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});

// ============================================
// PUBLIC CATEGORIES ROUTES
// ============================================

// GET /api/categories - Get all active categories (public)
router.get('/categories', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// ============================================
// PUBLIC SITE CONTENT ROUTES
// ============================================

// GET /api/content - Get all site content (public)
router.get('/content', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('site_content')
            .select('*');

        if (error) throw error;

        // Transform to key-value object grouped by section
        const content = {};
        data.forEach(item => {
            if (!content[item.section]) {
                content[item.section] = {};
            }
            content[item.section][item.key] = item.content || item.image_url;
        });

        res.json(content);

    } catch (error) {
        console.error('Get content error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// GET /api/content/:section - Get content by section (public)
router.get('/content/:section', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('site_content')
            .select('*')
            .eq('section', req.params.section);

        if (error) throw error;

        // Transform to key-value object
        const content = {};
        data.forEach(item => {
            content[item.key] = item.content || item.image_url;
        });

        res.json(content);

    } catch (error) {
        console.error('Get content error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// ============================================
// PUBLIC PAGES ROUTES
// ============================================

// GET /api/pages - Get all active pages (for footer menu)
router.get('/pages', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pages')
            .select('title, slug')
            .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data || []);

    } catch (error) {
        console.error('Get pages error:', error);
        res.json([]); // Return empty array on error so footer doesn't break
    }
});

// GET /api/pages/:slug - Get single page content (public)
router.get('/pages/:slug', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pages')
            .select('*')
            .eq('slug', req.params.slug)
            .eq('is_active', true)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Página no encontrada' });
        }

        res.json(data);

    } catch (error) {
        console.error('Get page error:', error);
        res.status(500).json({ error: 'Failed to fetch page' });
    }
});

module.exports = router;
