"use strict";

const main = require("../../main")

global.p2p = new p2plib()

document.addEventListener('DOMContentLoaded', async () => {
    require("./tab_network.js").Init();
}, false);

