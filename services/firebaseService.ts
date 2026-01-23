
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  writeBatch, 
  doc, 
  Timestamp,
  limit
} from 'firebase/firestore';
import { LeadData } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyBu1K1g9oQ3MRQw6TWSugoVJ3vlAjtCwZY",
  authDomain: "akasa-analytics.firebaseapp.com",
  projectId: "akasa-analytics",
  storageBucket: "akasa-analytics.firebasestorage.app",
  messagingSenderId: "50140962278",
  appId: "1:50140962278:web:abc00a4238973dd72c4a27",
  measurementId: "G-77S4HM4MND"
};

let db: any = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase failed to initialize. Dashboard will run in offline mode.", e);
}

const LEADS_COLLECTION = 'leads';

export const saveLeadsToCloud = async (leads: LeadData[]) => {
  if (!db) {
    console.warn("Saving to memory only (Database not ready)");
    return;
  }
  
  try {
    const batch = writeBatch(db);
    const colRef = collection(db, LEADS_COLLECTION);
    
    // Simpan 100 data terakhir saja untuk menjaga performa batch
    const limitedLeads = leads.slice(0, 100);
    
    limitedLeads.forEach((lead) => {
      const newDocRef = doc(colRef);
      const serialized = JSON.parse(JSON.stringify(lead, (key, value) => 
        value === undefined ? null : value
      ));

      batch.set(newDocRef, {
        ...serialized,
        uploadedAt: Timestamp.now()
      });
    });

    return await batch.commit();
  } catch (error) {
    console.error("Firestore Save Error:", error);
  }
};

export const fetchLeadsFromCloud = async (): Promise<LeadData[]> => {
  if (!db) return [];
  try {
    const colRef = collection(db, LEADS_COLLECTION);
    // Ambil 500 data terbaru saja agar loading tidak lama saat deployment
    const q = query(colRef, orderBy('uploadedAt', 'desc'), limit(500));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const toDate = (ts: any) => {
        if (!ts) return null;
        if (ts instanceof Timestamp) return ts.toDate();
        if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
        return null;
      };

      return {
        ...data,
        id: docSnap.id,
        assignedAt: toDate(data.assignedAt),
        tanggalSiteVisit: toDate(data.tanggalSiteVisit),
        bookingDate: toDate(data.bookingDate),
        tanggalVisitAja: toDate(data.tanggalVisitAja),
      } as LeadData;
    });
  } catch (error) {
    console.error("Firestore Fetch Error:", error);
    return [];
  }
};
