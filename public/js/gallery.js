// The gallery search page. It mounts the browsing grid, and a click opens the
// detail view inside it.
import { mountGallery } from './gallery-page.js';
import { createLoadingScreen } from './loading-screen.js';

// The cover hides the grid until its first screen of pictures arrives.
const loader = createLoadingScreen();

mountGallery(document.getElementById('app'), { title: 'Gallery Search', loader });
