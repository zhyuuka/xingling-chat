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