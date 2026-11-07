import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://127.0.0.1:5001/api';

async function runVerification() {
  console.log('🧪 Starting End-to-End Verification: Post-Purchase Activation & Paytm Session Handling...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Check Public Catalog - Ensure NO activationProcess or orderNote leak
    console.log('\n--- 1. Testing Public Catalog Security ---');
    const catalogRes = await fetch(`${BASE_URL}/products`);
    const catalogData = await catalogRes.json();
    assert(catalogData.success === true, 'Public products endpoint responded with success');
    assert(catalogData.products && catalogData.products.length > 0, `Catalog returned ${catalogData.products?.length} products`);

    const leakedItem = catalogData.products.find(
      (p) => p.activationProcess !== undefined || p.orderNote !== undefined || p.activationSteps !== undefined
    );
    assert(!leakedItem, 'Public catalog query STRICTLY stripped activationProcess, orderNote, and activationSteps');

    const testProduct =
      catalogData.products.find((p) => p.deliveryType === 'instant_automated' && p.slug.includes('jetbrains')) ||
      catalogData.products.find((p) => p.deliveryType === 'instant_automated') ||
      catalogData.products[0];
    const testSlug = testProduct.slug;

    // 2. Check Anonymous Product Detail by Slug
    console.log(`\n--- 2. Testing Public Product Detail Slug (${testSlug}) ---`);
    const slugRes = await fetch(`${BASE_URL}/products/${testSlug}`);
    const slugData = await slugRes.json();
    assert(slugData.success === true, 'Public slug lookup succeeded');
    assert(slugData.product.hasPurchased === false, 'Visitor hasPurchased flag is false');
    assert(slugData.product.activationProcess === undefined, 'Public slug response does NOT contain activationProcess');
    assert(slugData.product.orderNote === undefined, 'Public slug response does NOT contain orderNote');
    assert(slugData.product.activationSteps === undefined, 'Public slug response does NOT contain activationSteps');

    // 3. Login as Admin
    console.log('\n--- 3. Testing Admin Privilege & Form Retrieval ---');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@bundlebyte.com',
        password: 'Admin@123456',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginData.success === true, 'Admin login succeeded');
    const adminToken = adminLoginData.token;

    // Admin accessing /api/products/admin/:id
    const adminProdRes = await fetch(`${BASE_URL}/products/admin/${testProduct._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminProdData = await adminProdRes.json();
    assert(adminProdData.success === true, 'Admin successfully fetched product by /admin/:id');
    assert(adminProdData.product.activationProcess !== undefined, 'Admin received activationProcess');
    assert(adminProdData.product.orderNote !== undefined, 'Admin received orderNote');
    assert(Array.isArray(adminProdData.product.activationSteps), 'Admin received activationSteps array');

    // 4. Customer Login & Purchase Flow
    console.log('\n--- 4. Testing Customer Order & Post-Purchase Vault Delivery ---');
    const custLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com',
        password: 'Password@123',
      }),
    });
    const custLoginData = await custLoginRes.json();
    assert(custLoginData.success === true, 'Customer login succeeded');
    const custToken = custLoginData.token;

    // Create an order for testProduct using UPI gateway
    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            product: testProduct._id,
            duration: 'annual',
            quantity: 1,
            unitPrice: testProduct.pricing?.annual?.price || 149.99,
          },
        ],
        paymentMethod: 'upi',
      }),
    });
    const orderData = await orderRes.json();
    assert(orderData.success === true, 'Customer created order successfully');
    const orderId = orderData.order._id;

    // Submit UPI UTR
    const uniqueUtr = `${Date.now().toString().slice(-12)}`;
    const utrRes = await fetch(`${BASE_URL}/payments/upi/submit-utr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        orderId,
        utr: uniqueUtr,
      }),
    });
    const utrData = await utrRes.json();
    assert(utrData.success === true, 'Customer submitted UPI UTR reference');

    if (utrData.pendingReview && utrData.claimId) {
      console.log(`Approving pending verification claim ${utrData.claimId} via Admin...`);
      const approveRes = await fetch(`${BASE_URL}/admin/binance/verify/${utrData.claimId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ notes: 'Verified in automated test' }),
      });
      const approveData = await approveRes.json();
      assert(approveData.success === true, 'Admin successfully approved payment claim');
    }

    // Verify order is now marked as paid
    const checkOrderRes = await fetch(`${BASE_URL}/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const checkOrderData = await checkOrderRes.json();
    assert(checkOrderData.success === true && checkOrderData.order.paymentStatus === 'paid', 'Order status verified as paid');

    // 5. Test Customer Product Detail After Purchase
    console.log('\n--- 5. Testing Verified Buyer Experience on Product Detail Page ---');
    const buyerSlugRes = await fetch(`${BASE_URL}/products/${testSlug}`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const buyerSlugData = await buyerSlugRes.json();
    assert(buyerSlugData.success === true, 'Buyer slug lookup succeeded');
    assert(buyerSlugData.product.hasPurchased === true, 'Verified buyer hasPurchased flag is true');
    assert(typeof buyerSlugData.product.activationProcess === 'string', 'Verified buyer received unlocked activationProcess');
    assert(typeof buyerSlugData.product.orderNote === 'string', 'Verified buyer received unlocked orderNote');

    // 6. Test Deliveries API & Purchased Products Vault
    console.log('\n--- 6. Testing Purchased Products Vault (/api/deliveries/my-products) ---');
    const vaultRes = await fetch(`${BASE_URL}/deliveries/my-products`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const vaultData = await vaultRes.json();
    assert(vaultData.success === true, 'Customer deliveries/my-products endpoint succeeded');
    assert(vaultData.products && vaultData.products.length > 0, `Vault returned ${vaultData.products?.length} products`);

    const purchasedVaultItem = vaultData.products.find((p) => p.productId === testProduct._id || p.orderId === orderId);
    assert(!!purchasedVaultItem, 'Purchased order item found in customer vault');
    if (purchasedVaultItem) {
      assert(typeof purchasedVaultItem.activationProcess === 'string', 'Vault item includes activationProcess');
      assert(typeof purchasedVaultItem.orderNote === 'string', 'Vault item includes orderNote');
      assert(Array.isArray(purchasedVaultItem.activationSteps), 'Vault item includes activationSteps array');
    }

    // 7. Test Order Details & Deliveries by Order ID (/api/deliveries/:orderId)
    console.log(`\n--- 7. Testing Delivery by Order ID (/api/deliveries/${orderId}) ---`);
    const delOrderRes = await fetch(`${BASE_URL}/deliveries/${orderId}`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const delOrderData = await delOrderRes.json();
    assert(delOrderData.success === true, 'Deliveries by orderId succeeded');
    assert(delOrderData.order.items && delOrderData.order.items.length > 0, 'Order returned items with activationProcess');
    assert(typeof delOrderData.order.items[0].activationProcess === 'string', 'Order item contains activationProcess snapshot');
    assert(typeof delOrderData.order.items[0].orderNote === 'string', 'Order item contains orderNote snapshot');

    // 8. Test Paytm Dynamic QR Initiation & Countdown
    console.log('\n--- 8. Testing Paytm 10-Minute Dynamic QR Initiation ---');
    const paytmInitRes = await fetch(`${BASE_URL}/payments/paytm/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${custToken}`,
      },
      body: JSON.stringify({
        isWalletTopup: true,
        amount: 500,
        currency: 'INR',
      }),
    });
    const paytmInitData = await paytmInitRes.json();
    assert(paytmInitData.success === true, 'Paytm Dynamic QR initiated successfully');
    assert(paytmInitData.payment.countdownSeconds === 600, `Paytm countdown is 600s (10 minutes) - got: ${paytmInitData.payment.countdownSeconds}`);
    assert(typeof paytmInitData.payment.qrCodeUrl === 'string', 'Paytm dynamic QR code URL generated');
    assert(typeof paytmInitData.payment.upiUri === 'string', 'Paytm dynamic UPI URI generated');

    const paytmPaymentId = paytmInitData.payment.paymentId;

    // 9. Test Paytm Polling Status
    console.log(`\n--- 9. Testing Paytm Polling Status (/api/payments/paytm/status/${paytmPaymentId}) ---`);
    const statusRes = await fetch(`${BASE_URL}/payments/paytm/status/${paytmPaymentId}`, {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    const statusData = await statusRes.json();
    assert(statusData.success === true, 'Paytm status polling returned valid response');
    assert(statusData.status === 'PENDING', `Paytm status is properly PENDING - got: ${statusData.status}`);

    console.log(`\n======================================================`);
    console.log(`🎉 ALL VERIFICATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('Unhandled verification error:', error);
    process.exit(1);
  }
}

runVerification();
