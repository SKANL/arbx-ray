# ArbX-Ray: Public-API Bitcoin Arbitrage Execution Lab

**ArbX-Ray** es un laboratorio full-stack de arbitraje Bitcoin con datos públicos reales. No coloca órdenes, no usa llaves privadas y no requiere tarjeta de crédito. La app reconstruye libros L2 de exchanges, cruza fuentes públicas y simula si un spread aparente puede ejecutarse después de profundidad, fees, slippage, latencia, inventario y riesgo de settlement.

El objetivo del proyecto es demostrar ejecución realista, no solo mostrar `best_bid - best_ask`.

## How to judge this project in 90 seconds

1. Abre la app desplegada y pulsa **Live feeds** para conectar WebSockets públicos y snapshots REST.
2. Revisa **Command route / Best Route** para ver la oportunidad actual o la razón exacta por la que no se ejecuta.
3. Abre **Backend Evidence** para verificar `/api/health`, `/api/backend-manifest` y la capa backend serverless.
4. Si el mercado live está quieto o un exchange público falla, pulsa **Replay**: carga una decisión determinística con fills, fees, wallets y P&L.
5. Abre **Judge Proof Board** para ver la matriz de criterios, evidencia y ruta de demo para jurado.

Si un exchange público falla, el sistema no lo oculta: lo reporta por venue, conserva la evidencia disponible y permite replay determinístico. La demo no depende de prometer una oportunidad rentable live justo en el momento de evaluación.

## Contrato full-stack

ArbX-Ray no es una pantalla estática. Es una aplicación Next.js full-stack:

- **Frontend:** cockpit interactivo, Web Worker, Zustand, IndexedDB, replay y visualización quant.
- **Backend:** Route Handlers bajo `src/app/api`, usados como BFF serverless para snapshots, agregación, fallback CORS-resilient, manifiesto técnico y evidencia de salud.
- **Datos:** APIs públicas sin registro, sin secretos y sin acciones reales de compra/venta.
- **Deployment:** una sola app en Vercel Hobby; no requiere Railway, Render, base de datos ni worker always-on.

## Capturas de pantalla

### Cockpit principal

![Cockpit principal](public/screenshots/01-cockpit.png)

### Evidencia backend full-stack

![Backend Evidence](public/screenshots/02-backend-evidence.png)

### Market Map y liquidez global

![Market Map](public/screenshots/03-market-map.png)

### Quant Lab

![Quant Lab](public/screenshots/04-quant-lab.png)

### Vista móvil

![Vista móvil](public/screenshots/05-mobile.png)

## Stack tecnológico

- **Framework:** Next.js 16, React 19, TypeScript
- **UI:** Tailwind CSS 4, componentes estilo shadcn/ui, lucide-react
- **Estado:** Zustand
- **Motor live:** Web Worker en navegador
- **Persistencia local:** IndexedDB con `idb`
- **Backend:** Next.js Route Handlers bajo `src/app/api`
- **Testing:** Vitest, TypeScript typecheck, Next production build
- **Deploy recomendado:** Vercel Hobby
- **Credenciales:** ninguna API key privada, ningún exchange account, ningún pago real

## Arquitectura

```text
Browser cockpit + Web Worker + IndexedDB
        |
        | fetch /api/*
        v
Next.js Route Handlers backend on Vercel Hobby
        |
        | no private keys, no real orders, cache: no-store where live data matters
        v
Public market APIs: exchanges, status pages, mempool, CoinGecko, Deribit, Bitso
```

El frontend abre feeds live cuando el navegador lo permite. El backend funciona como BFF/serverless para snapshots, agregación pública, fallback CORS-resilient, manifiesto técnico y evidencia full-stack.

### Frontend

- Cockpit-first dashboard con Mission Control, Execution Mode Bar, proof command palette y vistas de juez.
- Web Worker para mantener order books, evaluar oportunidades y no bloquear la UI.
- IndexedDB para journal local, replay y evidencia sin base de datos obligatoria.
- Componentes reutilizables para fórmulas, empty states, charts, badges y paneles.

### Backend

- `GET /api/health` resume readiness, módulos backend, fuentes públicas y estado keyless.
- `GET /api/backend-manifest` documenta endpoints, fuentes públicas, fallback policy y `requiresApiKey=false`.
- Route Handlers consultan APIs públicas con `cache: "no-store"` cuando los datos son dinámicos.
- Los proxies usan URLs hardcodeadas por módulo; no aceptan URLs controladas por usuario.

## Qué hace

- Conecta venues BTC/USD, BTC/USDT y México BTC/MXN sin mezclar lanes de forma ingenua.
- Normaliza feeds públicos a un formato común de order book.
- Simula arbitraje dirigido: comprar en el ask ejecutable más barato y vender en el bid ejecutable más alto.
- Camina niveles L2 para calcular VWAP, fill parcial, slippage y depth consumed.
- Resta fees, rebalance/withdrawal cost, haircut de latencia, basis USD/USDT e inventario.
- Mantiene wallets prefundadas simuladas por venue.
- Rechaza rutas con razones explícitas: stale book, liquidez insuficiente, inventario insuficiente, P&L negativo, latencia excesiva, lane risk o circuit breaker.
- Incluye replay determinístico para demos cuando el mercado live está quieto o un feed falla.
- Expone fórmulas legibles y auditables para los modelos quant.

## Diferenciadores técnicos

- **Execution realism:** no confía solo en top-of-book; camina profundidad y calcula net P&L.
- **Backend Evidence:** prueba que la entrega incluye frontend + backend con Route Handlers reales.
- **Venue Connection Lab:** muestra endpoint, canal, latencia, fallback, errores y estado por venue.
- **Quant Lab:** microprice, queue position, Hawkes flow, latency alpha, mirage detector, optimal stopping y lead-lag.
- **Market Map:** liquidez global, price consensus, USDT basis, smart order routing, reliability oracle y arbitrage graph.
- **Mexico Corridor:** cruza Bitso BTC/MXN, Bitso USD/MXN y Coinbase BTC/USD para contexto nacional.
- **Historical Replay:** backtest/replay con políticas, heatmap, walk-forward, conformal guard y tournament.

## Mapa de pruebas para jueces

| Criterio | Dónde se demuestra |
| --- | --- |
| Frontend funcional | Cockpit, Live Exchange Matrix, Command route, Replay & Risk |
| Backend real | Backend Evidence, `/api/health`, `/api/backend-manifest` |
| Datos públicos live | Live feeds, Venue Connection Lab, Market Map |
| Simulación realista | Best Route, Execution Depth, P&L waterfall, wallets simuladas |
| Matemática/quant | Quant Lab, Queue Position, Hawkes Flow, Latency Alpha, Mirage Detector |
| Riesgo y robustez | Risk Governor, Settlement Risk, Venue Failure War Game |
| Contexto México | Mexico Corridor con Bitso BTC/MXN y USD/MXN |
| Historia y validación | Historical Replay, Walk-Forward, Conformal Guard, Tournament |

## Modelos y módulos destacados

- **Gross-to-net execution:** spread bruto menos fees, slippage, rebalance cost, latency haircut, basis haircut e inventario.
- **Execution Depth Lens:** niveles caminados, VWAP, liquidez consumida y fill parcial por pierna.
- **Smart Order Router:** divide compras/ventas simuladas sobre profundidad marginal y wallets prefundadas.
- **Cross-Venue Arbitrage Graph:** modela conversiones como `w = -log(rate_after_costs)` y busca ciclos negativos tipo Bellman-Ford.
- **Liquidity Topology Map:** compara geometría L2 con distancia tipo Wasserstein-1 para detectar venues frágiles.
- **Queue Position Oracle:** estima fill maker con queue-ahead, flujo agresor, Poisson fill probability y adverse selection.
- **Hawkes Flow Shock Oracle:** estima flujo auto-excitante, branching ratio y probabilidad de aftershock.
- **Latency Alpha Race:** mide si la oportunidad sobreviviría p95 latency, edge half-life y volatilidad.
- **Conformal Execution Guard:** resta un downside residual calibrado con replay histórico antes de permitir ejecución.
- **Capital Allocation Optimizer:** asigna bankroll simulado entre estrategias con CVaR, confianza, capacidad y settlement risk.

## Instalación

Requisitos:

- Node.js 20 o superior
- npm
- GitHub CLI `gh` solo para publicar el repo

```bash
npm install
npm run dev
```

Abre:

```text
http://localhost:3000
```

## Uso rápido para demo

1. Abre el cockpit.
2. Pulsa **Live feeds** para conectar WebSockets públicos y snapshots REST.
3. Revisa **Command route** para ver la oportunidad actual o la razón por la que no hay ruta ejecutable.
4. Usa **Replay** para cargar una ejecución determinística.
5. Abre **Backend Evidence** para mostrar `/api/health`, `/api/backend-manifest` y módulos serverless.
6. Abre **Market Map**, **Quant Lab**, **Mexico Corridor** e **Historical Replay** como prueba técnica para jueces.
7. Usa **Stop feeds** para cerrar sockets y conservar evidencia visible.
8. Usa **Clear session** solo cuando quieras limpiar books, trades, wallets y journal visible.

## Demo script de 90 segundos

1. **Mission Control:** muestra que el proyecto cubre detección, simulación, backend, riesgo y demo reproducible.
2. **Live feeds:** inicia datos públicos y enseña Venue Connection Lab con estado por exchange.
3. **Command route:** explica por qué hay o no una ruta ejecutable ahora mismo.
4. **Best Route:** muestra fórmula neta, waterfall, profundidad caminada y razones de rechazo.
5. **Backend Evidence:** abre `/api/health` y `/api/backend-manifest` para probar frontend + backend.
6. **Market Map:** enseña price consensus, USDT basis, smart routing y liquidez global.
7. **Quant Lab:** enseña queue position, Hawkes flow, latency race y mirage detector.
8. **Replay:** cambia a escenario determinístico para cerrar con una decisión reproducible.

## Endpoints backend principales

```text
GET /api/health
GET /api/backend-manifest
GET /api/price-consensus
GET /api/usdt-basis
GET /api/liquidity-radar
GET /api/market-context
GET /api/trade-tape
GET /api/venue-latency
GET /api/venue-reliability
GET /api/settlement-risk
GET /api/mexico-corridor
GET /api/triangular-lab
GET /api/historical-replay
```

Todos usan fuentes públicas. Los endpoints dinámicos usan `Cache-Control: no-store` y no reciben URLs arbitrarias del usuario.

## Fuentes públicas por módulo

| Módulo | Fuentes públicas |
| --- | --- |
| Live L2 feeds | Kraken, Coinbase, Gemini, Binance, Bybit, Gate.io, OKX, Bitfinex, Bitstamp, KuCoin, Bitget |
| REST snapshots | Coinbase, Binance, Bitstamp, Gemini, KuCoin |
| Price consensus | Coinbase, Kraken, Binance, Bitstamp, Bitso |
| USDT basis | Coinbase, Kraken, Bitstamp, CoinGecko |
| Liquidity radar | Coinbase, Kraken, Bitstamp, Bitfinex, OKX, Gemini, KuCoin |
| Trade tape / lead-lag | Coinbase, Kraken, Bitstamp, Gemini, Bitfinex, Binance |
| Mexico corridor | Bitso BTC/MXN, Bitso USD/MXN, Coinbase BTC/USD |
| Settlement risk | mempool.space, CoinGecko BTC/USD |
| Derivatives / options | OKX, Deribit, BitMEX |
| Sentiment / market context | Binance, Kraken, CoinGecko, Alternative.me |

## Seguridad y límites

- Simulation only.
- No trading real.
- No private API keys.
- No custody.
- No wallets reales.
- No secrets en el repo.
- No URLs públicas controladas por input del usuario.
- Los proxies serverless usan allowlists hardcodeadas por módulo.

## Scripts

```bash
npm run dev        # desarrollo local
npm run typecheck  # TypeScript sin emitir archivos
npm test           # suite Vitest
npm run build      # build de producción Next.js
npm audit --omit=dev
```

## Verificación recomendada antes de entregar

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Prueba manual:

```text
http://localhost:3000/api/health
http://localhost:3000/api/backend-manifest
http://localhost:3000/api/price-consensus
http://localhost:3000/api/usdt-basis
http://localhost:3000/api/liquidity-radar
```

## Publicación en GitHub

El repo está preparado para publicarse como proyecto público:

```bash
gh repo create arbx-ray --public --source=. --remote=origin --push
```

Si el nombre `arbx-ray` ya existe en tu cuenta, el comando fallará. En ese caso conviene elegir un nombre explícito como `arbx-ray-challenge` antes de volver a intentar.

## Autoría individual

`SKANL` y `LoffyDev` pertenecen a la misma persona. `SKANL` es mi cuenta personal de GitHub y `LoffyDev` es mi identidad/cuenta escolar configurada en Git. El proyecto fue desarrollado de forma individual, sin equipo ni contribuciones externas.

## Deploy

Deploy recomendado:

- Vercel Hobby
- Framework preset: Next.js
- Build command: `npm run build`
- Output: configuración estándar de Next.js

No se requiere Railway, Render, base de datos ni worker always-on para la demo.

## Referencias públicas usadas

### Exchange WebSockets y order books

- Kraken book channel: https://docs.kraken.com/api/docs/websocket-v2/book/
- Coinbase level2 channel: https://docs.cdp.coinbase.com/exchange/websocket-feed/channels
- Binance depth stream: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
- Bybit orderbook stream: https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook
- Gate.io order book channel: https://www.gate.com/docs/developers/apiv4/ws/en/
- Gemini streams: https://docs.gemini.com/websocket/streams
- OKX order book: https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-order-book
- Bitfinex public book: https://docs.bitfinex.com/reference/rest-public-book
- Bitstamp API: https://www.bitstamp.net/api/
- KuCoin public WebSocket token: https://www.kucoin.com/docs-new/websocket-api/base-info/get-public-token-spot-margin
- KuCoin partial order book: https://www.kucoin.com/docs-new/rest/spot-trading/market-data/get-part-order-book-aggregated-

### REST market data y trade tape

- Binance market data endpoints: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- Kraken OHLC: https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/
- Kraken market depth: https://docs.kraken.com/api/docs/rest-api/get-order-book/
- Kraken recent trades: https://docs.kraken.com/api/docs/rest-api/get-recent-trades/
- Kraken ticker: https://docs.kraken.com/api/docs/rest-api/get-ticker-information/
- Coinbase product book: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductbook
- Coinbase product trades: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducttrades
- Coinbase product ticker: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductticker
- Coinbase candles: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles
- Bitfinex public trades: https://docs.bitfinex.com/reference/rest-public-trades
- Gemini REST market data: https://developer.gemini.com/rest/market-data

### México, settlement, contexto y derivados

- Bitso order book: https://docs.bitso.com/bitso-api/docs/list-order-book
- Bitso available books: https://docs.bitso.com/bitso-api/docs/list-available-books
- Bitso ticker: https://docs.bitso.com/bitso-api/docs/ticker
- mempool.space REST API: https://mempool.space/docs/api/rest
- CoinGecko markets: https://docs.coingecko.com/reference/coins-markets
- CoinGecko Bitcoin tickers: https://docs.coingecko.com/reference/coins-id-tickers
- CoinGecko simple price: https://docs.coingecko.com/reference/simple-price
- Alternative.me Fear & Greed Index: https://alternative.me/crypto/fear-and-greed-index/
- OKX funding rate: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate
- Deribit public ticker: https://docs.deribit.com/#public-ticker
- Deribit option summaries: https://docs.deribit.com/#public-get_book_summary_by_currency
- Deribit index price: https://docs.deribit.com/#public-get_index_price
- BitMEX instrument: https://www.bitmex.com/api/explorer/#!/Instrument/Instrument_get

### Status y confiabilidad

- Coinbase status API: https://status.coinbase.com/api/v2/status.json
- Kraken status API: https://status.kraken.com/api/v2/status.json
- Gemini status API: https://status.gemini.com/api/v2/status.json
- Bitfinex status API: https://bitfinex.statuspage.io/api/v2/status.json
- Bitstamp status API: https://status.bitstamp.net/api/v2/status.json
- OKX status API: https://status.okx.com/api/v2/status.json

### Papers / modelos

- Bayesian Online Changepoint Detection, Adams and MacKay: https://arxiv.org/abs/0710.3742

## Estado del proyecto

ArbX-Ray está diseñado como una entrega de challenge defendible: frontend interactivo, backend serverless verificable, datos públicos reales, simulación sin riesgo custodial y explicabilidad matemática para cada decisión.
