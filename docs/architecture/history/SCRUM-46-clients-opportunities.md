# SCRUM-46 Implementation And Validation

Ticket: [SCRUM-46](https://davidveracontacto.atlassian.net/browse/SCRUM-46).
Specification: [Clients, opportunities and responsible seller](https://docs.google.com/document/d/1UWtAjAoOcGyXfVp9nTEVZ_DPLhsFM_sbvciaL5u9ZjM/edit).

## Approved Decisions

The user approved the specification and technical plan after the read-only audit. Historical
drafts may be linked manually; finalized quotes remain entirely immutable. Client phone and
email are required, with `1111111111` and `none` accepted only as pending confirmation. Preferred
channel is empty, phone, WhatsApp or email; consent starts false. Opportunity client and name
are required; address, date and seller are optional. No default seller is assumed.

The original Jira description mentions sent quotes. The later ticket comment, linked spec and
explicit user approval exclude commercial states from SCRUM-46. This implementation follows
that approved boundary and retains the existing draft/finalized contract.

## Design

Independent Client and Opportunity types and local collections extend Quote with optional IDs.
Pure helpers validate contacts, dates and associations. `localCollectionStorage.ts` contains the
shared array reading/upsert behavior used by the two new stores; quote storage reuses its raw
reader to preserve corrupt unrelated records and reject unreadable roots. No dependencies added.

`QuoteCommercialContext`, `ClientForm` and `OpportunityForm` integrate into the existing summary.
The current context is visibly separate from document snapshots. No navigation section is added.
The list displays opportunity context while retaining every quote as an independent row.

No changes to AGENTS.md, PDF implementation, calculation or line helpers, catalog behavior,
document status contract, branding, build configuration or dependency versions.

## Acceptance Traceability

| Requirement                                | Implementation                                     | Verification                                       |
| ------------------------------------------ | -------------------------------------------------- | -------------------------------------------------- |
| Required contacts, pending values, consent | Client validation and form                         | `clientValidation.test.ts`; manual client creation |
| Reusable identities without name matching  | Client/opportunity stores                          | `clientStorage.test.ts`                            |
| Optional client and opportunity references | Association helper and summary                     | `quoteAssociations.test.ts`; manual linking        |
| Several quotes per opportunity             | Save by quote ID                                   | `clientStorage.test.ts`; manual multiple quotes    |
| Historical snapshots                       | Explicit association policy; independent stores    | Association/storage tests; historical reopening    |
| Finalized immutability                     | UI read-only, association guard, persistence guard | Association/storage tests; manual finalized view   |
| Compatible idempotent recovery             | Read-time optional-reference normalization         | Storage tests with historical/corrupt records      |
| Existing calculations and PDF              | Existing implementation unchanged                  | Existing unit suites; linked quote PDF regression  |
| Responsive and existing navigation         | Existing shell with local form styles              | Desktop/mobile validation                          |

## Validation Record

Baseline before implementation: 82 tests passed; optional PDF evidence generator skipped.
Automated checks after implementation:

- `npm run format:check`: passed.
- `npm run lint`: passed.
- `npm test`: 116 passed in 17 suites; the opt-in PDF evidence generator remains skipped.
- `npm run build`: passed.
- `git diff --check`: passed.

The environment reports npm 12 with Node 20 as an unsupported pairing. Commands nevertheless
completed successfully. Vite reports the existing large PDF/font chunks; PDF assets and build
configuration were not changed.

Manual desktop/mobile validation is pending browser availability. The connected browser tool
reported no available browser; alternate local browser validation was requested. Do not treat
unit checks as evidence that visual validation has passed.
