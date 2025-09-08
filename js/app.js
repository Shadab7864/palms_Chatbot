/**
 * Dynamically load a component with HTML, JS, CSS, and optional init callback.
 */
function loadComponent({ htmlPath, jsPath, cssPath, containerId, initCallback }) {
    fetch(htmlPath)
        .then(res => res.text())
        .then(html => {
            const container = document.getElementById(containerId);
            if (!container) throw new Error(`Container #${containerId} not found`);
            container.innerHTML = html;

            // Load CSS
            if (cssPath) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = cssPath;
                document.head.appendChild(link);
            }

            // Load JS
            if (jsPath) {
                const script = document.createElement("script");
                script.src = jsPath;
                script.onload = () => {
                    if (typeof initCallback === "function") initCallback();
                };
                document.body.appendChild(script);
            } else {
                if (typeof initCallback === "function") initCallback();
            }
        })
        .catch(err => console.error(`Error loading component ${containerId}:`, err));
}

// ====================
// Load Left Strip
// ====================
loadComponent({
    htmlPath: "./components/leftStrip.html",
    jsPath: "./js/components/leftStrip.js",
    cssPath: "./css/components/leftStrip.css",
    containerId: "leftStripContainer",
    initCallback: () => {
        if (window.initLeftStrip) window.initLeftStrip();

        // Theme toggle
        const themeToggleBtn = document.getElementById("themeToggleBtn");
        const themeToggleIcon = document.getElementById("themeToggleIcon");

        themeToggleBtn.addEventListener("click", () => {
            document.body.classList.toggle("light-theme");

            if (document.body.classList.contains("light-theme")) {
                themeToggleIcon.src = "./assests/darkMode.png";
            } else {
                themeToggleIcon.src = "./assests/lightMode.png";
            }
        });
    }
});

// ====================
// Load Chat Area first
// ====================
loadComponent({
    htmlPath: "./components/chatArea.html",
    jsPath: "./js/components/chatArea.js",
    cssPath: "./css/components/chatArea.css",
    containerId: "chatArea",
    initCallback: () => {
        if (window.initChatArea) window.initChatArea();

        // ====================
        // Load Text Area next
        // ====================
        loadComponent({
            htmlPath: "./components/textArea.html",
            jsPath: "./js/components/textArea.js",
            cssPath: "./css/components/textArea.css",
            containerId: "textAreaContainer",
            initCallback: () => {
                if (window.initTextArea) {
                    window.initTextArea((msg, sender) => {
                        const chatContainer = document.getElementById("chatBubbleContainer");
                        if (!chatContainer) return;

                        // Append message
                        const bubble = document.createElement("div");
                        bubble.className = `chat-bubble ${sender}`;
                        bubble.textContent = msg;
                        chatContainer.appendChild(bubble);

                        // Scroll chat to bottom
                        const chatArea = document.getElementById("chatArea");
                        chatArea.scrollTop = chatArea.scrollHeight;

                        // Move input to bottom
                        const textAreaWrapper = document.getElementById("textAreaWrapper");
                        textAreaWrapper?.classList.add("bottom");

                        // Hide welcome message
                        const messageContainer = document.getElementById("message-container");
                        messageContainer?.classList.add("hidden");
                    });
                }
            }
        });
    }
});

// Loading Models
document.addEventListener("DOMContentLoaded", () => {
    const dropdownLabel = document.getElementById("dropdown-label");
    const dropdownOptions = document.getElementById("dropdown-options");
    const selectedModelSpan = document.getElementById("selected-model");
    const modelSelectInput = document.getElementById("model-select");

    // Toggle dropdown visibility
    dropdownLabel.addEventListener("click", () => {
        dropdownOptions.classList.toggle("d-none");
    });

    // Handle selection of a model
    dropdownOptions.querySelectorAll("li").forEach(item => {
        item.addEventListener("click", () => {
            const value = item.dataset.value;
            const text = item.textContent;

            selectedModelSpan.textContent = text;
            modelSelectInput.value = value;

            // Hide dropdown after selection
            dropdownOptions.classList.add("d-none");
        });
    });

    // Optional: click outside closes dropdown
    document.addEventListener("click", (e) => {
        if (!dropdownLabel.contains(e.target) && !dropdownOptions.contains(e.target)) {
            dropdownOptions.classList.add("d-none");
        }
    });
});
