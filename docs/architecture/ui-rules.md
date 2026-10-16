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
