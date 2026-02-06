from __future__ import annotations

from typing import Any

import requests
from browser_use.llm.anthropic.chat import ChatAnthropic as BrowserChatAnthropic
from browser_use.llm.openai.chat import ChatOpenAI as BrowserChatOpenAI

ANTHROPIC_PROXY_URL = "https://cloud.gitlab.com/ai/v1/proxy/anthropic"
OPENAI_PROXY_URL = "https://cloud.gitlab.com/ai/v1/proxy/openai/v1"


def _get_gitlab_token(api_key: str) -> dict[str, Any]:
    response = requests.post(
        "https://gitlab.com/api/v4/ai/third_party_agents/direct_access",
        headers={"Authorization": f"Bearer {api_key}"},
        json={},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def _build_gitlab_headers(token_data: dict[str, Any]) -> dict[str, str]:
    headers = token_data["headers"]
    return {
        "Authorization": f"Bearer {token_data['token']}",
        "X-Gitlab-Global-User-Id": headers["x-gitlab-global-user-id"],
        "x-gitlab-host-name": headers["x-gitlab-host-name"],
        "x-gitlab-instance-id": headers["x-gitlab-instance-id"],
        "x-gitlab-realm": headers["x-gitlab-realm"],
        "x-gitlab-unit-primitive": headers["x-gitlab-unit-primitive"],
        "x-gitlab-authentication-type": headers["x-gitlab-authentication-type"],
    }


def _create_models(
    token_data: dict[str, Any], gitlab_headers: dict[str, str]
) -> dict[str, Any]:
    # OpenAI SDK sets Authorization via api_key, so exclude it from default_headers
    openai_headers = {
        k: v for k, v in gitlab_headers.items() if k.lower() != "authorization"
    }

    claude_opus = BrowserChatAnthropic(
        model="claude-opus-4-5-20251101",
        api_key="unused",
        base_url=ANTHROPIC_PROXY_URL,
        default_headers=gitlab_headers,
        temperature=0,
        timeout=30.0,
    )

    claude_sonnet = BrowserChatAnthropic(
        model="claude-sonnet-4-5-20250929",
        api_key="unused",
        base_url=ANTHROPIC_PROXY_URL,
        default_headers=gitlab_headers,
        temperature=0,
        timeout=30.0,
    )

    claude_haiku = BrowserChatAnthropic(
        model="claude-haiku-4-5-20251001",
        api_key="unused",
        base_url=ANTHROPIC_PROXY_URL,
        default_headers=gitlab_headers,
        temperature=0,
        timeout=30.0,
    )

    gpt5_2 = BrowserChatOpenAI(
        model="gpt-5.2-2025-12-11",
        api_key=token_data["token"],
        base_url=OPENAI_PROXY_URL,
        default_headers=openai_headers,
        temperature=0,
        timeout=20.0,
    )

    gpt5_1 = BrowserChatOpenAI(
        model="gpt-5.1-2025-11-13",
        api_key=token_data["token"],
        base_url=OPENAI_PROXY_URL,
        default_headers=openai_headers,
        temperature=0,
        timeout=20.0,
    )

    gpt5_mini = BrowserChatOpenAI(
        model="gpt-5-mini-2025-08-07",
        api_key=token_data["token"],
        base_url=OPENAI_PROXY_URL,
        default_headers=openai_headers,
        temperature=0,
        timeout=20.0,
    )

    return {
        "claude_opus": claude_opus,
        "claude_sonnet": claude_sonnet,
        "claude_haiku": claude_haiku,
        "gpt5_2": gpt5_2,
        "gpt5_1": gpt5_1,
        "gpt5_mini": gpt5_mini,
        "llm": claude_sonnet,
        "llm_gpt": gpt5_2,
    }


def create_duo_models(api_key: str) -> dict[str, Any]:
    token_data = _get_gitlab_token(api_key)
    gitlab_headers = _build_gitlab_headers(token_data)
    return _create_models(token_data, gitlab_headers)


def refresh_models(api_key: str) -> dict[str, Any]:
    return create_duo_models(api_key)
