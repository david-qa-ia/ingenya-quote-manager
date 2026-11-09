# Roadmap

Work queue agreed with the owner. Take the first open item, ship it as one or more small PRs, and
mark it done here in the same PR. Merging is delegated: squash-merge when CI passes.

## Product decisions (2026-11-09)

- **Quick quotes stay.** A quote without a client (for an acquaintance) is a real use. Keep
  "Nuevo presupuesto" in the menu and the saved quotes list as a secondary section; Trabajos only
  shows sales with a prospect or opportunity.
- **One shared user.** No per-person accounts. Any note can be edited by anyone; the previous text
  stays in the note history. Hide "Responsable" fields while the team list has a single person.
- **Every contact counts.** In-person meetings and Instagram count as contacts in Indicadores, like
  calls, WhatsApp and email. Today they are stored as notes and do not count.
- **Stages in Trabajos:** Nuevo, Contactado, Presupuestando, Presupuesto enviado, Ganado, Perdido.

## Stage 1: new navigation

1. [x] Trabajos: every sale in one list by stage (#84).
2. [x] Clientes: list of clients with their jobs (#86).
3. [x] Menu: Hoy (merge "Mi trabajo de hoy" and "A quién contactar hoy"), Trabajos, Clientes;
       saved quotes as a secondary item; Indicadores reachable from Hoy.
4. [x] Split `src/App.tsx` into views and hooks, without behavior changes.
5. [x] Single job file: prospect and opportunity shown as one job (#97, #98).

## Stage 2: actions and simplification

1. [x] One shared user: notes editable by anyone, hide "Responsable" with a single person (#99, #100).
2. [x] Meetings and Instagram as contact activity types that count in Indicadores (#101).
3. [x] WhatsApp and Llamar buttons open the chat or dialer with the message ready (#102).
4. [x] Suggested next step after each result; optional next step when discarding (#103).
5. [ ] Loss reason as a list (price, chose another, no answer, postponed, other).
6. [ ] "Enviar" finalizes and registers the send in one step.

## Known bugs

- [x] In a new workspace, a responsible typed as "Daniel" is saved as "D".
