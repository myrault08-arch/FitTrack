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

const $ = id => document.getElementById(id);

const day = () =>
  new Date().toISOString().slice(0, 10);

const userRef = () =>
  doc(db, 'users', user.uid);

const dayRef = () =>
  doc(
    db,
    'users',
    user.uid,
    'days',
    day()
  );


// ============================================================
// PROFILE
// ============================================================

let profile = {

  age: 31,

  sex: 'male',

  height: 170,

  weight: 73,

  calGoal: 2439,

  pGoal: 146,

  cGoal: 341,

  fGoal: 58,

  stepGoal: 10000

};


let user = null;

let ppl = 'Push';

let signup = false;

let stream = null;


// ============================================================
// DATE
// ============================================================

if ($('date')) {

  $('date').textContent =
    new Date().toLocaleDateString();

}


// ============================================================
// DAILY DATA
// ============================================================

async function getDay() {

  const snapshot =
    await getDoc(dayRef());

  const data =
    snapshot.exists()
      ? snapshot.data()
      : {};

  return {

    cal: Number(data.cal) || 0,

    p: Number(data.p) || 0,

    c: Number(data.c) || 0,

    f: Number(data.f) || 0,

    steps: Number(data.steps) || 0,

    workout:
      data.workout || 'Rest'

  };

}


// ============================================================
// BMI + CALORIE + MACRO CALCULATOR
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
    !weight ||
    age <= 0 ||
    height <= 0 ||
    weight <= 0
  ) {

    return null;

  }


  // ----------------------------------------------------------
  // BMR
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


  // ----------------------------------------------------------
  // Moderate activity
  // PPL approximately 3x/week
  // ----------------------------------------------------------

  const calories =
    Math.round(bmr * 1.55);


  // ----------------------------------------------------------
  // MACROS
  // ----------------------------------------------------------

  const protein =
    Math.round(weight * 2);

  const fat =
    Math.round(weight * 0.8);


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


  // ----------------------------------------------------------
  // SAVE CALCULATED VALUES
  // ----------------------------------------------------------

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


  let status;

  let color;


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


  // ==========================================================
  // UPDATE DASHBOARD BMI
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
  // UPDATE SETTINGS BMI
  // ==========================================================

  if ($('settingsBmiValue')) {

    $('settingsBmiValue').textContent =
      bmi.toFixed(1);

  }


  if ($('settingsBmiStatus')) {

    $('settingsBmiStatus').textContent =
      status;

    $('settingsBmiStatus').className =
      `bmi ${color}`;

  }


  // ==========================================================
  // UPDATE CALORIE GOAL
  // ==========================================================

  if ($('calGoal')) {

    $('calGoal').textContent =
      calories.toLocaleString();

  }


  // ==========================================================
  // UPDATE SETTINGS TARGETS
  // ==========================================================

  if ($('goalCal')) {

    $('goalCal').value =
      calories;

  }


  if ($('goalP')) {

    $('goalP').value =
      protein;

  }


  if ($('goalC')) {

    $('goalC').value =
      carbs;

  }


  if ($('goalF')) {

    $('goalF').value =
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

      button.style.background =
        button.dataset.page === id
          ? '#2563eb'
          : '#172236';

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
// AUTH TOGGLE
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

};


// ============================================================
// AUTH FORM
// ============================================================

$('authForm').onsubmit =
  async e => {

    e.preventDefault();


    try {

      if (signup) {

        const credential =
          await createUserWithEmailAndPassword(
            auth,
            $('email').value,
            $('password').value
          );


        user =
          credential.user;


        calculateMetrics();


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
  async u => {

    user = u;


    if (!u) {

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


      // Existing users
      // may not have sex stored.

      if (!profile.sex) {

        profile.sex =
          'male';

      }


      fill();


      calculateMetrics();


      await setDoc(
        userRef(),
        profile,
        {
          merge: true
        }
      );


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

$('logout').onclick = () => {

  signOut(auth);

};


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


  if ($('goalCal')) {

    $('goalCal').value =
      profile.calGoal;

  }


  if ($('goalP')) {

    $('goalP').value =
      profile.pGoal;

  }


  if ($('goalC')) {

    $('goalC').value =
      profile.cGoal;

  }


  if ($('goalF')) {

    $('goalF').value =
      profile.fGoal;

  }


  if ($('goalSteps')) {

    $('goalSteps').value =
      profile.stepGoal;

  }

}


// ============================================================
// SETTINGS
// ============================================================

$('settingsForm').onsubmit =
  async e => {

    e.preventDefault();


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


      // ------------------------------------------------------
      // AUTOMATIC CALCULATION
      // ------------------------------------------------------

      calculateMetrics();


      // ------------------------------------------------------
      // SAVE
      // ------------------------------------------------------

      await setDoc(
        userRef(),
        profile,
        {
          merge: true
        }
      );


      // ------------------------------------------------------
      // UPDATE UI
      // ------------------------------------------------------

      fill();

      calculateMetrics();

      await refresh();


      $('settingsMsg').textContent =
        'Settings saved successfully.';


      setTimeout(() => {

        $('settingsMsg').textContent =
          '';

      }, 3000);

    }

    catch (error) {

      console.error(
        'Settings error:',
        error
      );


      $('settingsMsg').textContent =
        'Unable to save settings.';

    }

  };


// ============================================================
// DASHBOARD
// ============================================================

async function refresh() {

  if (!user) {

    return;

  }


  const d =
    await getDay();


  // Calories

  $('cal').textContent =
    Math.round(
      d.cal
    ).toLocaleString();


  $('calGoal').textContent =
    Math.round(
      profile.calGoal
    ).toLocaleString();


  const percentage =
    profile.calGoal > 0

      ? (
          d.cal /
          profile.calGoal
        ) * 100

      : 0;


  $('calBar').style.width =
    Math.min(
      100,
      percentage
    ) + '%';


  // Weight

  $('weightDash').textContent =
    profile.weight;


  // Steps

  $('stepsDash').textContent =
    (
      d.steps || 0
    ).toLocaleString();


  // Workout

  $('workoutDash').textContent =
    d.workout || 'Rest';


  // Macros

  $('macros').innerHTML = `

    <div class="row">
      Protein
      <b>
        ${Math.round(d.p || 0)}
        /
        ${profile.pGoal}
        g
      </b>
    </div>

    <div class="row">
      Carbs
      <b>
        ${Math.round(d.c || 0)}
        /
        ${profile.cGoal}
        g
      </b>
    </div>

    <div class="row">
      Fat
      <b>
        ${Math.round(d.f || 0)}
        /
        ${profile.fGoal}
        g
      </b>
    </div>

  `;


  // Recalculate display

  calculateMetrics();

}


// ============================================================
// FOOD
// ============================================================

$('foodForm').onsubmit =
  async e => {

    e.preventDefault();


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


    d.cal +=
      f.cal;

    d.p +=
      f.p;

    d.c +=
      f.c;

    d.f +=
      f.f;


    await setDoc(
      dayRef(),
      d,
      {
        merge: true
      }
    );


    e.target.reset();


    await refresh();

    food();

  };


// ============================================================
// FOOD LIST
// ============================================================

async function food() {

  if (
    !user ||
    !$('foodList')
  ) {

    return;

  }


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
    snapshot.docs
      .map(snapshot => {

        const f =
          snapshot.data();


        return `

          <div class="row">

            <span>

              ${f.name}

              <br>

              <small>
                ${f.serving || ''}
                · ${f.cal} kcal
                · P ${f.p}
                C ${f.c}
                F ${f.f}
              </small>

            </span>


            <button
              data-del="${snapshot.id}"
            >
              Delete
            </button>

          </div>

        `;

      })
      .join('') ||
      '<p>No food logged.</p>';


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


          if (
            snapshot.exists()
          ) {

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

          }

        };

    });

}


// ============================================================
// WORKOUT PPL
// ============================================================

document
  .querySelectorAll('[data-ppl]')
  .forEach(button => {

    button.onclick =
      () => {

        ppl =
          button.dataset.ppl;

      };

  });


// ============================================================
// EXERCISE
// ============================================================

$('exForm').onsubmit =
  async e => {

    e.preventDefault();


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


    e.target.reset();


    await exercises();

  };


// ============================================================
// FINISH WORKOUT
// ============================================================

$('finish').onclick =
  async () => {

    await setDoc(
      dayRef(),
      {
        workout:
          ppl
      },
      {
        merge: true
      }
    );


    await refresh();

  };


// ============================================================
// EXERCISES
// ============================================================

async function exercises() {

  if (
    !user ||
    !$('exList')
  ) {

    return;

  }


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
    snapshot.docs
      .map(snapshot => {

        const e =
          snapshot.data();


        return `

          <div class="row">

            <span>

              ${e.name}

              <br>

              <small>
                ${e.type}
                · ${e.sets}×${e.reps}
                @ ${e.weight} kg
              </small>

            </span>


            <button
              data-ex="${snapshot.id}"
            >
              Delete
            </button>

          </div>

        `;

      })
      .join('') ||
      '<p>No exercises logged.</p>';


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


          await exercises();

        };

    });

}


// ============================================================
// WEIGHT TRACKING
// ============================================================

$('weightForm').onsubmit =
  async e => {

    e.preventDefault();


    const newWeight =
      Number(
        $('weightInput').value
      );


    if (
      !newWeight ||
      newWeight <= 0
    ) {

      return;

    }


    profile.weight =
      newWeight;


    // Recalculate

    calculateMetrics();


    // Save profile

    await setDoc(
      userRef(),
      profile,
      {
        merge: true
      }
    );


    // Save history

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
          profile.weight

      }
    );


    await refresh();

    history();

  };


// ============================================================
// STEPS
// ============================================================

$('stepsForm').onsubmit =
  async e => {

    e.preventDefault();


    const steps =
      Number(
        $('stepsInput').value
      );


    await setDoc(
      dayRef(),
      {
        steps
      },
      {
        merge: true
      }
    );


    await refresh();

  };


// ============================================================
// HISTORY
// ============================================================

async function history() {

  if (
    !user ||
    !$('history')
  ) {

    return;

  }


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
    snapshot.docs
      .map(snapshot => {

        const data =
          snapshot.data();


        return `

          <div class="row">

            ${data.date}

            <b>
              ${data.weight} kg
            </b>

          </div>

        `;

      })
      .join('') ||
      '<p>No history.</p>';

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
        await navigator.mediaDevices
          .getUserMedia({

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
                  ] ||
                  nutrients[
                    'energy-kcal_100g'
                  ] ||
                  0
                );


              $('fp').value =
                nutrients.proteins_serving ??
                nutrients.proteins_100g ??
                0;


              $('fc').value =
                nutrients.carbohydrates_serving ??
                nutrients.carbohydrates_100g ??
                0;


              $('ff').value =
                nutrients.fat_serving ??
                nutrients.fat_100g ??
                0;

            }

            else {

              alert(
                'Product not found; enter nutrition manually.'
              );

            }

          }

          else {

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


if (canvas) {

  const ctx =
    canvas.getContext('2d');


  let stars = [];


  const STAR_COUNT =
    110;


  const CONNECTION_DISTANCE =
    130;


  function resizeConstellation() {

    const dpr =
      window.devicePixelRatio || 1;


    canvas.width =
      window.innerWidth * dpr;


    canvas.height =
      window.innerHeight * dpr;


    canvas.style.width =
      window.innerWidth + 'px';


    canvas.style.height =
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
          (Math.random() - 0.5) *
          0.15,

        vy:
          (Math.random() - 0.5) *
          0.15,

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


  function drawConstellation() {

    ctx.clearRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );


    for (
      const star of stars
    ) {

      star.x += star.vx;

      star.y += star.vy;


      if (
        star.x < -10
      ) {

        star.x =
          window.innerWidth + 10;

      }


      if (
        star.x >
        window.innerWidth + 10
      ) {

        star.x = -10;

      }


      if (
        star.y < -10
      ) {

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
        ) *
        0.15;


      // Glow

      ctx.beginPath();

      ctx.arc(
        star.x,
        star.y,
        star.radius * 4,
        0,
        Math.PI * 2
      );


      ctx.fillStyle =
        `rgba(100, 150, 255, ${Math.max(
          0,
          pulse * 0.08
        )})`;


      ctx.fill();


      // Star

      ctx.beginPath();

      ctx.arc(
        star.x,
        star.y,
        star.radius,
        0,
        Math.PI * 2
      );


      ctx.fillStyle =
        `rgba(180, 210, 255, ${Math.max(
          0,
          pulse
        )})`;


      ctx.fill();

    }


    // Connections

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
            ) *
            0.25;


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
            `rgba(100, 150, 255, ${opacity})`;


          ctx.lineWidth =
            0.6;


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