document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const logo = document.getElementById('sidebarLogo');
    const dropdownLabel = document.getElementById('dropdown-label');
    const dropdownOptions = document.getElementById('dropdown-options');
    const selectedModelSpan = document.getElementById('selected-model');
    const hiddenInput = document.getElementById('model-select');

    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadBox = document.getElementById('uploadBox');
    const docList = document.getElementById('docList');

    const refreshBtn = document.getElementById('refreshBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    const chatHistory = document.getElementById('chatHistory');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // Sidebar toggle
    logo.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // Dropdown toggle
    dropdownLabel.addEventListener('click', () => {
        dropdownOptions.classList.toggle('d-none');
        dropdownLabel.setAttribute('aria-expanded', !dropdownOptions.classList.contains('d-none'));
    });


    // Dropdown option select
    dropdownOptions.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            selectedModelSpan.textContent = event.target.textContent;
            hiddenInput.value = event.target.getAttribute('data-value');
            dropdownOptions.classList.add('d-none');
            dropdownLabel.setAttribute('aria-expanded', 'false');
        }
    });


    // Close dropdown if clicking outside
    document.addEventListener('click', (event) => {
        if (!dropdownLabel.contains(event.target) && !dropdownOptions.contains(event.target)) {
            dropdownOptions.classList.add('d-none');
            dropdownLabel.setAttribute('aria-expanded', 'false');
        }
    });



    let uploadedFiles = [];
    let chatMessages = [];

    // Browse → open file picker
    browseBtn.addEventListener('click', () => fileInput.click());

    // Handle file selection
    fileInput.addEventListener('change', () => {
        addFiles([...fileInput.files]);
    });

    // Drag & Drop support
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
    });
    uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        addFiles([...e.dataTransfer.files]);
    });

    // Add files to uploaded list
    function addFiles(files) {
        files.forEach(file => {
            uploadedFiles.push({ name: file.name, selected: false });
        });
        renderDocs();
    }

    // Render document list
    function renderDocs() {
        docList.innerHTML = '';
        if (uploadedFiles.length === 0) {
            docList.innerHTML = `<li class="list-group-item text-muted">No documents uploaded.</li>`;
            return;
        }

        uploadedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';

            li.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <input type="checkbox" class="form-check-input file-check" data-index="${index}" ${file.selected ? 'checked' : ''}>
        <span>${file.name}</span>
      </div>
      <button class="btn btn-sm btn-outline-danger btn-delete" data-index="${index}">x</button>
    `;

            // Checkbox toggle
            li.querySelector('.file-check').addEventListener('change', (e) => {
                uploadedFiles[index].selected = e.target.checked;
            });

            // Individual delete
            li.querySelector('.btn-delete').addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                uploadedFiles.splice(idx, 1);
                renderDocs();
            });

            docList.appendChild(li);
        });
    }

    // Button Actions
    refreshBtn.addEventListener('click', renderDocs);

    selectAllBtn.addEventListener('click', () => {
        uploadedFiles.forEach(file => file.selected = true);
        renderDocs();
    });

    deleteBtn.addEventListener('click', () => {
        uploadedFiles = uploadedFiles.filter(file => !file.selected);
        renderDocs();
    });


    // Chat history demo
    function renderChatHistory() {
        chatHistory.innerHTML = '';
        if (chatMessages.length === 0) {
            chatHistory.innerHTML = `<li class="list-group-item text-muted">No chat history yet.</li>`;
            return;
        }
        chatMessages.forEach(msg => {
            const li = document.createElement('li');
            li.className = 'list-group-item';
            li.textContent = msg;
            chatHistory.appendChild(li);
        });
    }

    clearHistoryBtn.addEventListener('click', () => {
        chatMessages = [];
        renderChatHistory();
    });

    // Init
    renderDocs();
    renderChatHistory();

});