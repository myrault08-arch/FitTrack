// ============================================================
// FITTRACK - app.js
// ============================================================
//
// Matches the exact index.html provided.
//
// Features:
//   - Firebase Authentication
//   - Firestore
//   - Profile / BMI
//   - Mifflin-St Jeor calorie calculation
//   - Macro calculation
//   - Food tracking
//   - Barcode scanner
//   - OpenFoodFacts lookup
//   - PPL workout tracking
//   - Workout calorie estimation
//   - Steps tracking
//   - Weight tracking
//   - Dashboard history
//   - Progress history
//   - Chart.js charts
//   - Constellation background
//
// Firestore structure:
//
// users/{uid}
//   age
//   sex
//   height
//   weight
//   calGoal
//   pGoal
//   cGoal
//   fGoal
//   stepGoal
//
// users/{uid}/days/{YYYY-MM-DD}
//   cal
//   p
//   c
//   f
//   steps
//   workout
//   workoutCalories
//   stepsCalories
//   totalCaloriesBurned
//
// users/{uid}/days/{YYYY-MM-DD}/foods/{foodId}
//
// users/{uid}/days/{YYYY-MM-DD}/exercises/{exerciseId}
//
// users/{uid}/weights/{weightId}
//
// ============================================================


import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================
//
// Replace these values with your Firebase project configuration.
// ============================================================

const firebaseConfig = {

  apiKey: "YOUR_API_KEY",

  authDomain: "YOUR_PROJECT.firebaseapp.com",

  projectId: "YOUR_PROJECT_ID",

  storageBucket: "YOUR_PROJECT.firebasestorage.app",

  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",

  appId: "YOUR_APP_ID"

};


// ============================================================
// FIREBASE INITIALIZATION
// ============================================================

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;

let profile = null;

let selectedPPL = "Push";

let selectedHistoryDays = 7;

let selectedProgressDays = 7;

let caloriesHistoryChart = null;

let stepsHistoryChart = null;

let burnedHistoryChart = null;

let weightHistoryChart = null;

let macroHistoryChart = null;

let progressWeightChart = null;

let barcodeDetector = null;

let scannerStream = null;

let settingsCalculationTimer = null;


// ============================================================
// DOM HELPER
// ============================================================

function $(id) {
  return document.getElementById(id);
}


// ============================================================
// DATE HELPERS
// ============================================================

function getDateKey(date = new Date()) {

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function getDateFromKey(key) {

  const [year, month, day] = key.split("-").map(Number);

  return new Date(year, month - 1, day);
}


function formatDate(date) {

  return date.toLocaleDateString(undefined, {

    weekday: "short",

    month: "short",

    day: "numeric",

    year: "numeric"

  });

}


function formatShortDate(date) {

  return date.toLocaleDateString(undefined, {

    month: "short",

    day: "numeric"

  });

}


function getDateKeys(days) {

  const result = [];

  const today = new Date();

  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {

    const date = new Date(today);

    date.setDate(today.getDate() - i);

    result.push(getDateKey(date));

  }

  return result;
}


// ============================================================
// FIRESTORE REFERENCES
// ============================================================

function userRef() {

  if (!currentUser) {
    return null;
  }

  return doc(
    db,
    "users",
    currentUser.uid
  );
}


function dayRef(dateKey = getDateKey()) {

  if (!currentUser) {
    return null;
  }

  return doc(
    db,
    "users",
    currentUser.uid,
    "days",
    dateKey
  );
}


function foodsRef(dateKey = getDateKey()) {

  if (!currentUser) {
    return null;
  }

  return collection(
    db,
    "users",
    currentUser.uid,
    "days",
    dateKey,
    "foods"
  );
}


function exercisesRef(dateKey = getDateKey()) {

  if (!currentUser) {
    return null;
  }

  return collection(
    db,
    "users",
    currentUser.uid,
    "days",
    dateKey,
    "exercises"
  );
}


function weightsRef() {

  if (!currentUser) {
    return null;
  }

  return collection(
    db,
    "users",
    currentUser.uid,
    "weights"
  );
}


// ============================================================
// DEFAULT DAY
// ============================================================

function defaultDay() {

  return {

    cal: 0,

    p: 0,

    c: 0,

    f: 0,

    steps: 0,

    workout: "Rest",

    workoutCalories: 0,

    stepsCalories: 0,

    totalCaloriesBurned: 0

  };

}


// ============================================================
// DEFAULT PROFILE
// ============================================================

function defaultProfile() {

  return {

    age: 31,

    sex: "male",

    height: 170,

    weight: 73,

    calGoal: 2546,

    pGoal: 146,

    cGoal: 341,

    fGoal: 58,

    stepGoal: 10000

  };

}


// ============================================================
// NUMBER HELPERS
// ============================================================

function number(value, fallback = 0) {

  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;

}


function round(value, decimals = 0) {

  const multiplier = Math.pow(10, decimals);

  return Math.round(number(value) * multiplier) / multiplier;

}


function formatNumber(value) {

  return Math.round(number(value)).toLocaleString();

}


// ============================================================
// PROFILE CALCULATIONS
// ============================================================

function calculateBMI(height, weight) {

  height = number(height);

  weight = number(weight);

  if (height <= 0 || weight <= 0) {
    return 0;
  }

  const meters = height / 100;

  return weight / (meters * meters);

}


function getBMIStatus(bmi) {

  if (bmi < 18.5) {

    return "Underweight";

  }

  if (bmi < 25) {

    return "Normal";

  }

  if (bmi < 30) {

    return "Overweight";

  }

  return "Obese";

}


function calculateCalories(age, sex, height, weight) {

  age = number(age);

  height = number(height);

  weight = number(weight);

  let bmr;

  if (sex === "female") {

    bmr =
      (10 * weight) +
      (6.25 * height) -
      (5 * age) -
      161;

  } else {

    bmr =
      (10 * weight) +
      (6.25 * height) -
      (5 * age) +
      5;

  }

  // Moderate activity
  const calories = bmr * 1.55;

  return Math.round(calories);

}


function calculateMacros(calories, weight) {

  weight = number(weight);

  calories = number(calories);

  const protein = weight * 2;

  const fat = weight * 0.8;

  const remainingCalories =
    calories -
    (protein * 4) -
    (fat * 9);

  const carbs =
    remainingCalories > 0
      ? remainingCalories / 4
      : 0;

  return {

    protein: Math.round(protein),

    fat: Math.round(fat),

    carbs: Math.round(carbs)

  };

}


function calculateProfile(age, sex, height, weight) {

  const bmi = calculateBMI(
    height,
    weight
  );

  const calories = calculateCalories(
    age,
    sex,
    height,
    weight
  );

  const macros = calculateMacros(
    calories,
    weight
  );

  return {

    bmi,

    bmiStatus: getBMIStatus(bmi),

    calories,

    protein: macros.protein,

    carbs: macros.carbs,

    fat: macros.fat

  };

}


// ============================================================
// BURNED CALORIE CALCULATIONS
// ============================================================
//
// Walking estimate:
// approximately 0.04 kcal per step.
//
// Workout:
// approximately 325 kcal per completed PPL workout.
//
// This is an estimate, not a medical-grade measurement.
// ============================================================

function calculateWalkingCalories(steps) {

  return Math.round(
    number(steps) * 0.04
  );

}


function calculateWorkoutCalories(workout) {

  if (
    !workout ||
    workout === "Rest"
  ) {

    return 0;

  }

  return 325;

}


function calculateTotalBurned(
  workoutCalories,
  stepsCalories
) {

  return (
    number(workoutCalories) +
    number(stepsCalories)
  );

}


// ============================================================
// PROFILE LOADING
// ============================================================

async function loadProfile() {

  if (!currentUser) {
    return;
  }

  try {

    const snapshot = await getDoc(
      userRef()
    );

    if (snapshot.exists()) {

      profile = {

        ...defaultProfile(),

        ...snapshot.data()

      };

    } else {

      profile = defaultProfile();

      await setDoc(
        userRef(),
        profile
      );

    }

    populateSettings();

    updateDashboardProfile();

  } catch (error) {

    console.error(
      "Failed to load profile:",
      error
    );

  }

}


// ============================================================
// PROFILE SAVE
// ============================================================

async function saveProfile() {

  if (!currentUser) {
    return;
  }

  const age =
    number($("age").value);

  const sex =
    $("sex").value;

  const height =
    number($("height").value);

  const weight =
    number($("weight").value);

  const stepGoal =
    number($("goalSteps").value);

  const calculations =
    calculateProfile(
      age,
      sex,
      height,
      weight
    );

  profile = {

    age,

    sex,

    height,

    weight,

    calGoal: calculations.calories,

    pGoal: calculations.protein,

    cGoal: calculations.carbs,

    fGoal: calculations.fat,

    stepGoal

  };

  await setDoc(
    userRef(),
    profile,
    { merge: true }
  );

  populateSettings();

  updateDashboardProfile();

  await refreshDashboard();

  await refreshProgress();

  showMessage(
    "authMsg",
    "",
    ""
  );

}


// ============================================================
// SETTINGS FORM
// ============================================================

function populateSettings() {

  if (!profile) {
    return;
  }

  $("age").value =
    profile.age;

  $("sex").value =
    profile.sex;

  $("height").value =
    profile.height;

  $("weight").value =
    profile.weight;

  $("goalSteps").value =
    profile.stepGoal;

  updateSettingsCalculations();

}


function updateSettingsCalculations() {

  const age =
    number($("age").value);

  const sex =
    $("sex").value;

  const height =
    number($("height").value);

  const weight =
    number($("weight").value);

  if (
    age <= 0 ||
    height <= 0 ||
    weight <= 0
  ) {

    $("settingsBmi").textContent =
      "0.0";

    $("settingsBmiStatus").textContent =
      "--";

    $("settingsCalories").textContent =
      "0";

    $("settingsProtein").textContent =
      "0";

    $("settingsCarbs").textContent =
      "0";

    $("settingsFat").textContent =
      "0";

    return;

  }

  const result =
    calculateProfile(
      age,
      sex,
      height,
      weight
    );

  $("settingsBmi").textContent =
    result.bmi.toFixed(1);

  $("settingsBmiStatus").textContent =
    result.bmiStatus;

  $("settingsCalories").textContent =
    formatNumber(result.calories);

  $("settingsProtein").textContent =
    result.protein;

  $("settingsCarbs").textContent =
    result.carbs;

  $("settingsFat").textContent =
    result.fat;

}


// ============================================================
// DASHBOARD PROFILE
// ============================================================

function updateDashboardProfile() {

  if (!profile) {
    return;
  }

  const bmi =
    calculateBMI(
      profile.height,
      profile.weight
    );

  const status =
    getBMIStatus(bmi);

  $("bmiValue").textContent =
    bmi.toFixed(1);

  $("bmiStatus").textContent =
    status;

  $("bmiStatus").className =
    "bmi " +
    status.toLowerCase();

  $("calGoal").textContent =
    formatNumber(profile.calGoal);

  $("macroProteinGoal").textContent =
    profile.pGoal;

  $("macroCarbsGoal").textContent =
    profile.cGoal;

  $("macroFatGoal").textContent =
    profile.fGoal;

  $("weightDash").textContent =
    number(profile.weight).toFixed(1);

  $("stepGoalDash").textContent =
    formatNumber(profile.stepGoal);

}


// ============================================================
// DAY LOADING
// ============================================================

async function getDay(dateKey = getDateKey()) {

  if (!currentUser) {
    return defaultDay();
  }

  try {

    const snapshot =
      await getDoc(
        dayRef(dateKey)
      );

    if (!snapshot.exists()) {

      return defaultDay();

    }

    return {

      ...defaultDay(),

      ...snapshot.data()

    };

  } catch (error) {

    console.error(
      "Failed to load day:",
      error
    );

    return defaultDay();

  }

}


// ============================================================
// SAVE DAY
// ============================================================

async function saveDay(
  data,
  dateKey = getDateKey()
) {

  if (!currentUser) {
    return;
  }

  const current =
    await getDay(dateKey);

  const merged = {

    ...current,

    ...data

  };

  merged.stepsCalories =
    calculateWalkingCalories(
      merged.steps
    );

  merged.totalCaloriesBurned =
    calculateTotalBurned(
      merged.workoutCalories,
      merged.stepsCalories
    );

  await setDoc(
    dayRef(dateKey),
    merged,
    { merge: true }
  );

  return merged;

}


// ============================================================
// FOOD TOTALS
// ============================================================

async function calculateFoodTotals(
  dateKey = getDateKey()
) {

  if (!currentUser) {

    return {

      cal: 0,

      p: 0,

      c: 0,

      f: 0

    };

  }

  try {

    const snapshot =
      await getDocs(
        foodsRef(dateKey)
      );

    let cal = 0;

    let p = 0;

    let c = 0;

    let f = 0;

    snapshot.forEach(item => {

      const data = item.data();

      cal += number(data.cal);

      p += number(data.p);

      c += number(data.c);

      f += number(data.f);

    });

    return {

      cal: round(cal),

      p: round(p, 1),

      c: round(c, 1),

      f: round(f, 1)

    };

  } catch (error) {

    console.error(
      "Failed to calculate food totals:",
      error
    );

    return {

      cal: 0,

      p: 0,

      c: 0,

      f: 0

    };

  }

}


// ============================================================
// REFRESH TODAY'S DAY TOTALS
// ============================================================

async function refreshDayTotals(
  dateKey = getDateKey()
) {

  const day =
    await getDay(dateKey);

  const foods =
    await calculateFoodTotals(
      dateKey
    );

  day.cal = foods.cal;

  day.p = foods.p;

  day.c = foods.c;

  day.f = foods.f;

  day.stepsCalories =
    calculateWalkingCalories(
      day.steps
    );

  day.totalCaloriesBurned =
    calculateTotalBurned(
      day.workoutCalories,
      day.stepsCalories
    );

  await setDoc(
    dayRef(dateKey),
    day,
    { merge: true }
  );

  return day;

}


// ============================================================
// DASHBOARD
// ============================================================

async function refreshDashboard() {

  if (!currentUser) {
    return;
  }

  const today =
    await refreshDayTotals();

  updateDashboardProfile();

  $("cal").textContent =
    formatNumber(today.cal);

  $("macroProtein").textContent =
    round(today.p, 1);

  $("macroCarbs").textContent =
    round(today.c, 1);

  $("macroFat").textContent =
    round(today.f, 1);

  $("stepsDash").textContent =
    formatNumber(today.steps);

  $("workoutDash").textContent =
    today.workout || "Rest";

  $("caloriesBurnedDash").textContent =
    `${formatNumber(today.totalCaloriesBurned)} kcal`;

  $("workoutCaloriesDash").textContent =
    `${formatNumber(today.workoutCalories)} kcal`;

  $("stepsCaloriesDash").textContent =
    `${formatNumber(today.stepsCalories)} kcal`;

  $("totalCaloriesBurnedDash").textContent =
    `${formatNumber(today.totalCaloriesBurned)} kcal`;

  const calorieGoal =
    number(profile?.calGoal);

  let caloriePercent = 0;

  if (calorieGoal > 0) {

    caloriePercent =
      (today.cal / calorieGoal) * 100;

  }

  $("calBar").style.width =
    `${Math.min(caloriePercent, 100)}%`;

  const remaining =
    calorieGoal - today.cal;

  if (remaining >= 0) {

    $("calRemaining").textContent =
      `${formatNumber(remaining)} kcal remaining`;

  } else {

    $("calRemaining").textContent =
      `${formatNumber(Math.abs(remaining))} kcal over`;

  }

  await loadFoodList();

  await loadExerciseList();

  await refreshDashboardHistory();

  await refreshProgress();

}


// ============================================================
// FOOD FORM
// ============================================================

async function addFood(event) {

  event.preventDefault();

  if (!currentUser) {
    return;
  }

  const name =
    $("fname").value.trim();

  const serving =
    $("serving").value.trim();

  const cal =
    number($("fcal").value);

  const p =
    number($("fp").value);

  const c =
    number($("fc").value);

  const f =
    number($("ff").value);

  if (!name) {
    return;
  }

  try {

    await addDoc(
      foodsRef(),
      {

        name,

        serving,

        cal,

        p,

        c,

        f,

        createdAt:
          new Date().toISOString()

      }
    );

    $("foodForm").reset();

    await refreshDayTotals();

    await refreshDashboard();

  } catch (error) {

    console.error(
      "Failed to add food:",
      error
    );

    alert(
      "Unable to add food."
    );

  }

}


// ============================================================
// FOOD LIST
// ============================================================

async function loadFoodList() {

  if (!currentUser) {
    return;
  }

  const container =
    $("foodList");

  container.innerHTML =
    "<p>Loading food...</p>";

  try {

    const snapshot =
      await getDocs(
        foodsRef()
      );

    if (snapshot.empty) {

      container.innerHTML =
        "<p>No food logged today.</p>";

      return;

    }

    const foods = [];

    snapshot.forEach(item => {

      foods.push({

        id: item.id,

        ...item.data()

      });

    });

    foods.sort(
      (a, b) =>
        String(a.createdAt || "")
          .localeCompare(
            String(b.createdAt || "")
          )
    );

    container.innerHTML = "";

    foods.forEach(food => {

      const row =
        document.createElement("div");

      row.className =
        "food-entry";

      row.innerHTML = `

        <div>

          <strong>
            ${escapeHTML(food.name)}
          </strong>

          ${
            food.serving
              ? `<small>${escapeHTML(food.serving)}</small>`
              : ""
          }

        </div>

        <div>

          <span>
            ${formatNumber(food.cal)} kcal
          </span>

          <small>
            P ${round(food.p, 1)}g
            · C ${round(food.c, 1)}g
            · F ${round(food.f, 1)}g
          </small>

        </div>

        <button
          type="button"
          class="secondary-btn delete-food"
          data-id="${food.id}">
          Delete
        </button>

      `;

      container.appendChild(row);

    });

    container
      .querySelectorAll(".delete-food")
      .forEach(button => {

        button.addEventListener(
          "click",
          async () => {

            await deleteFood(
              button.dataset.id
            );

          }
        );

      });

  } catch (error) {

    console.error(
      "Failed to load food:",
      error
    );

    container.innerHTML =
      "<p>Unable to load food.</p>";

  }

}


// ============================================================
// DELETE FOOD
// ============================================================

async function deleteFood(id) {

  if (!currentUser || !id) {
    return;
  }

  try {

    await deleteDoc(
      doc(
        db,
        "users",
        currentUser.uid,
        "days",
        getDateKey(),
        "foods",
        id
      )
    );

    await refreshDayTotals();

    await refreshDashboard();

  } catch (error) {

    console.error(
      "Failed to delete food:",
      error
    );

  }

}


// ============================================================
// BARCODE SCANNER
// ============================================================

async function startScanner() {

  if (!("BarcodeDetector" in window)) {

    alert(
      "Barcode scanning is not supported by this browser. Try Chrome or another browser that supports BarcodeDetector."
    );

    return;

  }

  try {

    if (!barcodeDetector) {

      barcodeDetector =
        new BarcodeDetector({

          formats: [

            "ean_13",

            "ean_8",

            "upc_a",

            "upc_e",

            "code_128",

            "code_39"

          ]

        });

    }

    scannerStream =
      await navigator.mediaDevices
        .getUserMedia({

          video: {

            facingMode: {
              ideal: "environment"
            }

          }

        });

    const video =
      $("video");

    video.srcObject =
      scannerStream;

    video.hidden = false;

    await video.play();

    $("scan").textContent =
      "📷 Scanning...";

    scanBarcodeLoop();

  } catch (error) {

    console.error(
      "Scanner error:",
      error
    );

    alert(
      "Unable to access your camera. Please allow camera access."
    );

    stopScanner();

  }

}


async function scanBarcodeLoop() {

  const video =
    $("video");

  if (
    !scannerStream ||
    video.hidden
  ) {
    return;
  }

  try {

    const barcodes =
      await barcodeDetector.detect(video);

    if (barcodes.length > 0) {

      const barcode =
        barcodes[0].rawValue;

      await lookupBarcode(
        barcode
      );

      stopScanner();

      return;

    }

  } catch (error) {

    console.error(
      "Barcode detection error:",
      error
    );

  }

  requestAnimationFrame(
    scanBarcodeLoop
  );

}


// ============================================================
// STOP SCANNER
// ============================================================

function stopScanner() {

  if (scannerStream) {

    scannerStream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    scannerStream = null;

  }

  const video =
    $("video");

  video.pause();

  video.srcObject = null;

  video.hidden = true;

  $("scan").textContent =
    "📷 Scan barcode";

}


// ============================================================
// OPENFOODFACTS
// ============================================================

async function lookupBarcode(barcode) {

  try {

    $("scan").textContent =
      "🔎 Looking up product...";

    const response =
      await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`
      );

    if (!response.ok) {

      throw new Error(
        `HTTP ${response.status}`
      );

    }

    const data =
      await response.json();

    if (
      data.status !== 1 ||
      !data.product
    ) {

      alert(
        "Product not found in OpenFoodFacts."
      );

      return;

    }

    const product =
      data.product;

    const nutriments =
      product.nutriments || {};

    const name =
      product.product_name ||
      product.product_name_en ||
      "Unknown food";

    const serving =
      product.serving_size ||
      "";

    let calories =
      nutriments["energy-kcal_serving"];

    let protein =
      nutriments["proteins_serving"];

    let carbs =
      nutriments["carbohydrates_serving"];

    let fat =
      nutriments["fat_serving"];

    if (
      calories === undefined ||
      calories === null
    ) {

      calories =
        nutriments["energy-kcal_100g"];

    }

    if (
      protein === undefined ||
      protein === null
    ) {

      protein =
        nutriments["proteins_100g"];

    }

    if (
      carbs === undefined ||
      carbs === null
    ) {

      carbs =
        nutriments["carbohydrates_100g"];

    }

    if (
      fat === undefined ||
      fat === null
    ) {

      fat =
        nutriments["fat_100g"];

    }

    $("fname").value =
      name;

    $("serving").value =
      serving;

    $("fcal").value =
      number(calories);

    $("fp").value =
      number(protein);

    $("fc").value =
      number(carbs);

    $("ff").value =
      number(fat);

  } catch (error) {

    console.error(
      "OpenFoodFacts error:",
      error
    );

    alert(
      "Unable to look up this barcode."
    );

  } finally {

    $("scan").textContent =
      "📷 Scan barcode";

  }

}


// ============================================================
// WORKOUT PPL BUTTONS
// ============================================================

function setupPPL() {

  document
    .querySelectorAll("[data-ppl]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          selectedPPL =
            button.dataset.ppl;

          document
            .querySelectorAll("[data-ppl]")
            .forEach(btn => {

              btn.classList.remove(
                "ppl-active"
              );

            });

          button.classList.add(
            "ppl-active"
          );

        }
      );

    });

}


// ============================================================
// ADD EXERCISE
// ============================================================

async function addExercise(event) {

  event.preventDefault();

  if (!currentUser) {
    return;
  }

  const name =
    $("ename").value.trim();

  const sets =
    number($("sets").value);

  const reps =
    number($("reps").value);

  const weight =
    number($("ew").value);

  if (!name) {
    return;
  }

  try {

    await addDoc(
      exercisesRef(),
      {

        name,

        sets,

        reps,

        weight,

        type: selectedPPL,

        createdAt:
          new Date().toISOString()

      }
    );

    $("exForm").reset();

    $("sets").value = 3;

    $("reps").value = 10;

    $("ew").value = 0;

    await loadExerciseList();

  } catch (error) {

    console.error(
      "Failed to add exercise:",
      error
    );

    alert(
      "Unable to add exercise."
    );

  }

}


// ============================================================
// EXERCISE LIST
// ============================================================

async function loadExerciseList() {

  if (!currentUser) {
    return;
  }

  const container =
    $("exList");

  container.innerHTML =
    "<p>Loading exercises...</p>";

  try {

    const snapshot =
      await getDocs(
        exercisesRef()
      );

    if (snapshot.empty) {

      container.innerHTML =
        "<p>No exercises added today.</p>";

      return;

    }

    const exercises = [];

    snapshot.forEach(item => {

      exercises.push({

        id: item.id,

        ...item.data()

      });

    });

    exercises.sort(
      (a, b) =>
        String(a.createdAt || "")
          .localeCompare(
            String(b.createdAt || "")
          )
    );

    container.innerHTML = "";

    exercises.forEach(exercise => {

      const row =
        document.createElement("div");

      row.className =
        "exercise-entry";

      row.innerHTML = `

        <div>

          <strong>
            ${escapeHTML(exercise.name)}
          </strong>

          <small>
            ${escapeHTML(exercise.type || "")}
          </small>

        </div>

        <div>

          <span>
            ${exercise.sets} × ${exercise.reps}
          </span>

          <small>
            ${exercise.weight} kg
          </small>

        </div>

        <button
          type="button"
          class="secondary-btn delete-exercise"
          data-id="${exercise.id}">
          Delete
        </button>

      `;

      container.appendChild(row);

    });

    container
      .querySelectorAll(".delete-exercise")
      .forEach(button => {

        button.addEventListener(
          "click",
          async () => {

            await deleteExercise(
              button.dataset.id
            );

          }
        );

      });

  } catch (error) {

    console.error(
      "Failed to load exercises:",
      error
    );

    container.innerHTML =
      "<p>Unable to load exercises.</p>";

  }

}


// ============================================================
// DELETE EXERCISE
// ============================================================

async function deleteExercise(id) {

  if (!currentUser || !id) {
    return;
  }

  try {

    await deleteDoc(
      doc(
        db,
        "users",
        currentUser.uid,
        "days",
        getDateKey(),
        "exercises",
        id
      )
    );

    await loadExerciseList();

  } catch (error) {

    console.error(
      "Failed to delete exercise:",
      error
    );

  }

}


// ============================================================
// FINISH WORKOUT
// ============================================================

async function finishWorkout() {

  if (!currentUser) {
    return;
  }

  const calories =
    calculateWorkoutCalories(
      selectedPPL
    );

  try {

    await saveDay({

      workout:
        selectedPPL,

      workoutCalories:
        calories

    });

    await refreshDashboard();

    alert(
      `${selectedPPL} workout completed.\nEstimated calories burned: ${calories} kcal`
    );

  } catch (error) {

    console.error(
      "Failed to finish workout:",
      error
    );

  }

}


// ============================================================
// RECORD WEIGHT
// ============================================================

async function recordWeight(event) {

  event.preventDefault();

  if (!currentUser) {
    return;
  }

  const weight =
    number(
      $("weightInput").value
    );

  if (weight <= 0) {
    return;
  }

  try {

    await addDoc(
      weightsRef(),
      {

        weight,

        date:
          getDateKey(),

        timestamp:
          new Date().toISOString()

      }
    );

    profile.weight =
      weight;

    await setDoc(
      userRef(),
      {

        weight

      },
      { merge: true }
    );

    $("weightInput").value =
      "";

    await loadProfile();

    await refreshDashboard();

    await refreshProgress();

  } catch (error) {

    console.error(
      "Failed to record weight:",
      error
    );

    alert(
      "Unable to save weight."
    );

  }

}


// ============================================================
// RECORD STEPS
// ============================================================

async function recordSteps(event) {

  event.preventDefault();

  if (!currentUser) {
    return;
  }

  const steps =
    number(
      $("stepsInput").value
    );

  if (steps < 0) {
    return;
  }

  try {

    await saveDay({

      steps,

      stepsCalories:
        calculateWalkingCalories(
          steps
        )

    });

    $("stepsInput").value =
      "";

    await refreshDashboard();

    await refreshProgress();

  } catch (error) {

    console.error(
      "Failed to record steps:",
      error
    );

  }

}


// ============================================================
// WEIGHT HISTORY
// ============================================================

async function loadWeightHistory() {

  if (!currentUser) {
    return [];
  }

  try {

    const snapshot =
      await getDocs(
        query(
          weightsRef(),
          orderBy(
            "timestamp",
            "asc"
          )
        )
      );

    const result = [];

    snapshot.forEach(item => {

      result.push({

        id: item.id,

        ...item.data()

      });

    });

    return result;

  } catch (error) {

    console.error(
      "Failed to load weight history:",
      error
    );

    return [];

  }

}


// ============================================================
// GET HISTORICAL DAYS
// ============================================================

async function getHistoricalDays(days) {

  const dateKeys =
    getDateKeys(days);

  const result = [];

  for (const dateKey of dateKeys) {

    const day =
      await getDay(dateKey);

    const foods =
      await calculateFoodTotals(
        dateKey
      );

    day.cal =
      foods.cal;

    day.p =
      foods.p;

    day.c =
      foods.c;

    day.f =
      foods.f;

    day.stepsCalories =
      calculateWalkingCalories(
        day.steps
      );

    day.totalCaloriesBurned =
      calculateTotalBurned(
        day.workoutCalories,
        day.stepsCalories
      );

    result.push({

      dateKey,

      date:
        getDateFromKey(dateKey),

      ...day

    });

  }

  return result;

}


// ============================================================
// DASHBOARD HISTORY
// ============================================================

async function refreshDashboardHistory() {

  if (!currentUser) {
    return;
  }

  const data =
    await getHistoricalDays(
      selectedHistoryDays
    );

  if (!data.length) {
    return;
  }

  const avgCalories =
    data.reduce(
      (sum, day) =>
        sum + number(day.cal),
      0
    ) / data.length;

  const avgSteps =
    data.reduce(
      (sum, day) =>
        sum + number(day.steps),
      0
    ) / data.length;

  $("historyAvgCalories").textContent =
    formatNumber(avgCalories);

  $("historyAvgSteps").textContent =
    formatNumber(avgSteps);

  const weights =
    await loadWeightHistory();

  if (weights.length) {

    const latest =
      weights[weights.length - 1];

    $("historyCurrentWeight").textContent =
      number(latest.weight).toFixed(1);

  } else if (profile) {

    $("historyCurrentWeight").textContent =
      number(profile.weight).toFixed(1);

  }

  renderDashboardHistoryTable(
    data,
    weights
  );

  renderCaloriesHistoryChart(
    data
  );

  renderStepsHistoryChart(
    data
  );

  renderBurnedHistoryChart(
    data
  );

  renderWeightHistoryChart(
    data,
    weights
  );

  renderMacroHistoryChart(
    data
  );

}


// ============================================================
// DASHBOARD HISTORY TABLE
// ============================================================

function renderDashboardHistoryTable(
  data,
  weights
) {

  const container =
    $("dashboardHistory");

  if (!data.length) {

    container.innerHTML =
      "<p>No history available yet.</p>";

    return;

  }

  container.innerHTML = "";

  const weightMap =
    new Map();

  weights.forEach(item => {

    if (item.date) {

      weightMap.set(
        item.date,
        number(item.weight)
      );

    }

  });

  [...data]
    .reverse()
    .forEach(day => {

      const row =
        document.createElement("div");

      row.className =
        "history-entry";

      const weight =
        weightMap.has(day.dateKey)
          ? weightMap.get(day.dateKey)
          : null;

      row.innerHTML = `

        <div>

          <strong>
            ${formatDate(day.date)}
          </strong>

          <small>
            ${day.workout || "Rest"}
          </small>

        </div>

        <div>

          <span>
            ${formatNumber(day.cal)} kcal
          </span>

          <small>
            ${formatNumber(day.steps)} steps
          </small>

        </div>

        <div>

          <span>
            Burned:
            ${formatNumber(day.totalCaloriesBurned)} kcal
          </span>

          <small>
            ${
              weight !== null
                ? `${weight.toFixed(1)} kg`
                : "No weight"
            }
          </small>

        </div>

      `;

      container.appendChild(row);

    });

}


// ============================================================
// CHART COMMON OPTIONS
// ============================================================

function destroyChart(chart) {

  if (chart) {

    chart.destroy();

  }

}


// ============================================================
// CALORIES HISTORY CHART
// ============================================================

function renderCaloriesHistoryChart(data) {

  destroyChart(
    caloriesHistoryChart
  );

  caloriesHistoryChart =
    new Chart(
      $("caloriesHistoryChart"),
      {

        type: "line",

        data: {

          labels:
            data.map(
              item =>
                formatShortDate(
                  item.date
                )
            ),

          datasets: [

            {

              label: "Calories",

              data:
                data.map(
                  item =>
                    number(item.cal)
                ),

              tension: 0.3,

              fill: false

            },

            {

              label: "Goal",

              data:
                data.map(
                  () =>
                    number(
                      profile?.calGoal
                    )
                ),

              tension: 0,

              borderDash: [
                6,
                6
              ],

              fill: false

            }

          ]

        },

        options: chartOptions(
          "Calories"
        )

      }
    );

}


// ============================================================
// STEPS HISTORY CHART
// ============================================================

function renderStepsHistoryChart(data) {

  destroyChart(
    stepsHistoryChart
  );

  stepsHistoryChart =
    new Chart(
      $("stepsHistoryChart"),
      {

        type: "line",

        data: {

          labels:
            data.map(
              item =>
                formatShortDate(
                  item.date
                )
            ),

          datasets: [

            {

              label: "Steps",

              data:
                data.map(
                  item =>
                    number(item.steps)
                ),

              tension: 0.3,

              fill: false

            },

            {

              label: "Goal",

              data:
                data.map(
                  () =>
                    number(
                      profile?.stepGoal
                    )
                ),

              tension: 0,

              borderDash: [
                6,
                6
              ],

              fill: false

            }

          ]

        },

        options: chartOptions(
          "Steps"
        )

      }
    );

}


// ============================================================
// BURNED HISTORY CHART
// ============================================================

function renderBurnedHistoryChart(data) {

  destroyChart(
    burnedHistoryChart
  );

  burnedHistoryChart =
    new Chart(
      $("burnedHistoryChart"),
      {

        type: "line",

        data: {

          labels:
            data.map(
              item =>
                formatShortDate(
                  item.date
                )
            ),

          datasets: [

            {

              label: "Workout",

              data:
                data.map(
                  item =>
                    number(
                      item.workoutCalories
                    )
                ),

              tension: 0.3,

              fill: false

            },

            {

              label: "Walking",

              data:
                data.map(
                  item =>
                    number(
                      item.stepsCalories
                    )
                ),

              tension: 0.3,

              fill: false

            },

            {

              label: "Total",

              data:
                data.map(
                  item =>
                    number(
                      item.totalCaloriesBurned
                    )
                ),

              tension: 0.3,

              fill: false

            }

          ]

        },

        options: chartOptions(
          "Calories Burned"
        )

      }
    );

}


// ============================================================
// WEIGHT HISTORY CHART
// ============================================================

function renderWeightHistoryChart(
  data,
  weights
) {

  destroyChart(
    weightHistoryChart
  );

  const weightMap =
    new Map();

  weights.forEach(item => {

    if (item.date) {

      weightMap.set(
        item.date,
        number(item.weight)
      );

    }

  });

  const labels =
    [];

  const values =
    [];

  data.forEach(day => {

    if (
      weightMap.has(
        day.dateKey
      )
    ) {

      labels.push(
        formatShortDate(
          day.date
        )
      );

      values.push(
        weightMap.get(
          day.dateKey
        )
      );

    }

  });

  if (!values.length) {

    return;

  }

  weightHistoryChart =
    new Chart(
      $("weightHistoryChart"),
      {

        type: "line",

        data: {

          labels,

          datasets: [

            {

              label: "Weight (kg)",

              data: values,

              tension: 0.3,

              fill: false

            }

          ]

        },

        options: chartOptions(
          "Weight (kg)"
        )

      }
    );

}


// ============================================================
// MACRO HISTORY CHART
// ============================================================

function renderMacroHistoryChart(data) {

  destroyChart(
    macroHistoryChart
  );

  macroHistoryChart =
    new Chart(
      $("macroHistoryChart"),
      {

        type: "line",

        data: {

          labels:
            data.map(
              item =>
                formatShortDate(
                  item.date
                )
            ),

          datasets: [

            {

              label: "Protein",

              data:
                data.map(
                  item =>
                    number(item.p)
                ),

              tension: 0.3,

              fill: false

            },

            {

              label: "Carbohydrates",

              data:
                data.map(
                  item =>
                    number(item.c)
                ),

              tension: 0.3,

              fill: false

            },

            {

              label: "Fat",

              data:
                data.map(
                  item =>
                    number(item.f)
                ),

              tension: 0.3,

              fill: false

            }

          ]

        },

        options: chartOptions(
          "Grams"
        )

      }
    );

}


// ============================================================
// CHART OPTIONS
// ============================================================

function chartOptions(label) {

  return {

    responsive: true,

    maintainAspectRatio: false,

    interaction: {

      mode: "index",

      intersect: false

    },

    plugins: {

      legend: {

        display: true

      }

    },

    scales: {

      y: {

        beginAtZero: true,

        title: {

          display: true,

          text: label

        }

      }

    }

  };

}


// ============================================================
// PROGRESS
// ============================================================

async function refreshProgress() {

  if (!currentUser) {
    return;
  }

  const weights =
    await loadWeightHistory();

  const data =
    await getHistoricalDays(
      selectedProgressDays
    );

  let currentWeight =
    profile
      ? number(profile.weight)
      : 0;

  if (weights.length) {

    currentWeight =
      number(
        weights[weights.length - 1].weight
      );

  }

  $("progressCurrentWeight").textContent =
    currentWeight.toFixed(1);

  if (weights.length >= 2) {

    const firstWeight =
      number(weights[0].weight);

    const change =
      currentWeight -
      firstWeight;

    $("progressWeightChange").textContent =
      `${change > 0 ? "+" : ""}${change.toFixed(1)}`;

    $("progressWeightChangeLabel").textContent =
      "Since first record";

  } else {

    $("progressWeightChange").textContent =
      "0.0";

    $("progressWeightChangeLabel").textContent =
      "Since first record";

  }

  const avgSteps =
    data.length
      ? data.reduce(
          (sum, item) =>
            sum + number(item.steps),
          0
        ) / data.length
      : 0;

  $("progressAverageSteps").textContent =
    formatNumber(avgSteps);

  renderProgressWeightChart(
    weights,
    selectedProgressDays
  );

  renderProgressHistory(
    data,
    weights
  );

}


// ============================================================
// PROGRESS WEIGHT CHART
// ============================================================

function renderProgressWeightChart(
  weights,
  days
) {

  destroyChart(
    progressWeightChart
  );

  const cutoff =
    new Date();

  cutoff.setHours(
    0,
    0,
    0,
    0
  );

  cutoff.setDate(
    cutoff.getDate() -
    (days - 1)
  );

  const filtered =
    weights.filter(item => {

      if (!item.date) {
        return false;
      }

      const date =
        getDateFromKey(
          item.date
        );

      return date >= cutoff;

    });

  if (!filtered.length) {

    return;

  }

  progressWeightChart =
    new Chart(
      $("progressWeightChart"),
      {

        type: "line",

        data: {

          labels:
            filtered.map(
              item =>
                formatShortDate(
                  getDateFromKey(
                    item.date
                  )
                )
            ),

          datasets: [

            {

              label: "Weight (kg)",

              data:
                filtered.map(
                  item =>
                    number(
                      item.weight
                    )
                ),

              tension: 0.3,

              fill: false

            }

          ]

        },

        options: chartOptions(
          "Weight (kg)"
        )

      }
    );

}


// ============================================================
// PROGRESS HISTORY
// ============================================================

function renderProgressHistory(
  data,
  weights
) {

  const container =
    $("history");

  if (!data.length) {

    container.innerHTML =
      "<p>No progress history yet.</p>";

    return;

  }

  const weightMap =
    new Map();

  weights.forEach(item => {

    if (item.date) {

      weightMap.set(
        item.date,
        number(item.weight)
      );

    }

  });

  container.innerHTML = "";

  [...data]
    .reverse()
    .forEach(day => {

      const row =
        document.createElement("div");

      row.className =
        "history-entry";

      const weight =
        weightMap.has(day.dateKey)
          ? weightMap.get(day.dateKey)
          : null;

      row.innerHTML = `

        <div>

          <strong>
            ${formatDate(day.date)}
          </strong>

          <small>
            ${day.workout || "Rest"}
          </small>

        </div>

        <div>

          <span>
            ${formatNumber(day.steps)} steps
          </span>

          <small>
            ${formatNumber(day.totalCaloriesBurned)}
            kcal burned
          </small>

        </div>

        <div>

          <span>
            ${
              weight !== null
                ? `${weight.toFixed(1)} kg`
                : "—"
            }
          </span>

        </div>

      `;

      container.appendChild(row);

    });

}


// ============================================================
// HISTORY RANGE BUTTONS
// ============================================================

function setupHistoryControls() {

  $("history7")
    .addEventListener(
      "click",
      () => {

        selectedHistoryDays =
          7;

        updateHistoryButtons(
          "history",
          7
        );

        refreshDashboardHistory();

      }
    );

  $("history30")
    .addEventListener(
      "click",
      () => {

        selectedHistoryDays =
          30;

        updateHistoryButtons(
          "history",
          30
        );

        refreshDashboardHistory();

      }
    );

  $("history90")
    .addEventListener(
      "click",
      () => {

        selectedHistoryDays =
          90;

        updateHistoryButtons(
          "history",
          90
        );

        refreshDashboardHistory();

      }
    );

}


function setupProgressControls() {

  $("progress7")
    .addEventListener(
      "click",
      () => {

        selectedProgressDays =
          7;

        updateHistoryButtons(
          "progress",
          7
        );

        refreshProgress();

      }
    );

  $("progress30")
    .addEventListener(
      "click",
      () => {

        selectedProgressDays =
          30;

        updateHistoryButtons(
          "progress",
          30
        );

        refreshProgress();

      }
    );

  $("progress90")
    .addEventListener(
      "click",
      () => {

        selectedProgressDays =
          90;

        updateHistoryButtons(
          "progress",
          90
        );

        refreshProgress();

      }
    );

}


function updateHistoryButtons(
  type,
  days
) {

  const ids =
    type === "history"
      ? [
          "history7",
          "history30",
          "history90"
        ]
      : [
          "progress7",
          "progress30",
          "progress90"
        ];

  ids.forEach(id => {

    $(id).classList.remove(
      "history-range-active"
    );

  });

  const activeId =
    type === "history"
      ? `history${days}`
      : `progress${days}`;

  $(activeId)
    .classList.add(
      "history-range-active"
    );

}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {

  document
    .querySelectorAll(
      "nav button[data-page]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        async () => {

          const page =
            button.dataset.page;

          document
            .querySelectorAll(
              "nav button"
            )
            .forEach(btn => {

              btn.classList.remove(
                "nav-active"
              );

            });

          button.classList.add(
            "nav-active"
          );

          document
            .querySelectorAll(
              ".page"
            )
            .forEach(section => {

              section.hidden =
                section.id !== page;

            });

          if (page === "dash") {

            await refreshDashboard();

          }

          if (page === "food") {

            await loadFoodList();

          }

          if (page === "workout") {

            await loadExerciseList();

          }

          if (page === "progress") {

            await refreshProgress();

          }

          if (page === "settings") {

            updateSettingsCalculations();

          }

        }
      );

    });

}


// ============================================================
// AUTHENTICATION
// ============================================================

let authMode = "signin";


function setupAuth() {

  $("authForm")
    .addEventListener(
      "submit",
      handleAuth
    );

  $("toggle")
    .addEventListener(
      "click",
      toggleAuthMode
    );

}


function toggleAuthMode() {

  authMode =
    authMode === "signin"
      ? "signup"
      : "signin";

  if (authMode === "signup") {

    $("authTitle").textContent =
      "Create account";

    $("toggle").textContent =
      "Already have an account? Sign in";

  } else {

    $("authTitle").textContent =
      "Sign in";

    $("toggle").textContent =
      "Create account";

  }

  $("authMsg").textContent =
    "";

}


async function handleAuth(event) {

  event.preventDefault();

  const email =
    $("email").value.trim();

  const password =
    $("password").value;

  if (!email || !password) {
    return;
  }

  try {

    $("authMsg").textContent =
      "Please wait...";

    if (authMode === "signup") {

      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    } else {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    }

    $("authMsg").textContent =
      "";

  } catch (error) {

    console.error(
      "Authentication error:",
      error
    );

    let message =
      error.message;

    switch (error.code) {

      case "auth/invalid-credential":

        message =
          "Invalid email or password.";

        break;

      case "auth/email-already-in-use":

        message =
          "This email is already registered.";

        break;

      case "auth/weak-password":

        message =
          "Password must be at least 6 characters.";

        break;

      case "auth/invalid-email":

        message =
          "Please enter a valid email.";

        break;

    }

    $("authMsg").textContent =
      message;

  }

}


// ============================================================
// LOGOUT
// ============================================================

async function handleLogout() {

  try {

    stopScanner();

    await signOut(auth);

  } catch (error) {

    console.error(
      "Logout error:",
      error
    );

  }

}


// ============================================================
// AUTH STATE
// ============================================================

function setupAuthState() {

  onAuthStateChanged(
    auth,
    async user => {

      currentUser =
        user;

      if (user) {

        $("auth").hidden =
          true;

        $("app").hidden =
          false;

        $("logout").hidden =
          false;

        await loadProfile();

        await refreshDashboard();

      } else {

        $("auth").hidden =
          false;

        $("app").hidden =
          true;

        $("logout").hidden =
          true;

        profile =
          null;

      }

    }
  );

}


// ============================================================
// DATE DISPLAY
// ============================================================

function updateDate() {

  $("date").textContent =
    formatDate(
      new Date()
    );

}


// ============================================================
// CONSTELLATION BACKGROUND
// ============================================================

function setupConstellation() {

  const canvas =
    $("constellation");

  const ctx =
    canvas.getContext("2d");

  let width =
    window.innerWidth;

  let height =
    window.innerHeight;

  let particles = [];

  function resize() {

    width =
      window.innerWidth;

    height =
      window.innerHeight;

    canvas.width =
      width;

    canvas.height =
      height;

    createParticles();

  }


  function createParticles() {

    const count =
      Math.min(
        100,
        Math.floor(
          (width * height) /
          18000
        )
      );

    particles = [];

    for (
      let i = 0;
      i < count;
      i++
    ) {

      particles.push({

        x:
          Math.random() * width,

        y:
          Math.random() * height,

        vx:
          (Math.random() - 0.5) *
          0.25,

        vy:
          (Math.random() - 0.5) *
          0.25,

        radius:
          Math.random() * 1.5 +
          0.5

      });

    }

  }


  function animate() {

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    particles.forEach(p => {

      p.x += p.vx;

      p.y += p.vy;

      if (
        p.x < 0 ||
        p.x > width
      ) {

        p.vx *= -1;

      }

      if (
        p.y < 0 ||
        p.y > height
      ) {

        p.vy *= -1;

      }

      ctx.beginPath();

      ctx.arc(
        p.x,
        p.y,
        p.radius,
        0,
        Math.PI * 2
      );

      ctx.fill();

    });


    for (
      let i = 0;
      i < particles.length;
      i++
    ) {

      for (
        let j = i + 1;
        j < particles.length;
        j++
      ) {

        const a =
          particles[i];

        const b =
          particles[j];

        const dx =
          a.x - b.x;

        const dy =
          a.y - b.y;

        const distance =
          Math.sqrt(
            dx * dx +
            dy * dy
          );

        if (distance < 120) {

          ctx.beginPath();

          ctx.moveTo(
            a.x,
            a.y
          );

          ctx.lineTo(
            b.x,
            b.y
          );

          ctx.globalAlpha =
            1 -
            distance / 120;

          ctx.stroke();

          ctx.globalAlpha =
            1;

        }

      }

    }

    requestAnimationFrame(
      animate
    );

  }


  resize();

  window.addEventListener(
    "resize",
    resize
  );

  animate();

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {

  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// ============================================================
// MESSAGE HELPER
// ============================================================

function showMessage(
  elementId,
  message
) {

  const element =
    $(elementId);

  if (element) {

    element.textContent =
      message;

  }

}


// ============================================================
// LIVE SETTINGS CALCULATIONS
// ============================================================

function setupSettingsCalculation() {

  [
    "age",
    "sex",
    "height",
    "weight"
  ].forEach(id => {

    $(id).addEventListener(
      "input",
      () => {

        clearTimeout(
          settingsCalculationTimer
        );

        settingsCalculationTimer =
          setTimeout(
            updateSettingsCalculations,
            50
          );

      }
    );

    $(id).addEventListener(
      "change",
      updateSettingsCalculations
    );

  });

}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEvents() {

  $("logout")
    .addEventListener(
      "click",
      handleLogout
    );

  $("foodForm")
    .addEventListener(
      "submit",
      addFood
    );

  $("scan")
    .addEventListener(
      "click",
      () => {

        if (scannerStream) {

          stopScanner();

        } else {

          startScanner();

        }

      }
    );

  $("exForm")
    .addEventListener(
      "submit",
      addExercise
    );

  $("finish")
    .addEventListener(
      "click",
      finishWorkout
    );

  $("weightForm")
    .addEventListener(
      "submit",
      recordWeight
    );

  $("stepsForm")
    .addEventListener(
      "submit",
      recordSteps
    );

  $("settingsForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        try {

          await saveProfile();

          alert(
            "Profile saved successfully."
          );

        } catch (error) {

          console.error(
            "Failed to save profile:",
            error
          );

          alert(
            "Unable to save profile."
          );

        }

      }
    );

}


// ============================================================
// APPLICATION START
// ============================================================

function initialize() {

  updateDate();

  setupConstellation();

  setupAuth();

  setupAuthState();

  setupNavigation();

  setupPPL();

  setupHistoryControls();

  setupProgressControls();

  setupSettingsCalculation();

  setupEvents();

}


// ============================================================
// START
// ============================================================

initialize();
