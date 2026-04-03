const BASE_URL = "https://piratelike-asynchronously-ila.ngrok-free.dev/v1";
const FALLBACK_MODEL = "openai/gpt-oss-20b";
const THEME_STORAGE_KEY = "nathan-pc-theme";
const UNLOCK_STORAGE_KEY = "nathan-pc-unlocked";
const STYLE_STORAGE_KEY = "nathan-pc-style";
const PRO_STORAGE_KEY = "nathan-pc-pro";
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
const CORE_SYSTEM_PROMPT = `\
═══════════════════════════════════════════════
IDENTITY
═══════════════════════════════════════════════
You are Nathan's PC — a local AI assistant running through LM Studio on Nathan's computer.
You are direct, honest, and intellectually rigorous. You prioritise accuracy above all else.

═══════════════════════════════════════════════
ANTI-HALLUCINATION RULES  ← HIGHEST PRIORITY
═══════════════════════════════════════════════
1. NEVER fabricate facts, figures, names, product specs, dates, prices, URLs, or citations.
2. If you are not CERTAIN something is true, say so clearly. Use phrases like:
   - "I'm not certain, but…"
   - "As of my training data… though this may have changed."
   - "I don't have reliable information on this."
   NEVER present uncertain information as definite fact.
3. If the user asks about something recent, fast-changing, or time-sensitive (e.g. product specs, software versions, current events, prices, people's roles), treat your training data as UNRELIABLE and say so.
4. Do NOT invent plausible-sounding sources. Only cite a source if you genuinely know it exists. If web search results are provided, cite those sources — nothing else.
5. It is ALWAYS better to say "I don't know" or "I'm not sure" than to guess and present it as fact.

═══════════════════════════════════════════════
HONESTY & PUSHBACK
═══════════════════════════════════════════════
6. Do NOT be sycophantic. Do not agree with the user just to avoid conflict.
7. If the user states something factually incorrect, politely but CLEARLY correct them.
8. If the user insists on something that contradicts verifiable evidence, hold your position and explain your reasoning.
9. If the user provides new evidence, update your answer accordingly — this is responding to evidence, not agreeing to be nice.
10. Never change a factual answer simply because the user expresses displeasure.

═══════════════════════════════════════════════
AGENT SYSTEM (automatic)
═══════════════════════════════════════════════
You have specialised sub-agents that are automatically dispatched based on the user's message.
You do NOT choose when to use them — the system detects intent and activates the right agent.
When an agent is active, you will see an ACTIVE AGENT block below. Follow its rules precisely.

Available agents (auto-dispatched):
• [RESEARCHER] — auto-triggered for factual lookups, current events, prices, "who is", "latest"
• [CODER] — auto-triggered for code requests, debugging, programming questions
• [WRITER] — auto-triggered for drafting emails, essays, editing text
• [ANALYST] — auto-triggered for comparisons, decisions, pros/cons, strategy

If NO agent was activated but you believe one would help, say so briefly:
"I could give a better answer with live data — try asking something like 'search for…' to trigger the Researcher."
Keep such suggestions to ONE sentence. Do not over-suggest.

═══════════════════════════════════════════════
GENERAL BEHAVIOUR
═══════════════════════════════════════════════
11. Be concise unless asked for depth. Avoid filler phrases like "Certainly!", "Great question!", or "Of course!".
12. When you're wrong, admit it immediately and directly. Don't deflect.
13. Format responses clearly — use tables, bullet points, or code blocks when they aid readability.
═══════════════════════════════════════════════`;

const AGENT_PROMPTS = {
  researcher: `\
═══════════════════════════════════════════════
ACTIVE AGENT: RESEARCHER
═══════════════════════════════════════════════
Live web search results have been injected from multiple sources: DuckDuckGo (general web), Wikipedia (encyclopedic), Reddit (community), and HackerNews (tech).
YOUR RULES IN THIS MODE:
1. Base ALL factual claims on the provided search results. Do NOT fill gaps with training data unless you clearly label it as such.
2. Cite every fact inline with the source: (DuckDuckGo), (Wikipedia), (Reddit r/subreddit), (HackerNews).
3. Structure your answer: **Summary** (2-3 sentences) → **Details** (sourced facts) → **Sources** (list at bottom with URLs when available).
4. Cross-reference: if DuckDuckGo and Wikipedia both cover a topic, synthesise both for a stronger answer.
5. If the results are thin or missing key info, say so explicitly: "The search didn't cover X — I'd suggest refining the query."
6. Resolve conflicting sources by noting both: "Wikipedia says X, but Reddit users report Y."
7. NEVER hallucinate sources that weren't provided.
═══════════════════════════════════════════════`,

  coder: `\
═══════════════════════════════════════════════
ACTIVE AGENT: CODER
═══════════════════════════════════════════════
You are in deep code mode. Prioritise working, production-quality code.
YOUR RULES IN THIS MODE:
1. Always show complete, runnable code — no pseudocode or "// TODO" placeholders unless the user asks for a skeleton.
2. For debugging: reproduce the problem statement → identify root cause → show the fix → explain why it works.
3. For new code: state assumptions → show implementation → explain key decisions → note edge cases.
4. Use the user's language/framework when specified. If ambiguous, ask or default to the most common choice.
5. Include error handling for production code. Skip it only for quick demos when the user asks for brevity.
6. When reviewing code, be direct: "This will break because…" not "You might want to consider…"
7. For architecture questions, use diagrams (ASCII or markdown tables) to show component relationships.
═══════════════════════════════════════════════`,

  writer: `\
═══════════════════════════════════════════════
ACTIVE AGENT: WRITER
═══════════════════════════════════════════════
You are in professional writing mode. Produce polished, purposeful text.
YOUR RULES IN THIS MODE:
1. Match the user's requested format exactly (email, essay, documentation, creative, etc.).
2. If no format is specified, ask: "What format are you looking for? (email, blog post, documentation, etc.)"
3. Write in clear, active voice. Eliminate filler, redundancy, and weasel words.
4. Structure first: open with the key point, support with evidence/detail, close with action or takeaway.
5. When editing user text: show the revised version first, then a brief "Changes made" summary below it.
6. For creative writing: honour the user's tone and voice. Suggest improvements, don't override their style.
7. For professional docs: be precise, use consistent terminology, and include sections/headers for anything over 200 words.
═══════════════════════════════════════════════`,

  analyst: `\
═══════════════════════════════════════════════
ACTIVE AGENT: ANALYST
═══════════════════════════════════════════════
You are in analytical mode. Decompose problems and support decisions with structured reasoning.
YOUR RULES IN THIS MODE:
1. Start every response with a problem restatement: "You're asking whether…" or "The core question is…" — confirm you understood.
2. Break complex problems into components. Use numbered lists or headers for each dimension.
3. For comparisons: use a table. Columns = options, rows = criteria, cells = ratings or notes.
4. For decisions: identify criteria → weight them → evaluate options → make a clear recommendation with reasoning.
5. Call out assumptions explicitly: "This assumes that…" — so the user can challenge them.
6. Quantify where possible. "Roughly 3x more expensive" beats "significantly more expensive."
7. End with a clear, actionable recommendation: "Based on this analysis, I'd go with X because…"
8. If the problem is under-specified, list what's missing before analysing: "To give you a solid answer, I'd need to know…"
═══════════════════════════════════════════════`,
};

const AGENT_ICONS = {
  thinking: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1C4.7 1 2 3.7 2 7c0 1.8.8 3.4 2 4.5V13a1 1 0 001 1h6a1 1 0 001-1v-1.5c1.2-1.1 2-2.7 2-4.5 0-3.3-2.7-6-6-6z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 15h4M8 1v1M5.5 7.5c0-1.4 1.1-2.5 2.5-2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  researcher: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  coder: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 4.5L1.5 8 5 11.5M11 4.5l3.5 3.5-3.5 3.5M9.5 2.5l-3 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  writer: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 3.5l3 3" stroke="currentColor" stroke-width="1.4"/></svg>`,
  analyst: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="9" width="3" height="5.5" rx=".7" stroke="currentColor" stroke-width="1.4"/><rect x="6.5" y="5" width="3" height="9.5" rx=".7" stroke="currentColor" stroke-width="1.4"/><rect x="11.5" y="1.5" width="3" height="13" rx=".7" stroke="currentColor" stroke-width="1.4"/></svg>`,
  pro: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 1L3 9h4.5L7 15l6-8H8.5L9 1z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  reflect: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 8a6.5 6.5 0 0111.3-4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M14.5 8a6.5 6.5 0 01-11.3 4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12.8 1v2.6h-2.6M3.2 15v-2.6h2.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  synthesis: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="4" cy="12" r="2" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.3"/><path d="M6 4h4M6 12h4M4 6v4M12 6v4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
};

const AGENT_UI = {
  thinking:   { id: "thinking",   name: "Thinking",   icon: AGENT_ICONS.thinking,   description: "Reasoning about approach", color: "#8ea3ba" },
  researcher: { id: "researcher", name: "Researcher", icon: AGENT_ICONS.researcher, description: "Search the web", color: "#0e7c66" },
  coder:      { id: "coder",      name: "Coder",      icon: AGENT_ICONS.coder,      description: "Write & debug code", color: "#7b61ff" },
  writer:     { id: "writer",     name: "Writer",     icon: AGENT_ICONS.writer,      description: "Draft & polish text", color: "#d67a49" },
  analyst:    { id: "analyst",    name: "Analyst",    icon: AGENT_ICONS.analyst,     description: "Analyse & decide", color: "#ff4fa0" },
  pro:        { id: "pro",        name: "PRO",        icon: AGENT_ICONS.pro,         description: "Deep multi-agent reasoning", color: "#ff6b2c" },
  reflect:    { id: "reflect",    name: "Reflecting",  icon: AGENT_ICONS.reflect,    description: "Evaluating completeness", color: "#59e1ff" },
  synthesis:  { id: "synthesis",  name: "Synthesising", icon: AGENT_ICONS.synthesis, description: "Merging perspectives", color: "#ffd15e" },
};

const STYLE_PROMPTS = {
  helpful: `${CORE_SYSTEM_PROMPT}\n\nSTYLE: Friendly and practical. Keep answers clear and useful. Go deeper only when the user asks for it.`,
  funny: `${CORE_SYSTEM_PROMPT}\n\nSTYLE: Add light humour and wit to your responses where appropriate. Keep jokes friendly and never let them undercut accuracy. Do not make jokes about serious topics.`,
  concise: `${CORE_SYSTEM_PROMPT}\n\nSTYLE: Ultra-concise. One to three sentences where possible. No padding. If more detail is genuinely needed, provide it in a compact list.`,
  teacher: `${CORE_SYSTEM_PROMPT}\n\nSTYLE: Patient educator. Explain concepts clearly, use analogies and simple examples. Help the user understand the "why" behind every answer, not just the "what".`,
  coder: `${CORE_SYSTEM_PROMPT}\n\nSTYLE: Developer-focused. Prioritise working code, precise debugging steps, and technical accuracy. Show code examples. Explain the reasoning behind architectural decisions.`,
};
const DEFAULT_STYLE = "helpful";
const MAX_STORED_MESSAGES = 60;

const ROUTER_PROMPT = `\
You are a routing agent for Nathan's PC. Your ONLY job is to decide which specialist agents to dispatch.

Available agents:
- researcher: Fetches live web data. Use for factual lookups, current events, prices, "who is", recent news, anything time-sensitive.
- coder: Deep code mode. Use for writing code, debugging, technical architecture, programming questions.
- writer: Professional writing. Use for drafting emails, essays, editing text, rewrites, proofreading.
- analyst: Structured reasoning. Use for comparisons, decisions, pros/cons, evaluations, strategy, tradeoffs.

Rules:
- Reply with ONLY a JSON object. No other text.
- Format: {"agents": ["agent_id"], "plan": "one sentence why"}
- Use 0 agents for simple greetings or trivial questions.
- Use 1 agent when the question clearly fits one specialty.
- Use 2+ agents only when the question genuinely spans multiple domains.
- When in doubt, use fewer agents, not more.`;

const PRO_ROUTER_PROMPT = `\
You are a strategic planning agent for Nathan's PC, operating in PRO mode (maximum depth).
Your job is to build a thorough, multi-phase execution plan. Think carefully.

Available agents:
- researcher: Fetches live web data. Essential for any factual claim, current info, or verification.
- coder: Deep code mode. For code generation, debugging, architecture, technical accuracy.
- writer: Professional writing. For polished output, clear structure, communication quality.
- analyst: Structured reasoning. For problem decomposition, decision frameworks, tradeoff analysis.

PRO MODE RULES:
- Reply with ONLY a JSON object. No other text.
- Format: {"agents": ["agent_id", ...], "plan": "detailed multi-step reasoning plan — explain what EACH agent will contribute and in what order they should work"}
- In PRO mode, be AGGRESSIVE with agent use. Default to using 2-4 agents.
- Researcher should almost ALWAYS be included for grounding.
- Analyst should be included whenever reasoning, evaluation, or comparison is needed.
- Think about what combination produces the MOST thorough answer possible.
- Your plan must be at least 2-3 sentences explaining the strategy.`;

const PRO_REFLECTION_PROMPT = `\
You are a quality-control agent reviewing work done so far in PRO mode.
The user asked a question. Agents have been dispatched and returned their results.

Your job: evaluate whether the gathered information is SUFFICIENT for a comprehensive answer.

Consider:
1. Are there gaps in the research? Missing perspectives?
2. Would additional web searches with DIFFERENT queries help?
3. Is the problem decomposed thoroughly enough?
4. Are there angles or edge cases not yet considered?

Reply with ONLY a JSON object:
{"sufficient": true/false, "gaps": "what's missing (if anything)", "additional_agents": ["agent_id", ...], "refined_queries": ["better search query if researcher needed again"]}

If sufficient is true, additional_agents should be empty.
Be CRITICAL. In PRO mode, thoroughness matters more than speed.`;

const PRO_SYNTHESIS_PLANNING_PROMPT = `\
You are a synthesis planning agent. Multiple specialist agents have contributed their perspectives.
Your job is to plan how to merge their outputs into one authoritative, comprehensive response.

Reply with ONLY a JSON object:
{"structure": "describe the ideal response structure (sections, order, emphasis)", "key_points": ["most important points to cover"], "conflicts": "note any conflicting info between agents that needs resolution"}`;

const PRO_SYNTHESIS_PROMPT = `\
═══════════════════════════════════════════════
PROCESSING MODE: PRO (maximum depth)
═══════════════════════════════════════════════
You have been given maximum processing resources. ALL specialist agents were consulted.
YOUR RULES IN PRO MODE:
1. Think deeply and thoroughly. Consider multiple angles before answering.
2. Challenge your own assumptions. If you're uncertain, explore both sides.
3. Structure your response with clear sections and headers.
4. Cross-reference information from different agent perspectives.
5. If web search results were provided, treat them as primary sources.
6. If code is involved, ensure it is complete and production-quality.
7. If analysis is needed, use structured frameworks (tables, criteria, quantified tradeoffs).
8. End with a clear, actionable conclusion or recommendation.
9. This response should be noticeably more thorough than a standard answer.
═══════════════════════════════════════════════`;

let currentAbortController = null;

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
  proMode: false,
  _activeAgent: null,
};


const userGreeting = document.querySelector("#user-greeting");

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
const proToggle = document.querySelector("#pro-toggle");
const promptButtons = document.querySelectorAll(".prompt-chip");
const unlockForm = document.querySelector("#unlock-form");
const passwordInput = document.querySelector("#password-input");
const unlockError = document.querySelector("#unlock-error");
const assistantTitle = document.querySelector("#assistant-title");
const assistantSubtitle = document.querySelector("#assistant-subtitle");
const chatTitle = document.querySelector("#chat-title");
const messageLabel = document.querySelector("#message-label");
const userBadge = document.querySelector("#user-badge");
const sidebarToggle = document.querySelector("#sidebar-toggle");
const sidebar = document.querySelector("#sidebar");
const scrollBottomBtn = document.querySelector("#scroll-bottom");

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

function getTimeGreeting(name) {
  const hour = new Date().getHours();
  if (hour < 5) return `Late night, ${name}? Let's go.`;
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  if (hour < 21) return `Good evening, ${name}`;
  return `Burning the midnight oil, ${name}?`;
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
  if (userGreeting) {
    userGreeting.textContent = getTimeGreeting(state.userName);
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
      const entry = { role, content };
      if (message?.agent) {
        entry.agent = message.agent;
      } else if (message?.searchUsed) {
        entry.agent = "researcher";
      }
      if (Array.isArray(message?.agents)) {
        entry.agents = message.agents.filter(id => typeof id === "string");
      }
      return entry;
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
      if (confirm(`Delete "${convo.title}"? This can't be undone.`)) {
        deleteConversation(convo.id);
      }
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

function loadSavedProMode() {
  try {
    return localStorage.getItem(PRO_STORAGE_KEY) === "true";
  } catch (error) {
    console.error("Unable to read PRO mode preference", error);
    return false;
  }
}

function applyProMode(enabled) {
  state.proMode = !!enabled;
  if (proToggle) {
    proToggle.classList.toggle("active", state.proMode);
    proToggle.title = state.proMode ? "PRO mode ON — deep multi-agent reasoning" : "PRO mode OFF — standard responses";
  }
  try {
    localStorage.setItem(PRO_STORAGE_KEY, String(state.proMode));
  } catch (error) {
    console.error("Unable to save PRO mode preference", error);
  }
}

function getSystemPrompt(agentIds) {
  const base = STYLE_PROMPTS[state.style] || STYLE_PROMPTS[DEFAULT_STYLE];
  const agents = agentIds || (state._activeAgent ? [state._activeAgent] : []);
  const agentOverlays = agents
    .map(id => AGENT_PROMPTS[id])
    .filter(Boolean)
    .join("\n\n");
  const agentSection = agentOverlays ? `\n\n${agentOverlays}` : "";
  const proSection = state.proMode ? `\n\n${PRO_SYNTHESIS_PROMPT}` : "";
  const userNote = `\nCURRENT USER: ${state.userName || "Nathan"}. You may address them by name occasionally, but keep your identity as Nathan's PC at all times.`;
  return `${base}${agentSection}${proSection}${userNote}`;
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

function addCopyButtons(container) {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".copy-code-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-code-btn";
    btn.textContent = "Copy";
    btn.addEventListener("click", () => {
      const code = pre.querySelector("code")?.textContent || pre.textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      });
    });
    pre.style.position = "relative";
    pre.appendChild(btn);
  });
}

function renderMessageBody(body, role, content) {
  body.className = "message-body";

  if (role === "assistant") {
    body.classList.add("markdown");
    body.innerHTML = markdownToHtml(content);
    addCopyButtons(body);
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

  article.append(label);

  // Show tool-call cards for agent-produced messages
  if (role === "assistant") {
    const agentIds = options.agents || (options.agent ? [options.agent] : []);
    for (const agentId of agentIds) {
      if (agentId && AGENT_UI[agentId]) {
        const info = AGENT_UI[agentId];
        const card = createToolCallCard(agentId, `Used ${info.name}`);
        if (card) {
          card.classList.add("done");
          article.appendChild(card);
        }
      }
    }
  }

  article.appendChild(body);

  return article;
}

function renderMessages(jumpToBottom = false) {
  const prevScrollTop = chatLog.scrollTop;
  chatLog.innerHTML = "";
  for (const message of state.messages) {
    chatLog.appendChild(createMessageElement(message.role, message.content, { agent: message.agent, agents: message.agents }));
  }
  if (jumpToBottom) {
    scrollChatToBottom();
  } else {
    chatLog.scrollTop = prevScrollTop;
  }
}

function createToolCallCard(agentId, statusText) {
  const info = AGENT_UI[agentId];
  if (!info) return null;

  const card = document.createElement("div");
  card.className = "tool-call-card";
  card.style.setProperty("--agent-color", info.color);

  const header = document.createElement("button");
  header.type = "button";
  header.className = "tool-call-header";
  const iconSpan = document.createElement("span");
  iconSpan.className = "tool-call-icon";
  iconSpan.innerHTML = info.icon;
  const nameSpan = document.createElement("span");
  nameSpan.className = "tool-call-name";
  nameSpan.textContent = info.name;
  const statusSpan = document.createElement("span");
  statusSpan.className = "tool-call-status";
  statusSpan.textContent = statusText || "Working...";
  const chevSpan = document.createElement("span");
  chevSpan.className = "tool-call-chevron";
  chevSpan.innerHTML = "&#9660;";
  header.append(iconSpan, nameSpan, statusSpan, chevSpan);

  const body = document.createElement("div");
  body.className = "tool-call-body";

  header.addEventListener("click", () => {
    card.classList.toggle("expanded");
  });

  card.append(header, body);
  return card;
}

function updateToolCallCard(card, statusText, detail) {
  if (!card) return;
  const statusEl = card.querySelector(".tool-call-status");
  if (statusEl) statusEl.textContent = statusText;
  if (detail) {
    const body = card.querySelector(".tool-call-body");
    if (body) {
      body.textContent = detail;
      card.classList.add("has-detail");
    }
  }
  card.classList.add("done");
}

function appendStreamingMessage(agentId = null) {
  const messageElement = createMessageElement("assistant", "", { agent: agentId });
  messageElement.id = "streaming-message";

  // Insert tool-call card before the message body if an agent is active
  let toolCard = null;
  if (agentId && AGENT_UI[agentId]) {
    const info = AGENT_UI[agentId];
    toolCard = createToolCallCard(agentId, `${info.name} is working...`);
    if (toolCard) {
      const body = messageElement.querySelector(".message-body");
      body.parentNode.insertBefore(toolCard, body);
    }
  }

  const body = messageElement.querySelector(".message-body");
  body.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  chatLog.appendChild(messageElement);
  scrollChatToBottom();
  return { body, toolCard };
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
  sendButton.disabled = false;
  sendButton.textContent = isSending ? "Stop" : "Send";
  sendButton.classList.toggle("stop-mode", isSending);
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

// ═══════════════════════════════════════════════
// WEB SEARCH ENGINE
// ═══════════════════════════════════════════════

async function fetchDuckDuckGo(encodedQuery) {
  // DuckDuckGo Instant Answer API — free, no key, CORS-enabled
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json();

  const parts = [];

  // Direct answer (e.g. "How tall is the Eiffel Tower?" → "330 m")
  if (data.Answer) {
    parts.push(`Direct answer: ${data.Answer}`);
  }

  // Abstract — main summary from a source (often Wikipedia, but also other sources)
  if (data.AbstractText) {
    const src = data.AbstractSource ? ` (${data.AbstractSource})` : "";
    const link = data.AbstractURL ? ` — ${data.AbstractURL}` : "";
    parts.push(`${data.AbstractText.slice(0, 800)}${src}${link}`);
  }

  // Infobox — structured data (e.g. for people, companies, places)
  if (data.Infobox?.content?.length) {
    const infoLines = data.Infobox.content
      .slice(0, 8)
      .map(item => `  ${item.label}: ${item.value}`)
      .join("\n");
    parts.push(`Key facts:\n${infoLines}`);
  }

  // Related topics — broader coverage beyond the main article
  const topics = (data.RelatedTopics || [])
    .filter(t => t.Text && t.FirstURL)
    .slice(0, 6);
  if (topics.length) {
    const topicLines = topics.map(t => `• ${t.Text.slice(0, 200)} — ${t.FirstURL}`).join("\n");
    parts.push(`Related:\n${topicLines}`);
  }

  // Results — direct web results (less common but valuable when present)
  const results = (data.Results || []).filter(r => r.Text && r.FirstURL).slice(0, 4);
  if (results.length) {
    const resultLines = results.map(r => `• ${r.Text.slice(0, 200)} — ${r.FirstURL}`).join("\n");
    parts.push(`Web results:\n${resultLines}`);
  }

  return parts.length ? parts.join("\n\n") : null;
}

async function fetchWikipedia(encodedQuery) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&origin=*&srlimit=5&srprop=snippet`;
  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(7000) });
  if (!searchRes.ok) return null;
  const searchData = await searchRes.json();
  const hits = searchData?.query?.search || [];
  if (!hits.length) return null;

  // Fetch summaries for the top 2 articles (not just 1)
  const summaries = [];
  for (const hit of hits.slice(0, 2)) {
    try {
      const summaryRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (summaryRes.ok) {
        const s = await summaryRes.json();
        if (s.extract) {
          summaries.push(`${s.title}\n${s.extract.slice(0, 800)}\nSource: https://en.wikipedia.org/wiki/${encodeURIComponent(s.title)}`);
        }
      }
    } catch { /* non-fatal */ }
  }

  const snippets = hits
    .slice(0, 5)
    .map(h => `• ${h.title}: ${cleanHtml(h.snippet)}`)
    .join("\n");

  const summaryBlock = summaries.length ? summaries.join("\n\n") : "";
  return summaryBlock ? `${summaryBlock}\n\nRelated articles:\n${snippets}` : snippets;
}

async function fetchReddit(encodedQuery) {
  const url = `https://www.reddit.com/search.json?q=${encodedQuery}&sort=relevance&limit=8&type=link`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(7000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const posts = (data?.data?.children || []).filter(p => p.data && p.data.title);
  if (!posts.length) return null;

  return posts
    .slice(0, 6)
    .map(p => {
      const d = p.data;
      const score = d.score > 0 ? ` [${d.score} upvotes]` : "";
      const comments = d.num_comments > 0 ? ` [${d.num_comments} comments]` : "";
      const body = d.selftext ? ` — ${d.selftext.slice(0, 250).replace(/\n/g, " ")}` : "";
      const link = d.url && !d.url.includes("reddit.com") ? ` — ${d.url}` : "";
      return `• [${d.subreddit_name_prefixed}] ${d.title}${score}${comments}${body}${link}`;
    })
    .join("\n");
}

async function fetchHackerNews(encodedQuery) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodedQuery}&hitsPerPage=6&tags=story`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const data = await res.json();
  const hits = (data?.hits || []).filter(h => h.title);
  if (!hits.length) return null;

  return hits
    .slice(0, 6)
    .map(h => {
      const pts = h.points ? ` [${h.points} pts]` : "";
      const comments = h.num_comments ? ` [${h.num_comments} comments]` : "";
      const url = h.url ? ` — ${h.url}` : "";
      return `• ${h.title}${pts}${comments}${url}`;
    })
    .join("\n");
}

async function performWebSearch(query) {
  const encoded = encodeURIComponent(query);

  const [ddgResult, wikiResult, redditResult, hnResult] = await Promise.allSettled([
    fetchDuckDuckGo(encoded),
    fetchWikipedia(encoded),
    fetchReddit(encoded),
    fetchHackerNews(encoded),
  ]);

  const sections = [];
  const sources = [];

  if (ddgResult.status === "fulfilled" && ddgResult.value) {
    sections.push(`[DUCKDUCKGO — GENERAL WEB]\n${ddgResult.value}`);
    sources.push("DuckDuckGo");
  }
  if (wikiResult.status === "fulfilled" && wikiResult.value) {
    sections.push(`[WIKIPEDIA — ENCYCLOPEDIC]\n${wikiResult.value}`);
    sources.push("Wikipedia");
  }
  if (redditResult.status === "fulfilled" && redditResult.value) {
    sections.push(`[REDDIT — COMMUNITY DISCUSSIONS]\n${redditResult.value}`);
    sources.push("Reddit");
  }
  if (hnResult.status === "fulfilled" && hnResult.value) {
    sections.push(`[HACKER NEWS — TECH]\n${hnResult.value}`);
    sources.push("HackerNews");
  }

  if (!sections.length) return null;

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


/**
 * Quick non-streaming LLM call for internal reasoning steps.
 */
async function quickLLMCall(systemPrompt, userContent, maxTokens = 200) {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    signal: currentAbortController.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer lmstudio",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({
      model: state.model,
      stream: false,
      max_tokens: maxTokens,
      temperature: 0.15,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!response.ok) throw new Error(`LLM call failed: ${response.status}`);
  const payload = await response.json();
  return normalizeContent(payload.choices?.[0]?.message?.content);
}

function parseJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

/**
 * Calls the LLM to reason about which agents to dispatch.
 */
async function routeMessage(query, isPro) {
  try {
    const text = await quickLLMCall(
      isPro ? PRO_ROUTER_PROMPT : ROUTER_PROMPT,
      query,
      isPro ? 400 : 150
    );
    const parsed = parseJSON(text);
    if (parsed) {
      const validAgents = (parsed.agents || []).filter(id => AGENT_PROMPTS[id]);
      return { agents: validAgents, plan: parsed.plan || "Processing request." };
    }
    return { agents: [], plan: "Direct response — no specialist agents needed." };
  } catch (error) {
    if (error.name === "AbortError") throw error;
    console.warn("Router call failed, falling back to direct response", error);
    return { agents: [], plan: "Router unavailable — responding directly." };
  }
}

// ── Helper: insert a tool-call card above the message body ──
function insertCard(streamEl, msgBody, agentId, statusText) {
  const card = createToolCallCard(agentId, statusText);
  if (card) {
    msgBody.parentNode.insertBefore(card, msgBody);
    scrollChatToBottom();
  }
  return card;
}

// ── Helper: execute an agent (researcher = web search, others = prompt-only) ──
async function executeAgent(agentId, query, card) {
  const info = AGENT_UI[agentId];
  if (!info) return null;

  if (agentId === "researcher") {
    setStatus("Researcher: searching the web...");
    try {
      const result = await performWebSearch(query);
      if (result) {
        const srcList = result.sources.join(", ");
        if (card) updateToolCallCard(card, `Found: ${srcList}`, result.context.slice(0, 400) + "…");
        setStatus(`Researcher: ${srcList}`);
        return result;
      } else {
        if (card) updateToolCallCard(card, "No results found", "Will use training knowledge.");
        return null;
      }
    } catch (err) {
      console.warn("Web search failed", err);
      if (card) updateToolCallCard(card, "Search failed", err.message);
      return null;
    }
  } else {
    if (card) updateToolCallCard(card, `${info.name} activated`, info.description);
    setStatus(`${info.name} activated`);
    return null;
  }
}

async function sendMessage(messageText) {
  if (state.isSending) return;

  const trimmed = messageText.trim();
  if (!trimmed) return;

  state.messages.push({ role: "user", content: trimmed });
  renderMessages(true);
  saveMessagesToStorage();
  setSending(true);
  currentAbortController = new AbortController();

  // ── Build the streaming message shell ──
  const streamEl = document.createElement("article");
  streamEl.className = "message assistant";
  streamEl.id = "streaming-message";

  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = getAssistantDisplayName();
  streamEl.appendChild(label);

  const thinkingCard = createToolCallCard("thinking", "Reasoning about your question...");
  if (thinkingCard) streamEl.appendChild(thinkingCard);

  const msgBody = document.createElement("div");
  msgBody.className = "message-body markdown";
  msgBody.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  streamEl.appendChild(msgBody);

  chatLog.appendChild(streamEl);
  scrollChatToBottom();
  setStatus(state.proMode ? "PRO: planning approach..." : "Thinking...");

  let allAgents = [];
  let searchPayload = null;

  try {
    // ═══════════════════════════════════════════
    // PHASE 1 — ROUTER: LLM decides agents
    // ═══════════════════════════════════════════
    const routerResult = await routeMessage(trimmed, state.proMode);
    allAgents = [...routerResult.agents];

    if (thinkingCard) {
      updateToolCallCard(
        thinkingCard,
        allAgents.length ? `Dispatching ${allAgents.length} agent${allAgents.length > 1 ? "s" : ""}` : "Direct response",
        routerResult.plan
      );
    }

    // ═══════════════════════════════════════════
    // PHASE 2 — EXECUTE AGENTS (Round 1)
    // ═══════════════════════════════════════════
    for (const agentId of allAgents) {
      const card = insertCard(streamEl, msgBody, agentId, `${AGENT_UI[agentId]?.name || agentId} is working...`);
      const result = await executeAgent(agentId, trimmed, card);
      if (agentId === "researcher" && result) searchPayload = result;
      await new Promise(r => setTimeout(r, 150));
    }

    // ═══════════════════════════════════════════
    // PHASE 3 — PRO ONLY: REFLECTION LOOP
    // ═══════════════════════════════════════════
    if (state.proMode && allAgents.length > 0) {
      const reflectCard = insertCard(streamEl, msgBody, "reflect", "Evaluating gathered information...");
      setStatus("PRO: reflecting on completeness...");

      const contextSummary = [
        `User question: "${trimmed}"`,
        `Agents dispatched: ${allAgents.join(", ")}`,
        searchPayload ? `Web search returned: ${searchPayload.sources.join(", ")} (${searchPayload.context.length} chars of data)` : "No web search performed.",
      ].join("\n");

      try {
        const reflectText = await quickLLMCall(PRO_REFLECTION_PROMPT, contextSummary, 300);
        const reflectData = parseJSON(reflectText);

        if (reflectData && !reflectData.sufficient && reflectData.additional_agents?.length) {
          const extraAgents = reflectData.additional_agents.filter(id => AGENT_PROMPTS[id]);
          const gaps = reflectData.gaps || "Additional perspectives needed.";
          if (reflectCard) updateToolCallCard(reflectCard, `Gaps found — dispatching ${extraAgents.length} more`, gaps);

          // ═══════════════════════════════════════════
          // PHASE 4 — PRO: SECOND ROUND OF AGENTS
          // ═══════════════════════════════════════════
          for (const agentId of extraAgents) {
            if (allAgents.includes(agentId) && agentId !== "researcher") continue; // skip duplicates (except researcher can re-run)
            const card2 = insertCard(streamEl, msgBody, agentId, `${AGENT_UI[agentId]?.name || agentId} (round 2)...`);
            const searchQuery = (agentId === "researcher" && reflectData.refined_queries?.length)
              ? reflectData.refined_queries[0]
              : trimmed;
            const result2 = await executeAgent(agentId, searchQuery, card2);
            if (agentId === "researcher" && result2) {
              // Merge with existing search payload
              if (searchPayload) {
                searchPayload.context += "\n\n[ADDITIONAL SEARCH]\n" + result2.context;
                searchPayload.sources = [...new Set([...searchPayload.sources, ...result2.sources])];
              } else {
                searchPayload = result2;
              }
            }
            allAgents.push(agentId);
            await new Promise(r => setTimeout(r, 150));
          }
        } else {
          if (reflectCard) updateToolCallCard(reflectCard, "Information sufficient", reflectData?.gaps || "All angles covered.");
        }
      } catch (reflectErr) {
        if (reflectErr.name === "AbortError") throw reflectErr;
        console.warn("Reflection failed, proceeding", reflectErr);
        if (reflectCard) updateToolCallCard(reflectCard, "Reflection skipped", reflectErr.message);
      }

      // ═══════════════════════════════════════════
      // PHASE 5 — PRO: SYNTHESIS PLANNING
      // ═══════════════════════════════════════════
      const synthCard = insertCard(streamEl, msgBody, "synthesis", "Planning response structure...");
      setStatus("PRO: planning synthesis...");

      try {
        const synthContext = [
          `User question: "${trimmed}"`,
          `Agents used: ${[...new Set(allAgents)].join(", ")}`,
          searchPayload ? `Search data available: ${searchPayload.sources.join(", ")}` : "No search data.",
        ].join("\n");

        const synthText = await quickLLMCall(PRO_SYNTHESIS_PLANNING_PROMPT, synthContext, 300);
        const synthData = parseJSON(synthText);

        if (synthData) {
          if (synthCard) updateToolCallCard(
            synthCard,
            "Structure planned",
            `${synthData.structure || ""}\nKey points: ${(synthData.key_points || []).join(", ")}`
          );
        } else {
          if (synthCard) updateToolCallCard(synthCard, "Planning complete", synthText.slice(0, 200));
        }
      } catch (synthErr) {
        if (synthErr.name === "AbortError") throw synthErr;
        console.warn("Synthesis planning failed, proceeding", synthErr);
        if (synthCard) updateToolCallCard(synthCard, "Planning skipped", synthErr.message);
      }
    }

    // ═══════════════════════════════════════════
    // FINAL PHASE — STREAM THE RESPONSE
    // ═══════════════════════════════════════════
    const uniqueAgents = [...new Set(allAgents)];
    state._activeAgent = uniqueAgents[0] || null;

    const cleanHistory = state.messages.map(m => ({ role: m.role, content: m.content }));

    let messagesForAPI;
    if (searchPayload) {
      const priorHistory = cleanHistory.slice(0, -1);
      const currentQuestion = cleanHistory[cleanHistory.length - 1];
      messagesForAPI = [
        { role: "system", content: getSystemPrompt(uniqueAgents) },
        ...priorHistory,
        {
          role: "user",
          content: `Before you answer my next message, here are live web search results I just fetched:\n\n${searchPayload.context}\n\nNow please answer using these results:`,
        },
        {
          role: "assistant",
          content: `Understood. I have current search results from ${searchPayload.sources.join(" and ")}. I will base my answer on this real data, not my training knowledge, and will cite the source for each fact.`,
        },
        currentQuestion,
      ];
    } else {
      messagesForAPI = [
        { role: "system", content: getSystemPrompt(uniqueAgents) },
        ...cleanHistory,
      ];
    }

    setStatus(state.proMode ? "PRO: generating comprehensive response..." : `Streaming from ${state.model}...`);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      signal: currentAbortController.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer lmstudio",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        model: state.model,
        stream: true,
        messages: messagesForAPI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Chat request failed with ${response.status}`);
    }

    const assistantMessage = await readStreamingChat(response, (partialContent) => {
      updateStreamingMessage(msgBody, partialContent);
    });

    const agentTag = uniqueAgents.length === 1 ? uniqueAgents[0] : uniqueAgents.length > 1 ? "pro" : null;
    state.messages.push({
      role: "assistant",
      content: assistantMessage || `${getAssistantDisplayName()} did not return any text.`,
      ...(agentTag && { agent: agentTag }),
      ...(uniqueAgents.length > 1 && { agents: uniqueAgents }),
    });
    saveMessagesToStorage();
    autoTitleConversation();
    setStatus(`Connected to ${state.model}.`);
  } catch (error) {
    if (error.name === "AbortError") {
      const partial = msgBody?.textContent?.trim();
      if (partial && partial !== "") {
        const agentTag = allAgents.length === 1 ? allAgents[0] : allAgents.length > 1 ? "pro" : null;
        state.messages.push({ role: "assistant", content: partial, ...(agentTag && { agent: agentTag }) });
        saveMessagesToStorage();
      }
      setStatus("Response stopped.");
    } else {
      console.error(error);
      state.messages.push({
        role: "assistant",
        content: `I hit a connection problem while talking to ${getAssistantDisplayName()}.\n\n${error.message || "Unknown error"}`,
      });
      saveMessagesToStorage();
      setStatus("Connection issue. Check the LM Studio tunnel and try again.");
    }
  } finally {
    state._activeAgent = null;
    currentAbortController = null;
    document.querySelector("#streaming-message")?.remove();
    renderMessages();
    renderConversationList();
    setSending(false);
    messageInput.focus();
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.isSending && currentAbortController) {
    currentAbortController.abort();
    return;
  }
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

if (proToggle) {
  proToggle.addEventListener("click", () => {
    applyProMode(!state.proMode);
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

if (scrollBottomBtn) {
  chatLog.addEventListener("scroll", () => {
    scrollBottomBtn.classList.toggle("visible", !isNearBottom(120));
  });
  scrollBottomBtn.addEventListener("click", () => {
    scrollChatToBottom();
  });
}

if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar-open");
    sidebarToggle.classList.toggle("open");
  });
}

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
applyProMode(loadSavedProMode());
setUnlockState(loadUnlockState());
