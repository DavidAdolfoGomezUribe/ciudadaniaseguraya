from src.scrapers.normalization import (
    canonicalize_url,
    clean_text,
    concise_description,
    normalized_title,
    title_fingerprint,
)


def test_clean_text_repairs_common_cms_drop_cap_split() -> None:
    assert clean_text("U na discusión ocurrió. E l hecho fue reportado.") == (
        "Una discusión ocurrió. El hecho fue reportado."
    )


def test_clean_text_removes_cms_space_before_punctuation() -> None:
    assert clean_text("Ocurrió en Bogotá . Hubo una víctima .") == (
        "Ocurrió en Bogotá. Hubo una víctima."
    )


def test_title_normalization_removes_html_whitespace_and_diacritics() -> None:
    raw = "  Alerta&nbsp;por\n\tHURTÓ   una moto  "

    assert clean_text(raw) == "Alerta por HURTÓ una moto"
    assert normalized_title(raw) == "alerta por hurto una moto"


def test_title_fingerprint_is_stable_for_equivalent_titles() -> None:
    assert title_fingerprint("Robo en Bogotá") == title_fingerprint(
        "  ROBO\nEN Bogota!!! "
    )


def test_canonicalize_url_removes_tracking_but_keeps_meaningful_query() -> None:
    value = "HTTPS://Example.COM/noticia?utm_source=x&page=2#fragment"

    assert canonicalize_url(value) == "https://example.com/noticia?page=2"


def test_concise_description_includes_ellipsis_inside_utf16_limit() -> None:
    result = concise_description("📹" + ("palabra " * 100), maximum=50)

    assert result.endswith("…")
    assert len(result.encode("utf-16-le")) // 2 <= 50
