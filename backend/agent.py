from __future__ import annotations

import asyncio
import inspect
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable, Literal, Optional
from uuid import uuid4

from browser_use import Agent, BrowserSession
from browser_use.agent.views import ActionResult
from browser_use.tools.service import Tools
from gitlab_duo_complete import create_duo_models

from veto import Veto, VetoOptions
from veto.types.tool import ToolCall
from veto.utils.id import generate_tool_call_id

logger = logging.getLogger("demo.agent")

VALIDATED_ACTIONS: set[str] = {
    "navigate",
    "search",
    "click",
    "input",
    "extract",
    "scroll",
}
MAX_STEPS = 100
APPROVAL_TIMEOUT = 300


EmitFn = Callable[[str, dict[str, Any]], Awaitable[None]]


@dataclass
class AgentSession:
    id: str
    task: str
    veto_api_key: str
    veto_base_url: str
    model_provider_token: str
    llm_model: Literal["claude-sonnet-4.5", "claude-opus-4.5"] = "claude-sonnet-4.5"
    use_demo_policies: bool = True
    emit: Optional[EmitFn] = None
    agent_task: Optional[asyncio.Task] = None
    pending_approvals: dict[str, dict[str, Any]] = field(default_factory=dict)
    demo_policy_ids: list[str] = field(default_factory=list)
    stopped: bool = False


def _build_demo_tools(
    veto_instance: Veto,
    session: AgentSession,
) -> type[Tools]:
    class DemoVetoTools(Tools):  # type: ignore[misc]
        async def act(
            self,
            action: Any,
            browser_session: Any,
            **kwargs: Any,
        ) -> Any:
            action_dict = action.model_dump(exclude_unset=True)
            action_name = next(iter(action_dict), None)
            params = action_dict.get(action_name, {}) if action_name else {}

            if action_name and action_name in VALIDATED_ACTIONS:
                arguments = params if isinstance(params, dict) else {"value": params}
                emit = session.emit

                start = time.perf_counter()
                try:
                    result = await veto_instance._validate_tool_call(
                        ToolCall(
                            id=generate_tool_call_id(),
                            name=action_name,
                            arguments=arguments,
                        )
                    )
                    latency_ms = round((time.perf_counter() - start) * 1000)

                    if result.allowed:
                        if emit:
                            await emit(
                                "decision",
                                {
                                    "action": action_name,
                                    "args": _truncate_args(arguments),
                                    "decision": "allow",
                                    "reason": result.validation_result.reason,
                                    "latencyMs": latency_ms,
                                    "mode": (
                                        result.validation_result.metadata or {}
                                    ).get("mode", "deterministic"),
                                },
                            )
                    else:
                        reason = result.validation_result.reason or "Policy violation"
                        if emit:
                            await emit(
                                "decision",
                                {
                                    "action": action_name,
                                    "args": _truncate_args(arguments),
                                    "decision": "deny",
                                    "reason": reason,
                                    "latencyMs": latency_ms,
                                    "mode": (
                                        result.validation_result.metadata or {}
                                    ).get("mode", "deterministic"),
                                },
                            )

                        approval_id = str(uuid4())
                        approval_event = asyncio.Event()
                        session.pending_approvals[approval_id] = {
                            "event": approval_event,
                            "result": None,
                        }

                        if emit:
                            await emit(
                                "approval_needed",
                                {
                                    "id": approval_id,
                                    "action": action_name,
                                    "args": _truncate_args(arguments),
                                    "reason": reason,
                                },
                            )

                        try:
                            await asyncio.wait_for(
                                approval_event.wait(), timeout=APPROVAL_TIMEOUT
                            )
                        except asyncio.TimeoutError:
                            session.pending_approvals.pop(approval_id, None)
                            return ActionResult(
                                error="Approval timed out after 5 minutes"
                            )

                        user_decision = session.pending_approvals.pop(
                            approval_id, {}
                        ).get("result")

                        if user_decision == "approve":
                            return await super().act(action, browser_session, **kwargs)
                        else:
                            return ActionResult(error="Denied by reviewer")

                except Exception as e:
                    logger.error("Veto validation error for %s: %s", action_name, e)
                    return ActionResult(error=f"Veto validation error: {e}")

            return await super().act(action, browser_session, **kwargs)

    return DemoVetoTools


def _truncate_args(args: dict[str, Any], max_len: int = 200) -> dict[str, Any]:
    out = {}
    for k, v in args.items():
        s = str(v)
        out[k] = s[:max_len] + "..." if len(s) > max_len else v
    return out


async def run_agent(session: AgentSession) -> None:
    emit = session.emit
    if not emit:
        raise RuntimeError("session.emit must be set before calling run_agent")

    await emit("status", {"step": 0, "maxSteps": MAX_STEPS, "state": "initializing"})

    veto_instance = await Veto.init(
        VetoOptions(
            api_key=session.veto_api_key,
            base_url=session.veto_base_url,
        )
    )

    DemoTools = _build_demo_tools(veto_instance, session)

    duo_models = create_duo_models(session.model_provider_token)
    llm = (
        duo_models["claude_opus"]
        if session.llm_model == "claude-opus-4.5"
        else duo_models["claude_sonnet"]
    )

    # Run browser VISIBLE on the Xvfb virtual display.
    # The user watches via VNC — no screenshot streaming needed.
    display = os.environ.get("DISPLAY", ":99")
    logger.info("Launching visible browser on display %s", display)
    browser_session = BrowserSession(headless=False)
    step_counter = {"n": 0}

    async def on_step_end(agent_instance: Agent):
        step_counter["n"] += 1
        step = step_counter["n"]
        await emit("status", {"step": step, "maxSteps": MAX_STEPS, "state": "running"})

    try:
        agent = Agent(
            task=session.task,
            llm=llm,
            browser_session=browser_session,
            tools=DemoTools(),
        )

        await emit("status", {"step": 0, "maxSteps": MAX_STEPS, "state": "running"})

        run_kwargs: dict[str, Any] = {"max_steps": MAX_STEPS}
        sig = inspect.signature(agent.run)
        if "on_step_end" in sig.parameters:
            run_kwargs["on_step_end"] = on_step_end

        history = await agent.run(**run_kwargs)

        await emit("done", {"success": history.is_done()})

    except asyncio.CancelledError:
        await emit("status", {"step": 0, "maxSteps": 0, "state": "stopped"})
        raise
    except Exception as e:
        logger.exception("Agent run failed for session %s", session.id)
        await emit("error", {"message": str(e)})
    finally:
        try:
            await browser_session.close()
        except Exception:
            pass
