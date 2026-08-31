import pytest

from src.classifiers.rule_based_classifier import RuleBasedClassifier


@pytest.fixture
def classifier() -> RuleBasedClassifier:
    return RuleBasedClassifier(
        (
            "atraco",
            "robo",
            "hurto",
            "homicidio",
            "agresion",
            "secuestro",
            "extorsion",
            "violencia_sexual",
            "violencia_intrafamiliar",
            "vandalismo",
            "otro",
        )
    )


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("El atraco ocurrió ayer contra un comerciante", "atraco"),
        ("Una mujer fue víctima de robo en el barrio Restrepo", "robo"),
        ("Capturado por hurto ocurrido en Kennedy", "hurto"),
        ("Investigan homicidio ocurrido en el barrio Santa Fe", "homicidio"),
        ("Un joven fue secuestrado en Suba", "secuestro"),
        (
            "Un incendio se registró ayer en el barrio La Estrada",
            "otro",
        ),
        (
            "Un ataque con artefacto explosivo ocurrió en el barrio Santa Fe",
            "otro",
        ),
    ],
)
def test_classifies_concrete_backend_types(
    classifier: RuleBasedClassifier, text: str, expected: str
) -> None:
    assert classifier.classify(text, text, text) == expected


@pytest.mark.parametrize(
    "title",
    [
        "Cinco recomendaciones para prevenir el hurto",
        "Informe mensual de homicidios en Bogotá",
        "Disminución de casos de robo durante 2026",
        "Campaña de prevención del atraco en TransMilenio",
    ],
)
def test_rejects_non_individual_reports(
    classifier: RuleBasedClassifier, title: str
) -> None:
    assert classifier.classify(title, title, title) is None


def test_discovery_allows_ladrones_until_full_article_is_read(
    classifier: RuleBasedClassifier,
) -> None:
    assert classifier.might_be_incident(
        "Dos presuntos ladrones fueron capturados en Ciudad Bolívar"
    )


def test_rejects_unknown_configured_type() -> None:
    with pytest.raises(ValueError):
        RuleBasedClassifier(("incendio",))


def test_compact_evidence_does_not_borrow_type_from_another_field(
    classifier: RuleBasedClassifier,
) -> None:
    assert classifier.classify_evidence(
        "La captura ocurrió el 20 de agosto a las 8:30 p. m."
    ) is None
    assert classifier.classify_evidence(
        "El robo ocurrió el 20 de agosto a las 8:30 p. m."
    ) == "robo"


def test_compact_evidence_accepts_a_registered_explosive_attack(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "Un ataque con un artefacto explosivo se registró en la noche del "
        "22 de enero, sobre las 9:00 p. m., en el barrio Santa Fe."
    )

    assert classifier.classify_evidence(evidence) == "otro"


def test_explosive_attack_headline_with_casualty_is_concrete(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "Ataque con artefacto explosivo en el barrio Santa Fe deja un muerto "
        "y 13 heridos"
    )

    assert classifier.classify_evidence(evidence) == "otro"


def test_fatal_assault_wording_supports_homicide(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "Los hechos ocurrieron en un inmueble donde un hombre lesionó con arma "
        "blanca a una mujer causándole la muerte."
    )

    assert classifier.classify_evidence(evidence) == "homicidio"


@pytest.mark.parametrize(
    "evidence",
    [
        (
            "La Policía recuperó en el barrio La Favorita tres motocicletas "
            "que habían sido hurtadas."
        ),
        (
            "Cuatro hombres desguazaban en el barrio Restrepo un vehículo "
            "hurtado."
        ),
        "Fue capturado en el barrio Modelia con un celular robado.",
        (
            "En el barrio Restrepo, un ciudadano rastreaba mediante GPS su "
            "vehículo, hurtado horas antes en otra localidad."
        ),
        (
            "En el barrio Caracolí los uniformados lograron ubicar un camión "
            "que había sido reportado como hurtado horas antes."
        ),
    ],
)
def test_recovery_location_does_not_become_property_crime_location(
    classifier: RuleBasedClassifier,
    evidence: str,
) -> None:
    assert classifier.classify_evidence(evidence) is None


def test_direct_property_crime_remains_valid_even_when_property_was_recovered(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "La víctima denunció que le robaron la moto en el barrio Restrepo; "
        "la Policía la recuperó horas después."
    )

    assert classifier.classify_evidence(evidence) == "robo"


@pytest.mark.parametrize(
    ("evidence", "expected"),
    [
        (
            "Video: Capturados luego de hurtar supermercado en el barrio Venecia.",
            "hurto",
        ),
        (
            "Dos hombres fueron capturados luego de robar un local en el barrio Restrepo.",
            "robo",
        ),
    ],
)
def test_direct_property_infinitives_are_supported(
    classifier: RuleBasedClassifier,
    evidence: str,
    expected: str,
) -> None:
    assert classifier.classify_evidence(evidence) == expected


def test_arrest_place_alone_does_not_become_theft_place(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "Tres hombres señalados de participar en el hurto a un transeúnte "
        "fueron capturados en el barrio San Miguel cuando intentaban escapar."
    )

    assert classifier.classify_evidence(evidence) is None


def test_presumed_vehicle_involvement_is_not_theft_location(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "Los hechos se registraron en el barrio Tabora, donde la Policía "
        "identificó un vehículo reportado por su presunta participación en "
        "un hurto ocurrido en otra localidad."
    )

    assert classifier.classify_evidence(evidence) is None


def test_explicitly_located_robbery_with_later_arrest_remains_valid(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "El robo ocurrió en el barrio La Joya y los responsables fueron "
        "capturados por la Policía."
    )

    assert classifier.classify_evidence(evidence) == "robo"


@pytest.mark.parametrize(
    "evidence",
    [
        "En este ataque murieron un empresario y su escolta.",
        "Atentado contra funcionarios del INPEC deja un dragoneante muerto.",
    ],
)
def test_fatal_attack_wording_supports_homicide(
    classifier: RuleBasedClassifier,
    evidence: str,
) -> None:
    assert classifier.classify_evidence(evidence) == "homicidio"


def test_singular_sicarial_attack_with_occurrence_supports_homicide(
    classifier: RuleBasedClassifier,
) -> None:
    assert classifier.classify_evidence(
        "El ataque sicarial ocurrido el pasado 11 de febrero."
    ) == "homicidio"


def test_event_that_ended_in_firearm_aggression_is_direct_evidence(
    classifier: RuleBasedClassifier,
) -> None:
    assert classifier.classify_evidence(
        "La discusión terminó en una agresión con arma de fuego."
    ) == "agresion"


@pytest.mark.parametrize(
    ("evidence", "expected"),
    [
        (
            "Intento de feminicidio en Usaquén: menor de 16 años fue apuñalada "
            "por su pareja.",
            "agresion",
        ),
        (
            "Armas traumáticas en atracos: hombre fue herido durante un robo "
            "en el norte de Bogotá.",
            "atraco",
        ),
        (
            "La Policía capturó a un hombre por el delito de fuga de presos.",
            "otro",
        ),
        (
            "Tres adolescentes fueron aprehendidos tras hurtar un vehículo.",
            "hurto",
        ),
    ],
)
def test_additional_concrete_incident_wording(
    classifier: RuleBasedClassifier,
    evidence: str,
    expected: str,
) -> None:
    assert classifier.classify_evidence(evidence) == expected


def test_one_sentence_can_support_two_explicit_backend_categories(
    classifier: RuleBasedClassifier,
) -> None:
    evidence = (
        "Armas traumáticas en atracos: hombre fue herido durante un robo "
        "en el norte de Bogotá."
    )

    assert classifier.supports_evidence_type(evidence, "atraco") is True
    assert classifier.supports_evidence_type(evidence, "robo") is True


def test_frustrated_concrete_robbery_is_direct_evidence(
    classifier: RuleBasedClassifier,
) -> None:
    assert classifier.classify_evidence(
        "Alerta ciudadana frustró robo: capturados tres presuntos apartamenteros."
    ) == "robo"
