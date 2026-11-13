from app.engines.personal_rotation_scoring import (
    score_personal_rotation,
)
from app.knowledge.loader import load_crops
from app.schemas.analysis import (
    Priorities,
    SuitabilityResult,
)


def test_personal_rotation_scoring():

    crops = load_crops()

    assert len(crops) >= 3

    sequence = tuple(crops[:3])

    suitability_by_crop = {
        crop.id: SuitabilityResult(
            crop_id=crop.id,
            crop_name=crop.name,
            total_score=75.0,
            components={
                "water": 0.75,
                "temp": 0.75,
                "soil": 0.75,
                "risk": 0.75,
            },
            weights={
                "water": 0.25,
                "temp": 0.25,
                "soil": 0.25,
                "risk": 0.25,
            },
            recommended=True,
        )
        for crop in sequence
    }

    result = score_personal_rotation(
        sequence=sequence,
        suitability_by_crop=suitability_by_crop,
        priorities=Priorities(),
    )

    assert len(result.crop_ids) == 3

    assert len(result.slot_scores) == 3

    assert 0 <= result.score.total <= 100

    assert 0 <= result.score.water_impact <= 1

    assert 0 <= result.score.soil_impact <= 1

    assert 0 <= result.score.resilience <= 1


if __name__ == "__main__":
    test_personal_rotation_scoring()
    print("Personal rotation scoring tests passed!")