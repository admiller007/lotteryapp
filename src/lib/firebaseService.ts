import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  writeBatch,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import type { Prize } from './types';

export interface FirebaseUser {
  id?: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName: string;
  tickets: number;
  pin: string;
  createdAt?: Timestamp;
}

export interface FirebasePrize {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  entries: Array<{
    userId: string;
    numTickets: number;
  }>;
  totalTicketsInPrize: number;
  createdAt?: Timestamp;
}

export interface FirebaseAllocation {
  id?: string;
  lotteryId: string;
  prizeId: string;
  userId: string;
  userName: string;
  tickets: number;
  timestamp: string;
}

// Prize Management
export const addPrize = async (prize: Omit<FirebasePrize, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'prizes'), {
      ...prize,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding prize:', error);
    throw error;
  }
};

export const getPrizes = async (): Promise<FirebasePrize[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'prizes'), orderBy('createdAt', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebasePrize[];
  } catch (error) {
    console.error('Error getting prizes:', error);
    throw error;
  }
};

export const updatePrize = async (id: string, updates: Partial<FirebasePrize>): Promise<void> => {
  try {
    const prizeRef = doc(db, 'prizes', id);
    await updateDoc(prizeRef, updates);
  } catch (error) {
    console.error('Error updating prize:', error);
    throw error;
  }
};

export const deletePrize = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'prizes', id));
  } catch (error) {
    console.error('Error deleting prize:', error);
    throw error;
  }
};

// User Management
export const addUser = async (user: Omit<FirebaseUser, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      ...user,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding user:', error);
    throw error;
  }
};

export const addUsers = async (users: Omit<FirebaseUser, 'id' | 'createdAt'>[]): Promise<string[]> => {
  try {
    const batch = writeBatch(db);
    const userRefs: string[] = [];
    
    users.forEach(user => {
      const docRef = doc(collection(db, 'users'));
      batch.set(docRef, {
        ...user,
        createdAt: Timestamp.now()
      });
      userRefs.push(docRef.id);
    });
    
    await batch.commit();
    return userRefs;
  } catch (error) {
    console.error('Error adding users:', error);
    throw error;
  }
};

export const getUsers = async (): Promise<FirebaseUser[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseUser[];
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
};

export const getUserByCredentials = async (
  firstName: string, 
  lastName: string, 
  facilityName: string, 
  pin: string
): Promise<FirebaseUser | null> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('firstName', '==', firstName),
      where('lastName', '==', lastName),
      where('facilityName', '==', facilityName),
      where('pin', '==', pin)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    return {
      id: userDoc.id,
      ...userDoc.data()
    } as FirebaseUser;
  } catch (error) {
    console.error('Error getting user by credentials:', error);
    throw error;
  }
};

// Ticket Allocation Management
export const allocateTickets = async (allocation: Omit<FirebaseAllocation, 'id'>): Promise<string> => {
  try {
    // Check if user already has an allocation for this prize
    const q = query(
      collection(db, 'allocations'),
      where('lotteryId', '==', allocation.lotteryId),
      where('prizeId', '==', allocation.prizeId),
      where('userId', '==', allocation.userId)
    );
    const existingSnapshot = await getDocs(q);
    
    if (!existingSnapshot.empty) {
      // Update existing allocation
      const existingDoc = existingSnapshot.docs[0];
      if (allocation.tickets === 0) {
        await deleteDoc(existingDoc.ref);
        return existingDoc.id;
      } else {
        await updateDoc(existingDoc.ref, {
          tickets: allocation.tickets,
          userName: allocation.userName,
          timestamp: new Date().toISOString()
        });
        return existingDoc.id;
      }
    } else {
      // Create new allocation if tickets > 0
      if (allocation.tickets > 0) {
        const docRef = await addDoc(collection(db, 'allocations'), {
          ...allocation,
          timestamp: new Date().toISOString()
        });
        return docRef.id;
      }
    }
    
    return '';
  } catch (error) {
    console.error('Error allocating tickets:', error);
    throw error;
  }
};

export const getUserAllocations = async (userId: string): Promise<Record<string, number>> => {
  try {
    const q = query(
      collection(db, 'allocations'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    
    const allocations: Record<string, number> = {};
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      allocations[data.prizeId] = data.tickets;
    });
    
    return allocations;
  } catch (error) {
    console.error('Error getting user allocations:', error);
    throw error;
  }
};

export const getAllAllocations = async (): Promise<FirebaseAllocation[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'allocations'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseAllocation[];
  } catch (error) {
    console.error('Error getting all allocations:', error);
    throw error;
  }
};

// Convert Firebase prizes to app format
export const convertFirebasePrizeToAppPrize = (firebasePrize: FirebasePrize): Prize => {
  return {
    id: firebasePrize.id || '',
    name: firebasePrize.name,
    description: firebasePrize.description,
    imageUrl: firebasePrize.imageUrl,
    entries: firebasePrize.entries || [],
    totalTicketsInPrize: firebasePrize.totalTicketsInPrize || 0
  };
};