
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  Timestamp,
  query,
  limit,
  orderBy
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
  console.error("Firebase failed to initialize:", e);
}

const LEADS_COLLECTION = 'leads';

export const saveLeadsToCloud = async (leads: LeadData[]) => {
  if (!db) throw new Error("Database Firebase belum siap.");
  try {
    const chunkSize = 400;
    const now = Timestamp.now();
    for (let i = 0; i < leads.length; i += chunkSize) {
      const chunk = leads.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const colRef = collection(db, LEADS_COLLECTION);
      
      chunk.forEach((lead) => {
        const newDocRef = doc(colRef);
        const toTimestamp = (d: Date | null) => (d instanceof Date && !isNaN(d.getTime())) ? Timestamp.fromDate(d) : null;

        const dataToSave = {
          ...lead,
          assignedAt: toTimestamp(lead.assignedAt),
          tanggalSiteVisit: toTimestamp(lead.tanggalSiteVisit),
          bookingDate: toTimestamp(lead.bookingDate),
          tanggalVisitAja: toTimestamp(lead.tanggalVisitAja),
          uploadedAt: now
        };

        batch.set(newDocRef, dataToSave);
      });
      await batch.commit();
    }
  } catch (error) {
    console.error("Firestore Save Error:", error);
    throw error;
  }
};

export const fetchLeadsFromCloud = async (): Promise<LeadData[]> => {
  if (!db) return [];
  try {
    const colRef = collection(db, LEADS_COLLECTION);
    // Tambahkan ORDER BY uploadedAt DESC agar data terbaru yang tampil duluan
    // Catatan: Jika ini pertama kali, Firestore mungkin meminta pembuatan Index via link di console.
    const q = query(
      colRef, 
      orderBy('uploadedAt', 'desc'), 
      limit(3000)
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as any;
      const toDate = (ts: any) => {
        if (!ts) return null;
        if (ts instanceof Timestamp) return ts.toDate();
        if (ts.seconds) return new Date(ts.seconds * 1000);
        return new Date(ts);
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
    console.warn("Firestore Fetch Error (Possible Missing Index):", error);
    // Fallback jika index belum dibuat: ambil tanpa sorting
    const fallbackQ = query(collection(db, LEADS_COLLECTION), limit(3000));
    const fallbackSnapshot = await getDocs(fallbackQ);
    return fallbackSnapshot.docs.map(docSnap => {
      const data = docSnap.data() as any;
      const toDate = (ts: any) => {
        if (!ts) return null;
        if (ts instanceof Timestamp) return ts.toDate();
        return new Date(ts);
      };
      return { ...data, id: docSnap.id, assignedAt: toDate(data.assignedAt) } as any;
    });
  }
};

export const deleteAllLeads = async () => {
  if (!db) throw new Error("Koneksi Database tidak tersedia.");
  try {
    const colRef = collection(db, LEADS_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return;
    const docs = snapshot.docs;
    const chunkSize = 450; 
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }
  } catch (error: any) {
    throw new Error(`Gagal menghapus data: ${error.message}`);
  }
};
