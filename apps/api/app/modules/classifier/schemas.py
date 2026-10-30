from typing import Annotated

from pydantic import BaseModel, Field


class Prediction(BaseModel):
    topic: str
    topic_label: str
    topic_confidence: float
    grade_band: str
    grade_band_label: str
    grade_band_confidence: float
    grade: int | None
    grade_confidence: float
    difficulty: float
    level: str


class ClassifierStatus(BaseModel):
    available: bool
    loaded: bool
    reason: str | None
    base_model: str | None
    # Độ chính xác trên đề thật chưa thấy khi train (labels.json)
    real_test: dict


class PredictIn(BaseModel):
    texts: list[Annotated[str, Field(min_length=3, max_length=3000)]] = Field(min_length=1, max_length=20)
