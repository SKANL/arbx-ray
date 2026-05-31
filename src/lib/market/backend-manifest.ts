export type BackendSource = {
  name: string;
  url: string;
  kind: "rest" | "status" | "derived";
};

export type BackendModule = {
  id: string;
  label: string;
  endpoint: `/api/${string}`;
  role: "snapshot-proxy" | "market-oracle" | "risk-oracle" | "strategy-lab" | "health";
  description: string;
  publicSources: BackendSource[];
  crosses: string[];
  cachePolicy: "no-store";
  fallbackPolicy: string;
  requiresApiKey: false;
  uiView: "cockpit" | "quant" | "market" | "mexico" | "triangular" | "backtest" | "judge" | "replay";
};

export type BackendManifest = {
  name: "ArbX-Ray serverless backend";
  version: "0.1.0";
  architecture: "nextjs-route-handlers-bff";
  deploymentTarget: "Vercel Hobby";
  simulationOnly: true;
  requiresPrivateApiKeys: false;
  requiresDatabase: false;
  generatedAt: number;
  modules: BackendModule[];
};

export type BackendHealth = {
  ok: boolean;
  runtime: "Next.js Route Handlers on Vercel-compatible serverless";
  generatedAt: number;
  moduleCount: number;
  publicSourceCount: number;
  requiresPrivateApiKeys: false;
  checks: Array<{
    id: string;
    endpoint: BackendModule["endpoint"];
    label: string;
    status: "configured";
    publicSources: number;
    requiresApiKey: false;
    fallbackPolicy: string;
  }>;
};

const modules: BackendModule[] = [
  module({
    id: "binance-snapshot",
    label: "Binance REST depth snapshot",
    endpoint: "/api/snapshots/binance",
    role: "snapshot-proxy",
    description: "CORS-resilient server-side depth bootstrap for the browser WebSocket book.",
    publicSources: [source("Binance", "https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=100")],
    crosses: ["BTC/USDT L2 depth"],
    fallbackPolicy: "REST depth snapshot seeds the local book if the browser WebSocket starts after missed deltas.",
    uiView: "cockpit",
  }),
  module({
    id: "bitstamp-snapshot",
    label: "Bitstamp REST depth snapshot",
    endpoint: "/api/snapshots/bitstamp",
    role: "snapshot-proxy",
    description: "Server-side BTC/USD depth fallback for the Bitstamp browser WebSocket adapter.",
    publicSources: [source("Bitstamp", "https://www.bitstamp.net/api/v2/order_book/btcusd/")],
    crosses: ["BTC/USD L2 depth", "Bitstamp WebSocket fallback"],
    fallbackPolicy: "REST depth snapshot keeps Bitstamp visible when the browser socket is slow to emit the first order book.",
    uiView: "cockpit",
  }),
  module({
    id: "coinbase-snapshot",
    label: "Coinbase REST depth snapshot",
    endpoint: "/api/snapshots/coinbase",
    role: "snapshot-proxy",
    description: "Server-side BTC/USD depth fallback for Coinbase level2 and level2_batch WebSocket feeds.",
    publicSources: [source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2")],
    crosses: ["BTC/USD L2 depth", "Coinbase WebSocket fallback"],
    fallbackPolicy: "REST depth snapshot keeps Coinbase visible when the browser socket is slow, blocked, or closes.",
    uiView: "cockpit",
  }),
  module({
    id: "gemini-snapshot",
    label: "Gemini REST depth snapshot",
    endpoint: "/api/snapshots/gemini",
    role: "snapshot-proxy",
    description: "Server-side BTC/USD depth fallback for Gemini modern depth and book-ticker streams.",
    publicSources: [source("Gemini", "https://api.gemini.com/v1/book/btcusd")],
    crosses: ["BTC/USD L2 depth", "Gemini WebSocket fallback"],
    fallbackPolicy: "REST depth snapshot keeps Gemini visible while stream subscriptions or first payloads settle.",
    uiView: "cockpit",
  }),
  module({
    id: "kucoin-public-token",
    label: "KuCoin public WebSocket token",
    endpoint: "/api/kucoin-bullet-public",
    role: "snapshot-proxy",
    description: "No-key public token broker for KuCoin spot WebSocket market data.",
    publicSources: [source("KuCoin", "https://api.kucoin.com/api/v1/bullet-public")],
    crosses: ["BTC/USDT L2 depth", "public token", "ping interval"],
    fallbackPolicy: "If token retrieval fails, the venue is marked unavailable while other venues continue.",
    uiView: "cockpit",
  }),
  module({
    id: "kucoin-snapshot",
    label: "KuCoin REST depth snapshot",
    endpoint: "/api/snapshots/kucoin",
    role: "snapshot-proxy",
    description: "CORS-resilient server-side BTC/USDT depth fallback for KuCoin public WebSocket market data.",
    publicSources: [source("KuCoin", "https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=BTC-USDT")],
    crosses: ["BTC/USDT L2 depth", "KuCoin WebSocket fallback"],
    fallbackPolicy: "REST depth snapshot keeps KuCoin visible if token setup or WebSocket delivery is delayed.",
    uiView: "cockpit",
  }),
  module({
    id: "live-websocket-venue-matrix",
    label: "Live WebSocket Venue Matrix",
    endpoint: "/api/backend-manifest",
    role: "health",
    description: "Documents the browser-first public WebSocket venue adapters used by the execution worker.",
    publicSources: [
      source("Kraken", "wss://ws.kraken.com/v2", "derived"),
      source("Coinbase", "wss://ws-feed.exchange.coinbase.com", "derived"),
      source("Gemini", "wss://ws.gemini.com?snapshot=20", "derived"),
      source("Binance", "wss://stream.binance.com:9443/ws/btcusdt@depth@100ms", "derived"),
      source("Bybit", "wss://stream.bybit.com/v5/public/spot", "derived"),
      source("Gate.io", "wss://api.gateio.ws/ws/v4/", "derived"),
      source("OKX", "wss://ws.okx.com:8443/ws/v5/public", "derived"),
      source("Bitfinex", "wss://api-pub.bitfinex.com/ws/2", "derived"),
      source("Bitstamp", "wss://ws.bitstamp.net", "derived"),
      source("KuCoin", "wss://ws-api-spot.kucoin.com/", "derived"),
      source("Bitget", "wss://ws.bitget.com/v3/ws/public", "derived"),
    ],
    crosses: ["BTC/USD L2 depth", "BTC/USDT L2 depth", "WebSocket telemetry", "REST fallback evidence"],
    fallbackPolicy: "Route Handlers provide REST snapshots or public-token bootstraps where browser WebSockets need help.",
    uiView: "cockpit",
  }),
  module({
    id: "market-context",
    label: "Market Context",
    endpoint: "/api/market-context",
    role: "market-oracle",
    description: "Aggregates public price, volatility, and mempool context used by execution risk models.",
    publicSources: [
      source("CoinGecko", "https://api.coingecko.com/api/v3/simple/price"),
      source("Binance", "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"),
      source("mempool.space", "https://mempool.space/api/v1/fees/recommended"),
      source("Alternative.me", "https://api.alternative.me/fng/"),
    ],
    crosses: ["BTC/USD", "BTC/USDT", "network fees", "sentiment"],
    fallbackPolicy: "Unavailable sources are reported as errors while the UI keeps replay and local simulation usable.",
    uiView: "quant",
  }),
  module({
    id: "venue-latency",
    label: "Venue Latency Race",
    endpoint: "/api/venue-latency",
    role: "risk-oracle",
    description: "Samples public ping/time/ticker endpoints to estimate latency, jitter, availability, and haircut.",
    publicSources: [
      source("Binance", "https://api.binance.com/api/v3/ping"),
      source("Coinbase", "https://api.coinbase.com/v2/time"),
      source("Kraken", "https://api.kraken.com/0/public/Time"),
      source("OKX", "https://www.okx.com/api/v5/public/time"),
    ],
    crosses: ["venue p50/p95 latency", "availability"],
    fallbackPolicy: "Failed probes become venue-specific latency errors instead of blocking the dashboard.",
    uiView: "judge",
  }),
  module({
    id: "venue-reliability",
    label: "Venue Reliability Oracle",
    endpoint: "/api/venue-reliability",
    role: "risk-oracle",
    description: "Combines public status APIs and endpoint latency into allow/cap/halt routing policy.",
    publicSources: [
      source("Coinbase Status", "https://status.coinbase.com/api/v2/status.json", "status"),
      source("Kraken Status", "https://status.kraken.com/api/v2/status.json", "status"),
      source("Gemini Status", "https://status.gemini.com/api/v2/status.json", "status"),
      source("Bitstamp Status", "https://status.bitstamp.net/api/v2/status.json", "status"),
      source("Bitfinex Status", "https://bitfinex.statuspage.io/api/v2/status.json", "status"),
      source("OKX Status", "https://status.okx.com/api/v2/status.json", "status"),
    ],
    crosses: ["statuspage health", "REST latency"],
    fallbackPolicy: "Unknown venues are capped rather than trusted when status APIs fail.",
    uiView: "market",
  }),
  module({
    id: "price-consensus",
    label: "Price Consensus Oracle",
    endpoint: "/api/price-consensus",
    role: "market-oracle",
    description: "Normalizes public BTC tickers into USD and flags outliers with robust median/MAD statistics.",
    publicSources: [
      source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/ticker"),
      source("Kraken", "https://api.kraken.com/0/public/Ticker?pair=XBTUSD"),
      source("Binance", "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
      source("Bitstamp", "https://www.bitstamp.net/api/v2/ticker/btcusd/"),
      source("Bitso", "https://api.bitso.com/v3/ticker/?book=btc_mxn"),
      source("Bitso", "https://api.bitso.com/v3/ticker/?book=usd_mxn"),
    ],
    crosses: ["BTC/USD", "BTC/USDT", "BTC/MXN via USD/MXN"],
    fallbackPolicy: "Missing venues reduce confidence and remain visible in the oracle errors list.",
    uiView: "market",
  }),
  module({
    id: "usdt-basis",
    label: "USDT Basis Oracle",
    endpoint: "/api/usdt-basis",
    role: "market-oracle",
    description: "Measures USDT/USD basis so cross-lane BTC/USD vs BTC/USDT routes need an explicit haircut.",
    publicSources: [
      source("Coinbase", "https://api.exchange.coinbase.com/products/USDT-USD/ticker"),
      source("Kraken", "https://api.kraken.com/0/public/Ticker?pair=USDTUSD"),
      source("Bitstamp", "https://www.bitstamp.net/api/v2/ticker/usdtusd/"),
      source("CoinGecko", "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd"),
    ],
    crosses: ["USDT/USD", "cross-lane basis haircut"],
    fallbackPolicy: "Cross-lane routes stay conservative if fewer than three basis sources are available.",
    uiView: "market",
  }),
  module({
    id: "liquidity-radar",
    label: "Global Liquidity Radar",
    endpoint: "/api/liquidity-radar",
    role: "market-oracle",
    description: "Fetches public REST books across venues for broad liquidity, spread, and route capacity evidence.",
    publicSources: [
      source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2"),
      source("Kraken", "https://api.kraken.com/0/public/Depth?pair=XBTUSD"),
      source("Bitstamp", "https://www.bitstamp.net/api/v2/order_book/btcusd/"),
      source("Bitfinex", "https://api-pub.bitfinex.com/v2/book/tBTCUSD/P0"),
      source("OKX", "https://www.okx.com/api/v5/market/books?instId=BTC-USDT"),
      source("Gemini", "https://api.gemini.com/v1/book/btcusd"),
      source("KuCoin", "https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=BTC-USDT"),
    ],
    crosses: ["BTC/USD L2", "BTC/USDT L2", "venue capacity"],
    fallbackPolicy: "Partial venue failures are surfaced per venue while remaining books still feed topology and routing.",
    uiView: "market",
  }),
  module({
    id: "trade-tape",
    label: "Trade Tape Toxicity",
    endpoint: "/api/trade-tape",
    role: "risk-oracle",
    description: "Fetches public recent trades for flow toxicity, imbalance, and short-window execution risk.",
    publicSources: [
      source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/trades"),
      source("Kraken", "https://api.kraken.com/0/public/Trades?pair=XBTUSD"),
    ],
    crosses: ["recent trades", "flow imbalance"],
    fallbackPolicy: "If one tape fails, the oracle scores surviving venues and marks sourceCount lower.",
    uiView: "quant",
  }),
  module({
    id: "lead-lag",
    label: "Lead-Lag Execution Oracle",
    endpoint: "/api/lead-lag",
    role: "strategy-lab",
    description: "Bucketizes recent public trades to find leader/follower venues and execution timing haircuts.",
    publicSources: [
      source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/trades"),
      source("Kraken", "https://api.kraken.com/0/public/Trades?pair=XBTUSD"),
      source("Bitstamp", "https://www.bitstamp.net/api/v2/transactions/btcusd/"),
      source("Gemini", "https://api.gemini.com/v1/trades/btcusd"),
      source("Bitfinex", "https://api-pub.bitfinex.com/v2/trades/tBTCUSD/hist"),
      source("Binance", "https://api.binance.com/api/v3/aggTrades?symbol=BTCUSDT"),
    ],
    crosses: ["trade buckets", "lagged correlations"],
    fallbackPolicy: "The oracle degrades to observed venues and reports insufficient venue count when needed.",
    uiView: "quant",
  }),
  module({
    id: "derivatives-pressure",
    label: "Derivatives Pressure Oracle",
    endpoint: "/api/derivatives-pressure",
    role: "risk-oracle",
    description: "Normalizes public perpetual funding and premium into execution pressure risk.",
    publicSources: [
      source("OKX", "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP"),
      source("Deribit", "https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL"),
      source("BitMEX", "https://www.bitmex.com/api/v1/instrument?symbol=XBTUSD"),
    ],
    crosses: ["funding", "premium", "perpetual pressure"],
    fallbackPolicy: "Missing derivatives venues lower confidence and keep spot execution policy conservative.",
    uiView: "quant",
  }),
  module({
    id: "cash-carry",
    label: "Cash-and-Carry Lab",
    endpoint: "/api/cash-carry",
    role: "strategy-lab",
    description: "Crosses public spot tickers with perpetual data for basis/carry simulation.",
    publicSources: [
      source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/ticker"),
      source("Kraken", "https://api.kraken.com/0/public/Ticker?pair=XBTUSD"),
      source("Binance", "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
      source("Bitstamp", "https://www.bitstamp.net/api/v2/ticker/btcusd/"),
      source("OKX", "https://www.okx.com/api/v5/public/funding-rate?instId=BTC-USDT-SWAP"),
      source("Deribit", "https://www.deribit.com/api/v2/public/ticker?instrument_name=BTC-PERPETUAL"),
      source("BitMEX", "https://www.bitmex.com/api/v1/instrument?symbol=XBTUSD"),
    ],
    crosses: ["spot BTC", "perpetual funding", "basis carry"],
    fallbackPolicy: "Routes require both spot and derivative legs; incomplete legs become rejected candidates.",
    uiView: "quant",
  }),
  module({
    id: "options-iv",
    label: "Options IV Oracle",
    endpoint: "/api/options-iv",
    role: "risk-oracle",
    description: "Uses public Deribit option summaries to estimate expected move and volatility regime.",
    publicSources: [
      source("Deribit", "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option"),
      source("Deribit", "https://www.deribit.com/api/v2/public/get_index_price?index_name=btc_usd"),
    ],
    crosses: ["BTC options IV", "index price", "expected move"],
    fallbackPolicy: "If options are unavailable, the quant lab keeps this risk term explicit as not loaded.",
    uiView: "quant",
  }),
  module({
    id: "settlement-risk",
    label: "Settlement Risk Oracle",
    endpoint: "/api/settlement-risk",
    role: "risk-oracle",
    description: "Converts public Bitcoin fee and mempool data into withdrawal cost and confirmation risk.",
    publicSources: [
      source("mempool.space", "https://mempool.space/api/v1/fees/recommended"),
      source("mempool.space", "https://mempool.space/api/v1/fees/mempool-blocks"),
      source("CoinGecko", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"),
    ],
    crosses: ["BTC network fees", "projected blocks", "BTC/USD"],
    fallbackPolicy: "Network-risk widgets remain visible and label withdrawal costs unavailable instead of assuming zero.",
    uiView: "replay",
  }),
  module({
    id: "venue-intelligence",
    label: "Venue Intelligence",
    endpoint: "/api/venue-intelligence",
    role: "market-oracle",
    description: "Summarizes public CoinGecko ticker markets into venue quality and route candidates.",
    publicSources: [source("CoinGecko", "https://api.coingecko.com/api/v3/coins/bitcoin/tickers")],
    crosses: ["exchange tickers", "volume", "trust score"],
    fallbackPolicy: "If CoinGecko rate-limits, the market map continues with other public-data modules.",
    uiView: "market",
  }),
  module({
    id: "mexico-corridor",
    label: "Mexico Corridor",
    endpoint: "/api/mexico-corridor",
    role: "strategy-lab",
    description: "Combines Bitso MXN books with Coinbase BTC/USD depth for Mexico-relevant route simulation.",
    publicSources: [
      source("Bitso BTC/MXN", "https://api.bitso.com/v3/order_book/?book=btc_mxn"),
      source("Bitso USD/MXN", "https://api.bitso.com/v3/order_book/?book=usd_mxn"),
      source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2"),
    ],
    crosses: ["BTC/MXN", "USD/MXN", "BTC/USD"],
    fallbackPolicy: "Missing FX or BTC leg blocks that route and leaves the rest of the app usable.",
    uiView: "mexico",
  }),
  module({
    id: "triangular-lab",
    label: "Triangular Lab",
    endpoint: "/api/triangular-lab",
    role: "strategy-lab",
    description: "Builds a three-leg Coinbase BTC/ETH/USD simulator from public L2 books.",
    publicSources: [
      source("Coinbase BTC/USD", "https://api.exchange.coinbase.com/products/BTC-USD/book?level=2"),
      source("Coinbase ETH/USD", "https://api.exchange.coinbase.com/products/ETH-USD/book?level=2"),
      source("Coinbase ETH/BTC", "https://api.exchange.coinbase.com/products/ETH-BTC/book?level=2"),
    ],
    crosses: ["BTC/USD", "ETH/USD", "ETH/BTC"],
    fallbackPolicy: "A missing leg rejects the triangular route instead of interpolating synthetic liquidity.",
    uiView: "triangular",
  }),
  module({
    id: "historical-replay",
    label: "Historical Replay",
    endpoint: "/api/historical-replay",
    role: "strategy-lab",
    description: "Fetches public candle history to replay simulated arbitrage and validate strategy robustness.",
    publicSources: [
      source("Binance", "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m"),
      source("Kraken", "https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1"),
      source("Coinbase", "https://api.exchange.coinbase.com/products/BTC-USD/candles"),
    ],
    crosses: ["BTC/USDT candles", "BTC/USD candles", "stat-arb replay"],
    fallbackPolicy: "Replay uses aligned surviving candles and reports insufficient history when alignment is weak.",
    uiView: "backtest",
  }),
];

export function buildBackendManifest(generatedAt = Date.now()): BackendManifest {
  return {
    name: "ArbX-Ray serverless backend",
    version: "0.1.0",
    architecture: "nextjs-route-handlers-bff",
    deploymentTarget: "Vercel Hobby",
    simulationOnly: true,
    requiresPrivateApiKeys: false,
    requiresDatabase: false,
    generatedAt,
    modules,
  };
}

export function buildBackendHealth(input: { generatedAt?: number } = {}): BackendHealth {
  const manifest = buildBackendManifest(input.generatedAt ?? Date.now());
  const uniqueSources = new Set(manifest.modules.flatMap((item) => item.publicSources.map((source) => source.url)));
  return {
    ok: manifest.modules.length > 0 && manifest.modules.every((item) => item.requiresApiKey === false),
    runtime: "Next.js Route Handlers on Vercel-compatible serverless",
    generatedAt: manifest.generatedAt,
    moduleCount: manifest.modules.length,
    publicSourceCount: uniqueSources.size,
    requiresPrivateApiKeys: false,
    checks: manifest.modules.map((item) => ({
      id: item.id,
      endpoint: item.endpoint,
      label: item.label,
      status: "configured",
      publicSources: item.publicSources.length,
      requiresApiKey: false,
      fallbackPolicy: item.fallbackPolicy,
    })),
  };
}

function module(input: Omit<BackendModule, "cachePolicy" | "requiresApiKey">): BackendModule {
  return {
    ...input,
    cachePolicy: "no-store",
    requiresApiKey: false,
  };
}

function source(name: string, url: string, kind: BackendSource["kind"] = "rest"): BackendSource {
  return { name, url, kind };
}
