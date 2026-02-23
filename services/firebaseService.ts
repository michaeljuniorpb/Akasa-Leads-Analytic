
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

/**
 * Saves leads to cloud using batch writes with Smart Sync logic.
 * Only writes data that is actually new or has changed.
 */
export const saveLeadsToCloud = async (newLeads: LeadData[], existingLeads: LeadData[] = []) => {
  if (!db) throw new Error("Database Firebase belum siap.");
  
  try {
    // Create a map of existing leads for fast lookup
    const existingMap = new Map(existingLeads.map(l => [l.id || `${l.custId}_${l.agent || 'NA'}`.replace(/[^a-zA-Z0-9]/g, '_'), l]));
    
    // Filter only leads that are new or have changed
    const leadsToUpdate = newLeads.filter(lead => {
      const uniqueId = lead.custId ? `${lead.custId}_${lead.agent || 'NA'}`.replace(/[^a-zA-Z0-9]/g, '_') : null;
      if (!uniqueId) return true; // Always save if no unique ID
      
      const existing = existingMap.get(uniqueId);
      if (!existing) return true; // New lead
      
      // Compare critical fields to detect changes
      // You can add more fields here if needed
      return (
        existing.statusLeads !== lead.statusLeads ||
        existing.statusSiteVisit !== lead.statusSiteVisit ||
        existing.noAttempt !== lead.noAttempt ||
        String(existing.remarks) !== String(lead.remarks) ||
        (existing.tanggalSiteVisit?.getTime() !== lead.tanggalSiteVisit?.getTime()) ||
        (existing.bookingDate?.getTime() !== lead.bookingDate?.getTime())
      );
    });

    if (leadsToUpdate.length === 0) {
      console.log("Smart Sync: No changes detected. Skipping write.");
      return 0;
    }

    console.log(`Smart Sync: Writing ${leadsToUpdate.length} out of ${newLeads.length} leads.`);

    const chunkSize = 400;
    const now = Timestamp.now();
    
    for (let i = 0; i < leadsToUpdate.length; i += chunkSize) {
      const chunk = leadsToUpdate.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      const colRef = collection(db, LEADS_COLLECTION);
      
      chunk.forEach((lead) => {
        const uniqueId = lead.custId ? `${lead.custId}_${lead.agent || 'NA'}`.replace(/[^a-zA-Z0-9]/g, '_') : null;
        const newDocRef = uniqueId ? doc(colRef, uniqueId) : doc(colRef);
        
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
    return leadsToUpdate.length;
  } catch (error) {
    console.error("Firestore Save Error:", error);
    throw error;
  }
};

export const fetchLeadsFromCloud = async (): Promise<LeadData[]> => {
  if (!db) return [];
  try {
    const colRef = collection(db, LEADS_COLLECTION);
    // Limit to 3000 to save "Read" quota on free tier
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
    const fallbackQ = query(collection(db, LEADS_COLLECTION), limit(3000));
    const fallbackSnapshot = await getDocs(fallbackQ);
    return fallbackSnapshot.docs.map(docSnap => {
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
        tanggalVisitAja: toDate(data.tanggalVisitAja)
      } as LeadData;
    });
  }
};

/**
 * Optimized iterative batch deletion for large collections.
 */
export const deleteAllLeads = async () => {
  if (!db) throw new Error("Koneksi Database tidak tersedia.");
  
  try {
    let deletedTotal = 0;
    const colRef = collection(db, LEADS_COLLECTION);
    
    while (true) {
      const q = query(colRef, limit(500));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) break;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      
      await batch.commit();
      deletedTotal += snapshot.size;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return deletedTotal;
  } catch (error: any) {
    console.error("Deletion Error:", error);
    throw new Error(`Gagal menghapus data: ${error.message}`);
  }
};
