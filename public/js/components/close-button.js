// The one way out of anything that opens.
//
// Every close control on the site is this button: a large cross, no border
// and no fill, at the top right of the thing it closes. STYLE_GUIDE.md holds
// the rule, and css/components.css holds the look.
//
// The caller decides where it sits. A component gives it a positioned parent,
// and the detail view pins it to the corner of the window instead.

// The multiplication sign, not the letter x. It is symmetric, and it carries
// no meaning for a reader who hears the page.
const CROSS = '×';

// Builds the button. `label` names what closes, for a reader who hears the
// page, because the glyph says nothing out loud.
export function buildCloseButton(onClose, label = 'Close') {
    const shut = document.createElement('button');
    shut.type = 'button';
    shut.className = 'close-button';
    shut.textContent = CROSS;
    shut.setAttribute('aria-label', label);
    shut.addEventListener('click', onClose);

    return shut;
}
