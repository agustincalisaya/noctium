# Guía — Cómo usar el material de referencia visual de Sprint 2

**Para quién es:** todo el equipo de desarrollo, como apoyo en las planning de Sprint 2 y como referencia mientras se escriben specs y tasks.
**Quién la mantiene:** PO. Se actualiza cada vez que el material de referencia cambia de forma relevante (como pasó el 28/09, ver el ejemplo al final).

---

## 1. Por qué existe esto

En Sprint 1 tuvimos un problema concreto: varias HU que en realidad pertenecían a la misma pantalla (HU-B-01/02/03 de Alumno, HU-D-01/02/03/04 de Profesor) se trataron como pantallas independientes porque nadie había fijado antes de escribir las tasks a qué pantalla pertenecía cada una. Ese caso no quedó documentado por separado; el mapa de pantallas es justamente el mecanismo para que no se repita.

Para Sprint 2 no alcanza con evitar ese error puntual — además queremos que **el diseño y el comportamiento** de cada pantalla también estén acordados *antes* de escribir código, no que cada uno interprete el criterio de aceptación a su manera. Por eso este sprint hay tres materiales de referencia, no uno solo, y cada uno cubre una capa distinta.

## 2. Los tres materiales, y qué mirar en cada uno

### 2.1. `docs/adicionales/mapa-pantallas-sprint-2.md` — la fuente normativa

Es el documento que **manda**. Dice, para cada HU:
- A qué pantalla pertenece (existente o nueva) — sección 1 y 2.
- Si la acción va en modal o en página completa, y qué tipo de modal (`Dialog` vs `AlertDialog`) — sección 4.
- Qué mecanismo de feedback usa (toast o banner) — sección 4, en conjunto con `docs/DESIGN.md` §6.

Si en algún momento el mapa y el prototipo/las pantallas de referencia no coinciden, **el mapa es el que vale** hasta que el PO lo actualice explícitamente (ver sección 4 de esta guía).

### 2.2. Pantallas de referencia (HTML + PDF)

Es una exportación estática de las mismas pantallas que arma el prototipo, pensada para:
- Compartir sin depender de un link (adjuntas en Discord, se pueden guardar en el repo).
- Tener una vista completa de todas las pantallas juntas en un solo documento, útil para revisar de punta a punta antes de una planning.

**No reemplazan al mapa de pantallas.** Son la referencia visual de lo que el mapa describe en texto.

### 2.3. Prototipo interactivo (Claude)

🔗 https://claude.ai/artifact/9VhY4YdPBzRXU4dhPrFnLo

Es la versión que hay que mirar cuando el HTML/PDF no alcanza para entender el comportamiento: qué pasa al hacer click, cómo se abre un modal, qué datos aparecen ya cargados vs. cuáles hay que completar, qué texto exacto lleva un botón o un toast. Usa los tokens de `docs/DESIGN.md` (paleta, modal/toast/banner) — si algo en el prototipo no respeta esos tokens es un error del prototipo, no una excepción a documentar.

**Tampoco reemplaza a la spec.** El prototipo no define contrato de API, reglas de negocio ni eventos de dominio — eso sigue siendo exclusivamente trabajo del Scrum Master en `spec_modulo_<letra>.md`, como ya establece `docs/adicionales/sdd-metodologia.md`.

## 3. Jerarquía — qué mirar primero

1. **`mapa-pantallas-sprint-2.md`** → decide a qué pantalla pertenece la HU y si es modal o página completa.
2. **Prototipo interactivo** → cómo se comporta esa pantalla exactamente (layout, textos, interacción).
3. **HTML/PDF** → mismo contenido que el prototipo, en formato para repasar offline o mandar por Discord.
4. **`docs/DESIGN.md`** → de dónde salen los colores, el tipo de modal y el mecanismo de feedback que ves en el prototipo — para no tener que adivinar el token correcto al codear.

Si notás una diferencia entre el mapa y el prototipo, **no se resuelve por tu cuenta ni se implementa "lo que parece más razonable"**: se avisa al PO antes de escribir la task. Es exactamente el mismo criterio de "relevar antes de asumir" que ya usamos para las specs.

## 4. Cómo se integra esto en el flujo SDD

Repasando el flujo de `docs/adicionales/sdd-metodologia.md`, el material de referencia entra en dos puntos concretos:

- **Antes de escribir `HU-<letra><n>.md`:** el Scrum Master consulta `mapa-pantallas-sprint-2.md` para la fila de la HU, y mira el prototipo/HTML/PDF para esa pantalla puntual. La sección 5 (Frontend) de la task cita la fila del mapa — *"Pantalla: Detalle de turno (`/turnos/[id]`), ver `docs/adicionales/mapa-pantallas-sprint-2.md` §1"* — en vez de describir el layout de cero.
- **En el Relevamiento previo (sección 0 de la task):** si al mirar el prototipo surge una duda que la task no contempla (un estado que no está en el mapa, un texto que no coincide con el criterio de aceptación), se reporta ahí como punto a confirmar — no se resuelve por inferencia.

El prototipo **no se linkea dentro de las tasks ni de las specs** — esas siguen siendo autocontenidas y con referencias a documentos del repo, no a un link externo que puede cambiar. El link vive acá y en `mapa-pantallas-sprint-2.md`.

## 5. Ejemplo real de cómo funciona esto (28/09/2026)

El mismo día que se armó el prototipo, revisar las pantallas hizo que se revirtieran dos decisiones que se habían tomado más temprano ese día, antes de tener el prototipo armado:

| HU | Se había decidido | Con el prototipo se definió |
|---|---|---|
| HU-C-12 (Solicitar turno) | Modal (`Dialog`) desde "Mis turnos" | Página completa propia, con 3 columnas (Materia/Profesor/Horario) |
| HU-D-07 (Materias del profesor) | Modal picker aparte | Embebido en el mismo modo edición de la ficha, junto a Datos personales |

`mapa-pantallas-sprint-2.md` ya está actualizado con esto (con nota de la revisión, para que quede el historial). Si estabas por escribir la task de alguna de estas dos HU con la versión vieja del mapa, es el motivo por el que cambió — no es un criterio de aceptación distinto, es solo la presentación.

## 6. Checklist rápido antes de escribir una task

- [ ] ¿Miré la fila de esta HU en `mapa-pantallas-sprint-2.md`?
- [ ] ¿Es modal o página completa? Si es modal, ¿qué tipo (`Dialog`/`AlertDialog`) y qué feedback (toast/banner)?
- [ ] ¿Miré el prototipo o el HTML/PDF para esa pantalla puntual?
- [ ] ¿Hay algo que el prototipo muestra y el mapa no menciona? → se consulta con el PO antes de asumir, se documenta en la sección 0 de la task.
- [ ] ¿La sección 5 (Frontend) de mi task cita la fila del mapa en vez de inventar layout o ruta nueva?
