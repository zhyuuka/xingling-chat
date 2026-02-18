from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import memory_core

app = FastAPI(title="杏铃酱 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    search_enabled: Optional[bool] = False
    search_provider: Optional[str] = "tavily"
    search_api_key: Optional[str] = None
    search_result_count: Optional[int] = 3

class ChatResponse(BaseModel):
    reply: str

class ClearSessionRequest(BaseModel):
    session_id: str

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        reply = memory_core.chat_with_memory(
            session_id=request.session_id,
            user_message=request.message,
            api_key=request.api_key,
            base_url=request.base_url,
            model=request.model,
            system_prompt=request.system_prompt,
            search_enabled=request.search_enabled,
            search_provider=request.search_provider,
            search_api_key=request.search_api_key,
            search_result_count=request.search_result_count,
        )
        return ChatResponse(reply=reply)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat_stream")
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import os
import tempfile
import memory_core

app = FastAPI(title="杏铃酱 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    search_enabled: Optional[bool] = False
    search_provider: Optional[str] = "tavily"
    search_api_key: Optional[str] = None
    search_result_count: Optional[int] = 3

class ChatResponse(BaseModel):
    reply: str

class ClearSessionRequest(BaseModel):
    session_id: str

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        reply = memory_core.chat_with_memory(
            session_id=request.session_id,
            user_message=request.message,
            api_key=request.api_key,
            base_url=request.base_url,
            model=request.model,
            system_prompt=request.system_prompt,
            search_enabled=request.search_enabled,
            search_provider=request.search_provider,
            search_api_key=request.search_api_key,
            search_result_count=request.search_result_count,
        )
        return ChatResponse(reply=reply)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat_stream")
async def chat_stream(request: ChatRequest):
    try:
        generator = memory_core.chat_with_memory_stream(
            session_id=request.session_id,
            user_message=request.message,
            api_key=request.api_key,
            base_url=request.base_url,
            model=request.model,
            system_prompt=request.system_prompt,
            search_enabled=request.search_enabled,
            search_provider=request.search_provider,
            search_api_key=request.search_api_key,
            search_result_count=request.search_result_count,
        )
        return StreamingResponse(generator, media_type="text/plain")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clear_session")
async def clear_session(request: ClearSessionRequest):
    try:
        memory_core.clear_session_memory(request.session_id)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status")
async def status():
    return {"status": "ok", "name": "杏铃酱"}

@app.post("/upload")
async def upload_file(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    base_url: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    system_prompt: Optional[str] = Form(None),
    search_enabled: Optional[bool] = Form(False),
    search_provider: Optional[str] = Form("tavily"),
    search_api_key: Optional[str] = Form(None),
    search_result_count: Optional[int] = Form(3),
):
    """
    上传文件并让 AI 分析（流式返回）
    """
    # 保存上传的文件到临时目录
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # 提取文件内容
        file_content = memory_core.extract_text_from_file(tmp_path)
        if not file_content.strip():
            return StreamingResponse(iter(["（文件内容为空）"]), media_type="text/plain")

        # 构建用户消息：包含文件内容和分析指令
        user_message = f"请分析以下文件内容（文件名：{file.filename}）：\n\n{file_content[:10000]}"
        if len(file_content) > 10000:
            user_message += "\n\n（文件较长，已截取前10000字符）"

        # 调用流式对话函数，将分析结果流式返回
        generator = memory_core.chat_with_memory_stream(
            session_id=session_id,
            user_message=user_message,
            api_key=api_key,
            base_url=base_url,
            model=model,
            system_prompt=system_prompt,
            search_enabled=search_enabled,
            search_provider=search_provider,
            search_api_key=search_api_key,
            search_result_count=search_result_count,
        )
        return StreamingResponse(generator, media_type="text/plain")
    finally:
        # 删除临时文件
        os.unlink(tmp_path)

if __name__ == "__main__":
    import uvicorn
    import logging

    # 简单配置日志，避免 uvicorn 默认日志的 isatty 问题
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_config=None,
        access_log=False,
        reload=False
    )
