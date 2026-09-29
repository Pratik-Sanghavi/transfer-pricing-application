import json
import logging
import re
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings

logger = logging.getLogger(__name__)
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

FAR_SYSTEM = """You are a senior transfer pricing consultant. Extract a functional analysis (functions, assets, risks) from a client interview transcript, following OECD TP Guidelines Chapter I. Return ONLY JSON with keys: entity_id, characterisation, functions (object), assets (list), risks (object), flags_for_human_review (list of strings)."""
SCREEN_SYSTEM = """You are a transfer pricing benchmarking analyst. For each candidate company, decide ACCEPT or REJECT as a comparable using OECD TP Guidelines Chapter III. Return ONLY a JSON list with comp_id, decision (Accept or Reject), criterion, and reason."""
REPORT_SYSTEM = """You are drafting an audit-ready transfer pricing local-file benchmarking section. Use markdown headings, cite the supplied regulatory references, and use only the supplied data. Mark this as a consultant-review draft."""


def _chat(settings: Settings, model: str, system: str, user: str, max_tokens: int = 2500) -> str | None:
    if not settings.openrouter_api_key:
        return None
    payload = json.dumps({"model": model, "max_tokens": max_tokens, "temperature": 0.2, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}).encode()
    request = Request(OPENROUTER_URL, data=payload, headers={"Authorization": f"Bearer {settings.openrouter_api_key}", "Content-Type": "application/json", "X-OpenRouter-Title": "TP Copilot"}, method="POST")
    try:
        with urlopen(request, timeout=90) as response:
            return json.loads(response.read())['choices'][0]['message']['content']
    except (HTTPError, URLError, TimeoutError, KeyError, json.JSONDecodeError) as error:
        logger.warning("OpenRouter request failed; using deterministic demo output: %s", error)
        return None


def _json_from(text: str) -> Any:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    candidate = fenced.group(1) if fenced else text[text.find("{") if text.find("{") >= 0 else text.find("["):]
    return json.loads(candidate)


def mock_far(entity: dict[str, Any]) -> dict[str, Any]:
    return {"entity_id": entity.get("entity_id"), "characterisation": entity.get("role"), "functions": {"key_functions": entity.get("key_functions", "")}, "assets": [value.strip() for value in entity.get("key_assets", "").split(";") if value.strip()], "risks": {"summary": entity.get("key_risks", "")}, "flags_for_human_review": ["No live transcript analysis was available; review the ERP-derived functional profile."]}


def mock_screen(comps: list[dict[str, Any]], tested: dict[str, Any]) -> list[dict[str, str]]:
    keyword_rules = [(r"patent|proprietary|licens", "Intangibles", "Owns or licenses significant intangibles."), (r"\bBPO\b|call-center|call center", "Functional", "BPO/call-center services are not comparable."), (r"retail|consumer", "Functional", "Consumer retail differs from a routine B2B profile."), (r"restructuring|persistent losses", "Persistent losses", "Loss-making or restructuring company."), (r"subsidiary of|owned by", "Independence", "Part of a group; fails independence screen.")]
    output = []
    for comp in comps:
        decision, criterion, reason = "Accept", "Comparable", f"Independent, functionally similar to {tested.get('role', 'the tested party')}."
        if float(comp.get("largest_shareholder_pct") or 0) > 25:
            decision, criterion, reason = "Reject", "Independence", f"Largest shareholder holds {comp['largest_shareholder_pct']}% (>25% threshold)."
        elif int(comp.get("loss_years") or 0) >= 2:
            decision, criterion, reason = "Reject", "Persistent losses", f"Operating losses in {comp['loss_years']} of 3 years."
        else:
            for pattern, candidate_criterion, candidate_reason in keyword_rules:
                if re.search(pattern, comp.get("business_description", ""), re.I):
                    decision, criterion, reason = "Reject", candidate_criterion, candidate_reason
                    break
        output.append({"comp_id": comp["comp_id"], "decision": decision, "criterion": criterion, "reason": reason})
    return output


def mock_report(context: dict[str, Any]) -> str:
    entity, benchmark = context["entity"], context["benchmark"]
    return f"# Transfer Pricing Local File (Draft)\n\n## Tested party\n{entity['entity_name']} is characterised as **{entity['role']}**.\n\n## Method and PLI\nTNMM / CPM is proposed with **{benchmark['pli_type_long']}**.\n\n## Arm's-length result\nThe three-year tested-party PLI is **{benchmark['tested_pli']:.1%}**, against an IQR of **{benchmark['lq']:.1%}–{benchmark['uq']:.1%}** (median **{benchmark['median']:.1%}**).\n\n## Compliance\nThis is illustrative output for consultant review; conclusions should be traced to the cited OECD guidance before use."


def far(settings: Settings, transcript: str, entity: dict[str, Any]) -> dict[str, Any]:
    content = _chat(settings, settings.openrouter_model_strong, FAR_SYSTEM, f"Entity master data:\n{json.dumps(entity)}\n\nInterview transcript:\n{transcript}") if transcript.strip() else None
    if content:
        try:
            return {"result": _json_from(content), "source": "live"}
        except json.JSONDecodeError:
            logger.warning("OpenRouter FAR response was not JSON; using deterministic demo output")
    return {"result": mock_far(entity), "source": "mock"}


def screen(settings: Settings, comps: list[dict[str, Any]], tested: dict[str, Any], far_data: dict[str, Any] | None) -> dict[str, Any]:
    content = _chat(settings, settings.openrouter_model_fast, SCREEN_SYSTEM, f"Tested party:\n{json.dumps(tested)}\n\nApproved FAR:\n{json.dumps(far_data or {})}\n\nCandidates:\n{json.dumps(comps)}")
    if content:
        try:
            result = _json_from(content)
            if not isinstance(result, list): result = next(value for value in result.values() if isinstance(value, list))
            return {"result": result, "source": "live"}
        except (json.JSONDecodeError, StopIteration):
            logger.warning("OpenRouter screening response was invalid; using deterministic demo output")
    return {"result": mock_screen(comps, tested), "source": "mock"}


def report(settings: Settings, context: dict[str, Any]) -> dict[str, Any]:
    content = _chat(settings, settings.openrouter_model_strong, REPORT_SYSTEM, json.dumps(context), 4000)
    return {"result": content or mock_report(context), "source": "live" if content else "mock"}