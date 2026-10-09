# DESIGN.md — Guía de diseño de Noctium

Paleta oficial del proyecto, implementada como tokens de shadcn/ui en
`src/app/globals.css` (Tailwind v4, `@theme inline` + variables CSS en
formato `oklch`). Todo componente que use las clases estándar de Tailwind
(`bg-primary`, `text-foreground`, `border-border`, etc.) toma estos valores
automáticamente — nadie debería escribir un color a mano.

## Regla no negociable

**Prohibido usar colores hex o colores de la paleta default de Tailwind
(`blue-600`, `gray-500`, `emerald-100`, etc.) directamente en componentes.**
Siempre a través de un token (`bg-primary`, `text-muted-foreground`,
`bg-success`, etc.). Si necesitás un color que no está en la tabla de abajo,
se discute y se agrega acá como token nuevo — no se hardcodea puntualmente.

---

## 1. Paleta base (colores de marca)

| Color | Hex |
|---|---|
| Azul petróleo | `#123C4A` |
| Azul profundo | `#172A3A` |
| Marfil | `#F5F3EE` |
| Grafito | `#20262B` |
| Verde azulado / acento | `#2A9D8F` |

Todos los tokens de abajo derivan de estos 5 colores (o son neutros
calculados a partir de ellos). No hay ningún color en el sistema que no
tenga trazabilidad hasta esta tabla.

---

## 2. Tabla de tokens

| Token | oklch | Hex aprox. | Uso |
|---|---|---|---|
| `--background` | `oklch(0.9643 0.0070 88.64)` | `#F5F3EE` | Fondo general de la app (Marfil) |
| `--foreground` | `oklch(0.2648 0.0127 243.35)` | `#20262B` | Texto general (Grafito) |
| `--card` / `--popover` | `oklch(1 0 0)` | `#FFFFFF` | Fondo de tarjetas, popovers, diálogos |
| `--card-foreground` / `--popover-foreground` | `oklch(0.2648 0.0127 243.35)` | `#20262B` | Texto sobre tarjetas/popovers |
| `--primary` | `oklch(0.3341 0.0516 223.81)` | `#123C4A` | Acción principal (botón default, links importantes) |
| `--primary-foreground` | `oklch(0.9643 0.0070 88.64)` | `#F5F3EE` | Texto sobre `--primary` |
| `--secondary` | `oklch(0.2767 0.0388 245.25)` | `#172A3A` | Acción secundaria (botón `variant="secondary"`) |
| `--secondary-foreground` | `oklch(0.9643 0.0070 88.64)` | `#F5F3EE` | Texto sobre `--secondary` |
| `--muted` | `oklch(0.93 0.006 243)` | `#E5E8EC` | Fondos de sección atenuados (gris neutro, hue de Grafito) |
| `--muted-foreground` | `oklch(0.50 0.010 243)` | `#5F6469` | Texto secundario/deshabilitado |
| `--accent` | `oklch(0.93 0.008 88.64)` | `#EAE8E2` | Fondo de hover de menús/selects/items — **nunca** el verde acento, ver Regla obligatoria abajo |
| `--accent-foreground` | `oklch(0.2648 0.0127 243.35)` | `#20262B` | Texto sobre `--accent` |
| `--destructive` | `oklch(0.55 0.19 25)` | `#C92F33` | Acciones destructivas, errores de formulario |
| `--destructive-soft` | `oklch(0.93 0.04 25)` | `#FFDEDB` | Fondo suave de error/alerta (aviso de acción rechazada, tarjeta de turno cancelado) — par de `--success`/`--warning`. **Token nuevo, 28/09/2026** (ver sección 6.5) |
| `--destructive-soft-foreground` | `oklch(0.40 0.14 25)` | `#831A1D` | Texto sobre `--destructive-soft` (contraste ~7.9:1). **Token nuevo, 28/09/2026** |
| `--success` | `oklch(0.93 0.045 152)` | `#D3F1D9` | Fondo de estado de éxito (banner/badge/toast) |
| `--success-foreground` | `oklch(0.32 0.09 152)` | `#003F1A` | Texto sobre `--success` |
| `--warning` | `oklch(0.93 0.06 75)` | `#FFE3BC` | Fondo de estado de advertencia |
| `--warning-foreground` | `oklch(0.38 0.09 60)` | `#643400` | Texto sobre `--warning` |
| `--border` / `--input` | `oklch(0.88 0.006 243)` | `#D4D8DB` | Bordes de inputs, separadores, contornos |
| `--ring` | `oklch(0.6304 0.1013 183.03)` | `#2A9D8F` | Anillo de foco (acento) |
| `--brand-accent` | `oklch(0.6304 0.1013 183.03)` | `#2A9D8F` | Utilidad de marca (`bg-brand-accent`, `text-brand-accent`, `border-brand-accent`) — mismo valor que `--ring` hoy, pero es un token independiente |
| `--chart-1` | `oklch(0.33 0.052 224)` | `#103B49` | Serie 1 (azul petróleo) |
| `--chart-2` | `oklch(0.60 0.105 183)` | `#0C9486` | Serie 2 (acento) |
| `--chart-3` | `oklch(0.28 0.039 245)` | `#182B3B` | Serie 3 (azul profundo) |
| `--chart-4` | `oklch(0.40 0.02 243)` | `#3F4952` | Serie 4 (gris Grafito medio) |
| `--chart-5` | `oklch(0.48 0.075 200)` | `#176A6E` | Serie 5 (teal intermedio) |
| `--sidebar` | `oklch(0.2767 0.0388 245.25)` | `#172A3A` | Fondo del sidebar (azul profundo) |
| `--sidebar-foreground` | `oklch(0.9643 0.0070 88.64)` | `#F5F3EE` | Texto del sidebar (Marfil) |
| `--sidebar-primary` | `oklch(0.6304 0.1013 183.03)` | `#2A9D8F` | Ítem activo/destacado del sidebar (acento) |
| `--sidebar-primary-foreground` | `oklch(0.2648 0.0127 243.35)` | `#20262B` | Texto sobre `--sidebar-primary` (Grafito, ver Regla de contraste) |
| `--sidebar-accent` | `oklch(0.34 0.045 245)` | `#233A4E` | Hover de ítems del sidebar |
| `--sidebar-accent-foreground` | `oklch(0.9643 0.0070 88.64)` | `#F5F3EE` | Texto sobre `--sidebar-accent` |
| `--sidebar-border` | `oklch(0.38 0.04 245)` | `#304556` | Separadores dentro del sidebar |
| `--sidebar-ring` | `oklch(0.6304 0.1013 183.03)` | `#2A9D8F` | Anillo de foco dentro del sidebar |

Los hex de la columna "Hex aprox." están calculados por conversión exacta
oklch→sRGB (no son una estimación a ojo); para los tokens que provienen
directamente de la paleta base, el resultado coincide con el hex oficial.

---

## 3. Cuándo usar cada color

- **`--primary`** (Azul petróleo): la acción principal de cada pantalla —
  el botón que realmente hace avanzar el flujo ("Guardar", "Registrar
  materia", "Iniciar sesión"). Un solo `primary` por vista, salvo casos
  claramente repetidos (ej. una fila de tabla con su propia acción).
- **`--secondary`** (Azul profundo): acciones alternativas de importancia
  media — no destructivas, no la principal. También es el color de fondo
  del sidebar.
- **`--brand-accent`** (Acento): detalles de marca puntuales fuera del
  sistema de componentes de shadcn (ilustraciones, iconografía, elementos
  decorativos, highlights puntuales). No es un color de fondo de uso
  general — ver la regla de contraste abajo.
- **`--success` / `--warning`**: estados semánticos de feedback (mensajes
  de éxito, avisos no destructivos). Usados en banners inline (pantallas
  existentes) y en toasts (ver sección 6, "Confirmaciones y feedback de
  acciones") — no se usa un color a mano en ninguno de los dos casos.
- **`--destructive`**: errores de validación, acciones irreversibles,
  mensajes de error de comunicación.
- **`--destructive-soft` / `--destructive-soft-foreground`**: el fondo
  suave para mostrar algo "en rojo" sin usar el rojo fuerte de relleno —
  avisos de una acción rechazada y tarjetas de turno cancelado (sección
  6.5). Es al rojo lo que `--success` y `--warning` son al verde y al
  ámbar.

## 4. Advertencia de contraste — `--brand-accent` / `#2A9D8F`

El acento tiene un contraste de **~3:1 con blanco y con Marfil** —
insuficiente para texto de tamaño normal sobre esos fondos (falla WCAG AA
para texto). Reglas:

- **Nunca** usarlo como color de texto sobre `--background` o `--card` en
  tamaño de texto normal (sí es aceptable en texto grande/bold o iconografía
  decorativa).
- Si se usa como **fondo**, el texto encima va en **Grafito**
  (`--foreground` / `#20262B`), nunca en blanco/Marfil — así quedó resuelto
  en `--sidebar-primary-foreground`.
- Por eso mismo **nunca** está asignado a `--accent` de shadcn: ese token es
  el fondo de hover de menús y selects con texto normal encima, y pintarlo
  de acento rompería el contraste en todos esos casos a la vez.

**Regla análoga para el rojo (28/09/2026):** `--destructive` sobre
`--destructive-soft` tiene un contraste de ~4.3:1, que no alcanza AA para
texto normal. Sobre `--destructive-soft` el texto va **siempre** en
`--destructive-soft-foreground`; `--destructive` queda para bordes e
íconos sobre ese fondo, o como texto/borde sobre `--card` (blanco), donde
llega a ~5.3:1.

## 5. Modo oscuro

Fuera de alcance de esta tarea. El bloque `.dark` en `globals.css` sigue
siendo el default genérico de shadcn (grises sin relación con esta paleta)
— no hay ningún toggle conectado en la app todavía. Cuando se aborde modo
oscuro, es una tarea aparte que define los equivalentes oscuros de esta
misma tabla, no algo a improvisar sobre la marcha.

---

## 6. Confirmaciones y feedback de acciones — Toast, Banner y Modal

**Regla no negociable, igual que la paleta:** cada acción que crea, modifica
o cancela algo tiene que dar feedback explícito de éxito, y ese feedback usa
uno de estos tres mecanismos **según el tipo de pantalla desde la que se
dispara** — no queda a criterio del desarrollador cuál usar.

### 6.1 Toast — para acciones disparadas desde un modal (`Dialog`/`AlertDialog`)

**Componente:** `sonner` (`npx shadcn@latest add sonner`) — es el toast que
shadcn/ui recomienda actualmente, reemplaza a su `Toast`/`useToast` viejo.
Es una dependencia nueva y chica, agregada específicamente para esto — no
hay nada en el stack actual que la reemplace.

**Cuándo usarlo:** siempre que la acción se confirma desde un modal y el
modal se cierra devolviendo a la misma pantalla (Registrar pago, Asignar
prioridad, Cancelar turno, Reprogramar turno, Registrar clase dictada,
Registrar resultado de examen, Nueva forma de pago — ver
`docs/adicionales/mapa-pantallas-sprint-2.md` para la lista completa de
acciones en modal).

**Cómo se ve:**
- Aparece en una esquina fija de la pantalla (arriba a la derecha),
  no bloquea ni requiere click para cerrarse.
- Se autodescarta a los 4 segundos.
- Éxito: fondo `--success`, texto `--success-foreground`, ícono de check.
- Error de servidor (ej. falla de red al guardar): fondo `--destructive`
  con su foreground, mismo mecanismo — no usar `alert()` del navegador
  ni dejar el modal "colgado" sin feedback.
- El texto es siempre el mismo que ya define el criterio de aceptación de
  la HU correspondiente, literal (ej. "Pago registrado correctamente",
  "Forma de pago registrada correctamente") — no se parafrasea.

**Qué NO hacer:** no usar un modal de confirmación ("Registrado
exitosamente" + botón "Aceptar") para avisar un éxito. Eso obliga a un
click extra sin que haya ninguna decisión que tomar — un modal se reserva
para pedir una decisión (confirmar una acción destructiva, elegir entre
opciones), nunca para informar un resultado.

### 6.2 Banner inline — para acciones de página completa (patrón ya existente de Sprint 1)

**Cuándo usarlo:** se mantiene sin cambios en las pantallas que ya lo usan
y en cualquier flujo nuevo que siga el mismo patrón de página completa (alta
o edición que no vive en un modal): Alumnos, Profesores, Materias, Aulas,
el wizard de turno (`/turnos/nuevo`, individual y modo masivo de HU-C-17).

**Cómo se ve:** franja fija en la parte superior del contenido de la
página, fondo `--success` / texto `--success-foreground`, con los links de
navegación que correspondan ("Volver al listado", "Ver detalle") —
mismo patrón ya verificado en `/turnos/nuevo` y documentado como deuda de
diseño pendiente en `/materias` (sección 7).

**Por qué no se migra a toast:** son flujos de página completa (el submit
ya te deja en una pantalla distinta o recargada), donde el banner es visible
sin que el usuario tenga que fijarse en una esquina — cambiarlo ahora
tocaría código ya funcionando de Sprint 1 sin necesidad real. Queda como
inconsistencia deliberada, no como olvido.

### 6.3 Modal / `AlertDialog` — solo para pedir una decisión, nunca para informar éxito

**Cuándo usarlo:** exclusivamente antes de una acción irreversible o que
necesita una confirmación explícita (Cancelar turno). Usar `AlertDialog` de
shadcn (no se cierra con click afuera, fuerza a elegir un botón) y el botón
de confirmación lleva el verbo de la acción, nunca "Aceptar"/"OK" genérico
(ej. "Cancelar turno", no "Confirmar").

**Después de confirmar en un `AlertDialog`, el resultado se informa con
toast (6.1), no con otro modal.**

**Única excepción — `Dialog` informativo de una acción rechazada
(28/09/2026):** cuando una acción se rechaza y la explicación necesita una
lista o tabla que no entra en la pantalla sin deformarla (caso actual:
HU-D-07, "Ver turnos" — los turnos futuros que impiden quitar una materia
de un profesor), se permite un `Dialog` ancho que solo informa.
- Lleva un único botón "Entendido" (y la X); no hay decisión que tomar.
- **No dispara toast:** no hay éxito que informar, y el rechazo ya está
  explicado en el propio modal.
- Se abre desde un link del aviso corto de error ("Ver turnos"), nunca
  automáticamente.
- Si la lista tiene más de 10 elementos, se pagina (sección 8).
- No es un permiso general para informar éxitos con modal: eso sigue
  prohibido (6.1). Cualquier caso nuevo de este tipo se agrega acá y en la
  tabla 6.4 antes de escribir el task.

### 6.4 Tabla resumen — qué usa cada acción de Sprint 2

| Acción | Disparador | Feedback de éxito |
|---|---|---|
| Cancelar turno (HU-C-05) | `AlertDialog` | Toast |
| Reprogramar turno (HU-C-06) | `Dialog` | Toast |
| Asignar prioridad (HU-C-10) | `Dialog` | Toast |
| Registrar pago (HU-I-01) | `Dialog` | Toast |
| Nueva forma de pago (HU-I-03) | `Dialog` | Toast |
| Registrar clase dictada (HU-E-01) | `AlertDialog` (confirmación simple) | Toast |
| Registrar resultado de examen (HU-E-06) | `Dialog` | Toast |
| Ver turnos que impiden quitar una materia (HU-D-07) | `Dialog` informativo (6.3) | Ninguno — no modifica datos |
| Alta/edición de Alumno, Profesor, Materia, Aula (Sprint 1, sin cambios) | Página completa | Banner inline |
| Wizard de turno, ambos modos (`/turnos/nuevo`) | Página completa | Banner inline |

Si una HU nueva no está en esta tabla, se define su feedback con el mismo
criterio (¿la acción vive en modal o en página completa?) y se agrega acá
antes de escribir el task — no se improvisa en el momento de implementar.

### 6.5 Etiquetas de estado del turno y avisos de error (28/09/2026)

Antes cada pantalla interpretaba el aspecto de las etiquetas de estado a su
manera; esta tabla es la referencia única (HU-C-13 la cita para "Cancelado").
Todas son etiquetas tipo píldora (`Badge`), con los tokens de la tabla — sin
colores a mano.

| Estado | Aspecto | Tokens |
|---|---|---|
| Disponible | Relleno suave | fondo `--success`, texto `--success-foreground` |
| Completo | Relleno oscuro | fondo `--primary`, texto `--primary-foreground` |
| Pendiente | Relleno suave | fondo `--warning`, texto `--warning-foreground` |
| Cancelado | Contorno | borde y texto `--destructive`, fondo `--card` |

**Turno cancelado en "Mis turnos" (HU-C-13):**
- En **Próximos**: la tarjeta se destaca con fondo `--destructive-soft`,
  borde `--destructive` y texto `--destructive-soft-foreground`, además de la
  etiqueta "Cancelado".
- En **Anteriores**: conserva la etiqueta "Cancelado", pero la tarjeta va
  atenuada (sin fondo rojo, texto `--muted-foreground`) — ya no es un aviso
  de algo por venir.

**Aviso corto de una acción rechazada** (por ejemplo, "No se puede quitar:
el profesor tiene N turnos futuros de esta materia"): una línea con ícono,
fondo `--destructive-soft`, texto `--destructive-soft-foreground`. Si tiene
un link (como "Ver turnos"), el link va subrayado en el mismo color de
texto.

---

## 7. Deuda de diseño pendiente

Componentes que ya existen con colores hardcodeados de la paleta default
de Tailwind, en vez de tokens. No se tocaron en esta tarea (fuera de
alcance) — quedan como candidatos para una migración futura:

| Archivo | Qué usa hoy | Migrar a |
|---|---|---|
| `src/app/(dashboard)/materias/page.tsx` | `bg-emerald-100` / `text-emerald-900` (banner "Materia registrada correctamente") | `bg-success` / `text-success-foreground` |
| `src/components/sesion/aviso-expiracion.tsx` | `bg-amber-100` / `text-amber-900` (banner de expiración próxima de sesión) | `bg-warning` / `text-warning-foreground` |
| `src/app/(auth)/login/page.tsx` | `slate-*`, `cyan-*`, gradientes hardcodeados (rediseño de la pantalla de login: logo, fondo de video, mensajes de aviso/éxito) | Requiere una revisión de diseño propia — mezcla layout con colores fuera de la paleta oficial (cyan no es un color de marca), no es un simple find-and-replace de token |

Los primeros dos son reemplazos directos (el token nuevo ya cubre
exactamente ese caso de uso). El tercero necesita más que un cambio de
color — se anota acá para que no se pierda, no para resolverlo ahora.

---

## 8. Listas paginadas y selector con buscador (28/09/2026)

### 8.1 Paginación

Un único componente de paginación para toda la app, con el aspecto que ya
tiene el listado de Alumnos.

- **Tamaño de página:**
  - **10** en las listas que viven dentro de otra pantalla o modal: el tab
    "Historial académico" de la ficha del alumno (HU-E-05), cada pestaña de
    "Mis turnos" (HU-C-13) y la lista del modal "Ver turnos" (HU-D-07).
  - **20** en los listados principales que ya existen (Alumnos, Turnos,
    Materias, Aulas, Profesores). La diferencia es deliberada — son
    pantallas de trabajo donde conviene ver más filas — y no se unifica
    por ahora.
- Texto "Mostrando 1–10 de N", botones "Anterior" / "Siguiente" y números
  de página; con muchas páginas se abrevia con puntos suspensivos
  (1 2 3 … 16).
- Si hay una sola página, no se muestra el control.
- Al cambiar un filtro, el texto de búsqueda o de pestaña, vuelve a la
  página 1. Los contadores (por ejemplo "Anteriores (153)") muestran el
  total, no el de la página.

### 8.2 Selector con buscador (combobox)

Para elegir un elemento de una lista de personas (alumnos) o similar, en vez
de un desplegable simple.

- Filtra por los campos que corresponda (para alumnos: Apellido, Nombre o
  DNI combinados), con coincidencias parciales y sin distinguir mayúsculas
  ni acentos (misma utilidad `normalizarTexto()` que ya usan los listados).
- **Se activa a partir de 2 caracteres** cuando la lista es grande (todos
  los alumnos, HU-B-05 y "Agregar alumno" de HU-C-04). Si la lista es corta
  y acotada (los alumnos inscriptos en un turno, en "Registrar pago" de
  HU-I-01) filtra desde el primer carácter.
- Cada opción muestra "Apellido, Nombre · DNI".
- Sin coincidencias: "No se encontraron alumnos para «texto buscado»".
- No sumar una librería nueva para esto: reutilizar el buscador que ya
  implementó HU-C-04 (`participantes-turno.tsx`) o, si el equipo prefiere
  un componente compartido, el `Combobox` de shadcn/ui.

---

## 9. Contrato de textos de interfaz — HU-C-23 (09/10/2026)

Los textos visibles nuevos o modificados en Sprint 3 provienen de
`src/lib/textos.ts`, mediante `texto(clave, valores?)`. Incluye etiquetas
accesibles, emails e impresiones. Los números calculados y los datos de
negocio no son copy. La migración de pantallas anteriores corresponde a C-19.

Cada módulo mantiene sus claves `ui.<modulo>.<grupo>.<nombre>`; el equipo que
mantiene el componente compartido es responsable de `ui.comun.*` (paginación:
`ui.comun.paginacion.*`). Las claves legacy `errores.*` y sus consumidores se
conservan. La interfaz del sprint nombra “Clase” y estados en femenino
(“Completa”, “Cancelada”), sin cambiar nombres técnicos ni contratos de API.

`texto()` es síncrona y compartida por cliente/servidor. Interpola `{nombre}`;
un valor nulo o ausente deja el hueco intacto. Una clave ausente devuelve la
clave y emite `console.warn(clave)`, sin valores ni datos personales.

La suite y `scripts/verificar-claves-textos.ts` usan el mismo comprobador de
símbolos de TypeScript: referencias a catálogo/función, errores de dominio,
alias, ternarias, mapas finitos y wrappers cerrados. Los casts no sustituyen
la expresión analizada. En mapas se verifica conservadoramente todo el
conjunto de valores. Una referencia indeterminada o un símbolo que escapa a
los usos comprobables falla con archivo y línea. El workflow de textos corre
en `pull_request` sin filtros; su ejecución efectiva requiere evidencia de
un run de GitHub. Cambiar un valor central se propaga al volver a renderizar
sus consumidores, sin editar sus fuentes.

---

## Historial de cambios de este documento

- **28/09/2026:** se retira la mención a "Asociar forma de pago" (HU-C-11,
  eliminada del backlog) en 6.1 y 6.4; se agregan los tokens
  `--destructive-soft` y `--destructive-soft-foreground` (sección 2, 3 y
  4); se agrega la excepción del `Dialog` informativo en 6.3 y su fila en
  6.4; se agrega 6.5 (etiquetas de estado y avisos de error); se agrega la
  sección 8 (paginación y selector con buscador). No se renumeraron
  secciones existentes.
- **09/10/2026:** HU-C-23 agrega el contrato transversal de textos (§9).
  Tras auditoría se ubica antes del historial, conservando contenido y
  numeración de las secciones.
