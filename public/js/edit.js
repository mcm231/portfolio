// The edit page. It mounts the same browsing grid as the gallery search page,
// and a click opens the upload form for that row.
import { mountGallery } from './gallery-page.js';

mountGallery(document.getElementById('app'), {
    title: 'Edit an image',
    action: { label: 'Upload new', href: '/pages/upload' },
    onSelect: entry => {
        window.location.href = `/pages/upload?id=${encodeURIComponent(entry.id)}`;
    },
});
