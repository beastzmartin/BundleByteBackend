import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/db.js';
import Product from '../models/Product.js';

dotenv.config();

const enrichmentMap = {
  'jetbrains-all-products-pack': {
    setupGuideUrl: 'https://www.jetbrains.com/help/idea/register.html',
    defaultAccessLink: 'https://account.jetbrains.com',
    activationProcess: `### Step-by-Step JetBrains All Products Pack Activation:
1. **Download & Install:** Download the official JetBrains Toolbox App or standalone IDE (IntelliJ IDEA Ultimate, PyCharm Pro, WebStorm, etc.) from https://www.jetbrains.com/products.
2. **Launch IDE:** Open your installed IDE and navigate to the top menu: **Help -> Register...** (or click 'Activate License' on the splash screen).
3. **Select Activation Method:** Choose **Activation Code** (Offline License Ticket).
4. **Enter Your License Key:** Copy your allocated license code directly from your BundleByte Vault and paste it into the activation text box.
5. **Confirm Activation:** Click **Activate**. A green checkmark stating "Subscribed until..." will appear.
6. **Toolbox Sync (Optional):** If using JetBrains Toolbox, apply the activation ticket under Settings -> Licenses to automatically license all installed IDEs at once.`,
    orderNote: `⚠️ **Important Post-Purchase Guidelines:**
- This license is authorized for commercial development across up to 2 workstations used simultaneously by you.
- Do NOT share or distribute this license ticket publicly on forums or GitHub repositories.
- Includes 14-day warranty replacement guarantee if the key encounters any verification failures.
- For priority support or activation assistance, open a support ticket with your Order ID.`,
    activationSteps: [
      {
        stepNumber: 1,
        title: 'Download JetBrains IDE or Toolbox',
        instruction: 'Download the official installer for your operating system (Windows, macOS, or Linux) directly from jetbrains.com/products.',
      },
      {
        stepNumber: 2,
        title: 'Navigate to Registration Dialog',
        instruction: 'Launch the application and select Help -> Register from the top menu, or click Activate on the welcome window.',
      },
      {
        stepNumber: 3,
        title: 'Paste License Activation Code',
        instruction: 'Select "Activation Code", copy your key from your vault above, paste it into the code area, and click "Activate".',
      },
      {
        stepNumber: 4,
        title: 'Verify Subscription Status',
        instruction: 'Confirm the green checkmark appears showing valid commercial entitlement for your selected duration.',
      },
    ],
  },

  'adobe-creative-cloud-all-apps': {
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
      {
        stepNumber: 1,
        title: 'Open Adobe Redemption Portal',
        instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.',
      },
      {
        stepNumber: 2,
        title: 'Enter 24-Digit Voucher Code',
        instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.',
      },
      {
        stepNumber: 3,
        title: 'Download Desktop Suite',
        instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.',
      },
    ],
  },

  'microsoft-365-business-standard': {
    setupGuideUrl: 'https://support.microsoft.com/en-us/office/download-and-install-or-reinstall-microsoft-365-or-office-2021-on-a-pc-or-mac-4414eaaf-0478-48be-9c42-23adc4716658',
    defaultAccessLink: 'https://portal.office.com',
    activationProcess: `### Step-by-Step Microsoft 365 Business Standard Activation:
1. **Access Microsoft Setup:** Visit https://setup.office.com or https://microsoft365.com/setup.
2. **Sign In:** Sign in with your Microsoft account (e.g. @outlook.com or custom domain).
3. **Enter Product Key:** Copy your 25-character Microsoft Product Key (XXXXX-XXXXX-XXXXX-XXXXX-XXXXX) from your vault and paste it.
4. **Select Country/Region:** Confirm your country/region and preferred interface language.
5. **Install Desktop Apps:** Click 'Install Apps' to download the official 64-bit installer for Word, Excel, PowerPoint, Outlook, and Teams.
6. **Activate:** Open Word, sign in with your Microsoft account, and your software is automatically activated.`,
    orderNote: `⚠️ **Warranty & Support Guidelines:**
- Valid for up to 5 PCs/Macs + 5 Tablets + 5 Mobile devices simultaneously.
- 1 TB OneDrive storage is automatically linked to your registered Microsoft ID.
- Includes 14-day money-back/replacement warranty for non-activating keys.`,
    activationSteps: [
      {
        stepNumber: 1,
        title: 'Go to setup.office.com',
        instruction: 'Open setup.office.com and log in with your primary Microsoft account.',
      },
      {
        stepNumber: 2,
        title: 'Redeem 25-Digit License Key',
        instruction: 'Paste the 25-character license key displayed in your vault and click Next.',
      },
      {
        stepNumber: 3,
        title: 'Run Desktop Installer',
        instruction: 'Download the OfficeSetup.exe or PKG installer and follow on-screen instructions.',
      },
      {
        stepNumber: 4,
        title: 'Sign In to Word/Excel',
        instruction: 'Launch any Office app and sign in with the same Microsoft account to complete verification.',
      },
    ],
  },

  'google-workspace-enterprise-account': {
    setupGuideUrl: 'https://support.google.com/a/answer/182449',
    defaultAccessLink: 'https://accounts.google.com',
    activationProcess: `### Step-by-Step Google Workspace Enterprise Account Setup:
1. **Access Google Sign-In:** Go to https://accounts.google.com in an Incognito / Private browser window.
2. **Enter Username:** Copy the authorized email username provided in your vault credentials.
3. **Enter Temporary Password:** Copy the temporary password from your vault and click Next.
4. **Accept Terms & Set Password:** Read Google Workspace Terms of Service and set a strong, private permanent password.
5. **Setup 2-Step Verification:** Add your mobile number or Google Authenticator app for enhanced account security.
6. **Access Services:** Open drive.google.com for unlimited cloud storage and mail.google.com for Gmail.`,
    orderNote: `⚠️ **Critical Account Rules:**
- Change your temporary password IMMEDIATELY upon first login.
- Do NOT use this account for illegal torrenting or violating Google Cloud Acceptable Use Policies.
- Guaranteed 14-day replacement coverage if initial login authentication fails.`,
    activationSteps: [
      {
        stepNumber: 1,
        title: 'Sign in at accounts.google.com',
        instruction: 'Open an Incognito window and sign in using the provided username and password.',
      },
      {
        stepNumber: 2,
        title: 'Create Your New Password',
        instruction: 'Enter a secure, unique password known only to you and accept Workspace policies.',
      },
      {
        stepNumber: 3,
        title: 'Enable Two-Factor Authentication',
        instruction: 'Configure phone number or 2FA authenticator app to protect your enterprise account.',
      },
    ],
  },

  'grammarly-premium-business-account': {
    setupGuideUrl: 'https://support.grammarly.com',
    defaultAccessLink: 'https://app.grammarly.com',
    activationProcess: `### Step-by-Step Grammarly Business Setup:
1. **Go to Grammarly:** Open https://app.grammarly.com/signin.
2. **Input Credentials:** Enter the email and password provided in your BundleByte vault.
3. **Install Browser Extension:** Visit https://grammarly.com/browser to install Grammarly on Chrome, Edge, Safari, or Firefox.
4. **Install Desktop App:** Download Grammarly for Mac or Windows to enable real-time proofreading across all apps (Word, Slack, Notion, etc.).`,
    orderNote: `⚠️ **Account Rules:**
- Keep your login secure. Do not share login credentials across unauthorized third parties.
- Full 14-day warranty provided.`,
    activationSteps: [
      {
        stepNumber: 1,
        title: 'Log in at app.grammarly.com',
        instruction: 'Input the username and password delivered to your customer vault.',
      },
      {
        stepNumber: 2,
        title: 'Install Chrome/Desktop App',
        instruction: 'Add the browser extension or desktop app to enable AI corrections everywhere.',
      },
    ],
  },
};

// Generic fallback for any other products
const defaultEnrichment = {
  setupGuideUrl: 'https://bundlebyte.com/guides',
  defaultAccessLink: 'https://bundlebyte.com',
  activationProcess: `### Step-by-Step Software Activation Instructions:
1. **Download:** Download the latest official software build from the vendor portal.
2. **Install:** Run the setup installer following default system prompts.
3. **Activate:** Open the software, navigate to Help / Settings / License, and input your allocated digital key or authorized credentials.
4. **Enjoy:** Your subscription is now fully unlocked and operational!`,
  orderNote: `⚠️ **Post-Purchase Terms & Warranty:**
- 14-day replacement guarantee included if you encounter any authentication or key validation issues.
- Please retain your Order ID for any customer support communications.`,
  activationSteps: [
    {
      stepNumber: 1,
      title: 'Download Vendor Software',
      instruction: 'Download the official installer for your computer or device.',
    },
    {
      stepNumber: 2,
      title: 'Enter Digital License',
      instruction: 'Copy your license key from your vault and paste it into the application activation box.',
    },
    {
      stepNumber: 3,
      title: 'Verify & Use',
      instruction: 'Confirm activation succeeded and enjoy full unlocked features.',
    },
  ],
};

const runEnrichment = async () => {
  try {
    await connectDB();
    console.log('📦 Connected to MongoDB. Enriching products with activation instructions & order notes...');

    const products = await Product.find({});
    console.log(`Found ${products.length} products to evaluate.`);

    for (const prod of products) {
      const enrichment = enrichmentMap[prod.slug] || defaultEnrichment;

      // Always update if missing or using default placeholder
      prod.setupGuideUrl = prod.setupGuideUrl || enrichment.setupGuideUrl;
      prod.defaultAccessLink = prod.defaultAccessLink || enrichment.defaultAccessLink;
      prod.activationProcess = enrichment.activationProcess;
      prod.orderNote = enrichment.orderNote;
      prod.activationSteps = enrichment.activationSteps;

      await prod.save();
      console.log(`✅ Updated product: ${prod.title} (${prod.slug})`);
    }

    console.log('🎉 All products enriched with post-purchase activation instructions & order notes!');
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('Enrichment failed:', err);
    process.exit(1);
  }
};

runEnrichment();

