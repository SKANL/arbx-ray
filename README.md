# ArbX-Ray: Public-API Bitcoin Arbitrage Execution Lab

ArbX-Ray is a simulation-only Bitcoin arbitrage lab for the Coding Challenge Mexico prompt. It uses public exchange market-data APIs, reconstructs live L2 books, and simulates whether an apparent spread is actually executable after fees, depth, slippage, latency, wallet inventory, and quote-lane risk.

No private API keys are used. No real orders are placed.

## Full-Stack Delivery

ArbX-Ray is a **Next.js full-stack application**, not a static frontend. The browser cockpit runs the low-latency simulation loop, while `src/app/api/*` Route Handlers provide a serverless backend/BFF layer for public API aggregation, CORS-resilient snapshots, normalization, fallback policy, and judge-verifiable health metadata.

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

### Frontend

- Cockpit-first dashboard, shadcn-style navigation, proof command palette, replay timeline, wallets, P&L, and judge-mode evidence.
- Browser Web Worker maintains local books and simulation logic so the UI stays responsive.
- IndexedDB stores the local event journal and replay evidence without requiring a hosted database.

### Backend

- `GET /api/health` summarizes serverless backend readiness, module count, public-source count, and keyless status.
- `GET /api/backend-manifest` documents every backend module, endpoint, public source, fallback policy, and `requiresApiKey=false`.
- Existing Route Handlers under `src/app/api` fetch and aggregate public APIs for price consensus, USDT basis, liquidity radar, latency, reliability, settlement risk, derivatives, options IV, Mexico corridor, triangular lab, and historical replay.
- No private exchange credentials, no custodial surface, no real order placement, and no required database.

## What It Does

- Opens public WebSocket feeds for Kraken, Coinbase, Gemini, Binance, Bybit, Gate.io, OKX, Bitfinex, Bitstamp, and KuCoin.
- Adds Backend Evidence with `/api/health`, `/api/backend-manifest`, 22 serverless API modules, public-source counts, no-key proof, and fallback policies.
- Normalizes all feeds into a common `OrderBookSnapshot` format.
- Keeps USD and USDT lanes separate unless an explicit basis haircut is applied.
- Simulates marketable buy/sell fills by walking both books level by level.
- Visualizes gross-to-net execution with a P&L waterfall for spread, taker fees, rebalance cost, latency haircut, basis haircut, and final net P&L.
- Adds Execution Depth Lens with cumulative BTC, VWAP, levels walked, and slippage for both buy and sell legs.
- Updates prefunded simulated wallets after accepted opportunities.
- Rejects bad opportunities with explicit reasons: stale book, insufficient depth, insufficient inventory, negative net expectancy, cross-lane risk, or latency.
- Stores decisions/trades locally in IndexedDB and includes replay mode for demos.
- Adds a Quant Lab with microprice, top-of-book imbalance, execution probability, impact curve, and historical volatility context.
- Crosses public REST data from Binance, Kraken, mempool.space, CoinGecko, and Alternative.me for market regime, sentiment, venue quality, and network-cost awareness.
- Adds Market Map with CoinGecko venue tickers, exchange quality scores, market-wide route candidates, volume floors, spread sanity checks, and depth cost-to-move context.
- Adds Global Liquidity Radar that fetches REST order book snapshots from Coinbase, Kraken, Bitstamp, Bitfinex, OKX, Gemini, and KuCoin, then re-walks cross-venue depth to rank executable same-lane routes.
- Adds Liquidity Topology Map using Wasserstein-1 / optimal-transport distance over public L2 book shapes to identify the central venue, fragmented venues, topology haircut, and routes that are fragile beyond top-of-book spread.
- Adds Cross-Venue Arbitrage Graph that converts liquidity, Mexico corridor, and triangular routes into weighted graph edges using `w = -log(rate_after_costs)`, then uses Bellman-Ford negative-cycle proof to separate real arbitrage cycles from rejected noise.
- Adds Smart Order Router that uses the same public L2 snapshots to split simulated buys and sells across marginal depth, prefunded wallets, fees, and venue reliability gates, then compares the result against the best single route.
- Adds Venue Reliability Oracle using public exchange status pages plus endpoint latency to allow, cap, or halt simulated routing per venue before capital is assigned.
- Adds Venue Failure War Game that simulates a venue outage after one leg, computes emergency unwind P&L, trapped capital, backup inventory, and failover/halt policy before trusting a route.
- Adds Price Consensus Oracle using Coinbase, Kraken, Binance, Bitstamp, and Bitso tickers to compute robust BTC fair value with median/MAD outlier detection.
- Adds USDT Basis Oracle using Coinbase, Kraken, Bitstamp, and CoinGecko public USDT/USD data to compute a dynamic USD/USDT haircut before any cross-lane comparison.
- Adds Mexico Corridor Lab using Bitso BTC/MXN, Bitso USD/MXN, and Coinbase BTC/USD books to simulate cross-currency arbitrage with executable FX depth.
- Adds Trade Tape Toxicity using recent public trades from Coinbase and Kraken to detect hostile fast flow from signed volume, price drift, trade pace, and average trade size.
- Adds Queue Position Oracle that compares taker execution against simulated post-only maker orders using top-level queue size, public aggressor flow, Poisson fill probability, fee savings, spread capture, and adverse-selection penalty.
- Adds Hawkes Flow Shock Oracle that estimates whether recent public aggressor trades are self-exciting, with branching ratio, aftershock probability, shock half-life, and expected BTC shock versus top depth.
- Adds Latency Alpha Race Simulator that combines public venue latency probes, recent aggressor trade flow, L2 top-depth, volatility, and net edge to estimate whether faster bots will consume the opportunity first.
- Adds Optimal Stopping Frontier that compares execute-now against short wait horizons using edge half-life, volatility cost, conformal downside, and historical opportunity clustering to pick execute, wait, cap, or reject.
- Adds Liquidity Mirage Detector that checks whether a positive top-of-book spread survives VWAP depth walk, fill completeness, depth convexity, top-level concentration, and broader smart-router confirmation.
- Adds Lead-Lag Execution Oracle using recent public trades from Coinbase, Kraken, Bitstamp, Gemini, Bitfinex, and Binance to infer which venue leads price discovery, which venue follows, predicted drift, and execution haircut.
- Adds Derivatives Pressure Oracle using OKX, Deribit, and BitMEX public perpetual data to convert funding, premium, and open interest into a spot execution risk haircut.
- Adds Cash-and-Carry Lab using Coinbase, Kraken, Binance, Bitstamp, OKX, Deribit, and BitMEX public data to simulate spot/perp basis carry with funding, fees, rebalance cost, adverse basis stress, and liquidation buffer.
- Adds Options Implied Volatility Oracle using Deribit public BTC options to estimate forward expected move and an IV-based execution haircut.
- Adds Triangular Lab using Coinbase public L2 books for BTC-USD, ETH-USD, and ETH-BTC to simulate both USD -> BTC -> ETH -> USD and USD -> ETH -> BTC -> USD cycles.
- Adds a latency risk cone that estimates P&L quantiles, VaR, expected shortfall, and break-even latency from real volatility inputs.
- Adds Monte Carlo execution distribution with deterministic trials, histogram, percentiles, loss probability, and CVaR from the same real volatility input.
- Adds fractional Kelly position sizing with bankroll cap, recommended notional, BTC size, variance, and VaR-aware skip/cap/increase policy.
- Adds Capital Rebalance Planner that uses simulated wallets plus public mempool fee context to estimate inventory drift, buy/sell capacity bottlenecks, and simulated BTC transfer actions.
- Adds Settlement Risk Oracle using mempool.space recommended fees, projected blocks, and CoinGecko BTC/USD to price Bitcoin withdrawal cost, confirmation ETA, stranded-inventory risk, and rebalance policy.
- Adds Historical Replay using real Kraken and Coinbase one-minute candles to simulate historical cross-venue actions.
- Adds Strategy Arena to compare conservative, balanced, and aggressive simulated policies over the same historical candle window with risk-adjusted score, profit factor, trades/hour, drawdown, and equity mini-curves.
- Adds Historical Opportunity Heatmap that buckets real replay opportunities by UTC hour and edge tier to reveal repeatable clusters versus one-off noise.
- Adds Walk-Forward Robustness Lab that trains spread filters on the first historical segment, freezes the chosen rule, and validates out-of-sample P&L, generalization ratio, and overfit penalty on the later segment.
- Adds Bayesian Regime Break Detector inspired by Bayesian Online Changepoint Detection, using historical Kraken/Coinbase simulated spreads to estimate run length, change-point posterior, expected edge decay, and trust/cap/retrain policy.
- Adds Conformal Execution Guard that calibrates historical simulator downside residuals with split conformal prediction, then requires the current route to survive a finite-sample lower-bound check before executing or caps size.
- Adds Execution Tournament & Regret Lab that compares naive spread chasing, conservative, balanced, aggressive, walk-forward, and ArbX-Ray autopilot policies on the same real historical replay, ranking P&L, regret, drawdown, and exploitability.
- Adds Historical Sensitivity Surface that sweeps spread filters and cost assumptions across the same real candle window to reveal robust vs fragile parameter zones.
- Adds Stat-Arb Signal using aligned Kraken/Coinbase candles to estimate return correlation, spread z-score, mean-reversion half-life, and lead/lag correlation.
- Adds Risk Governor / Circuit Breaker that gates simulated execution using route status, real volatility, network fees, sentiment, feed health, and stress survival.
- Adds Bayesian Edge Conviction that fuses live route outcome, net edge, P(win), stress survival, historical stat-arb regime, REST liquidity confirmation, feed health, and throughput SLA into one posterior execution recommendation.
- Adds Execution Regime Fusion that combines market context, trade tape toxicity, derivatives pressure, options IV, USDT basis, price consensus, REST liquidity, and venue latency into one action: simulate, cap size, wait, or halt.
- Adds Autonomous Execution Playbook that ranks smart-route, cross-now, post-maker, rebalance, wait-for-evidence, and halt actions with expected P&L, risk score, confidence, hard stops, and a visible scoring equation.
- Adds Causal Execution Evidence Graph that links market edge, Bayesian conviction, walk-forward validation, latency race, risk governor, autonomous playbook, blockers, and final simulated decision into one auditable chain.
- Adds Sequential Execution Test using a Wald-style SPRT gate that accumulates log-likelihood evidence from the independent oracles, exposes alpha/beta risk, and only executes, caps, samples, or rejects after crossing explicit statistical boundaries.
- Adds Capital Allocation Optimizer that ranks live arb, cash-and-carry, Mexico corridor, triangular, historical replay, and global liquidity strategies, then allocates simulated bankroll with CVaR, confidence, capacity, and settlement-risk caps.
- Adds Judge Mode with a challenge-oriented scorecard and stress scenarios for latency, thin books, fee shocks, and fast adverse markets.
- Adds Venue Latency Race that samples public REST endpoints for Binance, Kraken, Coinbase, Bitso, OKX, and Bitstamp, then ranks p50/p95 latency, jitter, availability, and expected P&L haircut.
- Adds a 90-second Demo Director that maps each challenge criterion to a concrete proof point and lets judges jump directly to the strongest evidence.
- Adds Evidence Navigator that compresses the full proof surface into a criterion coverage map, view load map, navigation gaps, and a high-impact judge route under a fixed time budget.
- Adds shadcn-style Mission Control with cards, progress, separator, tooltip, judge path, workspace navigation, readiness score, and first-screen challenge coverage for a more polished trading-desk UX.
- Adds shadcn-style Execution Mode Bar with explicit Live feeds, Replay, Stop feeds, Clear session, last-action receipt, socket counts, and fallback/error evidence.
- Adds shadcn-style Live Exchange Matrix with alert state, venue toggle cards, skeleton loading cells, scrollable data table, source-yield audit, payload-shape diagnostics, and clearer same-lane readiness cues.
- Adds shadcn-style Best Route decision console with tabs for summary, cost waterfall, execution depth, and audit evidence, plus a richer empty state while compatible books are loading.
- Adds shadcn-style Proof Command Palette using Dialog, Command, Input, groups, separators, and empty states to jump directly to views, high-impact demo steps, or challenge criteria.
- Adds a visible `Ctrl/⌘ + K` command shortcut with a shadcn-style Kbd component so judges and operators can open proof search without scanning the full dashboard.
- Adds shadcn-style Active View Brief with Breadcrumb, contextual judge value, proof-step counts, fast-path coverage, and criterion badges for each dashboard view.
- Adds shadcn-style Challenge Coverage Drilldown with Accordion rows, proof text, next-move guidance, score progress, and direct navigation to Judge Mode or the best proof view.
- Adds Decision Audit Receipt with a deterministic fingerprint, formula inputs, policy state, rejection reasons, and data provenance for the latest simulated decision.
- Adds Engine Throughput Lab that benchmarks directed same-lane route evaluations, p50/p95 cycle latency, SLA headroom, accepted/rejected evaluations, and estimated decisions per second.

## Demo Script

1. Run `npm install`.
2. Run `npm run dev`.
3. Open `http://localhost:3000`.
4. Start at **Mission Control** to show readiness, live/replay mode, public source count, challenge coverage, and the generated 70-second judge path.
5. Click **Live feeds** in the Execution Mode Bar and wait for at least two venues in the same quote lane to become live.
6. Inspect **Best Route** for the net P&L formula and rejection reasons.
7. Click **Replay** if an exchange feed is unavailable or the live market is quiet; use **Stop feeds** to freeze evidence and **Clear session** only before a fresh run.
8. Open **Quant Lab** to show execution probability, impact-by-size, microprice, imbalance, volatility, mempool fee context, **Trade Tape Toxicity**, **Hawkes Flow Shock Oracle**, **Latency Alpha Race Simulator**, **Optimal Stopping Frontier**, **Queue Position Oracle**, **Liquidity Mirage Detector**, **Lead-Lag Execution Oracle**, **Derivatives Pressure Oracle**, **Cash-and-Carry Lab**, and **Options Implied Volatility Oracle** from public derivatives markets.
9. Open **Market Map** to show CoinGecko's broader venue snapshot, route scores, volume floors, **Global Liquidity Radar** across public REST order books, **Liquidity Topology Map**, **Cross-Venue Arbitrage Graph**, **Smart Order Router**, **Venue Reliability Oracle**, **Price Consensus Oracle**, and **USDT Basis Oracle**.
10. Open **Backend Evidence** to show `/api/health`, `/api/backend-manifest`, Route Handler module count, public-source count, no private keys, no required database, and Vercel Hobby deployment fit.
11. Open **Mexico Corridor** to show a locally relevant BTC/USD ↔ BTC/MXN strategy over Bitso and Coinbase with Bitso USD/MXN FX depth.
12. Open **Triangular Lab** to show a second strategy class: single-venue triangular arbitrage over real Coinbase L2 depth.
13. Open **Historical Replay** to show real candle-based simulated actions, equity curve, win rate, drawdown, trade log, Strategy Arena, **Historical Opportunity Heatmap**, **Walk-Forward Robustness Lab**, **Bayesian Regime Break Detector**, **Conformal Execution Guard**, and **Execution Tournament & Regret Lab**.
14. Open **Judge Mode** to follow the **90-Second Demo Director** and **Evidence Navigator** across the cockpit, quant lab, market map, backend evidence, Mexico corridor, triangular lab, historical replay, Bayesian Edge Conviction, **Autonomous Execution Playbook**, **Causal Execution Evidence Graph**, **Liquidity Topology Map**, **Cross-Venue Arbitrage Graph**, **Sequential Execution Test**, **Bayesian Regime Break Detector**, **Conformal Execution Guard**, **Optimal Stopping Frontier**, **Execution Tournament & Regret Lab**, Execution Regime Fusion, **Capital Allocation Optimizer**, risk governor, engine throughput lab, Venue Latency Race, Venue Failure War Game, and replay timeline.
15. Open **Replay & Risk** to show wallet inventory, P&L, rejected opportunities, **Venue Failure War Game**, and the **Capital Rebalance Planner**.
16. Show **Settlement Risk Oracle** to prove withdrawal and rebalance assumptions are priced from live Bitcoin blockspace, not a static constant.
17. Show **Decision Audit Receipt** so the jury can verify the decision fingerprint, formula inputs, policy state, and provenance chain.
18. Use **Rejected Opportunities** to show the jury why raw spreads are not enough.

## Why It Is Different

Most challenge bots stop at `best_bid - best_ask`. ArbX-Ray treats that as only the first filter. It asks:

- Can both sides fill at the desired size after walking depth?
- Does the edge survive taker fees, network/rebalance costs, and latency?
- Is top-of-book pressure favorable or hostile?
- What size maximizes net P&L before market impact decays the edge?
- Would the trade still survive under slow-path latency, thin books, fee shock, or fast adverse markets?
- Did similar cross-venue dislocations appear in the historical Kraken/Coinbase candle window?
- Does the live route agree with broader market-wide venue quality, trust, volume, and spread data?
- Does a slower REST sweep across additional venues confirm that the apparent route has real executable depth?
- Are two venues close in top price but far apart in L2 liquidity geometry, meaning the route may be fragile once size walks into deeper levels?
- Can the strategy be expressed as a graph where every venue/asset conversion is an edge, every cost-adjusted exchange rate becomes `-log(rate)`, and Bellman-Ford only approves closed negative cycles?
- Can a larger simulated order improve net P&L by splitting across marginal levels on multiple venues instead of forcing the entire trade through one exchange pair?
- Is the venue operationally safe right now according to public status pages and endpoint latency, or should routing be capped or halted before trusting the book?
- If a venue fails after one leg, can prefunded inventory fail over, or does the bot need to halt and internalize stranded capital?
- Does the venue price agree with a robust multi-source BTC consensus, or is it an outlier/local premium?
- Is the USDT/USD basis small enough to compare BTC/USD and BTC/USDT, or should cross-lane routes pay a larger haircut or halt?
- Is a Mexico-specific BTC/MXN route still attractive after converting through executable USD/MXN depth instead of a static FX rate?
- Is the latest public trade tape benign, or is aggressive flow moving against the simulated execution?
- Is aggressive flow self-exciting, and will one burst likely trigger another burst large enough to consume top-of-book depth?
- Should the simulator cross the spread immediately as taker, or post maker orders based on queue-ahead size, aggressor flow, fill probability, and adverse-selection risk?
- Will this simulated bot capture the spread before faster competitors consume the same L2 liquidity, after measured p95 latency, edge half-life, aggressive flow, and volatility tail risk?
- Should the simulator execute now or wait a few hundred milliseconds for confirmation after pricing edge decay, volatility, conformal downside, and historical opportunity clustering?
- Is the spread real executable liquidity, or a top-of-book mirage that disappears after walking depth and checking route-wide confirmation?
- Which exchange is currently leading price discovery, which one is lagging, and should the simulated bot follow, cap size, wait, or halt?
- Are perpetual funding and premium crowded enough to add a spot execution haircut or halt the route?
- Is a spot/perp cash-and-carry route attractive after funding projection, taker fees, rebalance cost, adverse basis stress, and liquidation buffer?
- What forward move does the BTC options market imply, and does that require a higher latency haircut?
- Which exact cost destroyed or preserved the apparent spread?
- How many book levels did the simulated order consume, and how much slippage did each side pay?
- How much P&L is at risk if latency expands from 50ms to 2s?
- What does the full simulated P&L distribution look like under thousands of short-horizon execution shocks?
- How much capital should the bot allocate if the edge survives, and when should it cap or skip the trade?
- Is the simulated capital stuck on the wrong venue, and what would it cost to rebalance before the next opportunity?
- Is Bitcoin blockspace cheap enough to rebalance now, or should the bot internalize inventory and defer withdrawals?
- Which historical policy is better after adjusting for activity, drawdown, and edge quality?
- Do historical opportunities cluster by UTC hour and edge magnitude, or are they isolated events that should not be overfit?
- Does the historically selected spread filter survive an out-of-sample walk-forward test, or is it just a curve-fit artifact?
- Did the historical spread distribution just change enough that the bot should cap size or retrain instead of trusting yesterday's edge?
- Does the live route remain profitable after subtracting a split-conformal downside residual calibrated from historical simulated trades, or should size be capped despite positive nominal P&L?
- Does ArbX-Ray autopilot beat naive, conservative, balanced, aggressive, and walk-forward rival policies on the same real replay after regret and exploitability are measured?
- Does the historical strategy still work when fees, slippage, latency, and spread filters change?
- Is the cross-venue spread statistically mean-reverting, breaking out, or too weak to trust?
- Is triangular arbitrage inside one exchange actually executable after walking all three L2 books and paying three taker fees?
- Would the engine permit, cap, or halt execution under the current market regime and stress tests?
- Which single simulated action should win now after ranking smart routing, taker execution, maker posting, inventory rebalance, waiting, and hard-stop halt policies?
- Which exact causal evidence path explains the final simulated decision, and which blocker would invalidate the trade first?
- Has the accumulated evidence crossed a statistical SPRT execute/reject boundary, or should the simulator keep sampling/cap size instead of overreacting to one attractive quote?
- Across all available strategy classes, where should simulated bankroll go after CVaR, confidence, capacity, and Bitcoin settlement risk are applied?
- Which venues are currently fast enough to trust, after measuring p50/p95 latency, jitter, availability, and expected latency P&L haircut?
- What is the posterior probability that the current edge is genuinely executable after combining live, historical, liquidity, feed, and speed evidence?
- What single execution regime remains after fusing spot liquidity, toxic flow, derivatives pressure, options IV, USDT basis, consensus quality, and venue latency?
- Can the latest simulated decision be reproduced from a compact audit fingerprint and a visible chain of inputs?
- Which exact screen proves each judging criterion in a 90-second live demo?
- What is the shortest high-impact path through all proof panels if the judge gives only 90 seconds?
- How much latency headroom does the decision engine have when evaluating all same-lane directed routes?

## Free-Tier Architecture

- **Frontend/runtime:** Next.js on Vercel Hobby.
- **Backend/runtime:** Next.js Route Handlers under `src/app/api`, deployed with the same Vercel Hobby app as serverless functions.
- **Live engine:** browser Web Worker, so no always-on backend worker is required.
- **Persistence:** IndexedDB by default; Supabase can be added later for shared history.
- **Backend routes:** 22 public-data modules plus `/api/health` and `/api/backend-manifest` for judge-verifiable full-stack evidence.
- **WebSocket reliability:** Coinbase, Gemini, Binance, Bitstamp, and KuCoin have CORS-resilient REST bootstrap/fallback routes so blocked or slow browser feeds become explicit evidence instead of silent failure.
- **Market context:** route handlers fetch public APIs with no keys and return no-store JSON.
- **Queue position oracle:** client-side maker/taker simulator consumes the latest L2 top level and public recent trades to estimate queue fill probability and expected maker improvement.
- **Venue latency race:** public time/ticker/ping endpoints are sampled on demand to show p50/p95 latency, jitter, availability, and P&L haircut without any credentials.
- **Smart order router:** client-side optimizer consumes public REST L2 snapshots and simulated wallets to build marginal buy/sell slices across venues without private APIs or order placement.
- **Venue reliability oracle:** public Statuspage-compatible endpoints from Coinbase, Kraken, Gemini, Bitstamp, Bitfinex, and OKX are crossed with endpoint latency to create per-venue allow/cap/halt routing policy.
- **Venue failure war game:** pure client-side simulation combines the latest accepted route, prefunded wallets, settlement penalty, and venue reliability policy to model outage recovery without keys, orders, or paid infrastructure.
- **Autonomous execution playbook:** pure client-side policy matrix consumes the simulator's public-data oracles and produces a ranked, auditable action without private APIs or real order placement.
- **Causal execution evidence graph:** pure client-side graph logic turns independent public-data signals into support, drag, blocker, and final-decision nodes, so the judge can audit why the simulator executes, caps, waits, or halts.
- **Sequential execution test:** pure client-side Wald/SPRT-style gate converts public-data oracle outputs into accumulated log-likelihood, upper/lower boundaries, alpha/beta risk, and a final simulate/cap/sample/reject decision.
- **Settlement risk oracle:** mempool.space recommended fees and projected mempool blocks are sampled on demand, then converted to USD with CoinGecko BTC/USD for withdrawal-cost and confirmation-time policy.
- **Trade tape toxicity:** public recent-trade endpoints from Coinbase and Kraken are fetched through a no-store route handler for CORS-resilient microstructure evidence.
- **Hawkes flow shock oracle:** pure client-side self-exciting flow model consumes public recent-trade summaries and estimates branching ratio, aftershock probability, shock half-life, and expected BTC shock without private order-flow feeds.
- **Latency alpha race simulator:** client-side survival model combines the latest simulated route, Venue Latency Race, Trade Tape Toxicity, L2 top-depth, and volatility to estimate edge half-life and expected capture before faster competitors.
- **Optimal stopping frontier:** pure client-side timing optimizer compares wait horizons against crossing now using latency half-life, volatility, conformal downside, and historical opportunity clustering.
- **Liquidity mirage detector:** pure client-side depth forensics uses the latest simulated fill plus Smart Order Router output to score fill completeness, depth convexity, edge retention, top-level concentration, and broad route confirmation.
- **Lead-lag execution oracle:** public recent-trade endpoints from Coinbase, Kraken, Bitstamp, Gemini, Bitfinex, and Binance are bucketized into short-window returns, then scored with lagged correlations to identify leader/follower venues and execution haircuts.
- **Derivatives pressure oracle:** public perpetual endpoints from OKX, Deribit, and BitMEX are fetched through a no-store route handler and normalized into funding/premium risk.
- **Cash-and-Carry Lab:** public spot tickers from Coinbase, Kraken, Binance, and Bitstamp are crossed with OKX, Deribit, and BitMEX perpetual data to simulate a spot/perp basis trade without keys or real orders.
- **Options IV oracle:** public Deribit BTC option summaries and index price are fetched through a no-store route handler and normalized into ATM IV, expected move, term buckets, and execution haircut.
- **Venue intelligence:** CoinGecko public tickers are summarized server-side to keep the UI light and avoid browser CORS fragility.
- **Global liquidity radar:** public REST order books from Coinbase, Kraken, Bitstamp, Bitfinex, OKX, Gemini, and KuCoin are fetched on demand through a no-store route handler.
- **Liquidity Topology Map:** pure client-side optimal-transport analysis consumes the same public L2 books and computes Wasserstein book-shape distances, outliers, centrality, and topology routing haircut.
- **Cross-venue arbitrage graph:** pure client-side graph construction consumes existing public-data route outputs and runs Bellman-Ford-style negative-cycle detection with no private keys, no paid compute, and no order placement.
- **Price consensus oracle:** public BTC tickers from Coinbase, Kraken, Binance, Bitstamp, and Bitso are normalized into USD and scored with median/MAD robust statistics.
- **USDT basis oracle:** public USDT/USD tickers from Coinbase, Kraken, Bitstamp, and CoinGecko are normalized into a median basis and dynamic cross-lane haircut.
- **Mexico Corridor:** public Bitso BTC/MXN and USD/MXN books are combined with Coinbase BTC/USD depth through a no-store route handler.
- **Historical replay:** public OHLC/candle endpoints feed a deterministic simulator with graceful degradation.
- **Walk-forward robustness:** pure client-side validation splits real historical simulated trades into train/test windows, selects the in-sample spread filter, and reports out-of-sample degradation before trusting the strategy.
- **Bayesian regime break detector:** pure client-side BOCPD-style guard estimates change-point posterior and run length from real historical simulated spreads, then emits trust/cap/retrain policy without paid services.
- **Conformal execution guard:** pure client-side split-conformal calibration turns historical simulated trade residuals into a finite-sample downside bound for the current route, then emits execute/cap/wait policy without external services.
- **Execution tournament:** pure client-side policy tournament converts real historical replay and live gate state into a leaderboard of rival bots, regret, exploitability, drawdown, and deploy/cap/retrain policy.
- **Triangular lab:** Coinbase public book endpoints feed a deterministic three-leg simulator.
- **Capital allocation optimizer:** pure client-side portfolio logic consumes the app's existing public-data strategy outputs and never needs private keys, card-backed services, or an always-on worker.
- **Evidence navigator:** pure client-side judge-routing logic classifies demo steps by challenge criterion, groups proof by view, surfaces weak criteria, and builds a high-impact route under a time budget.
- **Lane-aware exchange matrix:** shadcn-style toggle controls let the cockpit inspect USD and USDT venues separately, preserving the challenge requirement that BTC/USD and BTC/USDT are not treated as identical without an explicit basis haircut.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

Manual backend proof after `npm run dev`:

```text
http://localhost:3000/api/health
http://localhost:3000/api/backend-manifest
http://localhost:3000/api/price-consensus
http://localhost:3000/api/usdt-basis
http://localhost:3000/api/liquidity-radar
```

## API References

- Kraken book channel: https://docs.kraken.com/api/docs/websocket-v2/book/
- Coinbase level2 channel: https://docs.cdp.coinbase.com/exchange/websocket-feed/channels
- Binance depth stream: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
- Bybit orderbook stream: https://bybit-exchange.github.io/docs/v5/websocket/public/orderbook
- Gate.io order book channel: https://www.gate.com/docs/developers/apiv4/ws/en/
- Gemini streams: https://docs.gemini.com/websocket/streams
- Binance klines/ticker: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- Kraken OHLC: https://docs.kraken.com/api/docs/rest-api/get-ohlc-data/
- Coinbase candles: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductcandles
- Coinbase product book: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductbook
- Coinbase product trades: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproducttrades
- Coinbase product ticker: https://docs.cdp.coinbase.com/exchange/reference/exchangerestapi_getproductticker
- Coinbase status API: https://status.coinbase.com/api/v2/status.json
- Kraken market depth: https://docs.kraken.com/api/docs/rest-api/get-order-book/
- Kraken recent trades: https://docs.kraken.com/api/docs/rest-api/get-recent-trades/
- Kraken ticker: https://docs.kraken.com/api/docs/rest-api/get-ticker-information/
- Kraken status API: https://status.kraken.com/api/v2/status.json
- Bitso order book: https://docs.bitso.com/bitso-api/docs/list-order-book
- Bitso available books: https://docs.bitso.com/bitso-api/docs/list-available-books
- Bitso ticker: https://docs.bitso.com/bitso-api/docs/ticker
- Binance symbol price ticker: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- Bitstamp order book: https://www.bitstamp.net/api/
- Bitstamp transactions: https://www.bitstamp.net/api/
- Bitstamp ticker: https://www.bitstamp.net/api/
- Gemini order book: https://developer.gemini.com/rest/market-data
- Gemini trades: https://developer.gemini.com/rest/market-data
- Gemini status API: https://status.gemini.com/api/v2/status.json
- Bitfinex public trades: https://docs.bitfinex.com/reference/rest-public-trades
- Bitfinex status API: https://bitfinex.statuspage.io/api/v2/status.json
- Bitstamp status API: https://status.bitstamp.net/api/v2/status.json
- OKX status API: https://status.okx.com/api/v2/status.json
- Binance aggregate trades: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- KuCoin partial order book: https://www.kucoin.com/docs-new/rest/spot-trading/market-data/get-part-order-book-aggregated-
- KuCoin public WebSocket token: https://www.kucoin.com/docs-new/websocket-api/base-info/get-public-token-spot-margin
- Bitfinex public book: https://docs.bitfinex.com/reference/rest-public-book
- OKX order book: https://www.okx.com/docs-v5/en/#order-book-trading-market-data-get-order-book
- OKX public time: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-system-time
- OKX funding rate: https://www.okx.com/docs-v5/en/#public-data-rest-api-get-funding-rate
- Deribit public ticker: https://docs.deribit.com/#public-ticker
- Deribit option summaries: https://docs.deribit.com/#public-get_book_summary_by_currency
- Deribit index price: https://docs.deribit.com/#public-get_index_price
- BitMEX instrument: https://www.bitmex.com/api/explorer/#!/Instrument/Instrument_get
- Binance ping: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/general-endpoints
- Coinbase time: https://docs.cdp.coinbase.com/coinbase-app/docs/api-time
- mempool.space fees: https://mempool.space/docs/api/rest
- mempool.space projected blocks: https://mempool.space/docs/api/rest
- CoinGecko markets: https://docs.coingecko.com/reference/coins-markets
- CoinGecko Bitcoin tickers: https://docs.coingecko.com/reference/coins-id-tickers
- CoinGecko simple price: https://docs.coingecko.com/reference/simple-price
- Alternative.me Fear & Greed Index: https://alternative.me/crypto/fear-and-greed-index/
- Bayesian Online Changepoint Detection, Adams and MacKay: https://arxiv.org/abs/0710.3742
