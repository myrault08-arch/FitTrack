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

// ---------------------------------------------------------------------------
// Firebase setup
// ---------------------------------------------------------------------------

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);

let user;
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
let ppl = 'Push';       // currently selected workout split (Push / Pull / Legs)
let signup = false;     // whether the auth form is in "create account" mode
let stream;             // active camera stream for barcode scanning

$('date').textContent = new Date().toLocaleDateString();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const day = () => new Date().toISOString().slice(0, 10);
const userRef = () => doc(db, 'users', user.uid);
const dayRef = () => doc(db, 'users', user.uid, 'days', day());

async function getDay() {
  const s = await getDoc(dayRef());
  const data = s.exists() ? s.data() : {};
  return {
    cal: Number(data.cal) || 0,
    p: Number(data.p) || 0,
    c: Number(data.c) || 0,
    f: Number(data.f) || 0,
    steps: Number(data.steps) || 0,
    workout: data.workout || 'Rest'
  };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function show(id) {
  document.querySelectorAll('.page').forEach(x => x.hidden = x.id !== id);
  document.querySelectorAll('nav button').forEach(x => {
    x.style.background = x.dataset.page === id ? '#2563eb' : '#172236';
  });

  if (id === 'food') food();
  if (id === 'workout') exercises();
  if (id === 'progress') history();
}

document.querySelectorAll('nav button').forEach(b => {
  b.onclick = () => show(b.dataset.page);
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

$('toggle').onclick = () => {
  signup = !signup;
  $('authTitle').textContent = signup ? 'Create account' : 'Sign in';
  $('toggle').textContent = signup ? 'Back to sign in' : 'Create account';
};

$('authForm').onsubmit = async e => {
  e.preventDefault();
  try {
    if (signup) {
      await createUserWithEmailAndPassword(auth, $('email').value, $('password').value);
      await setDoc(userRef(), profile);
    } else {
      await signInWithEmailAndPassword(auth, $('email').value, $('password').value);
    }
  } catch (err) {
    $('authMsg').textContent = err.message;
  }
};

onAuthStateChanged(auth, async u => {
  user = u;

  if (!u) {
    $('auth').hidden = false;
    $('app').hidden = true;
    $('logout').hidden = true;
    return;
  }

  $('auth').hidden = true;
  $('app').hidden = false;
  $('logout').hidden = false;

  const s = await getDoc(userRef());
  if (s.exists()) {
    profile = { ...profile, ...s.data() };
  } else {
    await setDoc(userRef(), profile);
  }

  fill();
  await refresh();
  show('dash');
});

$('logout').onclick = () => signOut(auth);

// ---------------------------------------------------------------------------
// Settings / profile
// ---------------------------------------------------------------------------

function fill() {
  $('age').value = profile.age;
  $('height').value = profile.height;
  $('goalCal').value = profile.calGoal;
  $('goalP').value = profile.pGoal;
  $('goalC').value = profile.cGoal;
  $('goalF').value = profile.fGoal;
  $('goalSteps').value = profile.stepGoal;
}

$('settingsForm').onsubmit = async e => {
  e.preventDefault();
  profile = {
    ...profile,
    age: +$('age').value,
    height: +$('height').value,
    calGoal: +$('goalCal').value,
    pGoal: +$('goalP').value,
    cGoal: +$('goalC').value,
    fGoal: +$('goalF').value,
    stepGoal: +$('goalSteps').value
  };
  await setDoc(userRef(), profile, { merge: true });
  await refresh();
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function refresh() {
  const d = await getDay();

  $('cal').textContent = Math.round(d.cal);
  $('calGoal').textContent = profile.calGoal;
  $('calBar').style.width = Math.min(100, (d.cal / profile.calGoal) * 100) + '%';
  $('weightDash').textContent = profile.weight;
  $('stepsDash').textContent = (d.steps || 0).toLocaleString();
  $('workoutDash').textContent = d.workout || 'Rest';

  $('macros').innerHTML = `
    <div class="row">Protein <b>${Math.round(d.p || 0)} / ${profile.pGoal} g</b></div>
    <div class="row">Carbs <b>${Math.round(d.c || 0)} / ${profile.cGoal} g</b></div>
    <div class="row">Fat <b>${Math.round(d.f || 0)} / ${profile.fGoal} g</b></div>
  `;
}

// ---------------------------------------------------------------------------
// Food logging
// ---------------------------------------------------------------------------

$('foodForm').onsubmit = async e => {
  e.preventDefault();

  const f = {
    name: $('fname').value,
    serving: $('serving').value,
    cal: +$('fcal').value,
    p: +$('fp').value,
    c: +$('fc').value,
    f: +$('ff').value
  };

  await addDoc(collection(db, 'users', user.uid, 'days', day(), 'foods'), f);

  const d = await getDay();
  d.cal += f.cal;
  d.p += f.p;
  d.c += f.c;
  d.f += f.f;
  await setDoc(dayRef(), d, { merge: true });

  e.target.reset();
  await refresh();
  food();
};

async function food() {
  const s = await getDocs(
    query(collection(db, 'users', user.uid, 'days', day(), 'foods'), orderBy('__name__'))
  );

  $('foodList').innerHTML = s.docs.map(x => {
    const f = x.data();
    return `
      <div class="row">
        <span>${f.name}<br><small>${f.serving || ''} · ${f.cal} kcal · P ${f.p} C ${f.c} F ${f.f}</small></span>
        <button data-del="${x.id}">Delete</button>
      </div>
    `;
  }).join('') || '<p>No food logged.</p>';

  document.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async () => {
      const r = doc(db, 'users', user.uid, 'days', day(), 'foods', b.dataset.del);
      const s = await getDoc(r);

      if (s.exists()) {
        const f = s.data();
        const d = await getDay();
        d.cal -= f.cal;
        d.p -= f.p;
        d.c -= f.c;
        d.f -= f.f;
        await setDoc(dayRef(), d, { merge: true });
        await deleteDoc(r);
        await refresh();
        food();
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Workout / exercise logging
// ---------------------------------------------------------------------------

document.querySelectorAll('[data-ppl]').forEach(b => {
  b.onclick = () => { ppl = b.dataset.ppl; };
});

$('exForm').onsubmit = async e => {
  e.preventDefault();

  await addDoc(collection(db, 'users', user.uid, 'days', day(), 'exercises'), {
    type: ppl,
    name: $('ename').value,
    sets: +$('sets').value,
    reps: +$('reps').value,
    weight: +$('ew').value
  });

  e.target.reset();
  await exercises();
};

$('finish').onclick = async () => {
  await setDoc(dayRef(), { workout: ppl }, { merge: true });
  await refresh();
};

async function exercises() {
  const s = await getDocs(collection(db, 'users', user.uid, 'days', day(), 'exercises'));

  $('exList').innerHTML = s.docs.map(x => {
    const e = x.data();
    return `
      <div class="row">
        <span>${e.name}<br><small>${e.type} · ${e.sets}×${e.reps} @ ${e.weight} kg</small></span>
        <button data-ex="${x.id}">Delete</button>
      </div>
    `;
  }).join('') || '<p>No exercises logged.</p>';

  document.querySelectorAll('[data-ex]').forEach(b => {
    b.onclick = async () => {
      await deleteDoc(doc(db, 'users', user.uid, 'days', day(), 'exercises', b.dataset.ex));
      exercises();
    };
  });
}

// ---------------------------------------------------------------------------
// Weight & steps tracking
// ---------------------------------------------------------------------------

$('weightForm').onsubmit = async e => {
  e.preventDefault();

  profile.weight = +$('weightInput').value;
  await setDoc(userRef(), profile, { merge: true });
  await addDoc(collection(db, 'users', user.uid, 'weights'), {
    date: day(),
    weight: profile.weight
  });

  await refresh();
  history();
};

$('stepsForm').onsubmit = async e => {
  e.preventDefault();
  await setDoc(dayRef(), { steps: +$('stepsInput').value }, { merge: true });
  await refresh();
};

async function history() {
  const s = await getDocs(
    query(collection(db, 'users', user.uid, 'weights'), orderBy('date', 'desc'))
  );

  $('history').innerHTML = s.docs.map(x => `
    <div class="row">${x.data().date}<b>${x.data().weight} kg</b></div>
  `).join('') || '<p>No history.</p>';
}

// ---------------------------------------------------------------------------
// Barcode scanning (Open Food Facts lookup)
// ---------------------------------------------------------------------------

$('scan').onclick = async () => {
  if (!('BarcodeDetector' in window)) {
    alert('Barcode scanning is not supported by this browser.');
    return;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    $('video').hidden = false;
    $('video').srcObject = stream;
    await $('video').play();

    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });

    const loop = async () => {
      if (!stream) return;

      const codes = await detector.detect($('video'));

      if (codes.length) {
        const code = codes[0].rawValue;
        stream.getTracks().forEach(t => t.stop());
        stream = null;
        $('video').hidden = true;

        const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
        const j = await r.json();

        if (j.status === 1) {
          const p = j.product;
          const n = p.nutriments || {};
          $('fname').value = p.product_name || 'Scanned food';
          $('serving').value = p.serving_size || '100 g';
          $('fcal').value = Math.round(n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0);
          $('fp').value = n.proteins_serving ?? n.proteins_100g ?? 0;
          $('fc').value = n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0;
          $('ff').value = n.fat_serving ?? n.fat_100g ?? 0;
        } else {
          alert('Product not found; enter nutrition manually.');
        }
      } else {
        requestAnimationFrame(loop);
      }
    };

    loop();
  } catch (e) {
    alert(e.message);
  }
};
// ==========================================
// Constellation Background
// ==========================================

const canvas = document.getElementById("constellation");
const ctx = canvas.getContext("2d");

let stars = [];
let animationFrame;

const STAR_COUNT = 110;
const CONNECTION_DISTANCE = 130;

function resizeConstellation() {
    const dpr = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    createStars();
}

function createStars() {
    stars = [];

    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,

            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,

            radius: Math.random() * 1.4 + 0.4,

            opacity: Math.random() * 0.6 + 0.25,

            twinkle: Math.random() * Math.PI * 2,
            twinkleSpeed: Math.random() * 0.02 + 0.005
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

    // Move and draw stars
    for (const star of stars) {

        star.x += star.vx;
        star.y += star.vy;

        // Wrap around screen
        if (star.x < -10) star.x = window.innerWidth + 10;
        if (star.x > window.innerWidth + 10) star.x = -10;

        if (star.y < -10) star.y = window.innerHeight + 10;
        if (star.y > window.innerHeight + 10) star.y = -10;

        star.twinkle += star.twinkleSpeed;

        const pulse =
            star.opacity +
            Math.sin(star.twinkle) * 0.15;

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
            `rgba(100, 150, 255, ${Math.max(0, pulse * 0.08)})`;

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
            `rgba(180, 210, 255, ${Math.max(0, pulse)})`;

        ctx.fill();
    }

    // Connect nearby stars
    for (let i = 0; i < stars.length; i++) {

        for (let j = i + 1; j < stars.length; j++) {

            const a = stars[i];
            const b = stars[j];

            const dx = a.x - b.x;
            const dy = a.y - b.y;

            const distance = Math.sqrt(
                dx * dx + dy * dy
            );

            if (distance < CONNECTION_DISTANCE) {

                const opacity =
                    (1 - distance / CONNECTION_DISTANCE) * 0.25;

                ctx.beginPath();

                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);

                ctx.strokeStyle =
                    `rgba(100, 150, 255, ${opacity})`;

                ctx.lineWidth = 0.6;

                ctx.stroke();
            }
        }
    }

    animationFrame = requestAnimationFrame(drawConstellation);
}

window.addEventListener(
    "resize",
    resizeConstellation
);

resizeConstellation();
drawConstellation();
