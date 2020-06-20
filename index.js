const { initNodesAndRouter } = require('./Consensus');

const names = [['Node 0'], ['Node 1'], ['Node 2']];

const { router, nodes } = initNodesAndRouter('./Raft', names);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
    await sleep(5000);
    //await Promise.all([
    //    nodes[0].propose('Foo'),
    //    nodes[0].propose('Bar'),
    //    nodes[1].propose('Foo'),
    //    nodes[1].propose('Bar'),
    //    nodes[2].propose('Foo'),
    //    nodes[2].propose('Bar'),
    //]);
    const results = await Promise.all(nodes.map((x) => x.current()));
    console.log(JSON.stringify(results, null, 4));
    nodes.forEach((a) => a.shutdown());
})();
