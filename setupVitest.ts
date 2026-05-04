import "@testing-library/jest-dom";

// jsdom 25 doesn't ship a PointerEvent constructor, so testing-library's
// fireEvent.pointerDown/pointerUp falls back to a generic Event that drops
// `button` and `pointerId`. Components that read those (e.g. TaskCard) then
// short-circuit. Polyfill the constructor so init properties round-trip.
if (
  typeof (globalThis as { PointerEvent?: unknown }).PointerEvent === "undefined"
) {
  class PolyfillPointerEvent extends MouseEvent {
    public readonly pointerId: number;
    public readonly pointerType: string;
    public readonly isPrimary: boolean;
    public readonly width: number;
    public readonly height: number;
    public readonly pressure: number;
    public readonly tangentialPressure: number;
    public readonly tiltX: number;
    public readonly tiltY: number;
    public readonly twist: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? false;
      this.width = init.width ?? 1;
      this.height = init.height ?? 1;
      this.pressure = init.pressure ?? 0;
      this.tangentialPressure = init.tangentialPressure ?? 0;
      this.tiltX = init.tiltX ?? 0;
      this.tiltY = init.tiltY ?? 0;
      this.twist = init.twist ?? 0;
    }
  }
  (globalThis as { PointerEvent: typeof PolyfillPointerEvent }).PointerEvent =
    PolyfillPointerEvent;
}
