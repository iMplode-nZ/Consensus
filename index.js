const { initNodesAndRouter } = require('./Consensus');

const names = ['Node 0', 'Node 1', 'Node 2'];

const { router, nodes, nn } = initNodesAndRouter('./Strongist', names);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    nodes[1].pause();
    await nodes[0].propose('Foo');
    const results = await Promise.all(nodes.map(x => x.current()));
    console.log(results);
    nodes.forEach(a => a.shutdown());
})();
