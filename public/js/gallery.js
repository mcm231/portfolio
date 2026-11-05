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
                // A row with no filename is a piece with no picture. It shows
                // a color panel, the same component the home page wall uses.
                entry.filename
                    ? h('img', {
                        key: 'thumb',
                        src: `/api/images?id=${encodeURIComponent(entry.filename)}`,
                        alt: entry.name,
                        loading: 'lazy'
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

    function renderModal() {
        if (!selectedImage) return null;

        return h('div', {
            key: 'modal',
            className: 'modal-overlay',
            onClick: () => setSelectedImage(null)
        }, h('div', {
            className: 'modal-content',
            onClick: (e) => e.stopPropagation()
        }, [
            selectedImage.filename
                ? h('img', {
                    key: 'full',
                    src: `/api/images?id=${encodeURIComponent(selectedImage.filename)}`,
                    alt: selectedImage.name
                })
                : h('div', {
                    key: 'panel',
                    className: 'modal-panel',
                    style: { '--panel': `var(--blank-${panelColor(selectedImage)})` },
                    'aria-hidden': 'true'
                }),
            h('div', { key: 'meta', className: 'modal-meta' }, [
                h('h2', { key: 'name' }, selectedImage.name),
                selectedImage.description
                    ? h('p', { key: 'desc' }, selectedImage.description)
                    : null,
                (selectedImage.mediums || []).length > 0
                    ? h('p', { key: 'mediums', className: 'modal-tags' },
                        selectedImage.mediums.join(', '))
                    : null,
                (selectedImage.tags || []).length > 0
                    ? h('p', { key: 'tags', className: 'modal-tags' }, selectedImage.tags.join(', '))
                    : null
            ]),
            h('button', {
                key: 'close',
                className: 'button button-quiet modal-close',
                onClick: () => setSelectedImage(null)
            }, 'Close')
        ]));
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
