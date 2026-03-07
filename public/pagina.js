// Dynamic Page Loader for Legado San José
// Loads page content from /api/pages/:slug based on URL parameter

(function () {
    'use strict';

    async function loadPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const slug = urlParams.get('slug');

        const loadingEl = document.getElementById('page-loading');
        const contentEl = document.getElementById('page-content');
        const notFoundEl = document.getElementById('page-not-found');
        const heroEl = document.getElementById('page-hero');

        if (!slug) {
            loadingEl.style.display = 'none';
            notFoundEl.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`/api/pages/${slug}`);

            if (!response.ok) {
                loadingEl.style.display = 'none';
                notFoundEl.style.display = 'block';
                return;
            }

            const page = await response.json();

            // Update page title
            document.title = `${page.title} - Legado San José`;

            // Show hero banner with title
            document.getElementById('page-title').textContent = page.title;
            heroEl.style.display = 'block';

            // Render content (support basic HTML) — h1 inside content is hidden via CSS
            document.getElementById('page-body').innerHTML = page.content || '<p>Sin contenido disponible.</p>';

            // Show content, hide loading
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';

        } catch (error) {
            console.error('Error loading page:', error);
            loadingEl.style.display = 'none';
            notFoundEl.style.display = 'block';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadPage);
    } else {
        loadPage();
    }
})();
