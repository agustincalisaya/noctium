# HU-I-10 — Evidencia de implementación y validación

Fecha: 09/10/2026. Task: [HU-I-10](../tasks/Sprint%203/Modulo%20I/HU-I-10.md). Contrato: [Módulo I](../specs/spec_modulo_I.md) §2.7.

## Entorno

- **Nivel 1:** `vitest` local y `npm run test:pg` (base PostgreSQL descartable `noctium_pruebas_*` en el servidor local, creada y borrada por el script).
- **Nivel 2:** `next dev` local (puerto 3100) apuntando a una base PostgreSQL **descartable** (`noctium_n2_hui10_*`, mismo servidor local) con `prisma migrate deploy` + `prisma/seed.ts`, más escenarios armados con las fábricas de prueba de `src/server/testing/fabricas.ts` y con los servicios de dominio (cierre de la caja de `mesa.entrada2` con `declararEfectivo` + `cerrarCaja`; marcado de una reserva vencida con `marcarVencidas`). Sesiones reales de NextAuth (`/api/auth/callback/credentials`). La base de desarrollo habitual no se tocó; la descartable se borró al terminar.
- **Nivel 3 (visual):** pendiente, lo hace el desarrollador con la app levantada antes de abrir el PR.

## Nivel 1 — Tests

| Verificación | Resultado |
|---|---|
| Suite unitaria completa (`npx vitest run`) | 2125 pasados, 202 omitidos por guarda, 0 fallidos (incluye `claves-textos.test.ts` con el límite subido a 60 s) |
| `pago.schema.test.ts` | 48 pasados |
| `pago.service.test.ts` | 35 pasados |
| Rutas `buscar-alumnos`, `pendientes`, `operaciones` (+ la de HU-I-01) | 51 pasados |
| Wizard (`registrar-pago-wizard.test.tsx`) + `seleccion-clases.test.ts` | 14 pasados |
| PostgreSQL real: `inscripcion.lecturas.pg.test.ts` (función hermana de C) | 5 pasados |
| PostgreSQL real: `pago.operacion.pg.test.ts` (servicios de punta a punta) | 5 pasados |
| PostgreSQL real: `src/server/pagos` + `inscripcion.service.pg.test.ts` (regresión) | 64 pasados |
| TypeScript (`tsc --noEmit`) | Sin errores |
| ESLint sobre los archivos tocados | Sin errores (el warning de `CALENDARIO` en `Sidebar.tsx` ya existía) |

## Nivel 2 — API (automatizado)

Generado el 2026-10-09T22:26:59.598Z contra `next dev` local (puerto 3100) y una base PostgreSQL descartable con migraciones + `prisma/seed.ts` + escenarios armados con las fábricas de prueba. Sesiones reales de NextAuth: `mesa.entrada@noctium.local` (caja abierta del seed), `mesa.entrada2@noctium.local` (caja cerrada con `declararEfectivo` + `cerrarCaja`) y `gerente@noctium.local`. Hoy en el centro: 2026-10-09.

### Resumen

| Caso | Esperado | Obtenido | |
|---|---|---|---|
| Query válida (2 caracteres) | 200 | 200 | ✅ |
| Varias palabras en cualquier orden (HU-B-05) | 200 | 200 | ✅ |
| Menos de 2 caracteres | 400 VALIDACION | 400 VALIDACION | ✅ |
| Alumno existente con clases pendientes (RESERVADA y PAGO_SIN_REGISTRAR) | 200 | 200 | ✅ |
| Con turno_id de una inscripción pendiente: fila marcada | 200 | 200 | ✅ |
| Alumno inexistente | 404 ALUMNO_NO_ENCONTRADO | 404 ALUMNO_NO_ENCONTRADO | ✅ |
| SE_INSCRIBE_AL_PAGAR (reserva vencida previa → exigeInscripcionConPago) | 200 | 200 | ✅ |
| turno_id de una clase PENDIENTE | 409 TURNO_NO_ADMITE_PAGO | 409 TURNO_NO_ADMITE_PAGO | ✅ |
| turno_id de una clase que ya empezó | 409 TURNO_YA_EMPEZO | 409 TURNO_YA_EMPEZO | ✅ |
| SE_INSCRIBE con materia sin tarifa | 422 MATERIA_SIN_TARIFA | 422 MATERIA_SIN_TARIFA | ✅ |
| alumno_id que no es CUID | 400 VALIDACION | 400 VALIDACION | ✅ |
| Zod: ninguna clase | 400 VALIDACION | 400 VALIDACION | ✅ |
| Zod: más de 50 clases | 400 VALIDACION | 400 VALIDACION | ✅ |
| Zod: campo extra (el precio no viaja) | 400 VALIDACION | 400 VALIDACION | ✅ |
| ALUMNO_NO_ENCONTRADO | 404 ALUMNO_NO_ENCONTRADO | 404 ALUMNO_NO_ENCONTRADO | ✅ |
| INSCRIPCION_NO_ENCONTRADA | 404 INSCRIPCION_NO_ENCONTRADA | 404 INSCRIPCION_NO_ENCONTRADA | ✅ |
| TURNO_NO_ENCONTRADO | 404 TURNO_NO_ENCONTRADO | 404 TURNO_NO_ENCONTRADO | ✅ |
| FORMA_PAGO_NO_ENCONTRADA | 404 FORMA_PAGO_NO_ENCONTRADA | 404 FORMA_PAGO_NO_ENCONTRADA | ✅ |
| TURNO_NO_ADMITE_PAGO (clase PENDIENTE) | 409 TURNO_NO_ADMITE_PAGO | 409 TURNO_NO_ADMITE_PAGO | ✅ |
| ALUMNO_NO_INSCRIPTO (inscripción de otro alumno) | 409 ALUMNO_NO_INSCRIPTO | 409 ALUMNO_NO_INSCRIPTO | ✅ |
| TURNO_YA_EMPEZO | 409 TURNO_YA_EMPEZO | 409 TURNO_YA_EMPEZO | ✅ |
| RESERVA_VENCIDA | 409 RESERVA_VENCIDA | 409 RESERVA_VENCIDA | ✅ |
| MOTIVO_AJUSTE_REQUERIDO (con detalles.precio_vigente) | 400 MOTIVO_AJUSTE_REQUERIDO | 400 MOTIVO_AJUSTE_REQUERIDO | ✅ |
| FECHA_PAGO_FUTURA | 400 FECHA_PAGO_FUTURA | 400 FECHA_PAGO_FUTURA | ✅ |
| FORMA_PAGO_NO_DISPONIBLE (forma inactiva) | 409 FORMA_PAGO_NO_DISPONIBLE | 409 FORMA_PAGO_NO_DISPONIBLE | ✅ |
| CAJA_NO_ABIERTA (mesa.entrada2 con la caja cerrada) | 409 CAJA_NO_ABIERTA | 409 CAJA_NO_ABIERTA | ✅ |
| CUPO_INSUFICIENTE («Se inscribe al confirmar el pago» en clase llena) | 409 CUPO_INSUFICIENTE | 409 CUPO_INSUFICIENTE | ✅ |
| ALUMNO_NO_DISPONIBLE («Se inscribe…» superpuesta con otra clase del alumno) | 409 ALUMNO_NO_DISPONIBLE | 409 ALUMNO_NO_DISPONIBLE | ✅ |
| ALUMNO_INACTIVO («Se inscribe…» con alumno inactivo) | 409 ALUMNO_INACTIVO | 409 ALUMNO_INACTIVO | ✅ |
| MATERIA_SIN_TARIFA («Se inscribe…» en materia sin tarifa) | 422 MATERIA_SIN_TARIFA | 422 MATERIA_SIN_TARIFA | ✅ |
| TRANSACCION_OCUPADA (fila del alumno bloqueada por otra transacción) | 409 TRANSACCION_OCUPADA | 409 TRANSACCION_OCUPADA | ✅ |
| Una operación con dos clases (una con importe ajustado y motivo) | 201 | 201 | ✅ |
| INSCRIPCION_YA_PAGADA (cobrar de nuevo la misma clase) | 409 INSCRIPCION_YA_PAGADA | 409 INSCRIPCION_YA_PAGADA | ✅ |
| «Se inscribe al confirmar el pago» (turno_id, tarifa vigente) | 201 | 201 | ✅ |
| Pendientes después del cobro: solo queda la clase no elegida | 200 | 200 | ✅ |
| GET buscar-alumnos como Gerente | 403 SIN_PERMISO | 403 SIN_PERMISO | ✅ |
| GET pendientes como Gerente | 403 SIN_PERMISO | 403 SIN_PERMISO | ✅ |
| POST operaciones como Gerente | 403 SIN_PERMISO | 403 SIN_PERMISO | ✅ |

**38/38 casos como se esperaba.**

### 1. GET /api/pagos/buscar-alumnos

#### ✅ Query válida (2 caracteres)

`GET /api/pagos/buscar-alumnos?q=fe` — sesión: mesa — 273 ms

Response `200`:

```json
{
  "data": [
    {
      "id": "cmv1j36h5000ouwkoutc89i6f",
      "nombre": "Sofía",
      "apellido": "Fernández",
      "dni": "40100001"
    }
  ],
  "error": null
}
```

#### ✅ Varias palabras en cualquier orden (HU-B-05)

`GET /api/pagos/buscar-alumnos?q=fernandez%20sofia` — sesión: mesa — 198 ms

Response `200`:

```json
{
  "data": [
    {
      "id": "cmv1j36h5000ouwkoutc89i6f",
      "nombre": "Sofía",
      "apellido": "Fernández",
      "dni": "40100001"
    }
  ],
  "error": null
}
```

#### ✅ Menos de 2 caracteres

`GET /api/pagos/buscar-alumnos?q=f` — sesión: mesa — 169 ms

Response `400`:

```json
{
  "data": null,
  "error": {
    "code": "VALIDACION",
    "message": "Parámetros inválidos",
    "detalles": {
      "formErrors": [],
      "fieldErrors": {
        "q": [
          "Escribí al menos 2 caracteres"
        ]
      }
    }
  }
}
```

### 2. GET /api/pagos/pendientes

#### ✅ Alumno existente con clases pendientes (RESERVADA y PAGO_SIN_REGISTRAR)

`GET /api/pagos/pendientes?alumno_id=cmv1j36h5000ouwkoutc89i6f` — sesión: mesa — 1721 ms

Response `200`:

```json
{
  "data": {
    "alumno": {
      "id": "cmv1j36h5000ouwkoutc89i6f",
      "nombre_completo": "Fernández, Sofía",
      "dni": "40100001",
      "forma_pago_preferida_id": "formapago-efectivo"
    },
    "clases": [
      {
        "inscripcion_id": "cmv1j9l430009uwfoilygcdar",
        "turno_id": "tumv1j9l1s6uvy0",
        "fecha": "2026-10-12",
        "hora_inicio": "18:00",
        "hora_fin": "19:00",
        "materia": {
          "id": "cmv1j9l050000uwfolsj7cloj",
          "nombre": "Materia mv1j9ky71og7t"
        },
        "profesor": {
          "id": "cmv1j9l0x0002uwfo1brbot12",
          "nombre_completo": "prmv1j9l0s3rzty, Profesor"
        },
        "estado_pago": "RESERVADA",
        "vence_el": "2026-10-10T19:24:48-03:00",
        "precio": 12000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1jad6k0009uwzk8o20ydmm",
        "turno_id": "tumv1jad446zg27",
        "fecha": "2026-10-12",
        "hora_inicio": "20:00",
        "hora_fin": "21:00",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "profesor": {
          "id": "cmv1jad2f0002uwzkc0wmbag9",
          "nombre_completo": "prmv1jad2b3756p, Profesor"
        },
        "estado_pago": "RESERVADA",
        "vence_el": "2026-10-10T19:25:25-03:00",
        "precio": 12000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1j9l4c000buwfozo736oil",
        "turno_id": "tumv1j9l2xakgm6",
        "fecha": "2026-10-13",
        "hora_inicio": "18:00",
        "hora_fin": "19:00",
        "materia": {
          "id": "cmv1j9l050000uwfolsj7cloj",
          "nombre": "Materia mv1j9ky71og7t"
        },
        "profesor": {
          "id": "cmv1j9l2m0004uwfofsd3dz8w",
          "nombre_completo": "prmv1j9l2k7m3sh, Profesor"
        },
        "estado_pago": "PAGO_SIN_REGISTRAR",
        "vence_el": null,
        "precio": 11000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1jad72000buwzkx7uv0dd3",
        "turno_id": "tumv1jad51abbcm",
        "fecha": "2026-10-13",
        "hora_inicio": "20:00",
        "hora_fin": "21:00",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "profesor": {
          "id": "cmv1jad4o0004uwzkg1wadhdu",
          "n
```

#### ✅ Con turno_id de una inscripción pendiente: fila marcada

`GET /api/pagos/pendientes?alumno_id=cmv1j36h5000ouwkoutc89i6f&turno_id=tumv1jad446zg27` — sesión: mesa — 117 ms

Response `200`:

```json
{
  "data": {
    "alumno": {
      "id": "cmv1j36h5000ouwkoutc89i6f",
      "nombre_completo": "Fernández, Sofía",
      "dni": "40100001",
      "forma_pago_preferida_id": "formapago-efectivo"
    },
    "clases": [
      {
        "inscripcion_id": "cmv1j9l430009uwfoilygcdar",
        "turno_id": "tumv1j9l1s6uvy0",
        "fecha": "2026-10-12",
        "hora_inicio": "18:00",
        "hora_fin": "19:00",
        "materia": {
          "id": "cmv1j9l050000uwfolsj7cloj",
          "nombre": "Materia mv1j9ky71og7t"
        },
        "profesor": {
          "id": "cmv1j9l0x0002uwfo1brbot12",
          "nombre_completo": "prmv1j9l0s3rzty, Profesor"
        },
        "estado_pago": "RESERVADA",
        "vence_el": "2026-10-10T19:24:48-03:00",
        "precio": 12000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1jad6k0009uwzk8o20ydmm",
        "turno_id": "tumv1jad446zg27",
        "fecha": "2026-10-12",
        "hora_inicio": "20:00",
        "hora_fin": "21:00",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "profesor": {
          "id": "cmv1jad2f0002uwzkc0wmbag9",
          "nombre_completo": "prmv1jad2b3756p, Profesor"
        },
        "estado_pago": "RESERVADA",
        "vence_el": "2026-10-10T19:25:25-03:00",
        "precio": 12000,
        "origen_precio": "INSCRIPCION",
        "marcada": true
      },
      {
        "inscripcion_id": "cmv1j9l4c000buwfozo736oil",
        "turno_id": "tumv1j9l2xakgm6",
        "fecha": "2026-10-13",
        "hora_inicio": "18:00",
        "hora_fin": "19:00",
        "materia": {
          "id": "cmv1j9l050000uwfolsj7cloj",
          "nombre": "Materia mv1j9ky71og7t"
        },
        "profesor": {
          "id": "cmv1j9l2m0004uwfofsd3dz8w",
          "nombre_completo": "prmv1j9l2k7m3sh, Profesor"
        },
        "estado_pago": "PAGO_SIN_REGISTRAR",
        "vence_el": null,
        "precio": 11000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1jad72000buwzkx7uv0dd3",
        "turno_id": "tumv1jad51abbcm",
        "fecha": "2026-10-13",
        "hora_inicio": "20:00",
        "hora_fin": "21:00",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "profesor": {
          "id": "cmv1jad4o0004uwzkg1wadhdu",
          "no
```

#### ✅ Alumno inexistente

`GET /api/pagos/pendientes?alumno_id=cnoexiste0000000000000000` — sesión: mesa — 74 ms

Response `404`:

```json
{
  "data": null,
  "error": {
    "code": "ALUMNO_NO_ENCONTRADO",
    "message": "El alumno ya no existe"
  }
}
```

#### ✅ SE_INSCRIBE_AL_PAGAR (reserva vencida previa → exigeInscripcionConPago)

`GET /api/pagos/pendientes?alumno_id=cmv1jad8p000luwzk6lbk3j4p&turno_id=tumv1jad98q9xoy` — sesión: mesa — 109 ms

Response `200`:

```json
{
  "data": {
    "alumno": {
      "id": "cmv1jad8p000luwzk6lbk3j4p",
      "nombre_completo": "almv1jad8olbb70, Alumno",
      "dni": "25128022",
      "forma_pago_preferida_id": null
    },
    "clases": [
      {
        "inscripcion_id": null,
        "turno_id": "tumv1jad98q9xoy",
        "fecha": "2026-10-15",
        "hora_inicio": "20:00",
        "hora_fin": "21:00",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "profesor": {
          "id": "cmv1jad8w000muwzkbj68dmqc",
          "nombre_completo": "prmv1jad8vn61td, Profesor"
        },
        "estado_pago": "SE_INSCRIBE_AL_PAGAR",
        "vence_el": null,
        "precio": 12000,
        "origen_precio": "TARIFA_VIGENTE",
        "marcada": true
      }
    ],
    "formas_pago": [
      {
        "id": "formapago-debito",
        "nombre": "Débito"
      },
      {
        "id": "formapago-efectivo",
        "nombre": "Efectivo"
      },
      {
        "id": "formapago-mercado-pago",
        "nombre": "Mercado Pago"
      },
      {
        "id": "formapago-transferencia",
        "nombre": "Transferencia"
      }
    ]
  },
  "error": null
}
```

#### ✅ turno_id de una clase PENDIENTE

`GET /api/pagos/pendientes?alumno_id=cmv1j36h5000ouwkoutc89i6f&turno_id=tumv1jada4ureh1` — sesión: mesa — 95 ms

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "TURNO_NO_ADMITE_PAGO",
    "message": "Solo se pueden registrar pagos en turnos disponibles o completos",
    "detalles": {
      "turno_id": "tumv1jada4ureh1",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-16",
      "fecha_dia": "16/10/2026"
    }
  }
}
```

#### ✅ turno_id de una clase que ya empezó

`GET /api/pagos/pendientes?alumno_id=cmv1jad7l000fuwzkhthjvbkj&turno_id=tumv1jad88klqg8` — sesión: mesa — 66 ms

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "TURNO_YA_EMPEZO",
    "message": "La clase de Materia mv1jacv61j8db del 08/10/2026 ya empezó: el pago se hace antes de la clase.",
    "detalles": {
      "turno_id": "tumv1jad88klqg8",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-08",
      "fecha_dia": "08/10/2026"
    }
  }
}
```

#### ✅ SE_INSCRIBE con materia sin tarifa

`GET /api/pagos/pendientes?alumno_id=cmv1jadab000tuwzkan47dn4m&turno_id=tumv1jadas10cgfl` — sesión: mesa — 99 ms

Response `422`:

```json
{
  "data": null,
  "error": {
    "code": "MATERIA_SIN_TARIFA",
    "message": "Esta materia todavía no tiene tarifa. Pedile al gerente que la defina."
  }
}
```

#### ✅ alumno_id que no es CUID

`GET /api/pagos/pendientes?alumno_id=x` — sesión: mesa — 47 ms

Response `400`:

```json
{
  "data": null,
  "error": {
    "code": "VALIDACION",
    "message": "Parámetros inválidos",
    "detalles": {
      "formErrors": [],
      "fieldErrors": {
        "alumno_id": [
          "Invalid cuid"
        ]
      }
    }
  }
}
```

### 3. POST /api/pagos/operaciones — errores de §2.7.6

#### ✅ Zod: ninguna clase

`POST /api/pagos/operaciones` — sesión: mesa — 647 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `400`:

```json
{
  "data": null,
  "error": {
    "code": "VALIDACION",
    "message": "Datos inválidos",
    "detalles": {
      "formErrors": [],
      "fieldErrors": {
        "items": [
          "Elegí al menos una clase"
        ]
      }
    }
  }
}
```

#### ✅ Zod: más de 50 clases

`POST /api/pagos/operaciones` — sesión: mesa — 43 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "turno_id": "t0",
      "monto": "1"
    },
    {
      "turno_id": "t1",
      "monto": "1"
    },
    {
      "turno_id": "t2",
      "monto": "1"
    },
    {
      "turno_id": "t3",
      "monto": "1"
    },
    {
      "turno_id": "t4",
      "monto": "1"
    },
    {
      "turno_id": "t5",
      "monto": "1"
    },
    {
      "turno_id": "t6",
      "monto": "1"
    },
    {
      "turno_id": "t7",
      "monto": "1"
    },
    {
      "turno_id": "t8",
      "monto": "1"
    },
    {
      "turno_id": "t9",
      "monto": "1"
    },
    {
      "turno_id": "t10",
      "monto": "1"
    },
    {
      "turno_id": "t11",
      "monto": "1"
    },
    {
      "turno_id": "t12",
      "monto": "1"
    },
    {
      "turno_id": "t13",
      "monto": "1"
    },
    {
      "turno_id": "t14",
      "monto": "1"
    },
    {
      "turno_id": "t15",
      "monto": "1"
    },
    {
      "turno_id": "t16",
      "monto": "1"
    },
    {
      "turno_id": "t17",
      "monto": "1"
    },
    {
      "turno_id": "t18",
      "monto": "1"
    },
    {
      "turno_id": "t19",
      "monto": "1"
    },
    {
      "turno_id": "t20",
      "monto": "1"
    },
    {
      "turno_id": "t21",
      "monto": "1"
    },
    {
      "turno_id": "t22",
      "monto": "1"
    },
    {
      "turno_id": "t23",
      "monto": "1"
    },
    {
      "turno_id": "t24",
      "monto": "1"
    },
    {
      "turno_id": "t25",
      "monto": "1"
    },
    {
      "turno_id": "t26",
      "monto": "1"
    },
    {
      "turno_id": "t27",
      "monto": "1"
    },
    {
      "turno_id": "t28",
      "monto": "1"
    },
    {
      "turno_id": "t29",
      "monto": "1"
    },
    {
      "turno_id": "t30",
      "monto": "1"
    },
    {
      "turno_id": "t31",
      "monto": "1"
    },
    {
      "turno_id": "t32",
      "monto": "1"
    },
    {
      "turno_id": "t33",
      "monto": "1"
    },
    {
      "turno_id": "t34",
      "monto": "1"
    },
    {
      "turno_id": "t35",
      "monto": "1"
    },
    {
      "turno_id": "t36",
      "monto": "1"
    },
    {
      "turno_id": "t37",
      "monto": "1"
    },
    {
      "turno_id": "t38",
      "monto": "1"
    },
    {
      "turno_id": "t39",
      "monto": "1"
    },
    {
      "turno_id": "t40",
      "monto": "1"
    },
    {
      "turno_id": "t41",
      "monto": "1"
    },
    {
      "turno_id": "t42",
      "monto": "1"
    },
    {
      "turno_id": "t43",
      "monto": "1"
    },
    {
      "turno_id": "t44",
      "monto": "1"
    },
    {
      "turno_id": "t45",
      "monto": "1"
    },
    {
      "turno_id": "t46",
      "monto": "1"
    },
    {
      "turno_id": "t47",
      "monto": "1"
    },
    {
      "turno_id": "t48",
      "monto": "1"
    },
    {
      "turno_id": "t49",
      "monto": "1"
    },
    {
      "turno_id": "t50",
      "monto": "1"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `400`:

```json
{
  "data": null,
  "error": {
    "code": "VALIDACION",
    "message": "Datos inválidos",
    "detalles": {
      "formErrors": [],
      "fieldErrors": {
        "items": [
          "Too big: expected array to have <=50 items"
        ]
      }
    }
  }
}
```

#### ✅ Zod: campo extra (el precio no viaja)

`POST /api/pagos/operaciones` — sesión: mesa — 52 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000",
      "precio": 12000
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `400`:

```json
{
  "data": null,
  "error": {
    "code": "VALIDACION",
    "message": "Datos inválidos",
    "detalles": {
      "formErrors": [],
      "fieldErrors": {
        "items": [
          "Unrecognized key: \"precio\""
        ]
      }
    }
  }
}
```

#### ✅ ALUMNO_NO_ENCONTRADO

`POST /api/pagos/operaciones` — sesión: mesa — 83 ms

Request body:

```json
{
  "alumno_id": "cnoexiste0000000000000000",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `404`:

```json
{
  "data": null,
  "error": {
    "code": "ALUMNO_NO_ENCONTRADO",
    "message": "El alumno ya no existe"
  }
}
```

#### ✅ INSCRIPCION_NO_ENCONTRADA

`POST /api/pagos/operaciones` — sesión: mesa — 95 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cnoexiste0000000000000000",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `404`:

```json
{
  "data": null,
  "error": {
    "code": "INSCRIPCION_NO_ENCONTRADA",
    "message": "No se encontró la inscripción.",
    "detalles": {
      "turno_id": null
    }
  }
}
```

#### ✅ TURNO_NO_ENCONTRADO

`POST /api/pagos/operaciones` — sesión: mesa — 86 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "turno_id": "turno-inexistente",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `404`:

```json
{
  "data": null,
  "error": {
    "code": "TURNO_NO_ENCONTRADO",
    "message": "No se encontró el turno",
    "detalles": {
      "turno_id": "turno-inexistente"
    }
  }
}
```

#### ✅ FORMA_PAGO_NO_ENCONTRADA

`POST /api/pagos/operaciones` — sesión: mesa — 137 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "cnoexiste0000000000000000"
}
```

Response `404`:

```json
{
  "data": null,
  "error": {
    "code": "FORMA_PAGO_NO_ENCONTRADA",
    "message": "No se encontró la forma de pago"
  }
}
```

#### ✅ TURNO_NO_ADMITE_PAGO (clase PENDIENTE)

`POST /api/pagos/operaciones` — sesión: mesa — 95 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "turno_id": "tumv1jada4ureh1",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "TURNO_NO_ADMITE_PAGO",
    "message": "Solo se pueden registrar pagos en turnos disponibles o completos",
    "detalles": {
      "turno_id": "tumv1jada4ureh1",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-16",
      "fecha_dia": "16/10/2026"
    }
  }
}
```

#### ✅ ALUMNO_NO_INSCRIPTO (inscripción de otro alumno)

`POST /api/pagos/operaciones` — sesión: mesa — 94 ms

Request body:

```json
{
  "alumno_id": "cmv1jad7l000fuwzkhthjvbkj",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "ALUMNO_NO_INSCRIPTO",
    "message": "El alumno no está inscripto en este turno",
    "detalles": {
      "turno_id": "tumv1jad5sen5rf",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-14",
      "fecha_dia": "14/10/2026"
    }
  }
}
```

#### ✅ TURNO_YA_EMPEZO

`POST /api/pagos/operaciones` — sesión: mesa — 91 ms

Request body:

```json
{
  "alumno_id": "cmv1jad7l000fuwzkhthjvbkj",
  "items": [
    {
      "inscripcion_id": "cmv1jad8h000juwzkvc8f3eed",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "TURNO_YA_EMPEZO",
    "message": "La clase de Materia mv1jacv61j8db del 08/10/2026 ya empezó: el pago se hace antes de la clase.",
    "detalles": {
      "turno_id": "tumv1jad88klqg8",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-08",
      "fecha_dia": "08/10/2026"
    }
  }
}
```

#### ✅ RESERVA_VENCIDA

`POST /api/pagos/operaciones` — sesión: mesa — 110 ms

Request body:

```json
{
  "alumno_id": "cmv1jad8p000luwzk6lbk3j4p",
  "items": [
    {
      "inscripcion_id": "cmv1jad9l000puwzkcnit1asr",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "RESERVA_VENCIDA",
    "message": "La reserva venció. Inscribí al alumno de nuevo si todavía hay cupo.",
    "detalles": {
      "turno_id": "tumv1jad98q9xoy",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-15",
      "fecha_dia": "15/10/2026"
    }
  }
}
```

#### ✅ MOTIVO_AJUSTE_REQUERIDO (con detalles.precio_vigente)

`POST /api/pagos/operaciones` — sesión: mesa — 112 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "9000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `400`:

```json
{
  "data": null,
  "error": {
    "code": "MOTIVO_AJUSTE_REQUERIDO",
    "message": "El monto es distinto del precio de la clase: ingresá el motivo del ajuste.",
    "detalles": {
      "turno_id": "tumv1jad5sen5rf",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-14",
      "fecha_dia": "14/10/2026",
      "precio_vigente": 12000
    }
  }
}
```

#### ✅ FECHA_PAGO_FUTURA

`POST /api/pagos/operaciones` — sesión: mesa — 101 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo",
  "fecha_pago": "2026-10-10"
}
```

Response `400`:

```json
{
  "data": null,
  "error": {
    "code": "FECHA_PAGO_FUTURA",
    "message": "La fecha de pago no puede ser futura"
  }
}
```

#### ✅ FORMA_PAGO_NO_DISPONIBLE (forma inactiva)

`POST /api/pagos/operaciones` — sesión: mesa — 143 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "cmv1jadlm001uuwzkejnb6wc0"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "FORMA_PAGO_NO_DISPONIBLE",
    "message": "La forma de pago ya no está disponible"
  }
}
```

#### ✅ CAJA_NO_ABIERTA (mesa.entrada2 con la caja cerrada)

`POST /api/pagos/operaciones` — sesión: mesa2 — 209 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "CAJA_NO_ABIERTA",
    "message": "No se puede registrar un cobro hasta que abras una caja."
  }
}
```

#### ✅ CUPO_INSUFICIENTE («Se inscribe al confirmar el pago» en clase llena)

`POST /api/pagos/operaciones` — sesión: mesa — 145 ms

Request body:

```json
{
  "alumno_id": "cmv1jadcg0015uwzkvf1xkbs7",
  "items": [
    {
      "turno_id": "tumv1jadcx1cz5xg",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "CUPO_INSUFICIENTE",
    "message": "El turno alcanzó su cupo máximo",
    "detalles": {
      "turno_id": "tumv1jadcx1cz5xg",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-19",
      "fecha_dia": "19/10/2026"
    }
  }
}
```

#### ✅ ALUMNO_NO_DISPONIBLE («Se inscribe…» superpuesta con otra clase del alumno)

`POST /api/pagos/operaciones` — sesión: mesa — 176 ms

Request body:

```json
{
  "alumno_id": "cmv1jaddy001fuwzk6ofxo96i",
  "items": [
    {
      "turno_id": "tumv1jadeg1k1rr3",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "ALUMNO_NO_DISPONIBLE",
    "message": "El alumno ya tiene un turno agendado en ese horario",
    "detalles": {
      "turno_id": "tumv1jadeg1k1rr3",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-20",
      "fecha_dia": "20/10/2026",
      "alumno_id": "cmv1jaddy001fuwzk6ofxo96i"
    }
  }
}
```

#### ✅ ALUMNO_INACTIVO («Se inscribe…» con alumno inactivo)

`POST /api/pagos/operaciones` — sesión: mesa — 134 ms

Request body:

```json
{
  "alumno_id": "cmv1jadbc000zuwzk2u73qwkc",
  "items": [
    {
      "turno_id": "tumv1jadbr16znpg",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "ALUMNO_INACTIVO",
    "message": "La ficha del alumno está inactiva",
    "detalles": {
      "turno_id": "tumv1jadbr16znpg",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-18",
      "fecha_dia": "18/10/2026"
    }
  }
}
```

#### ✅ MATERIA_SIN_TARIFA («Se inscribe…» en materia sin tarifa)

`POST /api/pagos/operaciones` — sesión: mesa — 133 ms

Request body:

```json
{
  "alumno_id": "cmv1jadab000tuwzkan47dn4m",
  "items": [
    {
      "turno_id": "tumv1jadas10cgfl",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `422`:

```json
{
  "data": null,
  "error": {
    "code": "MATERIA_SIN_TARIFA",
    "message": "Esta materia todavía no tiene tarifa. Pedile al gerente que la defina.",
    "detalles": {
      "turno_id": "tumv1jadas10cgfl",
      "materia": "Materia mv1jad1q2tm70",
      "fecha": "2026-10-17",
      "fecha_dia": "17/10/2026"
    }
  }
}
```

> Para el caso siguiente, otra conexión tiene `SELECT 1 FROM "alumnos" WHERE "idAlumno" = 'cmv1jadj7001puwzkwh8y5m6c' FOR UPDATE` abierto durante el request.

#### ✅ TRANSACCION_OCUPADA (fila del alumno bloqueada por otra transacción)

`POST /api/pagos/operaciones` — sesión: mesa — 5099 ms

Request body:

```json
{
  "alumno_id": "cmv1jadj7001puwzkwh8y5m6c",
  "items": [
    {
      "inscripcion_id": "cmv1jadl9001tuwzkbimgc5jm",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "TRANSACCION_OCUPADA",
    "message": "Otra persona está modificando estos datos. Intentá de nuevo."
  }
}
```

### 4. POST /api/pagos/operaciones — camino feliz

#### ✅ Una operación con dos clases (una con importe ajustado y motivo)

`POST /api/pagos/operaciones` — sesión: mesa — 293 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad6k0009uwzk8o20ydmm",
      "monto": "12000"
    },
    {
      "inscripcion_id": "cmv1jad72000buwzkx7uv0dd3",
      "monto": "10000",
      "motivo_ajuste": "Beca"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `201`:

```json
{
  "data": {
    "operacion_id": "cmv1jcnc00004uwkkj63g02p7",
    "alumno": {
      "id": "cmv1j36h5000ouwkoutc89i6f",
      "nombre_completo": "Fernández, Sofía"
    },
    "forma_pago": {
      "id": "formapago-efectivo",
      "nombre": "Efectivo"
    },
    "fecha_pago": "2026-10-09",
    "total": "22000.00",
    "pagos": [
      {
        "id": "cmv1jcnc60006uwkkq50dbgt3",
        "turno_id": "tumv1jad446zg27",
        "inscripcion_id": "cmv1jad6k0009uwzk8o20ydmm",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "fecha": "2026-10-12",
        "hora_inicio": "20:00",
        "precio": 12000,
        "monto": "12000.00",
        "motivo_ajuste": null
      },
      {
        "id": "cmv1jcncy0008uwkkuae6d2of",
        "turno_id": "tumv1jad51abbcm",
        "inscripcion_id": "cmv1jad72000buwzkx7uv0dd3",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "fecha": "2026-10-13",
        "hora_inicio": "20:00",
        "precio": 11000,
        "monto": "10000.00",
        "motivo_ajuste": "Beca"
      }
    ],
    "comprobante": {
      "id": "cmv1jcnet000auwkk7ps9ggry",
      "numero": "0001-00000025"
    }
  },
  "error": null
}
```

#### ✅ INSCRIPCION_YA_PAGADA (cobrar de nuevo la misma clase)

`POST /api/pagos/operaciones` — sesión: mesa — 98 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad6k0009uwzk8o20ydmm",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `409`:

```json
{
  "data": null,
  "error": {
    "code": "INSCRIPCION_YA_PAGADA",
    "message": "Esta clase ya tiene un pago registrado.",
    "detalles": {
      "turno_id": "tumv1jad446zg27",
      "materia": "Materia mv1jacv61j8db",
      "fecha": "2026-10-12",
      "fecha_dia": "12/10/2026"
    }
  }
}
```

#### ✅ «Se inscribe al confirmar el pago» (turno_id, tarifa vigente)

`POST /api/pagos/operaciones` — sesión: mesa — 240 ms

Request body:

```json
{
  "alumno_id": "cmv1jad8p000luwzk6lbk3j4p",
  "items": [
    {
      "turno_id": "tumv1jad98q9xoy",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `201`:

```json
{
  "data": {
    "operacion_id": "cmv1jcnnb000euwkkkc1gunag",
    "alumno": {
      "id": "cmv1jad8p000luwzk6lbk3j4p",
      "nombre_completo": "almv1jad8olbb70, Alumno"
    },
    "forma_pago": {
      "id": "formapago-efectivo",
      "nombre": "Efectivo"
    },
    "fecha_pago": "2026-10-09",
    "total": "12000.00",
    "pagos": [
      {
        "id": "cmv1jcnne000guwkkzsjgca6w",
        "turno_id": "tumv1jad98q9xoy",
        "inscripcion_id": "cmv1jcnmq000cuwkk897fhcbb",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "fecha": "2026-10-15",
        "hora_inicio": "20:00",
        "precio": 12000,
        "monto": "12000.00",
        "motivo_ajuste": null
      }
    ],
    "comprobante": {
      "id": "cmv1jcnob000iuwkk2agyprzj",
      "numero": "0001-00000026"
    }
  },
  "error": null
}
```

#### ✅ Pendientes después del cobro: solo queda la clase no elegida

`GET /api/pagos/pendientes?alumno_id=cmv1j36h5000ouwkoutc89i6f` — sesión: mesa — 73 ms

Response `200`:

```json
{
  "data": {
    "alumno": {
      "id": "cmv1j36h5000ouwkoutc89i6f",
      "nombre_completo": "Fernández, Sofía",
      "dni": "40100001",
      "forma_pago_preferida_id": "formapago-efectivo"
    },
    "clases": [
      {
        "inscripcion_id": "cmv1j9l430009uwfoilygcdar",
        "turno_id": "tumv1j9l1s6uvy0",
        "fecha": "2026-10-12",
        "hora_inicio": "18:00",
        "hora_fin": "19:00",
        "materia": {
          "id": "cmv1j9l050000uwfolsj7cloj",
          "nombre": "Materia mv1j9ky71og7t"
        },
        "profesor": {
          "id": "cmv1j9l0x0002uwfo1brbot12",
          "nombre_completo": "prmv1j9l0s3rzty, Profesor"
        },
        "estado_pago": "RESERVADA",
        "vence_el": "2026-10-10T19:24:48-03:00",
        "precio": 12000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1j9l4c000buwfozo736oil",
        "turno_id": "tumv1j9l2xakgm6",
        "fecha": "2026-10-13",
        "hora_inicio": "18:00",
        "hora_fin": "19:00",
        "materia": {
          "id": "cmv1j9l050000uwfolsj7cloj",
          "nombre": "Materia mv1j9ky71og7t"
        },
        "profesor": {
          "id": "cmv1j9l2m0004uwfofsd3dz8w",
          "nombre_completo": "prmv1j9l2k7m3sh, Profesor"
        },
        "estado_pago": "PAGO_SIN_REGISTRAR",
        "vence_el": null,
        "precio": 11000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1j9l4j000duwfopnxvh9tn",
        "turno_id": "tumv1j9l3levh4h",
        "fecha": "2026-10-14",
        "hora_inicio": "18:00",
        "hora_fin": "19:00",
        "materia": {
          "id": "cmv1j9l050000uwfolsj7cloj",
          "nombre": "Materia mv1j9ky71og7t"
        },
        "profesor": {
          "id": "cmv1j9l380006uwforlid234l",
          "nombre_completo": "prmv1j9l36b2a9p, Profesor"
        },
        "estado_pago": "PAGO_SIN_REGISTRAR",
        "vence_el": null,
        "precio": 12000,
        "origen_precio": "INSCRIPCION",
        "marcada": false
      },
      {
        "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
        "turno_id": "tumv1jad5sen5rf",
        "fecha": "2026-10-14",
        "hora_inicio": "20:00",
        "hora_fin": "21:00",
        "materia": {
          "id": "cmv1jad1g0000uwzkpd915ien",
          "nombre": "Materia mv1jacv61j8db"
        },
        "profesor": {
          "id": "cmv1jad5b0006uwzk9xs1uug5",
          "nombre_completo
```

### 5. Gerente (sin pagos:crear)

#### ✅ GET buscar-alumnos como Gerente

`GET /api/pagos/buscar-alumnos?q=fe` — sesión: gerente — 47 ms

Response `403`:

```json
{
  "data": null,
  "error": {
    "code": "SIN_PERMISO",
    "message": "No tenés permisos para acceder a esta sección"
  }
}
```

#### ✅ GET pendientes como Gerente

`GET /api/pagos/pendientes?alumno_id=cmv1j36h5000ouwkoutc89i6f` — sesión: gerente — 46 ms

Response `403`:

```json
{
  "data": null,
  "error": {
    "code": "SIN_PERMISO",
    "message": "No tenés permisos para acceder a esta sección"
  }
}
```

#### ✅ POST operaciones como Gerente

`POST /api/pagos/operaciones` — sesión: gerente — 57 ms

Request body:

```json
{
  "alumno_id": "cmv1j36h5000ouwkoutc89i6f",
  "items": [
    {
      "inscripcion_id": "cmv1jad7a000duwzkxcx5utxa",
      "monto": "12000"
    }
  ],
  "forma_pago_id": "formapago-efectivo"
}
```

Response `403`:

```json
{
  "data": null,
  "error": {
    "code": "SIN_PERMISO",
    "message": "No tenés permisos para acceder a esta sección"
  }
}
```

### 6. Capa de datos del camino feliz (consulta directa a la base descartable)

```json
{
  "operacion": {
    "id": "cmv1jcnc00004uwkkj63g02p7",
    "alumnoId": "cmv1j36h5000ouwkoutc89i6f",
    "cajaId": "cmv1j39jg008suwkob1eticzv"
  },
  "pagos": [
    {
      "inscripcionId": "cmv1jad6k0009uwzk8o20ydmm",
      "operacionId": "cmv1jcnc00004uwkkj63g02p7",
      "precio": 12000,
      "montoPago": "12000.00",
      "motivoAjuste": null,
      "ajustadoPorUsuarioId": null
    },
    {
      "inscripcionId": "cmv1jad72000buwzkx7uv0dd3",
      "operacionId": "cmv1jcnc00004uwkkj63g02p7",
      "precio": 11000,
      "montoPago": "10000.00",
      "motivoAjuste": "Beca",
      "ajustadoPorUsuarioId": "cmv1j366d0000uwkohtm5bsf6"
    }
  ],
  "inscripciones": [
    {
      "idInscripcion": "cmv1jad7a000duwzkxcx5utxa",
      "estadoPago": "PAGO_SIN_REGISTRAR"
    },
    {
      "idInscripcion": "cmv1jad6k0009uwzk8o20ydmm",
      "estadoPago": "PAGADA"
    },
    {
      "idInscripcion": "cmv1jad72000buwzkx7uv0dd3",
      "estadoPago": "PAGADA"
    }
  ],
  "comprobantes": [
    {
      "idComprobante": "cmv1jcnet000auwkk7ps9ggry",
      "operacionId": "cmv1jcnc00004uwkkj63g02p7"
    }
  ],
  "inscripcion_creada_al_pagar": {
    "vigencia": "VIGENTE",
    "estadoPago": "PAGADA",
    "precio": 12000
  }
}
```

## Nivel 3 — Capa de datos

Lo que se miraría en TablePlus quedó comprobado de dos formas: automatizado en `pago.operacion.pg.test.ts` (una `OperacionPago`, dos `Pago` con el mismo `operacionId`, inscripciones `PAGADA`, un `Comprobante`; `motivoAjuste` y `ajustadoPor`; inscripción creada ya `PAGADA` con la tarifa vigente; todo o nada) y con la consulta directa del final del Nivel 2 (sección 6). Las capturas de UI de los 3 pasos y del error inline del paso 3 quedan pendientes (ver Entorno).
