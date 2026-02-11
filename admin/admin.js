// ============================================
// ADMIN PANEL JAVASCRIPT - LEGADO SAN JOSÉ
// ============================================

const API_BASE = '/api/admin';
let authToken = localStorage.getItem('admin_token');
let currentProducts = [];
let currentGallery = [];
let currentContent = [];
let currentCategories = [];
let currentOrders = [];
let currentDiscountCodes = [];
let currentPages = [];
let currentSubscribers = [];
let deleteCallback = null;
let inputPromptCallback = null;

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

    // Add category button
    const addCategoryBtn = document.getElementById('add-category-btn');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => openCategoryModal());
    }

    // Add discount button
    const addDiscountBtn = document.getElementById('add-discount-btn');
    if (addDiscountBtn) {
        addDiscountBtn.addEventListener('click', () => openDiscountModal());
    }

    // Add page button
    const addPageBtn = document.getElementById('add-page-btn');
    if (addPageBtn) {
        addPageBtn.addEventListener('click', () => openPageModal());
    }

    // Product form
    document.getElementById('product-form').addEventListener('submit', handleProductSubmit);

    // Gallery form
    document.getElementById('gallery-form').addEventListener('submit', handleGallerySubmit);

    // Category form
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', handleCategorySubmit);
    }

    // Discount form
    const discountForm = document.getElementById('discount-form');
    if (discountForm) {
        discountForm.addEventListener('submit', handleDiscountSubmit);
    }

    // Page form
    const pageForm = document.getElementById('page-form');
    if (pageForm) {
        pageForm.addEventListener('submit', handlePageSubmit);
    }

    // Send email button
    const sendEmailBtn = document.getElementById('send-email-btn');
    if (sendEmailBtn) {
        sendEmailBtn.addEventListener('click', () => openEmailModal());
    }

    // Email form
    const emailForm = document.getElementById('email-form');
    if (emailForm) {
        emailForm.addEventListener('submit', handleSendEmail);
    }

    // Email editor toolbar buttons
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.value || null;
            const editor = document.getElementById('email-content');
            editor.focus();
            if (cmd === 'createLink') {
                showInputPrompt('Insertar Enlace', 'URL del enlace', 'https://', (url) => {
                    if (url) {
                        editor.focus();
                        document.execCommand('createLink', false, url);
                        updateToolbarState();
                    }
                });
            } else if (cmd === 'formatBlock') {
                document.execCommand('formatBlock', false, `<${val}>`);
            } else {
                document.execCommand(cmd, false, val);
            }
            updateToolbarState();
        });
    });

    // Track toolbar active state on selection changes
    const emailEditor = document.getElementById('email-content');
    if (emailEditor) {
        emailEditor.addEventListener('keyup', updateToolbarState);
        emailEditor.addEventListener('mouseup', updateToolbarState);
        emailEditor.addEventListener('focus', updateToolbarState);
    }

    // Email preview button
    const emailPreviewBtn = document.getElementById('email-preview-btn');
    if (emailPreviewBtn) {
        emailPreviewBtn.addEventListener('click', () => {
            const editor = document.getElementById('email-content');
            const content = editor.innerHTML;
            const headerText = document.getElementById('email-header-text').value.trim();
            const previewSection = document.getElementById('email-preview-section');
            const previewDiv = document.getElementById('email-preview');
            if (content.trim() && content.trim() !== '<br>') {
                previewDiv.innerHTML = buildEmailPreview(headerText, content);
                previewSection.style.display = 'block';
            }
        });
    }

    // Change password form
    document.getElementById('change-password-form').addEventListener('submit', handlePasswordChange);

    // Modal close buttons — except overlay modals (confirm, input-prompt)
    document.querySelectorAll('.modal-close, .modal-cancel, .modal-backdrop').forEach(el => {
        el.addEventListener('click', (e) => {
            const parentModal = e.target.closest('.modal');
            if (parentModal && (parentModal.id === 'confirm-modal' || parentModal.id === 'input-prompt-modal')) {
                // Only close this overlay modal, not the one underneath
                parentModal.classList.remove('active');
                deleteCallback = null;
                inputPromptCallback = null;
            } else {
                closeAllModals();
            }
        });
    });

    // Confirm action button
    document.getElementById('confirm-delete-btn').addEventListener('click', () => {
        if (deleteCallback) {
            const cb = deleteCallback;
            deleteCallback = null;
            document.getElementById('confirm-modal').classList.remove('active');
            cb();
        }
    });

    // Input prompt modal - OK button
    document.getElementById('input-prompt-ok').addEventListener('click', () => {
        const val = document.getElementById('input-prompt-value').value;
        if (inputPromptCallback) {
            const cb = inputPromptCallback;
            inputPromptCallback = null;
            document.getElementById('input-prompt-modal').classList.remove('active');
            cb(val);
        }
    });

    // Input prompt modal - Enter key
    document.getElementById('input-prompt-value').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('input-prompt-ok').click();
        }
    });

    // Image upload handlers
    document.getElementById('main-image-input').addEventListener('change', handleMainImageUpload);
    document.getElementById('gallery-image-input').addEventListener('change', handleGalleryImageUpload);

    // Maintenance toggle
    const maintenanceToggle = document.getElementById('maintenance-toggle');
    if (maintenanceToggle) {
        maintenanceToggle.addEventListener('change', handleMaintenanceToggle);
    }
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
    loadCategories(); // Load categories first for product form
    loadProducts();
    loadOrders();
    loadGallery();
    loadContent();
    loadDiscountCodes();
    loadPages();
    loadSubscribers();
    loadSettings();
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
                            <span class="product-row-stock" style="font-size: 0.8rem; color: ${product.stock === 0 ? '#e74c3c' : product.stock !== null && product.stock !== undefined ? '#27ae60' : '#888'};">
                                ${product.stock === 0 ? 'AGOTADO' : product.stock !== null && product.stock !== undefined ? product.stock + ' pzas' : 'Sin límite'}
                            </span>
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
    document.getElementById('product-stock').value = '';

    if (product) {
        title.textContent = 'Editar Producto';
        document.getElementById('product-id').value = product.id;
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-category').value = product.category;
        document.getElementById('product-description').value = product.description || '';
        document.getElementById('product-active').value = product.is_active ? 'true' : 'false';
        document.getElementById('product-sizes').value = (product.sizes || []).join(', ');
        document.getElementById('product-stock').value = product.stock !== null && product.stock !== undefined ? product.stock : '';
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
    const stockValue = document.getElementById('product-stock').value;
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
        variants: getVariants(),
        stock: stockValue !== '' ? parseInt(stockValue) : null
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
    showConfirmModal(
        'Confirmar Eliminación',
        `¿Estás seguro de que deseas eliminar "${product?.name || 'este producto'}"?`,
        'Eliminar',
        () => deleteProduct(id)
    );
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
    const variantId = Date.now() + Math.random().toString(36).substr(2, 9);
    item.className = 'variant-item';
    item.dataset.variantId = variantId;

    const hasImage = data?.image && data.image.length > 0;

    // Fix image path for display (relative paths need to go up from /admin/)
    const fixImagePath = (url) => {
        if (!url) return '';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        return '../' + url;
    };

    const displayImageUrl = hasImage ? fixImagePath(data.image) : '';

    item.innerHTML = `
        <div class="variant-row">
            <div class="form-group">
                <label>Nombre</label>
                <input type="text" class="variant-name" value="${data?.name || ''}" placeholder="Ej: Azul">
            </div>
            <div class="form-group">
                <label>Color</label>
                <input type="color" class="variant-color" value="${data?.color || '#000000'}">
            </div>
            <button type="button" class="remove-variant" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="variant-image-section">
            <label>Imagen de variante</label>
            <div class="variant-image-upload" id="variant-upload-${variantId}">
                <input type="file" class="variant-image-input" id="variant-input-${variantId}" accept="image/*" style="display: none;">
                <div class="variant-upload-placeholder ${hasImage ? 'hidden' : ''}" onclick="document.getElementById('variant-input-${variantId}').click()">
                    <span>📷</span>
                    <p>Click para subir imagen</p>
                </div>
                <div class="variant-image-preview-container ${hasImage ? '' : 'hidden'}">
                    <img class="variant-image-preview" src="${displayImageUrl}" alt="Preview">
                    <div class="variant-image-actions">
                        <button type="button" class="btn-change-image" onclick="document.getElementById('variant-input-${variantId}').click()">Cambiar</button>
                        <button type="button" class="btn-remove-image" onclick="removeVariantImage('${variantId}')">Eliminar</button>
                    </div>
                </div>
            </div>
            <input type="hidden" class="variant-image" value="${data?.image || ''}">
        </div>
    `;
    container.appendChild(item);

    // Add event listener for image upload
    const imageInput = item.querySelector(`#variant-input-${variantId}`);
    imageInput.addEventListener('change', (e) => handleVariantImageUpload(e, variantId));
}

async function handleVariantImageUpload(e, variantId) {
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

        // Update the variant item
        const variantItem = document.querySelector(`[data-variant-id="${variantId}"]`);
        if (variantItem) {
            const preview = variantItem.querySelector('.variant-image-preview');
            const previewContainer = variantItem.querySelector('.variant-image-preview-container');
            const placeholder = variantItem.querySelector('.variant-upload-placeholder');
            const hiddenInput = variantItem.querySelector('.variant-image');

            preview.src = data.url;
            previewContainer.classList.remove('hidden');
            placeholder.classList.add('hidden');
            hiddenInput.value = data.url;
        }

        showToast('Imagen subida', 'success');

    } catch (error) {
        console.error('Upload error:', error);
        showToast('Error al subir imagen', 'error');
    }
}

function removeVariantImage(variantId) {
    const variantItem = document.querySelector(`[data-variant-id="${variantId}"]`);
    if (variantItem) {
        const preview = variantItem.querySelector('.variant-image-preview');
        const previewContainer = variantItem.querySelector('.variant-image-preview-container');
        const placeholder = variantItem.querySelector('.variant-upload-placeholder');
        const hiddenInput = variantItem.querySelector('.variant-image');

        preview.src = '';
        previewContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
        hiddenInput.value = '';
    }
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
        if (!url) return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect fill="%23eee" width="200" height="150"/></svg>';
        if (url.startsWith('http') || url.startsWith('data:')) return url;
        return '../' + url;
    };

    grid.innerHTML = `<div class="gallery-reorder-grid">
        ${currentGallery.map((img, index) => `
            <div class="gallery-reorder-item" data-id="${img.id}" draggable="true">
                <img src="${fixImagePath(img.image_url)}" alt="${img.alt_text || 'Gallery image'}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'150\\'><rect fill=\\'%23eee\\' width=\\'200\\' height=\\'150\\'/></svg>'">
                <div class="gallery-reorder-overlay">
                    <div class="gallery-order-badge">${index + 1}</div>
                    <div class="gallery-item-info">
                        <span class="gallery-alt-text">${img.alt_text || 'Sin descripción'}</span>
                        <button class="btn-delete-gallery" onclick="event.stopPropagation(); confirmDeleteGallery('${img.id}')">×</button>
                    </div>
                </div>
            </div>
        `).join('')}
    </div>`;

    // Initialize drag & drop for gallery
    initGalleryDragAndDrop();
}

function initGalleryDragAndDrop() {
    const container = document.querySelector('.gallery-reorder-grid');
    if (!container) return;

    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.gallery-reorder-item');
        if (item) {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    container.addEventListener('dragend', (e) => {
        const item = e.target.closest('.gallery-reorder-item');
        if (item) {
            item.classList.remove('dragging');
            // Update order badges
            container.querySelectorAll('.gallery-reorder-item').forEach((el, i) => {
                const badge = el.querySelector('.gallery-order-badge');
                if (badge) badge.textContent = i + 1;
            });
            saveGalleryOrder();
        }
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const afterElement = getGalleryDragAfterElement(container, e.clientX, e.clientY);
        const dragging = container.querySelector('.dragging');
        if (!dragging) return;
        if (afterElement == null) {
            container.appendChild(dragging);
        } else {
            container.insertBefore(dragging, afterElement);
        }
    });
}

function getGalleryDragAfterElement(container, x, y) {
    const elements = [...container.querySelectorAll('.gallery-reorder-item:not(.dragging)')];
    return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offsetX = x - box.left - box.width / 2;
        const offsetY = y - box.top - box.height / 2;
        // Use combined distance for grid layout
        const offset = offsetY * 3 + offsetX; // Weight Y more since rows matter more
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveGalleryOrder() {
    const items = document.querySelectorAll('.gallery-reorder-item');
    const orderedIds = [...items].map(item => item.dataset.id);

    try {
        const response = await fetch(`${API_BASE}/gallery-reorder`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ orderedIds })
        });

        if (!response.ok) throw new Error('Failed to reorder');
        showToast('Orden de galería actualizado', 'success');

    } catch (error) {
        console.error('Gallery reorder error:', error);
        showToast('Error al reordenar galería', 'error');
    }
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
    showConfirmModal(
        'Confirmar Eliminación',
        '¿Estás seguro de que deseas eliminar esta imagen de la galería?',
        'Eliminar',
        () => deleteGallery(id)
    );
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
        footer: 'Footer',
        shop: 'Tienda (Productos)',
        newsletter: 'Suscripción (Newsletter)'
    };

    // Order sections for display
    const sectionOrder = ['hero', 'about', 'shop', 'newsletter', 'footer'];

    const keyLabels = {
        'subtitle': 'Subtítulo',
        'title': 'Título',
        'description': 'Descripción',
        'button': 'Texto del Botón',
        'button_link': 'Destino del Botón',
        'paragraph1': 'Párrafo 1',
        'paragraph2': 'Párrafo 2',
        'tagline': 'Eslogan',
        'features': 'Características (separadas por |)',
        'video_url': 'URL del Video de Fondo'
    };

    // Build page link options for button_link select
    const linkOptions = [
        { value: 'productos.html', label: 'Productos (Tienda)' },
        { value: 'index.html#contacto', label: 'Contacto' },
        { value: 'index.html#galeria', label: 'Galería' },
        { value: 'index.html#nosotros', label: 'Nosotros' },
    ];
    // Add dynamic pages
    if (currentPages && currentPages.length > 0) {
        currentPages
            .filter(p => p.is_active)
            .forEach(p => {
                linkOptions.push({ value: `pagina.html?slug=${p.slug}`, label: p.title });
            });
    }

    // Sort sections by defined order, filter out settings
    const sortedSections = Object.entries(sections)
        .filter(([section]) => section !== 'settings')
        .sort((a, b) => {
            const idxA = sectionOrder.indexOf(a[0]);
            const idxB = sectionOrder.indexOf(b[0]);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        });

    editor.innerHTML = sortedSections.map(([section, items]) => `
        <div class="content-section">
            <h3>${sectionLabels[section] || section}</h3>
            ${items.map(item => {
                const label = keyLabels[item.key] || item.key;

                // Skip maintenance_mode (managed in settings)
                if (item.key === 'maintenance_mode') return '';

                // Special: button_link renders as a select dropdown
                if (item.key === 'button_link') {
                    const currentVal = item.content || 'productos.html';
                    return `
                    <div class="form-group">
                        <label>${label}</label>
                        <select id="content-${section}-${item.key}"
                                onchange="updateContent('${section}', '${item.key}', this.value)">
                            ${linkOptions.map(opt =>
                                `<option value="${opt.value}" ${opt.value === currentVal ? 'selected' : ''}>${opt.label}</option>`
                            ).join('')}
                        </select>
                    </div>
                    `;
                }

                // Special: features renders as textarea with helper text
                if (item.key === 'features') {
                    return `
                    <div class="form-group">
                        <label>${label}</label>
                        <input type="text"
                               id="content-${section}-${item.key}"
                               value="${item.content || ''}"
                               placeholder="Ej: Diseños exclusivos|Calidad premium|Ediciones limitadas"
                               onchange="updateContent('${section}', '${item.key}', this.value)">
                        <small style="color: #999; font-size: 12px; margin-top: 4px; display: block;">Separa cada característica con el símbolo |</small>
                    </div>
                    `;
                }

                const inputType = item.key.includes('link') || item.key.includes('url') ? 'url' : 'text';
                return `
                <div class="form-group">
                    <label>${label}</label>
                    <input type="${inputType}"
                           id="content-${section}-${item.key}"
                           value="${item.content || ''}"
                           ${inputType === 'url' ? 'placeholder="https://... o ruta relativa"' : ''}
                           onchange="updateContent('${section}', '${item.key}', this.value)">
                </div>
            `}).join('')}
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
// CATEGORIES
// ============================================

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE}/categories`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load categories');

        currentCategories = await response.json();
        renderCategories();
        updateCategorySelect();

    } catch (error) {
        console.error('Load categories error:', error);
    }
}

function renderCategories() {
    const list = document.getElementById('admin-categories-list');
    if (!list) return;

    if (currentCategories.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No hay categorías. Haz clic en "+ Nueva Categoría" para agregar una.</p>';
        return;
    }

    list.innerHTML = `
        <div class="categories-table">
            <div class="categories-header">
                <span>Nombre</span>
                <span>Slug</span>
                <span>Estado</span>
                <span>Acciones</span>
            </div>
            ${currentCategories.map(cat => `
                <div class="category-row" data-id="${cat.id}">
                    <span class="category-name">${cat.name}</span>
                    <span class="category-slug">${cat.slug}</span>
                    <span class="category-status ${cat.is_active ? 'active' : 'inactive'}">
                        ${cat.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <div class="category-actions">
                        <button class="btn-edit-sm" onclick="editCategory('${cat.id}')">Editar</button>
                        <button class="btn-delete-sm" onclick="confirmDeleteCategory('${cat.id}')">×</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function updateCategorySelect() {
    const select = document.getElementById('product-category');
    if (!select) return;

    // Keep the first "Seleccionar..." option
    const firstOption = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (firstOption) {
        select.appendChild(firstOption);
    } else {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleccionar...';
        select.appendChild(defaultOption);
    }

    // Add categories
    currentCategories.forEach(cat => {
        if (cat.is_active) {
            const option = document.createElement('option');
            option.value = cat.slug;
            option.textContent = cat.name;
            select.appendChild(option);
        }
    });
}

function openCategoryModal(category = null) {
    const modal = document.getElementById('category-modal');
    const form = document.getElementById('category-form');
    const title = document.getElementById('category-modal-title');

    form.reset();
    document.getElementById('category-id').value = '';

    if (category) {
        title.textContent = 'Editar Categoría';
        document.getElementById('category-id').value = category.id;
        document.getElementById('category-name').value = category.name;
        document.getElementById('category-active').value = category.is_active ? 'true' : 'false';
    } else {
        title.textContent = 'Nueva Categoría';
    }

    modal.classList.add('active');
}

function editCategory(id) {
    const category = currentCategories.find(c => c.id === id);
    if (category) {
        openCategoryModal(category);
    }
}

async function handleCategorySubmit(e) {
    e.preventDefault();

    const id = document.getElementById('category-id').value;
    const isEdit = !!id;

    const categoryData = {
        name: document.getElementById('category-name').value,
        is_active: document.getElementById('category-active').value === 'true'
    };

    try {
        const url = isEdit ? `${API_BASE}/categories/${id}` : `${API_BASE}/categories`;
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(categoryData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save category');
        }

        showToast(isEdit ? 'Categoría actualizada' : 'Categoría creada', 'success');
        closeAllModals();
        loadCategories();

    } catch (error) {
        console.error('Save category error:', error);
        showToast(error.message || 'Error al guardar categoría', 'error');
    }
}

function confirmDeleteCategory(id) {
    const category = currentCategories.find(c => c.id === id);
    showConfirmModal(
        'Confirmar Eliminación',
        `¿Estás seguro de que deseas eliminar la categoría "${category?.name || ''}"?`,
        'Eliminar',
        () => deleteCategory(id)
    );
}

async function deleteCategory(id) {
    try {
        const response = await fetch(`${API_BASE}/categories/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete category');

        showToast('Categoría eliminada', 'success');
        loadCategories();

    } catch (error) {
        console.error('Delete category error:', error);
        showToast('Error al eliminar categoría', 'error');
    }
}

// Make category functions globally available
window.editCategory = editCategory;
window.confirmDeleteCategory = confirmDeleteCategory;

// ============================================
// SETTINGS
// ============================================

async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/content`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load settings');

        const content = await response.json();
        const maintenanceSetting = content.find(item => item.section === 'settings' && item.key === 'maintenance_mode');

        if (maintenanceSetting) {
            const toggle = document.getElementById('maintenance-toggle');
            const statusText = document.getElementById('maintenance-status');
            const isActive = maintenanceSetting.content === 'true';

            if (toggle) toggle.checked = isActive;
            if (statusText) {
                statusText.textContent = isActive ? 'Modo Mantenimiento Activado' : 'Modo Mantenimiento Desactivado';
                statusText.style.color = isActive ? 'var(--danger)' : 'var(--gray-mid)';
            }
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

async function handleMaintenanceToggle(e) {
    const isChecked = e.target.checked;
    const statusText = document.getElementById('maintenance-status');

    try {
        const response = await fetch(`${API_BASE}/content/settings/maintenance_mode`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content: isChecked ? 'true' : 'false' })
        });

        if (!response.ok) throw new Error('Failed to update maintenance mode');

        if (statusText) {
            statusText.textContent = isChecked ? 'Modo Mantenimiento Activado' : 'Modo Mantenimiento Desactivado';
            statusText.style.color = isChecked ? 'var(--danger)' : 'var(--gray-mid)';
        }

        showToast(isChecked ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado', isChecked ? 'warning' : 'success');

    } catch (error) {
        console.error('Update maintenance error:', error);
        showToast('Error al actualizar modo mantenimiento', 'error');
        e.target.checked = !isChecked; // Revert toggle
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
    inputPromptCallback = null;
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

// ============================================
// ORDERS
// ============================================

async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load orders');

        currentOrders = await response.json();
        renderOrders();

    } catch (error) {
        console.error('Load orders error:', error);
        currentOrders = [];
        renderOrders();
    }
}

function renderOrders() {
    const list = document.getElementById('orders-list');
    if (!list) return;

    if (!currentOrders || currentOrders.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No hay pedidos aún.</p>';
        return;
    }

    const statusColors = {
        'pagado': '#3498db',
        'procesado': '#f39c12',
        'enviado': '#9b59b6',
        'entregado': '#27ae60',
        'pendiente': '#95a5a6'
    };

    const statusLabels = {
        'pagado': 'PAGADO',
        'procesado': 'PROCESADO',
        'enviado': 'ENVIADO',
        'entregado': 'ENTREGADO',
        'pendiente': 'PENDIENTE'
    };

    list.innerHTML = `
        <div class="orders-table">
            <div class="orders-header">
                <span>Pedido</span>
                <span>Cliente</span>
                <span>Total</span>
                <span>Estado</span>
                <span>Fecha</span>
                <span>Acciones</span>
            </div>
            ${currentOrders.map(order => {
                const status = order.status || 'pendiente';
                const customer = order.customer || {};
                const date = order.created_at ? new Date(order.created_at).toLocaleDateString('es-MX') : 'N/A';
                const totalDisplay = (order.total || 0) / 100;
                const orderNum = order.order_number ? `LSJ-${String(order.order_number).padStart(5, '0')}` : order.id.substring(0, 8);
                return `
                <div class="order-row" data-id="${order.id}">
                    <span class="order-id" style="font-weight: 600; font-family: monospace;">${orderNum}</span>
                    <span class="order-customer">
                        <strong>${customer.name || 'N/A'}</strong><br>
                        <small>${customer.email || ''}</small>
                    </span>
                    <span class="order-total">$${totalDisplay.toLocaleString('es-MX')} MXN</span>
                    <span>
                        <select class="order-status-select" data-order-id="${order.id}" style="border: 2px solid ${statusColors[status] || '#ccc'}; border-radius: 6px; padding: 4px 8px; font-size: 0.8rem; font-weight: 600; color: ${statusColors[status] || '#333'};">
                            ${['pagado', 'procesado', 'enviado', 'entregado'].map(s =>
                                `<option value="${s}" ${status === s ? 'selected' : ''}>${statusLabels[s]}</option>`
                            ).join('')}
                        </select>
                    </span>
                    <span class="order-date">${date}</span>
                    <span>
                        <button class="btn-edit-sm" onclick="viewOrderDetails('${order.id}')">Ver</button>
                    </span>
                </div>
            `}).join('')}
        </div>
    `;

    // Add event listeners for status changes
    list.querySelectorAll('.order-status-select').forEach(select => {
        select.addEventListener('change', (e) => {
            updateOrderStatus(e.target.dataset.orderId, e.target.value);
        });
    });
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update status');

        showToast(`Pedido actualizado a: ${newStatus.toUpperCase()}`, 'success');
        loadOrders();

    } catch (error) {
        console.error('Update order status error:', error);
        showToast('Error al actualizar estado', 'error');
        loadOrders(); // Reload to revert select
    }
}

function viewOrderDetails(orderId) {
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) return;

    const customer = order.customer || {};
    const items = order.items || [];
    const address = customer.address || {};

    let addressStr = '';
    if (address.line1) {
        addressStr = `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postal_code || ''}`;
    }

    const shippingDisplay = (order.shipping || 0) / 100;
    const totalDisplay = (order.total || 0) / 100;
    const dateStr = order.created_at ? new Date(order.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    const detailOrderNum = order.order_number ? `LSJ-${String(order.order_number).padStart(5, '0')}` : order.id;

    const detailsHtml = `
        <div style="max-width: 500px;">
            <h3 style="margin-bottom: 16px;">Pedido ${detailOrderNum}</h3>
            ${dateStr ? `<p style="color: #888; font-size: 0.85rem;">${dateStr}</p>` : ''}
            <hr style="margin: 12px 0;">
            <p><strong>Cliente:</strong> ${customer.name || 'N/A'}</p>
            <p><strong>Email:</strong> ${customer.email || 'N/A'}</p>
            ${customer.phone ? `<p><strong>Teléfono:</strong> ${customer.phone}</p>` : ''}
            ${customer.rfc ? `<p><strong>RFC:</strong> ${customer.rfc}</p>` : ''}
            ${addressStr ? `<p><strong>Dirección:</strong> ${addressStr}</p>` : ''}
            <p><strong>Estado:</strong> ${(order.status || 'pendiente').toUpperCase()}</p>
            ${order.tracking_number ? `<p><strong>Rastreo:</strong> ${order.tracking_number}</p>` : ''}
            <hr style="margin: 12px 0;">
            <p><strong>Productos:</strong></p>
            <ul style="margin: 8px 0; padding-left: 20px;">
                ${items.map(item => {
                    const details = [item.size ? `Talla: ${item.size}` : '', item.variant ? `Color: ${item.variant}` : ''].filter(Boolean).join(', ');
                    return `<li>${item.name}${details ? ' (' + details + ')' : ''} x${item.quantity} — $${(item.price || 0).toLocaleString('es-MX')}</li>`;
                }).join('')}
            </ul>
            <hr style="margin: 12px 0;">
            <p><strong>Envío:</strong> $${shippingDisplay.toLocaleString('es-MX')} MXN</p>
            <p style="font-size: 1.1rem;"><strong>Total: $${totalDisplay.toLocaleString('es-MX')} MXN</strong></p>
        </div>
    `;

    document.getElementById('confirm-title').textContent = 'Detalles del Pedido';
    document.getElementById('confirm-message').innerHTML = detailsHtml;
    document.getElementById('confirm-delete-btn').style.display = 'none';
    document.getElementById('confirm-modal').classList.add('active');

    // Restore delete button when modal closes
    const restoreBtn = () => {
        document.getElementById('confirm-delete-btn').style.display = '';
        document.getElementById('confirm-message').textContent = '';
    };
    document.querySelectorAll('#confirm-modal .modal-close, #confirm-modal .modal-cancel, #confirm-modal .modal-backdrop').forEach(el => {
        el.addEventListener('click', restoreBtn, { once: true });
    });
}

// ============================================
// DISCOUNT CODES
// ============================================

async function loadDiscountCodes() {
    try {
        const response = await fetch(`${API_BASE}/discount-codes`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load discount codes');

        currentDiscountCodes = await response.json();
        renderDiscountCodes();

    } catch (error) {
        console.error('Load discount codes error:', error);
    }
}

function renderDiscountCodes() {
    const list = document.getElementById('discounts-list');
    if (!list) return;

    if (!currentDiscountCodes || currentDiscountCodes.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No hay códigos de descuento. Haz clic en "+ Nuevo Código" para crear uno.</p>';
        return;
    }

    list.innerHTML = `
        <div class="categories-table">
            <div class="discounts-header">
                <span>Código</span>
                <span>Descuento</span>
                <span>Usos</span>
                <span>Expiración</span>
                <span>Estado</span>
                <span>Acciones</span>
            </div>
            ${currentDiscountCodes.map(promo => {
                const coupon = promo.coupon || {};
                const discount = coupon.percent_off
                    ? `${coupon.percent_off}%`
                    : coupon.amount_off
                        ? `$${(coupon.amount_off / 100).toLocaleString('es-MX')} MXN`
                        : 'N/A';
                const uses = promo.max_redemptions
                    ? `${promo.times_redeemed || 0} / ${promo.max_redemptions}`
                    : `${promo.times_redeemed || 0} / ∞`;
                const expires = promo.expires_at
                    ? new Date(promo.expires_at * 1000).toLocaleDateString('es-MX')
                    : 'Sin expiración';
                return `
                <div class="discount-row">
                    <span style="font-weight: 600; font-family: monospace; font-size: 1rem;">${promo.code}</span>
                    <span>${discount}</span>
                    <span>${uses}</span>
                    <span>${expires}</span>
                    <span><span class="category-status ${promo.active ? 'active' : 'inactive'}">${promo.active ? 'Activo' : 'Inactivo'}</span></span>
                    <span style="display: flex; gap: 6px;">
                        <button class="btn-edit-sm" onclick="toggleDiscountCode('${promo.id}', ${!promo.active})">
                            ${promo.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button class="btn-delete-sm" onclick="deleteDiscountCode('${promo.id}', '${promo.code}')">Eliminar</button>
                    </span>
                </div>
            `}).join('')}
        </div>
    `;
}

function openDiscountModal() {
    const modal = document.getElementById('discount-modal');
    document.getElementById('discount-form').reset();
    modal.classList.add('active');
}

async function handleDiscountSubmit(e) {
    e.preventDefault();

    const data = {
        code: document.getElementById('discount-code').value,
        discount_type: document.getElementById('discount-type').value,
        value: document.getElementById('discount-value').value,
        max_redemptions: document.getElementById('discount-max-uses').value || null,
        expires_at: document.getElementById('discount-expires').value || null
    };

    try {
        const response = await fetch(`${API_BASE}/discount-codes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create discount code');
        }

        showToast('Código de descuento creado', 'success');
        closeAllModals();
        loadDiscountCodes();

    } catch (error) {
        console.error('Create discount code error:', error);
        showToast(error.message || 'Error al crear código', 'error');
    }
}

async function toggleDiscountCode(id, active) {
    try {
        const response = await fetch(`${API_BASE}/discount-codes/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ active })
        });

        if (!response.ok) throw new Error('Failed to update discount code');

        showToast(active ? 'Código activado' : 'Código desactivado', 'success');
        loadDiscountCodes();

    } catch (error) {
        console.error('Toggle discount code error:', error);
        showToast('Error al actualizar código', 'error');
    }
}

function deleteDiscountCode(id, code) {
    showConfirmModal('Eliminar Código', `¿Eliminar el código "${code}"? Esto también eliminará el cupón asociado en Stripe.`, 'Eliminar', async () => {
        try {
            const response = await fetch(`${API_BASE}/discount-codes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            if (!response.ok) throw new Error('Failed to delete');

            showToast('Código eliminado', 'success');
            loadDiscountCodes();
        } catch (error) {
            console.error('Delete discount code error:', error);
            showToast('Error al eliminar código', 'error');
        }
    });
}

// ============================================
// PAGES
// ============================================

async function loadPages() {
    try {
        const response = await fetch(`${API_BASE}/pages`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load pages');

        currentPages = await response.json();
        renderPages();

        // Re-render content section so button_link dropdown includes dynamic pages
        if (currentContent.length > 0) {
            renderContent();
        }

    } catch (error) {
        console.error('Load pages error:', error);
    }
}

function renderPages() {
    const list = document.getElementById('pages-list');
    if (!list) return;

    if (!currentPages || currentPages.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No hay páginas. Haz clic en "+ Nueva Página" para crear una.</p>';
        return;
    }

    list.innerHTML = `
        <div class="categories-table">
            <div class="categories-header">
                <span>Título</span>
                <span>URL</span>
                <span>Estado</span>
                <span>Acciones</span>
            </div>
            ${currentPages.map(page => `
                <div class="category-row" data-id="${page.id}">
                    <span class="category-name">${page.title}</span>
                    <span class="category-slug">/pagina.html?slug=${page.slug}</span>
                    <span class="category-status ${page.is_active ? 'active' : 'inactive'}">
                        ${page.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <div class="category-actions">
                        <button class="btn-edit-sm" onclick="editPage('${page.id}')">Editar</button>
                        <button class="btn-delete-sm" onclick="confirmDeletePage('${page.id}')">×</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function openPageModal(page = null) {
    const modal = document.getElementById('page-modal');
    const form = document.getElementById('page-form');
    const title = document.getElementById('page-modal-title');

    form.reset();
    document.getElementById('page-id').value = '';

    if (page) {
        title.textContent = 'Editar Página';
        document.getElementById('page-id').value = page.id;
        document.getElementById('page-title').value = page.title;
        document.getElementById('page-content').value = page.content || '';
        document.getElementById('page-active').value = page.is_active ? 'true' : 'false';
    } else {
        title.textContent = 'Nueva Página';
    }

    modal.classList.add('active');
}

function editPage(id) {
    const page = currentPages.find(p => p.id === id);
    if (page) {
        openPageModal(page);
    }
}

async function handlePageSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('page-id').value;
    const isEdit = !!id;

    const pageData = {
        title: document.getElementById('page-title').value,
        content: document.getElementById('page-content').value,
        is_active: document.getElementById('page-active').value === 'true'
    };

    try {
        const url = isEdit ? `${API_BASE}/pages/${id}` : `${API_BASE}/pages`;
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(pageData)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save page');
        }

        showToast(isEdit ? 'Página actualizada' : 'Página creada', 'success');
        closeAllModals();
        loadPages();

    } catch (error) {
        console.error('Save page error:', error);
        showToast(error.message || 'Error al guardar página', 'error');
    }
}

function confirmDeletePage(id) {
    const page = currentPages.find(p => p.id === id);
    showConfirmModal(
        'Confirmar Eliminación',
        `¿Estás seguro de que deseas eliminar la página "${page?.title || ''}"?`,
        'Eliminar',
        () => deletePage(id)
    );
}

async function deletePage(id) {
    try {
        const response = await fetch(`${API_BASE}/pages/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete page');

        showToast('Página eliminada', 'success');
        loadPages();

    } catch (error) {
        console.error('Delete page error:', error);
        showToast('Error al eliminar página', 'error');
    }
}

// ============================================
// SUBSCRIBERS SECTION
// ============================================

async function loadSubscribers() {
    try {
        const response = await fetch(`${API_BASE}/subscribers`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to load subscribers');

        currentSubscribers = await response.json();
        renderSubscribers();

    } catch (error) {
        console.error('Load subscribers error:', error);
    }
}

function renderSubscribers() {
    const list = document.getElementById('subscribers-list');
    const stats = document.getElementById('subscribers-stats');
    if (!list) return;

    const activeCount = currentSubscribers.filter(s => s.is_active).length;
    const totalCount = currentSubscribers.length;

    // Stats bar
    if (stats) {
        stats.innerHTML = `
            <div style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                <div style="background: #f0f9f0; border: 1px solid #c3e6c3; border-radius: 8px; padding: 16px 24px; flex: 1; min-width: 150px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #2d8a2d;">${activeCount}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 4px;">Activos</div>
                </div>
                <div style="background: #f5f5f5; border: 1px solid #ddd; border-radius: 8px; padding: 16px 24px; flex: 1; min-width: 150px; text-align: center;">
                    <div style="font-size: 28px; font-weight: 700; color: #555;">${totalCount}</div>
                    <div style="font-size: 13px; color: #666; margin-top: 4px;">Total</div>
                </div>
            </div>
        `;
    }

    if (!currentSubscribers || currentSubscribers.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No hay suscriptores aún.</p>';
        return;
    }

    list.innerHTML = `
        <div class="categories-table">
            <div class="categories-header" style="grid-template-columns: 2fr 1fr 1fr 80px;">
                <span>Email</span>
                <span>Fecha</span>
                <span>Estado</span>
                <span>Acciones</span>
            </div>
            ${currentSubscribers.map(sub => `
                <div class="category-row" data-id="${sub.id}" style="grid-template-columns: 2fr 1fr 1fr 80px;">
                    <span class="category-name" style="font-size: 14px;">${sub.email}</span>
                    <span style="font-size: 13px; color: #888;">${new Date(sub.subscribed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span>
                        <span class="category-status ${sub.is_active ? 'active' : 'inactive'}">${sub.is_active ? 'Activo' : 'Inactivo'}</span>
                    </span>
                    <div class="category-actions">
                        <button class="btn-delete-sm" onclick="confirmDeleteSubscriber('${sub.id}')">×</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function confirmDeleteSubscriber(id) {
    const sub = currentSubscribers.find(s => s.id === id);
    showConfirmModal(
        'Confirmar Eliminación',
        `¿Estás seguro de que deseas eliminar al suscriptor "${sub?.email || ''}"?`,
        'Eliminar',
        () => deleteSubscriber(id)
    );
}

async function deleteSubscriber(id) {
    try {
        const response = await fetch(`${API_BASE}/subscribers/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!response.ok) throw new Error('Failed to delete subscriber');

        showToast('Suscriptor eliminado', 'success');
        loadSubscribers();

    } catch (error) {
        console.error('Delete subscriber error:', error);
        showToast('Error al eliminar suscriptor', 'error');
    }
}

function buildEmailPreview(headerText, content) {
    const headerHtml = headerText
        ? `<div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; text-align: center;">
               <h1 style="color: #F5A84F; font-size: 22px; margin: 0; letter-spacing: 4px; text-transform: uppercase; font-weight: 700;">${headerText}</h1>
           </div>`
        : '';

    return `
        <div style="max-width: 600px; margin: 0 auto; font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
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
}

function openEmailModal() {
    const modal = document.getElementById('email-modal');
    const form = document.getElementById('email-form');
    form.reset();
    // Clear the contenteditable editor
    const editor = document.getElementById('email-content');
    editor.innerHTML = '';
    // Reset header text to default
    document.getElementById('email-header-text').value = 'LEGADO SAN JOSÉ';
    document.getElementById('email-preview-section').style.display = 'none';

    const activeCount = currentSubscribers.filter(s => s.is_active).length;
    document.getElementById('email-recipient-count').textContent =
        `Este email se enviará a ${activeCount} suscriptor${activeCount !== 1 ? 'es' : ''} activo${activeCount !== 1 ? 's' : ''}.`;

    modal.classList.add('active');
}

async function handleSendEmail(e) {
    e.preventDefault();

    const subject = document.getElementById('email-subject').value;
    const editor = document.getElementById('email-content');
    const content = editor.innerHTML.trim();
    const headerText = document.getElementById('email-header-text').value.trim();
    const activeCount = currentSubscribers.filter(s => s.is_active).length;

    if (!content || content === '<br>') {
        showToast('El contenido del email no puede estar vacío', 'error');
        return;
    }

    if (activeCount === 0) {
        showToast('No hay suscriptores activos', 'error');
        return;
    }

    // Use custom confirm modal instead of native confirm()
    showConfirmModal(
        'Confirmar Envío',
        `¿Enviar este email a ${activeCount} suscriptor${activeCount !== 1 ? 'es' : ''} activo${activeCount !== 1 ? 's' : ''}?`,
        'Enviar',
        async () => {
            const submitBtn = document.querySelector('#email-form button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Enviando...';
            submitBtn.disabled = true;

            try {
                const response = await fetch(`${API_BASE}/subscribers/send-email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ subject, content, headerText })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to send emails');
                }

                showToast(`${data.sent} emails enviados exitosamente`, 'success');
                closeAllModals();

            } catch (error) {
                console.error('Send email error:', error);
                showToast(error.message || 'Error al enviar emails', 'error');
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        }
    );
}

// ============================================
// CUSTOM CONFIRM MODAL (replaces native confirm())
// ============================================

function showConfirmModal(title, message, actionText, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const actionBtn = document.getElementById('confirm-delete-btn');
    actionBtn.textContent = actionText;
    actionBtn.style.display = ''; // Ensure visible (may be hidden by order details view)
    // Style: use primary for non-destructive, danger for destructive
    if (actionText === 'Eliminar') {
        actionBtn.className = 'btn-danger';
    } else {
        actionBtn.className = 'btn-primary';
    }
    deleteCallback = callback;
    document.getElementById('confirm-modal').classList.add('active');
}

// ============================================
// INPUT PROMPT MODAL (replaces native prompt())
// ============================================

function showInputPrompt(title, label, placeholder, callback) {
    document.getElementById('input-prompt-title').textContent = title;
    document.getElementById('input-prompt-label').textContent = label;
    const input = document.getElementById('input-prompt-value');
    input.value = placeholder || '';
    input.placeholder = placeholder || '';
    inputPromptCallback = callback;
    document.getElementById('input-prompt-modal').classList.add('active');
    setTimeout(() => { input.focus(); input.select(); }, 100);
}

// ============================================
// TOOLBAR STATE TRACKING
// ============================================

function updateToolbarState() {
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        const cmd = btn.dataset.cmd;
        const val = btn.dataset.value || null;
        let isActive = false;

        if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline') {
            isActive = document.queryCommandState(cmd);
        } else if (cmd === 'insertUnorderedList') {
            isActive = document.queryCommandState('insertUnorderedList');
        } else if (cmd === 'justifyLeft') {
            isActive = document.queryCommandState('justifyLeft');
        } else if (cmd === 'justifyCenter') {
            isActive = document.queryCommandState('justifyCenter');
        } else if (cmd === 'formatBlock' && val) {
            const block = document.queryCommandValue('formatBlock');
            isActive = block.toLowerCase() === val.toLowerCase();
        }

        btn.classList.toggle('active', isActive);
    });
}

// Make functions globally available
window.editProduct = editProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.addAdditionalImage = addAdditionalImage;
window.addVariant = addVariant;
window.confirmDeleteGallery = confirmDeleteGallery;
window.updateContent = updateContent;
window.viewOrderDetails = viewOrderDetails;
window.toggleDiscountCode = toggleDiscountCode;
window.editPage = editPage;
window.confirmDeletePage = confirmDeletePage;
window.confirmDeleteSubscriber = confirmDeleteSubscriber;
