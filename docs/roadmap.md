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
5. [x] Loss reason as a list (price, chose another, no answer, postponed, other) (#104).
6. [x] "Enviar" finalizes and registers the send in one step (#105).

## Stage 3: quote document

1. [ ] The quote PDF reads as a complete quote document, not a summary of the data. Seen in
       PRES-2026-E0080EC2 (2026-11-09):
   - The internal status badge ("FINALIZADO") is shown to the client.
   - The project name is repeated as "Propuesta" title and as "Proyecto".
   - Services show only their name ("QRS"); no description or scope of the work.
   - The client block has only the name: no company, phone, email or address of the job.
   - No conditions: payment terms, execution time, what is included and what is not, and what
     "Válido hasta" means for the client.
   - No acceptance section (sign or confirm) and no logo, only the company name as text.
   - The total sits at the bottom of the page, far from a one-line table, leaving a large empty
     area.

   Taxes stay out of scope unless the owner decides how to show them.

2. [ ] Discount on the whole quote, decided while preparing it (owner, 2026-11-09):
   - One "Descuento" field with a % / $ choice. A percentage goes from 0% to 100%; an amount
     from $0 up to the subtotal (never more than 100%).
   - A percentage is recalculated when services change in a draft; an amount stays fixed. If
     the subtotal drops below that amount, the quote asks to adjust it before finalizing.
   - The quote and its PDF show subtotal, discount (e.g. "Descuento 10% −$10.000") and final
     total. A finalized quote keeps its discount.
   - Not per service. If taxes are ever shown, the discount applies before them.

## Known bugs

- [x] In a new workspace, a responsible typed as "Daniel" is saved as "D".
- [x] The global search shows the internal word "opportunity" next to opportunity results.
- [ ] At ~390px, the pipeline labels in the job file run together and the "Editar" button of
      "Datos de oportunidad" is cut at the card edge.
- [ ] At ~390px, the "Registrar resultado" drawer header wraps the person's name into narrow
      lines.
- [x] The automatic note "Próximo paso agendado: … responsable Daniel." names the responsible
      even when the team has a single person (Responsable is hidden everywhere else).
