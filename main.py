"""Render deployment entrypoint for Loopader TradingAgents Bridge."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bridge import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)