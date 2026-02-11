// Admin API Routes for Legado San José
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { supabaseAdmin } = require('../lib/supabase');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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
        // Check if Supabase is configured
        if (!supabaseAdmin) {
            console.error('Supabase not configured - check SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
            return res.status(500).json({ error: 'Database not configured' });
        }

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
        const { name, price, category, description, image_url, images, gradient, sizes, variants, is_active, stock } = req.body;

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

        const productData = {
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
        };
        if (stock !== undefined) productData.stock = parseInt(stock);

        const { data, error } = await supabaseAdmin
            .from('products')
            .insert(productData)
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
        const { name, price, category, description, image_url, images, gradient, sizes, variants, is_active, display_order, stock } = req.body;

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
        if (stock !== undefined) updateData.stock = parseInt(stock);

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
// CATEGORIES ROUTES
// ============================================

// GET /api/admin/categories - Get all categories
router.get('/categories', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('categories')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// POST /api/admin/categories - Create new category
router.post('/categories', verifyAdmin, async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        // Generate slug from name
        const slug = name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Get max display_order
        const { data: maxOrder } = await supabaseAdmin
            .from('categories')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .single();

        const newOrder = (maxOrder?.display_order || 0) + 1;

        const { data, error } = await supabaseAdmin
            .from('categories')
            .insert({
                name,
                slug,
                display_order: newOrder,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);

    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// PUT /api/admin/categories/:id - Update category
router.put('/categories/:id', verifyAdmin, async (req, res) => {
    try {
        const { name, is_active } = req.body;

        const updateData = {};
        if (name !== undefined) {
            updateData.name = name;
            // Update slug too
            updateData.slug = name.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabaseAdmin
            .from('categories')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// DELETE /api/admin/categories/:id - Delete category
router.delete('/categories/:id', verifyAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('categories')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Category deleted successfully' });

    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

// PATCH /api/admin/categories-reorder - Reorder categories
router.patch('/categories-reorder', verifyAdmin, async (req, res) => {
    try {
        const { orderedIds } = req.body;

        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds must be an array' });
        }

        const updates = orderedIds.map((id, index) =>
            supabaseAdmin
                .from('categories')
                .update({ display_order: index + 1 })
                .eq('id', id)
        );

        await Promise.all(updates);
        res.json({ message: 'Categories reordered successfully' });

    } catch (error) {
        console.error('Reorder categories error:', error);
        res.status(500).json({ error: 'Failed to reorder categories' });
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
            .upsert({
                section: req.params.section,
                key: req.params.key,
                ...updateData
            }, {
                onConflict: 'section,key'
            })
            .select()
            .single();

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Update content error:', error);
        res.status(500).json({ error: 'Failed to update content' });
    }
});

// PATCH /api/admin/gallery-reorder - Reorder gallery images
router.patch('/gallery-reorder', verifyAdmin, async (req, res) => {
    try {
        const { orderedIds } = req.body;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds must be an array' });
        }
        const updates = orderedIds.map((id, index) =>
            supabaseAdmin
                .from('gallery_images')
                .update({ display_order: index + 1 })
                .eq('id', id)
        );
        await Promise.all(updates);
        res.json({ message: 'Gallery reordered successfully' });
    } catch (error) {
        console.error('Reorder gallery error:', error);
        res.status(500).json({ error: 'Failed to reorder gallery' });
    }
});

// ============================================
// DISCOUNT CODES ROUTES (via Stripe API)
// ============================================

// GET /api/admin/discount-codes - List all promotion codes
router.get('/discount-codes', verifyAdmin, async (req, res) => {
    try {
        const promotionCodes = await stripe.promotionCodes.list({
            limit: 50,
            expand: ['data.coupon']
        });
        res.json(promotionCodes.data);
    } catch (error) {
        console.error('Get discount codes error:', error);
        res.status(500).json({ error: 'Failed to fetch discount codes' });
    }
});

// POST /api/admin/discount-codes - Create a new promotion code
router.post('/discount-codes', verifyAdmin, async (req, res) => {
    try {
        const { code, discount_type, value, max_redemptions, expires_at } = req.body;

        if (!code || !discount_type || !value) {
            return res.status(400).json({ error: 'Código, tipo y valor son requeridos' });
        }

        // Create coupon first
        const couponData = { currency: 'mxn' };
        if (discount_type === 'percent') {
            couponData.percent_off = parseFloat(value);
        } else {
            couponData.amount_off = parseInt(value) * 100; // Convert MXN to centavos
        }

        const coupon = await stripe.coupons.create(couponData);

        // Create promotion code linked to coupon
        const promoData = {
            coupon: coupon.id,
            code: code.toUpperCase().trim()
        };
        if (max_redemptions) promoData.max_redemptions = parseInt(max_redemptions);
        if (expires_at) promoData.expires_at = Math.floor(new Date(expires_at).getTime() / 1000);

        const promotionCode = await stripe.promotionCodes.create(promoData);
        res.status(201).json(promotionCode);

    } catch (error) {
        console.error('Create discount code error:', error);
        res.status(500).json({ error: error.message || 'Failed to create discount code' });
    }
});

// PATCH /api/admin/discount-codes/:id - Activate/deactivate promotion code
router.patch('/discount-codes/:id', verifyAdmin, async (req, res) => {
    try {
        const { active } = req.body;
        const promotionCode = await stripe.promotionCodes.update(req.params.id, { active });
        res.json(promotionCode);
    } catch (error) {
        console.error('Update discount code error:', error);
        res.status(500).json({ error: 'Failed to update discount code' });
    }
});

// ============================================
// PAGES ROUTES
// ============================================

// GET /api/admin/pages - Get all pages (including inactive)
router.get('/pages', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('pages')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Get pages error:', error);
        res.status(500).json({ error: 'Failed to fetch pages' });
    }
});

// POST /api/admin/pages - Create a new page
router.post('/pages', verifyAdmin, async (req, res) => {
    try {
        const { title, content, is_active } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Auto-generate slug from title
        const slug = title.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Get max display_order
        const { data: maxOrder } = await supabaseAdmin
            .from('pages')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1);

        const display_order = (maxOrder && maxOrder.length > 0) ? maxOrder[0].display_order + 1 : 1;

        const { data, error } = await supabaseAdmin
            .from('pages')
            .insert({
                title,
                slug,
                content: content || '',
                is_active: is_active !== undefined ? is_active : false,
                display_order
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);

    } catch (error) {
        console.error('Create page error:', error);
        res.status(500).json({ error: error.message || 'Failed to create page' });
    }
});

// PUT /api/admin/pages/:id - Update a page
router.put('/pages/:id', verifyAdmin, async (req, res) => {
    try {
        const { title, slug, content, is_active } = req.body;

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (slug !== undefined) updateData.slug = slug;
        if (content !== undefined) updateData.content = content;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabaseAdmin
            .from('pages')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Update page error:', error);
        res.status(500).json({ error: 'Failed to update page' });
    }
});

// DELETE /api/admin/pages/:id - Delete a page
router.delete('/pages/:id', verifyAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('pages')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Page deleted successfully' });

    } catch (error) {
        console.error('Delete page error:', error);
        res.status(500).json({ error: 'Failed to delete page' });
    }
});

// ============================================
// ORDERS ROUTES
// ============================================

// GET /api/admin/orders - Get all orders
router.get('/orders', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*')
            .order('createdAt', { ascending: false });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// PATCH /api/admin/orders/:id/status - Update order status
router.patch('/orders/:id/status', verifyAdmin, async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const validStatuses = ['pagado', 'procesado', 'enviado', 'entregado'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Status inválido. Valores permitidos: ${validStatuses.join(', ')}` });
        }

        const updateData = { status };
        if (trackingNumber) {
            updateData.trackingNumber = trackingNumber;
        }

        const { data, error } = await supabaseAdmin
            .from('orders')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        // Send email notification to customer about status update
        try {
            const { sendStatusUpdate } = require('../lib/email');
            await sendStatusUpdate(data, status);
        } catch (emailError) {
            console.error('Error sending status update email:', emailError);
        }

        res.json(data);

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// ============================================
// SUBSCRIBERS ROUTES
// ============================================

// GET /api/admin/subscribers - Get all subscribers
router.get('/subscribers', verifyAdmin, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('subscribers')
            .select('*')
            .order('subscribed_at', { ascending: false });

        if (error) throw error;
        res.json(data);

    } catch (error) {
        console.error('Get subscribers error:', error);
        res.status(500).json({ error: 'Failed to fetch subscribers' });
    }
});

// DELETE /api/admin/subscribers/:id - Delete a subscriber
router.delete('/subscribers/:id', verifyAdmin, async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('subscribers')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Subscriber deleted successfully' });

    } catch (error) {
        console.error('Delete subscriber error:', error);
        res.status(500).json({ error: 'Failed to delete subscriber' });
    }
});

// POST /api/admin/subscribers/send-email - Send marketing email to all active subscribers
router.post('/subscribers/send-email', verifyAdmin, async (req, res) => {
    try {
        const { subject, content, headerText } = req.body;

        if (!subject || !content) {
            return res.status(400).json({ error: 'Asunto y contenido son requeridos' });
        }

        // Get all active subscribers
        const { data: subscribers, error } = await supabaseAdmin
            .from('subscribers')
            .select('email')
            .eq('is_active', true);

        if (error) throw error;

        if (!subscribers || subscribers.length === 0) {
            return res.status(400).json({ error: 'No hay suscriptores activos' });
        }

        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Legado San José <onboarding@resend.dev>';
        const REPLY_TO_EMAIL = process.env.REPLY_TO_EMAIL || 'legadosanjosemx@gmail.com';

        // Build header section (optional, customizable from admin)
        const headerHtml = headerText
            ? `<div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; text-align: center;">
                   <h1 style="color: #F5A84F; font-size: 22px; margin: 0; letter-spacing: 4px; text-transform: uppercase; font-weight: 700;">${headerText}</h1>
               </div>`
            : '';

        const html = `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff;">
            ${headerHtml}
            <div style="padding: 30px; line-height: 1.8; color: #333;">
                ${content}
            </div>
            <div style="background: #1a1a1a; padding: 20px; text-align: center;">
                <p style="color: #888; font-size: 12px; margin: 0;">Legado San José — Tradición que se viste</p>
                <p style="color: #666; font-size: 11px; margin: 8px 0 0;">Si ya no deseas recibir estos correos, responde con "DESUSCRIBIR".</p>
            </div>
        </div>
        `;

        // Send emails in batches of 50
        const batchSize = 50;
        let sent = 0;
        let failed = 0;

        for (let i = 0; i < subscribers.length; i += batchSize) {
            const batch = subscribers.slice(i, i + batchSize);
            const emails = batch.map(s => s.email);

            try {
                await resend.batch.send(
                    emails.map(email => ({
                        from: FROM_EMAIL,
                        to: [email],
                        reply_to: REPLY_TO_EMAIL,
                        subject: subject,
                        html: html
                    }))
                );
                sent += emails.length;
            } catch (batchError) {
                console.error('Batch send error:', batchError);
                failed += emails.length;
            }
        }

        res.json({
            message: `Emails enviados: ${sent}, fallidos: ${failed}`,
            sent,
            failed,
            total: subscribers.length
        });

    } catch (error) {
        console.error('Send marketing email error:', error);
        res.status(500).json({ error: error.message || 'Failed to send emails' });
    }
});

module.exports = router;
