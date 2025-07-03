import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import type { 
  FirebaseUser, 
  FirebaseLottery, 
  FirebaseAllocation, 
  FirebaseWinner,
  Prize 
} from './types';

// Authentication functions
export const signUpUser = async (email: string, password: string, userData: Partial<FirebaseUser>) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save additional user data to Firestore
    await addDoc(collection(db, 'users'), {
      uid: user.uid,
      email: user.email,
      ...userData,
      createdAt: new Date().toISOString()
    });
    
    return user;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

export const signInUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// User data functions
export const getUserData = async (uid: string): Promise<FirebaseUser | null> => {
  try {
    const q = query(collection(db, 'users'), where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as FirebaseUser;
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};

// CSV User functions (for name/facility/pin login)
export const uploadCSVUsers = async (users: any[]) => {
  try {
    const batch = writeBatch(db);
    const csvUsersRef = collection(db, 'csv_users');
    
    // Clear existing CSV users first
    const existingUsers = await getDocs(csvUsersRef);
    existingUsers.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Add new CSV users
    users.forEach(user => {
      const userRef = doc(csvUsersRef);
      batch.set(userRef, {
        firstName: user.firstName,
        lastName: user.lastName,
        name: `${user.firstName} ${user.lastName}`,
        facilityName: user.facilityName,
        tickets: user.tickets,
        pin: user.pin,
        uploadedAt: new Date().toISOString()
      });
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error uploading CSV users:', error);
    throw error;
  }
};

export const getAllCSVUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'csv_users'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting CSV users:', error);
    throw error;
  }
};

export const findCSVUser = async (firstName: string, lastName: string, facilityName: string, pin: string) => {
  try {
    const name = `${firstName} ${lastName}`;
    const q = query(
      collection(db, 'csv_users'),
      where('name', '==', name),
      where('facilityName', '==', facilityName),
      where('pin', '==', pin)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error finding CSV user:', error);
    throw error;
  }
};

// Get all users (both Firebase auth users and CSV users) for admin display
export const getAllUsers = async () => {
  try {
    const [authUsers, csvUsers] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'csv_users'))
    ]);
    
    const allUsers = [
      ...authUsers.docs.map(doc => ({
        id: doc.id,
        type: 'firebase',
        name: doc.data().displayName,
        facilityName: doc.data().facilityName,
        tickets: doc.data().tickets,
        isAdmin: doc.data().isAdmin,
        ...doc.data()
      })),
      ...csvUsers.docs.map(doc => ({
        id: doc.id,
        type: 'csv',
        ...doc.data()
      }))
    ];
    
    return allUsers;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Lottery functions
export const createLottery = async (lotteryData: Omit<FirebaseLottery, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, 'lotteries'), lotteryData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating lottery:', error);
    throw error;
  }
};

export const getLottery = async (lotteryId: string): Promise<FirebaseLottery | null> => {
  try {
    const docRef = doc(db, 'lotteries', lotteryId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as FirebaseLottery;
    }
    return null;
  } catch (error) {
    console.error('Error getting lottery:', error);
    throw error;
  }
};

export const updateLottery = async (lotteryId: string, updates: Partial<FirebaseLottery>) => {
  try {
    const docRef = doc(db, 'lotteries', lotteryId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating lottery:', error);
    throw error;
  }
};

// Prize functions - Direct prize management (not tied to lottery)
export const addPrize = async (prize: Omit<Prize, 'id' | 'entries' | 'totalTicketsInPrize'>) => {
  try {
    const prizeWithId = {
      ...prize,
      id: `prize-${Date.now()}`,
      entries: [],
      totalTicketsInPrize: 0,
      createdAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'prizes'), prizeWithId);
    return docRef.id;
  } catch (error) {
    console.error('Error adding prize:', error);
    throw error;
  }
};

export const getAllPrizes = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, 'prizes'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Prize[];
  } catch (error) {
    console.error('Error getting prizes:', error);
    throw error;
  }
};

export const updatePrize = async (prizeId: string, updates: Partial<Prize>) => {
  try {
    const prizeRef = doc(db, 'prizes', prizeId);
    await updateDoc(prizeRef, updates);
  } catch (error) {
    console.error('Error updating prize:', error);
    throw error;
  }
};

export const deletePrize = async (prizeId: string) => {
  try {
    // Delete the prize document
    const prizeRef = doc(db, 'prizes', prizeId);
    await deleteDoc(prizeRef);
    
    // Also delete any allocations for this prize
    const allocationsQuery = query(
      collection(db, 'allocations'),
      where('prizeId', '==', prizeId)
    );
    const allocationsSnapshot = await getDocs(allocationsQuery);
    
    const batch = writeBatch(db);
    allocationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting prize:', error);
    throw error;
  }
};

// Initialize default prizes if none exist
export const initializeDefaultPrizes = async () => {
  try {
    const existingPrizes = await getAllPrizes();
    if (existingPrizes.length === 0) {
      const defaultPrizes = [
        {
          name: 'Luxury Spa Day',
          description: 'A full day of pampering at a top-rated spa, including massage, facial, and more.',
          imageUrl: 'https://placehold.co/300x200/4f46e5/ffffff?text=Spa+Day',
        },
        {
          name: 'Weekend Getaway',
          description: 'A two-night stay for two at a scenic countryside cabin.',
          imageUrl: 'https://placehold.co/300x200/059669/ffffff?text=Weekend+Getaway',
        },
        {
          name: 'Tech Gadget Bundle',
          description: 'Latest smartwatch, wireless earbuds, and a portable charger.',
          imageUrl: 'https://placehold.co/300x200/dc2626/ffffff?text=Tech+Bundle',
        },
      ];
      
      const batch = writeBatch(db);
      defaultPrizes.forEach(prize => {
        const prizeRef = doc(collection(db, 'prizes'));
        batch.set(prizeRef, {
          ...prize,
          id: prizeRef.id,
          entries: [],
          totalTicketsInPrize: 0,
          createdAt: new Date().toISOString()
        });
      });
      
      await batch.commit();
      console.log('Default prizes initialized');
    }
  } catch (error) {
    console.error('Error initializing default prizes:', error);
    throw error;
  }
};

// Allocation functions
export const allocateTickets = async (allocation: Omit<FirebaseAllocation, 'id'>) => {
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
        // Delete the allocation if tickets is 0
        await deleteDoc(existingDoc.ref);
        return existingDoc.id;
      } else {
        // Update existing allocation
        await updateDoc(existingDoc.ref, {
          tickets: allocation.tickets,
          userName: allocation.userName,
          timestamp: new Date().toISOString()
        });
        return existingDoc.id;
      }
    } else {
      // Only create new allocation if tickets > 0
      if (allocation.tickets > 0) {
        const docRef = await addDoc(collection(db, 'allocations'), {
          ...allocation,
          timestamp: new Date().toISOString()
        });
        return docRef.id;
      }
      return null;
    }
  } catch (error) {
    console.error('Error allocating tickets:', error);
    throw error;
  }
};

export const getUserAllocations = async (lotteryId: string, userId: string) => {
  try {
    const q = query(
      collection(db, 'allocations'),
      where('lotteryId', '==', lotteryId),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseAllocation[];
  } catch (error) {
    console.error('Error getting user allocations:', error);
    throw error;
  }
};

export const getAllAllocations = async (lotteryId: string) => {
  try {
    const q = query(
      collection(db, 'allocations'),
      where('lotteryId', '==', lotteryId),
      orderBy('timestamp', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseAllocation[];
  } catch (error) {
    console.error('Error getting all allocations:', error);
    throw error;
  }
};

// Winner functions
export const drawWinners = async (lotteryId: string, allocations: FirebaseAllocation[], prizes: Prize[]) => {
  try {
    const batch = writeBatch(db);
    const winners: FirebaseWinner[] = [];
    const usersWhoWon = new Set<string>();
    
    // Group allocations by prize
    const allocationsByPrize = allocations.reduce((acc, allocation) => {
      if (!acc[allocation.prizeId]) {
        acc[allocation.prizeId] = [];
      }
      acc[allocation.prizeId].push(allocation);
      return acc;
    }, {} as Record<string, FirebaseAllocation[]>);
    
    // Draw winners for each prize
    prizes.forEach(prize => {
      const prizeAllocations = allocationsByPrize[prize.id] || [];
      if (prizeAllocations.length === 0) return;
      
      // Create drawing pool
      const drawingPool: string[] = [];
      prizeAllocations.forEach(allocation => {
        for (let i = 0; i < allocation.tickets; i++) {
          drawingPool.push(allocation.userId);
        }
      });
      
      // Filter out users who already won
      const eligiblePool = drawingPool.filter(userId => !usersWhoWon.has(userId));
      
      if (eligiblePool.length > 0) {
        const winnerIndex = Math.floor(Math.random() * eligiblePool.length);
        const winnerUserId = eligiblePool[winnerIndex];
        const winnerAllocation = prizeAllocations.find(a => a.userId === winnerUserId);
        
        if (winnerAllocation) {
          const winner: FirebaseWinner = {
            id: `winner-${Date.now()}-${prize.id}`,
            lotteryId,
            prizeId: prize.id,
            userId: winnerUserId,
            userName: winnerAllocation.userName,
            drawnAt: new Date().toISOString()
          };
          
          winners.push(winner);
          usersWhoWon.add(winnerUserId);
          
          // Add to batch
          const winnerRef = doc(collection(db, 'winners'));
          batch.set(winnerRef, winner);
        }
      }
    });
    
    // Update lottery to closed
    const lotteryRef = doc(db, 'lotteries', lotteryId);
    batch.update(lotteryRef, { isOpen: false });
    
    // Commit batch
    await batch.commit();
    
    return winners;
  } catch (error) {
    console.error('Error drawing winners:', error);
    throw error;
  }
};

export const getWinners = async (lotteryId: string) => {
  try {
    const q = query(
      collection(db, 'winners'),
      where('lotteryId', '==', lotteryId),
      orderBy('drawnAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseWinner[];
  } catch (error) {
    console.error('Error getting winners:', error);
    throw error;
  }
};

// Real-time listeners
export const subscribeToLottery = (lotteryId: string, callback: (lottery: FirebaseLottery | null) => void) => {
  const lotteryRef = doc(db, 'lotteries', lotteryId);
  
  return onSnapshot(lotteryRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as FirebaseLottery);
    } else {
      callback(null);
    }
  });
};

export const subscribeToAllocations = (lotteryId: string, callback: (allocations: FirebaseAllocation[]) => void) => {
  const q = query(
    collection(db, 'allocations'),
    where('lotteryId', '==', lotteryId),
    orderBy('timestamp', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const allocations = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseAllocation[];
    callback(allocations);
  });
};

export const subscribeToWinners = (lotteryId: string, callback: (winners: FirebaseWinner[]) => void) => {
  const q = query(
    collection(db, 'winners'),
    where('lotteryId', '==', lotteryId),
    orderBy('drawnAt', 'desc')
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const winners = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseWinner[];
    callback(winners);
  });
};