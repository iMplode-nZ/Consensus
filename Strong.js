const { parentPort } = require('worker_threads');

let ids;

let data = '';

let proposeConformations = -1;

function handler(message) {
    switch (message.shift()) {
        case 'propose':
            proposeConformations = 0;
            parentPort.postMessage(['messageBroadcast', 'propose', message[0]]);
            break;
        case 'message':
            const author = message.shift();
            if (message[0] === 'propose') {
                parentPort.postMessage(['message', author, 'received']);
                data = message[1];
            } else if (message[0] === 'received') {
                if (proposeConformations === -1) throw new Error('Invalid Received Message');
                proposeConformations++;
            }
            if (proposeConformations === ids.length) {
                parentPort.postMessage(['finishedPropose', data]);
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