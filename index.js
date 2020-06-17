const { initNodesAndRouter } = require('./Consensus');

const names = [['Node 0', 'leader'], ['Node 1'], ['Node 2']];

const { router, nodes } = initNodesAndRouter('./Raft', names);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
    nodes[0].propose('Foo');
    await sleep(2000);
    const results = await Promise.all(nodes.map((x) => x.current()));
    console.log(
        JSON.stringify(
            results.map((x) => x.logs),
            null,
            4
        )
    );
    nodes.forEach((a) => a.shutdown());
})();
