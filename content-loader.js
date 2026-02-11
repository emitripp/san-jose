// Dynamic Content Loader - Loads site content from API
// This script fetches content from Supabase and updates the page dynamically

(function () {
    'use strict';

    // Content mapping: section.key -> element selector (textContent replacement)
    const contentMapping = {
        // Hero section
        'hero.subtitle': '.hero-subtitle',
        'hero.title': '.hero-title',
        'hero.description': '.hero-description',
        'hero.button': '.cta-button',

        // About section
        'about.title': '.about-content .section-title',
        'about.paragraph1': '.about-content p:first-of-type',
        'about.paragraph2': '.about-content p:nth-of-type(2)',

        // Footer
        'footer.tagline': '#footer-tagline',

        // Shop (productos.html)
        'shop.title': '.shop-title',
        'shop.subtitle': '.shop-subtitle',

        // Newsletter
        'newsletter.title': '.newsletter-content h2',
        'newsletter.subtitle': '.newsletter-content p'
    };

    async function loadContent() {
        try {
            const response = await fetch('/api/content');
            if (!response.ok) {
                console.log('Content API not available, using default content');
                return;
            }

            const content = await response.json();

            // Apply content to page (format: { section: { key: value } })
            Object.entries(content).forEach(([section, keys]) => {
                Object.entries(keys).forEach(([key, value]) => {
                    const selectorKey = `${section}.${key}`;
                    const selector = contentMapping[selectorKey];

                    if (selector && value) {
                        const element = document.querySelector(selector);
                        if (element) {
                            element.textContent = value;
                        }
                    }
                });
            });

            // Special handling: hero button link
            if (content.hero && content.hero.button_link) {
                const ctaButton = document.querySelector('.cta-button');
                if (ctaButton) {
                    ctaButton.href = content.hero.button_link;
                }
            }

            // Special handling: about features (pipe-separated list)
            if (content.about && content.about.features) {
                const featuresList = document.querySelector('.about-features');
                if (featuresList) {
                    const items = content.about.features.split('|').map(f => f.trim()).filter(f => f);
                    featuresList.innerHTML = items.map(item => `<li>✓ ${item}</li>`).join('');
                }
            }

            console.log('Dynamic content loaded successfully');

        } catch (error) {
            console.log('Using default content (API not available)');
        }
    }

    // Load dynamic footer pages
    async function loadFooterPages() {
        try {
            const footerList = document.getElementById('footer-pages-links');
            if (!footerList) return;

            const response = await fetch('/api/pages');
            if (!response.ok) return;

            const pages = await response.json();
            if (!pages || pages.length === 0) return;

            footerList.innerHTML = pages.map(page =>
                `<li><a href="pagina.html?slug=${page.slug}">${page.title}</a></li>`
            ).join('');

        } catch (error) {
            console.log('Footer pages not available');
        }
    }

    // Load gallery images dynamically
    async function loadGallery() {
        try {
            const collage = document.getElementById('gallery-collage');
            if (!collage) return;

            const response = await fetch('/api/gallery');
            if (!response.ok) return;

            const images = await response.json();
            if (!images || images.length === 0) return;

            collage.innerHTML = images.map((img, index) => {
                // First image is large (spans full width), rest are small
                const sizeClass = index === 0 ? 'gallery-large' : 'gallery-small';
                return `
                    <div class="gallery-item ${sizeClass} reveal active">
                        <img src="${img.image_url}" alt="${img.alt_text || ''}" class="gallery-image-real"
                            loading="${index < 4 ? 'eager' : 'lazy'}">
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.log('Gallery not available');
        }
    }

    // Load content when DOM is ready
    function init() {
        loadContent();
        loadFooterPages();
        loadGallery();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
