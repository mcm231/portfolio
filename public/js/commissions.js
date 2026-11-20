// The commissions page. It carries the words, the price menu, and a grid of
// the work already taken on.
//
// The grid is the same one the gallery search page mounts. Here it takes no
// filter, because the page already decides what it shows.
import { mountGallery } from './components/gallery-page.js';
import { mountMenu } from './components/menu.js';

// The side drawer. One file holds the links, and marks this page.
mountMenu(document.getElementById('menu'));

// A commission is a field on the row, not a tag. DATA_MODEL.md says why.
const isCommission = entry => entry.commission === true;

mountGallery(document.getElementById('commission-gallery'), {
    // The section above the grid carries the heading, so the grid draws none.
    title: null,
    search: false,
    only: isCommission,
});
