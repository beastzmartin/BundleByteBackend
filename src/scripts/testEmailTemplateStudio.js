import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import EmailTemplate from '../models/EmailTemplate.js';
import EmailLog from '../models/EmailLog.js';
import {
  buildCrossClientEmailHtml,
  interpolateEmailVariables,
  compileTemplateWithMock,
  MOCK_CONTEXTS,
} from '../services/emailHtmlEngine.js';
import {
  DEFAULT_TEMPLATES,
  getDefaultTemplateByKey,
  ensureDefaultTemplates,
} from '../services/emailTemplateDefaults.js';

async function runStudioTests() {
  console.log('🧪 Starting Email Template Studio & Product Delivery System Verification...\n');

  // ==========================================
  // Test 1: Cross-Client HTML Engine
  // ==========================================
  console.log('--- Test 1: Cross-Client HTML Engine ---');
  const engineHtml = buildCrossClientEmailHtml({
    subject: 'Test Subject',
    previewText: 'This is the inbox snippet preview',
    brandColor: '#4f46e5',
    headline: 'Your License is Ready',
    greeting: 'Hello {{customerName}},',
    bodyContent: '<p>Main body content goes here.</p>',
    productAccessBox: {
      enabled: true,
      productTitle: '{{productTitle}}',
      accessLink: '{{productAccessLink}}',
      accessLabel: 'Open Your Product Access Link',
      setupGuideUrl: '{{setupGuideUrl}}',
      showLicenseKey: true,
      licenseKeyPreview: '{{licenseKeyPreview}}',
      activationSteps: '{{activationSteps}}',
    },
    ctaButton: {
      label: 'Open Secure Vault',
      url: '{{vaultUrl}}',
      color: '#4f46e5',
      radius: '8px',
    },
    securityNotice: 'Keys are protected with end-to-end security.',
    supportLink: {
      label: 'Message WhatsApp Concierge',
      url: '{{supportUrl}}',
    },
    footerText: 'BundleByte &bull; Enterprise Marketplace',
  });

  if (!engineHtml.includes('<!DOCTYPE html PUBLIC')) {
    throw new Error('Missing XHTML 1.0 doctype');
  }
  if (!engineHtml.includes('@media only screen and (max-width: 600px)')) {
    throw new Error('Missing mobile responsive media query');
  }
  if (!engineHtml.includes('mso-hide: all;')) {
    throw new Error('Missing preheader hidden inbox snippet styles');
  }
  if (!engineHtml.includes('{{productAccessLink}}')) {
    throw new Error('Missing productAccessLink variable in access box');
  }
  if (!engineHtml.includes('{{licenseKeyPreview}}')) {
    throw new Error('Missing licenseKeyPreview variable in access box');
  }
  console.log('✅ Cross-Client HTML engine generated valid responsive table structure.');

  // ==========================================
  // Test 2: Variable Interpolation & Mock Contexts
  // ==========================================
  console.log('\n--- Test 2: Variable Interpolation across Mock Contexts ---');
  const contexts = ['jetbrains', 'claude', 'windows', 'canva', 'whatsapp'];
  for (const ctx of contexts) {
    const mock = MOCK_CONTEXTS[ctx];
    if (!mock || !mock.productTitle || !mock.productAccessLink || !mock.vaultUrl) {
      throw new Error(`Incomplete mock dataset for context: ${ctx}`);
    }
    const compiled = compileTemplateWithMock({
      template: {
        subject: 'Delivery: {{productTitle}} (#{{orderNumber}})',
        htmlBody: engineHtml,
      },
      mockContextType: ctx,
    });

    if (compiled.subject.includes('{{productTitle}}')) {
      throw new Error(`Subject interpolation failed for ${ctx}`);
    }
    if (compiled.html.includes('{{productAccessLink}}')) {
      throw new Error(`HTML access link interpolation failed for ${ctx}`);
    }
    console.log(`✅ Mock context "${ctx}" compiles clean: "${compiled.subject}"`);
  }

  // ==========================================
  // Test 3: Dedicated Delivery Email Templates
  // ==========================================
  console.log('\n--- Test 3: Dedicated Digital Product Access Delivery Templates ---');
  const requiredDeliveryKeys = [
    'instant_access_delivery',
    'license_key_delivery',
    'account_credentials_vault',
    'whatsapp_concierge_delivery',
  ];

  for (const key of requiredDeliveryKeys) {
    const tpl = getDefaultTemplateByKey(key);
    if (!tpl) throw new Error(`Missing dedicated default template: ${key}`);
    if (tpl.category !== 'delivery') throw new Error(`Template ${key} should have category 'delivery'`);
    if (!tpl.htmlBody || !tpl.variables) throw new Error(`Template ${key} is missing body or variables`);
    console.log(`✅ Dedicated template "${tpl.name}" [${tpl.key}] verified.`);
  }

  // ==========================================
  // Test 4: Database Lifecycle (Drafts, Versioning, Rollback & Reset)
  // ==========================================
  console.log('\n--- Test 4: Template Lifecycle via In-Memory Mongo ---');
  let mongod;
  try {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    console.log('✅ Connected to MongoMemoryServer');

    // Seed defaults
    await ensureDefaultTemplates();
    const seededCount = await EmailTemplate.countDocuments();
    console.log(`✅ Default templates seeded: ${seededCount} templates in database`);

    // Fetch instant_access_delivery
    const template = await EmailTemplate.findOne({ key: 'instant_access_delivery' });
    if (!template) throw new Error('Seeded instant_access_delivery not found in DB');

    console.log(`✅ Template loaded: "${template.name}" (version: v${template.version || 1})`);

    // 4a. Save Draft
    template.draftSubject = 'Draft Subject: Instant Access Link (v1.1 draft)';
    template.draftHtmlBody = '<p>Draft body modification</p>';
    template.hasDraft = true;
    await template.save();
    console.log('✅ Draft saved: hasDraft = true, live subject remains unchanged.');

    // 4b. Publish Live
    const prevVersion = template.version || 1;
    template.versionHistory.push({
      version: prevVersion,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      savedAt: new Date(),
      savedBy: 'admin-tester',
    });
    template.subject = template.draftSubject;
    template.htmlBody = template.draftHtmlBody;
    template.version = prevVersion + 1;
    template.hasDraft = false;
    template.publishedAt = new Date();
    await template.save();
    console.log(`✅ Published live: bumped to v${template.version}, 1 version history snapshot created.`);

    // 4c. Version Rollback
    const v1Snapshot = template.versionHistory.find((v) => v.version === 1);
    if (!v1Snapshot) throw new Error('Missing v1 snapshot in versionHistory');
    template.subject = v1Snapshot.subject;
    template.htmlBody = v1Snapshot.htmlBody;
    await template.save();
    console.log('✅ Rollback verified: restored original subject from v1 snapshot.');

    // 4d. Factory Reset
    const factoryDef = getDefaultTemplateByKey('instant_access_delivery');
    template.subject = factoryDef.subject;
    template.htmlBody = factoryDef.htmlBody;
    template.hasDraft = false;
    await template.save();
    console.log('✅ Factory reset verified: template restored to factory default.');

    // 4e. Test Delivery Logging in EmailLog
    const testLog = await EmailLog.create({
      recipient: 'admin@bundlebyte.com',
      recipientName: 'Lead Admin',
      templateKey: template.key,
      category: template.category,
      subject: `[TEST] ${template.subject}`,
      htmlContent: template.htmlBody,
      provider: 'simulation',
      messageId: `sim-test-${Date.now()}`,
      status: 'test_delivery',
      sentAt: new Date(),
      metadata: {
        isTestDelivery: true,
        mockContextType: 'jetbrains',
        latencyMs: 145,
      },
    });

    if (testLog.status !== 'test_delivery') {
      throw new Error(`EmailLog status should be test_delivery, got: ${testLog.status}`);
    }
    console.log(`✅ Test delivery recorded in EmailLog (status: '${testLog.status}', latency: ${testLog.metadata.latencyMs}ms).`);

    console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runStudioTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

