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
export const studentStatus = pgEnum("student_status", ["trial", "active", "paused", "frozen", "cancelled"]);
export const gradeKind = pgEnum("grade_kind", ["kup", "poom", "dan"]);
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
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("clubs_slug_key").on(t.slug)],
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
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
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
    createdAt: createdAt(),
  },
  (t) => [index("students_club_site_idx").on(t.clubId, t.siteId)],
);

/* ---------- Progress ---------- */

/** The club's belt ladder, lowest sort_order first (10th Kup … 1st Kup, 1st Poom, 1st Dan …). */
export const grades = pgTable("grades", {
  id: id(),
  clubId: clubId(),
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
  createdAt: createdAt(),
});

export const mandates = pgTable("mandates", {
  id: id(),
  clubId: clubId(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("gocardless"),
  providerMandateId: text("provider_mandate_id"),
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
  name: text("name").notNull(),
  /** 1 = Monday … 7 = Sunday */
  weekday: integer("weekday").notNull(),
  startsAt: time("starts_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  capacity: integer("capacity"),
});

export const sessions = pgTable("class_sessions", {
  id: id(),
  clubId: clubId(),
  classId: uuid("class_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
});

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

/* ---------- Marketing ---------- */

/**
 * Clubs registering interest from the public website. Not tenant data.
 * The app role may INSERT only; nobody can read these through the app (see drizzle/0004).
 */
export const foundingClubSignups = pgTable("founding_club_signups", {
  id: id(),
  clubName: text("club_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  activeStudents: text("active_students").notNull(),
  sites: integer("sites").notNull().default(1),
  currentSystem: text("current_system"),
  plan: text("plan"),
  consentToContact: boolean("consent_to_contact").notNull(),
  createdAt: createdAt(),
});

/** Tables protected by row-level security on club_id. Kept here so tests can check every one. */
export const TENANT_TABLES = [
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
] as const;
