from typing import Any
from pydantic import BaseModel, Field


class FarUpdate(BaseModel):
    functions: list[str] = Field(default_factory=list)
    assets: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    reviewer: str = "consultant"
    notes: str = ""


class BenchmarkRequest(BaseModel):
    segment: str = Field(pattern="^(distributor|services)$")
    tested_entity_id: str
    tested_margin: float | None = None
    scenario_margin_delta: float = 0.0


class ReportRequest(BaseModel):
    entity_id: str
    benchmark_segment: str = Field(pattern="^(distributor|services)$")
    reviewer: str = "consultant"


class FarAIRequest(BaseModel):
    transcript: str = ""
    entity: dict[str, Any]


class ScreenAIRequest(BaseModel):
    comps: list[dict[str, Any]]
    tested: dict[str, Any]
    far: dict[str, Any] | None = None


class ReportAIRequest(BaseModel):
    ctx: dict[str, Any]