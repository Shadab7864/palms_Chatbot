function initTextArea(sendMessageCallback) {
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-button");
  const messageContainer = document.getElementById("message-container");

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    if (messageContainer) {
      messageContainer.remove();
    }

    // Move input box to bottom after first send
    if (textAreaWrapper && !textAreaWrapper.classList.contains("bottom")) {
      textAreaWrapper.classList.add("bottom");
    }

    // Call the chat area callback
    if (typeof sendMessageCallback === "function") {
      sendMessageCallback(text, "user");
    }

    input.value = "";
    input.focus();

    // Optional: simulate bot reply
    setTimeout(() => {
      if (typeof sendMessageCallback === "function") {
        sendMessageCallback("This is a bot reply.", "bot");
      }
    }, 500);
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
}

window.initTextArea = initTextArea;
