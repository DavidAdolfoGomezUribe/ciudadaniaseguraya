import { IsRestoringProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryRestoreGate } from "./QueryRestoreGate";

describe("QueryRestoreGate", () => {
  it("no monta consumidores de consultas durante la restauración inicial", () => {
    const consumeQuery = vi.fn();

    function QueryConsumer() {
      consumeQuery();
      return <p>Datos restaurados</p>;
    }

    const view = render(
      <IsRestoringProvider value>
        <QueryRestoreGate fallback={<p>Restaurando caché</p>}>
          <QueryConsumer />
        </QueryRestoreGate>
      </IsRestoringProvider>,
    );

    expect(screen.getByText("Restaurando caché")).toBeInTheDocument();
    expect(consumeQuery).not.toHaveBeenCalled();

    view.rerender(
      <IsRestoringProvider value={false}>
        <QueryRestoreGate fallback={<p>Restaurando caché</p>}>
          <QueryConsumer />
        </QueryRestoreGate>
      </IsRestoringProvider>,
    );

    expect(screen.getByText("Datos restaurados")).toBeInTheDocument();
    expect(consumeQuery).toHaveBeenCalledOnce();
  });
});
