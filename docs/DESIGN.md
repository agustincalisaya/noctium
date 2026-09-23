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
| `--success` | `oklch(0.93 0.045 152)` | `#D3F1D9` | Fondo de estado de éxito (banner/badge) |
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
  de éxito, avisos no destructivos). Ver "Deuda de diseño pendiente" — hoy
  todavía no los usa ningún componente.
- **`--destructive`**: errores de validación, acciones irreversibles,
  mensajes de error de comunicación.

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

## 5. Modo oscuro

Fuera de alcance de esta tarea. El bloque `.dark` en `globals.css` sigue
siendo el default genérico de shadcn (grises sin relación con esta paleta)
— no hay ningún toggle conectado en la app todavía. Cuando se aborde modo
oscuro, es una tarea aparte que define los equivalentes oscuros de esta
misma tabla, no algo a improvisar sobre la marcha.

---

## 6. Deuda de diseño pendiente

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
