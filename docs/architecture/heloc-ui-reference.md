# HELOC / Houseloan UI Reference

This is the durable reference derived from the UI audit supplied for the BRIO and Ingenya work.
It is a design reference only. It does not authorize changes to business rules, persistence,
authentication, commercial workflows or product scope.

**Reference analyzed:** <https://heloc.houseloan.com/>

Do not copy the referenced product's logos, copy, photography, identity or proprietary assets.
Reuse the interaction principles below through Ingenya's own brand, shared tokens and local
components.

## Why the reference feels clear

The experience is guided rather than decorative. Its quality comes from a consistent system:

1. One clear primary action per screen.
2. Strong hierarchy: benefit or task, short explanation, main action, then supporting detail.
3. Progressive disclosure: ask only for information that matters at the current step.
4. Immediate feedback for selection, validation, loading, progress and completion.
5. Repeated spacing, radii, typography, state and accent-color decisions.

## Patterns worth adapting

| Pattern                         | Use in Ingenya / BRIO                                                | Guardrail                                                                        |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Application shell               | Stable navigation, page frame and content area.                      | Do not let each feature invent a separate page layout.                           |
| Primary CTA                     | One high-contrast action that expresses the result.                  | Use one primary action per decision area.                                        |
| Stepper and progress            | Contextual title plus honest progress in multi-step flows.           | Never show artificial or inferred progress.                                      |
| Wizard layout                   | Narrow, focused forms with back and next controls.                   | Preserve entered data when going back.                                           |
| Option buttons                  | Large selectable options for 2–6 meaningful choices.                 | Selected state needs border, background and visible check/text, not color alone. |
| Searchable selection            | One input filters matching clients, opportunities or services.       | Permit changing an already selected option.                                      |
| Summary panel                   | Show chosen values and their consequence before confirmation.        | Keep important values editable or explain why they are locked.                   |
| Status badges                   | Compact text-first status indicators.                                | Do not rely on red/green alone.                                                  |
| Responsive lists                | Readable table on desktop, useful cards or labels on narrow screens. | Avoid horizontal scrolling as the only mobile strategy.                          |
| Empty, loading and error states | Explain what happened and provide one useful next action.            | Never leave an unexplained blank area.                                           |

## Operational UI direction

Ingenya is an operational admin tool, not a commercial landing page.

- Keep information density readable: filters, statuses, lists and repeatable actions have priority.
- Use restrained cards, calm surfaces, concise Spanish text and obvious action hierarchy.
- Use the permanent green navigation rail as the product anchor. The sign-in experience may use
  a soft blue sky background as a welcome-screen accent only.
- Use illustrations and animation sparingly. Decorative motion must never interrupt a repeated
  operational task and must respect `prefers-reduced-motion`.
- Use outline icons from the shared `UiIcon` component. Do not mix icon families, emojis or
  hand-drawn SVGs inside feature components.

## Component behavior checklist

### Primary actions

- Use verb + outcome labels, such as “Crear presupuesto” or “Confirmar envío”.
- Keep controls at least 44 px high; 48–52 px is preferred for the primary CTA.
- Provide a visible keyboard focus ring and a loading state that prevents duplicate submission.
- Make the back action secondary. Do not present two equally strong primary actions.

### Inputs and selections

- Keep the label visible; placeholder text is not a label.
- Show help, success or error next to the relevant field in clear Spanish.
- For a searchable selector, test typing, selection, clearing, choosing a different option,
  keyboard focus and empty results.
- Use a normal select only when its option list is appropriate; use option cards/buttons for a
  short, important choice.

### Overlays

- Popovers, search panels, workspace menus, modals and tooltips must not be clipped by their
  parent container.
- The trigger must remain reachable and the overlay must layer above surrounding content.
- Preserve Escape, click-outside and focus-return behavior where the component supports it.
- Use a modal only for a decision that benefits from temporarily blocking the surrounding task.

### States and responsiveness

- Design default, hover, focus-visible, selected, disabled, loading, success, error and empty
  states for important interactions.
- Validate each affected screen at desktop width and at narrow mobile width.
- On narrow screens stack related controls instead of shrinking targets below a usable size.

## Tokens and visual restraint

Use the existing Ingenya variables and patterns in `src/index.css` and `src/App.css` before
introducing a new color, radius, shadow or transition. Favor the existing practical scale:

- 4, 8, 12, 16, 24, 32 and 48 px spacing.
- Small controls, medium cards and large content groups with a consistent radius family.
- Fast microinteractions (roughly 150–250 ms); avoid ornamental movement in administrative
  workflows.
- Text contrast that meets WCAG AA for ordinary body copy.

## Pre-merge visual review

- Is the primary action obvious?
- Does the view use the existing administrative language rather than a new visual style?
- Are focus, selection, disabled, empty and error states understandable without color alone?
- Do popovers and selectors open, change selection and dismiss without clipping?
- Does the layout remain usable at 320 px wide?
- Does the change preserve business logic and data behavior when the ticket is visual-only?

## Summary

The reusable formula is:

> Simple task → clear CTA → small steps → constant feedback → trustworthy summary → readable status.

Build shared tokens and components first; apply BRIO's more expressive marketing personality and
Ingenya's sober operational personality on top of that shared system.
