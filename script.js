const configuration = {iceServers: [{urls: 'stun:stun.l.google.com:19302'}]};
var id = 1;

console.log("=== WebSocket Test ===")

const ws = new WebSocket("ws://localhost:8765");
const rtc = new RTCPeerConnection(configuration);

rtc.ondatachannel = event => {
    event.channel.send("Hello!");
    event.channel.onmessage = event => console.log(event.data);
}

ws.onmessage = event => {
    const response = JSON.parse(event.data);
    console.log(response);

    if(response.action == "create_room")
        document.getElementById("room_id").textContent = response.room_id;
    
    if(response.event == "sdp_offer") {
        client_id = response.client_id;
        rtc.onicecandidate = e => {
            if(client_id == null)
                console.log("WHOOPS");
            if(e.candidate) wsSend({"id": id++, "action": "ice_candidate", "target": client_id, "candidate": e.candidate});
        }

        rtc.setRemoteDescription(response.sdp)
            .then(() => rtc.createAnswer())
            .then(answer => rtc.setLocalDescription(answer))
            .then(() => wsSend({"id": id++, "action": "sdp_answer", "client_id": client_id, "sdp": rtc.localDescription}));
    }

    if(response.event == "sdp_answer")
    {
        const host_id = response.host_id;
        rtc.onicecandidate = e => {
            if(host_id == null)
                console.log("WOOPS");

            if(e.candidate) wsSend({"id": id++, "action": "ice_candidate", "target": host_id, "candidate": e.candidate});
        }

        rtc.setRemoteDescription(response["sdp"]);
    }

    if(response.event == "ice_candidate")
        rtc.addIceCandidate(response.candidate);
}

document.getElementById("create_room_button").onclick = event => {
    wsSend({"id": id++, "action": "create_room"});
}

document.getElementById("join_room_button").onclick = event => {
    const room_id = document.getElementById("join_room_id").value;

    const sendChannel = rtc.createDataChannel("sendChannel")
    sendChannel.onopen = () => sendChannel.send("Hello World!");
    sendChannel.onmessage = event => console.log(event.data);
    
    rtc.createOffer()
        .then(offer => rtc.setLocalDescription(offer))
        .then(() => wsSend({"id": id++, "action": "join_room", "room_id": room_id, "sdp": rtc.localDescription}));
};

function wsSend(data)
{
    ws.send(JSON.stringify(data));
}