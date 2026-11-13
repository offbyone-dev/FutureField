from app.schemas.analysis import FieldCondition
from app.services import pipeline


def get_intelligence(field_id: str) -> FieldCondition:
    return pipeline.build_condition(field_id)[2]
