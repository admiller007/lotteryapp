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
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject 
} from 'firebase/storage';
import { db, storage } from './firebase';
import type { Prize, PrizeTier } from './types';
import { planWinnerSync, winnerDocId } from './winnerSync';

export interface FirebaseUser {
  id?: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName: string;
  tickets: number;
  status?: 'inactive' | 'working' | 'at_party';
  profilePictureUrl?: string;
  // 'admin' grants admin rights at the next login. PINs are not on this doc:
  // they're hashed in the server-only userSecrets collection.
  role?: 'admin';
  loginKey?: string;
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
  numberOfWinners?: number;
  excludedFacilities?: string[];
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

export const uploadPrizeImage = async (file: File): Promise<string> => {
  try {
    const dataURL = await fileToDataURL(file);
    const compressedDataURL = await compressImage(dataURL, 0.82, 1200, 1200);

    return compressedDataURL;
  } catch (error) {
    console.error('Error processing prize image file:', error);
    throw error;
  }
};

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
// Creating users, resetting PINs and deleting users go through the admin API
// routes (see src/lib/apiClient.ts) because they touch PINs.
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

export const updateUser = async (id: string, updates: Partial<FirebaseUser>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', id);
    await updateDoc(userRef, updates);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const resetAuctionData = async (): Promise<void> => {
  try {
    const [allocationsSnapshot, prizesSnapshot, winnersSnapshot] = await Promise.all([
      getDocs(collection(db, 'allocations')),
      getDocs(collection(db, 'prizes')),
      getDocs(collection(db, 'winners')),
    ]);

    type Op = (batch: ReturnType<typeof writeBatch>) => void;
    const ops: Op[] = [
      ...allocationsSnapshot.docs.map((d): Op => (b) => b.delete(d.ref)),
      ...prizesSnapshot.docs.map((d): Op => (b) => b.update(d.ref, { entries: [], totalTicketsInPrize: 0 })),
      ...winnersSnapshot.docs.map((d): Op => (b) => b.delete(d.ref)),
    ];

    // A Firestore batch holds at most 500 writes; with one allocation doc per
    // user per prize, a real event easily exceeds that.
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db);
      ops.slice(i, i + 450).forEach((op) => op(batch));
      await batch.commit();
    }
  } catch (error) {
    console.error('Error resetting auction data:', error);
    throw error;
  }
};

// Lottery-wide settings (single doc). A missing doc means allocations are open.
export const LOTTERY_SETTINGS_PATH = ['settings', 'lottery'] as const;

export const setAllocationsOpen = async (open: boolean): Promise<void> => {
  await setDoc(
    doc(db, ...LOTTERY_SETTINGS_PATH),
    { allocationsOpen: open, updatedAt: Timestamp.now() },
    { merge: true }
  );
};

// Which animation the winner draw uses ('slot' or 'wheel'), for every screen.
export const setDrawStyle = async (drawStyle: 'slot' | 'wheel'): Promise<void> => {
  await setDoc(
    doc(db, ...LOTTERY_SETTINGS_PATH),
    { drawStyle, updatedAt: Timestamp.now() },
    { merge: true }
  );
};

// Ticket allocation writes go through /api/allocations (allocateTicketsApi).
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
    tierId: firebasePrize.tierId,
    numberOfWinners: firebasePrize.numberOfWinners || 1,
    excludedFacilities: firebasePrize.excludedFacilities || []
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

// Save winner to Firebase. The doc ID comes from the (prize, winner) pair, so
// saving the same winner twice can't create a duplicate.
export const saveWinner = async (prizeId: string, winnerId: string): Promise<void> => {
  try {
    await setDoc(doc(db, 'winners', winnerDocId(prizeId, winnerId)), {
      prizeId,
      winnerId,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error saving winner to Firebase:', error);
    throw error;
  }
};

// Make the winners collection match `winners` (prizeId -> winner IDs).
// Only the differences are written: winners who are unchanged keep their doc
// and its original timestamp, and other screens' winners listeners see just
// the change instead of every winner being deleted and re-added.
export const saveWinners = async (winners: Record<string, string[]>): Promise<void> => {
  try {
    const existingWinners = await getDocs(collection(db, 'winners'));
    const { toDelete, toAdd } = planWinnerSync(
      existingWinners.docs.map((d) => ({ id: d.id, ...(d.data() as { prizeId?: string; winnerId?: string }) })),
      winners
    );

    type Op = (batch: ReturnType<typeof writeBatch>) => void;
    const timestamp = Timestamp.now();
    // Adds go first: if a later batch fails, a winner is never missing, and
    // running the save again finishes the job.
    const ops: Op[] = [
      ...toAdd.map(({ id, prizeId, winnerId }): Op => (b) =>
        b.set(doc(db, 'winners', id), { prizeId, winnerId, timestamp })),
      ...toDelete.map((id): Op => (b) => b.delete(doc(db, 'winners', id))),
    ];

    // A Firestore batch holds at most 500 writes.
    for (let i = 0; i < ops.length; i += 450) {
      const batch = writeBatch(db);
      ops.slice(i, i + 450).forEach((op) => op(batch));
      await batch.commit();
    }
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

// Admin function to upload profile picture for any user
export const adminUploadUserProfilePicture = async (userId: string, file: File): Promise<string> => {
  try {
    // Use the existing upload function
    const profilePictureUrl = await uploadProfilePicture(userId, file);

    // Update the user's profile picture in Firestore
    await updateUserProfilePicture(userId, profilePictureUrl);

    return profilePictureUrl;
  } catch (error) {
    console.error('Error uploading profile picture for user:', error);
    throw error;
  }
};

// Admin function to remove profile picture for any user
export const adminRemoveUserProfilePicture = async (userId: string): Promise<void> => {
  try {
    // Get the user to check if they have a profile picture
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data() as FirebaseUser;
      if (userData.profilePictureUrl) {
        // Delete the file if it exists
        await deleteProfilePicture(userData.profilePictureUrl);
      }
    }

    // Remove the profile picture URL from the user document
    await updateUserProfilePicture(userId, '');
  } catch (error) {
    console.error('Error removing profile picture for user:', error);
    throw error;
  }
};

// Debug function to check winner and user data consistency
export const debugWinnersAndUsers = async (): Promise<void> => {
  try {
    console.log('=== DEBUG: Winners and Users Data ===');

    // Get all winners
    const winnersSnapshot = await getDocs(collection(db, 'winners'));
    const winners: any[] = [];
    winnersSnapshot.forEach(doc => {
      const data = doc.data();
      winners.push({ docId: doc.id, ...data });
    });
    console.log('Winners in Firebase:', winners);

    // Get all users
    const users = await getUsers();
    console.log('Users in Firebase:', users.map(u => ({ id: u.id, employeeId: u.employeeId, name: `${u.firstName} ${u.lastName}` })));

    // Check if winner IDs match user IDs
    winners.forEach(winner => {
      const matchingUser = users.find(u => u.id === winner.winnerId || u.employeeId === winner.winnerId);
      console.log(`Winner ${winner.winnerId} for prize ${winner.prizeId}:`,
        matchingUser ? `Found user: ${matchingUser.firstName} ${matchingUser.lastName}` : 'NO MATCHING USER FOUND');
    });

  } catch (error) {
    console.error('Error debugging winners and users:', error);
  }
};

// Get all winners with complete user and prize information
export interface WinnerExportData {
  prizeName: string;
  prizeDescription: string;
  winnerFirstName: string;
  winnerLastName: string;
  winnerEmployeeId: string;
  winnerFacility: string;
  timestamp: Date;
}

export const getWinnersForExport = async (): Promise<WinnerExportData[]> => {
  try {
    // Get all winners
    const winnersSnapshot = await getDocs(collection(db, 'winners'));
    const winners: any[] = [];
    winnersSnapshot.forEach(doc => {
      const data = doc.data();
      winners.push({ docId: doc.id, ...data });
    });

    // Get all users
    const users = await getUsers();

    // Get all prizes
    const prizes = await getPrizes();

    // Combine the data
    const exportData: WinnerExportData[] = [];

    winners.forEach(winner => {
      const user = users.find(u => u.id === winner.winnerId || u.employeeId === winner.winnerId);
      const prize = prizes.find(p => p.id === winner.prizeId);

      if (user && prize) {
        exportData.push({
          prizeName: prize.name,
          prizeDescription: prize.description,
          winnerFirstName: user.firstName,
          winnerLastName: user.lastName,
          winnerEmployeeId: user.employeeId,
          winnerFacility: user.facilityName,
          timestamp: winner.timestamp?.toDate() || new Date()
        });
      }
    });

    // Sort by timestamp (newest first)
    exportData.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return exportData;
  } catch (error) {
    console.error('Error fetching winners for export:', error);
    throw error;
  }
};
