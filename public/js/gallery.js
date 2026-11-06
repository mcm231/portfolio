// Gallery search page: every image in the database, with composable filters
// (Title / Tag / Date Created). Styling lives in css/styles.css per
// STYLE_GUIDE.md. This file sets class names only.

// The first entry is the default filter type. A `vocabulary` key names the
// list of used terms that suggests values for that type.
const FILTER_TYPES = [
    { value: 'medium', label: 'Medium', vocabulary: 'mediums' },
    { value: 'tag', label: 'Tag', vocabulary: 'tags' },
    { value: 'title', label: 'Title' },
    { value: 'dateCreated', label: 'Date Created' }
];

const DEFAULT_FILTER_TYPE = FILTER_TYPES[0].value;

const h = React.createElement;

// A code row with no picture shows code on its card, the same block the home
// page wall uses. The module is loaded by the page, so this reads a global.
const buildCodeBlock = (entry) => window.buildCodeBlock(entry);

// The same two readers the Worker uses, set on the window by the page.
const readImages = (entry) => window.readImages(entry);
const previewKey = (image) => window.previewKey(image);
const readParagraphs = (text) => window.readParagraphs(text);

function cardKind(entry) {
    if (readImages(entry).length > 0) return 'image';
    return entry.kind === 'code' ? 'code' : 'panel';
}

function imageUrl(key) {
    return `/api/images?id=${encodeURIComponent(key)}`;
}

const PANEL_COLORS = 8;

// A steady color for a row with no picture, from the id. The same row keeps
// the same color on every visit.
function panelColor(entry) {
    const named = Number(entry.panelColor);
    if (Number.isInteger(named) && named >= 1 && named <= PANEL_COLORS) return named;

    let hash = 0;
    for (const char of String(entry.id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return (hash % PANEL_COLORS) + 1;
}

// Props:
//   title     heading text, default "Gallery Search"
//   onSelect  what a click on a tile does, default: open the modal
//   action    an optional top right link, { label, href }
function GalleryPage({ title = 'Gallery Search', onSelect, action } = {}) {
    const { useState, useEffect, useMemo } = React;

    const [entries, setEntries] = useState([]);
    const [vocabulary, setVocabulary] = useState({ tags: [], mediums: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterType, setFilterType] = useState(DEFAULT_FILTER_TYPE);
    const [inputValue, setInputValue] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [slide, setSlide] = useState(0);        // which picture is showing
    const [panelOpen, setPanelOpen] = useState(false);

    // Every detail view opens on the first picture, with the panel closed.
    useEffect(() => {
        setSlide(0);
        setPanelOpen(false);
    }, [selectedImage]);

    useEffect(() => {
        Promise.all([
            fetch('/api/image-metadata').then(res => res.json()),
            fetch('/api/vocabulary').then(res => res.json())
        ])
            .then(([imageEntries, words]) => {
                setEntries(Array.isArray(imageEntries) ? imageEntries : []);
                setVocabulary({
                    tags: Array.isArray(words.tags) ? words.tags : [],
                    mediums: Array.isArray(words.mediums) ? words.mediums : []
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

    const removeFilter = (index) => {
        setActiveFilters(prev => prev.filter((_, i) => i !== index));
    };

    const handleInputKeyDown = (event) => {
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

    const filteredEntries = useMemo(() => entries.filter(entry =>
        activeFilters.every(filter => {
            if (filter.type === 'title') {
                return typeof entry.name === 'string'
                    && entry.name.toLowerCase().includes(filter.value.toLowerCase());
            }
            if (filter.type === 'tag') {
                return Array.isArray(entry.tags) && entry.tags.includes(filter.value);
            }
            if (filter.type === 'medium') {
                return Array.isArray(entry.mediums) && entry.mediums.includes(filter.value);
            }
            if (filter.type === 'dateCreated') {
                return entry.dateCreated === filter.value;
            }
            return true;
        })
    ).sort(byNewest), [entries, activeFilters]);

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
                : filterType === 'title' ? 'Search by title…' : '',
            onChange: (e) => setInputValue(e.target.value),
            onKeyDown: handleInputKeyDown
        });

        if (!words) return input;

        return h(React.Fragment, { key: 'value-field' }, [
            input,
            h('datalist', { key: 'options', id: `${filterType}-options` },
                words.map(({ value, count }) =>
                    h('option', { key: value, value, label: count > 1 ? `${value} (${count})` : value })))
        ]);
    }

    function renderResults() {
        if (loading) {
            return h('div', { key: 'loading', className: 'loading' },
                h('div', { className: 'loading-spinner' }));
        }

        if (error) return h('p', { key: 'error', className: 'message' }, error);

        if (filteredEntries.length === 0) {
            return h('p', { key: 'empty', className: 'message' }, 'No images match your filters.');
        }

        return h('div', { key: 'grid', className: 'grid' }, filteredEntries.map(entry => {
            const caption = [entry.name, entry.dateCreated].filter(Boolean);

            return h('div', {
                key: entry.id,
                className: 'grid-item',
                role: 'button',
                tabIndex: 0,
                'aria-label': entry.name || 'Untitled piece',
                onClick: () => (onSelect ? onSelect(entry) : setSelectedImage(entry)),
                onKeyDown: (e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    return onSelect ? onSelect(entry) : setSelectedImage(entry);
                }
            }, [
                // A picture, a block of code, or a color panel.
                cardKind(entry) === 'image'
                    ? h('img', {
                        key: 'thumb',
                        // A card is a thumbnail, so it loads the small copy.
                        src: imageUrl(previewKey(readImages(entry)[0])),
                        alt: entry.name || '',
                        loading: 'lazy'
                    })
                    : cardKind(entry) === 'code'
                        ? h('div', {
                            key: 'code',
                            className: 'grid-item-code',
                            ref: node => {
                                if (!node || node.firstChild) return;
                                node.appendChild(buildCodeBlock(entry));
                            }
                        })
                        : h('div', {
                            key: 'panel',
                            className: 'grid-item-panel',
                            style: { '--panel': `var(--blank-${panelColor(entry)})` },
                            'aria-hidden': 'true'
                        }),
                // The title and the date sit over the image, on hover and
                // on focus. A piece with neither shows the image alone.
                caption.length > 0
                    ? h('div', { key: 'caption', className: 'grid-item-caption' }, [
                        entry.name
                            ? h('span', { key: 'name', className: 'grid-item-name' }, entry.name)
                            : null,
                        entry.dateCreated
                            ? h('span', { key: 'date', className: 'grid-item-date' }, entry.dateCreated)
                            : null
                    ])
                    : null
            ]);
        }));
    }

    // The rotating gallery at the top of a detail view.
    function renderSlides(images, name) {
        if (images.length === 0) return null;

        const step = (by) => setSlide((slide + by + images.length) % images.length);

        return h('div', { key: 'slides', className: 'slides' }, [
            h('img', {
                key: 'shown',
                className: 'slides-image',
                src: imageUrl(images[slide % images.length].key),
                alt: name || ''
            }),

            images.length > 1
                ? h('button', {
                    key: 'prev', type: 'button', className: 'slides-step is-prev',
                    'aria-label': 'The picture before',
                    onClick: (e) => { e.stopPropagation(); step(-1); }
                }, '‹')
                : null,

            images.length > 1
                ? h('button', {
                    key: 'next', type: 'button', className: 'slides-step is-next',
                    'aria-label': 'The next picture',
                    onClick: (e) => { e.stopPropagation(); step(1); }
                }, '›')
                : null,

            images.length > 1
                ? h('div', { key: 'dots', className: 'slides-dots' },
                    images.map((image, index) => h('button', {
                        key: image.key, type: 'button',
                        className: `slides-dot${index === slide % images.length ? ' is-on' : ''}`,
                        'aria-label': `Picture ${index + 1}`,
                        onClick: (e) => { e.stopPropagation(); setSlide(index); }
                    })))
                : null
        ]);
    }

    function renderParagraphs(text) {
        const paragraphs = readParagraphs(text);
        if (paragraphs.length === 0) return null;

        return h('div', { key: 'text', className: 'detail-text' },
            paragraphs.map((block, index) => h('p', { key: index }, block)));
    }

    function renderName(entry) {
        return entry.name
            ? h('h2', { key: 'name', className: 'detail-name' }, entry.name)
            : null;
    }

    // True when the panel would hold nothing. The handle then stays away.
    function hasWords(entry) {
        return Boolean(entry.name)
            || Boolean(entry.dateCreated)
            || (entry.mediums || []).length > 0
            || (entry.tags || []).length > 0
            || readParagraphs(entry.description).length > 0;
    }

    // The date reads as plain text. A medium and a tag each get a pill, one
    // color for each, so the three never blur together.
    function renderMeta(entry) {
        const mediums = entry.mediums || [];
        const tags = entry.tags || [];

        return [
            entry.dateCreated
                ? h('p', { key: 'date', className: 'detail-date' }, entry.dateCreated)
                : null,

            mediums.length > 0 || tags.length > 0
                ? h('ul', { key: 'terms', className: 'detail-terms' }, [
                    ...mediums.map(term =>
                        h('li', { key: `m-${term}`, className: 'pill pill-medium' }, term)),
                    ...tags.map(term =>
                        h('li', { key: `t-${term}`, className: 'pill pill-tag' }, term))
                ])
                : null
        ];
    }

    function renderActions(entry) {
        return h('div', { key: 'actions', className: 'modal-actions' }, [
            entry.repoUrl
                ? h('a', {
                    key: 'repo', className: 'button', href: entry.repoUrl,
                    target: '_blank', rel: 'noopener noreferrer'
                }, 'Repo')
                : null,
            entry.liveUrl
                ? h('a', {
                    key: 'live', className: 'button', href: entry.liveUrl,
                    target: '_blank', rel: 'noopener noreferrer'
                }, 'Live')
                : null,
            entry.download && entry.download.key
                ? h('a', {
                    key: 'download', className: 'button button-quiet',
                    href: `/api/files?key=${encodeURIComponent(entry.download.key)}`
                }, `Download ${entry.download.name}`)
                : null,
            h('button', {
                key: 'close', type: 'button', className: 'button button-quiet',
                onClick: () => setSelectedImage(null)
            }, 'Close')
        ]);
    }

    // A code project reads as a document: the pictures, then the words.
    function renderCodeDetail(entry, images) {
        return h('div', {
            className: 'modal-content detail-document',
            onClick: (e) => e.stopPropagation()
        }, [
            renderSlides(images, entry.name),
            renderName(entry),
            renderMeta(entry),
            renderParagraphs(entry.description),
            images.length === 0
                ? h('div', {
                    key: 'code', className: 'detail-code',
                    ref: node => {
                        if (!node || node.firstChild) return;
                        node.appendChild(buildCodeBlock(entry));
                    }
                })
                : null,
            renderActions(entry)
        ]);
    }

    // Everything else: the picture fills the view, and a button slides the
    // words out beside it.
    function renderPieceDetail(entry, images) {
        const words = hasWords(entry);

        return h('div', {
            className: `modal-content detail-stage${panelOpen && words ? ' is-open' : ''}`,
            onClick: (e) => e.stopPropagation()
        }, [
            h('div', { key: 'stage', className: 'detail-stage-image' }, [
                images.length > 0
                    ? renderSlides(images, entry.name)
                    : h('div', {
                        key: 'panel',
                        className: 'modal-panel',
                        style: { '--panel': `var(--blank-${panelColor(entry)})` },
                        'aria-hidden': 'true'
                    }),
                renderActions(entry)
            ]),

            // A piece with nothing written about it needs no handle.
            words
                ? h('button', {
                    key: 'handle', type: 'button', className: 'detail-handle',
                    'aria-expanded': String(panelOpen),
                    'aria-controls': 'detail-panel',
                    'aria-label': panelOpen ? 'Hide the description' : 'Show the description',
                    onClick: () => setPanelOpen(!panelOpen)
                }, panelOpen ? '›' : '‹')
                : null,

            words
                ? h('aside', { key: 'panel', id: 'detail-panel', className: 'detail-panel' }, [
                    renderName(entry),
                    renderMeta(entry),
                    renderParagraphs(entry.description)
                ])
                : null
        ]);
    }

    function renderModal() {
        if (!selectedImage) return null;

        const images = readImages(selectedImage);

        return h('div', {
            key: 'modal',
            className: 'modal-overlay',
            onClick: () => setSelectedImage(null)
        }, selectedImage.kind === 'code'
            ? renderCodeDetail(selectedImage, images)
            : renderPieceDetail(selectedImage, images));
    }

    return h('div', { className: 'page' }, [
        h('a', { key: 'back', className: 'button button-quiet back-link', href: '/' }, '← Home'),

        action
            ? h('a', {
                key: 'action',
                className: 'button button-quiet forward-link',
                href: action.href
            }, action.label)
            : null,

        h('div', { key: 'header', className: 'page-header' }, [
            h('h1', { key: 'title', className: 'page-title' }, title),
            h('p', { key: 'count', className: 'page-count' },
                `${filteredEntries.length} of ${entries.length} pieces`)
        ]),

        h('div', { key: 'search', className: 'search-bar' }, [
            h('select', {
                key: 'type',
                className: 'field',
                value: filterType,
                onChange: (e) => {
                    setFilterType(e.target.value);
                    setInputValue('');
                }
            }, FILTER_TYPES.map(f => h('option', { key: f.value, value: f.value }, f.label))),

            renderValueField(),

            h('button', { key: 'add', className: 'button button-mark', onClick: addFilter }, 'Add')
        ]),

        activeFilters.length > 0
            ? h('div', { key: 'chips', className: 'chips' }, activeFilters.map((filter, index) =>
                h('div', { key: `chip-${index}`, className: 'chip' }, [
                    h('span', { key: 'text' }, `${filter.label}: ${filter.value}`),
                    h('button', {
                        key: 'remove',
                        className: 'chip-remove',
                        onClick: () => removeFilter(index),
                        'aria-label': `Remove the ${filter.label} filter`
                    }, '×')
                ])
            ))
            : null,

        renderResults(),
        renderModal()
    ]);
}

if (typeof window !== 'undefined') {
    window.GalleryPage = GalleryPage;
}
