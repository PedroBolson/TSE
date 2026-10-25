import { getApp, getApps, initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAVheJRpWDPxCrfMLlv64xtRkcNDelx6vU',
  authDomain: 'tsebr-2df7b.firebaseapp.com',
  projectId: 'tsebr-2df7b',
  storageBucket: 'tsebr-2df7b.firebasestorage.app',
  messagingSenderId: '260934290378',
  appId: '1:260934290378:web:c819f7f05e7946fb5b1d33',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firestore = getFirestore(app)
