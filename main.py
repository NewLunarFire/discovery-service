#!/usr/bin/env python
import asyncio
import json
import random
import string
from uuid import UUID, uuid4
import websockets
from websockets.exceptions import ConnectionClosed

from src.encoder import UUIDEncoder

def random_string(k: int):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=k))

async def wsSend(ws, data):
    await ws.send(json.dumps(data, cls=UUIDEncoder))
    print(f"> {data}")

async def create_room(client_id, req):
    room_id = random_string(6)
    rooms[room_id] = {"host" : client_id}
    return {"room_id": room_id}

async def join_room(client_id, req):
    event = {"event": "sdp_offer", "sdp": req["sdp"], "client_id": client_id}
    room_id = req["room_id"]
    host_id = rooms[room_id]["host"]
    ws = clients[host_id]["ws"]
    await wsSend(ws, event)
    return {"host_id": host_id}

async def sdp_answer(client_id, req):
    uuid = UUID(req["client_id"])
    event = {"event": "sdp_answer", "sdp": req["sdp"], "host_id": client_id}
    ws = clients[uuid]["ws"]
    await wsSend(ws, event)
    return {}

async def ice_candiate(client_id, req):
    target = UUID(req["target"])
    event = {"event": "ice_candidate", "candidate": req["candidate"]}
    ws = clients[target]["ws"]
    await wsSend(ws, event)
    return {}

rooms = {}
clients = {}
request_handlers = {
    "create_room": create_room,
    "join_room": join_room,
    "sdp_answer": sdp_answer,
    "ice_candidate": ice_candiate
}

async def hello(websocket, path):
    client_id = uuid4()
    clients[client_id] = {"ws": websocket}

    try:
        async for message in websocket:
            req = json.loads(message)
            print(f"< {req}")

            action = req["action"]
            handler = request_handlers[action]
            response = {"action": action, "id": req["id"]}
            if handler:
                response.update(await handler(client_id, req))

            await wsSend(websocket, response)
    except ConnectionClosed:
        for r in rooms:
            print(rooms[r])

start_server = websockets.serve(hello, "localhost", 8765)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()