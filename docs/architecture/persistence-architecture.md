# Persistencia comercial segura (SCRUM-78)

Este documento fija el contrato que SCRUM-79 debe implementar. Supabase es la fuente de
verdad: PostgreSQL, Auth, Row Level Security, Storage privado y migraciones versionadas.

## Límites de confianza

- Supabase Auth identifica al usuario mediante `auth.uid()`.
- `workspace_id` enviado por el navegador es un selector de contexto, nunca una autorización.
- Toda tabla comercial tiene `workspace_id not null`.
- Toda consulta y mutación comercial se ejecuta con RLS y valida una membresía activa con rol
  `owner` o `admin`.
- `collaborator` no puede leer ni escribir datos comerciales en el MVP; queda reservado para una
  matriz futura de permisos.
- El frontend no conoce ni usa una clave administrativa.
- La identidad es única; las empresas se representan como membresías en espacios.
- El login es con email y contraseña (Supabase Auth, `grant_type=password`), con refresco de
  sesión. _(Actualizado 2026-10-29, SCRUM-108: el contrato inicial preveía enlace mágico al
  email; la implementación vigente usa contraseña.)_

## Modelo relacional

```text
auth.users -> user_profiles
auth.users + workspaces -> workspace_memberships

workspaces -> prospects -> prospect_activities
workspaces -> contacts
workspaces -> opportunities -> next_actions -> next_action_history
workspaces -> activities
workspaces -> commercial_outcomes
workspaces -> quotes -> quote_versions -> quote_sends
                                  -> quote_change_requests
workspaces -> cadence_templates -> cadence_template_steps
workspaces -> cadence_executions -> cadence_step_executions -> cadence_events
workspaces -> attachments -> private storage object
workspaces -> audit_events
workspaces -> idempotency_keys
workspaces -> outbox_events
workspaces -> migration_runs -> migration_items -> migration_quarantine
```

Las relaciones entre entidades comerciales se validan con claves compuestas que incluyen
`workspace_id`. No se permite que una oportunidad de un espacio referencie un contacto de otro.

`user_profiles` tiene RLS explícita: cada usuario puede leer y actualizar únicamente su propio
perfil. La creación inicial y cambios sensibles de identidad se realizan mediante Auth o RPC segura.

## Roles

| Operación                            | owner | admin | collaborator futuro |
| ------------------------------------ | ----- | ----- | ------------------- |
| Leer y operar datos comerciales      | Sí    | Sí    | No                  |
| Registrar actividades y seguimientos | Sí    | Sí    | No                  |
| Gestionar plantillas/cadencias       | Sí    | Sí    | No                  |
| Gestionar membresías y roles         | Sí    | No    | No                  |
| Ejecutar migración                   | Sí    | No    | No                  |
| Crear/restaurar respaldos            | Sí    | No    | No                  |
| Ver auditoría completa               | Sí    | Sí    | Limitado            |

El rol `collaborator` solo queda preparado en el modelo; no agrega permisos en este alcance.

## RPC transaccionales obligatorios

React no encadena escrituras críticas. Cada caso de uso se resuelve con una función PostgreSQL
`security definer`, que valida `auth.uid()`, membresía, rol, `workspace_id` y versión esperada.

Las tablas comerciales no exponen `insert`, `update`, `delete` ni `truncate` al navegador. El
cliente autenticado solo tiene `select`, restringido por RLS a filas del espacio activo y a roles
`owner`/`admin`. Toda creación, edición, archivado, resultado, conversión, presupuesto, cadencia y
migración debe pasar por una RPC `security definer`.

- `convert_prospect_to_opportunity`
- `register_contact_result`
- `complete_or_reschedule_next_action`
- `create_quote_version`
- `send_quote_version`
- `record_commercial_outcome`
- `run_migration_batch`

Cada RPC debe cumplir estas reglas:

1. Recibir `expected_version` en toda entidad editable.
2. Rechazar la mutación con conflicto si la versión no coincide.
3. Escribir todos los cambios relacionados dentro de una única transacción.
4. Si falla cualquier escritura secundaria dentro de la RPC, hacer rollback de toda la transacción.
5. Registrar auditoría e idempotencia dentro de la misma transacción.
6. Devolver confirmación solo después del commit.
7. Una escritura secundaria fallida dentro de la RPC revierte toda la transacción.

`requiere_recuperacion` no representa un fallo de una escritura dentro de la transacción. Solo se
usa para una tarea externa o posterior al commit, registrada en `outbox_events` y reintentable con
la misma clave idempotente.

## Idempotencia y concurrencia

Todas las mutaciones reciben `idempotency_key`. La restricción única es por usuario, espacio,
operación y clave. Un reintento devuelve el resultado original sin crear duplicados.

Las entidades editables mantienen `version bigint`. El cliente envía `expected_version`; un
conflicto devuelve `409`, conserva el formulario local y no sobrescribe el dato remoto.

Los eventos derivados tienen identificadores deterministas, por ejemplo:

- `commercial-outcome:{outcome_id}`;
- `next-action:{action_id}:{event}`;
- `cadence:{event_id}`;
- `migration:{run_id}:{source_type}:{source_id}`.

## Auditoría y outbox

`audit_events` es inmutable y registra usuario, espacio, rol, operación, entidad, antes/después,
request ID, clave idempotente, timestamp y resultado. No tiene políticas `for all` para miembros ni
permite escritura, update o delete desde el cliente. La lectura, si se habilita, debe ocurrir por
una RPC explícita que devuelva únicamente un resumen mínimo; los payloads técnicos completos no se
exponen directamente.

`idempotency_keys` y `outbox_events` tampoco tienen políticas comerciales para miembros. Solo las
RPC seguras pueden escribirlos; el worker posterior al commit consume outbox con una clave única.

`outbox_events` se utiliza solamente después del commit para tareas externas, por ejemplo:

- procesamiento de un objeto en Storage;
- notificación futura;
- reindexación;
- exportación de respaldo.

Cada evento tiene estado `pending`, `processing`, `completed` o `failed`, contador de reintentos,
`next_attempt_at` y una clave única idempotente.

## Migración

Una `migration_run` siempre representa exactamente un origen, un destino y un snapshot. El usuario
debe ser `owner` tanto del espacio origen como del espacio destino:

```text
source_workspace_id + destination_workspace_id + snapshot_fingerprint
```

No se puede crear una nueva corrida con el mismo fingerprint. Sí se puede reanudar la corrida
existente, con su mismo ID y checkpoints.

Las actividades tienen exactamente un sujeto comercial válido. Sus FKs compuestas obligan a que
prospecto, contacto, oportunidad y presupuesto pertenezcan al mismo `workspace_id`. Resultados
comerciales referencian presupuesto y resultado previo; ejecuciones de cadencia referencian el paso
actual y los eventos referencian su ejecución y paso. Cualquier relación polimórfica no expresable
con una FK se valida obligatoriamente dentro de la RPC antes de escribir.

Flujo:

1. Exportar snapshot completo del espacio local elegido.
2. Calcular fingerprint, checksum y conteos.
3. Exigir origen y destino explícitos; nunca mezclar las tres empresas.
4. Validar en seco y normalizar.
5. Importar registros válidos en lotes idempotentes.
6. Enviar registros inválidos a cuarentena con motivo descargable.
7. Conservar IDs y relaciones.
8. Registrar checkpoints y permitir reanudación segura.
9. Comparar conteos, relaciones e historial al finalizar.
10. Mantener el snapshot local hasta aceptación explícita.
11. Exportar respaldo y probar restauración en un espacio aislado.

Los binarios no existentes en `localStorage` no se migran. Solo se crean metadatos y estructura
para futuros adjuntos privados.

## Pruebas obligatorias para SCRUM-79

- RLS permite y deniega lectura/escritura entre tres espacios.
- Usuario sin membresía, membresía desactivada y sesión vencida.
- Manipulación de URL, payload, caché y `workspace_id`.
- Doble clic, retry, refresh y dos pestañas.
- Conflicto de `expected_version` sin pérdida de formulario.
- Red caída, respuesta corrupta y backend no disponible.
- Rollback completo ante fallo secundario dentro de una RPC.
- Outbox posterior al commit con reintento idempotente.
- Migración interrumpida, reanudada, duplicada e inválida.
- Restauración desde snapshot y respaldo.
- Ciclo prospecto → oportunidad → presupuesto → envío/seguimiento → cierre.
- Ningún modal se cierra ni muestra éxito antes de una confirmación real.
