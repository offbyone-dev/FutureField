from app.engines.rotation_history import extract_current_rotation
from app.schemas.field import CropHistoryItem


def test_valid_history():

    history = [
        CropHistoryItem(
            crop_id="rice",
            season="aman",
            year=2023,
        ),
        CropHistoryItem(
            crop_id="mungbean",
            season="summer",
            year=2024,
        ),
        CropHistoryItem(
            crop_id="maize",
            season="winter",
            year=2025,
        ),
    ]

    result = extract_current_rotation(
        history,
        n_slots=3,
    )

    assert result.status == "available"

    assert result.crop_ids == [
        "rice",
        "mungbean",
        "maize",
    ]


def test_missing_history():

    result = extract_current_rotation(
        [],
        n_slots=3,
    )

    assert result.status == "unavailable"

    assert result.crop_ids == []


def test_ambiguous_history():

    history = [
        CropHistoryItem(
            crop_id="rice",
            season="aman",
            year=2024,
        ),
        CropHistoryItem(
            crop_id="mungbean",
            season="summer",
            year=2024,
        ),
        CropHistoryItem(
            crop_id="maize",
            season="winter",
            year=2025,
        ),
    ]

    result = extract_current_rotation(
        history,
        n_slots=3,
    )

    assert result.status == "insufficient"

    assert result.crop_ids == []


if __name__ == "__main__":

    test_valid_history()

    test_missing_history()

    test_ambiguous_history()

    print("All rotation history tests passed!")