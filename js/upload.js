// Upload form. Cloudflare Access gates this page, so the browser only reaches
// it after a sign-in. The form posts to /api/upload, which writes the image to
// R2 and the metadata entry to KV.

const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file');
const idInput = document.getElementById('id');
const nameInput = document.getElementById('name');
const preview = document.getElementById('preview');
const tagList = document.getElementById('tag-list');
const entryPreview = document.getElementById('entry-preview');
const submitButton = document.getElementById('submit');
const status = document.getElementById('status');

let previewUrl = null;

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

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

// Mirrors what functions/api/upload.js stores, so the page shows the real row.
function currentEntry() {
    const name = nameInput.value.trim();
    const id = slugify(idInput.value.trim() || name);
    const file = fileInput.files[0];

    return {
        key: id || '(the id is still empty)',
        value: {
            name,
            filename: id && file ? `${id}.${extensionOf(file)}` : '',
            description: document.getElementById('description').value.trim(),
            medium: document.getElementById('medium').value.trim(),
            tags: checkedTags(),
            dateCreated: document.getElementById('dateCreated').value,
            galleries: splitList(document.getElementById('galleries').value)
        }
    };
}

function refreshPreview() {
    const { key, value } = currentEntry();
    entryPreview.textContent = `${key}\n${JSON.stringify(value, null, 2)}`;
}

function setStatus(message, kind) {
    status.textContent = message;
    status.className = `form-status${kind ? ` is-${kind}` : ''}`;
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
        }
    }

    refreshPreview();
});

form.addEventListener('input', refreshPreview);

form.addEventListener('submit', async event => {
    event.preventDefault();

    const file = fileInput.files[0];
    if (!file) return setStatus('Choose an image file.', 'error');
    if (!nameInput.value.trim()) return setStatus('Give the piece a name.', 'error');

    const { key } = currentEntry();
    const body = new FormData(form);
    body.set('id', key);
    body.set('overwrite', String(document.getElementById('overwrite').checked));

    submitButton.disabled = true;
    setStatus('Uploading…');

    try {
        const response = await fetch('/api/upload', { method: 'POST', body });
        const result = await response.json();

        if (!response.ok) {
            setStatus(result.error || `The upload failed with status ${response.status}.`, 'error');
            return;
        }

        setStatus(result.replaced ? `Replaced "${result.id}".` : `Stored "${result.id}".`, 'ok');
        entryPreview.textContent = `${result.id}\n${JSON.stringify(result.entry, null, 2)}`;
    } catch {
        setStatus('The upload failed. Check the network and try again.', 'error');
    } finally {
        submitButton.disabled = false;
    }
});

loadTags();
refreshPreview();
