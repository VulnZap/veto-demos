from __future__ import annotations

import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agent import AgentSession, run_agent
from policies import ensure_demo_policies, cleanup_demo_policies

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("demo.main")

app = FastAPI(title="Veto Browser Agent Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions: dict[str, AgentSession] = {}


class StartSessionRequest(BaseModel):
    task: str
    vetoApiKey: str
    vetoBaseUrl: str | None = None
    modelProviderToken: str | None = None
    llmModel: Literal["claude-sonnet-4.5", "claude-opus-4.5"] = "claude-sonnet-4.5"
    useDemoPolicies: bool = True


class ApprovalRequest(BaseModel):
    action: str


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.post("/api/session")
async def start_session(req: StartSessionRequest) -> dict[str, str]:
    provider_token = (
        req.modelProviderToken
        or os.getenv("MODEL_PROVIDER_TOKEN")
        or os.getenv("ANTHROPIC_API_KEY")
        or os.getenv("VERTEX_API_KEY")
    )
    if not provider_token:
        raise HTTPException(
            status_code=400,
            detail="Missing model provider token. Set MODEL_PROVIDER_TOKEN, ANTHROPIC_API_KEY, or VERTEX_API_KEY.",
        )

    session_id = str(uuid.uuid4())
    session = AgentSession(
        id=session_id,
        task=req.task,
        veto_api_key=req.vetoApiKey,
        veto_base_url=req.vetoBaseUrl or "https://api.runveto.com",
        model_provider_token=provider_token,
        llm_model=req.llmModel,
        use_demo_policies=req.useDemoPolicies,
    )
    sessions[session_id] = session
    logger.info("Session created: %s", session_id)
    return {"sessionId": session_id}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str):
    await ws.accept()

    session = sessions.get(session_id)
    if not session:
        await ws.send_json({"type": "error", "data": {"message": "Session not found"}})
        await ws.close()
        return

    async def emit(event_type: str, data: dict[str, Any]):
        try:
            await ws.send_json({"type": event_type, "data": data})
        except Exception:
            logger.warning(
                "Failed to send WS event %s for session %s", event_type, session_id
            )

    session.emit = emit

    try:
        if session.use_demo_policies:
            await emit(
                "status", {"step": 0, "maxSteps": 0, "state": "creating_policies"}
            )
            session.demo_policy_ids = await ensure_demo_policies(
                session.veto_api_key, session.veto_base_url
            )

        agent_task = asyncio.create_task(run_agent(session))
        session.agent_task = agent_task

        while not agent_task.done():
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except WebSocketDisconnect:
                break

        if agent_task.done() and not agent_task.cancelled():
            exc = agent_task.exception()
            if exc:
                logger.error("Agent error in session %s: %s", session_id, exc)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", session_id)
    except Exception as e:
        logger.exception("Unexpected error in session %s", session_id)
        await emit("error", {"message": str(e)})
    finally:
        if session.agent_task and not session.agent_task.done():
            session.agent_task.cancel()
        if session.use_demo_policies and session.demo_policy_ids:
            asyncio.create_task(
                cleanup_demo_policies(
                    session.veto_api_key, session.veto_base_url, session.demo_policy_ids
                )
            )
        sessions.pop(session_id, None)


@app.post("/api/session/{session_id}/approve/{approval_id}")
async def resolve_approval(session_id: str, approval_id: str, req: ApprovalRequest):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    pending = session.pending_approvals.get(approval_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Approval not found")

    pending["result"] = req.action
    pending["event"].set()

    if session.emit:
        await session.emit(
            "approval_resolved", {"id": approval_id, "decision": req.action}
        )

    return {"ok": True}


@app.post("/api/session/{session_id}/stop")
async def stop_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.agent_task and not session.agent_task.done():
        session.agent_task.cancel()
        logger.info("Session stopped by user: %s", session_id)

    return {"ok": True}


static_dir = Path(__file__).parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
