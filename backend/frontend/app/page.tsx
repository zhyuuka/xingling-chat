# 杏铃酱 xingling-chat 核心代码
# Copyright (c) 2026 你的昵称/署名
# 开源协议：MIT License，使用需保留原作者署名，商用需获得授权

"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Send, User, Bot, Pencil, Menu, X, Plus, Trash2, Eraser, Settings, Globe, Upload, MessageSquare
} from "lucide-react";
import Cropper, { Area } from "react-easy-crop";
import Modal from "react-modal";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  reasoning?: string;
}

interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  systemPrompt?: string; // 新增：会话独立系统提示词
}

interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string; // 全局默认提示词
}

interface SearchConfig {
  enabled: boolean;
  provider: "tavily" | "google_serper";
  apiKey: string;
  resultCount: number;
}

export default function Home() {
  const defaultSession: Session = {
    id: "default",
    name: "默认会话",
    messages: [],
    createdAt: 0,
    systemPrompt: "你是一个友善的AI助手，名叫杏铃酱。",
  };

  const [sessions, setSessions] = useState<Session[]>([defaultSession]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("default");
  const [messages, setMessages] = useState<Message[]>([]);
  const prevSessionIdRef = useRef(currentSessionId);

  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    systemPrompt: "你是一个友善的AI助手，名叫杏铃酱。",
  });

  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    enabled: false,
    provider: "tavily",
    apiKey: "",
    resultCount: 3,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [assistantName, setAssistantName] = useState("杏铃酱");
  const [assistantAvatar, setAssistantAvatar] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(assistantName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [userName, setUserName] = useState("我");
  const [userAvatar, setUserAvatar] = useState("");
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [editUserNameInput, setEditUserNameInput] = useState(userName);
  const userNameInputRef = useRef<HTMLInputElement>(null);

  const [wallpaper, setWallpaper] = useState("");

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [showReasoning, setShowReasoning] = useState(true);
  const [showCredits, setShowCredits] = useState(false);

  // 新增：编辑会话提示词相关状态
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState("");
  const [showPromptModal, setShowPromptModal] = useState(false);

  useEffect(() => {
    Modal.setAppElement('body');
  }, []);

  // 加载 localStorage 数据
  useEffect(() => {
    const storedSessions = localStorage.getItem("chatSessions");
    if (storedSessions) {
      const parsed = JSON.parse(storedSessions);
      // 确保旧数据有 systemPrompt 字段（若没有则补默认值）
      const migrated = parsed.map((s: any) => ({
        ...s,
        systemPrompt: s.systemPrompt || apiConfig.systemPrompt,
      }));
      setSessions(migrated);
      const storedId = localStorage.getItem("currentSessionId");
      if (storedId && migrated.some((s: Session) => s.id === storedId)) {
        setCurrentSessionId(storedId);
      } else if (migrated.length > 0) {
        setCurrentSessionId(migrated[0].id);
      }
    } else {
      localStorage.setItem("chatSessions", JSON.stringify([defaultSession]));
      localStorage.setItem("currentSessionId", "default");
    }

    const savedName = localStorage.getItem("assistantName");
    const savedAvatar = localStorage.getItem("assistantAvatar");
    const savedWallpaper = localStorage.getItem("chatWallpaper");
    const savedUserName = localStorage.getItem("userName");
    const savedUserAvatar = localStorage.getItem("userAvatar");
    const savedApiConfig = localStorage.getItem("apiConfig");
    const savedSearchConfig = localStorage.getItem("searchConfig");
    const savedShowReasoning = localStorage.getItem("showReasoning");

    if (savedName) setAssistantName(savedName);
    if (savedAvatar) setAssistantAvatar(savedAvatar);
    if (savedWallpaper) setWallpaper(savedWallpaper);
    if (savedUserName) setUserName(savedUserName);
    if (savedUserAvatar) setUserAvatar(savedUserAvatar);
    if (savedApiConfig) setApiConfig(JSON.parse(savedApiConfig));
    if (savedSearchConfig) setSearchConfig(JSON.parse(savedSearchConfig));
    if (savedShowReasoning !== null) setShowReasoning(savedShowReasoning === "true");
  }, []);

  // 同步当前会话消息
  useEffect(() => {
    if (currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        if (prevSessionIdRef.current !== currentSessionId) {
          setMessages(session.messages);
          prevSessionIdRef.current = currentSessionId;
        }
      } else if (sessions.length > 0) {
        setCurrentSessionId(sessions[0].id);
      }
    }
  }, [currentSessionId, sessions]);

  // 保存消息到会话
  useEffect(() => {
    if (currentSessionId) {
      setSessions(prev => {
        const currentSession = prev.find(s => s.id === currentSessionId);
        if (currentSession && JSON.stringify(currentSession.messages) === JSON.stringify(messages)) {
          return prev;
        }
        const updated = prev.map(s =>
          s.id === currentSessionId ? { ...s, messages } : s
        );
        localStorage.setItem("chatSessions", JSON.stringify(updated));
        return updated;
      });
    }
  }, [messages, currentSessionId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 会话操作
  const createNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      name: `新对话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now(),
      systemPrompt: apiConfig.systemPrompt, // 继承当前全局提示词
    };
    setSessions(prev => {
      const updated = [...prev, newSession];
      localStorage.setItem("chatSessions", JSON.stringify(updated));
      return updated;
    });
    setCurrentSessionId(newSession.id);
    localStorage.setItem("currentSessionId", newSession.id);
  };

  const switchSession = (id: string) => {
    setCurrentSessionId(id);
    localStorage.setItem("currentSessionId", id);
  };

  const deleteSession = (id: string) => {
    if (sessions.length <= 1) {
      alert("至少保留一个会话");
      return;
    }
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      localStorage.setItem("chatSessions", JSON.stringify(filtered));
      return filtered;
    });
    if (currentSessionId === id) {
      const newId = sessions.find(s => s.id !== id)!.id;
      setCurrentSessionId(newId);
      localStorage.setItem("currentSessionId", newId);
    }
  };

  const startRenaming = (id: string, currentName: string) => {
    setRenamingSessionId(id);
    setNewSessionName(currentName);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const saveRenaming = () => {
    if (renamingSessionId && newSessionName.trim()) {
      setSessions(prev => {
        const updated = prev.map(s =>
          s.id === renamingSessionId ? { ...s, name: newSessionName.trim() } : s
        );
        localStorage.setItem("chatSessions", JSON.stringify(updated));
        return updated;
      });
      setRenamingSessionId(null);
    }
  };

  const clearCurrentSessionMessages = async () => {
    if (!currentSessionId) return;
    setMessages([]);
    try {
      await axios.post("http://localhost:8000/clear_session", {
        session_id: currentSessionId
      });
    } catch (error) {
      console.error("清空后端记忆失败", error);
    }
  };

  const deleteMessage = (index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  };

  const exportSessions = () => {
    const data = {
      sessions,
      currentSessionId,
      assistantName,
      assistantAvatar,
      userName,
      userAvatar,
      wallpaper,
      apiConfig,
      searchConfig,
      showReasoning,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xingling-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSessions = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          // 迁移旧数据：确保每个会话有 systemPrompt
          const migratedSessions = (data.sessions || []).map((s: any) => ({
            ...s,
            systemPrompt: s.systemPrompt || apiConfig.systemPrompt,
          }));
          setSessions(migratedSessions);
          setCurrentSessionId(data.currentSessionId || "default");
          setAssistantName(data.assistantName || "杏铃酱");
          setAssistantAvatar(data.assistantAvatar || "");
          setUserName(data.userName || "我");
          setUserAvatar(data.userAvatar || "");
          setWallpaper(data.wallpaper || "");
          setApiConfig(data.apiConfig || { apiKey: "", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", systemPrompt: "你是一个友善的AI助手，名叫杏铃酱。" });
          setSearchConfig(data.searchConfig || { enabled: false, provider: "tavily", apiKey: "", resultCount: 3 });
          if (data.showReasoning !== undefined) setShowReasoning(data.showReasoning);
          localStorage.setItem("chatSessions", JSON.stringify(migratedSessions));
          localStorage.setItem("currentSessionId", data.currentSessionId || "default");
          localStorage.setItem("assistantName", data.assistantName || "杏铃酱");
          localStorage.setItem("assistantAvatar", data.assistantAvatar || "");
          localStorage.setItem("userName", data.userName || "我");
          localStorage.setItem("userAvatar", data.userAvatar || "");
          localStorage.setItem("chatWallpaper", data.wallpaper || "");
          localStorage.setItem("apiConfig", JSON.stringify(data.apiConfig || {}));
          localStorage.setItem("searchConfig", JSON.stringify(data.searchConfig || {}));
          localStorage.setItem("showReasoning", data.showReasoning ? "true" : "false");
          alert("导入成功！");
        } catch (error) {
          alert("导入失败：文件格式错误");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 流式发送消息
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      const sessionSystemPrompt = currentSession?.systemPrompt ?? apiConfig.systemPrompt;

      const storedApiConfig = localStorage.getItem('apiConfig');
      const currentApiConfig = storedApiConfig ? JSON.parse(storedApiConfig) : apiConfig;
      const storedSearchConfig = localStorage.getItem('searchConfig');
      const currentSearchConfig = storedSearchConfig ? JSON.parse(storedSearchConfig) : searchConfig;

      const requestBody = {
        message: input,
        session_id: currentSessionId,
        api_key: currentApiConfig.apiKey || null,
        base_url: currentApiConfig.baseUrl || null,
        model: currentApiConfig.model || null,
        system_prompt: sessionSystemPrompt, // 使用会话专属提示词
        search_enabled: currentSearchConfig.enabled,
        search_provider: currentSearchConfig.provider,
        search_api_key: currentSearchConfig.apiKey || null,
        search_result_count: currentSearchConfig.resultCount,
      };

      const response = await fetch("http://localhost:8000/chat_stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let currentReasoning = "";
      let assistantContent = "";

      const tempMsg: Message = { role: "assistant", content: "", reasoning: "", timestamp: Date.now() };
      setMessages(prev => [...prev, tempMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'reasoning') {
                  currentReasoning += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex].role === "assistant") {
                      newMessages[lastIndex] = { ...newMessages[lastIndex], reasoning: currentReasoning };
                    }
                    return newMessages;
                  });
                } else if (data.type === 'content') {
                  assistantContent += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex].role === "assistant") {
                      newMessages[lastIndex] = { ...newMessages[lastIndex], content: assistantContent };
                    }
                    return newMessages;
                  });
                } else if (data.type === 'error') {
                  console.error("Stream error:", data.content);
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", jsonStr, e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("API error:", error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "（发生错误，请稍后重试）",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 文件上传处理函数
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploading(true);

    try {
      const currentSession = sessions.find(s => s.id === currentSessionId);
      const sessionSystemPrompt = currentSession?.systemPrompt ?? apiConfig.systemPrompt;

      const storedApiConfig = localStorage.getItem('apiConfig');
      const currentApiConfig = storedApiConfig ? JSON.parse(storedApiConfig) : apiConfig;
      const storedSearchConfig = localStorage.getItem('searchConfig');
      const currentSearchConfig = storedSearchConfig ? JSON.parse(storedSearchConfig) : searchConfig;

      const formData = new FormData();
      formData.append("session_id", currentSessionId);
      formData.append("file", file);
      if (currentApiConfig.apiKey) formData.append("api_key", currentApiConfig.apiKey);
      if (currentApiConfig.baseUrl) formData.append("base_url", currentApiConfig.baseUrl);
      if (currentApiConfig.model) formData.append("model", currentApiConfig.model);
      if (sessionSystemPrompt) formData.append("system_prompt", sessionSystemPrompt);
      if (currentSearchConfig.enabled) formData.append("search_enabled", "true");
      formData.append("search_provider", currentSearchConfig.provider);
      if (currentSearchConfig.apiKey) formData.append("search_api_key", currentSearchConfig.apiKey);
      formData.append("search_result_count", String(currentSearchConfig.resultCount));

      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.body) throw new Error("No response body");

      const userMsg: Message = {
        role: "user",
        content: `📎 上传文件：${file.name}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let assistantContent = "";

      const tempMsg: Message = { role: "assistant", content: "", timestamp: Date.now() };
      setMessages(prev => [...prev, tempMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'content') {
                  assistantContent += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex].role === "assistant") {
                      newMessages[lastIndex] = { ...newMessages[lastIndex], content: assistantContent };
                    }
                    return newMessages;
                  });
                } else if (data.type === 'error') {
                  console.error("Stream error:", data.content);
                }
              } catch (err) {}
            }
          }
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "（文件上传或分析失败）", timestamp: Date.now() },
      ]);
    } finally {
      setUploading(false);
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  // 编辑会话提示词相关函数
  const openSystemPromptEditor = (sessionId: string, currentPrompt: string) => {
    setEditingSessionId(sessionId);
    setEditingPrompt(currentPrompt);
    setShowPromptModal(true);
  };

  const saveSystemPrompt = () => {
    if (!editingSessionId) return;
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === editingSessionId ? { ...s, systemPrompt: editingPrompt } : s
      );
      localStorage.setItem("chatSessions", JSON.stringify(updated));
      return updated;
    });
    setShowPromptModal(false);
    setEditingSessionId(null);
  };

  const saveApiConfig = (newConfig: ApiConfig) => {
    setApiConfig(newConfig);
    localStorage.setItem("apiConfig", JSON.stringify(newConfig));
  };

  const saveSearchConfig = (newConfig: SearchConfig) => {
    setSearchConfig(newConfig);
    localStorage.setItem("searchConfig", JSON.stringify(newConfig));
  };

  const handleSaveSettings = () => {
    saveApiConfig(apiConfig);
    saveSearchConfig(searchConfig);
    setShowSettings(false);
  };

  // 头像/壁纸上传裁剪
  const handleAvatarClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const getCroppedImg = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    const image = await createImage(cropImageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );
    const base64 = canvas.toDataURL("image/jpeg");
    setAssistantAvatar(base64);
    localStorage.setItem("assistantAvatar", base64);
    setCropModalOpen(false);
    setCropImageSrc(null);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", reject);
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const handleWallpaperClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setWallpaper(base64);
        localStorage.setItem("chatWallpaper", base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleUserAvatarClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUserAvatar(base64);
        localStorage.setItem("userAvatar", base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const saveName = (newName: string) => {
    setAssistantName(newName);
    localStorage.setItem("assistantName", newName);
    setIsEditingName(false);
  };

  const saveUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem("userName", newName);
    setIsEditingUserName(false);
  };

  return (
    <div className="flex h-screen dark">
      <style jsx global>{`
        :root { color-scheme: dark; }
        body { background-color: #111827; color: #f9fafb; }
      `}</style>
      
      {/* 侧边栏 */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-gray-900 border-r border-gray-700 flex flex-col`}>
        <div className="p-4 flex justify-between items-center">
          <h2 className="font-bold text-gray-300">对话列表</h2>
          <div className="flex gap-1">
            <button onClick={createNewSession} className="p-1 hover:bg-gray-800 rounded text-gray-300" title="新建对话"><Plus size={16} /></button>
            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-800 rounded text-gray-300" title="收起侧边栏"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`p-2 mb-1 rounded cursor-pointer flex justify-between items-center ${
                session.id === currentSessionId ? 'bg-blue-900' : 'bg-gray-800 hover:bg-gray-700'
              }`}
              onClick={() => switchSession(session.id)}
            >
              {renamingSessionId === session.id ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  onBlur={saveRenaming}
                  onKeyDown={(e) => e.key === "Enter" && saveRenaming()}
                  className="flex-1 bg-transparent border-b border-gray-500 outline-none text-sm text-white"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span suppressHydrationWarning className="truncate text-sm flex-1 text-gray-300">{session.name}</span>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => startRenaming(session.id, session.name)}
                      className="text-gray-400 hover:text-blue-500"
                      title="重命名"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSystemPromptEditor(session.id, session.systemPrompt || apiConfig.systemPrompt);
                      }}
                      className="text-gray-400 hover:text-blue-500"
                      title="编辑会话提示词"
                    >
                      <MessageSquare size={14} />
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="text-gray-400 hover:text-red-500"
                      title="删除对话"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {sidebarOpen && (
          <div className="p-4 border-t border-gray-700 space-y-2">
            <button onClick={clearCurrentSessionMessages} className="w-full flex items-center justify-center gap-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
              <Eraser size={16} /> 清空当前对话
            </button>
            <button onClick={exportSessions} className="w-full flex items-center justify-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              ⬇️ 导出会话
            </button>
            <button onClick={importSessions} className="w-full flex items-center justify-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              ⬆️ 导入会话
            </button>
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-full hover:bg-gray-700 mr-2 text-gray-300"><Menu size={20} /></button>}
            <div onClick={handleAvatarClick} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white cursor-pointer hover:opacity-80 transition" title="点击更换头像">
              {assistantAvatar ? <img src={assistantAvatar} alt="avatar" className="w-full h-full rounded-full object-cover" /> : <Bot size={24} />}
            </div>
            {isEditingName ? (
              <input ref={nameInputRef} type="text" value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} onBlur={() => saveName(editNameInput)} onKeyDown={(e) => e.key === "Enter" && saveName(editNameInput)} className="text-xl font-bold bg-transparent border-b border-gray-500 outline-none text-white w-32" autoFocus />
            ) : (
              <h1 suppressHydrationWarning className="text-xl font-bold text-white cursor-pointer hover:underline flex items-center gap-1" onDoubleClick={() => { setEditNameInput(assistantName); setIsEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }} title="双击修改名字">
                {assistantName} <Pencil size={16} className="text-gray-400" />
              </h1>
            )}
            <div className="flex items-center gap-2 ml-4">
              <div onClick={handleUserAvatarClick} className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white cursor-pointer hover:opacity-80 transition" title="点击更换你的头像">
                {userAvatar ? <img src={userAvatar} alt="user avatar" className="w-full h-full rounded-full object-cover" /> : <User size={20} />}
              </div>
              {isEditingUserName ? (
                <input ref={userNameInputRef} type="text" value={editUserNameInput} onChange={(e) => setEditUserNameInput(e.target.value)} onBlur={() => saveUserName(editUserNameInput)} onKeyDown={(e) => e.key === "Enter" && saveUserName(editUserNameInput)} className="text-md bg-transparent border-b border-gray-500 outline-none text-white w-20" autoFocus />
              ) : (
                <span suppressHydrationWarning className="text-md text-white cursor-pointer hover:underline" onDoubleClick={() => { setEditUserNameInput(userName); setIsEditingUserName(true); setTimeout(() => userNameInputRef.current?.focus(), 0); }} title="双击修改名字">
                  {userName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showReasoning}
                onChange={(e) => {
                  setShowReasoning(e.target.checked);
                  localStorage.setItem("showReasoning", e.target.checked ? "true" : "false");
                }}
                className="rounded bg-gray-800 border-gray-600"
              />
              显示思考
            </label>
            <button onClick={() => setSearchConfig(prev => ({ ...prev, enabled: !prev.enabled }))} className={`p-2 rounded-full hover:bg-gray-700 relative ${searchConfig.enabled ? 'text-blue-400' : 'text-gray-400'}`} title={searchConfig.enabled ? "联网搜索已开启" : "联网搜索已关闭"}>
              <Globe size={20} />
              {searchConfig.enabled && <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full"></span>}
            </button>
            <button onClick={handleWallpaperClick} className="p-2 rounded-full hover:bg-gray-700 relative text-gray-400" title="更换聊天背景">🌄</button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-700 text-gray-400" title="设置"><Settings size={20} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : 'none', backgroundColor: wallpaper ? 'transparent' : '#111827' }}>
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500">开始和{assistantName}聊天吧 ✦</div>
          )}
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div key={idx} id={`msg-${idx}`} className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[70%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-green-600 ml-2" : "bg-blue-600 mr-2"}`}>
                    {isUser ? (userAvatar ? <img src={userAvatar} alt="user" className="w-full h-full rounded-full object-cover" /> : <User size={16} className="text-white" />) : (assistantAvatar ? <img src={assistantAvatar} alt="assistant" className="w-full h-full rounded-full object-cover" /> : <Bot size={16} className="text-white" />)}
                  </div>
                  <div className="flex items-start">
                    <div className={`rounded-lg px-4 py-2 ${isUser ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-200 border border-gray-700"}`}>
                      <div className="text-xs text-gray-400 mb-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {!isUser && msg.reasoning && showReasoning && (
                        <div className="text-xs text-gray-400 italic border-l-2 border-gray-600 pl-2 mb-1 whitespace-pre-wrap">
                          🤔 {msg.reasoning}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                    <button onClick={() => deleteMessage(idx)} className="text-gray-500 hover:text-red-500 transition ml-2 self-center" title="删除这条消息"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {(loading || uploading) && (
            <div className="flex mb-4 justify-start">
              <div className="flex max-w-[70%] flex-row">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mr-2">
                  {assistantAvatar ? <img src={assistantAvatar} alt="assistant" className="w-full h-full rounded-full object-cover" /> : <Bot size={16} className="text-white" />}
                </div>
                <div className="rounded-lg px-4 py-3 bg-gray-800 text-gray-200 border border-gray-700">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="flex gap-2 max-w-4xl mx-auto items-center">
            <input
              type="file"
              id="file-upload"
              accept=".txt,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploading}
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400"
              title="上传文件让 AI 分析"
            >
              <Upload size={20} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`给${assistantName}发消息...`}
              className="flex-1 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              disabled={loading || uploading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim() || uploading}
              className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex items-center gap-2"
            >
              <Send size={18} />发送
            </button>
            <span onClick={() => setShowCredits(true)} className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer ml-2">制作人</span>
          </div>
        </div>

        {/* 裁剪模态框 */}
        <Modal isOpen={cropModalOpen} onRequestClose={() => setCropModalOpen(false)} contentLabel="裁剪头像" style={{ content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%', transform: 'translate(-50%, -50%)', padding: 0, border: 'none', background: 'transparent' }, overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000 } }}>
          <div className="w-[500px] h-[500px] bg-gray-800 rounded-lg overflow-hidden relative">
            <Cropper image={cropImageSrc || ''} crop={crop} zoom={zoom} aspect={1 / 1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button onClick={() => setCropModalOpen(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">取消</button>
              <button onClick={getCroppedImg} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确定</button>
            </div>
          </div>
        </Modal>

        {/* 设置模态框 */}
        <Modal isOpen={showSettings} onRequestClose={() => setShowSettings(false)} contentLabel="设置" style={{ content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%', transform: 'translate(-50%, -50%)', padding: '20px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }, overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000 } }}>
          <h2 className="text-xl font-bold mb-4 text-white">设置</h2>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-white">API 设置</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">系统提示词</label>
                <textarea value={apiConfig.systemPrompt} onChange={(e) => setApiConfig({ ...apiConfig, systemPrompt: e.target.value })} rows={3} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="例如：你是一个友善的AI助手..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">API 密钥</label>
                <input type="password" value={apiConfig.apiKey} onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="sk-..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">API 基础 URL</label>
                <input type="text" value={apiConfig.baseUrl} onChange={(e) => setApiConfig({ ...apiConfig, baseUrl: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="https://api.deepseek.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">模型名称</label>
                <input type="text" value={apiConfig.model} onChange={(e) => setApiConfig({ ...apiConfig, model: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="deepseek-chat" />
              </div>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-white">联网搜索设置</h3>
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <input type="checkbox" checked={searchConfig.enabled} onChange={(e) => setSearchConfig({ ...searchConfig, enabled: e.target.checked })} className="rounded bg-gray-800 border-gray-600" />
                  默认开启联网搜索
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">搜索服务商</label>
                <select value={searchConfig.provider} onChange={(e) => setSearchConfig({ ...searchConfig, provider: e.target.value as "tavily" | "google_serper" })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white">
                  <option value="tavily">Tavily</option>
                  <option value="google_serper">Google Serper</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">搜索 API 密钥</label>
                <input type="password" value={searchConfig.apiKey} onChange={(e) => setSearchConfig({ ...searchConfig, apiKey: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="输入搜索服务商的 API 密钥" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">返回结果数量</label>
                <input type="number" min="1" max="10" value={searchConfig.resultCount} onChange={(e) => setSearchConfig({ ...searchConfig, resultCount: parseInt(e.target.value) || 3 })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">取消</button>
            <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
          </div>
        </Modal>

        {/* 编辑会话提示词模态框 */}
        <Modal
          isOpen={showPromptModal}
          onRequestClose={() => setShowPromptModal(false)}
          contentLabel="编辑会话提示词"
          style={{
            content: {
              top: '50%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              marginRight: '-50%',
              transform: 'translate(-50%, -50%)',
              padding: '20px',
              maxWidth: '500px',
              width: '90%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
              color: '#f9fafb',
            },
            overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000 },
          }}
        >
          <h3 className="text-lg font-bold mb-4">编辑会话提示词</h3>
          <textarea
            value={editingPrompt}
            onChange={(e) => setEditingPrompt(e.target.value)}
            rows={5}
            className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white mb-4"
            placeholder="输入此会话的专属系统提示词..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowPromptModal(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              取消
            </button>
            <button
              onClick={saveSystemPrompt}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </Modal>

        {/* 制作人信息模态框 */}
        <Modal
          isOpen={showCredits}
          onRequestClose={() => setShowCredits(false)}
          contentLabel="制作人"
          style={{
            content: {
              top: '50%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              marginRight: '-50%',
              transform: 'translate(-50%, -50%)',
              padding: '30px',
              maxWidth: '400px',
              width: '90%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.75rem',
              color: '#f9fafb',
            },
            overlay: {
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              zIndex: 1000,
            },
          }}
        >
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4 text-blue-400">杏铃酱</h3>
            <p className="mb-2">制作人：<span className="text-blue-300">zhyuuka</span>  &amp;  <span className="text-green-300">DeepSeek</span></p>
            <p className="mb-1">B站：</p>
            <a 
              href="https://b23.tv/LWF95IO" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 underline break-all hover:text-blue-300"
            >
              https://b23.tv/LWF95IO
            </a>
            <p className="mt-3 mb-1">QQ反馈：</p>
            <p className="text-blue-300 select-all">3684939695</p>
            <button
              onClick={() => setShowCredits(false)}
              className="mt-6 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              关闭
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}}

export default function Home() {
  const defaultSession: Session = {
    id: "default",
    name: "默认会话",
    messages: [],
    createdAt: 0,
  };

  const [sessions, setSessions] = useState<Session[]>([defaultSession]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("default");
  const [messages, setMessages] = useState<Message[]>([]);
  const prevSessionIdRef = useRef(currentSessionId);

  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    systemPrompt: "你是一个友善的AI助手，名叫杏铃酱。",
  });

  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    enabled: false,
    provider: "tavily",
    apiKey: "",
    resultCount: 3,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [assistantName, setAssistantName] = useState("杏铃酱");
  const [assistantAvatar, setAssistantAvatar] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameInput, setEditNameInput] = useState(assistantName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [userName, setUserName] = useState("我");
  const [userAvatar, setUserAvatar] = useState("");
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [editUserNameInput, setEditUserNameInput] = useState(userName);
  const userNameInputRef = useRef<HTMLInputElement>(null);

  const [wallpaper, setWallpaper] = useState("");

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 显示思考的开关
  const [showReasoning, setShowReasoning] = useState(true);

  // 制作人弹窗
  const [showCredits, setShowCredits] = useState(false);

  useEffect(() => {
    Modal.setAppElement('body');
  }, []);

  // 加载 localStorage 数据
  useEffect(() => {
    const storedSessions = localStorage.getItem("chatSessions");
    if (storedSessions) {
      const parsed = JSON.parse(storedSessions);
      setSessions(parsed);
      const storedId = localStorage.getItem("currentSessionId");
      if (storedId && parsed.some((s: Session) => s.id === storedId)) {
        setCurrentSessionId(storedId);
      } else if (parsed.length > 0) {
        setCurrentSessionId(parsed[0].id);
      }
    } else {
      localStorage.setItem("chatSessions", JSON.stringify([defaultSession]));
      localStorage.setItem("currentSessionId", "default");
    }

    const savedName = localStorage.getItem("assistantName");
    const savedAvatar = localStorage.getItem("assistantAvatar");
    const savedWallpaper = localStorage.getItem("chatWallpaper");
    const savedUserName = localStorage.getItem("userName");
    const savedUserAvatar = localStorage.getItem("userAvatar");
    const savedApiConfig = localStorage.getItem("apiConfig");
    const savedSearchConfig = localStorage.getItem("searchConfig");
    const savedShowReasoning = localStorage.getItem("showReasoning");

    if (savedName) setAssistantName(savedName);
    if (savedAvatar) setAssistantAvatar(savedAvatar);
    if (savedWallpaper) setWallpaper(savedWallpaper);
    if (savedUserName) setUserName(savedUserName);
    if (savedUserAvatar) setUserAvatar(savedUserAvatar);
    if (savedApiConfig) setApiConfig(JSON.parse(savedApiConfig));
    if (savedSearchConfig) setSearchConfig(JSON.parse(savedSearchConfig));
    if (savedShowReasoning !== null) setShowReasoning(savedShowReasoning === "true");
  }, []);

  // 同步当前会话消息
  useEffect(() => {
    if (currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        if (prevSessionIdRef.current !== currentSessionId) {
          setMessages(session.messages);
          prevSessionIdRef.current = currentSessionId;
        }
      } else if (sessions.length > 0) {
        setCurrentSessionId(sessions[0].id);
      }
    }
  }, [currentSessionId, sessions]);

  // 保存消息到会话
  useEffect(() => {
    if (currentSessionId) {
      setSessions(prev => {
        const currentSession = prev.find(s => s.id === currentSessionId);
        if (currentSession && JSON.stringify(currentSession.messages) === JSON.stringify(messages)) {
          return prev;
        }
        const updated = prev.map(s =>
          s.id === currentSessionId ? { ...s, messages } : s
        );
        localStorage.setItem("chatSessions", JSON.stringify(updated));
        return updated;
      });
    }
  }, [messages, currentSessionId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 会话操作
  const createNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      name: `新对话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: Date.now()
    };
    setSessions(prev => {
      const updated = [...prev, newSession];
      localStorage.setItem("chatSessions", JSON.stringify(updated));
      return updated;
    });
    setCurrentSessionId(newSession.id);
    localStorage.setItem("currentSessionId", newSession.id);
  };

  const switchSession = (id: string) => {
    setCurrentSessionId(id);
    localStorage.setItem("currentSessionId", id);
  };

  const deleteSession = (id: string) => {
    if (sessions.length <= 1) {
      alert("至少保留一个会话");
      return;
    }
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      localStorage.setItem("chatSessions", JSON.stringify(filtered));
      return filtered;
    });
    if (currentSessionId === id) {
      const newId = sessions.find(s => s.id !== id)!.id;
      setCurrentSessionId(newId);
      localStorage.setItem("currentSessionId", newId);
    }
  };

  const startRenaming = (id: string, currentName: string) => {
    setRenamingSessionId(id);
    setNewSessionName(currentName);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  };

  const saveRenaming = () => {
    if (renamingSessionId && newSessionName.trim()) {
      setSessions(prev => {
        const updated = prev.map(s =>
          s.id === renamingSessionId ? { ...s, name: newSessionName.trim() } : s
        );
        localStorage.setItem("chatSessions", JSON.stringify(updated));
        return updated;
      });
      setRenamingSessionId(null);
    }
  };

  const clearCurrentSessionMessages = async () => {
    if (!currentSessionId) return;
    setMessages([]);
    try {
      await axios.post("http://localhost:8000/clear_session", {
        session_id: currentSessionId
      });
    } catch (error) {
      console.error("清空后端记忆失败", error);
    }
  };

  const deleteMessage = (index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  };

  // 导出会话
  const exportSessions = () => {
    const data = {
      sessions,
      currentSessionId,
      assistantName,
      assistantAvatar,
      userName,
      userAvatar,
      wallpaper,
      apiConfig,
      searchConfig,
      showReasoning,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xingling-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入会话
  const importSessions = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          setSessions(data.sessions || []);
          setCurrentSessionId(data.currentSessionId || "default");
          setAssistantName(data.assistantName || "杏铃酱");
          setAssistantAvatar(data.assistantAvatar || "");
          setUserName(data.userName || "我");
          setUserAvatar(data.userAvatar || "");
          setWallpaper(data.wallpaper || "");
          setApiConfig(data.apiConfig || { apiKey: "", baseUrl: "https://api.deepseek.com", model: "deepseek-chat", systemPrompt: "你是一个友善的AI助手，名叫杏铃酱。" });
          setSearchConfig(data.searchConfig || { enabled: false, provider: "tavily", apiKey: "", resultCount: 3 });
          if (data.showReasoning !== undefined) setShowReasoning(data.showReasoning);
          // 保存到 localStorage
          localStorage.setItem("chatSessions", JSON.stringify(data.sessions || []));
          localStorage.setItem("currentSessionId", data.currentSessionId || "default");
          localStorage.setItem("assistantName", data.assistantName || "杏铃酱");
          localStorage.setItem("assistantAvatar", data.assistantAvatar || "");
          localStorage.setItem("userName", data.userName || "我");
          localStorage.setItem("userAvatar", data.userAvatar || "");
          localStorage.setItem("chatWallpaper", data.wallpaper || "");
          localStorage.setItem("apiConfig", JSON.stringify(data.apiConfig || {}));
          localStorage.setItem("searchConfig", JSON.stringify(data.searchConfig || {}));
          localStorage.setItem("showReasoning", data.showReasoning ? "true" : "false");
          alert("导入成功！");
        } catch (error) {
          alert("导入失败：文件格式错误");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // 流式发送消息（包含思考内容解析）
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const storedApiConfig = localStorage.getItem('apiConfig');
      const currentApiConfig = storedApiConfig ? JSON.parse(storedApiConfig) : apiConfig;
      const storedSearchConfig = localStorage.getItem('searchConfig');
      const currentSearchConfig = storedSearchConfig ? JSON.parse(storedSearchConfig) : searchConfig;

      const requestBody = {
        message: input,
        session_id: currentSessionId,
        api_key: currentApiConfig.apiKey || null,
        base_url: currentApiConfig.baseUrl || null,
        model: currentApiConfig.model || null,
        system_prompt: currentApiConfig.systemPrompt || null,
        search_enabled: currentSearchConfig.enabled,
        search_provider: currentSearchConfig.provider,
        search_api_key: currentSearchConfig.apiKey || null,
        search_result_count: currentSearchConfig.resultCount,
      };

      const response = await fetch("http://localhost:8000/chat_stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let currentReasoning = "";
      let assistantContent = "";

      // 添加临时助手消息
      const tempMsg: Message = { role: "assistant", content: "", reasoning: "", timestamp: Date.now() };
      setMessages(prev => [...prev, tempMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 按 SSE 事件分割（每个事件以 \n\n 结束）
        const events = buffer.split('\n\n');
        buffer = events.pop() || "";

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              try {
                const data = JSON.parse(jsonStr);
                if (data.type === 'reasoning') {
                  currentReasoning += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex].role === "assistant") {
                      newMessages[lastIndex] = { ...newMessages[lastIndex], reasoning: currentReasoning };
                    }
                    return newMessages;
                  });
                } else if (data.type === 'content') {
                  assistantContent += data.content;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex].role === "assistant") {
                      newMessages[lastIndex] = { ...newMessages[lastIndex], content: assistantContent };
                    }
                    return newMessages;
                  });
                } else if (data.type === 'error') {
                  console.error("Stream error:", data.content);
                }
              } catch (e) {
                console.error("Failed to parse SSE data:", jsonStr, e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("API error:", error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "（发生错误，请稍后重试）",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveApiConfig = (newConfig: ApiConfig) => {
    setApiConfig(newConfig);
    localStorage.setItem("apiConfig", JSON.stringify(newConfig));
  };

  const saveSearchConfig = (newConfig: SearchConfig) => {
    setSearchConfig(newConfig);
    localStorage.setItem("searchConfig", JSON.stringify(newConfig));
  };

  const handleSaveSettings = () => {
    saveApiConfig(apiConfig);
    saveSearchConfig(searchConfig);
    setShowSettings(false);
  };

  // 头像/壁纸上传裁剪
  const handleAvatarClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const getCroppedImg = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    const image = await createImage(cropImageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;
    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );
    const base64 = canvas.toDataURL("image/jpeg");
    setAssistantAvatar(base64);
    localStorage.setItem("assistantAvatar", base64);
    setCropModalOpen(false);
    setCropImageSrc(null);
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", reject);
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const handleWallpaperClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setWallpaper(base64);
        localStorage.setItem("chatWallpaper", base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleUserAvatarClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUserAvatar(base64);
        localStorage.setItem("userAvatar", base64);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const saveName = (newName: string) => {
    setAssistantName(newName);
    localStorage.setItem("assistantName", newName);
    setIsEditingName(false);
  };

  const saveUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem("userName", newName);
    setIsEditingUserName(false);
  };

  return (
    <div className="flex h-screen dark">
      <style jsx global>{`
        :root { color-scheme: dark; }
        body { background-color: #111827; color: #f9fafb; }
      `}</style>
      
      {/* 侧边栏 */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden bg-gray-900 border-r border-gray-700 flex flex-col`}>
        <div className="p-4 flex justify-between items-center">
          <h2 className="font-bold text-gray-300">对话列表</h2>
          <div className="flex gap-1">
            <button onClick={createNewSession} className="p-1 hover:bg-gray-800 rounded text-gray-300" title="新建对话"><Plus size={16} /></button>
            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-800 rounded text-gray-300" title="收起侧边栏"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map(session => (
            <div key={session.id} className={`p-2 mb-1 rounded cursor-pointer flex justify-between items-center ${session.id === currentSessionId ? 'bg-blue-900' : 'bg-gray-800 hover:bg-gray-700'}`} onClick={() => switchSession(session.id)}>
              {renamingSessionId === session.id ? (
                <input ref={renameInputRef} type="text" value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} onBlur={saveRenaming} onKeyDown={(e) => e.key === "Enter" && saveRenaming()} className="flex-1 bg-transparent border-b border-gray-500 outline-none text-sm text-white" onClick={(e) => e.stopPropagation()} />
              ) : (
                <>
                  <span suppressHydrationWarning className="truncate text-sm flex-1 text-gray-300">{session.name}</span>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => startRenaming(session.id, session.name)} className="text-gray-400 hover:text-blue-500" title="重命名"><Pencil size={14} /></button>
                    <button onClick={() => deleteSession(session.id)} className="text-gray-400 hover:text-red-500" title="删除对话"><Trash2 size={14} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {sidebarOpen && (
          <div className="p-4 border-t border-gray-700 space-y-2">
            <button onClick={clearCurrentSessionMessages} className="w-full flex items-center justify-center gap-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
              <Eraser size={16} /> 清空当前对话
            </button>
            <button onClick={exportSessions} className="w-full flex items-center justify-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              ⬇️ 导出会话
            </button>
            <button onClick={importSessions} className="w-full flex items-center justify-center gap-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
              ⬆️ 导入会话
            </button>
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-full hover:bg-gray-700 mr-2 text-gray-300"><Menu size={20} /></button>}
            <div onClick={handleAvatarClick} className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white cursor-pointer hover:opacity-80 transition" title="点击更换头像">
              {assistantAvatar ? <img src={assistantAvatar} alt="avatar" className="w-full h-full rounded-full object-cover" /> : <Bot size={24} />}
            </div>
            {isEditingName ? (
              <input ref={nameInputRef} type="text" value={editNameInput} onChange={(e) => setEditNameInput(e.target.value)} onBlur={() => saveName(editNameInput)} onKeyDown={(e) => e.key === "Enter" && saveName(editNameInput)} className="text-xl font-bold bg-transparent border-b border-gray-500 outline-none text-white w-32" autoFocus />
            ) : (
              <h1 suppressHydrationWarning className="text-xl font-bold text-white cursor-pointer hover:underline flex items-center gap-1" onDoubleClick={() => { setEditNameInput(assistantName); setIsEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }} title="双击修改名字">
                {assistantName} <Pencil size={16} className="text-gray-400" />
              </h1>
            )}
            <div className="flex items-center gap-2 ml-4">
              <div onClick={handleUserAvatarClick} className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white cursor-pointer hover:opacity-80 transition" title="点击更换你的头像">
                {userAvatar ? <img src={userAvatar} alt="user avatar" className="w-full h-full rounded-full object-cover" /> : <User size={20} />}
              </div>
              {isEditingUserName ? (
                <input ref={userNameInputRef} type="text" value={editUserNameInput} onChange={(e) => setEditUserNameInput(e.target.value)} onBlur={() => saveUserName(editUserNameInput)} onKeyDown={(e) => e.key === "Enter" && saveUserName(editUserNameInput)} className="text-md bg-transparent border-b border-gray-500 outline-none text-white w-20" autoFocus />
              ) : (
                <span suppressHydrationWarning className="text-md text-white cursor-pointer hover:underline" onDoubleClick={() => { setEditUserNameInput(userName); setIsEditingUserName(true); setTimeout(() => userNameInputRef.current?.focus(), 0); }} title="双击修改名字">
                  {userName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* 显示思考开关 */}
            <label className="flex items-center gap-1 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={showReasoning}
                onChange={(e) => {
                  setShowReasoning(e.target.checked);
                  localStorage.setItem("showReasoning", e.target.checked ? "true" : "false");
                }}
                className="rounded bg-gray-800 border-gray-600"
              />
              显示思考
            </label>
            <button onClick={() => setSearchConfig(prev => ({ ...prev, enabled: !prev.enabled }))} className={`p-2 rounded-full hover:bg-gray-700 relative ${searchConfig.enabled ? 'text-blue-400' : 'text-gray-400'}`} title={searchConfig.enabled ? "联网搜索已开启" : "联网搜索已关闭"}>
              <Globe size={20} />
              {searchConfig.enabled && <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full"></span>}
            </button>
            <button onClick={handleWallpaperClick} className="p-2 rounded-full hover:bg-gray-700 relative text-gray-400" title="更换聊天背景">🌄</button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-full hover:bg-gray-700 text-gray-400" title="设置"><Settings size={20} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : 'none', backgroundColor: wallpaper ? 'transparent' : '#111827' }}>
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-500">开始和{assistantName}聊天吧 ✦</div>
          )}
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div key={idx} id={`msg-${idx}`} className={`flex mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[70%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-green-600 ml-2" : "bg-blue-600 mr-2"}`}>
                    {isUser ? (userAvatar ? <img src={userAvatar} alt="user" className="w-full h-full rounded-full object-cover" /> : <User size={16} className="text-white" />) : (assistantAvatar ? <img src={assistantAvatar} alt="assistant" className="w-full h-full rounded-full object-cover" /> : <Bot size={16} className="text-white" />)}
                  </div>
                  <div className="flex items-start">
                    <div className={`rounded-lg px-4 py-2 ${isUser ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-200 border border-gray-700"}`}>
                      <div className="text-xs text-gray-400 mb-1">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {/* 显示思考内容（仅助手且开启时） */}
                      {!isUser && msg.reasoning && showReasoning && (
                        <div className="text-xs text-gray-400 italic border-l-2 border-gray-600 pl-2 mb-1 whitespace-pre-wrap">
                          🤔 {msg.reasoning}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    </div>
                    <button onClick={() => deleteMessage(idx)} className="text-gray-500 hover:text-red-500 transition ml-2 self-center" title="删除这条消息"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex mb-4 justify-start">
              <div className="flex max-w-[70%] flex-row">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mr-2">
                  {assistantAvatar ? <img src={assistantAvatar} alt="assistant" className="w-full h-full rounded-full object-cover" /> : <Bot size={16} className="text-white" />}
                </div>
                <div className="rounded-lg px-4 py-3 bg-gray-800 text-gray-200 border border-gray-700">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="flex gap-2 max-w-4xl mx-auto items-center">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder={`给${assistantName}发消息...`} className="flex-1 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white" disabled={loading} />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="bg-blue-600 text-white rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex items-center gap-2"><Send size={18} />发送</button>
            <span onClick={() => setShowCredits(true)} className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer ml-2">制作人</span>
          </div>
        </div>

        {/* 裁剪模态框 */}
        <Modal isOpen={cropModalOpen} onRequestClose={() => setCropModalOpen(false)} contentLabel="裁剪头像" style={{ content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%', transform: 'translate(-50%, -50%)', padding: 0, border: 'none', background: 'transparent' }, overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000 } }}>
          <div className="w-[500px] h-[500px] bg-gray-800 rounded-lg overflow-hidden relative">
            <Cropper image={cropImageSrc || ''} crop={crop} zoom={zoom} aspect={1 / 1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <button onClick={() => setCropModalOpen(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">取消</button>
              <button onClick={getCroppedImg} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确定</button>
            </div>
          </div>
        </Modal>

        {/* 设置模态框 */}
        <Modal isOpen={showSettings} onRequestClose={() => setShowSettings(false)} contentLabel="设置" style={{ content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%', transform: 'translate(-50%, -50%)', padding: '20px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f9fafb' }, overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)', zIndex: 1000 } }}>
          <h2 className="text-xl font-bold mb-4 text-white">设置</h2>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-white">API 设置</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">系统提示词</label>
                <textarea value={apiConfig.systemPrompt} onChange={(e) => setApiConfig({ ...apiConfig, systemPrompt: e.target.value })} rows={3} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="例如：你是一个友善的AI助手..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">API 密钥</label>
                <input type="password" value={apiConfig.apiKey} onChange={(e) => setApiConfig({ ...apiConfig, apiKey: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="sk-..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">API 基础 URL</label>
                <input type="text" value={apiConfig.baseUrl} onChange={(e) => setApiConfig({ ...apiConfig, baseUrl: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="https://api.deepseek.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">模型名称</label>
                <input type="text" value={apiConfig.model} onChange={(e) => setApiConfig({ ...apiConfig, model: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="deepseek-chat" />
              </div>
            </div>
          </div>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2 text-white">联网搜索设置</h3>
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                  <input type="checkbox" checked={searchConfig.enabled} onChange={(e) => setSearchConfig({ ...searchConfig, enabled: e.target.checked })} className="rounded bg-gray-800 border-gray-600" />
                  默认开启联网搜索
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">搜索服务商</label>
                <select value={searchConfig.provider} onChange={(e) => setSearchConfig({ ...searchConfig, provider: e.target.value as "tavily" | "google_serper" })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white">
                  <option value="tavily">Tavily</option>
                  <option value="google_serper">Google Serper</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">搜索 API 密钥</label>
                <input type="password" value={searchConfig.apiKey} onChange={(e) => setSearchConfig({ ...searchConfig, apiKey: e.target.value })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" placeholder="输入搜索服务商的 API 密钥" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">返回结果数量</label>
                <input type="number" min="1" max="10" value={searchConfig.resultCount} onChange={(e) => setSearchConfig({ ...searchConfig, resultCount: parseInt(e.target.value) || 3 })} className="w-full border border-gray-600 rounded-lg px-3 py-2 bg-gray-800 text-white" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">取消</button>
            <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
          </div>
        </Modal>

        {/* 制作人信息模态框 */}
        <Modal
          isOpen={showCredits}
          onRequestClose={() => setShowCredits(false)}
          contentLabel="制作人"
          style={{
            content: {
              top: '50%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              marginRight: '-50%',
              transform: 'translate(-50%, -50%)',
              padding: '30px',
              maxWidth: '400px',
              width: '90%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '0.75rem',
              color: '#f9fafb',
            },
            overlay: {
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              zIndex: 1000,
            },
          }}
        >
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4 text-blue-400">杏铃酱</h3>
            <p className="mb-2">制作人：<span className="text-blue-300">zhyuuka</span>  &amp;  <span className="text-green-300">DeepSeek</span></p>
            <p className="mb-1">B站：</p>
            <a 
              href="https://b23.tv/LWF95IO" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 underline break-all hover:text-blue-300"
            >
              https://b23.tv/LWF95IO
            </a>
            <p className="mt-3 mb-1">QQ反馈：</p>
            <p className="text-blue-300 select-all">3684939695</p>
            <button
              onClick={() => setShowCredits(false)}
              className="mt-6 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              关闭
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
