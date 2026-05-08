import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DishGrid } from "@/components/DishGrid";
import type { DishWithSelection } from "@/hooks/useRealtimeRoom";

// Use importOriginal to avoid breaking Dialog's internal lucide imports
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    // We only need to verify these specific icons exist in tests,
    // but keep the real ones so Dialog works
  };
});

const baseDish: DishWithSelection = {
  id: "dish-1",
  name: "宫保鸡丁",
  description: "鸡肉·花生·干辣椒",
  image_url: "",
  category: "热菜",
  created_by: "管理员",
  created_at: "2026-01-01",
  selected_quantity: 0,
  selected_note: "",
  ordered_by: [],
};

describe("DishGrid - co-diner warning", () => {
  it("shows confirmation dialog when reducing to 0 with co-diners", async () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    const dish: DishWithSelection = {
      ...baseDish,
      selected_quantity: 1,
      ordered_by: ["爸爸", "妈妈"],
    };

    render(
      <DishGrid
        dishes={[dish]}
        userNickname="爸爸"
        onUpdateQuantity={onUpdate}
        onRemoveDish={onRemove}
      />
    );

    // Click the minus button (first button with "-" text)
    const minusButtons = screen.getAllByRole("button");
    const minusBtn = minusButtons.find(
      (btn) => btn.querySelector("svg")?.parentElement === btn && btn.innerHTML.includes("minus")
    );
    // Actually, let's just find the minus button by its position
    // The dish card has: [X remove], [image], [...minus, count, plus...]
    // The minus button has the lucide Minus icon as child
    const allButtons = screen.getAllByRole("button");
    // Minus button: disabled when quantity is 0
    const minusButton = allButtons.find(
      (btn) => btn.querySelector(".lucide-minus") !== null
    );
    expect(minusButton).toBeTruthy();
    fireEvent.click(minusButton!);

    // Dialog should appear (妈妈 appears on card AND in dialog)
    expect(screen.getByText("取消自己的点单")).toBeInTheDocument();
    const momElements = screen.getAllByText(/妈妈/);
    expect(momElements.length).toBeGreaterThanOrEqual(2); // card + dialog

    // Confirm cancel
    const confirmBtn = screen.getByText("确认取消");
    fireEvent.click(confirmBtn);

    expect(onUpdate).toHaveBeenCalledWith("dish-1", -1);
  });

  it("allows direct deletion when no co-diners", async () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    const dish: DishWithSelection = {
      ...baseDish,
      selected_quantity: 1,
      ordered_by: ["爸爸"],
    };

    render(
      <DishGrid
        dishes={[dish]}
        userNickname="爸爸"
        onUpdateQuantity={onUpdate}
        onRemoveDish={onRemove}
      />
    );

    // Find the minus button and click it
    const allButtons = screen.getAllByRole("button");
    const minusButton = allButtons.find(
      (btn) => btn.querySelector(".lucide-minus") !== null
    );
    fireEvent.click(minusButton!);

    expect(onUpdate).toHaveBeenCalledWith("dish-1", -1);
    expect(screen.queryByText("取消自己的点单")).not.toBeInTheDocument();
  });
});

describe("DishGrid - remove dish protection", () => {
  it("disables remove button when dish has selections", () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    const dish: DishWithSelection = {
      ...baseDish,
      selected_quantity: 0,
      ordered_by: ["妈妈"],
    };

    render(
      <DishGrid
        dishes={[dish]}
        userNickname="爸爸"
        onUpdateQuantity={onUpdate}
        onRemoveDish={onRemove}
      />
    );

    const removeBtn = screen.getByTitle("已有妈妈点单，无法移除");
    expect(removeBtn).toBeDisabled();
  });

  it("allows remove when dish has no selections", () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    const dish: DishWithSelection = {
      ...baseDish,
      selected_quantity: 0,
      ordered_by: [],
    };

    render(
      <DishGrid
        dishes={[dish]}
        userNickname="爸爸"
        onUpdateQuantity={onUpdate}
        onRemoveDish={onRemove}
      />
    );

    const removeBtn = screen.getByTitle("从房间移除这道菜");
    expect(removeBtn).not.toBeDisabled();
  });
});

describe("DishGrid - display", () => {
  it("shows co-diner names on dish card", () => {
    const onUpdate = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);

    const dish: DishWithSelection = {
      ...baseDish,
      selected_quantity: 1,
      ordered_by: ["爸爸", "妈妈"],
    };

    render(
      <DishGrid
        dishes={[dish]}
        userNickname="爸爸"
        onUpdateQuantity={onUpdate}
        onRemoveDish={onRemove}
      />
    );

    expect(screen.getByText("妈妈")).toBeInTheDocument();
  });
});
