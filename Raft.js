const { parentPort } = require('worker_threads');

let ids;
let id;

let logs = [[0, 'EMPTY']];
let commitIndex = 0;

let state = 'follower';
let stateArgs = {};

let term = 0;

let timeout;

function electionTime(candidate = false) {
    if (timeout != null) {
        clearTimeout(timeout);
    }
    const ct = 300 + Math.random(1000);
    const ft = 500 + Math.random() * 500;
    timeout = setTimeout(() => stateChange('candidate'), candidate ? ct : ft);
}

function stateChange(changeState, args = {}) {
    console.log(`${id} changed to ${changeState}.`);
    const stateDeactivate = {
        candidate: () => {},
        leader: () => {
            clearInterval(stateArgs.heartbeat);
        },
        follower: () => {},
    };
    stateDeactivate[state]();
    stateArgs = args;
    state = changeState;
    const stateActivate = {
        candidate: () => {
            term++;
            parentPort.postMessage([
                'messageBroadcast',
                term,
                'requestVote',
                {
                    lastLogIndex: logs.length - 1,
                    lastLog: logs[logs.length - 1],
                },
            ]);
            stateArgs.votes = 1;
            electionTime(true);
        },
        leader: () => {
            stateArgs.confirms = [];
            stateArgs.replyOnIncrease = [];
            clearTimeout(timeout);
            const f = () => {
                parentPort.postMessage([
                    'messageBroadcast',
                    term,
                    'appendEntries',
                    {
                        prevLogIndex: logs.length - 1,
                        prevLogTerm: logs[logs.length - 1][0],
                        entries: [],
                        leaderCommit: commitIndex,
                    },
                ]);
            };
            f();
            stateArgs.heartbeat = setInterval(f, 400);
        },
        follower: () => {
            electionTime();
        },
    };
    stateActivate[state]();
}

function handler(message) {
    switch (message.shift()) {
        case 'propose': {
            const proposal = message.shift();
            if (state === 'leader') {
                logs.push([term, proposal]);
                parentPort.postMessage([
                    'messageBroadcast',
                    term,
                    'appendEntries',
                    {
                        prevLogIndex: logs.length - 2,
                        prevLogTerm: logs[logs.length - 2][0],
                        entries: [[term, proposal]],
                        leaderCommit: commitIndex,
                    },
                ]);
                stateArgs.replyOnIncrease[logs.length - 1] = () => {
                    parentPort.postMessage(['finishedPropose', proposal]);
                };
                return;
            } else if (state === 'follower') {
                console.log(`${id}: The leader is ${stateArgs.leader}`);
            } else if (state === 'candidate') {
                console.log(`${id} is a candidate.`);
            }
            parentPort.postMessage(['finishedPropose', proposal]);
            break;
        }
        case 'message':
            {
                const author = message.shift();
                const otherTerm = message.shift();
                const type = message.shift();
                if (otherTerm > term) {
                    term = otherTerm;
                    stateChange('follower');
                }
                const resolvers = {
                    candidate: () => {
                        if (type === 'grantVote') {
                            stateArgs.votes++;
                            if (stateArgs.votes > ids.length / 2)
                                stateChange('leader');
                        }
                    },
                    leader: () => {
                        if (type === 'requestEntries') {
                            const len = message[0];
                            parentPort.postMessage([
                                'message',
                                author,
                                term,
                                'appendEntries',
                                {
                                    prevLogIndex: len,
                                    prevLogTerm: logs[len][0],
                                    entries: logs.slice(len + 1),
                                    leaderCommit: commitIndex,
                                },
                            ]);
                        } else if (type === 'successfulAppend') {
                            const msg = message[0];
                            for (let i = 0; i < msg.entries.length; i++) {
                                const index = i + msg.prevLogIndex + 1;
                                if (stateArgs.confirms[index] == null)
                                    stateArgs.confirms[index] = Object.create(
                                        null
                                    );
                                stateArgs.confirms[index][author] = true;
                                if (
                                    Object.keys(stateArgs.confirms[index])
                                        .length +
                                        1 >
                                        ids.length / 2 &&
                                    commitIndex === index - 1
                                ) {
                                    commitIndex++;
                                    if (
                                        stateArgs.replyOnIncrease[
                                            commitIndex
                                        ] != null
                                    ) {
                                        stateArgs.replyOnIncrease[
                                            commitIndex
                                        ]();
                                        stateArgs.replyOnIncrease[
                                            commitIndex
                                        ] = null;
                                    }
                                }
                            }
                        }
                    },
                    follower: () => {
                        electionTime();
                        if (type === 'appendEntries') {
                            const msg = message[0];
                            if (otherTerm < term)
                                return parentPort.postMessage([
                                    'message',
                                    author,
                                    term,
                                    'updateTerm',
                                ]);
                            if (
                                logs[msg.prevLogIndex] == null ||
                                logs[msg.prevLogIndex][0] !== msg.prevLogTerm
                            ) {
                                const res = logs[msg.prevLogIndex] == null;
                                parentPort.postMessage([
                                    'message',
                                    author,
                                    term,
                                    'requestEntries',
                                    res
                                        ? logs.length - 1
                                        : msg.prevLogIndex - 1,
                                ]);
                                return;
                            }

                            for (let i = 0; i < msg.entries.length; i++) {
                                const actualIndex = i + msg.prevLogIndex + 1;
                                if (
                                    actualIndex < logs.length &&
                                    JSON.stringify(logs[actualIndex]) !==
                                        JSON.stringify(msg.entries[i])
                                ) {
                                    logs = logs.slice(0, actualIndex);
                                }
                                logs[actualIndex] = msg.entries[i];
                            }
                            if (msg.leaderCommit > commitIndex)
                                commitIndex = Math.min(
                                    msg.leaderCommit,
                                    msg.prevLogIndex + 1 + msg.entries.length
                                );
                            stateArgs.leader = author;
                            parentPort.postMessage([
                                'message',
                                author,
                                term,
                                'successfulAppend',
                                msg,
                            ]);
                        } else if (type === 'requestVote') {
                            const msg = message[0];
                            if (otherTerm < term)
                                return parentPort.postMessage([
                                    'message',
                                    author,
                                    term,
                                    'updateTerm',
                                ]);
                            if (
                                stateArgs.votedFor == null ||
                                stateArgs.votedFor === author
                            ) {
                                const termDiff =
                                    msg.lastLog[0] - logs[logs.length - 1][0];
                                if (
                                    termDiff > 0 ||
                                    (termDiff === 0 &&
                                        msg.lastLogIndex >= logs.length - 1)
                                ) {
                                    parentPort.postMessage([
                                        'message',
                                        author,
                                        term,
                                        'grantVote',
                                    ]);
                                }
                                stateArgs.votedFor = author;
                            }
                        }
                    },
                };
                resolvers[state]();
            }
            break;
        case 'current':
            parentPort.postMessage(['current', { logs, commitIndex, term }]);
            break;
    }
}

function initialize(message) {
    if (message.shift() == 'init') {
        ids = message.shift();
        id = message.shift();

        parentPort.off('message', initialize);
        parentPort.on('message', handler);
        const shift = message.shift();
        if (shift?.state != null) {
            stateChange(shift.state);
        } else {
            stateChange('follower');
        }
        if (shift?.term != null) {
            term = shift.term;
        }
    }
}

parentPort.on('message', initialize);
