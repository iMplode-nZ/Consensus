const { Worker } = require('worker_threads');

function toNamed(nodes) {
    return nodes
        .map((x) => [x.id, x])
        .reduce((obj, x) => {
            obj[x[0]] = x[1];
            return obj;
        }, Object.create(null));
}

function createRouter(outNodes) {
    let nodes = outNodes.slice();

    let nodesByName = toNamed(nodes);

    const toDrop = Object.create(null);
    const dropTo = Object.create(null);

    const router = {
        sendTo(orig, msg, id) {
            const msgts = JSON.stringify(msg, null, 4);
            if (toDrop[orig]) {
                console.log(`Send: ${orig} -| (${msgts})    ${id}`);
                toDrop[orig]--;
            } else if (dropTo[id]) {
                console.log(`Send: ${orig} ---(${msgts})-|  ${id}`);
                dropTo[id]--;
            } else {
                if (!process.argv.includes('--nosend'))
                    console.log(`Send: ${orig} ---(${msgts})--> ${id}`);
                nodesByName[id].receive(orig, msg);
            }
        },
        broadcast(orig, msg) {
            nodes.forEach((x) => this.sendTo(orig, msg, x.id));
        },
        dropNext(node) {
            const location = (typeof node === 'string'
                ? nodesByName[node]
                : node
            ).id;
            if (toDrop[location] == null) toDrop[location] = 0;
            toDrop[location]++;
        },
        nextDrop(node) {
            const location = (typeof node === 'string'
                ? nodesByName[node]
                : node
            ).id;
            if (dropTo[location] == null) dropTo[location] = 0;
            dropTo[location]++;
        },
    };
    nodes.forEach((x) => (x.router = router));
    return router;
}

function createNode(location, name) {
    const w = new Worker(location + '.js');

    let isPaused = false;

    return {
        pause() {
            isPaused = true;
        },
        play() {
            isPaused = false;
        },
        shutdown() {
            w.terminate();
        },
        propose(proposal) {
            if (isPaused) return Promise.reject(new Error('Worker is Paused'));
            w.postMessage(['propose', proposal]);
            return new Promise((resolve) => {
                const listener = (e) => {
                    if (e[0] === 'finishedPropose' && e[1] === proposal) {
                        w.off('message', listener);
                        resolve(e[1]);
                    }
                };
                w.on('message', listener);
            });
        },
        current() {
            return new Promise((resolve) => {
                w.postMessage(['current']);
                const listener = (e) => {
                    if (e[0] === 'current') {
                        w.off('message', listener);
                        resolve(e[1]);
                    }
                };
                w.on('message', listener);
            });
        },
        receive(author, msg) {
            if (isPaused) return;
            setTimeout(() => {
                if (process.argv.includes('--receive'))
                    console.log(`Receive: ${author} ---(${msg})--> ${name}`);
                w.postMessage(['message', author, ...msg]);
            }, Math.random() * 50);
        },
        init(nodes, otherSettings) {
            w.postMessage(['init', nodes, name, otherSettings]);
            w.on('message', (msg) => {
                if (isPaused) return;
                const e = msg.slice();
                const iden = e.shift();
                if (iden === 'message') {
                    this.router.sendTo(name, e.slice(1), e[0]);
                } else if (iden === 'messageBroadcast') {
                    this.router.broadcast(name, e);
                }
            });
        },
        id: name,
    };
}

function initNodesAndRouter(location, names) {
    const nodes = names.map((x) => [createNode(location, x[0]), x[1]]);
    const router = createRouter(nodes.map((x) => x[0]));
    const nodesByName = toNamed(nodes);
    nodes.forEach((x) =>
        x[0].init(
            nodes.map((a) => a[0].id),
            x[1]
        )
    );
    return {
        router: router,
        nodes: nodes.map((x) => x[0]),
        nn: nodesByName,
    };
}

module.exports = {
    createRouter,
    createNode,
    initNodesAndRouter,
};
