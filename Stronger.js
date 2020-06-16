const { parentPort } = require('worker_threads');

let ids;

let data = '';

let conformations = null;
let proposeConformations = -1;

function handler(message) {
    switch (message.shift()) {
        case 'propose':
            conformations = {};
            proposeConformations = 0;
            const interval = setInterval(() => {
                if (proposeConformations === -1) {
                    parentPort.postMessage(['finishedPropose', data]);
                    clearInterval(interval);
                }
                ids.forEach((x, i) => {
                    if (!conformations[ids[i]])
                        parentPort.postMessage(['message', x, 'propose', message[0]])
                });
            }, 500);
            break;
        case 'message':
            const author = message.shift();
            if (message[0] === 'propose') {
                parentPort.postMessage(['message', author, 'received']);
                data = message[1];
            } else if (message[0] === 'received') {
                if (!conformations[author]) proposeConformations++;
                conformations[author] = true;
            }
            if (proposeConformations === ids.length) {
                proposeConformations = -1;
            }
            break;
        case 'current':
            parentPort.postMessage(['current', data]);
            break;
    }
}

function initialize(message) {
    if (message[0] == 'init') {
        ids = message[1];
        parentPort.off('message', initialize);
        parentPort.on('message', handler);
    }
}

parentPort.on('message', initialize);