// A field that collects terms, such as tags or mediums.
//
// You type a term and press Enter, or pick one from the suggestion list. The
// list holds the terms already in the database, so an old term is one click
// away and a new term is just typing. Each chosen term shows as a chip.
import { normalizeTerm, MAX_TERMS } from '../shared/taxonomy.js';

export function createTermField({ input, datalist, addButton, chips, label, onChange }) {
    const chosen = [];

    function announce() {
        if (onChange) onChange([...chosen]);
    }

    function draw() {
        chips.replaceChildren(
            ...chosen.map(term => {
                const chip = document.createElement('span');
                chip.className = 'chip';

                const text = document.createElement('span');
                text.textContent = term;

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'chip-remove';
                remove.textContent = '×';
                remove.setAttribute('aria-label', `Remove the ${label} ${term}`);
                remove.addEventListener('click', () => {
                    chosen.splice(chosen.indexOf(term), 1);
                    draw();
                    announce();
                });

                chip.append(text, remove);
                return chip;
            })
        );
    }

    function add(raw) {
        const term = normalizeTerm(raw);
        input.value = '';
        input.classList.remove('is-invalid');

        if (!term || chosen.includes(term) || chosen.length >= MAX_TERMS) return;

        chosen.push(term);
        draw();
        announce();
    }

    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        add(input.value);
    });

    // Picking from the suggestion list fires input, not keydown.
    input.addEventListener('input', () => {
        if (suggestions.includes(input.value)) add(input.value);
    });

    addButton.addEventListener('click', () => add(input.value));

    let suggestions = [];

    return {
        // The terms already in use, most used first.
        setSuggestions(terms) {
            suggestions = terms.map(t => t.value);
            datalist.replaceChildren(
                ...terms.map(({ value, count }) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.label = count > 1 ? `${value} (${count})` : value;
                    return option;
                })
            );
        },

        values() {
            return [...chosen];
        },

        set(terms) {
            chosen.length = 0;
            for (const term of terms) {
                const clean = normalizeTerm(term);
                if (clean && !chosen.includes(clean)) chosen.push(clean);
            }
            draw();
            announce();
        },

        // The half typed term counts too, so a forgotten Enter costs nothing.
        commitPending() {
            if (input.value.trim()) add(input.value);
        },

        focus() {
            input.focus();
        },
    };
}
