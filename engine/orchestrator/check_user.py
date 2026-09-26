import asyncio
import asyncpg
import os
from dotenv import load_dotenv
load_dotenv()

async def test():
    pool = await asyncpg.create_pool(os.getenv('DATABASE_URL'))
    async with pool.acquire() as conn:
        # Get a user that has both a trading account and trades
        rows = await conn.fetch('''
            SELECT t."userId", ta.id as account_id
            FROM "TradingAccount" ta
            JOIN "Trade" t ON t."accountId" = ta.id
            LIMIT 1
        ''')
        for row in rows:
            print(f"userId: {row['userId']}, accountId: {row['account_id']}")
    await pool.close()

asyncio.run(test())