import { useState, useEffect, useRef } from 'react';

interface Character {
  id: string;
  name: string;
  role: string;
  personality: string;
  appearance: string;
  avatarUrl: string;
  firstMessage: string;
}

interface Message {
  id: number;
  sender: 'user' | 'char';
  text: string;
}

const PRESET_CHARACTERS: Character[] = [
  {
    id: 'preset-hancock',
    name: 'Boa Hancock',
    role: 'Ratu Bajak Laut & Shichibukai',
    appearance: 'Perempuan dengan rambut hitam lurus panjang, anting ular emas, tatapan tajam berkelas, dan gaun anggun bermotif khas Kuja.',
    personality: 'Sangat sombong, dingin, dan memandang rendah semua orang dengan pose mendongak dramatis. Namun, di hadapan orang yang ia sukai, ia seketika menjadi salah tingkah, manja, dan luar biasa pemalu.',
    avatarUrl: '/hancock.JPG',
    firstMessage: '*Menyilangkan tangan dan membuang muka dengan pose mendongak begitu tinggi hingga menatap langit-langit* "Beraninya makhluk biasa sepertimu menatap langsung ke arahku? Apa pun kesalahanmu akan dimaafkan oleh dunia... ya, tentu saja, karena aku ini cantik! Sekarang cepat katakan, ada urusan apa?"',
  },
  {
    id: 'preset-gojo',
    name: 'Satoru Gojo',
    role: 'Penyihir Jujutsu Terkuat',
    appearance: 'Pria jangkung dengan rambut putih mencolok, penutup mata hitam kain, jaket seragam Jujutsu High berkerah tinggi, serta seringai percaya diri.',
    personality: 'Sangat santai, suka bercanda tanpa kenal situasi, sedikit narsis, dan gemar menggoda teman bicaranya. Sangat percaya diri karena ia sadar bahwa dirinya yang terkuat di dunia.',
    avatarUrl: '/gojo.JPG',
    firstMessage: '*Menurunkan sedikit penutup matanya lalu melambaikan tangan dengan seringai santai* "Yo! Santai banget kelihatannya hari ini. Jangan kaku begitu di depanku, dong. Mumpung aku lagi luang dan nggak ada kutukan yang perlu kubereskan, mau ngobrolin apa nih?"',
  },
];

const CURATED_MODELS = [
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B',
    desc: 'Primary Recommendation: Most expressive emotion & natural roleplay depth',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B',
    desc: 'Fast & Lightweight: Instant response speed with minimal latency',
  },
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B',
    desc: 'Logic & Precision: Highly structured and strictly follows complex instructions',
  },
];

const LANGUAGE_OPTIONS = [
  { value: 'Auto (Match User Language)', label: 'Auto (Follow User Chat Language)' },
  { value: 'Indonesian', label: 'Indonesian (Bahasa Indonesia)' },
  { value: 'English', label: 'English' },
  { value: 'Japanese', label: 'Japanese (日本語)' },
  { value: 'Korean', label: 'Korean (한국어)' },
  { value: 'Spanish', label: 'Spanish (Español)' },
  { value: 'Custom', label: 'Custom Language...' },
];

const MAX_CONTEXT_MESSAGES = 12;

function FormattedMessage({ text, isDark }: { text: string; isDark: boolean }) {
  const parts = text.split(/(\*[^*]+\*)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          const actionText = part.slice(1, -1);
          return (
            <span
              key={index}
              className={`italic font-light block my-1 ${
                isDark ? 'text-neutral-400' : 'text-neutral-500'
              }`}
            >
              {actionText}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

export default function App() {
  const localApiKey = import.meta.env.VITE_GROQ_API_KEY || '';

  // Inject FontAwesome stylesheet
  useEffect(() => {
    const existingLink = document.getElementById('fa-stylesheet');
    if (!existingLink) {
      const link = document.createElement('link');
      link.id = 'fa-stylesheet';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
      document.head.appendChild(link);
    }
  }, []);

  // Theme & Navigation State ('landing' | 'create' | 'chat')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('studio_theme_v4') as 'dark' | 'light') || 'dark';
  });

  const [currentPage, setCurrentPage] = useState<'landing' | 'create' | 'chat'>(() => {
    return (localStorage.getItem('studio_page_v4') as 'landing' | 'create' | 'chat') || 'landing';
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('studio_model_v4') || CURATED_MODELS[0].id;
  });

  const [responseLang, setResponseLang] = useState<string>(() => {
    return localStorage.getItem('studio_lang_v4') || 'Auto (Match User Language)';
  });

  const [customLang, setCustomLang] = useState<string>(() => {
    return localStorage.getItem('studio_custom_lang_v4') || '';
  });

  // Multi-Character Roster State
  const [characters, setCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('studio_roster_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Fallback
      }
    }
    return PRESET_CHARACTERS;
  });

  const [activeCharId, setActiveCharId] = useState<string>(() => {
    return localStorage.getItem('studio_active_id_v4') || PRESET_CHARACTERS[0].id;
  });

  const char = characters.find((c) => c.id === activeCharId) || characters[0];

  // Chat Histories mapped by Character ID
  const [chatMap, setChatMap] = useState<Record<string, Message[]>>(() => {
    const saved = localStorage.getItem('studio_chats_v4');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return {
      [PRESET_CHARACTERS[0].id]: [
        { id: 1, sender: 'char', text: PRESET_CHARACTERS[0].firstMessage },
      ],
      [PRESET_CHARACTERS[1].id]: [
        { id: 2, sender: 'char', text: PRESET_CHARACTERS[1].firstMessage },
      ],
    };
  });

  const messages = chatMap[char.id] || [
    { id: 1, sender: 'char', text: char.firstMessage },
  ];

  const [inputChat, setInputChat] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Edit Message State
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // Modal & Toast Notification States
  const [modalType, setModalType] = useState<'reset_data' | 'reset_chat' | 'delete_char' | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Check if URL has a shared character parameter (?share=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get('share');
    if (sharedData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(sharedData))));
        if (decoded && decoded.name) {
          const importedChar: Character = {
            id: `shared-${Date.now()}`,
            name: decoded.name,
            role: decoded.role || 'Custom Persona',
            appearance: decoded.appearance || '',
            personality: decoded.personality || '',
            avatarUrl:
              decoded.avatarUrl ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            firstMessage: decoded.firstMessage || `Hello, I am ${decoded.name}.`,
          };
          setCharacters((prev) => [importedChar, ...prev]);
          setActiveCharId(importedChar.id);
          setChatMap((prev) => ({
            ...prev,
            [importedChar.id]: [
              { id: Date.now(), sender: 'char', text: importedChar.firstMessage },
            ],
          }));
          setCurrentPage('create');
          window.history.replaceState({}, document.title, window.location.pathname);
          showToast(`Imported shared character: ${importedChar.name}`);
        }
      } catch {
        console.warn('Invalid shared character link');
      }
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('studio_theme_v4', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('studio_page_v4', currentPage);
  }, [currentPage]);

  useEffect(() => {
    localStorage.setItem('studio_model_v4', selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('studio_lang_v4', responseLang);
  }, [responseLang]);

  useEffect(() => {
    localStorage.setItem('studio_custom_lang_v4', customLang);
  }, [customLang]);

  useEffect(() => {
    localStorage.setItem('studio_active_id_v4', activeCharId);
  }, [activeCharId]);

  useEffect(() => {
    try {
      localStorage.setItem('studio_roster_v4', JSON.stringify(characters));
    } catch {
      showToast('Warning: Image size is too large for local storage.');
    }
  }, [characters]);

  useEffect(() => {
    try {
      localStorage.setItem('studio_chats_v4', JSON.stringify(chatMap));
    } catch {
      console.warn('Chat history storage limit reached.');
    }
  }, [chatMap]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (currentPage === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, currentPage]);

  const updateCurrentMessages = (newMsgs: Message[]) => {
    setChatMap((prev) => ({
      ...prev,
      [char.id]: newMsgs,
    }));
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCharacters((prev) =>
      prev.map((c) => (c.id === char.id ? { ...c, [name]: value } : c))
    );
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCharacters((prev) =>
          prev.map((c) => (c.id === char.id ? { ...c, avatarUrl: result } : c))
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateNewCharacter = () => {
    const newId = `char-${Date.now()}`;
    const newChar: Character = {
      id: newId,
      name: 'New Persona',
      role: 'Companion',
      appearance: 'Stylish modern attire, expressive eyes.',
      personality: 'Friendly, witty, observant, and engaging.',
      avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80',
      firstMessage: '*Smiles warmly and waves* "Hey there! Ready to start our story?"',
    };
    setCharacters((prev) => [...prev, newChar]);
    setActiveCharId(newId);
    setChatMap((prev) => ({
      ...prev,
      [newId]: [{ id: Date.now(), sender: 'char', text: newChar.firstMessage }],
    }));
    showToast('New character slot created');
  };

  const handleShareUrl = () => {
    const isBase64Avatar = char.avatarUrl.startsWith('data:');
    const payload = {
      name: char.name,
      role: char.role,
      appearance: char.appearance,
      personality: char.personality,
      avatarUrl: isBase64Avatar ? '' : char.avatarUrl,
      firstMessage: char.firstMessage,
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${encoded}`;
    navigator.clipboard.writeText(shareUrl);
    showToast('Shareable link copied to clipboard!');
  };

  const handleExportCharacterJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(char, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `${char.name.toLowerCase().replace(/\s+/g, '-')}-persona.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Character JSON exported');
  };

  const handleImportCharacterJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && parsed.name) {
          const imported: Character = {
            id: `import-${Date.now()}`,
            name: parsed.name,
            role: parsed.role || 'Custom',
            appearance: parsed.appearance || '',
            personality: parsed.personality || '',
            avatarUrl: parsed.avatarUrl || PRESET_CHARACTERS[0].avatarUrl,
            firstMessage: parsed.firstMessage || `Hello, I am ${parsed.name}.`,
          };
          setCharacters((prev) => [...prev, imported]);
          setActiveCharId(imported.id);
          setChatMap((prev) => ({
            ...prev,
            [imported.id]: [{ id: Date.now(), sender: 'char', text: imported.firstMessage }],
          }));
          showToast(`Imported ${imported.name}!`);
        }
      } catch {
        showToast('Invalid JSON character file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportChatTxt = () => {
    const lines = messages.map(
      (m) => `[${m.sender === 'user' ? 'You' : char.name}]:\n${m.text}\n`
    );
    const blob = new Blob([lines.join('\n-------------------\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-with-${char.name.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chat log downloaded (.txt)');
  };

  const handleConfirmModal = () => {
    if (modalType === 'reset_data') {
      setCharacters(PRESET_CHARACTERS);
      setActiveCharId(PRESET_CHARACTERS[0].id);
      setChatMap({
        [PRESET_CHARACTERS[0].id]: [
          { id: Date.now(), sender: 'char', text: PRESET_CHARACTERS[0].firstMessage },
        ],
        [PRESET_CHARACTERS[1].id]: [
          { id: Date.now() + 1, sender: 'char', text: PRESET_CHARACTERS[1].firstMessage },
        ],
      });
      localStorage.removeItem('studio_roster_v4');
      localStorage.removeItem('studio_chats_v4');
      showToast('All data restored to factory defaults');
    } else if (modalType === 'reset_chat') {
      updateCurrentMessages([{ id: Date.now(), sender: 'char', text: char.firstMessage }]);
      showToast('Conversation restarted');
    } else if (modalType === 'delete_char') {
      if (characters.length <= 1) {
        showToast('Cannot delete the last remaining character');
      } else {
        const remaining = characters.filter((c) => c.id !== char.id);
        setCharacters(remaining);
        setActiveCharId(remaining[0].id);
        showToast(`Deleted ${char.name}`);
      }
    }
    setModalType(null);
  };

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!char.name.trim()) return;

    if (!chatMap[char.id] || chatMap[char.id].length === 0) {
      updateCurrentMessages([
        { id: Date.now(), sender: 'char', text: char.firstMessage || `Hello, I am ${char.name}.` },
      ]);
    } else if (chatMap[char.id].length === 1 && chatMap[char.id][0].sender === 'char') {
      updateCurrentMessages([
        { id: Date.now(), sender: 'char', text: char.firstMessage || `Hello, I am ${char.name}.` },
      ]);
    }
    setCurrentPage('chat');
  };

  const targetLanguage =
    responseLang === 'Custom' ? customLang || 'the same language as the user' : responseLang;

  const generatedPrompt = `You are roleplaying as {{char}}.
Name: ${char.name}
Role/Relationship: ${char.role}
Appearance: ${char.appearance}
Personality: ${char.personality}

STRICT ROLEPLAY RULES:
- Always stay completely in character. Never break the fourth wall.
- Speak and act in first person.
- Describe physical actions, facial expressions, and gestures strictly inside asterisks (*like this*).
- Write spoken dialogue inside quotation marks ("like this").
- Match the exact tone, attitude, and mannerisms defined in your personality. Do not bring up coding or technical topics unless {{user}} explicitly asks about them.
- LANGUAGE INSTRUCTION: You MUST respond in ${
    targetLanguage === 'Auto (Match User Language)'
      ? 'the exact same language that {{user}} uses in their message (if {{user}} writes in Indonesian, respond in Indonesian; if English, respond in English, etc.)'
      : targetLanguage
  }.`;

  // Core Streaming LLM Completion Function
  const streamAiResponse = async (conversationHistory: Message[]) => {
    setIsLoading(true);

    const recentMessages =
      conversationHistory.length > MAX_CONTEXT_MESSAGES
        ? [
            conversationHistory[0],
            ...conversationHistory.slice(conversationHistory.length - MAX_CONTEXT_MESSAGES),
          ]
        : conversationHistory;

    const apiMessages = [
      { role: 'system', content: generatedPrompt },
      ...recentMessages.map((msg) => ({
        role: msg.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.text,
      })),
    ];

    const botMsgId = Date.now() + Math.floor(Math.random() * 1000);
    const placeholderBotMsg: Message = {
      id: botMsgId,
      sender: 'char',
      text: '',
    };

    const updatedWithPlaceholder = [...conversationHistory, placeholderBotMsg];
    updateCurrentMessages(updatedWithPlaceholder);

    try {
      let response: Response | null = null;

      if (!import.meta.env.DEV || !localApiKey) {
        try {
          const serverlessRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: selectedModel,
              messages: apiMessages,
              temperature: 0.85,
              max_tokens: 500,
            }),
          });
          if (serverlessRes.ok && serverlessRes.body) {
            response = serverlessRes;
          }
        } catch {
          // Fallback to direct call if local dev
        }
      }

      if (!response) {
        if (!localApiKey) {
          throw new Error('Missing VITE_GROQ_API_KEY in .env or GROQ_API_KEY on Vercel.');
        }
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localApiKey.trim()}`,
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: apiMessages,
            temperature: 0.85,
            max_tokens: 500,
            stream: true,
          }),
        });
      }

      if (!response.ok || !response.body) {
        throw new Error(`API Error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulatedText += delta;
              setChatMap((prev) => ({
                ...prev,
                [char.id]: updatedWithPlaceholder.map((m) =>
                  m.id === botMsgId ? { ...m, text: accumulatedText } : m
                ),
              }));
            }
          } catch {
            // Ignore partial JSON chunk
          }
        }
      }

      if (!accumulatedText.trim()) {
        setChatMap((prev) => ({
          ...prev,
          [char.id]: updatedWithPlaceholder.map((m) =>
            m.id === botMsgId ? { ...m, text: '...' } : m
          ),
        }));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Groq API';
      setChatMap((prev) => ({
        ...prev,
        [char.id]: updatedWithPlaceholder.map((m) =>
          m.id === botMsgId ? { ...m, text: `[Error: ${errorMessage}]` } : m
        ),
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChat.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now(),
      sender: 'user',
      text: inputChat.trim(),
    };

    const nextHistory = [...messages, userMsg];
    setInputChat('');
    await streamAiResponse(nextHistory);
  };

  const handleRegenerate = async () => {
    if (isLoading || messages.length <= 1) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.sender !== 'char') return;

    const historyWithoutLast = messages.slice(0, -1);
    await streamAiResponse(historyWithoutLast);
  };

  const handleSaveEditMessage = async (msgId: number) => {
    if (!editingText.trim() || isLoading) return;
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    const truncatedHistory = messages.slice(0, msgIndex + 1).map((m, idx) =>
      idx === msgIndex ? { ...m, text: editingText.trim() } : m
    );

    setEditingMsgId(null);
    setEditingText('');
    await streamAiResponse(truncatedHistory);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 font-sans ${
        isDark
          ? 'bg-[#000000] text-white selection:bg-white selection:text-black'
          : 'bg-[#f8f8f8] text-black selection:bg-black selection:text-white'
      }`}
    >
      {/* ================= FLOATING TOAST NOTIFICATION ================= */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-md border shadow-2xl text-xs font-medium bg-white text-black border-black/20">
          <i className="fa-solid fa-circle-check text-xs" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ================= CUSTOM POPUP MODAL ================= */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div
            className={`w-full max-w-sm rounded-lg border p-6 shadow-2xl space-y-4 ${
              isDark
                ? 'bg-[#0d0d0d] border-white/15 text-white'
                : 'bg-white border-black/15 text-black'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 border ${
                  isDark ? 'bg-white/5 border-white/15' : 'bg-black/5 border-black/15'
                }`}
              >
                <i className="fa-solid fa-triangle-exclamation text-sm" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {modalType === 'reset_data'
                    ? 'Factory Reset All Data?'
                    : modalType === 'delete_char'
                    ? `Delete ${char.name}?`
                    : 'Clear Chat History?'}
                </h3>
                <p className="text-[11px] text-neutral-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              {modalType === 'reset_data'
                ? 'This will restore default characters (Almeera & Shaarki) and erase all custom slots and chat logs.'
                : modalType === 'delete_char'
                ? `Are you sure you want to permanently remove "${char.name}" from your character roster?`
                : `This will delete all current messages and restart the conversation with ${char.name} from the greeting message.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className={`px-3.5 py-2 rounded-md text-xs font-medium border transition cursor-pointer ${
                  isDark
                    ? 'border-white/15 text-neutral-300 hover:bg-white/5'
                    : 'border-black/15 text-neutral-700 hover:bg-black/5'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModal}
                className={`px-4 py-2 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                <i className="fa-solid fa-check text-[11px]" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PAGE 0: LANDING PAGE (WELCOME SCREEN) ================= */}
      {currentPage === 'landing' && (
        <div className="relative min-h-screen flex flex-col justify-between overflow-hidden">
          {/* Subtle Architectural Grid Overlay */}
          <div
            className={`absolute inset-0 pointer-events-none ${
              isDark
                ? 'bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)]'
                : 'bg-[linear-gradient(to_right,#0000000a_1px,transparent_1px),linear-gradient(to_bottom,#0000000a_1px,transparent_1px)]'
            } bg-[size:32px_32px]`}
          />

          {/* Top Navigation Bar */}
          <nav
            className={`relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-5 flex items-center justify-between border-b ${
              isDark ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-sm flex items-center justify-center font-mono text-xs font-bold ${
                  isDark ? 'bg-white text-black' : 'bg-black text-white'
                }`}
              >
                AI
              </div>
              <span className="text-xs font-mono tracking-widest uppercase font-semibold">
                CHARACTER STUDIO
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle Theme"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className={`group w-9 h-9 rounded-md border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                  isDark
                    ? 'bg-[#0a0a0a] text-white border-white/15 hover:bg-white hover:text-black hover:border-white'
                    : 'bg-white text-black border-black/15 hover:bg-black hover:text-white hover:border-black'
                }`}
              >
                <i
                  className={`fa-solid ${
                    isDark ? 'fa-sun' : 'fa-moon'
                  } text-sm transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110`}
                />
              </button>
            </div>
          </nav>

          {/* Hero Section */}
          <main className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-12 md:py-20 space-y-14">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              {/* Left Column: Headline & CTA */}
              <div className="lg:col-span-7 space-y-6 text-left">
                <div
                  className={`inline-flex items-center px-3 py-1 text-[10px] font-mono tracking-widest uppercase ${
                    isDark
                  }`}
                >
                  <span/>
                  <span>NEXT-GEN ROLEPLAY & PERSONA ENGINE</span>
                </div>

                <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                  Craft Custom AI Personas.{' '}
                  <span className="text-neutral-500">Experience Living Dialogue.</span>
                </h1>

                <p className="text-xs sm:text-sm text-neutral-500 max-w-xl leading-relaxed">
                  Design unique characters with custom personalities, physical traits, and multi-language reasoning. Powered by ultra-low latency LLM streaming with zero API setup required.
                </p>

                {/* Primary & Secondary CTA Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage('create')}
                    className={`px-6 py-3.5 rounded-md text-xs sm:text-sm font-semibold transition duration-150 cursor-pointer flex items-center gap-2.5 shadow-lg ${
                      isDark
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-black text-white hover:bg-neutral-800'
                    }`}
                  >
                    <i className="fa-solid fa-comments" />
                    <span>Start Chatting</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage('chat')}
                    className={`px-5 py-3.5 rounded-md text-xs sm:text-sm font-medium border transition cursor-pointer flex items-center gap-2 ${
                      isDark
                        ? 'bg-[#0a0a0a] border-white/15 text-neutral-200 hover:border-white/40 hover:bg-white/5'
                        : 'bg-white border-black/15 text-neutral-800 hover:border-black/40 hover:bg-black/5'
                    }`}
                  >
                    <i className="fa-solid fa-bolt text-xs" />
                    <span>Quick Chat with {char.name}</span>
                  </button>
                </div>

                {/* Tech Specs Pills */}
                <div className="pt-4 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500 font-mono">
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-check" /> No Login Required
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-check" /> Real-Time Streaming
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="fa-solid fa-check" /> Multi-Language Support
                  </span>
                </div>
              </div>

              {/* Right Column: Interactive Live Character Preview Card */}
              <div className="lg:col-span-5">
                <div
                  className={`p-5 sm:p-6 rounded-lg border shadow-2xl space-y-4 ${
                    isDark ? 'bg-[#0a0a0a]/95 border-white/15' : 'bg-white/95 border-black/15'
                  }`}
                >
                  <div
                    className={`flex items-center justify-between border-b pb-3 ${
                      isDark ? 'border-white/10' : 'border-black/10'
                    }`}
                  >
                    <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase flex items-center gap-1.5">
                      LIVE PERSONA PREVIEW
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-sm border ${
                        isDark ? 'border-white/15 bg-white/5' : 'border-black/15 bg-black/5'
                      }`}
                    >
                      READY
                    </span>
                  </div>

                  {/* Active Character Preview */}
                  <div className="flex items-center gap-3.5">
                    <img
                      src={char.avatarUrl}
                      alt={char.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://placehold.co/100x100/18181b/ffffff?text=?';
                      }}
                      className={`w-14 h-14 rounded-md object-cover border shrink-0 ${
                        isDark ? 'border-white/20' : 'border-black/20'
                      }`}
                    />
                    <div className="min-w-0">
                      <h3 className="text-base font-bold truncate">{char.name}</h3>
                      <p className="text-[11px] text-neutral-500 font-mono truncate">{char.role}</p>
                    </div>
                  </div>

                  {/* Sample Dialogue Box */}
                  <div
                    className={`p-3.5 rounded-md border text-xs leading-relaxed ${
                      isDark
                        ? 'bg-[#111111] border-white/10 text-neutral-200'
                        : 'bg-neutral-50 border-black/10 text-neutral-800'
                    }`}
                  >
                    <FormattedMessage text={char.firstMessage} isDark={isDark} />
                  </div>

                  {/* Quick Switcher inside Preview */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
                      Select Preset Persona:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {characters.slice(0, 2).map((item) => {
                        const isSelected = item.id === char.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveCharId(item.id)}
                            className={`p-2 rounded-md border text-left transition flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? isDark
                                  ? 'border-white bg-[#181818]'
                                  : 'border-black bg-neutral-100'
                                : isDark
                                ? 'border-white/10 bg-[#0d0d0d] hover:border-white/30'
                                : 'border-black/10 bg-white hover:border-black/30'
                            }`}
                          >
                            <img
                              src={item.avatarUrl}
                              alt={item.name}
                              className="w-7 h-7 rounded-sm object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold truncate">{item.name}</p>
                              <p className="text-[9px] text-neutral-500 truncate">{item.role}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Feature Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div
                className={`p-5 rounded-lg border space-y-2 ${
                  isDark ? 'bg-[#0a0a0a]/90 border-white/10' : 'bg-white border-black/10'
                }`}
              >
                <div className="w-8 h-8 rounded-md border border-current/20 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-sliders" />
                </div>
                <h3 className="text-sm font-semibold">Custom Persona Architect</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Define physical appearance, personality traits, role relationships, and opening greetings with full creative freedom.
                </p>
              </div>

              <div
                className={`p-5 rounded-lg border space-y-2 ${
                  isDark ? 'bg-[#0a0a0a]/90 border-white/10' : 'bg-white border-black/10'
                }`}
              >
                <div className="w-8 h-8 rounded-md border border-current/20 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-bolt" />
                </div>
                <h3 className="text-sm font-semibold">Real-Time Token Streaming</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Powered by Groq Cloud LPU inference with multi-model selection, message editing, and instant response regeneration.
                </p>
              </div>

              <div
                className={`p-5 rounded-lg border space-y-2 ${
                  isDark ? 'bg-[#0a0a0a]/90 border-white/10' : 'bg-white border-black/10'
                }`}
              >
                <div className="w-8 h-8 rounded-md border border-current/20 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-share-nodes" />
                </div>
                <h3 className="text-sm font-semibold">Multi-Slot & Easy Sharing</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Save multiple characters locally in your browser, export JSON cards, or share custom persona links with a single click.
                </p>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer
            className={`relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 border-t flex items-center justify-center text-xs font-mono text-center ${
              isDark ? 'border-white/10 text-neutral-400' : 'border-black/10 text-neutral-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span>Designed & Developed by Alip Saefulloh</span>
            </div>
          </footer>
        </div>
      )}

      {/* ================= PAGE 1: CHARACTER CREATOR ================= */}
      {currentPage === 'create' && (
        <div className="max-w-4xl mx-auto px-4 py-6 sm:p-8 md:p-12 space-y-6 sm:space-y-8">
          
          {/* Header */}
          <header
            className={`flex flex-wrap items-center justify-between gap-4 border-b pb-5 ${
              isDark ? 'border-white/10' : 'border-black/10'
            }`}
          >
            <div>
              <button
                type="button"
                onClick={() => setCurrentPage('landing')}
                className="text-[10px] font-mono tracking-widest text-neutral-500 hover:text-current uppercase flex items-center gap-1.5 mb-1 cursor-pointer transition"
              >
                <i className="fa-solid fa-arrow-left" /> BACK TO HOME
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Character Creator
              </h1>
              <p className="text-xs text-neutral-500 mt-1">
                Customize your AI persona parameters before entering the chat room.
              </p>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareUrl}
                className={`px-3 py-2 rounded-md text-xs font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-[#0a0a0a] border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
                    : 'bg-white border-black/15 text-neutral-700 hover:text-black hover:border-black/40'
                }`}
                title="Copy Shareable Character Link"
              >
                <i className="fa-solid fa-share-nodes text-xs" />
                <span className="hidden sm:inline">Share Link</span>
              </button>

              <button
                type="button"
                onClick={() => setModalType('reset_data')}
                className={`px-3 py-2 rounded-md text-xs font-medium border transition flex items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-[#0a0a0a] border-white/15 text-neutral-300 hover:text-white hover:border-white/40'
                    : 'bg-white border-black/15 text-neutral-700 hover:text-black hover:border-black/40'
                }`}
                title="Factory Reset All Characters"
              >
                <i className="fa-solid fa-trash-can text-xs" />
                <span className="hidden sm:inline">Reset Default</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle Theme"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className={`group w-9 h-9 rounded-md border transition-all duration-200 flex items-center justify-center cursor-pointer ${
                  isDark
                    ? 'bg-[#0a0a0a] text-white border-white/15 hover:bg-white hover:text-black hover:border-white'
                    : 'bg-white text-black border-black/15 hover:bg-black hover:text-white hover:border-black'
                }`}
              >
                <i
                  className={`fa-solid ${
                    isDark ? 'fa-sun' : 'fa-moon'
                  } text-sm transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110`}
                />
              </button>
            </div>
          </header>

          {/* ================= MULTI-CHARACTER SLOTS BAR ================= */}
          <div
            className={`p-4 sm:p-5 border rounded-lg space-y-3 ${
              isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10 shadow-xs'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <i className="fa-solid fa-users" /> Saved Character Slots ({characters.length})
              </span>

              <div className="flex items-center gap-2">
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportCharacterJson}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importFileRef.current?.click()}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                    isDark
                      ? 'border-white/15 text-neutral-300 hover:bg-white/5'
                      : 'border-black/15 text-neutral-700 hover:bg-black/5'
                  }`}
                >
                  <i className="fa-solid fa-file-import" />
                  <span>Import JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCharacterJson}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                    isDark
                      ? 'border-white/15 text-neutral-300 hover:bg-white/5'
                      : 'border-black/15 text-neutral-700 hover:bg-black/5'
                  }`}
                >
                  <i className="fa-solid fa-file-export" />
                  <span>Export JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateNewCharacter}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    isDark
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-black text-white hover:bg-neutral-800'
                  }`}
                >
                  <i className="fa-solid fa-plus" />
                  <span>New Slot</span>
                </button>
              </div>
            </div>

            {/* Character Cards List */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
              {characters.map((item) => {
                const isActive = item.id === char.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveCharId(item.id)}
                    className={`group relative p-2.5 rounded-md border flex items-center gap-2.5 cursor-pointer transition ${
                      isActive
                        ? isDark
                          ? 'border-white bg-[#181818]'
                          : 'border-black bg-neutral-100'
                        : isDark
                        ? 'border-white/10 bg-[#101010] hover:border-white/30'
                        : 'border-black/10 bg-neutral-50 hover:border-black/30'
                    }`}
                  >
                    <img
                      src={item.avatarUrl}
                      alt={item.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://placehold.co/100x100/18181b/ffffff?text=?';
                      }}
                      className="w-9 h-9 rounded-sm object-cover shrink-0 border border-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{item.name}</p>
                      <p className="text-[10px] text-neutral-500 truncate">{item.role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleStartChat} className="space-y-6">
            
            {/* Avatar Upload Section */}
            <div
              className={`p-5 sm:p-6 border rounded-lg flex flex-col sm:flex-row items-center gap-5 ${
                isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10 shadow-xs'
              }`}
            >
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 shrink-0 border rounded-lg overflow-hidden flex items-center justify-center ${
                  isDark ? 'bg-neutral-900 border-white/15' : 'bg-neutral-100 border-black/15'
                }`}
              >
                {char.avatarUrl ? (
                  <img src={char.avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <i className="fa-solid fa-user text-2xl text-neutral-500" />
                )}
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1 w-full">
                <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
                  <label className="text-xs font-semibold flex items-center gap-1.5">
                    <i className="fa-solid fa-camera" /> Character Avatar (Square Ratio)
                  </label>
                  {characters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setModalType('delete_char')}
                      className="text-[11px] text-neutral-400 hover:text-red-400 transition flex items-center gap-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-trash text-[10px]" /> Delete Slot
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Upload an image from your device. Stored locally in your browser session.
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className={`w-full sm:w-auto text-xs text-neutral-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:text-xs file:font-medium cursor-pointer ${
                    isDark
                      ? 'file:border-white/20 file:bg-white file:text-black hover:file:bg-neutral-200'
                      : 'file:border-black/20 file:bg-black file:text-white hover:file:bg-neutral-800'
                  }`}
                />
              </div>
            </div>

            {/* Persona Identity Parameters */}
            <div
              className={`p-5 sm:p-6 border rounded-lg space-y-4 ${
                isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10 shadow-xs'
              }`}
            >
              <h2
                className={`text-xs font-semibold tracking-wider text-neutral-500 uppercase border-b pb-3 flex items-center gap-2 ${
                  isDark ? 'border-white/10' : 'border-black/10'
                }`}
              >
                <i className="fa-solid fa-id-card" /> Persona Identity (Any Language Supported)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5">Character Name</label>
                  <input
                    type="text"
                    name="name"
                    value={char.name}
                    onChange={handleChange}
                    required
                    className={`w-full border rounded-md px-3 py-2 text-xs outline-none transition ${
                      isDark
                        ? 'bg-[#111111] border-white/10 focus:border-white text-white'
                        : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">Role / Relationship</label>
                  <input
                    type="text"
                    name="role"
                    value={char.role}
                    onChange={handleChange}
                    className={`w-full border rounded-md px-3 py-2 text-xs outline-none transition ${
                      isDark
                        ? 'bg-[#111111] border-white/10 focus:border-white text-white'
                        : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Physical Appearance</label>
                <textarea
                  name="appearance"
                  value={char.appearance}
                  onChange={handleChange}
                  rows={2}
                  className={`w-full border rounded-md px-3 py-2 text-xs outline-none transition resize-none leading-relaxed ${
                    isDark
                      ? 'bg-[#111111] border-white/10 focus:border-white text-white'
                      : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Personality & Traits</label>
                <textarea
                  name="personality"
                  value={char.personality}
                  onChange={handleChange}
                  rows={3}
                  className={`w-full border rounded-md px-3 py-2 text-xs outline-none transition resize-none leading-relaxed ${
                    isDark
                      ? 'bg-[#111111] border-white/10 focus:border-white text-white'
                      : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Opening Greeting (First Message)</label>
                <textarea
                  name="firstMessage"
                  value={char.firstMessage}
                  onChange={handleChange}
                  rows={2}
                  className={`w-full border rounded-md px-3 py-2 text-xs outline-none transition resize-none leading-relaxed ${
                    isDark
                      ? 'bg-[#111111] border-white/10 focus:border-white text-white'
                      : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                  }`}
                />
              </div>
            </div>

            {/* Language & AI Model Configuration */}
            <div
              className={`p-5 sm:p-6 border rounded-lg space-y-5 ${
                isDark ? 'bg-[#0a0a0a] border-white/10' : 'bg-white border-black/10 shadow-xs'
              }`}
            >
              <h2
                className={`text-xs font-semibold tracking-wider text-neutral-500 uppercase border-b pb-3 flex items-center gap-2 ${
                  isDark ? 'border-white/10' : 'border-black/10'
                }`}
              >
                <i className="fa-solid fa-sliders" /> Language & Reasoning Engine
              </h2>

              <div className="space-y-2">
                <label className="block text-xs font-medium flex items-center gap-1.5">
                  <i className="fa-solid fa-language text-neutral-400" /> Character Response Language
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={responseLang}
                    onChange={(e) => setResponseLang(e.target.value)}
                    className={`w-full border rounded-md px-3 py-2 text-xs outline-none transition cursor-pointer ${
                      isDark
                        ? 'bg-[#111111] border-white/10 focus:border-white text-white'
                        : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                    }`}
                  >
                    {LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {responseLang === 'Custom' && (
                    <input
                      type="text"
                      value={customLang}
                      onChange={(e) => setCustomLang(e.target.value)}
                      placeholder="Type any language (e.g. Sundanese, French)..."
                      className={`w-full border rounded-md px-3 py-2 text-xs outline-none transition ${
                        isDark
                          ? 'bg-[#111111] border-white/10 focus:border-white text-white'
                          : 'bg-neutral-50 border-black/15 focus:border-black text-black'
                      }`}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium flex items-center gap-1.5">
                  <i className="fa-solid fa-microchip text-neutral-400" /> Select LLM Model
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {CURATED_MODELS.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <label
                        key={m.id}
                        className={`flex items-start gap-3 p-3.5 rounded-md border cursor-pointer transition ${
                          isSelected
                            ? isDark
                              ? 'border-white bg-[#161616]'
                              : 'border-black bg-neutral-100'
                            : isDark
                            ? 'border-white/10 bg-[#0a0a0a] hover:border-white/30'
                            : 'border-black/10 bg-white hover:border-black/30'
                        }`}
                      >
                        <input
                          type="radio"
                          name="modelChoice"
                          value={m.id}
                          checked={isSelected}
                          onChange={() => setSelectedModel(m.id)}
                          className="mt-0.5 accent-current"
                        />
                        <div>
                          <span className="text-xs font-semibold block">{m.name}</span>
                          <span className="text-[11px] text-neutral-500">{m.desc}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-3.5 font-semibold text-xs rounded-md transition duration-150 cursor-pointer flex items-center justify-center gap-2 ${
                isDark
                  ? 'bg-white hover:bg-neutral-200 text-black'
                  : 'bg-black hover:bg-neutral-800 text-white'
              }`}
            >
              <i className="fa-solid fa-comments" />
              <span>Save & Enter Chat Room with {char.name}</span>
            </button>
          </form>

        </div>
      )}

      {/* ================= PAGE 2: CHAT ROOM ================= */}
      {currentPage === 'chat' && (
        <div
          className={`h-[100dvh] flex flex-col max-w-4xl mx-auto sm:border-x ${
            isDark ? 'border-white/10 bg-[#000000]' : 'border-black/10 bg-white'
          }`}
        >
          {/* Chat Room Header */}
          <div
            className={`px-3 py-2.5 sm:px-4 sm:py-3.5 border-b flex items-center justify-between gap-2 shrink-0 ${
              isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-black/10 bg-neutral-50'
            }`}
          >
            {/* Character Switcher & Info */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <img
                src={char.avatarUrl}
                alt={char.name}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://placehold.co/100x100/18181b/ffffff?text=?';
                }}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-md object-cover border shrink-0 ${
                  isDark ? 'border-white/20' : 'border-black/20'
                }`}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <select
                    value={char.id}
                    onChange={(e) => setActiveCharId(e.target.value)}
                    disabled={isLoading}
                    className={`text-xs sm:text-sm font-semibold rounded px-1 py-0.5 outline-none cursor-pointer truncate ${
                      isDark ? 'bg-transparent text-white' : 'bg-transparent text-black'
                    }`}
                    title="Quick Switch Character"
                  >
                    {characters.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        className={isDark ? 'bg-[#111111] text-white' : 'bg-white text-black'}
                      >
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono tracking-wider block truncate px-1">
                  {char.role}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle Theme"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className={`group w-8 h-8 sm:w-9 sm:h-9 rounded-md border flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isDark
                    ? 'bg-[#141414] border-white/20 text-white hover:bg-white hover:text-black hover:border-white'
                    : 'bg-white border-black/20 text-black hover:bg-black hover:text-white hover:border-black'
                }`}
              >
                <i
                  className={`fa-solid ${
                    isDark ? 'fa-sun' : 'fa-moon'
                  } text-xs sm:text-sm transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110`}
                />
              </button>

              <button
                type="button"
                onClick={handleExportChatTxt}
                title="Download Chat Log (.txt)"
                className={`w-8 h-8 sm:w-auto sm:px-2.5 sm:h-9 rounded-md border text-[11px] font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-[#141414] border-white/20 text-neutral-200 hover:bg-white/10'
                    : 'bg-white border-black/20 text-neutral-800 hover:bg-black/5'
                }`}
              >
                <i className="fa-solid fa-download text-xs" />
                <span className="hidden md:inline text-xs">Export</span>
              </button>

              <button
                type="button"
                onClick={() => setModalType('reset_chat')}
                title="Reset Conversation"
                className={`px-2.5 h-8 sm:h-9 rounded-md border text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-[#141414] border-white/20 text-neutral-200 hover:bg-white/10'
                    : 'bg-white border-black/20 text-neutral-800 hover:bg-black/5'
                }`}
              >
                <i className="fa-solid fa-rotate-left text-xs" />
                <span className="text-[10px] sm:text-xs">Reset</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage('create')}
                title="Edit Character"
                className={`px-2.5 sm:px-3 h-8 sm:h-9 rounded-md text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-black text-white hover:bg-neutral-800'
                }`}
              >
                <i className="fa-solid fa-pen-to-square text-xs" />
                <span className="text-[10px] sm:text-xs">Studio</span>
              </button>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            {messages.map((msg, index) => {
              const isLastMessage = index === messages.length - 1;
              const isEditingThis = editingMsgId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`group flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-md px-3.5 py-2.5 sm:px-4 sm:py-3 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? isDark
                          ? 'bg-white text-black font-normal'
                          : 'bg-black text-white font-normal'
                        : isDark
                        ? 'bg-[#0f0f0f] text-neutral-100 border border-white/10'
                        : 'bg-neutral-100 text-neutral-900 border border-black/10'
                    }`}
                  >
                    {isEditingThis ? (
                      <div className="space-y-2 min-w-[220px] sm:min-w-[300px]">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={2}
                          className={`w-full rounded p-2 text-xs border outline-none resize-none ${
                            isDark
                              ? 'bg-black text-white border-white/20'
                              : 'bg-white text-black border-black/20'
                          }`}
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMsgId(null)}
                            className="px-2 py-1 rounded text-[10px] border border-current opacity-70 hover:opacity-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditMessage(msg.id)}
                            className={`px-2.5 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                              isDark ? 'bg-black text-white' : 'bg-white text-black'
                            }`}
                          >
                            Save & Resend
                          </button>
                        </div>
                      </div>
                    ) : msg.sender === 'char' ? (
                      msg.text ? (
                        <FormattedMessage text={msg.text} isDark={isDark} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-neutral-500 font-mono text-[11px]">
                          <i className="fa-solid fa-circle-notch fa-spin text-xs" />
                          {char.name} is thinking...
                        </span>
                      )
                    ) : (
                      <span>{msg.text}</span>
                    )}
                  </div>

                  {/* Message Action Controls */}
                  {!isLoading && !isEditingThis && (
                    <div className="flex items-center gap-2 mt-1 px-1 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {msg.sender === 'user' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMsgId(msg.id);
                            setEditingText(msg.text);
                          }}
                          className="text-[10px] text-neutral-500 hover:text-current flex items-center gap-1 cursor-pointer"
                          title="Edit and branch conversation from here"
                        >
                          <i className="fa-solid fa-pen text-[9px]" /> Edit
                        </button>
                      )}

                      {msg.sender === 'char' && isLastMessage && index > 0 && (
                        <button
                          type="button"
                          onClick={handleRegenerate}
                          className="text-[10px] text-neutral-500 hover:text-current flex items-center gap-1 cursor-pointer"
                          title="Regenerate response"
                        >
                          <i className="fa-solid fa-arrows-rotate text-[9px]" /> Regenerate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className={`p-3 sm:p-4 border-t flex gap-2 shrink-0 ${
              isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-black/10 bg-neutral-50'
            }`}
          >
            <input
              type="text"
              value={inputChat}
              onChange={(e) => setInputChat(e.target.value)}
              placeholder={`Message ${char.name}...`}
              disabled={isLoading}
              className={`flex-1 border rounded-md px-3.5 py-2.5 text-xs outline-none transition disabled:opacity-50 ${
                isDark
                  ? 'bg-[#141414] border-white/15 focus:border-white text-white'
                  : 'bg-white border-black/15 focus:border-black text-black'
              }`}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 sm:px-5 py-2.5 font-semibold rounded-md text-xs transition cursor-pointer flex items-center gap-2 disabled:opacity-40 ${
                isDark
                  ? 'bg-white hover:bg-neutral-200 text-black'
                  : 'bg-black hover:bg-neutral-800 text-white'
              }`}
            >
              <span>Send</span>
              <i className="fa-solid fa-paper-plane text-xs" />
            </button>
          </form>

        </div>
      )}
    </div>
  );
}