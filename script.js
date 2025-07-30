document.addEventListener('DOMContentLoaded', () => {
    // Game Elements
    const board = document.getElementById('game-board');
    const scoreEl = document.getElementById('score');
    const clicksEl = document.getElementById('clicks');
    const gameOverEl = document.getElementById('game-over');
    const finalScoreEl = document.getElementById('final-score');

    // Buttons
    
    const normalBtn = document.getElementById('normalBtn');
    const hardBtn = document.getElementById('hardBtn');
    const resetBtn = document.getElementById('resetBtn');
    const restartBtn = document.getElementById('restartBtn');
    const muteBtn = document.getElementById('muteBtn');

    // Audio
    const swapSound = new Audio('sounds/swap.mp3');
    const matchSound = new Audio('sounds/match.mp3');
    const scoreSound = new Audio('sounds/score.mp3');
    const bombSound = new Audio('sounds/bomb.mp3');
    const rainbowSound = new Audio('sounds/rainbow.mp3');
    const allSounds = [swapSound, matchSound, scoreSound, bombSound, rainbowSound];
    let isMuted = false;

    // Game Config
    const boardSize = 8;
    
    const initialClicks = 20;
    let colors = [];

    // Helper to get dynamic panel size
    function getPanelSize() {
        return board.offsetWidth / boardSize;
    }

    const colorMap = {
        'red': '#ff4136',
        'blue': '#0074d9',
        'green': '#2ecc40',
        'yellow': '#ffdc00',
        'orange': '#ff851b',
    };
    const panelTypes = {
        NORMAL: 'normal',
        BOMB: 'bomb',
        RAINBOW: 'rainbow',
        SEALED: 'sealed'
    };

    const scoreHistoryList = document.getElementById('score-history-list');

    // Game State
    let score = 0;
    let clicks = initialClicks;
    let selectedPanel = null;
    let panelElements = [];
    let isProcessing = false;
    let currentDifficulty = 'normal';
    let scoreHistory = [];
    let bombPendingCreation = false;
    let isSealedPanelMode = false;

    // --- Game Setup ---

    function setDifficulty(level) {
        currentDifficulty = level;
        [normalBtn, hardBtn].forEach(btn => btn.classList.remove('selected'));
        if (level === 'normal') {
            normalBtn.classList.add('selected');
            isSealedPanelMode = false;
        } else if (level === 'hard') {
            hardBtn.classList.add('selected');
            isSealedPanelMode = true;
        }

        let colorCount = 4; // 常に4色
        colors = Object.keys(colorMap).slice(0, colorCount);
        startGame();
    }

    async function startGame() {
        score = 0;
        clicks = initialClicks;
        selectedPanel = null;
        isProcessing = true;
        board.innerHTML = '';
        gameOverEl.classList.add('hidden');
        updateInfo();

        panelElements = Array(boardSize).fill(null).map(() => Array(boardSize).fill(null));

        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                const panel = createPanel(r, c, getRandomColor(), panelTypes.NORMAL);
                panelElements[r][c] = panel;
                board.appendChild(panel);
            }
        }

        while (checkForMatches().size > 0) {
            for (let r = 0; r < boardSize; r++) {
                for (let c = 0; c < boardSize; c++) {
                    setPanel(panelElements[r][c], getRandomColor(), panelTypes.NORMAL);
                }
            }
        }
        isProcessing = false;
    }

    function createPanel(row, col, colorName, type) {
        const panel = document.createElement('div');
        panel.dataset.row = row;
        panel.dataset.col = col;
        const currentPanelSize = getPanelSize();
        panel.style.top = `${row * currentPanelSize}px`;
        panel.style.left = `${col * currentPanelSize}px`;

        const panelInner = document.createElement('div');
        panelInner.classList.add('panel-inner');
        panel.appendChild(panelInner);

        setPanel(panel, colorName, type);

        panel.addEventListener('click', () => onPanelClick(panel));
        return panel;
    }

    function setPanel(panel, colorName, type) {
        panel.className = 'panel';
        panel.dataset.colorName = colorName;
        panel.dataset.type = type;

        if (type === panelTypes.NORMAL) {
            panel.classList.add(`color-${colorName}`);
        } else {
            panel.classList.add(`type-${type}`);
        }
    }

    function getRandomColor() {
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // --- Event Handlers ---

    normalBtn.addEventListener('click', () => setDifficulty('normal'));
    hardBtn.addEventListener('click', () => setDifficulty('hard'));
    resetBtn.addEventListener('click', () => setDifficulty(currentDifficulty));
    restartBtn.addEventListener('click', () => setDifficulty(currentDifficulty));

    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        allSounds.forEach(sound => {
            sound.muted = isMuted;
        });
        muteBtn.textContent = isMuted ? 'サウンドON' : 'サウンドOFF';
        muteBtn.classList.toggle('muted', isMuted);
    });

    function onPanelClick(panel) {
        if (isProcessing || !gameOverEl.classList.contains('hidden')) return;

        if (!selectedPanel) {
            panel.classList.add('selected');
            selectedPanel = panel;
        } else {
            if (selectedPanel === panel) {
                selectedPanel.classList.remove('selected');
                selectedPanel = null;
                return;
            }

            const r1 = parseInt(selectedPanel.dataset.row);
            const c1 = parseInt(selectedPanel.dataset.col);
            const r2 = parseInt(panel.dataset.row);
            const c2 = parseInt(panel.dataset.col);

            if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
                swapAndCheck(selectedPanel, panel);
            } else {
                selectedPanel.classList.remove('selected');
                panel.classList.add('selected');
                selectedPanel = panel;
            }
        }
    }

    // --- Game Logic ---

    async function swapAndCheck(panel1, panel2) {
        isProcessing = true;
        if (selectedPanel) selectedPanel.classList.remove('selected');
        selectedPanel = null;

        swapSound.play();
        await swapPanels(panel1, panel2);

        const type1 = panel1.dataset.type;
        const type2 = panel2.dataset.type;
        let matches = new Set();
        let totalChain = 0;
        let fromSpecialEffect = false;

        if (type1 === panelTypes.BOMB || type1 === panelTypes.RAINBOW || type2 === panelTypes.BOMB || type2 === panelTypes.RAINBOW) {
            clicks--;
            updateInfo();
            if (type1 === panelTypes.BOMB && type2 === panelTypes.BOMB) {
                ({ chain: totalChain, fromSpecialEffect } = await handleBombBomb(panel1, panel2));
            } else if (type1 === panelTypes.RAINBOW && type2 === panelTypes.RAINBOW) {
                ({ chain: totalChain, fromSpecialEffect } = await handleRainbowRainbow(panel1, panel2));
            } else if ((type1 === panelTypes.BOMB && type2 === panelTypes.RAINBOW) || (type1 === panelTypes.RAINBOW && type2 === panelTypes.BOMB)) {
                ({ chain: totalChain, fromSpecialEffect } = await handleBombRainbow(panel1, panel2));
            } else if (type1 === panelTypes.BOMB) {
                ({ chain: totalChain, fromSpecialEffect } = await handleBomb(panel1));
            } else if (type2 === panelTypes.BOMB) {
                ({ chain: totalChain, fromSpecialEffect } = await handleBomb(panel2));
            } else if (type1 === panelTypes.RAINBOW) {
                ({ chain: totalChain, fromSpecialEffect } = await handleRainbow(panel1, panel2.dataset.colorName));
            } else if (type2 === panelTypes.RAINBOW) {
                ({ chain: totalChain, fromSpecialEffect } = await handleRainbow(panel2, panel1.dataset.colorName));
            }
        } else {
            matches = checkForMatches();
            if (matches.size > 0) {
                clicks--;
                updateInfo();
                ({ chain: totalChain, fromSpecialEffect } = await handleMatches(matches, 1, panel1, panel2, false));
            } else {
                await swapPanels(panel1, panel2); // Swap back
            }
        }

        if (totalChain >= 5) {
            const emptyPanels = panelElements.flat().filter(p => p && p.dataset.type === panelTypes.NORMAL);
            if (emptyPanels.length > 0) {
                const randomPanel = emptyPanels[Math.floor(Math.random() * emptyPanels.length)];
                setPanel(randomPanel, '', panelTypes.RAINBOW);
            }
        }

        if (clicks <= 0 && gameOverEl.classList.contains('hidden')) {
            endGame();
        }

        if (bombPendingCreation) {
            const normalPanels = panelElements.flat().filter(p => p && p.dataset.type === panelTypes.NORMAL);
            if (normalPanels.length > 0) {
                const randomPanel = normalPanels[Math.floor(Math.random() * normalPanels.length)];
                setPanel(randomPanel, '', panelTypes.BOMB);
            }
            bombPendingCreation = false;
        }

        isProcessing = false;
    }

    async function handleMatches(matches, chain, swipedPanel1, swipedPanel2, isSpecialPanelEffect = false) {
        const matchSize = matches.size;
        
        if (matchSize >= 5) {
            if (swipedPanel1) {
                const swipedPanel = Array.from(matches).includes(swipedPanel1) ? swipedPanel1 : swipedPanel2;
                setPanel(swipedPanel, '', panelTypes.BOMB);
                matches.delete(swipedPanel);
            } else if (!isSpecialPanelEffect) {
                bombPendingCreation = true;
            }
        }

        matchSound.play();
        if (chain > 1) {
            board.classList.add('chain-effect');
            setTimeout(() => board.classList.remove('chain-effect'), 500);
        }

        let scoreMultiplier = 1;
        if (currentDifficulty === 'normal') {
            scoreMultiplier = 1 + (chain - 1) * 0.2; // 例: 1連鎖:1倍, 2連鎖:1.2倍, 3連鎖:1.4倍
        } else if (currentDifficulty === 'hard') {
            if (chain <= 2) {
                scoreMultiplier = 1 + (chain - 1) * 0.2; // 1-2連鎖は「普通」と同じ倍率
            } else {
                // 3連鎖以上で加速
                scoreMultiplier = (1 + (2 - 1) * 0.2) + (chain - 2) * 0.6; // 2連鎖目の倍率を基準に加算
            }
        }
        const scoreToAdd = matchSize * scoreMultiplier;
        score += scoreToAdd;
        updateInfo();
        if (scoreToAdd > 0) {
            const firstPanel = Array.from(matches)[0];
            showScorePopup(scoreToAdd, parseInt(firstPanel.dataset.row), parseInt(firstPanel.dataset.col));
        }

        await removeMatches(matches);
        await dropPanels();
        await fillEmptyPanels();

        const newMatches = checkForMatches();
        if (newMatches.size > 0) {
            return await handleMatches(newMatches, chain + 1, null, null, isSpecialPanelEffect);
        }
        // 封印パネル生成ロジック
        if (isSealedPanelMode && matches.size > 0) { // 何らかのパネルが消えた場合
            const normalPanels = panelElements.flat().filter(p => p && p.dataset.type === panelTypes.NORMAL);
            if (normalPanels.length > 0) {
                // Shuffle the array to get random panels
                const shuffledPanels = normalPanels.sort(() => 0.5 - Math.random());
                const panelsToSeal = shuffledPanels.slice(0, 2); // Get the first two
                panelsToSeal.forEach(panel => {
                    setPanel(panel, '', panelTypes.SEALED);
                });
            }
        }
        return { chain: chain, fromSpecialEffect: isSpecialPanelEffect }; // Return the final chain count and special effect status
    }

    // --- Special Handlers ---
    async function handleBomb(bombPanel) {
        bombSound.play();
        const r = parseInt(bombPanel.dataset.row);
        const c = parseInt(bombPanel.dataset.col);
        const panelsToClear = new Set([bombPanel]);
        for (let i = r - 1; i <= r + 1; i++) {
            for (let j = c - 1; j <= c + 1; j++) {
                if (i >= 0 && i < boardSize && j >= 0 && j < boardSize && panelElements[i][j]) {
                    panelsToClear.add(panelElements[i][j]);
                }
            }
        }
        const { chain, fromSpecialEffect } = await handleMatches(panelsToClear, 1, null, null, true);
        return { chain, fromSpecialEffect };
    }

    async function handleRainbow(rainbowPanel, color) {
        rainbowSound.play();
        const panelsToClear = new Set([rainbowPanel]);
        panelElements.flat().forEach(p => {
            if (p && p.dataset.colorName === color) {
                panelsToClear.add(p);
            }
        });
        const { chain, fromSpecialEffect } = await handleMatches(panelsToClear, 1, null, null, true);
        return { chain, fromSpecialEffect };
    }

    async function handleBombBomb(panel1, panel2) {
        bombSound.play();
        const panelsToClear = new Set(panelElements.flat().filter(p => p));
        const scoreToAdd = 1000;
        score += scoreToAdd;
        updateInfo();
        showScorePopup(scoreToAdd, parseInt(panel1.dataset.row), parseInt(panel1.dataset.col));
        const { chain, fromSpecialEffect } = await handleMatches(panelsToClear, 1, null, null, true);
        return { chain, fromSpecialEffect };
    }
    async function handleRainbowRainbow(panel1, panel2) {
        rainbowSound.play();
        return await handleBombBomb(panel1, panel2);
    }
    async function handleBombRainbow(panel1, panel2) {
        bombSound.play();
        rainbowSound.play();
        return await handleBombBomb(panel1, panel2);
    }

    function swapPanels(panel1, panel2) {
        return new Promise(resolve => {
            const r1 = parseInt(panel1.dataset.row), c1 = parseInt(panel1.dataset.col);
            const r2 = parseInt(panel2.dataset.row), c2 = parseInt(panel2.dataset.col);

            [panelElements[r1][c1], panelElements[r2][c2]] = [panelElements[r2][c2], panelElements[r1][c1]];

            panel1.dataset.row = r2; panel1.dataset.col = c2;
            panel2.dataset.row = r1; panel2.dataset.col = c1;

            const currentPanelSize = getPanelSize();
            panel1.style.top = `${r2 * currentPanelSize}px`;
            panel1.style.left = `${c2 * currentPanelSize}px`;
            panel2.style.top = `${r1 * currentPanelSize}px`;
            panel2.style.left = `${c1 * currentPanelSize}px`;

            setTimeout(resolve, 300);
        });
    }

    function checkForMatches() {
        const matches = new Set();
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize - 2; c++) {
                const p1 = panelElements[r][c];
                if (p1 && p1.dataset.type === panelTypes.NORMAL) {
                    const color = p1.dataset.colorName;
                    const p2 = panelElements[r][c + 1];
                    const p3 = panelElements[r][c + 2];
                    if (p2 && p2.dataset.type === panelTypes.NORMAL && p3 && p3.dataset.type === panelTypes.NORMAL &&
                        p2.dataset.colorName === color && p3.dataset.colorName === color) {
                        matches.add(p1); matches.add(p2); matches.add(p3);
                    }
                }
            }
        }
        for (let c = 0; c < boardSize; c++) {
            for (let r = 0; r < boardSize - 2; r++) {
                const p1 = panelElements[r][c];
                if (p1 && p1.dataset.type === panelTypes.NORMAL) {
                    const color = p1.dataset.colorName;
                    const p2 = panelElements[r + 1][c];
                    const p3 = panelElements[r + 2][c];
                    if (p2 && p2.dataset.type === panelTypes.NORMAL && p3 && p3.dataset.type === panelTypes.NORMAL &&
                        p2.dataset.colorName === color && p3.dataset.colorName === color) {
                        matches.add(p1); matches.add(p2); matches.add(p3);
                    }
                }
            }
        }
        return matches;
    }

    function removeMatches(matches) {
        return new Promise(resolve => {
            const panelsToRemove = [];
            const panelsToUnseal = new Set();

            matches.forEach(panel => {
                if(panel) {
                    panelsToRemove.push(panel);
                    panel.classList.add('matched');
                    panel.dataset.colorName = '';

                    // Check neighbors for sealed panels
                    const r = parseInt(panel.dataset.row);
                    const c = parseInt(panel.dataset.col);
                    getNeighbors(r, c).forEach(neighbor => {
                        if (neighbor && neighbor.dataset.type === panelTypes.SEALED) {
                            panelsToUnseal.add(neighbor);
                        }
                    });
                }
            });

            setTimeout(() => {
                panelsToRemove.forEach(panel => {
                    if (panel && panel.parentNode === board) {
                        board.removeChild(panel);
                        const r = parseInt(panel.dataset.row);
                        const c = parseInt(panel.dataset.col);
                        panelElements[r][c] = null;
                    }
                });

                panelsToUnseal.forEach(panel => {
                    if (panel) {
                        setPanel(panel, getRandomColor(), panelTypes.NORMAL); // Unseal and give a random color
                    }
                });
                resolve();
            }, 400);
        });
    }

    // Helper function to get adjacent panels
    function getNeighbors(row, col) {
        const neighbors = [];
        const directions = [
            { dr: -1, dc: 0 }, { dr: 1, dc: 0 },
            { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
        ];

        directions.forEach(dir => {
            const newRow = row + dir.dr;
            const newCol = col + dir.dc;
            if (newRow >= 0 && newRow < boardSize && newCol >= 0 && newCol < boardSize) {
                const neighborPanel = panelElements[newRow][newCol];
                if (neighborPanel) {
                    neighbors.push(neighborPanel);
                }
            }
        });
        return neighbors;
    }

    async function dropPanels() {
        let promises = [];
        for (let c = 0; c < boardSize; c++) {
            let emptySlots = 0;
            for (let r = boardSize - 1; r >= 0; r--) {
                if (panelElements[r][c] === null) {
                    emptySlots++;
                } else if (emptySlots > 0) {
                    const panel = panelElements[r][c];
                    const newRow = r + emptySlots;
                    panelElements[newRow][c] = panel;
                    panelElements[r][c] = null;
                    panel.dataset.row = newRow;
                    panel.style.top = `${newRow * getPanelSize()}px`;
                    promises.push(new Promise(res => setTimeout(res, 500)));
                }
            }
        }
        await Promise.all(promises);
    }

    async function fillEmptyPanels() {
        let promises = [];
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (panelElements[r][c] === null) {
                    const panel = createPanel(r, c, getRandomColor(), panelTypes.NORMAL);
                    panelElements[r][c] = panel;
                    board.appendChild(panel);
                    panel.classList.add('new');
                    const animPromise = new Promise(resolve => {
                        setTimeout(() => {
                            panel.classList.remove('new');
                            resolve();
                        }, 300);
                    });
                    promises.push(animPromise);
                }
            }
        }
        await Promise.all(promises);
    }

    // --- UI Update ---

    function updateInfo() {
        scoreEl.textContent = Math.round(score);
        clicksEl.textContent = clicks;
    }

    function showScorePopup(amount, row, col) {
        const popup = document.createElement('div');
        popup.classList.add('score-popup');
        popup.textContent = `+${Math.round(amount)}`;
        const currentPanelSize = getPanelSize();
        popup.style.left = `${col * currentPanelSize + currentPanelSize / 2}px`;
        popup.style.top = `${row * currentPanelSize + currentPanelSize / 2}px`;
        board.appendChild(popup);

        popup.addEventListener('animationend', () => {
            popup.remove();
        });
    }

    function endGame() {
        isProcessing = true;
        scoreSound.play();
        finalScoreEl.textContent = Math.round(score);
        gameOverEl.classList.remove('hidden');
        addScoreToHistory(score, currentDifficulty);
    }

    function addScoreToHistory(finalScore, difficulty) {
        const difficultyText = {
            'normal': '普通',
            'hard': '難しい'
        }[difficulty];

        const scoreEntry = {
            score: finalScore,
            difficulty: difficultyText,
            date: new Date().toLocaleTimeString('ja-JP')
        };

        scoreHistory.unshift(scoreEntry);
        if (scoreHistory.length > 10) {
            scoreHistory.pop();
        }
        updateScoreHistoryUI();
    }

    function updateScoreHistoryUI() {
        scoreHistoryList.innerHTML = '';
        scoreHistory.forEach(entry => {
            const li = document.createElement('li');
            li.textContent = `${entry.date} - ${entry.difficulty}: ${Math.round(entry.score)}点`;
            scoreHistoryList.appendChild(li);
        });
    }

    // --- Initial Start ---
    setDifficulty('normal');

    // Update panel positions on resize
    function updatePanelPositions() {
        const currentPanelSize = getPanelSize();
        panelElements.flat().forEach(panel => {
            if (panel) {
                const r = parseInt(panel.dataset.row);
                const c = parseInt(panel.dataset.col);
                panel.style.top = `${r * currentPanelSize}px`;
                panel.style.left = `${c * currentPanelSize}px`;
            }
        });
    }

    window.addEventListener('resize', updatePanelPositions);
});
