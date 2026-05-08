import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectionPanel } from "@/components/SelectionPanel";
import { ConnectionStatus } from "@/components/ConnectionStatus";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: {} } }),
      signInAnonymously: vi.fn().mockResolvedValue({}),
    },
    storage: {
      from: vi.fn(),
    },
  },
  ensureAuth: vi.fn().mockResolvedValue(undefined),
}));

describe("SelectionPanel", () => {
  it("shows total dishes and quantity", () => {
    render(<SelectionPanel totalDishes={5} totalQuantity={12} roomId="ABC123" />);
    expect(screen.getByText("5 道菜")).toBeInTheDocument();
    expect(screen.getByText("12 份")).toBeInTheDocument();
  });

  it("disables export button when totalQuantity is 0", () => {
    render(<SelectionPanel totalDishes={0} totalQuantity={0} roomId="ABC123" />);
    const btn = screen.getByRole("button", { name: /导出菜单/ });
    expect(btn).toBeDisabled();
  });

  it("enables export button when totalQuantity > 0", () => {
    render(<SelectionPanel totalDishes={3} totalQuantity={8} roomId="ABC123" />);
    const btn = screen.getByRole("button", { name: /导出菜单/ });
    expect(btn).not.toBeDisabled();
  });

  it("shows Chinese text correctly", () => {
    render(<SelectionPanel totalDishes={1} totalQuantity={1} roomId="XYZ789" />);
    expect(screen.getByText("已选")).toBeInTheDocument();
    expect(screen.getByText("1 道菜")).toBeInTheDocument();
    expect(screen.getByText("1 份")).toBeInTheDocument();
  });
});

describe("ConnectionStatus", () => {
  it("renders nothing when online", () => {
    const { container } = render(<ConnectionStatus />);
    expect(container.firstChild).toBeNull();
  });

  it("shows warning bar when offline", () => {
    const { container } = render(<ConnectionStatus />);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText("网络异常，正在重连…")).toBeInTheDocument();
  });

  it("hides bar when back online", () => {
    const { container } = render(<ConnectionStatus />);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText("网络异常，正在重连…")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText("网络异常，正在重连…")).not.toBeInTheDocument();
  });

  it("calls onReconnect when coming back online", () => {
    const onReconnect = vi.fn();
    render(<ConnectionStatus onReconnect={onReconnect} />);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("does not call onReconnect initially", () => {
    const onReconnect = vi.fn();
    render(<ConnectionStatus onReconnect={onReconnect} />);
    expect(onReconnect).not.toHaveBeenCalled();
  });
});
