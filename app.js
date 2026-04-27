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

// Settings Modal Elements
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const newCalorieGoal = document.getElementById('new-calorie-goal');
const saveNewGoalBtn = document.getElementById('save-new-goal-btn');
const settingMealBtns = document.querySelectorAll('.setting-meal-btn');
const hardResetBtn = document.getElementById('hard-reset-btn');

// --- State ---
let userConfig = JSON.parse(localStorage.getItem('kaloriConfig')) || null;
let todayDate = new Date().toISOString().split('T')[0];
let dailyData = JSON.parse(localStorage.getItem(`kaloriData_${todayDate}`)) || {};

let selectedMeals = 0;

// --- Initialization ---
function init() {
    if (userConfig && userConfig.goal && userConfig.meals) {
        showDashboard();
        requestNotificationPermission();
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
    
    if(!localStorage.getItem('kaloriStartDate')) {
        localStorage.setItem('kaloriStartDate', new Date().toISOString());
    }
    
    // Initialize today's data if empty
    if(Object.keys(dailyData).length === 0) {
        dailyData = {
            meals: Array(selectedMeals).fill(null),
            total: 0
        };
        saveDailyData();
    }
    
    showDashboard();
    requestNotificationPermission();
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
    settingsModal.classList.remove('hidden');
    newCalorieGoal.value = userConfig.goal;
    
    settingMealBtns.forEach(b => {
        if (parseInt(b.dataset.value) === userConfig.meals) {
            b.classList.add('selected');
        } else {
            b.classList.remove('selected');
        }
    });
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
});

saveNewGoalBtn.addEventListener('click', () => {
    const val = parseInt(newCalorieGoal.value);
    if (val > 0) {
        userConfig.goal = val;
        localStorage.setItem('kaloriConfig', JSON.stringify(userConfig));
        renderDashboard();
        addNotification('Kalori hedefi başarıyla güncellendi.', 'success', '✅');
        settingsModal.classList.add('hidden');
    }
});

settingMealBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const newVal = parseInt(e.target.dataset.value);
        if (newVal === userConfig.meals) return;
        
        if(confirm(`Öğün sayısını ${newVal} olarak değiştirmek istediğinize emin misiniz?`)) {
            userConfig.meals = newVal;
            localStorage.setItem('kaloriConfig', JSON.stringify(userConfig));
            
            let newMeals = Array(newVal).fill(null);
            for(let i=0; i<Math.min(newVal, dailyData.meals.length); i++) {
                newMeals[i] = dailyData.meals[i];
            }
            dailyData.meals = newMeals;
            saveDailyData();
            
            renderDashboard();
            addNotification('Öğün sayısı güncellendi.', 'success', '✅');
            settingsModal.classList.add('hidden');
        }
    });
});

hardResetBtn.addEventListener('click', () => {
    if(confirm('Tüm geçmişi ve ayarları silmek istediğinize EMIN MİSİNİZ?')) {
        localStorage.clear();
        location.reload();
    }
});

function renderDashboard() {
    // Header Stats
    const startDateStr = localStorage.getItem('kaloriStartDate') || new Date().toISOString();
    const startDate = new Date(startDateStr);
    const now = new Date();
    const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayDiff = Math.floor((nowMidnight - startMidnight) / (1000 * 60 * 60 * 24)) + 1;
    
    const headerTitle = document.querySelector('.dash-header h2');
    if (headerTitle) {
        headerTitle.textContent = `Gün ${dayDiff}`;
    }

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
    
    const mealNamesMap = {
        2: ['Sabah', 'Akşam'],
        3: ['Sabah', 'Öğle', 'Akşam'],
        4: ['Sabah', 'Öğle', 'Öğleden Sonra', 'Akşam'],
        5: ['Sabah', 'Öğle', 'Öğleden Sonra', 'Akşam', 'Gece']
    };
    const mealNames = mealNamesMap[userConfig.meals] || ['Öğün 1', 'Öğün 2'];
    
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
const mealSchedules = {
    2: [18, 22],
    3: [12, 18, 22],
    4: [10, 14, 18, 22],
    5: [9, 12, 16, 19, 22]
};

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

function sendNativeNotification(msg) {
    if (!('Notification' in window)) return;
    
    const notifKey = `kalori_notif_${todayDate}_${msg}`;
    if (localStorage.getItem(notifKey)) return; // Already sent today
    
    if (Notification.permission === 'granted') {
        new Notification('KaloriÖlçer', { body: msg, icon: 'https://cdn-icons-png.flaticon.com/512/8144/8144415.png' });
        localStorage.setItem(notifKey, 'true');
    }
}

function checkNotifications() {
    notificationsContainer.innerHTML = '';
    
    const now = new Date();
    const hour = now.getHours();
    
    let emptyMeals = 0;
    dailyData.meals.forEach(m => { if(m === null) emptyMeals++; });
    
    // Check missing meals by schedule
    if (userConfig && userConfig.meals && mealSchedules[userConfig.meals]) {
        const schedule = mealSchedules[userConfig.meals];
        
        for (let i = 0; i < schedule.length; i++) {
            const targetHour = schedule[i];
            const isMealEmpty = dailyData.meals[i] === null;
            
            if (hour >= targetHour && isMealEmpty) {
                const msg = `Saat ${targetHour}:00'ı geçti, ${i + 1}. öğünü henüz girmediniz!`;
                addNotification(msg, 'warning', '⚠️');
                sendNativeNotification(msg);
            }
        }
    }
    
    // Check if all meals entered
    if (emptyMeals === 0 && dailyData.meals.length > 0) {
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
