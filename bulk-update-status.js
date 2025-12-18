// Bulk Update All Users to Inactive Status
// Run this script in your browser console while logged in as admin

async function updateAllUsersToInactive() {
  try {
    console.log('Starting bulk update to set all users to inactive...');

    // Import Firebase functions
    const { getUsers, updateUser } = await import('./src/lib/firebaseService.js');

    // Get all users
    const users = await getUsers();
    console.log(`Found ${users.length} users to update`);

    // Update each user to inactive status
    let updated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        if (user.id && user.status !== 'inactive') {
          await updateUser(user.id, { status: 'inactive' });
          console.log(`✅ Updated ${user.firstName} ${user.lastName} to inactive`);
          updated++;
        } else if (user.status === 'inactive') {
          console.log(`⏭️ ${user.firstName} ${user.lastName} already inactive`);
        }
      } catch (error) {
        console.error(`❌ Failed to update ${user.firstName} ${user.lastName}:`, error);
        errors++;
      }
    }

    console.log(`\n🎉 Bulk update complete!`);
    console.log(`✅ Updated: ${updated} users`);
    console.log(`❌ Errors: ${errors} users`);
    console.log(`📊 Total processed: ${users.length} users`);

    // Refresh the page to see changes
    if (updated > 0) {
      console.log('Refreshing page to show changes...');
      window.location.reload();
    }

  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

// Run the script
updateAllUsersToInactive();