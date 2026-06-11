import { render, screen, fireEvent } from "@solidjs/testing-library";
import { describe, it, expect, vi } from "vitest";
import { StartDayModal } from "./StartDayModal";

describe("StartDayModal", () => {
  it("renders nothing when closed", () => {
    render(() => (
      <StartDayModal open={false} onClose={() => {}} onStart={() => {}} />
    ));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a dialog with start now and start on time options when open", () => {
    render(() => (
      <StartDayModal open={true} onClose={() => {}} onStart={() => {}} />
    ));

    expect(
      screen.getByRole("dialog", { name: /start day/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start now/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /start on time/i }),
    ).toBeInTheDocument();
  });

  it('calls onStart with "now" when Start now is clicked', () => {
    const onStart = vi.fn();
    render(() => (
      <StartDayModal open={true} onClose={() => {}} onStart={onStart} />
    ));

    fireEvent.click(screen.getByRole("button", { name: /start now/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("now");
  });

  it('calls onStart with "on-time" when Start on time is clicked', () => {
    const onStart = vi.fn();
    render(() => (
      <StartDayModal open={true} onClose={() => {}} onStart={onStart} />
    ));

    fireEvent.click(screen.getByRole("button", { name: /start on time/i }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith("on-time");
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(() => (
      <StartDayModal open={true} onClose={onClose} onStart={() => {}} />
    ));

    const dialog = screen.getByRole("dialog", { name: /start day/i });
    fireEvent.pointerDown(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
