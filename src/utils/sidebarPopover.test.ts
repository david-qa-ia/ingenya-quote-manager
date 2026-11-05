import { describe, expect, it } from 'vitest';
import { placeSidebarPopover } from './sidebarPopover';

describe('placeSidebarPopover (SCRUM-128)', () => {
  it('opens next to the rail at the height of the button', () => {
    expect(
      placeSidebarPopover({
        anchorTop: 230,
        railRight: 232,
        popoverHeight: 160,
        viewportHeight: 640,
      }),
    ).toEqual({ top: 230, left: 244 });
  });

  it('moves up so a tall panel stays inside a short window', () => {
    expect(
      placeSidebarPopover({
        anchorTop: 400,
        railRight: 232,
        popoverHeight: 300,
        viewportHeight: 500,
      }),
    ).toEqual({ top: 188, left: 244 });
  });

  it('never goes above the top margin', () => {
    expect(
      placeSidebarPopover({
        anchorTop: 300,
        railRight: 232,
        popoverHeight: 900,
        viewportHeight: 500,
      }).top,
    ).toBe(12);
  });
});
