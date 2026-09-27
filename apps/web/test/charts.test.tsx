import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DivergingColumns, HBars } from "@/components/charts";

describe("DivergingColumns", () => {
  it("keeps every value reachable in the table view, not only in the picture", () => {
    render(
      <DivergingColumns
        title="Sao theo từng ngày"
        data={[
          { label: "T2", plus: 12, minus: 1 },
          { label: "T3", plus: 4, minus: 0 },
        ]}
      />,
    );
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual(["Thời gianCộngTrừ", "T2+12−1", "T3+4−0"]);
  });
});

describe("HBars", () => {
  it("labels each bar with its value, and says so when there is nothing yet", () => {
    const { rerender } = render(<HBars title="Nhóm" empty="Chưa có." rows={[{ label: "Học tập", value: 9 }]} />);
    expect(screen.getByText("9")).toBeInTheDocument();
    rerender(<HBars title="Nhóm" empty="Chưa có." rows={[{ label: "Học tập", value: 0 }]} />);
    expect(screen.getByText("Chưa có.")).toBeInTheDocument();
  });
});
