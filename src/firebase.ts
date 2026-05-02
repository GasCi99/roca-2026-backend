import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize Analytics safely
export const analytics = typeof window !== 'undefined' ? 
  isSupported().then(supported => {
    if (supported) {
      return getAnalytics(app);
    }
    return null;
  }).catch(() => null) : 
  Promise.resolve(null);
