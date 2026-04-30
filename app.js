// --- DOM Elements ---
const splashScreen = document.getElementById('splash-screen');
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

// Food Search Modal Elements
let foodDatabase = [];
const foodSearchModal = document.getElementById('food-search-modal');
const closeFoodSearchBtn = document.getElementById('close-food-search-btn');
const foodSearchInput = document.getElementById('food-search-input');
const foodSearchResults = document.getElementById('food-search-results');
const foodCalcPanel = document.getElementById('food-calc-panel');
const foodGramInput = document.getElementById('food-gram-input');
const addCalculatedFoodBtn = document.getElementById('add-calculated-food-btn');
const selectedFoodName = document.getElementById('selected-food-name');
const selectedFoodKcal = document.getElementById('selected-food-kcal');
const selectedFoodHint = document.getElementById('selected-food-hint');
const calculatedKcalDisplay = document.getElementById('calculated-kcal-display');

let currentSearchMealIndex = null;
let currentSelectedFood = null;

// PWA Install Logic
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.classList.remove('hidden');
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installBtn.classList.add('hidden');
            }
            deferredPrompt = null;
        }
    });
}

// --- State ---
let userConfig = JSON.parse(localStorage.getItem('kaloriConfig')) || null;
let todayDate = new Date().toISOString().split('T')[0];
let dailyData = JSON.parse(localStorage.getItem(`kaloriData_${todayDate}`)) || {};

let selectedMeals = 0;

// --- Initialization ---
async function init() {
    // Both setup and dashboard should be hidden initially so they don't peek
    setupScreen.classList.add('hidden');
    dashboardScreen.classList.add('hidden');

    await fetchFoodDatabase();
    
    // Hide splash screen after 2.5 seconds
    setTimeout(() => {
        splashScreen.classList.add('fade-out');
        
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 600); // Wait for fade out transition

        if (userConfig && userConfig.goal && userConfig.meals) {
            showDashboard();
            requestNotificationPermission();
        } else {
            showSetup();
        }
    }, 2500);
}

async function fetchFoodDatabase() {
    try {
        const response = await fetch('./yemekler.json');
        if (response.ok) {
            foodDatabase = await response.json();
        }
    } catch (e) {
        console.error('Yemekler yüklenemedi:', e);
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
            meals: Array(selectedMeals).fill(null).map(() => ({ items: [], total: 0 })),
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
            meals: Array(userConfig.meals).fill(null).map(() => ({ items: [], total: 0 })),
            total: 0
        };
        saveDailyData();
    }

    // Migration for old data format
    if (dailyData.meals.length > 0 && (dailyData.meals[0] === null || typeof dailyData.meals[0] !== 'object' || typeof dailyData.meals[0].total === 'undefined')) {
        dailyData.meals = dailyData.meals.map(val => {
            if (val && typeof val === 'object' && typeof val.total !== 'undefined') return val;
            return {
                items: (val !== null && val > 0) ? [{ name: 'Manuel Giriş', kcal: val, grams: 0 }] : [],
                total: val || 0
            };
        });
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
        headerTitle.textContent = `Kalori Takibi`;
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
        const meal = dailyData.meals[i];
        const isSaved = meal.total > 0;
        
        const card = document.createElement('div');
        card.className = `meal-card ${isSaved ? 'saved' : ''}`;
        
        let itemsHtml = '';
        meal.items.forEach((item, itemIdx) => {
            itemsHtml += `
                <div class="food-item-row">
                    <div class="food-item-info">
                        <span class="food-item-name">${item.name}</span>
                        <span class="food-item-grams">${item.grams > 0 ? item.grams + 'g' : ''}</span>
                    </div>
                    <div class="food-item-actions">
                        <span class="food-item-kcal">${item.kcal} kcal</span>
                        <button class="delete-food-btn" onclick="deleteFood(${i}, ${itemIdx})">✕</button>
                    </div>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="meal-header">
                <span class="meal-name">${i < mealNames.length ? mealNames[i] : 'Öğün ' + (i+1)}</span>
                <div class="meal-header-actions">
                    <span class="meal-total">${meal.total} kcal</span>
                    <button class="search-food-btn" onclick="openFoodSearch(${i})" title="Yemek Ara">🔍</button>
                </div>
            </div>
            <div class="meal-items-list">
                ${itemsHtml}
                <div class="manual-entry-row">
                    <input type="number" class="manual-kcal-input" id="manual-kcal-${i}" placeholder="Manuel kalori...">
                    <button class="add-manual-btn" onclick="addManualKcal(${i})">+</button>
                </div>
            </div>
        `;
        mealsListEl.appendChild(card);
    }
    
    checkNotifications();
}

window.deleteFood = function(mealIdx, itemIdx) {
    dailyData.meals[mealIdx].items.splice(itemIdx, 1);
    updateMealTotal(mealIdx);
    saveDailyData();
    renderDashboard();
    updateCharts();
}

window.addManualKcal = function(mealIdx) {
    const input = document.getElementById(`manual-kcal-${mealIdx}`);
    const val = parseInt(input.value);
    if (isNaN(val) || val <= 0) return;

    dailyData.meals[mealIdx].items.push({
        name: 'Manuel Giriş',
        grams: 0,
        kcal: val
    });
    updateMealTotal(mealIdx);
    saveDailyData();
    renderDashboard();
    updateCharts();
}

function updateMealTotal(mealIdx) {
    dailyData.meals[mealIdx].total = dailyData.meals[mealIdx].items.reduce((sum, item) => sum + item.kcal, 0);
    calculateTotal();
}

// --- Food Search Logic ---
window.openFoodSearch = function(index) {
    currentSearchMealIndex = index;
    foodSearchModal.classList.remove('hidden');
    foodSearchInput.value = '';
    foodCalcPanel.classList.add('hidden');
    renderFoodResults(foodDatabase); // Show all initially or empty
    setTimeout(() => foodSearchInput.focus(), 100);
}

closeFoodSearchBtn.addEventListener('click', () => {
    foodSearchModal.classList.add('hidden');
});

foodSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length === 0) {
        renderFoodResults(foodDatabase);
        return;
    }
    const filtered = foodDatabase.filter(food => food.name.toLowerCase().includes(term));
    renderFoodResults(filtered);
});

function renderFoodResults(results) {
    foodSearchResults.innerHTML = '';
    if (results.length === 0) {
        foodSearchResults.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 20px;">Sonuç bulunamadı.</p>';
        return;
    }
    results.forEach(food => {
        const item = document.createElement('div');
        item.className = 'food-list-item';
        item.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--c-dark-blue); font-size: 15px;">${food.name}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${food.unit_hint}</div>
            </div>
            <div style="font-weight: 800; color: var(--c-main); font-size: 14px;">${food.kcal_per_100g} <small style="font-weight: normal; color: var(--text-muted);">kcal/100g</small></div>
        `;
        item.addEventListener('click', () => selectFood(food));
        foodSearchResults.appendChild(item);
    });
}

function selectFood(food) {
    currentSelectedFood = food;
    foodCalcPanel.classList.remove('hidden');
    selectedFoodName.textContent = food.name;
    selectedFoodKcal.textContent = food.kcal_per_100g;
    selectedFoodHint.textContent = `(${food.unit_hint})`;
    foodGramInput.value = '';
    updateCalculatedKcal();
    foodGramInput.focus();
}

foodGramInput.addEventListener('input', (e) => {
    updateCalculatedKcal();
});

function updateCalculatedKcal() {
    if (!currentSelectedFood) return;
    let grams = parseInt(foodGramInput.value);
    if (isNaN(grams) || grams < 0) {
        // Use default if empty
        grams = extractDefaultGrams(currentSelectedFood.unit_hint);
    }
    const kcal = Math.round((grams * currentSelectedFood.kcal_per_100g) / 100);
    calculatedKcalDisplay.textContent = kcal;
}

function extractDefaultGrams(hint) {
    const match = hint.match(/~(\d+)g/);
    return match ? parseInt(match[1]) : 100;
}

addCalculatedFoodBtn.addEventListener('click', () => {
    let grams = parseInt(foodGramInput.value);
    if (isNaN(grams) || grams < 0) {
        grams = extractDefaultGrams(currentSelectedFood.unit_hint);
    }
    const calculated = Math.round((grams * currentSelectedFood.kcal_per_100g) / 100);
    
    if (calculated > 0 && currentSearchMealIndex !== null) {
        dailyData.meals[currentSearchMealIndex].items.push({
            name: currentSelectedFood.name,
            grams: grams,
            kcal: calculated
        });
        
        updateMealTotal(currentSearchMealIndex);
        saveDailyData();
        renderDashboard();
        updateCharts();
        
        foodSearchModal.classList.add('hidden');
        addNotification(`${currentSelectedFood.name} eklendi: ${calculated} kcal`, 'success', '🍽️');
    }
});

window.saveMeal = function(index) {
    // This function is now legacy or can be used for generic saving
    calculateTotal();
    saveDailyData();
    renderDashboard();
    updateCharts();
}

function calculateTotal() {
    dailyData.total = dailyData.meals.reduce((acc, meal) => acc + (meal.total || 0), 0);
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
    dailyData.meals.forEach(m => { if(m.total === 0) emptyMeals++; });
    
    // Check missing meals by schedule
    if (userConfig && userConfig.meals && mealSchedules[userConfig.meals]) {
        const schedule = mealSchedules[userConfig.meals];
        
        for (let i = 0; i < schedule.length; i++) {
            const targetHour = schedule[i];
            const isMealEmpty = dailyData.meals[i].total === 0;
            
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
            let total = 0;
            if (hist) {
                if (typeof hist === 'number') total = hist;
                else if (typeof hist === 'object') total = hist.total || 0;
            }
            data.push(total);
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
