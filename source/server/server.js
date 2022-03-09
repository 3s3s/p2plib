'use strict';

const g_constants = require('../constants');

const WebSocketServer = require('isomorphic-ws').Server;

if (typeof window !== 'object')
{
    require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    }).on('line', line => {
        require("./terminal").Handle(line);
    })
}

exports.StartServer = function(P2P_protocol)
{
    require("./database").Init();
    require("./peers").Init(P2P_protocol);

    console.log("This Machine IP address: " + require("ip").address())

    const httpsServer = 
        require('https').createServer(P2P_protocol.SSL_options || g_constants.SSL_options)
        .listen(P2P_protocol.my_portSSL || g_constants.my_portSSL, () => {
        console.log("SSL server listening on port "+g_constants.my_portSSL);
    });

    g_constants.WEB_SOCKETS = new WebSocketServer({ server: httpsServer, clientTracking: true, perMessageDeflate: true });

    const interval = setInterval(() => {
            g_constants.WEB_SOCKETS.clients.forEach(ws => {
            if (ws["isAlive"] === false) 
                return ws.terminate();
        
            ws["isAlive"] = false;
        });
    }, 30000);

    g_constants.WEB_SOCKETS.on('connection', (ws, req) => {
        if (g_constants.WEB_SOCKETS.clients.length > 100)
            return ws.terminate();

        let connectedToMe = 0;
        ws["isAlive"] = true;

        g_constants.WEB_SOCKETS.clients.forEach(wsOld => {
            if (wsOld["remote_address"] == req.socket.remoteAddress)
                ws["isAlive"] = false;

            if (wsOld["isAlive"])
                connectedToMe++;
        });

        if (!ws["isAlive"]) return ws.terminate();

        const maxConnections = P2P_protocol.MAX_CONNECTIONS || g_constants.MAX_CONNECTIONS;

        if (connectedToMe > maxConnections)
            ws["connectedToMe"] = connectedToMe;

        console.log("Connected remote address: " + req.socket.remoteAddress)
        
        ws["remote_address"] = req.socket.remoteAddress;

        require("./peers").GetPort(ws);

        require('./reqHandler.js').handleConnection(ws);

    }).on('close', () => {
        clearInterval(interval);
    });
}

process.on('uncaughtException', err => {
  console.error('uncaughtException:' + err.message + "\n" + err.stack);

  process.exit(0);
});


