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

import {
  firebaseConfig
} from './firebase-config.js';


// ============================================================
// Firebase
// ============================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


// ============================================================
// Helpers
// ============================================================

const $ = id => document.getElementById(id);


// ============================================================
// State
// ============================================================

let user = null;

let profile = {

  age: 31,

  sex: "male",

  height: 170,

  weight: 73,

  calGoal: 0,

  pGoal: 0,

  cGoal: 0,

  fGoal: 0,

  stepGoal: 10000

};

let ppl = "Push";

let signup = false;

let stream = null;


// ============================================================
// Date
// ============================================================

$("date").textContent =
  new Date().toLocaleDateString();


// ============================================================
// Firebase References
// ============================================================

const day = () => {

  return new Date()
    .toISOString()
    .slice(0, 10);

};


const userRef = () => {

  return doc(
    db,
    "users",
    user.uid
  );

};


const dayRef = () => {

  return doc(
    db,
    "users",
    user.uid,
    "days",
    day()
  );

};


// ============================================================
// Get Today's Data
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

    workout: data.workout || "Rest"

  };

}


// ============================================================
// BMI + Macro Calculator
// ============================================================

function calculateMetrics() {

  const age =
    Number(profile.age);

  const height =
    Number(profile.height);

  const weight =
    Number(profile.weight);


  // Prevent invalid calculations

  if (
    !age ||
    !height ||
    !weight ||
    height <= 0 ||
    weight <= 0
  ) {

    return;

  }


  // ----------------------------------------------------------
  // Mifflin-St Jeor BMR
  // ----------------------------------------------------------

  const bmr =
    profile.sex === "female"

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
  // Macro targets
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
      Math.round(carbCalories / 4)
    );


  // ----------------------------------------------------------
  // Save calculated values into profile
  // ----------------------------------------------------------

  profile.calGoal = calories;

  profile.pGoal = protein;

  profile.cGoal = carbs;

  profile.fGoal = fat;


  // ----------------------------------------------------------
  // BMI
  // ----------------------------------------------------------

  const bmi =
    weight /
    Math.pow(height / 100, 2);


  let status = "";

  let cssClass = "";


  if (bmi < 18.5) {

    status = "Underweight";

    cssClass = "under";

  }

  else if (bmi < 25) {

    status = "Normal";

    cssClass = "normal";

  }

  else if (bmi < 30) {

    status = "Overweight";

    cssClass = "over";

  }

  else {

    status = "Obese";

    cssClass = "obese";

  }


  // ----------------------------------------------------------
  // Dashboard BMI
  // ----------------------------------------------------------

  if ($("bmiValue")) {

    $("bmiValue").textContent =
      bmi.toFixed(1);

  }


  if ($("bmiStatus")) {

    $("bmiStatus").textContent =
      status;

    $("bmiStatus").className =
      "bmi " + cssClass;

  }


  // ----------------------------------------------------------
  // Settings BMI
  // ----------------------------------------------------------

  if ($("settingsBmiValue")) {

    $("settingsBmiValue").textContent =
      bmi.toFixed(1);

  }


  if ($("settingsBmiStatus")) {

    $("settingsBmiStatus").textContent =
      status;

    $("settingsBmiStatus").className =
      "bmi " + cssClass;

  }


  // ----------------------------------------------------------
  // Settings calculated goals
  // ----------------------------------------------------------

  if ($("goalCal")) {

    $("goalCal").value =
      calories;

  }


  if ($("goalP")) {

    $("goalP").value =
      protein;

  }


  if ($("goalC")) {

    $("goalC").value =
      carbs;

  }


  if ($("goalF")) {

    $("goalF").value =
      fat;

  }


  // Dashboard calorie target

  if ($("calGoal")) {

    $("calGoal").textContent =
      calories;

  }

}


// ============================================================
// Navigation
// ============================================================

function show(id) {

  document
    .querySelectorAll(".page")
    .forEach(page => {

      page.hidden =
        page.id !== id;

    });


  document
    .querySelectorAll("nav button")
    .forEach(button => {

      if (button.dataset.page === id) {

        button.style.background =
          "#2563eb";

      } else {

        button.style.background =
          "#172236";

      }

    });


  if (id === "food") {

    food();

  }


  if (id === "workout") {

    exercises();

  }


  if (id === "progress") {

    history();

  }


  if (id === "settings") {

    fill();

    calculateMetrics();

  }

}


document
  .querySelectorAll("nav button")
  .forEach(button => {

    button.onclick = () => {

      show(button.dataset.page);

    };

  });


// ============================================================
// Authentication
// ============================================================

$("toggle").onclick = () => {

  signup = !signup;


  $("authTitle").textContent =
    signup
      ? "Create account"
      : "Sign in";


  $("toggle").textContent =
    signup
      ? "Back to sign in"
      : "Create account";


  $("authMsg").textContent = "";

};


$("authForm").onsubmit =
  async event => {

    event.preventDefault();

    $("authMsg").textContent = "";

    try {

      if (signup) {

        const credential =
          await createUserWithEmailAndPassword(
            auth,
            $("email").value,
            $("password").value
          );


        user = credential.user;


        calculateMetrics();


        await setDoc(
          userRef(),
          profile
        );

      }

      else {

        await signInWithEmailAndPassword(
          auth,
          $("email").value,
          $("password").value
        );

      }

    }

    catch (error) {

      console.error(error);

      $("authMsg").textContent =
        error.message;

    }

  };


// ============================================================
// Auth State
// ============================================================

onAuthStateChanged(
  auth,
  async currentUser => {

    user = currentUser;


    if (!currentUser) {

      $("auth").hidden = false;

      $("app").hidden = true;

      $("logout").hidden = true;

      return;

    }


    $("auth").hidden = true;

    $("app").hidden = false;

    $("logout").hidden = false;


    try {

      const snapshot =
        await getDoc(userRef());


      if (snapshot.exists()) {

        profile = {

          ...profile,

          ...snapshot.data()

        };

      }

      else {

        calculateMetrics();

        await setDoc(
          userRef(),
          profile
        );

      }


      // Make sure old profiles
      // get the sex field

      if (!profile.sex) {

        profile.sex = "male";

      }


      // Calculate BMI/macros
      calculateMetrics();


      // Put values into Settings
      fill();


      // Update dashboard
      await refresh();


      show("dash");

    }

    catch (error) {

      console.error(
        "Profile loading error:",
        error
      );

    }

  }
);


// ============================================================
// Logout
// ============================================================

$("logout").onclick = () => {

  signOut(auth);

};


// ============================================================
// Fill Settings
// ============================================================

function fill() {

  if ($("age")) {

    $("age").value =
      profile.age;

  }


  if ($("sex")) {

    $("sex").value =
      profile.sex || "male";

  }


  if ($("height")) {

    $("height").value =
      profile.height;

  }


  if ($("weight")) {

    $("weight").value =
      profile.weight;

  }


  if ($("goalSteps")) {

    $("goalSteps").value =
      profile.stepGoal;

  }


  if ($("goalCal")) {

    $("goalCal").value =
      profile.calGoal;

  }


  if ($("goalP")) {

    $("goalP").value =
      profile.pGoal;

  }


  if ($("goalC")) {

    $("goalC").value =
      profile.cGoal;

  }


  if ($("goalF")) {

    $("goalF").value =
      profile.fGoal;

  }

}


// ============================================================
// Live BMI calculation in Settings
// ============================================================

function updateProfilePreview() {

  profile.age =
    Number($("age").value);

  profile.sex =
    $("sex").value;

  profile.height =
    Number($("height").value);

  profile.weight =
    Number($("weight").value);

  calculateMetrics();

}


$("age").addEventListener(
  "input",
  updateProfilePreview
);


$("sex").addEventListener(
  "change",
  updateProfilePreview
);


$("height").addEventListener(
  "input",
  updateProfilePreview
);


$("weight").addEventListener(
  "input",
  updateProfilePreview
);


// ============================================================
// Save Settings
// ============================================================

$("settingsForm").onsubmit =
  async event => {

    event.preventDefault();


    profile.age =
      Number($("age").value);


    profile.sex =
      $("sex").value;


    profile.height =
      Number($("height").value);


    profile.weight =
      Number($("weight").value);


    profile.stepGoal =
      Number($("goalSteps").value);


    // Recalculate everything

    calculateMetrics();


    // Save complete profile

    await setDoc(
      userRef(),
      profile,
      {
        merge: true
      }
    );


    await refresh();


    alert(
      "Profile and goals updated!"
    );

  };


// ============================================================
// Dashboard Refresh
// ============================================================

async function refresh() {

  if (!user) return;


  // Recalculate BMI/macros

  calculateMetrics();


  const d =
    await getDay();


  $("cal").textContent =
    Math.round(d.cal);


  $("calGoal").textContent =
    profile.calGoal;


  const percentage =
    profile.calGoal > 0

      ? (
          d.cal /
          profile.calGoal
        ) * 100

      : 0;


  $("calBar").style.width =
    Math.min(
      100,
      percentage
    ) + "%";


  $("weightDash").textContent =
    profile.weight;


  $("stepsDash").textContent =
    (d.steps || 0)
      .toLocaleString();


  $("workoutDash").textContent =
    d.workout || "Rest";


  $("macros").innerHTML = `

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

}


// ============================================================
// FOOD
// ============================================================

$("foodForm").onsubmit =
  async event => {

    event.preventDefault();


    const f = {

      name:
        $("fname").value,

      serving:
        $("serving").value,

      cal:
        Number($("fcal").value),

      p:
        Number($("fp").value),

      c:
        Number($("fc").value),

      f:
        Number($("ff").value)

    };


    await addDoc(

      collection(
        db,
        "users",
        user.uid,
        "days",
        day(),
        "foods"
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

  if (!user) return;


  const snapshot =
    await getDocs(

      query(

        collection(
          db,
          "users",
          user.uid,
          "days",
          day(),
          "foods"
        ),

        orderBy("__name__")

      )

    );


  $("foodList").innerHTML =

    snapshot.docs.map(
      item => {

        const f =
          item.data();


        return `

          <div class="row">

            <span>

              ${f.name}

              <br>

              <small>

                ${f.serving || ""}

                ·

                ${f.cal} kcal

                · P ${f.p}

                C ${f.c}

                F ${f.f}

              </small>

            </span>


            <button
              data-del="${item.id}"
            >
              Delete
            </button>

          </div>

        `;

      }
    ).join("")

    ||

    "<p>No food logged.</p>";


  document
    .querySelectorAll("[data-del]")
    .forEach(button => {

      button.onclick =
        async () => {

          const ref =
            doc(
              db,
              "users",
              user.uid,
              "days",
              day(),
              "foods",
              button.dataset.del
            );


          const snapshot =
            await getDoc(ref);


          if (!snapshot.exists()) {
            return;
          }


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


          await deleteDoc(ref);


          await refresh();

          food();

        };

    });

}


// ============================================================
// WORKOUT
// ============================================================

document
  .querySelectorAll("[data-ppl]")
  .forEach(button => {

    button.onclick = () => {

      ppl =
        button.dataset.ppl;

    };

  });


$("exForm").onsubmit =
  async event => {

    event.preventDefault();


    await addDoc(

      collection(
        db,
        "users",
        user.uid,
        "days",
        day(),
        "exercises"
      ),

      {

        type: ppl,

        name:
          $("ename").value,

        sets:
          Number($("sets").value),

        reps:
          Number($("reps").value),

        weight:
          Number($("ew").value)

      }

    );


    event.target.reset();


    await exercises();

  };


$("finish").onclick =
  async () => {

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

  };


// ============================================================
// Exercise List
// ============================================================

async function exercises() {

  if (!user) return;


  const snapshot =
    await getDocs(

      collection(
        db,
        "users",
        user.uid,
        "days",
        day(),
        "exercises"
      )

    );


  $("exList").innerHTML =

    snapshot.docs.map(
      item => {

        const e =
          item.data();


        return `

          <div class="row">

            <span>

              ${e.name}

              <br>

              <small>

                ${e.type}

                ·

                ${e.sets}×${e.reps}

                @

                ${e.weight} kg

              </small>

            </span>


            <button
              data-ex="${item.id}"
            >
              Delete
            </button>

          </div>

        `;

      }
    ).join("")

    ||

    "<p>No exercises logged.</p>";


  document
    .querySelectorAll("[data-ex]")
    .forEach(button => {

      button.onclick =
        async () => {

          await deleteDoc(

            doc(
              db,
              "users",
              user.uid,
              "days",
              day(),
              "exercises",
              button.dataset.ex
            )

          );


          await exercises();

        };

    });

}


// ============================================================
// WEIGHT
// ============================================================

$("weightForm").onsubmit =
  async event => {

    event.preventDefault();


    profile.weight =
      Number(
        $("weightInput").value
      );


    // Recalculate BMI and macros

    calculateMetrics();


    // Save profile

    await setDoc(
      userRef(),
      profile,
      {
        merge: true
      }
    );


    // Save weight history

    await addDoc(

      collection(
        db,
        "users",
        user.uid,
        "weights"
      ),

      {

        date: day(),

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

$("stepsForm").onsubmit =
  async event => {

    event.preventDefault();


    await setDoc(

      dayRef(),

      {

        steps:
          Number(
            $("stepsInput").value
          )

      },

      {
        merge: true
      }

    );


    await refresh();

  };


// ============================================================
// WEIGHT HISTORY
// ============================================================

async function history() {

  if (!user) return;


  const snapshot =
    await getDocs(

      query(

        collection(
          db,
          "users",
          user.uid,
          "weights"
        ),

        orderBy(
          "date",
          "desc"
        )

      )

    );


  $("history").innerHTML =

    snapshot.docs.map(
      item => {

        const data =
          item.data();


        return `

          <div class="row">

            ${data.date}

            <b>
              ${data.weight} kg
            </b>

          </div>

        `;

      }
    ).join("")

    ||

    "<p>No history.</p>";

}


// ============================================================
// BARCODE SCANNER
// ============================================================

$("scan").onclick =
  async () => {

    if (!("BarcodeDetector" in window)) {

      alert(
        "Barcode scanning is not supported by this browser."
      );

      return;

    }


    try {

      stream =
        await navigator.mediaDevices.getUserMedia({

          video: {
            facingMode: "environment"
          }

        });


      $("video").hidden = false;

      $("video").srcObject =
        stream;


      await $("video").play();


      const detector =
        new BarcodeDetector({

          formats: [
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e"
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
                $("video")
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


              stream = null;

              $("video").hidden =
                true;


              const response =
                await fetch(

                  `https://world.openfoodfacts.org/api/v2/product/${code}.json`

                );


              const data =
                await response.json();


              if (data.status === 1) {

                const product =
                  data.product;


                const n =
                  product.nutriments || {};


                $("fname").value =
                  product.product_name ||
                  "Scanned food";


                $("serving").value =
                  product.serving_size ||
                  "100 g";


                $("fcal").value =
                  Math.round(

                    n["energy-kcal_serving"] ??
                    n["energy-kcal_100g"] ??
                    0

                  );


                $("fp").value =
                  n.proteins_serving ??
                  n.proteins_100g ??
                  0;


                $("fc").value =
                  n.carbohydrates_serving ??
                  n.carbohydrates_100g ??
                  0;


                $("ff").value =
                  n.fat_serving ??
                  n.fat_100g ??
                  0;

              }

              else {

                alert(
                  "Product not found. Enter nutrition manually."
                );

              }

            }

            else {

              requestAnimationFrame(loop);

            }

          }

          catch (error) {

            console.error(
              "Barcode error:",
              error
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
    "constellation"
  );


const ctx =
  canvas.getContext("2d");


let stars = [];

let animationFrame;

let mouse = {

  x: null,

  y: null,

  active: false

};


const STAR_COUNT = 110;

const CONNECTION_DISTANCE = 130;

const MOUSE_CONNECTION_DISTANCE = 180;


// ============================================================
// Canvas Resize
// ============================================================

function resizeConstellation() {

  const dpr =
    window.devicePixelRatio || 1;


  canvas.width =
    window.innerWidth * dpr;


  canvas.height =
    window.innerHeight * dpr;


  canvas.style.width =
    window.innerWidth + "px";


  canvas.style.height =
    window.innerHeight + "px";


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
// Create Stars
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
        (Math.random() - .5) *
        .15,

      vy:
        (Math.random() - .5) *
        .15,

      radius:
        Math.random() * 1.4 + .4,

      opacity:
        Math.random() * .6 + .25,

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
// Mouse Tracking
// ============================================================

window.addEventListener(
  "mousemove",
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
  "mouseleave",
  () => {

    mouse.active =
      false;

    mouse.x = null;

    mouse.y = null;

  }
);


// ============================================================
// Touch Tracking
// ============================================================

window.addEventListener(
  "touchmove",
  event => {

    if (!event.touches.length) {
      return;
    }


    const touch =
      event.touches[0];


    mouse.x =
      touch.clientX;

    mouse.y =
      touch.clientY;

    mouse.active =
      true;

  },
  {
    passive: true
  }
);


window.addEventListener(
  "touchend",
  () => {

    mouse.active =
      false;

  }
);


// ============================================================
// Draw Constellation
// ============================================================

function drawConstellation() {

  ctx.clearRect(
    0,
    0,
    window.innerWidth,
    window.innerHeight
  );


  // ----------------------------------------------------------
  // Move stars
  // ----------------------------------------------------------

  for (const star of stars) {

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
      ) * .15;


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
      `rgba(100,150,255,${Math.max(
        0,
        pulse * .08
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
      `rgba(180,210,255,${Math.max(
        0,
        pulse
      )})`;


    ctx.fill();

  }


  // ----------------------------------------------------------
  // Star-to-star connections
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
          `rgba(100,150,255,${opacity})`;


        ctx.lineWidth =
          .6;


        ctx.stroke();

      }

    }

  }


  // ----------------------------------------------------------
  // Mouse-to-star connections
  // ----------------------------------------------------------

  if (
    mouse.active &&
    mouse.x !== null &&
    mouse.y !== null
  ) {

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
          ) * .45;


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
          `rgba(100,150,255,${opacity})`;


        ctx.lineWidth =
          .8;


        ctx.stroke();

      }

    }


    // Small glow around mouse

    const gradient =
      ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        0,
        mouse.x,
        mouse.y,
        100
      );


    gradient.addColorStop(
      0,
      "rgba(80,130,255,.08)"
    );


    gradient.addColorStop(
      1,
      "rgba(80,130,255,0)"
    );


    ctx.beginPath();

    ctx.arc(
      mouse.x,
      mouse.y,
      100,
      0,
      Math.PI * 2
    );


    ctx.fillStyle =
      gradient;

    ctx.fill();

  }


  animationFrame =
    requestAnimationFrame(
      drawConstellation
    );

}


// ============================================================
// Start constellation
// ============================================================

window.addEventListener(
  "resize",
  resizeConstellation
);


resizeConstellation();

drawConstellation();