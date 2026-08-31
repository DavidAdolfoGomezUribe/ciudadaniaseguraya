from src.extraction.locations import LocationExtractor


def test_extracts_explicit_neighborhood_locality_and_intersection() -> None:
    result = LocationExtractor().extract(
        "El hecho ocurrió en el barrio Restrepo, en la localidad de Antonio Nariño. "
        "La captura se produjo en la Carrera 20 con Calle 15."
    )

    assert result is not None
    assert result.neighborhood == "Restrepo"
    assert result.locality == "Antonio Nariño"
    assert result.address == "Carrera 20 con Calle 15"
    assert "barrio Restrepo" in result.evidence


def test_uses_explicit_barrio_phrase_as_approximate_address() -> None:
    result = LocationExtractor().extract(
        "Los hechos se registraron en el barrio San Francisco tras una persecución."
    )

    assert result is not None
    assert result.address == "barrio San Francisco"
    assert result.neighborhood == "San Francisco"


def test_rejects_locality_without_explicit_neighborhood() -> None:
    assert (
        LocationExtractor().extract("El hecho ocurrió en la localidad de Kennedy.")
        is None
    )


def test_accepts_explicit_intersection_without_neighborhood() -> None:
    result = LocationExtractor().extract(
        "El ataque ocurrió en la Carrera 16 con Calle 23, en la localidad de Los Mártires."
    )

    assert result is not None
    assert result.address == "Carrera 16 con Calle 23"
    assert result.neighborhood is None
    assert result.locality == "Los Mártires"


def test_accepts_marked_named_sector_without_neighborhood() -> None:
    result = LocationExtractor().extract(
        "El robo ocurrió en el sector de Lagos de Torca, en la localidad de Suba."
    )

    assert result is not None
    assert result.address == "sector de Lagos de Torca"
    assert result.neighborhood is None
    assert result.locality == "Suba"


def test_accepts_explicit_landmark_without_neighborhood() -> None:
    result = LocationExtractor().extract(
        "El atentado ocurrió en inmediaciones de la cárcel La Modelo, en Bogotá."
    )

    assert result is not None
    assert result.address == "cárcel La Modelo"
    assert result.neighborhood is None


def test_rejects_generic_barrio_or_locality_phrase() -> None:
    assert (
        LocationExtractor().extract(
            "Se reportaron varios casos sin distinción de barrio o localidad."
        )
        is None
    )


def test_does_not_invent_neighborhood_from_bogota() -> None:
    assert LocationExtractor().extract("El robo ocurrió en Bogotá.") is None


def test_extracts_one_contextual_locality_from_a_headline() -> None:
    result = LocationExtractor.contextual_locality(
        "Capturado en flagrancia cuando robaba a una mujer en Barrios Unidos"
    )

    assert result == ("Barrios Unidos", "en Barrios Unidos")


def test_contextual_locality_rejects_ambiguous_headline() -> None:
    result = LocationExtractor.contextual_locality(
        "Operativos en Bosa y en Kennedy dejaron varias capturas"
    )

    assert result is None


def test_does_not_mix_address_from_a_second_neighborhood() -> None:
    result = LocationExtractor().extract(
        "El robo ocurrió en el barrio Restrepo, en la localidad de Antonio Nariño. "
        "Los sospechosos fueron capturados en el barrio Modelia, en la localidad "
        "de Fontibón, en la Calle 24 con Carrera 80."
    )

    assert result is not None
    assert result.neighborhood == "Restrepo"
    assert result.locality == "Antonio Nariño"
    assert result.address == "barrio Restrepo"
    assert "Modelia" not in result.evidence
    assert "Calle 24" not in result.evidence


def test_does_not_mix_adjacent_address_introduced_by_another_locality() -> None:
    result = LocationExtractor().extract(
        "El atraco ocurrió en el barrio Restrepo. "
        "La captura fue en la localidad de Kennedy, en la Carrera 80 con Calle 26."
    )

    assert result is not None
    assert result.neighborhood == "Restrepo"
    assert result.locality is None
    assert result.address == "barrio Restrepo"
    assert result.evidence == "barrio Restrepo"
