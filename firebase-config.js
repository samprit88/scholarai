const firebaseConfig = {
  apiKey: "AIzaSyD954drxzTJp3-yIPhwLrkJmFIzSjZRBvs",
  authDomain: "scholarai-8c431.firebaseapp.com",
  projectId: "scholarai-8c431",
  storageBucket: "scholarai-8c431.firebasestorage.app",
  messagingSenderId: "217261975745",
  appId: "1:217261975745:web:58d957790c2fc7d4cd0c40",
  databaseURL: "https://scholarai-8c431-default-rtdb.firebaseio.com"
};

const firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
const firebaseAuth = firebase.auth();
const firebaseFirestore = firebase.firestore();
const firebaseRealtimeDb = firebase.database();

firebaseFirestore.enablePersistence({ synchronizeTabs: true }).catch(() => {});

let firebaseAuthResolved = false;
let firebaseCurrentUser = null;
const firebaseAuthReady = new Promise(resolve => {
  firebaseAuth.onAuthStateChanged(user => {
    firebaseCurrentUser = user;
    firebaseAuthResolved = true;
    resolve(user);
  });
});

window.ScholarFirebase = {
  app: firebaseApp,
  auth: firebaseAuth,
  firestore: firebaseFirestore,
  database: firebaseRealtimeDb,
  authReady: firebaseAuthReady,
  getCurrentUser: () => firebaseCurrentUser,
  isAuthResolved: () => firebaseAuthResolved
};
