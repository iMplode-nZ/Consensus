const { parentPort } = require('worker_threads');

let ids;
let index;
let id;

let logs = [[0, 'EMPTY']];
let commitIndex = 0;

let state = 'follower';
let stateArgs = {};

let term = 0;

let currentProposal;

const electionTimeout = Math.random() * 500;

let timeout;

function electionTime() {
    if (timeout != null) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(() => stateChange('candidate'), electionTimeout);
}

function stateChange(changeState, args = {}) {
    console.log(`${id} changed to ${changeState}.`);
    const stateDeactivate = {
        'candidate': () => {},
        'leader': () => {
            clearInterval(stateArgs.heartbeat);
        },
        'follower': () => {}
    }
    stateDeactivate[state]();
    state = changeState;
    const stateActivate = {
        'candidate': () => {
            electionTime();
        },
        'leader': () => {
            propose();
            stateArgs.heartbeat = setInterval(() => {

            }, 750);
        },
        'follower': () => {
            propose();
            electionTime();
        }
    }
    stateActivate[state]();
    stateArgs = args;
}

function handler(message) {
    switch (message.shift()) {
        case 'propose':
            if (state === 'leader') {
                logs.push([term, message.shift()]);
                parentPort.sendMessage(['messageBroadcast', term, 'appendEntries', {
                    prevLogIndex: logs.length - 2,
                    prevLogTerm: logs[logs.length - 2][0],
                    entries: logs.slice(commitIndex),
                    leaderCommit: commitIndex
                }]);
            } else if (state === 'follower') {
                console.log(`${id}: The leader is ${stateArgs.leader}`);
            }
            break;
        case 'message':
            const author = message.shift();
            const otherTerm = message.shift();
            const type = message.shift();
            if (otherTerm > term) {
                stateChange('follower');
            }
            const resolvers = {
                'candidate': () => {
                    if (otherTerm === term) {
                        term = otherTerm;
                        stateChange('follower');
                        resolvers[state]();
                    }
                },
                'leader': () => {
                },
                'follower': () => {
                    stateArgs.electionTime();
                    if (type === 'appendEntries') {
                        const msg = message[0];
                        if (otherTerm < term) return;
                        if (logs[msg.prevLogIndex][0] !== msg.prevLogTerm) return;
                        for (let i = 0; i < msg.entries.length; i++) {
                            const actualIndex = i + msg.prevLogIndex - 1;
                            if (actualIndex < logs.length && logs[actualIndex] !== msg.entries[i]) {
                                logs = logs.slice(0, actualIndex);
                            }
                            logs[actualIndex] = msg.entries[i];
                        }
                        if (msg.leaderCommit > commitIndex) commitIndex = min(msg.leaderCommit, msg.prevLogIndex + msg.entries.length);
                    } else if (type === 'requestVote') {
                        const msg = message[0];
                        if (otherTerm < term) return parentPort.sendMessage(['message', author, term, 'updateTerm']);
                        if (stateArgs.votedFor == null || stateArgs.votedFor === author) {
                            const termDiff = msg.lastLog[0] > logs[logs.length - 1][0];
                            if (termDiff > 0 || (termDiff === 0 && msg.lastLogIndex >= logs.length - 1)) {
                                parentPort.sendMessage(['message', author, term, 'grantVote']);
                            }
                        }
                    }
                }
            }
            resolvers[state]();
            break;
        case 'current':
            parentPort.postMessage(['current', { logs, commitIndex }]);
            break;
    }
}

function initialize(message) {
    if (message[0] == 'init') {
        ids = message[1];
        id = message[2];

        index = ids.indexOf(id);
        parentPort.off('message', initialize);
        parentPort.on('message', handler);
        if (message[3] === 'leader') {
            stateChange('leader');
        } else stateChange('follower');
    }
}

parentPort.on('message', initialize);