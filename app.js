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
// LOCAL DATE
//
// IMPORTANT:
// This produces:
//
// 2026-08-22
//
// and is used for:
//
// users/{uid}/daily/2026-08-22
// ============================================================

function day() {

  const now = new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, '0');

  const date =
    String(
      now.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${date}`;

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


// ============================================================
// IMPORTANT:
//
// YOUR DATABASE STRUCTURE IS:
//
// users
//   └── {uid}
//       ├── daily
//       │   └── 2026-08-22
//       ├── foods
//       ├── exercises
//       └── weights
//
// NOT:
//
// users/{uid}/days/{date}
//
// ============================================================

function dayRef() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return doc(
    db,
    'users',
    user.uid,
    'daily',
    day()
  );

}


// ============================================================
// FOOD COLLECTION
// ============================================================

function foodCollection() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return collection(
    db,
    'users',
    user.uid,
    'daily',
    day(),
    'foods'
  );

}


// ============================================================
// EXERCISE COLLECTION
// ============================================================

function exerciseCollection() {

  if (!user) {
    throw new Error('No authenticated user.');
  }

  return collection(
    db,
    'users',
    user.uid,
    'daily',
    day(),
    'exercises'
  );

}


// ============================================================
// EMPTY DAILY DATA
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

    caloriesBurned: 0

  };

}


// ============================================================
// GET TODAY
// ============================================================

async function getDay() {

  if (!user) {

    return emptyDay();

  }


  const currentDay =
    day();


  console.log(
    'Reading daily document:',
    `users/${user.uid}/daily/${currentDay}`
  );


  const snapshot =
    await getDoc(
      dayRef()
    );


  if (!snapshot.exists()) {

    console.log(
      'Daily document does not exist yet:',
      currentDay
    );

    return emptyDay();

  }


  const data =
    snapshot.data();


  console.log(
    'Firestore daily document:',
    data
  );


  /*
    IMPORTANT:

    Firebase numbers can sometimes
    arrive as different numeric types.

    Number() makes sure the dashboard
    receives normal JavaScript numbers.
  */

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
      Number(data.caloriesBurned) || 0

  };

}


// ============================================================
// STEP CALORIES
// ============================================================

function calculateStepCalories(steps) {

  const weight =
    Number(profile.weight) || 0;

  const stepCount =
    Number(steps) || 0;


  if (
    weight <= 0 ||
    stepCount <= 0
  ) {

    return 0;

  }


  /*
    Approximation.

    73 kg × 10,000 steps × 0.0004
    ≈ 292 kcal
  */

  return Math.round(
    stepCount *
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
    met *
    weight
  );

}


// ============================================================
// TOTAL CALORIES BURNED
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
// BMI + MACROS
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


  // ==========================================================
  // BMR
  // ==========================================================

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


  // ==========================================================
  // MACROS
  // ==========================================================

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


  profile.calGoal =
    calories;

  profile.pGoal =
    protein;

  profile.cGoal =
    carbs;

  profile.fGoal =
    fat;


  // ==========================================================
  // BMI
  // ==========================================================

  const bmi =
    weight /
    Math.pow(
      height / 100,
      2
    );


  let status = '';

  let color = '';


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


  // ==========================================================
  // DASHBOARD BMI
  // ==========================================================

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


  // ==========================================================
  // SETTINGS BMI
  // ==========================================================

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


  // ==========================================================
  // SETTINGS CALORIES
  // ==========================================================

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


  // ==========================================================
  // DASHBOARD GOALS
  // ==========================================================

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


  if (id === 'food') {

    food();

  }


  if (id === 'workout') {

    exercises();

  }


  if (id === 'progress') {

    history();

  }


  if (id === 'dash') {

    refresh();

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
// AUTH MODE
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
// AUTH FORM
// ============================================================

if ($('authForm')) {

  $('authForm').onsubmit =
    async event => {

      event.preventDefault();


      if ($('authMsg')) {

        $('authMsg').textContent =
          '';

      }


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

        $('auth').hidden =
          false;

      }

      if ($('app')) {

        $('app').hidden =
          true;

      }

      if ($('logout')) {

        $('logout').hidden =
          true;

      }

      return;

    }


    if ($('auth')) {

      $('auth').hidden =
        true;

    }

    if ($('app')) {

      $('app').hidden =
        false;

    }

    if ($('logout')) {

      $('logout').hidden =
        false;

    }


    try {

      // ======================================================
      // LOAD PROFILE
      // ======================================================

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


      console.log(
        'Profile loaded:',
        profile
      );


      // ======================================================
      // UPDATE SETTINGS
      // ======================================================

      fill();

      calculateMetrics();


      // ======================================================
      // LOAD TODAY
      // ======================================================

      await refresh();


      // ======================================================
      // SHOW DASHBOARD
      // ======================================================

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


  calculateMetrics();

}


// ============================================================
// LIVE SETTINGS CALCULATION
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
        Number(
          $('age').value
        );


      profile.sex =
        $('sex').value;


      profile.height =
        Number(
          $('height').value
        );


      profile.weight =
        Number(
          $('weight').value
        );


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
          Number(
            $('age').value
          );


        profile.sex =
          $('sex').value;


        profile.height =
          Number(
            $('height').value
          );


        profile.weight =
          Number(
            $('weight').value
          );


        profile.stepGoal =
          Number(
            $('goalSteps').value
          ) || 10000;


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
              totalBurned

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
// DASHBOARD REFRESH
// ============================================================

async function refresh() {

  if (!user) {

    return;

  }


  try {

    console.log(
      '========================================'
    );

    console.log(
      'FITTRACK DASHBOARD REFRESH'
    );

    console.log(
      'User UID:',
      user.uid
    );

    console.log(
      'Today:',
      day()
    );

    console.log(
      'Daily Firestore path:',
      `users/${user.uid}/daily/${day()}`
    );

    console.log(
      '========================================'
    );


    calculateMetrics();


    // ========================================================
    // GET DAILY DOCUMENT
    // ========================================================

    const d =
      await getDay();


    console.log(
      'Daily data loaded:',
      d
    );


    // ========================================================
    // CALORIES EATEN
    // ========================================================

    const caloriesEaten =
      Number(d.cal) || 0;


    const calorieGoal =
      Number(profile.calGoal) || 0;


    if ($('cal')) {

      $('cal').textContent =
        caloriesEaten.toLocaleString();

    }


    if ($('calGoal')) {

      $('calGoal').textContent =
        calorieGoal.toLocaleString();

    }


    const caloriePercent =
      calorieGoal > 0
        ? (
            caloriesEaten /
            calorieGoal
          ) * 100
        : 0;


    if ($('calBar')) {

      $('calBar').style.width =
        Math.min(
          100,
          caloriePercent
        ) + '%';

    }


    if ($('calRemaining')) {

      $('calRemaining').textContent =
        `${Math.max(
          0,
          calorieGoal - caloriesEaten
        ).toLocaleString()} kcal remaining`;

    }


    // ========================================================
    // STEPS
    //
    // THIS IS THE IMPORTANT PART
    //
    // d.steps comes from:
    //
    // users/{uid}/daily/{date}
    //
    // ========================================================

    const steps =
      Number(d.steps) || 0;


    console.log(
      'STEPS FROM FIRESTORE:',
      d.steps
    );


    console.log(
      'STEPS USED BY DASHBOARD:',
      steps
    );


    if ($('stepsDash')) {

      $('stepsDash').textContent =
        steps.toLocaleString();

    }


    // ========================================================
    // STEP GOAL
    // ========================================================

    const stepGoal =
      Number(
        profile.stepGoal
      ) || 10000;


    if ($('stepGoalDash')) {

      $('stepGoalDash').textContent =
        stepGoal.toLocaleString();

    }


    // ========================================================
    // STEP PROGRESS BAR
    // ========================================================

    if ($('stepsBar')) {

      const stepPercent =
        stepGoal > 0
          ? (
              steps /
              stepGoal
            ) * 100
          : 0;


      $('stepsBar').style.width =
        Math.min(
          100,
          stepPercent
        ) + '%';

    }


    // ========================================================
    // STEP CALORIES
    // ========================================================

    let stepsCalories =
      Number(
        d.stepsCalories
      ) || 0;


    /*
      If steps exist but calories
      have not yet been calculated,
      calculate them automatically.
    */

    if (
      steps > 0 &&
      stepsCalories <= 0
    ) {

      stepsCalories =
        calculateStepCalories(
          steps
        );


      console.log(
        'Calculated step calories:',
        stepsCalories
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


    // ========================================================
    // WORKOUT
    // ========================================================

    const workout =
      d.workout || 'Rest';


    const workoutCalories =
      Number(
        d.workoutCalories
      ) || 0;


    if ($('workoutDash')) {

      $('workoutDash').textContent =
        workout;

    }


    // ========================================================
    // TOTAL CALORIES BURNED
    // ========================================================

    const totalBurned =
      calculateTotalBurned(

        workoutCalories,

        stepsCalories

      );


    if ($('burned')) {

      $('burned').textContent =
        totalBurned.toLocaleString();

    }


    if ($('burnWorkout')) {

      $('burnWorkout').textContent =
        `${workoutCalories.toLocaleString()} kcal`;

    }


    if ($('burnSteps')) {

      $('burnSteps').textContent =
        `${stepsCalories.toLocaleString()} kcal`;

    }


    if ($('caloriesBurnedDash')) {

      $('caloriesBurnedDash').textContent =
        `${totalBurned.toLocaleString()} kcal`;

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
        `${totalBurned.toLocaleString()} kcal`;

    }


    // ========================================================
    // WEIGHT
    // ========================================================

    if ($('weightDash')) {

      $('weightDash').textContent =
        Number(
          profile.weight || 0
        ).toFixed(1);

    }


    // ========================================================
    // MACROS
    // ========================================================

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


    if ($('macroProteinGoal')) {

      $('macroProteinGoal').textContent =
        profile.pGoal;

    }


    if ($('macroCarbsGoal')) {

      $('macroCarbsGoal').textContent =
        profile.cGoal;

    }


    if ($('macroFatGoal')) {

      $('macroFatGoal').textContent =
        profile.fGoal;

    }


    console.log(
      'FINAL DASHBOARD VALUES:',
      {

        date:
          day(),

        steps,

        stepGoal,

        stepsCalories,

        workout,

        workoutCalories,

        totalBurned

      }
    );


  }

  catch (error) {

    console.error(
      'Dashboard refresh error:',
      error
    );

  }

}


// ============================================================
// FOOD FORM
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
            Number(
              $('fcal').value
            ) || 0,

          p:
            Number(
              $('fp').value
            ) || 0,

          c:
            Number(
              $('fc').value
            ) || 0,

          f:
            Number(
              $('ff').value
            ) || 0

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

          orderBy(
            '__name__'
          )

        )

      );


    $('foodList').innerHTML =

      snapshot.docs.map(
        item => {

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

                  · ${Number(
                    f.cal || 0
                  )} kcal

                  · P ${Number(
                    f.p || 0
                  )}

                  · C ${Number(
                    f.c || 0
                  )}

                  · F ${Number(
                    f.f || 0
                  )}

                </small>

              </span>

              <button
                data-del="${item.id}">
                Delete
              </button>

            </div>

          `;

        }

      ).join('')

      ||

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

                  'daily',

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
// PPL BUTTONS
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


// ============================================================
// EXERCISE FORM
// ============================================================

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
              Number(
                $('sets').value
              ) || 0,

            reps:
              Number(
                $('reps').value
              ) || 0,

            weight:
              Number(
                $('ew').value
              ) || 0

          }

        );


        event.target.reset();


        if ($('sets')) {

          $('sets').value =
            3;

        }


        if ($('reps')) {

          $('reps').value =
            10;

        }


        if ($('ew')) {

          $('ew').value =
            0;

        }


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
// EXERCISES
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

      snapshot.docs.map(
        item => {

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

                  · ${Number(
                    e.sets || 0
                  )}

                  × ${Number(
                    e.reps || 0
                  )}

                  @ ${Number(
                    e.weight || 0
                  )} kg

                </small>

              </span>

              <button
                data-ex="${item.id}">
                Delete
              </button>

            </div>

          `;

        }

      ).join('')

      ||

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

                  'daily',

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
// WEIGHT TRACKING
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

            stepsCalories,

            caloriesBurned:
              totalBurned

          },

          {
            merge: true
          }

        );


        await addDoc(

          collection(

            db,

            'users',

            user.uid,

            'weights'

          ),

          {

            date:
              day(),

            weight:
              newWeight

          }

        );


        await refresh();

        await history();


        $('weightInput').value =
          '';

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
// MANUAL STEPS
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
          Number(
            $('stepsInput').value
          ) || 0;


        if (steps < 0) {

          alert(
            'Steps cannot be negative.'
          );

          return;

        }


        const roundedSteps =
          Math.round(
            steps
          );


        // ====================================================
        // CALCULATE STEP CALORIES
        // ====================================================

        const stepsCalories =
          calculateStepCalories(
            roundedSteps
          );


        // ====================================================
        // GET WORKOUT DATA
        // ====================================================

        const d =
          await getDay();


        const totalBurned =
          calculateTotalBurned(

            d.workoutCalories,

            stepsCalories

          );


        // ====================================================
        // SAVE TO:
        //
        // users/{uid}/daily/{date}
        //
        // ====================================================

        await setDoc(

          dayRef(),

          {

            steps:
              roundedSteps,

            stepsCalories,

            caloriesBurned:
              totalBurned

          },

          {
            merge: true
          }

        );


        console.log(
          'Steps successfully saved:',
          {

            path:
              `users/${user.uid}/daily/${day()}`,

            steps:
              roundedSteps,

            stepsCalories,

            caloriesBurned:
              totalBurned

          }
        );


        $('stepsInput').value =
          '';


        // ====================================================
        // REFRESH DASHBOARD
        // ====================================================

        await refresh();


        alert(

          `${roundedSteps.toLocaleString()} steps saved!\n\n` +

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
// WEIGHT HISTORY
// ============================================================

async function history() {

  if (!user || !$('history')) {

    return;

  }


  try {

    const snapshot =
      await getDocs(

        query(

          collection(

            db,

            'users',

            user.uid,

            'weights'

          ),

          orderBy(
            'date',
            'desc'
          )

        )

      );


    $('history').innerHTML =

      snapshot.docs.map(
        item => {

          const data =
            item.data();


          return `

            <div class="row">

              <span>
                ${escapeHtml(
                  data.date || ''
                )}
              </span>

              <strong>

                ${Number(
                  data.weight || 0
                ).toFixed(1)}

                kg

              </strong>

            </div>

          `;

        }

      ).join('')

      ||

      '<p>No weight history yet.</p>';

  }

  catch (error) {

    console.error(
      'Weight history error:',
      error
    );

  }

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
          await navigator.mediaDevices.getUserMedia({

            video: {

              facingMode:
                'environment'

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
                    product.nutriments ||
                    {};


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
// CONSTELLATION BACKGROUND
// ============================================================

const canvas =
  document.getElementById(
    'constellation'
  );


if (canvas) {

  const ctx =
    canvas.getContext(
      '2d'
    );


  let stars = [];

  let animationFrame;


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


    canvas.width =
      window.innerWidth *
      dpr;


    canvas.height =
      window.innerHeight *
      dpr;


    canvas.style.width =
      window.innerWidth +
      'px';


    canvas.style.height =
      window.innerHeight +
      'px';


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


      if (
        star.x < -10
      ) {

        star.x =
          window.innerWidth +
          10;

      }


      if (
        star.x >
        window.innerWidth + 10
      ) {

        star.x =
          -10;

      }


      if (
        star.y < -10
      ) {

        star.y =
          window.innerHeight +
          10;

      }


      if (
        star.y >
        window.innerHeight + 10
      ) {

        star.y =
          -10;

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


    // ========================================================
    // STAR CONNECTIONS
    // ========================================================

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
          a.x -
          b.x;

        const dy =
          a.y -
          b.y;


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


    // ========================================================
    // MOUSE CONNECTIONS
    // ========================================================

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


    animationFrame =
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