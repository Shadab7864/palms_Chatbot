function initLeftStrip() {
    const leftStrip = document.getElementById('leftStrip');
    const logo = document.getElementById('leftStripLogo');

    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const uploadBox = document.getElementById('uploadBox');
    const docList = document.getElementById('docList');

    const refreshBtn = document.getElementById('refreshBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    const chatHistory = document.getElementById('chatHistory');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    // Initial state: disable delete button
    deleteBtn.disabled = true;

    // Toggle sidebar
    logo.addEventListener('click', () => {
        leftStrip.classList.toggle('collapsed');
        const transitionDuration = parseFloat(getComputedStyle(leftStrip).transitionDuration) || 0.3;
        setTimeout(adjustFooter, transitionDuration * 1000 + 10);
    });

    // Resize footer
    function adjustFooter() {
        const leftStripContainer = document.getElementById("leftStripContainer");
        const footer = document.getElementById("footerBar");
        const leftWidth = leftStripContainer ? leftStripContainer.getBoundingClientRect().width : 0;
        footer.style.left = leftWidth + "px";
        footer.style.width = `calc(100% - ${leftWidth}px)`;
    }

    let uploadedFiles = [];
    let chatMessages = [];

    // Expose render functions globally for theme toggle
    window.renderDocs = renderDocs;
    window.renderChatHistory = renderChatHistory;

    // Browse button → open file picker
    browseBtn.addEventListener('click', () => fileInput.click());

    // Handle file selection
    fileInput.addEventListener('change', () => {
        addFiles([...fileInput.files]);
    });

    // Drag & Drop
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
        files.forEach(file => uploadedFiles.push({ name: file.name, selected: false }));
        renderDocs();
        updateDeleteBtnState();
    }

    // Enable/disable Delete button based on selection
    function updateDeleteBtnState() {
        const hasSelected = uploadedFiles.some(file => file.selected);
        deleteBtn.disabled = !hasSelected;
    }

    // Render document list
    function renderDocs() {
        docList.innerHTML = '';

        if (uploadedFiles.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item dynamic-li d-flex justify-content-between align-items-center';
            li.textContent = 'No documents uploaded.';
            docList.appendChild(li);
            return;
        }

        uploadedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item dynamic-li d-flex justify-content-between align-items-center';
            li.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <input type="checkbox" class="form-check-input file-check" data-index="${index}" ${file.selected ? 'checked' : ''}>
                    <span>${file.name}</span>
                </div>
                <button class="btn btn-sm btn-outline-danger btn-delete" data-index="${index}"> X </button>
            `;

            // Checkbox toggle
            li.querySelector('.file-check').addEventListener('change', (e) => {
                uploadedFiles[index].selected = e.target.checked;
                updateDeleteBtnState();
            });

            // Individual delete
            li.querySelector('.btn-delete').addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-index');
                uploadedFiles.splice(idx, 1);
                renderDocs();
                updateDeleteBtnState();
            });

            docList.appendChild(li);
        });

        updateDeleteBtnState();
    }

    // Render chat history
    function renderChatHistory() {
        chatHistory.innerHTML = '';

        if (chatMessages.length === 0) {
            const li = document.createElement('li');
            li.className = 'list-group-item dynamic-li';
            li.textContent = 'No chat history yet.';
            chatHistory.appendChild(li);
            return;
        }

        chatMessages.forEach(msg => {
            const li = document.createElement('li');
            li.className = 'list-group-item dynamic-li';
            li.textContent = msg;
            chatHistory.appendChild(li);
        });
    }

    // Button actions
    refreshBtn.addEventListener('click', renderDocs);

    selectAllBtn.addEventListener('click', () => {
        uploadedFiles.forEach(file => file.selected = true);
        renderDocs();
        updateDeleteBtnState();
    });

    deleteBtn.addEventListener('click', () => {
        uploadedFiles = uploadedFiles.filter(file => !file.selected);
        renderDocs();
        updateDeleteBtnState();
    });

    clearHistoryBtn.addEventListener('click', () => {
        chatMessages = [];
        renderChatHistory();
    });

    // Initial render
    renderDocs();
    renderChatHistory();
    document.addEventListener("DOMContentLoaded", adjustFooter);

    // Responsive footer
    window.addEventListener("resize", adjustFooter);
}

window.initLeftStrip = initLeftStrip;
