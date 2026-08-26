// ============================================================
// FITTRACK - app.js
// ============================================================

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

import { firebaseConfig } from './firebase-config.js';


// ============================================================
// FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ============================================================
// HELPER
// ============================================================

const $ = id => document.getElementById(id);


// ============================================================
// STATE
// ============================================================

let user = null;
let signup = false;
let ppl = 'Push';
let stream = null;

let historyRange = 7;
let healthHistory = [];


// ============================================================
// DEFAULT PROFILE
// ============================================================

let profile = {
  age: 31,
  sex: 'male',
  height: 170,
  weight: 73,

  calGoal: 2546,
  pGoal: 146,
  cGoal: 341,
  fGoal: 58,

  stepGoal: 10000
};


// ============================================================
// DATE
// ============================================================

function day() {

  const now = new Date();

  const year = now.getFullYear();

  const month =
    String(now.getMonth() + 1)
      .padStart(2, '0');

  const date =
    String(now.getDate())
      .padStart(2, '0');

  return `${year}-${month}-${date}`;
}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(dateString) {

  if (!dateString) {
    return '--';
  }

  const parts = dateString.split('-');

  if (parts.length !== 3) {
    return dateString;
  }

  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }
  );
}


// ============================================================
// SHORT DATE
// ============================================================

function shortDate(dateString) {

  if (!dateString) {
    return '';
  }

  const parts = dateString.split('-');

  if (parts.length !== 3) {
    return dateString;
  }

  return `${parts[1]}/${parts[2]}`;
}


// ============================================================
// FIRESTORE REFERENCES
// ============================================================

function userRef() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return doc(
    db,
    'users',
    user.uid
  );
}


function healthDataCollection() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return collection(
    db,
    'users',
    user.uid,
    'healthData'
  );
}


// ------------------------------------------------------------
// OLD PATH
//
// Kept ONLY so History can still see records saved by an older
// version of FitTrack.
// ------------------------------------------------------------

function legacyDaysCollection() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return collection(
    db,
    'users',
    user.uid,
    'days'
  );
}


function dayRef() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return doc(
    db,
    'users',
    user.uid,
    'healthData',
    day()
  );
}


function foodCollection() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return collection(
    db,
    'users',
    user.uid,
    'healthData',
    day(),
    'foods'
  );
}


function exerciseCollection() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return collection(
    db,
    'users',
    user.uid,
    'healthData',
    day(),
    'exercises'
  );
}


// ============================================================
// EMPTY DAY
// ============================================================

function emptyDay() {

  return {

    cal: 0,
    p: 0,
    c: 0,
    f: 0,

    steps: 0,

    workout: 'Rest',

    workoutCalories: 0,
    stepsCalories: 0,
    caloriesBurned: 0,

    activeCalories: 0,

    weight: 0

  };
}


// ============================================================
// NORMALIZE DAY
// ============================================================

function normalizeDay(data) {

  data = data || {};

  return {

    cal:
      Number(data.cal) || 0,

    p:
      Number(data.p) || 0,

    c:
      Number(data.c) || 0,

    f:
      Number(data.f) || 0,

    steps:
      Number(data.steps) || 0,

    workout:
      data.workout || 'Rest',

    workoutCalories:
      Number(data.workoutCalories) || 0,

    stepsCalories:
      Number(data.stepsCalories) || 0,

    caloriesBurned:
      Number(data.caloriesBurned) || 0,

    activeCalories:
      Number(data.activeCalories) || 0,

    weight:
      Number(data.weight) || 0

  };
}


// ============================================================
// GET TODAY
// ============================================================

async function getDay() {

  if (!user) {
    return emptyDay();
  }

  const snapshot =
    await getDoc(dayRef());

  if (!snapshot.exists()) {
    return emptyDay();
  }

  return normalizeDay(
    snapshot.data()
  );
}


// ============================================================
// CALCULATE STEP CALORIES
// ============================================================

function calculateStepCalories(steps) {

  const weight =
    Number(profile.weight) || 0;

  const count =
    Number(steps) || 0;

  if (
    weight <= 0 ||
    count <= 0
  ) {
    return 0;
  }

  return Math.round(
    count *
    weight *
    0.0004
  );
}


// ============================================================
// WORKOUT CALORIES
// ============================================================

function calculateWorkoutCalories(type) {

  const weight =
    Number(profile.weight) || 73;

  let met = 5;

  if (type === 'Legs') {
    met = 6;
  }

  return Math.round(
    met * weight
  );
}


// ============================================================
// TOTAL BURNED
// ============================================================

function calculateTotalBurned(
  workoutCalories,
  stepsCalories
) {

  return Math.round(
    (Number(workoutCalories) || 0) +
    (Number(stepsCalories) || 0)
  );
}


// ============================================================
// BMI / MACROS
// ============================================================

function calculateMetrics() {

  const age =
    Number(profile.age);

  const height =
    Number(profile.height);

  const weight =
    Number(profile.weight);

  if (
    !age ||
    !height ||
    !weight
  ) {
    return null;
  }

  const bmr =
    profile.sex === 'female'
      ? (
          10 * weight +
          6.25 * height -
          5 * age -
          161
        )
      : (
          10 * weight +
          6.25 * height -
          5 * age +
          5
        );

  const calories =
    Math.round(
      bmr * 1.55
    );

  const protein =
    Math.round(
      weight * 2
    );

  const fat =
    Math.round(
      weight * 0.8
    );

  const carbCalories =
    calories -
    (
      protein * 4 +
      fat * 9
    );

  const carbs =
    Math.max(
      0,
      Math.round(
        carbCalories / 4
      )
    );

  profile.calGoal = calories;
  profile.pGoal = protein;
  profile.cGoal = carbs;
  profile.fGoal = fat;

  const bmi =
    weight /
    Math.pow(
      height / 100,
      2
    );

  let status;
  let color;

  if (bmi < 18.5) {
    status = 'Underweight';
    color = 'under';
  }

  else if (bmi < 25) {
    status = 'Normal';
    color = 'normal';
  }

  else if (bmi < 30) {
    status = 'Overweight';
    color = 'over';
  }

  else {
    status = 'Obese';
    color = 'obese';
  }

  if ($('bmiValue')) {
    $('bmiValue').textContent =
      bmi.toFixed(1);
  }

  if ($('bmiStatus')) {
    $('bmiStatus').textContent =
      status;

    $('bmiStatus').className =
      `bmi ${color}`;
  }

  if ($('settingsBmi')) {
    $('settingsBmi').textContent =
      bmi.toFixed(1);
  }

  if ($('settingsBmiStatus')) {
    $('settingsBmiStatus').textContent =
      status;

    $('settingsBmiStatus').className =
      `bmi ${color}`;
  }

  if ($('settingsCalories')) {
    $('settingsCalories').textContent =
      calories.toLocaleString();
  }

  if ($('settingsProtein')) {
    $('settingsProtein').textContent =
      protein;
  }

  if ($('settingsCarbs')) {
    $('settingsCarbs').textContent =
      carbs;
  }

  if ($('settingsFat')) {
    $('settingsFat').textContent =
      fat;
  }

  if ($('calGoal')) {
    $('calGoal').textContent =
      calories.toLocaleString();
  }

  if ($('macroProteinGoal')) {
    $('macroProteinGoal').textContent =
      protein;
  }

  if ($('macroCarbsGoal')) {
    $('macroCarbsGoal').textContent =
      carbs;
  }

  if ($('macroFatGoal')) {
    $('macroFatGoal').textContent =
      fat;
  }

  return {
    bmr,
    calories,
    protein,
    carbs,
    fat,
    bmi,
    status
  };
}


// ============================================================
// NAVIGATION
// ============================================================

function show(id) {

  document
    .querySelectorAll('.page')
    .forEach(page => {

      page.hidden =
        page.id !== id;

    });

  document
    .querySelectorAll('nav button')
    .forEach(button => {

      button.classList.toggle(
        'nav-active',
        button.dataset.page === id
      );

    });

  if (id === 'dash') {
    refresh();
  }

  if (id === 'food') {
    food();
  }

  if (id === 'workout') {
    exercises();
  }

  if (id === 'progress') {
    loadHistory();
  }
}


// ============================================================
// NAVIGATION BUTTONS
// ============================================================

document
  .querySelectorAll('nav button')
  .forEach(button => {

    button.onclick = () => {

      show(
        button.dataset.page
      );

    };

  });


// ============================================================
// AUTH TOGGLE
// ============================================================

if ($('toggle')) {

  $('toggle').onclick = () => {

    signup =
      !signup;

    $('authTitle').textContent =
      signup
        ? 'Create account'
        : 'Sign in';

    $('toggle').textContent =
      signup
        ? 'Back to sign in'
        : 'Create account';

    $('authMsg').textContent =
      '';

  };

}


// ============================================================
// AUTH
// ============================================================

if ($('authForm')) {

  $('authForm').onsubmit =
    async event => {

      event.preventDefault();

      try {

        const email =
          $('email').value.trim();

        const password =
          $('password').value;

        if (signup) {

          const credentials =
            await createUserWithEmailAndPassword(
              auth,
              email,
              password
            );

          user =
            credentials.user;

          await setDoc(
            userRef(),
            profile
          );

        }

        else {

          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );

        }

      }

      catch (error) {

        console.error(
          'Authentication error:',
          error
        );

        if ($('authMsg')) {
          $('authMsg').textContent =
            error.message;
        }

      }

    };

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
  auth,
  async currentUser => {

    user =
      currentUser;

    if (!currentUser) {

      if ($('auth')) {
        $('auth').hidden = false;
      }

      if ($('app')) {
        $('app').hidden = true;
      }

      if ($('logout')) {
        $('logout').hidden = true;
      }

      return;
    }

    if ($('auth')) {
      $('auth').hidden = true;
    }

    if ($('app')) {
      $('app').hidden = false;
    }

    if ($('logout')) {
      $('logout').hidden = false;
    }

    try {

      const snapshot =
        await getDoc(
          userRef()
        );

      if (snapshot.exists()) {

        profile = {
          ...profile,
          ...snapshot.data()
        };

      }

      else {

        await setDoc(
          userRef(),
          profile
        );

      }

      fill();

      calculateMetrics();

      await refresh();

      show('dash');

    }

    catch (error) {

      console.error(
        'Profile loading error:',
        error
      );

    }

  }
);


// ============================================================
// LOGOUT
// ============================================================

if ($('logout')) {

  $('logout').onclick =
    async () => {

      try {

        await signOut(auth);

      }

      catch (error) {

        console.error(
          'Logout error:',
          error
        );

      }

    };

}


// ============================================================
// FILL SETTINGS
// ============================================================

function fill() {

  if ($('age')) {
    $('age').value =
      profile.age;
  }

  if ($('sex')) {
    $('sex').value =
      profile.sex || 'male';
  }

  if ($('height')) {
    $('height').value =
      profile.height;
  }

  if ($('weight')) {
    $('weight').value =
      profile.weight;
  }

  if ($('goalSteps')) {
    $('goalSteps').value =
      profile.stepGoal || 10000;
  }

}


// ============================================================
// LIVE SETTINGS
// ============================================================

[
  'age',
  'sex',
  'height',
  'weight'
]
.forEach(id => {

  if (!$(id)) {
    return;
  }

  $(id).addEventListener(
    'input',
    () => {

      profile.age =
        Number($('age').value);

      profile.sex =
        $('sex').value;

      profile.height =
        Number($('height').value);

      profile.weight =
        Number($('weight').value);

      calculateMetrics();

    }
  );

});


// ============================================================
// SETTINGS SAVE
// ============================================================

if ($('settingsForm')) {

  $('settingsForm').onsubmit =
    async event => {

      event.preventDefault();

      try {

        profile.age =
          Number($('age').value);

        profile.sex =
          $('sex').value;

        profile.height =
          Number($('height').value);

        profile.weight =
          Number($('weight').value);

        profile.stepGoal =
          Number($('goalSteps').value) ||
          10000;

        calculateMetrics();

        await setDoc(
          userRef(),
          profile,
          {
            merge: true
          }
        );

        const d =
          await getDay();

        const stepsCalories =
          calculateStepCalories(
            d.steps
          );

        const totalBurned =
          calculateTotalBurned(
            d.workoutCalories,
            stepsCalories
          );

        await setDoc(
          dayRef(),
          {
            stepsCalories,

            caloriesBurned:
              totalBurned,

            weight:
              profile.weight
          },
          {
            merge: true
          }
        );

        await refresh();

        alert(
          'Profile saved successfully.'
        );

      }

      catch (error) {

        console.error(
          'Settings save error:',
          error
        );

        alert(
          'Could not save your profile: ' +
          error.message
        );

      }

    };

}


// ============================================================
// DASHBOARD
// ============================================================

async function refresh() {

  if (!user) {
    return;
  }

  try {

    calculateMetrics();

    const d =
      await getDay();

    const calories =
      Number(d.cal) || 0;

    const calorieGoal =
      Number(profile.calGoal) || 0;

    if ($('cal')) {
      $('cal').textContent =
        calories.toLocaleString();
    }

    if ($('calGoal')) {
      $('calGoal').textContent =
        calorieGoal.toLocaleString();
    }

    if ($('calBar')) {

      const percent =
        calorieGoal > 0
          ? (calories / calorieGoal) * 100
          : 0;

      $('calBar').style.width =
        Math.min(100, percent) + '%';
    }

    if ($('calRemaining')) {

      $('calRemaining').textContent =
        `${Math.max(
          0,
          calorieGoal - calories
        ).toLocaleString()} kcal remaining`;

    }

    const steps =
      Number(d.steps) || 0;

    if ($('stepsDash')) {
      $('stepsDash').textContent =
        steps.toLocaleString();
    }

    let stepsCalories =
      Number(d.stepsCalories) || 0;

    if (
      steps > 0 &&
      stepsCalories <= 0
    ) {

      stepsCalories =
        calculateStepCalories(
          steps
        );

      await setDoc(
        dayRef(),
        {
          stepsCalories
        },
        {
          merge: true
        }
      );

    }

    const workout =
      d.workout || 'Rest';

    const workoutCalories =
      Number(d.workoutCalories) || 0;

    if ($('workoutDash')) {
      $('workoutDash').textContent =
        workout;
    }

    let burnedCalories =
      Number(d.activeCalories) || 0;

    if (burnedCalories <= 0) {

      burnedCalories =
        calculateTotalBurned(
          workoutCalories,
          stepsCalories
        );

    }

    if ($('caloriesBurnedDash')) {
      $('caloriesBurnedDash').textContent =
        `${burnedCalories.toLocaleString()} kcal`;
    }

    if ($('workoutCaloriesDash')) {
      $('workoutCaloriesDash').textContent =
        `${workoutCalories.toLocaleString()} kcal`;
    }

    if ($('stepsCaloriesDash')) {
      $('stepsCaloriesDash').textContent =
        `${stepsCalories.toLocaleString()} kcal`;
    }

    if ($('totalCaloriesBurnedDash')) {
      $('totalCaloriesBurnedDash').textContent =
        `${burnedCalories.toLocaleString()} kcal`;
    }

    const weight =
      Number(
        d.weight ||
        profile.weight ||
        0
      );

    if ($('weightDash')) {
      $('weightDash').textContent =
        weight.toFixed(1);
    }

    if ($('macroProtein')) {
      $('macroProtein').textContent =
        Math.round(
          Number(d.p) || 0
        );
    }

    if ($('macroCarbs')) {
      $('macroCarbs').textContent =
        Math.round(
          Number(d.c) || 0
        );
    }

    if ($('macroFat')) {
      $('macroFat').textContent =
        Math.round(
          Number(d.f) || 0
        );
    }

  }

  catch (error) {

    console.error(
      'Dashboard refresh error:',
      error
    );

  }

}


// ============================================================
// FOOD
// ============================================================

if ($('foodForm')) {

  $('foodForm').onsubmit =
    async event => {

      event.preventDefault();

      try {

        const f = {

          name:
            $('fname').value.trim(),

          serving:
            $('serving').value.trim(),

          cal:
            Number($('fcal').value) || 0,

          p:
            Number($('fp').value) || 0,

          c:
            Number($('fc').value) || 0,

          f:
            Number($('ff').value) || 0

        };

        await addDoc(
          foodCollection(),
          f
        );

        const d =
          await getDay();

        await setDoc(
          dayRef(),
          {

            cal:
              (Number(d.cal) || 0) +
              f.cal,

            p:
              (Number(d.p) || 0) +
              f.p,

            c:
              (Number(d.c) || 0) +
              f.c,

            f:
              (Number(d.f) || 0) +
              f.f

          },
          {
            merge: true
          }
        );

        event.target.reset();

        await refresh();

        await food();

      }

      catch (error) {

        console.error(
          'Food save error:',
          error
        );

        alert(
          'Could not save food: ' +
          error.message
        );

      }

    };

}


// ============================================================
// FOOD LIST
// ============================================================

async function food() {

  if (!user || !$('foodList')) {
    return;
  }

  try {

    const snapshot =
      await getDocs(
        query(
          foodCollection(),
          orderBy('__name__')
        )
      );

    $('foodList').innerHTML =
      snapshot.docs
        .map(item => {

          const f =
            item.data();

          return `

            <div class="row">

              <span>

                <strong>
                  ${escapeHtml(
                    f.name || 'Food'
                  )}
                </strong>

                <br>

                <small>

                  ${escapeHtml(
                    f.serving || ''
                  )}

                  · ${Number(f.cal || 0)} kcal

                  · P ${Number(f.p || 0)}

                  · C ${Number(f.c || 0)}

                  · F ${Number(f.f || 0)}

                </small>

              </span>

              <button
                data-del="${item.id}">
                Delete
              </button>

            </div>

          `;

        })
        .join('') ||

      '<p>No food logged today.</p>';

    document
      .querySelectorAll('[data-del]')
      .forEach(button => {

        button.onclick =
          async () => {

            try {

              const reference =
                doc(
                  db,
                  'users',
                  user.uid,
                  'healthData',
                  day(),
                  'foods',
                  button.dataset.del
                );

              const snapshot =
                await getDoc(
                  reference
                );

              if (!snapshot.exists()) {
                return;
              }

              const f =
                snapshot.data();

              const d =
                await getDay();

              await setDoc(
                dayRef(),
                {

                  cal:
                    Math.max(
                      0,
                      (Number(d.cal) || 0) -
                      (Number(f.cal) || 0)
                    ),

                  p:
                    Math.max(
                      0,
                      (Number(d.p) || 0) -
                      (Number(f.p) || 0)
                    ),

                  c:
                    Math.max(
                      0,
                      (Number(d.c) || 0) -
                      (Number(f.c) || 0)
                    ),

                  f:
                    Math.max(
                      0,
                      (Number(d.f) || 0) -
                      (Number(f.f) || 0)
                    )

                },
                {
                  merge: true
                }
              );

              await deleteDoc(
                reference
              );

              await refresh();

              await food();

            }

            catch (error) {

              console.error(
                'Food delete error:',
                error
              );

            }

          };

      });

  }

  catch (error) {

    console.error(
      'Food loading error:',
      error
    );

  }

}


// ============================================================
// EXERCISES
// ============================================================

document
  .querySelectorAll('[data-ppl]')
  .forEach(button => {

    button.onclick = () => {

      ppl =
        button.dataset.ppl;

      document
        .querySelectorAll('[data-ppl]')
        .forEach(b => {

          b.classList.toggle(
            'ppl-active',
            b === button
          );

        });

    };

  });


if ($('exForm')) {

  $('exForm').onsubmit =
    async event => {

      event.preventDefault();

      try {

        await addDoc(
          exerciseCollection(),
          {

            type:
              ppl,

            name:
              $('ename').value.trim(),

            sets:
              Number($('sets').value) || 0,

            reps:
              Number($('reps').value) || 0,

            weight:
              Number($('ew').value) || 0

          }
        );

        event.target.reset();

        $('sets').value = 3;
        $('reps').value = 10;
        $('ew').value = 0;

        await exercises();

      }

      catch (error) {

        console.error(
          'Exercise save error:',
          error
        );

        alert(
          'Could not save exercise: ' +
          error.message
        );

      }

    };

}


// ============================================================
// FINISH WORKOUT
// ============================================================

if ($('finish')) {

  $('finish').onclick =
    async () => {

      try {

        const workoutCalories =
          calculateWorkoutCalories(
            ppl
          );

        const d =
          await getDay();

        const totalBurned =
          calculateTotalBurned(
            workoutCalories,
            d.stepsCalories
          );

        await setDoc(
          dayRef(),
          {

            workout:
              ppl,

            workoutCalories,

            caloriesBurned:
              totalBurned

          },
          {
            merge: true
          }
        );

        await refresh();

        alert(
          `${ppl} workout completed!\n\n` +
          `Estimated calories burned: ` +
          `${workoutCalories} kcal`
        );

      }

      catch (error) {

        console.error(
          'Workout completion error:',
          error
        );

        alert(
          'Could not finish workout: ' +
          error.message
        );

      }

    };

}


// ============================================================
// EXERCISE LIST
// ============================================================

async function exercises() {

  if (!user || !$('exList')) {
    return;
  }

  try {

    const snapshot =
      await getDocs(
        exerciseCollection()
      );

    $('exList').innerHTML =
      snapshot.docs
        .map(item => {

          const e =
            item.data();

          return `

            <div class="row">

              <span>

                <strong>
                  ${escapeHtml(
                    e.name || 'Exercise'
                  )}
                </strong>

                <br>

                <small>

                  ${escapeHtml(
                    e.type || ''
                  )}

                  · ${Number(e.sets || 0)}

                  × ${Number(e.reps || 0)}

                  @ ${Number(e.weight || 0)} kg

                </small>

              </span>

              <button
                data-ex="${item.id}">
                Delete
              </button>

            </div>

          `;

        })
        .join('') ||

      '<p>No exercises logged today.</p>';

    document
      .querySelectorAll('[data-ex]')
      .forEach(button => {

        button.onclick =
          async () => {

            try {

              await deleteDoc(
                doc(
                  db,
                  'users',
                  user.uid,
                  'healthData',
                  day(),
                  'exercises',
                  button.dataset.ex
                )
              );

              await exercises();

            }

            catch (error) {

              console.error(
                'Exercise delete error:',
                error
              );

            }

          };

      });

  }

  catch (error) {

    console.error(
      'Exercise loading error:',
      error
    );

  }

}


// ============================================================
// WEIGHT FORM
// ============================================================

if ($('weightForm')) {

  $('weightForm').onsubmit =
    async event => {

      event.preventDefault();

      try {

        const newWeight =
          Number(
            $('weightInput').value
          );

        if (
          !newWeight ||
          newWeight <= 0
        ) {

          alert(
            'Please enter a valid weight.'
          );

          return;

        }

        profile.weight =
          newWeight;

        calculateMetrics();

        await setDoc(
          userRef(),
          profile,
          {
            merge: true
          }
        );

        const d =
          await getDay();

        const stepsCalories =
          calculateStepCalories(
            d.steps
          );

        const totalBurned =
          calculateTotalBurned(
            d.workoutCalories,
            stepsCalories
          );

        await setDoc(
          dayRef(),
          {

            weight:
              newWeight,

            stepsCalories,

            caloriesBurned:
              totalBurned

          },
          {
            merge: true
          }
        );

        $('weightInput').value =
          '';

        await refresh();

        await loadHistory();

      }

      catch (error) {

        console.error(
          'Weight save error:',
          error
        );

        alert(
          'Could not save weight: ' +
          error.message
        );

      }

    };

}


// ============================================================
// STEPS FORM
// ============================================================

if ($('stepsForm')) {

  $('stepsForm').onsubmit =
    async event => {

      event.preventDefault();

      if (!user) {

        alert(
          'Please sign in first.'
        );

        return;

      }

      try {

        const steps =
          Math.round(
            Number(
              $('stepsInput').value
            ) || 0
          );

        if (steps < 0) {

          alert(
            'Steps cannot be negative.'
          );

          return;

        }

        const stepsCalories =
          calculateStepCalories(
            steps
          );

        const d =
          await getDay();

        const totalBurned =
          calculateTotalBurned(
            d.workoutCalories,
            stepsCalories
          );

        await setDoc(
          dayRef(),
          {

            steps,

            stepsCalories,

            caloriesBurned:
              totalBurned

          },
          {
            merge: true
          }
        );

        $('stepsInput').value =
          '';

        await refresh();

        alert(
          `${steps.toLocaleString()} steps saved!\n\n` +
          `Estimated calories burned: ` +
          `${stepsCalories} kcal`
        );

      }

      catch (error) {

        console.error(
          'Steps save error:',
          error
        );

        alert(
          'Could not save steps: ' +
          error.message
        );

      }

    };

}


// ============================================================
// HISTORY
// ============================================================
//
// CURRENT:
//
// users/{uid}/healthData/{YYYY-MM-DD}
//
// OLD:
//
// users/{uid}/days/{YYYY-MM-DD}
//
// History checks BOTH paths.
// ============================================================


// ============================================================
// LOAD CURRENT HISTORY
// ============================================================

async function loadHealthHistory() {

  if (!user) {
    return [];
  }

  const recordsByDate =
    new Map();

  // ----------------------------------------------------------
  // CURRENT healthData
  // ----------------------------------------------------------

  try {

    const snapshot =
      await getDocs(
        healthDataCollection()
      );

    snapshot.forEach(dayDoc => {

      const data =
        normalizeDay(
          dayDoc.data()
        );

      recordsByDate.set(
        dayDoc.id,
        {
          date: dayDoc.id,
          ...data
        }
      );

    });

  }

  catch (error) {

    console.error(
      'Current healthData history error:',
      error
    );

  }


  // ----------------------------------------------------------
  // LEGACY days
  //
  // This prevents older records from disappearing from the
  // History page.
  // ----------------------------------------------------------

  try {

    const legacySnapshot =
      await getDocs(
        legacyDaysCollection()
      );

    legacySnapshot.forEach(dayDoc => {

      const date =
        dayDoc.id;

      const data =
        normalizeDay(
          dayDoc.data()
        );

      // Current healthData always wins if both exist.
      if (!recordsByDate.has(date)) {

        recordsByDate.set(
          date,
          {
            date,
            ...data
          }
        );

      }

    });

  }

  catch (error) {

    // This is intentionally non-fatal.
    // The old collection may not exist or rules may deny it.

    console.warn(
      'Legacy history unavailable:',
      error.message
    );

  }


  const records =
    Array.from(
      recordsByDate.values()
    );


  records.sort(
    (a, b) =>
      b.date.localeCompare(a.date)
  );


  return records;
}


// ============================================================
// FILTER HISTORY
// ============================================================

function getFilteredHistory() {

  if (!healthHistory.length) {
    return [];
  }

  if (historyRange === 'all') {
    return [...healthHistory];
  }

  return healthHistory.slice(
    0,
    Number(historyRange)
  );
}


// ============================================================
// LOAD HISTORY
// ============================================================

async function loadHistory() {

  if (!user) {
    return;
  }

  try {

    console.log(
      'Loading FitTrack history...'
    );

    healthHistory =
      await loadHealthHistory();

    console.log(
      'History records found:',
      healthHistory.length,
      healthHistory
    );

    const records =
      getFilteredHistory();

    updateHistorySummary(
      records
    );

    drawHistoryCaloriesChart(
      records
    );

    drawHistoryStepsChart(
      records
    );

    drawHistoryBurnedChart(
      records
    );

    drawHistoryWeightChart(
      records
    );

    drawHistoryMacroChart(
      records
    );

    renderHistoryRecords(
      records
    );

  }

  catch (error) {

    console.error(
      'History loading error:',
      error
    );

  }

}


// ============================================================
// HISTORY RANGE BUTTONS
// ============================================================

function setupHistoryButtons() {

  const buttons = {

    7:
      $('history7'),

    30:
      $('history30'),

    90:
      $('history90')

  };

  Object.entries(buttons)
    .forEach(
      ([range, button]) => {

        if (!button) {
          return;
        }

        button.onclick =
          async () => {

            historyRange =
              Number(range);

            Object.values(buttons)
              .forEach(item => {

                if (!item) {
                  return;
                }

                item.classList.toggle(
                  'history-range-active',
                  item === button
                );

                item.classList.toggle(
                  'active',
                  item === button
                );

              });

            await loadHistory();

          };

      }
    );
}


setupHistoryButtons();


// ============================================================
// HISTORY SUMMARY
// ============================================================

function updateHistorySummary(records) {

  const totalCalories =
    records.reduce(
      (sum, record) =>
        sum +
        Number(record.cal || 0),
      0
    );

  const averageCalories =
    records.length
      ? Math.round(
          totalCalories /
          records.length
        )
      : 0;

  if ($('historyAvgCalories')) {

    $('historyAvgCalories').textContent =
      averageCalories.toLocaleString();

  }


  const totalSteps =
    records.reduce(
      (sum, record) =>
        sum +
        Number(record.steps || 0),
      0
    );

  const averageSteps =
    records.length
      ? Math.round(
          totalSteps /
          records.length
        )
      : 0;

  if ($('historyAvgSteps')) {

    $('historyAvgSteps').textContent =
      averageSteps.toLocaleString();

  }


  const weightRecords =
    records.filter(
      record =>
        Number(record.weight) > 0
    );

  if (
    weightRecords.length &&
    $('historyCurrentWeight')
  ) {

    $('historyCurrentWeight').textContent =
      Number(
        weightRecords[0].weight
      ).toFixed(1);

  }

  else if ($('historyCurrentWeight')) {

    $('historyCurrentWeight').textContent =
      '--';

  }

}


// ============================================================
// HISTORY CHART SETUP
// ============================================================

function prepareHistoryChart(canvas) {

  if (!canvas) {
    return null;
  }

  const rect =
    canvas.getBoundingClientRect();

  const width =
    Math.max(
      rect.width,
      300
    );

  const height =
    Math.max(
      rect.height,
      280
    );

  const dpr =
    window.devicePixelRatio || 1;

  canvas.width =
    width * dpr;

  canvas.height =
    height * dpr;

  const ctx =
    canvas.getContext('2d');

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  return {
    ctx,
    width,
    height
  };
}


// ============================================================
// GENERIC HISTORY LINE CHART
// ============================================================

function drawHistoryLineChart(
  canvas,
  records,
  valueGetter,
  labelFormatter
) {

  if (!canvas) {
    return;
  }

  if (!records.length) {

    canvas.style.display =
      'none';

    return;

  }

  canvas.style.display =
    'block';

  const chart =
    prepareHistoryChart(
      canvas
    );

  if (!chart) {
    return;
  }

  const {
    ctx,
    width,
    height
  } = chart;

  const data =
    [...records]
      .reverse()
      .map(record => ({

        record,

        value:
          Number(
            valueGetter(record)
          ) || 0

      }));

  const padding = {

    top: 30,
    right: 30,
    bottom: 55,
    left: 65

  };

  const graphWidth =
    width -
    padding.left -
    padding.right;

  const graphHeight =
    height -
    padding.top -
    padding.bottom;

  let min =
    Math.min(
      ...data.map(
        item => item.value
      )
    );

  let max =
    Math.max(
      ...data.map(
        item => item.value
      )
    );

  if (min === max) {

    if (min === 0) {
      max = 10;
    }

    else {

      const extra =
        Math.max(
          1,
          Math.abs(min) * 0.1
        );

      min -= extra;
      max += extra;

    }

  }

  const range =
    max - min;

  min -= range * 0.1;
  max += range * 0.1;


  // GRID

  ctx.font =
    '12px sans-serif';

  ctx.textAlign =
    'right';

  ctx.textBaseline =
    'middle';

  for (
    let i = 0;
    i <= 4;
    i++
  ) {

    const ratio =
      i / 4;

    const y =
      padding.top +
      graphHeight * ratio;

    const value =
      max -
      (
        max - min
      ) *
      ratio;

    ctx.beginPath();

    ctx.moveTo(
      padding.left,
      y
    );

    ctx.lineTo(
      width - padding.right,
      y
    );

    ctx.strokeStyle =
      'rgba(255,255,255,0.10)';

    ctx.lineWidth =
      1;

    ctx.stroke();

    ctx.fillStyle =
      'rgba(255,255,255,0.60)';

    ctx.fillText(
      labelFormatter
        ? labelFormatter(value)
        : Math.round(value),
      padding.left - 10,
      y
    );

  }


  // POINTS

  const points =
    data.map(
      (item, index) => {

        const x =
          data.length === 1

            ? padding.left +
              graphWidth / 2

            : padding.left +
              (
                index /
                (
                  data.length - 1
                )
              ) *
              graphWidth;

        const y =
          padding.top +
          (
            1 -
            (
              item.value - min
            ) /
            (
              max - min
            )
          ) *
          graphHeight;

        return {

          x,
          y,

          value:
            item.value,

          record:
            item.record

        };

      }
    );


  // LINE

  if (points.length > 1) {

    ctx.beginPath();

    points.forEach(
      (point, index) => {

        if (index === 0) {

          ctx.moveTo(
            point.x,
            point.y
          );

        }

        else {

          ctx.lineTo(
            point.x,
            point.y
          );

        }

      }
    );

    ctx.strokeStyle =
      '#6ea8fe';

    ctx.lineWidth =
      3;

    ctx.lineJoin =
      'round';

    ctx.lineCap =
      'round';

    ctx.stroke();

  }


  // POINTS

  points.forEach(
    point => {

      ctx.beginPath();

      ctx.arc(
        point.x,
        point.y,
        4,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#ffffff';

      ctx.fill();

      ctx.beginPath();

      ctx.arc(
        point.x,
        point.y,
        2,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        '#6ea8fe';

      ctx.fill();

    }
  );


  // DATE LABELS

  ctx.fillStyle =
    'rgba(255,255,255,0.65)';

  ctx.textAlign =
    'center';

  ctx.textBaseline =
    'top';

  const labelStep =
    Math.max(
      1,
      Math.ceil(
        points.length / 7
      )
    );

  points.forEach(
    (point, index) => {

      if (
        index % labelStep !== 0 &&
        index !==
          points.length - 1
      ) {
        return;
      }

      ctx.fillText(
        shortDate(
          point.record.date
        ),
        point.x,
        height -
          padding.bottom +
          15
      );

    }
  );

}


// ============================================================
// CALORIES HISTORY CHART
// ============================================================

function drawHistoryCaloriesChart(records) {

  drawHistoryLineChart(

    $('caloriesHistoryChart'),

    records,

    record =>
      Number(record.cal) || 0,

    value =>
      Math.round(
        value
      ).toLocaleString()

  );

}


// ============================================================
// STEPS HISTORY CHART
// ============================================================

function drawHistoryStepsChart(records) {

  drawHistoryLineChart(

    $('stepsHistoryChart'),

    records,

    record =>
      Number(record.steps) || 0,

    value =>
      Math.round(
        value
      ).toLocaleString()

  );

}


// ============================================================
// BURNED CALORIES HISTORY CHART
// ============================================================

function drawHistoryBurnedChart(records) {

  drawHistoryLineChart(

    $('burnedHistoryChart'),

    records,

    record => {

      const active =
        Number(
          record.activeCalories
        ) || 0;

      if (active > 0) {
        return active;
      }

      const stored =
        Number(
          record.caloriesBurned
        ) || 0;

      if (stored > 0) {
        return stored;
      }

      return (
        Number(
          record.workoutCalories
        ) || 0
      ) +
      (
        Number(
          record.stepsCalories
        ) || 0
      );

    },

    value =>
      Math.round(
        value
      ).toLocaleString()

  );

}


// ============================================================
// WEIGHT HISTORY CHART
// ============================================================

function drawHistoryWeightChart(records) {

  const valid =
    records.filter(
      record =>
        Number(record.weight) > 0
    );

  drawHistoryLineChart(

    $('weightHistoryChart'),

    valid,

    record =>
      Number(record.weight) || 0,

    value =>
      value.toFixed(1)

  );

}


// ============================================================
// MACRO HISTORY CHART
// ============================================================

function drawHistoryMacroChart(records) {

  const canvas =
    $('macroHistoryChart');

  if (!canvas) {
    return;
  }

  if (!records.length) {

    canvas.style.display =
      'none';

    return;

  }

  canvas.style.display =
    'block';

  const chart =
    prepareHistoryChart(
      canvas
    );

  if (!chart) {
    return;
  }

  const {
    ctx,
    width,
    height
  } = chart;

  const data =
    [...records].reverse();

  const padding = {

    top: 45,
    right: 30,
    bottom: 55,
    left: 55

  };

  const graphWidth =
    width -
    padding.left -
    padding.right;

  const graphHeight =
    height -
    padding.top -
    padding.bottom;

  const allValues =
    data.flatMap(
      record => [

        Number(record.p) || 0,

        Number(record.c) || 0,

        Number(record.f) || 0

      ]
    );

  let max =
    Math.max(
      ...allValues,
      10
    );

  max *= 1.15;


  // GRID

  ctx.font =
    '12px sans-serif';

  ctx.textAlign =
    'right';

  ctx.textBaseline =
    'middle';

  for (
    let i = 0;
    i <= 4;
    i++
  ) {

    const ratio =
      i / 4;

    const y =
      padding.top +
      graphHeight * ratio;

    const value =
      max -
      max * ratio;

    ctx.beginPath();

    ctx.moveTo(
      padding.left,
      y
    );

    ctx.lineTo(
      width - padding.right,
      y
    );

    ctx.strokeStyle =
      'rgba(255,255,255,0.10)';

    ctx.lineWidth =
      1;

    ctx.stroke();

    ctx.fillStyle =
      'rgba(255,255,255,0.60)';

    ctx.fillText(
      Math.round(value),
      padding.left - 10,
      y
    );

  }


  const datasets = [

    {
      key: 'p',
      label: 'Protein',
      color: '#60a5fa'
    },

    {
      key: 'c',
      label: 'Carbs',
      color: '#fbbf24'
    },

    {
      key: 'f',
      label: 'Fat',
      color: '#f472b6'
    }

  ];


  datasets.forEach(
    dataset => {

      const points =
        data.map(
          (record, index) => {

            const value =
              Number(
                record[
                  dataset.key
                ]
              ) || 0;

            const x =
              data.length === 1

                ? padding.left +
                  graphWidth / 2

                : padding.left +
                  (
                    index /
                    (
                      data.length - 1
                    )
                  ) *
                  graphWidth;

            const y =
              padding.top +
              (
                1 -
                value / max
              ) *
              graphHeight;

            return {
              x,
              y,
              value,
              record
            };

          }
        );


      if (points.length > 1) {

        ctx.beginPath();

        points.forEach(
          (point, index) => {

            if (index === 0) {

              ctx.moveTo(
                point.x,
                point.y
              );

            }

            else {

              ctx.lineTo(
                point.x,
                point.y
              );

            }

          }
        );

        ctx.strokeStyle =
          dataset.color;

        ctx.lineWidth =
          2.5;

        ctx.lineJoin =
          'round';

        ctx.lineCap =
          'round';

        ctx.stroke();

      }


      points.forEach(
        point => {

          ctx.beginPath();

          ctx.arc(
            point.x,
            point.y,
            3,
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            dataset.color;

          ctx.fill();

        }
      );

    }
  );


  // DATE LABELS

  ctx.fillStyle =
    'rgba(255,255,255,0.65)';

  ctx.textAlign =
    'center';

  ctx.textBaseline =
    'top';

  const labelStep =
    Math.max(
      1,
      Math.ceil(
        data.length / 7
      )
    );

  data.forEach(
    (record, index) => {

      if (
        index % labelStep !== 0 &&
        index !==
          data.length - 1
      ) {
        return;
      }

      const x =
        data.length === 1

          ? padding.left +
            graphWidth / 2

          : padding.left +
            (
              index /
              (
                data.length - 1
              )
            ) *
            graphWidth;

      ctx.fillText(
        shortDate(
          record.date
        ),
        x,
        height -
          padding.bottom +
          15
      );

    }
  );


  // LEGEND

  let legendX =
    padding.left;

  datasets.forEach(
    dataset => {

      ctx.fillStyle =
        dataset.color;

      ctx.fillRect(
        legendX,
        12,
        10,
        10
      );

      ctx.fillStyle =
        'rgba(255,255,255,0.75)';

      ctx.textAlign =
        'left';

      ctx.fillText(
        dataset.label,
        legendX + 16,
        22
      );

      legendX += 90;

    }
  );

}


// ============================================================
// RENDER DAILY HISTORY
// ============================================================

function renderHistoryRecords(records) {

  const container =
    $('dashboardHistory');

  if (!container) {
    return;
  }

  if (!records.length) {

    container.innerHTML = `
      <p>
        No history available yet.
      </p>
    `;

    return;

  }

  container.innerHTML =
    records.map(
      record => {

        const calories =
          Number(record.cal) || 0;

        const protein =
          Number(record.p) || 0;

        const carbs =
          Number(record.c) || 0;

        const fat =
          Number(record.f) || 0;

        const steps =
          Number(record.steps) || 0;

        const weight =
          Number(record.weight) || 0;

        const workout =
          record.workout || 'Rest';

        const workoutCalories =
          Number(
            record.workoutCalories
          ) || 0;

        const stepsCalories =
          Number(
            record.stepsCalories
          ) || 0;

        let totalBurned =
          Number(
            record.activeCalories
          ) || 0;

        if (totalBurned <= 0) {

          totalBurned =
            Number(
              record.caloriesBurned
            ) || 0;

        }

        if (totalBurned <= 0) {

          totalBurned =
            workoutCalories +
            stepsCalories;

        }

        const bmi =
          weight > 0 &&
          Number(profile.height) > 0

            ? weight /
              Math.pow(
                Number(profile.height) / 100,
                2
              )

            : 0;

        let bmiStatus = '';

        if (bmi > 0) {

          if (bmi < 18.5) {
            bmiStatus = 'Underweight';
          }

          else if (bmi < 25) {
            bmiStatus = 'Normal';
          }

          else if (bmi < 30) {
            bmiStatus = 'Overweight';
          }

          else {
            bmiStatus = 'Obese';
          }

        }

        return `

          <div class="historical-day">

            <div class="historical-day-header">

              <div>

                <p class="eyebrow">
                  DAILY RECORD
                </p>

                <h3>
                  ${escapeHtml(
                    formatDate(
                      record.date
                    )
                  )}
                </h3>

              </div>

              <span class="historical-date">
                ${escapeHtml(
                  record.date
                )}
              </span>

            </div>

            <div class="historical-stats">

              <div class="historical-stat">

                <span>
                  🔥 Calories
                </span>

                <strong>
                  ${calories.toLocaleString()} kcal
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  🥩 Protein
                </span>

                <strong>
                  ${Math.round(
                    protein
                  )} g
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  🍚 Carbs
                </span>

                <strong>
                  ${Math.round(
                    carbs
                  )} g
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  🥑 Fat
                </span>

                <strong>
                  ${Math.round(
                    fat
                  )} g
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  ⚖️ Weight
                </span>

                <strong>
                  ${
                    weight > 0
                      ? weight.toFixed(1) +
                        ' kg'
                      : '--'
                  }
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  📊 BMI
                </span>

                <strong>
                  ${
                    bmi > 0
                      ? bmi.toFixed(1)
                      : '--'
                  }
                </strong>

                <small>
                  ${escapeHtml(
                    bmiStatus
                  )}
                </small>

              </div>

              <div class="historical-stat">

                <span>
                  🚶 Steps
                </span>

                <strong>
                  ${steps.toLocaleString()}
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  🏋️ Workout
                </span>

                <strong>
                  ${escapeHtml(
                    workout
                  )}
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  🔥 Workout Burn
                </span>

                <strong>
                  ${workoutCalories.toLocaleString()}
                  kcal
                </strong>

              </div>

              <div class="historical-stat">

                <span>
                  🚶 Walking Burn
                </span>

                <strong>
                  ${stepsCalories.toLocaleString()}
                  kcal
                </strong>

              </div>

              <div
                class="historical-stat historical-total">

                <span>
                  🔥 Total Burned
                </span>

                <strong>
                  ${totalBurned.toLocaleString()}
                  kcal
                </strong>

              </div>

            </div>

          </div>

        `;

      }
    ).join('');

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(value)

    .replaceAll(
      '&',
      '&amp;'
    )

    .replaceAll(
      '<',
      '&lt;'
    )

    .replaceAll(
      '>',
      '&gt;'
    )

    .replaceAll(
      '"',
      '&quot;'
    )

    .replaceAll(
      "'",
      '&#039;'
    );

}


// ============================================================
// BARCODE SCANNER
// ============================================================

if ($('scan')) {

  $('scan').onclick =
    async () => {

      if (
        !('BarcodeDetector' in window)
      ) {

        alert(
          'Barcode scanning is not supported by this browser.'
        );

        return;

      }

      try {

        stream =
          await navigator.mediaDevices
            .getUserMedia({

              video: {
                facingMode: 'environment'
              }

            });

        $('video').hidden =
          false;

        $('video').srcObject =
          stream;

        await $('video').play();

        const detector =
          new BarcodeDetector({

            formats: [
              'ean_13',
              'ean_8',
              'upc_a',
              'upc_e'
            ]

          });

        const loop =
          async () => {

            if (!stream) {
              return;
            }

            try {

              const codes =
                await detector.detect(
                  $('video')
                );

              if (codes.length) {

                const code =
                  codes[0].rawValue;

                stream
                  .getTracks()
                  .forEach(
                    track =>
                      track.stop()
                  );

                stream =
                  null;

                $('video').hidden =
                  true;

                const response =
                  await fetch(
                    `https://world.openfoodfacts.org/api/v2/product/${code}.json`
                  );

                const json =
                  await response.json();

                if (
                  json.status === 1
                ) {

                  const product =
                    json.product;

                  const nutrients =
                    product.nutriments || {};

                  $('fname').value =
                    product.product_name ||
                    'Scanned food';

                  $('serving').value =
                    product.serving_size ||
                    '100 g';

                  $('fcal').value =
                    Math.round(

                      nutrients[
                        'energy-kcal_serving'
                      ]

                      ??

                      nutrients[
                        'energy-kcal_100g'
                      ]

                      ??

                      0

                    );

                  $('fp').value =
                    nutrients.proteins_serving
                    ??
                    nutrients.proteins_100g
                    ??
                    0;

                  $('fc').value =
                    nutrients.carbohydrates_serving
                    ??
                    nutrients.carbohydrates_100g
                    ??
                    0;

                  $('ff').value =
                    nutrients.fat_serving
                    ??
                    nutrients.fat_100g
                    ??
                    0;

                }

                else {

                  alert(
                    'Product not found. Enter nutrition manually.'
                  );

                }

              }

              else {

                requestAnimationFrame(
                  loop
                );

              }

            }

            catch (error) {

              console.error(
                'Barcode detection error:',
                error
              );

              requestAnimationFrame(
                loop
              );

            }

          };

        loop();

      }

      catch (error) {

        console.error(
          'Camera error:',
          error
        );

        alert(
          error.message
        );

      }

    };

}


// ============================================================
// REDRAW HISTORY GRAPHS ON WINDOW RESIZE
// ============================================================

let resizeTimer = null;

window.addEventListener(
  'resize',
  () => {

    clearTimeout(
      resizeTimer
    );

    resizeTimer =
      setTimeout(
        () => {

          if (
            $('progress') &&
            !$('progress').hidden &&
            user
          ) {

            const records =
              getFilteredHistory();

            drawHistoryWeightChart(
              records
            );

            drawHistoryCaloriesChart(
              records
            );

            drawHistoryStepsChart(
              records
            );

            drawHistoryMacroChart(
              records
            );

            drawHistoryBurnedChart(
              records
            );

          }

        },
        150
      );

  }
);


// ============================================================
// CONSTELLATION BACKGROUND
// ============================================================

const constellationCanvas =
  $('constellation');

if (constellationCanvas) {

  const ctx =
    constellationCanvas.getContext('2d');

  let stars = [];

  let mouse = {

    x: null,
    y: null,
    active: false

  };

  const STAR_COUNT =
    110;

  const CONNECTION_DISTANCE =
    130;

  const MOUSE_CONNECTION_DISTANCE =
    190;


  function resizeConstellation() {

    const dpr =
      window.devicePixelRatio || 1;

    constellationCanvas.width =
      window.innerWidth * dpr;

    constellationCanvas.height =
      window.innerHeight * dpr;

    constellationCanvas.style.width =
      window.innerWidth + 'px';

    constellationCanvas.style.height =
      window.innerHeight + 'px';

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    createStars();

  }


  function createStars() {

    stars = [];

    for (
      let i = 0;
      i < STAR_COUNT;
      i++
    ) {

      stars.push({

        x:
          Math.random() *
          window.innerWidth,

        y:
          Math.random() *
          window.innerHeight,

        vx:
          (
            Math.random() -
            0.5
          ) * 0.15,

        vy:
          (
            Math.random() -
            0.5
          ) * 0.15,

        radius:
          Math.random() *
          1.4 +
          0.4,

        opacity:
          Math.random() *
          0.6 +
          0.25,

        twinkle:
          Math.random() *
          Math.PI *
          2,

        twinkleSpeed:
          Math.random() *
          0.02 +
          0.005

      });

    }

  }


  window.addEventListener(
    'mousemove',
    event => {

      mouse.x =
        event.clientX;

      mouse.y =
        event.clientY;

      mouse.active =
        true;

    }
  );


  window.addEventListener(
    'mouseleave',
    () => {

      mouse.active =
        false;

    }
  );


  function drawConstellation() {

    ctx.clearRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );

    for (const star of stars) {

      star.x +=
        star.vx;

      star.y +=
        star.vy;

      if (star.x < -10) {
        star.x =
          window.innerWidth + 10;
      }

      if (
        star.x >
        window.innerWidth + 10
      ) {
        star.x = -10;
      }

      if (star.y < -10) {
        star.y =
          window.innerHeight + 10;
      }

      if (
        star.y >
        window.innerHeight + 10
      ) {
        star.y = -10;
      }

      star.twinkle +=
        star.twinkleSpeed;

      const pulse =
        star.opacity +
        Math.sin(
          star.twinkle
        ) * 0.15;

      ctx.beginPath();

      ctx.arc(
        star.x,
        star.y,
        star.radius * 4,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        `rgba(
          100,
          150,
          255,
          ${Math.max(
            0,
            pulse * 0.08
          )}
        )`;

      ctx.fill();

      ctx.beginPath();

      ctx.arc(
        star.x,
        star.y,
        star.radius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        `rgba(
          180,
          210,
          255,
          ${Math.max(
            0,
            pulse
          )}
        )`;

      ctx.fill();

    }


    // STAR CONNECTIONS

    for (
      let i = 0;
      i < stars.length;
      i++
    ) {

      for (
        let j = i + 1;
        j < stars.length;
        j++
      ) {

        const a =
          stars[i];

        const b =
          stars[j];

        const dx =
          a.x - b.x;

        const dy =
          a.y - b.y;

        const distance =
          Math.sqrt(
            dx * dx +
            dy * dy
          );

        if (
          distance <
          CONNECTION_DISTANCE
        ) {

          const opacity =
            (
              1 -
              distance /
              CONNECTION_DISTANCE
            ) * 0.25;

          ctx.beginPath();

          ctx.moveTo(
            a.x,
            a.y
          );

          ctx.lineTo(
            b.x,
            b.y
          );

          ctx.strokeStyle =
            `rgba(
              100,
              150,
              255,
              ${opacity}
            )`;

          ctx.lineWidth =
            0.6;

          ctx.stroke();

        }

      }

    }


    // MOUSE CONNECTIONS

    if (mouse.active) {

      for (const star of stars) {

        const dx =
          star.x -
          mouse.x;

        const dy =
          star.y -
          mouse.y;

        const distance =
          Math.sqrt(
            dx * dx +
            dy * dy
          );

        if (
          distance <
          MOUSE_CONNECTION_DISTANCE
        ) {

          const opacity =
            (
              1 -
              distance /
              MOUSE_CONNECTION_DISTANCE
            ) * 0.55;

          ctx.beginPath();

          ctx.moveTo(
            star.x,
            star.y
          );

          ctx.lineTo(
            mouse.x,
            mouse.y
          );

          ctx.strokeStyle =
            `rgba(
              100,
              170,
              255,
              ${opacity}
            )`;

          ctx.lineWidth =
            1;

          ctx.stroke();

        }

      }

    }

    requestAnimationFrame(
      drawConstellation
    );

  }


  window.addEventListener(
    'resize',
    resizeConstellation
  );

  resizeConstellation();

  drawConstellation();

}


// ============================================================
// DATE DISPLAY
// ============================================================

if ($('date')) {

  $('date').textContent =
    new Date().toLocaleDateString(
      undefined,
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }
    );

}


// ============================================================
// INITIAL PROFILE METRICS
// ============================================================

calculateMetrics();
