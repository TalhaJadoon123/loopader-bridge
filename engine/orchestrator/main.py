import os
import logging
import asyncio
import sys
from decimal import Decimal
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Optional, List
from dotenv import load_dotenv

# Windows fix: use SelectorEventLoop instead of ProactorEventLoop
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

print("[orchestrator] main.py loaded", flush=True)

from engine_client import EngineClient, get_engine_client, close_engine_client, OrderRequest as EngineOrderRequest
from routing import get_routing_decision, get_user_metrics
from database import init_db, close_db, get_pool as get_db_pool
from risk_engine import (
    update_exposure, should_hedge, calculate_hedge_size, place_hedge,
    get_all_exposures, reconcile_orders, log_audit, send_admin_alert,
    MAX_EXPOSURE_USD, RISK_CAPITAL_USD, RISK_POLL_INTERVAL_SEC
)

load_dotenv()

ORCHESTRATOR_PORT = int(os.getenv("ORCHESTRATOR_PORT", "8000"))
ENGINE_URL = os.getenv("ENGINE_URL", "http://localhost:8080")
USE_ORCHESTRATOR = os.getenv("USE_ORCHESTRATOR", "true").lower() == "true"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Background task for risk polling
_risk_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("[lifespan] startup begin", flush=True)
    logger.info("Lifespan startup starting")
    try:
        await init_db()
        print("[lifespan] db pool ready", flush=True)
        logger.info("Database initialized")
        
        # Connect to Rust engine
        client = EngineClient(os.getenv("ENGINE_URL", "http://localhost:8080"))
        try:
            health = await client.health()
            print(f"[lifespan] Connected to Rust engine: {health.status}", flush=True)
            logger.info(f"Connected to Rust engine: {health.status}")
        except Exception as e:
            print(f"[lifespan] Could not connect to Rust engine: {e}", flush=True)
            logger.warning(f"Could not connect to Rust engine: {e}")
        finally:
            await client.close()
        
        # Reconcile pending orders
        try:
            from risk_engine import reconcile_orders
            await reconcile_orders()
            print("[lifespan] Reconciliation complete", flush=True)
            logger.info("Reconciliation complete")
        except Exception as e:
            print(f"[lifespan] Reconciliation failed: {e}", flush=True)
            logger.error(f"Reconciliation failed: {e}")
        
        # Start background risk polling
        app.state.risk_task = asyncio.create_task(risk_poll_loop())
        print("[lifespan] risk_poll_loop spawned", flush=True)
        logger.info("Risk polling task created")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[lifespan] STARTUP FAILED: {e}", flush=True)
        logger.error(f"Lifespan startup failed: {e}")
        raise
    
    print("[lifespan] startup complete", flush=True)
    
    yield
    
    # Shutdown
    print("[lifespan] shutdown begin", flush=True)
    logger.info("Lifespan shutdown starting")
    if hasattr(app.state, "risk_task") and app.state.risk_task:
        app.state.risk_task.cancel()
        try:
            await app.state.risk_task
        except asyncio.CancelledError:
            pass
        print("[lifespan] risk task cancelled", flush=True)
        logger.info("Risk task cancelled")
    
    await close_engine_client()
    await close_db()
    print("[lifespan] shutdown complete", flush=True)
    logger.info("Lifespan shutdown complete")


app = FastAPI(title="Loopader Orchestrator", lifespan=lifespan)


# Request/Response models
class RouteOrderRequest(BaseModel):
    user_id: str
    symbol: str
    side: str  # "buy" or "sell"
    volume: float


class RouteOrderResponse(BaseModel):
    user_id: str
    symbol: str
    side: str
    volume: float
    book_type: str
    execution_venue: Optional[str] = None
    risk_params: dict = {}


class OrderRequest(BaseModel):
    user_id: str
    symbol: str
    side: str
    order_type: str
    price: Optional[float] = None
    volume: float
    account_type: str = "DEMO"  # "DEMO" or "LIVE"


class OrderResponse(BaseModel):
    order_id: str
    status: str
    filled_price: Optional[float] = None
    routing_decision: Optional[dict] = None
    hedge_decision: Optional[dict] = None


class PositionResponse(BaseModel):
    order_id: str
    symbol: str
    pnl: float
    status: str


class HealthResponse(BaseModel):
    status: str
    engine_connected: bool
    orchestrator: str


# Risk models
class ExposureResponse(BaseModel):
    symbol: str
    net_volume: float
    net_direction: str
    notional_usd: float
    risk_level: str
    max_exposure_usd: float
    utilization_pct: float


class HedgeEventResponse(BaseModel):
    id: str
    symbol: str
    volume: float
    direction: str
    reason: str
    hedged_at: str
    provider_ticket: Optional[str] = None


class ManualHedgeRequest(BaseModel):
    symbol: str
    volume: float
    direction: str  # "LONG" or "SHORT"
    reason: str


async def risk_poll_loop():
    """Background task: every 5 seconds check exposures and hedge if needed."""
    print("[risk_poll_loop] Starting risk polling loop", flush=True)
    logger.info("Starting risk polling loop")
    
    try:
        while True:
            try:
                await asyncio.sleep(RISK_POLL_INTERVAL_SEC)
                
                # Get current prices (placeholder - would use real market data)
                prices = {
                    "EURUSD": 1.0850,
                    "GBPUSD": 1.2700,
                    "USDJPY": 149.50,
                    "XAUUSD": 2000.00,
                    "BTCUSD": 43000.00,
                }
                
                exposures = await get_all_exposures()
                
                for exp in exposures:
                    symbol = exp["symbol"]
                    notional = exp["notional_usd"]
                    risk_level = exp["risk_level"]
                    
                    if notional > MAX_EXPOSURE_USD:
                        price = exp.get("price", 1.0)  # Would come from market data
                        hedge_size = await calculate_hedge_size(symbol, Decimal(str(prices.get(symbol, 1.0))))
                        
                        if hedge_size > 0:
                            # Determine hedge direction (opposite of net exposure)
                            net_dir = exp["net_direction"]
                            hedge_dir = "SELL" if net_dir == "LONG" else "BUY"
                            
                            print(f"[risk_poll_loop] Auto-hedge triggered: {symbol} notional=${exp['notional_usd']:.2f} > ${MAX_EXPOSURE_USD}", flush=True)
                            logger.warning(f"Auto-hedge triggered: {symbol} notional=${exp['notional_usd']:.2f} > ${MAX_EXPOSURE_USD}")
                            
                            hedge_result = await place_hedge(
                                symbol=symbol,
                                volume=hedge_size,
                                direction=hedge_dir,
                                reason="EXPOSURE_CAP"
                            )
                            
                            await log_audit("AUTO_HEDGE", None, {
                                "symbol": symbol,
                                "hedge_size": float(hedge_size),
                                "direction": hedge_dir,
                                "reason": "EXPOSURE_CAP",
                                "notional_before": exp["notional_usd"]
                            })
                            
                            # Send admin alert
                            await send_admin_alert(
                                f"Auto-Hedge Executed: {symbol}",
                                f"Symbol: {symbol}\n"
                                f"Hedge Size: {hedge_size} lots\n"
                                f"Direction: {hedge_dir}\n"
                                f"Reason: EXPOSURE_CAP\n"
                                f"Notional Before: ${exp['notional_usd']:,.2f}\n"
                                f"Max Exposure: ${MAX_EXPOSURE_USD:,.2f}"
                            )
                            
            except asyncio.CancelledError:
                print("[risk_poll_loop] Risk polling loop cancelled", flush=True)
                logger.info("Risk polling loop cancelled")
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"[risk_poll_loop] error: {e}", flush=True)
                logger.error(f"Risk poll error: {e}")
                await asyncio.sleep(1)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[risk_poll_loop] Fatal error: {e}", flush=True)
        logger.error(f"Fatal risk_poll_loop error: {e}")
        # Don't re-raise, keep the loop alive


# Request/Response models
class RouteOrderRequest(BaseModel):
    user_id: str
    symbol: str
    side: str  # "buy" or "sell"
    volume: float


class RouteOrderResponse(BaseModel):
    user_id: str
    symbol: str
    side: str
    volume: float
    book_type: str
    execution_venue: Optional[str] = None
    risk_params: dict = {}


class OrderRequest(BaseModel):
    user_id: str
    symbol: str
    side: str
    order_type: str
    price: Optional[float] = None
    volume: float
    account_type: str = "DEMO"  # "DEMO" or "LIVE"


class OrderResponse(BaseModel):
    order_id: str
    status: str
    filled_price: Optional[float] = None
    routing_decision: Optional[dict] = None
    hedge_decision: Optional[dict] = None


class PositionResponse(BaseModel):
    order_id: str
    symbol: str
    pnl: float
    status: str


class HealthResponse(BaseModel):
    status: str
    engine_connected: bool
    orchestrator: str


# Risk models
class ExposureResponse(BaseModel):
    symbol: str
    net_volume: float
    net_direction: str
    notional_usd: float
    risk_level: str
    max_exposure_usd: float
    utilization_pct: float


class HedgeEventResponse(BaseModel):
    id: str
    symbol: str
    volume: float
    direction: str
    reason: str
    hedged_at: str
    provider_ticket: Optional[str] = None


class ManualHedgeRequest(BaseModel):
    symbol: str
    volume: float
    direction: str  # "LONG" or "SHORT"
    reason: str


@app.get("/health", response_model=HealthResponse)
async def health():
    engine_connected = False
    try:
        client = EngineClient(os.getenv("ENGINE_URL", "http://localhost:8080"))
        health = await client.health()
        engine_connected = health.status == "ok"
        await client.close()
    except Exception:
        engine_connected = False
    
    return HealthResponse(
        status="ok",
        engine_connected=engine_connected,
        orchestrator="loopader-orchestrator"
    )


@app.post("/route_order", response_model=RouteOrderResponse)
async def route_order_endpoint(request: RouteOrderRequest):
    """Get routing decision for an order without executing."""
    from routing import route_order
    from database import get_user_active_account_balance
    
    metrics = await get_user_metrics(request.user_id)
    decision = route_order(request.user_id, request.symbol, request.side, request.volume, metrics)
    return RouteOrderResponse(**decision)


@app.post("/order", response_model=OrderResponse)
async def submit_order(request: OrderRequest, background_tasks: BackgroundTasks):
    """
    Submit order through orchestrator.
    1. Get routing decision
    2. Persist EngineOrder with PENDING status
    3. Forward to Rust engine
    4. Update EngineOrder with result
    5. If B/C_BOOK and filled, update exposure and check hedging
    """
    from database import get_pool as get_db_pool
    from engine_client import OrderRequest as EOR
    from risk_engine import log_audit
    
    # Get routing decision
    metrics = await get_user_metrics(request.user_id)
    routing = await get_routing_decision(
        request.user_id,
        request.symbol,
        request.side,
        request.volume
    )
    
    book_type = routing["book_type"]
    
    # Check if LIVE trading is allowed
    if request.account_type == "LIVE":
        lp_enabled = os.getenv("LP_ENABLED", "false").lower() == "true"
        if not lp_enabled:
            raise HTTPException(
                status_code=403,
                detail="Live trading not yet enabled. The operator is configuring the LP connection. Use your DEMO account to practice."
            )
        # TODO: Call LP adapter when LP_ENABLED=true
        # For now, return 403 since LP is stubbed
        raise HTTPException(
            status_code=403,
            detail="LP not configured. Set LP_ENABLED=true and configure LP_PROVIDER."
        )
    
    # Forward to Rust engine (DEMO only)
    client = await get_engine_client()
    
    engine_order = {
        "symbol": request.symbol,
        "side": request.side,
        "order_type": request.order_type,
        "price": request.price,
        "quantity": request.volume
    }
    
    engine_response = await client.submit_order(EOR(**engine_order))
    
    # Persist EngineOrder
    pool = await get_db_pool()
    engine_order_id = engine_response.order_id
    
    # Get or create a trade ID for this user
    async with pool.acquire() as conn:
        trade_row = await conn.fetchrow("SELECT id FROM \"Trade\" WHERE \"userId\" = $1 LIMIT 1", request.user_id)
        if trade_row:
            trade_id = trade_row["id"]
        else:
            # Create a new trade record
            trade_id = await conn.fetchval("""
                INSERT INTO "Trade" (id, "accountId", "userId", symbol, side, volume, "orderType", "openPrice", status, "openedAt")
                VALUES (gen_random_uuid(), 
                    (SELECT id FROM "TradingAccount" WHERE "userId" = $1 LIMIT 1),
                    $1, $2, $3, $4, $5, $6, 'OPEN', NOW())
                RETURNING id
            """, request.user_id, request.symbol, request.side.upper(), str(request.volume), request.order_type.upper(), str(request.price) if request.price else '0')
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Create EngineOrder record
            await conn.execute("""
                INSERT INTO "EngineOrder" (id, "tradeId", "engineOrderId", symbol, side, "orderType", price, quantity, status, "filledPrice", "routingDecision", "updatedAt")
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            """, trade_id, engine_response.order_id, request.symbol, 
                request.side.upper(), request.order_type.upper(),
                str(request.price) if request.price else None,
                str(request.volume), engine_response.status,
                str(engine_response.filled_price) if engine_response.filled_price else None,
                str(routing).replace("'", '"'))
    
    # Build response
    response = OrderResponse(
        order_id=engine_response.order_id,
        status=engine_response.status,
        filled_price=engine_response.filled_price,
        routing_decision=routing
    )
    
    # If filled and B/C_BOOK, update exposure and check hedging
    if engine_response.status == "filled" and book_type in ("B_BOOK", "C_BOOK"):
        from risk_engine import update_exposure, should_hedge, calculate_hedge_size, place_hedge, log_audit, Decimal
        
        # Update exposure
        direction = "BUY" if request.side.lower() == "buy" else "SELL"
        volume_decimal = Decimal(str(request.volume))
        await update_exposure(request.symbol, volume_decimal, direction, "OPEN")
        
        # Check hedging (using a placeholder price)
        prices = {"EURUSD": Decimal("1.0850"), "GBPUSD": Decimal("1.2700"), "USDJPY": Decimal("149.50"), "XAUUSD": Decimal("2000.00"), "BTCUSD": Decimal("43000.00")}
        price = Decimal(str(prices.get(request.symbol, "1.0")))
        
        if await should_hedge(request.symbol, price):
            hedge_size = await calculate_hedge_size(request.symbol, price)
            if hedge_size > 0:
                # Determine hedge direction (opposite of net exposure)
                net_exposure = await get_net_exposure(request.symbol)
                hedge_dir = "SELL" if net_exposure > 0 else "BUY"
                
                hedge_result = await place_hedge(
                    symbol=request.symbol,
                    volume=hedge_size,
                    direction=hedge_dir,
                    reason="EXPOSURE_CAP"
                )
                
                response.hedge_decision = {
                    "hedged": True,
                    "hedge_id": hedge_result["hedge_id"],
                    "hedge_size": float(hedge_size),
                    "direction": hedge_dir,
                    "reason": "EXPOSURE_CAP"
                }
                
                await log_audit("AUTO_HEDGE", request.user_id, {
                    "symbol": request.symbol,
                    "hedge_size": float(hedge_size),
                    "direction": hedge_dir,
                    "reason": "EXPOSURE_CAP"
                })
                
                await send_admin_alert(
                    f"Auto-Hedge Executed: {request.symbol}",
                    f"Symbol: {request.symbol}\nHedge Size: {hedge_size} lots\nDirection: {hedge_dir}\nReason: EXPOSURE_CAP"
                )
    
    # Log audit
    await log_audit("ORDER_SUBMITTED", request.user_id, {
        "engine_order_id": engine_response.order_id,
        "symbol": request.symbol,
        "side": request.side,
        "volume": request.volume,
        "book_type": book_type,
        "status": engine_response.status
    })
    
    return OrderResponse(
        order_id=engine_response.order_id,
        status=engine_response.status,
        filled_price=engine_response.filled_price,
        routing_decision=routing,
        hedge_decision=response.hedge_decision
    )


@app.get("/orderbook/{symbol}", response_model=dict)
async def get_orderbook(symbol: str):
    client = await get_engine_client()
    try:
        orderbook = await client.get_orderbook(symbol)
        return orderbook.model_dump()
    except Exception as e:
        logger.error(f"Orderbook fetch failed: {e}")
        raise HTTPException(status_code=502, detail=f"Engine error: {e}")


@app.get("/position/{order_id}", response_model=PositionResponse)
async def get_position(order_id: str):
    client = await get_engine_client()
    try:
        position = await client.get_position(order_id)
        return position
    except Exception as e:
        logger.error(f"Position fetch failed: {e}")
        raise HTTPException(status_code=502, detail=f"Engine error: {e}")


@app.post("/close/{order_id}", response_model=PositionResponse)
async def close_order(order_id: str):
    client = await get_engine_client()
    try:
        position = await client.close_order(order_id)
        
        # Update EngineOrder status
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE "EngineOrder" SET status = 'CLOSED', updated_at = NOW()
                WHERE "engineOrderId" = $1
            """, order_id)
        
        # Update exposure (reverse)
        from risk_engine import update_exposure, log_audit, get_net_exposure, should_hedge, calculate_hedge_size, place_hedge, Decimal
        from database import get_pool as get_db_pool
        
        # Get order details to reverse exposure
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            order = await conn.fetchrow("""
                SELECT symbol, side, quantity FROM "EngineOrder" WHERE "engineOrderId" = $1
            """, order_id)
            
            if order:
                direction = "SELL" if order["side"] == "BUY" else "BUY"
                volume = Decimal(str(order["quantity"]))
                await update_exposure(order["symbol"], volume, direction, "CLOSE")
                
                # Re-check hedging after close
                from risk_engine import get_net_exposure, should_hedge, calculate_hedge_size, place_hedge
                prices = {"EURUSD": Decimal("1.0850")}
                price = Decimal(str(prices.get(order["symbol"], "1.0")))
                
                if await should_hedge(order["symbol"], price):
                    hedge_size = await calculate_hedge_size(order["symbol"], price)
                    if hedge_size > 0:
                        net_exposure = await get_net_exposure(order["symbol"])
                        hedge_dir = "SELL" if net_exposure > 0 else "BUY"
                        await place_hedge(order["symbol"], hedge_size, hedge_dir, "EXPOSURE_CAP")
        
        return position
    except Exception as e:
        logger.error(f"Close order failed: {e}")
        raise HTTPException(status_code=502, detail=f"Engine error: {e}")


# --- Risk Endpoints ---

@app.get("/risk/exposure", response_model=List[ExposureResponse])
async def get_exposures():
    """Get all symbol exposures with notional values and risk levels."""
    exposures = await get_all_exposures()
    return exposures


@app.get("/risk/hedges", response_model=List[HedgeEventResponse])
async def get_hedges(limit: int = 50):
    """Get recent hedge events."""
    pool = await get_db_pool()
    rows = await pool.fetch("""
        SELECT id, symbol, volume, direction, reason, hedged_at, provider_ticket
        FROM "HedgeEvent"
        ORDER BY hedged_at DESC
        LIMIT $1
    """, limit)
    
    return [
        HedgeEventResponse(
            id=r["id"],
            symbol=r["symbol"],
            volume=float(r["volume"]),
            direction=r["direction"],
            reason=r["reason"],
            hedged_at=r["hedged_at"].isoformat(),
            provider_ticket=r["provider_ticket"]
        ) for r in rows
    ]


@app.post("/risk/hedge")
async def manual_hedge(request: ManualHedgeRequest):
    """Admin-only manual hedge."""
    from risk_engine import place_hedge, log_audit, Decimal
    
    hedge_result = await place_hedge(
        symbol=request.symbol,
        volume=Decimal(str(request.volume)),
        direction=request.direction,
        reason=request.reason
    )
    
    await log_audit("MANUAL_HEDGE", None, {
        "symbol": request.symbol,
        "volume": request.volume,
        "direction": request.direction,
        "reason": request.reason
    })
    
    return hedge_result


@app.get("/risk/exposure/{symbol}", response_model=ExposureResponse)
async def get_symbol_exposure(symbol: str):
    """Get exposure for a specific symbol."""
    exposures = await get_all_exposures()
    for exp in exposures:
        if exp["symbol"] == symbol:
            return exp
    raise HTTPException(status_code=404, detail=f"No exposure data for {symbol}")


@app.get("/metrics/{user_id}")
async def get_metrics(user_id: str):
    from routing import get_user_metrics
    metrics = await get_user_metrics(user_id)
    return {
        "user_id": user_id,
        "total_trades": metrics.total_trades,
        "wins": metrics.wins,
        "losses": metrics.losses,
        "win_rate": metrics.wins / metrics.total_trades if metrics.total_trades > 0 else 0,
        "consecutive_wins": metrics.consecutive_wins,
        "consecutive_losses": metrics.consecutive_losses,
        "max_trade_size": metrics.max_trade_size,
        "book_type": get_routing_decision(user_id, "EURUSD", "buy", 0.1)["book_type"]
    }


if __name__ == "__main__":
    import uvicorn
    config = uvicorn.Config(
        "main:app",
        host="127.0.0.1",
        port=ORCHESTRATOR_PORT,
        loop="asyncio",
        log_level="debug",
        access_log=True,
    )
    server = uvicorn.Server(config)
    try:
        server.run()
    except Exception as e:
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")