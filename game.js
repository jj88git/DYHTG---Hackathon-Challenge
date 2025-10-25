
// Global variables for game state and Firebase configuration
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let deck = [];
let dealerHand = [];
let playerHand = [];
let isGameActive = false;
let isDealerHidden = true;

// DOM Elements
const dealerCardsEl = document.getElementById('dealer-cards');
const playerCardsEl = document.getElementById('player-cards');
const dealerScoreEl = document.getElementById('dealer-score');
const playerScoreEl = document.getElementById('player-score');
const messageBoxEl = document.getElementById('message-box');
const newGameBtn = document.getElementById('new-game-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const adviceTextEl = document.getElementById('advice-text');
const adviceMoveEl = document.getElementById('advice-move');
const adviceContainerEl = document.getElementById('current-advice-container');

// Utility Functions

// Creates 52-card deck
function createDeck() {
    const suits = ['♥', '♦', '♣', '♠'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const newDeck = [];
    for (const suit of suits) {
        for (const value of values) {
            newDeck.push({ value, suit });
        }
    }
    return newDeck;
}

// Shuffles the deck
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

// Calculates the score of a hand, sets Aces as 1 or 11
function calculateScore(hand) {
    let score = 0;
    let hasAce = 0;

    for (const card of hand) {
        if (['K', 'Q', 'J'].includes(card.value)) {
            score += 10;
        } else if (card.value === 'A') {
            score += 11;
            hasAce++;
        } else {
            score += parseInt(card.value);
        }
    }

    // Adjust Aces value if score exceeds 21
    while (score > 21 && hasAce > 0) {
        score -= 10;
        hasAce--;
    }

    return score;
}

// Renders a single card element
function renderCard(card, isHidden = false) {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');

    if (isHidden) {
        cardEl.classList.add('hidden');
        cardEl.innerHTML = 'Card<br>Down';
        return cardEl;
    }

    const suitClass = (card.suit === '♦' || card.suit === '♥') ? 'red-suit' : '';

    cardEl.innerHTML = `
        <div class="suit-top ${suitClass}">${card.value} ${card.suit}</div>
        <div class="flex-grow flex items-center justify-center text-4xl ${suitClass}">${card.suit}</div>
        <div class="suit-bottom ${suitClass} transform rotate-180">${card.value} ${card.suit}</div>
    `;
    return cardEl;
}

// Updates the display of all cards and scores
function updateDisplay() {
    const playerScore = calculateScore(playerHand);
    const dealerScoreVisible = calculateScore(isDealerHidden ? [dealerHand[0]] : dealerHand);

    // Update Player Display
    playerCardsEl.innerHTML = '';
    playerHand.forEach(card => playerCardsEl.appendChild(renderCard(card)));
    playerScoreEl.textContent = playerScore;

    // Update Dealer Display
    dealerCardsEl.innerHTML = '';
    if (dealerHand.length > 0) {
        // Render first card visible
        dealerCardsEl.appendChild(renderCard(dealerHand[0]));
        // Render subsequent cards
        for (let i = 1; i < dealerHand.length; i++) {
            const isCardHidden = isDealerHidden && i === 1;
            dealerCardsEl.appendChild(renderCard(dealerHand[i], isCardHidden));
        }
    }

    // Update Dealer Score
    dealerScoreEl.textContent = isDealerHidden ? dealerScoreVisible : calculateScore(dealerHand);

    // Update Strategy Helper
    if (isGameActive && !isDealerHidden) {
            // Do not show advice once the dealer's turn starts
            updateStrategyHelper(null);
    } else if (isGameActive) {
        updateStrategyHelper(playerScore);
    } else {
        updateStrategyHelper(null);
    }
}

// Implements the basic strategy to advise the player
function getBasicStrategy(playerScore, dealerUpcardValue) {
    // Determine the value of the dealer's upcard (A=11, 2-9=face value, 10/J/Q/K=10)
    let dealerValue;
    if (['K', 'Q', 'J', '10'].includes(dealerUpcardValue)) {
        dealerValue = 10;
    } else if (dealerUpcardValue === 'A') {
        dealerValue = 11;
    } else {
        dealerValue = parseInt(dealerUpcardValue);
    }

    // Check for Soft Hand (Ace counts as 11)
    const isSoft = playerHand.some(card => card.value === 'A') && playerScore <= 21;

    if (isSoft) {
        // Soft Totals (A, X)
        if (playerScore >= 19) return { move: 'Stand', color: 'text-green-400' }; // A,8 or A,9
        if (playerScore === 18) { // A,7
            if (dealerValue >= 9) return { move: 'Hit', color: 'text-red-400' };
            return { move: 'Stand', color: 'text-green-400' };
        }
        // A,6 or less: Always Hit
        return { move: 'Hit', color: 'text-red-400' };

    } else {
        // Hard Totals
        if (playerScore >= 17) return { move: 'Stand', color: 'text-green-400' };
        if (playerScore <= 11) return { move: 'Hit', color: 'text-red-400' };
        if (playerScore === 12) {
            if (dealerValue >= 4 && dealerValue <= 6) return { move: 'Stand', color: 'text-green-400' };
            return { move: 'Hit', color: 'text-red-400' };
        }
        // Hard 13, 14, 15, 16
        if (dealerValue >= 7) return { move: 'Hit', color: 'text-red-400' };
        return { move: 'Stand', color: 'text-green-400' };
    }
}


// Updates the strategy helper panel with the recommended move
function updateStrategyHelper(playerScore) {
    if (!isGameActive || !playerScore || isDealerHidden === false) {
        adviceTextEl.textContent = "Game paused or finished.";
        adviceMoveEl.textContent = "---";
        adviceMoveEl.className = 'text-4xl font-extrabold text-gray-400';
        adviceContainerEl.classList.remove('bg-red-900', 'bg-green-900', 'bg-yellow-900');
        adviceContainerEl.classList.add('bg-gray-700');
        return;
    }

    const dealerUpcardValue = dealerHand[0].value;
    const isPlayerSoft = playerHand.some(card => card.value === 'A') && playerScore < 21;

    adviceTextEl.innerHTML = `Player Total: <span class="text-white font-bold">${playerScore}</span> (${isPlayerSoft ? 'Soft' : 'Hard'})<br>Dealer Upcard: <span class="text-white font-bold">${dealerUpcardValue}</span>`;

    if (playerScore > 21) {
        adviceMoveEl.textContent = 'BUST!';
        adviceMoveEl.className = 'text-4xl font-extrabold text-red-500';
        adviceContainerEl.classList.remove('bg-gray-700', 'bg-green-900', 'bg-yellow-900');
        adviceContainerEl.classList.add('bg-red-900');
        return;
    }

    const advice = getBasicStrategy(playerScore, dealerUpcardValue);
    adviceMoveEl.textContent = advice.move.toUpperCase();
    adviceMoveEl.className = `text-4xl font-extrabold ${advice.color}`;

    // Set container background based on advice
    adviceContainerEl.classList.remove('bg-gray-700', 'bg-red-900');
    adviceContainerEl.classList.add(advice.move === 'Hit' ? 'bg-red-900' : 'bg-green-900');
}

// Resets the game state and starts a new round
function startGame() {
    isGameActive = true;
    isDealerHidden = true;
    deck = createDeck();
    shuffleDeck(deck);

    playerHand = [];
    dealerHand = [];

    // Deal two cards to player and two to dealer
    playerHand.push(deck.pop(), deck.pop());
    dealerHand.push(deck.pop(), deck.pop());

    // Check for immediate Blackjack
    const playerScore = calculateScore(playerHand);
    const dealerScore = calculateScore(dealerHand);

    if (playerScore === 21 && dealerScore === 21) {
        endGame("It's a tie! Both have Blackjack.", true);
    } else if (playerScore === 21) {
        endGame("Blackjack! You win!", true);
    } else if (dealerScore === 21) {
        endGame("Dealer has Blackjack. You lose.", true);
    } else {
        messageBoxEl.textContent = "Time to play! Do you Hit or Stand?";
        hitBtn.disabled = false;
        standBtn.disabled = false;
        newGameBtn.disabled = true;
    }

    updateDisplay();
}

// Handles the player's 'Hit' action
function handleHit() {
    if (!isGameActive) return;

    playerHand.push(deck.pop());
    const score = calculateScore(playerHand);
    updateDisplay();

    if (score > 21) {
        endGame("Bust! Your score is over 21. You lose.", false);
    } else if (score === 21) {
        // Automatically stand on 21
        handleStand();
    } else {
        messageBoxEl.textContent = "Hit or Stand?";
    }
}

// Handles the player's 'Stand' action
async function handleStand() {
    if (!isGameActive) return;

    isGameActive = false;
    hitBtn.disabled = true;
    standBtn.disabled = true;

    // Reveal Dealer's second card
    isDealerHidden = false;
    updateDisplay();
    await new Promise(r => setTimeout(r, 1000)); // Pause for visual effect

    let dealerScore = calculateScore(dealerHand);

    // Dealer hits until score is 17 or more (Dealer stands on soft 17)
    while (dealerScore < 17) {
        messageBoxEl.textContent = "Dealer is hitting...";
        dealerHand.push(deck.pop());
        updateDisplay();
        dealerScore = calculateScore(dealerHand);
        await new Promise(r => setTimeout(r, 1000)); // Pause between dealer draws
    }

    // Determine the final winner
    determineWinner(dealerScore);
}

// Determines the winner after all hands are played
function determineWinner(dealerScore) {
    const playerScore = calculateScore(playerHand);
    let message;

    if (playerScore > 21) {
        message = "Bust! You lose.";
    } else if (dealerScore > 21) {
        message = "Dealer busts! You win!";
    } else if (playerScore > dealerScore) {
        message = "You beat the Dealer! You win!";
    } else if (playerScore < dealerScore) {
        message = "Dealer's hand is higher. You lose.";
    } else { // Player Score === Dealer Score
        // Simplified tie rule: Player wins a tie (or Push, which is a return of bet)
        message = "It's a Push (Tie)! You keep your money.";
    }
    endGame(message, false);
}

// Ends the current game round
function endGame(msg, immediate) {
    isGameActive = false;
    isDealerHidden = false; // Always show dealer's hand at end
    messageBoxEl.textContent = msg;

    hitBtn.disabled = true;
    standBtn.disabled = true;
    newGameBtn.disabled = false;

    updateDisplay();
    updateStrategyHelper(null); // Clear advice
}

// Event Listeners
newGameBtn.addEventListener('click', startGame);
hitBtn.addEventListener('click', handleHit);
standBtn.addEventListener('click', handleStand);

// Initialization on Load

window.onload = function() {
    // Initial UI setup
    endGame("Click 'New Game' to begin.", false);
};