import os
import asyncpg
from typing import Optional, Dict, Any
import logging
# import redis.asyncio as redis  # Disabled for now
from dotenv import load_dotenv

load_dotenv()

# Use pooled connection for runtime (PgBouncer transaction mode requires statement_cache_size=0)
ORCHESTRATOR_DATABASE_URL = os.getenv("ORCHESTRATOR_DATABASE_URL") or os.getenv("DATABASE_URL")
# REDIS_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").replace("https://", "redis://")
# REDIS_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")

_pool: Optional[asyncpg.Pool] = None
_redis: Optional[Any] = None  # redis.Redis

logger = logging.getLogger(__name__)


async def init_db():
    global _pool, _redis
    if _pool is None:
        # Neon free tier: max 3 connections, statement_cache_size=0 required for PgBouncer
        _pool = await asyncpg.create_pool(
            ORCHESTRATOR_DATABASE_URL,
            min_size=1,
            max_size=3,
            statement_cache_size=0,
            command_timeout=30,
        )
        logger.info("Database pool created (pooled, max_size=3)")
    # Redis disabled for now
    _redis = None


async def close_db():
    global _pool, _redis
    if _pool:
        await _pool.close()
        _pool = None
    if _redis:
        await _redis.close()
        _redis = None


async def get_client_metrics(user_id: str) -> Dict[str, Any]:
    """
    Get real trading metrics for a user from Postgres.
    Redis caching disabled for now.
    """
    # Redis disabled - always fetch from DB
    if not _pool:
        await init_db()
    
    async with _pool.acquire() as conn:
        # Get all closed trades for this user, ordered by closedAt
        rows = await conn.fetch("""
            SELECT 
                t.profit,
                t.volume,
                t.side,
                t."stopLoss",
                t."takeProfit",
                t."accountId",
                ta.leverage,
                t."closedAt"
            FROM "Trade" t
            JOIN "TradingAccount" ta ON t."accountId" = ta.id
            WHERE t."userId" = $1 
              AND t.status = 'CLOSED'
              AND t.profit IS NOT NULL
            ORDER BY t."closedAt" ASC
        """, user_id)
        
        if not rows:
            return {
                "total_trades": 0,
                "winning_trades": 0,
                "win_rate": 0.0,
                "consecutive_wins": 0,
                "consecutive_losses": 0,
                "avg_volume": 0.0,
                "max_volume": 0.0,
                "uses_stop_loss": False,
                "avg_leverage": 1.0,
                "account_size": 10000.0,
                "adds_to_losers": False
            }
        
        total_trades = len(rows)
        winning_trades = sum(1 for r in rows if float(r["profit"]) > 0)
        win_rate = winning_trades / total_trades
        
        # Calculate consecutive wins/losses from most recent
        consecutive_wins = 0
        consecutive_losses = 0
        for r in reversed(rows):
            if float(r["profit"]) > 0:
                if consecutive_losses == 0:
                    consecutive_wins += 1
                else:
                    break
            else:
                if consecutive_wins == 0:
                    consecutive_losses += 1
                else:
                    break
        
        # Average volume
        avg_volume = sum(float(r["volume"]) for r in rows) / total_trades
        max_volume = max(float(r["volume"]) for r in rows)
        
        # Uses stop loss in last 20 trades
        recent_trades = rows[-20:] if len(rows) >= 20 else rows
        uses_stop_loss = any(r["stopLoss"] is not None for r in recent_trades)
        
        # Average leverage
        avg_leverage = sum(r["leverage"] for r in rows) / total_trades
        
        # Account size (from most recent trade's account balance would need another query)
        # For now, use a default or get from user's active account
        account_size = 10000.0
        
        # Check for adding to losers pattern
        # Look for trades in same direction after a loss
        adds_to_losers = False
        if len(rows) >= 3:
            for i in range(1, len(rows)):
                prev = rows[i-1]
                curr = rows[i]
                if float(prev["profit"]) < 0 and curr["side"] == prev["side"]:
                    adds_to_losers = True
                    break
        
        metrics = {
            "total_trades": total_trades,
            "winning_trades": winning_trades,
            "win_rate": round(win_rate, 4),
            "consecutive_wins": consecutive_wins,
            "consecutive_losses": consecutive_losses,
            "avg_volume": round(avg_volume, 4),
            "max_volume": round(max_volume, 4),
            "uses_stop_loss": uses_stop_loss,
            "avg_leverage": round(avg_leverage, 2),
            "account_size": account_size,
            "adds_to_losers": adds_to_losers
        }
        
        return metrics


async def get_user_active_account_balance(user_id: str) -> float:
    """Get user's active trading account balance."""
    if not _pool:
        await init_db()
    async with _pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT balance FROM "TradingAccount"
            WHERE "userId" = $1 AND "isActive" = true
            ORDER BY "createdAt" DESC LIMIT 1
        """, user_id)
        return float(row["balance"]) if row else 10000.0


def get_pool() -> asyncpg.Pool:
    """Get the global database pool."""
    return _pool