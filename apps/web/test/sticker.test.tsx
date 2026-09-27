import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StudentRow } from "@lhhp/shared";
import { StickerCard } from "@/components/teacher/score";

const s: StudentRow = {
  id: 7,
  fullName: "Nguyễn Minh Anh",
  username: "Anh2026",
  group: 2,
  avatarEmoji: "🐰",
  avatarUrl: null,
  lastLoginAt: null,
  points: 21,
  drops: 23,
  weekPoints: 5,
  level: 2,
};

function setup(props: Partial<Parameters<typeof StickerCard>[0]> = {}) {
  const onScore = vi.fn();
  const onMenu = vi.fn();
  const onToggle = vi.fn();
  render(
    <ul>
      <StickerCard s={s} bursts={[]} selectMode={false} selected={false} onScore={onScore} onMenu={onMenu} onToggle={onToggle} {...props} />
    </ul>,
  );
  return { onScore, onMenu, onToggle };
}

describe("StickerCard", () => {
  it("shows the child's name, level, group and drops", () => {
    setup();
    expect(screen.getByText("Nguyễn Minh Anh")).toBeInTheDocument();
    expect(screen.getByText(/Lv 2/)).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nguyễn Minh Anh có 21 giọt nước. Mở bảng cộng nhanh" })).toHaveTextContent("21");
  });

  it("+💧 and −💧 score one drop at once, no reason asked", async () => {
    const { onScore } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Cộng 1 giọt nước cho Nguyễn Minh Anh" }));
    await userEvent.click(screen.getByRole("button", { name: "Trừ 1 giọt nước của Nguyễn Minh Anh" }));
    expect(onScore.mock.calls).toEqual([[1], [-1]]);
  });

  it("tapping the drop count opens the quick menu", async () => {
    const { onMenu, onScore } = setup();
    await userEvent.click(screen.getByRole("button", { name: /có 21 giọt nước/ }));
    expect(onMenu).toHaveBeenCalledOnce();
    expect(onScore).not.toHaveBeenCalled();
  });

  it("in select mode the whole sticker toggles the child, and scoring buttons go away", async () => {
    const { onToggle } = setup({ selectMode: true });
    expect(screen.queryByRole("button", { name: /Cộng 1 giọt nước/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { pressed: false }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows the burst when drops land", () => {
    setup({ bursts: [{ id: 1, delta: 5 }] });
    expect(screen.getByText("+5 💧")).toHaveClass("burst-big");
  });
});
