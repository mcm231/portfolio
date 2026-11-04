// Gallery search page: every image in the database, with composable filters
// (Title / Tag / Date Created). Styling lives in css/styles.css per
// STYLE_GUIDE.md. This file sets class names only.

// The first entry is the default filter type.
const FILTER_TYPES = [
    { value: 'tag', label: 'Tag' },
    { value: 'title', label: 'Title' },
    { value: 'dateCreated', label: 'Date Created' }
];

const DEFAULT_FILTER_TYPE = FILTER_TYPES[0].value;

const h = React.createElement;

// Props:
//   title     heading text, default "Gallery Search"
//   onSelect  what a click on a tile does, default: open the modal
//   action    an optional top right link, { label, href }
function GalleryPage({ title = 'Gallery Search', onSelect, action } = {}) {
    const { useState, useEffect, useMemo } = React;

    const [entries, setEntries] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterType, setFilterType] = useState(DEFAULT_FILTER_TYPE);
    const [inputValue, setInputValue] = useState('');
    const [activeFilters, setActiveFilters] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        Promise.all([
            fetch('/api/image-metadata').then(res => res.json()),
            fetch('/api/tags').then(res => res.json())
        ])
            .then(([imageEntries, tagEntries]) => {
                setEntries(Array.isArray(imageEntries) ? imageEntries : []);
                setTags(Array.isArray(tagEntries) ? tagEntries : []);
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

    const filteredEntries = useMemo(() => entries.filter(entry =>
        activeFilters.every(filter => {
            if (filter.type === 'title') {
                return typeof entry.name === 'string'
                    && entry.name.toLowerCase().includes(filter.value.toLowerCase());
            }
            if (filter.type === 'tag') {
                return Array.isArray(entry.tags) && entry.tags.includes(filter.value);
            }
            if (filter.type === 'dateCreated') {
                return entry.dateCreated === filter.value;
            }
            return true;
        })
    ), [entries, activeFilters]);

    function renderValueField() {
        if (filterType === 'tag') {
            return h('select', {
                key: 'value',
                className: 'field field-grow',
                value: inputValue,
                onChange: (e) => setInputValue(e.target.value),
                onKeyDown: handleInputKeyDown
            }, [
                h('option', { key: 'placeholder', value: '' }, 'Select a tag…'),
                ...tags.map(t => h('option', { key: t.tag, value: t.tag }, `${t.tag} (${t.count})`))
            ]);
        }

        return h('input', {
            key: 'value',
            className: 'field field-grow',
            type: filterType === 'dateCreated' ? 'date' : 'text',
            value: inputValue,
            placeholder: filterType === 'title' ? 'Search by title…' : '',
            onChange: (e) => setInputValue(e.target.value),
            onKeyDown: handleInputKeyDown
        });
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

        return h('div', { key: 'grid', className: 'grid' }, filteredEntries.map(entry =>
            h('div', {
                key: entry.id,
                className: 'grid-item',
                onClick: () => (onSelect ? onSelect(entry) : setSelectedImage(entry))
            }, [
                h('img', {
                    key: 'thumb',
                    src: `/api/images?id=${encodeURIComponent(entry.filename)}`,
                    alt: entry.name,
                    loading: 'lazy'
                }),
                h('div', { key: 'info', className: 'grid-item-info' }, [
                    h('h3', { key: 'name', className: 'grid-item-name' }, entry.name),
                    entry.dateCreated
                        ? h('p', { key: 'date', className: 'grid-item-date' }, entry.dateCreated)
                        : null
                ])
            ])
        ));
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
            h('img', {
                key: 'full',
                src: `/api/images?id=${encodeURIComponent(selectedImage.filename)}`,
                alt: selectedImage.name
            }),
            h('div', { key: 'meta', className: 'modal-meta' }, [
                h('h2', { key: 'name' }, selectedImage.name),
                selectedImage.description
                    ? h('p', { key: 'desc' }, selectedImage.description)
                    : null,
                Array.isArray(selectedImage.tags) && selectedImage.tags.length > 0
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
