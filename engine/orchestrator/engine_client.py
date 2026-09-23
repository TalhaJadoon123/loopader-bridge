import httpx
from typing import Optional, Dict, Any
from pydantic import BaseModel
import os

ENGINE_URL = os.getenv("ENGINE_URL", "http://localhost:8080")


class OrderRequest(BaseModel):
    symbol: str
    side: str  # "buy" or "sell"
    order_type: str  # "limit" or "market"
    price: Optional[float] = None
    quantity: float


class OrderResponse(BaseModel):
    order_id: str
    status: str
    filled_price: Optional[float] = None


class Level(BaseModel):
    price: float
    quantity: float


class OrderBookResponse(BaseModel):
    symbol: str
    bids: list[Level]
    asks: list[Level]


class PositionResponse(BaseModel):
    order_id: str
    symbol: str
    pnl: float
    status: str


class HealthResponse(BaseModel):
    status: str


class EngineClient:
    def __init__(self, base_url: str = ENGINE_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.client.aclose()

    async def health(self) -> HealthResponse:
        response = await self.client.get(f"{self.base_url}/health")
        response.raise_for_status()
        return HealthResponse(**response.json())

    async def submit_order(self, order: OrderRequest) -> OrderResponse:
        response = await self.client.post(
            f"{self.base_url}/order",
            json=order.model_dump()
        )
        response.raise_for_status()
        return OrderResponse(**response.json())

    async def get_orderbook(self, symbol: str) -> OrderBookResponse:
        response = await self.client.get(f"{self.base_url}/orderbook/{symbol}")
        response.raise_for_status()
        return OrderBookResponse(**response.json())

    async def get_position(self, order_id: str) -> PositionResponse:
        response = await self.client.get(f"{self.base_url}/position/{order_id}")
        response.raise_for_status()
        return PositionResponse(**response.json())

    async def close_order(self, order_id: str) -> PositionResponse:
        response = await self.client.post(f"{self.base_url}/close/{order_id}")
        response.raise_for_status()
        return PositionResponse(**response.json())


# Global client instance
_engine_client: Optional[EngineClient] = None


async def get_engine_client() -> EngineClient:
    global _engine_client
    if _engine_client is None:
        _engine_client = EngineClient()
    return _engine_client


async def close_engine_client():
    global _engine_client
    if _engine_client:
        await _engine_client.close()
        _engine_client = None