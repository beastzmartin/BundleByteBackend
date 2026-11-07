import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import LicenseInventory from '../models/LicenseInventory.js';
import Order from '../models/Order.js';
import Subscription from '../models/Subscription.js';
import DigitalDelivery from '../models/DigitalDelivery.js';
import Coupon from '../models/Coupon.js';
import Review from '../models/Review.js';
import SupportTicket from '../models/SupportTicket.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import DeliveryHistory from '../models/DeliveryHistory.js';
import CashbackTransaction from '../models/CashbackTransaction.js';
import WhatsAppDelivery from '../models/WhatsAppDelivery.js';
import rbacService from '../services/rbacService.js';
import TeamRole from '../models/TeamRole.js';
import Department from '../models/Department.js';
import TeamMember from '../models/TeamMember.js';
import TeamInvitation from '../models/TeamInvitation.js';
import ApprovalRequest from '../models/ApprovalRequest.js';

export const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing collections
    await User.deleteMany();
    await Category.deleteMany();
    await Product.deleteMany();
    await LicenseInventory.deleteMany();
    await Order.deleteMany();
    await Subscription.deleteMany();
    await DigitalDelivery.deleteMany();
    await WhatsAppDelivery.deleteMany();
    await Coupon.deleteMany();
    await Review.deleteMany();
    await SupportTicket.deleteMany();
    await WebsiteSetting.deleteMany();
    await Wallet.deleteMany();
    await WalletTransaction.deleteMany();
    await DeliveryHistory.deleteMany();
    await CashbackTransaction.deleteMany();

    // 1. Create Users
    const admin = await User.create({
      name: 'Muzammil (Owner & Super Admin)',
      email: 'admin@bundlebyte.com',
      password: 'Admin@123456',
      role: 'super_admin',
      phone: '+1 (555) 019-2834',
      isEmailVerified: true,
      billingAddress: {
        company: 'BundleByte Technologies Inc.',
        street: '100 Silicon Way, Suite 400',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94107',
        country: 'US',
      },
    });

    const staffSupport = await User.create({
      name: 'Sarah Jenkins',
      email: 'sarah.support@bundlebyte.com',
      password: 'Password@123',
      role: 'support_manager',
      phone: '+1 (555) 304-9122',
      isEmailVerified: true,
    });

    const staffFinance = await User.create({
      name: 'Marcus Vance',
      email: 'marcus.finance@bundlebyte.com',
      password: 'Password@123',
      role: 'finance_manager',
      phone: '+1 (555) 441-8930',
      isEmailVerified: true,
    });

    const staffOps = await User.create({
      name: 'Elena Rostova',
      email: 'elena.ops@bundlebyte.com',
      password: 'Password@123',
      role: 'operations_manager',
      phone: '+1 (555) 772-1109',
      isEmailVerified: true,
    });

    const customer = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password@123',
      role: 'customer',
      phone: '+1 (555) 748-9102',
      isEmailVerified: true,
      billingAddress: {
        company: 'DevCraft Labs',
        street: '42 Innovation Blvd',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        country: 'US',
      },
    });

    console.log('👤 Created Admin (admin@bundlebyte.com) and Customer (john@example.com)');

    // 2. Create Categories
    const categories = await Category.insertMany([
      {
        name: 'Software Subscriptions',
        slug: 'software-subscriptions',
        description: 'Monthly, quarterly, annual and lifetime subscriptions for industry-standard software suites.',
        icon: 'Zap',
        badge: 'MOST POPULAR',
        displayOrder: 1,
      },
      {
        name: 'Digital Accounts',
        slug: 'digital-accounts',
        description: 'Verified business, team, and individual software accounts with direct authorized credentials.',
        icon: 'UserCheck',
        badge: 'INSTANT ACCESS',
        displayOrder: 2,
      },
      {
        name: 'Software Access Links',
        slug: 'software-access-links',
        description: 'Secure workspace activation links, enterprise organization invites, and setup URLs.',
        icon: 'Link',
        badge: 'NO INSTALL REQUIRED',
        displayOrder: 3,
      },
      {
        name: 'Digital Licenses',
        slug: 'digital-licenses',
        description: 'Genuine cryptographic license keys, OEM product codes, and perpetual activation serials.',
        icon: 'KeyRound',
        badge: '100% GENUINE',
        displayOrder: 4,
      },
    ]);

    const [catSubs, catAccounts, catLinks, catLicenses] = categories;
    console.log('📁 Created 4 Core Product Categories');

    // 3. Create Products
    const productsData = [
      // CATEGORY A: Software Subscriptions
      {
        title: 'JetBrains All Products Pack',
        slug: 'jetbrains-all-products-pack',
        category: catSubs._id,
        subCategory: 'Developer IDEs & Tools',
        summary: 'Access IntelliJ IDEA Ultimate, PyCharm Pro, WebStorm, GoLand, CLion, Rider, DataGrip, and all 16 developer IDEs.',
        description: `The JetBrains All Products Pack gives professional developers complete access to JetBrains desktop tools including 10 IDEs, 3 extensions, and 2 profilers. Build modern web applications, backend distributed systems, mobile apps, and machine learning models with industry-leading code intelligence.`,
        logo: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=200&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000&auto=format&fit=crop&q=80',
        ],
        tags: ['jetbrains', 'intellij', 'pycharm', 'developer', 'ide', 'webstorm'],
        isFeatured: true,
        isTrending: true,
        isPopular: true,
        isSpecialOffer: true,
        badge: 'BESTSELLER',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        deliveryInstructions: 'Your JetBrains activation license key and offline ticket will be generated immediately in your vault. Enter it in Help -> Register -> Activation Code.',
        setupGuideUrl: 'https://www.jetbrains.com/help/idea/register.html',
        defaultAccessLink: 'https://account.jetbrains.com',
        activationProcess: `### Step-by-Step JetBrains All Products Pack Activation:
1. **Download & Install:** Download the official JetBrains Toolbox App or standalone IDE from https://www.jetbrains.com/products.
2. **Launch IDE:** Open your installed IDE and navigate to the top menu: **Help -> Register...**
3. **Select Activation Method:** Choose **Activation Code**.
4. **Enter Your License Key:** Copy your allocated license code directly from your BundleByte Vault and paste it into the activation text box.
5. **Confirm Activation:** Click **Activate** to unlock your software!`,
        orderNote: `⚠️ **Important Post-Purchase Guidelines:**
- Authorized for commercial development across up to 2 workstations used by you.
- Do NOT share or distribute this license ticket publicly on forums or GitHub.
- 14-day warranty replacement guarantee included.`,
        activationSteps: [
          { stepNumber: 1, title: 'Download JetBrains IDE or Toolbox', instruction: 'Download the official installer for your OS directly from jetbrains.com/products.' },
          { stepNumber: 2, title: 'Navigate to Registration Dialog', instruction: 'Launch the application and select Help -> Register from the top menu.' },
          { stepNumber: 3, title: 'Paste License Activation Code', instruction: 'Select "Activation Code", copy your key from your vault above, paste it into the code area, and click "Activate".' },
          { stepNumber: 4, title: 'Verify Subscription Status', instruction: 'Confirm the green checkmark appears showing valid commercial entitlement.' },
        ],
        features: [
          'All 16 JetBrains IDEs & Developer Tools included',
          'IntelliJ IDEA Ultimate, PyCharm Professional, WebStorm, GoLand',
          'AI Assistant integrated & perpetual fallback license privilege',
          'Cross-platform support for macOS, Linux, and Windows',
          'Continuous product updates and major version upgrades',
        ],
        specifications: [
          { key: 'Platform', value: 'macOS, Windows, Linux' },
          { key: 'License Type', value: 'Commercial Developer Seat' },
          { key: 'Version', value: 'Latest 2026.x' },
          { key: 'Offline Use', value: 'Supported' },
        ],
        pricing: {
          monthly: { enabled: true, price: 29.99, originalPrice: 39.99 },
          quarterly: { enabled: true, price: 79.99, originalPrice: 109.99 },
          half_yearly: { enabled: true, price: 149.99, originalPrice: 199.99 },
          annual: { enabled: true, price: 249.99, originalPrice: 349.99 },
          lifetime: { enabled: true, price: 699.99, originalPrice: 999.99 },
        },
        defaultDuration: 'annual',
        averageRating: 4.9,
        totalReviews: 84,
        salesCount: 312,
      },
      {
        title: 'Adobe Creative Cloud All Apps',
        slug: 'adobe-creative-cloud-all-apps',
        category: catSubs._id,
        subCategory: 'Design & Multimedia',
        summary: '20+ creative applications including Photoshop, Illustrator, Premiere Pro, After Effects, and 100GB Cloud Storage.',
        description: `Unleash your creative potential with Adobe Creative Cloud All Apps. Get full commercial access to Photoshop, Illustrator, InDesign, Premiere Pro, After Effects, Lightroom, and Adobe Firefly generative AI credits.`,
        logo: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=200&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=1000&auto=format&fit=crop&q=80',
        ],
        tags: ['adobe', 'photoshop', 'illustrator', 'premiere', 'design'],
        isFeatured: true,
        isTrending: true,
        isPopular: true,
        badge: 'POPULAR SUITE',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        features: [
          'Full Creative Cloud Suite (Photoshop, Illustrator, Premiere, After Effects)',
          '1000 Monthly Generative AI Firefly Credits',
          '100 GB High-Speed Adobe Cloud Storage',
          'Adobe Fonts Library with 20,000+ fonts',
          'Simultaneous activation on up to 2 active devices',
        ],
        specifications: [
          { key: 'Platforms', value: 'macOS, Windows, iPad' },
          { key: 'Cloud Storage', value: '100 GB' },
          { key: 'AI Credits', value: '1,000 / month' },
        ],
        pricing: {
          monthly: { enabled: true, price: 34.99, originalPrice: 59.99 },
          quarterly: { enabled: true, price: 89.99, originalPrice: 159.99 },
          half_yearly: { enabled: true, price: 169.99, originalPrice: 299.99 },
          annual: { enabled: true, price: 299.99, originalPrice: 549.99 },
          lifetime: { enabled: false, price: 0, originalPrice: 0 },
        },
        defaultDuration: 'annual',
        averageRating: 4.8,
        totalReviews: 62,
        salesCount: 224,
      },
      {
        title: 'Microsoft 365 Business Standard',
        slug: 'microsoft-365-business-standard',
        category: catSubs._id,
        subCategory: 'Office & Productivity',
        summary: 'Premium desktop and mobile apps: Word, Excel, PowerPoint, Outlook, Teams, plus 1 TB OneDrive cloud storage.',
        description: `Run your enterprise smoothly with Microsoft 365 Business Standard. Access cutting-edge desktop Office applications across PC, Mac, tablets, and phones, together with business-class email hosting (50GB mailbox) and 1TB OneDrive cloud storage.`,
        logo: 'https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1000&auto=format&fit=crop&q=80'],
        tags: ['microsoft', 'office', 'excel', 'word', 'teams', 'onedrive'],
        isFeatured: false,
        isTrending: true,
        isPopular: true,
        badge: 'ENTERPRISE READY',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        features: [
          'Full desktop installations of Word, Excel, PowerPoint, Outlook, and OneNote',
          '1 TB OneDrive secure cloud storage per seat',
          'Microsoft Teams with HD video calls up to 300 participants',
          'Commercial use license on up to 5 phones, 5 tablets, and 5 PCs/Macs',
        ],
        pricing: {
          monthly: { enabled: true, price: 14.99, originalPrice: 19.99 },
          quarterly: { enabled: true, price: 39.99, originalPrice: 54.99 },
          half_yearly: { enabled: true, price: 69.99, originalPrice: 99.99 },
          annual: { enabled: true, price: 119.99, originalPrice: 179.99 },
          lifetime: { enabled: false, price: 0, originalPrice: 0 },
        },
        defaultDuration: 'annual',
        averageRating: 4.7,
        totalReviews: 45,
        salesCount: 180,
      },

      // CATEGORY B: Digital Accounts
      {
        title: 'Google Workspace Enterprise Account',
        slug: 'google-workspace-enterprise-account',
        category: catAccounts._id,
        subCategory: 'Business Cloud Accounts',
        summary: 'Authorized Google Workspace account with unlimited pooled Google Drive storage, Gemini AI features, and Meet recordings.',
        description: `Get an authorized Enterprise-tier Google Workspace account configured on a secure business domain. Enjoy unlimited Google Drive storage, Gemini Advanced AI assistance in Gmail/Docs, and Google Meet meetings up to 500 participants with noise cancellation and recording.`,
        logo: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80'],
        tags: ['google', 'workspace', 'drive', 'gmail', 'enterprise', 'gemini'],
        isFeatured: true,
        isTrending: true,
        isPopular: true,
        badge: 'INSTANT CREDENTIALS',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        deliveryInstructions: 'Your login username, temporary password, and recovery setup steps are revealed in your vault. Change your password on first login.',
        features: [
          'Dedicated enterprise username & password issued instantly',
          'Unlimited Google Drive cloud storage with S3 sync support',
          'Built-in Gemini AI in Gmail, Google Docs, and Sheets',
          'Google Meet with 500 participants + recording & attendance tracking',
          'Advanced DLP and eDiscovery vault compliance',
        ],
        pricing: {
          monthly: { enabled: true, price: 18.99, originalPrice: 30.0 },
          quarterly: { enabled: true, price: 49.99, originalPrice: 85.0 },
          half_yearly: { enabled: true, price: 89.99, originalPrice: 160.0 },
          annual: { enabled: true, price: 159.99, originalPrice: 280.0 },
          lifetime: { enabled: true, price: 349.99, originalPrice: 599.0 },
        },
        defaultDuration: 'annual',
        averageRating: 4.9,
        totalReviews: 38,
        salesCount: 142,
      },
      {
        title: 'Grammarly Premium Business Account',
        slug: 'grammarly-premium-business-account',
        category: catAccounts._id,
        subCategory: 'Writing & AI Tools',
        summary: 'Full Grammarly Business edition with unlimited AI prompts, tone adjustment, plagiarism checker, and team style guides.',
        description: `Elevate your communication with Grammarly Business. Access full tone adjustments, clarity rewrites, full-text plagiarism checks across 16 billion web pages, and 2,000 monthly generative AI prompts.`,
        logo: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1000&auto=format&fit=crop&q=80'],
        tags: ['grammarly', 'writing', 'ai', 'productivity', 'english'],
        isFeatured: false,
        isTrending: false,
        isPopular: true,
        badge: 'VERIFIED ACCOUNT',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        features: [
          'Full-sentence rewrites & advanced fluency corrections',
          'Plagiarism detection across billions of web pages',
          '2,000 GenAI writing prompts per month',
          'Integrates into Word, Google Docs, Chrome, and Slack',
        ],
        pricing: {
          monthly: { enabled: true, price: 9.99, originalPrice: 15.0 },
          quarterly: { enabled: true, price: 24.99, originalPrice: 40.0 },
          half_yearly: { enabled: true, price: 44.99, originalPrice: 75.0 },
          annual: { enabled: true, price: 79.99, originalPrice: 140.0 },
          lifetime: { enabled: true, price: 189.99, originalPrice: 320.0 },
        },
        defaultDuration: 'annual',
        averageRating: 4.8,
        totalReviews: 29,
        salesCount: 95,
      },
      {
        title: 'Canva Pro Master Team Account',
        slug: 'canva-pro-master-team-account',
        category: catAccounts._id,
        subCategory: 'Graphic Design',
        summary: 'Authorized Canva Pro account with 100M+ premium stock assets, Magic Studio AI, and background remover.',
        description: `Create stunning social media graphics, presentations, videos, and marketing collateral in seconds. Includes 100M+ photos, videos, and graphics, 3,000+ fonts, Magic Resize, and Magic Eraser.`,
        logo: 'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?w=200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1000&auto=format&fit=crop&q=80'],
        tags: ['canva', 'design', 'social-media', 'graphics', 'ai'],
        isFeatured: false,
        isTrending: true,
        isPopular: true,
        badge: 'UNLIMITED ASSETS',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        features: [
          '100M+ premium stock photos, videos, audio, and graphics',
          'One-click Background Remover for images & videos',
          'Magic Switch & Magic Expand AI tools',
          '1 TB Cloud Storage for designs and media assets',
        ],
        pricing: {
          monthly: { enabled: true, price: 8.99, originalPrice: 14.99 },
          quarterly: { enabled: true, price: 22.99, originalPrice: 39.99 },
          half_yearly: { enabled: true, price: 39.99, originalPrice: 69.99 },
          annual: { enabled: true, price: 69.99, originalPrice: 119.99 },
          lifetime: { enabled: true, price: 149.99, originalPrice: 249.99 },
        },
        defaultDuration: 'annual',
        averageRating: 4.9,
        totalReviews: 51,
        salesCount: 167,
      },

      // CATEGORY C: Software Access Links
      {
        title: 'Claude Team & GPT-4o Enterprise Workspace Invitation Link',
        slug: 'claude-team-gpt4o-enterprise-workspace-link',
        category: catLinks._id,
        subCategory: 'AI & Machine Learning',
        summary: 'Direct single-click invitation link to join an Enterprise Workspace with Claude 3.5 Sonnet, GPT-4o, and unlimited context windows.',
        description: `Gain instant access to top-tier AI models through an authorized corporate workspace. Enjoy 200K token context windows, dedicated Claude Artifacts collaboration, GPT-4o high-throughput multimodal reasoning, and team shared project knowledge bases with zero training on your data.`,
        logo: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=200&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1684369175833-4b445ad6bfb5?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80',
        ],
        tags: ['claude', 'gpt4', 'chatgpt', 'openai', 'anthropic', 'ai-workspace'],
        isFeatured: true,
        isTrending: true,
        isPopular: true,
        isSpecialOffer: true,
        badge: 'HOT AI DEAL',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        defaultAccessLink: 'https://bundlebyte.com/access/claude-enterprise-invitation',
        deliveryInstructions: 'Click the unique invite link generated in your vault to join the enterprise workspace with your existing email address. No credentials required.',
        features: [
          'Direct invitation link delivered instantly into your dashboard',
          'Full access to Claude 3.5 Sonnet, Opus, and GPT-4o',
          'High rate limits (5x standard individual accounts)',
          'Artifacts interactive code previewing & project spaces',
          'Strict enterprise privacy: your prompts are never trained on',
        ],
        pricing: {
          monthly: { enabled: true, price: 24.99, originalPrice: 35.0 },
          quarterly: { enabled: true, price: 64.99, originalPrice: 99.0 },
          half_yearly: { enabled: true, price: 119.99, originalPrice: 189.0 },
          annual: { enabled: true, price: 199.99, originalPrice: 320.0 },
          lifetime: { enabled: false, price: 0, originalPrice: 0 },
        },
        defaultDuration: 'annual',
        averageRating: 5.0,
        totalReviews: 92,
        salesCount: 388,
      },
      {
        title: 'Notion Enterprise AI Direct Workspace Link',
        slug: 'notion-enterprise-ai-direct-workspace-link',
        category: catLinks._id,
        subCategory: 'Knowledge & Collaboration',
        summary: 'Instant activation link into a Notion Enterprise Workspace with unlimited Notion AI Q&A, unlimited page history, and SSO.',
        description: `Supercharge company wikis, roadmaps, and personal productivity with Notion Enterprise + Notion AI. Query your entire workspace knowledge base, generate meeting summaries, auto-populate database properties, and enjoy unlimited storage with 99.9% uptime SLA.`,
        logo: 'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1000&auto=format&fit=crop&q=80'],
        tags: ['notion', 'notes', 'enterprise', 'workspace', 'productivity'],
        isFeatured: false,
        isTrending: true,
        isPopular: true,
        badge: 'INSTANT INVITE',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        defaultAccessLink: 'https://bundlebyte.com/access/notion-workspace-invitation',
        features: [
          'Direct workspace invitation link delivered to your vault',
          'Unlimited Notion AI queries and document summarization',
          'Unlimited page history and file upload size',
          'Collaborative real-time editing with custom permission controls',
        ],
        pricing: {
          monthly: { enabled: true, price: 12.99, originalPrice: 20.0 },
          quarterly: { enabled: true, price: 34.99, originalPrice: 55.0 },
          half_yearly: { enabled: true, price: 62.99, originalPrice: 99.0 },
          annual: { enabled: true, price: 109.99, originalPrice: 180.0 },
          lifetime: { enabled: true, price: 279.99, originalPrice: 450.0 },
        },
        defaultDuration: 'annual',
        averageRating: 4.8,
        totalReviews: 31,
        salesCount: 110,
      },

      // CATEGORY D: Digital Licenses
      {
        title: 'Windows 11 Professional Retail Activation Key',
        slug: 'windows-11-professional-retail-activation-key',
        category: catLicenses._id,
        subCategory: 'Operating Systems',
        summary: '100% Genuine 25-digit retail digital license key with lifetime perpetual activation, BitLocker encryption, and Remote Desktop.',
        description: `Activate Windows 11 Professional permanently with a genuine Microsoft digital retail key. Supports 32/64-bit architectures, multilingual worldwide activation, and full access to BitLocker drive encryption, Hyper-V virtualization, Windows Sandbox, and Windows Update.`,
        logo: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=200&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1588702547919-26089e690ecc?w=1000&auto=format&fit=crop&q=80',
        ],
        tags: ['windows', 'microsoft', 'os', 'license-key', 'windows-11', 'pc'],
        isFeatured: true,
        isTrending: true,
        isPopular: true,
        isSpecialOffer: true,
        badge: 'LIFETIME LICENSE',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        deliveryInstructions: 'Your 25-digit activation key (XXXXX-XXXXX-XXXXX-XXXXX-XXXXX) is ready in your vault. Go to Settings > System > Activation > Change Product Key to activate.',
        features: [
          'Genuine Microsoft 25-character digital retail license',
          'Perpetual lifetime activation for 1 PC (reinstallations supported)',
          'BitLocker drive encryption and Windows Information Protection',
          'Remote Desktop Server & Hyper-V Virtualization built-in',
          'Global online activation directly through Microsoft servers',
        ],
        specifications: [
          { key: 'Activation Type', value: 'Retail Digital License' },
          { key: 'Architecture', value: '64-bit / 32-bit' },
          { key: 'Validity', value: 'Perpetual Lifetime' },
          { key: 'Region', value: 'Worldwide' },
        ],
        pricing: {
          monthly: { enabled: false, price: 0, originalPrice: 0 },
          quarterly: { enabled: false, price: 0, originalPrice: 0 },
          half_yearly: { enabled: false, price: 0, originalPrice: 0 },
          annual: { enabled: false, price: 0, originalPrice: 0 },
          lifetime: { enabled: true, price: 39.99, originalPrice: 199.99 },
        },
        defaultDuration: 'lifetime',
        averageRating: 4.9,
        totalReviews: 120,
        salesCount: 540,
      },
      {
        title: 'Docker Desktop Pro Commercial License Key',
        slug: 'docker-desktop-pro-commercial-license-key',
        category: catLicenses._id,
        subCategory: 'DevOps & Containers',
        summary: 'Commercial use license key for Docker Desktop. Unlimited Docker Scout vulnerability checks and 5 private repositories.',
        description: `Stay compliant with Docker commercial terms for enterprises and business developers. Unlock Docker Desktop Pro with unlimited local development, Docker Scout image security scanning, 5 private Hub repositories, and priority technical support.`,
        logo: 'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=200&auto=format&fit=crop&q=80',
        images: ['https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=1000&auto=format&fit=crop&q=80'],
        tags: ['docker', 'containers', 'devops', 'developer', 'linux', 'kubernetes'],
        isFeatured: false,
        isTrending: false,
        isPopular: true,
        badge: 'BUSINESS COMPLIANT',
        deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
        deliveryInstructions: 'Copy your commercial license string from your vault and paste it in Docker Desktop > Settings > Licenses.',
        features: [
          'Full legal compliance for commercial corporate development',
          'Docker Scout automated vulnerability image scanning',
          '5 private Docker Hub repositories included',
          'High parallel pull/push rate limits',
        ],
        pricing: {
          monthly: { enabled: true, price: 11.99, originalPrice: 18.0 },
          quarterly: { enabled: true, price: 29.99, originalPrice: 45.0 },
          half_yearly: { enabled: true, price: 54.99, originalPrice: 85.0 },
          annual: { enabled: true, price: 99.99, originalPrice: 150.0 },
          lifetime: { enabled: false, price: 0, originalPrice: 0 },
        },
        defaultDuration: 'annual',
        averageRating: 4.8,
        totalReviews: 24,
        salesCount: 78,
      },

      // CATEGORY E: WhatsApp Concierge VIP Tools
      {
        title: 'WhatsApp Concierge VIP Tool',
        slug: 'whatsapp-concierge-vip-tool',
        category: catAccounts._id,
        subCategory: 'VIP Concierge Software',
        summary: 'Exclusive software delivered manually via WhatsApp concierge with verified access credentials and dedicated VIP support.',
        description: 'Experience hands-on fulfillment with our WhatsApp Concierge VIP Tool. After checkout, connect directly with our dedicated concierge support on WhatsApp. Our team will verify and provision your custom VIP access credentials, setup keys, and enterprise environment in real-time.',
        logo: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=200&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000&auto=format&fit=crop&q=80',
        ],
        tags: ['whatsapp', 'concierge', 'vip', 'software', 'manual-delivery', 'custom-provisioning'],
        isFeatured: true,
        isTrending: true,
        isPopular: true,
        isSpecialOffer: true,
        badge: 'WHATSAPP VIP',
        deliveryType: 'whatsapp_manual',
        deliveryMethod: 'whatsapp_manual',
        whatsappConfig: {
          businessPhone: '+91 98765 43210',
          messageTemplate: 'Hello Concierge! I purchased Order #{orderId} for {productTitle}. Please deliver credentials.',
          instructions: 'Click the button below to message our concierge team directly on WhatsApp.',
          buttonText: 'Contact Concierge on WhatsApp',
          expectedDeliveryTime: '15-30 minutes',
        },
        deliveryInstructions: 'Click the Contact Concierge button in your dashboard or order receipt to open a secure WhatsApp chat with our fulfillment team.',
        refundPolicy: 'Full money-back guarantee or replacement within 14 days if credentials fail to activate.',
        features: [
          'Direct 1-on-1 human concierge assistance on WhatsApp',
          'Manual credential verification and custom domain provisioning',
          '15-30 minute typical delivery turnaround',
          'Priority VIP support channel available 24/7',
          'Complete guided setup assistance for your enterprise team',
        ],
        pricing: {
          monthly: { enabled: true, price: 19.99, originalPrice: 39.99 },
          quarterly: { enabled: true, price: 49.99, originalPrice: 89.99 },
          half_yearly: { enabled: true, price: 79.99, originalPrice: 149.99 },
          annual: { enabled: true, price: 99.00, originalPrice: 199.00 },
          lifetime: { enabled: true, price: 249.99, originalPrice: 499.00 },
        },
        defaultDuration: 'annual',
        status: 'active',
        averageRating: 5.0,
        totalReviews: 18,
        salesCount: 65,
      },
      {
        title: 'WhatsApp Concierge VIP Tool 1793971843231',
        slug: 'whatsapp-concierge-vip-tool-1793971843231',
        category: catAccounts._id,
        subCategory: 'VIP Concierge Software',
        summary: 'Exclusive software delivered manually via WhatsApp concierge with verified access credentials and dedicated VIP support.',
        description: 'Full description of VIP concierge tool with instant WhatsApp fulfillment and verified access credentials.',
        logo: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=200&auto=format&fit=crop&q=80',
        images: [
          'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
        ],
        tags: ['whatsapp', 'concierge', 'vip', 'software', 'manual-delivery'],
        isFeatured: false,
        isTrending: false,
        isPopular: true,
        badge: 'WHATSAPP VIP',
        deliveryType: 'whatsapp_manual',
        deliveryMethod: 'whatsapp_manual',
        whatsappConfig: {
          businessPhone: '+91 98765 43210',
          messageTemplate: 'Hello Concierge! I purchased Order #{orderId} for {productTitle}. Please deliver credentials.',
          instructions: 'Click the button below to message our concierge team directly on WhatsApp.',
          buttonText: 'Contact Concierge on WhatsApp',
          expectedDeliveryTime: '15-30 minutes',
        },
        deliveryInstructions: 'Click the Contact Concierge button in your dashboard or order receipt to open a secure WhatsApp chat with our fulfillment team.',
        pricing: {
          monthly: { enabled: true, price: 19.99, originalPrice: 39.99 },
          quarterly: { enabled: true, price: 49.99, originalPrice: 89.99 },
          half_yearly: { enabled: true, price: 79.99, originalPrice: 149.99 },
          annual: { enabled: true, price: 99.00, originalPrice: 199.00 },
          lifetime: { enabled: true, price: 249.99, originalPrice: 499.00 },
        },
        defaultDuration: 'annual',
        status: 'active',
        averageRating: 5.0,
        totalReviews: 12,
        salesCount: 42,
      },
    ];

    const products = await Product.insertMany(productsData);
    console.log(`📦 Seeded ${products.length} Products with multi-duration pricing`);

    // 4. Pre-populate License Inventory pool with 5 statuses
    const inventoryKeys = [
      // Windows 11 keys - Available
      {
        product: products[7]._id,
        durationType: 'lifetime',
        licenseKey: 'W269N-WFGWX-YVC9B-4J6C9-T83GX',
        status: 'Available',
        batchTag: 'MS-WIN11-BATCH-1',
        adminNotes: 'Official Microsoft Windows 11 Pro Retail Batch 1',
        isAllocated: false,
      },
      {
        product: products[7]._id,
        durationType: 'lifetime',
        licenseKey: 'VK7JG-NPHTM-C97JM-9MPGT-3V66T',
        status: 'Available',
        batchTag: 'MS-WIN11-BATCH-1',
        adminNotes: 'Official Microsoft Windows 11 Pro Retail Batch 1',
        isAllocated: false,
      },
      {
        product: products[7]._id,
        durationType: 'lifetime',
        licenseKey: 'NRG8B-VKK3Q-CXVCJ-9G2XF-6Q84J',
        status: 'Reserved',
        batchTag: 'MS-WIN11-BATCH-2',
        adminNotes: 'Reserved for VIP Client renewal',
        isAllocated: false,
      },
      {
        product: products[7]._id,
        durationType: 'lifetime',
        licenseKey: 'SOLD-WIN11-DEMO-9912-8823',
        status: 'Sold',
        batchTag: 'MS-WIN11-BATCH-0',
        allocatedToUser: customer._id,
        adminNotes: 'Delivered in historical order',
        isAllocated: true,
      },
      {
        product: products[7]._id,
        durationType: 'lifetime',
        licenseKey: 'DIS-WIN11-DEFECTIVE-KEY-001',
        status: 'Disabled',
        batchTag: 'MS-WIN11-BATCH-0',
        adminNotes: 'Defective key flagged during vendor audit',
        isAllocated: false,
      },
      {
        product: products[7]._id,
        durationType: 'lifetime',
        licenseKey: 'EXP-WIN11-TRIAL-30DAYS-99',
        status: 'Expired',
        batchTag: 'MS-WIN11-TRIAL',
        expiryDate: new Date('2025-01-01'),
        adminNotes: 'Promotional OEM trial license expired',
        isAllocated: false,
      },
      // JetBrains keys
      {
        product: products[0]._id,
        durationType: 'annual',
        licenseKey: 'JB-ALLPROD-2026-X8912-KLP90-M718',
        status: 'Available',
        batchTag: 'JB-COMMERCIAL-2026',
        adminNotes: 'JetBrains Commercial Seat Pool A',
        isAllocated: false,
      },
      {
        product: products[0]._id,
        durationType: 'monthly',
        licenseKey: 'JB-ALLPROD-2026-M4419-QRT55-V102',
        status: 'Available',
        batchTag: 'JB-MONTHLY-2026',
        adminNotes: 'JetBrains Monthly Pool',
        isAllocated: false,
      },
      // Google Workspace accounts
      {
        product: products[3]._id,
        durationType: 'annual',
        licenseKey: 'GW-ENTERPRISE-ACCT-9912',
        status: 'Available',
        accountCredentials: {
          username: 'user.john.enterprise@cloudsuite-auth.com',
          password: 'TmpPassword!2026#Secure',
          recoveryInfo: 'recovery-support@bundlebyte.com',
        },
        accessLink: 'https://accounts.google.com/signin',
        batchTag: 'GW-ACCT-BATCH-1',
        adminNotes: 'Pre-provisioned Workspace seats',
        isAllocated: false,
      },
      // Claude link
      {
        product: products[5]._id,
        durationType: 'annual',
        accessLink: 'https://claude.ai/enterprise/invite/join?token=bb_corp_ai_9941a8fe',
        licenseKey: 'CLAUDE-ENT-2026-VIP-9941',
        status: 'Available',
        batchTag: 'CLAUDE-ENT-BATCH-1',
        adminNotes: 'Enterprise invite seat',
        isAllocated: false,
      },
    ];

    await LicenseInventory.insertMany(inventoryKeys);
    console.log('🔑 Populated License Inventory Key Pool');

    // 5. Create Active Seed Order, Subscription, and Digital Delivery for Demo Customer
    const sampleOrderNumber = 'BB-2026-10492';
    const sampleOrder = await Order.create({
      orderNumber: sampleOrderNumber,
      user: customer._id,
      customerEmail: customer.email,
      customerName: customer.name,
      items: [
        {
          product: products[0]._id,
          productTitle: products[0].title,
          productLogo: products[0].logo,
          productCategoryName: 'Software Subscriptions',
          duration: 'annual',
          unitPrice: 249.99,
          quantity: 1,
          totalPrice: 249.99,
          deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
          deliveryStatus: 'delivered',
        },
        {
          product: products[7]._id,
          productTitle: products[7].title,
          productLogo: products[7].logo,
          productCategoryName: 'Digital Licenses',
          duration: 'lifetime',
          unitPrice: 39.99,
          quantity: 1,
          totalPrice: 39.99,
          deliveryType: 'instant_automated',
        setupGuideUrl: 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html',
        defaultAccessLink: 'https://creativecloud.adobe.com',
        activationProcess: `### Step-by-Step Adobe Creative Cloud All Apps Activation:
1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.
2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.
3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.
4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded to Creative Cloud All Apps with 100GB Cloud Storage and Firefly AI credits.
5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps and install Photoshop, Illustrator, Premiere Pro, etc.`,
        orderNote: `⚠️ **Adobe Licensing & Warranty Rules:**
- The redemption code must be redeemed within 30 days of purchase.
- You can install and activate applications on up to 2 machines (e.g. Work PC and Laptop).
- Full 14-day replacement warranty in case of invalid or duplicate redemption codes.`,
        activationSteps: [
          { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
          { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
          { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
        ],
          deliveryStatus: 'delivered',
        },
      ],
      subtotal: 289.98,
      discount: 20.0,
      couponCode: 'WELCOME20',
      taxAmount: 0.0,
      totalAmount: 269.98,
      paymentMethod: 'binance',
      paymentStatus: 'paid',
      orderStatus: 'completed',
      deliveryStatus: 'delivered',
      paymentDetails: {
        transactionId: '0x8f2d5c3b1a9e7f4d2c8b0a3f6e1d9c4b7a2e5f8d1c3b6a9e2f5d8b1a4c7e0f3',
        gateway: 'binance',
        paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      billingAddress: customer.billingAddress,
    });

    // Deliveries for the customer's sample order
    const deliveryJetbrains = await DigitalDelivery.create({
      order: sampleOrder._id,
      user: customer._id,
      product: products[0]._id,
      productTitle: products[0].title,
      productLogo: products[0].logo,
      duration: 'annual',
      deliveryType: 'instant_automated',
      status: 'delivered',
      payload: {
        licenseKey: 'JB-ALLPROD-COMMERCIAL-9901-7721-AC12',
        instructions: products[0].deliveryInstructions,
        directDownloadUrl: 'https://www.jetbrains.com/toolbox-app/',
      },
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    const deliveryWin11 = await DigitalDelivery.create({
      order: sampleOrder._id,
      user: customer._id,
      product: products[7]._id,
      productTitle: products[7].title,
      productLogo: products[7].logo,
      duration: 'lifetime',
      deliveryType: 'instant_automated',
      status: 'delivered',
      payload: {
        licenseKey: 'W269N-WFGWX-YVC9B-4J6C9-T83GX',
        instructions: products[7].deliveryInstructions,
      },
      deliveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });

    // Subscriptions for the customer
    const jetbrainsEnd = new Date();
    jetbrainsEnd.setFullYear(jetbrainsEnd.getFullYear() + 1);

    await Subscription.create({
      user: customer._id,
      product: products[0]._id,
      productTitle: products[0].title,
      productLogo: products[0].logo,
      order: sampleOrder._id,
      duration: 'annual',
      billingCyclePrice: 249.99,
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: jetbrainsEnd,
      isLifetime: false,
      status: 'active',
    });

    const win11End = new Date();
    win11End.setFullYear(win11End.getFullYear() + 100);

    await Subscription.create({
      user: customer._id,
      product: products[7]._id,
      productTitle: products[7].title,
      productLogo: products[7].logo,
      order: sampleOrder._id,
      duration: 'lifetime',
      billingCyclePrice: 39.99,
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: win11End,
      isLifetime: true,
      status: 'active',
    });

    // 5b. Create Order in MANUAL DELIVERY QUEUE for Admin Queue testing
    const manualOrder = await Order.create({
      orderNumber: 'BB-2026-99014',
      user: customer._id,
      customerEmail: customer.email,
      customerName: customer.name,
      items: [
        {
          product: products[3]._id,
          productTitle: products[3].title,
          productLogo: products[3].logo,
          productCategoryName: 'Digital Accounts',
          duration: 'annual',
          unitPrice: 159.99,
          quantity: 1,
          totalPrice: 159.99,
          deliveryType: 'admin_assisted',
          deliveryMethod: 'manual',
          deliveryStatus: 'manual_queue',
        },
      ],
      subtotal: 159.99,
      discount: 0,
      taxAmount: 0,
      totalAmount: 159.99,
      currency: 'INR',
      paymentMethod: 'wallet',
      walletAmountUsed: 159.99,
      walletAmountPaise: 15999,
      gatewayAmountPaid: 0,
      paymentStatus: 'paid',
      orderStatus: 'processing',
      deliveryStatus: 'manual_queue',
      paymentDetails: {
        transactionId: 'WAL-INIT-99014',
        gateway: 'wallet',
        paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      billingAddress: customer.billingAddress,
    });

    await DeliveryHistory.create({
      order: manualOrder._id,
      product: products[3]._id,
      user: customer._id,
      customer: customer._id,
      orderItemIndex: 0,
      action: 'manual_queued',
      event: 'manual_queued',
      deliveryMethod: 'manual',
      auditNotes: 'High-touch enterprise account purchase placed into manual provisioning queue.',
    });

    // 5c. Create Customer Wallet & Initial Immutable Ledger
    const customerWallet = await Wallet.create({
      user: customer._id,
      balance: 250000, // ₹2,500.00 stored in integer paise
      totalAdded: 500000, // ₹5,000.00
      totalSpent: 260000, // ₹2,600.00
      totalCashback: 10000, // ₹100.00
      currency: 'INR',
      isActive: true,
    });

    await WalletTransaction.insertMany([
      {
        transactionId: 'WTX-TOPUP-INIT-101',
        wallet: customerWallet._id,
        user: customer._id,
        type: 'topup',
        amount: 500000, // ₹5,000 in paise
        previousBalance: 0,
        newBalance: 500000,
        description: 'Initial Wallet Top-Up via Payment Gateway',
        status: 'completed',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        transactionId: 'WTX-PURCHASE-102',
        wallet: customerWallet._id,
        user: customer._id,
        type: 'purchase',
        amount: 260000, // ₹2,600 in paise
        previousBalance: 500000,
        newBalance: 240000,
        relatedOrder: sampleOrder._id,
        description: `Purchase deduction for Order #${sampleOrderNumber}`,
        status: 'completed',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        transactionId: 'CBK-PROMO-103',
        wallet: customerWallet._id,
        user: customer._id,
        type: 'cashback',
        amount: 10000, // ₹100 in paise
        previousBalance: 240000,
        newBalance: 250000,
        relatedOrder: sampleOrder._id,
        description: 'Promotional 5% Marketplace Cashback Credited',
        status: 'completed',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ]);
    console.log('💰 Created Customer Wallet (₹2,500.00) & Initial Ledger Records');

    console.log('💳 Created Sample Order & Active Subscription in Customer Vault');

    // 6. Create Coupons
    await Coupon.insertMany([
      {
        code: 'WELCOME20',
        description: '20% off your first order on any software or subscription (up to $50 off)',
        discountType: 'percentage',
        discountValue: 20,
        maxDiscountAmount: 50,
        minOrderAmount: 20,
        expiryDate: new Date('2028-12-31'),
        isActive: true,
      },
      {
        code: 'SAVE10',
        description: '10% instant discount across all catalog items',
        discountType: 'percentage',
        discountValue: 10,
        maxDiscountAmount: 30,
        minOrderAmount: 15,
        expiryDate: new Date('2028-12-31'),
        isActive: true,
      },
      {
        code: 'LIFETIME50',
        description: '$50 off any lifetime perpetual license or annual subscription over $200',
        discountType: 'fixed',
        discountValue: 50,
        minOrderAmount: 200,
        expiryDate: new Date('2028-12-31'),
        isActive: true,
      },
    ]);
    console.log('🎟️ Created Discount Coupons: WELCOME20, SAVE10, LIFETIME50');

    // 7. Create Reviews
    await Review.insertMany([
      {
        product: products[0]._id,
        user: customer._id,
        userName: 'John Doe',
        rating: 5,
        title: 'Instant activation code received in seconds!',
        comment: 'I was hesitant at first, but immediately after mock payment my JetBrains offline activation key appeared right on the screen. Entered it into PyCharm and it unlocked instantly. Incredible service!',
        isVerifiedPurchase: true,
        status: 'approved',
      },
      {
        product: products[7]._id,
        user: customer._id,
        userName: 'Alex Rivers',
        rating: 5,
        title: 'Windows 11 activated on the first try',
        comment: 'Upgraded my custom PC from Home to Pro. Key registered online directly with Microsoft in 5 seconds. Will buy all my software here.',
        isVerifiedPurchase: true,
        status: 'approved',
      },
      {
        product: products[5]._id,
        user: customer._id,
        userName: 'DevOps Lead',
        rating: 5,
        title: 'Huge upgrade for our engineering team',
        comment: 'The workspace invitation link worked flawlessly. Having uninterrupted access to Claude 3.5 Sonnet and GPT-4o with high limits is worth every penny.',
        isVerifiedPurchase: true,
        status: 'approved',
      },
    ]);
    console.log('⭐ Created Verified Customer Reviews');

    // 8. Create Support Ticket
    await SupportTicket.create({
      ticketNumber: 'TKT-89102',
      user: customer._id,
      subject: 'Inquiry regarding multi-device setup for JetBrains suite',
      category: 'License Key Problem',
      priority: 'normal',
      status: 'resolved',
      messages: [
        {
          sender: customer._id,
          senderRole: 'customer',
          senderName: customer.name,
          message: 'Hi team, can I use my JetBrains license key on both my MacBook and desktop PC simultaneously as long as only I am using them?',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          sender: admin._id,
          senderRole: 'admin',
          senderName: 'BundleByte Support',
          message: 'Hello John! Yes, absolutely. Under JetBrains commercial developer terms, a single named user can activate their license across multiple devices (e.g. work laptop and home desktop) as long as you are the sole person working on the IDEs.',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    // 9. Website Setting
    await WebsiteSetting.create({
      siteName: 'BundleByte',
      siteTagline: 'Premium Software Subscriptions & Digital Licenses',
      supportEmail: 'support@bundlebyte.com',
      announcement: {
        enabled: true,
        text: '⚡ Flash Sale: Use code WELCOME20 for 20% off all software subscriptions & digital licenses!',
        link: '/products',
        badge: 'LIMITED OFFER',
      },
      taxRatePercent: 0,
      currency: 'USD',
      gateways: {
        mock: { enabled: false, name: 'Instant Test Checkout (Disabled)' },
        stripe: { enabled: true, publishableKey: 'pk_test_sample' },
        paypal: { enabled: false, clientId: 'sb' },
        binance: {
          enabled: true,
          name: 'Binance USDT (TRC20 / BEP20)',
          apiKey: '',
          apiSecret: '',
          depositAddress: 'TLR7Vw3G1uK4K4U5w6q7N9x8yZ2A1B3C4D',
          network: 'TRX',
          autoVerifyEnabled: true,
          minDepositUsdt: 1,
          usdtToUsdRate: 1.0,
          usdtToInrRate: 86.5,
        },
        upi: {
          enabled: true,
          name: 'UPI / QR Code Transfer',
          upiId: 'bundlebyte@icici',
          merchantName: 'BundleByte Technologies Inc.',
          qrCodeUrl: '',
          autoApproveTrusted: true,
        },
      },
    });

    // 10. Sample Trusted Bank Settlement Records for instant automated UTR testing
    const TrustedPaymentRecord = (await import('../models/TrustedPaymentRecord.js')).default;
    await TrustedPaymentRecord.deleteMany();
    await TrustedPaymentRecord.insertMany([
      {
        paymentType: 'upi_utr',
        transactionId: '412345678901',
        amount: 8563, // ₹8,563.50 test order
        currency: 'INR',
        senderName: 'John Doe',
        senderVpaOrAddress: 'johndoe@okaxis',
        status: 'credited',
        isClaimed: false,
      },
      {
        paymentType: 'upi_utr',
        transactionId: '498765432109',
        amount: 1000,
        currency: 'INR',
        senderName: 'VIP Customer',
        senderVpaOrAddress: 'vipbuyer@upi',
        status: 'credited',
        isClaimed: false,
      },
    ]);
    console.log('🏦 Populated Initial Trusted UPI Bank Settlement Ledger');

    // 11. Seed Paytm Merchants & Multi-Merchant Routing
    const PaytmMerchant = (await import('../models/PaytmMerchant.js')).default;
    const MerchantRoutingConfig = (await import('../models/MerchantRoutingConfig.js')).default;
    const { encryptCredential } = await import('../utils/credentialEncryption.js');

    await PaytmMerchant.deleteMany();
    await MerchantRoutingConfig.deleteMany();

    const merchantA = await PaytmMerchant.create({
      merchantName: 'BundleByte Payments Ltd.',
      mid: 'BUNDLEBYTEPROD01',
      merchantKey: encryptCredential('SamplePaytmMerchantSecretKey2026A'),
      upiId: 'bundlebyte@paytm',
      websiteName: 'DEFAULT',
      industryType: 'Retail',
      channelId: 'WEB',
      environment: 'production',
      status: 'active',
      priority: 1,
      minAmount: 1,
      maxAmount: 100000,
      dailyLimit: 200000,
      currentDailyVolume: 0,
      notes: 'Primary High-Volume Merchant Account',
    });

    const merchantB = await PaytmMerchant.create({
      merchantName: 'ByteTech Digital Solutions',
      mid: 'BYTETECHDIGITAL02',
      merchantKey: encryptCredential('SamplePaytmMerchantSecretKey2026B'),
      upiId: 'bytetech@icici',
      websiteName: 'DEFAULT',
      industryType: 'Retail',
      channelId: 'WEB',
      environment: 'production',
      status: 'active',
      priority: 2,
      minAmount: 1,
      maxAmount: 50000,
      dailyLimit: 100000,
      currentDailyVolume: 0,
      notes: 'Secondary / Tier-2 Failover Merchant Account',
    });

    await MerchantRoutingConfig.create({
      routingStrategy: 'round_robin',
      manualMerchant: merchantA._id,
      enableAutomaticFailover: true,
      amountBrackets: [
        { min: 1, max: 2000, merchant: merchantA._id, label: 'Standard Orders (<₹2,000)' },
        { min: 2001, max: 100000, merchant: merchantB._id, label: 'High-Value Orders (₹2,000+)' },
      ],
      failoverOrder: [merchantA._id, merchantB._id],
    });
    console.log('💳 Seeded Multi-Merchant Paytm Accounts & Routing Configuration');

    console.log('⚙️ Initialized Website Settings & Announcements');

    // Initialize RBAC System Roles & Departments
    await rbacService.seedSystemRolesAndDepartments();

    // Map Staff Users to TeamMember records
    const supportRole = await TeamRole.findOne({ slug: 'support_manager' });
    const financeRole = await TeamRole.findOne({ slug: 'finance_manager' });
    const opsRole = await TeamRole.findOne({ slug: 'operations_manager' });

    const supportDept = await Department.findOne({ slug: 'customer_support' });
    const financeDept = await Department.findOne({ slug: 'finance' });
    const opsDept = await Department.findOne({ slug: 'operations' });

    if (supportDept && staffSupport) {
      supportDept.manager = staffSupport._id;
      await supportDept.save();
    }
    if (financeDept && staffFinance) {
      financeDept.manager = staffFinance._id;
      await financeDept.save();
    }
    if (opsDept && staffOps) {
      opsDept.manager = staffOps._id;
      await opsDept.save();
    }

    await TeamMember.create([
      {
        user: staffSupport._id,
        employeeCode: 'BB-EMP-002',
        jobTitle: 'Head of Customer Support',
        department: supportDept?._id,
        roles: supportRole ? [supportRole._id] : [],
        status: 'active',
        reportingManager: admin._id,
      },
      {
        user: staffFinance._id,
        employeeCode: 'BB-EMP-003',
        jobTitle: 'VP of Finance & Treasury',
        department: financeDept?._id,
        roles: financeRole ? [financeRole._id] : [],
        status: 'active',
        reportingManager: admin._id,
      },
      {
        user: staffOps._id,
        employeeCode: 'BB-EMP-004',
        jobTitle: 'Director of Digital Operations',
        department: opsDept?._id,
        roles: opsRole ? [opsRole._id] : [],
        status: 'active',
        reportingManager: admin._id,
      },
    ]);

    // Create a sample Pending Invitation
    const productRole = await TeamRole.findOne({ slug: 'product_manager' });
    const devDept = await Department.findOne({ slug: 'development' });
    if (productRole) {
      await TeamInvitation.create({
        email: 'alex.product@bundlebyte.com',
        name: 'Alex Product Lead',
        role: productRole._id,
        department: devDept?._id,
        jobTitle: 'Principal Product Manager',
        tokenHash: 'sample_invite_token_hash_dev',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        invitedBy: admin._id,
      });
    }

    // Create a sample High-Value Pending Approval Request
    await ApprovalRequest.create({
      workflowType: 'refund_threshold',
      title: 'High-Value Enterprise Refund Authorization',
      description: 'Customer requested full refund on Enterprise Tier Suite after licensing conflict',
      requester: staffSupport._id,
      amount: 650,
      currency: 'USD',
      targetEntity: 'Refund',
      targetId: 'REF-78901',
      payload: { reason: 'Licensing incompatibility', customerEmail: 'enterprise@acme.corp' },
      status: 'pending',
    });

    console.log('🛡️ Seeded Enterprise RBAC Team Members, Departments, Invitations & Approvals');
    console.log('✅ DATABASE SEED COMPLETED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

// If run directly via node src/seeds/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    await connectDB();
    await seedDatabase();
    await disconnectDB();
    process.exit(0);
  })();
}
