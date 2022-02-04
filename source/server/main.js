'use strict';

if (typeof window !== 'object')
    require("./server.js").StartServer();
else
    console.error("could not to start server in browser")