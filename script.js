// ÉTAT DU JEU ET CONFIGURATION
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const currentScoreElement = document.getElementById('current-score');
const bestScoreElement = document.getElementById('best-score');
const gameOverElement = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');
const changeUserBtn = document.getElementById('change-user-btn');

const profileScreen = document.getElementById('profile-screen');
const gameUI = document.getElementById('game-ui');
const usernameInput = document.getElementById('username-input');
const startBtn = document.getElementById('start-btn');
const displayUsername = document.getElementById('display-username');
const leaderboardBody = document.getElementById('leaderboard-body');

// Paramètres de la grille
const gridSize = 20;
const tileCount = canvas.width / gridSize;

// État Global
let currentUser = "";
let localScores = JSON.parse(localStorage.getItem('snakeHistory')) || [];

// État du jeu
let snake = [];
let food = { x: 5, y: 5 };
let bigFood = null; // { x, y, spawnTime }
let regularApplesEaten = 0;
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let score = 0;
let bestScore = 0;
let initialBestScore = 0;
let speed = 200; // Plus lent au départ (était 150)
let isGameOver = false;
let gameTimeout;

// --- GESTION DE L'HISTORIQUE LOCAL ---

function renderLeaderboard() {
    const sorted = [...localScores].sort((a, b) => b.score - a.score).slice(0, 50);
    leaderboardBody.innerHTML = sorted.map((entry, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${entry.username}</td>
            <td>${entry.score}</td>
        </tr>
    `).join('');
}

renderLeaderboard();

function saveScoreLocally() {
    if (score <= 0) return;
    localScores.push({
        username: currentUser,
        score: score,
        timestamp: new Date().getTime()
    });
    localScores.sort((a, b) => b.score - a.score);
    if (localScores.length > 100) localScores = localScores.slice(0, 100);
    localStorage.setItem('snakeHistory', JSON.stringify(localScores));
    renderLeaderboard();
}

// --- GESTION DES PROFILS ---

startBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        loginUser();
    } else {
        alert("Entre un pseudo !");
    }
});

function loginUser() {
    profileScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    displayUsername.innerText = currentUser;
    const userScores = localScores.filter(s => s.username === currentUser);
    bestScore = userScores.length > 0 ? Math.max(...userScores.map(s => s.score)) : 0;
    initialBestScore = bestScore;
    init();
}

changeUserBtn.addEventListener('click', () => {
    gameUI.classList.add('hidden');
    profileScreen.classList.remove('hidden');
    gameOverElement.classList.add('hidden');
    isGameOver = true;
    if (gameTimeout) clearTimeout(gameTimeout);
    renderLeaderboard();
});

// --- LOGIQUE DU JEU ---

function init() {
    snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    dx = 0; dy = -1; nextDx = 0; nextDy = -1;
    score = 0;
    regularApplesEaten = 0;
    bigFood = null;
    speed = 200;
    
    const userScores = localScores.filter(s => s.username === currentUser);
    bestScore = userScores.length > 0 ? Math.max(...userScores.map(s => s.score)) : 0;
    initialBestScore = bestScore;
    
    currentScoreElement.innerText = score;
    bestScoreElement.innerText = bestScore;
    bestScoreElement.style.color = 'inherit'; 
    bestScoreElement.style.textShadow = 'none';
    gameOverElement.classList.add('hidden');
    
    createFood();
    if (gameTimeout) clearTimeout(gameTimeout);
    gameLoop();
}

function createFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);
    if (snake.some(part => part.x === food.x && part.y === food.y)) createFood();
}

function spawnBigFood() {
    bigFood = {
        x: Math.floor(Math.random() * tileCount),
        y: Math.floor(Math.random() * tileCount),
        spawnTime: Date.now()
    };
    // Éviter de spawner sur le serpent ou la nourriture normale
    if (snake.some(p => p.x === bigFood.x && p.y === bigFood.y) || (bigFood.x === food.x && bigFood.y === food.y)) {
        spawnBigFood();
    }
}

function gameLoop() {
    if (isGameOver) return;
    
    // Gérer l'expiration de la grosse pomme
    if (bigFood) {
        const elapsed = (Date.now() - bigFood.spawnTime) / 1000;
        if (elapsed >= 5) {
            bigFood = null;
        }
    }

    gameTimeout = setTimeout(() => {
        update();
        draw();
        gameLoop();
    }, speed);
}

function checkBestScore() {
    if (score > bestScore) {
        bestScore = score;
        bestScoreElement.innerText = bestScore;
        if (score > initialBestScore) {
            bestScoreElement.style.color = '#ffd700'; 
            bestScoreElement.style.textShadow = '0 0 10px #ffd700';
        }
    }
}

function update() {
    dx = nextDx; dy = nextDy;
    let head = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    if (snake.some(part => part.x === head.x && part.y === head.y)) {
        return gameOver();
    }

    snake.unshift(head);

    // Collision Pomme Normale
    if (head.x === food.x && head.y === food.y) {
        score += 1;
        regularApplesEaten++;
        currentScoreElement.innerText = score;
        checkBestScore();
        
        if (regularApplesEaten >= 3) {
            spawnBigFood();
            regularApplesEaten = 0;
        }
        
        // VITESSE : Augmente seulement après 10 pommes mangées
        if (score > 10 && speed > 40) {
            speed -= 5; // Augmentation graduelle
        }
        
        createFood();
    } 
    // Collision Grosse Pomme
    else if (bigFood && head.x === bigFood.x && head.y === bigFood.y) {
        const elapsed = (Date.now() - bigFood.spawnTime) / 1000;
        const points = Math.max(1, Math.ceil(5 - elapsed));
        score += points;
        currentScoreElement.innerText = score;
        checkBestScore();

        // On augmente aussi la vitesse pour la grosse pomme si le score > 10
        if (score > 10 && speed > 40) {
            speed -= 5;
        }

        bigFood = null;
    }
    else {
        snake.pop();
    }
}

function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // NOURRITURE NORMALE (Vert)
    ctx.shadowBlur = 15; ctx.shadowColor = '#39ff14'; ctx.fillStyle = '#39ff14';
    ctx.beginPath(); ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/2.5, 0, Math.PI * 2); ctx.fill();

    // GROSSE POMME (Rouge avec Compte à rebours)
    if (bigFood) {
        const elapsed = (Date.now() - bigFood.spawnTime) / 1000;
        const timeLeft = Math.max(1, Math.ceil(5 - elapsed));
        const centerX = bigFood.x * gridSize + gridSize / 2;
        const centerY = bigFood.y * gridSize + gridSize / 2;

        ctx.shadowBlur = 20; ctx.shadowColor = '#ff0000'; ctx.fillStyle = '#ff0000';
        ctx.beginPath(); ctx.arc(centerX, centerY, gridSize/1.2, 0, Math.PI * 2); ctx.fill();
        
        // Texte du compte à rebours
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText(timeLeft, centerX, centerY + 5);
    }

    // DESSIN DU CORPS (FLUIDE ROUGE)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = gridSize - 4; ctx.strokeStyle = '#ff0000';
    ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000';

    ctx.beginPath();
    for (let i = 0; i < snake.length; i++) {
        const x = snake[i].x * gridSize + gridSize / 2;
        const y = snake[i].y * gridSize + gridSize / 2;
        if (i === 0) ctx.moveTo(x, y);
        else {
            const prevX = snake[i-1].x; const prevY = snake[i-1].y;
            if (Math.abs(snake[i].x - prevX) > 1 || Math.abs(snake[i].y - prevY) > 1) {
                ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
            } else ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // DÉTAILS SERPENT
    snake.forEach((part, index) => {
        const centerX = part.x * gridSize + gridSize / 2;
        const centerY = part.y * gridSize + gridSize / 2;

        if (index === 0) {
            ctx.save(); ctx.translate(centerX, centerY);
            let rotation = 0;
            if (dx === 1) rotation = 0; if (dx === -1) rotation = Math.PI;
            if (dy === 1) rotation = Math.PI / 2; if (dy === -1) rotation = -Math.PI / 2;
            ctx.rotate(rotation);
            ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.ellipse(2, 0, gridSize/1.5, gridSize/1.8, 0, 0, Math.PI * 2); ctx.fill();
            
            // Bouche (Vérifie aussi la grosse pomme)
            const distNormal = Math.abs(part.x - food.x) + Math.abs(part.y - food.y);
            const distBig = bigFood ? Math.abs(part.x - bigFood.x) + Math.abs(part.y - bigFood.y) : 999;
            if (distNormal === 1 || distBig === 1) {
                ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, gridSize/1.6, -0.5, 0.5); ctx.fill();
            }
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3, -4, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(3, 4, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(4, -4, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, 4, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } else {
            ctx.shadowBlur = 0; ctx.fillStyle = '#ffff00';
            ctx.beginPath(); ctx.arc(centerX, centerY - 2, 2.5, 0, Math.PI * 2); ctx.fill();
            if (index % 2 === 0) { ctx.beginPath(); ctx.arc(centerX + 4, centerY + 3, 1.5, 0, Math.PI * 2); ctx.fill(); }
        }
    });
}

function drawGrid() {
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath(); ctx.moveTo(i * gridSize, 0); ctx.lineTo(i * gridSize, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * gridSize); ctx.lineTo(canvas.width, i * gridSize); ctx.stroke();
    }
}

function gameOver() {
    isGameOver = true;
    saveScoreLocally();
    gameOverElement.classList.remove('hidden');
}

window.addEventListener('keydown', e => {
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) e.preventDefault();
    switch (e.key) {
        case 'ArrowUp': if (dy !== 1) { nextDx = 0; nextDy = -1; } break;
        case 'ArrowDown': if (dy !== -1) { nextDx = 0; nextDy = 1; } break;
        case 'ArrowLeft': if (dx !== 1) { nextDx = -1; nextDy = 0; } break;
        case 'ArrowRight': if (dx !== -1) { nextDx = 1; nextDy = 0; } break;
    }
});

// Contrôles Mobiles
document.getElementById('btn-up').addEventListener('touchstart', (e) => { e.preventDefault(); if (dy !== 1) { nextDx = 0; nextDy = -1; } });
document.getElementById('btn-down').addEventListener('touchstart', (e) => { e.preventDefault(); if (dy !== -1) { nextDx = 0; nextDy = 1; } });
document.getElementById('btn-left').addEventListener('touchstart', (e) => { e.preventDefault(); if (dx !== 1) { nextDx = -1; nextDy = 0; } });
document.getElementById('btn-right').addEventListener('touchstart', (e) => { e.preventDefault(); if (dx !== -1) { nextDx = 1; nextDy = 0; } });

// Support souris
document.getElementById('btn-up').addEventListener('mousedown', () => { if (dy !== 1) { nextDx = 0; nextDy = -1; } });
document.getElementById('btn-down').addEventListener('mousedown', () => { if (dy !== -1) { nextDx = 0; nextDy = 1; } });
document.getElementById('btn-left').addEventListener('mousedown', () => { if (dx !== 1) { nextDx = -1; nextDy = 0; } });
document.getElementById('btn-right').addEventListener('mousedown', () => { if (dx !== -1) { nextDx = 1; nextDy = 0; } });

restartBtn.addEventListener('click', () => {
    isGameOver = false;
    init();
});