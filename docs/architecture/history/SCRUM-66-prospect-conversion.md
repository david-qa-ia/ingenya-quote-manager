# SCRUM-66: Calificar prospecto y convertirlo en oportunidad

Eligible prospects have either an `interested` state or their latest contact result is `contacted`.
The conversion form requires an explicit opportunity/work name, service of interest, interest
level, detected need, next step, next-step date and time, and responsible person. Estimated value
is optional and, when supplied, is a finite number greater than or equal to zero. The next-step
timestamp is ISO and is distinct from the optional opportunity estimated-start date.

Conversion creates a reusable client with contact consent always false, then an open opportunity
with its qualification and pending next action. It never creates or opens a quote. A completed
prospect retains its history and conversion references and is excluded from the daily prospect
inbox. The compact post-conversion context shows the opportunity, client, qualification and next
step; SCRUM-67 owns a full opportunity record.

Because localStorage cannot make multi-key writes transactional, the prospect persists a pending
conversion journal before dependent writes. On reload the UI exposes only an explicit retry; it
does not retry automatically. Stable IDs make retry idempotent and prevent duplicate client or
opportunity creation. Any failed write displays an error rather than a success message.
