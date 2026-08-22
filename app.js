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
// HELPERS
// ============================================================

const $ = id =>
  document.getElementById(id);


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
// DATE
// ============================================================

$('date').textContent =
  new Date().toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  );


// ============================================================
// DATE HELPERS
// ============================================================

// ============================================================
// LOCAL DATE (Philippines friendly)
// ============================================================

function day() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${date}`;
}


const userRef = () =>
  doc(
    db,
    'users',
    user.uid
  );


const dayRef = () =>
  doc(
    db,
    'users',
    user.uid,
    'days',
    day()
  );


// ============================================================
// GET TODAY
// ============================================================

async function getDay() {

  const snapshot =
    await getDoc(dayRef());


  const data =
    snapshot.exists()
      ? snapshot.data()
      : {};


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
// CALORIES BURNED CALCULATIONS
// ============================================================

function calculateStepCalories(steps) {

  const weight =
    Number(profile.weight) || 0;


  if (
    !weight ||
    !steps
  ) {

    return 0;

  }


  /*
    Approximate walking calories.

    Average walking:
    ~0.04 kcal per kg per step

    Example:

    73 kg × 10,000 × 0.04
    = approximately 292 kcal
  */

  const calories =
    steps *
    weight *
    0.0004;


  return Math.round(calories);

}


// ============================================================
// WORKOUT CALORIES
// ============================================================

function calculateWorkoutCalories(type) {

  const weight =
    Number(profile.weight) || 73;


  /*
    Estimated calories for a
    moderate 60-minute resistance
    training session.

    MET values:

    Push = 5.0
    Pull = 5.0
    Legs = 6.0

    kcal =
    MET × body weight × hours
  */

  let met = 5;


  if (type === 'Legs') {

    met = 6;

  }


  const durationHours = 1;


  const calories =
    met *
    weight *
    durationHours;


  return Math.round(calories);

}


// ============================================================
// TOTAL BURNED
// ============================================================

function calculateTotalBurned(
  workoutCalories,
  stepsCalories
) {

  return Math.round(
    Number(workoutCalories || 0) +
    Number(stepsCalories || 0)
  );

}


// ============================================================
// BMI + MACRO CALCULATOR
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

    return;

  }


  // ----------------------------------------------------------
  // Mifflin-St Jeor
  // ----------------------------------------------------------

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


  // Moderate activity

  const calories =
    Math.round(
      bmr * 1.55
    );


  // ----------------------------------------------------------
  // MACROS
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // BMI
  // ----------------------------------------------------------

  const bmi =
    weight /
    Math.pow(
      height / 100,
      2
    );


  let status = '';

  let color = '';


  if (bmi < 18.5) {

    status =
      'Underweight';

    color =
      'under';

  }

  else if (bmi < 25) {

    status =
      'Normal';

    color =
      'normal';

  }

  else if (bmi < 30) {

    status =
      'Overweight';

    color =
      'over';

  }

  else {

    status =
      'Obese';

    color =
      'obese';

  }


  // ----------------------------------------------------------
  // DASHBOARD BMI
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // SETTINGS BMI
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // SETTINGS CALCULATIONS
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // DASHBOARD GOALS
  // ----------------------------------------------------------

  if ($('calGoal')) {

    $('calGoal').textContent =
      calories;

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

}


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


// ============================================================
// AUTH FORM
// ============================================================

$('authForm').onsubmit =
  async event => {

    event.preventDefault();

    $('authMsg').textContent =
      '';


    try {

      if (signup) {

        const credentials =
          await createUserWithEmailAndPassword(
            auth,
            $('email').value,
            $('password').value
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
          $('email').value,
          $('password').value
        );

      }

    }

    catch (error) {

      console.error(error);

      $('authMsg').textContent =
        error.message;

    }

  };


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(
  auth,
  async currentUser => {

    user =
      currentUser;


    if (!currentUser) {

      $('auth').hidden =
        false;

      $('app').hidden =
        true;

      $('logout').hidden =
        true;

      return;

    }


    $('auth').hidden =
      true;

    $('app').hidden =
      false;

    $('logout').hidden =
      false;


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

$('logout').onclick =
  () => signOut(auth);


// ============================================================
// FILL SETTINGS
// ============================================================

function fill() {

  $('age').value =
    profile.age;


  $('sex').value =
    profile.sex || 'male';


  $('height').value =
    profile.height;


  $('weight').value =
    profile.weight;


  $('goalSteps').value =
    profile.stepGoal;


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

$('settingsForm').onsubmit =
  async event => {

    event.preventDefault();


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
      );


    calculateMetrics();


    await setDoc(
      userRef(),
      profile,
      {
        merge: true
      }
    );


    await refresh();


    alert(
      'Profile saved successfully.'
    );

  };


// ============================================================
// DASHBOARD REFRESH
// ============================================================

async function refresh() {

  calculateMetrics();

  const d = await getDay();

  console.log("Today's data:", d);

  // -----------------------
  // Calories Eaten
  // -----------------------

  $("cal").textContent = Math.round(d.cal);
  $("calGoal").textContent = profile.calGoal;

  const percent =
    profile.calGoal > 0
      ? (d.cal / profile.calGoal) * 100
      : 0;

  $("calBar").style.width =
    Math.min(100, percent) + "%";

  $("calRemaining").textContent =
    `${Math.max(0, profile.calGoal - d.cal)} kcal remaining`;

  // -----------------------
  // Calories Burned
  // -----------------------

  const burned =
    (Number(d.workoutCalories) || 0) +
    (Number(d.stepsCalories) || 0);

  if ($("burned"))
    $("burned").textContent = burned;

  if ($("burnWorkout"))
    $("burnWorkout").textContent =
      `${Number(d.workoutCalories || 0)} kcal`;

  if ($("burnSteps"))
    $("burnSteps").textContent =
      `${Number(d.stepsCalories || 0)} kcal`;

  // -----------------------
  // Weight
  // -----------------------

  $("weightDash").textContent =
    Number(profile.weight).toFixed(1);

  // -----------------------
  // Steps
  // -----------------------

  $("stepsDash").textContent =
    Number(d.steps || 0).toLocaleString();

  // -----------------------
  // Workout
  // -----------------------

  $("workoutDash").textContent =
    d.workout || "Rest";

  // -----------------------
  // Macros
  // -----------------------

  $("macroProtein").textContent = Math.round(d.p || 0);
  $("macroCarbs").textContent = Math.round(d.c || 0);
  $("macroFat").textContent = Math.round(d.f || 0);

  $("macroProteinGoal").textContent = profile.pGoal;
  $("macroCarbsGoal").textContent = profile.cGoal;
  $("macroFatGoal").textContent = profile.fGoal;
}

  // ----------------------------------------------------------
  // CALORIES BURNED
  // ----------------------------------------------------------

  const workoutCalories =
    Number(
      d.workoutCalories
    ) || 0;


  const stepsCalories =
    Number(
      d.stepsCalories
    ) || 0;


  const totalBurned =
    calculateTotalBurned(
      workoutCalories,
      stepsCalories
    );


  $('caloriesBurnedDash').textContent =
    `${totalBurned.toLocaleString()} kcal`;


  $('workoutCaloriesDash').textContent =
    `${workoutCalories.toLocaleString()} kcal`;


  $('stepsCaloriesDash').textContent =
    `${stepsCalories.toLocaleString()} kcal`;


  $('totalCaloriesBurnedDash').textContent =
    `${totalBurned.toLocaleString()} kcal`;


// ============================================================
// FOOD FORM
// ============================================================

$('foodForm').onsubmit =
  async event => {

    event.preventDefault();


    const f = {

      name:
        $('fname').value,

      serving:
        $('serving').value,

      cal:
        Number(
          $('fcal').value
        ),

      p:
        Number(
          $('fp').value
        ),

      c:
        Number(
          $('fc').value
        ),

      f:
        Number(
          $('ff').value
        )

    };


    await addDoc(

      collection(
        db,
        'users',
        user.uid,
        'days',
        day(),
        'foods'
      ),

      f

    );


    const d =
      await getDay();


    d.cal += f.cal;

    d.p += f.p;

    d.c += f.c;

    d.f += f.f;


    await setDoc(
      dayRef(),
      d,
      {
        merge: true
      }
    );


    event.target.reset();


    await refresh();

    food();

  };


// ============================================================
// FOOD LIST
// ============================================================

async function food() {

  if (!user)
    return;


  const snapshot =
    await getDocs(

      query(

        collection(
          db,
          'users',
          user.uid,
          'days',
          day(),
          'foods'
        ),

        orderBy('__name__')

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
                ${escapeHtml(f.name)}
              </strong>

              <br>

              <small>
                ${escapeHtml(f.serving || '')}
                · ${f.cal} kcal
                · P ${f.p}
                · C ${f.c}
                · F ${f.f}
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

          const reference =
            doc(
              db,
              'users',
              user.uid,
              'days',
              day(),
              'foods',
              button.dataset.del
            );


          const snapshot =
            await getDoc(
              reference
            );


          if (!snapshot.exists())
            return;


          const f =
            snapshot.data();


          const d =
            await getDay();


          d.cal -=
            Number(f.cal) || 0;

          d.p -=
            Number(f.p) || 0;

          d.c -=
            Number(f.c) || 0;

          d.f -=
            Number(f.f) || 0;


          await setDoc(
            dayRef(),
            d,
            {
              merge: true
            }
          );


          await deleteDoc(
            reference
          );


          await refresh();

          food();

        };

    });

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

$('exForm').onsubmit =
  async event => {

    event.preventDefault();


    await addDoc(

      collection(
        db,
        'users',
        user.uid,
        'days',
        day(),
        'exercises'
      ),

      {

        type:
          ppl,

        name:
          $('ename').value,

        sets:
          Number(
            $('sets').value
          ),

        reps:
          Number(
            $('reps').value
          ),

        weight:
          Number(
            $('ew').value
          )

      }

    );


    event.target.reset();


    $('sets').value =
      3;

    $('reps').value =
      10;

    $('ew').value =
      0;


    await exercises();

  };


// ============================================================
// FINISH WORKOUT
// ============================================================

$('finish').onclick =
  async () => {

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

        workoutCalories:
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
      `${ppl} workout completed!\n\nEstimated calories burned: ${workoutCalories} kcal`
    );

  };


// ============================================================
// EXERCISES
// ============================================================

async function exercises() {

  if (!user)
    return;


  const snapshot =
    await getDocs(

      collection(
        db,
        'users',
        user.uid,
        'days',
        day(),
        'exercises'
      )

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
                ${escapeHtml(e.name)}
              </strong>

              <br>

              <small>
                ${e.type}
                · ${e.sets} × ${e.reps}
                @ ${e.weight} kg
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

          await deleteDoc(

            doc(
              db,
              'users',
              user.uid,
              'days',
              day(),
              'exercises',
              button.dataset.ex
            )

          );


          exercises();

        };

    });

}


// ============================================================
// WEIGHT TRACKING
// ============================================================

$('weightForm').onsubmit =
  async event => {

    event.preventDefault();


    const newWeight =
      Number(
        $('weightInput').value
      );


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


    /*
      Recalculate today's
      walking calories because
      they depend on body weight.
    */

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

    history();


    $('weightInput').value =
      '';

  };


// ============================================================
// STEPS
// ============================================================

$("stepsForm").onsubmit = async (e) => {

  e.preventDefault();

  const steps = Number($("stepsInput").value);

  // Approx. 0.04 kcal per step
  const stepsCalories = Math.round(steps * 0.04);

  await setDoc(
    dayRef(),
    {
      steps,
      stepsCalories
    },
    { merge: true }
  );

  $("stepsInput").value = "";

  await refresh();

  alert("Steps saved!");
};


// ============================================================
// WEIGHT HISTORY
// ============================================================

async function history() {

  if (!user)
    return;


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
              ${data.date}
            </span>

            <strong>
              ${Number(
                data.weight
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


// ============================================================
// BARCODE SCANNER
// ============================================================

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

          if (!stream)
            return;


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
              'Barcode error:',
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

      alert(
        error.message
      );

    }

  };


// ============================================================
// CONSTELLATION BACKGROUND
// ============================================================

const canvas =
  document.getElementById(
    'constellation'
  );


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


// ============================================================
// RESIZE
// ============================================================

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


// ============================================================
// CREATE STARS
// ============================================================

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
          .5
        ) * .15,

      vy:
        (
          Math.random() -
          .5
        ) * .15,

      radius:
        Math.random() *
        1.4 +
        .4,

      opacity:
        Math.random() *
        .6 +
        .25,

      twinkle:
        Math.random() *
        Math.PI *
        2,

      twinkleSpeed:
        Math.random() *
        .02 +
        .005

    });

  }

}


// ============================================================
// MOUSE TRACKING
// ============================================================

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


// ============================================================
// CONSTELLATION DRAW
// ============================================================

function drawConstellation() {

  ctx.clearRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );


  // ----------------------------------------------------------
  // MOVE STARS
  // ----------------------------------------------------------

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
      window.innerWidth +
      10
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
      window.innerHeight +
      10
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
      ) * .15;


    // --------------------------------------------------------
    // GLOW
    // --------------------------------------------------------

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
          pulse * .08
        )}
      )`;


    ctx.fill();


    // --------------------------------------------------------
    // STAR
    // --------------------------------------------------------

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


  // ----------------------------------------------------------
  // CONNECT STARS
  // ----------------------------------------------------------

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
          ) * .25;


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
          .6;


        ctx.stroke();

      }

    }

  }


  // ----------------------------------------------------------
  // MOUSE CONSTELLATION
  // ----------------------------------------------------------

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
          ) * .55;


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


        ctx.beginPath();

        ctx.arc(
          mouse.x,
          mouse.y,
          2.5,
          0,
          Math.PI * 2
        );


        ctx.fillStyle =
          'rgba(180,220,255,.75)';


        ctx.fill();

      }

    }

  }


  animationFrame =
    requestAnimationFrame(
      drawConstellation
    );

}


// ============================================================
// CONSTELLATION START
// ============================================================

window.addEventListener(
  'resize',
  resizeConstellation
);


resizeConstellation();

drawConstellation();
