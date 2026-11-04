// Upload form. Cloudflare Access gates this page, so the browser only reaches
// it after a sign-in. The form posts to /api/upload, which writes the image to
// R2 and the metadata entry to KV.

import { slugify, freeIdSync } from './id-rules.js';

const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file');
const idInput = document.getElementById('id');
const nameInput = document.getElementById('name');
const preview = document.getElementById('preview');
const tagList = document.getElementById('tag-list');
const entryPreview = document.getElementById('entry-preview');
const submitButton = document.getElementById('submit');
const status = document.getElementById('status');
const idHint = document.getElementById('id-hint');
const pageTitle = document.getElementById('page-title');
const backLink = document.getElementById('back-link');
const fileRequired = document.getElementById('file-required');
const fileHint = document.getElementById('file-hint');
const overwriteRow = document.getElementById('overwrite-row');
const overwriteInput = document.getElementById('overwrite');
const deleteButton = document.getElementById('delete');
const dateInput = document.getElementById('dateCreated');

let previewUrl = null;
let idEdited = false;
// Ids already in the database. The page shows the free id before you submit.
let takenIds = new Set();
// Set when /upload?id=KEY opens the page on an existing row.
let editingId = new URLSearchParams(window.location.search).get('id');

function splitList(value) {
    return value.split(',').map(item => item.trim()).filter(Boolean);
}

function checkedTags() {
    return Array.from(tagList.querySelectorAll('input:checked')).map(input => input.value);
}

function extensionOf(file) {
    const fromName = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1];
    if (fromName) return fromName.toLowerCase();

    const fromType = (file.type.match(/^image\/([a-z0-9+.-]+)$/i) || [])[1];
    return fromType ? fromType.replace('jpeg', 'jpg') : 'bin';
}

// Mirrors what src/api/upload.js stores, so the page shows the real row.
function currentEntry() {
    const name = nameInput.value.trim();
    const wanted = slugify(idInput.value.trim() || name);
    const overwrite = document.getElementById('overwrite').checked;
    const file = fileInput.files[0];

    // freeId resolves at once here, because the id set is already in memory.
    let id = wanted;
    if (!editingId && wanted && !overwrite && takenIds.has(wanted)) {
        try {
            id = freeIdSync(wanted, key => takenIds.has(key));
        } catch {
            id = wanted;
        }
    }

    return {
        key: id || '(the id is still empty)',
        wanted,
        renamed: Boolean(wanted) && id !== wanted,
        value: {
            name,
            filename: id && file ? `${id}.${extensionOf(file)}` : '',
            description: document.getElementById('description').value.trim(),
            medium: document.getElementById('medium').value.trim(),
            tags: checkedTags(),
            dateCreated: dateInput.value,
            galleries: splitList(document.getElementById('galleries').value)
        }
    };
}

function refreshPreview() {
    const { key, value, renamed, wanted } = currentEntry();
    entryPreview.textContent = `${key}\n${JSON.stringify(value, null, 2)}`;
    idHint.textContent = renamed
        ? `"${wanted}" is taken, so this entry becomes "${key}".`
        : 'The KV key. Lower case, dashes only. It fills itself from the name.';
    idHint.classList.toggle('is-warning', renamed);
}

async function loadTakenIds() {
    try {
        const response = await fetch('/api/image-metadata');
        if (!response.ok) return;

        const entries = await response.json();
        takenIds = new Set(entries.map(entry => entry.id).filter(Boolean));
        refreshPreview();
    } catch {
        // The page still works. The server resolves the final id either way.
    }
}

function setStatus(message, kind) {
    status.textContent = message;
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
}

// Every field except the id, the description, and the galleries. The id fills
// itself from the name. The server checks the same list, so a direct POST
// cannot skip one.
function firstProblem() {
    if (!fileInput.files[0] && !editingId) return [fileInput, 'Choose an image file.'];
    if (!nameInput.value.trim()) return [nameInput, 'Give the piece a name.'];

    const medium = document.getElementById('medium');
    if (!medium.value.trim()) return [medium, 'Name the medium.'];

    if (!dateInput.value) return [dateInput, 'Pick the date created.'];

    if (checkedTags().length === 0) return [tagList, 'Tick at least one tag.'];

    return null;
}

function markInvalid(element) {
    document.querySelectorAll('.is-invalid').forEach(node => node.classList.remove('is-invalid'));
    element.classList.add('is-invalid');
    element.focus();
}

async function loadTags() {
    try {
        const response = await fetch('/api/tags?all=true');
        if (!response.ok) throw new Error(String(response.status));

        const tags = await response.json();
        tagList.replaceChildren(...tags.map(({ tag, count }) => {
            const label = document.createElement('label');
            label.className = 'tag-option';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.name = 'tags';
            input.value = tag;
            input.addEventListener('change', refreshPreview);

            const text = document.createElement('span');
            text.textContent = count ? `${tag} (${count})` : tag;

            label.append(input, text);
            return label;
        }));
    } catch {
        tagList.textContent = 'The tag list did not load. Reload the page.';
    }
}

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = file ? URL.createObjectURL(file) : null;

    preview.hidden = !file;
    if (file) {
        preview.src = previewUrl;
        if (!nameInput.value.trim()) {
            nameInput.value = file.name.replace(/\.[a-z0-9]+$/i, '');
            if (!idEdited) idInput.value = slugify(nameInput.value);
        }
    }

    refreshPreview();
});

idInput.addEventListener('input', () => {
    idEdited = idInput.value.trim() !== '';
});

nameInput.addEventListener('input', () => {
    if (!idEdited) idInput.value = slugify(nameInput.value);
});

form.addEventListener('input', event => {
    event.target.classList.remove('is-invalid');
    refreshPreview();
});

form.addEventListener('change', () => {
    tagList.classList.remove('is-invalid');
    refreshPreview();
});

form.addEventListener('submit', async event => {
    event.preventDefault();

    const problem = firstProblem();
    if (problem) {
        const [element, message] = problem;
        markInvalid(element);
        setStatus(message, 'error');
        return;
    }

    // Send the typed id. The server owns the final choice.
    const { wanted } = currentEntry();
    const body = new FormData(form);
    body.set('id', editingId || wanted);
    body.set('overwrite', String(Boolean(editingId) || overwriteInput.checked));

    // An edit with no new file keeps the image already in the bucket.
    if (editingId && !fileInput.files[0]) body.delete('file');

    submitButton.disabled = true;
    setStatus('Uploading…');

    try {
        const response = await fetch('/api/upload', { method: 'POST', body });
        const result = await response.json();

        if (!response.ok) {
            setStatus(result.error || `The upload failed with status ${response.status}.`, 'error');
            return;
        }

        const note = editingId
            ? `Saved "${result.id}".`
            : result.replaced
            ? `Replaced "${result.id}".`
            : result.renamedFrom
                ? `"${result.renamedFrom}" was taken. Stored as "${result.id}".`
                : `Stored "${result.id}".`;

        setStatus(note, 'ok');
        entryPreview.textContent = `${result.id}\n${JSON.stringify(result.entry, null, 2)}`;
        takenIds.add(result.id);
    } catch {
        setStatus('The upload failed. Check the network and try again.', 'error');
    } finally {
        submitButton.disabled = false;
    }
});

// ---------- Edit mode ----------
//
// /upload?id=KEY turns the same page into an editor for that row. The id is
// fixed, the file becomes optional, and the submit replaces the entry instead
// of adding one.
async function enterEditMode(id) {
    pageTitle.textContent = 'Edit an image';
    submitButton.textContent = 'Save changes';
    backLink.hidden = false;

    fileRequired.hidden = true;
    fileInput.required = false;
    fileHint.textContent = 'Leave this empty to keep the current image.';

    idInput.readOnly = true;
    idInput.value = id;
    idEdited = true;
    idHint.textContent = 'The row being edited. The key never changes here.';

    overwriteRow.hidden = true;
    overwriteInput.checked = true;
    deleteButton.hidden = false;

    setStatus('Loading the entry…');

    try {
        const response = await fetch(`/api/image-metadata?id=${encodeURIComponent(id)}`);
        if (!response.ok) {
            setStatus(`No entry with the id "${id}".`, 'error');
            submitButton.disabled = true;
            deleteButton.hidden = true;
            return;
        }

        const entry = await response.json();
        nameInput.value = entry.name || '';
        document.getElementById('description').value = entry.description || '';
        document.getElementById('medium').value = entry.medium || '';
        dateInput.value = entry.dateCreated || '';
        document.getElementById('galleries').value = (entry.galleries || []).join(', ');

        if (entry.filename) {
            preview.src = `/api/images?id=${encodeURIComponent(entry.filename)}`;
            preview.hidden = false;
        }

        checkTags(entry.tags || []);
        setStatus('');
        refreshPreview();
    } catch {
        setStatus('The entry did not load. Reload the page.', 'error');
        submitButton.disabled = true;
    }
}

// Delete takes two clicks. The first one arms the button, so a stray click
// never removes a row. Any other click on the page disarms it again.
let deleteArmed = false;

function disarmDelete() {
    if (!deleteArmed) return;
    deleteArmed = false;
    deleteButton.classList.remove('is-armed');
    deleteButton.textContent = 'Delete this image';
}

async function runDelete() {
    if (!deleteArmed) {
        deleteArmed = true;
        deleteButton.classList.add('is-armed');
        deleteButton.textContent = 'Click again to delete';
        setStatus(`This removes "${editingId}" and its image. The step cannot be undone.`, 'error');
        return;
    }

    deleteArmed = false;
    deleteButton.disabled = true;
    submitButton.disabled = true;
    setStatus('Deleting…');

    try {
        const response = await fetch(`/api/upload?id=${encodeURIComponent(editingId)}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (!response.ok) {
            setStatus(result.error || `The delete failed with status ${response.status}.`, 'error');
            deleteButton.disabled = false;
            submitButton.disabled = false;
            return;
        }

        setStatus(`Deleted "${result.id}". Going back to the edit list…`, 'ok');
        window.setTimeout(() => { window.location.href = '/edit'; }, 900);
    } catch {
        setStatus('The delete failed. Check the network and try again.', 'error');
        deleteButton.disabled = false;
        submitButton.disabled = false;
    }
}

deleteButton.addEventListener('click', runDelete);
form.addEventListener('pointerdown', event => {
    if (event.target !== deleteButton) disarmDelete();
});

// Ticks the boxes for an entry's tags, once the tag list exists.
function checkTags(tags) {
    const wanted = new Set(tags);
    tagList.querySelectorAll('input').forEach(input => {
        input.checked = wanted.has(input.value);
    });
}

document.getElementById('overwrite').addEventListener('change', refreshPreview);

// Default the date to today, in the browser's own time zone.
const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
dateInput.value = localDate.toISOString().slice(0, 10);

(async function start() {
    await loadTags();

    if (editingId) {
        await enterEditMode(editingId);
        return;
    }

    loadTakenIds();
    refreshPreview();
})();
