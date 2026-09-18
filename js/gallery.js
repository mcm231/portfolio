// Gallery Page Component - Browses every image in the database with
// composable filters (Title / Tag / Date Created).

const FILTER_TYPES = [
    { value: 'title', label: 'Title' },
    { value: 'tag', label: 'Tag' },
    { value: 'dateCreated', label: 'Date Created' }
];

function GalleryPage() {
    const { useState, useEffect, useMemo } = React;

    const [entries, setEntries] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filterType, setFilterType] = useState('title');
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

    const handleBackClick = () => {
        window.location.href = '../';
    };

    const addFilter = () => {
        const value = inputValue.trim();
        if (!value) return;

        const filterTypeLabel = FILTER_TYPES.find(f => f.value === filterType).label;
        const alreadyActive = activeFilters.some(f => f.type === filterType && f.value === value);
        if (alreadyActive) return;

        setActiveFilters(prev => [...prev, { type: filterType, value, label: filterTypeLabel }]);
        setInputValue('');
    };

    const removeFilter = (idx) => {
        setActiveFilters(prev => prev.filter((_, i) => i !== idx));
    };

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addFilter();
        }
    };

    const filteredEntries = useMemo(() => {
        return entries.filter(entry =>
            activeFilters.every(filter => {
                if (filter.type === 'title') {
                    return typeof entry.name === 'string' &&
                        entry.name.toLowerCase().includes(filter.value.toLowerCase());
                }
                if (filter.type === 'tag') {
                    return Array.isArray(entry.tags) && entry.tags.includes(filter.value);
                }
                if (filter.type === 'dateCreated') {
                    return entry.dateCreated === filter.value;
                }
                return true;
            })
        );
    }, [entries, activeFilters]);

    const inputStyle = {
        flex: 1,
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        color: 'white',
        padding: '14px 18px',
        fontSize: '16px',
        outline: 'none'
    };

    return React.createElement('div', {
        style: {
            width: '100vw',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            padding: '40px 40px 80px',
            color: 'white'
        }
    }, [
        // Back button
        React.createElement('button', {
            key: 'back-btn',
            onClick: handleBackClick,
            style: {
                position: 'fixed',
                top: '20px',
                left: '20px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease',
                zIndex: 1000
            },
            onMouseEnter: (e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            },
            onMouseLeave: (e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
            }
        }, '← Back to Portfolio'),

        // Header
        React.createElement('div', {
            key: 'header',
            style: {
                textAlign: 'center',
                marginBottom: '40px',
                marginTop: '40px',
                animation: 'slideDown 0.6s ease-out'
            }
        }, [
            React.createElement('h1', {
                key: 'title',
                style: {
                    fontSize: '48px',
                    fontWeight: '700',
                    margin: '0 0 10px 0',
                    textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                    letterSpacing: '2px'
                }
            }, 'Gallery'),
            React.createElement('p', {
                key: 'subtitle',
                style: {
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    margin: 0,
                    fontWeight: '300'
                }
            }, `${filteredEntries.length} of ${entries.length} pieces`)
        ]),

        // Search / filter bar
        React.createElement('div', {
            key: 'search-bar',
            style: {
                display: 'flex',
                gap: '10px',
                width: '100%',
                maxWidth: '900px',
                marginBottom: '16px'
            }
        }, [
            React.createElement('select', {
                key: 'filter-type',
                value: filterType,
                onChange: (e) => {
                    setFilterType(e.target.value);
                    setInputValue('');
                },
                style: {
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    padding: '14px 12px',
                    fontSize: '16px',
                    outline: 'none',
                    cursor: 'pointer'
                }
            }, FILTER_TYPES.map(f => React.createElement('option', {
                key: f.value,
                value: f.value,
                style: { color: 'black' }
            }, f.label))),

            filterType === 'tag'
                ? React.createElement('select', {
                    key: 'value-input-tag',
                    value: inputValue,
                    onChange: (e) => setInputValue(e.target.value),
                    onKeyDown: handleInputKeyDown,
                    style: inputStyle
                }, [
                    React.createElement('option', { key: 'placeholder', value: '', style: { color: 'black' } }, 'Select a tag…'),
                    ...tags.map(t => React.createElement('option', {
                        key: t.tag,
                        value: t.tag,
                        style: { color: 'black' }
                    }, `${t.tag} (${t.count})`))
                ])
                : React.createElement('input', {
                    key: 'value-input',
                    type: filterType === 'dateCreated' ? 'date' : 'text',
                    value: inputValue,
                    placeholder: filterType === 'title' ? 'Search by title…' : '',
                    onChange: (e) => setInputValue(e.target.value),
                    onKeyDown: handleInputKeyDown,
                    style: inputStyle
                }),

            React.createElement('button', {
                key: 'add-btn',
                onClick: addFilter,
                style: {
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    padding: '14px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    backdropFilter: 'blur(10px)'
                },
                onMouseEnter: (e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)',
                onMouseLeave: (e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
            }, 'Add')
        ]),

        // Active filter chips
        activeFilters.length > 0 ? React.createElement('div', {
            key: 'filter-chips',
            style: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                width: '100%',
                maxWidth: '900px',
                marginBottom: '30px'
            }
        }, activeFilters.map((filter, idx) => React.createElement('div', {
            key: `chip-${idx}`,
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '20px',
                padding: '6px 8px 6px 16px',
                fontSize: '13px'
            }
        }, [
            React.createElement('span', { key: 'text' }, `${filter.label}: ${filter.value}`),
            React.createElement('button', {
                key: 'remove',
                onClick: () => removeFilter(idx),
                style: {
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    color: 'white',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: '14px',
                    lineHeight: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }
            }, '×')
        ]))) : null,

        // Content
        loading ? React.createElement('div', {
            key: 'loading',
            className: 'loading',
            style: { position: 'relative', top: 0, left: 0, transform: 'none', marginTop: '60px' }
        }, React.createElement('div', { className: 'loading-spinner' })) :
        error ? React.createElement('p', {
            key: 'error',
            style: { color: 'rgba(255, 255, 255, 0.7)', marginTop: '40px' }
        }, error) :
        filteredEntries.length === 0 ? React.createElement('p', {
            key: 'empty',
            style: { color: 'rgba(255, 255, 255, 0.7)', marginTop: '40px' }
        }, 'No images match your filters.') :
        React.createElement('div', {
            key: 'grid',
            style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '20px',
                width: '100%',
                maxWidth: '1400px',
                animation: 'fadeIn 0.6s ease-out'
            }
        }, filteredEntries.map(entry => React.createElement('div', {
            key: entry.id,
            onClick: () => setSelectedImage(entry),
            style: {
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.25s ease'
            },
            onMouseEnter: (e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)';
            },
            onMouseLeave: (e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
        }, [
            React.createElement('img', {
                key: 'thumb',
                src: `/api/images?id=${encodeURIComponent(entry.filename)}`,
                alt: entry.name,
                loading: 'lazy',
                style: {
                    width: '100%',
                    height: '200px',
                    objectFit: 'cover',
                    display: 'block'
                }
            }),
            React.createElement('div', {
                key: 'info',
                style: { padding: '12px 14px' }
            }, [
                React.createElement('h3', {
                    key: 'name',
                    style: { fontSize: '15px', fontWeight: '600', margin: '0 0 4px 0' }
                }, entry.name),
                entry.dateCreated ? React.createElement('p', {
                    key: 'date',
                    style: { fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }
                }, entry.dateCreated) : null
            ])
        ]))),

        // Modal
        selectedImage ? React.createElement('div', {
            key: 'modal',
            className: 'modal-overlay',
            onClick: () => setSelectedImage(null)
        }, React.createElement('div', {
            className: 'modal-content',
            onClick: (e) => e.stopPropagation()
        }, [
            React.createElement('img', {
                key: 'full-img',
                src: `/api/images?id=${encodeURIComponent(selectedImage.filename)}`,
                alt: selectedImage.name
            }),
            React.createElement('div', {
                key: 'meta',
                style: { color: 'white', marginTop: '16px', textAlign: 'center' }
            }, [
                React.createElement('h2', { key: 'name', style: { margin: '0 0 6px 0' } }, selectedImage.name),
                selectedImage.description ? React.createElement('p', {
                    key: 'desc',
                    style: { margin: '0 0 6px 0', color: 'rgba(255, 255, 255, 0.8)' }
                }, selectedImage.description) : null,
                Array.isArray(selectedImage.tags) && selectedImage.tags.length > 0 ? React.createElement('p', {
                    key: 'tags',
                    style: { margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }
                }, selectedImage.tags.join(', ')) : null
            ]),
            React.createElement('button', {
                key: 'close',
                className: 'modal-close',
                onClick: () => setSelectedImage(null),
                style: { position: 'static', marginTop: '16px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }
            }, 'Close')
        ])) : null,

        // Styles
        React.createElement('style', {
            key: 'styles'
        }, `
            @keyframes slideDown {
                from { opacity: 0; transform: translateY(-30px); }
                to { opacity: 1; transform: translateY(0); }
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
                overflow-y: auto;
            }

            ::-webkit-scrollbar {
                width: 8px;
            }

            ::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
            }

            ::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 4px;
            }

            ::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        `)
    ]);
}

if (typeof window !== 'undefined') {
    window.GalleryPage = GalleryPage;
}
