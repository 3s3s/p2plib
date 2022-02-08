'use strict';

const p2p = require("../../../main")

exports.HandleMessage = async function(client)
{
    const responce = {request: "listPeers", params: {uid: client.params.uid, TTL: 3-(client.params.TTL+1), list: await p2p.GetLastSavedPeers() } };

    p2p.broadcastMessage(responce) 

    return;     
}