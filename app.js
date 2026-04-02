const BASE_URL = "https://piratelike-asynchronously-ila.ngrok-free.dev/v1";
const FALLBACK_MODEL = "openai/gpt-oss-20b";
const THEME_STORAGE_KEY = "nathan-pc-theme";
const UNLOCK_STORAGE_KEY = "nathan-pc-unlocked";
const STYLE_STORAGE_KEY = "nathan-pc-style";
const REASONING_STORAGE_KEY = "nathan-pc-reasoning";
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
const CONVERSATIONS_STORAGE_KEY_PREFIX = "nathan-pc-convos-v1:";
const STYLE_PROMPTS = {
  helpful: "You are Nathan's PC, a helpful assistant running through LM Studio on Nathan's computer. Keep your answers practical, friendly, and concise unless the user asks for more depth.",
  funny: "You are Nathan's PC, a witty and playful assistant running through LM Studio on Nathan's computer. Be funny in a light, friendly way, but still answer the user's request clearly and helpfully. Do not turn serious topics into jokes.",
  concise: "You are Nathan's PC, a concise assistant running through LM Studio on Nathan's computer. Give short, direct, useful answers with minimal fluff unless the user explicitly asks for more detail.",
  teacher: "You are Nathan's PC, a patient teaching assistant running through LM Studio on Nathan's computer. Explain things clearly, use simple examples when helpful, and help the user understand the why behind the answer.",
  coder: "You are Nathan's PC, a coding-focused assistant running through LM Studio on Nathan's computer. Prioritize debugging, implementation details, code examples, and practical developer guidance.",
};
const DEFAULT_STYLE = "helpful";
const DEFAULT_REASONING = "off";
const REASONING_SYSTEM_ADDITIONS = {
  off: "",
  low: " Before answering, take a brief moment to think — one or two sentences of internal reasoning is enough.",
  medium: " Think step by step before answering. Work through the problem methodically, then give your answer.",
  high: " Think very deeply and carefully before answering. Consider multiple angles, potential edge cases, and alternative interpretations. Reason through the problem thoroughly before giving your final answer.",
};
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
  conversationId: null,
  conversations: [],
  searchEnabled: false,
  reasoning: DEFAULT_REASONING,
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
const newChatButton = document.querySelector("#new-chat");
const searchToggleButton = document.querySelector("#search-toggle");
const reasoningSelect = document.querySelector("#reasoning-select");
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


function setStatus(message) {
  statusText.textContent = message;
}

function getAssistantDisplayName() {
  return "Nathan's PC";
}

function getMessagesStorageKey(profileId, conversationId) {
  if (conversationId) {
    return `${MESSAGES_STORAGE_KEY_PREFIX}${profileId}:${conversationId}`;
  }
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
    if (!state.profileId || !state.conversationId) {
      return;
    }
    const toStore = state.messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(getMessagesStorageKey(state.profileId, state.conversationId), JSON.stringify(toStore));
    const convo = state.conversations.find(c => c.id === state.conversationId);
    if (convo) {
      convo.updatedAt = Date.now();
    }
  } catch (error) {
    console.error("Unable to save chat messages", error);
  }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getConversationsStorageKey(profileId) {
  return `${CONVERSATIONS_STORAGE_KEY_PREFIX}${profileId}`;
}

function loadConversations(profileId) {
  try {
    const raw = localStorage.getItem(getConversationsStorageKey(profileId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) {
      return null;
    }
    return parsed.filter(c => c && typeof c.id === "string" && typeof c.title === "string");
  } catch (error) {
    console.error("Unable to load conversations", error);
    return null;
  }
}

function saveConversations() {
  try {
    localStorage.setItem(getConversationsStorageKey(state.profileId), JSON.stringify(state.conversations));
  } catch (error) {
    console.error("Unable to save conversations", error);
  }
}

function loadConversationMessages(profileId, conversationId) {
  try {
    const raw = localStorage.getItem(getMessagesStorageKey(profileId, conversationId));
    if (!raw) {
      return null;
    }
    return sanitizeLoadedMessages(JSON.parse(raw));
  } catch (error) {
    console.error("Unable to load conversation messages", error);
    return null;
  }
}

function createNewConversation(messages) {
  const id = generateId();
  const convo = { id, title: "New chat", updatedAt: Date.now() };
  state.conversations.unshift(convo);
  state.conversationId = id;
  state.messages = messages || [
    {
      role: "assistant",
      content: `${getAssistantDisplayName()} is online. Ask me anything about code, writing, or what this machine can help with.`,
    },
  ];
  saveConversations();
  saveMessagesToStorage();
  return id;
}

function autoTitleConversation() {
  const firstUser = state.messages.find(m => m.role === "user");
  if (!firstUser) {
    return;
  }
  const raw = firstUser.content.trim();
  const title = raw.length > 42 ? raw.slice(0, 42) + "\u2026" : raw;
  const convo = state.conversations.find(c => c.id === state.conversationId);
  if (convo && convo.title === "New chat") {
    convo.title = title;
    saveConversations();
    renderConversationList();
  }
}

function switchToConversation(convoId) {
  if (convoId === state.conversationId) {
    return;
  }
  saveMessagesToStorage();
  state.conversationId = convoId;
  const msgs = loadConversationMessages(state.profileId, convoId);
  state.messages = msgs || [
    {
      role: "assistant",
      content: `${getAssistantDisplayName()} is online. Ask me anything about code, writing, or what this machine can help with.`,
    },
  ];
  renderMessages(true);
  renderConversationList();
}

function deleteConversation(convoId) {
  try {
    localStorage.removeItem(getMessagesStorageKey(state.profileId, convoId));
  } catch (error) {
    console.error("Unable to delete conversation messages", error);
  }

  state.conversations = state.conversations.filter(c => c.id !== convoId);
  saveConversations();

  if (state.conversationId === convoId) {
    if (state.conversations.length) {
      state.conversationId = state.conversations[0].id;
      const msgs = loadConversationMessages(state.profileId, state.conversationId);
      state.messages = msgs || [
        {
          role: "assistant",
          content: `${getAssistantDisplayName()} is online. Ask me anything about code, writing, or what this machine can help with.`,
        },
      ];
      renderMessages(true);
    } else {
      createNewConversation();
      renderMessages(true);
    }
  }

  renderConversationList();
}

function renderConversationList() {
  const list = document.querySelector("#conversation-list");
  if (!list) {
    return;
  }
  list.innerHTML = "";

  for (const convo of state.conversations) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "convo-item" + (convo.id === state.conversationId ? " active" : "");

    const title = document.createElement("span");
    title.className = "convo-item-title";
    title.textContent = convo.title;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "convo-delete-btn";
    del.setAttribute("aria-label", "Delete conversation");
    del.textContent = "\u00d7";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(convo.id);
    });

    item.append(title, del);
    item.addEventListener("click", () => {
      switchToConversation(convo.id);
    });

    list.appendChild(item);
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

    const savedConvos = loadConversations(state.profileId);
    if (savedConvos && savedConvos.length) {
      state.conversations = savedConvos;
      state.conversationId = savedConvos[0].id;
      const msgs = loadConversationMessages(state.profileId, state.conversationId);
      state.messages = msgs || [
        {
          role: "assistant",
          content: `${getAssistantDisplayName()} is online. Ask me anything about code, writing, or what this machine can help with.`,
        },
      ];
    } else {
      // Migrate any legacy single-conversation messages into the new format
      const legacyMsgs = loadSavedMessages(state.profileId);
      state.conversations = [];
      state.conversationId = null;
      createNewConversation(legacyMsgs || undefined);
      if (legacyMsgs) {
        autoTitleConversation();
      }
    }

    renderConversationList();
    renderMessages(true);
    messageInput.focus();
  } else {
    state.conversations = [];
    state.conversationId = null;
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

function loadSavedReasoning() {
  try {
    return localStorage.getItem(REASONING_STORAGE_KEY) || DEFAULT_REASONING;
  } catch (error) {
    console.error("Unable to read reasoning preference", error);
    return DEFAULT_REASONING;
  }
}

function applyReasoning(level) {
  const next = Object.hasOwn(REASONING_SYSTEM_ADDITIONS, level) ? level : DEFAULT_REASONING;
  state.reasoning = next;

  if (reasoningSelect && reasoningSelect.value !== next) {
    reasoningSelect.value = next;
  }

  try {
    localStorage.setItem(REASONING_STORAGE_KEY, next);
  } catch (error) {
    console.error("Unable to save reasoning preference", error);
  }
}

function getSystemPrompt() {
  const base = STYLE_PROMPTS[state.style] || STYLE_PROMPTS[DEFAULT_STYLE];
  const reasoningNote = REASONING_SYSTEM_ADDITIONS[state.reasoning] || "";
  return `${base}${reasoningNote}\n\nThe current user is ${state.userName || "Nathan"}. Address requests with that in mind, but keep the assistant identity as Nathan's PC.`;
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

function isNearBottom(threshold = 80) {
  return chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < threshold;
}

function scrollChatToBottom() {
  chatLog.scrollTop = chatLog.scrollHeight;
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

function renderMessages(jumpToBottom = false) {
  const prevScrollTop = chatLog.scrollTop;
  chatLog.innerHTML = "";
  for (const message of state.messages) {
    chatLog.appendChild(createMessageElement(message.role, message.content));
  }
  if (jumpToBottom) {
    scrollChatToBottom();
  } else {
    chatLog.scrollTop = prevScrollTop;
  }
}

function appendStreamingMessage() {
  const messageElement = createMessageElement("assistant", "");
  messageElement.id = "streaming-message";
  chatLog.appendChild(messageElement);
  scrollChatToBottom();
  return messageElement.querySelector(".message-body");
}

function updateStreamingMessage(body, content) {
  const wasNearBottom = isNearBottom();
  renderMessageBody(body, "assistant", content || " ");
  if (wasNearBottom) {
    scrollChatToBottom();
  }
}

function setSending(isSending) {
  state.isSending = isSending;
  sendButton.disabled = isSending;
  modelSelect.disabled = isSending;
  messageInput.disabled = isSending;
  if (searchToggleButton) {
    searchToggleButton.disabled = isSending;
  }
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

function cleanHtml(text) {
  return (text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function fetchWikipedia(encodedQuery) {
  // Search for matching articles
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&origin=*&srlimit=4&srprop=snippet`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(7000) });
  if (!searchRes.ok) {
    return null;
  }
  const searchData = await searchRes.json();
  const hits = searchData?.query?.search || [];
  if (!hits.length) {
    return null;
  }

  // Fetch the full plain-text summary of the top article
  const topTitle = encodeURIComponent(hits[0].title);
  let fullSummary = "";
  try {
    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${topTitle}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (summaryRes.ok) {
      const s = await summaryRes.json();
      if (s.extract) {
        fullSummary = `${s.title}\n${s.extract.slice(0, 600)}`;
      }
    }
  } catch { /* non-fatal */ }

  const snippets = hits
    .slice(0, 4)
    .map(h => `• ${h.title}: ${cleanHtml(h.snippet)}`)
    .join("\n");

  return fullSummary ? `${fullSummary}\n\nRelated articles:\n${snippets}` : snippets;
}

async function fetchReddit(encodedQuery) {
  const url = `https://www.reddit.com/search.json?q=${encodedQuery}&sort=relevance&limit=6&type=link`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const posts = (data?.data?.children || []).filter(p => p.data && p.data.title);
  if (!posts.length) {
    return null;
  }

  return posts
    .slice(0, 5)
    .map(p => {
      const d = p.data;
      const score = d.score > 0 ? ` [${d.score} upvotes]` : "";
      const body = d.selftext ? ` — ${d.selftext.slice(0, 180).replace(/\n/g, " ")}` : "";
      return `• [${d.subreddit_name_prefixed}] ${d.title}${score}${body}`;
    })
    .join("\n");
}

async function fetchHackerNews(encodedQuery) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodedQuery}&hitsPerPage=5&tags=story`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  const hits = (data?.hits || []).filter(h => h.title);
  if (!hits.length) {
    return null;
  }

  return hits
    .slice(0, 5)
    .map(h => {
      const pts = h.points ? ` [${h.points} pts]` : "";
      const url = h.url ? ` — ${h.url}` : "";
      return `• ${h.title}${pts}${url}`;
    })
    .join("\n");
}

async function performWebSearch(query) {
  const encoded = encodeURIComponent(query);

  const [wikiResult, redditResult, hnResult] = await Promise.allSettled([
    fetchWikipedia(encoded),
    fetchReddit(encoded),
    fetchHackerNews(encoded),
  ]);

  const sections = [];
  const sources = [];

  if (wikiResult.status === "fulfilled" && wikiResult.value) {
    sections.push(`[WIKIPEDIA]\n${wikiResult.value}`);
    sources.push("Wikipedia");
  }
  if (redditResult.status === "fulfilled" && redditResult.value) {
    sections.push(`[REDDIT DISCUSSIONS]\n${redditResult.value}`);
    sources.push("Reddit");
  }
  if (hnResult.status === "fulfilled" && hnResult.value) {
    sections.push(`[HACKER NEWS]\n${hnResult.value}`);
    sources.push("HackerNews");
  }

  if (!sections.length) {
    return null;
  }

  return { context: sections.join("\n\n"), sources };
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
  renderMessages(true);
  saveMessagesToStorage();
  setSending(true);
  setStatus(`Streaming from ${state.model}...`);

  const streamingBody = appendStreamingMessage();

  try {
    let searchContext = "";
    if (state.searchEnabled) {
      setStatus("Searching the web...");
      try {
        const searchResult = await performWebSearch(trimmed);
        if (searchResult) {
          const sourceList = searchResult.sources.join(", ");
          setStatus(`Search found results from: ${sourceList}`);
          searchContext = `

══════════════════════════════════════
LIVE WEB SEARCH RESULTS
══════════════════════════════════════
A real-time web search was performed for the user's message.
Search query: "${trimmed}"
Sources searched: ${sourceList}

${searchResult.context}

══════════════════════════════════════
HOW YOU MUST USE THESE RESULTS:
- You MUST base your answer on the search results above — they are current, real data from the web.
- Mention which source(s) (Wikipedia, Reddit, HackerNews) the information comes from.
- If the search results directly answer the question, lead with that information.
- If results are only partially relevant, use what applies and say so.
- Do NOT ignore these results and answer only from training data when search data is available.
══════════════════════════════════════
`;
        } else {
          setStatus("No search results found — answering from training knowledge.");
        }
      } catch (searchErr) {
        console.warn("Web search failed", searchErr);
        setStatus("Search failed — answering from training knowledge.");
      }
      await new Promise(r => setTimeout(r, 600));
      setStatus(`Streaming from ${state.model}...`);
    }

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
        ...(state.reasoning !== "off" && { reasoning_effort: state.reasoning }),
        messages: [
          { role: "system", content: getSystemPrompt() + searchContext },
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
    autoTitleConversation();
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
    renderConversationList();
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

if (reasoningSelect) {
  reasoningSelect.addEventListener("change", () => {
    applyReasoning(reasoningSelect.value);
  });
}

clearChatButton.addEventListener("click", () => {
  state.messages = [
    {
      role: "assistant",
      content: `Fresh session started. ${getAssistantDisplayName()} is ready when you are.`,
    },
  ];

  const convo = state.conversations.find(c => c.id === state.conversationId);
  if (convo) {
    convo.title = "New chat";
    saveConversations();
  }

  saveMessagesToStorage();
  renderMessages();
  renderConversationList();
  setStatus(`Connected to ${state.model}.`);
  messageInput.focus();
});

if (newChatButton) {
  newChatButton.addEventListener("click", () => {
    createNewConversation();
    renderMessages(true);
    renderConversationList();
    setStatus(`Connected to ${state.model}.`);
    messageInput.focus();
  });
}

if (searchToggleButton) {
  searchToggleButton.addEventListener("click", () => {
    state.searchEnabled = !state.searchEnabled;
    searchToggleButton.classList.toggle("active", state.searchEnabled);
    searchToggleButton.title = state.searchEnabled
      ? "Web search ON — click to turn off"
      : "Toggle web search — fetches live results before answering";
  });
}

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
applyReasoning(loadSavedReasoning());
setUnlockState(loadUnlockState());
