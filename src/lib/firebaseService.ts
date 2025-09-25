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
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { db, storage } from './firebase';
import type { Prize, PrizeTier } from './types';

export interface FirebaseUser {
  id?: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName: string;
  tickets: number;
  pin: string;
  profilePictureUrl?: string;
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
  tierId?: string;
  createdAt?: Timestamp;
}

export interface FirebasePrizeTier {
  id?: string;
  name: string;
  description: string;
  color: string;
  order: number;
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

// Delete a user and clean up related data (allocations, prize entries, winners)
export const deleteUserAndCleanup = async (userId: string): Promise<void> => {
  try {
    // Collect all operations in a batch where possible
    const batch = writeBatch(db);

    // 1) Delete user doc
    batch.delete(doc(db, 'users', userId));

    // 2) Delete allocations for this user
    const allocsQ = query(collection(db, 'allocations'), where('userId', '==', userId));
    const allocsSnap = await getDocs(allocsQ);
    allocsSnap.forEach((d) => batch.delete(d.ref));

    // 3) Remove user from prize entries and recalc totals
    const prizesSnap = await getDocs(collection(db, 'prizes'));
    prizesSnap.forEach((pDoc) => {
      const data = pDoc.data() as FirebasePrize;
      const entries = (data.entries || []).filter((e) => e.userId !== userId);
      const totalTicketsInPrize = entries.reduce((sum, e) => sum + e.numTickets, 0);
      batch.update(pDoc.ref, { entries, totalTicketsInPrize });
    });

    // 4) Delete winners where this user is the winner
    const winnersQ = query(collection(db, 'winners'), where('winnerId', '==', userId));
    const winnersSnap = await getDocs(winnersQ);
    winnersSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();
  } catch (error) {
    console.error('Error deleting user and cleaning up:', error);
    throw error;
  }
};

export const resetAuctionData = async (): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // Delete all allocations
    const allocationsSnapshot = await getDocs(collection(db, 'allocations'));
    allocationsSnapshot.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    // Clear prize entries and totals
    const prizesSnapshot = await getDocs(collection(db, 'prizes'));
    prizesSnapshot.forEach((prizeDoc) => {
      batch.update(prizeDoc.ref, {
        entries: [],
        totalTicketsInPrize: 0,
      });
    });

    // Delete winner documents
    const winnersSnapshot = await getDocs(collection(db, 'winners'));
    winnersSnapshot.forEach((winnerDoc) => {
      batch.delete(winnerDoc.ref);
    });

    await batch.commit();
    console.log('Auction data reset in Firebase');
  } catch (error) {
    console.error('Error resetting auction data:', error);
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
// Update prize entries and total tickets
export const updatePrizeEntries = async (prizeId: string, entries: Array<{userId: string, numTickets: number}>): Promise<void> => {
  try {
    const totalTicketsInPrize = entries.reduce((sum, entry) => sum + entry.numTickets, 0);
    const prizeRef = doc(db, 'prizes', prizeId);
    await updateDoc(prizeRef, {
      entries,
      totalTicketsInPrize
    });
  } catch (error) {
    console.error('Error updating prize entries:', error);
    throw error;
  }
};

// Get all allocations for a specific prize
export const getPrizeAllocations = async (prizeId: string): Promise<FirebaseAllocation[]> => {
  try {
    const q = query(
      collection(db, 'allocations'),
      where('prizeId', '==', prizeId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebaseAllocation[];
  } catch (error) {
    console.error('Error getting prize allocations:', error);
    throw error;
  }
};

export const convertFirebasePrizeToAppPrize = (firebasePrize: FirebasePrize): Prize => {
  return {
    id: firebasePrize.id || '',
    name: firebasePrize.name,
    description: firebasePrize.description,
    imageUrl: firebasePrize.imageUrl,
    entries: firebasePrize.entries || [],
    totalTicketsInPrize: firebasePrize.totalTicketsInPrize || 0,
    tierId: firebasePrize.tierId
  };
};

// Prize Tier Management
export const addPrizeTier = async (tier: Omit<FirebasePrizeTier, 'id' | 'createdAt'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'prizeTiers'), {
      ...tier,
      createdAt: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding prize tier:', error);
    throw error;
  }
};

export const getPrizeTiers = async (): Promise<FirebasePrizeTier[]> => {
  try {
    const querySnapshot = await getDocs(
      query(collection(db, 'prizeTiers'), orderBy('order', 'asc'))
    );
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as FirebasePrizeTier[];
  } catch (error) {
    console.error('Error getting prize tiers:', error);
    throw error;
  }
};

export const updatePrizeTier = async (id: string, updates: Partial<FirebasePrizeTier>): Promise<void> => {
  try {
    const tierRef = doc(db, 'prizeTiers', id);
    await updateDoc(tierRef, updates);
  } catch (error) {
    console.error('Error updating prize tier:', error);
    throw error;
  }
};

export const deletePrizeTier = async (id: string): Promise<void> => {
  try {
    // First remove tier association from all prizes
    const prizesSnapshot = await getDocs(
      query(collection(db, 'prizes'), where('tierId', '==', id))
    );
    
    const batch = writeBatch(db);
    prizesSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { tierId: null });
    });
    
    // Delete the tier
    batch.delete(doc(db, 'prizeTiers', id));
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting prize tier:', error);
    throw error;
  }
};

export const convertFirebasePrizeTierToAppTier = (firebaseTier: FirebasePrizeTier): PrizeTier => {
  return {
    id: firebaseTier.id || '',
    name: firebaseTier.name,
    description: firebaseTier.description,
    color: firebaseTier.color,
    order: firebaseTier.order
  };
};

// Profile Picture Management
export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
  try {
    // Convert file to data URL and compress
    const dataURL = await fileToDataURL(file);
    const compressedDataURL = await compressImage(dataURL, 0.8, 800, 800);
    
    // For now, return the compressed data URL directly
    // This avoids Firebase Storage CORS issues
    return compressedDataURL;
  } catch (error) {
    console.error('Error processing profile picture file:', error);
    throw error;
  }
};

// Helper function to convert file to data URL
const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const uploadProfilePictureFromDataURL = async (userId: string, dataURL: string): Promise<string> => {
  try {
    // For now, we'll store the base64 data URL directly in Firestore
    // This avoids Firebase Storage CORS issues
    // In production, you'd want to set up proper Firebase Storage rules
    
    // Compress the image if it's too large
    const compressedDataURL = await compressImage(dataURL, 0.8, 800, 800);
    
    // Store the compressed data URL directly
    // This is a temporary solution - in production use Firebase Storage with proper auth
    return compressedDataURL;
  } catch (error) {
    console.error('Error processing profile picture from data URL:', error);
    throw error;
  }
};

// Save winner to Firebase
export const saveWinner = async (prizeId: string, winnerId: string): Promise<void> => {
  try {
    await addDoc(collection(db, 'winners'), {
      prizeId,
      winnerId,
      timestamp: Timestamp.now()
    });
    console.log('Winner saved to Firebase:', { prizeId, winnerId });
  } catch (error) {
    console.error('Error saving winner to Firebase:', error);
    throw error;
  }
};

// Save multiple winners to Firebase
export const saveWinners = async (winners: Record<string, string>): Promise<void> => {
  try {
    const batch = writeBatch(db);
    
    // Clear existing winners first
    const existingWinners = await getDocs(collection(db, 'winners'));
    existingWinners.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    // Add new winners
    Object.entries(winners).forEach(([prizeId, winnerId]) => {
      const docRef = doc(collection(db, 'winners'));
      batch.set(docRef, {
        prizeId,
        winnerId,
        timestamp: Timestamp.now()
      });
    });
    
    await batch.commit();
    console.log('Winners saved to Firebase:', winners);
  } catch (error) {
    console.error('Error saving winners to Firebase:', error);
    throw error;
  }
};

// Helper function to compress image
const compressImage = async (dataURL: string, quality: number = 0.8, maxWidth: number = 800, maxHeight: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      // Set canvas size
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      const compressedDataURL = canvas.toDataURL('image/jpeg', quality);
      
      resolve(compressedDataURL);
    };
    
    img.src = dataURL;
  });
};

export const updateUserProfilePicture = async (userId: string, profilePictureUrl: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      profilePictureUrl
    });
  } catch (error) {
    console.error('Error updating user profile picture:', error);
    throw error;
  }
};

export const deleteProfilePicture = async (profilePictureUrl: string): Promise<void> => {
  try {
    if (profilePictureUrl && profilePictureUrl.includes('firebase')) {
      // Extract the path from the URL and delete the file
      const storageRef = ref(storage, profilePictureUrl);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.error('Error deleting profile picture:', error);
    // Don't throw here as this is cleanup - we don't want to fail the main operation
  }
};
