from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio

router = APIRouter()
_connections: list[WebSocket] = []


@router.websocket("/ws/progress")
async def progress_ws(ws: WebSocket):
    await ws.accept()
    _connections.append(ws)
    try:
        while True:
            await asyncio.sleep(30)  # keep-alive ping interval
    except WebSocketDisconnect:
        _connections.remove(ws)


async def broadcast(event: dict) -> None:
    dead = []
    for ws in _connections:
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections.remove(ws)
