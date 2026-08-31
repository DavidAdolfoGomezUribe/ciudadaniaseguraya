import src.main as main_module


def test_menu_option_one_runs_the_five_news_search(
    monkeypatch,
    capsys,
) -> None:
    requested: list[int] = []

    async def fake_run_scrape(limit: int) -> int:
        requested.append(limit)
        return 0

    monkeypatch.setattr(main_module, "_run_scrape", fake_run_scrape)
    monkeypatch.setattr("builtins.input", lambda _prompt: "1")

    result = main_module._interactive_menu(default_limit=5)

    assert result == 0
    assert requested == [5]
    assert "Buscar 5 noticias" in capsys.readouterr().out


def test_menu_can_start_the_api(monkeypatch) -> None:
    calls: list[tuple[str, int]] = []

    def fake_run_server(*, host: str, port: int, reload: bool = False) -> int:
        calls.append((host, port))
        return 0

    monkeypatch.setattr(main_module, "_run_server", fake_run_server)
    monkeypatch.setattr("builtins.input", lambda _prompt: "2")

    result = main_module._interactive_menu(default_limit=5)

    assert result == 0
    assert calls == [("0.0.0.0", 8000)]


def test_menu_reprompts_after_an_invalid_option(monkeypatch, capsys) -> None:
    options = iter(("9", "0"))
    monkeypatch.setattr("builtins.input", lambda _prompt: next(options))

    result = main_module._interactive_menu(default_limit=5)

    assert result == 0
    assert "Opción inválida" in capsys.readouterr().out


def test_iteration_two_cli_accepts_collection_and_comparison_commands() -> None:
    parser = main_module._parser(default_limit=5, maximum_limit=100)

    collection = parser.parse_args(
        ["collect", "--limit", "100", "--output", ".runs/articles-100.jsonl"]
    )
    baseline = parser.parse_args(
        ["baseline", "--input", ".runs/articles-100.jsonl"]
    )
    agent = parser.parse_args(
        [
            "agent",
            "--input",
            ".runs/articles-100.jsonl",
            "--provider",
            "ollama",
            "--output",
            ".runs/candidates.jsonl",
        ]
    )
    ingest = parser.parse_args(
        ["ingest", "--input", ".runs/candidates.jsonl", "--limit", "5"]
    )

    assert collection.limit == 100
    assert baseline.command == "baseline"
    assert agent.provider == "ollama"
    assert agent.output.as_posix() == ".runs/candidates.jsonl"
    assert ingest.limit == 5
