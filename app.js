// --- DOM Elements ---
const setupScreen = document.getElementById('setup-screen');
const dashboardScreen = document.getElementById('dashboard-screen');

// Setup Elements
const calorieGoalInput = document.getElementById('calorie-goal');
const mealBtns = document.querySelectorAll('.meal-btn');
const startBtn = document.getElementById('start-btn');

// Dashboard Elements
const goalCalsEl = document.getElementById('goal-cals');
const consumedCalsEl = document.getElementById('consumed-cals');
const remainingCalsEl = document.getElementById('remaining-cals');
const calorieProgress = document.getElementById('calorie-progress');
const mealsListEl = document.getElementById('meals-list');
const mealCountDisplay = document.getElementById('meal-count-display');
const resetBtn = document.getElementById('reset-btn');
const notificationsContainer = document.getElementById('notifications-container');

// --- State ---
let userConfig = JSON.parse(localStorage.getItem('kaloriConfig')) || null;
let todayDate = new Date().toISOString().split('T')[0];
let dailyData = JSON.parse(localStorage.getItem(`kaloriData_${todayDate}`)) || {};

let selectedMeals = 0;

// --- Initialization ---
function init() {
    if (userConfig && userConfig.goal && userConfig.meals) {
        showDashboard();
    } else {
        showSetup();
    }
}

// --- Setup Logic ---
function showSetup() {
    setupScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    
    // Reset selections
    mealBtns.forEach(btn => btn.classList.remove('selected'));
    selectedMeals = 0;
    calorieGoalInput.value = '';
    validateSetup();
}

mealBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        mealBtns.forEach(b => b.classList.remove('selected'));
        e.target.classList.add('selected');
        selectedMeals = parseInt(e.target.dataset.value);
        validateSetup();
    });
});

calorieGoalInput.addEventListener('input', validateSetup);

function validateSetup() {
    const goal = parseInt(calorieGoalInput.value);
    if (goal > 0 && selectedMeals > 0) {
        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }
}

startBtn.addEventListener('click', () => {
    const goal = parseInt(calorieGoalInput.value);
    userConfig = { goal, meals: selectedMeals };
    localStorage.setItem('kaloriConfig', JSON.stringify(userConfig));
    
    // Initialize today's data if empty
    if(Object.keys(dailyData).length === 0) {
        dailyData = {
            meals: Array(selectedMeals).fill(null),
            total: 0
        };
        saveDailyData();
    }
    
    // Generate mock history if needed for charts
    generateMockHistory();
    
    showDashboard();
});

// --- Dashboard Logic ---
function showDashboard() {
    setupScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
    // Ensure daily data structure matches config
    if(!dailyData.meals || dailyData.meals.length !== userConfig.meals) {
        dailyData = {
            meals: Array(userConfig.meals).fill(null),
            total: 0
        };
        saveDailyData();
    }
    
    renderDashboard();
    initCharts();
}

resetBtn.addEventListener('click', () => {
    if(confirm('Ayarları sıfırlamak istediğinize emin misiniz?')) {
        localStorage.removeItem('kaloriConfig');
        userConfig = null;
        showSetup();
    }
});

function renderDashboard() {
    // Header Stats
    goalCalsEl.textContent = userConfig.goal;
    consumedCalsEl.textContent = dailyData.total;
    
    let remaining = userConfig.goal - dailyData.total;
    remainingCalsEl.textContent = Math.abs(remaining);
    
    if (remaining < 0) {
        remainingCalsEl.nextElementSibling.textContent = 'Fazla';
        remainingCalsEl.parentElement.style.color = 'var(--error-color)';
    } else {
        remainingCalsEl.nextElementSibling.textContent = 'Kaldı';
        remainingCalsEl.parentElement.style.color = 'var(--text-main)';
    }

    // Circular Progress
    const progressPercent = Math.min((dailyData.total / userConfig.goal) * 100, 100);
    const strokeDasharray = `${progressPercent}, 100`;
    calorieProgress.setAttribute('stroke-dasharray', strokeDasharray);
    
    if (progressPercent > 100) {
        calorieProgress.style.stroke = 'var(--error-color)';
    } else {
        calorieProgress.style.stroke = 'var(--c-light)';
    }

    // Meals List
    mealCountDisplay.textContent = userConfig.meals;
    mealsListEl.innerHTML = '';
    
    const mealNames = ['Kahvaltı', 'Öğle Yemeği', 'Akşam Yemeği', 'Ara Öğün 1', 'Ara Öğün 2'];
    
    for (let i = 0; i < userConfig.meals; i++) {
        const mealVal = dailyData.meals[i];
        const isSaved = mealVal !== null;
        
        const card = document.createElement('div');
        card.className = `meal-card ${isSaved ? 'saved' : ''}`;
        
        card.innerHTML = `
            <div class="meal-info">
                <span class="meal-name">${i < mealNames.length ? mealNames[i] : 'Öğün ' + (i+1)}</span>
                <div class="meal-input-wrapper">
                    <input type="number" class="meal-input" id="meal-input-${i}" placeholder="0" value="${isSaved ? mealVal : ''}">
                    <span class="kcal-label">kcal</span>
                </div>
            </div>
            <button class="save-meal-btn" onclick="saveMeal(${i})" title="Kaydet">
                ${isSaved ? '✓' : '+'}
            </button>
        `;
        mealsListEl.appendChild(card);
    }
    
    checkNotifications();
}

window.saveMeal = function(index) {
    const input = document.getElementById(`meal-input-${index}`);
    const val = parseInt(input.value);
    
    if (isNaN(val) || val < 0) return;
    
    dailyData.meals[index] = val;
    calculateTotal();
    saveDailyData();
    renderDashboard();
    updateCharts();
}

function calculateTotal() {
    dailyData.total = dailyData.meals.reduce((acc, curr) => acc + (curr || 0), 0);
}

function saveDailyData() {
    localStorage.setItem(`kaloriData_${todayDate}`, JSON.stringify(dailyData));
}

// --- Notifications & Messaging ---
function checkNotifications() {
    notificationsContainer.innerHTML = '';
    
    const now = new Date();
    const hour = now.getHours();
    
    let emptyMeals = 0;
    dailyData.meals.forEach(m => { if(m === null) emptyMeals++; });
    
    // Check if end of day (e.g. after 20:00) and meals are empty
    if (hour >= 20 && emptyMeals > 0) {
        addNotification(`Bugün girmediniz ${emptyMeals} öğün var! Lütfen kalorilerinizi kaydedin.`, 'warning', '⚠️');
    }
    
    // Check if all meals entered
    if (emptyMeals === 0) {
        const diff = userConfig.goal - dailyData.total;
        if (diff === 0) {
            addNotification('Tebrikler! Günlük hedefinize tam olarak ulaştınız.', 'success', '🎯');
        } else if (diff > 0) {
            addNotification(`Gün sonu özeti: Hedefinizden ${diff} kcal eksik aldınız.`, 'info', '📊');
        } else {
            addNotification(`Gün sonu özeti: Hedefinizi ${Math.abs(diff)} kcal aştınız!`, 'alert', '📉');
        }
    }
}

function addNotification(msg, type, icon) {
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    notificationsContainer.appendChild(el);
}

// --- Charts & Mock Data ---
let weeklyChartInstance = null;
let monthlyChartInstance = null;

function generateMockHistory() {
    // Generate 30 days of mock data if it doesn't exist
    if(!localStorage.getItem('kaloriHistoryGenerated')) {
        const goal = userConfig ? userConfig.goal : 2000;
        let date = new Date();
        
        for(let i = 1; i <= 30; i++) {
            let pastDate = new Date(date);
            pastDate.setDate(date.getDate() - i);
            let dateStr = pastDate.toISOString().split('T')[0];
            
            // Random calories around the goal
            let randomTotal = goal + (Math.floor(Math.random() * 800) - 400); 
            
            localStorage.setItem(`kaloriData_${dateStr}`, JSON.stringify({
                total: randomTotal,
                meals: [] // mockup meals
            }));
        }
        localStorage.setItem('kaloriHistoryGenerated', 'true');
    }
}

function getHistoricalData(days) {
    let labels = [];
    let data = [];
    
    let date = new Date();
    for(let i = days - 1; i >= 0; i--) {
        let pastDate = new Date();
        pastDate.setDate(date.getDate() - i);
        let dateStr = pastDate.toISOString().split('T')[0];
        
        // short date format (e.g. 24 Nis)
        let shortDate = pastDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        labels.push(shortDate);
        
        if (i === 0) {
            data.push(dailyData.total || 0); // Today
        } else {
            let hist = JSON.parse(localStorage.getItem(`kaloriData_${dateStr}`));
            data.push(hist ? hist.total : 0);
        }
    }
    return { labels, data };
}

function initCharts() {
    if(weeklyChartInstance) weeklyChartInstance.destroy();
    if(monthlyChartInstance) monthlyChartInstance.destroy();
    
    const weeklyData = getHistoricalData(7);
    const monthlyData = getHistoricalData(30);
    
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: { 
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' }
            },
            x: {
                grid: { display: false }
            }
        }
    };
    
    // Weekly Chart
    const ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
    weeklyChartInstance = new Chart(ctxWeekly, {
        type: 'bar',
        data: {
            labels: weeklyData.labels,
            datasets: [{
                label: 'Kalori',
                data: weeklyData.data,
                backgroundColor: 'rgba(103, 192, 144, 0.7)',
                borderColor: '#67C090',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: commonOptions
    });
    
    // Monthly Chart
    const ctxMonthly = document.getElementById('monthlyChart').getContext('2d');
    monthlyChartInstance = new Chart(ctxMonthly, {
        type: 'line',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: 'Kalori',
                data: monthlyData.data,
                borderColor: '#215B63',
                backgroundColor: 'rgba(33, 91, 99, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 2
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                x: { ticks: { maxTicksLimit: 6 } }
            }
        }
    });
}

function updateCharts() {
    if(weeklyChartInstance) {
        const weeklyData = getHistoricalData(7);
        weeklyChartInstance.data.datasets[0].data = weeklyData.data;
        weeklyChartInstance.update();
    }
    if(monthlyChartInstance) {
        const monthlyData = getHistoricalData(30);
        monthlyChartInstance.data.datasets[0].data = monthlyData.data;
        monthlyChartInstance.update();
    }
}

// Start App
init();
