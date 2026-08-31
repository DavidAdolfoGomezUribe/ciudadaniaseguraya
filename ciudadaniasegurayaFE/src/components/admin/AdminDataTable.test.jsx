import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminDataTable } from "./AdminDataTable";

describe("AdminDataTable", () => {
  it("delega orden y paginación al backend", async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const onPageChange = vi.fn();
    render(
      <AdminDataTable
        caption="Usuarios"
        rows={[{ id: "1", username: "ana" }]}
        columns={[{ key: "username", header: "Usuario", sortable: true }]}
        sort={{ sortBy: "username", sortOrder: "asc" }}
        onSort={onSort}
        pagination={{ page: 1, totalPages: 3, total: 60, pageSize: 25 }}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Usuario/ }));
    expect(onSort).toHaveBeenCalledWith({
      sortBy: "username",
      sortOrder: "desc",
    });
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
