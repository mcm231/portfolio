// The about page. The markup carries every word, so the only wiring the page
// needs is the side drawer.
import { mountMenu } from './components/menu.js';

// The side drawer. One file holds the links, and marks this page.
mountMenu(document.getElementById('menu'));
