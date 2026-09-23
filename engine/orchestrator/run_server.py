import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn
from fastapi import FastAPI

app = FastAPI()

@app.get('/health')
def health():
    return {'status': 'ok'}

if __name__ == '__main__':
    config = uvicorn.Config(app, host='127.0.0.1', port=8001, loop='asyncio', log_level='debug')
    server = uvicorn.Server(config)
    print('Starting server...', flush=True)
    try:
        asyncio.run(server.serve())
    except KeyboardInterrupt:
        print('Server stopped by user', flush=True)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'Server error: {e}', flush=True)
        input('Press Enter to exit...')