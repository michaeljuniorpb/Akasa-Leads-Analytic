
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  Timestamp,
  query,
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
  console.log("Firebase initialized successfully");
} catch (e) {
  console.error("Firebase failed to initialize:", e);
}

const LEADS_COLLECTION = 'leads';

export const saveLeadsToCloud = async (leads: LeadData[]) => {
  if (!db) throw new Error("Database Firebase belum siap.");
  try {
    const chunkSize = 400;
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
          uploadedAt: Timestamp.now()
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
    const q = query(colRef, limit(3000));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(docSnap => {
      // Fix: Cast docSnap.data() to any to avoid TypeScript unknown type errors on line 85 and lines 87-90
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
    console.error("Firestore Fetch Error:", error);
    return [];
  }
};

export const deleteAllLeads = async () => {
  if (!db) {
    console.error("Delete failed: DB is null");
    throw new Error("Koneksi Database (Firestore) tidak tersedia.");
  }
  
  console.log("Memulai proses penghapusan data...");
  
  try {
    const colRef = collection(db, LEADS_COLLECTION);
    const snapshot = await getDocs(colRef);
    
    if (snapshot.empty) {
      console.log("Database sudah kosong, tidak ada yang perlu dihapus.");
      return;
    }

    const docs = snapshot.docs;
    console.log(`Ditemukan ${docs.length} dokumen untuk dihapus.`);

    const chunkSize = 450; 
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      
      chunk.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      console.log(`Menghapus batch ${Math.floor(i/chunkSize) + 1}...`);
      await batch.commit();
    }
    
    console.log("Semua data di Cloud Firestore berhasil dihapus.");
  } catch (error: any) {
    console.error("CRITICAL DELETE ERROR:", error);
    // Jika error karena permission, beritahu user
    if (error.code === 'permission-denied') {
      throw new Error("Izin ditolak (Permission Denied). Pastikan 'Rules' di Firebase Console sudah diset ke 'allow read, write: if true;' untuk testing.");
    }
    throw new Error(`Gagal menghapus data: ${error.message || 'Unknown Error'}`);
  }
};
