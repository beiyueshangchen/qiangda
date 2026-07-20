const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

const QUESTION_BANK = [{
    q: '气相色谱仪中实现食品样品各组分分离的核心关键部件为（  ）',
    options: ['A. 气化衬管', 'B. 色谱柱', 'C. FID检测器', 'D. 稳压阀', 'E. 柱温加热丝'],
    answer: 1,
    hasE: true
}, {
    q: '下列组件中，不属于气相色谱气路净化装置的是（  ）',
    options: ['A. 除水分子筛管', 'B. 脱氧活性炭管', 'C. 除烃净化管', 'D. 分流平板', 'E. 气体过滤器'],
    answer: 3,
    hasE: true
}, {
    q: '气化室衬管的主要作用是（  ）',
    options: ['A. 调节载气流速压力', 'B. 承接样品、防止高沸点残渣污染色谱柱', 'C. 对分离后的组分进行信号响应', 'D. 控制色谱柱程序升温速率', 'E. 储存高纯载气气源'],
    answer: 1,
    hasE: true
}, {
    q: '气相色谱温控系统需独立控温的三个区域是（  ）',
    options: ['A. 钢瓶、净化器、色谱柱', 'B. 气化室、柱温箱、检测器', 'C. 分流阀、衬管、毛细管柱', 'D. 氢气路、空气路、载气路', 'E. 采集板、工作站、信号放大器'],
    answer: 1,
    hasE: true
}, {
    q: '在食品气相检测中，氢火焰离子化检测器（FID）最适合测定下列哪一类物质（  ）',
    options: ['A. 有机氯农药、含卤素有机污染物', 'B. 含碳氢的有机化合物（油脂、醇类、农残、溶剂）', 'C. 永久性气体、无机气体（氢气、氧气、氮气）', 'D. 重金属元素、无机金属离子', 'E. 放射性卤素衍生物'],
    answer: 1,
    hasE: true
}, {
    q: '气相色谱进样口隔垫（硅胶密封垫）的核心作用不包括（  ）',
    options: ['A. 穿刺进样时密封气化室，防止载气泄漏', 'B. 隔绝外部空气进入管路，避免氧气氧化色谱柱', 'C. 缓冲进样针穿刺，保护衬管与进样口内部结构', 'D. 吸附样品中高沸点杂质，净化待测组分', 'E. 维持气化室内稳定压力，保证分流效果稳定'],
    answer: 3,
    hasE: true
}, {
    q: '气相色谱分析中，保留时间（tR）是指（  ）',
    options: ['A. 组分从进样到出现色谱峰最大值所需时间', 'B. 组分在固定相中停留的时间', 'C. 死时间', 'D. 组分从进样到开始出峰的时间', 'E. 色谱峰宽度'],
    answer: 0,
    hasE: true
}, {
    q: '气相色谱法分离原理属于（  ）',
    options: ['A. 吸附色谱', 'B. 分配色谱', 'C. 离子交换色谱', 'D. 凝胶色谱', 'E. 亲和色谱'],
    answer: 1,
    hasE: true
}, {
    q: '在气相色谱中，柱温升高，则（  ）',
    options: ['A. 保留时间增加', 'B. 保留时间减少', 'C. 色谱峰变宽', 'D. 分离度增加', 'E. 理论塔板数减少'],
    answer: 1,
    hasE: true
}, {
    q: '气相色谱检测器中，属于通用型检测器的是（  ）',
    options: ['A. FID', 'B. ECD', 'C. TCD', 'D. FPD', 'E. NPD'],
    answer: 2,
    hasE: true
}];

const INITIAL_GROUPS = [
    { id: 0, name: 'A组', score: 0, streak: 0 },
    { id: 1, name: 'B组', score: 0, streak: 0 },
    { id: 2, name: 'C组', score: 0, streak: 0 },
    { id: 3, name: 'D组', score: 0, streak: 0 },
    { id: 4, name: 'E组', score: 0, streak: 0 },
    { id: 5, name: 'F组', score: 0, streak: 0 }
];

const STREAK_BONUS = 5;
const BASE_SCORE = 10;
const PENALTY = -3;

let gameState = {
    currentQuestionIndex: 0,
    roundState: 'idle',
    canBuzz: false,
    isAnswered: false,
    buzzGroupId: null,
    timer: 5,
    groups: JSON.parse(JSON.stringify(INITIAL_GROUPS)),
    logs: [],
    lastAnswerResult: null
};

let countdownInterval = null;
let answerInterval = null;

function resetRoundState() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (answerInterval) {
        clearInterval(answerInterval);
        answerInterval = null;
    }
    gameState.roundState = 'idle';
    gameState.canBuzz = false;
    gameState.buzzGroupId = null;
    gameState.isAnswered = false;
    gameState.timer = 5;
}

function resetGame() {
    resetRoundState();
    gameState.groups = JSON.parse(JSON.stringify(INITIAL_GROUPS));
    gameState.currentQuestionIndex = 0;
    gameState.logs = ['🔄 游戏已重置，分数归零'];
    broadcastState();
}

function broadcastState() {
    io.emit('state_sync', gameState);
}

function addLog(msg, highlight = false) {
    gameState.logs.push({ msg, highlight, time: Date.now() });
    if (gameState.logs.length > 50) {
        gameState.logs.shift();
    }
}

function startCountdown() {
    if (gameState.roundState !== 'idle' && gameState.roundState !== 'answered') return;
    if (gameState.currentQuestionIndex >= QUESTION_BANK.length) {
        addLog('⛔ 题库已用完，重置后再开始', true);
        broadcastState();
        return;
    }

    resetRoundState();
    gameState.roundState = 'countdown';
    gameState.canBuzz = false;
    gameState.timer = 5;

    addLog(`📌 第 ${gameState.currentQuestionIndex + 1} 题开始`);
    broadcastState();

    countdownInterval = setInterval(() => {
        gameState.timer -= 1;
        broadcastState();

        if (gameState.timer <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            gameState.roundState = 'buzzing';
            gameState.canBuzz = true;
            gameState.timer = 0;
            addLog('🔔 抢答开始!', true);
            broadcastState();
        }
    }, 1000);
}

function handleBuzz(groupId) {
    if (!gameState.canBuzz || gameState.roundState !== 'buzzing' || gameState.isAnswered) {
        return { success: false, reason: '当前不可抢答' };
    }

    gameState.canBuzz = false;
    gameState.buzzGroupId = groupId;
    gameState.roundState = 'answering';
    gameState.timer = 10;

    const group = gameState.groups.find(g => g.id === groupId);
    addLog(`⚡ ${group.name} 抢到答题权!`, true);
    broadcastState();

    answerInterval = setInterval(() => {
        gameState.timer -= 1;
        broadcastState();

        if (gameState.timer <= 0) {
            clearInterval(answerInterval);
            answerInterval = null;
            if (!gameState.isAnswered && gameState.roundState === 'answering') {
                const g = gameState.groups.find(gr => gr.id === gameState.buzzGroupId);
                if (g) {
                    g.score += PENALTY;
                    g.streak = 0;
                    addLog(`⏰ ${g.name} 超时 -3 分`, true);
                }
                gameState.roundState = 'answered';
                gameState.isAnswered = true;
                broadcastState();
            }
        }
    }, 1000);

    return { success: true, groupId };
}

function handleAnswer(groupId, selectedIdx) {
    if (gameState.isAnswered || gameState.roundState !== 'answering' || gameState.buzzGroupId !== groupId) {
        return { success: false, reason: '无效操作' };
    }

    gameState.isAnswered = true;
    gameState.canBuzz = false;

    if (answerInterval) {
        clearInterval(answerInterval);
        answerInterval = null;
    }

    const q = QUESTION_BANK[gameState.currentQuestionIndex];
    const correct = q.answer === selectedIdx;
    const group = gameState.groups.find(g => g.id === groupId);

    if (correct) {
        let addScore = BASE_SCORE;
        group.streak += 1;
        if (group.streak >= 3) {
            addScore += STREAK_BONUS;
            addLog(`🔥 ${group.name} 连续3题! 额外+${STREAK_BONUS}`, true);
        }
        group.score += addScore;
        addLog(`✅ ${group.name} 答对! +${addScore} 分 (连击${group.streak})`, true);
    } else {
        group.streak = 0;
        group.score += PENALTY;
        addLog(`❌ ${group.name} 答错 -3 分`, true);
    }

    gameState.roundState = 'answered';
    gameState.lastAnswerResult = {
        correct,
        selectedIdx,
        correctAnswer: q.answer
    };
    broadcastState();

    setTimeout(() => {
        if (gameState.currentQuestionIndex < QUESTION_BANK.length - 1) {
            gameState.currentQuestionIndex++;
            resetRoundState();
            gameState.lastAnswerResult = null;
            addLog(`📌 进入第 ${gameState.currentQuestionIndex + 1} 题`);
        } else {
            addLog('🏁 所有题目结束！查看最终排名', true);
            resetRoundState();
            gameState.lastAnswerResult = null;
        }
        broadcastState();
    }, 2000);

    return { success: true, correct };
}

io.on('connection', (socket) => {
    console.log(`客户端连接: ${socket.id}`);
    socket.role = null;
    socket.emit('state_sync', gameState);

    socket.on('set_role', (role) => {
        socket.role = role;
        if (role === 'teacher') {
            addLog('👨‍🏫 教师已连接');
            broadcastState();
        }
    });

    socket.on('join', (groupId) => {
        socket.groupId = groupId;
        const group = gameState.groups.find(g => g.id === groupId);
        if (group) {
            addLog(`👤 ${group.name} 有成员加入`);
            broadcastState();
        }
    });

    socket.on('start_round', () => {
        if (socket.role !== 'teacher') {
            socket.emit('error', { message: '只有教师可以开始答题' });
            return;
        }
        startCountdown();
    });

    socket.on('buzz', (groupId) => {
        const result = handleBuzz(groupId);
        socket.emit('buzz_result', result);
    });

    socket.on('answer', ({ groupId, selectedIdx }) => {
        const result = handleAnswer(groupId, selectedIdx);
        socket.emit('answer_result', result);
    });

    socket.on('reset_game', () => {
        if (socket.role !== 'teacher') {
            socket.emit('error', { message: '只有教师可以重置游戏' });
            return;
        }
        resetGame();
    });

    socket.on('disconnect', () => {
        console.log(`客户端断开: ${socket.id}`);
    });
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});