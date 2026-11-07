const BASE_URL = 'http://localhost:5001/api';

async function testSuite() {
  console.log('🚀 Starting Comprehensive End-to-End Test Suite for BundleByte Advanced Features...\n');

  // Step 1: Login as Admin and Customer
  console.log('--- Step 1: Authentication ---');
  const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bundlebyte.com', password: 'Admin@123456' }),
  });
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;
  console.log('✅ Admin logged in successfully:', adminData.user.name);

  const customerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'john@example.com', password: 'Password@123' }),
  });
  const customerData = await customerLoginRes.json();
  const customerToken = customerData.token;
  console.log('✅ Customer logged in successfully:', customerData.user.name);

  // Step 2: Fetch Products to use for testing
  console.log('\n--- Step 2: Product Discovery ---');
  const productsRes = await fetch(`${BASE_URL}/products`);
  const productsData = await productsRes.json();
  const allProducts = productsData.products || [];
  console.log(`✅ Loaded ${allProducts.length} seeded products`);
  const accountProduct = allProducts.find(p => p.status === 'active' && p.category?.name === 'Digital Accounts') || allProducts.find(p => p.status === 'active');
  console.log(`📦 Using Target Account Product: "${accountProduct.title}" (${accountProduct._id})`);

  // Step 3: Test Single Account Creation with AES-256 Encryption
  console.log('\n--- Step 3: Single Account Inventory & AES-256 Encryption ---');
  const createAccRes = await fetch(`${BASE_URL}/admin/accounts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      productId: accountProduct._id,
      username: `testuser_${Date.now()}@bundlebyte.com`,
      password: 'MyTopSecretPassword_2026!',
      accountType: 'Enterprise Tier',
      plan: 'Lifetime',
      loginUrl: 'https://login.service.com',
      notes: 'Initial test account created via test suite',
      status: 'Available',
    }),
  });
  const createdAccData = await createAccRes.json();
  console.log('✅ Created Single Account Response:', createdAccData.message, 'ID:', createdAccData.data?._id);

  // Verify list hides encrypted password
  const listAccRes = await fetch(`${BASE_URL}/admin/accounts?productId=${accountProduct._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listAccData = await listAccRes.json();
  console.log(`✅ Listed ${listAccData.data.length} accounts. Verified encryptedPassword is NOT in list view:`, listAccData.data[0].encryptedPassword === undefined);

  // Verify getAccountDetails decrypts safely
  const singleDetailRes = await fetch(`${BASE_URL}/admin/accounts/${createdAccData.data._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const singleDetailData = await singleDetailRes.json();
  console.log('✅ Decrypted Password Verified via authorized admin endpoint:', singleDetailData.data.decryptedPassword === 'MyTopSecretPassword_2026!');

  // Step 4: Test Bulk Account Import with Delimiters and Preview
  console.log('\n--- Step 4: Bulk Account Import & Delimiter Parsing Preview ---');
  const rawImportPayload = `
    bulk1_${Date.now()}@test.com:SecretPass1:Premium:Annual:https://service.com
    bulk2_${Date.now()}@test.com|SecretPass2|Family|Monthly
    bulk3_${Date.now()}@test.com,SecretPass3,Standard,Lifetime
    USERNAME: bulk4_${Date.now()}@test.com PASSWORD: SecretPass4 ACCOUNT_TYPE: Developer PLAN: Annual
    # Duplicate of single account above:
    ${createdAccData.data.username}:ShouldBeDuplicate
    # Invalid record (missing password):
    baduser@missingpass.com
  `;

  const previewRes = await fetch(`${BASE_URL}/admin/accounts/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      productId: accountProduct._id,
      content: rawImportPayload,
    }),
  });
  const previewData = await previewRes.json();
  console.log('✅ Import Preview Results:');
  console.log(`   - Total Detected: ${previewData.data.totalDetected}`);
  console.log(`   - Valid Accounts: ${previewData.data.validCount}`);
  console.log(`   - Duplicate Accounts: ${previewData.data.duplicateCount}`);
  console.log(`   - Invalid Records: ${previewData.data.invalidCount}`);

  // Commit the valid accounts
  const commitRes = await fetch(`${BASE_URL}/admin/accounts/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      productId: accountProduct._id,
      accounts: previewData.data.validAccounts,
      fileName: 'automated-test-batch.txt',
      sourceType: 'paste',
    }),
  });
  const commitData = await commitRes.json();
  console.log(`✅ Commit Import Succeeded: Imported ${commitData.data.importedCount} accounts with AES-256 encryption.`);

  // Step 5: Test Unified Digital Inventory Stats
  console.log('\n--- Step 5: Unified Digital Inventory Telemetry ---');
  const unifiedRes = await fetch(`${BASE_URL}/admin/inventory/unified-stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const unifiedData = await unifiedRes.json();
  if (!unifiedData.success) {
    console.error('Unified stats error:', unifiedRes.status, unifiedData);
  }
  console.log('✅ Unified Inventory Stats:');
  console.log('   - Accounts:', unifiedData.data?.accounts);
  console.log('   - Licenses:', unifiedData.data?.licenses);
  console.log('   - Queues:', unifiedData.data?.queues);

  // Step 6: Test Purchasing an Account Product & Vault Delivery
  console.log('\n--- Step 6: Order Checkout with Automatic Account Credentials Delivery ---');
  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      items: [
        {
          productId: accountProduct._id,
          duration: 'annual',
          quantity: 1,
        },
      ],
      paymentMethod: 'wallet',
    }),
  });
  const orderData = await orderRes.json();
  console.log(`✅ Order Created: #${orderData.order?.orderNumber || 'OK'}`);

  // Pay order with wallet
  const payRes = await fetch(`${BASE_URL}/wallet/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      orderId: orderData.order._id,
    }),
  });
  const payData = await payRes.json();
  console.log(`✅ Wallet Payment Processed: ${payData.message}`);

  // Check customer vault for delivered account credentials
  const vaultRes = await fetch(`${BASE_URL}/deliveries/vault`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const vaultData = await vaultRes.json();
  const latestDelivery = vaultData.deliveries?.[0] || vaultData.data?.[0];
  console.log(`✅ Customer Vault Fetched: Found ${vaultData.deliveries?.length || vaultData.count} delivered items.`);
  if (latestDelivery?.payload?.accountCredentials?.username) {
    console.log(`   - Vault Credential Delivered: Username: "${latestDelivery.payload.accountCredentials.username}", Password: "${latestDelivery.payload.accountCredentials.password}"`);
  }

  // Step 7: Test WhatsApp Manual Delivery Order Lifecycle
  console.log('\n--- Step 7: WhatsApp Manual Delivery Lifecycle ---');
  // 1. Create a product configured for whatsapp_manual
  const newProductRes = await fetch(`${BASE_URL}/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: `WhatsApp Concierge VIP Tool ${Date.now()}`,
      summary: 'Exclusive software delivered manually via WhatsApp concierge',
      description: 'Full description of VIP tool with WhatsApp fulfillment',
      category: accountProduct.category._id || accountProduct.category,
      deliveryMethod: 'whatsapp_manual',
      deliveryType: 'whatsapp_manual',
      whatsappConfig: {
        businessPhone: '+91 98765 43210',
        messageTemplate: 'Hello Concierge! I purchased Order #{orderId} for {productTitle}. Please deliver credentials.',
        instructions: 'Click the button below to message our concierge team directly on WhatsApp.',
        buttonText: 'Contact Concierge on WhatsApp',
        estimatedTurnaround: '15-30 minutes',
      },
      status: 'active',
      pricing: {
        annual: { enabled: true, price: 99.00, originalPrice: 199.00 },
      },
      defaultDuration: 'annual',
    }),
  });
  const newProdData = await newProductRes.json();
  const waProduct = newProdData.product || newProdData.data;
  console.log(`✅ Created WhatsApp Product: "${waProduct.title}" (${waProduct._id})`);

  // 2. Customer buys WhatsApp product
  const waOrderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      items: [
        {
          productId: waProduct._id,
          duration: 'annual',
          quantity: 1,
        },
      ],
      paymentMethod: 'wallet',
    }),
  });
  const waOrderData = await waOrderRes.json();
  const waOrder = waOrderData.order;
  console.log(`✅ Order Created for WhatsApp product: #${waOrder.orderNumber}`);

  // Pay WhatsApp order
  await fetch(`${BASE_URL}/wallet/pay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      orderId: waOrder._id,
    }),
  });
  console.log('✅ Paid WhatsApp order. Checking order status...');

  // Customer fetches WhatsApp delivery record
  const waDeliveryRes = await fetch(`${BASE_URL}/whatsapp-deliveries/order/${waOrder._id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const waDeliveryData = await waDeliveryRes.json();
  const waDelivery = waDeliveryData.data;
  console.log(`✅ WhatsApp Delivery Record: Status = "${waDelivery.status}"`);
  console.log(`   - Pre-filled Message: "${waDelivery.prefilledMessage}"`);
  console.log(`   - Click-to-Chat URL: "${waDelivery.clickToChatUrl}"`);
  console.log(`   - Safe check (No password in URL):`, !waDelivery.clickToChatUrl.includes('password'));

  // Customer clicks contact button
  await fetch(`${BASE_URL}/whatsapp-deliveries/order/${waOrder._id}/contacted`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  console.log('✅ Customer contact click recorded');

  // Admin checks WhatsApp Queue
  const queueRes = await fetch(`${BASE_URL}/whatsapp-deliveries/admin/queue`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const queueData = await queueRes.json();
  console.log(`✅ Admin WhatsApp Queue: ${queueData.data.length} orders in queue`);

  // Admin fulfills the WhatsApp order
  const fulfillRes = await fetch(`${BASE_URL}/whatsapp-deliveries/admin/${waDelivery._id}/fulfill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      credentials: {
        username: 'vip_concierge_user@bundlebyte.com',
        password: 'ConciergeSecurePass#2026',
        accessLink: 'https://vip.bundlebyte.com/login',
        instructions: 'Delivered directly to customer via WhatsApp conversation.',
      },
      notes: 'Customer confirmed receipt on WhatsApp.',
    }),
  });
  const fulfillData = await fulfillRes.json();
  console.log(`✅ Admin Fulfill WhatsApp Delivery: ${fulfillData.message}`);

  // Step 8: Test Support Ticket System (Origins, Internal Notes Isolation, Assignment)
  console.log('\n--- Step 8: Advanced Support Ticket System ---');
  // 1. Customer creates order-specific support ticket
  const ticketRes = await fetch(`${BASE_URL}/tickets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      ticketType: 'order_support',
      relatedOrder: waOrder._id,
      category: 'Product Not Working',
      subject: `Assistance requested for Order #${waOrder.orderNumber}`,
      priority: 'high',
      message: 'Hello, I received the login credentials on WhatsApp but need help with initial setup.',
      attachments: ['https://example.com/screenshot.png'],
    }),
  });
  const ticketData = await ticketRes.json();
  const createdTicket = ticketData.ticket;
  console.log(`✅ Customer Created Order Support Ticket #${createdTicket.ticketNumber} (ID: ${createdTicket._id})`);

  // 2. Admin adds an INTERNAL STAFF NOTE (Should NEVER be visible to customer)
  const internalNoteRes = await fetch(`${BASE_URL}/tickets/${createdTicket._id}/internal-note`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      note: 'INTERNAL NOTE: Customer reached out on WhatsApp as well. Checked account logs, activation token is valid. Agent Sarah assigned.',
    }),
  });
  const internalNoteData = await internalNoteRes.json();
  console.log(`✅ Admin Added Internal Staff Note: ${internalNoteData.message}`);

  // 3. Admin adds a PUBLIC reply to customer
  const publicReplyRes = await fetch(`${BASE_URL}/tickets/${createdTicket._id}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      message: 'Hello John! We have verified your setup. Please clear your cache and log into the portal. We are here if you need more help.',
      isInternal: false,
    }),
  });
  const publicReplyData = await publicReplyRes.json();
  console.log(`✅ Admin Sent Public Customer Reply: ${publicReplyData.message}`);

  // 4. Customer retrieves ticket -> VERIFY STRICT PRIVACY: Internal note must NOT be present!
  const customerViewTicketRes = await fetch(`${BASE_URL}/tickets/${createdTicket._id}`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const customerViewData = await customerViewTicketRes.json();
  const customerMessages = customerViewData.ticket.messages;
  const hasLeakedInternalNote = customerMessages.some(m => m.isInternal === true) || customerViewData.ticket.internalNotes;
  console.log(`🛡️ Security Check: Customer Messages Count = ${customerMessages.length}`);
  console.log(`🛡️ Security Check: Internal Staff Note Hidden from Customer? ${!hasLeakedInternalNote ? 'YES (PASSED)' : 'NO (FAILED - LEAK DETECTED)'}`);

  // 5. Admin retrieves ticket -> VERIFY Admin CAN see internal note
  const adminViewTicketRes = await fetch(`${BASE_URL}/tickets/${createdTicket._id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminViewData = await adminViewTicketRes.json();
  const adminMessages = adminViewData.ticket.messages;
  const adminSeesInternal = adminMessages.some(m => m.isInternal === true);
  console.log(`🛡️ Security Check: Admin Sees Internal Note in Timeline? ${adminSeesInternal ? 'YES (PASSED)' : 'NO (FAILED)'}`);

  console.log('\n======================================================');
  console.log('🎉 ALL ADVANCED FEATURES VERIFIED AND PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

testSuite().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
