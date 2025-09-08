function initChat() {
  // Load Message Area
  fetch('./components/messageArea.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('messageAreaContainer').innerHTML = data;

      // attach messageArea.js
      const msgScript = document.createElement("script");
      msgScript.src = "./js/components/messageArea.js";
      document.body.appendChild(msgScript);

      // attach messageArea.css
      const msgCSS = document.createElement("link");
      msgCSS.rel = "stylesheet";
      msgCSS.href = "./css/components/messageArea.css";
      document.head.appendChild(msgCSS);
    });

  // Load Chat Bubble
  fetch('./components/chatBubble.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('chatBubbleContainer').innerHTML = data;

      const bubbleScript = document.createElement("script");
      bubbleScript.src = "./js/components/chatBubble.js";
      document.body.appendChild(bubbleScript);

      const bubbleCSS = document.createElement("link");
      bubbleCSS.rel = "stylesheet";
      bubbleCSS.href = "./css/components/chatBubble.css";
      document.head.appendChild(bubbleCSS);
    });

  // Load Text Area
  fetch('./components/textArea.html')
    .then(res => res.text())
    .then(data => {
      document.getElementById('textAreaContainer').innerHTML = data;

      const textScript = document.createElement("script");
      textScript.src = "./js/components/textArea.js";
      textScript.onload = () => {
        window.initTextArea(); // expose in textArea.js
      };
      document.body.appendChild(textScript);

      const textCSS = document.createElement("link");
      textCSS.rel = "stylesheet";
      textCSS.href = "./css/components/textArea.css";
      document.head.appendChild(textCSS);
    });

  // Title hide + textarea bottom logic
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "sendBtn") {
      const chatTitle = document.getElementById("chatTitle");
      const textAreaContainer = document.getElementById("textAreaContainer");

      chatTitle.style.display = "none"; // hide title
      textAreaContainer.classList.add("fixed-bottom"); // stick to bottom
    }
  });
}

window.initChat = initChat;
