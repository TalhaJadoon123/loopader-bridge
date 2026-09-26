import os
import asyncpg
import logging
from decimal import Decimal
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import asyncio

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
MAX_EXPOSURE_USD = Decimal(os.getenv("MAX_EXPOSURE_USD", "20000"))
RISK_CAPITAL_USD = Decimal(os.getenv("RISK_CAPITAL_USD", "10000"))
RISK_POLL_INTERVAL_SEC = int(os.getenv("RISK_POLL_INTERVAL_SEC", "5"))

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


# Symbol contract sizes for notional calculation
CONTRACT_SIZES = {
    "EURUSD": 100000,
    "GBPUSD": 100000,
    "USDJPY": 100000,
    "USDCHF": 100000,
    "USDCAD": 100000,
    "AUDUSD": 100000,
    "NZDUSD": 100000,
    "XAUUSD": 100,
    "XAGUSD": 5000,
    "USOIL": 1000,
    "UKOIL": 1000,
    "BTCUSD": 1,
    "ETHUSD": 1,
}


def get_contract_size(symbol: str) -> int:
    return CONTRACT_SIZES.get(symbol, 100000)


async def update_exposure(
    symbol: str,
    volume: Decimal,
    direction: str,  # "BUY" or "SELL"
    action: str      # "OPEN" or "CLOSE"
) -> Decimal:
    """
    Update broker exposure for a symbol.
    Returns the new net volume.
    """
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Get current exposure
            row = await conn.fetchrow(
                'SELECT "netVolume", "netDirection" FROM "BrokerExposure" WHERE symbol = $1',
                symbol
            )
            
            current_volume = Decimal(str(row["netVolume"])) if row else Decimal("0")
            current_direction = row["netDirection"] if row else "FLAT"
            
            # Calculate delta
            delta = volume if direction == "BUY" else -volume
            if action == "CLOSE":
                delta = -delta  # Closing reverses the effect
            
            new_volume = current_volume + delta
            
            # Determine new direction
            if new_volume > Decimal("0"):
                new_direction = "LONG"
            elif new_volume < Decimal("0"):
                new_direction = "SHORT"
            else:
                new_direction = "FLAT"
            
            # Upsert
            await conn.execute("""
                INSERT INTO "BrokerExposure" (symbol, "netVolume", "netDirection", "updatedAt")
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (symbol) DO UPDATE SET
                    "netVolume" = EXCLUDED."netVolume",
                    "netDirection" = EXCLUDED."netDirection",
                    "updatedAt" = NOW()
            """, symbol, str(new_volume), new_direction)
            
            logger.info(f"Exposure updated: {symbol} net={new_volume} dir={new_direction} (delta={delta}, action={action})")
            return new_volume


async def get_net_exposure(symbol: str) -> Decimal:
    """Get current net exposure volume for a symbol."""
    pool = await get_pool()
    row = await pool.fetchrow(
        'SELECT "netVolume" FROM "BrokerExposure" WHERE symbol = $1',
        symbol
    )
    return Decimal(str(row["netVolume"])) if row else Decimal("0")


async def get_exposure_notional(symbol: str, current_price: Decimal) -> Decimal:
    """Get exposure in USD notional."""
    net_volume = await get_net_exposure(symbol)
    contract_size = get_contract_size(symbol)
    return abs(net_volume) * current_price * Decimal(str(contract_size)) / Decimal("10000")


async def get_all_exposures() -> List[Dict[str, Any]]:
    """Get all exposures with notional values."""
    pool = await get_pool()
    rows = await pool.fetch('SELECT symbol, "netVolume", "netDirection" FROM "BrokerExposure"')
    
    results = []
    for row in rows:
        symbol = row["symbol"]
        net_volume = Decimal(str(row["netVolume"]))
        direction = row["netDirection"]
        
        # Get current price from market data (would need external API in real impl)
        # For now, use a placeholder price
        price_map = {
            "EURUSD": Decimal("1.0850"),
            "GBPUSD": Decimal("1.2700"),
            "USDJPY": Decimal("149.50"),
            "XAUUSD": Decimal("2000.00"),
            "BTCUSD": Decimal("43000.00"),
        }
        price = price_map.get(symbol, Decimal("1.0"))
        
        contract_size = get_contract_size(symbol)
        notional = abs(net_volume) * price * Decimal(str(contract_size)) / Decimal("10000")
        
        # Risk level
        risk_level = "LOW"
        if notional > MAX_EXPOSURE_USD * Decimal("0.8"):
            risk_level = "HIGH"
        elif notional > MAX_EXPOSURE_USD * Decimal("0.5"):
            risk_level = "MEDIUM"
        
        results.append({
            "symbol": symbol,
            "net_volume": float(net_volume),
            "net_direction": direction,
            "notional_usd": float(notional),
            "risk_level": risk_level,
            "max_exposure_usd": float(MAX_EXPOSURE_USD),
            "utilization_pct": float(notional / MAX_EXPOSURE_USD * 100) if MAX_EXPOSURE_USD > 0 else 0
        })
    
    return results


async def should_hedge(symbol: str, current_price: Decimal) -> bool:
    """Check if exposure exceeds max threshold."""
    notional = await get_exposure_notional(symbol, current_price)
    return notional > MAX_EXPOSURE_USD


async def calculate_hedge_size(symbol: str, current_price: Decimal) -> Decimal:
    """Calculate volume needed to hedge back under cap."""
    notional = await get_exposure_notional(symbol, current_price)
    excess = notional - MAX_EXPOSURE_USD
    
    if excess <= 0:
        return Decimal("0")
    
    contract_size = get_contract_size(symbol)
    # Volume in lots to bring exposure back to 80% of cap
    target_notional = MAX_EXPOSURE_USD * Decimal("0.8")
    hedge_notional = notional - target_notional
    hedge_volume = hedge_notional * Decimal("10000") / (current_price * Decimal(str(get_contract_size(symbol))))
    
    # Round to 0.01 lots
    return (hedge_volume * Decimal("100")).quantize(Decimal("1")) / Decimal("100")


async def place_hedge(
    symbol: str,
    volume: Decimal,
    direction: str,
    reason: str,
    provider_ticket: Optional[str] = None
) -> Dict[str, Any]:
    """
    Record a hedge event. In production, this would call an LP API.
    """
    pool = await get_pool()
    
    hedge_id = await pool.fetchval("""
        INSERT INTO "HedgeEvent" (symbol, volume, direction, reason, hedged_at, provider_ticket)
        VALUES ($1, $2, $3, $4, NOW(), $5)
        RETURNING id
    """, symbol, str(volume), direction, reason, provider_ticket)
    
    # Update exposure (hedge reverses the exposure)
    hedge_direction = "SELL" if direction == "BUY" else "BUY"
    await update_exposure(symbol, volume, hedge_direction, "OPEN")
    
    logger.warning(f"HEDGE PLACED: {symbol} {hedge_direction} {volume} lots (reason: {reason}) ticket={provider_ticket}")
    
    return {
        "hedge_id": hedge_id,
        "symbol": symbol,
        "volume": float(volume),
        "direction": hedge_direction,
        "reason": reason,
        "provider_ticket": provider_ticket
    }


async def log_audit(action: str, user_id: Optional[str] = None, payload: Optional[Dict] = None):
    pool = await get_pool()
    import json
    await pool.execute("""
        INSERT INTO "AuditLog" (id, action, "userId", payload, "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, NOW())
    """, action, user_id, json.dumps(payload) if payload else None)


async def reconcile_orders():
    """
    On startup, find all PENDING EngineOrders and re-submit to Rust engine.
    """
    from engine_client import get_engine_client
    from database import get_pool as get_db_pool
    
    pool = await get_db_pool()
    client = await get_engine_client()
    
    async with pool.acquire() as conn:
        pending = await conn.fetch("""
            SELECT eo.id, eo."engineOrderId", eo.symbol, eo.side, eo."orderType", 
                   eo.price, eo.quantity, eo."routingDecision"
            FROM "EngineOrder" eo
            WHERE eo.status = 'PENDING'
        """)
        
        logger.info(f"Reconciling {len(pending)} pending engine orders")
        
        for order in pending:
            try:
                # Check if order already exists in Rust engine
                # (would need a GET /order/:id endpoint in Rust engine)
                # For now, re-submit
                engine_order = {
                    "symbol": order["symbol"],
                    "side": order["side"].lower(),
                    "order_type": order["orderType"].lower(),
                    "price": float(order["price"]) if order["price"] else None,
                    "quantity": float(order["quantity"])
                }
                
                response = await client.submit_order(engine_order)
                
                # Update our record
                await conn.execute("""
                    UPDATE "EngineOrder" SET
                        "engineOrderId" = $1,
                        status = $2,
                        "filledPrice" = $3,
                        updated_at = NOW()
                    WHERE id = $4
                """, response.order_id, response.status, 
                    str(response.filled_price) if response.filled_price else None,
                    order["id"])
                
                logger.info(f"Reconciled order {order['id']} -> {response.order_id}")
            except Exception as e:
                logger.error(f"Failed to reconcile order {order['id']}: {e}")


async def send_admin_alert(subject: str, message: str):
    """Send alert email to admin via Resend."""
    import httpx
    import os
    
    resend_key = os.getenv("RESEND_API_KEY")
    resend_from = os.getenv("RESEND_FROM")
    admin_email = os.getenv("ADMIN_EMAIL")
    
    if not all([resend_key, resend_from, admin_email]):
        logger.warning("Email config missing, skipping admin alert")
        return
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {resend_key}"},
                json={
                    "from": resend_from,
                    "to": [admin_email],
                    "subject": f"[Loopader Risk Alert] {subject}",
                    "html": f"<pre>{message}</pre>"
                }
            )
    except Exception as e:
        logger.error(f"Failed to send admin alert: {e}")