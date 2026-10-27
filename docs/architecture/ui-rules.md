# UI Rules

This document defines UI rules for Ingenya Quote Manager.

## UI Language

All user-facing text must be written in Spanish.

Code identifiers must stay in English.

Example:

```tsx
const submitButtonLabel = 'Agregar mano de obra';
Main User
The main user is Daniel, a construction professional who needs a practical quote tool.
The UI should be:
- Clear
- Fast to use
- Easy to understand
- Useful on desktop first
- Not overloaded with technical language
Main Quote Screen Goals
The main quote screen should allow the user to:
- Select a service from the catalog.
- See the default unit and default unit price.
- Edit the unit price for the current quote.
- Enter quantity.
- Add a manual service if the catalog does not contain it.
- See each line subtotal.
- See the quote total.
- Continue to the next quote step when ready.
Manual Service Rules
The UI must allow adding a manual service from the main screen.
Manual service fields:
- Service name
- Unit
- Unit price
- Quantity
Manual services should use the same calculation rules as catalog services.
Price Rules
Default catalog prices are suggestions.
The user must be able to edit the unit price inside the quote before adding the line.
Editing a unit price in the quote should not automatically update the catalog.
Empty And Optional Data
Client name and project name may be optional in early quote drafts.
The UI should not block quote creation only because client information is missing, unless a future ticket changes this rule.
Visual Direction
The UI should feel professional and practical.
Prefer:
- Simple forms
- Clear totals
- Readable tables or line lists
- Obvious primary actions
- Spanish labels
- Minimal decoration
Avoid:
- Overloaded dashboards
- Technical jargon
- Hidden calculations
- Confusing worker/payroll language
- References to UOCRA or salary tables

## Approved Administrative Visual Language (SCRUM-92)

The administrative application has one shared visual language. Future UI work must extend this
language instead of introducing a separate style for each feature.

For the broader interaction rationale and a pre-merge visual checklist, consult
[`heloc-ui-reference.md`](./heloc-ui-reference.md). It is a visual reference, never a source of
product or business-rule changes.

### Foundations

- Desktop is the primary workspace. Use a permanent dark-green navigation rail with a clear
  active state, a distinct workspace selector and a single prominent primary action.
- Keep the main workspace light, calm and information-led. Use white or very light surfaces,
  subtle borders, restrained shadows and generous spacing to group related information.
- Use green for product identity, success and primary actions. The sign-in welcome may use a
  soft blue sky background; that blue is an entry-screen accent, not a replacement for the
  product's green identity.
- Prefer a small number of strong visual groups over many boxed-in controls. Cards must have a
  clear purpose: summary, action, form, list or status.
- Typography must establish an obvious reading order: page purpose first, concise guidance
  second, then actions and data. Avoid decorative headings that compete with operational data.

### Components And Interaction

- Reuse the shared visual tokens and patterns in `src/index.css` and `src/App.css`. Do not add
  one-off colors, radii, shadows or button styles when an existing pattern fits.
- Primary actions are filled green buttons. Secondary actions are quiet outlined or text
  actions. Destructive actions must remain visually distinct and never look primary.
- Inputs, filters and searchable selectors must have a visible label, calm resting state,
  obvious keyboard focus and clear selected, disabled and error states.
- Search panels, workspace menus, dropdowns, dialogs and tooltips must open above surrounding
  content without being clipped. Their trigger must remain usable, and closing with Escape and
  clicking outside must keep working where that behavior already exists.
- Use responsive layouts without changing the meaning or order of actions. On narrow screens,
  stack related controls and preserve readable target sizes rather than shrinking controls.
- Use concise Spanish copy that explains the user's next action. Do not expose implementation,
  storage or synchronization terminology unless it is necessary to resolve an actual user issue.

### Guardrails For Visual Tickets

- A visual-only ticket must not alter business rules, persistence, status transitions, data
  structures or authorization behavior.
- Before considering a UI change complete, inspect the affected desktop view and its narrow
  layout. For any overlay or selector, verify the open state, selection/change state, keyboard
  focus and dismissal state.
- Preserve existing accessible labels, focus behavior and semantic controls. Use CSS and
  presentation-focused components before changing an interaction contract.
- When a feature needs a new icon, follow the shared icon rules below. Do not use emojis,
  arbitrary glyphs or a second icon family as decoration.

## Icon System

Use the shared `UiIcon` component from `src/components/UiIcon.tsx` for interface icons.
Do not introduce Unicode glyphs, emoji, or one-off inline SVG drawings in feature components.
The shared icon set uses a consistent 24px viewBox, stroke style, line caps and line joins so
navigation, pipeline stages, actions and status cards remain visually coherent.

When a new icon is needed:

1. Add it to `UiIconName` and the shared path registry.
2. Reuse the same semantic name everywhere in the product.
3. Size and color it through the consuming component's CSS, not by changing the path geometry.
4. Validate the real screen against the approved visual reference before opening a pull request.

The approved Ingenya visual language uses outline icons with a 1.8px stroke, rounded joins and
semantic accent colors. The icon system is intentionally local so the application can keep a
stable, auditable visual vocabulary without feature-by-feature icon drift.
```

## Client And Opportunity Context (SCRUM-46)

The summary supports selecting, creating and editing reusable clients and opportunities
without leaving the current quote. Opportunities are selected after the client and belong
to that client. Keep a visible "Continuar sin cliente" action and explain that an association
is optional. The existing primary navigation remains unchanged.

Show pending contact values as "Pendiente de confirmar", without contact links. Client consent
starts unchecked. Allow `none` through application validation rather than native email input
validation. Do not prefill a confirmed responsible seller.

Separate current entity context from document texts. Saved drafts retain their historical
document texts when linked manually; finalized quotes show context without editing controls.
Changing entity details must not imply that a quote was saved. Explain that saving the draft
or finalizing it persists the association.

Keep each saved quote as an independent row, including when opportunities are shared. Forms,
warnings and actions must remain readable and keyboard accessible on desktop and mobile.

## Commercial Statuses (SCRUM-47)

Show document and commercial states separately in the saved quote list and summary. Commercial
changes require an explicit confirmation with actor and reason. Do not show an action that sends
messages or infer a sent status from PDF activity. Closed commercial states explain that audited
reopening belongs to a later increment.
