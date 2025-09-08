function initChatBubble() {
    const chatHistory = document.getElementById("chatHistory");

    function addMessage(text, sender = "user") {
        const li = document.createElement("li");
        li.className = "list-group-item";
        li.textContent = sender === "user" ? `You: ${text}` : `Bot: ${text}`;
        chatHistory.appendChild(li);

        // Auto scroll to bottom
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function botReply(userMsg) {
        // Simple fake bot logic for now
        let reply;
        if (userMsg.toLowerCase().includes("hello")) {
            reply = "Hi there 👋 How can I help you?";
        } else if (userMsg.toLowerCase().includes("bye")) {
            reply = "Goodbye! 👋 Take care.";
        } else {
            reply = "I’m here to assist you!";
        }

        setTimeout(() => addMessage(reply, "bot"), 800); // small delay
    }

    return { addMessage, botReply };
}

window.initChatBubble = initChatBubble;
