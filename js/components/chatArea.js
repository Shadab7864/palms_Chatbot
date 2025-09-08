function initChatArea() {
    const chatContainer = document.getElementById("chatBubbleContainer");
    const chatArea = document.getElementById("chatArea");

    if (!chatContainer || !chatArea) return;

    /**
     * Append a new message to the chat area.
     * @param {string} msg - Message text
     * @param {string} sender - "user" or "bot"
     */
    window.addMessageToChat = (msg, sender = "user") => {
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${sender}`;
        bubble.textContent = msg;

        chatContainer.appendChild(bubble);

        // Smooth scroll to bottom
        chatArea.scrollTo({
            top: chatArea.scrollHeight,
            behavior: "smooth"
        });
    };
}

document.addEventListener("DOMContentLoaded", initChatArea);
