"""THE shared core. Suitability, rotation and the Scenario Lab all start here:
field + environment (+ optional what-if) -> FieldCondition.
The simulation never duplicates logic; it only changes the indicators fed in here."""
from app.engines import field_intelligence, simulation
from app.processing import normalization
from app.schemas.analysis import FieldCondition, SimulationParams
from app.schemas.environment import EnvironmentalData
from app.schemas.field import FieldOut
from app.services import environment_service, field_service


def build_condition(field_id: str, sim: SimulationParams | None = None
                    ) -> tuple[FieldOut, EnvironmentalData, FieldCondition]:
    field = field_service.get_field(field_id)
    env = environment_service.get_environment(field_id)
    ind, irrigation_scale = dict(env.indicators), 1.0
    if sim is not None:
        ind, irrigation_scale = simulation.apply_simulation(ind, sim)
    normalized = normalization.normalize_indicators(ind)
    cond = field_intelligence.build_field_condition(field, ind, normalized, env.quality_score, irrigation_scale)
    return field, env, cond

