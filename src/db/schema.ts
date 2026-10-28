import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  date,
  time,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/*
 * Junbi Phase 1 schema.
 *
 * Every tenant table carries club_id. Row-level security (see drizzle/0001_rls.sql)
 * makes the database itself refuse rows from any club other than the one set
 * for the current transaction, so a missed WHERE clause can never leak data.
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const clubId = () =>
  uuid("club_id")
    .notNull()
    .references(() => clubs.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const staffRole = pgEnum("staff_role", ["owner", "admin", "instructor", "assistant"]);
export const studentStatus = pgEnum("student_status", ["trial", "active", "paused", "frozen", "cancelled", "pending"]);
export const gradeKind = pgEnum("grade_kind", ["kup", "poom", "dan", "kyu", "grade"]);
export const gradingOutcome = pgEnum("grading_outcome", ["pass", "merit", "distinction", "fail"]);
export const billingInterval = pgEnum("billing_interval", ["monthly", "termly", "annual"]);
export const mandateStatus = pgEnum("mandate_status", [
  "pending_customer_approval",
  "pending_submission",
  "submitted",
  "active",
  "failed",
  "cancelled",
  "expired",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "submitted",
  "confirmed",
  "paid_out",
  "retrying",
  "failed",
  "charged_back",
  "cancelled",
]);
export const checkInMethod = pgEnum("check_in_method", ["kiosk", "register", "family_app"]);

/* ---------- Tenant root ---------- */

export const clubs = pgTable(
  "clubs",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    plan: text("plan").notNull().default("starter"),
    /** Joined through the Founding Club offer (50% off six months, price locked two years). */
    founding: boolean("founding").notNull().default(false),
    trialEndsOn: date("trial_ends_on"),
    /** Legacy: trial extensions were removed when the trial became 7 days. */
    trialExtended: boolean("trial_extended").notNull().default(false),
    /** Code used at sign-up or in Settings, e.g. a free account for a tester. */
    promoCode: text("promo_code"),
    /** Percentage off Junbi's price from the code. 100 means free. */
    discountPercent: integer("discount_percent"),
    /** How many paid months the discount lasts. Null with a discount means for good. */
    discountMonths: integer("discount_months"),
    /** One-off fee per new member, taken with their first payment. 0 = none. */
    signupFeePence: integer("signup_fee_pence").notNull().default(0),
    /** Secret part of the club's family sign-up link (/join/<token>). The owner can reset it. */
    joinToken: text("join_token")
      .notNull()
      .default(sql`replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')`),
    /** Set when the owner finishes club set-up (arts, first site, belt syllabus). */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /** Junbi charging the club: its customer and subscription on Junbi's own Stripe account. */
    billingCustomerId: text("billing_customer_id"),
    billingSubscriptionId: text("billing_subscription_id"),
    /** Stripe subscription status: trialing, active, past_due, unpaid, canceled, incomplete. Null = no card yet. */
    billingStatus: text("billing_status"),
    billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("clubs_slug_key").on(t.slug), uniqueIndex("clubs_join_token_key").on(t.joinToken)],
);

/**
 * The martial arts a club teaches. active = false means "coming soon, tell me when it's ready".
 * Discipline ids come from src/lib/disciplines.ts.
 */
export const clubDisciplines = pgTable(
  "club_disciplines",
  {
    clubId: clubId(),
    discipline: text("discipline").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.clubId, t.discipline] })],
);

export const sites = pgTable("sites", {
  id: id(),
  clubId: clubId(),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: createdAt(),
});

/* ---------- People ---------- */

/** A person who can sign in. Global: one login can be staff at one club and a guardian at another. */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** scrypt hash (see src/auth/password.ts). Null for people who have never set a password. */
    passwordHash: text("password_hash"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

/**
 * Signed-in sessions. Only a SHA-256 of the cookie token is stored, so a leaked
 * table can't be used to sign in. The app reaches this table only through the
 * SECURITY DEFINER functions in drizzle/0006_auth_functions.sql.
 */
export const authSessions = pgTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/** Failed sign-ins, used to slow down password guessing. */
export const authFailures = pgTable(
  "auth_failures",
  {
    id: id(),
    email: text("email").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_failures_email_at_idx").on(t.email, t.at)],
);

export const clubStaff = pgTable(
  "club_staff",
  {
    id: id(),
    clubId: clubId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: staffRole("role").notNull(),
    /** Owners and admins usually see every site; others are limited to staff_sites. */
    allSites: boolean("all_sites").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("club_staff_club_user_key").on(t.clubId, t.userId)],
);

export const staffSites = pgTable(
  "staff_sites",
  {
    clubId: clubId(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => clubStaff.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.siteId] })],
);

export const households = pgTable("households", {
  id: id(),
  clubId: clubId(),
  name: text("name").notNull(),
  /** Home address, shared by everyone in the family. */
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  town: text("town"),
  postcode: text("postcode"),
  /** Someone other than the parents to call in an emergency. */
  emergencyName: text("emergency_name"),
  emergencyPhone: text("emergency_phone"),
  createdAt: createdAt(),
});

export const guardians = pgTable("guardians", {
  id: id(),
  clubId: clubId(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  relationship: text("relationship").notNull().default("parent"),
  isPayer: boolean("is_payer").notNull().default(false),
  canCollect: boolean("can_collect").notNull().default(true),
  createdAt: createdAt(),
});

export const students = pgTable(
  "students",
  {
    id: id(),
    clubId: clubId(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "restrict" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "restrict" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth"),
    status: studentStatus("status").notNull().default("trial"),
    joinedOn: date("joined_on").notNull().defaultNow(),
    medicalNotes: text("medical_notes"),
    firstAidConsent: boolean("first_aid_consent").notNull().default(false),
    photoConsent: boolean("photo_consent").notNull().default(false),
    licenceNumber: text("licence_number"),
    licenceExpiresOn: date("licence_expires_on"),
    /** How they joined: "staff" (added by hand), "import" (spreadsheet) or "join_link" (family sign-up link). */
    source: text("source").notNull().default("staff"),
    createdAt: createdAt(),
  },
  (t) => [index("students_club_site_idx").on(t.clubId, t.siteId)],
);

/* ---------- Progress ---------- */

/** Each art's belt ladder, lowest sort_order first within a discipline (e.g. 10th Kup … 1st Dan, or White … Black). */
export const grades = pgTable("grades", {
  id: id(),
  clubId: clubId(),
  discipline: text("discipline").notNull().default("taekwondo"),
  name: text("name").notNull(),
  kind: gradeKind("kind").notNull(),
  sortOrder: integer("sort_order").notNull(),
  beltColour: text("belt_colour").notNull(),
  classesRequired: integer("classes_required").notNull().default(20),
});

/** Current rank is derived from the latest passing result, never stored on the student. */
export const gradingResults = pgTable("grading_results", {
  id: id(),
  clubId: clubId(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  gradeId: uuid("grade_id")
    .notNull()
    .references(() => grades.id, { onDelete: "restrict" }),
  gradedOn: date("graded_on").notNull(),
  outcome: gradingOutcome("outcome").notNull(),
  examiner: text("examiner"),
  createdAt: createdAt(),
});

/* ---------- Billing ---------- */

export const plans = pgTable("plans", {
  id: id(),
  clubId: clubId(),
  name: text("name").notNull(),
  amountPence: integer("amount_pence").notNull(),
  interval: billingInterval("interval").notNull().default("monthly"),
  active: boolean("active").notNull().default(true),
  /** Offered to new families on the sign-up link. Old prices can stay for existing members but be hidden here. */
  showOnSignup: boolean("show_on_signup").notNull().default(true),
});

/** The club's own Stripe or GoCardless account, connected to Junbi. One per club. */
export const clubPaymentAccounts = pgTable("club_payment_accounts", {
  clubId: uuid("club_id")
    .primaryKey()
    .references(() => clubs.id, { onDelete: "cascade" }),
  /** "stripe" or "gocardless" */
  provider: text("provider").notNull(),
  /** Stripe account id (acct_…) or GoCardless organisation id (OR…). */
  accountId: text("account_id").notNull(),
  /** GoCardless only: the club's access token, encrypted (see src/lib/payments/crypto.ts). */
  accessTokenEnc: text("access_token_enc"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A parent part-way through setting up Direct Debit from the sign-up link.
 * Finished by the provider's webhook, which starts the memberships.
 */
export const paymentSetups = pgTable("payment_setups", {
  id: id(),
  clubId: clubId(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  /** Stripe Checkout Session id or GoCardless Billing Request id. */
  providerRef: text("provider_ref"),
  /** [{ studentId, planId }] */
  items: jsonb("items").notNull(),
  /** pending, completed, abandoned */
  status: text("status").notNull().default("pending"),
  /** Total sign-up fee taken with the first payment (already multiplied by the number of members). */
  signupFeePence: integer("signup_fee_pence").notNull().default(0),
  createdAt: createdAt(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const memberships = pgTable("memberships", {
  id: id(),
  clubId: clubId(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "restrict" }),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  /** Stripe subscription or GoCardless subscription paying for this membership. */
  providerSubscriptionId: text("provider_subscription_id"),
  /** pending (waiting for Direct Debit), active, cancelled */
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const mandates = pgTable("mandates", {
  id: id(),
  clubId: clubId(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("stripe"),
  providerMandateId: text("provider_mandate_id"),
  /** Stripe customer or GoCardless customer the mandate belongs to. */
  providerCustomerId: text("provider_customer_id"),
  status: mandateStatus("status").notNull().default("pending_customer_approval"),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: id(),
  clubId: clubId(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  mandateId: uuid("mandate_id").references(() => mandates.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  amountPence: integer("amount_pence").notNull(),
  chargeDate: date("charge_date").notNull(),
  status: paymentStatus("status").notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  providerPaymentId: text("provider_payment_id"),
  createdAt: createdAt(),
});

/* ---------- Classes ---------- */

export const classes = pgTable("classes", {
  id: id(),
  clubId: clubId(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  discipline: text("discipline").notNull().default("taekwondo"),
  name: text("name").notNull(),
  /** 1 = Monday … 7 = Sunday */
  weekday: integer("weekday").notNull(),
  startsAt: time("starts_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  capacity: integer("capacity"),
  /** Archived classes drop off the timetable but keep their registers. */
  archived: boolean("archived").notNull().default(false),
});

export const sessions = pgTable(
  "class_sessions",
  {
    id: id(),
    clubId: clubId(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("class_sessions_class_starts_key").on(t.classId, t.startsAt)],
);

export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    clubId: clubId(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    method: checkInMethod("method").notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("attendance_session_student_key").on(t.sessionId, t.studentId)],
);

/* ---------- Audit ---------- */

export const auditLog = pgTable("audit_log", {
  id: id(),
  clubId: clubId(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Email ---------- */

/**
 * Password reset links. Only a SHA-256 of the token is stored. Reached only through
 * the SECURITY DEFINER functions in drizzle/0013_email_security.sql.
 */
export const passwordResets = pgTable("password_resets", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

/** Invitations for staff to join a club with a given role. */
export const staffInvites = pgTable(
  "staff_invites",
  {
    id: id(),
    clubId: clubId(),
    email: text("email").notNull(),
    role: staffRole("role").notNull(),
    allSites: boolean("all_sites").notNull().default(false),
    siteIds: uuid("site_ids").array().notNull().default(sql`'{}'::uuid[]`),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("staff_invites_token_key").on(t.tokenHash)],
);

/** Every email Junbi sends, for support and to avoid sending the same reminder twice. */
export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "cascade" }),
    toEmail: text("to_email").notNull(),
    template: text("template").notNull(),
    /** Stops duplicates, e.g. "trial-7:<club id>". */
    dedupeKey: text("dedupe_key"),
    status: text("status").notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_log_dedupe_key").on(t.dedupeKey)],
);

/** Tables protected by row-level security on club_id. Kept here so tests can check every one. */
/* ---------- Messages to parents ---------- */

/** One message sent by staff to a group of families. */
export const messages = pgTable("messages", {
  id: id(),
  clubId: clubId(),
  senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  /** Always "email" for now. */
  channel: text("channel").notNull().default("email"),
  /** Who it went to, e.g. { kind: "site", siteId } or { kind: "class", classId }. */
  audience: jsonb("audience").notNull(),
  /** Plain-words version for the history list, e.g. "Southport · everyone". */
  audienceLabel: text("audience_label").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: createdAt(),
});

/** Each family contact a message went to, with how it went. */
export const messageRecipients = pgTable("message_recipients", {
  id: id(),
  clubId: clubId(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  guardianId: uuid("guardian_id").references(() => guardians.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email"),
  /** queued, sent, logged (no email provider set up), failed */
  status: text("status").notNull().default("queued"),
  providerId: text("provider_id"),
  error: text("error"),
});

/**
 * Discount codes for Junbi's own price. Not tenant data: reached only through
 * the promo_check and promo_redeem functions.
 */
export const promoCodes = pgTable("promo_codes", {
  code: text("code").primaryKey(),
  percentOff: integer("percent_off").notNull(),
  /** Paid months the discount lasts. Null means for good. */
  months: integer("months"),
  maxUses: integer("max_uses"),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  note: text("note"),
  createdAt: createdAt(),
});

/**
 * Someone interested in joining: a parent who rang, a walk-in, a Facebook enquiry. They get a welcome email
 * when added and a reminder before their trial session, and turn into "converted" when they sign up.
 */
export const leads = pgTable("leads", {
  id: id(),
  clubId: clubId(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  /** The person we talk to: the parent, or the adult training. */
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  /** Who's training, when it's a child. Empty when the contact is training themselves. */
  studentName: text("student_name"),
  studentAge: integer("student_age"),
  /** Their trial session, if booked. */
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  sessionAt: timestamp("session_at", { withTimezone: true }),
  source: text("source"),
  notes: text("notes"),
  /** new, booked, attended, converted, lost */
  status: text("status").notNull().default("new"),
  convertedStudentId: uuid("converted_student_id").references(() => students.id, { onDelete: "set null" }),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  welcomeSentAt: timestamp("welcome_sent_at", { withTimezone: true }),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** What Junbi has charged each club (from Stripe invoices). */
export const junbiInvoices = pgTable(
  "junbi_invoices",
  {
    id: id(),
    clubId: clubId(),
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    amountPence: integer("amount_pence").notNull(),
    status: text("status").notNull(),
    hostedUrl: text("hosted_url"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("junbi_invoices_stripe_key").on(t.stripeInvoiceId)],
);

/** Junbi-wide settings, e.g. the billing webhook's signing secret (encrypted). Not club data. */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const TENANT_TABLES = [
  "club_disciplines",
  "staff_invites",
  "sites",
  "club_staff",
  "staff_sites",
  "households",
  "guardians",
  "students",
  "grades",
  "grading_results",
  "plans",
  "memberships",
  "mandates",
  "payments",
  "classes",
  "class_sessions",
  "attendance",
  "audit_log",
  "messages",
  "message_recipients",
  "club_payment_accounts",
  "payment_setups",
  "leads",
  "junbi_invoices",
] as const;
