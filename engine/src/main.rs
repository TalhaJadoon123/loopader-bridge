use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use fx_core::{MatchResult, MatchingEngine, Order, OrderBook};
use fx_utils::{OrderType, Price, Quantity, Side};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OrderRequest {
    symbol: String,
    side: String,
    order_type: String,
    price: Option<f64>,
    quantity: f64,
}

#[derive(Debug, Serialize)]
struct OrderResponse {
    order_id: String,
    status: String,
    filled_price: Option<f64>,
}

#[derive(Debug, Serialize)]
struct OrderBookResponse {
    symbol: String,
    bids: Vec<LevelResponse>,
    asks: Vec<LevelResponse>,
}

#[derive(Debug, Serialize)]
struct LevelResponse {
    price: f64,
    quantity: f64,
}

#[derive(Debug, Serialize)]
struct PositionResponse {
    order_id: String,
    symbol: String,
    pnl: f64,
    status: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
}

type EngineMap = Arc<RwLock<HashMap<String, Arc<Mutex<MatchingEngine>>>>>;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let engines: EngineMap = Arc::new(RwLock::new(HashMap::new()));

    // Initialize test engine for EURUSD
    let test_engine = Arc::new(Mutex::new(MatchingEngine::new("EURUSD".to_string())));

    // Submit test orders
    {
        let mut engine = test_engine.lock().unwrap();
        let buy_order = Arc::new(Order::new(
            Uuid::new_v4(),
            "EURUSD".to_string(),
            Side::Buy,
            OrderType::Limit,
            Quantity(10000),
            Some(Price(10850)), // 1.0850 * 10000
        ));
        let sell_order = Arc::new(Order::new(
            Uuid::new_v4(),
            "EURUSD".to_string(),
            Side::Sell,
            OrderType::Limit,
            Quantity(10000),
            Some(Price(10850)),
        ));

        let result = engine.match_order(buy_order);
        info!("Test buy result: {} trades", result.trades.len());

        let result = engine.match_order(sell_order);
        info!("Test sell result: {} trades", result.trades.len());
    }

    engines.write().await.insert("EURUSD".to_string(), test_engine);

    let app = Router::new()
        .route("/order", post(submit_order))
        .route("/orderbook/:symbol", get(get_orderbook))
        .route("/position/:order_id", get(get_position))
        .route("/close/:order_id", post(close_order))
        .route("/health", get(health))
        .with_state(engines);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await?;
    info!("Engine server listening on http://0.0.0.0:8080");
    axum::serve(listener, app).await?;

    Ok(())
}

async fn submit_order(
    State(engines): State<EngineMap>,
    Json(payload): Json<OrderRequest>,
) -> Result<Json<OrderResponse>, (StatusCode, Json<OrderResponse>)> {
    let engine = {
        let engines_read = engines.read().await;
        engines_read.get(&payload.symbol).cloned()
    };

    let engine = match engine {
        Some(e) => e,
        None => {
            let mut engines_write = engines.write().await;
            let new_engine = Arc::new(Mutex::new(MatchingEngine::new(payload.symbol.clone())));
            engines_write.insert(payload.symbol.clone(), new_engine.clone());
            new_engine
        }
    };

    let side = match payload.side.to_lowercase().as_str() {
        "buy" => Side::Buy,
        "sell" => Side::Sell,
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(OrderResponse {
                    order_id: "".to_string(),
                    status: "rejected".to_string(),
                    filled_price: None,
                }),
            ))
        }
    };

    let order_type = match payload.order_type.to_lowercase().as_str() {
        "limit" => OrderType::Limit,
        "market" => OrderType::Market,
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(OrderResponse {
                    order_id: "".to_string(),
                    status: "rejected".to_string(),
                    filled_price: None,
                }),
            ))
        }
    };

    let price = payload.price.map(|p| Price((p * 10000.0) as u64));
    if order_type == OrderType::Limit && price.is_none() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(OrderResponse {
                order_id: "".to_string(),
                status: "rejected".to_string(),
                filled_price: None,
            }),
        ));
    }

    let order = Arc::new(Order::new(
        Uuid::new_v4(),
        payload.symbol.clone(),
        side,
        order_type,
        Quantity((payload.quantity * 10000.0) as u64), // Convert lots to micro-units
        price,
    ));

    let mut engine = engine.lock().unwrap();
    let result: MatchResult = engine.match_order(order.clone());

    let order_id = order.id.to_string();
    let filled_price = if !result.trades.is_empty() {
        Some(result.trades[0].price.0 as f64 / 10000.0)
    } else {
        None
    };

    if result.trades.is_empty() {
        Ok(Json(OrderResponse {
            order_id,
            status: "pending".to_string(),
            filled_price,
        }))
    } else {
        Ok(Json(OrderResponse {
            order_id,
            status: "filled".to_string(),
            filled_price,
        }))
    }
}

async fn get_orderbook(
    State(engines): State<EngineMap>,
    Path(symbol): Path<String>,
) -> Result<Json<OrderBookResponse>, (StatusCode, Json<OrderBookResponse>)> {
    let engines_read = engines.read().await;
    let engine = engines_read.get(&symbol).ok_or((
        StatusCode::NOT_FOUND,
        Json(OrderBookResponse {
            symbol: symbol.clone(),
            bids: vec![],
            asks: vec![],
        }),
    ))?;

    let engine = engine.lock().unwrap();
    let orderbook: &OrderBook = engine.orderbook();

    // Use best_bid and best_ask methods
    let bids = if let Some(level) = orderbook.best_bid() {
        vec![LevelResponse {
            price: level.price.0 as f64 / 10000.0,
            quantity: level.total_quantity.0 as f64 / 10000.0,
        }]
    } else {
        vec![]
    };

    let asks = if let Some(level) = orderbook.best_ask() {
        vec![LevelResponse {
            price: level.price.0 as f64 / 10000.0,
            quantity: level.total_quantity.0 as f64 / 10000.0,
        }]
    } else {
        vec![]
    };

    Ok(Json(OrderBookResponse {
        symbol,
        bids,
        asks,
    }))
}

async fn get_position(
    State(_engines): State<EngineMap>,
    Path(order_id): Path<String>,
) -> Result<Json<PositionResponse>, (StatusCode, Json<PositionResponse>)> {
    // In a real implementation, this would track positions
    // For now, return a placeholder
    Ok(Json(PositionResponse {
        order_id,
        symbol: "EURUSD".to_string(),
        pnl: 0.0,
        status: "open".to_string(),
    }))
}

async fn close_order(
    State(_engines): State<EngineMap>,
    Path(order_id): Path<String>,
) -> Result<Json<PositionResponse>, (StatusCode, Json<PositionResponse>)> {
    // In a real implementation, this would cancel/close the order
    Ok(Json(PositionResponse {
        order_id,
        symbol: "EURUSD".to_string(),
        pnl: 0.0,
        status: "closed".to_string(),
    }))
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
    })
}