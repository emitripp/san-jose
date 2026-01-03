// ============================================
// ADMIN PANEL JAVASCRIPT - LEGADO SAN JOSÉ
// ============================================

const API_BASE = '/api/admin';
let authToken = localStorage.getItem('admin_token');
let currentProducts = [];
let currentGallery = [];
let currentContent = [];
let deleteCallback = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    if (authToken) {
        verifyToken();
    } else {
        showLogin();
    }

    setupEventListeners();
});

function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    // Add product button
    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());

    // Add gallery button
    document.getElementById('add-gallery-btn').addEventListener('click', () => openGalleryModal());

    // Product form
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);

    // Gallery form
    document.getElementById('gallery-form').addEventListener('submit', handleGallerySubmit);

    // Change password form
    document.getElementById('change-password-form').addEventListener('submit', handlePasswordChange);

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel, .modal-backdrop').forEach(el => {
        el.addEventListener('click', closeAllModals);
    });

    // Confirm delete button
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (deleteCallback) {
            deleteCallback();
            closeAllModals();
        }
    });

    // Image upload handlers
    document.getElementById('main-image-input').addEventListener('change', handleMainImageUpload);
    document.getElementById('gallery-image-input').addEventListener('change', handleGalleryImageUpload);
}

// ============================================
// AUTHENTICATION
// ============================================

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            errorEl.textContent = data.error || 'Error al iniciar sesión';
            return;
        }

        // Save token and admin info
        authToken = data.token;
        localStorage.setItem('admin_token', authToken);
        localStorage.setItem('admin_info', JSON.stringify(data.admin));

        showDashboard(data.admin);

    } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = 'Error de conexión';
    }
}

async function verifyToken() {
    try {
        const response = await fetch(`${API_BASE}/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) {
            logout();
            return;
        }

        const data = await response.json();
        showDashboard(data.admin);

    } catch (error) {
        console.error('Token verification error:', error);
        logout();
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_info');
    showLogin();
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
}

function showDashboard(admin) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'flex';

    // Update admin info
    document.getElementById('admin-name').textContent = admin.name || 'Admin';
    document.getElementById('admin-email').textContent = admin.email;

    // Load initial data
    loadProducts();
    loadGallery();
    loadContent();
}

async function handlePasswordChange(e) {
    e.preventDefault();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const messageEl = document.getElementById('password-message');

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'Las contraseñas no coinciden';
        messageEl.className = 'message error';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();

        if (!response.ok) {
            messageEl.textContent = data.error || 'Error al cambiar contraseña';
            messageEl.className = 'message error';
            return;
        }

        messageEl.textContent = 'Contraseña cambiada exitosamente';
        messageEl.className = 'message success';
        e.target.reset();

    } catch (error) {
        console.error('Password change error:', error);
        messageEl.textContent = 'Error de conexión';
        messageEl.className = 'message error';
    }
}

// ============================================
// NAVIGATION
// ============================================

function switchSection(sectionName) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionName);
    });

    // Update sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.toggle('active', section.id === `${sectionName}-section`);
    });
}

// ============================================
// PRODUCTS
// ============================================

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE}/products`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load products');

        currentProducts = await response.json();
        renderProducts();

    } catch (error) {
        console.error('Load products error:', error);
        showToast('Error al cargar productos', 'error');
    }
}

function renderProducts() {
    const grid = document.getElementById('admin-products-grid');

    if (currentProducts.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No hay productos. Haz clic en "Nuevo Producto" para agregar uno.</p>';
        return;
    }

    // Group products by category
    const categories = {
        gorras: { name: 'Gorras', products: [] },
        playeras: { name: 'Playeras', products: [] },
        mochilas: { name: 'Mochilas', products: [] },
        maletas: { name: 'Maletas', products: [] }
    };

    currentProducts.forEach(product => {
        if (categories[product.category]) {
            categories[product.category].products.push(product);
        }
    });

    // Helper to fix image path (relative paths need to go up from /admin/)
    const fixImagePath = (url) => {
        if (!url) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect fill="%23eee" width="80" height="80"/></svg>';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        // Local relative path - go up one level from /admin/
        return '../' + url;
    };

    grid.innerHTML = Object.entries(categories)
        .filter(([_, cat]) => cat.products.length > 0)
        .map(([categoryKey, category]) => `
            <div class="category-section">
                <h3 class="category-title">${category.name} (${category.products.length})</h3>
                <div class="category-products" data-category="${categoryKey}">
                    ${category.products.map((product, index) => `
                        <div class="product-row" data-id="${product.id}" data-order="${product.display_order || index}">
                            <span class="drag-handle">☰</span>
                            <img src="${fixImagePath(product.image_url)}" 
                                 alt="${product.name}" 
                                 class="product-row-image"
                                 onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'60\\' height=\\'60\\'><rect fill=\\'%23eee\\' width=\\'60\\' height=\\'60\\'/></svg>'">
                            <div class="product-row-info">
                                <span class="product-row-name">${product.name}</span>
                                <span class="product-row-price">$${product.price.toLocaleString('es-MX')} MXN</span>
                            </div>
                            <span class="product-row-status ${product.is_active ? 'active' : 'inactive'}">
                                ${product.is_active ? 'Activo' : 'Inactivo'}
                            </span>
                            <div class="product-row-actions">
                                <button class="btn-edit-sm" onclick="editProduct('${product.id}')">Editar</button>
                                <button class="btn-delete-sm" onclick="confirmDeleteProduct('${product.id}')">×</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

    // Initialize drag & drop for each category
    initDragAndDrop();
}

// Initialize drag and drop functionality
function initDragAndDrop() {
    document.querySelectorAll('.category-products').forEach(container => {
        let draggedItem = null;

        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('product-row')) {
                draggedItem = e.target;
                e.target.classList.add('dragging');
            }
        });

        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('product-row')) {
                e.target.classList.remove('dragging');
                saveNewOrder(container);
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            const dragging = container.querySelector('.dragging');
            if (afterElement == null) {
                container.appendChild(dragging);
            } else {
                container.insertBefore(dragging, afterElement);
            }
        });

        // Make rows draggable
        container.querySelectorAll('.product-row').forEach(row => {
            row.draggable = true;
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.product-row:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveNewOrder(container) {
    const rows = container.querySelectorAll('.product-row');
    const orderedIds = [...rows].map(row => row.dataset.id);

    try {
        const response = await fetch(`${API_BASE}/products-reorder`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ orderedIds })
        });

        if (!response.ok) throw new Error('Failed to reorder');
        showToast('Orden actualizado', 'success');

    } catch (error) {
        console.error('Reorder error:', error);
        showToast('Error al reordenar', 'error');
    }
}


function openProductModal(product = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const title = document.getElementById('modal-title');

    // Reset form
    form.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-image-url').value = '';
    document.getElementById('main-image-preview').style.display = 'none';
    document.querySelector('#main-image-upload .upload-placeholder').style.display = 'block';
    document.getElementById('additional-images').innerHTML = '';
    document.getElementById('variants-container').innerHTML = '';

    if (product) {
        title.textContent = 'Editar Producto';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-active').value = product.is_active ? 'true' : 'false';
        document.getElementById('product-sizes').value = (product.sizes || []).join(', ');
        document.getElementById('product-image-url').value = product.image_url || '';

        // Show main image
        if (product.image_url) {
            const preview = document.getElementById('main-image-preview');
            preview.src = product.image_url;
            preview.style.display = 'block';
            document.querySelector('#main-image-upload .upload-placeholder').style.display = 'none';
        }

        // Load additional images
        if (product.images && product.images.length > 0) {
            product.images.forEach(url => addAdditionalImagePreview(url));
        }

        // Load variants
        if (product.variants && product.variants.length > 0) {
            product.variants.forEach(v => addVariant(v));
        }
    } else {
        title.textContent = 'Nuevo Producto';
    }

    modal.classList.add('active');
}

async function editProduct(id) {
    const product = currentProducts.find(p => p.id === id);
    if (product) {
        openProductModal(product);
    }
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('product-id').value;
    const isEdit = !!id;

    // Gather form data
    const productData = {
        name: document.getElementById('product-name').value,
        price: parseInt(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value,
        description: document.getElementById('product-description').value,
        is_active: document.getElementById('product-active').value === 'true',
        image_url: document.getElementById('product-image-url').value,
        images: getAdditionalImages(),
        sizes: document.getElementById('product-sizes').value
            .split(',')
            .map(s => s.trim())
            .filter(s => s),
        variants: getVariants()
    };

    try {
        const url = isEdit ? `${API_BASE}/products/${id}` : `${API_BASE}/products`;
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save product');
        }

        showToast(isEdit ? 'Producto actualizado' : 'Producto creado', 'success');
        closeAllModals();
        loadProducts();

    } catch (error) {
        console.error('Save product error:', error);
        showToast(error.message || 'Error al guardar producto', 'error');
    }
}

function confirmDeleteProduct(id) {
    const product = currentProducts.find(p => p.id === id);
    document.getElementById('confirm-message').textContent =
        `¿Estás seguro de que deseas eliminar "${product?.name || 'este producto'}"?`;

    deleteCallback = () => deleteProduct(id);
    document.getElementById('confirm-modal').classList.add('active');
}

async function deleteProduct(id) {
    try {
        const response = await fetch(`${API_BASE}/products/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete product');

        showToast('Producto eliminado', 'success');
        loadProducts();

    } catch (error) {
        console.error('Delete product error:', error);
        showToast('Error al eliminar producto', 'error');
    }
}

// ============================================
// IMAGE UPLOAD
// ============================================

async function handleMainImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        showToast('Subiendo imagen...', 'warning');

        const response = await fetch(`${API_BASE}/upload/product`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();

        // Update preview
        const preview = document.getElementById('main-image-preview');
        preview.src = data.url;
        preview.style.display = 'block';
        document.querySelector('#main-image-upload .upload-placeholder').style.display = 'none';

        // Store URL
        document.getElementById('product-image-url').value = data.url;

        showToast('Imagen subida', 'success');

    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error al subir imagen', 'error');
    }
}

function addAdditionalImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            showToast('Subiendo imagen...', 'warning');

            const response = await fetch(`${API_BASE}/upload/product`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();
            addAdditionalImagePreview(data.url);
            showToast('Imagen subida', 'success');

        } catch (error) {
            console.error('Upload error:', error);
            showToast('Error al subir imagen', 'error');
        }
    };
    input.click();
}

function addAdditionalImagePreview(url) {
    const container = document.getElementById('additional-images');
    const item = document.createElement('div');
    item.className = 'additional-image-item';
    item.innerHTML = `
        <img src="${url}" alt="Additional image">
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">×</button>
        <input type="hidden" class="additional-image-url" value="${url}">
    `;
    container.appendChild(item);
}

function getAdditionalImages() {
    const urls = [];
    document.querySelectorAll('.additional-image-url').forEach(input => {
        if (input.value) urls.push(input.value);
    });
    return urls;
}

// ============================================
// VARIANTS
// ============================================

function addVariant(data = null) {
    const container = document.getElementById('variants-container');
    const item = document.createElement('div');
    item.className = 'variant-item';
    item.innerHTML = `
        <div class="form-group">
            <label>Nombre</label>
            <input type="text" class="variant-name" value="${data?.name || ''}" placeholder="Ej: Azul">
        </div>
        <div class="form-group">
            <label>Color</label>
            <input type="color" class="variant-color" value="${data?.color || '#000000'}">
        </div>
        <button type="button" class="remove-variant" onclick="this.parentElement.remove()">×</button>
        <input type="hidden" class="variant-image" value="${data?.image || ''}">
    `;
    container.appendChild(item);
}

function getVariants() {
    const variants = [];
    document.querySelectorAll('.variant-item').forEach(item => {
        const name = item.querySelector('.variant-name').value.trim();
        const color = item.querySelector('.variant-color').value;
        const image = item.querySelector('.variant-image').value;

        if (name) {
            variants.push({ name, color, image });
        }
    });
    return variants;
}

// ============================================
// GALLERY
// ============================================

async function loadGallery() {
    try {
        const response = await fetch(`${API_BASE}/gallery`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load gallery');

        currentGallery = await response.json();
        renderGallery();

    } catch (error) {
        console.error('Load gallery error:', error);
    }
}

function renderGallery() {
    const grid = document.getElementById('admin-gallery-grid');

    if (currentGallery.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No hay imágenes en la galería.</p>';
        return;
    }

    // Helper to fix image path (relative paths need to go up from /admin/)
    const fixImagePath = (url) => {
        if (!url) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23eee" width="100" height="100"/></svg>';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        return '../' + url;
    };

    grid.innerHTML = currentGallery.map(img => `
        <div class="gallery-item" data-id="${img.id}">
            <img src="${fixImagePath(img.image_url)}" alt="${img.alt_text || 'Gallery image'}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><rect fill=\\'%23eee\\' width=\\'100\\' height=\\'100\\'/></svg>'">
            <div class="gallery-item-overlay">
                <button onclick="confirmDeleteGallery('${img.id}')">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function openGalleryModal() {
    const modal = document.getElementById('gallery-modal');
    document.getElementById('gallery-form').reset();
    document.getElementById('gallery-image-url').value = '';
    document.getElementById('gallery-image-preview').style.display = 'none';
    document.querySelector('#gallery-image-upload .upload-placeholder').style.display = 'block';
    modal.classList.add('active');
}

async function handleGalleryImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
        showToast('Subiendo imagen...', 'warning');

        const response = await fetch(`${API_BASE}/upload/gallery`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();

        const preview = document.getElementById('gallery-image-preview');
        preview.src = data.url;
        preview.style.display = 'block';
        document.querySelector('#gallery-image-upload .upload-placeholder').style.display = 'none';
        document.getElementById('gallery-image-url').value = data.url;

        showToast('Imagen subida', 'success');

    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error al subir imagen', 'error');
    }
}

async function handleGallerySubmit(e) {
    e.preventDefault();

    const image_url = document.getElementById('gallery-image-url').value;
    const alt_text = document.getElementById('gallery-alt').value;

    if (!image_url) {
        showToast('Por favor sube una imagen', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/gallery`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ image_url, alt_text })
        });

        if (!response.ok) throw new Error('Failed to add gallery image');

        showToast('Imagen agregada', 'success');
        closeAllModals();
        loadGallery();

    } catch (error) {
        console.error('Add gallery error:', error);
        showToast('Error al agregar imagen', 'error');
    }
}

function confirmDeleteGallery(id) {
    document.getElementById('confirm-message').textContent =
        '¿Estás seguro de que deseas eliminar esta imagen de la galería?';

    deleteCallback = () => deleteGallery(id);
    document.getElementById('confirm-modal').classList.add('active');
}

async function deleteGallery(id) {
    try {
        const response = await fetch(`${API_BASE}/gallery/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete gallery image');

        showToast('Imagen eliminada', 'success');
        loadGallery();

    } catch (error) {
        console.error('Delete gallery error:', error);
        showToast('Error al eliminar imagen', 'error');
    }
}

// ============================================
// CONTENT
// ============================================

async function loadContent() {
    try {
        const response = await fetch(`${API_BASE}/content`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load content');

        currentContent = await response.json();
        renderContent();

    } catch (error) {
        console.error('Load content error:', error);
    }
}

function renderContent() {
    const editor = document.getElementById('content-editor');

    // Group content by section
    const sections = {};
    currentContent.forEach(item => {
        if (!sections[item.section]) {
            sections[item.section] = [];
        }
        sections[item.section].push(item);
    });

    const sectionLabels = {
        hero: 'Sección Hero (Inicio)',
        about: 'Sección Nosotros',
        footer: 'Footer'
    };

    editor.innerHTML = Object.entries(sections).map(([section, items]) => `
        <div class="content-section">
            <h3>${sectionLabels[section] || section}</h3>
            ${items.map(item => `
                <div class="form-group">
                    <label>${item.key}</label>
                    <input type="text" 
                           id="content-${section}-${item.key}" 
                           value="${item.content || ''}"
                           onchange="updateContent('${section}', '${item.key}', this.value)">
                </div>
            `).join('')}
        </div>
    `).join('');
}

async function updateContent(section, key, value) {
    try {
        const response = await fetch(`${API_BASE}/content/${section}/${key}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content: value })
        });

        if (!response.ok) throw new Error('Failed to update content');

        showToast('Contenido actualizado', 'success');

    } catch (error) {
        console.error('Update content error:', error);
        showToast('Error al actualizar contenido', 'error');
    }
}

// ============================================
// UTILITIES
// ============================================

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    deleteCallback = null;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Make functions globally available
window.editProduct = editProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.addAdditionalImage = addAdditionalImage;
window.addVariant = addVariant;
window.confirmDeleteGallery = confirmDeleteGallery;
window.updateContent = updateContent;
