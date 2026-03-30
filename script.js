// CONFIGURATION FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBpVHVVdF3Ik00s_8pl8sI4y4qgw382Z10",
  authDomain: "snake-neon-a6e77.firebaseapp.com",
  projectId: "snake-neon-a6e77",
  storageBucket: "snake-neon-a6e77.firebasestorage.app",
  messagingSenderId: "159643256444",
  appId: "1:159643256444:web:7f810e58619b7df7a12bf9"
};

// Initialisation
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

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
let userId = localStorage.getItem('snakeUserId') || null;
let localScores = JSON.parse(localStorage.getItem('snakeProfiles')) || {}; // Gardé pour rapidité locale

// État du jeu
let snake = [];
let food = { x: 5, y: 5 };
let dx = 0;
let dy = 0;
let nextDx = 0;
let nextDy = 0;
let score = 0;
let bestScore = 0;
let initialBestScore = 0;
let speed = 150; 
let isGameOver = false;
let gameTimeout;

// --- GESTION FIREBASE (CLASSEMENT MONDIAL) ---

// Écouteur en temps réel pour tous les scores
db.collection("leaderboard")
    .orderBy("score", "desc")
    .onSnapshot((querySnapshot) => {
        const entries = [];
        querySnapshot.forEach((doc) => {
            entries.push(doc.data());
        });
        renderLeaderboard(entries);
    });

function renderLeaderboard(entries) {
    leaderboardBody.innerHTML = entries.map((entry, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${entry.username}</td>
            <td>${entry.score}</td>
        </tr>
    `).join('');
}

async function saveScoreToFirestore() {
    // --- SÉCURITÉ LOCALE ---
    // 1. On bloque si le score est physiquement impossible (ex: > 200)
    if (score > 200) {
        console.error("Tentative de triche détectée : Score trop élevé.");
        return;
    }

    // 2. On ne met à jour Firestore que si le score est supérieur au record enregistré localement
    if (score > (localScores[currentUser] || 0)) {
        localScores[currentUser] = score;
        localStorage.setItem('snakeProfiles', JSON.stringify(localScores));
        
        try {
            // Utiliser l'ID unique au lieu du pseudo pour ne pas écraser les autres
            await db.collection("leaderboard").doc(userId).set({
                username: currentUser,
                score: score,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log("Score mondial mis à jour !");
        } catch (error) {
            // Si les règles Firebase rejettent l'écriture (ex: triche), l'erreur sera captée ici
            console.error("Erreur de sauvegarde (Vérifiez les règles Firebase) :", error);
        }
    }
}

// --- GESTION DES PROFILS ---

startBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        loginUser();
    } else {
        alert("Entre un pseudo valide !");
    }
});

async function loginUser() {
    profileScreen.classList.add('hidden');
    gameUI.classList.remove('hidden');
    displayUsername.innerText = currentUser;
    
    // Générer un ID unique si c'est un nouveau joueur
    if (!userId) {
        userId = currentUser + "_" + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('snakeUserId', userId);
    }

    // Essayer de récupérer le record mondial pour cet ID unique
    try {
        const doc = await db.collection("leaderboard").doc(userId).get();
        if (doc.exists) {
            bestScore = doc.data().score;
            localScores[currentUser] = bestScore; // Sync local
        } else {
            bestScore = localScores[currentUser] || 0;
        }
    } catch (e) {
        bestScore = localScores[currentUser] || 0;
    }
    
    initialBestScore = bestScore;
    init();
}

changeUserBtn.addEventListener('click', () => {
    gameUI.classList.add('hidden');
    profileScreen.classList.remove('hidden');
    gameOverElement.classList.add('hidden');
    isGameOver = true;
    if (gameTimeout) clearTimeout(gameTimeout);
});

// --- LOGIQUE DU JEU ---

function init() {
    snake = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
    dx = 0; dy = -1; nextDx = 0; nextDy = -1;
    score = 0;
    bestScore = localScores[currentUser] || 0;
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

function gameLoop() {
    if (isGameOver) return;
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

    // --- TRAVERSÉE DES MURS ---
    if (head.x < 0) head.x = tileCount - 1;
    if (head.x >= tileCount) head.x = 0;
    if (head.y < 0) head.y = tileCount - 1;
    if (head.y >= tileCount) head.y = 0;

    // Collision avec soi-même (On garde cette défaite !)
    if (snake.some(part => part.x === head.x && part.y === head.y)) {
        return gameOver();
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score += 1;
        currentScoreElement.innerText = score;
        checkBestScore();
        if (score % 5 === 0 && speed > 50) speed -= 15;
        createFood();
    } else {
        snake.pop();
    }
}

function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // Food
    ctx.shadowBlur = 15; ctx.shadowColor = '#ff3131'; ctx.fillStyle = '#ff3131';
    ctx.beginPath(); ctx.arc(food.x * gridSize + gridSize/2, food.y * gridSize + gridSize/2, gridSize/2.5, 0, Math.PI * 2); ctx.fill();

    // Snake
    snake.forEach((part, index) => {
        ctx.shadowBlur = index === 0 ? 15 : 8;
        ctx.shadowColor = index === 0 ? '#7cff72' : '#39ff14';
        ctx.fillStyle = index === 0 ? '#7cff72' : '#39ff14';
        
        if (index === 0) {
            // DESSIN DE LA TÊTE AVEC BOUCHE
            const centerX = part.x * gridSize + gridSize / 2;
            const centerY = part.y * gridSize + gridSize / 2;
            
            // Calculer l'angle de rotation selon la direction
            let rotation = 0;
            if (dx === 1) rotation = 0;
            if (dx === -1) rotation = Math.PI;
            if (dy === 1) rotation = Math.PI / 2;
            if (dy === -1) rotation = -Math.PI / 2;

            // Vérifier si la nourriture est juste à côté pour ouvrir grand la bouche
            const dist = Math.abs(part.x - food.x) + Math.abs(part.y - food.y);
            // On gère aussi la distance à travers les murs pour la bouche
            const wrapDistX = Math.abs(Math.abs(part.x - food.x) - tileCount);
            const wrapDistY = Math.abs(Math.abs(part.y - food.y) - tileCount);
            const isNearFood = dist === 1 || (dist === tileCount - 1 && (wrapDistX === 1 || wrapDistY === 1));
            
            const mouthSize = isNearFood ? 0.4 : 0.15; // Ouvre grand si proche

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, gridSize / 2 - 1, 
                rotation + mouthSize * Math.PI, 
                rotation + (2 - mouthSize) * Math.PI);
            ctx.lineTo(centerX, centerY);
            ctx.fill();
        } else {
            // CORPS CLASSIQUE
            ctx.fillRect(part.x * gridSize + 1, part.y * gridSize + 1, gridSize - 2, gridSize - 2);
        }
    });
    ctx.shadowBlur = 0;
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
    saveScoreToFirestore();
    gameOverElement.classList.remove('hidden');
}

window.addEventListener('keydown', e => {
    // Empêcher le défilement de la page avec les flèches
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
        e.preventDefault();
    }

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

// Support souris pour test sur PC
document.getElementById('btn-up').addEventListener('mousedown', () => { if (dy !== 1) { nextDx = 0; nextDy = -1; } });
document.getElementById('btn-down').addEventListener('mousedown', () => { if (dy !== -1) { nextDx = 0; nextDy = 1; } });
document.getElementById('btn-left').addEventListener('mousedown', () => { if (dx !== 1) { nextDx = -1; nextDy = 0; } });
document.getElementById('btn-right').addEventListener('mousedown', () => { if (dx !== -1) { nextDx = 1; nextDy = 0; } });

restartBtn.addEventListener('click', () => {
    isGameOver = false;
    init();
});