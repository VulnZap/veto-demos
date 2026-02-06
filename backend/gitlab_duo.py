from __future__ import annotations

from typing import Any

import requests
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI


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


def create_duo_models(api_key: str) -> dict[str, Any]:
    token_data = _get_gitlab_token(api_key)
    gitlab_headers = _build_gitlab_headers(token_data)

    claude_opus = ChatAnthropic(
        model="claude-opus-4-5-20251101",
        anthropic_api_key="unused",
        anthropic_api_url="https://cloud.gitlab.com/ai/v1/proxy/anthropic",
        default_headers=gitlab_headers,
        temperature=0,
        request_timeout=30,
    )

    claude_sonnet = ChatAnthropic(
        model="claude-sonnet-4-5-20250929",
        anthropic_api_key="unused",
        anthropic_api_url="https://cloud.gitlab.com/ai/v1/proxy/anthropic",
        default_headers=gitlab_headers,
        temperature=0,
        request_timeout=30,
    )

    claude_haiku = ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        anthropic_api_key="unused",
        anthropic_api_url="https://cloud.gitlab.com/ai/v1/proxy/anthropic",
        default_headers=gitlab_headers,
        temperature=0,
        request_timeout=30,
    )

    gpt5_2 = ChatOpenAI(
        model="gpt-5.2-2025-12-11",
        openai_api_key="unused",
        openai_api_base="https://cloud.gitlab.com/ai/v1/proxy/openai/v1",
        default_headers=gitlab_headers,
        temperature=0,
        request_timeout=20,
    )

    gpt5_1 = ChatOpenAI(
        model="gpt-5.1-2025-11-13",
        openai_api_key="unused",
        openai_api_base="https://cloud.gitlab.com/ai/v1/proxy/openai/v1",
        default_headers=gitlab_headers,
        temperature=0,
        request_timeout=20,
    )

    gpt5_mini = ChatOpenAI(
        model="gpt-5-mini-2025-08-07",
        openai_api_key="unused",
        openai_api_base="https://cloud.gitlab.com/ai/v1/proxy/openai/v1",
        default_headers=gitlab_headers,
        temperature=0,
        request_timeout=20,
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
