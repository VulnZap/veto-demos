from __future__ import annotations

import logging
from typing import Any

import aiohttp

logger = logging.getLogger("demo.policies")

DEMO_POLICIES: list[dict[str, Any]] = [
    {
        "toolName": "navigate",
        "mode": "deterministic",
        "constraints": [
            {
                "argumentName": "url",
                "enabled": True,
                "regex": r"^(?!.*(chase|wellsfargo|bankofamerica|paypal|venmo)\.com).*$",
            },
        ],
    },
    {
        "toolName": "input",
        "mode": "deterministic",
        "constraints": [
            {
                "argumentName": "text",
                "enabled": True,
                "maxLength": 500,
            },
        ],
    },
    {
        "toolName": "click",
        "mode": "llm",
        "llmConfig": {
            "description": (
                "Block clicks on buttons that commit financial transactions "
                "such as Buy Now, Purchase, Submit Payment, Place Order, or Checkout. "
                "Allow all other clicks including navigation links, form inputs, and menu items."
            ),
            "exceptions": [
                "If the button is clearly a search or navigation action, allow the click",
                "If the button adds an item to a cart without completing purchase, allow the click",
            ],
        },
    },
    {
        "toolName": "search",
        "mode": "deterministic",
        "constraints": [
            {
                "argumentName": "query",
                "enabled": True,
                "maxLength": 200,
            },
        ],
    },
]


def _headers(api_key: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "X-Veto-API-Key": api_key,
    }


async def _get_existing_policies(
    api_key: str, base_url: str
) -> dict[str, str]:
    """Return a mapping of toolName -> policyId for policies that already exist."""
    url = f"{base_url.rstrip('/')}/v1/policies"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=_headers(api_key)) as resp:
                if resp.ok:
                    data = await resp.json()
                    policies = data if isinstance(data, list) else data.get("policies", [])
                    return {p["toolName"]: p["id"] for p in policies if "toolName" in p and "id" in p}
    except Exception as e:
        logger.warning("Failed to fetch existing policies: %s", e)
    return {}


async def ensure_demo_policies(api_key: str, base_url: str) -> list[str]:
    """Create demo policies if they don't already exist. Returns list of created policy IDs."""
    existing = await _get_existing_policies(api_key, base_url)
    created_ids: list[str] = []
    url = f"{base_url.rstrip('/')}/v1/policies"

    async with aiohttp.ClientSession() as session:
        for policy in DEMO_POLICIES:
            tool_name = policy["toolName"]
            if tool_name in existing:
                logger.info("Policy for %s already exists, skipping", tool_name)
                created_ids.append(existing[tool_name])
                continue

            try:
                async with session.post(url, json=policy, headers=_headers(api_key)) as resp:
                    if resp.ok:
                        data = await resp.json()
                        policy_id = data.get("id", "")
                        created_ids.append(policy_id)
                        logger.info("Created demo policy for %s: %s", tool_name, policy_id)
                    else:
                        text = await resp.text()
                        logger.warning("Failed to create policy for %s: %s %s", tool_name, resp.status, text)
            except Exception as e:
                logger.warning("Error creating policy for %s: %s", tool_name, e)

    return created_ids


async def cleanup_demo_policies(api_key: str, base_url: str, policy_ids: list[str]) -> None:
    """Delete demo policies created during a session."""
    base = base_url.rstrip("/")
    async with aiohttp.ClientSession() as session:
        for pid in policy_ids:
            if not pid:
                continue
            try:
                url = f"{base}/v1/policies/{pid}"
                async with session.delete(url, headers=_headers(api_key)) as resp:
                    if resp.ok:
                        logger.info("Deleted demo policy %s", pid)
                    else:
                        logger.warning("Failed to delete policy %s: %s", pid, resp.status)
            except Exception as e:
                logger.warning("Error deleting policy %s: %s", pid, e)
