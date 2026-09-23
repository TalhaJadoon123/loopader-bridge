with open('main.py', 'r') as f:
    content = f.read()

# Replace both occurrences
old = '''class OrderRequest(BaseModel):
    user_id: str
    symbol: str
    side: str
    order_type: str
    price: Optional[float] = None
    volume: float


class OrderResponse(BaseModel):'''

new = '''class OrderRequest(BaseModel):
    user_id: str
    symbol: str
    side: str
    order_type: str
    price: Optional[float] = None
    volume: float
    account_type: str = "DEMO"  # "DEMO" or "LIVE"


class OrderResponse(BaseModel):'''

content = content.replace(old, new)
with open('main.py', 'w') as f:
    f.write(content)
print('Done')