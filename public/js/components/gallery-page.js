// The browsing grid: every row in the database, with composable filters
// (Medium / Tag / Title / Date Created).
//
// Two pages mount it. The gallery search page opens the detail view of
// components/detail-modal.js on a click, the same view the photo wall of the
// home page opens. The edit page opens the upload form instead. Only the
// props differ.
//
// React is the one library this site uses, and ARCHITECTURE_GUIDE.md names
// the exception. The page loads it, so React and ReactDOM are globals here.
// Everything else arrives as an import.
import { buildCodeBlock } from './code-tile.js';
import { openDetail } from './detail-modal.js';
import { readImages, previewKey, panelColor } from '../shared/row.js';
import { api } from '../api.js';

// The first entry is the default filter type. A `vocabulary` key names the
// list of used terms that suggests values for that type.
const FILTER_TYPES = [
    { value: 'medium', label: 'Medium', vocabulary: 'mediums' },
    { value: 'tag', label: 'Tag', vocabulary: 'tags' },
    { value: 'title', label: 'Title' },
    { value: 'dateCreated', label: 'Date Created' },
];

const DEFAULT_FILTER_TYPE = FILTER_TYPES[0].value;

const h = React.createElement;

function cardKind(entry) {
    if (readImages(entry).length > 0) return 'image';
    return entry.kind === 'code' ? 'code' : 'panel';
}

// Cards of the first screen load at once, so the loading cover has something
// to wait for. The widest grid is six columns, and a tall window shows three
// rows of them. Every card past these stays lazy.
const EAGER_CARDS = 18;

// Props:
//   title     heading text, default "Gallery Search"
//   onSelect  what a click on a tile does, default: open the modal
//   action    an optional top right link, { label, href }
//   loader    an optional loading cover from components/loading-screen.js.
//             The page hands it every card picture, and seals it after the
//             first grid.
export function GalleryPage({ title = 'Gallery Search', onSelect, action, loader } = {}) {
    const { useState, useEffect, useMemo, useCallback } = React;

    const [entries, setEntries] = useState([]);
    const [vocabulary, setVocabulary] = useState({ tags: [], mediums: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterType, setFilterType] = useState(DEFAULT_FILTER_TYPE);
    const [inputValue, setInputValue] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);
    // A card shows nothing until its own picture arrives, so a tile never
    // snaps from the surface color to the photo. css/gallery.css holds the
    // fade. A broken picture also counts as ready, or its alt text would
    // never show.
    //
    // The same ref hands the picture to the cover, which counts a card of the
    // first screen and ignores the rest.
    const trackImage = useCallback(
        node => {
            if (!node) return;

            if (node.complete) node.classList.add('is-ready');
            else {
                const show = () => node.classList.add('is-ready');
                node.addEventListener('load', show, { once: true });
                node.addEventListener('error', show, { once: true });
            }

            if (loader) loader.track(node);
        },
        [loader]
    );

    // The cover goes once the grid renders and its first screen answers. This
    // effect runs after the commit, so every card already registered. A failed
    // fetch also ends the wait, because it clears `loading` too.
    useEffect(() => {
        if (!loader || loading) return;
        loader.seal();
    }, [loader, loading]);

    useEffect(() => {
        Promise.all([api.rows(), api.vocabulary()])
            .then(([imageEntries, words]) => {
                setEntries(Array.isArray(imageEntries) ? imageEntries : []);
                setVocabulary({
                    tags: Array.isArray(words.tags) ? words.tags : [],
                    mediums: Array.isArray(words.mediums) ? words.mediums : [],
                });
            })
            .catch(() => setError('Failed to load gallery images.'))
            .finally(() => setLoading(false));
    }, []);

    const addFilter = () => {
        const value = inputValue.trim();
        if (!value) return;

        const label = FILTER_TYPES.find(f => f.value === filterType).label;
        const alreadyActive = activeFilters.some(f => f.type === filterType && f.value === value);
        if (alreadyActive) return;

        setActiveFilters(prev => [...prev, { type: filterType, value, label }]);
        setInputValue('');
    };

    const removeFilter = index => {
        setActiveFilters(prev => prev.filter((_, i) => i !== index));
    };

    const handleInputKeyDown = event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addFilter();
    };

    // Newest first. A piece with no date goes last, and the id breaks a tie,
    // so the order never shuffles between loads.
    function byNewest(a, b) {
        const dateA = a.dateCreated || '';
        const dateB = b.dateCreated || '';

        if (dateA !== dateB) {
            if (!dateA) return 1;
            if (!dateB) return -1;
            return dateB.localeCompare(dateA);
        }

        return String(a.id).localeCompare(String(b.id));
    }

    const filteredEntries = useMemo(
        () =>
            entries
                .filter(entry =>
                    activeFilters.every(filter => {
                        if (filter.type === 'title') {
                            return (
                                typeof entry.name === 'string' &&
                                entry.name.toLowerCase().includes(filter.value.toLowerCase())
                            );
                        }
                        if (filter.type === 'tag') {
                            return Array.isArray(entry.tags) && entry.tags.includes(filter.value);
                        }
                        if (filter.type === 'medium') {
                            return (
                                Array.isArray(entry.mediums) && entry.mediums.includes(filter.value)
                            );
                        }
                        if (filter.type === 'dateCreated') {
                            return entry.dateCreated === filter.value;
                        }
                        return true;
                    })
                )
                .sort(byNewest),
        [entries, activeFilters]
    );

    function renderValueField() {
        const type = FILTER_TYPES.find(f => f.value === filterType);
        const words = type.vocabulary ? vocabulary[type.vocabulary] : null;

        // A typed value with a suggestion list. Typing narrows the list, and
        // a term that is not on it still filters.
        const input = h('input', {
            key: 'value',
            className: 'field field-grow',
            type: filterType === 'dateCreated' ? 'date' : 'text',
            list: words ? `${filterType}-options` : undefined,
            autoComplete: 'off',
            value: inputValue,
            placeholder: words
                ? `Type or pick a ${type.label.toLowerCase()}…`
                : filterType === 'title'
                  ? 'Search by title…'
                  : '',
            onChange: e => setInputValue(e.target.value),
            onKeyDown: handleInputKeyDown,
        });

        if (!words) return input;

        return h(React.Fragment, { key: 'value-field' }, [
            input,
            h(
                'datalist',
                { key: 'options', id: `${filterType}-options` },
                words.map(({ value, count }) =>
                    h('option', {
                        key: value,
                        value,
                        label: count > 1 ? `${value} (${count})` : value,
                    })
                )
            ),
        ]);
    }

    function renderResults() {
        if (loading) {
            return h(
                'div',
                { key: 'loading', className: 'loading' },
                h('div', { className: 'loading-spinner' })
            );
        }

        if (error) return h('p', { key: 'error', className: 'message' }, error);

        if (filteredEntries.length === 0) {
            return h('p', { key: 'empty', className: 'message' }, 'No images match your filters.');
        }

        return h(
            'div',
            { key: 'grid', className: 'grid' },
            filteredEntries.map((entry, index) => {
                const caption = [entry.name, entry.dateCreated].filter(Boolean);

                return h(
                    'div',
                    {
                        key: entry.id,
                        className: 'grid-item',
                        role: 'button',
                        tabIndex: 0,
                        'aria-label': entry.name || 'Untitled piece',
                        onClick: () => (onSelect ? onSelect(entry) : openDetail(entry)),
                        onKeyDown: e => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            return onSelect ? onSelect(entry) : openDetail(entry);
                        },
                    },
                    [
                        // A picture, a block of code, or a color panel.
                        cardKind(entry) === 'image'
                            ? h('img', {
                                  key: 'thumb',
                                  // A card is a thumbnail, so it loads the small copy.
                                  src: api.imageUrl(previewKey(readImages(entry)[0])),
                                  alt: entry.name || '',
                                  loading: index < EAGER_CARDS ? 'eager' : 'lazy',
                                  decoding: 'async',
                                  ref: trackImage,
                              })
                            : cardKind(entry) === 'code'
                              ? h('div', {
                                    key: 'code',
                                    className: 'grid-item-code',
                                    ref: node => {
                                        if (!node || node.firstChild) return;
                                        node.appendChild(buildCodeBlock(entry));
                                    },
                                })
                              : h('div', {
                                    key: 'panel',
                                    className: 'grid-item-panel',
                                    style: { '--panel': `var(--blank-${panelColor(entry)})` },
                                    'aria-hidden': 'true',
                                }),
                        // The title and the date sit over the image, on hover and
                        // on focus. A piece with neither shows the image alone.
                        caption.length > 0
                            ? h('div', { key: 'caption', className: 'grid-item-caption' }, [
                                  entry.name
                                      ? h(
                                            'span',
                                            { key: 'name', className: 'grid-item-name' },
                                            entry.name
                                        )
                                      : null,
                                  entry.dateCreated
                                      ? h(
                                            'span',
                                            { key: 'date', className: 'grid-item-date' },
                                            entry.dateCreated
                                        )
                                      : null,
                              ])
                            : null,
                    ]
                );
            })
        );
    }

    return h('div', { className: 'page' }, [
        action
            ? h(
                  'a',
                  {
                      key: 'action',
                      className: 'button button-quiet forward-link',
                      href: action.href,
                  },
                  action.label
              )
            : null,

        h('div', { key: 'header', className: 'page-header' }, [
            h('h1', { key: 'title', className: 'page-title' }, title),
            h(
                'p',
                { key: 'count', className: 'page-count' },
                `${filteredEntries.length} of ${entries.length} pieces`
            ),
        ]),

        h('div', { key: 'search', className: 'search-bar' }, [
            h(
                'select',
                {
                    key: 'type',
                    className: 'field',
                    value: filterType,
                    onChange: e => {
                        setFilterType(e.target.value);
                        setInputValue('');
                    },
                },
                FILTER_TYPES.map(f => h('option', { key: f.value, value: f.value }, f.label))
            ),

            renderValueField(),

            h('button', { key: 'add', className: 'button button-mark', onClick: addFilter }, 'Add'),
        ]),

        activeFilters.length > 0
            ? h(
                  'div',
                  { key: 'chips', className: 'chips' },
                  activeFilters.map((filter, index) =>
                      h('div', { key: `chip-${index}`, className: 'chip' }, [
                          h('span', { key: 'text' }, `${filter.label}: ${filter.value}`),
                          h(
                              'button',
                              {
                                  key: 'remove',
                                  className: 'chip-remove',
                                  onClick: () => removeFilter(index),
                                  'aria-label': `Remove the ${filter.label} filter`,
                              },
                              '×'
                          ),
                      ])
                  )
              )
            : null,

        renderResults(),
    ]);
}

// Mounts the grid on one page. The page passes what makes it different.
export function mountGallery(container, props = {}) {
    ReactDOM.createRoot(container).render(h(GalleryPage, props));
}
