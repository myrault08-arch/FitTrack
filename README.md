# FitTrack — GitHub Pages + Firebase

Mobile-friendly calorie, macro, PPL workout, steps, weight and barcode food tracker.

## Firebase
1. Create a Firebase project.
2. Add a Web App.
3. Enable Authentication > Email/Password.
4. Create Firestore.
5. Copy `firebase-config.example.js` to `firebase-config.js` and paste your web config.
6. Publish `firestore.rules`.

## GitHub Pages
Upload the files to a repository, then Settings > Pages > Deploy from branch > main > /(root).

The barcode scanner uses the browser BarcodeDetector API when available and Open Food Facts for product lookup.
