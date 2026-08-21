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
// FIREBASE SETUP
// ============================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);


// ============================================================
// HELPERS
// ============================================================

const $ = id => document.getElementById(id);

const day = () => {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${date}`;
};


// ============================================================
// APPLICATION STATE
// ============================================================

let user = null;

let profile = {
  age: 31,
  height: 170,
  weight: 73,

  calGoal: 1950,

  pGoal: 140,
  cGoal: 220,
  fGoal: 65,

  stepGoal: 10000
};

let ppl = 'Push';

let signup = false;

let stream = null;


// ============================================================
// FIRESTORE REFERENCES
// ============================================================

function userRef() {
  if (!user) {
    throw new Error('No authenticated user.');
  }

  return doc(db, 'users', user.uid);
}


function dayRef() {
  if (!user) {
    throw new Error('No authenticated user.');
  }

  return doc(
    db,
    'users',
    user.uid,
    'days',
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
    'days',
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
    'days',
    day(),
    'exercises'
  );
}


function weightCollection() {
  if (!user) {
    throw new Error('No authenticated user.');
  }

  return collection(
    db,
    'users',
    user.uid,
    'weights'
  );
}


// ============================================================
// INITIAL DATE
// ============================================================

if ($('date')) {
  $('date').textContent = new Date().toLocaleDateString();
}


// ============================================================
// GET TODAY'S DATA
// ============================================================

async function getDay() {

  if (!user) {
    return {
      cal: 0,
      p: 0,
      c: 0,
      f: 0,
      steps: 0,
      workout: 'Rest'
    };
  }

  const snapshot = await getDoc(dayRef());

  if (snapshot.exists()) {

    const data = snapshot.data();

    return {
      cal: Number(data.cal) || 0,
      p: Number(data.p) || 0,
      c: Number(data.c) || 0,
      f: Number(data.f) || 0,
      steps: Number(data.steps) || 0,
      workout: data.workout || 'Rest'
    };

  }

  return {
    cal: 0,
    p: 0,
    c: 0,
    f: 0,
    steps: 0,
    workout: 'Rest'
  };
}


// ============================================================
// NAVIGATION
// ============================================================

function show(id) {

  document.querySelectorAll('.page').forEach(page => {
    page.hidden = page.id !== id;
  });

  document.querySelectorAll('nav button').forEach(button => {

    if (button.dataset.page === id) {
      button.style.background = '#2563eb';
    } else {
      button.style.background = '#172236';
    }

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


document.querySelectorAll('nav button').forEach(button => {

  button.onclick = () => {
    show(button.dataset.page);
  };

});


// ============================================================
// AUTH MODE TOGGLE
// ============================================================

if ($('toggle')) {

  $('toggle').onclick = () => {

    signup = !signup;

    if ($('authTitle')) {
      $('authTitle').textContent =
        signup ? 'Create account' : 'Sign in';
    }

    $('toggle').textContent =
      signup ? 'Back to sign in' : 'Create account';

    if ($('authMsg')) {
      $('authMsg').textContent = '';
    }

  };

}


// ============================================================
// LOGIN / REGISTER
// ============================================================

if ($('authForm')) {

  $('authForm').onsubmit = async e => {

    e.preventDefault();

    const email = $('email').value.trim();
    const password = $('password').value;

    if (!email || !password) {

      $('authMsg').textContent =
        'Please enter your email and password.';

      return;
    }


    $('authMsg').textContent =
      signup
        ? 'Creating account...'
        : 'Signing in...';


    try {

      // --------------------------------------------------------
      // CREATE ACCOUNT
      // --------------------------------------------------------

      if (signup) {

        const credential =
          await createUserWithEmailAndPassword(
            auth,
            email,
            password
          );

        const newUser = credential.user;

        console.log(
          'Firebase account created:',
          newUser.uid
        );


        // IMPORTANT:
        // Use newUser.uid directly.
        // Do NOT depend on the global user variable here.

        await setDoc(
          doc(db, 'users', newUser.uid),
          profile
        );


        console.log(
          'Firestore profile created.'
        );


        $('authMsg').textContent =
          'Account created successfully!';

      }

      // --------------------------------------------------------
      // LOGIN
      // --------------------------------------------------------

      else {

        const credential =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );

        console.log(
          'Login successful:',
          credential.user.uid
        );

        $('authMsg').textContent = '';

      }

    }

    catch (error) {

      console.error(
        'AUTH ERROR:',
        error
      );

      $('authMsg').textContent =
        getFirebaseErrorMessage(error);

    }

  };

}


// ============================================================
// FIREBASE ERROR MESSAGES
// ============================================================

function getFirebaseErrorMessage(error) {

  switch (error.code) {

    case 'auth/email-already-in-use':
      return 'This email is already registered.';

    case 'auth/invalid-email':
      return 'Please enter a valid email address.';

    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';

    case 'auth/invalid-credential':
      return 'Incorrect email or password.';

    case 'auth/user-not-found':
      return 'No account exists with this email.';

    case 'auth/wrong-password':
      return 'Incorrect password.';

    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';

    case 'permission-denied':
      return 'Firestore permission denied. Check your Firestore rules.';

    default:
      return error.message || 'An unexpected error occurred.';

  }

}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, async currentUser => {

  console.log(
    'Auth state changed:',
    currentUser
  );


  user = currentUser;


  // ----------------------------------------------------------
  // NOT LOGGED IN
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // LOGGED IN
  // ----------------------------------------------------------

  console.log(
    'Logged in UID:',
    currentUser.uid
  );


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
        doc(db, 'users', currentUser.uid)
      );


    if (snapshot.exists()) {

      profile = {
        ...profile,
        ...snapshot.data()
      };

    }

    else {

      await setDoc(
        doc(db, 'users', currentUser.uid),
        profile
      );

    }


    fill();

    await refresh();

    show('dash');

  }

  catch (error) {

    console.error(
      'PROFILE/FIRESTORE ERROR:',
      error
    );

    if ($('authMsg')) {

      $('authMsg').textContent =
        `Firestore error: ${error.message}`;

    }

  }

});


// ============================================================
// LOGOUT
// ============================================================

if ($('logout')) {

  $('logout').onclick = async () => {

    try {

      await signOut(auth);

      console.log('Logged out.');

    }

    catch (error) {

      console.error(
        'LOGOUT ERROR:',
        error
      );

    }

  };

}


// ============================================================
// PROFILE / SETTINGS
// ============================================================

function fill() {

  if ($('age')) {
    $('age').value = profile.age;
  }

  if ($('height')) {
    $('height').value = profile.height;
  }

  if ($('goalCal')) {
    $('goalCal').value = profile.calGoal;
  }

  if ($('goalP')) {
    $('goalP').value = profile.pGoal;
  }

  if ($('goalC')) {
    $('goalC').value = profile.cGoal;
  }

  if ($('goalF')) {
    $('goalF').value = profile.fGoal;
  }

  if ($('goalSteps')) {
    $('goalSteps').value = profile.stepGoal;
  }

}


if ($('settingsForm')) {

  $('settingsForm').onsubmit = async e => {

    e.preventDefault();

    if (!user) {
      alert('You are not logged in.');
      return;
    }


    try {

      profile = {
        ...profile,

        age: Number($('age').value),

        height: Number($('height').value),

        calGoal: Number($('goalCal').value),

        pGoal: Number($('goalP').value),

        cGoal: Number($('goalC').value),

        fGoal: Number($('goalF').value),

        stepGoal: Number($('goalSteps').value)
      };


      await setDoc(
        userRef(),
        profile,
        { merge: true }
      );


      await refresh();

      alert('Settings saved.');

    }

    catch (error) {

      console.error(
        'SETTINGS ERROR:',
        error
      );

      alert(
        `Could not save settings:\n${error.message}`
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

    const d = await getDay();


    if ($('cal')) {
      $('cal').textContent =
        Math.round(d.cal);
    }


    if ($('calGoal')) {
      $('calGoal').textContent =
        profile.calGoal;
    }


    if ($('calBar')) {

      const percentage =
        profile.calGoal > 0
          ? (d.cal / profile.calGoal) * 100
          : 0;

      $('calBar').style.width =
        Math.min(100, percentage) + '%';

    }


    if ($('weightDash')) {
      $('weightDash').textContent =
        profile.weight;
    }


    if ($('stepsDash')) {
      $('stepsDash').textContent =
        (d.steps || 0).toLocaleString();
    }


    if ($('workoutDash')) {
      $('workoutDash').textContent =
        d.workout || 'Rest';
    }


    if ($('macros')) {

      $('macros').innerHTML = `

        <div class="row">
          Protein
          <b>
            ${Math.round(d.p)} /
            ${profile.pGoal} g
          </b>
        </div>

        <div class="row">
          Carbs
          <b>
            ${Math.round(d.c)} /
            ${profile.cGoal} g
          </b>
        </div>

        <div class="row">
          Fat
          <b>
            ${Math.round(d.f)} /
            ${profile.fGoal} g
          </b>
        </div>

      `;

    }

  }

  catch (error) {

    console.error(
      'REFRESH ERROR:',
      error
    );

  }

}


// ============================================================
// FOOD LOGGING
// ============================================================

if ($('foodForm')) {

  $('foodForm').onsubmit = async e => {

    e.preventDefault();


    if (!user) {

      alert('You are not logged in.');

      return;
    }


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


      // Save individual food

      await addDoc(
        foodCollection(),
        f
      );


      // Update daily totals

      const d = await getDay();


      d.cal += f.cal;
      d.p += f.p;
      d.c += f.c;
      d.f += f.f;


      await setDoc(
        dayRef(),
        d,
        { merge: true }
      );


      e.target.reset();


      await refresh();

      await food();

    }

    catch (error) {

      console.error(
        'FOOD LOG ERROR:',
        error
      );

      alert(
        `Could not save food:\n${error.message}`
      );

    }

  };

}


// ============================================================
// DISPLAY FOOD
// ============================================================

async function food() {

  if (!user) {
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


    if (!$('foodList')) {
      return;
    }


    $('foodList').innerHTML =
      snapshot.docs.map(item => {

        const f = item.data();

        return `

          <div class="row">

            <span>

              ${escapeHTML(f.name)}

              <br>

              <small>
                ${escapeHTML(f.serving || '')}
                · ${f.cal} kcal
                · P ${f.p}
                · C ${f.c}
                · F ${f.f}
              </small>

            </span>

            <button
              type="button"
              data-del="${item.id}">
              Delete
            </button>

          </div>

        `;

      }).join('') ||
      '<p>No food logged.</p>';


    document
      .querySelectorAll('[data-del]')
      .forEach(button => {

        button.onclick = async () => {

          try {

            const foodRef =
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
              await getDoc(foodRef);


            if (!snapshot.exists()) {
              return;
            }


            const f = snapshot.data();

            const d = await getDay();


            d.cal =
              Math.max(0, d.cal - (Number(f.cal) || 0));

            d.p =
              Math.max(0, d.p - (Number(f.p) || 0));

            d.c =
              Math.max(0, d.c - (Number(f.c) || 0));

            d.f =
              Math.max(0, d.f - (Number(f.f) || 0));


            await setDoc(
              dayRef(),
              d,
              { merge: true }
            );


            await deleteDoc(foodRef);


            await refresh();

            await food();

          }

          catch (error) {

            console.error(
              'DELETE FOOD ERROR:',
              error
            );

            alert(
              `Could not delete food:\n${error.message}`
            );

          }

        };

      });

  }

  catch (error) {

    console.error(
      'FOOD LOAD ERROR:',
      error
    );

  }

}


// ============================================================
// WORKOUT SPLIT
// ============================================================

document
  .querySelectorAll('[data-ppl]')
  .forEach(button => {

    button.onclick = () => {

      ppl =
        button.dataset.ppl;

      document
        .querySelectorAll('[data-ppl]')
        .forEach(x => {

          x.classList.toggle(
            'active',
            x === button
          );

        });

    };

  });


// ============================================================
// EXERCISE LOGGING
// ============================================================

if ($('exForm')) {

  $('exForm').onsubmit = async e => {

    e.preventDefault();


    if (!user) {

      alert('You are not logged in.');

      return;
    }


    try {

      const exercise = {

        type: ppl,

        name:
          $('ename').value.trim(),

        sets:
          Number($('sets').value) || 0,

        reps:
          Number($('reps').value) || 0,

        weight:
          Number($('ew').value) || 0

      };


      await addDoc(
        exerciseCollection(),
        exercise
      );


      e.target.reset();


      await exercises();

    }

    catch (error) {

      console.error(
        'EXERCISE ERROR:',
        error
      );

      alert(
        `Could not save exercise:\n${error.message}`
      );

    }

  };

}


// ============================================================
// FINISH WORKOUT
// ============================================================

if ($('finish')) {

  $('finish').onclick = async () => {

    if (!user) {

      alert('You are not logged in.');

      return;
    }


    try {

      await setDoc(
        dayRef(),
        {
          workout: ppl
        },
        {
          merge: true
        }
      );


      await refresh();


      alert(
        `${ppl} workout completed!`
      );

    }

    catch (error) {

      console.error(
        'FINISH WORKOUT ERROR:',
        error
      );

      alert(
        `Could not save workout:\n${error.message}`
      );

    }

  };

}


// ============================================================
// DISPLAY EXERCISES
// ============================================================

async function exercises() {

  if (!user) {
    return;
  }


  try {

    const snapshot =
      await getDocs(
        exerciseCollection()
      );


    if (!$('exList')) {
      return;
    }


    $('exList').innerHTML =
      snapshot.docs.map(item => {

        const e = item.data();

        return `

          <div class="row">

            <span>

              ${escapeHTML(e.name)}

              <br>

              <small>
                ${escapeHTML(e.type)}
                · ${e.sets}×${e.reps}
                @ ${e.weight} kg
              </small>

            </span>

            <button
              type="button"
              data-ex="${item.id}">
              Delete
            </button>

          </div>

        `;

      }).join('') ||
      '<p>No exercises logged.</p>';


    document
      .querySelectorAll('[data-ex]')
      .forEach(button => {

        button.onclick = async () => {

          try {

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

          }

          catch (error) {

            console.error(
              'DELETE EXERCISE ERROR:',
              error
            );

            alert(
              `Could not delete exercise:\n${error.message}`
            );

          }

        };

      });

  }

  catch (error) {

    console.error(
      'EXERCISE LOAD ERROR:',
      error
    );

  }

}


// ============================================================
// WEIGHT TRACKING
// ============================================================

if ($('weightForm')) {

  $('weightForm').onsubmit = async e => {

    e.preventDefault();


    if (!user) {

      alert('You are not logged in.');

      return;
    }


    try {

      const newWeight =
        Number($('weightInput').value);


      if (!newWeight || newWeight <= 0) {

        alert('Enter a valid weight.');

        return;
      }


      profile.weight =
        newWeight;


      // Update profile

      await setDoc(
        userRef(),
        {
          weight: newWeight
        },
        {
          merge: true
        }
      );


      // Save weight history

      await addDoc(
        weightCollection(),
        {
          date: day(),
          weight: newWeight
        }
      );


      await refresh();

      await history();


      e.target.reset();

    }

    catch (error) {

      console.error(
        'WEIGHT ERROR:',
        error
      );

      alert(
        `Could not save weight:\n${error.message}`
      );

    }

  };

}


// ============================================================
// STEP TRACKING
// ============================================================

if ($('stepsForm')) {

  $('stepsForm').onsubmit = async e => {

    e.preventDefault();


    if (!user) {

      alert('You are not logged in.');

      return;
    }


    try {

      const steps =
        Number($('stepsInput').value);


      if (steps < 0) {

        alert('Steps cannot be negative.');

        return;
      }


      await setDoc(
        dayRef(),
        {
          steps: steps
        },
        {
          merge: true
        }
      );


      await refresh();


      e.target.reset();

    }

    catch (error) {

      console.error(
        'STEPS ERROR:',
        error
      );

      alert(
        `Could not save steps:\n${error.message}`
      );

    }

  };

}


// ============================================================
// WEIGHT HISTORY
// ============================================================

async function history() {

  if (!user) {
    return;
  }


  try {

    const snapshot =
      await getDocs(
        query(
          weightCollection(),
          orderBy('date', 'desc')
        )
      );


    if (!$('history')) {
      return;
    }


    $('history').innerHTML =
      snapshot.docs.map(item => {

        const data = item.data();

        return `

          <div class="row">

            <span>
              ${escapeHTML(data.date)}
            </span>

            <b>
              ${data.weight} kg
            </b>

          </div>

        `;

      }).join('') ||
      '<p>No history.</p>';

  }

  catch (error) {

    console.error(
      'HISTORY ERROR:',
      error
    );

  }

}


// ============================================================
// BARCODE SCANNER
// ============================================================

if ($('scan')) {

  $('scan').onclick = async () => {

    if (!('BarcodeDetector' in window)) {

      alert(
        'Barcode scanning is not supported by this browser.'
      );

      return;
    }


    try {

      stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment'
          }
        });


      $('video').hidden = false;

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


      const scanLoop = async () => {

        if (!stream) {
          return;
        }


        try {

          const codes =
            await detector.detect(
              $('video')
            );


          if (codes.length > 0) {

            const code =
              codes[0].rawValue;


            stopScanner();


            console.log(
              'Barcode:',
              code
            );


            const response =
              await fetch(
                `https://world.openfoodfacts.org/api/v2/product/${code}.json`
              );


            if (!response.ok) {

              throw new Error(
                `Open Food Facts returned ${response.status}`
              );

            }


            const data =
              await response.json();


            if (data.status === 1) {

              const product =
                data.product;

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
                  nutrients['energy-kcal_serving'] ??
                  nutrients['energy-kcal_100g'] ??
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
                'Product not found. Please enter nutrition manually.'
              );

            }

          }

          else {

            requestAnimationFrame(
              scanLoop
            );

          }

        }

        catch (error) {

          console.error(
            'BARCODE ERROR:',
            error
          );

          stopScanner();

          alert(
            `Barcode scanning failed:\n${error.message}`
          );

        }

      };


      scanLoop();

    }

    catch (error) {

      console.error(
        'CAMERA ERROR:',
        error
      );

      alert(
        `Could not access camera:\n${error.message}`
      );

    }

  };

}


// ============================================================
// STOP BARCODE SCANNER
// ============================================================

function stopScanner() {

  if (stream) {

    stream
      .getTracks()
      .forEach(track => {
        track.stop();
      });

    stream = null;

  }


  if ($('video')) {

    $('video').pause();

    $('video').srcObject = null;

    $('video').hidden = true;

  }

}


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


// ============================================================
// CONSTELLATION BACKGROUND
// ============================================================

const canvas =
  document.getElementById('constellation');

if (canvas) {

  const ctx =
    canvas.getContext('2d');


  let stars = [];

  let animationFrame;


  const STAR_COUNT = 110;

  const CONNECTION_DISTANCE = 130;


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
          Math.random() * 1.4 +
          0.4,

        opacity:
          Math.random() * 0.6 +
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


    // --------------------------------------------------------
    // STARS
    // --------------------------------------------------------

    for (const star of stars) {

      star.x += star.vx;

      star.y += star.vy;


      // Wrap horizontally

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


      // Wrap vertically

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
        Math.sin(star.twinkle) *
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


      // Main star

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


    // --------------------------------------------------------
    // CONNECTIONS
    // --------------------------------------------------------

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

        const a = stars[i];

        const b = stars[j];


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
            (1 -
              distance /
              CONNECTION_DISTANCE) *
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


          ctx.lineWidth = 0.6;

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
