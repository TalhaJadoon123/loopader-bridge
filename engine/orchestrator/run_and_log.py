import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn
import subprocess

# Run the server as a subprocess with output captured
with open("server_output.log", "w") as f:
    proc = subprocess.Popen([sys.executable, "main.py"], stdout=f, stderr=subprocess.STDOUT)
    print(f"Server started with PID: {proc.pid}")
    
    # Wait for server to start
    import time
    time.sleep(8)
    
    # Test the health endpoint
    import urllib.request
    for i in range(5):
        try:
            with urllib.request.urlopen("http://127.0.0.1:8000/health") as resp:
                print(f"Health check: {resp.status}")
                print(resp.read().decode())
                break
        except Exception as e:
            print(f"Health check attempt {i+1} failed: {e}")
            time.sleep(1)
    
    # Test the order endpoint
    for i in range(5):
        try:
            import json
            data = json.dumps({"user_id": "cmtlczbzw0001uf2brk8gn1w4", "symbol": "EURUSD", "side": "buy", "order_type": "market", "volume": 0.1}).encode()
            req = urllib.request.Request("http://127.0.0.1:8000/order", data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req) as resp:
                print(f"Order: {resp.status}")
                print(resp.read().decode())
                break
        except Exception as e:
            print(f"Order attempt {i+1} failed: {e}")
            if hasattr(e, 'read'):
                print(f"Response: {e.read().decode()}")
            time.sleep(1)
    
    # Wait a bit more
    time.sleep(2)
    
    # Kill the server
    proc.terminate()
    proc.wait()
    print("Server stopped")
    
    # Read the log
    with open("server_output.log", "r") as f:
        print("\n=== SERVER LOG ===")
        print(f.read())