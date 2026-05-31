# Coding Challenge Mexico - Challenge

> Fuente: [https://www.coding-challenge-mexico.com/challenge](https://www.coding-challenge-mexico.com/challenge)  
> Título de la página: Mexico Coding Challenge Web Application  
> Estado del challenge: Publicado  
> Publicado: 2026-02-21T20:22:49.723Z  
> Última actualización del contenido: 2026-05-29T05:59:06.217Z  
> Contacto: [info@coding-challenge-mexico.com](mailto:info@coding-challenge-mexico.com)

# El Desafío: Arbitraje de Bitcoin

## El Problema

Bitcoin es el activo financiero más negociado del mundo digital. Se transa simultáneamente
en cientos de exchanges alrededor del mundo, las 24 horas del día, los 7 días de la semana,
sin interrupciones ni cierres de mercado.

Dado que cada exchange opera de forma independiente, con su propia liquidez, su propia base
de usuarios y su propio libro de órdenes (*order book*), los precios nunca son exactamente
iguales entre plataformas. Las fuerzas de oferta y demanda actúan de forma distinta en cada
mercado, generando constantemente **divergencias de precio** que pueden durar
milisegundos o varios segundos.

Estas divergencias son la materia prima del **arbitraje**: la práctica de explotar
diferencias de precio del mismo activo en mercados distintos para obtener una ganancia con
riesgo teórico cercano a cero. En los mercados financieros tradicionales, los grandes fondos
de inversión y los traders de alta frecuencia (*HFT — High Frequency Trading*) dedican
infraestructura millonaria para capturar estas oportunidades en fracciones de segundo.

En el mundo cripto, estas oportunidades son más frecuentes y accesibles, porque los mercados
son más fragmentados, menos eficientes, y las APIs de los exchanges están disponibles de
forma pública y gratuita. El campo de juego está abierto para cualquier desarrollador que
tenga la velocidad y la inteligencia para aprovecharlo.

**Tu misión es construir ese sistema.**

## El Challenge

Deberás diseñar, desarrollar y desplegar un sistema de trading automático que sea capaz de
detectar oportunidades de arbitraje en tiempo real y simular su ejecución de forma inteligente.
El sistema debe cumplir con los siguientes requisitos funcionales:

1. **Monitoreo en tiempo real de order books de BTC en dos o más exchanges.**
El sistema debe conectarse mediante WebSockets o polling a los feeds públicos de datos
de mercado y mantener una visión actualizada del mejor precio de compra (*Ask*)
y venta (*Bid*) en cada plataforma.
2. **Detección de oportunidades de arbitraje.**
Cuando el precio Ask de un exchange sea inferior al precio Bid de otro, existe una
oportunidad de arbitraje. El sistema debe identificarla en el momento en que ocurre,
calcular su rentabilidad neta y decidir si ejecutarla.
3. **Ejecución simulada de la operación.**
Al detectar una oportunidad rentable, el sistema debe registrar y simular la compra
en el exchange de precio menor y la venta simultánea en el exchange de precio mayor,
respetando las restricciones de liquidez del order book.
4. **Consideración de costos reales de operación.**
Toda oportunidad debe evaluarse neta de comisiones (*trading fees*), costos de
retiro (*withdrawal fees*), slippage estimado y latencia de red. Una oportunidad
que parezca rentable en bruto puede resultar negativa al considerar estos factores.
5. **Gestión de órdenes parciales y balance de wallets.**
El sistema debe manejar escenarios donde la liquidez disponible en el order book no
cubra el volumen completo de la operación, ejecutando órdenes parciales cuando sea
necesario. Los balances de cada wallet deben actualizarse correctamente tras cada
operación simulada.
6. **Registro y visualización del rendimiento.**
El sistema debe llevar un historial de todas las oportunidades detectadas, operaciones
ejecutadas, ganancias y pérdidas acumuladas, y presentar esta información de forma
clara en la interfaz web.

## Ejemplo

Considera el siguiente escenario en tiempo real. El sistema detecta la siguiente divergencia
en el mercado de BTC/USDT:

| Exchange | Acción | Precio BTC | Fee estimado (0.1%) | Precio neto |
| --- | --- | --- | --- | --- |
| Exchange A (ej. Kraken) | Comprar (Ask) | $70,000.00 | $70.00 | $70,070.00 |
| Exchange B (ej. Binance) | Vender (Bid) | $70,250.00 | $70.25 | $70,179.75 |

Tu bot evalúa la operación y ejecuta:

- Compra 1 BTC en Exchange A a **$70,000** + fee $70.00 = costo total **$70,070.00**
- Vende 1 BTC en Exchange B a **$70,250** − fee $70.25 = ingreso neto **$70,179.75**

**Ganancia neta por operación:** $109.75 USD por BTC negociado

Un sistema bien construido puede detectar decenas de estas oportunidades por hora.
La diferencia entre un bot promedio y uno excepcional no está solo en detectarlas,
sino en priorizarlas, ejecutarlas con la latencia más baja posible y gestionar el
riesgo cuando el mercado se mueve en contra durante la ejecución.

## Datos de Mercado: Exchanges y APIs Disponibles

Puedes conectarte a cualquier exchange que ofrezca API pública de datos de mercado.
A continuación encontrarás los principales exchanges recomendados, junto con sus
documentaciones oficiales:

-
**Binance** — El exchange de mayor volumen del mundo.
[API REST](https://binance-docs.github.io/apidocs/spot/en/) ·
[WebSocket Streams](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
-
**Kraken** — Uno de los exchanges más antiguos y confiables.
[API REST](https://docs.kraken.com/rest/) ·
[WebSocket API](https://docs.kraken.com/websockets/)
-
**Coinbase Advanced Trade** — Exchange regulado del mercado estadounidense.
[API REST](https://docs.cdp.coinbase.com/advanced-trade/docs/welcome) ·
[WebSocket Feed](https://docs.cdp.coinbase.com/advanced-trade/docs/ws-overview)
-
**OKX** — Alto volumen, especialmente en mercados asiáticos.
[API REST](https://www.okx.com/docs-v5/en/) ·
[WebSocket API](https://www.okx.com/docs-v5/en/#overview-websocket)
-
**Bybit** — Exchange en fuerte crecimiento global.
[API REST](https://bybit-exchange.github.io/docs/v5/intro) ·
[WebSocket API](https://bybit-exchange.github.io/docs/v5/ws/connect)
-
**Bitfinex** — Plataforma con alta liquidez institucional.
[API REST](https://docs.bitfinex.com/docs) ·
[WebSocket API](https://docs.bitfinex.com/docs/ws-general)
-
**KuCoin** — Amplia variedad de pares y mercados alternativos.
[API REST](https://www.kucoin.com/docs/beginners/introduction) ·
[WebSocket API](https://www.kucoin.com/docs/websocket/basic-info/apply-connect-token/public-token)
-
**Gate.io** — Uno de los exchanges con mayor número de activos listados.
[API REST y WebSocket](https://www.gate.io/docs/developers/apiv4/)
-
**Bitstamp** — Exchange europeo con larga trayectoria.
[API REST](https://www.bitstamp.net/api/) ·
[WebSocket API](https://www.bitstamp.net/api/#websocket_api_reference)
-
**Gemini** — Exchange regulado con datos institucionales.
[API REST](https://docs.gemini.com/rest-api/) ·
[WebSocket API](https://docs.gemini.com/websocket-api/)

Para explorar el universo completo de exchanges y comparar volúmenes, spreads y liquidez
en tiempo real, puedes consultar los siguientes agregadores de mercado:

-
[CoinMarketCap — Mercados de Bitcoin](https://coinmarketcap.com/currencies/bitcoin/#Markets)
· Comparativa de precios y volúmenes por exchange en tiempo real.
-
[CoinGecko — Mercados de Bitcoin](https://www.coingecko.com/en/coins/bitcoin#markets)
· Datos alternativos de liquidez, spread y confiabilidad por exchange.
-
[TradingView — BTC/USD](https://www.tradingview.com/symbols/BTCUSD/)
· Visualización de precios multi-exchange en tiempo real.

## Qué Estamos Buscando

Tu solución será evaluada por un jurado técnico especializado en sistemas financieros
y desarrollo de software. Los criterios de evaluación son los siguientes:

-
**Velocidad y eficiencia en la detección de oportunidades.**
¿Con qué latencia tu sistema identifica una divergencia de precio desde que ocurre
en el mercado? ¿Usas WebSockets o polling? ¿Cómo optimizas el procesamiento
de datos en tiempo real?
-
**Precisión en el cálculo de rentabilidad neta.**
¿Tu sistema considera correctamente los fees de cada exchange, el slippage estimado
y los riesgos de ejecución antes de tomar una decisión? ¿Evita ejecutar operaciones
que parezcan rentables en bruto pero resulten negativas en neto?
-
**Solidez y robustez de la lógica de negocio.**
¿Cómo maneja el sistema situaciones de baja liquidez, órdenes parciales o movimientos
bruscos de mercado durante la ejecución? ¿Existe algún mecanismo de gestión de riesgo
o de circuit breaker ante condiciones adversas?
-
**Estrategia e inteligencia del bot.**
¿El sistema simplemente detecta la primera oportunidad disponible o es capaz de
priorizarlas, comparar múltiples pares simultáneamente o implementar alguna estrategia
más sofisticada (por ejemplo, arbitraje triangular, arbitraje estadístico, etc.)?
-
**Calidad de la arquitectura y el código.**
¿El sistema está bien estructurado, es mantenible y escalable? ¿El código es legible,
está documentado y sigue buenas prácticas de ingeniería de software?
-
**Experiencia y presentación en la interfaz web.**
La solución debe estar desplegada como web app funcional y accesible desde un navegador.
Se valorará positivamente una interfaz que permita visualizar en tiempo real el estado
del mercado, las oportunidades detectadas, las operaciones ejecutadas y el P&L acumulado.

## Entrega y Despliegue

Tu solución debe estar desplegada y accesible públicamente como aplicación web antes del
cierre del periodo de entrega. Asegúrate de que el sistema esté corriendo y sea funcional
en el momento de la evaluación.

Plataformas sugeridas para el despliegue (gratuitas o con tier gratuito suficiente):

- [Vercel](https://vercel.com) — Ideal para frontends y APIs en Next.js, React, etc.
- [Railway](https://railway.app) — Backends, bots y servicios con soporte para cualquier lenguaje.
- [Render](https://render.com) — Web services, workers y bases de datos en la nube.
- [Fly.io](https://fly.io) — Despliegue de aplicaciones con baja latencia global.
- [Google Cloud Run](https://cloud.google.com/run) — Contenedores serverless con generoso free tier.
- [AWS Free Tier](https://aws.amazon.com/free/) — EC2, Lambda y servicios managed para arquitecturas más complejas.

Junto con la URL de tu aplicación, deberás proporcionar acceso al repositorio de código
(público o con acceso compartido) para que el jurado pueda revisar la implementación.
Un **README claro** con la descripción de la arquitectura, instrucciones de
uso y decisiones técnicas relevantes será valorado positivamente.

## El Objetivo

Construir el bot de arbitraje de Bitcoin más rápido, inteligente y robusto posible.
No existe una única solución correcta: hay decenas de estrategias válidas, arquitecturas
posibles y niveles de sofisticación alcanzables en 48 horas. Lo que buscamos no es la
solución perfecta, sino la que demuestre el mayor dominio técnico, la mejor capacidad
de razonamiento bajo presión y la ejecución más sólida dentro del tiempo disponible.

Los mercados financieros son brutalmente eficientes: las ineficiencias que existen hoy
pueden desaparecer mañana. Los mejores sistemas de arbitraje del mundo operan con latencias
de microsegundos y procesan millones de eventos por segundo. En este challenge no llegamos
a eso, pero el principio es el mismo: **velocidad, precisión y determinación**.

Las ineficiencias del mercado están ahí afuera. Tu trabajo es capturarlas antes que nadie.

## Links encontrados

### Enlaces del challenge

- [API REST](https://binance-docs.github.io/apidocs/spot/en/)
- [WebSocket Streams](https://binance-docs.github.io/apidocs/spot/en/#websocket-market-streams)
- [API REST](https://docs.kraken.com/rest/)
- [WebSocket API](https://docs.kraken.com/websockets/)
- [API REST](https://docs.cdp.coinbase.com/advanced-trade/docs/welcome)
- [WebSocket Feed](https://docs.cdp.coinbase.com/advanced-trade/docs/ws-overview)
- [API REST](https://www.okx.com/docs-v5/en/)
- [WebSocket API](https://www.okx.com/docs-v5/en/#overview-websocket)
- [API REST](https://bybit-exchange.github.io/docs/v5/intro)
- [WebSocket API](https://bybit-exchange.github.io/docs/v5/ws/connect)
- [API REST](https://docs.bitfinex.com/docs)
- [WebSocket API](https://docs.bitfinex.com/docs/ws-general)
- [API REST](https://www.kucoin.com/docs/beginners/introduction)
- [WebSocket API](https://www.kucoin.com/docs/websocket/basic-info/apply-connect-token/public-token)
- [API REST y WebSocket](https://www.gate.io/docs/developers/apiv4/)
- [API REST](https://www.bitstamp.net/api/)
- [WebSocket API](https://www.bitstamp.net/api/#websocket_api_reference)
- [API REST](https://docs.gemini.com/rest-api/)
- [WebSocket API](https://docs.gemini.com/websocket-api/)
- [CoinMarketCap — Mercados de Bitcoin](https://coinmarketcap.com/currencies/bitcoin/#Markets)
- [CoinGecko — Mercados de Bitcoin](https://www.coingecko.com/en/coins/bitcoin#markets)
- [TradingView — BTC/USD](https://www.tradingview.com/symbols/BTCUSD/)
- [Vercel](https://vercel.com)
- [Railway](https://railway.app)
- [Render](https://render.com)
- [Fly.io](https://fly.io)
- [Google Cloud Run](https://cloud.google.com/run)
- [AWS Free Tier](https://aws.amazon.com/free/)

### Enlaces internos del sitio

- [Página del challenge](https://www.coding-challenge-mexico.com/challenge)
- [Endpoint de settings](https://www.coding-challenge-mexico.com/_api/settings)
- [Términos](https://www.coding-challenge-mexico.com/terms)
- [Privacidad](https://www.coding-challenge-mexico.com/privacy)
- [index-BqnToiss.css](https://www.coding-challenge-mexico.com/_assets/index-BqnToiss.css)
- [index-Brpydidk.js](https://www.coding-challenge-mexico.com/_assets/index-Brpydidk.js)
- [vendor-Ch_OUP0U.js](https://www.coding-challenge-mexico.com/_assets/vendor-Ch_OUP0U.js)

### Enlaces externos adicionales

- Ninguno

### Enlaces mailto

- [info@coding-challenge-mexico.com](mailto:info@coding-challenge-mexico.com)

## Datos de captura

- Fecha/hora de captura: 2026-05-29 09:56:45 CST
- URL fuente: [https://www.coding-challenge-mexico.com/challenge](https://www.coding-challenge-mexico.com/challenge)
- Endpoint de contenido usado: [https://www.coding-challenge-mexico.com/_api/settings](https://www.coding-challenge-mexico.com/_api/settings)
- Método: descarga HTTP directa de la SPA y extracción del campo público `challengeContent` desde `/_api/settings`.
- Nota: los bundles JavaScript/CSS se registran como assets, pero no se copian completos porque no son contenido legible del challenge.
