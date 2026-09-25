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
```
