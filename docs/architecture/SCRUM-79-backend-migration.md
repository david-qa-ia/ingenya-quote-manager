# Backend mínimo y migración operable (SCRUM-79)

SCRUM-79 implementa Supabase como fuente de verdad sin rediseñar la UI comercial. El acceso usa
Supabase Auth con email y contraseña: el email identifica al usuario y la contraseña nunca se
guarda en tablas propias, `localStorage`, React ni commits. No hay registro público, invitaciones
automáticas ni enlace mágico; las cuentas iniciales se crean mediante administración o seed seguro.

Una identidad puede pertenecer a Ingenya, Alef-Tau y Negocio familiar. El espacio activo es solo
contexto de UI: RLS y las RPC validan membresía, rol y `workspace_id` en servidor.

## Mutaciones y conflictos

La aplicación lee con RLS y escribe únicamente mediante RPC `security definer`. Cada RPC valida
identidad, membresía, rol `owner`/`admin`, relaciones, `expected_version`, idempotencia y auditoría
antes del commit. Los fallos dentro de la transacción hacen rollback completo.

Los conflictos no dependen de un HTTP 409 específico. La respuesta tipada contiene:

```json
{
  "code": "CONFLICT",
  "entity": "opportunity",
  "entityId": "…",
  "expectedVersion": 3,
  "currentVersion": 4,
  "remoteData": {}
}
```

La UI conserva el formulario y permite recargar, comparar o reintentar conscientemente.

## Adjuntos

Este ticket crea únicamente metadatos, relaciones y políticas de Storage privado. No incluye carga,
interfaz de adjuntos ni migración de binarios inexistentes en `localStorage`.

## Migración y respaldos

La migración solo se inicia desde Configuración y solo por un owner. Cada corrida representa un
origen local, destino backend y fingerprint de snapshot. Se generan exportaciones comerciales
verificables antes y después, con checksum, conteos, relaciones y cuarentena descargable.

No se implementa backup físico ni restore físico de PostgreSQL desde RPC o UI. Los backups de
infraestructura de Supabase se administran fuera de la aplicación. La restauración funcional se
prueba únicamente en un workspace o entorno aislado, nunca sobre producción desde la UI.

La corrida puede reanudarse por sus checkpoints y no se permite crear otra con el mismo fingerprint.
La copia local se conserva hasta la aceptación explícita: `migración real aprobada`.
