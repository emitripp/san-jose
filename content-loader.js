// Dynamic Content Loader - Loads site content from API
// This script fetches content from Supabase and updates the page dynamically

(function () {
    'use strict';

    // Content mapping: section.key -> element selector
    const contentMapping = {
        // Hero section
        'hero.subtitle': '.hero-subtitle',
        'hero.title': '.hero-title',
        'hero.description': '.hero-description',

        // About section
        'about.title': '.about-content .section-title',
        'about.paragraph1': '.about-content p:first-of-type',
        'about.paragraph2': '.about-content p:nth-of-type(2)',

        // Footer
        'footer.tagline': '.footer-column:first-child p'
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
                            console.log(`Updated ${selectorKey}`);
                        }
                    }
                });
            });

            console.log('Dynamic content loaded successfully');

        } catch (error) {
            console.log('Using default content (API not available)');
        }
    }

    // Load content when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadContent);
    } else {
        loadContent();
    }
})();
