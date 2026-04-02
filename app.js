const BASE_URL = "https://piratelike-asynchronously-ila.ngrok-free.dev/v1";
const FALLBACK_MODEL = "openai/gpt-oss-20b";
const THEME_STORAGE_KEY = "nathan-pc-theme";
const UNLOCK_STORAGE_KEY = "nathan-pc-unlocked";
const STYLE_STORAGE_KEY = "nathan-pc-style";
const DEFAULT_THEME = "current";
const AVAILABLE_THEMES = new Set(["current", "spacy", "liquid-glass", "neon-riot", "volcanic", "midnight-terminal", "candy-pop", "chatgpt", "claude", "gemini", "grok"]);
const PASSWORD_TO_PROFILE = {
  knox: { id: "nathan", name: "Nathan" },
  max: { id: "lucas", name: "Lucas" },
};
const PROFILE_STORAGE_KEY = "nathan-pc-profile-v1";
const DEFAULT_PROFILE_ID = "nathan";
const PROFILE_ID_TO_INFO = {
  nathan: { id: "nathan", name: "Nathan" },
  lucas: { id: "lucas", name: "Lucas" },
};
const MESSAGES_STORAGE_KEY_PREFIX = "nathan-pc-messages-v1:";
const STYLE_PROMPTS = {
  helpful: "You are Nathan's PC, a helpful assistant running through LM Studio on Nathan's computer. Keep your answers practical, friendly, and concise unless the user asks for more depth.",
  funny: "You are Nathan's PC, a witty and playful assistant running through LM Studio on Nathan's computer. Be funny in a light, friendly way, but still answer the user's request clearly and helpfully. Do not turn serious topics into jokes.",
  concise: "You are Nathan's PC, a concise assistant running through LM Studio on Nathan's computer. Give short, direct, useful answers with minimal fluff unless the user explicitly asks for more detail.",
  teacher: "You are Nathan's PC, a patient teaching assistant running through LM Studio on Nathan's computer. Explain things clearly, use simple examples when helpful, and help the user understand the why behind the answer.",
  coder: "You are Nathan's PC, a coding-focused assistant running through LM Studio on Nathan's computer. Prioritize debugging, implementation details, code examples, and practical developer guidance.",
};
const DEFAULT_STYLE = "helpful";
const MAX_STORED_MESSAGES = 60; // cap storage to avoid growing forever

const state = {
  profileId: DEFAULT_PROFILE_ID,
  userName: PROFILE_ID_TO_INFO[DEFAULT_PROFILE_ID]?.name || "Nathan",
  messages: [
    {
      role: "assistant",
      content: "Nathan's PC is online. Ask me anything about code, writing, or what this machine can help with.",
    },
  ],
  model: FALLBACK_MODEL,
  isSending: false,
  theme: DEFAULT_THEME,
  isUnlocked: false,
  style: DEFAULT_STYLE,
  autoScroll: true,
};

const appShell = document.querySelector("#app-shell");
const chatLog = document.querySelector("#chat-log");
const chatForm = document.querySelector("#chat-form");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const modelSelect = document.querySelector("#model-select");
const themeSelect = document.querySelector("#theme-select");
const styleSelect = document.querySelector("#style-select");
const statusText = document.querySelector("#status-text");
const clearChatButton = document.querySelector("#clear-chat");
const signOutButton = document.querySelector("#sign-out");
const promptButtons = document.querySelectorAll(".prompt-chip");
const unlockForm = document.querySelector("#unlock-form");
const passwordInput = document.querySelector("#password-input");
const unlockError = document.querySelector("#unlock-error");
const assistantTitle = document.querySelector("#assistant-title");
const assistantSubtitle = document.querySelector("#assistant-subtitle");
const chatTitle = document.querySelector("#chat-title");
const messageLabel = document.querySelector("#message-label");
const userBadge = document.querySelector("#user-badge");

if (window.marked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

if (chatLog) {
  chatLog.addEventListener("scroll", () => {
    state.autoScroll = isUserNearBottom();
  });
}

function setStatus(message) {
  statusText.textContent = message;
}

function getAssistantDisplayName() {
  return "Nathan's PC";
}

function getMessagesStorageKey(profileId) {
  return `${MESSAGES_STORAGE_KEY_PREFIX}${profileId}`;
}

function loadSavedProfileId() {
  try {
    return sessionStorage.getItem(PROFILE_STORAGE_KEY) || DEFAULT_PROFILE_ID;
  } catch (error) {
    console.error("Unable to read saved profile", error);
    return DEFAULT_PROFILE_ID;
  }
}

function applyProfile(profileId) {
  const profileInfo = PROFILE_ID_TO_INFO[profileId] || PROFILE_ID_TO_INFO[DEFAULT_PROFILE_ID];

  state.profileId = profileInfo.id;
  state.userName = profileInfo.name;

  document.title = getAssistantDisplayName();
  if (assistantTitle) {
    assistantTitle.textContent = getAssistantDisplayName();
  }
  if (assistantSubtitle) {
    assistantSubtitle.textContent = "A simple ChatGPT-style front end pointed at Nathan's LM Studio server.";
  }
  if (chatTitle) {
    chatTitle.textContent = `Talk to ${getAssistantDisplayName()}`;
  }
  if (messageLabel) {
    messageLabel.textContent = `Message ${getAssistantDisplayName()}`;
  }
  if (messageInput) {
    messageInput.placeholder = `Message ${getAssistantDisplayName()}...`;
  }
  if (userBadge) {
    userBadge.textContent = `Signed in as ${state.userName}`;
  }
}

function sanitizeLoadedMessages(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const cleaned = value
    .map((message) => {
      const role = message?.role;
      const content = typeof message?.content === "string" ? message.content : "";
      return { role, content };
    })
    .filter((message) => (message.role === "user" || message.role === "assistant") && typeof message.content === "string" && message.content.trim().length > 0);

  if (!cleaned.length) {
    return null;
  }

  // Keep the most recent messages
  return cleaned.slice(-MAX_STORED_MESSAGES);
}

function loadSavedMessages(profileId) {
  try {
    const raw = localStorage.getItem(getMessagesStorageKey(profileId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return sanitizeLoadedMessages(parsed);
  } catch (error) {
    console.error("Unable to load saved chat messages", error);
    return null;
  }
}

function saveMessagesToStorage() {
  try {
    if (!state.profileId) {
      return;
    }
    const toStore = state.messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(getMessagesStorageKey(state.profileId), JSON.stringify(toStore));
  } catch (error) {
    // Storage can fail (private mode, quota, etc). Don't break chat.
    console.error("Unable to save chat messages", error);
  }
}

function loadUnlockState() {
  try {
    return sessionStorage.getItem(UNLOCK_STORAGE_KEY) === "true";
  } catch (error) {
    console.error("Unable to read unlock state", error);
    return false;
  }
}

function setUnlockState(isUnlocked) {
  state.isUnlocked = isUnlocked;
  document.body.dataset.locked = isUnlocked ? "false" : "true";
  appShell.setAttribute("aria-hidden", String(!isUnlocked));

  try {
    sessionStorage.setItem(UNLOCK_STORAGE_KEY, String(isUnlocked));
  } catch (error) {
    console.error("Unable to save unlock state", error);
  }

  if (isUnlocked) {
    unlockError.textContent = "";
    passwordInput.value = "";
    loadModels();

    const savedMessages = loadSavedMessages(state.profileId);
    state.messages =
      savedMessages ||
      [
        {
          role: "assistant",
          content: `${getAssistantDisplayName()} is online. Ask me anything about code, writing, or what this machine can help with.`,
        },
      ];
    renderMessages();

    messageInput.focus();
  } else {
    passwordInput.focus();
  }
}

function loadSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
  } catch (error) {
    console.error("Unable to read theme preference", error);
    return DEFAULT_THEME;
  }
}

function loadSavedStyle() {
  try {
    return localStorage.getItem(STYLE_STORAGE_KEY) || DEFAULT_STYLE;
  } catch (error) {
    console.error("Unable to read style preference", error);
    return DEFAULT_STYLE;
  }
}

function applyStyle(styleName) {
  const nextStyle = Object.hasOwn(STYLE_PROMPTS, styleName) ? styleName : DEFAULT_STYLE;
  state.style = nextStyle;

  if (styleSelect.value !== nextStyle) {
    styleSelect.value = nextStyle;
  }

  try {
    localStorage.setItem(STYLE_STORAGE_KEY, nextStyle);
  } catch (error) {
    console.error("Unable to save style preference", error);
  }
}

function getSystemPrompt() {
  const base = STYLE_PROMPTS[state.style] || STYLE_PROMPTS[DEFAULT_STYLE];
  return `${base}\n\nThe current user is ${state.userName || "Nathan"}. Address requests with that in mind, but keep the assistant identity as Nathan's PC.`;
}

function applyTheme(themeName) {
  const nextTheme = AVAILABLE_THEMES.has(themeName) ? themeName : DEFAULT_THEME;
  state.theme = nextTheme;
  document.body.dataset.theme = nextTheme;

  if (themeSelect.value !== nextTheme) {
    themeSelect.value = nextTheme;
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    console.error("Unable to save theme preference", error);
  }
}

function resizeComposer() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 220)}px`;
}

function scrollChatToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
}

function isUserNearBottom() {
  // If the user has scrolled up, don't force the chat back to the bottom.
  const distanceFromBottom = chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight;
  return distanceFromBottom <= 120;
}

function markdownToHtml(markdown) {
  if (!window.marked || !window.DOMPurify) {
    return escapeHtml(markdown).replace(/\n/g, "<br>");
  }

  const rawHtml = window.marked.parse(markdown || "");
  return window.DOMPurify.sanitize(rawHtml);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMessageBody(body, role, content) {
  body.className = "message-body";

  if (role === "assistant") {
    body.classList.add("markdown");
    body.innerHTML = markdownToHtml(content);
    return;
  }

  body.classList.add("plain-text");
  body.textContent = content;
}

function createMessageElement(role, content, options = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  if (options.typing) {
    article.classList.add("typing");
  }

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "assistant" ? getAssistantDisplayName() : state.userName;

  const body = document.createElement("div");
  renderMessageBody(body, role, content);

  article.append(label, body);
  return article;
}

function renderMessages() {
  const prevScrollTop = chatLog.scrollTop;
  const prevScrollHeight = chatLog.scrollHeight;
  const prevClientHeight = chatLog.clientHeight;
  const shouldStickToBottom = state.autoScroll;
  chatLog.innerHTML = "";
  for (const message of state.messages) {
    chatLog.appendChild(createMessageElement(message.role, message.content));
  }
  if (shouldStickToBottom) {
    scrollChatToBottom();
    return;
  }

  // Preserve relative scroll position when re-rendering.
  try {
    const prevScrollable = prevScrollHeight - prevClientHeight;
    const ratio = prevScrollable > 0 ? prevScrollTop / prevScrollable : 0;
    const nextScrollable = chatLog.scrollHeight - prevClientHeight;
    chatLog.scrollTop = Math.max(0, ratio * nextScrollable);
  } catch {
    // If anything goes wrong, fall back to default browser behavior.
  }
}

function appendStreamingMessage() {
  const messageElement = createMessageElement("assistant", "");
  messageElement.id = "streaming-message";
  chatLog.appendChild(messageElement);
  if (state.autoScroll) {
    scrollChatToBottom();
  }
  return messageElement.querySelector(".message-body");
}

function updateStreamingMessage(body, content) {
  renderMessageBody(body, "assistant", content || " ");
  if (state.autoScroll) {
    scrollChatToBottom();
  }
}

function setSending(isSending) {
  state.isSending = isSending;
  sendButton.disabled = isSending;
  modelSelect.disabled = isSending;
  messageInput.disabled = isSending;
}

function normalizeContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

async function loadModels() {
  setStatus("Loading models...");
  modelSelect.innerHTML = "<option>Loading models...</option>";

  try {
    const response = await fetch(`${BASE_URL}/models`, {
      headers: {
        Authorization: "Bearer lmstudio",
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      throw new Error(`Model request failed with ${response.status}`);
    }

    const payload = await response.json();
    const models = Array.isArray(payload.data) ? payload.data.map((entry) => entry.id) : [];
    const uniqueModels = [...new Set(models)].filter(Boolean);

    if (!uniqueModels.length) {
      throw new Error("No models returned by the server.");
    }

    modelSelect.innerHTML = "";
    uniqueModels.forEach((modelId) => {
      const option = document.createElement("option");
      option.value = modelId;
      option.textContent = modelId;
      modelSelect.appendChild(option);
    });

    state.model = uniqueModels.includes(FALLBACK_MODEL) ? FALLBACK_MODEL : uniqueModels[0];
    modelSelect.value = state.model;
    setStatus(`Ready with ${uniqueModels.length} available model${uniqueModels.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error(error);
    modelSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = FALLBACK_MODEL;
    option.textContent = `${FALLBACK_MODEL} (fallback)`;
    modelSelect.appendChild(option);
    state.model = FALLBACK_MODEL;
    modelSelect.value = FALLBACK_MODEL;
    setStatus("Using fallback model. The models list could not be loaded.");
  }
}

async function readStreamingChat(response, onContent) {
  const contentType = response.headers.get("content-type") || "";

  if (!response.body || !contentType.includes("text/event-stream")) {
    const payload = await response.json();
    const fullContent = normalizeContent(payload.choices?.[0]?.message?.content);
    if (fullContent) {
      onContent(fullContent);
    }
    return fullContent;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const lines = event.split("\n").filter((line) => line.startsWith("data: "));
      for (const line of lines) {
        const data = line.slice(6).trim();

        if (!data || data === "[DONE]") {
          continue;
        }

        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (error) {
          console.error("Unable to parse stream payload", error, data);
          continue;
        }

        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onContent(fullContent);
        }
      }
    }
  }

  if (buffer.trim()) {
    const trailingEvents = buffer.split("\n").filter((line) => line.startsWith("data: "));
    for (const line of trailingEvents) {
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") {
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onContent(fullContent);
        }
      } catch (error) {
        console.error("Unable to parse final stream payload", error, data);
      }
    }
  }

  return fullContent;
}

async function sendMessage(messageText) {
  if (state.isSending) {
    return;
  }

  const trimmed = messageText.trim();
  if (!trimmed) {
    return;
  }

  state.messages.push({ role: "user", content: trimmed });
  renderMessages();
  saveMessagesToStorage();
  setSending(true);
  setStatus(`Streaming from ${state.model}...`);

  const streamingBody = appendStreamingMessage();

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer lmstudio",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        model: state.model,
        stream: true,
        messages: [
          { role: "system", content: getSystemPrompt() },
          ...state.messages,
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Chat request failed with ${response.status}`);
    }

    const assistantMessage = await readStreamingChat(response, (partialContent) => {
      updateStreamingMessage(streamingBody, partialContent);
    });

    state.messages.push({
      role: "assistant",
      content: assistantMessage || `${getAssistantDisplayName()} did not return any text.`,
    });
    saveMessagesToStorage();
    setStatus(`Connected to ${state.model}.`);
  } catch (error) {
    console.error(error);
    state.messages.push({
      role: "assistant",
      content: `I hit a connection problem while talking to ${getAssistantDisplayName()}.\n\n${error.message || "Unknown error"}`,
    });
    saveMessagesToStorage();
    setStatus("Connection issue. Check the LM Studio tunnel and try again.");
  } finally {
    document.querySelector("#streaming-message")?.remove();
    renderMessages();
    setSending(false);
    messageInput.focus();
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextMessage = messageInput.value;
  messageInput.value = "";
  resizeComposer();
  await sendMessage(nextMessage);
});

messageInput.addEventListener("input", resizeComposer);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

modelSelect.addEventListener("change", () => {
  state.model = modelSelect.value;
  setStatus(`Connected to ${state.model}.`);
});

themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
});

styleSelect.addEventListener("change", () => {
  applyStyle(styleSelect.value);
});

clearChatButton.addEventListener("click", () => {
  state.messages = [
    {
      role: "assistant",
      content: `Fresh session started. ${getAssistantDisplayName()} is ready when you are.`,
    },
  ];

  saveMessagesToStorage();
  renderMessages();
  setStatus(`Connected to ${state.model}.`);
  messageInput.focus();
});

promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    messageInput.value = button.dataset.prompt || "";
    resizeComposer();
    messageInput.focus();
  });
});

unlockForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const attemptedPassword = passwordInput.value.trim().toLowerCase();
  const profile = PASSWORD_TO_PROFILE[attemptedPassword];

  if (profile) {
    applyProfile(profile.id);
    try {
      sessionStorage.setItem(PROFILE_STORAGE_KEY, profile.id);
    } catch (error) {
      console.error("Unable to save profile selection", error);
    }
    setUnlockState(true);
    return;
  }

  unlockError.textContent = "Incorrect password. Try again.";
  passwordInput.select();
});

if (signOutButton) {
  signOutButton.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(PROFILE_STORAGE_KEY);
    } catch {
      // ignore
    }
    applyProfile(DEFAULT_PROFILE_ID);
    setUnlockState(false);
    messageInput.value = "";
    unlockError.textContent = "";
  });
}

applyProfile(loadSavedProfileId());
renderMessages();
resizeComposer();
applyTheme(loadSavedTheme());
applyStyle(loadSavedStyle());
setUnlockState(loadUnlockState());
