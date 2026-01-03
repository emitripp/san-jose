// Admin API Routes for Legado San José
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');

// Configure multer for memory storage (for image uploads)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ============================================
// MIDDLEWARE: Verify Admin JWT Token
// ============================================
const verifyAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// ============================================
// AUTH ROUTES
// ============================================

// POST /api/admin/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find admin by email
        const { data: admin, error } = await supabaseAdmin
            .from('admins')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();

        if (error || !admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, admin.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await supabaseAdmin
            .from('admins')
            .update({ last_login: new Date().toISOString() })
            .eq('id', admin.id);

        // Generate JWT
        const token = jwt.sign(
            { id: admin.id, email: admin.email, name: admin.name },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/admin/change-password
router.post('/change-password', verifyAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Get current admin
        const { data: admin, error } = await supabaseAdmin
            .from('admins')
            .select('*')
            .eq('id', req.admin.id)
            .single();

        if (error || !admin) {
            return res.status(404).json({ error: 'Admin not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // Update password
        const { error: updateError } = await supabaseAdmin
            .from('admins')
            .update({ password_hash: newHash })
            .eq('id', req.admin.id);

        if (updateError) {
            throw updateError;
        }

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/admin/me - Get current admin info
router.get('/me', verifyAdmin, async (req, res) => {
    res.json({ admin: req.admin });
});

// ============================================
// PRODUCTS ROUTES
// ============================================

// GET /api/admin/products - List all products (including inactive)
router.get('/products', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// GET /api/admin/products/:id - Get single product
router.get('/products/:id', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Product not found' });

        res.json(data);

    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// POST /api/admin/products - Create new product
router.post('/products', verifyAdmin, async (req, res) => {
    try {
        const { name, price, category, description, image_url, images, gradient, sizes, variants, is_active } = req.body;

        if (!name || !price || !category) {
            return res.status(400).json({ error: 'Name, price, and category are required' });
        }

        // Get max display_order
        const { data: maxOrder } = await supabaseAdmin
            .from('products')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .single();

        const newOrder = (maxOrder?.display_order || 0) + 1;

        const { data, error } = await supabaseAdmin
            .from('products')
            .insert({
                name,
                price: parseInt(price),
                category,
                description: description || '',
                image_url: image_url || '',
                images: images || [],
                gradient: gradient || 'linear-gradient(135deg, #F5A84F 0%, #EDE4CE 100%)',
                sizes: sizes || [],
                variants: variants || [],
                display_order: newOrder,
                is_active: is_active !== false
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);

    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// PUT /api/admin/products/:id - Update product
router.put('/products/:id', verifyAdmin, async (req, res) => {
    try {
        const { name, price, category, description, image_url, images, gradient, sizes, variants, is_active, display_order } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (price !== undefined) updateData.price = parseInt(price);
        if (category !== undefined) updateData.category = category;
        if (description !== undefined) updateData.description = description;
        if (image_url !== undefined) updateData.image_url = image_url;
        if (images !== undefined) updateData.images = images;
        if (gradient !== undefined) updateData.gradient = gradient;
        if (sizes !== undefined) updateData.sizes = sizes;
        if (variants !== undefined) updateData.variants = variants;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (display_order !== undefined) updateData.display_order = display_order;

        const { data, error } = await supabaseAdmin
            .from('products')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Product not found' });

        res.json(data);

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', verifyAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Product deleted successfully' });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// PATCH /api/admin/products/reorder - Reorder products
router.patch('/products-reorder', verifyAdmin, async (req, res) => {
    try {
        const { orderedIds } = req.body; // Array of product IDs in new order

        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds must be an array' });
        }

        // Update each product's display_order
        const updates = orderedIds.map((id, index) =>
            supabaseAdmin
                .from('products')
                .update({ display_order: index + 1 })
                .eq('id', id)
        );

        await Promise.all(updates);
        res.json({ message: 'Products reordered successfully' });

    } catch (error) {
        console.error('Reorder products error:', error);
        res.status(500).json({ error: 'Failed to reorder products' });
    }
});

// ============================================
// IMAGE UPLOAD ROUTES
// ============================================

// POST /api/admin/upload/product - Upload product image
router.post('/upload/product', verifyAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        const filePath = `products/${fileName}`;

        const { data, error } = await supabaseAdmin.storage
            .from('products')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from('products')
            .getPublicUrl(filePath);

        res.json({
            url: urlData.publicUrl,
            path: filePath
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// POST /api/admin/upload/gallery - Upload gallery image
router.post('/upload/gallery', verifyAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
        const filePath = `gallery/${fileName}`;

        const { data, error } = await supabaseAdmin.storage
            .from('gallery')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) throw error;

        const { data: urlData } = supabaseAdmin.storage
            .from('gallery')
            .getPublicUrl(filePath);

        res.json({
            url: urlData.publicUrl,
            path: filePath
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// ============================================
// GALLERY ROUTES
// ============================================

// GET /api/admin/gallery - Get all gallery images
router.get('/gallery', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('gallery_images')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get gallery error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});

// POST /api/admin/gallery - Add gallery image
router.post('/gallery', verifyAdmin, async (req, res) => {
    try {
        const { image_url, alt_text } = req.body;

        if (!image_url) {
            return res.status(400).json({ error: 'image_url is required' });
        }

        // Get max display_order
        const { data: maxOrder } = await supabaseAdmin
            .from('gallery_images')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .single();

        const newOrder = (maxOrder?.display_order || 0) + 1;

        const { data, error } = await supabaseAdmin
            .from('gallery_images')
            .insert({
                image_url,
                alt_text: alt_text || '',
                display_order: newOrder
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);

    } catch (error) {
        console.error('Add gallery image error:', error);
        res.status(500).json({ error: 'Failed to add gallery image' });
    }
});

// DELETE /api/admin/gallery/:id - Delete gallery image
router.delete('/gallery/:id', verifyAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('gallery_images')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Gallery image deleted successfully' });

    } catch (error) {
        console.error('Delete gallery image error:', error);
        res.status(500).json({ error: 'Failed to delete gallery image' });
    }
});

// ============================================
// SITE CONTENT ROUTES
// ============================================

// GET /api/admin/content - Get all site content
router.get('/content', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('site_content')
            .select('*')
            .order('section', { ascending: true });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get content error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

// PUT /api/admin/content/:section/:key - Update site content
router.put('/content/:section/:key', verifyAdmin, async (req, res) => {
    try {
        const { content, image_url } = req.body;

        const updateData = {};
        if (content !== undefined) updateData.content = content;
        if (image_url !== undefined) updateData.image_url = image_url;

        const { data, error } = await supabaseAdmin
            .from('site_content')
            .update(updateData)
            .eq('section', req.params.section)
            .eq('key', req.params.key)
            .select()
            .single();

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Update content error:', error);
        res.status(500).json({ error: 'Failed to update content' });
    }
});

module.exports = router;
