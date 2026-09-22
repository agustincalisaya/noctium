# Metodología SDD — Noctium

Specification-Driven Development aplicado a Noctium: antes de escribir código de una funcionalidad, existe un documento que define su contrato (interfaces, reglas de negocio, eventos). La implementación puntual de una Historia de Usuario (HU) es una *task* que referencia ese contrato y detalla exactamente qué se construye en esa iteración — ni más, ni menos.

## Estructura de carpetas

```
docs/
  RULES.md                    ← reglas no negociables del proyecto (referencia normativa)
  specs/
    spec_modulo_A.md          ← Sesión
    spec_modulo_B.md          ← Alumno
    spec_modulo_C.md          ← Turno
    spec_modulo_D.md          ← Profesor
    spec_modulo_E.md          ← Atención académica / Historial
    spec_modulo_F.md          ← Personal de mesa de entrada
    spec_modulo_G.md          ← Gerente
    spec_modulo_H.md          ← Indicadores / Dashboard
    spec_modulo_I.md          ← Pagos
    spec_modulo_J.md          ← Calendario
    spec_modulo_K.md          ← Aulas
    spec_modulo_L.md          ← Materias
  tasks/
    Sprint 1/
      HU-A-01.md
      HU-B-04.md
      HU-C-02.md
      ...
    Sprint 2/
      ...
```

Las specs van **todas juntas en una carpeta plana** (`docs/specs/`), sin subcarpetas por módulo: el código de la HU ya lleva la letra del módulo adelante (`HU-C-02` = Turno), así que el orden alfabético del listado ya agrupa visualmente por módulo, y esto evita saltar entre carpetas cuando una spec referencia a otro módulo — cosa que pasa todo el tiempo (Pagos referencia Turno, Indicadores referencia casi todos, etc.).

Las tasks, en cambio, van agrupadas **por sprint** (`docs/tasks/Sprint <n>/`), una subcarpeta por sprint con todas las tasks de ese sprint adentro (de todos los módulos, todo el equipo junto). Esto es porque el equipo trabaja por sprint — cada integrante crea sus propias tasks dentro de la carpeta del sprint en curso — y separa naturalmente lo que ya se implementó (sprints cerrados) de lo que está en curso, sin perder la referencia cruzada a la spec del módulo correspondiente (que sigue viviendo en `docs/specs/`, fuera de la carpeta de sprints).

## Los dos tipos de documento

### `spec_modulo_<letra>.md` — contrato vivo del módulo
Es el documento de referencia de **todo** el módulo, no de una HU puntual. Vive mientras el módulo exista y se **amplía por revisiones**, nunca se reescribe desde cero. Contiene:
1. Visión General
2. Interfaces y Contratos (Route Handlers / Server Actions) — una subsección numerada por HU
3. Reglas de Negocio Estrictas (capa de servicios)
4. Eventos de Dominio

**Regla de aditividad:** cuando se incorpora una HU nueva o se amplía una existente, se agrega una sección nueva (2.6, 2.7, ...) o se anota la existente — **nunca se renumeran** las secciones preexistentes, porque ya están referenciadas desde tasks, casos de prueba y otros documentos. Cada revisión que modifica secciones existentes suma una tabla de *changelog* al principio del documento (HU → estado previo → acción).

### `HU-<letra><n>.md` — task de implementación puntual
Es el documento operativo que un desarrollador (o Claude Code) sigue para implementar **una** HU. Referencia la spec del módulo pero no la repite — apunta a las secciones concretas. Vive dentro de `docs/tasks/Sprint <n>/`, donde `<n>` es el sprint en el que se implementa. Contiene:
0. Relevamiento previo a implementación
1. Nota de alcance
2. Historia de Usuario (Como / Necesito / Para + SP estimado)
3. Alcance de esta task — qué incluye, y **explícitamente qué NO incluye** ("fuera de alcance de esta task")
4. Contrato Backend (schema Zod, servicio, Route Handler, Server Action)
5. Frontend
6. Testing (3 niveles — ver abajo)
7. Checklist de Definition of Done

Tres convenciones importantes que se repiten en las tasks de referencia y hay que mantener:
- **"Relevamiento previo a implementación"**: antes de que Claude Code escriba una sola línea de código, reporta la lista exacta de archivos nuevos a crear y de archivos existentes a modificar, más cualquier punto ambiguo de la task. Se espera confirmación explícita sobre ese relevamiento antes de dar la orden de implementar. Esto evita que el agente asuma una estructura de archivos o resuelva una ambigüedad por su cuenta antes de que vos lo hayas visto.
- **"Fuera de alcance (explícito)"**: cualquier cosa que la HU roce pero no implemente se nombra a propósito, para que no se termine implementando de más ni bloqueando la task por dependencias que en realidad no aplican.
- **"Relevar antes de asumir" / "Decisión resuelta"**: un punto ambiguo de la spec se marca como pregunta abierta a confirmar con el equipo/PO, nunca se resuelve por inferencia silenciosa (se reporta justamente en el relevamiento del punto 0). Una vez resuelto, se documenta como "DECISIÓN RESUELTA (no relevar de nuevo)" con el razonamiento, para que la próxima persona (o el próximo agente) no vuelva a levantar la misma pregunta.

## Testing en 3 niveles

Toda task documenta evidencia en estos tres niveles:
1. **Unit** — funciones puras de la capa de servicios (validaciones, máquinas de estado, resolución de precondiciones).
2. **Postman** — colección cubriendo el contrato de API: caso exitoso, cada error esperado con su código, casos límite.
3. **BD (TablePlus u otro cliente Postgres)** — verificación directa de que las columnas relevantes (`is_active`, `deleted_at`, campos de estado, `AuditLog`) quedaron como se espera tras la operación.

Un criterio de aceptación que no se pudo verificar se documenta como "Bloqueado" con motivo explícito — nunca se marca como si hubiera pasado.

## Flujo de trabajo

1. Sale una HU del Product Backlog / Sprint Backlog.
2. ¿El módulo ya tiene `spec_modulo_<letra>.md`? Si no existe, se crea con la Visión General y la primera sección de Interfaces antes de tocar código.
3. Si existe pero la HU no está contractualizada ahí, se amplía por revisión (sección nueva, aditiva, con changelog).
4. Se escribe `HU-<letra><n>.md` en `docs/tasks/Sprint <n>/` (la carpeta del sprint en curso), referenciando las secciones concretas de la spec.
5. **Relevamiento obligatorio:** antes de implementar, Claude Code reporta los archivos que va a crear/modificar y cualquier punto ambiguo de la task, y se espera confirmación explícita. Recién ahí se da la orden de implementación.
6. Se implementa siguiendo la task. Cualquier divergencia entre lo que decía la spec y lo que realmente existe en el código (como pasó con HU-A5 en el ejemplo de SWAT) se anota en la spec como nota de sincronización, no se corrige en silencio.
7. Se completa el checklist de Definition of Done y se deja evidencia de los 3 niveles de testing.

## Letras de módulo — Noctium

| Letra | Módulo |
|---|---|
| A | Sesión |
| B | Alumno |
| C | Turno |
| D | Profesor |
| E | Atención académica / Historial |
| F | Personal de mesa de entrada |
| G | Gerente |
| H | Indicadores / Dashboard |
| I | Pagos |
| J | Calendario |
| K | Aulas |
| L | Materias |