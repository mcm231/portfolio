// The gallery search page. It mounts the browsing grid, and a click opens the
// detail view inside it.
import { mountGallery } from './gallery-page.js';

mountGallery(document.getElementById('app'), { title: 'Gallery Search' });
