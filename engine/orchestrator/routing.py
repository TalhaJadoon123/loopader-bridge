from typing import Literal, Dict, Any
from dataclasses import dataclass
import logging
import httpx
import os

from database import get_client_metrics, get_user_active_account_balance

logger = logging.getLogger(__name__)

BookType = Literal["A_BOOK", "B_BOOK", "C_BOOK"]

AI_RISK_API_URL = os.getenv("AI_RISK_API_URL", "http://localhost:3000")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")


@dataclass
class UserMetrics:
    user_id: str
    total_trades: int = 0
    winning_trades: int = 0
    win_rate: float = 0.0
    consecutive_wins: int = 0
    consecutive_losses: int = 0
    avg_volume: float = 0.0
    max_volume: float = 0.0
    uses_stop_loss: bool = False
    avg_leverage: float = 1.0
    account_size: float = 10000.0
    adds_to_losers: bool = False


def classify_client(metrics: UserMetrics, volume: float) -> BookType:
    """
    Classify client into A_BOOK, B_BOOK, or C_BOOK based on real trading data.
    
    Rules in order of priority:
    1. If trade volume > 0.1 lots              → A_BOOK (override)
    2. If consecutive_wins >= 3                → A_BOOK (override)
    3. If total_trades < 10                    → B_BOOK
    4. If win_rate < 0.40                      → B_BOOK
    5. If win_rate > 0.60 AND total_trades >= 20 → A_BOOK
    6. If 0.40 <= win_rate <= 0.60             → C_BOOK
    7. Default fallback                        → B_BOOK
    
    Additional:
    - If uses_stop_loss is False AND avg_volume < 0.05 → B_BOOK
    - If avg_leverage > 500 AND total_trades < 20 → B_BOOK
    """
    win_rate = metrics.win_rate
    
    # Override rules (highest priority)
    if volume > 0.1:
        logger.info(f"User {metrics.user_id}: A_BOOK override - volume {volume} > 0.1")
        return "A_BOOK"
    
    if metrics.consecutive_wins >= 3:
        logger.info(f"User {metrics.user_id}: A_BOOK override - {metrics.consecutive_wins} consecutive wins")
        return "A_BOOK"
    
    # Main classification rules
    if metrics.total_trades < 10:
        logger.info(f"User {metrics.user_id}: B_BOOK - only {metrics.total_trades} trades")
        return "B_BOOK"
    
    if win_rate < 0.40:
        logger.info(f"User {metrics.user_id}: B_BOOK - win rate {win_rate:.2%} < 40%")
        return "B_BOOK"
    
    if win_rate > 0.60 and metrics.total_trades >= 20:
        logger.info(f"User {metrics.user_id}: A_BOOK - win rate {win_rate:.2%} with {metrics.total_trades} trades")
        return "A_BOOK"
    
    if 0.40 <= win_rate <= 0.60:
        logger.info(f"User {metrics.user_id}: C_BOOK - win rate {win_rate:.2%}")
        return "C_BOOK"
    
    # Additional risk signals
    if not metrics.uses_stop_loss and metrics.avg_volume < 0.05:
        logger.info(f"User {metrics.user_id}: B_BOOK - no SL and small avg volume")
        return "B_BOOK"
    
    if metrics.avg_leverage > 500 and metrics.total_trades < 20:
        logger.info(f"User {metrics.user_id}: B_BOOK - high leverage ({metrics.avg_leverage}) with few trades")
        return "B_BOOK"
    
    # Default fallback
    logger.info(f"User {metrics.user_id}: B_BOOK - default fallback")
    return "B_BOOK"


def route_order(
    user_id: str,
    symbol: str,
    side: str,
    volume: float,
    metrics: UserMetrics,
    book_type: BookType,
    source: str = "deterministic"
) -> dict:
    """
    Route order based on client classification.
    Returns routing decision with book type and risk parameters.
    """
    routing = {
        "user_id": user_id,
        "symbol": symbol,
        "side": side,
        "volume": volume,
        "book_type": book_type,
        "execution_venue": None,
        "risk_params": {},
        "routing_source": source,
    }
    
    if book_type == "A_BOOK":
        routing["execution_venue"] = "external_lp"
        routing["risk_params"] = {
            "hedge_immediately": True,
            "max_slippage_bps": 5,
            "partial_fill_allowed": True
        }
    elif book_type == "B_BOOK":
        routing["execution_venue"] = "internal_with_risk_mgmt"
        routing["risk_params"] = {
            "hedge_threshold": 0.5,
            "max_position_per_client": 1.0,
            "require_stop_loss": True,
            "monitor_for_martingale": True
        }
    else:  # C_BOOK
        routing["execution_venue"] = "internal_full"
        routing["risk_params"] = {
            "no_hedge": True,
            "max_position_per_client": 0.5,
            "wider_spreads": True,
            "monitor_for_toxic_flow": True
        }
    
    return routing


async def get_user_metrics(user_id: str) -> UserMetrics:
    """Get user metrics from database with Redis caching."""
    db_metrics = await get_client_metrics(user_id)
    account_balance = await get_user_active_account_balance(user_id)
    
    return UserMetrics(
        user_id=user_id,
        total_trades=db_metrics.get("total_trades", 0),
        winning_trades=db_metrics.get("winning_trades", 0),
        win_rate=db_metrics.get("win_rate", 0.0),
        consecutive_wins=db_metrics.get("consecutive_wins", 0),
        consecutive_losses=db_metrics.get("consecutive_losses", 0),
        avg_volume=db_metrics.get("avg_volume", 0.0),
        max_volume=db_metrics.get("max_volume", 0.0),
        uses_stop_loss=db_metrics.get("uses_stop_loss", False),
        avg_leverage=db_metrics.get("avg_leverage", 1.0),
        account_size=account_balance,
        adds_to_losers=db_metrics.get("adds_to_losers", False)
    )


async def get_ai_risk_analysis(user_id: str) -> dict | None:
    """Call Next.js API for AI risk analysis. Returns None on failure."""
    if not INTERNAL_API_KEY:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{AI_RISK_API_URL}/api/ai/risk/analyze",
                params={"userId": user_id},
                headers={"x-internal-api-key": INTERNAL_API_KEY},
            )
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        logger.warning(f"AI risk analysis failed for user {user_id}: {e}")
    return None


async def get_routing_decision(user_id: str, symbol: str, side: str, volume: float) -> dict:
    """Get full routing decision for an order."""
    metrics = await get_user_metrics(user_id)
    
    # Get deterministic routing decision
    book_type = classify_client(metrics, volume)
    source = "deterministic"
    
    # Get AI analysis and potentially upgrade route (safety first)
    ai_result = await get_ai_risk_analysis(user_id)
    if ai_result and ai_result.get("recommended_route"):
        ai_route = ai_result["recommended_route"]
        # Safety-first: only UPGRADE from B/C to A, never downgrade from A
        if book_type != "A_BOOK" and ai_route == "A_BOOK":
            logger.info(f"User {user_id}: AI upgrade {book_type} -> A_BOOK (reason: {ai_result.get('reason')})")
            book_type = "A_BOOK"
            source = "ai_override"
        elif book_type == "A_BOOK" and ai_route == "B_BOOK":
            logger.info(f"User {user_id}: Keeping A_BOOK despite AI suggesting B_BOOK (safety first)")
            source = "deterministic_overrides_ai"
    
    return route_order(user_id, symbol, side, volume, metrics, book_type, source)