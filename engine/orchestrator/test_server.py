import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get('/health')
def health():
    return {'status': 'ok'}

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8001, loop="asyncio", log_level='info')