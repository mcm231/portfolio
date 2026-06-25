// Category Page Component - Displays subcategories for each portfolio section

function CategoryPage({ categoryName, color, subcategories }) {
    const { useState } = React;

    const handleBackClick = () => {
        window.location.href = '../';
    };

    return React.createElement('div', {
        style: {
            width: '100vw',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: '40px',
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
                marginBottom: '60px',
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
            }, categoryName),
            React.createElement('p', {
                key: 'subtitle',
                style: {
                    fontSize: '16px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    margin: 0,
                    fontWeight: '300'
                }
            }, `Explore ${subcategories.length} subcategories`)
        ]),

        // Subcategories Grid
        React.createElement('div', {
            key: 'grid',
            style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '20px',
                maxWidth: '1000px',
                width: '100%',
                animation: 'fadeIn 0.8s ease-out 0.2s both'
            }
        }, subcategories.map((subcategory, idx) =>
            React.createElement('div', {
                key: `subcategory-${idx}`,
                style: {
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '30px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease',
                    transform: 'scale(1)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                },
                onMouseEnter: (e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.transform = 'scale(1.05) translateY(-5px)';
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                },
                onMouseLeave: (e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }
            }, [
                React.createElement('div', {
                    key: 'icon',
                    style: {
                        fontSize: '40px',
                        marginBottom: '15px',
                        opacity: 0.8
                    }
                }, '✨'),
                React.createElement('h3', {
                    key: 'name',
                    style: {
                        fontSize: '18px',
                        fontWeight: '600',
                        margin: 0,
                        color: 'white'
                    }
                }, subcategory),
                React.createElement('p', {
                    key: 'desc',
                    style: {
                        fontSize: '12px',
                        color: 'rgba(255, 255, 255, 0.6)',
                        margin: '10px 0 0 0'
                    }
                }, 'View work')
            ])
        )),

        // Footer
        React.createElement('div', {
            key: 'footer',
            style: {
                position: 'fixed',
                bottom: '20px',
                width: '100%',
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '12px'
            }
        }, 'Maya Malavasi © 2024 — Interactive Portfolio'),

        // Styles
        React.createElement('style', {
            key: 'styles'
        }, `
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
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

            /* Scrollbar styling */
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

// Make component globally available
if (typeof window !== 'undefined') {
    window.CategoryPage = CategoryPage;
}
