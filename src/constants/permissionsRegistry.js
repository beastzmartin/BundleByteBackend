/**
 * Enterprise RBAC Permission Registry & Default System Roles
 * Covers 18 distinct modules, granular actions, and sensitivity ratings.
 */

export const SENSITIVITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const PERMISSION_MODULES = [
  { id: 'dashboard', name: 'Dashboard & Metrics', description: 'Executive KPIs, revenue cards, and analytics overview' },
  { id: 'products', name: 'Product Catalog', description: 'Digital products, variants, tiers, and pricing' },
  { id: 'account_inventory', name: 'Account Credentials Inventory', description: 'AES-256 encrypted bulk accounts, stock allocation' },
  { id: 'license_inventory', name: 'License Keys Inventory', description: 'Digital license keys pool and assignment' },
  { id: 'software_links', name: 'Software Access Links', description: 'Protected download URLs, build links, and activations' },
  { id: 'orders', name: 'Customer Orders', description: 'Order fulfillment, lifecycle tracking, and status transitions' },
  { id: 'payments', name: 'Payments & Gateways', description: 'Paytm Dynamic QR, Binance Pay, UTR verification, gateways' },
  { id: 'refunds', name: 'Refunds & Returns', description: 'Processing refunds, return requests, and chargebacks' },
  { id: 'wallets', name: 'Customer Wallets', description: 'Ledger balances, cashback, adjustments, and transactions' },
  { id: 'subscriptions', name: 'Recurring Subscriptions', description: 'Billing cycles, auto-renewals, and plan tiers' },
  { id: 'customers', name: 'Customer Management', description: 'User accounts, verification, 360 dossiers, notes, bans' },
  { id: 'support_tickets', name: 'Customer Support Tickets', description: 'Ticketing desk, resolution, SLAs, and assignment' },
  { id: 'live_chat', name: 'Live Chat & Messaging', description: 'Real-time customer inquiries and agent chat' },
  { id: 'marketing', name: 'Marketing & Promotions', description: 'Coupons, flash deals, banners, and promotional popups' },
  { id: 'email_notifications', name: 'Email & Notifications', description: 'SMTP delivery, templates, logs, Telegram alerts' },
  { id: 'website_management', name: 'Website Control Suite', description: 'Branding, logos, themes, custom pages, SEO meta' },
  { id: 'team_management', name: 'Team & RBAC Management', description: 'Team members, custom roles, permissions, departments' },
  { id: 'system_settings', name: 'System Settings & Security', description: 'Global platform settings, API keys, maintenance mode' },
  { id: 'reports_analytics', name: 'Reports & Business Intelligence', description: 'Financial reconciliation, exportable CSV/PDF reports' },
  { id: 'gst', name: 'GST & Tax Management', description: 'Centralized GSTIN, SAC codes, place of supply rules, and tax compliance' },
  { id: 'gateway_fees', name: 'Payment Gateway Fees', description: 'Gateway processing fee rules, percentage/fixed rates, and surcharges' },
];

export const PERMISSION_ACTIONS = [
  'view',
  'create',
  'read',
  'update',
  'delete',
  'manage',
  'approve',
  'export',
  'assign',
  'refund',
  'configure',
];

// Flat list of all available permissions in the system
export const PERMISSIONS_LIST = [
  // 1. Dashboard
  { key: 'dashboard.view', module: 'dashboard', action: 'view', description: 'View dashboard analytics & metrics', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'dashboard.export', module: 'dashboard', action: 'export', description: 'Export analytics & metrics data', sensitivity: SENSITIVITY_LEVELS.MEDIUM },

  // 2. Products
  { key: 'products.view', module: 'products', action: 'view', description: 'View products list and catalog', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'products.read', module: 'products', action: 'read', description: 'Read detailed product information', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'products.create', module: 'products', action: 'create', description: 'Create new products & variants', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'products.update', module: 'products', action: 'update', description: 'Edit existing products and pricing', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'products.delete', module: 'products', action: 'delete', description: 'Delete products from catalog', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'products.manage', module: 'products', action: 'manage', description: 'Full catalog control and category assignment', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'products.export', module: 'products', action: 'export', description: 'Export products catalog to CSV/JSON', sensitivity: SENSITIVITY_LEVELS.MEDIUM },

  // 3. Account Inventory
  { key: 'account_inventory.view', module: 'account_inventory', action: 'view', description: 'View account stock levels & counts', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'account_inventory.read', module: 'account_inventory', action: 'read', description: 'Decrypt and read raw account credentials', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'account_inventory.create', module: 'account_inventory', action: 'create', description: 'Add new account credentials or bulk import', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'account_inventory.update', module: 'account_inventory', action: 'update', description: 'Edit account credential entries', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'account_inventory.delete', module: 'account_inventory', action: 'delete', description: 'Delete accounts from inventory', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'account_inventory.manage', module: 'account_inventory', action: 'manage', description: 'Full account stock inventory management', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'account_inventory.export', module: 'account_inventory', action: 'export', description: 'Export encrypted account stock', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 4. License Inventory
  { key: 'license_inventory.view', module: 'license_inventory', action: 'view', description: 'View license keys availability', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'license_inventory.read', module: 'license_inventory', action: 'read', description: 'Read raw license key codes', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'license_inventory.create', module: 'license_inventory', action: 'create', description: 'Import license keys into pool', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'license_inventory.update', module: 'license_inventory', action: 'update', description: 'Modify license key details or status', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'license_inventory.delete', module: 'license_inventory', action: 'delete', description: 'Delete license keys from pool', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'license_inventory.manage', module: 'license_inventory', action: 'manage', description: 'Full license pool administration', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'license_inventory.export', module: 'license_inventory', action: 'export', description: 'Export license keys inventory', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 5. Software Links
  { key: 'software_links.view', module: 'software_links', action: 'view', description: 'View software link inventories', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'software_links.read', module: 'software_links', action: 'read', description: 'Read protected software download links', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'software_links.create', module: 'software_links', action: 'create', description: 'Add new software download assets', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'software_links.update', module: 'software_links', action: 'update', description: 'Update software download URLs & instructions', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'software_links.delete', module: 'software_links', action: 'delete', description: 'Delete software access links', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'software_links.manage', module: 'software_links', action: 'manage', description: 'Full software download catalog control', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'software_links.export', module: 'software_links', action: 'export', description: 'Export software links list', sensitivity: SENSITIVITY_LEVELS.MEDIUM },

  // 6. Orders
  { key: 'orders.view', module: 'orders', action: 'view', description: 'View orders overview & list', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'orders.read', module: 'orders', action: 'read', description: 'Read complete order details & customer items', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'orders.create', module: 'orders', action: 'create', description: 'Manually create administrative orders', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'orders.update', module: 'orders', action: 'update', description: 'Update order delivery status or details', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'orders.delete', module: 'orders', action: 'delete', description: 'Delete or cancel customer orders', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'orders.manage', module: 'orders', action: 'manage', description: 'Full order lifecycle & fulfillment dispatch', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'orders.approve', module: 'orders', action: 'approve', description: 'Approve manual delivery queue fulfillment', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'orders.export', module: 'orders', action: 'export', description: 'Export orders history & accounting reports', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'orders.refund', module: 'orders', action: 'refund', description: 'Issue order refund directly', sensitivity: SENSITIVITY_LEVELS.CRITICAL },

  // 7. Payments
  { key: 'payments.view', module: 'payments', action: 'view', description: 'View payment transactions & status', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'payments.read', module: 'payments', action: 'read', description: 'Inspect payment gateways, logs & UTR matches', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'payments.manage', module: 'payments', action: 'manage', description: 'Reconcile payments & confirm manual UTRs', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'payments.approve', module: 'payments', action: 'approve', description: 'Approve high-value transactions or UTRs', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'payments.refund', module: 'payments', action: 'refund', description: 'Trigger gateway refunds (Paytm/Binance/Crypto)', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'payments.configure', module: 'payments', action: 'configure', description: 'Manage Paytm MID/Keys & Binance API secrets', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'payments.export', module: 'payments', action: 'export', description: 'Export payment ledger & financial statements', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 8. Refunds
  { key: 'refunds.view', module: 'refunds', action: 'view', description: 'View refund requests queue', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'refunds.read', module: 'refunds', action: 'read', description: 'Review refund justifications and evidence', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'refunds.update', module: 'refunds', action: 'update', description: 'Change refund status or assign reviewer', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'refunds.approve', module: 'refunds', action: 'approve', description: 'Approve refund request and authorize payout', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'refunds.refund', module: 'refunds', action: 'refund', description: 'Execute payout to wallet or original gateway', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'refunds.export', module: 'refunds', action: 'export', description: 'Export refunds audit report', sensitivity: SENSITIVITY_LEVELS.MEDIUM },

  // 9. Wallets
  { key: 'wallets.view', module: 'wallets', action: 'view', description: 'View customer wallet balances', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'wallets.read', module: 'wallets', action: 'read', description: 'Inspect detailed customer wallet ledger', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'wallets.update', module: 'wallets', action: 'update', description: 'Adjust wallet balance (credit/debit adjustments)', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'wallets.manage', module: 'wallets', action: 'manage', description: 'Full wallet ledger management & freeze controls', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'wallets.approve', module: 'wallets', action: 'approve', description: 'Approve large wallet balance adjustments', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'wallets.export', module: 'wallets', action: 'export', description: 'Export wallet balances and transaction logs', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 10. Subscriptions
  { key: 'subscriptions.view', module: 'subscriptions', action: 'view', description: 'View active subscriptions list', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'subscriptions.read', module: 'subscriptions', action: 'read', description: 'Inspect subscription details & renewal logs', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'subscriptions.create', module: 'subscriptions', action: 'create', description: 'Create subscription plans or manually enroll', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'subscriptions.update', module: 'subscriptions', action: 'update', description: 'Update subscriber renewal date or plan tier', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'subscriptions.delete', module: 'subscriptions', action: 'delete', description: 'Cancel or terminate customer subscription', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'subscriptions.manage', module: 'subscriptions', action: 'manage', description: 'Full recurring subscriptions administration', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'subscriptions.export', module: 'subscriptions', action: 'export', description: 'Export subscriptions subscriber list', sensitivity: SENSITIVITY_LEVELS.MEDIUM },

  // 11. Customers
  { key: 'customers.view', module: 'customers', action: 'view', description: 'View customers directory', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'customers.read', module: 'customers', action: 'read', description: 'View 360-degree customer profile & orders history', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'customers.create', module: 'customers', action: 'create', description: 'Create customer account manually', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'customers.update', module: 'customers', action: 'update', description: 'Update customer contact info and notes', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'customers.delete', module: 'customers', action: 'delete', description: 'Suspend or ban customer account', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'customers.manage', module: 'customers', action: 'manage', description: 'Full customer identity controls & session revocation', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'customers.export', module: 'customers', action: 'export', description: 'Export customers directory to CSV', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 12. Support Tickets
  { key: 'support_tickets.view', module: 'support_tickets', action: 'view', description: 'View customer support tickets', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.read', module: 'support_tickets', action: 'read', description: 'Read ticket correspondence and attachments', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.create', module: 'support_tickets', action: 'create', description: 'Open support tickets on behalf of customer', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.reply', module: 'support_tickets', action: 'update', description: 'Reply to customer tickets', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.update', module: 'support_tickets', action: 'update', description: 'Modify ticket properties, priority, and metadata', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.assign', module: 'support_tickets', action: 'assign', description: 'Assign tickets to agents or departments', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.transfer', module: 'support_tickets', action: 'manage', description: 'Transfer tickets across departments or agents', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'support_tickets.resolve', module: 'support_tickets', action: 'manage', description: 'Mark support tickets as resolved', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.close', module: 'support_tickets', action: 'manage', description: 'Officially close support tickets', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.reopen', module: 'support_tickets', action: 'manage', description: 'Reopen resolved or closed tickets', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.escalate', module: 'support_tickets', action: 'manage', description: 'Escalate tickets to managers or senior tiers', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'support_tickets.internal_notes', module: 'support_tickets', action: 'manage', description: 'Add and view staff-only internal discussion notes', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.view_all', module: 'support_tickets', action: 'view', description: 'View all organization-wide tickets', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'support_tickets.view_assigned', module: 'support_tickets', action: 'view', description: 'View tickets specifically assigned to self', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'support_tickets.delete', module: 'support_tickets', action: 'delete', description: 'Permanently purge support tickets', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'support_tickets.manage', module: 'support_tickets', action: 'manage', description: 'Full ticket queue management and SLA configuration', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'support_tickets.export', module: 'support_tickets', action: 'export', description: 'Export support tickets SLA & response logs', sensitivity: SENSITIVITY_LEVELS.LOW },

  // 13. Live Chat
  { key: 'live_chat.view', module: 'live_chat', action: 'view', description: 'View active chat conversations queue', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.read', module: 'live_chat', action: 'read', description: 'Read incoming live messages from customers', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.reply', module: 'live_chat', action: 'update', description: 'Participate and reply to live customer chats', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.update', module: 'live_chat', action: 'update', description: 'Update chat status, category and priority', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.assign', module: 'live_chat', action: 'assign', description: 'Claim or assign chat to specific support agent', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.transfer', module: 'live_chat', action: 'manage', description: 'Transfer live conversation to another agent/department', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'live_chat.resolve', module: 'live_chat', action: 'manage', description: 'Mark active chat as resolved', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.reopen', module: 'live_chat', action: 'manage', description: 'Reactivate an ended chat session', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.view_all', module: 'live_chat', action: 'view', description: 'View all ongoing live chats organization-wide', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'live_chat.view_assigned', module: 'live_chat', action: 'view', description: 'View only chats directly assigned to self', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.view_customer_details', module: 'live_chat', action: 'read', description: 'Inspect 360 customer profile in live chat drawer', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.view_order_details', module: 'live_chat', action: 'read', description: 'Inspect customer order history & transactions in chat', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.attachments', module: 'live_chat', action: 'create', description: 'Send and receive media attachments in chat', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.internal_notes', module: 'live_chat', action: 'manage', description: 'Leave private internal notes inside chat timeline', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'live_chat.manage_settings', module: 'live_chat', action: 'configure', description: 'Configure live chat business hours, auto-replies and routing', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'live_chat.manage', module: 'live_chat', action: 'manage', description: 'End, convert or re-queue live conversations', sensitivity: SENSITIVITY_LEVELS.MEDIUM },

  // 14. Marketing
  { key: 'marketing.view', module: 'marketing', action: 'view', description: 'View campaigns, promo codes & banners', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'marketing.create', module: 'marketing', action: 'create', description: 'Create coupon codes, deals, and popups', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'marketing.read', module: 'marketing', action: 'read', description: 'Inspect campaign conversion rates & metrics', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'marketing.update', module: 'marketing', action: 'update', description: 'Modify discount values and banner dates', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'marketing.delete', module: 'marketing', action: 'delete', description: 'Delete promotions and marketing assets', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'marketing.manage', module: 'marketing', action: 'manage', description: 'Full marketing suite and coupon campaigns', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'marketing.export', module: 'marketing', action: 'export', description: 'Export promotion performance reports', sensitivity: SENSITIVITY_LEVELS.LOW },

  // 15. Email & Notifications
  { key: 'email_notifications.view', module: 'email_notifications', action: 'view', description: 'View notification queue and SMTP delivery logs', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'email_notifications.read', module: 'email_notifications', action: 'read', description: 'Inspect sent message bodies and recipient logs', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'email_notifications.create', module: 'email_notifications', action: 'create', description: 'Compose email templates & announcements', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'email_notifications.update', module: 'email_notifications', action: 'update', description: 'Edit templates, layout variables & headers', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'email_notifications.delete', module: 'email_notifications', action: 'delete', description: 'Delete email templates or cancel queue items', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'email_notifications.manage', module: 'email_notifications', action: 'manage', description: 'Broadcast newsletters & system-wide alerts', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'email_notifications.configure', module: 'email_notifications', action: 'configure', description: 'Configure SMTP credentials & Telegram Bot tokens', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'email_notifications.export', module: 'email_notifications', action: 'export', description: 'Export email delivery & bounce logs', sensitivity: SENSITIVITY_LEVELS.LOW },

  // 16. Website Management
  { key: 'website_management.view', module: 'website_management', action: 'view', description: 'View website control center preview', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'website_management.create', module: 'website_management', action: 'create', description: 'Add new pages, navigation links, popups', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'website_management.read', module: 'website_management', action: 'read', description: 'Inspect draft pages & layout configurations', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'website_management.update', module: 'website_management', action: 'update', description: 'Update logos, banners, themes, navigation', sensitivity: SENSITIVITY_LEVELS.MEDIUM },
  { key: 'website_management.delete', module: 'website_management', action: 'delete', description: 'Delete custom pages, banners or popups', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'website_management.manage', module: 'website_management', action: 'manage', description: 'Publish site versions & emergency banner triggers', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'website_management.configure', module: 'website_management', action: 'configure', description: 'Modify SEO head scripts, robots.txt, sitemap', sensitivity: SENSITIVITY_LEVELS.CRITICAL },

  // 17. Team Management
  { key: 'team_management.view', module: 'team_management', action: 'view', description: 'View team members directory & hierarchy', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'team_management.create', module: 'team_management', action: 'create', description: 'Invite new team members & create custom roles', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'team_management.read', module: 'team_management', action: 'read', description: 'Inspect team member profiles & role details', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'team_management.update', module: 'team_management', action: 'update', description: 'Edit team members, roles & permission matrix', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'team_management.delete', module: 'team_management', action: 'delete', description: 'Remove team members & delete custom roles', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'team_management.manage', module: 'team_management', action: 'manage', description: 'Suspend members, revoke sessions & force logout', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'team_management.approve', module: 'team_management', action: 'approve', description: 'Approve sensitive team role elevation requests', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'team_management.assign', module: 'team_management', action: 'assign', description: 'Assign roles & departments to team members', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'team_management.configure', module: 'team_management', action: 'configure', description: 'Configure department structure & approval policies', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'team_management.export', module: 'team_management', action: 'export', description: 'Export team roster & RBAC audit history', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 18. System Settings
  { key: 'system_settings.view', module: 'system_settings', action: 'view', description: 'View system configuration overview', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'system_settings.read', module: 'system_settings', action: 'read', description: 'Inspect general platform configurations', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'system_settings.update', module: 'system_settings', action: 'update', description: 'Update platform parameters, maintenance banner', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'system_settings.manage', module: 'system_settings', action: 'manage', description: 'Toggle maintenance mode, purge cache', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'system_settings.configure', module: 'system_settings', action: 'configure', description: 'Modify core security parameters & system envs', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'system_settings.export', module: 'system_settings', action: 'export', description: 'Export system configuration diagnostics', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 19. Reports & Analytics
  { key: 'reports_analytics.view', module: 'reports_analytics', action: 'view', description: 'View financial & business intelligence reports', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'reports_analytics.read', module: 'reports_analytics', action: 'read', description: 'Access deep ledger audit & reconciliation analytics', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'reports_analytics.export', module: 'reports_analytics', action: 'export', description: 'Export accounting & tax reports to Excel/CSV', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 20. GST & Tax Management
  { key: 'gst.view', module: 'gst', action: 'view', description: 'View GST configuration and tax calculations', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'gst.settings.manage', module: 'gst', action: 'manage', description: 'Configure GSTIN, legal name, and default rates', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'gst.rules.manage', module: 'gst', action: 'manage', description: 'Manage HSN/SAC codes and category classifications', sensitivity: SENSITIVITY_LEVELS.HIGH },
  { key: 'gst.reports.view', module: 'gst', action: 'view', description: 'View GST reconciliation & sales register reports', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'gst.reports.export', module: 'gst', action: 'export', description: 'Export GST reports for tax return filing', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 21. Payment Gateway Fees
  { key: 'gateway_fees.view', module: 'gateway_fees', action: 'view', description: 'View payment gateway fee configurations', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'gateway_fees.manage', module: 'gateway_fees', action: 'manage', description: 'Modify gateway percentage/fixed fee rules and surcharges', sensitivity: SENSITIVITY_LEVELS.CRITICAL },
  { key: 'gateway_fees.reports.view', module: 'gateway_fees', action: 'view', description: 'Inspect gateway fee ledger and merchant absorption telemetry', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'gateway_fees.reports.export', module: 'gateway_fees', action: 'export', description: 'Export gateway fees reconciliation report', sensitivity: SENSITIVITY_LEVELS.HIGH },

  // 22. Invoices & Tax Audit
  { key: 'invoices.tax.view', module: 'system_settings', action: 'view', description: 'Inspect tax breakdown on all official invoices', sensitivity: SENSITIVITY_LEVELS.LOW },
  { key: 'invoices.tax.manage', module: 'system_settings', action: 'manage', description: 'Manage tax invoice sequences and credit notes', sensitivity: SENSITIVITY_LEVELS.HIGH },
];

/**
 * 12 Default Enterprise Roles Definition
 */
export const DEFAULT_SYSTEM_ROLES = [
  {
    name: 'Super Admin / Owner',
    slug: 'super_admin',
    description: 'Ultimate organization authority. Unrestricted access to all marketplace resources, billing, and configurations.',
    isSystemRole: true,
    isProtected: true,
    permissions: ['*'],
  },
  {
    name: 'Administrator',
    slug: 'admin',
    description: 'Senior enterprise administrator with comprehensive operational, financial, and team management capabilities.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.*',
      'products.*',
      'account_inventory.*',
      'license_inventory.*',
      'software_links.*',
      'orders.*',
      'payments.view', 'payments.read', 'payments.manage', 'payments.approve', 'payments.export',
      'refunds.*',
      'wallets.*',
      'subscriptions.*',
      'customers.*',
      'support_tickets.*',
      'live_chat.*',
      'marketing.*',
      'email_notifications.*',
      'website_management.*',
      'team_management.view', 'team_management.create', 'team_management.read', 'team_management.update', 'team_management.assign', 'team_management.export',
      'system_settings.view', 'system_settings.read', 'system_settings.update', 'system_settings.export',
      'reports_analytics.*',
    ],
  },
  {
    name: 'Operations Manager',
    slug: 'operations_manager',
    description: 'Oversees day-to-day digital product delivery, inventory levels, order dispatch, and manual fulfillment queues.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view', 'dashboard.export',
      'products.view', 'products.read', 'products.update', 'products.manage',
      'account_inventory.view', 'account_inventory.read', 'account_inventory.create', 'account_inventory.update', 'account_inventory.manage',
      'license_inventory.view', 'license_inventory.read', 'license_inventory.create', 'license_inventory.update', 'license_inventory.manage',
      'software_links.*',
      'orders.view', 'orders.read', 'orders.update', 'orders.manage', 'orders.approve', 'orders.export',
      'subscriptions.view', 'subscriptions.read', 'subscriptions.update',
      'support_tickets.view', 'support_tickets.read', 'support_tickets.update', 'support_tickets.assign',
      'reports_analytics.view',
    ],
  },
  {
    name: 'Finance Manager',
    slug: 'finance_manager',
    description: 'Controls financial transactions, multi-currency exchange rates, gateway reconciliation, and customer wallets.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view', 'dashboard.export',
      'payments.view', 'payments.read', 'payments.manage', 'payments.approve', 'payments.export',
      'refunds.view', 'refunds.read', 'refunds.update', 'refunds.approve', 'refunds.refund', 'refunds.export',
      'wallets.view', 'wallets.read', 'wallets.update', 'wallets.manage', 'wallets.approve', 'wallets.export',
      'orders.view', 'orders.read', 'orders.export',
      'customers.view', 'customers.read',
      'reports_analytics.*',
    ],
  },
  {
    name: 'Support Manager',
    slug: 'support_manager',
    description: 'Leads customer service teams, supervises support ticket queues, live chat dispatch, and customer relations.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view',
      'support_tickets.*',
      'live_chat.*',
      'customers.view', 'customers.read', 'customers.update',
      'orders.view', 'orders.read',
      'refunds.view', 'refunds.read', 'refunds.update',
      'email_notifications.view', 'email_notifications.read',
      'reports_analytics.view',
    ],
  },
  {
    name: 'Support Agent',
    slug: 'support_agent',
    description: 'Frontline customer support responding to support tickets, resolving inquiries, and handling live chat.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view',
      'support_tickets.view', 'support_tickets.read', 'support_tickets.reply', 'support_tickets.update', 'support_tickets.resolve', 'support_tickets.reopen', 'support_tickets.internal_notes', 'support_tickets.view_assigned',
      'live_chat.view', 'live_chat.read', 'live_chat.reply', 'live_chat.resolve', 'live_chat.view_assigned', 'live_chat.view_customer_details', 'live_chat.view_order_details', 'live_chat.attachments', 'live_chat.internal_notes',
      'customers.view', 'customers.read',
      'orders.view', 'orders.read',
    ],
  },
  {
    name: 'Product Manager',
    slug: 'product_manager',
    description: 'Creates and curates catalog products, digital categories, variants, pricing models, and coupon offers.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view',
      'products.*',
      'account_inventory.view',
      'license_inventory.view',
      'software_links.view',
      'marketing.view', 'marketing.read', 'marketing.create', 'marketing.update',
      'reports_analytics.view',
    ],
  },
  {
    name: 'Inventory Manager',
    slug: 'inventory_manager',
    description: 'Dedicated inventory specialist handling bulk account credential imports, license keys, and link pools.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view',
      'account_inventory.*',
      'license_inventory.*',
      'software_links.*',
      'products.view', 'products.read',
      'orders.view', 'orders.read',
    ],
  },
  {
    name: 'Order Manager',
    slug: 'order_manager',
    description: 'Specialist responsible for customer order tracking, manual delivery processing, and WhatsApp order dispatch.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view',
      'orders.view', 'orders.read', 'orders.update', 'orders.manage', 'orders.approve',
      'account_inventory.view', 'account_inventory.read',
      'license_inventory.view', 'license_inventory.read',
      'software_links.view', 'software_links.read',
      'customers.view', 'customers.read',
    ],
  },
  {
    name: 'Marketing Manager',
    slug: 'marketing_manager',
    description: 'Drives customer acquisition through coupon codes, promotional popups, homepage banners, and campaigns.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view',
      'marketing.*',
      'products.view', 'products.read',
      'website_management.view', 'website_management.read', 'website_management.update',
      'email_notifications.view', 'email_notifications.create',
      'reports_analytics.view',
    ],
  },
  {
    name: 'Content Manager',
    slug: 'content_manager',
    description: 'Responsible for public website pages, branding assets, documentation, announcements, and SEO metadata.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view',
      'website_management.*',
      'products.view', 'products.read', 'products.update',
      'marketing.view', 'marketing.read',
    ],
  },
  {
    name: 'Read-Only Analyst',
    slug: 'read_only_analyst',
    description: 'Non-modifying audit and analytical role with cross-departmental read and export access for reporting.',
    isSystemRole: true,
    isProtected: false,
    permissions: [
      'dashboard.view', 'dashboard.export',
      'products.view', 'products.read',
      'orders.view', 'orders.read', 'orders.export',
      'payments.view', 'payments.read', 'payments.export',
      'customers.view', 'customers.read', 'customers.export',
      'reports_analytics.*',
    ],
  },
];

/**
 * 7 Default Departments
 */
export const DEFAULT_DEPARTMENTS = [
  { name: 'Administration', slug: 'administration', description: 'Executive leadership, compliance, and governance' },
  { name: 'Customer Support', slug: 'customer_support', description: 'Ticketing desk, resolution, and live customer inquiries' },
  { name: 'Finance & Accounts', slug: 'finance', description: 'Financial reconciliation, gateway ledgers, and payouts' },
  { name: 'Operations & Fulfillment', slug: 'operations', description: 'Order fulfillment, manual dispatch, and quality assurance' },
  { name: 'Inventory & Procurement', slug: 'inventory', description: 'Account stock, license pool management, and software links' },
  { name: 'Marketing & Growth', slug: 'marketing', description: 'Promotional campaigns, customer acquisition, and merchandising' },
  { name: 'Engineering & Development', slug: 'development', description: 'Platform reliability, integrations, and technical maintenance' },
];

