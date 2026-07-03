// Firebase configuration for MOCKLIST app
// Connected to Firebase project: mocklist-app

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCmlcDOnvcjv79sYyfOUxHu4QJ-pBZZLGM",
  authDomain: "mocklist-app.firebaseapp.com",
  projectId: "mocklist-app",
  storageBucket: "mocklist-app.firebasestorage.app",
  messagingSenderId: "339480182886",
  appId: "1:339480182886:web:7628a49dd4c86bafa36da7"
};

// Initialize Firebase (using compat API for non-module scripts)
const firebaseApp = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestoreDb = firebase.firestore();

// Export globally for use in other scripts
window.firebase = firebase;
window.auth = auth;
// Note: window.db is intentionally not exported to avoid conflict with app.js's IndexedDB variable
window.firestoreDb = firestoreDb;