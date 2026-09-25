"""Shared access to the LLM used for decision support and prescription checks.

Everything is configured from .env:

    AI_API_KEY   key for the provider (falls back to OPENAI_API_KEY)
    AI_BASE_URL  any OpenAI-compatible endpoint; blank means api.openai.com
    AI_MODEL     model name sent to that endpoint; blank keeps each feature's default
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

# When a provider rejects one of these request options, the next attempt
# swaps it for its alternative (None = drop it). Reasoning models want
# max_completion_tokens and the default temperature; older models and many
# compatible APIs want max_tokens; some don't support JSON mode.
_FALLBACKS = {
    "max_tokens": "max_completion_tokens",
    "max_completion_tokens": "max_tokens",
    "temperature": None,
    "response_format": None,
}


def ai_configured():
    return bool(settings.AI_API_KEY)


def ai_model(default):
    return settings.AI_MODEL or default


def ai_client():
    from openai import OpenAI

    return OpenAI(api_key=settings.AI_API_KEY, base_url=settings.AI_BASE_URL or None)


def _rejected_param(exc):
    """Name of the request option a 400 error complains about, if any."""
    body = getattr(exc, "body", None) or {}
    err = body.get("error", body) if isinstance(body, dict) else {}
    param = err.get("param") if isinstance(err, dict) else None
    if param in _FALLBACKS:
        return param
    message = str(exc)
    return next((p for p in _FALLBACKS if f"'{p}'" in message), None)


def ai_chat(messages, *, default_model, max_tokens, temperature=None, json_mode=False, timeout=90):
    """Run a chat completion and return the reply text.

    Adapts to the model: options the provider rejects are swapped or dropped
    and the request retried, so the same code works across model families.
    """
    from openai import BadRequestError

    kwargs = {"max_tokens": max_tokens}
    if temperature is not None:
        kwargs["temperature"] = temperature
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    client = ai_client()
    model = ai_model(default_model)
    tried = set()
    while True:
        try:
            response = client.chat.completions.create(model=model, messages=messages, timeout=timeout, **kwargs)
            return response.choices[0].message.content or ""
        except BadRequestError as exc:
            param = _rejected_param(exc)
            if param is None or param not in kwargs or param in tried:
                raise
            tried.add(param)
            value = kwargs.pop(param)
            replacement = _FALLBACKS[param]
            if replacement and replacement not in tried:
                kwargs[replacement] = value
            logger.info("Model %s rejected %r; retrying with %s", model, param, replacement or "it removed")
