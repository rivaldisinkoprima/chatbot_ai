const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const typingIndicator = document.getElementById('typing-indicator');
const clearBtn = document.getElementById('clear-chat');
const sendBtn = document.getElementById('send-btn');
const emojiBtn = document.getElementById('emoji-btn');

const userAvatarIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>`;
const botAvatarIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;

let messageCount = 0;

input.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  
  const charCount = document.querySelector('.char-count');
  if (this.value.length > 0) {
    charCount.textContent = this.value.length;
    charCount.classList.add('visible');
  } else {
    charCount.classList.remove('visible');
  }
});

input.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});

form.addEventListener('submit', async function(e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  hideWelcomeMessage();
  sendBtn.disabled = true;
  
  appendMessage('user', userMessage);
  input.value = '';
  input.style.height = 'auto';
  document.querySelector('.char-count').classList.remove('visible');

  showTypingIndicator();
  scrollToBottom();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    });

    const data = await response.json();
    hideTypingIndicator();

    if (data.reply) {
      appendMessage('bot', data.reply);
    } else if (data.error) {
      appendMessage('bot', `Error: ${data.error}`);
    }
  } catch (error) {
    hideTypingIndicator();
    appendMessage('bot', 'Failed to connect to server. Please try again.');
    console.error('Error:', error);
  }

  sendBtn.disabled = false;
  input.focus();
});

clearBtn.addEventListener('click', function() {
  if (messageCount === 0) return;
  
  if (confirm('Are you sure you want to clear all messages?')) {
    chatBox.innerHTML = `
      <div class="welcome-message">
        <div class="bot-avatar-large">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7V5.73C5.4 5.39 5 4.74 5 4a2 2 0 0 1 2-2h5z"/>
          </svg>
        </div>
        <h2>Welcome to Zodiak AI! ✨</h2>
        <p>Start a conversation by typing a message below.</p>
      </div>
    `;
    messageCount = 0;
  }
});

function hideWelcomeMessage() {
  const welcomeMsg = chatBox.querySelector('.welcome-message');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }
}

function parseMarkdown(text) {
  if (!text) return '';
  
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
  
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
  
  html = html.replace(/\n\n/g, '<br><br>');
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

function appendMessage(sender, text) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', sender);
  messageEl.setAttribute('role', sender === 'user' ? 'status' : 'log');
  
  const avatarClass = sender === 'user' ? 'user' : 'bot';
  const avatarIcon = sender === 'user' ? userAvatarIcon : botAvatarIcon;
  const time = getCurrentTime();
  const parsedText = sender === 'user' ? text : parseMarkdown(text);
  
  messageEl.innerHTML = `
    <div class="avatar">
      ${avatarIcon}
    </div>
    <div class="message-content">
      <div class="message-bubble">
        <div class="message-actions">
          <button class="message-action-btn copy-btn" aria-label="Copy message" title="Copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
        ${parsedText}
      </div>
      <div class="timestamp">${time}</div>
    </div>
  `;

  const copyBtn = messageEl.querySelector('.copy-btn');
  copyBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    copyToClipboard(text);
    showCopyFeedback(copyBtn);
  });

  chatBox.appendChild(messageEl);
  messageCount++;
  scrollToBottom();
  
  return messageEl;
}

function showTypingIndicator() {
  typingIndicator.classList.remove('hidden');
  chatBox.appendChild(typingIndicator);
  scrollToBottom();
}

function hideTypingIndicator() {
  typingIndicator.classList.add('hidden');
}

function scrollToBottom() {
  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: 'smooth'
  });
}

function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
    }
  }
  
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (err) {
    document.body.removeChild(textarea);
    return false;
  }
}

function showCopyFeedback(btn) {
  const originalHTML = btn.innerHTML;
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
  btn.style.color = '#22c55e';
  
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.style.color = '';
  }, 1500);
}

input.focus();
