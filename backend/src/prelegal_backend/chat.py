"""AI chat that drafts a Mutual NDA: the model converses with the user and extracts Cover Page fields.

The API is stateless: the client sends the full message history and the current fields with every
request, and receives the assistant's reply plus the updated fields.
"""

import logging
import os
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, status
from litellm import completion
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

logger = logging.getLogger(__name__)

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
MAX_MESSAGES = 60
MAX_MESSAGE_CHARS = 4000

router = APIRouter(prefix="/api/chat", tags=["chat"])


class CamelModel(BaseModel):
    """JSON uses camelCase to match the frontend's NdaData."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ---- Current document state (mirrors frontend/lib/nda.ts NdaData) ----


class Party(CamelModel):
    name: str = ""
    title: str = ""
    company: str = ""
    notice_address: str = ""


class NdaFields(CamelModel):
    purpose: str = ""
    effective_date: str = ""  # ISO yyyy-mm-dd
    mnda_term_type: Literal["expires", "continues"] = "expires"
    mnda_term_years: int = 1
    confidentiality_type: Literal["years", "perpetual"] = "years"
    confidentiality_years: int = 1
    governing_law: str = ""
    jurisdiction: str = ""
    modifications: str = ""
    party1: Party = Field(default_factory=Party)
    party2: Party = Field(default_factory=Party)


# ---- Structured output from the model: null means "leave unchanged" ----


class PartyUpdate(CamelModel):
    name: str | None
    title: str | None
    company: str | None
    notice_address: str | None


class NdaUpdates(CamelModel):
    purpose: str | None
    effective_date: str | None = Field(description="ISO date yyyy-mm-dd")
    mnda_term_type: Literal["expires", "continues"] | None
    mnda_term_years: int | None
    confidentiality_type: Literal["years", "perpetual"] | None
    confidentiality_years: int | None
    governing_law: str | None
    jurisdiction: str | None
    modifications: str | None
    party1: PartyUpdate | None
    party2: PartyUpdate | None


class AssistantTurn(CamelModel):
    reply: str = Field(description="Your message to the user")
    updates: NdaUpdates = Field(description="Field values learned this turn; null for anything unchanged")


# ---- API models ----


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=MAX_MESSAGE_CHARS)]


class ChatRequest(CamelModel):
    messages: Annotated[list[ChatMessage], Field(min_length=1, max_length=MAX_MESSAGES)]
    fields: NdaFields = Field(default_factory=NdaFields)


class ChatResponse(CamelModel):
    reply: str
    fields: NdaFields


def apply_updates(fields: NdaFields, updates: NdaUpdates) -> NdaFields:
    """Overlay the non-null updates (including nested party fields) onto the current fields."""
    merged = fields.model_dump()
    for key, value in updates.model_dump(exclude_none=True).items():
        if isinstance(value, dict):
            merged[key].update(value)  # exclude_none already dropped unchanged party fields
        else:
            merged[key] = value
    return NdaFields.model_validate(merged)


SYSTEM_PROMPT = """\
You are Prelegal's assistant, helping the user draft a Mutual Non-Disclosure Agreement (the Common \
Paper Mutual NDA, version 1.0). You fill in its Cover Page by chatting with the user.

Cover Page fields (JSON keys in brackets):
- Purpose [purpose]: how confidential information may be used.
- Effective Date [effectiveDate]: ISO yyyy-mm-dd. Today is {today}.
- MNDA Term [mndaTermType, mndaTermYears]: "expires" after N whole years, or "continues" until terminated.
- Term of Confidentiality [confidentialityType, confidentialityYears]: N whole years from the \
Effective Date, or "perpetual".
- Governing Law [governingLaw]: a US state, e.g. "Delaware".
- Jurisdiction [jurisdiction]: city or county and state of the courts, e.g. "New Castle, DE".
- MNDA Modifications [modifications]: optional changes to the Standard Terms.
- Party 1 and Party 2 [party1, party2]: company, name (person signing), title, noticeAddress \
(email or postal address).

Required before the document can be downloaded: purpose, effectiveDate, both terms, governingLaw, \
jurisdiction, and each party's company and name. Title and notice address are recommended.

Current field values:
{fields}

How to behave:
- Hold a natural, friendly conversation. Ask about one topic at a time (at most two short questions).
- Whenever information is still needed, end your reply with a question asking for it.
- Put every value the user gives you in `updates`, including corrections. Use null for fields that \
did not change. Never invent values the user has not given or clearly agreed to; you may propose \
sensible defaults (e.g. the current purpose, today's date, 1-year terms) and record them once accepted.
- Convert dates to yyyy-mm-dd and durations to whole years.
- If the user asks for something other than a Mutual NDA, explain that only the Mutual NDA is \
supported for now.
- When all required fields are filled, briefly summarise the key terms, tell the user they can \
download the PDF, and ask if they want any changes.
- Keep replies concise and plain text (no markdown tables). You are not a lawyer; do not give legal advice.
"""


def build_messages(request: ChatRequest, today: date) -> list[dict[str, str]]:
    system = SYSTEM_PROMPT.format(
        today=today.isoformat(), fields=request.fields.model_dump_json(by_alias=True, indent=2)
    )
    return [{"role": "system", "content": system}] + [m.model_dump() for m in request.messages]


def call_llm(messages: list[dict[str, str]]) -> AssistantTurn:
    response = completion(
        model=MODEL,
        messages=messages,
        response_format=AssistantTurn,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    return AssistantTurn.model_validate_json(response.choices[0].message.content)


@router.post("", response_model_by_alias=True)
def chat(request: ChatRequest) -> ChatResponse:
    if not os.environ.get("OPENROUTER_API_KEY"):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI chat is not configured (OPENROUTER_API_KEY missing)")
    try:
        turn = call_llm(build_messages(request, date.today()))
    except Exception:
        logger.exception("LLM call failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI assistant is unavailable. Please try again.") from None
    return ChatResponse(reply=turn.reply, fields=apply_updates(request.fields, turn.updates))
