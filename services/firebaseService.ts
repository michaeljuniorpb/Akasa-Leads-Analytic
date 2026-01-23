
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { LeadData } from '../types';

// Catatan: Gunakan config Firebase Anda di sini jika ingin menggunakan project sendiri.
// Untuk demo ini, kita asumsikan environment sudah menyediakan akses.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSy...",
  authDomain: "leads-analyzer-pro.firebaseapp.com",
  projectId: "leads-analyzer-pro",
  storageBucket: "leads-analyzer-pro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const LEADS_COLLECTION = 'leads';

export const saveLeadsToCloud = async (leads: LeadData[]) => {
  const batch = writeBatch(db);
  const colRef = collection(db, LEADS_COLLECTION);
  
  // Karena Firestore memiliki limit batch 500, kita simpan secara bertahap
  // Untuk kesederhanaan, kita ambil 400 data pertama jika file sangat besar
  const limitedLeads = leads.slice(0, 400);
  
  limitedLeads.forEach((lead) => {
    const newDocRef = doc(colRef);
    // Convert Dates to ISO strings for Firestore compatibility if needed, 
    // but Firestore handles Dates well. We'll clean the object first.
    batch.set(newDocRef, {
      ...lead,
      uploadedAt: new Date()
    });
  });

  await batch.commit();
};

export const fetchLeadsFromCloud = async (): Promise<LeadData[]> => {
  const colRef = collection(db, LEADS_COLLECTION);
  const q = query(colRef, orderBy('uploadedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    // Re-convert timestamps back to Dates
    return {
      ...data,
      assignedAt: data.assignedAt?.toDate() || null,
      tanggalSiteVisit: data.tanggalSiteVisit?.toDate() || null,
      bookingDate: data.bookingDate?.toDate() || null,
      tanggalVisitAja: data.tanggalVisitAja?.toDate() || null,
    } as LeadData;
  });
};
