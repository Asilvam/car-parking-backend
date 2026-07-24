# Minuto — Backend

API para administrar entradas, salidas y cobros de un estacionamiento por
minuto. Está construida con NestJS, TypeScript, Mongoose y MongoDB.

## Tecnologías

- NestJS 10
- TypeScript
- MongoDB
- Mongoose
- `@nestjs/config` y `ConfigService`
- Jest

## Reglas del negocio

- Las patentes se normalizan a mayúsculas y sin separadores.
- Una patente no puede tener más de una estadía activa.
- Se cobra como mínimo un minuto.
- Cada fracción se redondea al minuto siguiente.
- La tarifa aplicada queda guardada en la estadía para conservar el valor
  histórico aunque la tarifa general cambie.
- La salida registra el total, la duración y el medio de pago.
- Los medios de pago admitidos son `cash`, `debit`, `credit` y `transfer`.
- El operador puede registrar manualmente una salida sin pago.
- Las evasiones generan deuda pendiente y no se suman a la recaudación.
- Los ingresos se permiten solo dentro del horario operativo configurado
  (`PARKING_OPEN_TIME` <= hora local de Chile < `PARKING_CLOSE_TIME`).
- Fuera del horario operativo se bloquean nuevas entradas, pero los cobros y
  salidas sin pago siguen habilitados para cerrar vehículos que ya estaban
  dentro.
- A la hora de auto cierre (`PARKING_AUTO_EVASION_TIME`) todo vehículo activo
  se cierra automáticamente como evasión.
- En la evasión automática, el tiempo y la deuda se calculan desde la entrada
  hasta la hora de cierre de cobros (`PARKING_CLOSE_TIME`) del mismo día.
- Existe un lugar principal compartido por todos los operadores. Cada estadía,
  consulta y auditoría queda asociada a ese lugar.
- Una patente solo puede tener una estadía activa por lugar, pero puede volver
  a ingresar después de finalizar la anterior.

## Logs y auditoría

El sistema mantiene dos capas separadas:

- Logs técnicos estructurados solamente para respuestas HTTP fallidas. Las
  lecturas y operaciones exitosas no se imprimen para evitar ruido redundante.
  Cada error incluye `requestId`, método, ruta, estado y duración en una sola
  línea JSON, sin parámetros de consulta.
- Auditoría de negocio persistida en la colección MongoDB `audit_logs` para
  entradas, cobros, evasiones y operaciones rechazadas.

Cada auditoría guarda actor, entidad, resumen, metadata del cobro, IP, agente de
usuario y `requestId`. Las fechas de MongoDB permanecen en UTC y los logs de
consola usan `America/Santiago`. La colección tiene índices por fecha, acción,
`requestId` y entidad.

La auditoría es tolerante a fallos: si no puede escribir un evento, registra el
error técnico sin revertir una entrada o un cobro que ya se completó. No existe
un endpoint público para consultar auditorías; debe agregarse detrás de
autenticación administrativa.

La implementación completa y las decisiones tomadas están documentadas en
[`docs/logging-y-auditoria.md`](docs/logging-y-auditoria.md).

## Fechas y zona horaria

MongoDB almacena `entryTime`, `exitTime`, `paidAt`, `createdAt` y `updatedAt`
como fechas UTC. Los logs se formatean siempre con `America/Santiago` y respetan
automáticamente los cambios de horario de verano de Chile.

Ejemplo durante el invierno chileno:

```text
MongoDB: 2026-07-21T12:30:00.000Z
Chile:   21-07-2026 08:30:00
```

## Requisitos

- Node.js 22, indicado en `.nvmrc`.
- MongoDB local o una instancia de MongoDB Atlas.

## Instalación

```bash
npm install
cp .env.example .env
```

## Variables de entorno

Todas las variables se leen mediante `ConfigService`.

| Variable                   | Obligatoria | Valor predeterminado    | Descripción                                  |
| -------------------------- | ----------- | ----------------------- | -------------------------------------------- |
| `MONGODB_URI`              | Sí          | —                       | Cadena de conexión de MongoDB                |
| `MONGODB_DB`               | No          | `CarParking`            | Nombre de la base de datos                   |
| `PORT`                     | No          | `3001`                  | Puerto HTTP del backend                      |
| `FRONTEND_URL`             | No          | `http://localhost:3000` | Origen permitido por CORS                    |
| `RATE_PER_MINUTE`          | Sí          | —                       | Tarifa CLP por minuto del lugar              |
| `PARKING_LOCATION_CODE`    | Sí          | —                       | Código estable, por ejemplo `STRIPCENTER`     |
| `PARKING_LOCATION_NAME`    | Sí          | —                       | Nombre visible para los operadores           |
| `PARKING_LOCATION_ADDRESS` | No          | —                       | Dirección visible del estacionamiento        |
| `PARKING_OPEN_TIME`        | Sí          | —                       | Hora de apertura para ingresos (`HH:mm`)     |
| `PARKING_CLOSE_TIME`       | Sí          | —                       | Hora de cierre para ingresos (`HH:mm`)       |
| `PARKING_AUTO_EVASION_TIME`| Sí          | —                       | Hora de cierre automático por evasión (`HH:mm`) |
| `ADMIN_PANEL_PASSWORD`     | Sí          | —                       | Clave simple para autenticación del panel admin |

La aplicación falla al iniciar cuando `MONGODB_URI` no está configurada o
cuando `RATE_PER_MINUTE` falta, no es numérica o no es mayor que cero. Después
de cambiar la tarifa se debe reiniciar el backend. El nuevo valor se aplica a
las entradas posteriores; las estadías ya abiertas conservan su tarifa original.
El lugar configurado se crea o actualiza automáticamente en la colección
`parking_locations`. Los movimientos anteriores se migran al lugar principal
sin modificar sus montos ni horarios.

Los horarios deben venir en formato `HH:mm` (24 horas) y cumplir este orden:
`PARKING_OPEN_TIME < PARKING_CLOSE_TIME < PARKING_AUTO_EVASION_TIME`.
Todas las validaciones de horario usan `America/Santiago`.

## Ejecución

```bash
# Desarrollo con recarga automática
npm run start:dev

# Compilación
npm run build

# Producción después de compilar
npm run start:prod
```

Con el `.env.example`, la API queda disponible en `http://localhost:3500`.

## API

### Registrar entrada

```http
POST /parking/entry
Content-Type: application/json

{
  "vehicleNumber": "ABCD12"
}
```

Si el ingreso se intenta fuera del horario operativo, el endpoint devuelve
`400 Bad Request`.

### Registrar cobro y salida

```http
POST /parking/exit
Content-Type: application/json

{
  "vehicleNumber": "ABCD12",
  "paymentMethod": "debit"
}
```

Este endpoint se mantiene disponible fuera del horario de ingresos para cerrar
operaciones pendientes.

### Consultas

- `GET /parking?status=active` — estadías activas.
- `GET /parking?status=completed` — últimas estadías cobradas.
- `GET /parking?status=evaded` — últimas salidas sin pago.
- `GET /parking/summary/today` — resumen diario de caja.
- `GET /parking/config` — tarifa y moneda configuradas.
- `GET /locations/current` — lugar compartido por la aplicación.

### Administración y reportes

Endpoints protegidos por sesión administrativa (`x-admin-session`):

- `POST /admin/auth/login` — inicia sesión con clave simple (`ADMIN_PANEL_PASSWORD`).
- `POST /admin/auth/logout` — cierra sesión admin.
- `GET /admin/reports/parking-summary` — resumen + movimientos recientes con filtros.
- `GET /admin/reports/parking.xlsx` — exporta Excel con hojas `Movimientos` y `Resumen`.

Filtros soportados para resumen y exportación:

- `preset=day|week|month|range`
- `date=YYYY-MM-DD` para `day`, `week`, `month`
- `from=YYYY-MM-DD&to=YYYY-MM-DD` para `range`
- `status=all|active|completed|evaded`
- `paymentMethod=all|cash|debit|credit|transfer`
- `vehicleNumber=ABCD12`

La semana se calcula con criterio Chile de lunes a domingo.

### Registrar salida sin pago

```http
POST /parking/evasion
Content-Type: application/json

{
  "vehicleNumber": "ABCD12",
  "reasonCode": "left-without-payment",
  "observation": "Salida sin pago observada por el operador"
}
```

Este endpoint se mantiene disponible fuera del horario de ingresos para cerrar
operaciones pendientes.

Motivos permitidos: `left-without-payment`, `payment-refused`,
`operator-record-correction`, `unknown` y `other`.

## Estructura principal

```text
src/
├── common/logging/  # Logs con horario de Chile
├── database/        # Conexión MongoDB mediante ConfigService
├── location/        # Lugar principal y tarifa configurada
├── parking/         # Esquema, cobro, servicio y controlador
├── user/            # Base del módulo de usuarios
├── app.module.ts
└── main.ts
```

## Calidad

```bash
# Pruebas unitarias
npm test -- --runInBand

# Cobertura
npm run test:cov

# Formato
npm run format

# Lint
npm run lint
```

Las pruebas cubren la normalización de patentes, el redondeo del cobro y la
conversión de horario de Chile en invierno y verano.

## Deploy en Heroku

Este backend está preparado para deploy en Heroku con:

- `Procfile` (`web: npm run start:prod`)
- `runtime.txt` (Node.js 22)

Pasos recomendados:

1. Crear app en Heroku:

   ```bash
   heroku create car-parking-backend
   ```

2. Configurar variables obligatorias:

   ```bash
   heroku config:set \
     MONGODB_URI="<mongodb-uri>" \
     MONGODB_DB="CarParking" \
     FRONTEND_URL="https://<tu-proyecto>.pages.dev" \
     RATE_PER_MINUTE="40" \
     PARKING_LOCATION_CODE="STRIPCENTER" \
     PARKING_LOCATION_NAME="Stripcenter" \
     PARKING_LOCATION_ADDRESS="Avenida Normandie s/n" \
     PARKING_OPEN_TIME="08:00" \
     PARKING_CLOSE_TIME="20:00" \
     PARKING_AUTO_EVASION_TIME="21:00" \
     ADMIN_PANEL_PASSWORD="<clave-admin>"
   ```

3. Publicar:

   ```bash
   git push heroku main
   ```

4. Ver logs:

   ```bash
   heroku logs --tail
   ```

Notas:

- Heroku inyecta `PORT` automáticamente; no lo fijes manualmente.
- El frontend en Cloudflare Pages debe usar `VITE_API_URL` con la URL Heroku.
