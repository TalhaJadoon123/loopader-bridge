import asyncio
import asyncpg
import os
from dotenv import load_dotenv
load_dotenv()

async def test():
    pool = await asyncpg.create_pool(os.getenv('DATABASE_URL'))
    async with pool.acquire() as conn:
        rows = await conn.fetch('SELECT id, "userId" FROM "TradingAccount" LIMIT 5')
        for row in rows:
            print(row['id'], row['userId'])
    await pool.close()

asyncio.run(test())