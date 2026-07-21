# Minuto — Backend

API NestJS y MongoDB para registrar entradas y cobrar estacionamientos por
minuto.

## Funciones del MVP

- Normalización y validación de patentes.
- Una sola estadía activa por vehículo.
- Cobro por minuto con redondeo hacia arriba y mínimo de un minuto.
- Tarifa aplicada guardada en cada estadía.
- Registro del medio de pago.
- Resumen de caja diario.
- Logs fechados siempre con la zona horaria `America/Santiago`, incluyendo los
  cambios automáticos de horario de verano de Chile.

## Configuración

```bash
cp .env.example .env
npm install
npm run start:dev
```

La API queda disponible en `http://localhost:3001`. La tarifa predeterminada es
`30` CLP por minuto y se puede cambiar con `RATE_PER_MINUTE`.

Todas las variables de entorno se leen mediante `ConfigService`. La aplicación
falla al iniciar si `MONGODB_URI` no está configurada; `MONGODB_DB` usa
`CarParking` como valor predeterminado.

## Endpoints

- `POST /parking/entry` — body: `{ "vehicleNumber": "ABCD12" }`
- `POST /parking/exit` — body: `{ "vehicleNumber": "ABCD12", "paymentMethod": "cash" }`
- `GET /parking?status=active`
- `GET /parking?status=completed`
- `GET /parking/summary/today`
- `GET /parking/config`

Medios de pago: `cash`, `debit`, `credit` y `transfer`.

## Verificación

```bash
npm run build
npm test -- --runInBand
```
