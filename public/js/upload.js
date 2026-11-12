// Upload form. Cloudflare Access gates this page, so the browser only reaches
// it after a sign-in. The form posts to /api/upload, which writes the image to
// R2 and the metadata entry to KV.

import { slugify, freeIdSync } from './shared/id-rules.js';
import { createTermField } from './components/term-field.js';
import { KNOWN_LANGUAGES } from './shared/taxonomy.js';
import { readImages, readSnippet } from './shared/row.js';
import { makeThumbnail } from './shared/thumbnail.js';
import { mountMenu } from './components/menu.js';
import { api, ApiError } from './api.js';

const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file');
const idInput = document.getElementById('id');
const nameInput = document.getElementById('name');
const preview = document.getElementById('preview');

const entryPreview = document.getElementById('entry-preview');
const submitButton = document.getElementById('submit');
const status = document.getElementById('status');
const idHint = document.getElementById('id-hint');
const pageTitle = document.getElementById('page-title');
const editLink = document.getElementById('edit-link');
const fileRequired = document.getElementById('file-required');
const fileHint = document.getElementById('file-hint');
const overwriteRow = document.getElementById('overwrite-row');
const overwriteInput = document.getElementById('overwrite');
const deleteButton = document.getElementById('delete');
const kindInput = document.getElementById('kind');
const kindHint = document.getElementById('kind-hint');
const codeOnly = document.querySelector('.code-only');
const imageOnly = document.querySelectorAll('.image-only');
const snippetInput = document.getElementById('snippet');
const downloadInput = document.getElementById('download');

// Two categories of term, one control each.
const tagField = createTermField({
    input: document.getElementById('tag-input'),
    datalist: document.getElementById('tag-options'),
    addButton: document.getElementById('tag-add'),
    chips: document.getElementById('tag-chips'),
    label: 'tag',
    onChange: refreshPreview,
});

const mediumField = createTermField({
    input: document.getElementById('medium-input'),
    datalist: document.getElementById('medium-options'),
    addButton: document.getElementById('medium-add'),
    chips: document.getElementById('medium-chips'),
    label: 'medium',
    onChange: refreshPreview,
});
const dateInput = document.getElementById('dateCreated');

let previewUrls = [];
let idEdited = false;
// Ids already in the database. The page shows the free id before you submit.
let takenIds = new Set();
// Set when /upload?id=KEY opens the page on an existing row.
let editingId = new URLSearchParams(window.location.search).get('id');
// The object key the edited row already points at.
let editingImages = [];

// A fresh upload is an ordinary page, so it carries the side drawer. The
// editor of one row shows the Edit list button alone, and the drawer stays
// hidden. The page starts hidden either way, so the button never flashes on
// a row this page is about to edit.
if (!editingId) {
    const menu = document.getElementById('menu');
    menu.hidden = false;
    mountMenu(menu);
}

function splitList(value) {
    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
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
    const files = Array.from(fileInput.files);

    // The id comes from the typed id, then the name, then the first file.
    const wanted = slugify(
        idInput.value.trim() || name || (files[0] ? files[0].name.replace(/\.[a-z0-9]+$/i, '') : '')
    );
    const overwrite = document.getElementById('overwrite').checked;

    // freeId resolves at once here, because the id set is already in memory.
    let id = wanted;
    if (!editingId && wanted && !overwrite && takenIds.has(wanted)) {
        try {
            id = freeIdSync(wanted, key => takenIds.has(key));
        } catch {
            id = wanted;
        }
    }

    const isCode = kindInput.value === 'code';

    return {
        key: id || '(the id is still empty)',
        wanted,
        renamed: Boolean(wanted) && id !== wanted,
        value: {
            kind: kindInput.value,
            name,
            images: files.length
                ? files.map((f, i) => ({
                      key: `${id}${i === 0 ? '' : `-${i + 1}`}.${extensionOf(f)}`,
                  }))
                : editingImages,
            description: document.getElementById('description').value.trim(),
            mediums: isCode ? [] : mediumField.values(),
            tags: tagField.values(),
            dateCreated: dateInput.value,
            galleries: splitList(document.getElementById('galleries').value),
            repoUrl: isCode ? document.getElementById('repoUrl').value.trim() : '',
            liveUrl: isCode ? document.getElementById('liveUrl').value.trim() : '',
            language: isCode ? document.getElementById('language').value.trim() : '',
            snippet: isCode ? readSnippet(snippetInput.value) : '',
            download:
                isCode && downloadInput.files[0]
                    ? { name: downloadInput.files[0].name, size: downloadInput.files[0].size }
                    : null,
        },
    };
}

function refreshPreview() {
    const { key, value, renamed, wanted } = currentEntry();
    entryPreview.textContent = `${key}\n${JSON.stringify(value, null, 2)}`;

    // Edit mode owns the hint, because the id is fixed there.
    if (editingId) return;

    idHint.textContent = renamed
        ? `"${wanted}" is taken, so this entry becomes "${key}".`
        : 'The KV key. Lower case, dashes only. It fills itself from the name, or the file name.';
    idHint.classList.toggle('is-warning', renamed);
}

async function loadTakenIds() {
    try {
        const entries = await api.rows();
        takenIds = new Set(entries.map(entry => entry.id).filter(Boolean));
        refreshPreview();
    } catch {
        // The page still works. The server resolves the final id either way.
    }
}

// The sentence the server wrote, or a plain fallback when nothing answered.
function reasonFrom(error, fallback) {
    return error instanceof ApiError && error.status !== 0 ? error.message : fallback;
}

function setStatus(message, kind) {
    status.textContent = message;
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
}

// Every field except the name, the id, the description, and the galleries.
// The id fills itself from the name or the file. The server checks the same
// list, so a direct POST cannot skip one.
function firstProblem() {
    const needsPicture = kindInput.value !== 'code' && !editingId;
    if (needsPicture && !fileInput.files[0]) return [fileInput, 'Choose an image file.'];

    // A code project has no medium.
    if (kindInput.value !== 'code' && mediumField.values().length === 0) {
        return [document.getElementById('medium-input'), 'Name at least one medium.'];
    }

    if (!dateInput.value) return [dateInput, 'Pick the date created.'];

    if (tagField.values().length === 0) {
        return [document.getElementById('tag-input'), 'Add at least one tag.'];
    }

    return null;
}

function markInvalid(element) {
    document.querySelectorAll('.is-invalid').forEach(node => node.classList.remove('is-invalid'));
    element.classList.add('is-invalid');
    element.focus();
}

// The suggestion lists come from the rows already stored.
async function loadVocabulary() {
    try {
        const { tags = [], mediums = [] } = await api.vocabulary();
        tagField.setSuggestions(tags);
        mediumField.setSuggestions(mediums);
    } catch {
        setStatus('The suggestion lists did not load. You can still type a new term.');
    }
}

// A thumbnail for each chosen file. The first one is the cover.
function drawPreview(items) {
    preview.hidden = items.length === 0;
    preview.replaceChildren(
        ...items.map((item, index) => {
            const figure = document.createElement('figure');
            figure.className = 'form-preview-item';

            const img = document.createElement('img');
            img.src = item.src;
            img.alt = '';

            const caption = document.createElement('figcaption');
            caption.textContent = index === 0 ? 'Cover' : String(index + 1);

            figure.append(img, caption);
            return figure;
        })
    );
}

fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files);

    previewUrls.forEach(url => URL.revokeObjectURL(url));
    previewUrls = files.map(file => URL.createObjectURL(file));
    drawPreview(previewUrls.map(src => ({ src })));

    if (files[0] && !idEdited && !idInput.value.trim()) {
        idInput.value = slugify(files[0].name.replace(/\.[a-z0-9]+$/i, ''));
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

form.addEventListener('change', refreshPreview);

form.addEventListener('submit', async event => {
    event.preventDefault();

    tagField.commitPending();
    mediumField.commitPending();

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

    body.delete('tags');
    body.delete('mediums');
    for (const tag of tagField.values()) body.append('tags', tag);
    if (kindInput.value !== 'code') {
        for (const medium of mediumField.values()) body.append('mediums', medium);
    }
    body.set('overwrite', String(Boolean(editingId) || overwriteInput.checked));

    // An edit with no new file keeps the pictures already in the bucket.
    if (editingId && fileInput.files.length === 0) body.delete('file');

    // A small copy of each picture, made here, so the wall loads kilobytes
    // instead of megabytes. One per file, in the same order. A picture the
    // browser cannot read sends an empty part, and the wall uses the original.
    const chosen = Array.from(fileInput.files);
    if (chosen.length > 0) {
        setStatus('Making the small copies…');

        const copies = await Promise.all(chosen.map(file => makeThumbnail(file)));
        for (const copy of copies) {
            body.append('thumb', copy ?? new Blob([], { type: 'application/octet-stream' }));
        }
    }

    // The same for the download.
    if (!downloadInput.files[0]) body.delete('download');
    body.set('keepDownload', String(Boolean(editingId)));

    submitButton.disabled = true;
    setStatus('Uploading…');

    try {
        const result = await api.saveRow(body);

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
    } catch (error) {
        setStatus(
            reasonFrom(error, 'The upload failed. Check the network and try again.'),
            'error'
        );
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
    editLink.textContent = '← Edit list';

    fileRequired.hidden = true;
    fileInput.required = false;
    fileHint.textContent = 'Leave this empty to keep the current pictures.';

    idInput.readOnly = true;
    idInput.value = id;
    idEdited = true;
    idHint.textContent = 'The row being edited. The key never changes here.';

    overwriteRow.hidden = true;
    overwriteInput.checked = true;
    deleteButton.hidden = false;

    setStatus('Loading the entry…');

    try {
        const entry = await api.row(id);
        nameInput.value = entry.name || '';
        document.getElementById('description').value = entry.description || '';
        mediumField.set(entry.mediums || []);
        dateInput.value = entry.dateCreated || '';
        document.getElementById('galleries').value = (entry.galleries || []).join(', ');

        editingImages = readImages(entry);
        drawPreview(editingImages.map(image => ({ src: api.imageUrl(image.key) })));

        tagField.set(entry.tags || []);

        kindInput.value = entry.kind === 'code' ? 'code' : 'image';
        applyKind();

        document.getElementById('repoUrl').value = entry.repoUrl || '';
        document.getElementById('liveUrl').value = entry.liveUrl || '';
        document.getElementById('language').value = entry.language || '';
        snippetInput.value = entry.snippet || '';

        if (entry.download && entry.download.name) {
            document.getElementById('download-hint').textContent =
                `Holding ${entry.download.name}. Choose a file to replace it.`;
        }

        setStatus('');
        refreshPreview();
    } catch (error) {
        setStatus(reasonFrom(error, 'The entry did not load. Reload the page.'), 'error');
        submitButton.disabled = true;
        deleteButton.hidden = true;
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
        const result = await api.deleteRow(editingId);

        setStatus(`Deleted "${result.id}". Going back to the edit list…`, 'ok');
        window.setTimeout(() => {
            window.location.href = '/pages/edit';
        }, 900);
    } catch (error) {
        setStatus(
            reasonFrom(error, 'The delete failed. Check the network and try again.'),
            'error'
        );
        deleteButton.disabled = false;
        submitButton.disabled = false;
    }
}

deleteButton.addEventListener('click', runDelete);
form.addEventListener('pointerdown', event => {
    if (event.target !== deleteButton) disarmDelete();
});

// The kind decides which fields show, and whether a picture is needed.
function applyKind() {
    const isCode = kindInput.value === 'code';

    codeOnly.hidden = !isCode;
    imageOnly.forEach(row => {
        row.hidden = isCode;
    });
    fileRequired.hidden = isCode;
    fileInput.required = !isCode;

    kindHint.textContent = isCode
        ? 'A code project needs no picture. With none, the tile shows code.'
        : 'An image needs a picture.';

    if (!editingId) {
        fileHint.textContent = isCode
            ? 'Optional. The first picture takes the place of the code on the tile.'
            : '25MB each, 12 at most. The first one is the cover.';
    }

    refreshPreview();
}

kindInput.addEventListener('change', applyKind);

document.getElementById('language-options').replaceChildren(
    ...KNOWN_LANGUAGES.map(name => {
        const option = document.createElement('option');
        option.value = name;
        return option;
    })
);

document.getElementById('overwrite').addEventListener('change', refreshPreview);

// Default the date to today, in the browser's own time zone.
const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
dateInput.value = localDate.toISOString().slice(0, 10);

(async function start() {
    applyKind();
    await loadVocabulary();

    if (editingId) {
        await enterEditMode(editingId);
        return;
    }

    loadTakenIds();
    refreshPreview();
})();
