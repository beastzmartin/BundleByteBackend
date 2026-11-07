import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import LicenseInventory from '../models/LicenseInventory.js';
import Order from '../models/Order.js';
import Subscription from '../models/Subscription.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import Wallet from '../models/Wallet.js';
import TeamRole from '../models/TeamRole.js';
import Department from '../models/Department.js';
import TeamMember from '../models/TeamMember.js';
import SupportSLA from '../models/SupportSLA.js';
import BrandingSettings from '../models/BrandingSettings.js';
import ThemeSettings from '../models/ThemeSettings.js';
import HomepageSection from '../models/HomepageSection.js';

async function checkData() {
  console.log('\n--- Checking Database Status & Record Counts ---');
  await connectDB();

  const counts = {
    users: await User.countDocuments(),
    categories: await Category.countDocuments(),
    products: await Product.countDocuments(),
    licenseKeys: await LicenseInventory.countDocuments(),
    orders: await Order.countDocuments(),
    subscriptions: await Subscription.countDocuments(),
    coupons: await Coupon.countDocuments(),
    reviews: await Review.countDocuments(),
    wallets: await Wallet.countDocuments(),
    teamRoles: await TeamRole.countDocuments(),
    departments: await Department.countDocuments(),
    teamMembers: await TeamMember.countDocuments(),
    slaPolicies: await SupportSLA.countDocuments(),
    homepageSections: await HomepageSection.countDocuments(),
  };

  console.log('\nDatabase Record Counts:');
  console.table(counts);

  const admin = await User.findOne({ email: 'admin@bundlebyte.com' });
  console.log('Admin User Verified:', admin ? `${admin.name} (${admin.email}) [Role: ${admin.role}]` : 'Not found');

  const customer = await User.findOne({ email: 'john@example.com' });
  console.log('Customer User Verified:', customer ? `${customer.name} (${customer.email}) [Role: ${customer.role}]` : 'Not found');

  await disconnectDB();
  process.exit(0);
}

checkData().catch(err => {
  console.error('Error checking DB data:', err);
  process.exit(1);
});

