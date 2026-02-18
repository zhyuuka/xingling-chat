# 杏铃酱 xingling-chat 核心代码
# Copyright (c) 2026 zhyyuka
# 开源协议：MIT License，使用需保留原作者署名，商用需获得授权
import json
import os
import sys
from typing import Optional, List, Dict, Generator
from openai import OpenAI
import requests
import PyPDF2
import docx

# ---------- 确定数据存储目录（兼容开发环境和打包后的 exe）----------
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MEMORY_DIR = os.path.join(BASE_DIR, "memory_sessions")
os.makedirs(MEMORY_DIR, exist_ok=True)

# ---------- 默认配置（从环境变量读取，作为后备）----------
DEFAULT_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEFAULT_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEFAULT_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEFAULT_SYSTEM_PROMPT = "你是一个友善的AI助手，名叫杏铃酱。"

def _get_history_path(session_id: str) -> str:
    return os.path.join(MEMORY_DIR, f"history_{session_id}.json")

def _get_summary_path(session_id: str) -> str:
    return os.path.join(MEMORY_DIR, f"summary_{session_id}.txt")

def load_history(session_id: str) -> List[Dict]:
    path = _get_history_path(session_id)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_history(session_id: str, history: List[Dict]):
    path = _get_history_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

def load_summary(session_id: str) -> str:
    path = _get_summary_path(session_id)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def save_summary(session_id: str, summary: str):
    path = _get_summary_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        f.write(summary)

def _create_client(api_key: Optional[str] = None, base_url: Optional[str] = None) -> OpenAI:
    key = api_key if api_key is not None else DEFAULT_API_KEY
    url = base_url if base_url is not None else DEFAULT_BASE_URL
    return OpenAI(api_key=key, base_url=url)

def generate_summary(messages: List[Dict], api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None) -> str:
    if not messages:
        return ""
    summary_prompt = "请总结以下对话内容，用简洁的语言概括主要话题和关键信息：\n\n"
    for msg in messages:
        role = "用户" if msg["role"] == "user" else "助手"
        summary_prompt += f"{role}: {msg['content']}\n"
    
    client = _create_client(api_key, base_url)
    model_name = model if model is not None else DEFAULT_MODEL
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "你是一个善于总结的助手。"},
                {"role": "user", "content": summary_prompt}
            ],
            temperature=0.3,
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"生成摘要失败: {e}")
        return "（摘要生成失败）"

def search_web(query: str, provider: str, api_key: str, result_count: int = 3) -> str:
    if not api_key:
        return "（未提供搜索 API 密钥）"
    
    try:
        if provider == "tavily":
            url = "https://api.tavily.com/search"
            payload = {
                "api_key": api_key,
                "query": query,
                "search_depth": "basic",
                "max_results": result_count,
                "include_answer": False,
                "include_raw_content": False
            }
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    formatted = "\n\n".join([f"{r.get('title', '无标题')}: {r.get('content', '')}" for r in results])
                    return f"以下是联网搜索到的信息：\n{formatted}"
                else:
                    return "（未搜索到相关信息）"
            else:
                return f"（搜索失败：HTTP {resp.status_code}）"
        elif provider == "google_serper":
            url = "https://google.serper.dev/search"
            headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
            payload = {"q": query, "num": result_count}
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("organic", [])
                if items:
                    formatted = "\n\n".join([f"{item.get('title', '无标题')}: {item.get('snippet', '')}" for item in items])
                    return f"以下是联网搜索到的信息：\n{formatted}"
                else:
                    return "（未搜索到相关信息）"
            else:
                return f"（搜索失败：HTTP {resp.status_code}）"
        else:
            return "（不支持的搜索服务商）"
    except Exception as e:
        return f"（搜索出错：{str(e)}）"

def extract_text_from_file(file_path: str) -> str:
    """根据文件扩展名提取文本内容"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.txt':
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    elif ext == '.pdf':
        text = ""
        with open(file_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() + "\n"
        return text
    elif ext == '.docx':
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])
    else:
        return "（不支持的文件格式）"

def chat_with_memory(
    session_id: str,
    user_message: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    search_enabled: bool = False,
    search_provider: str = "tavily",
    search_api_key: Optional[str] = None,
    search_result_count: int = 3,
) -> str:
    history = load_history(session_id)
    summary = load_summary(session_id)

    messages = []
    if summary:
        messages.append({"role": "system", "content": f"历史摘要：{summary}"})
    for msg in history[-40:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    if search_enabled and search_api_key:
        search_result = search_web(user_message, search_provider, search_api_key, search_result_count)
        messages.append({"role": "system", "content": f"联网搜索结果（供参考）：\n{search_result}"})
    
    messages.append({"role": "user", "content": user_message})
    
    client = _create_client(api_key, base_url)
    model_name = model if model is not None else DEFAULT_MODEL
    system = system_prompt if system_prompt is not None else DEFAULT_SYSTEM_PROMPT
    
    if messages[0]["role"] != "system":
        messages.insert(0, {"role": "system", "content": system})
    else:
        messages[0]["content"] = f"{system}\n\n{messages[0]['content']}"
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
            stream=False
        )
        reply = response.choices[0].message.content
    except Exception as e:
        print(f"API 调用失败: {e}")
        reply = "（抱歉，我现在无法回答，请稍后再试。）"
    
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": reply})
    
    if len(history) >= 40:
        summary_text = generate_summary(history[:-2], api_key, base_url, model)
        save_summary(session_id, summary_text)
        history = history[-2:]
    
    save_history(session_id, history)
    return reply

def chat_with_memory_stream(
    session_id: str,
    user_message: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    search_enabled: bool = False,
    search_provider: str = "tavily",
    search_api_key: Optional[str] = None,
    search_result_count: int = 3,
) -> Generator[str, None, None]:
    history = load_history(session_id)
    summary = load_summary(session_id)

    messages = []
    if summary:
        messages.append({"role": "system", "content": f"历史摘要：{summary}"})
    for msg in history[-40:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    if search_enabled and search_api_key:
        search_result = search_web(user_message, search_provider, search_api_key, search_result_count)
        messages.append({"role": "system", "content": f"联网搜索结果（供参考）：\n{search_result}"})

    messages.append({"role": "user", "content": user_message})

    client = _create_client(api_key, base_url)
    model_name = model if model is not None else DEFAULT_MODEL
    system = system_prompt if system_prompt is not None else DEFAULT_SYSTEM_PROMPT

    if messages[0]["role"] != "system":
        messages.insert(0, {"role": "system", "content": system})
    else:
        messages[0]["content"] = f"{system}\n\n{messages[0]['content']}"

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
            stream=True
        )
        full_content = ""
        reasoning_content = ""
        for chunk in response:
            if chunk.choices and chunk.choices[0].delta and hasattr(chunk.choices[0].delta, 'reasoning_content') and chunk.choices[0].delta.reasoning_content:
                reasoning_piece = chunk.choices[0].delta.reasoning_content
                reasoning_content += reasoning_piece
                yield f"data: {json.dumps({'type': 'reasoning', 'content': reasoning_piece})}\n\n"
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                content_piece = chunk.choices[0].delta.content
                full_content += content_piece
                yield f"data: {json.dumps({'type': 'content', 'content': content_piece})}\n\n"
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": full_content})
        if len(history) >= 40:
            summary_text = generate_summary(history[:-2], api_key, base_url, model)
            save_summary(session_id, summary_text)
            history = history[-2:]
        save_history(session_id, history)
    except Exception as e:
        import traceback
        traceback.print_exc()
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

def clear_session_memory(session_id: str):
    hist_path = _get_history_path(session_id)
    sum_path = _get_summary_path(session_id)
    if os.path.exists(hist_path):
        os.remove(hist_path)
    if os.path.exists(sum_path):
        os.remove(sum_path)    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def save_summary(session_id: str, summary: str):
    path = _get_summary_path(session_id)
    with open(path, "w", encoding="utf-8") as f:
        f.write(summary)

def _create_client(api_key: Optional[str] = None, base_url: Optional[str] = None) -> OpenAI:
    """根据传入的配置创建 OpenAI 客户端，未传入则使用默认值"""
    key = api_key if api_key is not None else DEFAULT_API_KEY
    url = base_url if base_url is not None else DEFAULT_BASE_URL
    return OpenAI(api_key=key, base_url=url)

def generate_summary(messages: List[Dict], api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None) -> str:
    """
    调用 LLM 生成历史摘要
    """
    if not messages:
        return ""
    summary_prompt = "请总结以下对话内容，用简洁的语言概括主要话题和关键信息：\n\n"
    for msg in messages:
        role = "用户" if msg["role"] == "user" else "助手"
        summary_prompt += f"{role}: {msg['content']}\n"
    
    client = _create_client(api_key, base_url)
    model_name = model if model is not None else DEFAULT_MODEL
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "你是一个善于总结的助手。"},
                {"role": "user", "content": summary_prompt}
            ],
            temperature=0.3,
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"生成摘要失败: {e}")
        return "（摘要生成失败）"

def search_web(query: str, provider: str, api_key: str, result_count: int = 3) -> str:
    """
    联网搜索，返回搜索结果文本
    """
    if not api_key:
        return "（未提供搜索 API 密钥）"
    
    try:
        if provider == "tavily":
            url = "https://api.tavily.com/search"
            payload = {
                "api_key": api_key,
                "query": query,
                "search_depth": "basic",
                "max_results": result_count,
                "include_answer": False,
                "include_raw_content": False
            }
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    formatted = "\n\n".join([f"{r.get('title', '无标题')}: {r.get('content', '')}" for r in results])
                    return f"以下是联网搜索到的信息：\n{formatted}"
                else:
                    return "（未搜索到相关信息）"
            else:
                return f"（搜索失败：HTTP {resp.status_code}）"
        elif provider == "google_serper":
            url = "https://google.serper.dev/search"
            headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
            payload = {"q": query, "num": result_count}
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                items = data.get("organic", [])
                if items:
                    formatted = "\n\n".join([f"{item.get('title', '无标题')}: {item.get('snippet', '')}" for item in items])
                    return f"以下是联网搜索到的信息：\n{formatted}"
                else:
                    return "（未搜索到相关信息）"
            else:
                return f"（搜索失败：HTTP {resp.status_code}）"
        else:
            return "（不支持的搜索服务商）"
    except Exception as e:
        return f"（搜索出错：{str(e)}）"

def chat_with_memory(
    session_id: str,
    user_message: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    search_enabled: bool = False,
    search_provider: str = "tavily",
    search_api_key: Optional[str] = None,
    search_result_count: int = 3,
) -> str:
    """
    普通对话函数（非流式）
    """
    history = load_history(session_id)
    summary = load_summary(session_id)

    messages = []
    if summary:
        messages.append({"role": "system", "content": f"历史摘要：{summary}"})
    for msg in history[-40:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    if search_enabled and search_api_key:
        search_result = search_web(user_message, search_provider, search_api_key, search_result_count)
        messages.append({"role": "system", "content": f"联网搜索结果（供参考）：\n{search_result}"})
    
    messages.append({"role": "user", "content": user_message})
    
    client = _create_client(api_key, base_url)
    model_name = model if model is not None else DEFAULT_MODEL
    system = system_prompt if system_prompt is not None else DEFAULT_SYSTEM_PROMPT
    
    if messages[0]["role"] != "system":
        messages.insert(0, {"role": "system", "content": system})
    else:
        messages[0]["content"] = f"{system}\n\n{messages[0]['content']}"
    
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
            stream=False
        )
        reply = response.choices[0].message.content
    except Exception as e:
        print(f"API 调用失败: {e}")
        reply = "（抱歉，我现在无法回答，请稍后再试。）"
    
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": reply})
    
    if len(history) >= 40:
        summary_text = generate_summary(history[:-2], api_key, base_url, model)
        save_summary(session_id, summary_text)
        history = history[-2:]
    
    save_history(session_id, history)
    return reply

def chat_with_memory_stream(
    session_id: str,
    user_message: str,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    system_prompt: Optional[str] = None,
    search_enabled: bool = False,
    search_provider: str = "tavily",
    search_api_key: Optional[str] = None,
    search_result_count: int = 3,
) -> Generator[str, None, None]:
    """
    流式版本，返回 SSE 格式数据，分别发送 reasoning 和 content
    """
    history = load_history(session_id)
    summary = load_summary(session_id)

    messages = []
    if summary:
        messages.append({"role": "system", "content": f"历史摘要：{summary}"})
    for msg in history[-40:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    if search_enabled and search_api_key:
        search_result = search_web(user_message, search_provider, search_api_key, search_result_count)
        messages.append({"role": "system", "content": f"联网搜索结果（供参考）：\n{search_result}"})

    messages.append({"role": "user", "content": user_message})

    client = _create_client(api_key, base_url)
    model_name = model if model is not None else DEFAULT_MODEL
    system = system_prompt if system_prompt is not None else DEFAULT_SYSTEM_PROMPT

    if messages[0]["role"] != "system":
        messages.insert(0, {"role": "system", "content": system})
    else:
        messages[0]["content"] = f"{system}\n\n{messages[0]['content']}"

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
            stream=True
        )
        full_content = ""
        reasoning_content = ""
        for chunk in response:
            # 发送 reasoning（如果有）
            if chunk.choices and chunk.choices[0].delta and hasattr(chunk.choices[0].delta, 'reasoning_content') and chunk.choices[0].delta.reasoning_content:
                reasoning_piece = chunk.choices[0].delta.reasoning_content
                reasoning_content += reasoning_piece
                yield f"data: {json.dumps({'type': 'reasoning', 'content': reasoning_piece})}\n\n"
            # 发送 content（如果有）
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                content_piece = chunk.choices[0].delta.content
                full_content += content_piece
                yield f"data: {json.dumps({'type': 'content', 'content': content_piece})}\n\n"
        # 流结束后保存历史
        history.append({"role": "user", "content": user_message})
        history.append({"role": "assistant", "content": full_content})
        if len(history) >= 40:
            summary_text = generate_summary(history[:-2], api_key, base_url, model)
            save_summary(session_id, summary_text)
            history = history[-2:]
        save_history(session_id, history)
    except Exception as e:
        import traceback
        traceback.print_exc()
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

def clear_session_memory(session_id: str):
    """删除该会话的记忆文件"""
    hist_path = _get_history_path(session_id)
    sum_path = _get_summary_path(session_id)
    if os.path.exists(hist_path):
        os.remove(hist_path)
    if os.path.exists(sum_path):
        os.remove(sum_path)
