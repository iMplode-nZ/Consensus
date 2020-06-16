const { parentPort } = require('worker_threads');

let ids;

let data = 'EMPTY';

let isProposing = false;

function handler(message) {
	switch (message[0]) {
		case 'propose':
			isProposing = true;
			parentPort.postMessage(['messageBroadcast', message[1]]);
			break;
		case 'message':
			data = message[2];
			if (isProposing == true) {
				parentPort.postMessage(['finishedPropose', data]);
				isProposing = false;
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