// The gallery search page. It mounts the browsing grid, and a click opens the
// detail view inside it.
import { mountGallery } from './components/gallery-page.js';
import { createLoadingScreen } from './components/loading-screen.js';
import { mountMenu } from './components/menu.js';

// The cover hides the grid until its first screen of pictures arrives.
const loader = createLoadingScreen();

mountGallery(document.getElementById('app'), { title: 'Gallery Search', loader });

// The side drawer. One file holds the links, and marks this page.
mountMenu(document.getElementById('menu'));
