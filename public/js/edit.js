// The edit page. It mounts the same browsing grid as the gallery search page,
// and a click opens the upload form for that row.
import { mountGallery } from './gallery-page.js';
import { createLoadingScreen } from './loading-screen.js';

// The cover hides the grid until its first screen of pictures arrives.
const loader = createLoadingScreen();

mountGallery(document.getElementById('app'), {
    title: 'Edit an image',
    loader,
    action: { label: 'Upload new', href: '/pages/upload' },
    onSelect: entry => {
        window.location.href = `/pages/upload?id=${encodeURIComponent(entry.id)}`;
    },
});
