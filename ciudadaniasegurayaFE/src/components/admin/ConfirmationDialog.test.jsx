import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "./ConfirmationDialog";

describe("ConfirmationDialog", () => {
  it("exige motivo y confirmación textual antes de una eliminación", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmationDialog
        open
        title="Eliminar cuenta"
        action="Eliminar lógicamente"
        resource="usuario-1"
        consequence="La cuenta será anonimizada."
        confirmationText="ELIMINAR"
        confirmLabel="ELIMINAR"
        onClose={vi.fn()}
        onConfirm={confirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Eliminar cuenta" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const button = screen.getByRole("button", { name: "ELIMINAR" });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo *"), "Incumplimiento reiterado");
    await user.type(
      screen.getByLabelText("Escribe ELIMINAR para confirmar *"),
      "ELIMINAR",
    );
    expect(button).toBeEnabled();
    await user.click(button);
    expect(confirm).toHaveBeenCalledWith({
      reason: "Incumplimiento reiterado",
      confirmation: "ELIMINAR",
    });
  });
});
