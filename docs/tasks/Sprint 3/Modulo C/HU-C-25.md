# TASK: HU-C-25 — Confirmar cada operación antes de guardarla

**Módulo:** Transversal (interfaz)
**Sprint:** 3
**Contrato de referencia:** sin `spec_modulo` propio (HU transversal) · `docs/tasks/Sprint 3/HU-Sprint-3.md` (HU-C-25, líneas 45-67) · `docs/tasks/Sprint 3/PR-0.md` §2.13 (archivo central de textos y `ErrorDeDominio`)
**RBAC:** sin permisos nuevos — lo usan todos los roles
**Schema:** ya completo, sin migración

---

## 0. Relevamiento previo a implementación (Claude Code)

Antes de escribir código, Claude Code debe reportar y **esperar confirmación explícita** sobre:

- **Archivos nuevos a crear** (ruta exacta, uno por uno) — ver punto de partida propuesto en la sección 3.
- **Archivos existentes a modificar** — en esta task, ninguno todavía: `CancelarTurnoDialog` (Sprint 2) sigue tal cual hasta que la HU que la toque la migre (ver "Nota de alcance").
- **Relevar antes de asumir:**
  - Nombre final del componente y de sus props (acá se propone `ConfirmarAccionDialog`, pero si el equipo ya usó otro nombre en una rama en curso, avisar antes de duplicar).
  - Si el formateo de montos (`$ 22.000`, sin decimales, separador de miles) ya existe en algún lado del código además de `indicadores` — si no, esta task lo crea (sección 4).

No se procede a la implementación hasta recibir el OK sobre este relevamiento.

---

## 1. Nota de alcance

Esta HU **no tiene pantalla propia**: es un componente compartido (`ConfirmarAccionDialog`) que las demás HU del sprint van a importar y usar con su propio título, detalle y acción. Por eso esta task solo entrega:

1. El componente genérico (contrato de UI).
2. Su publicación temprana (API de props estable) para que el resto de las HU de Cali y de sus compañeros de equipo programen contra ella desde el día 1 — la justificación de secuencia del backlog pide esto antes del merge del PR 0, pero el PR 0 **ya está mergeado en `develop`** (ver `src/lib/textos.ts`, `src/server/shared/error-dominio.ts`), así que acá el único prerrequisito real es que el componente quede disponible antes de que arranquen I-10, I-11, I-12 y C-26.
3. Las claves de texto nuevas que haga falta sumar a `src/lib/textos.ts` para los catálogos de confirmación del criterio 3 (los de **esta** historia: pagos, caja — el resto del catálogo del criterio 3 que no toca el carril de Cali, como clase dictada o tarifas, lo agregan las HU dueñas cuando lleguen).

**Ya existe en el repo** (Sprint 2, PR 0) y hay que tenerlo en cuenta:
- `src/components/shared/confirmar-descarte-dialog.tsx` — mismo patrón de `AlertDialog` de `@base-ui/react/alert-dialog`, para "cambios sin guardar". **No lo reemplaza esta historia** (es otro caso: descartar un formulario, no confirmar que se guarde).
- `src/app/(dashboard)/turnos/[id]/cancelar-turno-dialog.tsx` — confirmación de Sprint 2 para cancelar/descartar un turno, con mensajes fijos y manejo de error por `toast` (cierra el diálogo y notifica aparte). **Este es el patrón que HU-C-25 reemplaza conceptualmente**, pero esta task no lo migra: el criterio 7 dice que las confirmaciones de Sprint 1/2 "conservan su comportamiento" salvo que la propia HU-C-05 se toque este sprint (no está en el backlog de Sprint 3). Dejarlo documentado para que, si alguien migra `CancelarTurnoDialog` más adelante, use `ConfirmarAccionDialog`.
- `src/server/shared/error-dominio.ts` / `src/lib/textos.ts` — ya resuelven "los servicios no devuelven texto, lanzan `ErrorDeDominio(clave, datos)` y el texto sale de la tabla central". El componente de esta historia consume ese texto tal cual llega en la respuesta de error, no lo reconstruye.

**Fuera de alcance de esta task (explícito):**
- Migrar `CancelarTurnoDialog` u otra confirmación de Sprint 1/2 al nuevo componente.
- Las claves de texto de catálogos que no tocan el carril de Cali (clase dictada, tarifas, bajas de personal, etc.) — las agrega cada HU dueña al usarlas.
- Cualquier pantalla con acciones nuevas del sprint: esas HU (I-10, I-11, C-21, I-12, C-26, I-02, I-06, I-05, N-01) son las que **consumen** este componente, no esta task.

**Qué NO resuelve esta HU por sí sola (ojo al verificar Definition of Done del sprint):**
El criterio 3 del backlog pide un "catálogo mínimo" de textos de confirmación por dominio (pagos, inscripciones, clase dictada, tarifas, caja, bajas, config. del centro), y el criterio 1 pide que *toda* acción nueva o modificada del sprint use este patrón. Ninguna de las dos cosas la cumple esta task por sí sola: se van cumpliendo incrementalmente a medida que cada HU dueña (I-10, I-11, C-21, I-12, C-26, I-02, I-06, I-05, N-01, y las de los demás módulos fuera del carril de Cali) adopta el componente. El propio backlog lo deja explícito: *"no tiene verificaciones diferidas: se verifica con las operaciones que existen al mergearla"*. Por eso el checklist de DoD de esta task (sección 7) certifica solo el componente en sí, no el criterio 1/3 del sprint completo — eso se certifica al final, cuando el sprint entero esté mergeado.

---

## 2. Historia de Usuario

**Como** usuario del sistema (cualquier rol)
**Necesito** que antes de guardar cualquier operación el sistema me muestre un mensaje con lo que voy a hacer y sus datos concretos
**Para** detectar un importe, un alumno o una clase equivocados antes de que queden registrados

**SP estimado:** 1

---

## 3. Alcance de esta task

Implementación **solo frontend** (componente de interfaz + helper de formato). Incluye:

- Componente `src/components/shared/confirmar-accion-dialog.tsx`
- Helper de formato de moneda (si no existe ya): `src/lib/moneda.ts` → `formatearMonto(valor: number): string` (ej. `formatearMonto(22000)` → `"$ 22.000"`, `Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 })`)
- Las claves nuevas en `src/lib/textos.ts` que haga falta agregar *ahora* para que el componente tenga algo que mostrar cuando el servidor rechaza (ver sección 4.1) — solo las que ya están propuestas o existen; el resto las suma cada HU consumidora.
- Tests unitarios del componente (sección 6).

**Fuera de alcance de esta task** (no implementar bajo ninguna circunstancia):
- Cualquier pantalla, formulario o Route Handler de las HU que van a usar este componente (I-10, I-11, C-21, I-12, C-26, I-02, I-06, I-05, N-01) — eso lo hace cada task de esas HU.
- Textos del catálogo del criterio 3 que pertenecen a HU fuera del carril de Cali.

---

## 4. Contrato del componente

### 4.1. Props

**Archivo:** `src/components/shared/confirmar-accion-dialog.tsx`

```typescript
type ConfirmarAccionDialogProps = {
  /** Controla si el diálogo está abierto. Siempre controlado por el padre. */
  abierto: boolean;
  /**
   * "¿Estás seguro de que querés <acción> <datos concretos>?" ya armado por
   * el llamador (criterio 2). Por HU-C-23 (archivo central de textos), la
   * HU dueña de cada acción arma este string con `texto("confirmaciones.<dominio>.<accion>", {datos})`
   * desde `src/lib/textos.ts` — no como un template literal suelto en el
   * componente de esa pantalla. Esta task no agrega esas claves (pertenecen
   * al catálogo del criterio 3, que arma cada HU dueña); solo deja esto
   * documentado para que no se rompa por invención de cada dev.
   */
  titulo: string;
  /** Detalle debajo del título: clases, importes, forma y fecha de pago, etc. (criterio 2). Opcional. */
  detalle?: React.ReactNode;
  /** Texto del botón de confirmar, con el verbo de la acción (ej. "Registrar pago"). */
  textoConfirmar: string;
  /**
   * true si la operación no se puede deshacer (criterio 4): agrega la leyenda
   * "Esta acción no se puede deshacer.", pinta el botón de confirmar en rojo
   * (variant="destructive") y pone el foco inicial en "Volver".
   */
  irreversible?: boolean;
  /**
   * Se llama al tocar el botón de confirmar. Si el servidor rechaza, debe
   * lanzar un error con `.message` ya resuelto (el texto de `ErrorDeDominio`,
   * ver `fetchAutenticado` + `error-dominio.ts`) — el componente lo muestra
   * inline, debajo del detalle, sin cerrar el diálogo (criterio 6). Si
   * resuelve sin lanzar, el componente cierra el diálogo y llama a `onExito`.
   */
  onConfirmar: () => Promise<void>;
  /** Se llama tras un `onConfirmar` exitoso (para refrescar datos, mostrar un toast, etc.). */
  onExito?: () => void;
  /** Botón "Volver": cierra sin guardar lo cargado (no se pierde el formulario de atrás). */
  onCerrar: () => void;
};
```

### 4.2. Comportamiento

1. `AlertDialog` de `@base-ui/react/alert-dialog` (mismo primitivo que `ConfirmarDescarteDialog` y `CancelarTurnoDialog`), no se cierra con click afuera ni Escape mientras está `enviando` (criterio 1: "Hasta confirmar no se guarda nada", pero tampoco se puede abandonar el modal a mitad de un envío en curso).
2. Mientras `onConfirmar` está en curso, ambos botones quedan deshabilitados y el de confirmar muestra "Procesando…" (mismo patrón que `CancelarTurnoDialog`).
3. Si `onConfirmar` lanza un error: se muestra su `.message` en un bloque inline con ícono de alerta (mismo estilo que el aviso de pagos de `CancelarTurnoDialog`, `bg-destructive-soft`), el diálogo **no se cierra** y **no se llama a `onExito`** (criterio 6). El usuario puede corregir datos en la pantalla de atrás sin perder el diálogo — en la práctica, muchas pantallas van a cerrar igual el diálogo y dejar ver el error en el fondo; seguir el mock de HU-I-10 (figura 19): el error se ve dentro del propio modal de confirmación.
4. Si `onConfirmar` resuelve: cierra el diálogo y llama a `onExito` (el toast de éxito lo dispara el llamador, no este componente, porque el texto de éxito varía por acción).
5. Cuando `irreversible` es `true`: debajo del `detalle` se agrega el párrafo "Esta acción no se puede deshacer." y `initialFocus` apunta al botón "Volver" (igual que ya hace `CancelarTurnoDialog`, que esta historia no migra pero sí fija como referencia de estilo).

### 4.3. Helper de formato

**Archivo:** `src/lib/moneda.ts` (verificar primero que no exista ya nada equivalente, ver sección 0)

```typescript
export function formatearMonto(valor: number): string {
  return `$ ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(valor)}`;
}
```

### 4.4. Textos nuevos en `src/lib/textos.ts`

No agrega claves de error nuevas (esta historia no lanza `ErrorDeDominio`; solo consume los que ya lanzan los servicios). Si hace falta un texto fijo para el propio componente (por ejemplo, un label por defecto), se define como constante local del componente, no en el archivo central — ese archivo es para claves de `ErrorDeDominio` (ver comentario de cabecera de `textos.ts`).

### 4.5. Adaptador `fetch` → `onConfirmar`

Hoy cada diálogo de Sprint 1/2 repite a mano `const result = await response.json(); result?.error?.message ?? "..."` (`cancelar-turno-dialog.tsx`, `reprogramar-turno-dialog.tsx`, `asignar-prioridad-dialog.tsx`, `turno-detalle.tsx`). Como `onConfirmar` de esta historia espera que, si falla, **lance** un `Error` con el mensaje ya resuelto, esta task agrega un helper único para que las HU de Cali (y cualquier otra que adopte el patrón) no repitan la lógica cada una a su manera:

**Archivo:** `src/lib/fetch-autenticado.ts` (se agrega al wrapper que ya existe, no un archivo nuevo)

```typescript
/**
 * Para usar con `ConfirmarAccionDialog.onConfirmar`: hace el fetch con
 * `fetchAutenticado` y, si la respuesta no es 2xx, lanza un `Error` con
 * `result.error.message` (el texto que ya resolvió `ErrorDeDominio` en el
 * servidor) o un mensaje genérico si el cuerpo no se puede parsear.
 */
export async function fetchOLanzar(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const response = await fetchAutenticado(input, init);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error?.message ?? "No se pudo completar la acción. Intentá nuevamente.");
  }
  return result?.data ?? result;
}
```

Las HU consumidoras (I-10, I-11, C-21, I-12, C-26, I-02, I-06, I-05, N-01) usan `fetchOLanzar(...)` dentro de su propio `onConfirmar` en vez de manejar `response.ok` a mano. Un error de red (fetch rechaza antes de llegar a `response`) también llega como excepción y el componente lo muestra igual, pero con el mensaje genérico de JS (`TypeError: Failed to fetch`) — si alguna HU necesita un mensaje más amable para ese caso puntual, lo decide ella (no es parte de este contrato genérico).

---

## 5. Frontend

- Un único componente reutilizable, sin pantalla propia.
- Seguir `docs/DESIGN.md` (tokens de shadcn/ui + Tailwind, nunca hex ni paleta default de Tailwind): mismas clases que `cancelar-turno-dialog.tsx` (`bg-destructive`, `bg-destructive-soft`, `text-muted-foreground`, etc.) para que el estilo sea indistinguible del resto del sistema.
- Accesibilidad: `AlertDialog.Title` y `AlertDialog.Description` de `@base-ui/react/alert-dialog` ya resuelven el `aria-*` necesario (mismo patrón que los dos diálogos existentes).

**Fuera de alcance de frontend:** ninguna pantalla consumidora (ver sección 3).

---

## 6. Testing (tres niveles, según metodología del proyecto)

### Nivel 1 — Unitarios (`confirmar-accion-dialog.test.tsx`)

- Renderiza `titulo` y `detalle` cuando `abierto=true`.
- Al tocar el botón de confirmar, llama a `onConfirmar` una sola vez y deshabilita ambos botones mientras está pendiente.
- Si `onConfirmar` resuelve: cierra (`onCerrar`/`abierto` pasa a `false` por el padre) y llama a `onExito`.
- Si `onConfirmar` rechaza con `new Error("mensaje de prueba")`: muestra "mensaje de prueba" inline, no llama a `onExito`, el diálogo sigue abierto.
- Con `irreversible=true`: muestra "Esta acción no se puede deshacer.", el botón de confirmar tiene la clase de `destructive`, y el foco inicial cae en "Volver".
- Sin `irreversible` (o `false`): no muestra la leyenda y el botón de confirmar no lleva estilo de peligro.
- `formatearMonto`: casos `0`, `12000` → `"$ 12.000"`, `1234567` → `"$ 1.234.567"` (separador de miles `es-AR`).
- `fetchOLanzar`: con `response.ok=true` devuelve `result.data`; con `response.ok=false` y cuerpo `{ error: { message } }` lanza `Error(message)`; con cuerpo no parseable lanza el mensaje genérico.

### Nivel 2 — Postman

No aplica (sin Route Handler propio).

### Nivel 3 — BD / TablePlus

No aplica (sin escritura a base de datos).

**Evidencia esperada:** capturas de UI mostrando el componente en al menos dos usos simulados (ej. storybook-like fixture o una página de prueba temporal) — éxito, error inline, y variante irreversible.

---

## 7. Checklist de Definition of Done

- [ ] Relevamiento previo (sección 0) confirmado antes de implementar.
- [ ] `ConfirmarAccionDialog` implementado con las props y el comportamiento de la sección 4.
- [ ] `formatearMonto` implementado (o reutilizado si ya existía uno equivalente — documentar la decisión).
- [ ] `fetchOLanzar` agregado a `fetch-autenticado.ts` (sección 4.5).
- [ ] Ningún `DELETE` físico ni lógica de negocio en este componente (es puramente de presentación).
- [ ] Tests unitarios de la sección 6 en verde.
- [ ] Estilo visual indistinguible de `cancelar-turno-dialog.tsx` (mismas clases/tokens de `docs/DESIGN.md`).
- [ ] PR con diff acotado exclusivamente a esta HU (componente + helper + tests, sin tocar pantallas existentes).
